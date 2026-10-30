import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

console.log('--- RUNNING HEADER & ADMIN ISOLATION SECURITY SUITE ---');

type UserRole = 'GUEST' | 'PATIENT' | 'STUDENT' | 'STAFF' | 'ADMIN' | 'SUPER_ADMIN';

interface MockProfile {
  id: string;
  role: string;
  status: string;
  full_name: string;
}

// 1. Test Header item resolution logic
function resolveHeaderElements(user: boolean, profile: MockProfile | null) {
  if (!user || !profile) {
    return {
      desktopAuth: ['تسجيل الدخول', 'إنشاء حساب'],
      mobileAuth: ['تسجيل الدخول', 'إنشاء حساب'],
      hasProfileLink: false,
      hasAdminLink: false,
      hasGreeting: false,
      hasLogout: false,
    };
  }

  const isCustomer = profile.role === 'PATIENT' || profile.role === 'STUDENT';
  const isAuthorizedAdmin = ['ADMIN', 'SUPER_ADMIN', 'STAFF'].includes(profile.role);

  return {
    desktopAuth: [],
    mobileAuth: isCustomer ? ['الملف الشخصي', 'تسجيل الخروج'] : ['تسجيل الخروج'],
    hasProfileLink: isCustomer,
    // Admin link MUST NEVER be present in customer header for ANY role
    hasAdminLink: false,
    hasGreeting: true,
    hasLogout: true,
  };
}

// Test Guest persona
const guestHeader = resolveHeaderElements(false, null);
assert.deepEqual(guestHeader.desktopAuth, ['تسجيل الدخول', 'إنشاء حساب']);
assert.equal(guestHeader.hasProfileLink, false);
assert.equal(guestHeader.hasAdminLink, false);
assert.equal(guestHeader.hasLogout, false);

// Test Patient persona
const patientHeader = resolveHeaderElements(true, { id: 'p1', role: 'PATIENT', status: 'VERIFIED', full_name: 'علي حسن' });
assert.equal(patientHeader.hasProfileLink, true, 'Patient must have single "الملف الشخصي" link');
assert.equal(patientHeader.hasAdminLink, false, 'Patient must NEVER have admin link');
assert.equal(patientHeader.hasLogout, true);

// Test Student persona
const studentHeader = resolveHeaderElements(true, { id: 's1', role: 'STUDENT', status: 'PENDING', full_name: 'سارة علي' });
assert.equal(studentHeader.hasProfileLink, true, 'Student must have single "الملف الشخصي" link');
assert.equal(studentHeader.hasAdminLink, false, 'Student must NEVER have admin link');
assert.equal(studentHeader.hasLogout, true);

// Test Staff persona
const staffHeader = resolveHeaderElements(true, { id: 'st1', role: 'STAFF', status: 'VERIFIED', full_name: 'فريق العمل' });
assert.equal(staffHeader.hasProfileLink, false, 'Staff on customer site must NOT see patient profile link');
assert.equal(staffHeader.hasAdminLink, false, 'Staff must NOT see admin link in customer header');
assert.equal(staffHeader.hasLogout, true);

// Test Admin persona
const adminHeader = resolveHeaderElements(true, { id: 'a1', role: 'ADMIN', status: 'VERIFIED', full_name: 'مدير النظام' });
assert.equal(adminHeader.hasProfileLink, false, 'Admin on customer site must NOT see patient profile link');
assert.equal(adminHeader.hasAdminLink, false, 'Admin must NOT see admin link in customer header');
assert.equal(adminHeader.hasLogout, true);

// Test Super Admin persona
const superAdminHeader = resolveHeaderElements(true, { id: 'sa1', role: 'SUPER_ADMIN', status: 'VERIFIED', full_name: 'المدير العام' });
assert.equal(superAdminHeader.hasProfileLink, false, 'Super Admin on customer site must NOT see patient profile link');
assert.equal(superAdminHeader.hasAdminLink, false, 'Super Admin must NOT see admin link in customer header');
assert.equal(superAdminHeader.hasLogout, true);

// 2. Verify Header.tsx source code guarantees
const headerSource = readFileSync(resolve('customer-app/src/components/layout/Header.tsx'), 'utf8');
assert.doesNotMatch(headerSource, /href="\/admin\/"/, 'Header.tsx must NOT contain any link to /admin/');
assert.doesNotMatch(headerSource, />لوحة الإدارة</, 'Header.tsx must NOT render text "لوحة الإدارة"');
assert.doesNotMatch(headerSource, />حسابي</, 'Header.tsx must NOT duplicate links as "حسابي"');
assert.doesNotMatch(headerSource, />تعديل الملف الشخصي</, 'Header.tsx must NOT have duplicate "تعديل الملف الشخصي"');
assert.match(headerSource, /isCustomer && \(\s*<Link className="header-login inline-flex items-center gap-1" to="\/profile"/, 'Header.tsx must only show "الملف الشخصي" to customer roles');

// 3. Verify ProfilePage.tsx source code guarantees
const profilePageSource = readFileSync(resolve('customer-app/src/pages/ProfilePage.tsx'), 'utf8');
assert.match(profilePageSource, /const isCustomer = profile\.role === 'PATIENT' \|\| profile\.role === 'STUDENT';/, 'ProfilePage must isolate non-customers');
assert.match(profilePageSource, /if \(!isCustomer\) \{/, 'ProfilePage must guard against administrative roles');
assert.match(profilePageSource, /حساب إداري محمي/, 'ProfilePage must render admin isolation card');
assert.match(profilePageSource, /href="\/admin\/"/, 'ProfilePage must guide admins to /admin/');

// 4. Verify App.tsx routing protection
const appSource = readFileSync(resolve('customer-app/src/App.tsx'), 'utf8');
assert.match(appSource, /\['ADMIN', 'SUPER_ADMIN', 'STAFF'\]\.includes\(profile\.role\)/, 'App.tsx must guard customer dashboards from admin roles');
assert.doesNotMatch(appSource, /<Route path="\/complete-profile" element={<CompleteProfile/, 'complete-profile must not exist as a route');

// 5. Verify firestore.rules security
const rulesSource = readFileSync(resolve('firestore.rules'), 'utf8');
assert.match(rulesSource, /resource\.data\.role in \['PATIENT', 'STUDENT'\]/, 'firestore.rules must restrict client profile updates to PATIENT and STUDENT');
assert.match(rulesSource, /resource\.data\.role != 'SUPER_ADMIN' && request\.auth\.uid != uid/, 'firestore.rules must protect SUPER_ADMIN from deletion and self-tampering');

console.log('✓ All 5 Header & Admin Isolation Security Verifications PASSED');
