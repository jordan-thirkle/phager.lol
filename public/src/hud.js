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
    document.getElementById('xpBar').style.width = pct+'%';
    document.getElementById('xpLvl').textContent = `LV${lv.l} · ${lv.title}`;
    document.getElementById('xpLvl').style.color = lv.color;
    document.getElementById('xpNext').textContent = next ? `${xp-lv.xp} / ${next.xp-lv.xp}` : 'MAX';
    document.getElementById('levelBadge').textContent = `LV${lv.l}`;
    document.getElementById('levelBadge').style.color = lv.color;
  }

  function flashXP(amount) {
    const el = document.getElementById('xpFlash');
    el.textContent = `+${amount} XP`; el.style.opacity='1';
    setTimeout(()=>{ el.style.opacity='0'; }, 900);
  }

  function showStreak(n, color) {
    const name = STREAK_NAMES[Math.min(n, STREAK_NAMES.length-1)];
    if (!name) return;
    const el = document.getElementById('streakPopup');
    el.innerHTML = `<div class="streakAnim" style="color:${color}">${name}</div>`;
    setTimeout(()=>{ el.innerHTML=''; }, 1700);
  }

  function addKill(msg) {
    const kf = document.getElementById('kf');
    const d = document.createElement('div'); d.className='km'; d.textContent=msg;
    kf.appendChild(d);
    setTimeout(()=>{ if(d.parentNode) d.parentNode.removeChild(d); }, 4500);
    while (kf.children.length > 5) kf.removeChild(kf.firstChild);
  }

  function updateNametags(AppState) {
    const tagContainer = document.getElementById('nametags');
    // Using CSS transforms instead of left/top for performance (v2 spec)
    tagContainer.innerHTML = '';
    if (AppState.perfProfile === 'LOW') return;
    
    let players = AppState.gameState.players.filter(p => p.blobs && p.blobs.length > 0);
    if (AppState.perfProfile === 'MEDIUM') {
        const me = players.find(p => p.id === AppState.myId);
        if (me && me.blobs[0]) {
            players.sort((a,b) => {
                const da = Math.hypot(a.blobs[0].x - me.blobs[0].x, a.blobs[0].z - me.blobs[0].z);
                const db = Math.hypot(b.blobs[0].x - me.blobs[0].x, b.blobs[0].z - me.blobs[0].z);
                return da - db;
            });
            players = players.slice(0, 6); // Me + 5 others
        }
    }

    for (const p of players) {
      const b = p.blobs[0];
      const mass = p.blobs.reduce((s,bb)=>s+bb.mass,0);
      if (mass < 150 && p.id !== AppState.myId) continue;
      
      const r = Math.pow(b.mass, 0.45) * 2.2;
      const ws = CameraSystem.worldToScreen(AppState, b.x, r*2 + 10, b.z);
      if (!ws) continue;
      
      const tag = document.createElement('div');
      tag.className = 'ntag';
      tag.style.transform = `translate3d(${ws.x}px, ${ws.y}px, 0) translate(-50%, -50%)`;
      tag.style.color = p.color || '#fff';
      tag.textContent = p.name + (p.id === AppState.myId ? ' ●' : '');
      tagContainer.appendChild(tag);
    }
  }

  function updateLeaderboard(AppState) {
    document.getElementById('lbList').innerHTML = AppState.gameState.leaderboard.map((e,i)=>
      `<div class="lbe${e.id===AppState.myId?' me':''}"><span class="lbn">${i+1}. ${e.name.slice(0,12)}</span><span>${e.mass}</span></div>`
    ).join('');
  }

  function updateAbilityHUD(AppState) {
    const me = AppState.gameState.players.find(p => p.id === AppState.myId);
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

  function updateFPS(AppState, dt) {
    AppState.fpsFrames = (AppState.fpsFrames||0) + 1;
    AppState.fpsTime = (AppState.fpsTime||0) + dt;
    if(AppState.fpsTime >= 1){
      document.getElementById('fpsCount').textContent = AppState.fpsFrames;
      const clr = AppState.fpsFrames >= 50 ? '#0f0' : (AppState.fpsFrames >= 30 ? '#ff0' : '#f00');
      document.getElementById('fpsCount').style.color = clr;
      AppState.fpsFrames = 0; AppState.fpsTime = 0;
    }
  }

  function onAchievement(id) {
    const list = [
      { id:1, name:'FIRST BLOOD', desc:'Devour your first victim', reward:'Dots Skin' },
      { id:2, name:'MASS MONSTER', desc:'Reach 5000 mass', reward:'Hexagon Skin' },
      { id:3, name:'UNTOUCHABLE', desc:'Won FFA with 0 deaths', reward:'Phantom Title' },
      { id:4, name:'VIRUS KING', desc:'Triggered 10 virus explosions', reward:'Lightning Skin' },
      { id:5, name:'SPEED DEMON', desc:'Boosted 50 times', reward:'DASH Ability' },
      { id:6, name:'TEAM PLAYER', desc:'Won 3 Team Arena matches', reward:'Checkers Skin' },
      { id:7, name:'LAST STANDING', desc:'Won a Battle Royale', reward:'Immortal Badge' },
      { id:8, name:'PACIFIST', desc:'Reach 2000 mass with 0 kills', reward:'Swirl Skin' }
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
    openModal('CUSTOMIZE YOUR BLOB', renderCustomize());
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
      html += `<div class="skin-tile ${s} ${unlocked?'':'locked'} ${loadout.skin===s?'active':''}" onclick="${unlocked?`HudSystem.setSkin('${s}')`:''}">
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
      html += `<div class="ability-card ${a} ${unlocked?'':'locked'} ${loadout.ability===a?'active':''}" onclick="${unlocked?`HudSystem.setAbility('${a}')`:''}">
        <div class="a-name">${a}</div>
        ${unlocked ? '' : '<div class="a-lock">LOCKED</div>'}
      </div>`;
    });
    html += `</div></section>
        <section><h3>TITLE</h3><select id="title-select" onchange="HudSystem.setTitle(this.value)">`;
    ['SPAWN', 'HUNTER', 'PREDATOR', 'APEX', 'PHANTOM', 'GODLIKE', 'IMMORTAL'].forEach(t => {
      html += `<option value="${t}" ${loadout.title===t?'selected':''}>${t}</option>`;
    });
    html += `</select></section>
      </div>
      <div id="customize-right">
        <div id="demo-blob-container">
           <div id="demo-blob-preview" style="width:150px; height:150px; border-radius:50%; background:${loadout.primaryColor}; box-shadow: 0 0 40px ${loadout.primaryColor}; position:relative; overflow:hidden;">
              <div id="demo-blob-skin" class="skin-${loadout.skin}" style="position:absolute; inset:0; opacity:0.6;"></div>
           </div>
           <div id="demo-blob-title" style="margin-top:20px; font-family:'Orbitron'; font-weight:900; color:${loadout.primaryColor}">${loadout.title}</div>
        </div>
      </div>
    </div>`;
    return html;
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
    const p = document.getElementById('demo-blob-preview');
    if (p) {
        p.style.background = hex;
        p.style.boxShadow = `0 0 40px ${hex}`;
    }
    const t = document.getElementById('demo-blob-title');
    if (t) t.style.color = hex;
  }
  function setAbility(id) {
    window.MetaSystem.setLoadout({ ability: id });
    openCustomize(); // Refresh
  }
  function setTitle(t) {
    window.MetaSystem.setLoadout({ title: t });
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

  return { 
    updateXPBar, flashXP, showStreak, addKill, updateNametags, updateLeaderboard, 
    updateFPS, updateAbilityHUD, onAchievement, onLevelUp, openCustomize, openSettings, 
    closeModal, setSetting, setSkin, setColor, setAbility, setTitle 
  };
})();
