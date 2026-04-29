import { describe, it } from 'node:test';
import assert from 'node:assert';
import ModeManager from './ModeManager.js';

describe('ModeManager', () => {
  describe('Default Behaviors', () => {
    it('should return default values when mode provides none', () => {
      const mode = {};
      const manager = new ModeManager(mode);

      assert.deepStrictEqual(manager.getArenaSize(), { x: 3000, z: 3000 });
      assert.strictEqual(manager.getMassDecay(), 0.9997);
      assert.strictEqual(manager.getSpeedMultiplier(), 1.0);
      assert.strictEqual(manager.getModeName(), 'Unknown');
      assert.strictEqual(manager.checkWinCondition({}), null);
    });

    it('should handle undefined mode correctly', () => {
      const manager = new ModeManager({});
      assert.deepStrictEqual(manager.getArenaSize(), { x: 3000, z: 3000 });
    });
  });

  describe('Overridden Properties', () => {
    it('should return overridden values when mode provides them', () => {
      const mode = {
        arenaSize: { x: 5000, z: 5000 },
        massDecay: 0.99,
        speedMultiplier: 1.5,
        name: 'Custom Mode',
        checkWinCondition: (gs) => 'Player 1 Wins!'
      };
      const manager = new ModeManager(mode);

      assert.deepStrictEqual(manager.getArenaSize(), { x: 5000, z: 5000 });
      assert.strictEqual(manager.getMassDecay(), 0.99);
      assert.strictEqual(manager.getSpeedMultiplier(), 1.5);
      assert.strictEqual(manager.getModeName(), 'Custom Mode');
      assert.strictEqual(manager.checkWinCondition({}), 'Player 1 Wins!');
    });
  });

  describe('canEat Logic', () => {
    it('should use default mass-based logic when no override is provided', () => {
      const manager = new ModeManager({});

      const smallBlob = { blobs: [{ mass: 100 }] };
      const largeBlob = { blobs: [{ mass: 150 }] };
      const slightlyLargerBlob = { blobs: [{ mass: 110 }] }; // not 12% larger

      assert.strictEqual(manager.canEat(largeBlob, smallBlob), true, 'Large should eat small');
      assert.strictEqual(manager.canEat(smallBlob, largeBlob), false, 'Small should not eat large');
      assert.strictEqual(manager.canEat(slightlyLargerBlob, smallBlob), false, 'Slightly larger should not eat (needs > 1.12x mass)');
      assert.strictEqual(manager.canEat(smallBlob, smallBlob), false, 'Same size should not eat');
    });

    it('should handle undefined or empty attacker/target blobs in default logic', () => {
      const manager = new ModeManager({});
      const target = { blobs: [{ mass: 100 }] };
      const emptyAttacker = { blobs: [] };
      const nullAttacker = null;

      assert.strictEqual(manager.canEat(emptyAttacker, target), false, 'Empty attacker cannot eat');
      assert.strictEqual(manager.canEat(nullAttacker, target), false, 'Null attacker cannot eat');
      assert.strictEqual(manager.canEat(target, emptyAttacker), true, 'Valid attacker can eat empty target (target mass 0)');
    });

    it('should handle multiple blobs by summing their mass', () => {
      const manager = new ModeManager({});
      const attacker = { blobs: [{ mass: 100 }, { mass: 100 }] }; // Total 200
      const target = { blobs: [{ mass: 150 }] }; // Total 150

      assert.strictEqual(manager.canEat(attacker, target), true, 'Attacker total mass 200 should eat target 150');
      assert.strictEqual(manager.canEat(target, attacker), false, 'Target total mass 150 should not eat attacker 200');
    });

    it('should use custom canEat logic when provided by mode', () => {
      const mode = {
        canEat: (attacker, target) => {
          // Custom logic: only odd mass can eat even mass
          const attackerMass = attacker.blobs[0].mass;
          const targetMass = target.blobs[0].mass;
          return attackerMass % 2 !== 0 && targetMass % 2 === 0;
        }
      };
      const manager = new ModeManager(mode);

      const oddAttacker = { blobs: [{ mass: 101 }] };
      const evenTarget = { blobs: [{ mass: 100 }] };
      const oddTarget = { blobs: [{ mass: 101 }] };

      assert.strictEqual(manager.canEat(oddAttacker, evenTarget), true);
      assert.strictEqual(manager.canEat(oddAttacker, oddTarget), false);
      assert.strictEqual(manager.canEat(evenTarget, oddAttacker), false);
    });
  });

  describe('Event Hooks', () => {
    it('should call onPlayerJoin if provided', () => {
      let called = false;
      const mode = {
        onPlayerJoin: (player, gs) => {
          called = true;
          assert.strictEqual(player, 'player1');
          assert.strictEqual(gs, 'gameState');
        }
      };
      const manager = new ModeManager(mode);
      manager.onPlayerJoin('player1', 'gameState');
      assert.strictEqual(called, true);
    });

    it('should not throw if onPlayerJoin is not provided', () => {
      const manager = new ModeManager({});
      assert.doesNotThrow(() => manager.onPlayerJoin('player1', 'gameState'));
    });

    it('should call onPlayerDeath if provided', () => {
      let called = false;
      const mode = {
        onPlayerDeath: (player, gs) => {
          called = true;
          assert.strictEqual(player, 'player1');
          assert.strictEqual(gs, 'gameState');
        }
      };
      const manager = new ModeManager(mode);
      manager.onPlayerDeath('player1', 'gameState');
      assert.strictEqual(called, true);
    });

    it('should not throw if onPlayerDeath is not provided', () => {
      const manager = new ModeManager({});
      assert.doesNotThrow(() => manager.onPlayerDeath('player1', 'gameState'));
    });

    it('should call onTick if provided', () => {
      let called = false;
      const mode = {
        onTick: (gs, delta) => {
          called = true;
          assert.strictEqual(gs, 'gameState');
          assert.strictEqual(delta, 16);
        }
      };
      const manager = new ModeManager(mode);
      manager.onTick('gameState', 16);
      assert.strictEqual(called, true);
    });

    it('should not throw if onTick is not provided', () => {
      const manager = new ModeManager({});
      assert.doesNotThrow(() => manager.onTick('gameState', 16));
    });
  });
});
