import { chromium } from '../admin-app/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

console.log('--- STARTING LIVE VERIFICATION ON https://dental.alasas.tech ---');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  locale: 'ar-IQ',
});
const page = await context.newPage();

try {
  // 1. Load Live Home Page
  console.log('1. Navigating to https://dental.alasas.tech ...');
  const response = await page.goto('https://dental.alasas.tech', { waitUntil: 'domcontentloaded', timeout: 30000 });
  assert.equal(response?.status(), 200, 'Live site must return 200');

  await page.waitForSelector('header.customer-header', { timeout: 15000 });
  console.log('✓ Header rendered successfully on dental.alasas.tech');

  // 2. Verify NO "لوحة الإدارة" link in header
  const adminLinks = await page.locator('header.customer-header a[href*="/admin/"]').all();
  assert.equal(adminLinks.length, 0, 'Header must NEVER have a link to /admin/');

  const adminTexts = await page.locator('header.customer-header :text("لوحة الإدارة")').all();
  assert.equal(adminTexts.length, 0, 'Header must NEVER contain text "لوحة الإدارة"');
  console.log('✓ Verified: "لوحة الإدارة" completely removed from customer header');

  // 3. Verify NO duplicate profile links
  const duplicateEditProfile = await page.locator('header.customer-header :text("تعديل الملف الشخصي")').all();
  assert.equal(duplicateEditProfile.length, 0, 'Header must NOT have "تعديل الملف الشخصي"');

  const duplicateMyAccount = await page.locator('header.customer-header :text("حسابي")').all();
  assert.equal(duplicateMyAccount.length, 0, 'Header must NOT have duplicate "حسابي"');
  console.log('✓ Verified: Duplicate "حسابي" and "تعديل الملف الشخصي" links eliminated');

  // 4. Verify Guest actions
  const loginLink = page.locator('header.customer-header a[href="/login"]');
  const registerLink = page.locator('header.customer-header a[href="/register"]');
  assert.equal(await loginLink.count() > 0, true, 'Header must show "تسجيل الدخول" for guest');
  assert.equal(await registerLink.count() > 0, true, 'Header must show "إنشاء حساب" for guest');
  console.log('✓ Verified: Guest actions (تسجيل الدخول, إنشاء حساب) present and correct');

  // 5. Verify /admin/ direct URL loads the Admin Auth Gate
  console.log('5. Navigating directly to https://dental.alasas.tech/admin/ ...');
  await page.goto('https://dental.alasas.tech/admin/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Admin app routes unauthenticated users to /admin/login or shows admin login button
  const currentUrl = page.url();
  console.log('Admin route resolved to:', currentUrl);
  assert.ok(currentUrl.includes('/admin/'), 'Must remain in /admin/ subpath');

  // 6. Verify Cloudflare Worker production API health
  console.log('6. Verifying Production Worker API health ...');
  const workerRes = await fetch('https://alasas-dental-prod-worker.coffee101.workers.dev/health');
  assert.equal(workerRes.status, 200, 'Worker health must be 200');
  const workerHealth = await workerRes.json();
  console.log('Worker health payload:', workerHealth);
  assert.equal(workerHealth.ok, true);
  assert.equal(workerHealth.environment, 'production');
  assert.equal(workerHealth.productionWrites, true);
  console.log('✓ Verified: Production Cloudflare Worker is active and healthy');

  // 7. Verify Worker rejects unauthenticated profile update with 401
  const unauthProfileRes = await fetch('https://alasas-dental-prod-worker.coffee101.workers.dev/api/profile-update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ full_name: 'test' })
  });
  assert.equal(unauthProfileRes.status, 401, 'Unauthenticated profile update must be 401');
  console.log('✓ Verified: Worker rejects unauthenticated profile-update with 401');

  // 8. Verify Worker rejects unauthenticated admin route with 401
  const unauthAdminRes = await fetch('https://alasas-dental-prod-worker.coffee101.workers.dev/api/admin-user-update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ profile_id: 'test' })
  });
  assert.equal(unauthAdminRes.status, 401, 'Unauthenticated admin update must be 401');
  console.log('✓ Verified: Worker rejects unauthenticated admin API with 401');

  console.log('\n=== ALL LIVE VERIFICATIONS PASSED SUCCESSFULLY ===');
} catch (err) {
  console.error('FAILED LIVE VERIFICATION:', err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
