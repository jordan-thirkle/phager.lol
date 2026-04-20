const DASH_COOLDOWN = 12000;
const DASH_DURATION = 300;

module.exports = {
    name: 'DASH',
    cooldownMs: DASH_COOLDOWN,
    durationMs: DASH_DURATION,
    onActivate(player, AppState) {
        if (!player.blobs || !player.blobs.length) return;
        
        // Find largest blob
        let largest = player.blobs[0];
        for (const b of player.blobs) {
            if (b.mass > largest.mass) largest = b;
        }
        
        const totalMass = player.blobs.reduce((s,b)=>s+b.mass,0);
        const baseSpeed = 220; // BASE_SPEED from server.js
        const speed = baseSpeed * Math.pow(totalMass / player.blobs.length, -0.22);
        
        const dx = player.input ? player.input.dx : 1;
        const dz = player.input ? player.input.dz : 0;
        const len = Math.hypot(dx, dz) || 1;
        
        largest.dashVelocityX = (dx / len) * speed * 15;
        largest.dashVelocityZ = (dz / len) * speed * 15;
        player.dashing = true;
    },
    onTick(player, AppState, dt) {
        if (!player.blobs) return;
        for (const b of player.blobs) {
            if (b.dashVelocityX || b.dashVelocityZ) {
                b.x += (b.dashVelocityX || 0) * (1/20); // 1/20 is approx TICK_MS/1000
                b.z += (b.dashVelocityZ || 0) * (1/20);
                b.dashVelocityX = (b.dashVelocityX || 0) * 0.7;
                b.dashVelocityZ = (b.dashVelocityZ || 0) * 0.7;
            }
        }
    },
    onExpire(player, AppState) {
        player.dashing = false;
        if (player.blobs) {
            for (const b of player.blobs) {
                b.dashVelocityX = 0;
                b.dashVelocityZ = 0;
            }
        }
    }
};
