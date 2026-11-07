import { chromium } from '../admin-app/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

console.log('=== STARTING LIVE PRODUCTION AUTH & PERMISSION VERIFICATION ===');
console.log('Target: https://dental.alasas.tech');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  locale: 'ar-IQ',
});
const page = await context.newPage();

try {
  // Step 1: Navigate to Home Page
  console.log('\n--- 1. Testing Home Page Load ---');
  await page.goto('https://dental.alasas.tech/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('header.customer-header', { timeout: 15000 });
  console.log('✓ Home page loaded cleanly');

  // Verify no fatal error screen
  const fatalError = await page.locator(':text("تعذر تحميل الحساب")').count();
  assert.equal(fatalError, 0, 'Home page must NEVER display "تعذر تحميل الحساب"');

  // Step 2: Navigate to Login Page
  console.log('\n--- 2. Testing Login Page ---');
  await page.goto('https://dental.alasas.tech/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.aa-auth-page', { timeout: 15000 });
  const loginTitle = await page.locator('.aa-auth-heading h1, .aa-auth-intro-mobile h1').first().innerText();
  console.log(`Login heading: "${loginTitle}"`);
  assert(loginTitle.includes('مرحباً بعودتك'), 'Login heading must say "مرحباً بعودتك"');
  console.log('✓ Login page loaded cleanly');

  // Step 3: Register a fresh live Patient via production worker
  console.log('\n--- 3. Registering a test patient via production worker ---');
  const testPhone = `078${Math.floor(10000000 + Math.random() * 90000000)}`;
  const testPassword = 'Password123#';
  const regPayload = {
    full_name: 'مريض فحص الإنتاج',
    phone: testPhone,
    password: testPassword,
    password_confirmation: testPassword,
    role: 'PATIENT',
    gender: 'MALE',
    province_id: 'province_najaf',
    area_id: 'area_kufa',
    birth_date: '1992-04-12',
    university_id: 'uni_kufa',
    preferred_university_ids: ['uni_kufa'],
  };

  const regRes = await fetch('https://alasas-dental-prod-worker.coffee101.workers.dev/api/registration-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(regPayload),
  });

  const regData = await regRes.json();
  console.log('Registration response status:', regRes.status, 'Request ID:', regData.request_id);
  assert.equal(regRes.status, 201, 'Live registration must succeed with 201');
  assert(regData.auth_uid, 'Registration must return auth_uid');
  assert(regData.custom_token, 'Registration must return custom_token');
  const patientUid = regData.auth_uid;
  console.log(`✓ Test patient created with UID: ${patientUid} and Phone: ${testPhone}`);

  // Exchange custom token to get real Firebase ID token for Firestore rule testing
  const apiKey = 'AIzaSyDRTjsQ40m3atrNEc7MCp_j0FZOAKe4FRc';
  const tokenRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: regData.custom_token, returnSecureToken: true }),
  });
  const tokenData = await tokenRes.json();
  assert(tokenData.idToken, 'Must obtain valid Firebase ID token');
  const patientIdToken = tokenData.idToken;
  console.log('✓ Successfully exchanged custom token for authenticated ID token');

  // Step 4: Perform Real Login on dental.alasas.tech/login Form
  console.log('\n--- 4. Logging in on https://dental.alasas.tech/login via UI form ---');
  const phoneInput = page.locator('input[placeholder="07XXXXXXXXX"]');
  const passwordInput = page.locator('input[type="password"]');
  const submitButton = page.locator('button[type="submit"]:has-text("تسجيل الدخول")');

  await phoneInput.fill(testPhone);
  await passwordInput.fill(testPassword);
  console.log('Filled login form, clicking submit button...');
  await submitButton.click();

  // Step 5: Wait for Navigation to Dashboard
  console.log('\n--- 5. Waiting for authentication and redirection to dashboard ---');
  await page.waitForURL((url) => url.pathname.includes('/dashboard') || url.pathname.includes('/patient/dashboard'), { timeout: 20000 });
  await page.waitForTimeout(2000);

  const currentUrl = page.url();
  console.log('Current URL after login:', currentUrl);

  // Check if "تعذر تحميل الحساب" appeared
  const errorScreen = await page.locator(':text("تعذر تحميل الحساب")').count();
  console.log('Count of "تعذر تحميل الحساب" on screen:', errorScreen);
  assert.equal(errorScreen, 0, 'Screen "تعذر تحميل الحساب" MUST NOT appear for authorized user');

  // Verify that the user successfully reached the dashboard
  const onDashboard = currentUrl.includes('/patient/dashboard') || currentUrl.includes('/dashboard');
  assert(onDashboard, 'User must successfully reach dashboard');

  // Verify patient greeting in header
  const header = page.locator('header.customer-header');
  await header.waitFor({ state: 'visible', timeout: 5000 });
  const headerText = await header.innerText();
  console.log(`Header user greeting: "${headerText.slice(0, 100)}"`);
  assert(headerText.includes('مريض فحص الإنتاج') || headerText.includes('الملف الشخصي'), 'Header must display user name or profile link');
  console.log('✓ LIVE UI AUTHENTICATION AND ACCOUNT LOADING SUCCEEDED WITH ZERO ERRORS!');

  // Step 6: Test Refreshing the page after login
  console.log('\n--- 6. Testing Page Refresh after Login ---');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const refreshedUrl = page.url();
  console.log('URL after reload:', refreshedUrl);
  const errorAfterReload = await page.locator(':text("تعذر تحميل الحساب")').count();
  assert.equal(errorAfterReload, 0, 'Reloading MUST NOT cause "تعذر تحميل الحساب"');
  console.log('✓ Page refresh preserved authenticated session successfully');

  // Step 7: Test Firestore Security Rules Verification against Production
  console.log('\n--- 7. Testing Firestore Security Rules Authorization on Production ---');

  // 7a. Authenticated user reading their OWN profile -> 200 OK
  const ownProfileRes = await fetch(`https://firestore.googleapis.com/v1/projects/al-asas-dental-prod/databases/(default)/documents/profiles/${patientUid}`, {
    headers: { Authorization: `Bearer ${patientIdToken}` }
  });
  console.log(`Own profile read status (${patientUid}):`, ownProfileRes.status);
  assert.equal(ownProfileRes.status, 200, 'Authenticated user MUST be allowed to read their own profile');
  const ownProfileData = await ownProfileRes.json();
  assert.equal(ownProfileData.fields?.id?.stringValue, patientUid);
  console.log('✓ Verified: Authenticated user successfully read their own profile (200 OK)');

  // 7b. Authenticated user reading ANOTHER user's profile -> 403 PERMISSION_DENIED
  const superAdminUid = 'wmcFuqRQOWb82EW9XOuGVeVBoiF2';
  const otherProfileRes = await fetch(`https://firestore.googleapis.com/v1/projects/al-asas-dental-prod/databases/(default)/documents/profiles/${superAdminUid}`, {
    headers: { Authorization: `Bearer ${patientIdToken}` }
  });
  console.log(`Other user's profile read status (${superAdminUid}):`, otherProfileRes.status);
  assert.equal(otherProfileRes.status, 403, 'User reading another user profile MUST be rejected (403 PERMISSION_DENIED)');
  console.log('✓ Verified: Cross-user profile access correctly blocked by Firestore Security Rules (403 PERMISSION_DENIED)');

  // 7c. Unauthenticated user reading profile -> 403 PERMISSION_DENIED
  const unauthRes = await fetch(`https://firestore.googleapis.com/v1/projects/al-asas-dental-prod/databases/(default)/documents/profiles/${patientUid}`);
  console.log('Unauthenticated profile read status:', unauthRes.status);
  assert.equal(unauthRes.status, 403, 'Unauthenticated user MUST be denied (403 PERMISSION_DENIED)');
  console.log('✓ Verified: Unauthenticated profile read correctly blocked (403 PERMISSION_DENIED)');

  // Step 8: Test Sign Out
  console.log('\n--- 8. Testing Sign Out and Return to Guest State ---');
  const logoutBtn = page.locator('button.header-logout');
  await logoutBtn.click();
  await page.waitForTimeout(2000);
  const postLogoutUrl = page.url();
  console.log('URL after sign out (redirects protected route to /login):', postLogoutUrl);
  assert(postLogoutUrl.includes('/login'), 'Unauthenticated user must be redirected to /login');

  // Navigate to home to verify guest header
  await page.goto('https://dental.alasas.tech/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const guestLink = await page.locator('header.customer-header a[href="/login"]').count();
  assert(guestLink > 0, 'Home header must display "تسجيل الدخول" for guest');
  console.log('✓ Sign out successful and confirmed on home page');

  console.log('\n===============================================================');
  console.log('✓ ALL LIVE PRODUCTION AUTHENTICATION & PERMISSION TESTS PASSED!');
  console.log('===============================================================\n');

} catch (err) {
  console.error('\n❌ LIVE VERIFICATION FAILED:', err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
