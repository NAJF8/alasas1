import assert from 'node:assert/strict';
import { isProfileComplete, type Profile } from '../src/lib/profileValidation.ts';

console.log('--- RUNNING REMOVE COMPLETE PROFILE ROUTING & DATA SUITE ---');

// 1. Full Patient Profile: Complete
const validPatientProfile: Profile = {
  id: 'patient_1',
  role: 'PATIENT',
  status: 'VERIFIED',
  full_name: 'علي حسن أحمد',
  phone: '+9647801234567',
  whatsapp: '+9647801234567',
  gender: 'MALE',
  birth_date: '1995-05-15',
  province_id: 'province_najaf',
  area_id: 'area_kufa',
  university_id: 'uni_kufa',
  stage: null,
  workplace: null,
  preferred_university_ids: ['uni_kufa'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
assert.equal(isProfileComplete(validPatientProfile), true, 'Valid patient profile must be complete');

// 2. Full Student Profile: Complete
const validStudentProfile: Profile = {
  id: 'student_1',
  role: 'STUDENT',
  status: 'PENDING',
  full_name: 'فاطمة محمد علي',
  phone: '+9647701234567',
  whatsapp: '+9647701234567',
  gender: 'FEMALE',
  birth_date: null,
  province_id: 'province_baghdad',
  area_id: null,
  university_id: 'uni_baghdad',
  stage: 'FOURTH',
  workplace: null,
  preferred_university_ids: ['uni_baghdad', 'uni_mustansiriyah'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
assert.equal(isProfileComplete(validStudentProfile), true, 'Valid student profile must be complete');

// 3. Incomplete Patient Profiles
const patientMissingPhone: Profile = { ...validPatientProfile, phone: '' };
assert.equal(isProfileComplete(patientMissingPhone), false, 'Patient without phone is incomplete');

const patientMissingProvince: Profile = { ...validPatientProfile, province_id: null };
assert.equal(isProfileComplete(patientMissingProvince), false, 'Patient without province is incomplete');

const patientMissingUnis: Profile = { ...validPatientProfile, preferred_university_ids: [] };
assert.equal(isProfileComplete(patientMissingUnis), false, 'Patient without preferred universities is incomplete');

// 4. Incomplete Student Profiles
const studentMissingStage: Profile = { ...validStudentProfile, stage: null };
assert.equal(isProfileComplete(studentMissingStage), false, 'Student without academic stage is incomplete');

const studentMissingMainUniversity: Profile = { ...validStudentProfile, university_id: null };
assert.equal(isProfileComplete(studentMissingMainUniversity), false, 'Student without primary university is incomplete');

// 5. Routing resolution simulation
function resolveCustomerRoute(profile: Profile | null): string {
  if (!profile) return '/register';
  if (!isProfileComplete(profile)) return '/profile'; // Redirects incomplete profiles to /profile directly
  if (profile.role === 'STUDENT' && profile.status !== 'VERIFIED') return '/student/verification';
  return profile.role === 'STUDENT' ? '/student/search' : '/patient/dashboard';
}

// Complete patient -> /patient/dashboard
assert.equal(resolveCustomerRoute(validPatientProfile), '/patient/dashboard');

// Pending student -> /student/verification (requires admin approval before student/search)
assert.equal(resolveCustomerRoute(validStudentProfile), '/student/verification');

// Approved student -> /student/search
const approvedStudentProfile: Profile = { ...validStudentProfile, status: 'VERIFIED' };
assert.equal(resolveCustomerRoute(approvedStudentProfile), '/student/search');

// Incomplete legacy profile -> /profile (NOT /onboarding or /complete-profile)
assert.equal(resolveCustomerRoute(patientMissingProvince), '/profile');
assert.equal(resolveCustomerRoute(studentMissingStage), '/profile');

console.log('✓ All Profile Completeness and Route Resolution Tests PASSED');
