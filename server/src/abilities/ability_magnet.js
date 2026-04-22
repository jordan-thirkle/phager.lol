const MAGNET_COOLDOWN = 22000;
const MAGNET_DURATION = 3000;

export default {
    name: 'MAGNET',
    cooldownMs: MAGNET_COOLDOWN,
    durationMs: MAGNET_DURATION,
    onActivate(player, AppState) {
        player.magnetActive = true;
    },
    onTick(player, AppState, dt) {
        if (!player.blobs || !player.blobs.length) return;
        const b = player.blobs[0];
        const radius = Math.pow(b.mass, 0.45) * 2.2;
        const magnetRadius = radius * 8;
        
        // Use AppState.getNearbyCells if available
        const nearby = AppState.getNearbyCells ? AppState.getNearbyCells(b.x, b.z) : [];
        for (const cell of nearby) {
            for (const f of cell.foods) {
                const dx = b.x - f.x;
                const dz = b.z - f.z;
                const dist = Math.hypot(dx, dz);
                if (dist < magnetRadius && dist > 5) {
                    const pull = 12; // 12 units per tick as per Task 1
                    f.x += (dx / dist) * pull;
                    f.z += (dz / dist) * pull;
                }
            }
        }
    },
    onExpire(player, AppState) {
        player.magnetActive = false;
    }
};
