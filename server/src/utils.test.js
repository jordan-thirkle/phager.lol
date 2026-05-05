import { test, describe } from 'node:test';
import assert from 'node:assert';
import { getBlobRadius } from './utils.js';

describe('getBlobRadius', () => {
  test('should calculate radius for a given mass', () => {
    const blob = { mass: 100 };
    const radius = getBlobRadius(blob);
    const expected = Math.pow(100, 0.45) * 2.2;
    assert.strictEqual(radius, expected);
    assert.strictEqual(blob.radius, expected);
    assert.strictEqual(blob.lastMassForRadius, 100);
  });

  test('should use cached radius if mass has not changed', () => {
    const blob = { mass: 100 };
    getBlobRadius(blob);

    // Manually change the radius to see if it uses the cached one
    const cachedRadius = 999;
    blob.radius = cachedRadius;
    const result = getBlobRadius(blob);

    assert.strictEqual(result, cachedRadius);
  });

  test('should recalculate radius if mass has changed', () => {
    const blob = { mass: 100 };
    getBlobRadius(blob);

    blob.mass = 200;
    const newRadius = getBlobRadius(blob);
    const expected = Math.pow(200, 0.45) * 2.2;

    assert.strictEqual(newRadius, expected);
    assert.strictEqual(blob.lastMassForRadius, 200);
  });

  test('should handle mass of 0', () => {
    const blob = { mass: 0 };
    const radius = getBlobRadius(blob);
    assert.strictEqual(radius, 0);
  });
});
