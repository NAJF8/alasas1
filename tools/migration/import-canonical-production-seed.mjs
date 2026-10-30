#!/usr/bin/env node
/**
 * AL ASAS DENTAL 1.5.0 — Hardened Production Canonical Seed Importer
 * 
 * Safety features:
 * - SHA-256 cryptographic verification of seed payload content
 * - Strictly CREATE-ONLY: --overwrite is permanently removed; existing documents are never overwritten
 * - Atomic non-overwrite guarantee via Firestore precondition (currentDocument.exists=false)
 * - Approved canonical collection whitelist & exhaustive document path validation before execution
 * - Single-identity profile restriction: Only authentic Super Admin UID (wmcFuqRQOWb82EW9XOuGVeVBoiF2)
 * - Interruption resilience via progressive incremental manifest flushing
 * - Safe atomic rollback: Enforces Firestore DELETE with currentDocument.updateTime precondition
 *   so any concurrently modified document is atomically preserved and never deleted
 * - Dedicated target: al-asas-dental-prod
 */

import { readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

export const PROD_PROJECT = 'al-asas-dental-prod';
export const SEED_FILE = join(process.cwd(), '_backups', 'canonical-production-seed.json');
export const MANIFEST_FILE = join(process.cwd(), '_backups', 'production-import-manifest.json');

export const APPROVED_COLLECTIONS = Object.freeze([
  'clinical_categories',
  'universities',
  'provinces',
  'areas',
  'subscription_plans',
  'branding_settings',
  'matching_settings',
  'system_settings',
  'profiles'
]);

export const APPROVED_COLLECTIONS_SET = new Set(APPROVED_COLLECTIONS);
export const PROD_SUPER_ADMIN_UID = 'wmcFuqRQOWb82EW9XOuGVeVBoiF2';
export const PROD_SUPER_ADMIN_EMAIL = 'mohameadalhaear100@gmail.com';

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

/**
 * Validates document paths against canonical rules:
 * - Must belong to an approved collection
 * - Must strictly match the canonical path template projects/{project}/databases/(default)/documents/{colName}/{docId}
 * - Disallows path traversal, relative segments, query parameters, or invalid characters
 * - For profiles collection, strictly enforces the Super Admin UID
 */
export function validateDocumentPath(targetPath, expectedCollection) {
  if (!targetPath || typeof targetPath !== 'string') {
    throw new Error('CRITICAL: Document path must be a non-empty string');
  }

  if (
    targetPath.includes('..') ||
    targetPath.includes('//') ||
    targetPath.includes('?') ||
    targetPath.includes('#') ||
    targetPath.includes('\\')
  ) {
    throw new Error(`CRITICAL: Illegal path characters or traversal detected in path: ${targetPath}`);
  }

  if (!APPROVED_COLLECTIONS_SET.has(expectedCollection)) {
    throw new Error(`CRITICAL: Unapproved collection '${expectedCollection}' is not in approved canonical list`);
  }

  const match = targetPath.match(/^projects\/([a-zA-Z0-9_-]+)\/databases\/\(default\)\/documents\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)$/);
  if (!match) {
    throw new Error(`CRITICAL: Document path '${targetPath}' does not match standard Firestore canonical format`);
  }

  const [, project, colName, docId] = match;

  if (project !== PROD_PROJECT && project !== 'al-asas-dental-staging') {
    throw new Error(`CRITICAL: Invalid project '${project}' in path '${targetPath}'. Expected '${PROD_PROJECT}' or 'al-asas-dental-staging'.`);
  }

  if (colName !== expectedCollection) {
    throw new Error(`CRITICAL: Collection in path '${colName}' does not match expected collection '${expectedCollection}' in '${targetPath}'`);
  }

  if (expectedCollection === 'profiles' && docId !== PROD_SUPER_ADMIN_UID) {
    throw new Error(`CRITICAL: Unauthorized profile document ID '${docId}'. Only approved Super Admin UID '${PROD_SUPER_ADMIN_UID}' is allowed.`);
  }

  const resolvedTargetPath = `projects/${PROD_PROJECT}/databases/(default)/documents/${expectedCollection}/${docId}`;

  return { colName: expectedCollection, docId, targetPath: resolvedTargetPath };
}

export async function verifySeedFile(seed) {
  if (!seed || typeof seed !== 'object') {
    throw new Error('CRITICAL: Seed file must be a valid JSON object');
  }

  if (seed.target !== PROD_PROJECT) {
    throw new Error(`Invalid seed target: ${seed.target}, expected ${PROD_PROJECT}`);
  }

  // 1. Cryptographic SHA-256 Verification
  const expectedSha = seed.sha256;
  const computedSha = computeSeedSha256(seed);
  if (!expectedSha || computedSha !== expectedSha) {
    throw new Error(`CRITICAL: Canonical seed integrity check failed! Computed: ${computedSha}, Expected: ${expectedSha}`);
  }

  // 2. Validate that only approved collections are present in seed
  if (!seed.collections || typeof seed.collections !== 'object') {
    throw new Error('CRITICAL: Seed is missing valid collections map');
  }

  for (const colName of Object.keys(seed.collections)) {
    if (!APPROVED_COLLECTIONS_SET.has(colName)) {
      throw new Error(`CRITICAL: Unapproved collection '${colName}' found in canonical seed! Only approved canonical collections are permitted.`);
    }
  }

  // 3. Explicitly reject any forbidden clinical or transactional collections
  const forbidden = ['patient_cases', 'student_requests', 'matches', 'case_images', 'private_medical_chunks', 'audit_logs', 'notifications'];
  for (const f of forbidden) {
    if (seed.collections[f]) {
      throw new Error(`CRITICAL: Forbidden clinical/transactional collection '${f}' found in canonical seed!`);
    }
  }

  // 4. Validate profiles: ONLY authentic Super Admin bound to production UID
  const profiles = seed.collections.profiles?.items || [];
  if (profiles.length !== 1) {
    throw new Error(`CRITICAL: Expected exactly 1 authentic profile, found ${profiles.length}`);
  }
  const superAdmin = profiles[0];
  const email = superAdmin.fields?.email?.stringValue;
  const role = superAdmin.fields?.role?.stringValue;
  const id = superAdmin.fields?.id?.stringValue;
  if (email !== PROD_SUPER_ADMIN_EMAIL || role !== 'SUPER_ADMIN' || id !== PROD_SUPER_ADMIN_UID) {
    throw new Error(`CRITICAL: Invalid Super Admin profile in seed: email=${email}, role=${role}, id=${id}`);
  }

  // 5. Pre-validate ALL document paths across all collections BEFORE execution
  for (const [colName, colData] of Object.entries(seed.collections)) {
    const items = colData.items || [];
    for (const item of items) {
      if (!item || !item.name) {
        throw new Error(`CRITICAL: Malformed item without 'name' in collection '${colName}'`);
      }
      validateDocumentPath(item.name, colName);
    }
  }

  return true;
}

export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('CRITICAL: Corrupted manifest: root must be a JSON object');
  }
  if (manifest.target_project !== PROD_PROJECT) {
    throw new Error(`CRITICAL: Corrupted manifest: target_project '${manifest.target_project}' does not match '${PROD_PROJECT}'`);
  }
  if (!manifest.seed_sha256 || typeof manifest.seed_sha256 !== 'string' || manifest.seed_sha256.length !== 64) {
    throw new Error('CRITICAL: Corrupted manifest: missing or invalid seed_sha256 cryptographic hash');
  }
  if (!Array.isArray(manifest.created_docs)) {
    throw new Error('CRITICAL: Corrupted manifest: created_docs must be an array');
  }
  for (let i = 0; i < manifest.created_docs.length; i++) {
    const entry = manifest.created_docs[i];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`CRITICAL: Corrupted manifest: entry at index ${i} is not a valid object`);
    }
    if (!entry.path || typeof entry.path !== 'string') {
      throw new Error(`CRITICAL: Corrupted manifest: entry at index ${i} is missing valid 'path'`);
    }
    if (!entry.collection || !APPROVED_COLLECTIONS_SET.has(entry.collection)) {
      throw new Error(`CRITICAL: Corrupted manifest: entry at index ${i} has unapproved collection '${entry.collection}'`);
    }
    if (!entry.updateTime || typeof entry.updateTime !== 'string') {
      throw new Error(`CRITICAL: Corrupted manifest: entry '${entry.path}' is missing required atomic 'updateTime'`);
    }
  }
  return true;
}

export async function readManifestSafe(manifestPath = MANIFEST_FILE) {
  let raw;
  try {
    raw = await readFile(manifestPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return null;
    }
    throw new Error(`CRITICAL: Failed to read manifest from ${manifestPath}: ${err.message}`);
  }

  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (err) {
    throw new Error(`CRITICAL: Corrupted manifest file at ${manifestPath}: Malformed JSON (${err.message})`);
  }

  validateManifest(manifest);
  return manifest;
}

export async function saveManifestIncremental(manifest, manifestPath = MANIFEST_FILE) {
  validateManifest(manifest);
  const tempPath = `${manifestPath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(tempPath, JSON.stringify(manifest, null, 2), 'utf8');
  await rename(tempPath, manifestPath);
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

/**
 * Strictly CREATE-ONLY atomic document insert.
 * Precondition: currentDocument.exists=false guarantees zero overwrite.
 */
export async function insertDocAtomic(token, docPath, fields) {
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

/**
 * Safe atomic rollback deletion using Firestore DELETE with currentDocument.updateTime precondition.
 * Impossible to delete any document that was modified post-import.
 */
export async function deleteDocSafe(token, docPath, expectedUpdateTime) {
  if (!expectedUpdateTime || typeof expectedUpdateTime !== 'string') {
    throw new Error(`CRITICAL: Refusing to delete ${docPath} without atomic expectedUpdateTime precondition.`);
  }

  const encodedTime = encodeURIComponent(expectedUpdateTime);
  const url = `https://firestore.googleapis.com/v1/${docPath}?currentDocument.updateTime=${encodedTime}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.status === 200 || res.status === 204) {
    return { status: 'DELETED' };
  }
  if (res.status === 404) {
    return { status: 'NOT_FOUND' };
  }
  if (res.status === 412 || res.status === 409) {
    return {
      status: 'PRECONDITION_FAILED',
      error: `Atomic precondition failed: document was modified concurrently or does not match updateTime ${expectedUpdateTime}`
    };
  }

  const err = await res.text();
  throw new Error(`Failed to delete ${docPath}: HTTP ${res.status} - ${err}`);
}

/**
 * Safe Rollback execution loop:
 * - Inspects each created document
 * - Atomically deletes only if updateTime exactly matches
 * - Catches concurrent modification and preserves data
 * - Updates manifest incrementally to remain truthful on interruption
 */
export async function executeRollbackAtomic(token, manifest, manifestPath = MANIFEST_FILE, getDocFn = getDocInfo, deleteDocFn = deleteDocSafe) {
  console.log(`Evaluating ${manifest.created_docs.length} documents for safe atomic rollback...`);
  let deletedCount = 0;
  let skippedModified = 0;
  let alreadyAbsentCount = 0;

  for (const record of [...manifest.created_docs]) {
    const docPath = record.path;
    const initialUpdateTime = record.updateTime;

    if (!initialUpdateTime) {
      console.warn(`[SKIP_UNSAFE] Document ${docPath} lacks recorded updateTime. Preserving.`);
      skippedModified++;
      continue;
    }

    // 1. Initial inspection
    const current = await getDocFn(token, docPath);
    if (!current.exists) {
      console.log(`- Already absent: ${docPath}`);
      alreadyAbsentCount++;
      manifest.created_docs = manifest.created_docs.filter(r => r.path !== docPath);
      await saveManifestIncremental(manifest, manifestPath);
      continue;
    }

    // 2. Pre-check: If modified, preserve immediately
    if (current.updateTime !== initialUpdateTime) {
      console.warn(`[SKIP_MODIFIED] Document ${docPath} was modified after import (${current.updateTime} !== ${initialUpdateTime}). Preserving.`);
      skippedModified++;
      continue;
    }

    // 3. Atomic delete: Firestore precondition currentDocument.updateTime prevents race conditions
    console.log(`- Atomically deleting unmodified imported doc: ${docPath}...`);
    const deleteResult = await deleteDocFn(token, docPath, initialUpdateTime);

    if (deleteResult.status === 'DELETED') {
      deletedCount++;
      manifest.created_docs = manifest.created_docs.filter(r => r.path !== docPath);
      await saveManifestIncremental(manifest, manifestPath);
      console.log(`  [DELETED] Successfully deleted ${docPath}`);
    } else if (deleteResult.status === 'PRECONDITION_FAILED') {
      console.warn(`  [RACE_PREVENTED] Concurrent modification detected during DELETE for ${docPath}. Document preserved.`);
      skippedModified++;
    } else if (deleteResult.status === 'NOT_FOUND') {
      console.log(`  [ALREADY_ABSENT] ${docPath} was deleted concurrently.`);
      alreadyAbsentCount++;
      manifest.created_docs = manifest.created_docs.filter(r => r.path !== docPath);
      await saveManifestIncremental(manifest, manifestPath);
    }
  }

  return { deletedCount, skippedModified, alreadyAbsentCount };
}

async function main() {
  const args = process.argv.slice(2);

  // 1. Strictly forbid --overwrite option
  if (args.includes('--overwrite')) {
    throw new Error("CRITICAL: The '--overwrite' option has been permanently removed. Seed importer is strictly Create-only.");
  }

  const isApply = args.includes('--apply');
  const isRollback = args.includes('--rollback');
  const isDryRun = !isApply && !isRollback;

  console.log('=== AL ASAS DENTAL 1.5.0 — PRODUCTION FIRESTORE SEED RUNNER ===');
  console.log(`Mode: ${isRollback ? 'ROLLBACK' : isApply ? 'APPLY (Live Import)' : 'DRY-RUN (Simulation Only)'}`);
  console.log(`Target Project: ${PROD_PROJECT}`);
  console.log(`Import Semantics: STRICTLY CREATE-ONLY (No overwrite allowed)`);

  const token = await getAuthToken();

  if (isRollback) {
    console.log(`Reading rollback manifest from ${MANIFEST_FILE}...`);
    const manifest = await readManifestSafe(MANIFEST_FILE);
    if (!manifest || manifest.created_docs.length === 0) {
      console.log('No documents in manifest to rollback.');
      return;
    }

    const { deletedCount, skippedModified, alreadyAbsentCount } = await executeRollbackAtomic(token, manifest, MANIFEST_FILE);

    console.log(`\n[PASS] Rollback completed.`);
    console.log(`- Successfully deleted: ${deletedCount}`);
    console.log(`- Skipped modified docs: ${skippedModified}`);
    console.log(`- Already absent:        ${alreadyAbsentCount}`);
    return;
  }

  // Load and verify seed file
  const rawSeed = await readFile(SEED_FILE, 'utf8');
  const seed = JSON.parse(rawSeed);
  await verifySeedFile(seed);

  console.log(`[PASS] Cryptographic SHA-256 integrity verified: ${seed.sha256}`);
  console.log(`Approved Collections (${APPROVED_COLLECTIONS.length}): ${APPROVED_COLLECTIONS.join(', ')}`);

  const plan = [];
  let totalDocs = 0;

  for (const [colName, colData] of Object.entries(seed.collections)) {
    const items = colData.items || [];
    totalDocs += items.length;

    for (const item of items) {
      const { docId, targetPath } = validateDocumentPath(item.name, colName);
      const docInfo = await getDocInfo(token, targetPath);

      let action = 'INSERT';
      if (docInfo.exists) {
        if (areFieldsEqual(docInfo.fields, item.fields)) {
          action = 'IDENTICAL_SKIP';
        } else {
          action = 'EXISTING_SKIP'; // Strictly Create-only, never overwrite
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
  const toSkipExisting = plan.filter(p => p.action === 'EXISTING_SKIP');

  console.log('\n--- EXECUTION PLAN SUMMARY (STRICTLY CREATE-ONLY) ---');
  console.log(`Total documents evaluated:      ${totalDocs}`);
  console.log(`Documents to INSERT (New):       ${toInsert.length}`);
  console.log(`Documents IDENTICAL (Skip):      ${toSkipIdentical.length}`);
  console.log(`Documents EXISTING (Protected):  ${toSkipExisting.length}`);
  console.log(`Documents to OVERWRITE:          0 (Permanently disabled)`);

  if (isDryRun) {
    console.log('\n[PASS] DRY RUN SUCCESSFUL. Zero mutations performed.');
    console.log('To execute the import, pass --apply (Create-only mode).');
    return;
  }

  if (isApply) {
    console.log('\nStarting LIVE import with progressive manifest logging...');
    
    // Interruption resilience: Read existing manifest or start fresh
    let manifest = await readManifestSafe(MANIFEST_FILE);
    if (!manifest) {
      manifest = {
        imported_at: new Date().toISOString(),
        target_project: PROD_PROJECT,
        seed_sha256: seed.sha256,
        created_docs: []
      };
      await saveManifestIncremental(manifest, MANIFEST_FILE);
    }

    for (const step of plan) {
      if (step.action === 'IDENTICAL_SKIP') {
        console.log(`[SKIP_IDENTICAL] ${step.collection}/${step.docId}`);
        continue;
      }
      if (step.action === 'EXISTING_SKIP') {
        console.warn(`[SKIP_PROTECTED] ${step.collection}/${step.docId} exists with different data. Create-only mode preserves existing document.`);
        continue;
      }

      if (step.action === 'INSERT') {
        console.log(`[INSERT] ${step.collection}/${step.docId}...`);
        const result = await insertDocAtomic(token, step.targetPath, step.fields);
        
        manifest.created_docs.push({
          path: step.targetPath,
          collection: step.collection,
          docId: step.docId,
          updateTime: result.updateTime,
          created_at: new Date().toISOString()
        });
        // Incremental flush: guarantees manifest is accurate at all times
        await saveManifestIncremental(manifest, MANIFEST_FILE);
      }
    }

    console.log(`\n[PASS] LIVE CREATE-ONLY IMPORT COMPLETE.`);
    console.log(`Manifest saved incrementally to ${MANIFEST_FILE}`);
    console.log(`Total documents tracked in manifest: ${manifest.created_docs.length}`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('import-canonical-production-seed.mjs')) {
  main().catch(err => {
    console.error('[FAIL]', err.message);
    process.exit(1);
  });
}
