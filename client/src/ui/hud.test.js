import { test } from 'node:test';
import assert from 'node:assert';
import { escapeHTML } from './hud.js';

test('escapeHTML', async (t) => {
    await t.test('returns empty string for falsy values', () => {
        assert.strictEqual(escapeHTML(''), '');
        assert.strictEqual(escapeHTML(null), '');
        assert.strictEqual(escapeHTML(undefined), '');
        assert.strictEqual(escapeHTML(0), ''); // Note: escapeHTML(0) returns '' because !0 is true
        assert.strictEqual(escapeHTML(false), '');
    });

    await t.test('escapes special characters correctly', () => {
        assert.strictEqual(escapeHTML('&'), '&amp;');
        assert.strictEqual(escapeHTML('<'), '&lt;');
        assert.strictEqual(escapeHTML('>'), '&gt;');
        assert.strictEqual(escapeHTML('"'), '&quot;');
        assert.strictEqual(escapeHTML("'"), '&#039;');
    });

    await t.test('escapes combinations of special characters', () => {
        assert.strictEqual(
            escapeHTML('<script>alert("XSS & Hack\'s")</script>'),
            '&lt;script&gt;alert(&quot;XSS &amp; Hack&#039;s&quot;)&lt;/script&gt;'
        );
    });

    await t.test('converts non-strings to strings and escapes', () => {
        assert.strictEqual(escapeHTML(123), '123');
        assert.strictEqual(escapeHTML(true), 'true');
    });
});
