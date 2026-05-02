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
        global.localStorage.getItem.mock.mockImplementation((k) => mockStorage[k] || null);
        global.localStorage.setItem.mock.mockImplementation((k, v) => { mockStorage[k] = v; });
    });

    await t.test('get returns default value when item is not present', () => {
        const val = LS.get('missing', 'defVal');
        assert.strictEqual(val, 'defVal');
    });

    await t.test('set stores JSON stringified value with phage_ prefix', () => {
        LS.set('test_key', { a: 1 });
        assert.strictEqual(mockStorage['phage_test_key'], '{"a":1}');
        assert.strictEqual(global.localStorage.setItem.mock.callCount(), 1);
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
        global.localStorage.getItem.mock.mockImplementation(() => { throw new Error('Access Denied'); });
        const val = LS.get('test_key', 'fallback');
        assert.strictEqual(val, 'fallback');
    });

    await t.test('set handles localStorage throwing an error gracefully', () => {
        global.localStorage.setItem.mock.mockImplementation(() => { throw new Error('Quota Exceeded'); });
        assert.doesNotThrow(() => {
            LS.set('test_key', { a: 1 });
        });
    });
});
