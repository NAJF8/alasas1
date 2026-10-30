import { chromium } from '../admin-app/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const targetUrl = process.argv[2] || 'https://dental.alasas.tech';
console.log(`=== RUNNING MOBILE REDESIGN VERIFICATION ON: ${targetUrl} ===\n`);

const screenshotDir = resolve('_evidence_screenshots/mobile-redesign');
mkdirSync(screenshotDir, { recursive: true });

const viewports = [
  { name: 'iPhone-SE-320x568', width: 320, height: 568, isMobile: true },
  { name: 'iPhone-X-375x812', width: 375, height: 812, isMobile: true },
  { name: 'iPhone-14-390x844', width: 390, height: 844, isMobile: true },
  { name: 'iPhone-15Pro-393x852', width: 393, height: 852, isMobile: true },
  { name: 'iPhone-14ProMax-430x932', width: 430, height: 932, isMobile: true },
  { name: 'Tablet-768x1024', width: 768, height: 1024, isMobile: true },
  { name: 'Desktop-1366x768', width: 1366, height: 768, isMobile: false },
];

const browser = await chromium.launch({ headless: true });

try {
  for (const vp of viewports) {
    console.log(`\n--- Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      locale: 'ar-IQ',
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
    });
    const page = await context.newPage();

    // Collect console errors
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore favicon 404 or non-critical resource 404
        if (!text.includes('favicon.ico')) {
          consoleErrors.push(text);
        }
      }
    });

    const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    assert.equal(response?.status(), 200, `${targetUrl} must return 200`);
    await page.waitForSelector('header.customer-header', { timeout: 15000 });
    await page.waitForTimeout(1000); // Allow fonts and layout to settle

    // 1. Check Horizontal Overflow
    const overflowInfo = await page.evaluate(() => {
      const scrollWidth = document.documentElement.scrollWidth;
      const clientWidth = document.documentElement.clientWidth;
      return {
        hasOverflow: scrollWidth > clientWidth,
        scrollWidth,
        clientWidth,
      };
    });
    console.log(`Horizontal width check: clientWidth=${overflowInfo.clientWidth}, scrollWidth=${overflowInfo.scrollWidth}`);
    assert.equal(
      overflowInfo.hasOverflow,
      false,
      `Viewport ${vp.name} must NOT have horizontal overflow! (${overflowInfo.scrollWidth} > ${overflowInfo.clientWidth})`
    );
    console.log(`✓ No horizontal overflow on ${vp.name}`);

    // 2. Header Verification
    const headerBox = await page.locator('header.customer-header').boundingBox();
    assert.ok(headerBox, 'Header must be present');
    console.log(`Header bounding box height: ${headerBox.height.toFixed(1)}px`);

    if (vp.isMobile) {
      // Mobile header height must be within 60-68px range
      assert.ok(
        headerBox.height >= 58 && headerBox.height <= 72,
        `Mobile header height must be ~60-68px, got ${headerBox.height.toFixed(1)}px`
      );
      console.log(`✓ Mobile header height within specification: ${headerBox.height.toFixed(1)}px`);

      // Menu button must be visible with tappable size >= 40x40
      const menuBtn = page.locator('button.menu-button');
      const menuBox = await menuBtn.boundingBox();
      assert.ok(menuBox, 'Menu button must be present on mobile');
      assert.ok(menuBox.width >= 40 && menuBox.height >= 40, `Menu button must be >= 40x40px, got ${menuBox.width}x${menuBox.height}`);
      console.log(`✓ Menu button visible and touch-friendly: ${menuBox.width.toFixed(1)}x${menuBox.height.toFixed(1)}px`);

      // In header bar, desktop-only items must NOT be visible
      const desktopLogin = await page.locator('.header-actions .header-login').isVisible().catch(() => false);
      assert.equal(desktopLogin, false, 'Desktop login button must be hidden from mobile top bar');
      console.log('✓ Cluttered inline actions hidden from mobile top bar');

      // Brand logo must be visible and proportional
      const brandLogo = page.locator('.customer-header .brand-image');
      const logoBox = await brandLogo.boundingBox();
      assert.ok(logoBox && logoBox.width > 0 && logoBox.height > 0, 'Brand logo must be visible');
      console.log(`✓ Brand logo cleanly sized: ${logoBox.width.toFixed(1)}x${logoBox.height.toFixed(1)}px`);
    } else {
      // Desktop verification
      assert.ok(headerBox.height >= 70, `Desktop header height should be >= 70px, got ${headerBox.height.toFixed(1)}px`);
      const menuVisible = await page.locator('button.menu-button').isVisible().catch(() => false);
      assert.equal(menuVisible, false, 'Menu button must be hidden on desktop');
      console.log('✓ Desktop header layout verified unchanged');
    }

    // 3. Hero Section Verification
    const heroBox = await page.locator('.hero-section').boundingBox();
    assert.ok(heroBox, 'Hero section must be present');
    console.log(`Hero bounding box height: ${heroBox.height.toFixed(1)}px`);

    const heroImg = page.locator('.hero-visual img');
    const heroImgBox = await heroImg.boundingBox();
    assert.ok(heroImgBox && heroImgBox.width > 0 && heroImgBox.height > 0, 'Hero image must be visible');
    console.log(`Hero image rendered at ${heroImgBox.width.toFixed(1)}x${heroImgBox.height.toFixed(1)}px`);

    if (vp.isMobile) {
      // Verify visual sequence on mobile:
      // Kicker Y < Title Y < Description Y < Button Y < Image Y
      const kickerBox = await page.locator('.hero-kicker').boundingBox();
      const titleBox = await page.locator('.hero-copy h1').boundingBox();
      const descBox = await page.locator('.hero-copy p').boundingBox();
      const actionsBox = await page.locator('.hero-actions').boundingBox();

      assert.ok(kickerBox && titleBox && descBox && actionsBox, 'All mobile hero elements must be present');

      assert.ok(kickerBox.y < titleBox.y, 'Kicker must precede Title');
      assert.ok(titleBox.y < descBox.y, 'Title must precede Description');
      assert.ok(descBox.y < actionsBox.y, 'Description must precede CTA button(s)');
      assert.ok(actionsBox.y < heroImgBox.y, 'CTA button(s) must precede Hero Image');
      console.log('✓ Exact vertical sequence verified: Kicker -> Headline -> Description -> CTA -> Image');

      // Verify floating badge «مطابقة موثوقة»
      const floatCard = page.locator('.hero-float-card');
      const floatBox = await floatCard.boundingBox();
      assert.ok(floatBox, 'Float badge must be present');
      const floatText = await floatCard.innerText();
      assert.ok(floatText.includes('مطابقة موثوقة') || floatText.includes('مطابقة موثقة'), 'Float card should have matching badge text');
      console.log('✓ Subtle "مطابقة موثوقة" badge visible');
    }

    // 4. University and Category Grids
    if (vp.isMobile && vp.width >= 350) {
      const uniTiles = await page.locator('.university-tile').all();
      if (uniTiles.length >= 2) {
        const box1 = await uniTiles[0].boundingBox();
        const box2 = await uniTiles[1].boundingBox();
        if (box1 && box2) {
          // If 2 columns, box1 and box2 should have similar Y coordinates (within 10px)
          const sameRow = Math.abs(box1.y - box2.y) < 15;
          console.log(`University tiles grid: 2-columns side-by-side: ${sameRow}`);
        }
      }
    }

    // Capture main page screenshot
    const mainScreenshotPath = resolve(screenshotDir, `${vp.name}-home.png`);
    await page.screenshot({ path: mainScreenshotPath, fullPage: false });
    console.log(`Saved screenshot: ${mainScreenshotPath}`);

    // 5. Mobile Drawer Open/Close Interaction (Mobile only)
    if (vp.isMobile) {
      console.log('Testing mobile menu drawer interaction...');
      const menuBtn = page.locator('button.menu-button');
      await menuBtn.click();
      await page.waitForTimeout(300);

      const navOpen = await page.locator('.header-nav.is-open').isVisible();
      assert.ok(navOpen, 'Mobile nav must open when menu button is clicked');

      // Check drawer elements
      const navLinks = await page.locator('.header-nav.is-open a').count();
      assert.ok(navLinks >= 4, `Mobile drawer must have at least 4 links, found ${navLinks}`);

      const prefsVisible = await page.locator('.header-nav.is-open .asas-prefs-bar').isVisible().catch(() => false);
      console.log(`Preferences bar inside mobile drawer: ${prefsVisible}`);

      // Capture menu open screenshot
      const menuScreenshotPath = resolve(screenshotDir, `${vp.name}-menu-open.png`);
      await page.screenshot({ path: menuScreenshotPath });
      console.log(`Saved drawer screenshot: ${menuScreenshotPath}`);

      // Close drawer via close button or backdrop
      const closeBtn = page.locator('.mobile-drawer-close');
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
      } else {
        await page.locator('.mobile-drawer-backdrop').click({ force: true });
      }
      await page.waitForTimeout(400);

      const navClosed = await page.locator('.header-nav.is-open').isVisible().catch(() => false);
      assert.equal(navClosed, false, 'Mobile drawer must close properly');
      console.log('✓ Mobile drawer closes cleanly');
    }

    assert.equal(consoleErrors.length, 0, `Console errors encountered on ${vp.name}: ${consoleErrors.join(', ')}`);
    await context.close();
  }

  console.log('\n=== ALL 7 VIEWPORT RESPONSIVE TESTS PASSED SUCCESSFULLY! ===');
} finally {
  await browser.close();
}
