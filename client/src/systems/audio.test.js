import test, { describe, mock } from 'node:test';
import assert from 'node:assert';
import { AudioEngine } from './audio.js';

describe('AudioEngine.cleanupNode', () => {
  test('should assign onended callback to the node', () => {
    const node = { onended: null, disconnect: mock.fn() };
    AudioEngine.cleanupNode(node);
    assert.strictEqual(typeof node.onended, 'function');
  });

  test('should call node.disconnect() when onended is triggered', () => {
    const node = { onended: null, disconnect: mock.fn() };
    AudioEngine.cleanupNode(node);

    node.onended();

    assert.strictEqual(node.disconnect.mock.callCount(), 1);
  });

  test('should call both node.disconnect() and gain.disconnect() if gain is provided', () => {
    const node = { onended: null, disconnect: mock.fn() };
    const gain = { disconnect: mock.fn() };
    AudioEngine.cleanupNode(node, gain);

    node.onended();

    assert.strictEqual(node.disconnect.mock.callCount(), 1);
    assert.strictEqual(gain.disconnect.mock.callCount(), 1);
  });

  test('should not throw if node.disconnect() fails', () => {
    const node = {
      onended: null,
      disconnect: mock.fn(() => { throw new Error('Disconnect failed'); })
    };
    AudioEngine.cleanupNode(node);

    assert.doesNotThrow(() => {
      node.onended();
    });
    assert.strictEqual(node.disconnect.mock.callCount(), 1);
  });

  test('should handle gain.disconnect() failure if gain is provided', () => {
    const node = { onended: null, disconnect: mock.fn() };
    const gain = {
      disconnect: mock.fn(() => { throw new Error('Gain disconnect failed'); })
    };
    AudioEngine.cleanupNode(node, gain);

    assert.doesNotThrow(() => {
      node.onended();
    });
    assert.strictEqual(node.disconnect.mock.callCount(), 1);
    assert.strictEqual(gain.disconnect.mock.callCount(), 1);
  });
});
