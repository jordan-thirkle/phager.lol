const DECOY_COOLDOWN = 25000;
const DECOY_DURATION = 6000;

export default {
    name: 'DECOY',
    cooldownMs: DECOY_COOLDOWN,
    durationMs: DECOY_DURATION,
    onActivate(player, AppState) {
        if (!player.blobs || !player.blobs.length) return;
        const totalMass = player.blobs.reduce((s,b)=>s+b.mass,0);
        const b = player.blobs[0];
        
        const decoy = {
            id: `decoy_${player.id}_${Date.now()}`,
            x: b.x,
            z: b.z,
            mass: totalMass,
            isDecoy: true,
            ownerId: player.id,
            color: player.color,
            expiresAt: Date.now() + DECOY_DURATION
        };
        
        AppState.decoys.push(decoy);
    }
};
