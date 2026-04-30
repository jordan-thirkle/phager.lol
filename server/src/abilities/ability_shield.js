const SHIELD_COOLDOWN = 18000;
const SHIELD_DURATION = 4000;

export default {
    name: 'SHIELD',
    cooldownMs: SHIELD_COOLDOWN,
    durationMs: SHIELD_DURATION,
    onActivate(player, AppState) {
        player.shielded = true;
    },
    onExpire(player, AppState) {
        player.shielded = false;
    }
};
