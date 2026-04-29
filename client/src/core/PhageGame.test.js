import { test, mock } from 'node:test';
import assert from 'node:assert';
import { AppState } from './state.js';
import * as pc from 'playcanvas';

// ---- GLOBAL MOCKS ----
global.window = {
    location: { search: '' },
    addEventListener: mock.fn(),
    AudioContext: class AudioContext {
        createGain() { return { gain: { value: 1, setTargetAtTime: mock.fn() }, connect: mock.fn() }; }
        createDynamicsCompressor() { return { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect: mock.fn() }; }
        createOscillator() { return {}; }
        createBufferSource() { return {}; }
        createBiquadFilter() { return { frequency: { setTargetAtTime: mock.fn() }, connect: mock.fn(), disconnect: mock.fn() }; }
        suspend() {}
        resume() {}
    }
};

Object.defineProperty(global, 'navigator', {
    value: { getGamepads: mock.fn(() => []) },
    configurable: true,
    writable: true
});

const createMockElement = () => {
    const el = {
        style: {},
        addEventListener: mock.fn(),
        querySelector: mock.fn(() => createMockElement()),
        querySelectorAll: mock.fn(() => []),
        appendChild: mock.fn(),
        removeChild: mock.fn(),
        setAttribute: mock.fn(),
        getContext: mock.fn(() => ({ fillRect: mock.fn(), clearRect: mock.fn(), beginPath: mock.fn(), moveTo: mock.fn(), lineTo: mock.fn(), stroke: mock.fn(), fillText: mock.fn() })),
        classList: { add: mock.fn(), remove: mock.fn(), contains: mock.fn(), toggle: mock.fn() },
        value: '',
        innerText: '',
        innerHTML: '',
        textContent: '',
    };
    return el;
};

global.document = {
    getElementById: mock.fn((id) => {
        if (id === 'nameInput') {
            const el = createMockElement();
            el.value = 'TESTPLAYER';
            return el;
        }
        return createMockElement();
    }),
    createElement: mock.fn(() => createMockElement()),
    body: createMockElement()
};

global.localStorage = {
    getItem: mock.fn(() => null),
    setItem: mock.fn()
};

global.Worker = class Worker {
    constructor(url, options) {
        this.url = url;
        this.options = options;
    }
    postMessage(data) {}
};

global.URL = class URL {
    constructor(url) {
        this.url = url;
        this.searchParams = { set: mock.fn() };
    }
};

// Mock io
global.io = mock.fn(() => ({
    on: mock.fn(),
    emit: mock.fn(),
    disconnect: mock.fn(),
    removeAllListeners: mock.fn(),
    id: 'mock-socket-id',
    connected: true
}));

// Provide basic stubs for globals needed by UI and Game
await import('../ui/meta.js');
import { MetaSystem } from '../ui/meta.js';

MetaSystem.getData = mock.fn(() => ({ settings: { nameTags: false, glowLayer: false, gridLayer: false, particles: false } }));
MetaSystem.init = mock.fn();
MetaSystem.getLevelInfo = mock.fn(() => ({ level: 1 }));
MetaSystem.setSetting = mock.fn();
MetaSystem.getSetting = mock.fn(() => false);

global.MetaSystem = MetaSystem;

global.HudSystem = {
    openGuide: mock.fn(),
    closeModal: mock.fn(),
    spawnCombatPopup: mock.fn(),
    updateFPS: mock.fn(),
    triggerMembraneFlash: mock.fn(),
    updateCombatPopups: mock.fn(),
};

global.DevTools = {
    init: mock.fn(),
    update: mock.fn(),
    recordSocket: mock.fn()
};

await import('../systems/particles.js');
import { ParticleSystem } from '../systems/particles.js';
ParticleSystem.setEnabled = mock.fn();
ParticleSystem.emitDashTrail = mock.fn();
ParticleSystem.emitMagnetField = mock.fn();
ParticleSystem.update = mock.fn();
ParticleSystem.init = mock.fn();

global.InputSystem = {
    init: mock.fn(),
    update: mock.fn(),
    InputState: { dx: 1, dz: -1, w: 0, a: 0, s: 0, d: 0, split: true, boost: false, ability: false }
};

await import('./camera.js');
import { CameraSystem } from './camera.js';
CameraSystem.update = mock.fn();

global.PortalSystem = {
    init: mock.fn(),
    update: mock.fn()
};

global.MinimapSystem = {
    init: mock.fn(),
    update: mock.fn()
};

global.AudioEngine = {
    init: mock.fn(),
    resume: mock.fn(),
    split: mock.fn(),
    stopTension: mock.fn(),
    stopHeartbeat: mock.fn(),
    setVolume: mock.fn(),
    updateTension: mock.fn()
}

// Now import the module
import { PhageGame } from './PhageGame.js';

test('PhageGame Core Functionality', async (t) => {

    await t.test('Constructor: initializes properties and Worker successfully', () => {
        const game = new PhageGame();
        assert.strictEqual(game.arenaBuilt, false);
        assert.deepStrictEqual(game.gridLines, []);
        assert.deepStrictEqual(game.foodMatCache, {});
        assert.deepStrictEqual(game.foodPool, []);
        assert.deepStrictEqual(game.virusPool, []);
        assert.strictEqual(game.virusMat, null);

        assert.ok(game.syncWorker);
        assert.strictEqual(game.syncWorker.options.type, 'module');
    });

    await t.test('Constructor: handles Worker initialization failure gracefully', () => {
        const OriginalWorker = global.Worker;
        global.Worker = class Worker {
            constructor() { throw new Error('Worker not supported'); }
        };

        const game = new PhageGame();
        assert.strictEqual(game.syncWorker, null);

        global.Worker = OriginalWorker;
    });

    await t.test('init(): sets up UI logic and bridges', () => {
        const game = new PhageGame();

        // Stub internal methods to isolate init logic
        const loadStartStatsSpy = mock.fn();
        const initSettingsListenersSpy = mock.fn();
        const connectSocketSpy = mock.fn();
        const applyRuntimeSettingsSpy = mock.fn();

        game.loadStartStats = loadStartStatsSpy;
        game.initSettingsListeners = initSettingsListenersSpy;
        game.connectSocket = connectSocketSpy;
        game.applyRuntimeSettings = applyRuntimeSettingsSpy;

        // Suppress console.log for clean test output
        const origLog = console.log;
        console.log = () => {};

        game.init();

        console.log = origLog;

        // Assert methods were called
        assert.strictEqual(loadStartStatsSpy.mock.callCount(), 1);
        assert.strictEqual(initSettingsListenersSpy.mock.callCount(), 1);
        assert.strictEqual(connectSocketSpy.mock.callCount(), 1);
        assert.strictEqual(applyRuntimeSettingsSpy.mock.callCount(), 1);

        // Assert globals defined (window bridges)
        assert.strictEqual(typeof window.startGame, 'function');
        assert.strictEqual(typeof window.sendGlobalChat, 'function');
        assert.strictEqual(typeof window.toggleFullscreen, 'function');
        assert.strictEqual(typeof window.openGuide, 'function');
        assert.strictEqual(typeof window.openHowItWasMade, 'function');
        assert.strictEqual(typeof window.closeHowItWasMade, 'function');
        assert.strictEqual(typeof window.openCustomize, 'function');
        assert.strictEqual(typeof window.openSettings, 'function');
        assert.strictEqual(typeof window.openCareer, 'function');
        assert.strictEqual(typeof window.closeModal, 'function');
    });

    await t.test('startGame(): sets up active game state', () => {
        const game = new PhageGame();

        // Mock initPC because it requires PlayCanvas and complex setup
        game.initPC = mock.fn();

        // Reset state
        AppState.gameActive = false;
        AppState.gameStarting = false;
        AppState.socket = {
            connected: true,
            emit: mock.fn()
        };

        const origLog = console.log;
        console.log = () => {};

        game.startGame();

        console.log = origLog;

        // Assert
        assert.strictEqual(AppState.gameStarting, true);
        assert.strictEqual(AppState.myName, 'TESTPLAYER');

        // Ensure emit 'join' is called
        assert.strictEqual(AppState.socket.emit.mock.callCount(), 1);
        assert.strictEqual(AppState.socket.emit.mock.calls[0].arguments[0], 'join');
    });

    await t.test('applyRuntimeSettings(): updates layers based on settings', () => {
        const game = new PhageGame();

        // Create mock grid lines
        game.gridLines = [ { enabled: true }, { enabled: true } ];

        // Setup state with mock entities
        AppState.pEnts = {
            'test1': { ent: { children: [{ enabled: true }] } }
        };

        ParticleSystem.setEnabled.mock.resetCalls();

        // override MetaSystem getData
        const origGetData = global.MetaSystem.getData;
        global.MetaSystem.getData = mock.fn(() => ({ settings: { glowLayer: false, gridLayer: false, nameTags: false, particles: false } }));

        game.applyRuntimeSettings();

        // Assert settings applied
        assert.strictEqual(AppState.pEnts['test1'].ent.children[0].enabled, false);
        assert.strictEqual(game.gridLines[0].enabled, false);
        assert.strictEqual(game.gridLines[1].enabled, false);
        assert.strictEqual(ParticleSystem.setEnabled.mock.callCount(), 1);
        assert.strictEqual(ParticleSystem.setEnabled.mock.calls[0].arguments[0], false);

        global.MetaSystem.getData = origGetData;
    });

    await t.test('update(): handles networking, input, and state loop', () => {
        const game = new PhageGame();

        // Replace method with a no-op to not process actual PlayCanvas logic
        const origGameLoop = game.gameLoop;
        game.gameLoop = mock.fn();

        CameraSystem.update.mock.resetCalls();

        // Add fake camera reference to pass HudSystem.updateCombatPopups
        AppState.cameraEnt = { camera: {} };

        AppState.gameActive = true;
        AppState.animTime = 0;
        AppState.shakeAmt = 10;
        AppState.cam = { pos: new pc.Vec3(0, 700, 0) };
        AppState.fEnts = {};
        AppState.perfProfile = 'MEDIUM';

        game.update(0.016);

        // Assert
        assert.strictEqual(CameraSystem.update.mock.callCount(), 1);
        assert.strictEqual(game.gameLoop.mock.callCount(), 1);
        assert.ok(AppState.shakeAmt < 10);

        game.gameLoop = origGameLoop;
    });

    await t.test('gameLoop(): updates game loop timers and triggers emit logic', () => {
        const game = new PhageGame();

        // Prevent syncEntities from doing PlayCanvas model work by stubbing it
        game.syncEntities = mock.fn();
        game.renderModeEntities = mock.fn();

        // Fake Playcanvas App Reference
        AppState.app = { root: { children: [] } };

        AppState.gameActive = true;
        AppState.animTime = 0;
        AppState.sendTimer = 0.06; // >= 0.05 will trigger emit
        AppState.clientSeq = 1;
        AppState.pendingInputs = [];
        AppState.myId = 'player1';
        AppState.gameState = {
            players: [{ id: 'player1', color: '#ff0000', blobs: [{ id: 1, x: 0, z: 0, tx: 0, tz: 0 }] }],
            decoys: [],
            food: [],
            viruses: [],
            leaderboard: []
        };

        // Setup Socket
        const emitMock = mock.fn();
        AppState.socket = {
            connected: true,
            emit: emitMock
        };

        game.gameLoop(0.016);

        // Assert inputs sent
        assert.ok(AppState.sendTimer < 0.05); // reset
        assert.strictEqual(AppState.pendingInputs.length, 1);

        // Verify syncEntities was called
        assert.strictEqual(game.syncEntities.mock.callCount(), 1);
    });
});
