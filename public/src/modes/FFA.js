const FFA = {
  name: 'FREE FOR ALL',
  arenaSize: { x: 3000, z: 3000 },
  massDecay: 0.9997,
  speedMultiplier: 1.0,
  
  canEat(attacker, target) {
    if (target.shielded) return false;
    const aMass = attacker.blobs.reduce((s,b)=>s+b.mass,0);
    const tMass = target.blobs.reduce((s,b)=>s+b.mass,0);
    return aMass > tMass * 1.12;
  },
  
  onPlayerJoin(player, gs) {
    // No special join logic for FFA
  },
  
  onPlayerDeath(player, gs) {
    // FFA death logic is standard: blobs are removed, mass can be dropped as food
  },
  
  onTick(gs, delta) {
    // Apply decay to all players
    for (const pid in gs.players) {
        const p = gs.players[pid];
        if (!p.blobs) continue;
        for (const b of p.blobs) {
            b.mass *= this.massDecay;
        }
    }
  },
  
  checkWinCondition(gs) {
    const players = Object.values(gs.players);
    if (players.length === 0) return null;
    const leader = players.sort((a,b) => {
        const am = a.blobs ? a.blobs.reduce((s,bl)=>s+bl.mass,0) : 0;
        const bm = b.blobs ? b.blobs.reduce((s,bl)=>s+bl.mass,0) : 0;
        return bm - am;
    })[0];
    const leaderMass = leader.blobs ? leader.blobs.reduce((s,bl)=>s+bl.mass,0) : 0;
    if (leaderMass >= 10000) return { winner: leader, type: 'CHAMPION' };
    return null;
  }
};

if (typeof module !== 'undefined') {
  module.exports = FFA;
}
