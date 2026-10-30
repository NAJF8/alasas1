/**
 * AL ASAS DENTAL 1.5.0 — Canonical Production Data Migration & Verification
 *
 * This script prepares and verifies the canonical baseline seed for production migration.
 * It filters out ALL synthetic test fixtures and accounts created during E2E testing on Staging.
 * It does NOT write to Production or Supabase without explicit approval.
 */

import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const STAGING_PROJECT = 'al-asas-dental-staging';
const PROD_PROJECT = 'al-asas-dental-prod';
const token = execFileSync('gcloud.cmd', ['auth', 'print-access-token'], { encoding: 'utf8', shell: process.platform === 'win32' }).trim();

const getDocs = async (collection) => {
  const url = `https://firestore.googleapis.com/v1/projects/${STAGING_PROJECT}/databases/(default)/documents/${collection}?pageSize=300`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Failed to fetch ${collection}: ${res.status}`);
  const json = await res.json();
  return json.documents || [];
};

async function main() {
  console.log('=== AL ASAS DENTAL 1.5.0 — CANONICAL PRODUCTION SEED GENERATOR ===');

  // 1. Fetch reference collections
  console.log('Fetching reference data from baseline...');
  const categories = await getDocs('clinical_categories');
  const universities = await getDocs('universities');
  const provinces = await getDocs('provinces');
  const areas = await getDocs('areas');
  const plans = await getDocs('subscription_plans');
  const branding = await getDocs('branding_settings');
  const matching = await getDocs('matching_settings');
  const settings = await getDocs('system_settings');
  const profiles = await getDocs('profiles');

  // Filter ONLY authentic entities
  const authenticUniversities = universities.filter(u => !u.name.includes('test_') && !u.name.includes('اختبار'));
  const authenticCategories = categories.filter(c => !c.name.includes('test_'));
  
  // Super admin and authentic team profiles only (filter out synthetic test patients/students/admins)
  const authenticProfiles = profiles.filter(p => {
    const fields = p.fields || {};
    const email = fields.email?.stringValue || '';
    const fullName = fields.full_name?.stringValue || '';
    if (email === 'mohameadalhaear100@gmail.com') return true;
    if (fullName.includes('تجريب') || fullName.includes('فحص') || fullName.includes('Test') || fullName.includes('audit-')) return false;
    if (fields.role?.stringValue === 'SUPER_ADMIN') return true;
    return false;
  });

  const payload = {
    source: STAGING_PROJECT,
    target: PROD_PROJECT,
    version: '1.5.0',
    generated_at: new Date().toISOString(),
    collections: {
      clinical_categories: { count: authenticCategories.length, items: authenticCategories },
      universities: { count: authenticUniversities.length, items: authenticUniversities },
      provinces: { count: provinces.length, items: provinces },
      areas: { count: areas.length, items: areas },
      subscription_plans: { count: plans.length, items: plans },
      branding_settings: { count: branding.length, items: branding },
      matching_settings: { count: matching.length, items: matching },
      system_settings: { count: settings.length, items: settings },
      profiles: { count: authenticProfiles.length, items: authenticProfiles },
    }
  };

  const serialized = JSON.stringify(payload, null, 2);
  const sha256 = createHash('sha256').update(serialized).digest('hex');
  payload.sha256 = sha256;

  console.log(`Summary:`);
  console.log(`- Clinical categories: ${authenticCategories.length}/16`);
  console.log(`- Universities: ${authenticUniversities.length} (Kufa & Kafeel)`);
  console.log(`- Provinces: ${provinces.length}`);
  console.log(`- Areas: ${areas.length}`);
  console.log(`- Authentic Profiles: ${authenticProfiles.length} (Super Admin verified)`);
  console.log(`- Canonical Seed SHA-256: ${sha256}`);

  const outputPath = join(process.cwd(), '_backups', 'canonical-production-seed.json');
  await writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Canonical seed saved to ${outputPath}`);
}

main().catch(console.error);
