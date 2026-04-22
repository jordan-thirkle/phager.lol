const TeamArena = {
  name: 'TEAM ARENA',
  arenaSize: { x: 3000, z: 3000 },
  massDecay: 0.9997,
  speedMultiplier: 1.0,
  redCount: 0,
  blueCount: 0,
  timer: 300000, // 5 minutes in ms
  flagOrb: { x: 0, z: 0, carrier: null, lastHeldTeam: null, dropTime: 0 },
  
  canEat(attacker, target) {
    if (!attacker || !target) return false;
    if (attacker.team === target.team) return false;
    if (target.shielded) return false;
    const aMass = attacker.blobs.reduce((s,b)=>s+b.mass,0);
    const tMass = target.blobs.reduce((s,b)=>s+b.mass,0);
    return aMass > tMass * 1.12;
  },
  
  onPlayerJoin(player, gs) {
    if (this.redCount <= this.blueCount) {
        player.team = 'red';
        this.redCount++;
    } else {
        player.team = 'blue';
        this.blueCount++;
    }
  },
  
  onPlayerDeath(player, gs) {
    if (player.team === 'red') this.redCount--;
    else this.blueCount--;
    
    if (this.flagOrb.carrier === player.id) {
        this.flagOrb.carrier = null;
        this.flagOrb.lastHeldTeam = player.team;
        this.flagOrb.dropTime = Date.now();
        const b = player.blobs[0];
        if (b) { this.flagOrb.x = b.x; this.flagOrb.z = b.z; }
    }
  },
  
  onTick(gs, delta) {
    this.timer -= delta;
    if (this.timer < 0) this.timer = 0;
    
    // Decay and XP/Mass for carrier and team
    const carrierTeam = (this.flagOrb.carrier && gs.players[this.flagOrb.carrier]) ? gs.players[this.flagOrb.carrier].team : null;
    
    for (const pid in gs.players) {
        const p = gs.players[pid];
        if (!p.blobs) continue;
        for (const b of p.blobs) {
            b.mass *= this.massDecay;
            if (carrierTeam && p.team === carrierTeam) b.mass += 0.2; 
        }
        if (this.flagOrb.carrier === pid) {
            p.xp += 5;
        }
    }
    
    // Flag Orb interaction
    if (!this.flagOrb.carrier && Date.now() - this.flagOrb.dropTime > 3000) {
        for (const pid in gs.players) {
            const p = gs.players[pid];
            if (!p.blobs || !p.blobs[0]) continue;
            const b = p.blobs[0];
            const dist = Math.hypot(b.x - this.flagOrb.x, b.z - this.flagOrb.z);
            const radius = Math.pow(b.mass, 0.45) * 2.2;
            if (dist < radius + 20) {
                this.flagOrb.carrier = pid;
                this.flagOrb.lastHeldTeam = p.team;
            }
        }
    } else if (this.flagOrb.carrier) {
        const p = gs.players[this.flagOrb.carrier];
        if (p && p.blobs && p.blobs[0]) {
            this.flagOrb.x = p.blobs[0].x;
            this.flagOrb.z = p.blobs[0].z;
        } else {
            this.flagOrb.carrier = null;
            this.flagOrb.dropTime = Date.now();
        }
    }
  },
  
  checkWinCondition(gs) {
    if (this.timer <= 0) {
        let redMass = 0, blueMass = 0;
        for (const pid in gs.players) {
            const p = gs.players[pid];
            const mass = p.blobs ? p.blobs.reduce((s,b)=>s+b.mass,0) : 0;
            if (p.team === 'red') redMass += mass;
            else blueMass += mass;
        }
        const winningTeam = this.flagOrb.lastHeldTeam || (redMass > blueMass ? 'red' : 'blue');
        return { winner: winningTeam, type: 'TEAM_VICTORY' };
    }
    return null;
  }
};

export default TeamArena;
