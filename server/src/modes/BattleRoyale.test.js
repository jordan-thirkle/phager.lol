import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import BattleRoyale from './BattleRoyale.js';

describe('BattleRoyale Mode', () => {
  const resetMode = () => {
    BattleRoyale.gameStarted = false;
    BattleRoyale.lobbyTimer = 60000;
    BattleRoyale.zone = { centerX: 0, centerZ: 0, radius: 2000, targetRadius: 2000, shrinkSpeed: 0, phase: 0 };
    BattleRoyale.placements = [];
    BattleRoyale.startTime = undefined;
    BattleRoyale.massDecay = 0.9997;
  };

  beforeEach(() => {
    resetMode();
  });

  describe('canEat', () => {
    it('should return false if game has not started', () => {
      const attacker = { blobs: [{ mass: 100 }] };
      const target = { blobs: [{ mass: 10 }] };
      assert.strictEqual(BattleRoyale.canEat(attacker, target), false);
    });

    it('should return false if target is shielded', () => {
      BattleRoyale.gameStarted = true;
      const attacker = { blobs: [{ mass: 100 }] };
      const target = { blobs: [{ mass: 10 }], shielded: true };
      assert.strictEqual(BattleRoyale.canEat(attacker, target), false);
    });

    it('should return true if attacker mass > target mass * 1.12', () => {
      BattleRoyale.gameStarted = true;
      const attacker = { blobs: [{ mass: 113 }] };
      const target = { blobs: [{ mass: 100 }] };
      assert.strictEqual(BattleRoyale.canEat(attacker, target), true);
    });

    it('should return false if attacker mass <= target mass * 1.12', () => {
      BattleRoyale.gameStarted = true;
      const attacker = { blobs: [{ mass: 112 }] };
      const target = { blobs: [{ mass: 100 }] };
      assert.strictEqual(BattleRoyale.canEat(attacker, target), false);
    });

    it('should return false if attacker or target is missing', () => {
      BattleRoyale.gameStarted = true;
      assert.strictEqual(BattleRoyale.canEat(null, { blobs: [] }), false);
      assert.strictEqual(BattleRoyale.canEat({ blobs: [] }, null), false);
    });
  });

  describe('onPlayerDeath', () => {
    it('should record placement if game started', () => {
      BattleRoyale.gameStarted = true;
      const player = { name: 'Player1', kills: 5, blobs: [{ mass: 100 }, { mass: 50 }] };
      BattleRoyale.onPlayerDeath(player, {});
      assert.strictEqual(BattleRoyale.placements.length, 1);
      assert.deepStrictEqual(BattleRoyale.placements[0], { name: 'Player1', kills: 5, massAtDeath: 150 });
    });

    it('should not record placement if game not started', () => {
      BattleRoyale.gameStarted = false;
      const player = { name: 'Player1', kills: 5, blobs: [{ mass: 100 }] };
      BattleRoyale.onPlayerDeath(player, {});
      assert.strictEqual(BattleRoyale.placements.length, 0);
    });
  });

  describe('onTick - Lobby', () => {
    it('should decrease lobby timer', () => {
      const gs = { gameTime: 0, players: {} };
      BattleRoyale.onTick(gs, 1000);
      assert.strictEqual(BattleRoyale.lobbyTimer, 59000);
      assert.strictEqual(BattleRoyale.gameStarted, false);
      assert.strictEqual(gs.gameTime, 1000);
    });

    it('should start game when timer expires', () => {
      const gs = { gameTime: 0, players: {} };
      BattleRoyale.lobbyTimer = 500;
      BattleRoyale.onTick(gs, 1000);
      assert.strictEqual(BattleRoyale.gameStarted, true);
      assert.ok(BattleRoyale.startTime);
    });

    it('should start game when 8 human players join', () => {
      const players = {};
      for (let i = 0; i < 8; i++) {
        players[`p${i}`] = { id: `p${i}`, isBot: false };
      }
      const gs = { gameTime: 0, players };
      BattleRoyale.onTick(gs, 1000);
      assert.strictEqual(BattleRoyale.gameStarted, true);
    });

    it('should not start game with 8 bots', () => {
      const players = {};
      for (let i = 0; i < 8; i++) {
        players[`p${i}`] = { id: `p${i}`, isBot: true };
      }
      const gs = { gameTime: 0, players };
      BattleRoyale.onTick(gs, 1000);
      assert.strictEqual(BattleRoyale.gameStarted, false);
    });
  });

  describe('onTick - Game Started', () => {
    beforeEach(() => {
      BattleRoyale.gameStarted = true;
    });

    it('should shrink zone in phase 0', () => {
      const gs = { gameTime: 60000, players: {} }; // Phase 0 starts at 60000
      BattleRoyale.zone.radius = 2000;
      BattleRoyale.zone.phase = 0;

      // Phase 0: speed 10
      BattleRoyale.onTick(gs, 1000);
      assert.strictEqual(BattleRoyale.zone.radius, 2000 - 10);
      assert.strictEqual(BattleRoyale.zone.shrinkSpeed, 10);
    });

    it('should advance phase when target radius reached', () => {
      const gs = { gameTime: 60000, players: {} };
      BattleRoyale.zone.radius = 1400.1;
      BattleRoyale.zone.phase = 0;

      BattleRoyale.onTick(gs, 100); // shrink by 10 * 0.1 = 1
      assert.strictEqual(BattleRoyale.zone.radius, 1400);
      assert.strictEqual(BattleRoyale.zone.phase, 1);
    });

    it('should apply zone damage and remove players', () => {
      BattleRoyale.massDecay = 1.0; // Disable decay to simplify test
      let removedPlayerId = null;
      const gs = {
        gameTime: 100000,
        players: {
          'p1': {
            id: 'p1',
            blobs: [{ x: 3000, z: 0, mass: 20 }] // Outside 2000 radius
          }
        },
        removePlayer: (id) => { removedPlayerId = id; }
      };

      BattleRoyale.zone.radius = 2000;

      // 5 mass per second damage. Tick 1 second.
      BattleRoyale.onTick(gs, 1000);

      assert.strictEqual(gs.players['p1'].blobs[0].mass, 15);

      // Next second, mass becomes 10, which is < 15, so blob is removed.
      // Since it's the only blob, player is removed.
      BattleRoyale.onTick(gs, 1000);
      assert.strictEqual(gs.players['p1'].blobs.length, 0);
      assert.strictEqual(removedPlayerId, 'p1');
    });

    it('should apply mass decay to all blobs', () => {
        const gs = {
            gameTime: 100000,
            players: {
                'p1': {
                    id: 'p1',
                    blobs: [{ x: 0, z: 0, mass: 100 }]
                }
            }
        };
        BattleRoyale.onTick(gs, 1000);
        assert.strictEqual(gs.players['p1'].blobs[0].mass, 100 * 0.9997);
    });
  });

  describe('checkWinCondition', () => {
    it('should return null if game not started', () => {
      BattleRoyale.gameStarted = false;
      assert.strictEqual(BattleRoyale.checkWinCondition({}), null);
    });

    it('should return winner when only one player remains', () => {
      BattleRoyale.gameStarted = true;
      const gs = {
        players: {
          'p1': { name: 'Winner', blobs: [{ mass: 100 }], kills: 10 }
        }
      };
      const result = BattleRoyale.checkWinCondition(gs);
      assert.ok(result);
      assert.strictEqual(result.winner.name, 'Winner');
      assert.strictEqual(result.type, 'BATTLE_ROYALE_VICTORY');
      assert.strictEqual(BattleRoyale.placements[0].name, 'Winner');
    });

    it('should handle tiebreaker when zone is small', () => {
      BattleRoyale.gameStarted = true;
      BattleRoyale.zone.radius = 50;
      const gs = {
        players: {
          'p1': { name: 'Player1', blobs: [{ mass: 100 }], kills: 5 },
          'p2': { name: 'Player2', blobs: [{ mass: 200 }], kills: 2 }
        }
      };
      const result = BattleRoyale.checkWinCondition(gs);
      assert.ok(result);
      assert.strictEqual(result.winner.name, 'Player2'); // More mass
      assert.strictEqual(result.tiebreak, true);
    });

    it('should handle tiebreaker with kills if mass is equal', () => {
        BattleRoyale.gameStarted = true;
        BattleRoyale.zone.radius = 50;
        const gs = {
          players: {
            'p1': { name: 'Player1', blobs: [{ mass: 100 }], kills: 10 },
            'p2': { name: 'Player2', blobs: [{ mass: 100 }], kills: 5 }
          }
        };
        const result = BattleRoyale.checkWinCondition(gs);
        assert.ok(result);
        assert.strictEqual(result.winner.name, 'Player1'); // Same mass, more kills
      });

    it('should return null if multiple players alive and zone not small', () => {
      BattleRoyale.gameStarted = true;
      BattleRoyale.zone.radius = 1000;
      const gs = {
        players: {
          'p1': { blobs: [{ mass: 100 }] },
          'p2': { blobs: [{ mass: 100 }] }
        }
      };
      assert.strictEqual(BattleRoyale.checkWinCondition(gs), null);
    });
  });
});
