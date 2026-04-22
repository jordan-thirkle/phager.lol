import shield from './ability_shield.js';
import magnet from './ability_magnet.js';
import dash from './ability_dash.js';
import decoy from './ability_decoy.js';

const ABILITIES = {
    SHIELD: shield,
    MAGNET: magnet,
    DASH: dash,
    DECOY: decoy
};

export const AbilitySystem = {
    tryActivate(socketId, AppState) {
        const p = AppState.players[socketId];
        if (!p) return false;
        
        const abilityData = AppState.abilities.get(socketId);
        if (!abilityData || abilityData.remainingMs > 0 || abilityData.active) return false;
        
        const ability = ABILITIES[abilityData.ability];
        if (!ability) return false;
        
        abilityData.active = true;
        abilityData.activeDuration = ability.durationMs;
        abilityData.remainingMs = ability.cooldownMs;
        
        if (ability.onActivate) ability.onActivate(p, AppState);
        
        return true;
    },
    
    tick(AppState, dtMs) {
        const dt = dtMs / 1000;
        
        for (const [socketId, data] of AppState.abilities) {
            const p = AppState.players[socketId];
            if (!p) {
                AppState.abilities.delete(socketId);
                continue;
            }
            
            if (data.remainingMs > 0) {
                data.remainingMs -= dtMs;
                if (data.remainingMs < 0) data.remainingMs = 0;
            }
            
            if (data.active) {
                data.activeDuration -= dtMs;
                const ability = ABILITIES[data.ability];
                if (ability && ability.onTick) ability.onTick(p, AppState, dt);
                
                if (data.activeDuration <= 0) {
                    data.active = false;
                    if (ability && ability.onExpire) ability.onExpire(p, AppState);
                }
            }
        }
        
        // Update decoys
        const now = Date.now();
        AppState.decoys = AppState.decoys.filter(d => d.expiresAt > now);
    },
    
    getAbility(name) {
        return ABILITIES[name];
    }
};
