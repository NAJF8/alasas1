import test, { before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';

let env;
const T = '2026-01-01T00:00:00.000Z';

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-alasas-rules',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(async () => { await env?.cleanup(); });

const profile = (id, role, status = 'VERIFIED') => ({ id, role, status, full_name: id, created_at: T, updated_at: T });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'profiles/patient1'), profile('patient1', 'PATIENT'));
    await setDoc(doc(db, 'profiles/patient2'), profile('patient2', 'PATIENT'));
    await setDoc(doc(db, 'profiles/student1'), profile('student1', 'STUDENT'));
    await setDoc(doc(db, 'profiles/pending1'), profile('pending1', 'STUDENT', 'PENDING'));
    await setDoc(doc(db, 'profiles/admin1'), profile('admin1', 'ADMIN'));
    await setDoc(doc(db, 'profiles/root'), profile('root', 'SUPER_ADMIN'));
    await setDoc(doc(db, 'patient_cases/case1'), { patient_id: 'patient1', status: 'PENDING', case_number: 'C1', created_at: T, title: 't' });
    await setDoc(doc(db, 'student_requests/req1'), { student_id: 'student1', status: 'PENDING', request_number: 'R1', created_at: T });
    await setDoc(doc(db, 'support_tickets/tk1'), { user_id: 'patient1', subject: 's', message: 'm', status: 'OPEN', created_at: T });
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();

test('clients cannot create patient_cases (Worker-only)', async () => {
  await assertFails(setDoc(doc(as('patient1'), 'patient_cases/new1'), { patient_id: 'patient1', status: 'PENDING', case_number: 'C9', created_at: T }));
  await assertFails(setDoc(doc(as('student1'), 'patient_cases/new2'), { patient_id: 'student1', status: 'APPROVED' }));
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'patient_cases/new3'), { patient_id: 'x' }));
});

test('clients cannot create student_requests (Worker-only)', async () => {
  await assertFails(setDoc(doc(as('student1'), 'student_requests/new1'), { student_id: 'student1', status: 'PENDING', request_number: 'R9', created_at: T }));
  await assertFails(setDoc(doc(as('patient1'), 'student_requests/new2'), { student_id: 'patient1', status: 'PENDING' }));
});

test('clients cannot create, edit, or delete case_images; only owner/manager read', async () => {
  await assertFails(setDoc(doc(as('patient1'), 'case_images/img1'), { case_id: 'case1', storage_path: '../../etc/passwd' }));
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'case_images/img2'), { case_id: 'case1', storage_path: 'p' }));
  await assertFails(updateDoc(doc(as('patient1'), 'case_images/img2'), { storage_path: 'x' }));
  await assertFails(deleteDoc(doc(as('patient1'), 'case_images/img2')));
  await assertSucceeds(getDoc(doc(as('patient1'), 'case_images/img2')));
  await assertFails(getDoc(doc(as('student1'), 'case_images/img2')));
  await assertFails(getDoc(doc(as('patient2'), 'case_images/img2')));
  await assertSucceeds(getDoc(doc(as('admin1'), 'case_images/img2')));
});

test('owners cannot change status or ownership of their case/request', async () => {
  await assertFails(updateDoc(doc(as('patient1'), 'patient_cases/case1'), { status: 'APPROVED', updated_at: T }));
  await assertFails(updateDoc(doc(as('patient1'), 'patient_cases/case1'), { patient_id: 'patient2' }));
  await assertSucceeds(updateDoc(doc(as('patient1'), 'patient_cases/case1'), { title: 'new', updated_at: T }));
  await assertFails(updateDoc(doc(as('patient2'), 'patient_cases/case1'), { title: 'hijack', updated_at: T }));
  await assertFails(updateDoc(doc(as('student1'), 'student_requests/req1'), { status: 'APPROVED' }));
});

test('support_tickets: owner-only create with allowlisted fields; no client update/delete', async () => {
  const ok = { user_id: 'patient1', subject: 's', message: 'm', category: 'GENERAL', priority: 'LOW', created_at: T, updated_at: T };
  await assertSucceeds(setDoc(doc(as('patient1'), 'support_tickets/new1'), ok));
  await assertFails(setDoc(doc(as('patient1'), 'support_tickets/new2'), { ...ok, user_id: 'patient2' }));
  await assertFails(setDoc(doc(as('patient1'), 'support_tickets/new3'), { ...ok, status: 'RESOLVED' }));
  await assertFails(setDoc(doc(as('patient1'), 'support_tickets/new4'), { ...ok, admin_reply: 'x' }));
  await assertFails(updateDoc(doc(as('patient1'), 'support_tickets/tk1'), { status: 'RESOLVED' }));
  await assertFails(deleteDoc(doc(as('patient1'), 'support_tickets/tk1')));
  await assertSucceeds(getDoc(doc(as('patient1'), 'support_tickets/tk1')));
  await assertFails(getDoc(doc(as('patient2'), 'support_tickets/tk1')));
  await assertSucceeds(updateDoc(doc(as('admin1'), 'support_tickets/tk1'), { status: 'RESOLVED' }));
});

test('profiles: no self-escalation of role/status or foreign writes', async () => {
  await assertFails(updateDoc(doc(as('patient1'), 'profiles/patient1'), { role: 'SUPER_ADMIN' }));
  await assertFails(updateDoc(doc(as('patient1'), 'profiles/patient1'), { role: 'ADMIN', updated_at: T }));
  await assertFails(updateDoc(doc(as('pending1'), 'profiles/pending1'), { status: 'VERIFIED', updated_at: T }));
  await assertFails(updateDoc(doc(as('patient1'), 'profiles/patient1'), { is_admin: true, updated_at: T }));
  await assertFails(updateDoc(doc(as('patient1'), 'profiles/patient2'), { full_name: 'x', updated_at: T }));
  await assertSucceeds(updateDoc(doc(as('patient1'), 'profiles/patient1'), { full_name: 'New Name', updated_at: T }));
});

test('profiles: create is pending/verified-by-role only, never privileged', async () => {
  const base = (uid) => ({ id: uid, full_name: 'n', created_at: T, updated_at: T });
  await assertFails(setDoc(doc(as('newadmin'), 'profiles/newadmin'), { ...base('newadmin'), role: 'SUPER_ADMIN', status: 'VERIFIED' }));
  await assertFails(setDoc(doc(as('newadmin2'), 'profiles/newadmin2'), { ...base('newadmin2'), role: 'ADMIN', status: 'VERIFIED' }));
  await assertFails(setDoc(doc(as('stu2'), 'profiles/stu2'), { ...base('stu2'), role: 'STUDENT', status: 'VERIFIED' }));
  await assertFails(setDoc(doc(as('other'), 'profiles/victim'), { ...base('victim'), role: 'PATIENT', status: 'VERIFIED' }));
  await assertSucceeds(setDoc(doc(as('stu3'), 'profiles/stu3'), { ...base('stu3'), role: 'STUDENT', status: 'PENDING' }));
});

test('profiles: ADMIN cannot modify roles; SUPER_ADMIN cannot touch another SUPER_ADMIN or self', async () => {
  await assertFails(updateDoc(doc(as('admin1'), 'profiles/student1'), { status: 'SUSPENDED' }));
  await assertFails(updateDoc(doc(as('admin1'), 'profiles/admin1'), { role: 'SUPER_ADMIN' }));
  await assertSucceeds(updateDoc(doc(as('root'), 'profiles/student1'), { status: 'SUSPENDED' }));
  await assertFails(updateDoc(doc(as('root'), 'profiles/root'), { role: 'PATIENT' }));
});

test('privileged collections are closed to non-super-admins', async () => {
  for (const col of ['admin_permissions', 'manager_invitations', 'registration_requests']) {
    await assertFails(setDoc(doc(as('admin1'), `${col}/x`), { a: 1 }));
    await assertFails(setDoc(doc(as('patient1'), `${col}/x`), { a: 1 }));
    await assertSucceeds(setDoc(doc(as('root'), `${col}/x`), { a: 1 }));
  }
  await assertFails(setDoc(doc(as('root'), 'audit_logs/x'), { a: 1 }));
  await assertFails(setDoc(doc(as('root'), 'unknown_collection/x'), { a: 1 }));
});
