import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// Custom mock DOM element to track toggle
const createMockElement = () => {
    const el = {
        style: {},
        appendChild: mock.fn(),
        lastChild: null,
        innerHTML: '',
        textContent: '',
        className: '',
        classList: { toggle: mock.fn(), add: mock.fn(), remove: mock.fn() },
        remove: mock.fn(),
        querySelector: mock.fn(() => createMockElement()),
        querySelectorAll: mock.fn(() => []),
        addEventListener: mock.fn(),
        getAttribute: mock.fn(),
        setAttribute: mock.fn(),
        closest: mock.fn(),
        getContext: mock.fn(() => ({
            clearRect: mock.fn(),
            beginPath: mock.fn(),
            moveTo: mock.fn(),
            lineTo: mock.fn(),
            stroke: mock.fn(),
            fill: mock.fn(),
            fillText: mock.fn(),
            fillRect: mock.fn(),
            scale: mock.fn()
        })),
        width: 100,
        height: 100,
    };
    el.appendChild = mock.fn((child) => {
        el.lastChild = child;
    });
    return el;
};

// Expose a specific dtLogElement so we can check its content
let mockLogElement = createMockElement();

global.document = {
    getElementById: mock.fn((id) => {
        const el = createMockElement();
        if (id === 'dt-log') return mockLogElement;
        return el;
    }),
    createElement: mock.fn(() => {
        const el = createMockElement();
        el.querySelector = mock.fn((selector) => {
           if (selector === '#dt-log') return mockLogElement;
           return createMockElement();
        });
        return el;
    }),
    body: createMockElement(),
};

global.window = {
    addEventListener: mock.fn(),
    location: { reload: mock.fn() },
    performance: { memory: {} },
    innerWidth: 1920,
    innerHeight: 1080
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

// Polyfills
global.AppState = {
    myId: 'player1',
    myName: 'TestPlayer',
    myColor: '#FF0000',
    myStats: {},
    pendingInputs: [],
    clientSeq: 0,
    lastProcessedSeq: 0,
    perfProfile: 'HIGH',
    arenaSize: 1000,
    app: { stats: {} }
};

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

const { DevTools } = await import('./devtools.js');

test('DevTools copySnapshot', async (t) => {
    beforeEach(() => {
        mockLogElement.innerHTML = '';
        global.navigator.clipboard.writeText.mock.resetCalls();
        DevTools.init({
            game: {},
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

    await t.test('success path logs to success', async () => {
        global.navigator.clipboard.writeText.mock.mockImplementation(async () => Promise.resolve());

        await DevTools.copySnapshot();

        assert.strictEqual(global.navigator.clipboard.writeText.mock.calls.length, 1);
        assert.ok(mockLogElement.innerHTML.includes('snapshot copied to clipboard'), 'Should push success log');
        assert.ok(mockLogElement.innerHTML.includes('dt-success'), 'Should have success class');
    });

    await t.test('error path logs a warning', async () => {
        global.navigator.clipboard.writeText.mock.mockImplementation(async () => Promise.reject(new Error('fail')));

        await DevTools.copySnapshot();

        assert.strictEqual(global.navigator.clipboard.writeText.mock.calls.length, 1);
        assert.ok(mockLogElement.innerHTML.includes('clipboard copy failed'), 'Should push warning log');
        assert.ok(mockLogElement.innerHTML.includes('dt-warn'), 'Should have warning class');
    });
});
