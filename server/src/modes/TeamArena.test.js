import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import TeamArena from './TeamArena.js';

describe('TeamArena', () => {
  beforeEach(() => {
    TeamArena.redCount = 0;
    TeamArena.blueCount = 0;
    TeamArena.timer = 300000;
    TeamArena.flagOrb = { x: 0, z: 0, carrier: null, lastHeldTeam: null, dropTime: 0 };
  });

  describe('canEat', () => {
    it('returns false if attacker or target is missing', () => {
      assert.strictEqual(TeamArena.canEat(null, {}), false);
      assert.strictEqual(TeamArena.canEat({}, null), false);
    });

    it('returns false if attacker and target are on the same team', () => {
      const attacker = { team: 'red' };
      const target = { team: 'red' };
      assert.strictEqual(TeamArena.canEat(attacker, target), false);
    });

    it('returns false if target is shielded', () => {
      const attacker = { team: 'red', blobs: [{ mass: 100 }] };
      const target = { team: 'blue', shielded: true, blobs: [{ mass: 10 }] };
      assert.strictEqual(TeamArena.canEat(attacker, target), false);
    });

    it('returns true if attacker mass > target mass * 1.12', () => {
      const attacker = { team: 'red', blobs: [{ mass: 113 }] };
      const target = { team: 'blue', blobs: [{ mass: 100 }] };
      assert.strictEqual(TeamArena.canEat(attacker, target), true);
    });

    it('returns false if attacker mass <= target mass * 1.12', () => {
      const attacker = { team: 'red', blobs: [{ mass: 112 }] };
      const target = { team: 'blue', blobs: [{ mass: 100 }] };
      assert.strictEqual(TeamArena.canEat(attacker, target), false);
    });
  });

  describe('onPlayerJoin', () => {
    it('balances teams by assigning red then blue', () => {
      const p1 = {};
      const p2 = {};
      const p3 = {};

      TeamArena.onPlayerJoin(p1, {});
      assert.strictEqual(p1.team, 'red');
      assert.strictEqual(TeamArena.redCount, 1);
      assert.strictEqual(TeamArena.blueCount, 0);

      TeamArena.onPlayerJoin(p2, {});
      assert.strictEqual(p2.team, 'blue');
      assert.strictEqual(TeamArena.redCount, 1);
      assert.strictEqual(TeamArena.blueCount, 1);

      TeamArena.onPlayerJoin(p3, {});
      assert.strictEqual(p3.team, 'red');
      assert.strictEqual(TeamArena.redCount, 2);
      assert.strictEqual(TeamArena.blueCount, 1);
    });
  });

  describe('onPlayerDeath', () => {
    it('decreases the correct team count', () => {
      TeamArena.redCount = 1;
      TeamArena.blueCount = 1;

      TeamArena.onPlayerDeath({ team: 'red' }, {});
      assert.strictEqual(TeamArena.redCount, 0);
      assert.strictEqual(TeamArena.blueCount, 1);

      TeamArena.onPlayerDeath({ team: 'blue' }, {});
      assert.strictEqual(TeamArena.redCount, 0);
      assert.strictEqual(TeamArena.blueCount, 0);
    });

    it('drops the flag if the dead player was carrying it', () => {
      TeamArena.flagOrb.carrier = 'p1';
      TeamArena.flagOrb.lastHeldTeam = null;

      const player = {
        id: 'p1',
        team: 'red',
        blobs: [{ x: 50, z: 100 }]
      };

      TeamArena.onPlayerDeath(player, {});

      assert.strictEqual(TeamArena.flagOrb.carrier, null);
      assert.strictEqual(TeamArena.flagOrb.lastHeldTeam, 'red');
      assert.strictEqual(TeamArena.flagOrb.x, 50);
      assert.strictEqual(TeamArena.flagOrb.z, 100);
      assert.ok(TeamArena.flagOrb.dropTime > 0);
    });
  });

  describe('onTick', () => {
    it('decreases timer by delta but not below 0', () => {
      TeamArena.timer = 100;
      TeamArena.onTick({ players: {} }, 50);
      assert.strictEqual(TeamArena.timer, 50);

      TeamArena.onTick({ players: {} }, 100);
      assert.strictEqual(TeamArena.timer, 0);
    });

    it('decays mass for all players', () => {
      const gs = {
        players: {
          p1: { blobs: [{ mass: 100 }] },
          p2: { blobs: [{ mass: 200 }] }
        }
      };
      TeamArena.onTick(gs, 16);
      assert.strictEqual(gs.players.p1.blobs[0].mass, 100 * TeamArena.massDecay);
      assert.strictEqual(gs.players.p2.blobs[0].mass, 200 * TeamArena.massDecay);
    });

    it('gives XP to the flag carrier and mass to their team', () => {
      TeamArena.flagOrb.carrier = 'p1';
      const gs = {
        players: {
          p1: { id: 'p1', team: 'red', xp: 0, blobs: [{ mass: 100 }] },
          p2: { id: 'p2', team: 'red', xp: 0, blobs: [{ mass: 100 }] },
          p3: { id: 'p3', team: 'blue', xp: 0, blobs: [{ mass: 100 }] }
        }
      };

      TeamArena.onTick(gs, 16);

      assert.strictEqual(gs.players.p1.xp, 5);
      assert.strictEqual(gs.players.p1.blobs[0].mass, 100 * TeamArena.massDecay + 0.2);
      assert.strictEqual(gs.players.p2.xp, 0); // Only carrier gets XP
      assert.strictEqual(gs.players.p2.blobs[0].mass, 100 * TeamArena.massDecay + 0.2); // Team gets mass
      assert.strictEqual(gs.players.p3.xp, 0);
      assert.strictEqual(gs.players.p3.blobs[0].mass, 100 * TeamArena.massDecay); // Other team just decays
    });

    it('allows a player to pick up a dropped flag after 3000ms', () => {
      TeamArena.flagOrb.carrier = null;
      TeamArena.flagOrb.dropTime = Date.now() - 4000;
      TeamArena.flagOrb.x = 0;
      TeamArena.flagOrb.z = 0;

      const gs = {
        players: {
          p1: { id: 'p1', team: 'blue', blobs: [{ x: 0, z: 0, mass: 100 }] }
        }
      };

      TeamArena.onTick(gs, 16);

      assert.strictEqual(TeamArena.flagOrb.carrier, 'p1');
      assert.strictEqual(TeamArena.flagOrb.lastHeldTeam, 'blue');
    });

    it('updates flag coordinates to the carriers first blob', () => {
        TeamArena.flagOrb.carrier = 'p1';
        const gs = {
            players: {
                p1: { id: 'p1', team: 'red', xp: 0, blobs: [{ x: 100, z: 200, mass: 100 }]}
            }
        };

        TeamArena.onTick(gs, 16);
        assert.strictEqual(TeamArena.flagOrb.x, 100);
        assert.strictEqual(TeamArena.flagOrb.z, 200);
    });

    it('drops flag if carrier no longer exists', () => {
        TeamArena.flagOrb.carrier = 'p1';
        const gs = {
            players: {}
        };

        TeamArena.onTick(gs, 16);
        assert.strictEqual(TeamArena.flagOrb.carrier, null);
        assert.ok(TeamArena.flagOrb.dropTime > 0);
    });
  });

  describe('checkWinCondition', () => {
    it('returns null if timer > 0', () => {
      TeamArena.timer = 100;
      assert.strictEqual(TeamArena.checkWinCondition({}), null);
    });

    it('returns lastHeldTeam if timer <= 0', () => {
      TeamArena.timer = 0;
      TeamArena.flagOrb.lastHeldTeam = 'blue';
      const result = TeamArena.checkWinCondition({ players: {} });
      assert.deepStrictEqual(result, { winner: 'blue', winnerTeam: 'blue', type: 'TEAM_VICTORY' });
    });

    it('returns team with most mass if timer <= 0 and lastHeldTeam is null', () => {
      TeamArena.timer = 0;
      TeamArena.flagOrb.lastHeldTeam = null;

      const gs = {
        players: {
          p1: { team: 'red', blobs: [{ mass: 50 }] },
          p2: { team: 'blue', blobs: [{ mass: 100 }] }
        }
      };

      const result = TeamArena.checkWinCondition(gs);
      assert.deepStrictEqual(result, { winner: 'blue', winnerTeam: 'blue', type: 'TEAM_VICTORY' });
    });
  });
});
