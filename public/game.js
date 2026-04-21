// ─── PHAGE.LOL game.js (v2 Modular) ────────────────────────────
console.log('📦 GAME.JS LOADED');
var ARENA = 3000;
var NEON = ['#ff0088','#00ffff','#ffff00','#ff6600','#00ff88','#ff00ff','#88ff00','#0088ff','#ff4488','#ffbb00'];

var gridLines = [];
var AppState = {
  app: null, socket: null, cameraEnt: null,
  myId: null,
  myScore: 0,
  myKills: 0,
  shakeAmt: 0,
  shakeVec: new pc.Vec3(),
  aberrationAmt: 0,
  batchGroups: {},
  myName: '', myColor: NEON[Math.floor(Math.random()*NEON.length)],
  gameActive: false,
  gameState: { players: [], leaderboard: [] }, arenaSize: 3000,
  pEnts: {}, fEnts: {}, vEnts: {},
  animTime: 0, cam: { x:0, z:0, h:700 },
  myStats: { xp:0, kills:0, peakMass:0, sessionKills:0 },
  input: { dx:0, dz:0, w:0, a:0, s:0, d:0, split:false, boost:false },
  fpsFrames: 0, fpsTime: 0, lastPingTime: 0, sendTimer: 0
};

// ─── STARTUP CHECK ───────────────────────────────────────────
function checkLibraries(onReady) {
  let attempts = 0;
  const check = setInterval(() => {
    attempts++;
    const ready = (typeof pc !== 'undefined') && (typeof MessagePack !== 'undefined') && (typeof io !== 'undefined');
    if (ready) {
      clearInterval(check);
      console.log('✅ ALL LIBRARIES READY (Attempt '+attempts+')');
      onReady();
    } else if (attempts > 100) {
      clearInterval(check);
      console.error('❌ LIBRARY LOAD TIMEOUT: pc='+(typeof pc)+', msgpack='+(typeof MessagePack)+', io='+(typeof io));
    }
  }, 100);
}

// ─── ENTRY POINTS ─────────────────────────────────────────────
window.onload = () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('portal') === 'true') {
      const name = params.get('username') || 'PORTAL_CELL';
      const color = params.get('color') || '#00ffff';
      const input = document.getElementById('nameInput');
      if (input) input.value = name;
      AppState.myName = name;
      AppState.myColor = color;
      setTimeout(() => window.startGame(), 1000); 
  }
};

window.startGame = function() {
  checkLibraries(() => {
    console.log('▶️ STARTING GAME...');
    const nameEl = document.getElementById('nameInput');
    AppState.myName = (nameEl ? nameEl.value.trim() : 'PLAYER').toUpperCase().slice(0,16);
    LS.set('name', AppState.myName);
    
    const homeEl = document.getElementById('home-layout');
    if (homeEl) homeEl.style.display = 'none';

    // Pre-match briefing countdown
    const overlay = document.createElement('div');
    overlay.style = 'position:fixed; inset:0; display:flex; align-items:center; justify-content:center; font-family:Orbitron; font-size:100px; color:var(--cyan); z-index:10000; text-shadow:0 0 50px var(--cyan); pointer-events:none; font-weight:900;';
    document.body.appendChild(overlay);
    let count = 3;
    const timer = setInterval(() => {
        overlay.textContent = count > 0 ? count : 'INFECT!';
        if (count < 0) {
            clearInterval(timer);
            document.body.removeChild(overlay);
        }
        count--;
    }, 600);

    
    AppState.perfProfile = detectPerformanceProfile();
    if (typeof MetaSystem !== 'undefined' && MetaSystem.init) MetaSystem.init();
    if (typeof Audio !== 'undefined' && Audio.init) { Audio.init(); Audio.resume(); }
    initPC(); connectSocket();
    
    console.log('🚀 Emitting JOIN for', AppState.myName);
    AppState.socket.emit('join', MessagePack.encode({ 
        name: AppState.myName, 
        color: AppState.myColor,
        mode: AppState.selectedMode || 'ffa',
        ability: AppState.selectedAbility || 'SHIELD'
    }));
  });
}

window.selectMode = function(mode, el) {
    AppState.selectedMode = mode;
    document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
};

window.respawn = function() {
  const deadEl = document.getElementById('dead');
  if (deadEl) deadEl.style.display = 'none';
  AppState.socket.emit('respawn', MessagePack.encode({ 
      name: AppState.myName, 
      color: AppState.myColor,
      mode: AppState.selectedMode || 'ffa',
      ability: AppState.selectedAbility || 'SHIELD'
  }));
}
window.toggleFullscreen = function() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else if (document.exitFullscreen) document.exitFullscreen();
}
console.log('✅ startGame/respawn/fullscreen defined');

// ─── INITIAL LOAD SEQUENCE ────────────────────────────────────
function onInitialLoad() {
  console.log('🏁 Initializing Game Systems...');
  loadStartStats();
  console.log('✅ Stats Loaded');
  initSettingsListeners();
  if (typeof initHowItWasMade === 'function') initHowItWasMade();
  
  // Create socket immediately to support Home Chat
  connectSocket();
  console.log('✅ Systems Ready');
  
  const nameInput = document.getElementById('nameInput');
  if (nameInput) nameInput.addEventListener('keydown',e=>{ if(e.key==='Enter') window.startGame(); });
}

// ─── STATS (localStorage) ────────────────────────────────────
const LS = {
  get(k,def=0){ try{ return JSON.parse(localStorage.getItem('blobz_'+k))??def; }catch{ return def; } },
  set(k,v){ try{ localStorage.setItem('blobz_'+k,JSON.stringify(v)); }catch{} }
};

function loadStartStats() {
  const meta = (typeof MetaSystem !== 'undefined') ? window.MetaSystem.getData() : { totalXP: 0, bestMass: 0 };
  const levelData = (typeof MetaSystem !== 'undefined') ? window.MetaSystem.getLevelInfo(meta.totalXP) : { level: 1, progress: 0 };
  
  const elXp = document.getElementById('ss_xp');
  const elLevel = document.getElementById('ss_level');
  const elKills = document.getElementById('ss_kills');
  const elXpFill = document.getElementById('ss_xp_fill');
  const elName = document.getElementById('nameInput');

  if (elXp) elXp.textContent = meta.totalXP;
  if (elLevel) elLevel.textContent = levelData.level;
  if (elKills) elKills.textContent = meta.bestMass; // Showing best mass as "Best" stat
  if (elXpFill) elXpFill.style.width = (levelData.progress * 100) + '%';
  
  const savedName = LS.get('name','');
  if (savedName && elName) elName.value = savedName;
}

// ─── DEV SETTINGS ─────────────────────────────────────────────
function initSettingsListeners() {
  const chkGlow = document.getElementById('chkGlow');
  if (chkGlow) chkGlow.addEventListener('change', e => {
    for(const k in AppState.pEnts) {
      if(AppState.pEnts[k].ent.children[0]) AppState.pEnts[k].ent.children[0].enabled = e.target.checked;
    }
  });
  const chkGrid = document.getElementById('chkGrid');
  if (chkGrid) chkGrid.addEventListener('change', e => {
    gridLines.forEach(l => l.enabled = e.target.checked);
  });
}

// ─── HELPERS ──────────────────────────────────────────────────
function massToRadius(m){ return Math.pow(m, 0.45) * 2.2; }
function hexToRgb01(hex){
  return { r:parseInt(hex.slice(1,3),16)/255, g:parseInt(hex.slice(3,5),16)/255, b:parseInt(hex.slice(5,7),16)/255 };
}
function shake(amt){ AppState.shakeAmt = Math.max(AppState.shakeAmt, amt); }

// ─── PLAYCANVAS INIT ──────────────────────────────────────────
function initPC() {
  const canvas = document.getElementById('c');
  const app = new pc.Application(canvas, {
      mouse: new pc.Mouse(canvas),
      touch: !!('ontouchstart' in window) ? new pc.TouchDevice(canvas) : null,
      keyboard: new pc.Keyboard(window),
      elementInput: new pc.ElementInput(canvas)
  });
  AppState.app = app;
  AppState.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  AppState.app.setCanvasResolution(pc.RESOLUTION_AUTO);

  AppState.cameraEnt = new pc.Entity('cam');
  AppState.cameraEnt.addComponent('camera', { clearColor:new pc.Color(0.02,0.02,0.07), nearClip:0.5, farClip:9000, fov:62 });
  AppState.cameraEnt.setPosition(0,700,0); AppState.cameraEnt.setEulerAngles(-90,0,0);
  AppState.app.root.addChild(AppState.cameraEnt);

  const dl = new pc.Entity('dl');
  dl.addComponent('light',{ type:'directional', color:new pc.Color(0.8,0.85,1.0), intensity:1.2 });
  dl.setEulerAngles(55,30,0); AppState.app.root.addChild(dl);
  AppState.app.scene.ambientLight = new pc.Color(0.05,0.06,0.18);

  Particles.init(AppState.app); MinimapSystem.init(); InputSystem.init(AppState);

  // Optimized Batching
  const foodGroup = AppState.app.batcher.addGroup("Food", true, 1000);
  const virusGroup = AppState.app.batcher.addGroup("Viruses", true, 100);
  AppState.batchGroups = { food: foodGroup.id, virus: virusGroup.id };


  if (typeof initVibeJamPortals !== 'undefined') {
    initVibeJamPortals({
      scene: AppState.app.root,
      getPlayer: () => {
          const me = AppState.gameState.players.find(p => p && p.id === AppState.myId);
          if (me && AppState.pEnts[me.id]) return AppState.pEnts[me.id];
          return null;
      },
      spawnPoint:   { x: 0, y: 0, z: 0 },
      exitPosition: { x: -AppState.arenaSize*0.4, y: 10, z: -AppState.arenaSize*0.4 },
      onExit: () => {
          const me = AppState.gameState.players.find(p => p && p.id === AppState.myId);
          const mass = me ? me.blobs.reduce((s,b)=>s+b.mass,0) : 100;
          const url = new URL('https://vibej.am/portal/2026');
          url.searchParams.set('username', AppState.myName);
          url.searchParams.set('color', AppState.myColor);
          url.searchParams.set('ref', 'phage.lol');
          url.searchParams.set('hp', Math.min(100, Math.floor(mass / 10)));
          window.location.href = url.toString();
      }
    });
  }

  AppState.app.on('update', dt => { 
    if (typeof animateVibeJamPortals !== 'undefined') animateVibeJamPortals(dt);
    if (AppState.perfProfile !== 'LOW') {
        Particles.update(dt);
    }
    
    // Shake & VFX
    if (AppState.shakeAmt > 0) {
        AppState.shakeAmt -= dt * 40;
        if (AppState.shakeAmt < 0) AppState.shakeAmt = 0;
        AppState.shakeVec.set((Math.random()-0.5)*AppState.shakeAmt, (Math.random()-0.5)*AppState.shakeAmt, (Math.random()-0.5)*AppState.shakeAmt);
    }
    
    if (AppState.aberrationAmt > 0) {
        AppState.aberrationAmt -= dt * 2;
        if (AppState.aberrationAmt < 0) AppState.aberrationAmt = 0;
        const scan = document.getElementById('vfx-scanlines');
        if (scan) scan.style.filter = `contrast(${1 + AppState.aberrationAmt*0.5}) brightness(${1 + AppState.aberrationAmt*0.2})`;
    }

    if (AppState.cameraEnt) {
        let targetX = AppState.cam.x, targetZ = AppState.cam.z;
        
        // Follow leader if dead
        if (!AppState.gameActive && AppState.spectatingId) {
            const spec = AppState.gameState.players.find(p => p.id === AppState.spectatingId);
            if (spec && spec.blobs && spec.blobs[0]) {
                targetX = spec.blobs[0].x;
                targetZ = spec.blobs[0].z;
            }
        }

        const camPos = AppState.cam.pos || new pc.Vec3(0,700,0);
        // Smooth pan toward target
        AppState.cam.x += (targetX - AppState.cam.x) * (5 * dt);
        AppState.cam.z += (targetZ - AppState.cam.z) * (5 * dt);
        
        AppState.cameraEnt.setPosition(AppState.cam.x + AppState.shakeVec.x, 700 + AppState.shakeVec.y, AppState.cam.z + AppState.shakeVec.z);
    }

    window.HudSystem.updateCombatPopups(AppState.cameraEnt, AppState.app);

    // Culling & Lerp entities
    const camPos = AppState.cam.pos || new pc.Vec3(0,700,0);
    const CULL_DIST_SQ = 1200 * 1200; // Only render food within this radius

    for (const fid in AppState.fEnts) {
        const ent = AppState.fEnts[fid];
        const distSq = ent.getPosition().distanceSq(camPos);
        ent.enabled = (distSq < CULL_DIST_SQ);
    }
    
    if(AppState.gameActive) gameLoop(dt); 
  });
  AppState.app.start();
}

function clearGame() {
    AppState.gameActive = false;
    // Destroy player entities
    for (const id in AppState.pEnts) {
        if (AppState.pEnts[id].ent) AppState.pEnts[id].ent.destroy();
    }
    AppState.pEnts = {};
    // Destroy food
    for (const id in AppState.fEnts) {
        if (AppState.fEnts[id]) AppState.fEnts[id].destroy();
    }
    AppState.fEnts = {};
    // Destroy viruses
    for (const id in AppState.vEnts) {
        if (AppState.vEnts[id]) AppState.vEnts[id].destroy();
    }
    AppState.vEnts = {};
    
    // Clear nametags
    const nt = document.getElementById('nametags');
    if (nt) nt.innerHTML = '';
}

var arenaBuilt = false;
function buildArena() {
  if (arenaBuilt) return;
  arenaBuilt = true;
  const size = AppState.arenaSize || 3000;
  const fe = new pc.Entity('floor'); fe.addComponent('model',{type:'plane'}); fe.setLocalScale(size,1,size);
  const fm = new pc.StandardMaterial(); fm.diffuse=new pc.Color(0.02,0.02,0.06); fm.emissive=new pc.Color(0.01,0.01,0.04); fm.update();
  fe.model.meshInstances[0].material=fm; AppState.app.root.addChild(fe);

  const fe2 = new pc.Entity('floor2'); fe2.addComponent('model',{type:'plane'}); fe2.setLocalScale(size*2.5,1,size*2.5);
  const fm2 = new pc.StandardMaterial(); fm2.diffuse=new pc.Color(0.01,0.01,0.03); fm2.update();
  fe2.model.meshInstances[0].material=fm2; fe2.setPosition(0,-2,0); AppState.app.root.addChild(fe2);

  const gm = new pc.StandardMaterial(); gm.emissive=new pc.Color(0.0,0.12,0.38); gm.emissiveIntensity=1.2; gm.update();
  const step=150, half=size/2;
  for(let i=-half;i<=half;i+=step){
    const vl=new pc.Entity();vl.addComponent('model',{type:'box'});vl.setLocalScale(1.5,2,size);vl.setPosition(i,1.5,0);vl.model.meshInstances[0].material=gm;AppState.app.root.addChild(vl);
    const hl=new pc.Entity();hl.addComponent('model',{type:'box'});hl.setLocalScale(size,2,1.5);hl.setPosition(0,1.5,i);hl.model.meshInstances[0].material=gm;AppState.app.root.addChild(hl);
    gridLines.push(vl, hl);
  }

  const wm=new pc.StandardMaterial();wm.emissive=new pc.Color(0.0,0.5,1.0);wm.emissiveIntensity=3;wm.update();
  [[0,100,half,size,200,8],[0,100,-half,size,200,8],[half,100,0,8,200,size],[-half,100,0,8,200,size]].forEach(([x,y,z,w,h,d])=>{
    const w2=new pc.Entity();w2.addComponent('model',{type:'box'});w2.setPosition(x,y,z);w2.setLocalScale(w,h,d);w2.model.meshInstances[0].material=wm;AppState.app.root.addChild(w2);
  });
  
  const sm=new pc.StandardMaterial();sm.emissive=new pc.Color(0.4,0.4,1);sm.emissiveIntensity=4;sm.update();
  for(let i=0;i<150;i++){
    const s=new pc.Entity();s.addComponent('model',{type:'sphere'});
    s.setPosition((Math.random()-0.5)*size*1.5,(Math.random()*200)+50,(Math.random()-0.5)*size*1.5);
    const sz=Math.random()*3+1;s.setLocalScale(sz,sz,sz);
    s.model.meshInstances[0].material=sm;AppState.app.root.addChild(s);
  }
}

// ─── ENTITY MANAGEMENT ───────────────────────────────────────
function makeMat(color, intensity=2) {
  const c=hexToRgb01(color), mat=new pc.StandardMaterial();
  mat.diffuse=new pc.Color(c.r*0.2,c.g*0.2,c.b*0.2);
  mat.emissive=new pc.Color(c.r,c.g,c.b); mat.emissiveIntensity=intensity;
  mat.useMetalness=true; mat.metalness=0.3; mat.gloss=0.8; mat.update();
  return mat;
}

function getOrMakeBlobEnt(key, pid, color) {
  if (AppState.pEnts[key]) return AppState.pEnts[key];
  const e=new pc.Entity(`pb_${key}`); e.addComponent('model',{type:'sphere'});
  const mat=makeMat(color,2.2);
  const tex=Skins.getTexture(AppState.app,pid,color);
  mat.diffuseMap=tex; mat.emissiveMap=tex; mat.update();
  e.model.meshInstances[0].material=mat;
  const gl=new pc.Entity(); const c=hexToRgb01(color);
  gl.addComponent('light',{type:'point',color:new pc.Color(c.r,c.g,c.b),intensity:5,range:180});
  e.addChild(gl); AppState.app.root.addChild(e);
  AppState.pEnts[key]={ent:e,tx:0,ty:0,tz:0, color: color}; return AppState.pEnts[key];
}

var foodMatCache = {};
function getOrMakeFoodEnt(id, color) {
  if(AppState.fEnts[id]) return AppState.fEnts[id];
  const e=new pc.Entity(`f_${id}`); e.addComponent('model',{type:'sphere'});
  if (!foodMatCache[color]) foodMatCache[color] = makeMat(color, 3.5);
  e.model.meshInstances[0].material = foodMatCache[color];
  e.model.batchGroupId = AppState.batchGroups.food;
  AppState.app.root.addChild(e); AppState.fEnts[id]=e; return e;
}

function getOrMakeVirusEnt(id) {
  if(AppState.vEnts[id]) return AppState.vEnts[id];
  const e=new pc.Entity(`v_${id}`); e.addComponent('model',{type:'sphere'});
  e.model.meshInstances[0].material=makeMat('#00ff44',2.8);
  e.model.batchGroupId = AppState.batchGroups.virus;
  e.setLocalScale(25,25,25); AppState.app.root.addChild(e);
  AppState.vEnts[id]=e; return e;
}

// ─── GAME LOOP ────────────────────────────────────────────────
function gameLoop(dt) {
  AppState.animTime += dt;
  HudSystem.updateFPS(AppState, dt);

  InputSystem.update(dt);
  AppState.sendTimer += dt;
  if (AppState.sendTimer >= 0.05) { 
    AppState.sendTimer = 0; 
    const input = InputSystem.InputState;
    const pkt = { dx: input.dx, dz: input.dz, seq: AppState.clientSeq++ };
    AppState.socket.emit('input', MessagePack.encode(pkt)); 
    if (input.split) { AppState.socket.emit('split'); }
    if (input.boost) { AppState.socket.emit('boost'); }
    if (input.ability) { AppState.socket.emit('ability'); }
  }

  if (!AppState.gameState || !AppState.gameState.players) return;
  const me = AppState.gameState.players.find(p => p && p.id === AppState.myId);
  if (!me || !me.blobs || !me.blobs.length) return;

  let totalMass = me.blobs.reduce((s,b)=>s+b.mass,0);
  CameraSystem.update(AppState, dt);
  HudSystem.updateAbilityHUD(AppState);

  if (AppState.spectating && InputSystem.InputState.spectateNext) {
    cycleSpectator(1);
  }

  // Stats update
  AppState.myStats.peakMass = Math.max(AppState.myStats.peakMass, Math.floor(totalMass));
  const elMass = document.getElementById('massDisplay');
  if (elMass) {
      elMass.textContent = `● BIOMASS: ${Math.floor(totalMass)}`;
      elMass.style.color = me.color;
  }
  window.HudSystem.updateHints(totalMass);

  if (me.xp !== undefined && me.xp !== AppState.myStats.xp) { 
    const diff = me.xp - AppState.myStats.xp; 
    AppState.myStats.xp = me.xp; 
    HudSystem.updateXPBar(AppState.myStats.xp); 
    if(diff>0) HudSystem.flashXP(diff); 
  }

  // Achievement: Biomass Monster
  if (totalMass >= 5000) MetaSystem.unlockAchievement(2);
  // Achievement: Pacifist
  if (totalMass >= 2000 && AppState.myStats.sessionKills === 0) MetaSystem.unlockAchievement(8);

  // Entities Sync
  const seenKeys = new Set();
  for (const p of AppState.gameState.players) {
    if (!p || !p.blobs) continue;
    // Team coloring
    if (p.team) {
      if (p.team === 'red') p.color = '#ff0044';
      else if (p.team === 'blue') p.color = '#0088ff';
    }
    for (const blob of p.blobs) {
      if (!blob) continue;
      const key = blob.id || `${p.id}_0`;
      seenKeys.add(key);
      const pEnt = getOrMakeBlobEnt(key, p.id, p.color||'#00ffff');
      const r = massToRadius(blob.mass);
      // Interpolation (v2 lerp adapt logic if ping tracked)
      const lerpFactor = Math.min(1, 12 * dt);
      pEnt.tx = (pEnt.tx === undefined ? blob.x : pEnt.tx) + (blob.x - pEnt.tx) * lerpFactor;
      pEnt.tz = (pEnt.tz === undefined ? blob.z : pEnt.tz) + (blob.z - pEnt.tz) * lerpFactor;
      
      const pulse = p.id === AppState.myId ? 1 + Math.sin(AppState.animTime*3)*0.04 : 1;
      const sc = r * 2 * pulse;
      pEnt.ent.setPosition(pEnt.tx, r, pEnt.tz);
      pEnt.ent.setLocalScale(sc, sc, sc);

      if (p.dashing && AppState.perfProfile !== 'LOW') {
          Particles.emitDashTrail(pEnt.tx, r, pEnt.tz, p.color, r);
      }
      if (p.magnetActive && AppState.animTime % 0.2 < 0.05 && AppState.perfProfile !== 'LOW') {
          Particles.emitMagnetField(pEnt.tx, r, pEnt.tz, p.color);
      }
    }
  }
  for (const key in AppState.pEnts) { if (!seenKeys.has(key)) { AppState.pEnts[key].ent.destroy(); delete AppState.pEnts[key]; } }

  // Decoys Sync
  const seenDecoys = new Set();
  if (AppState.gameState.decoys) {
    for (const d of AppState.gameState.decoys) {
        seenDecoys.add(d.id);
        const dEnt = getOrMakeBlobEnt(d.id, d.ownerId, d.color);
        const r = massToRadius(d.mass);
        dEnt.ent.setPosition(d.x, r, d.z);
        dEnt.ent.setLocalScale(r * 2, r * 2, r * 2);
    }
  }

  HudSystem.updateNametags(AppState);
  HudSystem.updateLeaderboard(AppState);
  MinimapSystem.draw(AppState);

  // Mode Specific Rendering
  renderModeEntities();
}

function renderModeEntities() {
  const gs = AppState.gameState;
  
  // Flag Orb (Team Arena)
  if (gs.flagOrb) {
    let orbEnt = AppState.flagOrbEnt;
    if (!orbEnt) {
        orbEnt = new pc.Entity('flagOrb');
        orbEnt.addComponent('model', { type: 'sphere' });
        const mat = new pc.StandardMaterial();
        mat.emissive = new pc.Color(1, 0.84, 0); // Gold
        mat.emissiveIntensity = 2;
        mat.update();
        orbEnt.model.meshInstances[0].material = mat;
        AppState.app.root.addChild(orbEnt);
        AppState.flagOrbEnt = orbEnt;
    }
    orbEnt.setPosition(gs.flagOrb.x, 30, gs.flagOrb.z);
    orbEnt.setLocalScale(60, 60, 60);
  } else if (AppState.flagOrbEnt) {
    AppState.flagOrbEnt.destroy();
    AppState.flagOrbEnt = null;
  }

  // Zone (Battle Royale)
  if (gs.zone) {
    let zoneEnt = AppState.zoneEnt;
    if (!zoneEnt) {
        zoneEnt = new pc.Entity('zone');
        zoneEnt.addComponent('model', { type: 'cylinder' });
        const mat = new pc.StandardMaterial();
        mat.diffuse = new pc.Color(1, 0, 0);
        mat.opacity = 0.2;
        mat.blendType = pc.BLEND_NORMAL;
        mat.update();
        zoneEnt.model.meshInstances[0].material = mat;
        AppState.app.root.addChild(zoneEnt);
        
        const inner = new pc.Entity('zoneInner');
        inner.addComponent('model', { type: 'cylinder' });
        const iMat = new pc.StandardMaterial();
        iMat.emissive = new pc.Color(0, 0.2, 1);
        iMat.opacity = 0.5;
        iMat.blendType = pc.BLEND_ADDITIVE;
        iMat.update();
        inner.model.meshInstances[0].material = iMat;
        zoneEnt.addChild(inner);
        AppState.zoneInnerEnt = inner;
        AppState.zoneEnt = zoneEnt;
    }
    zoneEnt.setPosition(gs.zone.centerX, 0, gs.zone.centerZ);
    zoneEnt.setLocalScale(gs.zone.radius * 2, 500, gs.zone.radius * 2);
    AppState.zoneInnerEnt.setLocalScale(1.02, 1, 1.02);
    AppState.zoneInnerEnt.model.meshInstances[0].material.opacity = Math.sin(Date.now() * 0.004) * 0.2 + 0.4;
    AppState.zoneInnerEnt.model.meshInstances[0].material.update();
  } else if (AppState.zoneEnt) {
    AppState.zoneEnt.destroy();
    AppState.zoneEnt = null;
  }
}

// ─── SOCKET ───────────────────────────────────────────────────
function connectSocket() {
  console.log('🔌 Connecting to server...');
  AppState.socket = io();
  AppState.clientSeq = 1;

  // Home-Screen Social Listeners (Available immediately)
  AppState.socket.on('playerCount', count => {
    const el = document.getElementById('player-count');
    if (el) el.textContent = count;
  });

  AppState.socket.on('chat_history', msgs => {
    const container = document.getElementById('chat-messages');
    if (container) { container.innerHTML = ''; msgs.forEach(addChatMessage); }
  });

  AppState.socket.on('new_global_chat', msg => { addChatMessage(msg); });

  AppState.socket.on('connect', () => {
    console.log('✅ Socket connected!');
  });

  AppState.socket.on('init', buf => {
    clearGame();
    const data = MessagePack.decode(new Uint8Array(buf));
    AppState.myId = data.id;
    AppState.arenaSize = data.arenaSize || 3000;
    buildArena();
    AppState.gameActive = true;
    document.getElementById('hud').style.display = 'grid'; // Grid HUD
    Audio.resume(); Audio.spawn();
    Particles.spawnEffect(0, 10, 0, AppState.myColor);

    // Initial entities
    if (data.foods) {
      Object.entries(data.foods).forEach(([fid, f]) => {
        const e = getOrMakeFoodEnt(fid, f.color);
        const r = massToRadius(f.mass);
        e.setLocalScale(r*2, r*2, r*2); e.setPosition(f.x, r, f.z);
      });
    }
    if (data.viruses) {
      Object.entries(data.viruses).forEach(([vid, v]) => {
        const e = getOrMakeVirusEnt(vid);
        e.setPosition(v.x, 20, v.z);
      });
    }
  });

  AppState.socket.on('world_state', buf => {
    const data = MessagePack.decode(new Uint8Array(buf));
    AppState.gameState.players = data.players;
    AppState.gameState.leaderboard = data.leaderboard;
    
    const elPing = document.getElementById('pingCount');
    if (AppState.lastPingTime && elPing) elPing.textContent = Date.now() - AppState.lastPingTime;
    AppState.lastPingTime = Date.now();
  });

  AppState.socket.on('delta_state', buf => {
    const data = MessagePack.decode(new Uint8Array(buf));
    AppState.gameState.players = data.players;
    AppState.gameState.leaderboard = data.leaderboard;
    const elPing = document.getElementById('pingCount');
    if (AppState.lastPingTime && elPing) elPing.textContent = Date.now() - AppState.lastPingTime;
    AppState.lastPingTime = Date.now();
  });

  AppState.socket.on('foodSpawn', f => { const e=getOrMakeFoodEnt(f.id,f.color); const r=massToRadius(f.mass); e.setLocalScale(r*2,r*2,r*2); e.setPosition(f.x,r,f.z); });
  AppState.socket.on('foodEaten', ({id}) => { if(AppState.fEnts[id]){AppState.fEnts[id].destroy();delete AppState.fEnts[id];} });
  AppState.socket.on('virusSpawn', v => { const e=getOrMakeVirusEnt(v.id); e.setPosition(v.x,20,v.z); });
  AppState.socket.on('virusEaten', ({id}) => { if(AppState.vEnts[id]){AppState.vEnts[id].destroy();delete AppState.vEnts[id];} });

  AppState.socket.on('feedbackEatFood', ({x,z,mass}) => { 
    if (window.Audio) Audio.eatFood(); 
    if (window.Particles) Particles.eatFood(x,5,z,AppState.myColor); 
    AppState.shakeAmt = Math.max(AppState.shakeAmt, 4);
    window.HudSystem.spawnCombatPopup(new pc.Vec3(x, 10, z), `+${Math.floor(mass)}`, '#00ff66');
  });

  AppState.socket.on('feedbackEatPlayer', ({x,z,mass,streak,color}) => {
    if (window.Audio) Audio.eatPlayer(); 
    if (window.Particles) Particles.eatPlayer(x,5,z,color); 
    AppState.shakeAmt = Math.max(AppState.shakeAmt, 20);
    AppState.aberrationAmt = 0.5;
    window.HudSystem.spawnCombatPopup(new pc.Vec3(x, 20, z), `ENGULFED +${Math.floor(mass)}`, '#00ffff');
    
    AppState.myStats.sessionKills++; 
    if (window.HudSystem) HudSystem.showStreak(streak, AppState.myColor); 
    if (window.Audio) Audio.streak(streak);
    window.MetaSystem.unlockAchievement('FIRST_BLOOD');
  });

  AppState.socket.on('feedbackBoost', () => { 
    if (window.Particles) Particles.splitEffect(AppState.cam.x, 5, AppState.cam.z, AppState.myColor); 
  });

  AppState.socket.on('splitEffect', () => { if (window.Audio) Audio.split(); });
  AppState.socket.on('decoyHit', () => { Appstate.shakeAmt = 15; });

  AppState.socket.on('ability_event', ({ playerId, ability, ts }) => {
    // Trigger SFX/VFX based on ability type
    const p = AppState.gameState.players.find(x => x && x.id === playerId);
    const pos = p && p.blobs && p.blobs[0] ? p.blobs[0] : { x:0, z:0 };

    if (ability === 'SHIELD') { 
        if(typeof Audio.playShieldActivate === 'function') Audio.playShieldActivate(); 
        Particles.emitShieldBreak(pos.x, 10, pos.z);
    }
    if (ability === 'MAGNET') { 
        if(typeof Audio.playMagnetPulse === 'function') Audio.playMagnetPulse(); 
    }
    if (ability === 'DASH') { 
        if(typeof Audio.playDashCrack === 'function') Audio.playDashCrack(); 
    }
    if (ability === 'DECOY') { 
        if(typeof Audio.playDecoySpawn === 'function') Audio.playDecoySpawn(); 
        Particles.spawnEffect(pos.x, 10, pos.z, p ? p.color : '#fff');
    }
    
    if (playerId === AppState.myId) shake(8);
  });

  AppState.socket.on('kill_feed', ({killer, victim}) => {
    const isXK = killer && killer.startsWith('@');
    const isXV = victim && victim.startsWith('@');
    const kLink = isXK ? `<a href="https://x.com/${killer.slice(1)}" target="_blank" style="color:inherit">${killer}</a>` : killer;
    const vLink = isXV ? `<a href="https://x.com/${victim.slice(1)}" target="_blank" style="color:inherit">${victim}</a>` : victim;
    HudSystem.addKill(`${kLink} engulfed ${vLink}`);
  });

  AppState.socket.on('virusHit', ({x,z}) => { 
    Particles.virusExplosion(x,20,z); Audio.virusHit(); shake(22); 
    HudSystem.addKill('⚡ VIRUS EXPLOSION!'); 
    AppState.myStats.virusHits = (AppState.myStats.virusHits || 0) + 1;
    if (AppState.myStats.virusHits >= 10) MetaSystem.unlockAchievement(4);
  });

    AppState.socket.on('dead', ({killedBy, killerSocketId, rank}) => {
    AppState.gameActive = false;
    AppState.spectating = true;
    const topPlayer = AppState.gameState.players.filter(p => p).sort((a,b)=>b.score-a.score)[0];
    AppState.spectateId = killerSocketId || (topPlayer ? topPlayer.id : null);
    
    Audio.die(); shake(40);
    const msg = document.getElementById('killedByMsg'); 
    if (msg) {
        const isX = killedBy && killedBy.startsWith('@');
        const kDisplay = isX ? `<a href="https://x.com/${killedBy.slice(1)}" target="_blank" style="color:inherit; text-decoration:underline;">${killedBy.toUpperCase()}</a>` : (killedBy||'?').toUpperCase();
        let text = `LYSIS BY ${kDisplay}`;
        if (rank) text += `<br><span style="font-size:0.6em; color:rgba(255,255,255,0.4)">RANK: #${rank}</span>`;
        msg.innerHTML = text;
    }
    const dm = document.getElementById('d_mass'); if (dm) dm.textContent = AppState.myStats.peakMass;
    const dk = document.getElementById('d_kills'); if (dk) dk.textContent = AppState.myStats.sessionKills;
    
    // Hide respawn button initially
    const respawnBtn = document.querySelector('#dead button');
    if (respawnBtn) {
        respawnBtn.style.display = 'none';
        setTimeout(() => respawnBtn.style.display = 'block', 3000);
    }

    document.getElementById('hud').style.display = 'none';
    document.getElementById('dead').style.display = 'flex';
    document.getElementById('nametags').innerHTML = '';
    
    // Spectator logic: Find the leader's entity
    const leader = AppState.gameState.leaderboard ? AppState.gameState.leaderboard[0] : null;
    if (leader && leader.id !== AppState.myId) {
        AppState.spectatingId = leader.id;
    }

    
    MetaSystem.recordGame({ mass: AppState.myStats.peakMass, kills: AppState.myStats.sessionKills });
    
    for(const k in AppState.pEnts) AppState.pEnts[k].ent.destroy(); AppState.pEnts={};
  });

  AppState.socket.on('respawned', buf => {
    const data = MessagePack.decode(new Uint8Array(buf));
    AppState.myId = data.id; 
    AppState.myStats = { xp:0, kills:0, peakMass:0, sessionKills:0 };
    AppState.myColor = data.color || NEON[Math.floor(Math.random()*NEON.length)];
    AppState.spectating = false;
    document.getElementById('dead').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    Audio.spawn();
  });

  AppState.socket.on('lysis_event', ({killer, victim, x, z}) => {
    if (window.Audio) Audio.lysis();
    if (window.Particles) Particles.virusExplosion(x, 10, z, '#ff00ff');
    AppState.shakeAmt = Math.max(AppState.shakeAmt, 50);
    AppState.aberrationAmt = 2.0;
    window.HudSystem.spawnCombatPopup(new pc.Vec3(x, 20, z), "PHAGE LYSIS!", "#ff00ff");
    window.HudSystem.addKill(`💥 ${victim.toUpperCase()} WAS DESTROYED BY ${killer.toUpperCase()}'S LYSIS!`);
  });

  AppState.socket.on('match_end', data => {
    // data: { winner, type, placements? }
    const isMe = data.winner && (data.winner.id === AppState.myId || data.winner === AppState.myTeam);
    
    // Record game
    window.MetaSystem.recordGame({
      mass: Math.floor(AppState.myScore),
      kills: AppState.myKills,
      mode: AppState.selectedMode,
      won: isMe
    });

    if (isMe) {
        window.MetaSystem.unlockAchievement('CHAMPION');
        window.MetaSystem.addXP(500);
    }
    // Achievement: Team Player
    if (data.type === 'TEAM_VICTORY' && data.winnerTeam === AppState.localTeam) {
        let wins = LS.get('teamWins', 0) + 1;
        LS.set('teamWins', wins);
        if (wins >= 3) MetaSystem.unlockAchievement(6);
    }
    // Achievement: Last Standing
    if (data.type === 'BATTLE_ROYALE_VICTORY' && data.winner.id === AppState.myId) {
        MetaSystem.unlockAchievement(7);
    }
    // Achievement: Untouchable
    if (data.type === 'FFA_VICTORY' && data.winner.id === AppState.myId && AppState.myStats.deaths === 0) {
        MetaSystem.unlockAchievement(3);
    }

    // Show a global results overlay
    HudSystem.addKill(`🏆 MATCH END: ${data.winner.name || data.winnerTeam} WON!`);
  });
}

function cycleSpectator(dir) {
    const players = AppState.gameState.players.filter(p => p && p.blobs && p.blobs.length > 0).sort((a,b)=>b.score-a.score);
    if (!players.length) return;
    let idx = players.findIndex(p => p.id === AppState.spectateId);
    idx = (idx + dir + players.length) % players.length;
    AppState.spectateId = players[idx].id;
}

function detectPerformanceProfile() {
  const start = performance.now();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = `hsl(${i},50%,50%)`;
    ctx.fillRect(0, 0, 512, 512);
  }
  const elapsed = performance.now() - start;
  if (elapsed < 8)  return 'HIGH';
  if (elapsed < 20) return 'MEDIUM';
  return 'LOW';
}


// Entry helpers
function addChatMessage(msg) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const isX = msg.name && msg.name.startsWith('@');
    const nameHtml = isX ? `<a href="https://x.com/${msg.name.slice(1)}" target="_blank" style="color:var(--cyan);text-decoration:none;">${msg.name}</a>` : `<span class="chat-name">${msg.name}</span>`;
    
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `
        <div class="chat-meta" style="font-size:10px; opacity:0.6; margin-bottom:2px;">
            ${nameHtml}
            <span style="margin-left:5px;">${msg.time}</span>
        </div>
        <div style="color:#eee; word-break:break-word;">${msg.text}</div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

window.sendGlobalChat = function() {
    if (!AppState.socket) return;
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    const meta = window.MetaSystem.getData();
    AppState.socket.emit('send_global_chat', { name: meta.name || 'ANON', text });
    input.value = '';
};

function setupHof() {
    const hof = [
        { name: '@jordan_thirkle', score: 145200 },
        { name: '@phage_lol', score: 98400 },
        { name: '@vibejam2026', score: 76100 },
        { name: 'APEX_PREDATOR', score: 54300 },
        { name: 'CELL_DESTROYER', score: 42100 }
    ];
    const hofList = document.getElementById('hof-list');
    if (hofList) {
        hofList.innerHTML = hof.map((h, i) => {
            const isX = h.name.startsWith('@');
            const nameHtml = isX ? `<a href="https://x.com/${h.name.slice(1)}" target="_blank">${h.name}</a>` : h.name;
            return `
                <div class="hof-item">
                    <span class="hof-rank">#${i+1}</span>
                    <span class="hof-name">${nameHtml}</span>
                    <span class="hof-score">${h.score.toLocaleString()}</span>
                </div>
            `;
        }).join('');
    }
}

// Start sequence
checkLibraries(() => {
    onInitialLoad();
    setupHof();
});
