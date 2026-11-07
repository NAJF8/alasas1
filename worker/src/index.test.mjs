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

test('signed storage download tokens fail closed without a dedicated secret and never derive from the service account', async () => {
  const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /private_key\.slice/);
  assert.match(source, /env\.STORAGE_TOKEN_SECRET/);
  const forged = `${btoa('{"path":"cases/a/b","sub":"x","exp":9999999999}')}.AAAA`;
  const response = await request(`/api/storage/download?path=cases/a/b&token=${forged}`, { method: 'GET' });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'BACKEND_SECRET_NOT_CONFIGURED');
});

const fakeKv = () => { const m = new Map(); return { m, get: async (k) => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); } }; };

test('rate limit persists in KV across separate requests and isolates', async () => {
  const kv = fakeKv();
  const kvEnv = { ...env, RATE_LIMIT: kv };
  const call = (ip) => worker.fetch(new Request('https://worker.test/api/registration-request', { method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': ip }, body: '{}' }), kvEnv);
  for (let i = 0; i < 20; i++) assert.equal((await call('1.1.1.1')).status, 400);
  const blocked = await call('1.1.1.1');
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).error, 'RATE_LIMITED');
  assert.equal((await call('2.2.2.2')).status, 400, 'other IPs are unaffected');
  assert.ok([...kv.m.keys()].every((k) => k.startsWith('rl:registration:')));
});

test('rate limit fails open when KV is unavailable', async () => {
  const broken = { get: async () => { throw new Error('kv down'); }, put: async () => { throw new Error('kv down'); } };
  const response = await worker.fetch(new Request('https://worker.test/api/registration-request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }), { ...env, RATE_LIMIT: broken });
  assert.equal(response.status, 400);
});
