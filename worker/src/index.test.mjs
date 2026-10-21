import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.ts';

const env = { FIREBASE_PROJECT_ID: 'al-asas-dental-staging', ALLOWED_ORIGINS: 'http://localhost:5173' };
const request = (path, init) => worker.fetch(new Request(`https://worker.test${path}`, init), env);

test('health is staging-only and does not require a secret', async () => {
  const response = await request('/health');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, environment: 'staging', productionWrites: false, version: 'registration-approval-matching-v1' });
});

test('protected routes reject absent and malformed Firebase tokens', async () => {
  assert.equal((await request('/api/search_anonymized_patient_cases', { method: 'POST' })).status, 401);
  const response = await request('/api/search_anonymized_patient_cases', { method: 'POST', headers: { Authorization: 'Bearer not.a.jwt' } });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'INVALID_TOKEN');
});

test('registration validates before attempting any backend secret', async () => {
  const response = await request('/api/registration-request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'INVALID_REGISTRATION');
});
