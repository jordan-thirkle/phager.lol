const SHIELD_COOLDOWN = 18000;
const SHIELD_DURATION = 4000;

module.exports = {
    name: 'SHIELD',
    cooldownMs: SHIELD_COOLDOWN,
    durationMs: SHIELD_DURATION,
    onActivate(player, AppState) {
        player.shielded = true;
    },
    onTick(player, AppState, remainingMs) {
        // No-op for shield
    },
    onExpire(player, AppState) {
        player.shielded = false;
    }
};
