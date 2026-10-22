import assert from 'node:assert/strict';
import { normalizeIraqiPhone } from '../src/lib/phoneAuth.ts';
import { isStrongRegistrationPassword, registrationPasswordStrength } from '../src/lib/registrationFlow.ts';
import { calculateAge } from '../src/pages/RegistrationRequest.tsx';

assert.equal(normalizeIraqiPhone('07123456789'), '+9647123456789');
assert.equal(normalizeIraqiPhone('٠٧١٢٣٤٥٦٧٨٩'), '+9647123456789');
assert.equal(normalizeIraqiPhone('+964 7123456789'), '+9647123456789');
assert.equal(normalizeIraqiPhone('07123'), null);
assert.equal(isStrongRegistrationPassword('Dental2026!'), true);
assert.equal(isStrongRegistrationPassword('12345678'), false);
assert.equal(isStrongRegistrationPassword('password123'), false);
assert.equal(isStrongRegistrationPassword('short1!'), false);
assert.equal(isStrongRegistrationPassword('Dental!'.repeat(20)), true);
assert.equal(isStrongRegistrationPassword('Dental2026!'), true);
assert.equal(registrationPasswordStrength('Dental2026!'), 'قوية');
assert.equal(calculateAge('2000-10-22', new Date(2026, 9, 22)), 26);
assert.equal(calculateAge('2000-10-23', new Date(2026, 9, 22)), 25);
assert.equal(calculateAge('2099-01-01', new Date(2026, 9, 22)), null);

console.log('registration flow validation matrix: PASS');
