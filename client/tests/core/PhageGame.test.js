import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PhageGame } from '../../src/core/PhageGame.js';
import { AppState } from '../../src/core/state.js';

describe('PhageGame error handling tests', () => {

  it('connectSocket should catch connection errors without throwing TypeErrors', () => {
    const game = new PhageGame();
    AppState.socket = null; // Clear socket to ensure connectSocket runs

    const originalConsoleError = console.error;
    let loggedError = null;

    console.error = (msg, err) => {
      if (typeof msg === 'string' && msg.includes('Failed to initialize Socket.io')) {
        loggedError = err;
      }
    };

    let threw = false;
    try {
        game.connectSocket();
    } catch(e) {
        threw = true;
    }

    console.error = originalConsoleError;

    assert.strictEqual(threw, false, 'connectSocket should catch and handle errors gracefully');
    assert.ok(loggedError, 'Expected an error to be logged by the catch block');
    assert.strictEqual(AppState.socket, null, 'Socket should remain null on error');
  });

});
