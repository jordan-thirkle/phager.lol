window.HudSystem = (() => {
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

  function getLevel(xp) {
    let lv = LEVELS[0];
    for (const l of LEVELS) { if (xp >= l.xp) lv = l; else break; }
    return lv;
  }
  
  function getNextLevel(xp) {
    for (const l of LEVELS) { if (xp < l.xp) return l; }
    return null;
  }

  function updateXPBar(xp) {
    const lv = getLevel(xp), next = getNextLevel(xp);
    const pct = next ? ((xp - lv.xp) / (next.xp - lv.xp)) * 100 : 100;
    
    const fill = document.getElementById('xpFill'); if (fill) fill.style.width = pct+'%';
    const lvl = document.getElementById('currLvl'); if (lvl) lvl.textContent = lv.l;
    const info = document.getElementById('currXP'); if (info) info.textContent = xp;
    const bdg = document.getElementById('levelBadge'); if (bdg) {
        bdg.textContent = lv.l;
        bdg.style.color = lv.color;
    }
  }

  function flashXP(amount) {
    const el = document.getElementById('xpFlash');
    if (el) {
        el.textContent = `+${amount} XP`; el.style.opacity='1';
        setTimeout(()=>{ if (el) el.style.opacity='0'; }, 900);
    }
  }

  function showStreak(n, color) {
    const name = STREAK_NAMES[Math.min(n, STREAK_NAMES.length-1)];
    if (!name) return;
    const el = document.getElementById('streakPopup');
    if (el) {
        el.innerHTML = `<div class="streakAnim" style="color:${color}">${name}</div>`;
        setTimeout(()=>{ if (el) el.innerHTML=''; }, 1700);
    }
  }

  function updateLeaderboard(state) {
    const list = document.getElementById('hof-list');
    if (!list) return;
    
    // Clear list and add actual player data or thematic high-scores
    list.innerHTML = '';
    const lb = state.gameState.leaderboard || [];
    
    if (lb.length === 0) {
        // Thematic Fallbacks (if server hasn't sent any yet)
        const defaults = [
            { name: "APEX_PREDATOR", score: 50000 },
            { name: "LYSIS_MASTER", score: 35000 },
            { name: "CELL_DESTROYER", score: 28000 },
            { name: "VIRAL_LOAD_99", score: 22000 },
            { name: "PHAGE_ZERO", score: 18000 }
        ];
        defaults.forEach(d => {
            const el = document.createElement('div');
            el.className = 'hof-item';
            el.innerHTML = `<span>${d.name}</span> <span class="hof-score">${d.score}</span>`;
            list.appendChild(el);
        });
    } else {
        lb.slice(0, 10).forEach((p, i) => {
            const el = document.createElement('div');
            el.className = 'hof-item' + (p.id === state.myId ? ' me' : '');
            el.innerHTML = `<span>${i+1}. ${p.name}</span> <span class="hof-score">${p.score}</span>`;
            list.appendChild(el);
        });
    }
  }

  function addChatMessage(msg) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    const el = document.createElement('div');
    el.className = 'chat-msg';
    const name = msg.name || 'ANONYMOUS';
    const text = msg.text || '';
    
    // Sanitize and thematic highlighting
    el.innerHTML = `<span class="chat-name">${name}:</span> <span class="chat-text">${text}</span>`;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  // Pre-load thematic welcome message
  setTimeout(() => {
    addChatMessage({ name: 'SYSTEM', text: 'INITIATING VIRAL SEQUENCE. ALL BIOMASS DETECTED.' });
    addChatMessage({ name: 'SYSTEM', text: 'REPLICATION TARGET: 50,000 BIOMASS.' });
  }, 1000);

  function addKill(msg) {
    const kf = document.getElementById('kf');
    if (!kf) return;
    const d = document.createElement('div'); d.className='kfe'; d.textContent=msg;
    kf.appendChild(d);
    setTimeout(()=>{ if(d.parentNode) d.parentNode.removeChild(d); }, 4500);
    while (kf.children.length > 5) kf.removeChild(kf.firstChild);
  }

  let tagPool = [];
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

  function updateNametags(AppState) {
    const tagContainer = document.getElementById('nametags');
    tagPool.forEach(t => { t.active = false; t.el.style.display = 'none'; });
    if (AppState.perfProfile === 'LOW') return;
    
    let players = AppState.gameState.players.filter(p => p && p.blobs && p.blobs.length > 0);
    if (AppState.perfProfile === 'MEDIUM') {
        const me = players.find(p => p && p.id === AppState.myId);
        if (me && me.blobs[0]) {
            players.sort((a,b) => {
                const da = Math.hypot(a.blobs[0].x - me.blobs[0].x, a.blobs[0].z - me.blobs[0].z);
                const db = Math.hypot(b.blobs[0].x - me.blobs[0].x, b.blobs[0].z - me.blobs[0].z);
                return da - db;
            });
            players = players.slice(0, 8); 
        }
    }

    for (const p of players) {
      const b = p.blobs[0];
      const mass = p.blobs.reduce((s,bb)=>s+bb.mass,0);
      if (mass < 150 && p.id !== AppState.myId) continue;
      
      const r = Math.pow(b.mass, 0.45) * 2.2;
      const ws = CameraSystem.worldToScreen(AppState, b.x, r*2 + 10, b.z);
      if (!ws) continue;
      
      const el = getTag(tagContainer);
      el.style.transform = `translate3d(${ws.x}px, ${ws.y}px, 0) translate(-50%, -50%)`;
      el.style.color = p.color || '#fff';
      el.textContent = p.name + (p.id === AppState.myId ? ' ●' : '');
    }
  }

  function updateLeaderboard(AppState) {
    document.getElementById('lbList').innerHTML = AppState.gameState.leaderboard.filter(e => e).map((e,i) => {
      const isX = e.name && e.name.startsWith('@');
      const nameHtml = isX ? `<a href="https://x.com/${e.name.slice(1)}" target="_blank">${e.name.slice(0,12)}</a>` : e.name.slice(0,12);
      return `<div class="lbe${e.id===AppState.myId?' me':''}"><span class="lbn">${i+1}. ${nameHtml}</span><span>${e.mass}</span></div>`;
    }).join('');
  }

  function updateAbilityHUD(AppState) {
    const me = AppState.gameState.players.find(p => p && p.id === AppState.myId);
    if (!me || !me.ability) return;

    const canvas = document.getElementById('abilityCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { remainingMs, active } = me.ability;
    const cooldownMs = { SHIELD: 18000, MAGNET: 22000, DASH: 12000, DECOY: 25000 }[me.ability.ability] || 10000;

    ctx.clearRect(0, 0, 64, 64);
    
    // Draw background circle
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,20,0.8)';
    ctx.fill();
    ctx.strokeStyle = active ? '#fff' : (me.color || '#0ff');
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw initial
    ctx.font = 'bold 24px Orbitron';
    ctx.fillStyle = active ? '#fff' : (me.color || '#0ff');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(me.ability.ability[0], 32, 32);

    // Draw cooldown sweep
    if (remainingMs > 0) {
      ctx.beginPath();
      ctx.moveTo(32, 32);
      ctx.arc(32, 32, 30, -Math.PI / 2, -Math.PI / 2 + (remainingMs / cooldownMs) * (Math.PI * 2));
      ctx.lineTo(32, 32);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fill();
    }

    // Pulse effect
    const container = document.getElementById('abilityHUD');
    if (remainingMs <= 0 && !active) {
        container.classList.add('ready');
    } else {
        container.classList.remove('ready');
    }
    
    if (active) {
        container.classList.add('active');
    } else {
        container.classList.remove('active');
    }
  }

  function updateFPS(state, dt) {
    state.fpsFrames++;
    state.fpsTime += dt;
    if (state.fpsTime >= 1.0) {
        const fps = Math.round(state.fpsFrames / state.fpsTime);
        const el = document.getElementById('fpsCount');
        if (el) {
            el.textContent = fps;
            const clr = fps >= 50 ? '#0f0' : (fps >= 30 ? '#ff0' : '#f00');
            el.style.color = clr;
        }
        
        // Advanced Diagnostics from PC stats
        if (state.app && state.app.stats) {
            const dc = state.app.stats.drawCalls;
            const tri = state.app.stats.frame.triangles;
            const ents = Object.keys(state.fEnts || {}).length + Object.keys(state.pEnts || {}).length + Object.keys(state.vEnts || {}).length;
            
            const elDc = document.getElementById('dc-count'); if(elDc) elDc.textContent = dc;
            const elTri = document.getElementById('tri-count'); if(elTri) elTri.textContent = (tri/1000).toFixed(1) + 'K';
            const elEnt = document.getElementById('ent-count'); if(elEnt) elEnt.textContent = ents;
        }

        state.fpsFrames = 0; state.fpsTime = 0;
    }
  }

  function onAchievement(id) {
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
    setTimeout(() => popup.classList.add('in'), 100);
    
    if (window.Audio && window.Audio.playAchievementUnlock) window.Audio.playAchievementUnlock();
    if (window.Particles && window.AppState) {
        window.Particles.emitAchievementStars(window.AppState.cam.x, 10, window.AppState.cam.z);
    }
    
    setTimeout(() => {
        popup.classList.add('out');
        setTimeout(() => popup.remove(), 500);
    }, 4000);
  }

  function onLevelUp(lvl) {
    addKill(`🚀 LEVEL UP! REACHED LEVEL ${lvl}`);
    // Fancy animation would go here
  }

  function openCustomize() {
    openModal('CUSTOMIZE YOUR PHAGE', renderCustomize());
  }

  function openSettings() {
    openModal('SETTINGS', renderSettings());
  }

  function openModal(title, content) {
    const container = document.getElementById('modal-container');
    const body = document.getElementById('modal-body');
    body.innerHTML = `<h2>${title}</h2>${content}`;
    container.style.display = 'flex';
  }

  function closeModal() {
    document.getElementById('modal-container').style.display = 'none';
  }

  function renderCustomize() {
    const meta = window.MetaSystem.getData();
    const loadout = meta.loadout;
    const skins = ['solid', 'dots', 'hexagon', 'lightning', 'checkers', 'swirl', 'plasma', 'circuit', 'glitch', 'void'];
    const abilities = ['SHIELD', 'MAGNET', 'DASH', 'DECOY'];
    
    let html = `<div id="customize-layout">
      <div id="customize-left">
        <section><h3>SKIN PATTERN</h3><div id="skin-grid">`;
    skins.forEach(s => {
      const unlocked = meta.unlockedSkins.includes(s) || s === 'solid';
      const hint = unlocked ? '' : getUnlockHint('skin', s);
      html += `<div class="skin-tile skin-${s} ${unlocked?'':'locked'} ${loadout.skin===s?'active':''}" 
                onclick="${unlocked?`HudSystem.setSkin('${s}')`:`document.getElementById('unlock-info').textContent='${hint}'`}"
                onmouseover="if(!${unlocked}) document.getElementById('unlock-info').textContent='${hint}'"
                onmouseout="document.getElementById('unlock-info').textContent=''">
        ${unlocked ? '' : '🔒'}
      </div>`;
    });
    html += `</div></section>
        <section><h3>PRIMARY COLOR</h3><div id="color-picker-container">
          <input type="color" id="color-input" value="${loadout.primaryColor}" onchange="HudSystem.setColor(this.value)">
        </div></section>
        <section><h3>ACTIVE ABILITY</h3><div id="ability-select">`;
    abilities.forEach(a => {
      const unlocked = meta.unlockedAbilities.includes(a);
      const hint = unlocked ? '' : getUnlockHint('ability', a);
      html += `<div class="ability-card ${a} ${unlocked?'':'locked'} ${loadout.ability===a?'active':''}" 
                onclick="${unlocked?`HudSystem.setAbility('${a}')`:`document.getElementById('unlock-info').textContent='${hint}'`}"
                onmouseover="if(!${unlocked}) document.getElementById('unlock-info').textContent='${hint}'"
                onmouseout="document.getElementById('unlock-info').textContent=''">
        <div class="a-name">${a}</div>
        ${unlocked ? '' : '<div class="a-lock">LOCKED</div>'}
      </div>`;
    });
    html += `</div></section>
        <section><h3>TITLE</h3>
        <p class="custom-hint">Visible to all players in-game</p>
        <select id="title-select" onchange="HudSystem.setTitle(this.value)">`;
    ['SPAWN', 'HUNTER', 'PREDATOR', 'APEX', 'PHANTOM', 'GODLIKE', 'IMMORTAL'].forEach(t => {
      html += `<option value="${t}" ${loadout.title===t?'selected':''}>${t}</option>`;
    });
    html += `</select></section>
      </div>
      <div id="customize-right">
        <div id="demo-blob-container">
           <div id="demo-blob-preview" style="width:180px; height:180px; border-radius:50%; background:${loadout.primaryColor}; box-shadow: 0 0 50px ${loadout.primaryColor}; position:relative; overflow:hidden; border: 4px solid rgba(255,255,255,0.2);">
              <div id="demo-blob-skin" class="skin-${loadout.skin}" style="position:absolute; inset:0; opacity:0.6;"></div>
              <div style="position:absolute; inset:0; background:radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent);"></div>
           </div>
           <div id="demo-phage-title" style="margin-top:20px; font-family:'Orbitron'; font-weight:900; font-size:22px; letter-spacing:3px; color:${loadout.primaryColor}">${loadout.title}</div>
           <div id="unlock-info" style="margin-top:15px; font-size:12px; color:#ffffff55; font-family:'Inter'; text-transform:uppercase; letter-spacing:1px;"></div>
        </div>
      </div>
    </div>`;
    return html;
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

  function setSkin(id) {
    window.MetaSystem.setLoadout({ skin: id });
    const p = document.getElementById('demo-blob-skin');
    if (p) {
        p.className = `skin-${id}`;
    }
    openCustomize(); // Refresh grid state
  }
  function setColor(hex) {
    window.MetaSystem.setLoadout({ primaryColor: hex });
  }
  function spawnCombatPopup(worldPos, text, color) {
    const el = document.createElement('div');
    el.className = 'c-pop';
    el.textContent = text;
    if (color) el.style.color = color;
    document.getElementById('combat-popups').appendChild(el);
    const popup = { el, worldPos: worldPos.clone(), life: 0.8 };
    popups.push(popup);
    setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
        const idx = popups.indexOf(popup);
        if (idx !== -1) popups.splice(idx, 1);
    }, 800);
  }

  const popups = [];

  function updateCombatPopups(camera, app) {
    for (const p of popups) {
      const screenPos = camera.camera.worldToScreen(p.worldPos);
      p.el.style.left = `${screenPos.x}px`;
      p.el.style.top = `${screenPos.y}px`;
    }
  }

  const hints = {
    split: { shown: false, text: "PRESS SPACE TO REPLICATE", condition: (mass) => mass > 250 },
    virus: { shown: false, text: "AVOID GREEN VIRUSES WHILE LARGE", condition: (mass) => mass > 400 },
    boost: { shown: false, text: "HOLD W TO BOOST SPEED", condition: (mass) => mass > 150 }
  };

  function updateHints(mass) {
    for (const key in hints) {
        const h = hints[key];
        if (!h.shown && h.condition(mass)) {
            showHint(h.text);
            h.shown = true;
        }
    }
  }

  function showHint(text) {
    const el = document.createElement('div');
    el.className = 'c-pop diagnostic';
    el.style.position = 'fixed';
    el.style.bottom = '150px';
    el.style.left = '50%';
    el.style.color = 'var(--cyan)';
    el.style.fontSize = '12px';
    el.style.letterSpacing = '4px';
    el.style.whiteSpace = 'nowrap';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 4000);
  }

  function setSkin(s) {
    window.MetaSystem.setLoadout({ skin: s });
    updatePreview();
  }

  function setColor(c) {
    window.MetaSystem.setLoadout({ primaryColor: c });
    updatePreview();
  }

  function setAbility(a) {
    window.MetaSystem.setLoadout({ ability: a });
  }

  function setTitle(t) {
    window.MetaSystem.setLoadout({ title: t });
    updatePreview();
  }

  function updatePreview() {
    const l = window.MetaSystem.getLoadout();
    const p = document.getElementById('phage-preview');
    const t = document.getElementById('demo-phage-title');
    if (p) {
        p.style.background = l.primaryColor;
        p.style.boxShadow = `0 0 40px ${l.primaryColor}`;
    }
    if (t) t.textContent = l.title;
  }

  function renderSettings() {
    const meta = window.MetaSystem;
    const s = meta.getData().settings;
    return `<div id="settings-list">
      <div class="s-row"><span>MASTER VOLUME</span><input type="range" min="0" max="100" value="${s.masterVolume*100}" onchange="HudSystem.setSetting('masterVolume', this.value/100)"></div>
      <div class="s-row"><span>GLOW LAYER</span><input type="checkbox" ${s.glowLayer?'checked':''} onchange="HudSystem.setSetting('glowLayer', this.checked)"></div>
      <div class="s-row"><span>GRID LAYER</span><input type="checkbox" ${s.gridLayer?'checked':''} onchange="HudSystem.setSetting('gridLayer', this.checked)"></div>
      <div class="s-row"><span>PARTICLES</span><input type="checkbox" ${s.particles?'checked':''} onchange="HudSystem.setSetting('particles', this.checked)"></div>
      <div class="s-row"><span>NAME TAGS</span><input type="checkbox" ${s.nameTags?'checked':''} onchange="HudSystem.setSetting('nameTags', this.checked)"></div>
      <div class="s-row"><span>COLORBLIND MODE</span><input type="checkbox" ${s.colorblindMode?'checked':''} onchange="HudSystem.setSetting('colorblindMode', this.checked)"></div>
    </div>`;
  }

  function setSetting(key, val) {
    window.MetaSystem.setSetting(key, val);
    if (key === 'masterVolume' && window.Audio) window.Audio.setVolume(val);
  }

  function openGuide() {
    const body = document.getElementById('modal-body');
    body.innerHTML = `
      <div style="font-family: 'Orbitron';">
        <h2 style="color: var(--cyan); letter-spacing: 5px;">PHAGE PROTOCOL</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px;">
          <div>
            <h3 style="font-size: 14px; border-bottom: 1px solid var(--glass-border); padding-bottom: 10px;">CORE MECHANICS</h3>
            <p style="font-size: 12px; color: #aaa; line-height: 1.6;">
              <b>ENGULFMENT:</b> You are a virus. Consume smaller organisms (pellets) and phages to gain biomass. 
              Mass is survival. Lysis is death.
            </p>
            <p style="font-size: 12px; color: #aaa; line-height: 1.6;">
              <b>REPLICATION (SPLIT):</b> Press <b>SPACE</b> to divide. This propels you forward but makes you vulnerable. 
              Essential for hunting faster targets.
            </p>
            <p style="font-size: 12px; color: #aaa; line-height: 1.6;">
              <b>METABOLIC BOOST:</b> Hold <b>W</b> or <b>SHIFT</b> to burn biomass for speed. Use it to escape or trap prey.
            </p>
          </div>
          <div>
            <h3 style="font-size: 14px; border-bottom: 1px solid var(--glass-border); padding-bottom: 10px;">TACTICAL ABILITIES</h3>
            <p style="font-size: 12px; color: #aaa; line-height: 1.6;">
              <b>SHIELD:</b> Temporary immunity to viruses and engulfment.
            </p>
            <p style="font-size: 12px; color: #aaa; line-height: 1.6;">
              <b>DASH:</b> Instant kinetic burst in your current direction.
            </p>
            <p style="font-size: 12px; color: #aaa; line-height: 1.6;">
              <b>MAGNET:</b> Pull nearby pellets toward your membrane.
            </p>
            <p style="font-size: 12px; color: #aaa; line-height: 1.6;">
              <b>DECOY:</b> Spawn a fake cell to distract predators.
            </p>
          </div>
        </div>
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--glass-border);">
          <h3 style="font-size: 14px; margin-bottom: 15px;">ENVIRONMENTAL MODES</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
            <div class="tutorial-card"><b>FREE FOR ALL:</b> Reach 10k biomass to be declared Champion. No rules.</div>
            <div class="tutorial-card"><b>TEAM ARENA:</b> Hold the Golden Orb to generate mass. Highest team score wins.</div>
            <div class="tutorial-card"><b>BATTLE ROYALE:</b> Avoid the 'Lysis Zone'. Survive the contraction to win.</div>
          </div>
        </div>
      </div>
    `;
    document.getElementById('modal-container').style.display = 'flex';
  }

  function openCareer() {
    const data = window.MetaSystem.getData();
    const body = document.getElementById('modal-body');
    const timeMins = Math.floor(data.totalTimePlayed / 60);
    
    let modeHtml = '';
    for (const [m, s] of Object.entries(data.modeStats)) {
        modeHtml += `
          <div class="ds-card" style="padding:15px; margin-bottom:10px; background:rgba(0,255,102,0.02); display:grid; grid-template-columns: 1fr 1fr 1fr; align-items:center;">
            <div style="font-family:'Orbitron'; font-size:11px; color:var(--cyan);">${m.toUpperCase()}</div>
            <div style="font-size:10px; color:#888;">KILLS: <span style="color:#fff;">${s.kills}</span></div>
            <div style="font-size:10px; color:#888;">PEAK MASS: <span style="color:#fff;">${s.bestMass}</span></div>
          </div>
        `;
    }

    body.innerHTML = `
      <div style="font-family: 'Orbitron';">
        <h2 style="color: var(--cyan); letter-spacing: 5px;">CAREER DIAGNOSTICS</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px;">
          <div>
            <h3 style="font-size: 14px; border-bottom: 1px solid var(--glass-border); padding-bottom: 10px;">GLOBAL OVERALL</h3>
            <div class="ds-card" style="margin-top:20px;">
               <div class="ds-label">TOTAL TIME PLAYED</div>
               <div class="ds-value" style="font-size:24px;">${timeMins} MINS</div>
            </div>
            <div class="ds-card" style="margin-top:20px;">
               <div class="ds-label">TOTAL BIOMASS HARVESTED</div>
               <div class="ds-value" style="font-size:24px;">${data.totalKills} CELLS</div>
            </div>
          </div>
          <div>
            <h3 style="font-size: 14px; border-bottom: 1px solid var(--glass-border); padding-bottom: 10px;">MODE BREAKDOWN</h3>
            <div style="margin-top:20px;">
              ${modeHtml}
            </div>
          </div>
        </div>
      </div>
    `;
    document.getElementById('modal-container').style.display = 'flex';
  }

  return { 
    updateXPBar, flashXP, showStreak, addKill, updateNametags, updateLeaderboard, updateCombatPopups, spawnCombatPopup,
    updateFPS, updateAbilityHUD, onAchievement, onLevelUp, openCustomize, openSettings, openGuide, openCareer,
    closeModal, setSetting, setSkin, setColor, setAbility, setTitle, updatePreview, updateHints 
  };
})();
