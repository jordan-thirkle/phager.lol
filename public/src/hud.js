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
    for (const p of AppState.gameState.players) {
      if (!p.blobs || !p.blobs.length) continue;
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

  return { updateXPBar, flashXP, showStreak, addKill, updateNametags, updateLeaderboard, updateFPS };
})();
