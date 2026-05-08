import { BLEND_ADDITIVE, BLEND_NORMAL, Color, Entity, StandardMaterial } from 'playcanvas';
import { AppState } from '../core/state.js';

// ─── PHAGE.LOL Visceral Particle System ───
const POOL_SIZE = 480; 
let app = null;
const pool = [];
const matCache = new Map();
let time = 0;
let enabled = true;

function hexToColor(hex) {
  return new Color(parseInt(hex.slice(1,3),16)/255, parseInt(hex.slice(3,5),16)/255, parseInt(hex.slice(5,7),16)/255);
}

export const ParticleSystem = {
  init(pcApp) {
    app = pcApp;
    enabled = true;
    for (let i = 0; i < POOL_SIZE; i++) {
      const ent = new Entity(`pt_${i}`);
      ent.addComponent('model', { type: 'sphere' });
      ent.enabled = false;
      app.root.addChild(ent);
      pool.push({ ent, alive: false, life: 0, maxLife: 0, vx:0,vy:0,vz:0, drag:0.92, type: 'blob' });
    }
  },

  setEnabled(nextEnabled) {
    enabled = !!nextEnabled;
    if (!enabled) {
      for (const p of pool) {
        p.alive = false;
        if (p.ent) p.ent.enabled = false;
      }
      this._accum = 0;
    }
  },

  getStats() {
    let active = 0;
    for (const p of pool) if (p.alive) active++;
    return { active, total: pool.length, enabled };
  },

  spawn(x, y, z, color, count, speed, size, life, up=true, type='blob') {
    if (!enabled || !AppState.MetaSystem?.getSetting('particles')) return;
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
          mat = new StandardMaterial();
          const c = hexToColor(color);
          mat.emissive = c; 
          mat.emissiveIntensity = type === 'cytoplasm' ? 1.5 : 4;
          mat.opacity = type === 'cytoplasm' ? 0.6 : 1.0;
          mat.blendType = type === 'cytoplasm' ? BLEND_ADDITIVE : BLEND_NORMAL;
          mat.diffuse = new Color(c.r*0.1, c.g*0.1, c.b*0.1);
          mat.update();
          matCache.set(color + type, mat);
      }
      p.ent.model.meshInstances[0].material = mat;
      p.ent.enabled = true;
    }
  },

  update(dt) {
    if (!enabled || !AppState.MetaSystem?.getSetting('particles')) return;
    this._accum = (this._accum || 0) + dt;
    const step = AppState.perfProfile === 'HIGH' ? 1 / 60 : 1 / 30;
    if (this._accum < step) return;
    dt = this._accum;
    this._accum = 0;
    time += dt;
    for (const p of pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; p.ent.enabled = false; continue; }
      const pos = p.ent.getPosition();
      p.vx *= p.drag; p.vy *= p.drag; p.vz *= p.drag;
      
      if (p.type === 'blob') p.vy -= 120 * dt; 
      else if (p.type === 'organelle') p.vy -= 40 * dt; 
      
      p.ent.setPosition(pos.x + p.vx*dt, Math.max(0, pos.y + p.vy*dt), pos.z + p.vz*dt);
      
      const t = p.life / p.maxLife;
      let sc = t * 15;
      if (p.type === 'cytoplasm') sc = (1.5 - t) * 20; 
      
      if (sc > 0.1) p.ent.setLocalScale(sc,sc,sc);
    }
  },

  eatFood(x, y, z, color) { this.spawn(x,y,z,color,12,180,10,0.5,true); },
  
  eatPlayer(x, y, z, color) {
    this.spawn(x,y,z,color,60,450,25,1.2,true, 'blob');
    this.spawn(x,y,z,color,20,150,40,0.8,true, 'cytoplasm');
    this.spawn(x,y,z,'#ffffff',15,300,8,1.5,true, 'organelle');
  },

  emitEngulf(x, y, z, color) {
    this.eatPlayer(x, y, z, color);
  },
  
  virusExplosion(x, y, z, color='#00ff44') {
    this.spawn(x,y,z,color,80,600,20,1.5,true, 'blob');
    this.spawn(x,y,z,'#ff00ff',20,400,30,0.8,true, 'cytoplasm');
    this.spawn(x,y,z,'#ffffff',30,350,10,2.0,true, 'organelle');
  },
  
  splitEffect(x, y, z, color) { 
    this.spawn(x,y,z,color,15,250,12,0.4,false, 'blob'); 
  },
  
  spawnEffect(x, y, z, color) { 
    this.spawn(x,y,z,color,30,250,15,0.8,true, 'blob'); 
  },

  emitShieldBreak(x, y, z) {
    this.spawn(x, y, z, '#ffffff', 50, 400, 20, 0.7, true, 'blob');
  },

  emitMagnetField(x, y, z, color) {
    for (let i = 0; i < 25; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 180 + Math.random() * 60;
        const px = x + Math.cos(angle) * dist;
        const pz = z + Math.sin(angle) * dist;
        this.spawn(px, y, pz, color || '#00ffcc', 1, -120, 6, 0.5, false, 'organelle');
    }
  },

  emitDashTrail(x, y, z, color, radius) {
    this.spawn(x, y, z, color, 8, 0, radius * 1.1, 0.4, false, 'cytoplasm');
  },

  emitAchievementStars(x, y, z) {
    this.spawn(x, y, z, '#FFD700', 40, 400, 5, 2.0, true, 'organelle');
  }
};
