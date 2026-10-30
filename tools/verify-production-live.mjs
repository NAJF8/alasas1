import { chromium } from '../admin-app/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const evidenceDir = resolve(process.cwd(), '_evidence_screenshots');
mkdirSync(evidenceDir, { recursive: true });

console.log('=== STARTING LIVE PRODUCTION VERIFICATION ON https://dental.alasas.tech ===');

const browser = await chromium.launch({ headless: true });

try {
  // -------------------------------------------------------------
  // Test 1: Desktop View (Arabic, Light Mode)
  // -------------------------------------------------------------
  console.log('\n--- Test 1: Desktop View (Arabic, Light Mode) ---');
  const contextDesktop = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'ar-IQ',
  });
  const page = await contextDesktop.newPage();

  const networkFailures = [];
  page.on('response', (res) => {
    if (res.status() >= 400 && !res.url().includes('favicon.ico')) {
      networkFailures.push(`${res.status()} ${res.url()}`);
    }
  });

  console.log('Navigating to https://dental.alasas.tech/ ...');
  const response = await page.goto('https://dental.alasas.tech/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  assert.equal(response?.status(), 200, 'Home page must return 200');

  await page.waitForSelector('header.customer-header', { timeout: 15000 });
  await page.waitForSelector('.university-tile', { timeout: 15000 });
  await page.waitForSelector('.category-tile', { timeout: 15000 });
  await page.waitForTimeout(1500);

  // Verify tab title
  const title = await page.title();
  console.log(`Live Document Title: "${title}"`);
  assert(title.includes('الأساس لطب الأسنان'), `Title must contain "الأساس لطب الأسنان", got "${title}"`);
  assert(!title.includes('undefined'), 'Title must NOT contain "undefined"');

  // Verify Header Logo
  const logo = page.locator('header.customer-header .official-brand-logo');
  await logo.waitFor({ state: 'visible', timeout: 5000 });
  const logoBox = await logo.boundingBox();
  console.log(`Header Logo bounding box: width=${logoBox?.width}, height=${logoBox?.height}`);
  assert(logoBox && logoBox.width >= 40 && logoBox.height >= 40, 'Logo must be properly enlarged');

  // Verify University Images
  console.log('Checking University cards on Home page...');
  const uniCards = await page.locator('.university-tile').all();
  console.log(`Found ${uniCards.length} university cards.`);
  assert(uniCards.length > 0, 'Must render university cards');

  for (let i = 0; i < uniCards.length; i++) {
    const card = uniCards[i];
    const uniImg = card.locator('img.card-media');
    await uniImg.waitFor({ state: 'visible', timeout: 5000 });
    const src = await uniImg.getAttribute('src');
    const naturalWidth = await uniImg.evaluate((img) => img.naturalWidth);
    const naturalHeight = await uniImg.evaluate((img) => img.naturalHeight);
    const complete = await uniImg.evaluate((img) => img.complete);
    console.log(`  [Uni ${i + 1}] src="${src}" naturalWidth=${naturalWidth} naturalHeight=${naturalHeight} complete=${complete}`);
    assert(complete, `University image ${i + 1} must be complete`);
    assert(naturalWidth > 0, `University image ${i + 1} must render real graphic content (naturalWidth > 0)`);
  }

  // Verify Clinical Category Images
  console.log('Checking Clinical Category cards on Home page...');
  const catCards = await page.locator('.category-tile').all();
  console.log(`Found ${catCards.length} category cards.`);
  assert(catCards.length > 0, 'Must render clinical category cards');

  for (let i = 0; i < catCards.length; i++) {
    const card = catCards[i];
    const catImg = card.locator('img.card-media');
    await catImg.waitFor({ state: 'visible', timeout: 5000 });
    const src = await catImg.getAttribute('src');
    const naturalWidth = await catImg.evaluate((img) => img.naturalWidth);
    const naturalHeight = await catImg.evaluate((img) => img.naturalHeight);
    const complete = await catImg.evaluate((img) => img.complete);
    console.log(`  [Cat ${i + 1}] src="${src}" naturalWidth=${naturalWidth} naturalHeight=${naturalHeight} complete=${complete}`);
    assert(complete, `Category image ${i + 1} must be complete`);
    assert(naturalWidth > 0, `Category image ${i + 1} must render real graphic content (naturalWidth > 0)`);
  }

  // Take Desktop Screenshot
  await page.screenshot({ path: resolve(evidenceDir, '01-desktop-home-light.png'), fullPage: false });
  console.log('✓ Captured 01-desktop-home-light.png');

  // -------------------------------------------------------------
  // Test 2: Dark Mode
  // -------------------------------------------------------------
  console.log('\n--- Test 2: Dark Mode Verification ---');
  const darkBtn = page.locator('.asas-theme-capsule button[aria-label="الوضع الليلي"]');
  if (await darkBtn.count() > 0) {
    await darkBtn.click();
    await page.waitForTimeout(600);
    const htmlTheme = await page.locator('html').getAttribute('data-theme');
    console.log(`HTML data-theme after dark click: "${htmlTheme}"`);
    assert.equal(htmlTheme, 'dark', 'Theme must be dark');
    await page.screenshot({ path: resolve(evidenceDir, '02-desktop-home-dark.png'), fullPage: false });
    console.log('✓ Captured 02-desktop-home-dark.png');
  }

  // -------------------------------------------------------------
  // Test 3: English Language Switch
  // -------------------------------------------------------------
  console.log('\n--- Test 3: English Language Switch ---');
  const langBtn = page.locator('button.asas-lang-capsule');
  if (await langBtn.count() > 0) {
    await langBtn.click();
    await page.waitForTimeout(600);
    const htmlDir = await page.locator('html').getAttribute('dir');
    const htmlLang = await page.locator('html').getAttribute('lang');
    console.log(`HTML dir="${htmlDir}" lang="${htmlLang}"`);
    assert.equal(htmlDir, 'ltr', 'Dir must be ltr for English');
    assert.equal(htmlLang, 'en', 'Lang must be en for English');
    await page.screenshot({ path: resolve(evidenceDir, '03-desktop-home-en.png'), fullPage: false });
    console.log('✓ Captured 03-desktop-home-en.png');

    // Switch back to Arabic
    await langBtn.click();
    await page.waitForTimeout(400);
  }

  // Switch back to Light Mode
  const lightBtn = page.locator('.asas-theme-capsule button[aria-label="الوضع النهاري"]');
  if (await lightBtn.count() > 0) {
    await lightBtn.click();
    await page.waitForTimeout(400);
  }

  await contextDesktop.close();

  // -------------------------------------------------------------
  // Test 4: Mobile Viewport (Arabic)
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Mobile Viewport (iPhone 14 / Pixel) ---');
  const contextMobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'ar-IQ',
    isMobile: true,
  });
  const pageMobile = await contextMobile.newPage();
  await pageMobile.goto('https://dental.alasas.tech/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await pageMobile.waitForSelector('header.customer-header', { timeout: 15000 });
  await pageMobile.waitForTimeout(1000);

  const mobileLogo = pageMobile.locator('header.customer-header .official-brand-logo');
  await mobileLogo.waitFor({ state: 'visible', timeout: 5000 });
  const mobileLogoBox = await mobileLogo.boundingBox();
  console.log(`Mobile Logo bounding box: width=${mobileLogoBox?.width}, height=${mobileLogoBox?.height}`);
  assert(mobileLogoBox && mobileLogoBox.width > 30, 'Mobile logo must be visible and properly sized');

  await pageMobile.screenshot({ path: resolve(evidenceDir, '04-mobile-home-light.png') });
  console.log('✓ Captured 04-mobile-home-light.png');

  await contextMobile.close();

  // -------------------------------------------------------------
  // Test 5: Check Inner Pages (Login, How It Works, Admin)
  // -------------------------------------------------------------
  console.log('\n--- Test 5: Inner Pages Verification ---');
  const contextPages = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const testPage = await contextPages.newPage();

  // How it works
  console.log('Navigating to /how-it-works ...');
  await testPage.goto('https://dental.alasas.tech/how-it-works', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await testPage.waitForSelector('header.customer-header', { timeout: 15000 });
  await testPage.waitForTimeout(1000);
  const howTitle = await testPage.title();
  console.log(`How it works title: "${howTitle}"`);
  assert(!howTitle.includes('undefined'), 'Title must not be undefined');
  await testPage.screenshot({ path: resolve(evidenceDir, '05-how-it-works.png') });
  console.log('✓ How it works loaded cleanly');

  // Login page
  console.log('Navigating to /login ...');
  await testPage.goto('https://dental.alasas.tech/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await testPage.waitForSelector('.aa-auth-page', { timeout: 15000 });
  await testPage.waitForTimeout(1000);
  const loginLogo = testPage.locator('.aa-auth-logo, .aa-auth-mobile-brand img');
  assert(await loginLogo.count() > 0, 'Login page must have brand logo/mark');
  const loginLogoComplete = await loginLogo.first().evaluate((img) => img.complete);
  console.log(`Login logo loaded complete: ${loginLogoComplete}`);
  assert(loginLogoComplete, 'Login logo must be fully loaded');
  await testPage.screenshot({ path: resolve(evidenceDir, '06-login-page.png') });
  console.log('✓ Login page loaded with logo');

  // Admin App
  console.log('Navigating to /admin/ ...');
  await testPage.goto('https://dental.alasas.tech/admin/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await testPage.waitForTimeout(2000);
  const adminTitle = await testPage.title();
  console.log(`Admin page title: "${adminTitle}"`);
  assert(adminTitle.includes('الأساس لطب الأسنان'), `Admin title must contain platform name, got "${adminTitle}"`);
  await testPage.screenshot({ path: resolve(evidenceDir, '07-admin-gate.png') });
  console.log('✓ Admin gate loaded with correct title');

  await contextPages.close();

  // -------------------------------------------------------------
  // Final Checks: Network Assertions
  // -------------------------------------------------------------
  console.log('\n--- Final Network Audit ---');
  const criticalNetworkFailures = networkFailures.filter(f => !f.includes('firestore') && !f.includes('analytics'));
  console.log(`Total non-200 network requests: ${criticalNetworkFailures.length}`);
  if (criticalNetworkFailures.length > 0) {
    console.warn('Network warnings/failures:', criticalNetworkFailures);
  }
  assert.equal(criticalNetworkFailures.length, 0, 'There should be NO 404 image or script assets on production');

  console.log('\n======================================================');
  console.log('✓ ALL LIVE PRODUCTION VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
} finally {
  await browser.close();
}
