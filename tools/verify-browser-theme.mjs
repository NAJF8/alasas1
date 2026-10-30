import { chromium } from '../admin-app/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

async function run() {
  console.log('Launching headless browser with dark color scheme emulation...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    colorScheme: 'dark', // Emulate OS in Dark Mode
  });
  const page = await context.newPage();

  console.log('Navigating to https://dental.alasas.tech on a clean first visit...');
  await page.goto('https://dental.alasas.tech', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.asas-theme-capsule');

  // 1. Verify default theme on first visit is 'light'
  const firstVisitTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const firstVisitMode = await page.evaluate(() => document.documentElement.getAttribute('data-theme-mode'));
  console.log(`First visit attributes (OS=dark): data-theme="${firstVisitTheme}", data-theme-mode="${firstVisitMode}"`);
  assert.equal(firstVisitTheme, 'light', 'First visit MUST be light mode even when OS is dark');

  // 2. Click Dark mode button
  console.log('Testing theme switch to Dark...');
  const darkBtn = page.locator('button[aria-label="الوضع الليلي"]');
  await darkBtn.click();
  await page.waitForTimeout(300);
  const darkTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const storedTheme = await page.evaluate(() => localStorage.getItem('al-asas-theme'));
  console.log(`After selecting Dark: data-theme="${darkTheme}", localStorage="${storedTheme}"`);
  assert.equal(darkTheme, 'dark');
  assert.equal(storedTheme, 'dark');

  // 3. Reload to test persistence
  console.log('Testing reload persistence...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.asas-theme-capsule');
  const reloadedTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  console.log(`After reload: data-theme="${reloadedTheme}"`);
  assert.equal(reloadedTheme, 'dark', 'Saved preference dark must persist across reload');

  // 4. Test System mode
  console.log('Testing System mode button...');
  const systemBtn = page.locator('button[aria-label="تلقائي حسب النظام"]');
  await systemBtn.click();
  await page.waitForTimeout(300);
  const sysDarkTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  console.log(`After selecting System (OS=dark): data-theme="${sysDarkTheme}"`);
  assert.equal(sysDarkTheme, 'dark', 'System mode follows dark OS');

  // Emulate changing OS to light
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(300);
  const sysLightTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  console.log(`After changing OS to light: data-theme="${sysLightTheme}"`);
  assert.equal(sysLightTheme, 'light', 'System mode follows light OS');

  await browser.close();
  console.log('=== REAL BROWSER E2E TEST PASSED ON PRODUCTION DOMAIN ===');
}

run().catch((err) => {
  console.error('Browser test failed:', err);
  process.exit(1);
});
