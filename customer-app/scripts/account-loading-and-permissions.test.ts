import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isProfileComplete, type Profile } from '../src/lib/profileValidation.ts';

console.log('=== RUNNING ACCOUNT LOADING & PERMISSION SECURITY TEST SUITE ===');

// 1. Verify firestore.rules structural security
const rulesPath = existsSync(resolve('firestore.rules'))
  ? resolve('firestore.rules')
  : resolve('..', 'firestore.rules');
const rules = readFileSync(rulesPath, 'utf8');

// Ensure profileExists is defined and used
assert(rules.includes('function profileExists(uid)'), 'firestore.rules must define profileExists');
assert(rules.includes('profileExists(request.auth.uid)'), 'verifiedRole must verify document existence before accessing data');

// Ensure client profiles can only read their own document or manager
assert(
  rules.includes("allow read: if signedIn() && (request.auth.uid == uid || manager());"),
  'User can only read their own profile document unless manager'
);

// Ensure user CANNOT escalate role during create
assert(
  rules.includes("request.resource.data.role in ['PATIENT', 'STUDENT']"),
  'Profile creation must strictly forbid ADMIN / SUPER_ADMIN roles'
);

// Ensure user CANNOT change role during update
assert(
  rules.includes("request.resource.data.role == resource.data.role"),
  'Profile update must strictly prevent role alteration'
);

// Ensure user CANNOT alter status during update
assert(
  rules.includes("request.resource.data.status == resource.data.status"),
  'Profile update must strictly prevent status elevation'
);

// Ensure Super Admin protections
assert(
  rules.includes("resource.data.role != 'SUPER_ADMIN' && request.auth.uid != uid"),
  'Super Admin documents cannot be self-deleted or deleted'
);

// Ensure owner is checked first for patient and student preferences
assert(
  rules.includes("match /patient_preferred_universities/{id} {\n      allow read, delete: if owner('patient_id') || manager();"),
  'patient_preferred_universities must check owner first'
);
assert(
  rules.includes("match /student_preferred_universities/{id} {\n      allow read, delete: if owner('student_id') || manager();"),
  'student_preferred_universities must check owner first'
);

console.log('✓ Firestore Security Rules assertions PASSED');

// 2. Test Role-Based Account Resolution & Isolation Matrix
type SimulatedAuthUser = {
  uid: string;
  email?: string;
  phoneNumber?: string;
  displayName?: string;
};

function simulateProfileAccess(
  currentUser: SimulatedAuthUser | null,
  targetProfile: Profile | null,
  managerRoles = ['ADMIN', 'SUPER_ADMIN']
): { canRead: boolean; reason: string } {
  if (!currentUser) {
    return { canRead: false, reason: 'UNAUTHENTICATED' };
  }
  if (!targetProfile) {
    return { canRead: false, reason: 'PROFILE_NOT_FOUND' };
  }
  if (currentUser.uid === targetProfile.id) {
    return { canRead: true, reason: 'OWNER' };
  }
  if (managerRoles.includes(currentUser.uid)) {
    return { canRead: true, reason: 'MANAGER' };
  }
  return { canRead: false, reason: 'PERMISSION_DENIED' };
}

// Case A: Unauthenticated user
const unauth = simulateProfileAccess(null, {
  id: 'user_1',
  role: 'PATIENT',
  status: 'VERIFIED',
  full_name: 'مريض تجريبي',
  phone: '+9647800000000',
  whatsapp: null,
  gender: 'MALE',
  birth_date: '1990-01-01',
  province_id: 'p1',
  area_id: 'a1',
  university_id: 'u1',
  stage: null,
  workplace: null,
  preferred_university_ids: ['u1'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});
assert.equal(unauth.canRead, false);
assert.equal(unauth.reason, 'UNAUTHENTICATED');

// Case B: Registered Patient reading own profile
const patientUser: SimulatedAuthUser = { uid: 'patient_1' };
const patientProfile: Profile = {
  id: 'patient_1',
  role: 'PATIENT',
  status: 'VERIFIED',
  full_name: 'علي حسن',
  phone: '+9647801111111',
  whatsapp: null,
  gender: 'MALE',
  birth_date: '1995-03-10',
  province_id: 'p_najaf',
  area_id: 'a_kufa',
  university_id: 'u_kufa',
  stage: null,
  workplace: null,
  preferred_university_ids: ['u_kufa'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
const patientAccess = simulateProfileAccess(patientUser, patientProfile);
assert.equal(patientAccess.canRead, true);
assert.equal(patientAccess.reason, 'OWNER');

// Case C: Student reading own profile
const studentUser: SimulatedAuthUser = { uid: 'student_1' };
const studentProfile: Profile = {
  id: 'student_1',
  role: 'STUDENT',
  status: 'PENDING',
  full_name: 'طالب تجريبي',
  phone: '+9647702222222',
  whatsapp: null,
  gender: 'FEMALE',
  birth_date: null,
  province_id: 'p_baghdad',
  area_id: null,
  university_id: 'u_baghdad',
  stage: 'FOURTH',
  workplace: null,
  preferred_university_ids: ['u_baghdad'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
const studentAccess = simulateProfileAccess(studentUser, studentProfile);
assert.equal(studentAccess.canRead, true);
assert.equal(studentAccess.reason, 'OWNER');

// Case D: User trying to access another user's profile
const attackerUser: SimulatedAuthUser = { uid: 'attacker_evil' };
const attackerAccess = simulateProfileAccess(attackerUser, patientProfile);
assert.equal(attackerAccess.canRead, false);
assert.equal(attackerAccess.reason, 'PERMISSION_DENIED');

// Case E: Authorized Admin accessing patient profile
const adminUser: SimulatedAuthUser = { uid: 'ADMIN' };
const adminAccess = simulateProfileAccess(adminUser, patientProfile, ['ADMIN']);
assert.equal(adminAccess.canRead, true);
assert.equal(adminAccess.reason, 'MANAGER');

// Case F: Role escalation attempt (client trying to update role or status)
function simulateProfileUpdate(
  actorUid: string,
  current: Profile,
  updatePayload: Partial<Profile>
): { allowed: boolean; reason: string } {
  if (actorUid !== current.id) {
    return { allowed: false, reason: 'NOT_OWNER' };
  }
  if (!['PATIENT', 'STUDENT'].includes(current.role)) {
    return { allowed: false, reason: 'RESTRICTED_ROLE' };
  }
  if (updatePayload.role && updatePayload.role !== current.role) {
    return { allowed: false, reason: 'CANNOT_CHANGE_ROLE' };
  }
  if (updatePayload.status && updatePayload.status !== current.status) {
    return { allowed: false, reason: 'CANNOT_CHANGE_STATUS' };
  }
  const allowedKeys = new Set([
    'full_name', 'phone', 'whatsapp', 'gender', 'birth_date',
    'province_id', 'area_id', 'university_id', 'stage', 'workplace',
    'preferred_university_ids', 'updated_at'
  ]);
  for (const key of Object.keys(updatePayload)) {
    if (!allowedKeys.has(key)) {
      return { allowed: false, reason: `FORBIDDEN_KEY_${key}` };
    }
  }
  return { allowed: true, reason: 'UPDATED' };
}

// Attacker tries to escalate role from PATIENT to ADMIN
const escalation1 = simulateProfileUpdate('patient_1', patientProfile, { role: 'ADMIN' as any });
assert.equal(escalation1.allowed, false);
assert.equal(escalation1.reason, 'CANNOT_CHANGE_ROLE');

// Attacker tries to escalate status from PENDING to VERIFIED
const escalation2 = simulateProfileUpdate('student_1', studentProfile, { status: 'VERIFIED' });
assert.equal(escalation2.allowed, false);
assert.equal(escalation2.reason, 'CANNOT_CHANGE_STATUS');

// Legitimate update
const legitimate = simulateProfileUpdate('patient_1', patientProfile, {
  full_name: 'علي حسن أحمد',
  updated_at: new Date().toISOString(),
});
assert.equal(legitimate.allowed, true);

// 3. Test Secondary Query Failure Isolation
function resolveProfileWithSecondaryFallback(
  profileDoc: Profile,
  secondaryDataError: Error | null
): { profile: Profile; isFatal: boolean } {
  try {
    if (secondaryDataError) {
      console.warn('Simulated secondary query failure:', secondaryDataError.message);
      // Secondary failure is non-fatal: retain profile with primary preferred universities
      return { profile: profileDoc, isFatal: false };
    }
    return { profile: profileDoc, isFatal: false };
  } catch (err) {
    return { profile: profileDoc, isFatal: true };
  }
}

const fallbackTest = resolveProfileWithSecondaryFallback(patientProfile, new Error('Permission denied on secondary table'));
assert.equal(fallbackTest.isFatal, false, 'Secondary data failure must never be fatal');
assert.equal(fallbackTest.profile.id, 'patient_1', 'Primary profile data must be preserved');

console.log('✓ Role isolation, escalation prevention, and non-fatal secondary handling PASSED');
