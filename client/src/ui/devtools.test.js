import { test, mock, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// Custom mock DOM element
const createMockElement = () => {
    const el = {
        style: {},
        appendChild: mock.fn((child) => {
            el.lastChild = child;
        }),
        lastChild: null,
        innerHTML: '',
        textContent: '',
        className: '',
        classList: { 
            toggle: mock.fn(), 
            add: mock.fn(), 
            remove: mock.fn() 
        },
        remove: mock.fn(),
        setAttribute: mock.fn(),
        getAttribute: mock.fn(),
        addEventListener: mock.fn(),
        querySelector: mock.fn(() => createMockElement()),
        querySelectorAll: mock.fn(() => []),
        closest: mock.fn(),
        getContext: mock.fn(() => ({
            clearRect: mock.fn(),
            beginPath: mock.fn(),
            moveTo: mock.fn(),
            lineTo: mock.fn(),
            stroke: mock.fn(),
            fillStyle: '',
            fill: mock.fn(),
            fillRect: mock.fn(),
            fillText: mock.fn(),
            measureText: mock.fn(() => ({ width: 10 })),
            scale: mock.fn()
        })),
        width: 100,
        height: 100,
    };
    return el;
};

// Expose a specific dtLogElement so we can check its content
let mockLogElement = createMockElement();

global.document = {
    getElementById: mock.fn((id) => {
        if (id === 'dt-log') return mockLogElement;
        return createMockElement();
    }),
    createElement: mock.fn((tag) => {
        const el = createMockElement();
        if (tag === 'div') {
             el.querySelector = mock.fn((selector) => {
                if (selector === '#dt-log') return mockLogElement;
                return createMockElement();
             });
        }
        return el;
    }),
    body: createMockElement(),
    head: createMockElement(),
};

global.window = {
    addEventListener: mock.fn(),
    requestAnimationFrame: mock.fn((cb) => cb()),
    performance: { 
        now: () => Date.now(),
        memory: {}
    },
    location: { reload: mock.fn() },
    innerWidth: 1920,
    innerHeight: 1080
};

global.localStorage = {
    getItem: mock.fn(),
    setItem: mock.fn()
};

Object.defineProperty(global, 'navigator', {
    value: {
        clipboard: {
            writeText: mock.fn()
        }
    },
    writable: true,
    configurable: true
});

// Polyfills / Globals for DevTools
global.LS = {
    get: mock.fn(() => null),
    set: mock.fn()
};

global.getPacketRate = mock.fn(() => 60);
global.nowLabel = mock.fn(() => '12:00:00');
global.fmtBytes = mock.fn(() => '0B');
global.fmtMs = mock.fn(() => '0ms');
global.fmtInt = mock.fn(() => '0');
global.getCounts = mock.fn(() => ({}));

// Import modules
const { DevTools } = await import('./devtools.js');
const { AppState } = await import('../core/state.js');

// Also setup global AppState if needed by devtools.js
global.AppState = AppState; 

describe('DevTools', () => {
    let mockGame;

    beforeEach(() => {
        mockGame = {
            connectSocket: mock.fn()
        };

        mockLogElement.innerHTML = '';
        global.navigator.clipboard.writeText.mock.resetCalls();

        AppState.socket = null;
        AppState.myId = 'player1';
        AppState.myName = 'TestPlayer';
        AppState.myColor = '#FF0000';
        AppState.myStats = {};
        AppState.pendingInputs = [];
        AppState.clientSeq = 0;
        AppState.lastProcessedSeq = 0;
        AppState.perfProfile = 'HIGH';
        AppState.arenaSize = 1000;
        AppState.app = { stats: {} };

        DevTools.init({
            game: mockGame,
            MetaSystem: {
                getData: mock.fn(() => ({})),
                getSetting: mock.fn(() => false)
            },
            HudSystem: {},
            ParticleSystem: {
                getStats: mock.fn(() => ({ active: 0 }))
            }
        });
    });

    afterEach(() => {
        mock.restoreAll();
    });

    describe('reconnectSocket', () => {
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

    describe('copySnapshot', () => {
        test('success path logs to success', async () => {
            global.navigator.clipboard.writeText.mock.mockImplementation(async () => Promise.resolve());

            await DevTools.copySnapshot();

            assert.strictEqual(global.navigator.clipboard.writeText.mock.calls.length, 1);
            assert.ok(mockLogElement.innerHTML.includes('snapshot copied to clipboard'), 'Should push success log');
            assert.ok(mockLogElement.innerHTML.includes('dt-success'), 'Should have success class');
        });

        test('error path logs a warning', async () => {
            global.navigator.clipboard.writeText.mock.mockImplementation(async () => Promise.reject(new Error('fail')));

            await DevTools.copySnapshot();

            assert.strictEqual(global.navigator.clipboard.writeText.mock.calls.length, 1);
            assert.ok(mockLogElement.innerHTML.includes('clipboard copy failed'), 'Should push warning log');
            assert.ok(mockLogElement.innerHTML.includes('dt-warn'), 'Should have warning class');
        });
    });
});
