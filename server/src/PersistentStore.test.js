import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PersistentStore } from './PersistentStore.js';

describe('PersistentStore', () => {
  let tempDir;
  const filename = 'testData.json';
  const defaultData = [{ id: 1, text: 'default' }];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'persistent-store-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('should load default data if file does not exist', () => {
    const store = new PersistentStore(tempDir, filename, defaultData);
    assert.deepStrictEqual(store.data, defaultData);
  });

  test('should load data from file if it exists', () => {
    const existingData = [{ id: 2, text: 'existing' }];
    fs.writeFileSync(path.join(tempDir, filename), JSON.stringify(existingData), 'utf8');

    const store = new PersistentStore(tempDir, filename, defaultData);
    assert.deepStrictEqual(store.data, existingData);
  });

  test('should handle read errors gracefully', () => {
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, JSON.stringify({ a: 1 }), 'utf8');

    // Mock fs.readFileSync to throw an error
    const originalReadFileSync = fs.readFileSync;
    fs.readFileSync = (path, options) => {
      if (path === filePath) {
        throw new Error('Read error');
      }
      return originalReadFileSync(path, options);
    };

    try {
      const store = new PersistentStore(tempDir, filename, defaultData);
      // Should retain defaultData because load() failed
      assert.deepStrictEqual(store.data, defaultData);
    } finally {
      fs.readFileSync = originalReadFileSync;
    }
  });

  test('should handle JSON parse errors gracefully', () => {
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, 'invalid json', 'utf8');

    const store = new PersistentStore(tempDir, filename, defaultData);
    // Should retain defaultData because JSON.parse failed
    assert.deepStrictEqual(store.data, defaultData);
  });

  test('should save data to disk', () => {
    const store = new PersistentStore(tempDir, filename, defaultData);
    const newData = [{ id: 3, text: 'new' }];
    store.data = newData;
    store.save();

    const savedContent = fs.readFileSync(path.join(tempDir, filename), 'utf8');
    assert.deepStrictEqual(JSON.parse(savedContent), newData);
  });
});
