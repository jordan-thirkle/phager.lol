import { test, mock } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(`<!DOCTYPE html><html><body><canvas id="app-canvas"></canvas><div id="connOverlay"></div><div id="killfeed"></div></body></html>`, { url: "http://localhost" });
global.window = dom.window;
global.document = dom.window.document;
global.pc = {
    Entity: class {
        constructor() {
            this.model = { meshInstances: [{ material: null }] };
        }
        addComponent() {}
        setLocalScale() {}
        setPosition() {}
        addChild() {}
    },
    StandardMaterial: class {
        constructor() {}
        update() {}
    },
    Color: class {
        constructor(r, g, b) {
            this.r = r;
            this.g = g;
            this.b = b;
        }
    }
};

const { PhageGame } = await import('./PhageGame.js');
const { AppState } = await import('./state.js');

test('PhageGame - Initialization', () => {
  const game = new PhageGame();
  assert.ok(game);
  assert.strictEqual(game.arenaBuilt, false);
  assert.deepEqual(game.gridLines, []);
  assert.deepEqual(game.foodPool, []);
  assert.deepEqual(game.virusPool, []);
});

test('PhageGame - massToRadius', () => {
  const game = new PhageGame();
  assert.strictEqual(Math.round(game.massToRadius(100) * 100) / 100, 17.48);
  assert.strictEqual(game.massToRadius(0), 0);
});

test('PhageGame - hexToRgb01', () => {
  const game = new PhageGame();
  const rgb = game.hexToRgb01('#ff0080');
  assert.strictEqual(rgb.r, 1);
  assert.strictEqual(rgb.g, 0);
  assert.strictEqual(Math.round(rgb.b * 100) / 100, 0.5);
});

test('PhageGame - processWorldState - Reconcliation', () => {
    const game = new PhageGame();
    // Set up initial state
    AppState.myId = 'player1';
    AppState.gameState.players = [
        {
            id: 'player1',
            blobs: [{ id: 'b1', x: 0, z: 0, mass: 100 }]
        }
    ];
    AppState.pendingInputs = [
        { seq: 1, dx: 1, dz: 0 }, // Should be filtered out
        { seq: 2, dx: 1, dz: 0 }  // Should be applied
    ];

    // Server state acknowledges seq 1
    const serverState = {
        players: [
            {
                id: 'player1',
                lastSeq: 1,
                blobs: [{ id: 'b1', x: 10, z: 0, mass: 100 }]
            }
        ],
        leaderboard: []
    };

    game.processWorldState(serverState);

    // Sequence 1 should be filtered out
    assert.strictEqual(AppState.lastProcessedSeq, 1);
    assert.strictEqual(AppState.pendingInputs.length, 1);
    assert.strictEqual(AppState.pendingInputs[0].seq, 2);

    // Local blob x should be moved towards predX (which is server x + seq 2 input)
    // Server x = 10
    // Pending input = dx 1
    // Total mass = 100, length = 1. speed = 220 * Math.pow(100, -0.22) * 1 ≈ 220 * 0.36 ≈ 80
    // predX += 1 * 80 * 0.05 = +4.  predX = 14
    // local blob x += (14 - 0) * 0.45 = 6.3
    const localBlob = AppState.gameState.players.find(p => p.id === 'player1').blobs[0];
    assert.ok(localBlob.x > 0);
    assert.strictEqual(localBlob.mass, 100);
});

test('PhageGame - processWorldState - Server Death Detection', () => {
    const game = new PhageGame();
    let deathCalled = false;
    game.onPlayerDeath = () => { deathCalled = true; };

    AppState.gameActive = true;
    AppState.myId = 'player1';
    AppState.spectating = false;

    const serverState = {
        players: [], // We are dead
        leaderboard: []
    };

    game.processWorldState(serverState);

    assert.strictEqual(deathCalled, true);
});

test('PhageGame - processWorldState - Server count mismatch snap', () => {
    const game = new PhageGame();
    AppState.myId = 'player1';
    AppState.gameState.players = [
        {
            id: 'player1',
            blobs: [{ id: 'b1', x: 0, z: 0, mass: 100 }]
        }
    ];

    const serverState = {
        players: [
            {
                id: 'player1',
                lastSeq: 1,
                blobs: [
                    { id: 'b1', x: 10, z: 10, mass: 50 },
                    { id: 'b2', x: 20, z: 20, mass: 50 }
                ]
            }
        ],
        leaderboard: []
    };

    game.processWorldState(serverState);

    const localPlayer = AppState.gameState.players.find(p => p.id === 'player1');
    assert.strictEqual(localPlayer.blobs.length, 2);
    assert.strictEqual(localPlayer.blobs[1].id, 'b2');
    assert.strictEqual(localPlayer.blobs[1].x, 20);
});

test('PhageGame - getOrMakeFoodEnt caching', () => {
    const game = new PhageGame();
    // mock game environment slightly to test this logic
    let mockPool = [];
    game.foodPool = mockPool;
    game.hexToRgb01 = () => ({r:1, g:1, b:1});
    // AppState and pc are slightly hard to fully mock for the create branch,
    // but we can test the cache hit branch easily.
    AppState.fEnts['f1'] = { id: 'f1', mockEnt: true };

    const ent = game.getOrMakeFoodEnt('f1', '#ffffff');
    assert.strictEqual(ent.id, 'f1');
    assert.strictEqual(ent.mockEnt, true);
});

test('PhageGame - addChatMessage', () => {
    const game = new PhageGame();
    // JSDOM has mocked document and container should not exist yet
    game.addChatMessage({ name: 'test', text: 'hello' }); // should not throw

    // Now create it
    const container = document.createElement('div');
    container.id = 'chat-messages';
    document.body.appendChild(container);

    game.addChatMessage({ name: 'User1', text: 'Hello World', color: '#ff0000' });

    const messages = container.querySelectorAll('.chat-msg');
    assert.strictEqual(messages.length, 1);
    assert.ok(messages[0].innerHTML.includes('User1'));
    assert.ok(messages[0].innerHTML.includes('Hello World'));
    assert.ok(messages[0].innerHTML.includes('#ff0000'));
});

test('PhageGame - clearGame', () => {
    const game = new PhageGame();
    AppState.gameActive = true;

    // Mock entities with destroy function
    let pEntDestroyed = false;
    let fEntDestroyed = false;
    let vEntDestroyed = false;

    AppState.pEnts['p1'] = { ent: { destroy: () => { pEntDestroyed = true; } } };
    AppState.fEnts['f1'] = { destroy: () => { fEntDestroyed = true; } };
    AppState.vEnts['v1'] = { destroy: () => { vEntDestroyed = true; } };

    // Setup nametags div
    const nametags = document.createElement('div');
    nametags.id = 'nametags';
    nametags.innerHTML = '<span>Old tag</span>';
    document.body.appendChild(nametags);

    game.clearGame();

    assert.strictEqual(AppState.gameActive, false);
    assert.strictEqual(pEntDestroyed, true);
    assert.strictEqual(fEntDestroyed, true);
    assert.strictEqual(vEntDestroyed, true);
    assert.deepEqual(AppState.pEnts, {});
    assert.deepEqual(AppState.fEnts, {});
    assert.deepEqual(AppState.vEnts, {});
    assert.strictEqual(nametags.innerHTML, '');
});
