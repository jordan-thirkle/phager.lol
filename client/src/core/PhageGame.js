import * as pc from 'playcanvas';
import { io } from 'socket.io-client';
import * as MessagePack from '@msgpack/msgpack';
import { AppState, LS, NEON } from './state.js';
import { CameraSystem } from './camera.js';
import { InputSystem } from './input.js';
import { AudioEngine } from '../systems/audio.js';
import { ParticleSystem } from '../systems/particles.js';
import { Skins } from '../systems/skins.js';
import { HudSystem } from '../ui/hud.js';
import { MinimapSystem } from '../ui/minimap.js';
import { MetaSystem } from '../ui/meta.js';
import { PortalSystem } from '../systems/portals.js';
import { HowItWasMade } from '../systems/howItWasMade.js';

// MessagePack and Socket.io are typically loaded via CDN or npm. 
// For now, we'll assume they are available globally or imported if we use a bundler.
// If we want to be fully modular, we should npm install them.
// But let's stick to the current setup for libraries.

export class PhageGame {
  constructor() {
    this.arenaBuilt = false;
    this.gridLines = [];
    this.foodMatCache = {};
  }

  init() {
    console.log('☣️ PHAGE INITIALIZING...');
    
    // Connection Manager: Show overlay immediately
    const connOverlay = document.getElementById('connOverlay');
    if (connOverlay) connOverlay.style.display = 'flex';
    this.connTimeout = setTimeout(() => {
        if (AppState.socket && !AppState.socket.connected) {
            const p = connOverlay.querySelector('p');
            if (p) p.innerText = 'UPLINK DELAYED... PERSISTING...';
        }
    }, 2000);

    MetaSystem.init();
    this.loadStartStats();
    this.initSettingsListeners();
    HowItWasMade.init();

    // Create socket immediately to support Home Chat
    this.connectSocket();
    
    const nameInput = document.getElementById('nameInput');
    if (nameInput) {
      nameInput.addEventListener('keydown', e => { 
        if (e.key === 'Enter') this.startGame(); 
      });
    }

    // Expose some functions to window for legacy HTML handlers (until we refactor them)
    window.startGame = () => this.startGame();
    window.respawn = () => this.respawn();
    window.selectMode = (mode, el) => this.selectMode(mode, el);
    window.toggleFullscreen = () => this.toggleFullscreen();
    window.openHowItWasMade = () => HowItWasMade.open(AudioEngine);
    window.closeHowItWasMade = () => HowItWasMade.close();
    
    // Global Registry for UI/Meta callbacks
    window.AudioEngine = AudioEngine;
    window.ParticleSystem = ParticleSystem;
    window.AppState = AppState;
    
    // Bridge for HudSystem template handlers
    window.HudSystem = {
      ...HudSystem,
      setSkin: (s) => HudSystem.setSkin(s, MetaSystem),
      setColor: (c) => HudSystem.setColor(c, MetaSystem),
      setAbility: (a) => HudSystem.setAbility(a, MetaSystem),
      setTitle: (t) => HudSystem.setTitle(t, MetaSystem),
      setSetting: (k, v) => HudSystem.setSetting(k, v, MetaSystem, AudioEngine)
    };
    window.openCustomize = () => HudSystem.openCustomize(MetaSystem);
    window.openSettings = () => HudSystem.openSettings(MetaSystem);
    window.openGuide = () => HudSystem.openGuide();
    window.openCareer = () => HudSystem.openCareer(MetaSystem);
    window.closeModal = () => HudSystem.closeModal();
  }

  loadStartStats() {
    const meta = MetaSystem.getData();
    const levelData = MetaSystem.getLevelInfo(meta.totalXP);
    
    const elXp = document.getElementById('ss_xp');
    const elLevel = document.getElementById('ss_level');
    const elKills = document.getElementById('ss_kills');
    const elXpFill = document.getElementById('ss_xp_fill');
    const elName = document.getElementById('nameInput');

    if (elXp) elXp.textContent = meta.totalXP;
    if (elLevel) elLevel.textContent = levelData.level;
    if (elKills) elKills.textContent = meta.bestMass;
    if (elXpFill) elXpFill.style.width = (levelData.progress * 100) + '%';
    
    const savedName = LS.get('name', '');
    if (savedName && elName) elName.value = savedName;
  }

  initSettingsListeners() {
    const chkGlow = document.getElementById('chkGlow');
    if (chkGlow) {
      chkGlow.addEventListener('change', e => {
        for (const k in AppState.pEnts) {
          if (AppState.pEnts[k].ent.children[0]) AppState.pEnts[k].ent.children[0].enabled = e.target.checked;
        }
      });
    }
    const chkGrid = document.getElementById('chkGrid');
    if (chkGrid) {
      chkGrid.addEventListener('change', e => {
        this.gridLines.forEach(l => l.enabled = e.target.checked);
      });
    }
  }

  startGame() {
    if (AppState.gameActive) return;
    if (AppState.gameStarting) {
        // Reset if stuck for more than 5 seconds
        if (Date.now() - (AppState.startAttemptTime || 0) > 5000) {
            AppState.gameStarting = false;
        } else {
            return;
        }
    }

    if (!AppState.socket || !AppState.socket.connected) {
        console.error('❌ Cannot start: Socket not connected');
        HudSystem.spawnCombatPopup(new pc.Vec3(0,0,0), 'CONNECTION ERROR', '#ff0000');
        return;
    }

    AppState.gameStarting = true;
    AppState.startAttemptTime = Date.now();
    
    console.log('▶️ STARTING GAME...');
    const nameEl = document.getElementById('nameInput');
    AppState.myName = (nameEl ? nameEl.value.trim() : 'PLAYER').toUpperCase().slice(0, 16);
    LS.set('name', AppState.myName);
    
    // Reset UI state
    const homeEl = document.getElementById('home-layout');
    if (homeEl) homeEl.style.display = 'none';

    this.showCountdown();

    AppState.perfProfile = this.detectPerformanceProfile();
    AudioEngine.init(); 
    AudioEngine.resume();

    this.initPC();
    
    console.log('🚀 Emitting JOIN for', AppState.myName);
    AppState.socket.emit('join', MessagePack.encode({ 
        name: AppState.myName, 
        color: AppState.myColor,
        mode: AppState.selectedMode || 'ffa',
        ability: AppState.selectedAbility || 'SHIELD'
    }));
  }

  showCountdown() {
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
  }

  detectPerformanceProfile() {
    const mem = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    if (mem <= 2 || cores <= 2) return 'LOW';
    if (mem <= 4 || cores <= 4) return 'MEDIUM';
    return 'HIGH';
  }

  initPC() {
    if (AppState.app) return;
    const canvas = document.getElementById('c');
    if (!canvas) return;
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
    AppState.cameraEnt.addComponent('camera', { clearColor: new pc.Color(0.02, 0.02, 0.07), nearClip: 0.5, farClip: 9000, fov: 62 });
    AppState.cameraEnt.setPosition(0, 700, 0); AppState.cameraEnt.setEulerAngles(-90, 0, 0);
    AppState.app.root.addChild(AppState.cameraEnt);

    const dl = new pc.Entity('dl');
    dl.addComponent('light', { type: 'directional', color: new pc.Color(1.0, 1.0, 1.0), intensity: 2.0 });
    dl.setEulerAngles(45, 45, 0); AppState.app.root.addChild(dl);
    AppState.app.scene.ambientLight = new pc.Color(0.1, 0.1, 0.25);

    ParticleSystem.init(AppState.app); 
    MinimapSystem.init(); 
    InputSystem.init(AppState, MetaSystem);

    const foodGroup = AppState.app.batcher.addGroup("Food", true, 1000);
    const virusGroup = AppState.app.batcher.addGroup("Viruses", true, 100);
    AppState.batchGroups = { food: foodGroup.id, virus: virusGroup.id };

    PortalSystem.init({
      scene: AppState.app.root,
      exitPosition: { x: -AppState.arenaSize * 0.4, y: 10, z: -AppState.arenaSize * 0.4 }
    });

    AppState.app.on('update', dt => this.update(dt));
    AppState.app.start();
  }

  update(dt) {
    PortalSystem.update(dt, {
      getPlayer: () => {
        const me = AppState.gameState.players.find(p => p && p.id === AppState.myId);
        if (me && AppState.pEnts[me.id]) return AppState.pEnts[me.id].ent;
        return null;
      },
      onExit: () => {
        const me = AppState.gameState.players.find(p => p && p.id === AppState.myId);
        const mass = me ? me.blobs.reduce((s, b) => s + b.mass, 0) : 100;
        const url = new URL('https://vibej.am/portal/2026');
        url.searchParams.set('username', AppState.myName);
        url.searchParams.set('color', AppState.myColor);
        url.searchParams.set('ref', 'phage.lol');
        url.searchParams.set('hp', Math.min(100, Math.floor(mass / 10)));
        window.location.href = url.toString();
      }
    });

    if (AppState.perfProfile !== 'LOW') {
        ParticleSystem.update(dt);
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

    const camPos = AppState.cam.pos || new pc.Vec3(0, 700, 0);
    CameraSystem.update(AppState, dt);

    HudSystem.updateCombatPopups(AppState.cameraEnt, AppState.app);

    const CULL_RAD = AppState.perfProfile === 'HIGH' ? 3500 : (AppState.perfProfile === 'MEDIUM' ? 2200 : 1500);
    const CULL_DIST_SQ = CULL_RAD * CULL_RAD;

    for (const fid in AppState.fEnts) {
        const ent = AppState.fEnts[fid];
        const p = ent.getPosition();
        const dx = p.x - camPos.x, dz = p.z - camPos.z;
        ent.enabled = (dx*dx + dz*dz < CULL_DIST_SQ);
    }
    
    if (AppState.gameActive) this.gameLoop(dt);
  }

  gameLoop(dt) {
    AppState.animTime += dt;
    HudSystem.updateFPS(AppState, dt);
    InputSystem.update(dt);

    AppState.sendTimer += dt;
    if (AppState.sendTimer >= 0.05) { 
      AppState.sendTimer = 0; 
      const input = InputSystem.InputState;
      const pkt = { dx: input.dx, dz: input.dz, seq: AppState.clientSeq++ };
      AppState.socket.emit('input', MessagePack.encode(pkt)); 
      AppState.pendingInputs.push(pkt);

      if (input.split) AppState.socket.emit('split');
      if (input.boost) AppState.socket.emit('boost');
      if (input.ability) AppState.socket.emit('ability');
    }

    // Prediction
    const me = AppState.gameState.players.find(p => p && p.id === AppState.myId);
    if (me && me.blobs) {
      me.blobs.forEach(b => {
        const speed = 250 * Math.pow(b.mass, -0.4) * (me.dashing ? 2.5 : 1);
        const dx = InputSystem.InputState.dx, dz = InputSystem.InputState.dz;
        b.vx = (b.vx || 0) + (dx * speed - (b.vx || 0)) * 0.15;
        b.vz = (b.vz || 0) + (dz * speed - (b.vz || 0)) * 0.15;
        b.x += b.vx * dt;
        b.z += b.vz * dt;
        const half = (AppState.arenaSize || 3000) / 2;
        b.x = Math.max(-half, Math.min(half, b.x));
        b.z = Math.max(-half, Math.min(half, b.z));
      });
    }

    if (!AppState.gameState || !AppState.gameState.players) return;
    const meFinal = AppState.gameState.players.find(p => p && p.id === AppState.myId);
    if (!meFinal || !meFinal.blobs || !meFinal.blobs.length) return;

    let totalMass = meFinal.blobs.reduce((s, b) => s + b.mass, 0);
    HudSystem.updateAbilityHUD(AppState);

    if (AppState.spectating && InputSystem.InputState.spectateNext) {
      this.cycleSpectator(1);
    }

    AppState.myStats.peakMass = Math.max(AppState.myStats.peakMass, Math.floor(totalMass));
    const elMass = document.getElementById('massDisplay');
    if (elMass) {
        elMass.textContent = `● BIOMASS: ${Math.floor(totalMass)}`;
        elMass.style.color = meFinal.color;
    }
    HudSystem.updateHints(totalMass);

    if (meFinal.xp !== undefined && meFinal.xp !== AppState.myStats.xp) { 
      const diff = meFinal.xp - AppState.myStats.xp; 
      AppState.myStats.xp = meFinal.xp; 
      HudSystem.updateXPBar(AppState.myStats.xp); 
      if (diff > 0) HudSystem.flashXP(diff); 
    }

    if (totalMass >= 5000) MetaSystem.unlockAchievement(2, HudSystem);
    if (totalMass >= 2000 && AppState.myStats.sessionKills === 0) MetaSystem.unlockAchievement(8, HudSystem);

    this.syncEntities(dt);
    this.renderModeEntities();
  }

  syncEntities(dt) {
    const seenKeys = new Set();
    let playerIdx = 0;
    const me = AppState.gameState.players.find(p => p && p.id === AppState.myId);
    const myMass = me ? me.blobs.reduce((s, b) => s + b.mass, 0) : 0;

    // --- BIO-AUDIO TENSION ---
    if (AppState.gameActive && me) {
        AudioEngine.updateTension(myMass);
    }

    for (const p of AppState.gameState.players) {
      if (!p || !p.blobs) continue;
      playerIdx++;
      if (p.team) {
        if (p.team === 'red') p.color = '#ff0044';
        else if (p.team === 'blue') p.color = '#0088ff';
      }
      for (let bIdx = 0; bIdx < p.blobs.length; bIdx++) {
        const blob = p.blobs[bIdx];
        if (!blob) continue;
        const key = blob.id || `${p.id}_${bIdx}`;
        seenKeys.add(key);
        const pEnt = this.getOrMakeBlobEnt(key, p.id, p.color || '#00ffff');
        const r = this.massToRadius(blob.mass);
        const lerpFactor = Math.min(1, 12 * dt);
        pEnt.tx = (pEnt.tx === undefined || pEnt.tx === 0 ? blob.x : pEnt.tx) + (blob.x - pEnt.tx) * lerpFactor;
        pEnt.tz = (pEnt.tz === undefined || pEnt.tz === 0 ? blob.z : pEnt.tz) + (blob.z - pEnt.tz) * lerpFactor;
        
        const pulse = p.id === AppState.myId ? 1 + Math.sin(AppState.animTime * 3.5) * 0.06 : 1 + Math.sin(AppState.animTime * 2 + playerIdx * 0.5) * 0.03;
        const sc = r * 2 * pulse;
        const wobbleX = Math.sin(AppState.animTime * 4 + playerIdx + bIdx) * (r * 0.05);
        const wobbleZ = Math.cos(AppState.animTime * 4 + playerIdx + bIdx) * (r * 0.05);
        
        pEnt.ent.setPosition(pEnt.tx + wobbleX, r, pEnt.tz + wobbleZ);
        pEnt.ent.setLocalScale(sc, sc * (1 + Math.sin(AppState.animTime * 5) * 0.02), sc);

        // Relative Threat Indicators
        if (p.id !== AppState.myId && myMass > 0) {
            const ratio = blob.mass / myMass;
            let haloColor = new pc.Color(1, 1, 1);
            if (ratio < 0.75) haloColor = new pc.Color(0, 1, 0.4);      // Edible (Green)
            else if (ratio > 1.3) haloColor = new pc.Color(1, 0, 0.2); // Threat (Red)
            else haloColor = new pc.Color(1, 0.8, 0);                  // Risk (Yellow)
            
            const mesh = pEnt.ent.model.meshInstances[0];
            if (mesh && mesh.material) {
                mesh.material.emissive = haloColor;
                mesh.material.emissiveIntensity = 2.5; 
                mesh.material.update();
            }
        } else if (p.id === AppState.myId) {
            const mesh = pEnt.ent.model.meshInstances[0];
            if (mesh && mesh.material) {
                mesh.material.emissive = new pc.Color(0, 0, 0);
                mesh.material.emissiveIntensity = 0;
                mesh.material.update();
            }
        }

        if (p.dashing && AppState.perfProfile !== 'LOW') {
            ParticleSystem.emitDashTrail(pEnt.tx, r, pEnt.tz, p.color, r);
        }
        if (p.magnetActive && AppState.animTime % 0.2 < 0.05 && AppState.perfProfile !== 'LOW') {
            ParticleSystem.emitMagnetField(pEnt.tx, r, pEnt.tz, p.color);
        }
      }
    }
    for (const key in AppState.pEnts) { 
      if (!seenKeys.has(key)) { 
        AppState.pEnts[key].ent.destroy(); 
        delete AppState.pEnts[key]; 
      } 
    }

    if (AppState.gameState.decoys) {
      for (const d of AppState.gameState.decoys) {
          const dEnt = this.getOrMakeBlobEnt(d.id, d.ownerId, d.color);
          const r = this.massToRadius(d.mass);
          dEnt.ent.setPosition(d.x, r, d.z);
          dEnt.ent.setLocalScale(r * 2, r * 2, r * 2);
      }
    }

    HudSystem.updateNametags(AppState);
    HudSystem.updateLeaderboard(AppState);
    MinimapSystem.draw(AppState);
    
    if (AppState.gameState.hallOfFame) {
      HudSystem.updateHallOfFame(AppState.gameState.hallOfFame);
    }
  }

  renderModeEntities() {
    const gs = AppState.gameState;
    if (gs.flagOrb) {
      if (!AppState.flagOrbEnt) {
          const orb = new pc.Entity('flagOrb');
          orb.addComponent('model', { type: 'sphere' });
          const mat = new pc.StandardMaterial();
          mat.emissive = new pc.Color(1, 0.84, 0);
          mat.emissiveIntensity = 2;
          mat.update();
          orb.model.meshInstances[0].material = mat;
          AppState.app.root.addChild(orb);
          AppState.flagOrbEnt = orb;
      }
      AppState.flagOrbEnt.setPosition(gs.flagOrb.x, 30, gs.flagOrb.z);
      AppState.flagOrbEnt.setLocalScale(60, 60, 60);
    } else if (AppState.flagOrbEnt) {
      AppState.flagOrbEnt.destroy();
      AppState.flagOrbEnt = null;
    }

    if (gs.zone) {
      if (!AppState.zoneEnt) {
          const zone = new pc.Entity('zone');
          zone.addComponent('model', { type: 'cylinder' });
          const mat = new pc.StandardMaterial();
          mat.diffuse = new pc.Color(1, 0, 0);
          mat.opacity = 0.2;
          mat.blendType = pc.BLEND_NORMAL;
          mat.update();
          zone.model.meshInstances[0].material = mat;
          AppState.app.root.addChild(zone);
          
          const inner = new pc.Entity('zoneInner');
          inner.addComponent('model', { type: 'cylinder' });
          const iMat = new pc.StandardMaterial();
          iMat.emissive = new pc.Color(0, 0.2, 1);
          iMat.opacity = 0.5;
          iMat.blendType = pc.BLEND_ADDITIVE;
          iMat.update();
          inner.model.meshInstances[0].material = iMat;
          zone.addChild(inner);
          AppState.zoneInnerEnt = inner;
          AppState.zoneEnt = zone;
      }
      AppState.zoneEnt.setPosition(gs.zone.centerX, 0, gs.zone.centerZ);
      AppState.zoneEnt.setLocalScale(gs.zone.radius * 2, 500, gs.zone.radius * 2);
      AppState.zoneInnerEnt.setLocalScale(1.02, 1, 1.02);
      AppState.zoneInnerEnt.model.meshInstances[0].material.opacity = Math.sin(Date.now() * 0.004) * 0.2 + 0.4;
      AppState.zoneInnerEnt.model.meshInstances[0].material.update();
    } else if (AppState.zoneEnt) {
      AppState.zoneEnt.destroy();
      AppState.zoneEnt = null;
    }
  }

  connectSocket() {
    if (AppState.socket) return;
    console.log('🔌 Connecting to server...');
    try {
      AppState.socket = io();
      AppState.socket.on('connect', () => {
          console.log('✅ SOCKET CONNECTED:', AppState.socket.id);
          const disc = document.getElementById('disconnectOverlay');
          if (disc) disc.style.display = 'none';
      });
      AppState.socket.on('disconnect', () => {
          console.warn('⚠️ SOCKET DISCONNECTED');
          AppState.gameActive = false;
          AppState.gameStarting = false;
          const disc = document.getElementById('disconnectOverlay');
          if (disc) disc.style.display = 'flex';
      });
      AppState.socket.on('connect_error', (err) => {
          console.error('❌ SOCKET ERROR:', err);
          AppState.gameStarting = false;
      });
    } catch(e) {
      console.error('❌ Failed to initialize Socket.io:', e);
    }

    AppState.socket.on('playerCount', count => {
      const el = document.getElementById('playerCount');
      if (el) el.textContent = count;
    });

    AppState.socket.on('chat_history', msgs => {
      const container = document.getElementById('chat-messages');
      if (container) { container.innerHTML = ''; msgs.forEach(m => this.addChatMessage(m)); }
    });

    AppState.socket.on('new_global_chat', msg => { this.addChatMessage(msg); });

    AppState.socket.on('init', (buf) => {
      const data = MessagePack.decode(new Uint8Array(buf));
      AppState.myId = data.id;
      AppState.arenaSize = data.arenaSize || 3000;
      console.log('☣️ INFECTED! ID:', AppState.myId);
      
      // Hide Connection Overlay
      const connOverlay = document.getElementById('connOverlay');
      if (connOverlay) connOverlay.style.display = 'none';
      clearTimeout(this.connTimeout);
      
      this.buildArena();
      AppState.gameActive = true;
      document.getElementById('hud').style.display = 'grid'; 
      AudioEngine.resume(); 
      AudioEngine.spawn();
      ParticleSystem.spawnEffect(0, 10, 0, AppState.myColor);

      if (data.foods) {
        Object.entries(data.foods).forEach(([fid, f]) => {
          const e = this.getOrMakeFoodEnt(fid, f.color);
          const r = this.massToRadius(f.mass);
          e.setLocalScale(r*2, r*2, r*2); e.setPosition(f.x, r, f.z);
        });
      }
      if (data.viruses) {
        Object.entries(data.viruses).forEach(([vid, v]) => {
          const e = this.getOrMakeVirusEnt(vid);
          e.setPosition(v.x, 20, v.z);
        });
      }
      if (data.players) AppState.gameState.players = data.players;
      if (data.leaderboard) {
          AppState.gameState.leaderboard = data.leaderboard;
          HudSystem.updateLeaderboard(AppState);
      }
    });

    AppState.socket.on('world_state', buf => this.onWorldState(buf));
    
    AppState.socket.on('foodSpawn', f => { 
      const e = this.getOrMakeFoodEnt(f.id, f.color); 
      const r = this.massToRadius(f.mass); 
      e.setLocalScale(r*2, r*2, r*2); 
      e.setPosition(f.x, r, f.z); 
    });
    AppState.socket.on('foodEaten', ({id}) => { 
      if (AppState.fEnts[id]) { AppState.fEnts[id].destroy(); delete AppState.fEnts[id]; } 
    });
    AppState.socket.on('virusSpawn', v => { 
      const e = this.getOrMakeVirusEnt(v.id); 
      e.setPosition(v.x, 20, v.z); 
    });
    AppState.socket.on('virusEaten', ({id}) => { 
      if (AppState.vEnts[id]) { AppState.vEnts[id].destroy(); delete AppState.vEnts[id]; } 
    });

    AppState.socket.on('feedbackEatFood', ({x,z,mass}) => { 
      AudioEngine.eatFood(); 
      ParticleSystem.eatFood(x, 5, z, AppState.myColor); 
      AppState.shakeAmt = Math.max(AppState.shakeAmt, 4);
      HudSystem.spawnCombatPopup(new pc.Vec3(x, 10, z), `+${Math.floor(mass)}`, '#00ff66');
    });

    AppState.socket.on('feedbackEatPlayer', (data) => {
      AudioEngine.eatPlayer();
      AudioEngine.squelch(0.4);
      ParticleSystem.emitEngulf(data.x, 0.5, data.z, data.color, Math.sqrt(data.mass) * 2);
      AppState.shakeAmt = 10;
      if (data.streak > 1) AudioEngine.streak(data.streak);
      AppState.aberrationAmt = 0.5;
      HudSystem.spawnCombatPopup(new pc.Vec3(data.x, 20, data.z), `ENGULFED +${Math.floor(data.mass)}`, '#00ffff');
      AppState.myStats.sessionKills++; 
      HudSystem.showStreak(data.streak, AppState.myColor); 
      MetaSystem.unlockAchievement(1, HudSystem);
    });

    AppState.socket.on('feedbackBoost', () => { 
      ParticleSystem.splitEffect(AppState.cam.x, 5, AppState.cam.z, AppState.myColor); 
    });

    AppState.socket.on('splitEffect', () => { AudioEngine.split(); });
    
    AppState.socket.on('feedbackDecoyHit', ({x, z}) => {
      HudSystem.spawnCombatPopup(new pc.Vec3(x, 20, z), `DECOY ENGULFED: 0 MASS`, '#ff0055');
      AudioEngine.virusHit();
      AppState.shakeAmt = 20;
      AppState.aberrationAmt = 0.4;
    });

    AppState.socket.on('decoyPopped', ({x, z, color}) => {
      ParticleSystem.virusExplosion(x, 10, z, color);
    });

    AppState.socket.on('kill_feed', ({ killer, victim, color }) => {
      HudSystem.pushKillfeed(killer, victim, color);
    });

    AppState.socket.on('feedbackHit', () => {
      HudSystem.showHitMarker();
    });

    AppState.socket.on('feedbackOuch', () => {
      HudSystem.showOuchEffect();
      AppState.shakeAmt = 15;
    });
  }

  onWorldState(buf) {
    const data = MessagePack.decode(new Uint8Array(buf));
    const meServer = data.players.find(p => p && p.id === AppState.myId);
    
    if (meServer && meServer.lastSeq !== undefined) {
        AppState.lastProcessedSeq = meServer.lastSeq;
        AppState.pendingInputs = AppState.pendingInputs.filter(inp => inp.seq > AppState.lastProcessedSeq);
        const meLocal = AppState.gameState.players.find(p => p && p.id === AppState.myId);
        if (meLocal && meLocal.blobs) {
            meServer.blobs.forEach((sb, i) => {
                const lb = meLocal.blobs[i];
                if (lb) {
                    let predX = sb.x, predZ = sb.z;
                    let pvx = sb.vx || 0, pvz = sb.vz || 0;
                    AppState.pendingInputs.forEach(inp => {
                        const speed = 250 * Math.pow(sb.mass, -0.4) * (meServer.dashing ? 2.5 : 1);
                        pvx += (inp.dx * speed - pvx) * 0.15;
                        pvz += (inp.dz * speed - pvz) * 0.15;
                        predX += pvx * (0.05); 
                        predZ += pvz * (0.05);
                    });
                    const blend = 0.4;
                    lb.x += (predX - lb.x) * blend;
                    lb.z += (predZ - lb.z) * blend;
                    lb.vx = pvx; lb.vz = pvz;
                }
            });
        }
    }
    AppState.gameState.players = data.players;
    AppState.gameState.leaderboard = data.leaderboard;
    if (AppState.lastPingTime) {
      const el = document.getElementById('pingCount');
      if (el) el.textContent = Date.now() - AppState.lastPingTime;
    }
    AppState.lastPingTime = Date.now();
  }

  addChatMessage(msg) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span style="color:${msg.color || '#0ff'}">${msg.name}:</span> ${msg.text}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  clearGame() {
    AppState.gameActive = false;
    for (const id in AppState.pEnts) AppState.pEnts[id].ent.destroy();
    AppState.pEnts = {};
    for (const id in AppState.fEnts) AppState.fEnts[id].destroy();
    AppState.fEnts = {};
    for (const id in AppState.vEnts) AppState.vEnts[id].destroy();
    AppState.vEnts = {};
    const nt = document.getElementById('nametags');
    if (nt) nt.innerHTML = '';
  }

  buildArena() {
    if (this.arenaBuilt) return;
    this.arenaBuilt = true;
    const size = AppState.arenaSize || 3000;
    
    const fe = new pc.Entity('floor'); 
    fe.addComponent('model',{type:'plane'}); 
    fe.setLocalScale(size,1,size);
    const fm = new pc.StandardMaterial(); 
    fm.diffuse=new pc.Color(0.02,0.02,0.06); 
    fm.emissive=new pc.Color(0.01,0.01,0.04); 
    fm.update();
    fe.model.meshInstances[0].material=fm; 
    AppState.app.root.addChild(fe);

    const gm = new pc.StandardMaterial(); 
    gm.emissive=new pc.Color(0.0,0.12,0.38); 
    gm.emissiveIntensity=1.2; 
    gm.update();
    const step=150, half=size/2;
    for(let i=-half; i<=half; i+=step) {
      const vl=new pc.Entity(); vl.addComponent('model',{type:'box'}); vl.setLocalScale(1.5,2,size); vl.setPosition(i,1.5,0); vl.model.meshInstances[0].material=gm; AppState.app.root.addChild(vl);
      const hl=new pc.Entity(); hl.addComponent('model',{type:'box'}); hl.setLocalScale(size,2,1.5); hl.setPosition(0,1.5,i); hl.model.meshInstances[0].material=gm; AppState.app.root.addChild(hl);
      this.gridLines.push(vl, hl);
    }
  }

  getOrMakeBlobEnt(key, pid, color) {
    if (AppState.pEnts[key]) return AppState.pEnts[key];
    const e = new pc.Entity(`pb_${key}`); e.addComponent('model',{type:'sphere'});
    const mat = this.makeMat(color, 2.2);
    const tex = Skins.getTexture(AppState.app, pid, color);
    mat.diffuseMap = tex; mat.emissiveMap = tex; mat.update();
    e.model.meshInstances[0].material = mat;
    const gl = new pc.Entity(); 
    const c = this.hexToRgb01(color);
    gl.addComponent('light',{type:'point',color:new pc.Color(c.r,c.g,c.b),intensity:5,range:180});
    e.addChild(gl); AppState.app.root.addChild(e);
    AppState.pEnts[key] = { ent:e, tx:0, ty:0, tz:0, color: color }; 
    return AppState.pEnts[key];
  }

  getOrMakeFoodEnt(id, color) {
    if (AppState.fEnts[id]) return AppState.fEnts[id];
    const e = new pc.Entity(`f_${id}`); e.addComponent('model',{type:'sphere'});
    if (!this.foodMatCache[color]) this.foodMatCache[color] = this.makeMat(color, 3.5);
    e.model.meshInstances[0].material = this.foodMatCache[color];
    e.model.batchGroupId = AppState.batchGroups.food;
    AppState.app.root.addChild(e); 
    AppState.fEnts[id] = e; 
    return e;
  }

  getOrMakeVirusEnt(id) {
    if (AppState.vEnts[id]) return AppState.vEnts[id];
    const e = new pc.Entity(`v_${id}`); e.addComponent('model',{type:'sphere'});
    e.model.meshInstances[0].material = this.makeMat('#00ff44', 2.8);
    e.model.batchGroupId = AppState.batchGroups.virus;
    e.setLocalScale(25, 25, 25); 
    AppState.app.root.addChild(e);
    AppState.vEnts[id] = e; 
    return e;
  }

  makeMat(color, intensity = 2) {
    const c = this.hexToRgb01(color), mat = new pc.StandardMaterial();
    mat.diffuse = new pc.Color(c.r*0.1, c.g*0.1, c.b*0.1);
    mat.emissive = new pc.Color(c.r, c.g, c.b); 
    mat.emissiveIntensity = intensity;
    mat.useMetalness = true; mat.metalness = 0.5; mat.gloss = 0.9;
    mat.update();
    return mat;
  }

  massToRadius(m) { return Math.pow(m, 0.45) * 2.2; }
  hexToRgb01(hex) {
    return { r:parseInt(hex.slice(1,3),16)/255, g:parseInt(hex.slice(3,5),16)/255, b:parseInt(hex.slice(5,7),16)/255 };
  }

  respawn() {
    const deadEl = document.getElementById('dead');
    if (deadEl) deadEl.style.display = 'none';
    AppState.socket.emit('respawn', MessagePack.encode({ 
        name: AppState.myName, 
        color: AppState.myColor,
        mode: AppState.selectedMode || 'ffa',
        ability: AppState.selectedAbility || 'SHIELD'
    }));
  }

  selectMode(mode, el) {
    AppState.selectedMode = mode;
    document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
    if (el) el.classList.add('active');
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else if (document.exitFullscreen) document.exitFullscreen();
  }
}
