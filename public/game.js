// ─── BLOBZ.IO game.js (v2 Modular) ────────────────────────────
const ARENA = 3000;
const NEON = ['#ff0088','#00ffff','#ffff00','#ff6600','#00ff88','#ff00ff','#88ff00','#0088ff','#ff4488','#ffbb00'];

const AppState = {
  app: null, socket: null, cameraEnt: null,
  myId: null, myName: '', myColor: NEON[Math.floor(Math.random()*NEON.length)],
  gameActive: false,
  gameState: { players: [], leaderboard: [] },
  pEnts: {}, fEnts: {}, vEnts: {},
  animTime: 0, cam: { x:0, z:0, h:700 }, shakeAmt: 0,
  myStats: { xp:0, kills:0, peakMass:0, sessionKills:0 },
  input: { dx:0, dz:0, w:0, a:0, s:0, d:0, split:false, boost:false },
  fpsFrames: 0, fpsTime: 0, lastPingTime: 0, sendTimer: 0
};

// ─── STATS (localStorage) ────────────────────────────────────
const LS = {
  get(k,def=0){ try{ return JSON.parse(localStorage.getItem('blobz_'+k))??def; }catch{ return def; } },
  set(k,v){ try{ localStorage.setItem('blobz_'+k,JSON.stringify(v)); }catch{} }
};

function loadStartStats() {
  const best = LS.get('best',0), kills = LS.get('kills',0), games = LS.get('games',0);
  if (best > 0 || kills > 0) {
    document.getElementById('startStats').style.display='flex';
    document.getElementById('ss_best').textContent = best;
    document.getElementById('ss_kills').textContent = kills;
    document.getElementById('ss_games').textContent = games;
  }
  const savedName = LS.get('name','');
  if (savedName) document.getElementById('nameInput').value = savedName;
}

// ─── DEV SETTINGS ─────────────────────────────────────────────
document.getElementById('chkGlow').addEventListener('change', e => {
  for(const k in AppState.pEnts) {
    if(AppState.pEnts[k].ent.children[0]) AppState.pEnts[k].ent.children[0].enabled = e.target.checked;
  }
});
let gridLines = [];
document.getElementById('chkGrid').addEventListener('change', e => {
  gridLines.forEach(l => l.enabled = e.target.checked);
});

// ─── HELPERS ──────────────────────────────────────────────────
function massToRadius(m){ return Math.pow(m, 0.45) * 2.2; }
function hexToRgb01(hex){
  return { r:parseInt(hex.slice(1,3),16)/255, g:parseInt(hex.slice(3,5),16)/255, b:parseInt(hex.slice(5,7),16)/255 };
}
function shake(amt){ AppState.shakeAmt = Math.max(AppState.shakeAmt, amt); }

// ─── PLAYCANVAS INIT ──────────────────────────────────────────
function initPC() {
  const canvas = document.getElementById('c');
  AppState.app = new pc.Application(canvas);
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

  buildArena(); Particles.init(AppState.app); MinimapSystem.init(); InputSystem.init(AppState);

  AppState.app.on('update', dt => { 
    Particles.update(dt); 
    if(AppState.gameActive) gameLoop(dt); 
  });
  AppState.app.start();
}

function buildArena() {
  const fe = new pc.Entity('floor'); fe.addComponent('model',{type:'plane'}); fe.setLocalScale(ARENA,1,ARENA);
  const fm = new pc.StandardMaterial(); fm.diffuse=new pc.Color(0.02,0.02,0.06); fm.emissive=new pc.Color(0.01,0.01,0.04); fm.update();
  fe.model.meshInstances[0].material=fm; AppState.app.root.addChild(fe);

  const gm = new pc.StandardMaterial(); gm.emissive=new pc.Color(0.0,0.12,0.38); gm.emissiveIntensity=1.2; gm.update();
  const step=150, half=ARENA/2;
  for(let i=-half;i<=half;i+=step){
    const vl=new pc.Entity();vl.addComponent('model',{type:'box'});vl.setLocalScale(1.5,2,ARENA);vl.setPosition(i,1.5,0);vl.model.meshInstances[0].material=gm;AppState.app.root.addChild(vl);
    const hl=new pc.Entity();hl.addComponent('model',{type:'box'});hl.setLocalScale(ARENA,2,1.5);hl.setPosition(0,1.5,i);hl.model.meshInstances[0].material=gm;AppState.app.root.addChild(hl);
    gridLines.push(vl, hl);
  }

  const wm=new pc.StandardMaterial();wm.emissive=new pc.Color(0.0,0.5,1.0);wm.emissiveIntensity=3;wm.update();
  [[0,100,half,ARENA,200,8],[0,100,-half,ARENA,200,8],[half,100,0,8,200,ARENA],[-half,100,0,8,200,ARENA]].forEach(([x,y,z,w,h,d])=>{
    const w2=new pc.Entity();w2.addComponent('model',{type:'box'});w2.setPosition(x,y,z);w2.setLocalScale(w,h,d);w2.model.meshInstances[0].material=wm;AppState.app.root.addChild(w2);
  });
  
  const sm=new pc.StandardMaterial();sm.emissive=new pc.Color(0.4,0.4,1);sm.emissiveIntensity=4;sm.update();
  for(let i=0;i<150;i++){
    const s=new pc.Entity();s.addComponent('model',{type:'sphere'});
    s.setPosition((Math.random()-0.5)*ARENA*1.5,(Math.random()*200)+50,(Math.random()-0.5)*ARENA*1.5);
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
  AppState.pEnts[key]={ent:e,tx:0,ty:0,tz:0}; return AppState.pEnts[key];
}

function getOrMakeFoodEnt(id, color) {
  if(AppState.fEnts[id]) return AppState.fEnts[id];
  const e=new pc.Entity(`f_${id}`); e.addComponent('model',{type:'sphere'});
  e.model.meshInstances[0].material=makeMat(color,3.5);
  AppState.app.root.addChild(e); AppState.fEnts[id]=e; return e;
}

function getOrMakeVirusEnt(id) {
  if(AppState.vEnts[id]) return AppState.vEnts[id];
  const e=new pc.Entity(`v_${id}`); e.addComponent('model',{type:'sphere'});
  e.model.meshInstances[0].material=makeMat('#00ff44',2.8);
  e.setLocalScale(25,25,25); AppState.app.root.addChild(e);
  AppState.vEnts[id]=e; return e;
}

// ─── GAME LOOP ────────────────────────────────────────────────
function gameLoop(dt) {
  AppState.animTime += dt;
  HudSystem.updateFPS(AppState, dt);

  AppState.sendTimer += dt;
  if (AppState.sendTimer >= 0.05) { 
    AppState.sendTimer = 0; 
    const dir = InputSystem.getDirection(AppState);
    const pkt = { dx: dir.dx, dz: dir.dz, seq: AppState.clientSeq++ };
    AppState.socket.emit('input', MessagePack.encode(pkt)); 
    if (AppState.input.split) { AppState.socket.emit('split'); AppState.input.split = false; }
    if (AppState.input.boost) { AppState.socket.emit('boost'); AppState.input.boost = false; }
  }

  const me = AppState.gameState.players.find(p=>p.id===AppState.myId);
  if (!me || !me.blobs || !me.blobs.length) return;

  let totalMass = me.blobs.reduce((s,b)=>s+b.mass,0);
  CameraSystem.update(AppState, dt);

  // Stats update
  AppState.myStats.peakMass = Math.max(AppState.myStats.peakMass, Math.floor(totalMass));
  document.getElementById('massDisplay').textContent=`● ${Math.floor(totalMass)}`;
  document.getElementById('massDisplay').style.color=me.color;
  if (me.xp !== undefined && me.xp !== AppState.myStats.xp) { 
    const diff = me.xp - AppState.myStats.xp; 
    AppState.myStats.xp = me.xp; 
    HudSystem.updateXPBar(AppState.myStats.xp); 
    if(diff>0) HudSystem.flashXP(diff); 
  }

  // Entities Sync
  const seenKeys = new Set();
  for (const p of AppState.gameState.players) {
    if (!p.blobs) continue;
    for (const blob of p.blobs) {
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
    }
  }
  for (const key in AppState.pEnts) { if (!seenKeys.has(key)) { AppState.pEnts[key].ent.destroy(); delete AppState.pEnts[key]; } }

  HudSystem.updateNametags(AppState);
  HudSystem.updateLeaderboard(AppState);
  MinimapSystem.draw(AppState);
}

// ─── SOCKET ───────────────────────────────────────────────────
function connectSocket() {
  AppState.socket = io();
  AppState.clientSeq = 1;

  AppState.socket.on('init', buf => {
    const data = MessagePack.decode(new Uint8Array(buf));
    AppState.myId = data.id;
    AppState.gameActive = true;
    document.getElementById('hud').style.display = 'block';
    Audio.resume(); Audio.spawn();
    Particles.spawnEffect(0, 10, 0, AppState.myColor);
  });

  AppState.socket.on('world_state', buf => {
    const data = MessagePack.decode(new Uint8Array(buf));
    AppState.gameState.players = data.players;
    AppState.gameState.leaderboard = data.leaderboard;
    // Sync foods and viruses
    if (data.foods) {
      for (const fid in data.foods) {
        const f = data.foods[fid];
        const e = getOrMakeFoodEnt(fid, f.color);
        const r = massToRadius(f.mass);
        e.setLocalScale(r*2, r*2, r*2); e.setPosition(f.x, r, f.z);
      }
    }
    if (data.viruses) {
      for (const vid in data.viruses) {
        const v = data.viruses[vid];
        const e = getOrMakeVirusEnt(vid);
        e.setPosition(v.x, 20, v.z);
      }
    }
    if (AppState.lastPingTime) document.getElementById('pingCount').textContent = Date.now() - AppState.lastPingTime;
    AppState.lastPingTime = Date.now();
  });

  AppState.socket.on('delta_state', buf => {
    const data = MessagePack.decode(new Uint8Array(buf));
    AppState.gameState.players = data.players;
    AppState.gameState.leaderboard = data.leaderboard;
    if (AppState.lastPingTime) document.getElementById('pingCount').textContent = Date.now() - AppState.lastPingTime;
    AppState.lastPingTime = Date.now();
  });

  AppState.socket.on('foodSpawn', f => { const e=getOrMakeFoodEnt(f.id,f.color); const r=massToRadius(f.mass); e.setLocalScale(r*2,r*2,r*2); e.setPosition(f.x,r,f.z); });
  AppState.socket.on('foodEaten', ({id}) => { if(AppState.fEnts[id]){AppState.fEnts[id].destroy();delete AppState.fEnts[id];} });

  AppState.socket.on('feedbackEatFood', ({x,z}) => { Audio.eatFood(); Particles.eatFood(x,5,z,AppState.myColor); shake(4); });
  AppState.socket.on('feedbackEatPlayer', ({x,z,mass,streak,color}) => {
    Audio.eatPlayer(); Particles.eatPlayer(x,5,z,color); shake(18);
    AppState.myStats.sessionKills++; 
    HudSystem.showStreak(streak, AppState.myColor); Audio.streak(streak);
  });
  AppState.socket.on('feedbackBoost', () => { Particles.splitEffect(AppState.cam.x, 5, AppState.cam.z, AppState.myColor); });
  AppState.socket.on('splitEffect', () => { Audio.split(); });

  AppState.socket.on('kill_feed', ({killer, victim}) => {
    HudSystem.addKill(`${killer} ate ${victim}`);
  });

  AppState.socket.on('virusHit', ({x,z}) => { Particles.virusExplosion(x,20,z); Audio.virusHit(); shake(22); HudSystem.addKill('⚡ VIRUS EXPLOSION!'); });

  AppState.socket.on('dead', ({killedBy}) => {
    AppState.gameActive = false;
    Audio.die(); shake(40);
    document.getElementById('killedByMsg').textContent = `DEVOURED BY ${(killedBy||'?').toUpperCase()}`;
    document.getElementById('d_mass').textContent = AppState.myStats.peakMass;
    document.getElementById('d_kills').textContent = AppState.myStats.sessionKills;
    document.getElementById('d_xp').textContent = AppState.myStats.xp;
    document.getElementById('hud').style.display = 'none';
    document.getElementById('dead').style.display = 'flex';
    document.getElementById('nametags').innerHTML = '';
    LS.set('best', Math.max(LS.get('best'), AppState.myStats.peakMass));
    LS.set('kills', LS.get('kills') + AppState.myStats.sessionKills);
    LS.set('games', LS.get('games') + 1);
    for(const k in AppState.pEnts) AppState.pEnts[k].ent.destroy(); AppState.pEnts={};
  });

  AppState.socket.on('respawned', buf => {
    const data = MessagePack.decode(new Uint8Array(buf));
    AppState.myId = data.id; 
    AppState.myStats = { xp:0, kills:0, peakMass:0, sessionKills:0 };
    AppState.myColor = NEON[Math.floor(Math.random()*NEON.length)];
    AppState.gameActive = true;
    document.getElementById('dead').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    Audio.spawn();
  });
}

// ─── ENTRY POINTS ─────────────────────────────────────────────
window.startGame = function() {
  AppState.myName = (document.getElementById('nameInput').value.trim()||'PLAYER').toUpperCase().slice(0,16);
  LS.set('name', AppState.myName);
  LS.set('games', LS.get('games')+1);
  document.getElementById('start').style.display = 'none';
  Audio.init(); Audio.resume();
  initPC(); connectSocket();
  AppState.socket.emit('join', MessagePack.encode({ name: AppState.myName, color: AppState.myColor }));
}

window.respawn = function() {
  document.getElementById('dead').style.display = 'none';
  AppState.socket.emit('respawn', MessagePack.encode({ name: AppState.myName, color: AppState.myColor }));
}

// Init stats on load
loadStartStats();
if (typeof initHowItWasMade === 'function') initHowItWasMade();
document.getElementById('nameInput').addEventListener('keydown',e=>{ if(e.key==='Enter') window.startGame(); });
