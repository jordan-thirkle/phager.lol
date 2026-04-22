import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import * as msgpack from '@msgpack/msgpack';
import { AbilitySystem } from './src/abilities/AbilitySystem.js';
import ModeManager from './src/modes/ModeManager.js';
import FFA from './src/modes/FFA.js';
import TeamArena from './src/modes/TeamArena.js';
import BattleRoyale from './src/modes/BattleRoyale.js';
import fs from 'fs';
import path, { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);
global.io = io;

process.on('uncaughtException', (err) => {
  console.error('🔥 UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 UNHANDLED REJECTION:', reason);
});

// --- PATH B: PERSISTENCE BRIDGE ---
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

class PersistentStore {
  constructor(filename, defaultData = []) {
    this.path = path.join(DATA_DIR, filename);
    this.data = defaultData;
    this.load();
  }
  load() {
    try {
      if (fs.existsSync(this.path)) {
        this.data = JSON.parse(fs.readFileSync(this.path, 'utf8'));
      }
    } catch (e) { console.error(`Failed to load ${this.path}`, e); }
  }
  save() {
    try {
      const tempPath = this.path + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(this.data), 'utf8');
      try {
        fs.renameSync(tempPath, this.path);
      } catch (renameErr) {
        if (renameErr.code === 'EPERM') {
            // Fallback for Windows file locking issues
            fs.writeFileSync(this.path, JSON.stringify(this.data), 'utf8');
        } else {
            throw renameErr;
        }
      }
    } catch (e) { console.error(`Failed to save ${this.path}`, e); }
  }
}

const hofStore = new PersistentStore('hallOfFame.json', []);
const chatStore = new PersistentStore('chatHistory.json', [
  { name: 'DIAGNOSTIC', text: 'PHAGE PROTOCOL INITIALIZED.' },
  { name: 'DIAGNOSTIC', text: 'SCANNING FOR SUSCEPTIBLE BIOMASS...' }
]);

app.use(express.static(path.join(__dirname, '../client/public')));
app.use(express.static(path.join(__dirname, '../dist')));

const TICK_MS = 1000 / 20;
const MIN_MASS = 40;
const MAX_MASS = 25000;
const BASE_SPEED = 220;
const SPLIT_SPEED = 800;
const BOOST_THRUST = 550;
const BOOST_MASS_COST = 20;
const MAX_BLOBS = 16;
const GRID_SIZE = 400; // Size of each tactical cell

let globalChatBuffer = chatStore.data;
const MAX_CHAT_LOG = 30;

class GameRoom {
  constructor(id, modeConfig) {
    this.id = id;
    this.mode = new ModeManager(modeConfig);
    this.arena = this.mode.getArenaSize().x;
    this.players = {};
    this.foods = {};
    this.viruses = {};
    this.decoys = [];
    this.abilities = new Map();
    this.grid = new Map();
    this.lastFoodId = 0;
    this.foodPool = []; // Recycled IDs
    this.lastVirusId = 0;
    this.gameTime = 0;

    for(let i=0; i<700; i++) this.spawnFood();
    for(let i=0; i<20; i++) this.spawnVirus();
    this.botTimer = setInterval(() => this.scaleBots(), 10000);
  }

  rndArena(isRespawn = false) { 
    let attempts = 0;
    let pos;
    do {
      if (this.mode.mode.zone) {
          const r = this.mode.mode.zone.radius * 0.8;
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * r;
          pos = { x: this.mode.mode.zone.centerX + Math.cos(angle) * dist, z: this.mode.mode.zone.centerZ + Math.sin(angle) * dist };
      } else {
          pos = { x: (Math.random() - 0.5) * this.arena, z: (Math.random() - 0.5) * this.arena }; 
      }
      attempts++;
      // Safe Respawn check: no player with > 500 mass nearby
      if (isRespawn) {
          const safe = !Object.values(this.players).some(p => p.blobs && p.blobs.some(b => b.mass > 500 && Math.hypot(b.x - pos.x, b.z - pos.z) < 400));
          if (safe) break;
      } else break;
    } while (attempts < 10);
    return pos;
  }

  spawnFood() {
    const id = this.foodPool.length > 0 ? this.foodPool.pop() : ++this.lastFoodId;
    const pos = this.rndArena();
    const f = { id, x: pos.x, z: pos.z, mass: 3, color: '#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0') };
    this.foods[id] = f;
    io.to(this.id).emit('foodSpawn', f);
  }

  spawnVirus() {
    this.lastVirusId++;
    let pos;
    do { pos = this.rndArena(); } while(Object.values(this.players).some(p=>p.blobs&&p.blobs.some(b=>Math.hypot(b.x-pos.x, b.z-pos.z)<150)));
    const v = { id: this.lastVirusId, x: pos.x, z: pos.z };
    this.viruses[this.lastVirusId] = v;
    io.to(this.id).emit('virusSpawn', v);
  }

  scaleBots() {
    const humanCount = Object.values(this.players).filter(p => !p.isBot).length;
    const targetBotCount = Math.max(15, 40 - humanCount);
    const currentBots = Object.values(this.players).filter(p => p.isBot);
    if (currentBots.length < targetBotCount) this.addBot();
    else if (currentBots.length > targetBotCount) {
      const lowest = currentBots.sort((a,b) => a.score - b.score)[0];
      if (lowest) this.removePlayer(lowest.id);
    }
  }

  addBot() {
    const id = 'bot_' + Math.random().toString(36).substr(2, 9);
    const bioNames = ['PHAGE-X', 'LYSIS-B', 'CELL-STALKER', 'BIO-TOXIN', 'MEMBRANE-RIPPER', 'ZYGOTE-NULL', 'VIRAL-PRIME', 'METABOLIC-VOID', 'CYTO-STORM', 'EXO-GHOST'];
    const name = bioNames[Math.floor(Math.random() * bioNames.length)] + '_' + Math.floor(Math.random() * 999);
    
    const ability = ['SHIELD', 'DASH', 'MAGNET', 'DECOY'][Math.floor(Math.random()*4)];
    const color = ['#ff0088','#00ffff','#ffff00','#ff6600','#00ff88','#ff00ff','#00ffcc','#ffcc00'][Math.floor(Math.random()*8)];

    const bot = {
      id, isBot: true,
      name: name,
      color: color,
      blobs: [{ id: `${id}_0`, x: (Math.random()-0.5)*this.arena, z: (Math.random()-0.5)*this.arena, vx: 0, vz: 0, mass: 100 + Math.random()*150 }],
      score: 0, kills: 0, streak: 0, xp: 0, lastSplit: 0, input: { dx: 0, dz: 0 },
      activeAbility: ability, botTargetTime: 0
    };
    this.players[id] = bot;
    this.abilities.set(id, { ability, remainingMs: 0, active: false, activeDuration: 0 });
    this.mode.onPlayerJoin(bot, this);
  }

  removePlayer(id) {
    const p = this.players[id];
    if (p) {
        this.mode.onPlayerDeath(p, this);
        delete this.players[id];
        this.abilities.delete(id);
    }
  }

  buildSpatialHash() {
    this.grid.clear();
    for (const id in this.foods) {
      const f = this.foods[id];
      const cx = Math.floor(f.x / GRID_SIZE), cz = Math.floor(f.z / GRID_SIZE);
      const key = `${cx},${cz}`;
      if (!this.grid.has(key)) this.grid.set(key, { foods: [], viruses: [], blobs: [] });
      this.grid.get(key).foods.push(f);
    }
    for (const id in this.viruses) {
      const v = this.viruses[id];
      const cx = Math.floor(v.x / GRID_SIZE), cz = Math.floor(v.z / GRID_SIZE);
      const key = `${cx},${cz}`;
      if (!this.grid.has(key)) this.grid.set(key, { foods: [], viruses: [], blobs: [] });
      this.grid.get(key).viruses.push(v);
    }
    for (const pid in this.players) {
      const p = this.players[pid];
      if (!p || !p.blobs) continue;
      for (let i = 0; i < p.blobs.length; i++) {
        const b = p.blobs[i];
        if (!b) continue;
        const cx = Math.floor(b.x / GRID_SIZE), cz = Math.floor(b.z / GRID_SIZE);
        const key = `${cx},${cz}`;
        if (!this.grid.has(key)) this.grid.set(key, { foods: [], viruses: [], blobs: [], decoys: [] });
        this.grid.get(key).blobs.push({ pid, idx: i, blob: b });
      }
    }
    // Add Decoys to Spatial Hash for mechanical interaction
    for (let i = 0; i < this.decoys.length; i++) {
      const d = this.decoys[i];
      if (!d) continue;
      const cx = Math.floor(d.x / GRID_SIZE), cz = Math.floor(d.z / GRID_SIZE);
      const key = `${cx},${cz}`;
      if (!this.grid.has(key)) this.grid.set(key, { foods: [], viruses: [], blobs: [], decoys: [] });
      const cell = this.grid.get(key);
      if (cell && cell.decoys) {
        cell.decoys.push({ idx: i, decoy: d });
      }
    }
  }

  getNearbyCells(x, z, rangePx = 1000) {
    const cx = Math.floor(x / GRID_SIZE), cz = Math.floor(z / GRID_SIZE);
    const cellRange = Math.max(1, Math.ceil(rangePx / GRID_SIZE));
    const cells = [];
    for (let i = -cellRange; i <= cellRange; i++) {
      for (let j = -cellRange; j <= cellRange; j++) {
        const key = `${cx+i},${cz+j}`;
        if (this.grid.has(key)) cells.push(this.grid.get(key));
        else cells.push({ foods: [], viruses: [], blobs: [], decoys: [] }); // Defensive empty cell
      }
    }
    return cells;
  }

  tick() {
    const dt = TICK_MS / 1000;
    this.gameTime += TICK_MS;
    this.buildSpatialHash();
    
    // Respawn Food & Viruses
    if (Object.keys(this.foods).length < 700) {
      for(let i=0; i<15; i++) this.spawnFood(); 
    }
    if (Object.keys(this.viruses).length < 20) {
      this.spawnVirus();
    }

    const appState = {
      players: this.players, foods: this.foods, viruses: this.viruses,
      abilities: this.abilities, decoys: this.decoys,
      getNearbyCells: (x, z) => this.getNearbyCells(x, z)
    };
    AbilitySystem.tick(appState, TICK_MS);
    this.mode.onTick(this, TICK_MS);

    const win = this.mode.checkWinCondition(this);
    if (win) {
        io.to(this.id).emit('match_end', win);
        // Reset room logic would go here if needed, or just let them keep playing
        // For Phage.lol, we'll announce and reset the specific mode state
        if (this.mode.mode.name === 'BATTLE ROYALE') {
            this.mode.mode.gameStarted = false;
            this.mode.mode.lobbyTimer = 60000;
            this.mode.mode.zone.radius = 2000;
            this.mode.mode.zone.phase = 0;
            this.mode.mode.placements = [];
        } else if (this.mode.mode.name === 'TEAM ARENA') {
            this.mode.mode.timer = 300000;
        }
    }

    for (const pid in this.players) {
      const p = this.players[pid];
      if (!p.blobs || p.blobs.length === 0) continue;
      if (p.isBot) this.updateBot(p, dt);

      for (const b of p.blobs) {
        b.x += (b.vx||0) * dt;
        b.z += (b.vz||0) * dt;
        b.vx = (b.vx||0) * 0.87;
        b.vz = (b.vz||0) * 0.87;
        b.x = Math.max(-this.arena/2, Math.min(this.arena/2, b.x));
        b.z = Math.max(-this.arena/2, Math.min(this.arena/2, b.z));
      }

      if (p.input) {
        const { dx, dz } = p.input;
        const totalMass = p.blobs.reduce((s,b)=>s+b.mass,0);
        // Streak Boost: 2% speed increase per kill in streak, max 20%
        const streakBoost = 1 + Math.min(0.2, (p.streak || 0) * 0.02);
        const speed = BASE_SPEED * this.mode.getSpeedMultiplier() * streakBoost * Math.pow(totalMass / p.blobs.length, -0.22);
        for (const b of p.blobs) {
          b.x += dx * speed * dt;
          b.z += dz * speed * dt;
          // Boundary Hardening: bounce back slightly if hitting edge
          const margin = 20;
          if (b.x < -this.arena/2 + margin) { b.x = -this.arena/2 + margin; b.vx = Math.abs(b.vx||0) * 0.5; }
          if (b.x >  this.arena/2 - margin) { b.x =  this.arena/2 - margin; b.vx = -Math.abs(b.vx||0) * 0.5; }
          if (b.z < -this.arena/2 + margin) { b.z = -this.arena/2 + margin; b.vz = Math.abs(b.vz||0) * 0.5; }
          if (b.z >  this.arena/2 - margin) { b.z =  this.arena/2 - margin; b.vz = -Math.abs(b.vz||0) * 0.5; }
        }
      }
      this.checkEating(p);
    }
    this.broadcastState();
  }

  checkEating(p) {
    if (!p.blobs) return;
    const eatenBlobs = [];
    for (let i=0; i<p.blobs.length; i++) {
      const b = p.blobs[i];
      const r = Math.pow(b.mass, 0.45) * 2.2;
      const nearby = this.getNearbyCells(b.x, b.z);
        for (const cell of nearby) {
          for (const cellPlayer of cell.blobs) {
            if (p.id === cellPlayer.pid) continue;
            const ob = cellPlayer.blob;
            const dist = Math.hypot(b.x - ob.x, b.z - ob.z);
            const rPrey = Math.pow(ob.mass, 0.45) * 2.2;
            
            if (dist < r && b.mass > ob.mass * 1.1) {
              // Lysis Trap: If eater is not big enough to swallow (less than 1.6x prey mass), it bursts.
              if (b.mass < ob.mass * 1.6) {
                this.explodeVirus(p, i);
                io.to(this.id).emit('kill_feed', { killer: this.players[cellPlayer.pid]?.name || 'Unknown', victim: p.name, color: this.players[cellPlayer.pid]?.color });
                io.to(p.id).emit('feedbackOuch');
                continue; 
              }
              // Normal Eat
              b.mass += ob.mass;
              p.score += ob.mass;
              const preyPlayer = this.players[cellPlayer.pid];
              if (preyPlayer) {
                preyPlayer.blobs.splice(cellPlayer.idx, 1);
                if (preyPlayer.blobs.length === 0) {
                    io.to(this.id).emit('dead', { killedBy: p.name, killerSocketId: p.id });
                    this.removePlayer(cellPlayer.pid);
                }
              }
              io.to(p.id).emit('feedbackEatPlayer', { x: ob.x, z: ob.z, mass: ob.mass, color: preyPlayer?.color || '#fff' });
              io.to(p.id).emit('feedbackHit');
              io.to(cellPlayer.pid).emit('feedbackOuch');
            }
          }
          for (const v of cell.viruses) {
            if (this.viruses[v.id] && b.mass > 200 && Math.hypot(b.x-v.x, b.z-v.z) < r) {
              io.to(this.id).emit('virusEaten', {id: v.id});
              delete this.viruses[v.id];
              this.explodeVirus(p, i);
              break;
            }
          }
          for (const f of cell.foods) {
            if (Math.hypot(b.x-f.x, b.z-f.z) < r) {
              b.mass += f.mass;
              p.score += f.mass;
              this.foodPool.push(f.id);
              delete this.foods[f.id];
              io.to(this.id).emit('foodEaten', {id: f.id});
              if (!p.isBot) io.to(p.id).emit('feedbackEatFood', {x: f.x, z: f.z, mass: f.mass});
            }
          }
        for (const dObj of cell.decoys || []) {
          const d = dObj.decoy;
          if (!d) continue;
          if (p.id === d.ownerId) continue;
          const dist = Math.hypot(b.x - d.x, b.z - d.z);
          const rDecoy = Math.pow(d.mass, 0.45) * 2.2;
          if (dist < r && b.mass > d.mass * 0.1) {
            // MECHANICAL TRAP: Consumption logic triggers but gives ZERO mass
            // Penalty: Abilities of the predator go on short cooldown if they weren't already
            const ab = this.abilities.get(p.id);
            if (ab && ab.remainingMs < 5000) ab.remainingMs = 5000; 
            
            this.decoys.splice(dObj.idx, 1); // Destroy decoy
            io.to(p.id).emit('feedbackDecoyHit', { x: d.x, z: d.z });
            io.to(this.id).emit('decoyPopped', { x: d.x, z: d.z, color: d.color });
            return; // Predator is "stunned" by the fake biomass
          }
        }

        for (const other of cell.blobs) {
          if (other.pid === p.id) continue;
          const ob = other.blob;
          if (!ob || !b) continue;
          const target = this.players[other.pid];
          if (target && this.mode.canEat(p, target) && Math.hypot(b.x-ob.x, b.z-ob.z) < r * 0.75) {
            // LYSIS TRAP: If victim is > 60% of eater's size, eater bursts!
            if (b.mass < ob.mass * 1.5) {
                this.explodeVirus(p, i);
                io.to(this.id).emit('lysis_event', { killer: target.name, victim: p.name, x: b.x, z: b.z });
                return; // Stop processing this blob for this tick
            }

            b.mass += ob.mass; p.score += ob.mass;
            p.kills++; p.streak++; p.xp += Math.floor(50 + (ob.mass/10));
            eatenBlobs.push({ eaterPid: p.id, eaterIdx: i, victimPid: other.pid, victimIdx: other.idx });
            if (!p.isBot) {
                io.to(p.id).emit('feedbackEatPlayer', {x:ob.x, z:ob.z, mass:ob.mass, streak:p.streak, color:target.color});
                io.to(p.id).emit('feedbackHit');
            }
            io.to(other.pid).emit('feedbackOuch');
            io.to(this.id).emit('kill_feed', { killer: p.name, victim: target.name, color: p.color });
          }
        }
      }
    }
    for (const e of eatenBlobs) {
      const vp = this.players[e.victimPid];
      if (vp && vp.blobs && vp.blobs[e.victimIdx]) {
        vp.blobs.splice(e.victimIdx, 1);
        if (vp.blobs.length === 0) {
            if (vp.isBot) { delete this.players[e.victimPid]; setTimeout(()=>this.addBot(), 3000); }
            else {
                const room = rooms[this.id];
                let rank = 0;
                if (room && room.mode.mode.name === 'BATTLE ROYALE') {
                    rank = Object.values(room.players).filter(p => p.blobs && p.blobs.length > 0).length + 1;
                }
                io.to(e.victimPid).emit('dead', { killedBy: this.players[e.eaterPid].name, rank });
            }
        }
      }
    }
    while (Object.keys(this.foods).length < 700) this.spawnFood();
    while (Object.keys(this.viruses).length < 20) this.spawnVirus();
  }

  explodeVirus(p, idx) {
    const b = p.blobs[idx];
    const parts = Math.min(8, MAX_BLOBS - p.blobs.length + 1);
    if (parts <= 1) return;
    const newMass = b.mass / parts;
    p.blobs.splice(idx, 1);
    for (let i=0; i<parts; i++) {
        const angle = (Math.PI*2/parts)*i;
        p.blobs.push({ id: `${p.id}_v_${Date.now()}_${i}`, x: b.x, z: b.z, mass: newMass, vx: Math.cos(angle)*SPLIT_SPEED*0.8, vz: Math.sin(angle)*SPLIT_SPEED*0.8 });
    }
  }

  handleSplit(p) {
    if (Date.now() - p.lastSplit < 500) return;
    const canSplit = p.blobs.filter(b => b.mass >= MIN_MASS * 2);
    if (canSplit.length === 0 || p.blobs.length >= MAX_BLOBS) return;
    p.lastSplit = Date.now();
    let toAdd = [];
    for (const b of canSplit) {
      if (p.blobs.length + toAdd.length >= MAX_BLOBS) break;
      b.mass /= 2;
      const dx = p.input?.dx || 1, dz = p.input?.dz || 0;
      toAdd.push({ id: `${p.id}_s_${Date.now()}_${Math.random()}`, x: b.x, z: b.z, mass: b.mass, vx: dx * SPLIT_SPEED, vz: dz * SPLIT_SPEED });
    }
    p.blobs.push(...toAdd);
  }

  updateBot(p, dt) {
    const b = p.blobs[0]; if (!b) return;
    if (p.botTargetTime > Date.now()) return;
    p.botTargetTime = Date.now() + (400 + Math.random()*400);

    let dx = 0, dz = 0;
    const bMass = p.blobs.reduce((s,bl)=>s+bl.mass,0);

    // AI logic: Prioritize Fleeing > Hunting > Eating
    const nearbyCells = this.getNearbyCells(b.x, b.z);
    let threat = null, tDist = Infinity;
    let prey = null, pDist = Infinity;
    let food = null, fDist = Infinity;

    for (const cell of nearbyCells) {
      for (const other of cell.blobs) {
        if (other.pid === p.id) continue;
        const op = this.players[other.pid];
        if (!op || !op.blobs || !op.blobs[0]) continue;
        const d = Math.hypot(b.x - op.blobs[0].x, b.z - op.blobs[0].z);
        const oMass = op.blobs.reduce((s,bl)=>s+bl.mass,0);
        if (oMass > bMass * 1.2) {
          if (d < tDist) { tDist = d; threat = op.blobs[0]; }
        } else if (bMass > oMass * 1.5) {
          if (d < pDist) { pDist = d; prey = op.blobs[0]; }
        }
      }
      for (const f of cell.foods) {
        const d = Math.hypot(b.x-f.x, b.z-f.z);
        if (d < fDist) { fDist = d; food = f; }
      }
    }

    if (threat && tDist < 500) {
      dx = b.x - threat.x; dz = b.z - threat.z; // Flee
    } else if (prey && pDist < 800) {
      dx = prey.x - b.x; dz = prey.z - b.z; // Hunt
      if (pDist < 300 && Math.random() > 0.9) this.handleSplit(p);
    } else if (food) {
      dx = food.x - b.x; dz = food.z - b.z; // Eat
    } else {
      dx = Math.random()-0.5; dz = Math.random()-0.5; // Wander
    }

    const l = Math.hypot(dx, dz) || 1;
    p.input = { dx: dx/l, dz: dz/l };

    if (Math.random() > 0.98) {
      const ab = this.abilities.get(p.id);
      if (ab && ab.remainingMs <= 0) AbilitySystem.tryActivate(p.id, this);
    }
  }

  broadcastState() {
    const allPlayers = Object.values(this.players);
    const liveLeaderboard = allPlayers.sort((a,b)=>b.score-a.score).slice(0,10).map(p=>({id:p.id, name:p.name, mass:Math.floor(p.score)}));
    
    // Update Persistent Hall of Fame
    allPlayers.forEach(p => {
        if (p.isBot) return;
        const existing = hofStore.data.find(h => h.name === p.name);
        if (!existing || p.score > existing.mass) {
            if (existing) {
                existing.mass = Math.floor(p.score);
                existing.date = new Date().toISOString();
            } else {
                hofStore.data.push({ name: p.name, mass: Math.floor(p.score), date: new Date().toISOString() });
            }
            hofStore.data.sort((a,b) => b.mass - a.mass);
            hofStore.data = hofStore.data.slice(0, 50); // Keep top 50
            hofStore.save();
        }
    });

    // Mode-specific globals
    const globals = {
      flagOrb: this.mode.mode.flagOrb,
      zone: this.mode.mode.zone,
      brStarted: this.mode.mode.gameStarted,
      brLobbyTimer: this.mode.mode.lobbyTimer
    };

    const CULL_DIST_SQ = 2500 * 2500; // Radius of interest

    // We iterate through all human players to send them their specific tactical view
    for (const socketId in this.players) {
      const p = this.players[socketId];
      if (p.isBot) continue;

      const pSocket = io.sockets.sockets.get(socketId);
      if (!pSocket) continue;

      const myPos = p.blobs && p.blobs[0] ? p.blobs[0] : { x:0, z:0 };
      const myMass = p.blobs ? p.blobs.reduce((s,b)=>s+b.mass,0) : 100;
      
      // INTEREST MANAGEMENT: View distance depends on mass (Rule #10)
      const viewDist = 1800 + Math.sqrt(myMass) * 15;
      const viewDistSq = viewDist * viewDist;

      const nearbyCells = this.getNearbyCells(myPos.x, myPos.z, viewDist);
      const visiblePlayersMap = new Map();
      visiblePlayersMap.set(p.id, {
          id:p.id, name:p.name, color:p.color, blobs:p.blobs, score:p.score||0, kills:p.kills||0, xp:p.xp||0, team:p.team,
          shielded: p.shielded, dashing: p.dashing, magnetActive: p.magnetActive, ability: this.abilities.get(p.id),
          lastSeq: p.lastSeq || 0 // Acknowledge last processed input (Rule #3)
      });

      for (const cell of nearbyCells) {
          for (const other of cell.blobs) {
              if (visiblePlayersMap.has(other.pid)) continue;
              const op = this.players[other.pid];
              if (!op) continue;
              visiblePlayersMap.set(op.id, {
                  id:op.id, name:op.name, color:op.color, blobs:op.blobs.map(b=>({id:b.id, x:Math.round(b.x), z:Math.round(b.z), mass:Math.round(b.mass)})), 
                  score:Math.round(op.score||0), kills:op.kills||0, xp:op.xp||0, team:op.team,
                  shielded: op.shielded, dashing: op.dashing, magnetActive: op.magnetActive, ability: this.abilities.get(op.id)
              });
          }
      }

      const worldState = {
        players: Array.from(visiblePlayersMap.values()),
        leaderboard: liveLeaderboard,
        hallOfFame: hofStore.data.slice(0, 10),
        decoys: this.decoys.filter(d => Math.pow(d.x - myPos.x, 2) + Math.pow(d.z - myPos.z, 2) < CULL_DIST_SQ),
        ...globals
      };

      pSocket.emit('world_state', msgpack.encode(worldState));
    }
  }
}

const rooms = {
  ffa: new GameRoom('ffa', FFA),
  team: new GameRoom('team', TeamArena),
  br: new GameRoom('br', BattleRoyale)
};

setInterval(() => {
  for (const rid in rooms) rooms[rid].tick();
}, TICK_MS);

function broadcastPlayerCount() {
  io.emit('playerCount', io.engine.clientsCount);
}

io.on('connection', socket => {
  broadcastPlayerCount();
  socket.emit('chat_history', globalChatBuffer);

  socket.on('send_global_chat', (data) => {
    const msg = {
      name: (data.name || 'ANON').toUpperCase().slice(0, 16),
      text: data.text.slice(0, 100),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })
    };
    globalChatBuffer.push(msg);
    if (globalChatBuffer.length > MAX_CHAT_LOG) globalChatBuffer.shift();
    chatStore.save();
    io.emit('new_global_chat', msg);
  });

  const handlePlayerJoin = (socket, payload) => {
    const roomType = (payload && payload.mode) || socket.roomType || 'ffa';
    const room = rooms[roomType];
    if (!room) return;
    socket.join(roomType);
    socket.roomType = roomType;
    const pos = room.rndArena(true);
    const p = {
      id: socket.id, isBot: false,
      name: (payload && payload.name || 'PLAYER').toUpperCase().slice(0,16),
      color: (payload && payload.color) || '#00ffff',
      blobs: [{ id: `${socket.id}_0`, x: pos.x, z: pos.z, vx: 0, vz: 0, mass: 100 }],
      score: 0, kills: 0, streak: 0, xp: 0, lastSplit: 0, input: { dx:0, dz:0 },
      activeAbility: (payload && payload.ability) || 'SHIELD'
    };
    room.players[socket.id] = p;
    room.abilities.set(socket.id, { ability: p.activeAbility, remainingMs: 0, active: false, activeDuration: 0 });
    room.mode.onPlayerJoin(p, room);
    socket.emit('init', msgpack.encode({ 
        id: socket.id, 
        arenaSize: room.arena,
        foods: room.foods,
        viruses: room.viruses,
        players: Object.values(room.players).map(p => ({
            id:p.id, name:p.name, color:p.color, blobs:p.blobs, score:p.score||0, team:p.team, ability: room.abilities.get(p.id)
        })),
        leaderboard: Object.values(room.players).sort((a,b)=>b.score-a.score).slice(0,10).map(p=>({id:p.id, name:p.name, mass:Math.floor(p.score)}))
    }));
  };

  socket.on('join', (data) => {
    let payload = data;
    try { 
        if(Buffer.isBuffer(data) || data instanceof Uint8Array) {
            payload = msgpack.decode(data); 
        }
    } catch(e){ console.error("Decode error", e); }
    handlePlayerJoin(socket, payload);
  });

  socket.on('respawn', (data) => {
    let payload = data;
    try { 
        if(Buffer.isBuffer(data) || data instanceof Uint8Array) {
            payload = msgpack.decode(data); 
        }
    } catch(e){ console.error("Decode error", e); }
    handlePlayerJoin(socket, payload);
  });

  socket.on('input', data => {
    const room = rooms[socket.roomType];
    if (!room) return;
    const p = room.players[socket.id];
    if (!p) return;
    try {
      const pkt = msgpack.decode(new Uint8Array(data));
      p.input = { dx: pkt.dx, dz: pkt.dz };
      p.lastSeq = pkt.seq; // Store sequence for reconciliation (Rule #3)
    } catch(e){}
  });

  socket.on('ability', () => {
    const room = rooms[socket.roomType];
    if (!room) return;
    const appState = {
        players: room.players, foods: room.foods, viruses: room.viruses,
        abilities: room.abilities, decoys: room.decoys,
        getNearbyCells: (x, z) => room.getNearbyCells(x, z)
    };
    if (AbilitySystem.tryActivate(socket.id, appState)) {
        io.to(socket.roomType).emit('ability_event', { playerId: socket.id, ability: room.abilities.get(socket.id).ability, ts: Date.now() });
    }
  });

  socket.on('split', () => {
     const room = rooms[socket.roomType];
     if (room && room.players[socket.id]) room.handleSplit(room.players[socket.id]);
  });

  socket.on('disconnect', () => {
    broadcastPlayerCount();
    const room = rooms[socket.roomType];
    if (room) room.removePlayer(socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🎮 PHAGE.LOL v2 → http://localhost:${PORT}`));
