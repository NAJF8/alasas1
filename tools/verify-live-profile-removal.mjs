import { chromium } from '../admin-app/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

async function run() {
  console.log('Testing live domain for absence of "أكمل حسابك" on desktop and mobile...');
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Test
  const contextDesktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pageDesktop = await contextDesktop.newPage();
  await pageDesktop.goto('https://dental.alasas.tech', { waitUntil: 'domcontentloaded' });
  await pageDesktop.waitForSelector('.brand-lockup');

  const bodyTextDesktop = await pageDesktop.innerText('body');
  assert.equal(bodyTextDesktop.includes('أكمل حسابك'), false, 'Desktop homepage must not display "أكمل حسابك"');
  console.log('✓ Desktop: "أكمل حسابك" is completely absent.');

  // Check /onboarding redirects away (to /profile or /login)
  await pageDesktop.goto('https://dental.alasas.tech/onboarding', { waitUntil: 'domcontentloaded' });
  await pageDesktop.waitForTimeout(1000);
  const currentUrl = pageDesktop.url();
  console.log('Navigated to /onboarding -> ended at:', currentUrl);
  assert.equal(currentUrl.includes('/profile') || currentUrl.includes('/login'), true, 'Visiting /onboarding redirects safely away without complete-profile page');
  console.log('✓ Desktop: /onboarding safely redirects away.');

  // 2. Mobile Test
  const contextMobile = await browser.newContext({ viewport: { width: 375, height: 667 }, isMobile: true });
  const pageMobile = await contextMobile.newPage();
  await pageMobile.goto('https://dental.alasas.tech', { waitUntil: 'domcontentloaded' });
  await pageMobile.waitForSelector('.brand-lockup');

  const bodyTextMobile = await pageMobile.innerText('body');
  assert.equal(bodyTextMobile.includes('أكمل حسابك'), false, 'Mobile homepage must not display "أكمل حسابك"');
  console.log('✓ Mobile: "أكمل حسابك" is completely absent.');

  // Check registration form on mobile
  await pageMobile.goto('https://dental.alasas.tech/register?role=PATIENT&start=1', { waitUntil: 'domcontentloaded' });
  await pageMobile.waitForSelector('.registration-form');
  const registerTextMobile = await pageMobile.innerText('body');
  assert.equal(registerTextMobile.includes('أنشئ بيانات الدخول'), true, 'Registration step 1 renders properly on mobile');
  console.log('✓ Mobile: Registration flow is healthy and collects credentials upfront.');

  await browser.close();
  console.log('=== ALL LIVE BROWSER VERIFICATION TESTS PASSED ===');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
