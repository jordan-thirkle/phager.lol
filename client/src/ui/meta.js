// ─── PHAGE.LOL Meta / Persistence System ───

const DEFAULTS = {
  version: 3,
  name: "Player",
  totalGames: 0,
  bestBiomass: 0,
  totalKills: 0,
  totalXP: 0,
  totalTimePlayed: 0, 
  level: 1,
  achievements: [],
  unlockedSkins: ["solid"],
  unlockedAbilities: ["SHIELD", "DASH", "MAGNET"],
  modeStats: {
    ffa: { kills: 0, games: 0, wins: 0, bestMass: 0 },
    team: { kills: 0, games: 0, wins: 0, bestMass: 0 },
    br: { kills: 0, games: 0, wins: 0, bestMass: 0 }
  },
  loadout: {
    skin: "solid",
    primaryColor: "#00BFFF",
    ability: "SHIELD",
    title: "SPAWN"
  },
  settings: {
    masterVolume: 0.8,
    mouseSteer: true,
    glowLayer: true,
    gridLayer: true,
    particles: true,
    nameTags: true,
    colorblindMode: false,
    keybinds: { split: "Space", boost: "ShiftLeft", ability: "KeyQ" }
  }
};

let data = JSON.parse(JSON.stringify(DEFAULTS));
let sessionStartTime = Date.now();
let saveTimeout = null;

const XP_THRESHOLDS = [0, 100, 250, 500, 900, 1600, 2300, 3000, 3700, 4400, 5100];
for (let i = 11; i <= 50; i++) {
  const prev = XP_THRESHOLDS[i - 1];
  const inc = i < 20 ? 1500 : 3000;
  XP_THRESHOLDS.push(prev + inc);
}

function load() {
  try {
    const saved = localStorage.getItem('phage_meta') || localStorage.getItem('blobz_meta');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.version < 3) {
          data = Object.assign({}, DEFAULTS, parsed);
          data.version = 3;
      } else {
          data = parsed;
      }
    }
  } catch (e) {
    console.warn("Failed to load meta, resetting to defaults", e);
    data = JSON.parse(JSON.stringify(DEFAULTS));
  }
  return data;
}

function save() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    localStorage.setItem('phage_meta', JSON.stringify(data));
    saveTimeout = null;
  }, 500);
}

export const MetaSystem = {
  init() { load(); },
  getData() { return data; },
  load,
  save,
  addXP(amt, HudSystem) {
    data.totalXP += amt;
    let newLvl = data.level;
    while (XP_THRESHOLDS[newLvl] && data.totalXP >= XP_THRESHOLDS[newLvl]) {
      newLvl++;
    }
    if (newLvl > data.level) {
      data.level = newLvl;
      if (HudSystem && HudSystem.onLevelUp) HudSystem.onLevelUp(newLvl);
      if (newLvl >= 10 && !data.unlockedAbilities.includes("DECOY")) {
          data.unlockedAbilities.push("DECOY");
      }
    }
    save();
  },
  recordGame({ mass, kills, mode, won = false }) {
    data.totalGames++;
    data.totalKills += kills;
    if (mass > data.bestBiomass) data.bestBiomass = mass;
    
    const m = mode || 'ffa';
    if (data.modeStats[m]) {
        data.modeStats[m].games++;
        data.modeStats[m].kills += kills;
        if (mass > data.modeStats[m].bestMass) data.modeStats[m].bestMass = mass;
        if (won) data.modeStats[m].wins++;
    }
    
    const sessionSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);
    data.totalTimePlayed += sessionSeconds;
    sessionStartTime = Date.now();
    
    save();
  },
  unlockAchievement(id, HudSystem) {
    if (data.achievements.includes(id)) return;
    data.achievements.push(id);
    if (HudSystem && HudSystem.onAchievement) HudSystem.onAchievement(id, window.AudioEngine, window.ParticleSystem, window.AppState);
    save();
  },
  getSetting(key) { return data.settings[key] === undefined ? DEFAULTS.settings[key] : data.settings[key]; },
  setSetting(key, val) {
    data.settings[key] = val;
    save();
  },
  getLoadout() { return data.loadout; },
  setLoadout(partial) {
    Object.assign(data.loadout, partial);
    save();
  },
  getLevelInfo(xp) {
      let lvl = 1;
      while (XP_THRESHOLDS[lvl] && xp >= XP_THRESHOLDS[lvl]) lvl++;
      const currentXP = xp - (XP_THRESHOLDS[lvl - 1] || 0);
      const nextXP = (XP_THRESHOLDS[lvl] || (XP_THRESHOLDS[lvl - 1] + 5000)) - (XP_THRESHOLDS[lvl - 1] || 0);
      return { level: lvl, progress: Math.min(1, currentXP / nextXP) };
  }
};
