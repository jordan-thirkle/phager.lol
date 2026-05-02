import { test, mock } from 'node:test';
import assert from 'node:assert';
import { LS } from './state.js';

test('LS.get', async (t) => {
    // Setup a mock localStorage
    global.localStorage = {
        getItem: mock.fn(),
        setItem: mock.fn()
    };

    await t.test('returns parsed JSON for valid data', () => {
        global.localStorage.getItem.mock.mockImplementation(() => '{"test": 123}');
        const result = LS.get('key');
        assert.deepStrictEqual(result, { test: 123 });
    });

    await t.test('returns default value when localStorage returns null', () => {
        global.localStorage.getItem.mock.mockImplementation(() => null);
        const result = LS.get('key', 'defaultVal');
        assert.strictEqual(result, 'defaultVal');
    });

    await t.test('returns default value on JSON.parse error', () => {
        // Return malformed JSON to trigger the catch block
        global.localStorage.getItem.mock.mockImplementation(() => 'invalid json');
        const result = LS.get('key', 'fallback');
        assert.strictEqual(result, 'fallback');
    });

    await t.test('returns default value when localStorage throws an error', () => {
        global.localStorage.getItem.mock.mockImplementation(() => {
            throw new Error('localStorage disabled');
        });
        const result = LS.get('key', 'fallback');
        assert.strictEqual(result, 'fallback');
    });
});

test('LS.set', async (t) => {
    global.localStorage = {
        getItem: mock.fn(),
        setItem: mock.fn()
    };

    await t.test('calls localStorage.setItem with stringified value', () => {
        LS.set('key', { test: 123 });
        assert.strictEqual(global.localStorage.setItem.mock.calls.length, 1);
        assert.strictEqual(global.localStorage.setItem.mock.calls[0].arguments[0], 'phage_key');
        assert.strictEqual(global.localStorage.setItem.mock.calls[0].arguments[1], '{"test":123}');
    });

    await t.test('handles setItem errors gracefully', () => {
        global.localStorage.setItem.mock.mockImplementation(() => {
            throw new Error('quota exceeded');
        });
        assert.doesNotThrow(() => {
            LS.set('key', 'value');
        });
    });
});
