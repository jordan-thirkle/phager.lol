import { test } from 'node:test';
import assert from 'node:assert';

function sanitizeInput(dx, dz) {
  let rdx = Number.isFinite(dx) ? dx : 0;
  let rdz = Number.isFinite(dz) ? dz : 0;
  const mag = Math.hypot(rdx, rdz);
  if (mag > 1) {
    rdx /= mag;
    rdz /= mag;
  }
  return { dx: rdx, dz: rdz };
}

test('Anti-Cheat: Clamping large input', () => {
  const input = { dx: 10, dz: 0 };
  const sanitized = sanitizeInput(input.dx, input.dz);
  assert.strictEqual(sanitized.dx, 1);
  assert.strictEqual(sanitized.dz, 0);
});

test('Anti-Cheat: Clamping diagonal input', () => {
  const input = { dx: 1, dz: 1 };
  const sanitized = sanitizeInput(input.dx, input.dz);
  const mag = Math.hypot(sanitized.dx, sanitized.dz);
  assert.ok(mag <= 1.0000001);
  assert.ok(mag >= 0.9999999);
});

test('Anti-Cheat: Handling Infinity', () => {
  const input = { dx: Infinity, dz: 0 };
  const sanitized = sanitizeInput(input.dx, input.dz);
  assert.strictEqual(sanitized.dx, 0);
  assert.strictEqual(sanitized.dz, 0);
});

test('Anti-Cheat: Handling NaN', () => {
  const input = { dx: NaN, dz: 5 };
  const sanitized = sanitizeInput(input.dx, input.dz);
  assert.strictEqual(sanitized.dx, 0);
  assert.strictEqual(sanitized.dz, 1);
});

test('Anti-Cheat: Normal small input preserved', () => {
  const input = { dx: 0.5, dz: 0.5 };
  const sanitized = sanitizeInput(input.dx, input.dz);
  assert.strictEqual(sanitized.dx, 0.5);
  assert.strictEqual(sanitized.dz, 0.5);
});
