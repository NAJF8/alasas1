import assert from 'node:assert/strict';
import { normalizeIraqiPhone } from '../src/lib/phoneAuth.ts';
import { isStrongRegistrationPassword, registrationPasswordStrength } from '../src/lib/registrationFlow.ts';

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

console.log('registration flow validation matrix: PASS');
