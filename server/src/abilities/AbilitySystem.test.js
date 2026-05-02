import { test, describe } from 'node:test';
import assert from 'node:assert';
import { AbilitySystem } from './AbilitySystem.js';

describe('AbilitySystem', () => {

    describe('tryActivate', () => {
        test('returns false if player is missing', () => {
            const AppState = { players: {}, abilities: new Map() };
            assert.strictEqual(AbilitySystem.tryActivate('p1', AppState), false);
        });

        test('returns false if ability data is missing', () => {
            const AppState = {
                players: { p1: {} },
                abilities: new Map()
            };
            assert.strictEqual(AbilitySystem.tryActivate('p1', AppState), false);
        });

        test('returns false if ability is on cooldown', () => {
            const AppState = {
                players: { p1: {} },
                abilities: new Map([['p1', { ability: 'SHIELD', remainingMs: 100, active: false }]])
            };
            assert.strictEqual(AbilitySystem.tryActivate('p1', AppState), false);
        });

        test('returns false if ability is already active', () => {
            const AppState = {
                players: { p1: {} },
                abilities: new Map([['p1', { ability: 'SHIELD', remainingMs: 0, active: true }]])
            };
            assert.strictEqual(AbilitySystem.tryActivate('p1', AppState), false);
        });

        test('returns false if ability type is invalid', () => {
            const AppState = {
                players: { p1: {} },
                abilities: new Map([['p1', { ability: 'INVALID_ABILITY', remainingMs: 0, active: false }]])
            };
            assert.strictEqual(AbilitySystem.tryActivate('p1', AppState), false);
        });

        test('successfully activates SHIELD ability', () => {
            const player = {};
            const abilityData = { ability: 'SHIELD', remainingMs: 0, active: false };
            const AppState = {
                players: { p1: player },
                abilities: new Map([['p1', abilityData]])
            };

            const shieldAbility = AbilitySystem.getAbility('SHIELD');

            const result = AbilitySystem.tryActivate('p1', AppState);

            assert.strictEqual(result, true);
            assert.strictEqual(abilityData.active, true);
            assert.strictEqual(abilityData.activeDuration, shieldAbility.durationMs);
            assert.strictEqual(abilityData.remainingMs, shieldAbility.cooldownMs);
            assert.strictEqual(player.shielded, true); // set by onActivate
        });
    });

    describe('tick', () => {
        test('cleans up ability data for disconnected player', () => {
            const AppState = {
                players: {}, // p1 is missing
                abilities: new Map([['p1', { ability: 'SHIELD', remainingMs: 0, active: false }]]),
                decoys: []
            };

            AbilitySystem.tick(AppState, 100);

            assert.strictEqual(AppState.abilities.has('p1'), false);
        });

        test('reduces cooldown (remainingMs) correctly', () => {
            const abilityData = { ability: 'SHIELD', remainingMs: 500, active: false };
            const AppState = {
                players: { p1: {} },
                abilities: new Map([['p1', abilityData]]),
                decoys: []
            };

            AbilitySystem.tick(AppState, 100);
            assert.strictEqual(abilityData.remainingMs, 400);

            AbilitySystem.tick(AppState, 500); // Should not go below 0
            assert.strictEqual(abilityData.remainingMs, 0);
        });

        test('handles active duration and expiration', () => {
            const player = { shielded: true };
            const abilityData = { ability: 'SHIELD', remainingMs: 10000, active: true, activeDuration: 100 };
            const AppState = {
                players: { p1: player },
                abilities: new Map([['p1', abilityData]]),
                decoys: []
            };

            AbilitySystem.tick(AppState, 50);
            assert.strictEqual(abilityData.activeDuration, 50);
            assert.strictEqual(abilityData.active, true);
            assert.strictEqual(player.shielded, true); // onExpire not called yet

            AbilitySystem.tick(AppState, 60);
            assert.strictEqual(abilityData.activeDuration, -10);
            assert.strictEqual(abilityData.active, false);
            assert.strictEqual(player.shielded, false); // onExpire called
        });

        test('cleans up expired decoys', () => {
            const now = Date.now();
            const AppState = {
                players: {},
                abilities: new Map(),
                decoys: [
                    { id: 1, expiresAt: now + 1000 },
                    { id: 2, expiresAt: now - 1000 }
                ]
            };

            AbilitySystem.tick(AppState, 100);

            assert.strictEqual(AppState.decoys.length, 1);
            assert.strictEqual(AppState.decoys[0].id, 1);
        });
    });
});
