const BattleRoyale = {
  name: 'BATTLE ROYALE',
  arenaSize: { x: 4000, z: 4000 },
  massDecay: 0.9997,
  speedMultiplier: 1.0,
  lobbyTimer: 60000,
  gameStarted: false,
  zone: { centerX: 0, centerZ: 0, radius: 2000, targetRadius: 2000, shrinkSpeed: 0, phase: 0 },
  placements: [],
  
  phases: [
    { startTime: 60000,  endRadius: 1400, duration: 60000,  speed: 10  },
    { startTime: 180000, endRadius: 700,  duration: 120000, speed: 5.8 },
    { startTime: 300000, endRadius: 50,   duration: 120000, speed: 5.4 },
  ],
  
  canEat(attacker, target) {
    if (!attacker || !target) return false;
    if (!this.gameStarted) return false;
    if (target.shielded) return false;
    const aMass = attacker.blobs.reduce((s,b)=>s+b.mass,0);
    const tMass = target.blobs.reduce((s,b)=>s+b.mass,0);
    return aMass > tMass * 1.12;
  },
  
  onPlayerJoin(player, gs) {
    // Assigned to a slot in the lobby
  },
  
  onPlayerDeath(player, gs) {
    if (this.gameStarted) {
        const mass = player.blobs ? player.blobs.reduce((s,b)=>s+b.mass,0) : 0;
        this.placements.unshift({ name: player.name, kills: player.kills || 0, massAtDeath: Math.floor(mass) });
    }
  },
  
  onTick(gs, delta) {
    const now = gs.gameTime || 0;
    gs.gameTime = (gs.gameTime || 0) + delta;
    
    if (!this.gameStarted) {
        this.lobbyTimer -= delta;
        const humanPlayers = Object.values(gs.players).filter(p => !p.isBot).length;
        if (this.lobbyTimer <= 0 || humanPlayers >= 8) {
            this.gameStarted = true;
            this.startTime = Date.now();
        }
        return;
    }
    
    // Zone Shrinking
    const currentPhase = this.phases[this.zone.phase];
    if (currentPhase && now >= currentPhase.startTime) {
        this.zone.shrinkSpeed = currentPhase.speed;
        this.zone.radius -= this.zone.shrinkSpeed * (delta / 1000);
        if (this.zone.radius <= currentPhase.endRadius) {
            this.zone.radius = currentPhase.endRadius;
            this.zone.phase++;
        }
    }
    
    // Zone Damage
    for (const pid in gs.players) {
        const p = gs.players[pid];
        if (!p.blobs) continue;
        const b = p.blobs[0];
        const dist = Math.hypot(b.x - this.zone.centerX, b.z - this.zone.centerZ);
        if (dist > this.zone.radius) {
            for (let i = p.blobs.length - 1; i >= 0; i--) {
                const bl = p.blobs[i];
                bl.mass -= 5 * (delta / 1000); // 5 mass per second damage
                if (bl.mass < 15) {
                    p.blobs.splice(i, 1);
                }
            }
            if (p.blobs.length === 0) {
                gs.removePlayer(p.id);
                // The dead event is now handled by removePlayer or a separate emit in server.js
                // But for immediate feedback:
                if (typeof io !== 'undefined') io.to(p.id).emit('dead', { killedBy: 'THE ZONE', rank: this.placements.length + 1 });
            }
        }
        // Normal decay
        for (const bl of p.blobs) bl.mass *= this.massDecay;
    }
  },
  
  checkWinCondition(gs) {
    if (!this.gameStarted) return null;
    const playersAlive = Object.values(gs.players).filter(p => p.blobs && p.blobs.length > 0);
    if (playersAlive.length === 1) {
        const winner = playersAlive[0];
        const mass = winner.blobs.reduce((s,b)=>s+b.mass,0);
        this.placements.unshift({ name: winner.name, kills: winner.kills || 0, massAtDeath: Math.floor(mass) });
        return { winner: winner, type: 'BATTLE_ROYALE_VICTORY', placements: this.placements };
    }
    return null;
  }
};

if (typeof module !== 'undefined') {
  module.exports = BattleRoyale;
}
