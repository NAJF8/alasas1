import assert from 'node:assert/strict';
import { normalizeIraqiPhone } from '../src/lib/phoneAuth.ts';
import { isStrongRegistrationPin } from '../src/lib/registrationFlow.ts';

assert.equal(normalizeIraqiPhone('07123456789'), '+9647123456789');
assert.equal(normalizeIraqiPhone('٠٧١٢٣٤٥٦٧٨٩'), '+9647123456789');
assert.equal(normalizeIraqiPhone('+964 7123456789'), '+9647123456789');
assert.equal(normalizeIraqiPhone('07123'), null);
assert.equal(isStrongRegistrationPin('258037'), true);
assert.equal(isStrongRegistrationPin('123456'), false);
assert.equal(isStrongRegistrationPin('111111'), false);
assert.equal(isStrongRegistrationPin('258038'), true);

console.log('registration flow validation matrix: PASS');
