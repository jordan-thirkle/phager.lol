import test from 'node:test';
import assert from 'node:assert';
import { AbilitySystem } from './AbilitySystem.js';

test('AbilitySystem handles abilities without onTick or onExpire', (t) => {
    const AppState = {
        players: {
            'player1': { id: 'player1', blobs: [] }
        },
        abilities: new Map([
            ['player1', {
                ability: 'DECOY',
                active: true,
                activeDuration: 100,
                remainingMs: 0
            }]
        ]),
        decoys: []
    };

    // This should not throw even if DECOY has no onTick
    AbilitySystem.tick(AppState, 50);

    assert.strictEqual(AppState.abilities.get('player1').active, true);
    assert.strictEqual(AppState.abilities.get('player1').activeDuration, 50);

    // This should not throw even if DECOY has no onExpire
    AbilitySystem.tick(AppState, 100);
    assert.strictEqual(AppState.abilities.get('player1').active, false);
});

test('AbilitySystem handles SHIELD without onTick', (t) => {
    const AppState = {
        players: {
            'player1': { id: 'player1', blobs: [], shielded: true }
        },
        abilities: new Map([
            ['player1', {
                ability: 'SHIELD',
                active: true,
                activeDuration: 100,
                remainingMs: 0
            }]
        ]),
        decoys: []
    };

    // This should not throw even if SHIELD has no onTick
    AbilitySystem.tick(AppState, 50);

    assert.strictEqual(AppState.abilities.get('player1').active, true);
    assert.strictEqual(AppState.abilities.get('player1').activeDuration, 50);
    assert.strictEqual(AppState.players['player1'].shielded, true);

    // Should call onExpire and set shielded to false
    AbilitySystem.tick(AppState, 100);
    assert.strictEqual(AppState.abilities.get('player1').active, false);
    assert.strictEqual(AppState.players['player1'].shielded, false);
});
