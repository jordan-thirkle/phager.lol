export const NEON = ['#ff0088','#00ffff','#ffff00','#ff6600','#00ff88','#ff00ff','#88ff00','#0088ff','#ff4488','#ffbb00'];

export const AppState = {
  app: null, 
  socket: null, 
  cameraEnt: null,
  myId: null,
  myScore: 0,
  myKills: 0,
  shakeAmt: 0,
  shakeVec: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
  aberrationAmt: 0,
  flashAmt: 0,
  batchGroups: {},
  myName: '', 
  myColor: NEON[Math.floor(Math.random()*NEON.length)],
  gameActive: false,
  gameStarting: false,
  selectedMode: 'ffa',
  selectedAbility: 'SHIELD',
  gameState: { players: [], leaderboard: [], hallOfFame: [] }, 
  arenaSize: 3000,
  pEnts: {}, 
  fEnts: {}, 
  vEnts: {},
  animTime: 0, 
  cam: { x:0, z:0, h:700 },
  myStats: { xp:0, kills:0, peakMass:0, sessionKills:0 },
  input: { dx:0, dz:0, w:0, a:0, s:0, d:0, split:false, boost:false },
  fpsFrames: 0, 
  fpsTime: 0, 
  lastPingTime: 0, 
  sendTimer: 0,
  uiCache: { leaderboard: '', hof: '' },
  serverStats: null,
  clientSeq: 1, 
  lastProcessedSeq: 0, 
  pendingInputs: [],
  myLocalBlobs: [],
  perfProfile: 'MEDIUM',
  spectating: false,
  spectatingId: null,
  flagOrbEnt: null,
  zoneEnt: null,
  zoneInnerEnt: null
};

export const LS = {
  get(k, def = 0) {
    try {
      const v = localStorage.getItem('phage_' + k) || localStorage.getItem('blobz_' + k);
      return v ? JSON.parse(v) : def;
    } catch {
      return def;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('phage_' + k, JSON.stringify(v));
    } catch {}
  }
};
