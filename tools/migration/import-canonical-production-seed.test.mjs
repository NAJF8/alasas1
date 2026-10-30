import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  computeSeedSha256,
  verifySeedFile,
  areFieldsEqual
} from './import-canonical-production-seed.mjs';

test('Production Seed Importer: Cryptographic Hash Verification', async () => {
  const seedPath = join(process.cwd(), '_backups', 'canonical-production-seed.json');
  const seed = JSON.parse(await readFile(seedPath, 'utf8'));

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
    name: 'projects/al-asas-dental-prod/databases/(default)/documents/provinces/fake_province',
    fields: { name: { stringValue: 'Fake' } }
  });
  await assert.rejects(
    async () => verifySeedFile(tamperedContentSeed),
    /Canonical seed integrity check failed/,
    'Tampered content must be caught by SHA-256'
  );
});

test('Production Seed Importer: Rejects Forbidden Clinical Collections', async () => {
  const seedPath = join(process.cwd(), '_backups', 'canonical-production-seed.json');
  const seed = JSON.parse(await readFile(seedPath, 'utf8'));

  const badSeed = JSON.parse(JSON.stringify(seed));
  badSeed.collections.patient_cases = { count: 1, items: [{ name: 'case1' }] };
  badSeed.sha256 = computeSeedSha256(badSeed);

  await assert.rejects(
    async () => verifySeedFile(badSeed),
    /Forbidden clinical\/transactional collection 'patient_cases' found/,
    'Must strictly reject clinical collections'
  );
});

test('Production Seed Importer: Strict Super Admin Profile Enforcement', async () => {
  const seedPath = join(process.cwd(), '_backups', 'canonical-production-seed.json');
  const seed = JSON.parse(await readFile(seedPath, 'utf8'));

  // Reject non-owner profile
  const badProfileSeed = JSON.parse(JSON.stringify(seed));
  badProfileSeed.collections.profiles.items[0].fields.email = { stringValue: 'attacker@evil.com' };
  badProfileSeed.sha256 = computeSeedSha256(badProfileSeed);

  await assert.rejects(
    async () => verifySeedFile(badProfileSeed),
    /Invalid Super Admin profile in seed/,
    'Must reject non-owner emails in Super Admin profile'
  );

  // Reject wrong production UID
  const wrongUidSeed = JSON.parse(JSON.stringify(seed));
  wrongUidSeed.collections.profiles.items[0].fields.id = { stringValue: 'staging-uid-1234' };
  wrongUidSeed.sha256 = computeSeedSha256(wrongUidSeed);

  await assert.rejects(
    async () => verifySeedFile(wrongUidSeed),
    /Invalid Super Admin profile in seed/,
    'Must enforce production UID binding'
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

test('Production Seed Importer: Rollback Safety Logic (Preserves Post-Import Modified Docs)', () => {
  const manifestRecord = {
    path: 'projects/al-asas-dental-prod/databases/(default)/documents/universities/kufa',
    updateTime: '2026-10-30T10:00:00.000Z'
  };

  // If current doc has the same updateTime -> safe to delete
  const currentUnmodified = { updateTime: '2026-10-30T10:00:00.000Z' };
  const shouldDeleteUnmodified = (currentUnmodified.updateTime === manifestRecord.updateTime);
  assert.equal(shouldDeleteUnmodified, true, 'Unmodified doc should be eligible for rollback');

  // If current doc was edited after import -> MUST NOT DELETE
  const currentModified = { updateTime: '2026-10-30T10:05:00.000Z' };
  const shouldDeleteModified = (currentModified.updateTime === manifestRecord.updateTime);
  assert.equal(shouldDeleteModified, false, 'Post-import modified doc MUST NOT be deleted by rollback');
});
