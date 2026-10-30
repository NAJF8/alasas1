import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from './index.ts';

const env = { FIREBASE_PROJECT_ID: 'al-asas-dental-staging', ALLOWED_ORIGINS: 'http://localhost:5173', RELEASE_SHA: 'test-sha' };
const request = (path, init) => worker.fetch(new Request(`https://worker.test${path}`, init), env);

test('health is staging-only and does not require a secret', async () => {
  const response = await request('/health');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, environment: 'staging', productionWrites: false, version: 'registration-approval-matching-v1', releaseSha: 'test-sha' });
});

test('protected routes reject absent and malformed Firebase tokens', async () => {
  assert.equal((await request('/api/search_anonymized_patient_cases', { method: 'POST' })).status, 401);
  assert.equal((await request('/api/profile-update', { method: 'POST' })).status, 401);
  assert.equal((await request('/api/admin-user-update', { method: 'POST' })).status, 401);
  assert.equal((await request('/api/manager-accept', { method: 'POST' })).status, 401);
  const response = await request('/api/search_anonymized_patient_cases', { method: 'POST', headers: { Authorization: 'Bearer not.a.jwt' } });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'INVALID_TOKEN');
});

test('registration validates before attempting any backend secret', async () => {
  const response = await request('/api/registration-request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'INVALID_REGISTRATION');
});

test('phone login rejects incomplete credentials without exposing backend configuration', async () => {
  const response = await request('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '', password: '' }) });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'INVALID_CREDENTIALS');
});

test('manager mutations remain protected behind Firebase identity', async () => {
  assert.equal((await request('/api/manager-invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'manager@example.com', role: 'ADMIN' }) })).status, 401);
  assert.equal((await request('/api/manager-update', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile_id: 'manager', role: 'STAFF', status: 'VERIFIED' }) })).status, 401);
});

test('public media is never anonymous and medical storage stays fail-closed', async () => {
  assert.equal((await request('/api/public-media', { method: 'GET' })).status, 401);
  const response = await request('/api/storage/upload?case_id=synthetic', { method: 'POST', headers: { 'content-type': 'image/png', 'x-file-size': '10' }, body: new Uint8Array([137, 80, 78, 71]) });
  assert.equal(response.status, 401);
  const unauthDownload = await request('/api/storage/download?path=cases/synthetic/img1', { method: 'GET' });
  assert.equal(unauthDownload.status, 401);
  const traversalDownload = await request('/api/storage/download?path=cases/../secret', { method: 'GET' });
  assert.equal(traversalDownload.status, 400);
});

test('public-media reference mutations use update masks and preserve target fields', async () => {
  const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8');
  assert.match(source, /operation === 'link' \|\| operation === 'unlink'/);
  assert.match(source, /const firestoreUpdateMask = \(fields: string\[\]\) =>/);
  assert.match(source, /firestoreUpdateMask\(Object\.keys\(fields\)\)/);
  assert.doesNotMatch(source, /body: JSON\.stringify\(\{ fields, updateMask:/);
  assert.match(source, /const readback = fromDoc\(await getDoc\(env, collection, documentId\)\)/);
  assert.match(source, /if \(readback\?\.\[field\] !== media\.public_url \|\| readback\?\.\[mediaIdField\(field\)\] !== media\.id\)/);
  assert.match(source, /for \(const reference of references\) \{[\s\S]*?firestoreUpdateMask\(Object\.keys\(fields\)\)/);
});

test('student request university selections are transaction-owned by the Worker', async () => {
  const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8');
  assert.match(source, /INVALID_REQUEST_UNIVERSITIES/);
  assert.match(source, /student_request_preferred_universities/);
  assert.match(source, /request_id: entityId, student_id: actor\.sub/);
});

test('new patient cases remain private until an Admin approval publishes them', async () => {
  const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8');
  assert.match(source, /is_approved_for_student_view: false/);
  assert.match(source, /next === 'WAITING_FOR_MATCH'/);
  assert.match(source, /CASE_ALREADY_MATCHED/);
});

test('profile-update rejects non-customer roles, forbidden fields, and binds strictly to actor', async () => {
  const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8');
  // Rejects any role other than PATIENT or STUDENT
  assert.match(source, /if \(role !== 'PATIENT' && role !== 'STUDENT'\) \{\s*error\('FORBIDDEN', 403\);/);
  // Rejects forbidden administrative / tampering fields
  assert.match(source, /forbiddenKeys = \[[\s\S]*?'role',[\s\S]*?'status',[\s\S]*?'permissions',[\s\S]*?'uid'/);
  assert.match(source, /error\('FORBIDDEN_FIELD_MODIFICATION', 403\)/);
  // Transaction updates only the authenticated actor's own document
  assert.match(source, /writeUpdate\(env, 'profiles', actor\.sub, updates/);
  // Admin routes enforce admin / super admin roles
  assert.match(source, /await requireRole\(env, actor, \['ADMIN', 'SUPER_ADMIN'\]\)/);
  // Super Admin cannot be suspended or downgraded
  assert.match(source, /if \(current\.role === 'SUPER_ADMIN' \|\| String\(current\.email \|\| ''\)\.toLowerCase\(\) === 'mohameadalhaear100@gmail\.com'\) error\('FORBIDDEN', 403\);/);
});
