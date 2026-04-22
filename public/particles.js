// ─── PHAGE.LOL Visceral Particle System ───
window.Particles = (() => {
  const POOL_SIZE = 800; // Increased pool for lysis chaos
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
      pool.push({ ent, alive: false, life: 0, maxLife: 0, vx:0,vy:0,vz:0, drag:0.92, type: 'blob' });
    }
  }

  function hexToColor(hex) {
    return new pc.Color(parseInt(hex.slice(1,3),16)/255, parseInt(hex.slice(3,5),16)/255, parseInt(hex.slice(5,7),16)/255);
  }

  function spawn(x, y, z, color, count, speed, size, life, up=true, type='blob') {
    let spawned = 0;
    for (const p of pool) {
      if (p.alive) continue;
      if (spawned >= count) break;
      spawned++;
      const a = Math.random() * Math.PI * 2;
      const el = up ? (Math.random() * Math.PI * 0.5) : (Math.random() * Math.PI * 2);
      const sp = speed * (0.6 + Math.random() * 0.4);
      p.alive = true;
      p.life = life * (0.5 + Math.random() * 0.5);
      p.maxLife = p.life;
      p.vx = Math.cos(a) * Math.cos(el) * sp;
      p.vy = Math.sin(el) * sp * (up ? 1 : 0.5);
      p.vz = Math.sin(a) * Math.cos(el) * sp;
      p.drag = (type === 'organelle') ? 0.95 : 0.88;
      p.type = type;
      
      const s = size * (0.4 + Math.random() * 0.6);
      p.ent.setLocalScale(s,s,s);
      p.ent.setPosition(x + (Math.random()-0.5)*20, y, z + (Math.random()-0.5)*20);
      
      let mat = matCache.get(color + type);
      if (!mat) {
          mat = new pc.StandardMaterial();
          const c = hexToColor(color);
          mat.emissive = c; 
          mat.emissiveIntensity = type === 'cytoplasm' ? 1.5 : 4;
          mat.opacity = type === 'cytoplasm' ? 0.6 : 1.0;
          mat.blendType = type === 'cytoplasm' ? pc.BLEND_ADDITIVE : pc.BLEND_NORMAL;
          mat.diffuse = new pc.Color(c.r*0.1, c.g*0.1, c.b*0.1);
          mat.update();
          matCache.set(color + type, mat);
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
      
      if (p.type === 'blob') p.vy -= 120 * dt; // gravity
      else if (p.type === 'organelle') p.vy -= 40 * dt; // lighter float
      
      p.ent.setPosition(pos.x + p.vx*dt, Math.max(0, pos.y + p.vy*dt), pos.z + p.vz*dt);
      
      const t = p.life / p.maxLife;
      // Visceral scaling: start big, shrink fast, then linger as dust
      let sc = t * 15;
      if (p.type === 'cytoplasm') sc = (1.5 - t) * 20; // expands then fades
      
      if (sc > 0.1) p.ent.setLocalScale(sc,sc,sc);
    }
  }

  // Burst presets
  function eatFood(x, y, z, color) { spawn(x,y,z,color,12,180,10,0.5,true); }
  
  function eatPlayer(x, y, z, color) {
    // 1. Core Lysis Spray
    spawn(x,y,z,color,60,450,25,1.2,true, 'blob');
    // 2. Cytoplasmic Cloud
    spawn(x,y,z,color,20,150,40,0.8,true, 'cytoplasm');
    // 3. Organelle fragments
    spawn(x,y,z,'#ffffff',15,300,8,1.5,true, 'organelle');
  }
  
  function virusExplosion(x, y, z, color='#00ff44') {
    spawn(x,y,z,color,80,600,20,1.5,true, 'blob');
    spawn(x,y,z,'#ff00ff',20,400,30,0.8,true, 'cytoplasm');
    spawn(x,y,z,'#ffffff',30,350,10,2.0,true, 'organelle');
  }
  
  function splitEffect(x, y, z, color) { 
    spawn(x,y,z,color,15,250,12,0.4,false, 'blob'); 
  }
  
  function spawnEffect(x, y, z, color) { 
    spawn(x,y,z,color,30,250,15,0.8,true, 'blob'); 
  }

  function emitShieldBreak(x, y, z) {
    spawn(x, y, z, '#ffffff', 50, 400, 20, 0.7, true, 'blob');
  }

  function emitMagnetField(x, y, z, color) {
    for (let i = 0; i < 25; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 180 + Math.random() * 60;
        const px = x + Math.cos(angle) * dist;
        const pz = z + Math.sin(angle) * dist;
        spawn(px, y, pz, color || '#00ffcc', 1, -120, 6, 0.5, false, 'organelle');
    }
  }

  function emitDashTrail(x, y, z, color, radius) {
    spawn(x, y, z, color, 8, 0, radius * 1.1, 0.4, false, 'cytoplasm');
  }

  function emitAchievementStars(x, y, z) {
    spawn(x, y, z, '#FFD700', 40, 400, 5, 2.0, true, 'organelle');
  }

  return { init, update, eatFood, eatPlayer, virusExplosion, splitEffect, spawnEffect, emitShieldBreak, emitMagnetField, emitDashTrail, emitAchievementStars };
})();
