import { strict as assert } from 'node:assert';
import { displayValue } from '../src/lib/displayValue.ts';

assert.equal(displayValue('PATIENT', 'role'), 'PATIENT');
assert.equal(displayValue('FOURTH', 'stage'), 'FOURTH');
assert.equal(displayValue('not-a-date', 'created_at'), 'not-a-date');
assert.notEqual(displayValue('2026-10-10T00:00:00.000Z', 'created_at'), 'Invalid Date');
assert.equal(displayValue(false, 'is_active'), 'لا');
console.log('management display regression: PASS');
