import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  computeSeedSha256,
  verifySeedFile,
  areFieldsEqual,
  validateDocumentPath,
  validateManifest,
  readManifestSafe,
  saveManifestIncremental,
  deleteDocSafe,
  executeRollbackAtomic,
  PROD_PROJECT,
  PROD_SUPER_ADMIN_UID,
  PROD_SUPER_ADMIN_EMAIL,
  APPROVED_COLLECTIONS
} from './import-canonical-production-seed.mjs';

function createMockCanonicalSeed() {
  const seed = {
    source: 'al-asas-dental-staging',
    target: 'al-asas-dental-prod',
    version: '1.5.0',
    generated_at: '2026-10-30T10:00:00.000Z',
    collections: {
      clinical_categories: {
        count: 1,
        items: [{
          name: `projects/${PROD_PROJECT}/databases/(default)/documents/clinical_categories/cat1`,
          fields: { name: { stringValue: 'Category 1' } }
        }]
      },
      universities: {
        count: 1,
        items: [{
          name: `projects/${PROD_PROJECT}/databases/(default)/documents/universities/kufa`,
          fields: { name: { stringValue: 'جامعة الكوفة' } }
        }]
      },
      provinces: {
        count: 1,
        items: [{
          name: `projects/${PROD_PROJECT}/databases/(default)/documents/provinces/baghdad`,
          fields: { name: { stringValue: 'بغداد' } }
        }]
      },
      areas: {
        count: 1,
        items: [{
          name: `projects/${PROD_PROJECT}/databases/(default)/documents/areas/area1`,
          fields: { name: { stringValue: 'Area 1' } }
        }]
      },
      subscription_plans: { count: 0, items: [] },
      branding_settings: { count: 0, items: [] },
      matching_settings: { count: 0, items: [] },
      system_settings: { count: 0, items: [] },
      profiles: {
        count: 1,
        items: [{
          name: `projects/${PROD_PROJECT}/databases/(default)/documents/profiles/${PROD_SUPER_ADMIN_UID}`,
          fields: {
            id: { stringValue: PROD_SUPER_ADMIN_UID },
            email: { stringValue: PROD_SUPER_ADMIN_EMAIL },
            role: { stringValue: 'SUPER_ADMIN' },
            status: { stringValue: 'VERIFIED' }
          }
        }]
      }
    }
  };
  seed.sha256 = computeSeedSha256(seed);
  return seed;
}

test('Production Seed Importer: Cryptographic Hash Verification', async () => {
  const seed = createMockCanonicalSeed();

  // 1. Genuine seed passes verification
  const isValid = await verifySeedFile(seed);
  assert.equal(isValid, true, 'Genuine seed must pass verification');

  // 2. Tampered seed hash is immediately rejected
  const tamperedHashSeed = { ...seed, sha256: 'deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678' };
  await assert.rejects(
    async () => verifySeedFile(tamperedHashSeed),
    /Canonical seed integrity check failed/,
    'Tampered hash must be rejected'
  );

  // 3. Tampered content without updating hash is rejected
  const tamperedContentSeed = JSON.parse(JSON.stringify(seed));
  tamperedContentSeed.collections.provinces.items.push({
    name: `projects/${PROD_PROJECT}/databases/(default)/documents/provinces/fake_province`,
    fields: { name: { stringValue: 'Fake' } }
  });
  await assert.rejects(
    async () => verifySeedFile(tamperedContentSeed),
    /Canonical seed integrity check failed/,
    'Tampered content must be caught by SHA-256'
  );
});

test('Production Seed Importer: Rejects Forbidden and Unapproved Collections', async () => {
  const seed = createMockCanonicalSeed();

  // Reject forbidden clinical collection
  const forbiddenSeed = JSON.parse(JSON.stringify(seed));
  forbiddenSeed.collections.patient_cases = { count: 1, items: [{ name: 'case1' }] };
  forbiddenSeed.sha256 = computeSeedSha256(forbiddenSeed);

  await assert.rejects(
    async () => verifySeedFile(forbiddenSeed),
    /Unapproved collection 'patient_cases' found in canonical seed|Forbidden clinical\/transactional collection/,
    'Must strictly reject forbidden clinical collections'
  );

  // Reject arbitrary unexpected collections
  const unapprovedSeed = JSON.parse(JSON.stringify(seed));
  unapprovedSeed.collections.arbitrary_data = { count: 1, items: [{ name: 'arb1' }] };
  unapprovedSeed.sha256 = computeSeedSha256(unapprovedSeed);

  await assert.rejects(
    async () => verifySeedFile(unapprovedSeed),
    /Unapproved collection 'arbitrary_data' found in canonical seed/,
    'Must strictly reject collections outside approved whitelist'
  );
});

test('Production Seed Importer: Strict Super Admin Profile Enforcement', async () => {
  const seed = createMockCanonicalSeed();

  // Reject non-owner profile email
  const badProfileEmail = JSON.parse(JSON.stringify(seed));
  badProfileEmail.collections.profiles.items[0].fields.email = { stringValue: 'attacker@evil.com' };
  badProfileEmail.sha256 = computeSeedSha256(badProfileEmail);

  await assert.rejects(
    async () => verifySeedFile(badProfileEmail),
    /Invalid Super Admin profile in seed/,
    'Must reject non-owner emails in Super Admin profile'
  );

  // Reject wrong production UID in fields
  const wrongUidSeed = JSON.parse(JSON.stringify(seed));
  wrongUidSeed.collections.profiles.items[0].fields.id = { stringValue: 'staging-uid-1234' };
  wrongUidSeed.sha256 = computeSeedSha256(wrongUidSeed);

  await assert.rejects(
    async () => verifySeedFile(wrongUidSeed),
    /Invalid Super Admin profile in seed/,
    'Must enforce production UID binding in profile fields'
  );

  // Reject wrong production UID in document path
  const wrongUidPathSeed = JSON.parse(JSON.stringify(seed));
  wrongUidPathSeed.collections.profiles.items[0].name = `projects/${PROD_PROJECT}/databases/(default)/documents/profiles/unauthorized-uid`;
  wrongUidPathSeed.sha256 = computeSeedSha256(wrongUidPathSeed);

  await assert.rejects(
    async () => verifySeedFile(wrongUidPathSeed),
    /Unauthorized profile document ID 'unauthorized-uid'/,
    'Must reject any profile document ID other than designated Super Admin UID'
  );
});

test('Production Seed Importer: Document Path Validation & Whitelist', () => {
  // Valid path passes
  const valid = validateDocumentPath(
    `projects/${PROD_PROJECT}/databases/(default)/documents/universities/kufa`,
    'universities'
  );
  assert.equal(valid.colName, 'universities');
  assert.equal(valid.docId, 'kufa');

  // Reject path traversal ..
  assert.throws(
    () => validateDocumentPath(`projects/${PROD_PROJECT}/databases/(default)/documents/universities/../secret`, 'universities'),
    /Illegal path characters or traversal detected/
  );

  // Reject invalid characters (slashes, query params, hash)
  assert.throws(
    () => validateDocumentPath(`projects/${PROD_PROJECT}/databases/(default)/documents/universities/kufa?hack=1`, 'universities'),
    /Illegal path characters or traversal detected/
  );

  // Reject unapproved collection in path
  assert.throws(
    () => validateDocumentPath(`projects/${PROD_PROJECT}/databases/(default)/documents/medical_notes/note1`, 'medical_notes'),
    /Unapproved collection 'medical_notes'/
  );

  // Reject mismatch between expected collection and path prefix
  assert.throws(
    () => validateDocumentPath(`projects/${PROD_PROJECT}/databases/(default)/documents/provinces/kufa`, 'universities'),
    /does not match expected collection|does not match expected prefix/
  );
});

test('Production Seed Importer: Safe Field Equality Check', () => {
  const f1 = { name: { stringValue: 'Baghdad' }, code: { stringValue: 'BG' } };
  const f2 = { name: { stringValue: 'Baghdad' }, code: { stringValue: 'BG' } };
  const f3 = { name: { stringValue: 'Basra' }, code: { stringValue: 'BA' } };

  assert.equal(areFieldsEqual(f1, f2), true);
  assert.equal(areFieldsEqual(f1, f3), false);
  assert.equal(areFieldsEqual(f1, null), false);
});

test('Production Seed Importer: Atomic Rollback with currentDocument.updateTime Precondition', async () => {
  const docPath = `projects/${PROD_PROJECT}/databases/(default)/documents/universities/kufa`;
  const initialUpdateTime = '2026-10-30T10:00:00.000000Z';

  // Refusal to delete without atomic precondition
  await assert.rejects(
    async () => deleteDocSafe('fake-token', docPath, null),
    /Refusing to delete .* without atomic expectedUpdateTime precondition/
  );

  // Mock fetch: intercepts DELETE request and verifies query parameter currentDocument.updateTime
  const originalFetch = globalThis.fetch;
  let requestedUrl = null;

  globalThis.fetch = async (url, options) => {
    requestedUrl = url;
    assert.equal(options.method, 'DELETE');
    const parsedUrl = new URL(url);
    const preconditionTime = parsedUrl.searchParams.get('currentDocument.updateTime');

    if (preconditionTime === initialUpdateTime) {
      return {
        status: 200,
        ok: true,
        text: async () => ''
      };
    } else {
      // Precondition mismatch returns HTTP 412
      return {
        status: 412,
        ok: false,
        text: async () => 'Precondition Failed: updateTime mismatch'
      };
    }
  };

  try {
    // 1. Rollback when document updateTime matches -> atomic deletion succeeds
    const successResult = await deleteDocSafe('fake-token', docPath, initialUpdateTime);
    assert.equal(successResult.status, 'DELETED');
    assert.match(requestedUrl, /currentDocument\.updateTime=2026-10-30T10%3A00%3A00\.000000Z/);

    // 2. Rollback when document updateTime does not match (concurrent modification in Firestore)
    const failResult = await deleteDocSafe('fake-token', docPath, '2026-10-30T09:00:00.000000Z');
    assert.equal(failResult.status, 'PRECONDITION_FAILED');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Production Seed Importer: Concurrent Modification During Rollback Simulation', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'seed-test-rollback-'));
  const testManifestPath = join(tmpDir, 'test-manifest.json');

  const initialUpdateTime = '2026-10-30T10:00:00.000Z';
  const manifest = {
    imported_at: '2026-10-30T10:00:00.000Z',
    target_project: PROD_PROJECT,
    seed_sha256: 'a'.repeat(64),
    created_docs: [
      {
        path: `projects/${PROD_PROJECT}/databases/(default)/documents/clinical_categories/cat1`,
        collection: 'clinical_categories',
        docId: 'cat1',
        updateTime: initialUpdateTime,
        created_at: '2026-10-30T10:00:00.000Z'
      },
      {
        path: `projects/${PROD_PROJECT}/databases/(default)/documents/universities/kufa`,
        collection: 'universities',
        docId: 'kufa',
        updateTime: initialUpdateTime,
        created_at: '2026-10-30T10:00:00.000Z'
      }
    ]
  };

  await writeFile(testManifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  // Simulation:
  // - cat1: untouched in Firestore -> initial inspection reports updateTime matches -> DELETE succeeds
  // - kufa: modified concurrently in Firestore -> inspect reports matches, but between inspect and delete
  //         a concurrent modification happened, so deleteDoc returns PRECONDITION_FAILED (HTTP 412).
  const mockGetDocInfo = async (token, docPath) => {
    return { exists: true, updateTime: initialUpdateTime, fields: {} };
  };

  const mockDeleteDocSafe = async (token, docPath, expectedUpdateTime) => {
    if (docPath.includes('cat1')) {
      return { status: 'DELETED' };
    }
    if (docPath.includes('kufa')) {
      // Concurrent update changed Firestore updateTime -> atomic precondition rejected
      return {
        status: 'PRECONDITION_FAILED',
        error: 'Precondition failed: document was modified concurrently'
      };
    }
    throw new Error('Unexpected docPath');
  };

  const result = await executeRollbackAtomic('token', manifest, testManifestPath, mockGetDocInfo, mockDeleteDocSafe);

  // Verification:
  // - cat1 was deleted
  // - kufa was PRESERVED due to atomic precondition failure
  assert.equal(result.deletedCount, 1, 'Only unmodified doc should be deleted');
  assert.equal(result.skippedModified, 1, 'Concurrently modified doc must be skipped and preserved');

  // Verify that the modified document remains recorded in the manifest, whereas deleted doc was pruned
  const updatedManifest = JSON.parse(await readFile(testManifestPath, 'utf8'));
  assert.equal(updatedManifest.created_docs.length, 1);
  assert.equal(updatedManifest.created_docs[0].docId, 'kufa');

  await rm(tmpDir, { recursive: true, force: true });
});

test('Production Seed Importer: Manifest Validation and Corrupted Manifest Rejection', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'seed-test-manifest-'));
  const testManifestPath = join(tmpDir, 'manifest.json');

  // 1. Non-existent manifest returns null safely
  const nullResult = await readManifestSafe(join(tmpDir, 'non_existent.json'));
  assert.equal(nullResult, null);

  // 2. Corrupted malformed JSON is rejected
  await writeFile(testManifestPath, '{"broken_json": ', 'utf8');
  await assert.rejects(
    async () => readManifestSafe(testManifestPath),
    /CRITICAL: Corrupted manifest file.*Malformed JSON/
  );

  // 3. Invalid target_project rejected
  const badTarget = {
    target_project: 'wrong-project',
    seed_sha256: 'b'.repeat(64),
    created_docs: []
  };
  await writeFile(testManifestPath, JSON.stringify(badTarget), 'utf8');
  await assert.rejects(
    async () => readManifestSafe(testManifestPath),
    /target_project 'wrong-project' does not match/
  );

  // 4. Missing atomic updateTime in entry is rejected
  const missingUpdateTime = {
    target_project: PROD_PROJECT,
    seed_sha256: 'c'.repeat(64),
    created_docs: [{
      path: `projects/${PROD_PROJECT}/databases/(default)/documents/clinical_categories/cat1`,
      collection: 'clinical_categories',
      docId: 'cat1'
      // missing updateTime
    }]
  };
  await writeFile(testManifestPath, JSON.stringify(missingUpdateTime), 'utf8');
  await assert.rejects(
    async () => readManifestSafe(testManifestPath),
    /is missing required atomic 'updateTime'/
  );

  // 5. Unapproved collection in manifest rejected
  const unapprovedCol = {
    target_project: PROD_PROJECT,
    seed_sha256: 'd'.repeat(64),
    created_docs: [{
      path: `projects/${PROD_PROJECT}/databases/(default)/documents/injected_coll/doc1`,
      collection: 'injected_coll',
      docId: 'doc1',
      updateTime: '2026-10-30T10:00:00.000Z'
    }]
  };
  await writeFile(testManifestPath, JSON.stringify(unapprovedCol), 'utf8');
  await assert.rejects(
    async () => readManifestSafe(testManifestPath),
    /has unapproved collection 'injected_coll'/
  );

  await rm(tmpDir, { recursive: true, force: true });
});

test('Production Seed Importer: Write Interruption and Resume Resilience', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'seed-test-interruption-'));
  const testManifestPath = join(tmpDir, 'manifest.json');

  const seedSha = 'e'.repeat(64);
  const initialManifest = {
    imported_at: '2026-10-30T10:00:00.000Z',
    target_project: PROD_PROJECT,
    seed_sha256: seedSha,
    created_docs: []
  };
  await saveManifestIncremental(initialManifest, testManifestPath);

  // Step 1: Write first doc, manifest flushes incrementally
  const doc1 = {
    path: `projects/${PROD_PROJECT}/databases/(default)/documents/clinical_categories/cat1`,
    collection: 'clinical_categories',
    docId: 'cat1',
    updateTime: '2026-10-30T10:00:01.000Z',
    created_at: '2026-10-30T10:00:01.000Z'
  };
  initialManifest.created_docs.push(doc1);
  await saveManifestIncremental(initialManifest, testManifestPath);

  // Simulated interruption happens here! (process terminated before doc2)
  // Step 2: Restart / Resume
  // Verify saved manifest contains exactly doc1 and is valid
  const resumedManifest = await readManifestSafe(testManifestPath);
  assert.equal(resumedManifest.created_docs.length, 1);
  assert.equal(resumedManifest.created_docs[0].docId, 'cat1');
  assert.equal(resumedManifest.created_docs[0].updateTime, '2026-10-30T10:00:01.000Z');

  // Importer resumes: doc1 already exists (skipped in Create-only mode)
  // doc2 is inserted and manifest is incrementally saved
  const doc2 = {
    path: `projects/${PROD_PROJECT}/databases/(default)/documents/universities/kufa`,
    collection: 'universities',
    docId: 'kufa',
    updateTime: '2026-10-30T10:00:02.000Z',
    created_at: '2026-10-30T10:00:02.000Z'
  };
  resumedManifest.created_docs.push(doc2);
  await saveManifestIncremental(resumedManifest, testManifestPath);

  // Verify final manifest after resume has both docs truthfully recorded
  const finalManifest = await readManifestSafe(testManifestPath);
  assert.equal(finalManifest.created_docs.length, 2);
  assert.equal(finalManifest.created_docs[0].docId, 'cat1');
  assert.equal(finalManifest.created_docs[1].docId, 'kufa');

  await rm(tmpDir, { recursive: true, force: true });
});
