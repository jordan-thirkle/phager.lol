window.MinimapSystem = (() => {
  let mmCtx = null;


  function init() {
    mmCtx = document.getElementById('mm').getContext('2d');
  }

  function draw(AppState) {
    if (!mmCtx) return;
    const me = AppState.gameState.players.find(p => p && p.id === AppState.myId);
    const size = 140, arena = AppState.arenaSize || 3000, s = size / arena;
    const ctx = mmCtx;

    ctx.fillStyle = 'rgba(0,0,20,0.95)';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(0,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(0,80,200,0.12)';
    ctx.lineWidth = 0.4;
    for (let i = 0; i < size; i += 14) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
    }

    // Food (Only draw if HIGH perf)
    if (AppState.perfProfile === 'HIGH') {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      for (const fid in AppState.fEnts) {
        const fe = AppState.fEnts[fid];
        if (!fe) continue;
        const p = fe.getLocalPosition(); // faster than getPosition
        const mx = (p.x + arena/2) * s, mz = (p.z + arena/2) * s;
        ctx.fillRect(mx-0.5, mz-0.5, 1, 1);
      }
    }

    // Players
    ctx.globalAlpha = 0.9;
    for (const p of AppState.gameState.players) {
      if (!p || !p.blobs) continue;
      for (const b of p.blobs) {
        const mx = (b.x + arena/2) * s, mz = (b.z + arena/2) * s;
        const r = Math.max(2, Math.pow(b.mass, 0.45) * 2.2 * s * 0.5);
        ctx.fillStyle = p.id === AppState.myId ? '#ffff00' : (p.color || '#ff0000');
        ctx.beginPath(); ctx.arc(mx, mz, r, 0, Math.PI*2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // My position indicator
    if (me && me.blobs && me.blobs.length) {
      const b = me.blobs[0];
      const mx = (b.x + arena/2) * s, mz = (b.z + arena/2) * s;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(mx, mz, 4, 0, Math.PI*2); ctx.stroke();
    }
  }

  return { init, draw };
})();
