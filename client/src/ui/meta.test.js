import test, { describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { MetaSystem } from './meta.js';

describe('MetaSystem Payload Parsing', () => {
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {};
    global.localStorage = {
      getItem: mock.fn((key) => mockStorage[key] || null),
      setItem: mock.fn((key, value) => { mockStorage[key] = value; })
    };
    mock.method(console, 'warn', () => {});
  });

  afterEach(() => {
    mock.restoreAll();
    delete global.localStorage;
  });

  test('should load default values when no meta exists', () => {
    const data = MetaSystem.load();
    assert.strictEqual(data.version, 3);
    assert.strictEqual(data.name, "Player");
  });

  test('should handle valid JSON payload (happy path)', () => {
    const validData = {
      version: 3,
      name: "ProPlayer",
      totalGames: 5,
      totalXP: 1000
    };
    mockStorage['phage_meta'] = JSON.stringify(validData);

    const data = MetaSystem.load();
    assert.strictEqual(data.name, "ProPlayer");
    assert.strictEqual(data.totalGames, 5);
  });

  test('should migrate version 2 payload to version 3', () => {
    const oldData = {
      version: 2,
      name: "OldPlayer",
      totalGames: 10
    };
    mockStorage['phage_meta'] = JSON.stringify(oldData);

    const data = MetaSystem.load();
    assert.strictEqual(data.version, 3);
    assert.strictEqual(data.name, "OldPlayer");
    assert.strictEqual(data.totalGames, 10);
    assert.strictEqual(data.unlockedSkins[0], "solid", "Should merge with defaults");
  });

  test('should handle invalid JSON payload gracefully (error path)', () => {
    mockStorage['phage_meta'] = '{ invalid: json ]';

    const data = MetaSystem.load();

    // Should reset to defaults
    assert.strictEqual(data.version, 3);
    assert.strictEqual(data.name, "Player");

    // Should log a warning
    assert.strictEqual(console.warn.mock.calls.length, 1);
    const warnArgs = console.warn.mock.calls[0].arguments;
    assert.strictEqual(warnArgs[0], "Failed to load meta, resetting to defaults");
    assert.ok(warnArgs[1] instanceof Error || warnArgs[1] instanceof SyntaxError);
  });

  test('should fallback to blobz_meta if phage_meta is not present', () => {
      const blobzData = {
        version: 3,
        name: "BlobzPlayer"
      };
      mockStorage['blobz_meta'] = JSON.stringify(blobzData);

      const data = MetaSystem.load();
      assert.strictEqual(data.name, "BlobzPlayer");
  });
});
