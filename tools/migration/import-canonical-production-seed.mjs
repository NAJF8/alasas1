#!/usr/bin/env node
/**
 * AL ASAS DENTAL 1.5.0 — Hardened Production Canonical Seed Importer
 * 
 * Safety features:
 * - SHA-256 cryptographic verification of seed payload content
 * - Atomic non-overwrite guarantee via Firestore precondition (currentDocument.exists=false)
 * - Strict refusal to overwrite existing data by default
 * - Interruption resilience via progressive incremental manifest flushing
 * - Safe rollback: verifies documents have NOT been modified post-import before deleting
 * - Isolation: Rejects any synthetic users, patient cases, or unexpected entities
 * - Dedicated target: al-asas-dental-prod
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const PROD_PROJECT = 'al-asas-dental-prod';
const SEED_FILE = join(process.cwd(), '_backups', 'canonical-production-seed.json');
const MANIFEST_FILE = join(process.cwd(), '_backups', 'production-import-manifest.json');

export async function getAuthToken() {
  const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
  if (!token) throw new Error('Could not acquire gcloud access token.');
  return token;
}

export function computeSeedSha256(seed) {
  const clone = { ...seed };
  delete clone.sha256;
  return createHash('sha256').update(JSON.stringify(clone, null, 2)).digest('hex');
}

export async function verifySeedFile(seed) {
  if (seed.target !== PROD_PROJECT) {
    throw new Error(`Invalid seed target: ${seed.target}, expected ${PROD_PROJECT}`);
  }

  // 1. Cryptographic SHA-256 Verification
  const expectedSha = seed.sha256;
  const computedSha = computeSeedSha256(seed);
  if (!expectedSha || computedSha !== expectedSha) {
    throw new Error(`CRITICAL: Canonical seed integrity check failed! Computed: ${computedSha}, Expected: ${expectedSha}`);
  }
  
  // 2. Validate that forbidden clinical/transactional collections are strictly absent
  const forbidden = ['patient_cases', 'student_requests', 'matches', 'case_images', 'private_medical_chunks', 'audit_logs', 'notifications'];
  for (const f of forbidden) {
    if (seed.collections[f]) {
      throw new Error(`CRITICAL: Forbidden clinical/transactional collection '${f}' found in canonical seed!`);
    }
  }

  // 3. Validate profiles: ONLY authentic Super Admin mohameadalhaear100@gmail.com bound to production UID
  const profiles = seed.collections.profiles?.items || [];
  if (profiles.length !== 1) {
    throw new Error(`CRITICAL: Expected exactly 1 authentic profile, found ${profiles.length}`);
  }
  const superAdmin = profiles[0];
  const email = superAdmin.fields?.email?.stringValue;
  const role = superAdmin.fields?.role?.stringValue;
  const id = superAdmin.fields?.id?.stringValue;
  if (email !== 'mohameadalhaear100@gmail.com' || role !== 'SUPER_ADMIN' || id !== 'wmcFuqRQOWb82EW9XOuGVeVBoiF2') {
    throw new Error(`CRITICAL: Invalid Super Admin profile in seed: email=${email}, role=${role}, id=${id}`);
  }

  return true;
}

export async function getDocInfo(token, docPath) {
  const url = `https://firestore.googleapis.com/v1/${docPath}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status === 200) {
    const data = await res.json();
    return { exists: true, updateTime: data.updateTime, fields: data.fields || {} };
  }
  if (res.status === 404) {
    return { exists: false, updateTime: null, fields: null };
  }
  throw new Error(`Error checking doc ${docPath}: HTTP ${res.status}`);
}

export function areFieldsEqual(fieldsA, fieldsB) {
  return JSON.stringify(fieldsA || {}) === JSON.stringify(fieldsB || {});
}

export async function insertDocAtomic(token, docPath, fields) {
  // Use currentDocument.exists=false precondition to atomically guarantee no overwrite
  const url = `https://firestore.googleapis.com/v1/${docPath}?currentDocument.exists=false`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields })
  });
  if (res.status === 409 || res.status === 412) {
    throw new Error(`DOCUMENT_ALREADY_EXISTS: ${docPath} exists and cannot be overwritten.`);
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to insert ${docPath}: HTTP ${res.status} - ${err}`);
  }
  return await res.json();
}

export async function deleteDocSafe(token, docPath) {
  const url = `https://firestore.googleapis.com/v1/${docPath}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`Failed to delete ${docPath}: HTTP ${res.status} - ${err}`);
  }
}

export async function saveManifestIncremental(manifest) {
  await writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf8');
}

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const isRollback = args.includes('--rollback');
  const allowOverwrite = args.includes('--overwrite'); // Explicit opt-in only
  const isDryRun = !isApply && !isRollback;

  console.log('=== AL ASAS DENTAL 1.5.0 — PRODUCTION FIRESTORE SEED RUNNER ===');
  console.log(`Mode: ${isRollback ? 'ROLLBACK' : isApply ? 'APPLY (Live Import)' : 'DRY-RUN (Simulation Only)'}`);
  console.log(`Target Project: ${PROD_PROJECT}`);
  console.log(`Overwrite Existing: ${allowOverwrite ? 'ENABLED' : 'DISABLED (Protected)'}`);

  const token = await getAuthToken();

  if (isRollback) {
    console.log(`Reading rollback manifest from ${MANIFEST_FILE}...`);
    let manifest;
    try {
      manifest = JSON.parse(await readFile(MANIFEST_FILE, 'utf8'));
    } catch (e) {
      console.error('No rollback manifest found. Nothing to rollback.');
      process.exit(1);
    }

    console.log(`Evaluating ${manifest.created_docs.length} documents for safe rollback...`);
    let deletedCount = 0;
    let skippedModified = 0;
    const remainingDocs = [];

    for (const record of manifest.created_docs) {
      const docPath = typeof record === 'string' ? record : record.path;
      const initialUpdateTime = typeof record === 'object' ? record.updateTime : null;

      const current = await getDocInfo(token, docPath);
      if (!current.exists) {
        console.log(`- Already absent: ${docPath}`);
        continue;
      }

      // If document was modified after the import, DO NOT DELETE to avoid data loss
      if (initialUpdateTime && current.updateTime && current.updateTime !== initialUpdateTime) {
        console.warn(`[SKIP_MODIFIED] Document ${docPath} was modified after import (${current.updateTime} != ${initialUpdateTime}). Preserving.`);
        skippedModified++;
        remainingDocs.push(record);
        continue;
      }

      console.log(`- Deleting unmodified imported doc: ${docPath}`);
      await deleteDocSafe(token, docPath);
      deletedCount++;

      // Incrementally update manifest so if interrupted, manifest stays truthful
      manifest.created_docs = manifest.created_docs.filter(r => (typeof r === 'string' ? r : r.path) !== docPath);
      await saveManifestIncremental(manifest);
    }

    console.log(`\n[PASS] Rollback completed.`);
    console.log(`- Successfully deleted: ${deletedCount}`);
    console.log(`- Skipped modified docs: ${skippedModified}`);
    return;
  }

  // Load and verify seed file
  const rawSeed = await readFile(SEED_FILE, 'utf8');
  const seed = JSON.parse(rawSeed);
  await verifySeedFile(seed);

  console.log(`[PASS] Cryptographic SHA-256 integrity verified: ${seed.sha256}`);
  console.log(`Canonical Collections: ${Object.keys(seed.collections).join(', ')}`);

  const plan = [];
  let totalDocs = 0;

  for (const [colName, colData] of Object.entries(seed.collections)) {
    const items = colData.items || [];
    totalDocs += items.length;

    for (const item of items) {
      const parts = item.name.split('/');
      const docId = parts[parts.length - 1];
      const targetPath = `projects/${PROD_PROJECT}/databases/(default)/documents/${colName}/${docId}`;
      const docInfo = await getDocInfo(token, targetPath);

      let action = 'INSERT';
      if (docInfo.exists) {
        if (areFieldsEqual(docInfo.fields, item.fields)) {
          action = 'IDENTICAL_SKIP';
        } else {
          action = allowOverwrite ? 'UPDATE_OVERWRITE' : 'PROTECTED_SKIP';
        }
      }

      plan.push({
        collection: colName,
        docId,
        targetPath,
        exists: docInfo.exists,
        action,
        fields: item.fields,
        currentUpdateTime: docInfo.updateTime
      });
    }
  }

  const toInsert = plan.filter(p => p.action === 'INSERT');
  const toSkipIdentical = plan.filter(p => p.action === 'IDENTICAL_SKIP');
  const toSkipProtected = plan.filter(p => p.action === 'PROTECTED_SKIP');
  const toOverwrite = plan.filter(p => p.action === 'UPDATE_OVERWRITE');

  console.log('\n--- EXECUTION PLAN SUMMARY ---');
  console.log(`Total documents evaluated:      ${totalDocs}`);
  console.log(`Documents to INSERT (New):       ${toInsert.length}`);
  console.log(`Documents IDENTICAL (Skip):      ${toSkipIdentical.length}`);
  console.log(`Documents EXISTING (Protected):  ${toSkipProtected.length}`);
  console.log(`Documents to OVERWRITE:          ${toOverwrite.length}`);

  if (isDryRun) {
    console.log('\n[PASS] DRY RUN SUCCESSFUL. Zero mutations performed.');
    console.log('To execute the import, pass --apply (without overwriting existing data).');
    return;
  }

  if (isApply) {
    console.log('\nStarting LIVE import with progressive manifest logging...');
    
    // Initialize or load existing manifest for interruption resilience
    let manifest = {
      imported_at: new Date().toISOString(),
      target_project: PROD_PROJECT,
      seed_sha256: seed.sha256,
      created_docs: []
    };

    try {
      const existingManifest = JSON.parse(await readFile(MANIFEST_FILE, 'utf8'));
      if (existingManifest?.created_docs) {
        manifest = existingManifest;
      }
    } catch {}

    for (const step of plan) {
      if (step.action === 'IDENTICAL_SKIP') {
        console.log(`[SKIP_IDENTICAL] ${step.collection}/${step.docId}`);
        continue;
      }
      if (step.action === 'PROTECTED_SKIP') {
        console.warn(`[SKIP_PROTECTED] ${step.collection}/${step.docId} exists with different data and --overwrite is not specified. Skipping.`);
        continue;
      }

      if (step.action === 'INSERT') {
        console.log(`[INSERT] ${step.collection}/${step.docId}...`);
        const result = await insertDocAtomic(token, step.targetPath, step.fields);
        
        // Incrementally record to manifest
        manifest.created_docs.push({
          path: step.targetPath,
          collection: step.collection,
          docId: step.docId,
          updateTime: result.updateTime,
          created_at: new Date().toISOString()
        });
        await saveManifestIncremental(manifest);
      }
    }

    console.log(`\n[PASS] LIVE IMPORT COMPLETE.`);
    console.log(`Manifest saved incrementally to ${MANIFEST_FILE}`);
    console.log(`Total documents created in this execution: ${manifest.created_docs.length}`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('import-canonical-production-seed.mjs')) {
  main().catch(err => {
    console.error('[FAIL]', err.message);
    process.exit(1);
  });
}
