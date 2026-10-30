#!/usr/bin/env node
/**
 * AL ASAS DENTAL 1.5.0 — Production Canonical Seed Importer
 * 
 * Features:
 * - Idempotent upsert / insertion
 * - Mandatory --dry-run mode support
 * - Rollback capability via import manifest tracking
 * - Strict isolation: Rejects any synthetic users or patient cases
 * - Dedicated target: al-asas-dental-prod
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const PROD_PROJECT = 'al-asas-dental-prod';
const SEED_FILE = join(process.cwd(), '_backups', 'canonical-production-seed.json');
const MANIFEST_FILE = join(process.cwd(), '_backups', 'production-import-manifest.json');

async function getAuthToken() {
  const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
  if (!token) throw new Error('Could not acquire gcloud access token.');
  return token;
}

async function verifySeedFile(seed) {
  if (seed.target !== PROD_PROJECT) {
    throw new Error(`Invalid seed target: ${seed.target}, expected ${PROD_PROJECT}`);
  }
  
  // Validate that forbidden collections are absent
  const forbidden = ['patient_cases', 'student_requests', 'matches', 'case_images', 'private_medical_chunks'];
  for (const f of forbidden) {
    if (seed.collections[f]) {
      throw new Error(`CRITICAL: Forbidden clinical/transactional collection '${f}' found in canonical seed!`);
    }
  }

  // Validate profiles: ONLY Super Admin mohameadalhaear100@gmail.com
  const profiles = seed.collections.profiles?.items || [];
  for (const p of profiles) {
    const email = p.fields?.email?.stringValue;
    const role = p.fields?.role?.stringValue;
    if (email !== 'mohameadalhaear100@gmail.com' || role !== 'SUPER_ADMIN') {
      throw new Error(`CRITICAL: Non-authorized profile detected in seed: ${email} (${role})`);
    }
  }

  return true;
}

async function checkDocExists(token, docPath) {
  const url = `https://firestore.googleapis.com/v1/${docPath}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status === 200) return true;
  if (res.status === 404) return false;
  throw new Error(`Error checking doc ${docPath}: HTTP ${res.status}`);
}

async function writeDoc(token, docPath, fields) {
  const url = `https://firestore.googleapis.com/v1/${docPath}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to write ${docPath}: HTTP ${res.status} - ${err}`);
  }
  return await res.json();
}

async function deleteDoc(token, docPath) {
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

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const isRollback = args.includes('--rollback');
  const isDryRun = !isApply && !isRollback;

  console.log('=== AL ASAS DENTAL 1.5.0 — PRODUCTION FIRESTORE SEED RUNNER ===');
  console.log(`Mode: ${isRollback ? 'ROLLBACK' : isApply ? 'APPLY (Live Import)' : 'DRY-RUN (Simulation Only)'}`);
  console.log(`Target Project: ${PROD_PROJECT}`);

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

    console.log(`Rolling back ${manifest.created_docs.length} documents created in import ${manifest.imported_at}...`);
    let deletedCount = 0;
    for (const docPath of manifest.created_docs) {
      console.log(`- Deleting: ${docPath}`);
      await deleteDoc(token, docPath);
      deletedCount++;
    }
    console.log(`[PASS] Rollback completed. Deleted ${deletedCount} documents.`);
    return;
  }

  // Load and verify seed
  const rawSeed = await readFile(SEED_FILE, 'utf8');
  const seed = JSON.parse(rawSeed);
  await verifySeedFile(seed);

  console.log(`Verified Canonical Seed:`);
  console.log(`- Version: ${seed.version}`);
  console.log(`- Hash SHA-256: ${seed.sha256}`);
  console.log(`- Collections: ${Object.keys(seed.collections).join(', ')}`);

  const plan = [];
  let totalDocs = 0;

  for (const [colName, colData] of Object.entries(seed.collections)) {
    const items = colData.items || [];
    totalDocs += items.length;
    console.log(`Inspecting ${colName} (${items.length} docs)...`);

    for (const item of items) {
      const parts = item.name.split('/');
      const docId = parts[parts.length - 1];
      const targetPath = `projects/${PROD_PROJECT}/databases/(default)/documents/${colName}/${docId}`;
      const exists = await checkDocExists(token, targetPath);

      plan.push({
        collection: colName,
        docId,
        targetPath,
        exists,
        action: exists ? 'SKIP_OR_UPSERT' : 'INSERT',
        fields: item.fields
      });
    }
  }

  const inserts = plan.filter(p => p.action === 'INSERT');
  const existing = plan.filter(p => p.action === 'SKIP_OR_UPSERT');

  console.log('\n--- EXECUTION PLAN SUMMARY ---');
  console.log(`Total documents evaluated: ${totalDocs}`);
  console.log(`Documents to INSERT:        ${inserts.length}`);
  console.log(`Documents already EXISTING:  ${existing.length}`);

  if (isDryRun) {
    console.log('\n[PASS] DRY RUN SUCCESSFUL. Zero changes made to production.');
    console.log('To execute the import, pass --apply.');
    return;
  }

  if (isApply) {
    console.log('\nExecuting LIVE import to al-asas-dental-prod...');
    const createdDocs = [];

    for (const step of plan) {
      console.log(`Writing [${step.collection}/${step.docId}]...`);
      await writeDoc(token, step.targetPath, step.fields);
      if (step.action === 'INSERT') {
        createdDocs.push(step.targetPath);
      }
    }

    const manifest = {
      imported_at: new Date().toISOString(),
      target_project: PROD_PROJECT,
      seed_sha256: seed.sha256,
      total_imported: plan.length,
      created_docs: createdDocs
    };

    await writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(`\n[PASS] LIVE IMPORT COMPLETE.`);
    console.log(`Import manifest saved to ${MANIFEST_FILE}`);
    console.log(`Rollback is available via: node tools/migration/import-canonical-production-seed.mjs --rollback`);
  }
}

main().catch(err => {
  console.error('[FAIL]', err.message);
  process.exit(1);
});
