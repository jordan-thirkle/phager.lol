import { test, mock, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// 1. First, setup global mocks
const createMockElement = () => {
    const el = {
        style: {},
        appendChild: mock.fn(),
        lastChild: null,
        innerHTML: '',
        textContent: '',
        className: '',
        classList: {
            toggle: mock.fn()
        },
        remove: mock.fn(),
        setAttribute: mock.fn(),
        getAttribute: mock.fn(),
        addEventListener: mock.fn(),
        querySelector: mock.fn(() => createMockElement()),
        querySelectorAll: mock.fn(() => [createMockElement()]),
        getContext: mock.fn(() => ({
            clearRect: mock.fn(),
            beginPath: mock.fn(),
            moveTo: mock.fn(),
            lineTo: mock.fn(),
            stroke: mock.fn(),
            fillStyle: '',
            fillRect: mock.fn(),
            fillText: mock.fn(),
            measureText: mock.fn(() => ({ width: 10 })),
        })),
        width: 100,
        height: 100,
    };
    return el;
};

global.document = {
    getElementById: mock.fn(() => createMockElement()),
    createElement: mock.fn(() => createMockElement()),
    body: createMockElement(),
    head: createMockElement(),
};
global.window = {
    addEventListener: mock.fn(),
    requestAnimationFrame: mock.fn((cb) => cb()),
    performance: { now: () => Date.now() },
};

global.localStorage = {
    getItem: mock.fn(),
    setItem: mock.fn()
};

// 2. Import modules AFTER setting up globals
import { DevTools } from './devtools.js';
import { AppState } from '../core/state.js';

describe('DevTools.reconnectSocket', () => {
    let mockGame;

    beforeEach(() => {
        mockGame = {
            connectSocket: mock.fn()
        };

        AppState.socket = null;

        // Mock init internals if needed to prevent errors
        DevTools.init({
            game: mockGame,
            MetaSystem: {
                getData: mock.fn(() => ({}))
            },
            HudSystem: {},
            ParticleSystem: {}
        });
    });

    afterEach(() => {
        mock.restoreAll();
    });

    test('should reconnect socket when socket exists', () => {
        const mockDisconnect = mock.fn();
        AppState.socket = { disconnect: mockDisconnect };

        DevTools.reconnectSocket();

        assert.strictEqual(mockDisconnect.mock.callCount(), 1, 'socket.disconnect() should be called');
        assert.strictEqual(AppState.socket, null, 'AppState.socket should be set to null');
        assert.strictEqual(mockGame.connectSocket.mock.callCount(), 1, 'game.connectSocket() should be called');
    });

    test('should handle socket disconnect throwing an error', () => {
        const mockDisconnect = mock.fn(() => { throw new Error('Disconnect failed'); });
        AppState.socket = { disconnect: mockDisconnect };

        DevTools.reconnectSocket();

        assert.strictEqual(mockDisconnect.mock.callCount(), 1, 'socket.disconnect() should be called');
        assert.strictEqual(AppState.socket, null, 'AppState.socket should be null even if disconnect throws');
        assert.strictEqual(mockGame.connectSocket.mock.callCount(), 1, 'game.connectSocket() should still be called');
    });

    test('should handle missing AppState.socket', () => {
        AppState.socket = null;

        DevTools.reconnectSocket();

        assert.strictEqual(AppState.socket, null);
        assert.strictEqual(mockGame.connectSocket.mock.callCount(), 1);
    });

    test('should return early if game is missing', () => {
        DevTools.init({
            game: null,
            MetaSystem: { getData: mock.fn(() => ({})) },
        });

        const mockDisconnect = mock.fn();
        AppState.socket = { disconnect: mockDisconnect };

        DevTools.reconnectSocket();

        assert.strictEqual(mockDisconnect.mock.callCount(), 0, 'socket.disconnect() should not be called');
        assert.notStrictEqual(AppState.socket, null, 'AppState.socket should not be set to null');
    });
});
