import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import FFA from './FFA.js';

describe('FFA Mode', () => {
  beforeEach(() => {
    FFA.roundEnded = false;
  });

  describe('Properties', () => {
    it('should have correct default properties', () => {
      assert.strictEqual(FFA.name, 'FREE FOR ALL');
      assert.deepStrictEqual(FFA.arenaSize, { x: 3000, z: 3000 });
      assert.strictEqual(FFA.massDecay, 0.9997);
      assert.strictEqual(FFA.speedMultiplier, 1.0);
    });
  });

  describe('canEat()', () => {
    it('should return false if attacker or target is missing', () => {
      assert.strictEqual(FFA.canEat(null, {}), false);
      assert.strictEqual(FFA.canEat({}, null), false);
    });

    it('should return false if target is shielded', () => {
      const attacker = { blobs: [{ mass: 100 }] };
      const target = { shielded: true, blobs: [{ mass: 10 }] };
      assert.strictEqual(FFA.canEat(attacker, target), false);
    });

    it('should return true if attacker is > 1.12 times target mass', () => {
      const attacker = { blobs: [{ mass: 113 }] };
      const target = { blobs: [{ mass: 100 }] };
      assert.strictEqual(FFA.canEat(attacker, target), true);
    });

    it('should return false if attacker is <= 1.12 times target mass', () => {
      const attacker = { blobs: [{ mass: 112 }] };
      const target = { blobs: [{ mass: 100 }] };
      assert.strictEqual(FFA.canEat(attacker, target), false);
    });
  });

  describe('onPlayerJoin()', () => {
    it('should reset roundEnded if there is exactly 1 player and round is ended', () => {
      FFA.roundEnded = true;
      const gs = { players: { p1: {} } };
      FFA.onPlayerJoin({}, gs);
      assert.strictEqual(FFA.roundEnded, false);
    });

    it('should not reset roundEnded if there are more than 1 players', () => {
      FFA.roundEnded = true;
      const gs = { players: { p1: {}, p2: {} } };
      FFA.onPlayerJoin({}, gs);
      assert.strictEqual(FFA.roundEnded, true);
    });
  });

  describe('onPlayerDeath()', () => {
    it('should be a callable function that does not throw', () => {
      assert.doesNotThrow(() => FFA.onPlayerDeath({}, {}));
    });
  });

  describe('onTick()', () => {
    it('should apply mass decay to all player blobs', () => {
      const gs = {
        players: {
          p1: { blobs: [{ mass: 100 }, { mass: 200 }] },
          p2: { blobs: [{ mass: 300 }] },
          p3: {} // no blobs
        }
      };
      FFA.onTick(gs, 1000);
      assert.strictEqual(gs.players.p1.blobs[0].mass, 100 * FFA.massDecay);
      assert.strictEqual(gs.players.p1.blobs[1].mass, 200 * FFA.massDecay);
      assert.strictEqual(gs.players.p2.blobs[0].mass, 300 * FFA.massDecay);
    });
  });

  describe('checkWinCondition()', () => {
    it('should return null if roundEnded is true', () => {
      FFA.roundEnded = true;
      assert.strictEqual(FFA.checkWinCondition({}), null);
    });

    it('should return null if there are no players', () => {
      const gs = { players: {} };
      assert.strictEqual(FFA.checkWinCondition(gs), null);
    });

    it('should return null if leader mass is < 10000', () => {
      const gs = {
        players: {
          p1: { blobs: [{ mass: 5000 }] },
          p2: { blobs: [{ mass: 8000 }] }
        }
      };
      assert.strictEqual(FFA.checkWinCondition(gs), null);
      assert.strictEqual(FFA.roundEnded, false);
    });

    it('should return winner if leader mass is >= 10000', () => {
      const p1 = { blobs: [{ mass: 10000 }] };
      const p2 = { blobs: [{ mass: 8000 }] };
      const gs = {
        players: {
          p1,
          p2
        }
      };
      const result = FFA.checkWinCondition(gs);
      assert.deepStrictEqual(result, { winner: p1, type: 'CHAMPION' });
      assert.strictEqual(FFA.roundEnded, true);
    });

    it('should handle players with no blobs gracefully', () => {
        const p1 = { blobs: [{ mass: 10000 }] };
        const p2 = {};
        const gs = { players: { p1, p2 } };
        const result = FFA.checkWinCondition(gs);
        assert.deepStrictEqual(result, { winner: p1, type: 'CHAMPION' });
    });
  });
});
