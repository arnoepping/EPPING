import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pulse } from './beat.ts';

test('pulse peaks on the beat and decays', () => {
  assert.equal(pulse(0, 120), 1);
  assert.ok(Math.abs(pulse(0.25, 120) - Math.exp(-3)) < 1e-9);
  assert.ok(pulse(0.5, 120) > 0.999); // next beat at 120 BPM
  assert.ok(pulse(0.49, 120) < 0.01);
});
