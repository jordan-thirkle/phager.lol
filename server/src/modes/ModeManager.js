class ModeManager {
  constructor(mode) { 
    this.mode = mode; 
  }

  getArenaSize()             { return this.mode.arenaSize || { x: 3000, z: 3000 }; }
  getMassDecay()             { return this.mode.massDecay || 0.9997; }
  getSpeedMultiplier()       { return this.mode.speedMultiplier || 1.0; }
  canEat(attacker, target)   { return this.mode.canEat ? this.mode.canEat(attacker, target) : (attacker.totalMass > target.totalMass * 1.12); }
  onPlayerJoin(player, gs)   { if (this.mode.onPlayerJoin) this.mode.onPlayerJoin(player, gs); }
  onPlayerDeath(player, gs)  { if (this.mode.onPlayerDeath) this.mode.onPlayerDeath(player, gs); }
  onTick(gameState, delta)   { if (this.mode.onTick) this.mode.onTick(gameState, delta); }
  checkWinCondition(gs)      { return this.mode.checkWinCondition ? this.mode.checkWinCondition(gs) : null; }
  
  getModeName() { return this.mode.name || 'Unknown'; }
}

export default ModeManager;
