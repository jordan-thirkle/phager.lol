import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { LS } from './state.js';

test('LS wrapper', async (t) => {
    let mockStorage = {};

    global.localStorage = {
        getItem: mock.fn((k) => mockStorage[k] || null),
        setItem: mock.fn((k, v) => { mockStorage[k] = v; }),
        removeItem: mock.fn((k) => { delete mockStorage[k]; }),
        clear: mock.fn(() => { mockStorage = {}; })
    };

    beforeEach(() => {
        mockStorage = {};
        global.localStorage.getItem.mock.resetCalls();
        global.localStorage.setItem.mock.resetCalls();
    });

    await t.test('get returns default value when item is not present', () => {
        const val = LS.get('missing', 'defVal');
        assert.strictEqual(val, 'defVal');
    });

    await t.test('set stores JSON stringified value', () => {
        LS.set('test_key', { a: 1 });
        assert.strictEqual(mockStorage['phage_test_key'], '{"a":1}');
    });

    await t.test('get retrieves and parses stored value from phage_ prefix', () => {
        mockStorage['phage_test_key'] = '{"a":1}';
        const val = LS.get('test_key');
        assert.deepStrictEqual(val, { a: 1 });
    });

    await t.test('get retrieves and parses stored value from blobz_ prefix if phage_ is missing', () => {
        mockStorage['blobz_test_key'] = '{"a":1}';
        const val = LS.get('test_key');
        assert.deepStrictEqual(val, { a: 1 });
    });

    await t.test('get returns default value if JSON.parse fails', () => {
        mockStorage['phage_test_key'] = 'invalid_json';
        const val = LS.get('test_key', 'fallback');
        assert.strictEqual(val, 'fallback');
    });

    await t.test('get returns default value if localStorage throws an error', () => {
        global.localStorage.getItem = mock.fn(() => { throw new Error('Access Denied'); });
        const val = LS.get('test_key', 'fallback');
        assert.strictEqual(val, 'fallback');

        // restore original mock
        global.localStorage.getItem = mock.fn((k) => mockStorage[k] || null);
    });

    await t.test('set handles localStorage throwing an error', () => {
        global.localStorage.setItem = mock.fn(() => { throw new Error('Quota Exceeded'); });
        // Should not throw
        assert.doesNotThrow(() => {
            LS.set('test_key', { a: 1 });
        });

        // restore original mock
        global.localStorage.setItem = mock.fn((k, v) => { mockStorage[k] = v; });
    });
});
