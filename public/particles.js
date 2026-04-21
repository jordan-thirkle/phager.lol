// ─── BLOBZ.IO Particle System ───
window.Particles = (() => {
  const POOL_SIZE = 600;
  let app = null;
  const pool = [];
  const matCache = new Map();
  let time = 0;

  function init(pcApp) {
    app = pcApp;
    for (let i = 0; i < POOL_SIZE; i++) {
      const ent = new pc.Entity(`pt_${i}`);
      ent.addComponent('model', { type: 'sphere' });
      ent.enabled = false;
      app.root.addChild(ent);
      pool.push({ ent, alive: false, life: 0, maxLife: 0, vx:0,vy:0,vz:0, drag:0.92 });
    }
  }

  function hexToColor(hex) {
    return new pc.Color(parseInt(hex.slice(1,3),16)/255, parseInt(hex.slice(3,5),16)/255, parseInt(hex.slice(5,7),16)/255);
  }

  function spawn(x, y, z, color, count, speed, size, life, up=true) {
    let spawned = 0;
    for (const p of pool) {
      if (p.alive) continue;
      if (spawned >= count) break;
      spawned++;
      const a = Math.random() * Math.PI * 2;
      const el = up ? (Math.random() * Math.PI * 0.5) : (Math.random() * Math.PI * 2);
      const sp = speed * (0.5 + Math.random() * 0.5);
      p.alive = true;
      p.life = life * (0.5 + Math.random() * 0.5);
      p.maxLife = p.life;
      p.vx = Math.cos(a) * Math.cos(el) * sp;
      p.vy = Math.sin(el) * sp * (up ? 1 : 0.5);
      p.vz = Math.sin(a) * Math.cos(el) * sp;
      p.drag = 0.88;
      const s = size * (0.4 + Math.random() * 0.6);
      p.ent.setLocalScale(s,s,s);
      p.ent.setPosition(x + (Math.random()-0.5)*10, y, z + (Math.random()-0.5)*10);
      
      let mat = matCache.get(color);
      if (!mat) {
          mat = new pc.StandardMaterial();
          const c = hexToColor(color);
          mat.emissive = c; mat.emissiveIntensity = 3;
          mat.diffuse = new pc.Color(c.r*0.2, c.g*0.2, c.b*0.2);
          mat.update();
          matCache.set(color, mat);
      }
      p.ent.model.meshInstances[0].material = mat;
      p.ent.enabled = true;
    }
  }

  function update(dt) {
    time += dt;
    for (const p of pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; p.ent.enabled = false; continue; }
      const pos = p.ent.getPosition();
      p.vx *= p.drag; p.vy *= p.drag; p.vz *= p.drag;
      p.vy -= 80 * dt; // gravity
      p.ent.setPosition(pos.x + p.vx*dt, Math.max(0, pos.y + p.vy*dt), pos.z + p.vz*dt);
      const t = p.life / p.maxLife;
      const sc = t * 12;
      if (sc > 0.1) p.ent.setLocalScale(sc,sc,sc);
      
      // We don't update material properties per-particle anymore since materials are shared.
      // If we need fading, we'd need separate materials or use vertex colors/opacity map.
      // For now, let's keep it simple and skip per-particle material updates for performance.
    }
  }

  // Burst presets
  function eatFood(x, y, z, color) { spawn(x,y,z,color,8,120,8,0.4,true); }
  function eatPlayer(x, y, z, color) {
    spawn(x,y,z,color,40,300,20,0.8,true);
    spawn(x,y,z,'#ffffff',15,200,6,0.5,true);
  }
  function virusExplosion(x, y, z) {
    spawn(x,y,z,'#00ff44',50,400,15,1.0,true);
    spawn(x,y,z,'#ffffff',20,250,5,0.6,true);
  }
  function splitEffect(x, y, z, color) { spawn(x,y,z,color,12,150,6,0.3,false); }
  function spawnEffect(x, y, z, color) { spawn(x,y,z,color,20,200,10,0.6,true); }

  function emitShieldBreak(x, y, z) {
    spawn(x, y, z, '#ffffff', 40, 300, 15, 0.6, true);
  }

  function emitMagnetField(x, y, z, color) {
    // Spawns particles that move toward center
    for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 150 + Math.random() * 50;
        const px = x + Math.cos(angle) * dist;
        const pz = z + Math.sin(angle) * dist;
        spawn(px, y, pz, color || '#00BFFF', 1, -80, 5, 0.4, false);
    }
  }

  function emitDashTrail(x, y, z, color, radius) {
    spawn(x, y, z, color, 5, 0, radius * 0.8, 0.35, false);
  }

  function emitAchievementStars(x, y, z) {
    spawn(x, y, z, '#FFD700', 25, 300, 4, 1.2, true);
  }

  return { init, update, eatFood, eatPlayer, virusExplosion, splitEffect, spawnEffect, emitShieldBreak, emitMagnetField, emitDashTrail, emitAchievementStars };
})();
