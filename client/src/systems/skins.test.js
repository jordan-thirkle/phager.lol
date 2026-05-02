import test, { describe, mock } from 'node:test';
import assert from 'node:assert';
import { drawers } from './skins.js';

describe('Skins drawers.glitch error path', () => {
  test('should handle getImageData throwing an error without crashing', () => {
    let callCount = 0;
    const mockCtx = {
      getImageData: mock.fn(() => {
        callCount++;
        throw new Error('Simulated DOMException');
      }),
      putImageData: mock.fn(),
    };

    assert.doesNotThrow(() => {
      drawers.glitch(mockCtx, '#ff0000');
    });

    assert.strictEqual(callCount, 40);
    assert.strictEqual(mockCtx.putImageData.mock.callCount(), 0);
  });

  test('should handle putImageData throwing an error without crashing', () => {
    let putCallCount = 0;
    const mockCtx = {
      getImageData: mock.fn(() => ({ data: [] })),
      putImageData: mock.fn(() => {
        putCallCount++;
        throw new Error('Simulated DOMException');
      }),
    };

    assert.doesNotThrow(() => {
      drawers.glitch(mockCtx, '#ff0000');
    });

    assert.strictEqual(mockCtx.getImageData.mock.callCount(), 40);
    assert.strictEqual(putCallCount, 40);
  });
});
