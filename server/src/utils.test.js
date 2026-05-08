import { test, describe } from 'node:test';
import assert from 'node:assert';
import { getBlobRadius } from './utils.js';

describe('utils.js', () => {
    describe('getBlobRadius', () => {
        test('calculates correct radius for a given mass', () => {
            const blob = { mass: 100 };
            const expectedRadius = Math.pow(100, 0.45) * 2.2;
            const radius = getBlobRadius(blob);
            assert.strictEqual(radius, expectedRadius);
        });

        test('sets radius and lastMassForRadius on the blob object', () => {
            const blob = { mass: 100 };
            getBlobRadius(blob);
            assert.strictEqual(blob.lastMassForRadius, 100);
            assert.strictEqual(blob.radius, Math.pow(100, 0.45) * 2.2);
        });

        test('uses cached radius if mass has not changed', () => {
            const blob = { mass: 100 };
            getBlobRadius(blob);

            // Manually change radius to see if it gets recalculated
            blob.radius = 999;
            const radius2 = getBlobRadius(blob);

            assert.strictEqual(radius2, 999, 'Should return cached radius when mass is the same');
        });

        test('recalculates radius when mass changes', () => {
            const blob = { mass: 100 };
            getBlobRadius(blob);

            blob.mass = 200;
            const expectedRadius = Math.pow(200, 0.45) * 2.2;
            const radius = getBlobRadius(blob);

            assert.strictEqual(radius, expectedRadius);
            assert.strictEqual(blob.lastMassForRadius, 200);
        });

        test('handles mass = 0', () => {
            const blob = { mass: 0 };
            const radius = getBlobRadius(blob);
            assert.strictEqual(radius, 0);
        });
    });
});
