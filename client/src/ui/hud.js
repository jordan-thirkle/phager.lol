import { Vec3 } from 'playcanvas';
// ─── PHAGE.LOL HUD System ───
const LEVELS = [
  {l:1,xp:0,title:'SPAWN',color:'#888888'},
  {l:2,xp:200,title:'HUNTER',color:'#44ff88'},
  {l:3,xp:600,title:'PREDATOR',color:'#00ffff'},
  {l:4,xp:1400,title:'APEX',color:'#ff8800'},
  {l:5,xp:3000,title:'PHANTOM',color:'#ff00ff'},
  {l:6,xp:6500,title:'GODLIKE',color:'#ffff00'},
  {l:7,xp:13000,title:'IMMORTAL',color:'#ff0044'},
];
const STREAK_NAMES = ['','','DOUBLE KILL','TRIPLE KILL','QUAD KILL','PENTA KILL','RAMPAGE!!','GODLIKE!!!'];
const popups = [];
let tagPool = [];

function getLevel(xp) {
  let lv = LEVELS[0];
  for (const l of LEVELS) { if (xp >= l.xp) lv = l; else break; }
  return lv;
}

function getNextLevel(xp) {
  for (const l of LEVELS) { if (xp < l.xp) return l; }
  return null;
}

function getTag(container) {
  let t = tagPool.find(x => !x.active);
  if (!t) {
      const el = document.createElement('div'); el.className = 'ntag';
      container.appendChild(el);
      t = { el, active: true };
      tagPool.push(t);
  }
  t.active = true; t.el.style.display = 'block';
  return t.el;
}

function getUnlockHint(type, id) {
  const hints = {
    skin: {
      dots: 'ACHIEVEMENT: FIRST CONTACT',
      hexagon: 'ACHIEVEMENT: BIOMASS MONSTER',
      lightning: 'ACHIEVEMENT: VIRUS KING',
      checkers: 'ACHIEVEMENT: TEAM PLAYER',
      swirl: 'ACHIEVEMENT: PACIFIST',
      plasma: 'REACH LEVEL 4',
      circuit: 'REACH LEVEL 5',
      glitch: 'REACH LEVEL 6',
      void: 'REACH LEVEL 7'
    },
    ability: {
      DASH: 'ACHIEVEMENT: SPEED DEMON',
      MAGNET: 'REACH LEVEL 3',
      DECOY: 'REACH LEVEL 5'
    }
  };
  return hints[type]?.[id] || 'LOCKED';
}

export const HudSystem = {
  updateXPBar(xp) {
    const lv = getLevel(xp), next = getNextLevel(xp);
    const pct = next ? ((xp - lv.xp) / (next.xp - lv.xp)) * 100 : 100;
    
    const fill = document.getElementById('xpFill'); if (fill) fill.style.width = pct+'%';
    const lvl = document.getElementById('currLvl'); if (lvl) lvl.textContent = lv.l;
    const info = document.getElementById('currXP'); if (info) info.textContent = xp;
    const bdg = document.getElementById('levelBadge'); if (bdg) {
        bdg.textContent = lv.l;
        bdg.style.color = lv.color;
    }
  },

  flashXP(amount) {
    const el = document.getElementById('xpFlash');
    if (el) {
        el.textContent = `+${amount} XP`; el.style.opacity='1';
        setTimeout(()=>{ if (el) el.style.opacity='0'; }, 900);
    }
  },

  showStreak(n, color) {
    const name = STREAK_NAMES[Math.min(n, STREAK_NAMES.length-1)];
    if (!name) return;
    const el = document.getElementById('streakPopup');
    if (el) {
        el.innerHTML = `<div class="streakAnim" style="color:${color}">${name}</div>`;
        setTimeout(()=>{ if (el) el.innerHTML=''; }, 1700);
    }
  },

  updateHallOfFame(hof) {
    const list = document.getElementById('hof-list');
    if (!list || !hof) return;
    const hofString = JSON.stringify(hof);
    if (AppState.uiCache.hof === hofString) return;
    AppState.uiCache.hof = hofString;
    
    list.innerHTML = '';
    hof.slice(0, 10).forEach((entry, i) => {
        const el = document.createElement('div');
        const date = new Date(entry.date).toLocaleDateString([], { month: 'short', day: 'numeric' });
        el.className = 'hof-item';
        el.innerHTML = `<span class="hof-rank">${i+1}.</span> <span class="hof-name">${entry.name}</span> <span class="hof-score">${entry.mass}</span> <span class="hof-date">${date}</span>`;
        list.appendChild(el);
    });
  },

  updateNametags(AppState) {
    const tagContainer = document.getElementById('nametags');
    if (!tagContainer) return;
    if (AppState.MetaSystem && AppState.MetaSystem.getSetting('nameTags') === false) {
        tagContainer.style.display = 'none';
        return;
    }
    tagContainer.style.display = 'block';
    
    // PERF: Throttle nametag updates if too many items are in the pool
    if (tagPool.length > 50 && AppState.animTime % 2 !== 0) return;

    tagPool.forEach(t => { t.active = false; t.el.style.display = 'none'; });
    if (AppState.perfProfile === 'LOW') return;
    
    let players = AppState.gameState.players.filter(p => p && p.blobs && p.blobs.length > 0);
    const me = players.find(p => p && p.id === AppState.myId);
    
    if (AppState.perfProfile === 'MEDIUM') {
        if (me && me.blobs[0]) {
            players.sort((a,b) => {
                const da = (a.blobs[0].x - me.blobs[0].x)**2 + (a.blobs[0].z - me.blobs[0].z)**2;
                const db = (b.blobs[0].x - me.blobs[0].x)**2 + (b.blobs[0].z - me.blobs[0].z)**2;
                return da - db;
            });
            players = players.slice(0, 10); 
        }
    }

    const cam = AppState.cameraEnt.camera;
    const viewDistSq = AppState.perfProfile === 'HIGH' ? 1000000 : 400000;

    for (const p of players) {
      const b = p.blobs[0];
      if (!b) continue;
      
      // Distance Culling for Nametags
      if (me && me.blobs[0] && p.id !== AppState.myId) {
          const dsq = (b.x - me.blobs[0].x)**2 + (b.z - me.blobs[0].z)**2;
          if (dsq > viewDistSq) continue;
      }

      const mass = p.blobs.reduce((s,bb)=>s+(bb?bb.mass:0),0);
      if (mass < 150 && p.id !== AppState.myId) continue;
      
      const r = Math.pow(b.mass, 0.45) * 2.2;
      const wp = new Vec3(b.x, r*2 + 10, b.z);
      const ws = cam.worldToScreen(wp);
      if (!ws) continue;
      
      const el = getTag(tagContainer);
      el.style.transform = `translate3d(${ws.x}px, ${ws.y}px, 0) translate(-50%, -50%)`;
      el.style.color = p.color || '#fff';
      const nameTxt = p.name + (p.id === AppState.myId ? ' ●' : '');
      if (el.textContent !== nameTxt) el.textContent = nameTxt;
    }
  },

  updateLeaderboard(AppState) {
    if (!AppState.gameState || !AppState.gameState.leaderboard) return;
    const listEl = document.getElementById('lbList');
    if (!listEl) return;

    const lb = AppState.gameState.leaderboard.filter(e => e);
    const lbString = JSON.stringify(lb);
    if (AppState.uiCache.leaderboard === lbString) return;
    AppState.uiCache.leaderboard = lbString;

    const topMass = lb[0] ? lb[0].mass : 0;

    listEl.innerHTML = lb.map((e, i) => {
      const isX = e.name && e.name.startsWith('@');
      const nameHtml = isX ? `<a href="https://x.com/${e.name.slice(1)}" target="_blank">${e.name.slice(0, 12)}</a>` : e.name.slice(0, 12);
      const isMe = e.id === AppState.myId;
      const gap = (i > 0 && isMe) ? `<span style="font-size:8px; opacity:0.6; margin-left:5px;">-${topMass - e.mass}</span>` : '';
      
      return `<div class="lbe${isMe ? ' me' : ''}">
        <span class="lbn">${i + 1}. ${nameHtml}${gap}</span>
        <span>${e.mass}</span>
      </div>`;
    }).join('');
  },

  pushKillfeed(attackerName, targetName, color) {
    const kf = document.getElementById('kf');
    if (!kf) return;
    const el = document.createElement('div');
    el.className = 'kfe';
    el.style.borderRightColor = color || 'var(--magenta)';
    el.innerHTML = `<span style="color:${color}">${attackerName}</span> ➔ <span>${targetName}</span>`;
    kf.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      setTimeout(() => el.remove(), 500);
    }, 4000);
  },

  showHitMarker() {
    const hm = document.getElementById('vfx-hitmarker');
    if (hm) {
      hm.style.opacity = '1';
      setTimeout(() => hm.style.opacity = '0', 150);
    }
  },

  showOuchEffect() {
    const ouch = document.getElementById('vfx-ouch');
    if (ouch) {
      ouch.style.opacity = '1';
      setTimeout(() => ouch.style.opacity = '0', 300);
    }
  },

  updateAbilityHUD(AppState) {
    const me = AppState.gameState.players.find(p => p && p.id === AppState.myId);
    if (!me || !me.ability) return;

    const canvas = document.getElementById('abilityCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { remainingMs, active } = me.ability;
    const cooldownMs = { SHIELD: 18000, MAGNET: 22000, DASH: 12000, DECOY: 25000 }[me.ability.ability] || 10000;

    ctx.clearRect(0, 0, 64, 64);
    ctx.beginPath(); ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,20,0.8)'; ctx.fill();
    ctx.strokeStyle = active ? '#fff' : (me.color || '#0ff'); ctx.lineWidth = 2; ctx.stroke();
    ctx.font = 'bold 24px Orbitron'; ctx.fillStyle = active ? '#fff' : (me.color || '#0ff');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(me.ability.ability[0], 32, 32);

    if (remainingMs > 0) {
      ctx.beginPath(); ctx.moveTo(32, 32);
      ctx.arc(32, 32, 30, -Math.PI / 2, -Math.PI / 2 + (remainingMs / cooldownMs) * (Math.PI * 2));
      ctx.lineTo(32, 32); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fill();
    }

    const container = document.getElementById('abilityHUD');
    if (container) {
      if (remainingMs <= 0 && !active) container.classList.add('ready');
      else container.classList.remove('ready');
      
      if (active) container.classList.add('active');
      else container.classList.remove('active');
    }
  },

  updateFPS(state, dt) {
    state.fpsFrames++; state.fpsTime += dt;
    if (state.fpsTime >= 1.0) {
        const fps = Math.round(state.fpsFrames / state.fpsTime);
        const el = document.getElementById('fpsCount');
        if (el) {
            el.textContent = fps;
            const clr = fps >= 50 ? '#0f0' : (fps >= 30 ? '#ff0' : '#f00');
            el.style.color = clr;
        }
        if (state.app && state.app.stats) {
            const dc = state.app.stats.drawCalls.total !== undefined ? state.app.stats.drawCalls.total : state.app.stats.drawCalls;
            const tri = state.app.stats.frame.triangles;
            const ents = Object.keys(state.fEnts || {}).length + Object.keys(state.pEnts || {}).length + Object.keys(state.vEnts || {}).length;
            const elDc = document.getElementById('dc-count'); if(elDc) elDc.textContent = dc;
            const elTri = document.getElementById('tri-count'); if(elTri) elTri.textContent = (tri/1000).toFixed(1) + 'K';
            const elEnt = document.getElementById('ent-count'); if(elEnt) elEnt.textContent = ents;
        }
        state.fpsFrames = 0; state.fpsTime = 0;
    }
  },

  onAchievement(id, AudioEngine, Particles, AppState) {
    const list = [
      { id:1, name:'FIRST CONTACT', desc:'Engulf your first victim', reward:'Dots Skin' },
      { id:2, name:'BIOMASS MONSTER', desc:'Reach 5000 biomass', reward:'Hexagon Skin' },
      { id:3, name:'UNTOUCHABLE', desc:'Won FFA with 0 lysis events', reward:'Phantom Title' },
      { id:4, name:'VIRUS KING', desc:'Triggered 10 phage explosions', reward:'Lightning Skin' },
      { id:5, name:'SPEED DEMON', desc:'Boosted 50 times', reward:'DASH Ability' },
      { id:6, name:'TEAM PLAYER', desc:'Won 3 Team Arena matches', reward:'Checkers Skin' },
      { id:7, name:'LAST STANDING', desc:'Won a Battle Royale', reward:'Immortal Badge' },
      { id:8, name:'PACIFIST', desc:'Reach 2000 biomass with 0 engulfs', reward:'Swirl Skin' }
    ];
    const a = list.find(x => x.id === id);
    if (!a) return;

    const popup = document.createElement('div');
    popup.className = 'ach-popup';
    popup.innerHTML = `
      <div class="ach-icon">🏆</div>
      <div class="ach-text">
        <div class="ach-title">${a.name}</div>
        <div class="ach-desc">${a.desc}</div>
        <div class="ach-reward">REWARD: ${a.reward}</div>
      </div>
    `;
    document.body.appendChild(popup);
    setTimeout(() => popup.classList.add('in'), 10);
    
    if (AudioEngine && AudioEngine.playAchievementUnlock) AudioEngine.playAchievementUnlock();
    if (Particles && AppState) {
        Particles.emitAchievementStars(AppState.cameraEnt.getPosition().x, 10, AppState.cameraEnt.getPosition().z);
    }
    
    setTimeout(() => {
        popup.classList.add('out');
        setTimeout(() => popup.remove(), 500);
    }, 4000);
  },

  spawnCombatPopup(worldPos, text, color) {
    const el = document.createElement('div');
    el.className = 'c-pop'; el.textContent = text;
    if (color) el.style.color = color;
    const container = document.getElementById('combat-popups');
    if (container) container.appendChild(el);
    const popup = { el, worldPos: worldPos.clone(), life: 0.8 };
    popups.push(popup);
    setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
        const idx = popups.indexOf(popup);
        if (idx !== -1) popups.splice(idx, 1);
    }, 800);
  },

  updateCombatPopups(camera) {
    const cam = camera.camera;
    for (const p of popups) {
      const screenPos = cam.worldToScreen(p.worldPos);
      if (screenPos) {
        p.el.style.left = `${screenPos.x}px`; p.el.style.top = `${screenPos.y}px`;
      }
    }
  },

  triggerMembraneFlash() {
      AppState.flashAmt = 1.0;
  },

  updateHints(mass) {
    if (!this._hints) this._hints = {
      split: { shown: false, text: "PRESS SPACE TO REPLICATE", condition: (m) => m > 250 },
      virus: { shown: false, text: "AVOID GREEN VIRUSES WHILE LARGE", condition: (m) => m > 400 },
      boost: { shown: false, text: "HOLD SHIFT TO BOOST SPEED", condition: (m) => m > 150 }
    };
    for (const key in this._hints) {
        const h = this._hints[key];
        if (!h.shown && h.condition(mass)) {
            this.showHint(h.text); h.shown = true;
        }
    }
  },

  showHint(text) {
    const el = document.createElement('div');
    el.className = 'c-pop diagnostic'; el.style.position = 'fixed'; el.style.bottom = '150px';
    el.style.left = '50%'; el.style.color = 'var(--cyan)'; el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 4000);
  },

  openModal(title, content) {
    const container = document.getElementById('modal-container');
    const body = document.getElementById('modal-body');
    if (body) body.innerHTML = `<h2>${title}</h2>${content}`;
    if (container) container.style.display = 'flex';
  },

  closeModal() {
    const container = document.getElementById('modal-container');
    if (container) container.style.display = 'none';
  },

  openCustomize(MetaSystem) {
    this.openModal('CUSTOMIZE YOUR PHAGE', this.renderCustomize(MetaSystem));
  },
  setSkin(s, MetaSystem) {
    const meta = MetaSystem.getData();
    if (meta.unlockedSkins.includes(s) || s === 'solid') {
      MetaSystem.setLoadout({ skin: s });
      this.openCustomize(MetaSystem);
    }
  },

  setColor(c, MetaSystem) {
    MetaSystem.setLoadout({ primaryColor: c });
    this.openCustomize(MetaSystem);
  },

  setAbility(a, MetaSystem) {
    const meta = MetaSystem.getData();
    if (meta.unlockedAbilities.includes(a)) {
      MetaSystem.setLoadout({ ability: a });
      this.openCustomize(MetaSystem);
    }
  },

  setTitle(t, MetaSystem) {
    MetaSystem.setLoadout({ title: t });
    this.openCustomize(MetaSystem);
  },


  renderCustomize(MetaSystem) {
    const meta = MetaSystem.getData();
    const loadout = meta.loadout;
    const skins = ['solid', 'dots', 'hexagon', 'lightning', 'checkers', 'swirl', 'plasma', 'circuit', 'glitch', 'void'];
    const abilities = ['SHIELD', 'MAGNET', 'DASH', 'DECOY'];
    
    let html = `<style>#customize-layout { display: flex; gap: 40px; } #customize-left { flex: 1; } #customize-right { width: 250px; display: flex; flex-direction: column; align-items: center; justify-content: center; } #skin-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 10px; } .skin-tile { height: 80px; background: rgba(0,255,102,0.05); border: 1px solid var(--glass-border); border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 24px; transition: 0.3s; } .skin-tile:hover { background: rgba(0,255,102,0.15); border-color: var(--cyan); } .skin-tile.active { border-color: var(--cyan); box-shadow: 0 0 15px var(--cyan); } .skin-tile.locked { opacity: 0.3; cursor: not-allowed; } #ability-select { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; } .ability-card { background: rgba(0,255,102,0.05); border: 1px solid var(--glass-border); padding: 15px; border-radius: 8px; cursor: pointer; text-align: center; transition: 0.3s; } .ability-card:hover { background: rgba(0,255,102,0.15); border-color: var(--cyan); } .ability-card.active { border-color: var(--cyan); box-shadow: 0 0 15px var(--cyan); } .ability-card.locked { opacity: 0.3; cursor: not-allowed; } .a-name { font-family: 'Orbitron'; font-weight: 900; color: var(--cyan); margin-bottom: 5px; } .a-lock { font-size: 10px; color: var(--magenta); }</style><div id="customize-layout">
      <div id="customize-left">
        <section><h3>SKIN PATTERN</h3><div id="skin-grid">`;
    skins.forEach(s => {
      const unlocked = meta.unlockedSkins.includes(s) || s === 'solid';
      const hint = unlocked ? '' : getUnlockHint('skin', s);
      html += `<div class="skin-tile skin-${s} ${unlocked?'':'locked'} ${loadout.skin===s?'active':''}" 
                onclick="${unlocked?`HudSystem.setSkin('${s}')`:`document.getElementById('unlock-info').textContent='${hint}'`}">
        ${unlocked ? '' : '🔒'}
      </div>`;
    });
    html += `</div></section>
        <section><h3>PRIMARY COLOR</h3><input type="color" id="color-input" value="${loadout.primaryColor}" onchange="HudSystem.setColor(this.value)"></section>
        <section><h3>ACTIVE ABILITY</h3><div id="ability-select">`;
    abilities.forEach(a => {
      const unlocked = meta.unlockedAbilities.includes(a);
      const hint = unlocked ? '' : getUnlockHint('ability', a);
      html += `<div class="ability-card ${a} ${unlocked?'':'locked'} ${loadout.ability===a?'active':''}" 
                onclick="${unlocked?`HudSystem.setAbility('${a}')`:`document.getElementById('unlock-info').textContent='${hint}'`}">
        <div class="a-name">${a}</div>
        ${unlocked ? '' : '<div class="a-lock">LOCKED</div>'}
      </div>`;
    });
    html += `</div></section>
      </div>
      <div id="customize-right">
        <div id="demo-blob-container">
           <div id="demo-blob-preview" style="width:180px; height:180px; border-radius:50%; background:${loadout.primaryColor}; box-shadow: 0 0 50px ${loadout.primaryColor}; position:relative; overflow:hidden; border: 4px solid rgba(255,255,255,0.2);">
              <div id="demo-blob-skin" class="skin-${loadout.skin}" style="position:absolute; inset:0; opacity:0.6;"></div>
           </div>
           <div id="demo-phage-title" style="margin-top:20px; font-family:'Orbitron'; font-weight:900; font-size:22px; color:${loadout.primaryColor}">${loadout.title}</div>
           <div id="unlock-info" style="margin-top:20px; font-size:11px; color:var(--magenta); font-family:Orbitron;"></div>
        </div>
      </div>
    </div>`;
    return html;
  },

  openSettings(MetaSystem) {
    const s = MetaSystem.getData().settings;
    const content = `<div id="settings-list">
      <div class="s-row"><span>MASTER VOLUME</span><input type="range" min="0" max="100" value="${s.masterVolume*100}" onchange="HudSystem.setSetting('masterVolume', this.value/100)"></div>
      <div class="s-row"><span>GLOW LAYER</span><input type="checkbox" ${s.glowLayer?'checked':''} onchange="HudSystem.setSetting('glowLayer', this.checked)"></div>
      <div class="s-row"><span>GRID LAYER</span><input type="checkbox" ${s.gridLayer?'checked':''} onchange="HudSystem.setSetting('gridLayer', this.checked)"></div>
      <div class="s-row"><span>PARTICLES</span><input type="checkbox" ${s.particles?'checked':''} onchange="HudSystem.setSetting('particles', this.checked)"></div>
      <div class="s-row"><span>NAME TAGS</span><input type="checkbox" ${s.nameTags?'checked':''} onchange="HudSystem.setSetting('nameTags', this.checked)"></div>
    </div>`;
    this.openModal('SETTINGS', content);
  },

  openGuide() {
    this.openModal('PHAGE PROTOCOL', `<div class="tutorial-card"><b>SPACE</b> to split. <b>SHIFT</b> to boost. <b>Q</b> for Ability. <br><br> Engage smaller phages to engulf their biomass. Larger phages will lyse you on contact.</div>`);
  },

  openCareer(MetaSystem) {
    const data = MetaSystem.getData();
    this.openModal('CAREER DIAGNOSTICS', `
      <div class="career-stats" style="display:grid; grid-template-columns:1fr 1fr; gap:20px; font-family:Orbitron;">
        <div class="ds-card"><div class="ds-label">TOTAL XP</div><div class="ds-value">${data.totalXP}</div></div>
        <div class="ds-card"><div class="ds-label">BEST MASS</div><div class="ds-value">${data.bestBiomass}</div></div>
        <div class="ds-card"><div class="ds-label">TOTAL KILLS</div><div class="ds-value">${data.totalKills}</div></div>
        <div class="ds-card"><div class="ds-label">SKINS UNLOCKED</div><div class="ds-value">${data.unlockedSkins.length}</div></div>
      </div>
    `);
  },

  showHitMarker() {
    const el = document.getElementById('vfx-hitmarker');
    if (!el) return;
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 100);
  },

  showOuchEffect() {
    const el = document.getElementById('vfx-ouch');
    if (!el) return;
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 150);
  },

  /**
   * Updates general player status and triggers meta-progression updates.
   * @param {number} mass - Current total biomass.
   * @param {number} kills - Current session kills.
   * @param {Object} AppState - The global application state.
   */
  updateStatus(mass, kills, AppState) {
    const metaApi = AppState.MetaSystem || window.MetaSystem;
    const meta = metaApi && typeof metaApi.getData === 'function' ? metaApi.getData() : null;
    if (meta) this.updateXPBar(meta.totalXP);
    this.updateHints(mass);
    
    // Update death screen placeholders proactively
    const dMass = document.getElementById('d_mass');
    const dKills = document.getElementById('d_kills');
    if (dMass) dMass.textContent = Math.floor(mass);
    if (dKills) dKills.textContent = kills;
  },

  /**
   * Triggered when the player reaches a new virulence level.
   * @param {number} level - The new level reached.
   */
  onLevelUp(level) {
    const el = document.createElement('div');
    el.className = 'streakAnim';
    el.style.color = 'var(--cyan)';
    el.style.fontSize = '40px';
    el.innerHTML = `EVOLUTION COMPLETE<br><span style="font-size:20px">REACHED LEVEL ${level}</span>`;
    
    const container = document.getElementById('streakPopup');
    if (container) {
        container.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    }
    
    if (window.AudioEngine && window.AudioEngine.playAchievementUnlock) {
        window.AudioEngine.playAchievementUnlock();
    }
  }
};
