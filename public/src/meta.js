const meta = (() => {
  const DEFAULTS = {
    version: 2,
    name: "Player",
    totalGames: 0,
    bestMass: 0,
    totalKills: 0,
    totalXP: 0,
    level: 1,
    achievements: [],
    unlockedSkins: ["solid"],
    unlockedAbilities: ["SHIELD", "DASH", "MAGNET"],
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
  let saveTimeout = null;

  function load() {
    try {
      const saved = localStorage.getItem('blobz_meta');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.version < 2) {
            // Migration logic
            data = Object.assign({}, DEFAULTS, parsed);
            data.version = 2;
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
      localStorage.setItem('blobz_meta', JSON.stringify(data));
      saveTimeout = null;
    }, 500);
  }

  const XP_THRESHOLDS = [0, 100, 250, 500, 900, 1600, 2300, 3000, 3700, 4400, 5100];
  // Generate up to level 50
  for (let i = 11; i <= 50; i++) {
    const prev = XP_THRESHOLDS[i - 1];
    const inc = i < 20 ? 1500 : 3000;
    XP_THRESHOLDS.push(prev + inc);
  }

  return {
    init() { load(); },
    getData() { return data; },
    load,
    save,
    addXP(amt) {
      data.totalXP += amt;
      let newLvl = data.level;
      while (XP_THRESHOLDS[newLvl] && data.totalXP >= XP_THRESHOLDS[newLvl]) {
        newLvl++;
      }
      if (newLvl > data.level) {
        data.level = newLvl;
        if (window.HudSystem && window.HudSystem.onLevelUp) window.HudSystem.onLevelUp(newLvl);
        if (newLvl >= 10 && !data.unlockedAbilities.includes("DECOY")) {
            data.unlockedAbilities.push("DECOY");
        }
      }
      save();
    },
    recordGame({ mass, kills }) {
      data.totalGames++;
      data.totalKills += kills;
      if (mass > data.bestMass) data.bestMass = mass;
      save();
    },
    unlockAchievement(id) {
      if (data.achievements.includes(id)) return;
      data.achievements.push(id);
      if (window.HudSystem && window.HudSystem.onAchievement) window.HudSystem.onAchievement(id);
      save();
    },
    getSetting(key) { return data.settings[key]; },
    setSetting(key, val) {
      data.settings[key] = val;
      save();
    },
    getLoadout() { return data.loadout; },
    setLoadout(partial) {
      Object.assign(data.loadout, partial);
      save();
    }
  };
})();

if (typeof module !== 'undefined') module.exports = meta;
window.MetaSystem = meta;
