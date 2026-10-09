import assert from 'node:assert/strict';
import { isFreshRegistrationCandidate, isValidRegistrationIntent, type RegistrationIntent } from '../src/context/authRegistrationSecurity.ts';

const now = Date.parse('2026-10-07T18:00:00.000Z');
const freshIntent = (role: 'PATIENT' | 'STUDENT' = 'STUDENT'): RegistrationIntent => ({
  flow: 'register', role, createdAt: now, nonce: '0123456789abcdef0123456789abcdef',
});
const user = (createdAt: string, role = 'google', lastSignInAt = '2026-10-07T18:00:03.000Z') => ({
  id: 'u1', created_at: createdAt, last_sign_in_at: lastSignInAt, app_metadata: { provider: role }, identities: [{ provider: role }],
} as never);

assert.equal(isFreshRegistrationCandidate(user('2026-10-07T17:59:58.000Z'), freshIntent(), '2026-10-07T17:59:59.000Z', now), true, 'fresh Google identity is eligible');
assert.equal(isFreshRegistrationCandidate(user('2026-10-01T17:59:58.000Z'), freshIntent(), '2026-10-01T17:59:59.000Z', now), false, 'old Google identity is rejected');
assert.equal(isFreshRegistrationCandidate(user('2026-10-07T17:59:58.000Z', 'google'), { ...freshIntent(), role: 'PATIENT', createdAt: now - 11 * 60 * 1000 }, undefined, now), false, 'expired intent is rejected');
assert.equal(isFreshRegistrationCandidate(user('2026-10-07T17:59:58.000Z', 'google'), null, undefined, now), false, 'missing intent is rejected');
assert.equal(isFreshRegistrationCandidate(user('2026-10-07T17:59:58.000Z', 'google'), { ...freshIntent(), nonce: 'short' }, undefined, now), false, 'malformed nonce is rejected');
assert.equal(isFreshRegistrationCandidate(user('2026-10-07T17:59:58.000Z', 'github'), freshIntent(), undefined, now), false, 'non-Google identity is rejected');
assert.equal(isValidRegistrationIntent({ ...freshIntent(), role: 'PATIENT' }, now), true, 'patient intent validates');
assert.equal(isValidRegistrationIntent({ ...freshIntent(), role: 'ADMIN' as never }, now), false, 'privileged role intent validates false');
console.log('registration security matrix: PASS');
