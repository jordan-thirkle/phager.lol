/**
 * FILE: server.js
 * PURPOSE: Authoritative game server for Phage.lol. Handles physics, collisions, state sync, and persistence.
 * OWNERSHIP: Core Server Engine / Networking Layer.
 * DEPENDENCIES: socket.io, @msgpack/msgpack, AbilitySystem.js, ModeManager.js.
 * ARCHITECTURAL NOTES: Uses a 20Hz tick rate (50ms). Implements spatial hashing for O(n) collision performance.
 *                      Authoritative source of truth for all biological mass and movement.
 */

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import * as msgpack from '@msgpack/msgpack';
import { AbilitySystem } from './src/abilities/AbilitySystem.js';
import ModeManager from './src/modes/ModeManager.js';
import FFA from './src/modes/FFA.js';
import TeamArena from './src/modes/TeamArena.js';
import BattleRoyale from './src/modes/BattleRoyale.js';
import { PersistentStore } from './src/PersistentStore.js';
import fs from 'fs';
import path, { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : true,
    methods: ['GET', 'POST'],
    credentials: true
  }
});
global.io = io;
const serverStartedAt = Date.now();
let lastTickDurationMs = 0;

process.on('uncaughtException', (err) => {
  console.error('🔥 UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 UNHANDLED REJECTION:', reason);
});

// --- PATH B: PERSISTENCE BRIDGE ---
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const hofStore = new PersistentStore(DATA_DIR, 'hallOfFame.json', []);
const chatStore = new PersistentStore(DATA_DIR, 'chatHistory.json', [
  { name: 'DIAGNOSTIC', text: 'PHAGE PROTOCOL INITIALIZED.' },
  { name: 'DIAGNOSTIC', text: 'SCANNING FOR SUSCEPTIBLE BIOMASS...' }
]);

const distIndexPath = path.join(__dirname, '../dist/index.html');
if (!fs.existsSync(distIndexPath)) {
  console.error('Missing production client build at dist/index.html. Run `npm run build` before starting the server.');
  process.exit(1);
}

app.use(express.static(path.join(__dirname, '../client/public')));
app.use(express.static(path.join(__dirname, '../dist')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/socket.io')) return next();
  res.sendFile(distIndexPath);
});

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

/**
 * Represents a game instance/arena.
 * @class GameRoom
 * @param {string} id - Unique room identifier.
 * @param {object} modeConfig - The game mode implementation (FFA, Teams, etc).
 */
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
    this.foodPool = []; // Recycled IDs for performance
    this.lastVirusId = 0;
    this.gameTime = 0;

    for(let i=0; i<450; i++) this.spawnFood();
    for(let i=0; i<20; i++) this.spawnVirus();
    this.botTimer = setInterval(() => this.scaleBots(), 10000);
  }

  /**
   * Generates a random position within the arena or safe zone.
   * @param {boolean} isRespawn - If true, ensures distance from large phages.
   * @returns {object} {x, z} coordinates.
   */
  rndArena(isRespawn = false) { 
    let attempts = 0;
    let pos;
    do {
      if (this.mode.mode.zone) {
          // BATTLE ROYALE: Spawn within shrinking safe circle
          const r = this.mode.mode.zone.radius * 0.8;
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * r;
          pos = { x: this.mode.mode.zone.centerX + Math.cos(angle) * dist, z: this.mode.mode.zone.centerZ + Math.sin(angle) * dist };
      } else {
          pos = { x: (Math.random() - 0.5) * this.arena, z: (Math.random() - 0.5) * this.arena }; 
      }
      attempts++;
      // Safe Respawn check: no player with > 500 mass nearby (Prevent spawn-camping)
      if (isRespawn) {
          const safe = !Object.values(this.players).some(p => p.blobs && p.blobs.some(b => b.mass > 500 && Math.hypot(b.x - pos.x, b.z - pos.z) < 400));
          if (safe) break;
      } else break;
    } while (attempts < 10);
    return pos;
  }

  /**
   * Instantiates a food pellet.
   * @AI-CONTEXT: Reuses IDs from foodPool to prevent ID overflow in long sessions.
   */
  spawnFood() {
    const id = this.foodPool.length > 0 ? this.foodPool.pop() : ++this.lastFoodId;
    const pos = this.rndArena();
    const f = { id, x: pos.x, z: pos.z, mass: 3, color: '#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0') };
    this.foods[id] = f;
  }

  /**
   * Instantiates a Virus (obstacle).
   */
  spawnVirus() {
    this.lastVirusId++;
    let pos;
    do { pos = this.rndArena(); } while(Object.values(this.players).some(p=>p.blobs&&p.blobs.some(b=>Math.hypot(b.x-pos.x, b.z-pos.z)<150)));
    const v = { id: this.lastVirusId, x: pos.x, z: pos.z };
    this.viruses[this.lastVirusId] = v;
  }

  /**
   * Dynamically adjusts bot count based on human player activity.
   * @AI-CONTEXT: Target is 40 entities total for 'full' feel.
   */
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

  /**
   * Injects an AI-controlled Phage.
   * @side_effects Mutates this.players.
   */
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

  /**
   * Finalizes player removal.
   * @param {string} id - Socket ID or Bot ID.
   */
  removePlayer(id) {
    const p = this.players[id];
    if (p) {
        this.mode.onPlayerDeath(p, this);
        delete this.players[id];
        this.abilities.delete(id);
    }
  }

  /**
   * Rebuilds the spatial hash grid for efficient collision detection.
   * @PERF: O(n) instead of O(n^2). Crucial for 1000+ food pellets.
   * @AI-CONTEXT: GRID_SIZE is 400. Mapping is (cx+1000)*2000 to prevent negative key overlaps.
   */
  buildSpatialHash() {
    this.grid.clear();
    for (const id in this.foods) {
      const f = this.foods[id];
      const cx = Math.floor(f.x / GRID_SIZE), cz = Math.floor(f.z / GRID_SIZE);
      const key = (cx + 1000) * 2000 + (cz + 1000);
      if (!this.grid.has(key)) this.grid.set(key, { foods: [], viruses: [], blobs: [] });
      this.grid.get(key).foods.push(f);
    }
    for (const id in this.viruses) {
      const v = this.viruses[id];
      const cx = Math.floor(v.x / GRID_SIZE), cz = Math.floor(v.z / GRID_SIZE);
      const key = (cx + 1000) * 2000 + (cz + 1000);
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
        const key = (cx + 1000) * 2000 + (cz + 1000);
        if (!this.grid.has(key)) this.grid.set(key, { foods: [], viruses: [], blobs: [], decoys: [] });
        this.grid.get(key).blobs.push({ pid, idx: i, blob: b });
      }
    }
    // Add Decoys to Spatial Hash for mechanical interaction
    for (let i = 0; i < this.decoys.length; i++) {
      const d = this.decoys[i];
      if (!d) continue;
      const cx = Math.floor(d.x / GRID_SIZE), cz = Math.floor(d.z / GRID_SIZE);
      const key = (cx + 1000) * 2000 + (cz + 1000);
      if (!this.grid.has(key)) this.grid.set(key, { foods: [], viruses: [], blobs: [], decoys: [] });
      const cell = this.grid.get(key);
      if (cell && cell.decoys) {
        cell.decoys.push({ idx: i, decoy: d });
      }
    }
  }

  /**
   * Retrieves all grid cells within a tactical radius.
   * @param {number} x, z - Center coordinates.
   * @param {number} rangePx - Pixel radius to query.
   * @returns {Array} List of cell objects.
   */
  getNearbyCells(x, z, rangePx = 1000) {
    const cx = Math.floor(x / GRID_SIZE), cz = Math.floor(z / GRID_SIZE);
    const cellRange = Math.max(1, Math.ceil(rangePx / GRID_SIZE));
    const cells = [];
    for (let i = -cellRange; i <= cellRange; i++) {
      for (let j = -cellRange; j <= cellRange; j++) {
        const key = (cx + i + 1000) * 2000 + (cz + j + 1000);
        if (this.grid.has(key)) cells.push(this.grid.get(key));
        else cells.push({ foods: [], viruses: [], blobs: [], decoys: [] }); // Defensive empty cell
      }
    }
    return cells;
  }

  /**
   * The core 20Hz simulation loop.
   * @side_effects Mutates world state, broadcasts to all clients.
   */
  tick() {
    const dt = TICK_MS / 1000;
    this.gameTime += TICK_MS;
    this.deadBlobIds = new Set(); // Reset the mark-and-sweep registry
    this.buildSpatialHash();
    
    // Respawn Food & Viruses
    if (Object.keys(this.foods).length < 450) {
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

    // WIN CONDITION CHECK
    const win = this.mode.checkWinCondition(this);
    if (win) {
        io.to(this.id).emit('match_end', win);
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
        // Apply Velocity with organic damping (0.87)
        b.x += (b.vx||0) * dt;
        b.z += (b.vz||0) * dt;
        b.vx = (b.vx||0) * 0.87;
        b.vz = (b.vz||0) * 0.87;
        b.x = Math.max(-this.arena/2, Math.min(this.arena/2, b.x));
        b.z = Math.max(-this.arena/2, Math.min(this.arena/2, b.z));
      }

      if (p.input) {
        let { dx, dz } = p.input;
        // Anti-Cheat: Normalize/Clamp input to prevent speed hacks (Rule #8)
        // Sanitization and clamping is also performed at the socket.on('input') handler.
        dx = Number.isFinite(dx) ? dx : 0;
        dz = Number.isFinite(dz) ? dz : 0;
        const mag = Math.hypot(dx, dz);
        if (mag > 1) { dx /= mag; dz /= mag; }
        
        const totalMass = p.blobs.reduce((s,b)=>s+b.mass,0);
        // Streak Boost: 2% speed increase per kill in streak, max 20%
        const streakBoost = 1 + Math.min(0.2, (p.streak || 0) * 0.02);
        // Speed Formula: Inversely proportional to mass^0.22 (Law of Conservation)
        const isBoosting = p.boostUntil && Date.now() < p.boostUntil;
        const boostMultiplier = isBoosting ? 1.6 : 1;
        const speed = BASE_SPEED * this.mode.getSpeedMultiplier() * streakBoost * boostMultiplier * Math.pow(totalMass / p.blobs.length, -0.22);
        for (const b of p.blobs) {
          b.x += dx * speed * dt;
          b.z += dz * speed * dt;
          if (isBoosting) {
            b.vx = (b.vx || 0) + dx * BOOST_THRUST * dt;
            b.vz = (b.vz || 0) + dz * BOOST_THRUST * dt;
          }
          
          // Boundary Hardening: Bouncy edges for 'organic membrane' feel
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

  /**
   * Collision detection and resolution.
   * @param {object} p - The player attempting to engulf biomass.
   * @AI-CONTEXT: Uses a 'mark-and-sweep' registry (deadBlobIds) to prevent stale collisions in the same tick.
   */
  checkEating(p) {
    if (!p.blobs) return;
    const deadBlobIds = this.deadBlobIds; // Shared set for the tick
    for (let i=0; i<p.blobs.length; i++) {
      const b = p.blobs[i];
      const r = Math.pow(b.mass, 0.45) * 2.2;
      const nearby = this.getNearbyCells(b.x, b.z);
        for (const cell of nearby) {
          for (const cellPlayer of cell.blobs) {
            if (p.id === cellPlayer.pid || deadBlobIds.has(cellPlayer.blob.id)) continue;
            const ob = cellPlayer.blob;
            const dist = Math.hypot(b.x - ob.x, b.z - ob.z);
            
            if (dist < r && b.mass > ob.mass * 1.1) {
              // Dynamic Lysis: Threshold scales 1.1x -> 1.4x based on server population density
              const popDensity = Math.min(1, Object.keys(this.players).length / 20);
              const lysisThreshold = 1.1 + (popDensity * 0.3);
              
              // Lysis Trap: If eater is not big enough to swallow (close mass ratio), it bursts.
              if (b.mass < ob.mass * lysisThreshold) {
                this.explodeVirus(p, i);
                io.to(this.id).emit('kill_feed', { killer: this.players[cellPlayer.pid]?.name || 'Unknown', victim: p.name, color: this.players[cellPlayer.pid]?.color });
                io.to(p.id).emit('feedbackOuch');
                continue; 
              }
              // Normal Eat: Phage consumption
              b.mass += ob.mass;
              p.score += ob.mass;
              const preyPlayer = this.players[cellPlayer.pid];
              if (preyPlayer) {
                deadBlobIds.add(ob.id); // Mark for removal (Sweep phase handles physical array splice)
              }
              io.to(p.id).emit('feedbackEatPlayer', { x: ob.x, z: ob.z, mass: ob.mass, color: preyPlayer?.color || '#fff' });
              io.to(p.id).emit('feedbackHit');
              io.to(cellPlayer.pid).emit('feedbackOuch');
            }
          }
          // Virus Collision: Large phages split when hitting viruses
          for (const v of cell.viruses) {
            if (this.viruses[v.id] && b.mass > 200 && Math.hypot(b.x-v.x, b.z-v.z) < r) {
              io.to(this.id).emit('virusEaten', {id: v.id});
              delete this.viruses[v.id];
              this.explodeVirus(p, i);
              break;
            }
          }
          // Food Collision: Passive biomass accumulation
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
        // Decoy Interaction: Decoys stun predators without providing mass
        for (const dObj of cell.decoys || []) {
          const d = dObj.decoy;
          if (!d) continue;
          if (p.id === d.ownerId) continue;
          const dist = Math.hypot(b.x - d.x, b.z - d.z);
          if (dist < r && b.mass > d.mass * 0.1) {
            const ab = this.abilities.get(p.id);
            if (ab && ab.remainingMs < 5000) ab.remainingMs = 5000; 
            
            this.decoys.splice(dObj.idx, 1);
            io.to(p.id).emit('feedbackDecoyHit', { x: d.x, z: d.z });
            io.to(this.id).emit('decoyPopped', { x: d.x, z: d.z, color: d.color });
            return; 
          }
        }

        for (const other of cell.blobs) {
          if (other.pid === p.id || deadBlobIds.has(other.blob.id)) continue;
          const ob = other.blob;
          if (!ob || !b) continue;
          const target = this.players[other.pid];
          if (target && this.mode.canEat(p, target) && Math.hypot(b.x-ob.x, b.z-ob.z) < r * 0.75) {
            const popDensity = Math.min(1, Object.keys(this.players).length / 20);
            const lysisThreshold = 1.1 + (popDensity * 0.3);
            
            if (b.mass < ob.mass * lysisThreshold) {
                this.explodeVirus(p, i);
                io.to(this.id).emit('lysis_event', { killer: target.name, victim: p.name, x: b.x, z: b.z });
                return;
            }

            b.mass += ob.mass; p.score += ob.mass;
            p.kills++; p.streak++; p.xp += Math.floor(50 + (ob.mass/10));
            deadBlobIds.add(ob.id); 
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
    // Cleanup Phase: Batch remove all dead blobs (Sweep phase)
    const deadPlayers = new Set();
    for (const pid in this.players) {
        const player = this.players[pid];
        if (!player.blobs) continue;
        const beforeCount = player.blobs.length;
        player.blobs = player.blobs.filter(b => !deadBlobIds.has(b.id));
        
        if (beforeCount > 0 && player.blobs.length === 0) {
            deadPlayers.add(pid);
        }
    }

    for (const pid of deadPlayers) {
        const player = this.players[pid];
        if (player.isBot) { 
            delete this.players[pid]; 
            setTimeout(()=>this.addBot(), 3000); 
        } else {
            const room = rooms[this.id];
            let rank = 0;
            if (room && room.mode.mode.name === 'BATTLE ROYALE') {
                rank = Object.values(room.players).filter(p => p.blobs && p.blobs.length > 0).length + 1;
            }
            io.to(pid).emit('dead', { killedBy: 'Something', rank });
            this.removePlayer(pid); // Properly remove ability data etc
        }
    }

    while (Object.keys(this.foods).length < 450) this.spawnFood();
    while (Object.keys(this.viruses).length < 20) this.spawnVirus();
  }

  /**
   * Triggers a 'burst' split when hitting a virus or losing a lysis event.
   * @param {object} p - Player.
   * @param {number} idx - Index of the blob to explode.
   */
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

  /**
   * Handles manual split requests (Spacebar).
   * @param {object} p - Player.
   */
  handleSplit(p) {
    if (Date.now() - p.lastSplit < 500) return; // 500ms cooldown for performance/fairness
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

  /**
   * Handles a short boost burst.
   * @param {object} p - Player.
   */
  handleBoost(p) {
    if (!p.blobs || p.blobs.length === 0) return;
    const now = Date.now();
    if (p.lastBoost && now - p.lastBoost < 700) return;
    p.lastBoost = now;

    const dx = p.input?.dx || 0;
    const dz = p.input?.dz || 0;
    const mag = Math.hypot(dx, dz) || 1;
    const nx = dx / mag;
    const nz = dz / mag;

    p.boostUntil = now + 250;
    p.boostDir = { dx: nx, dz: nz };

    const massCost = Math.min(BOOST_MASS_COST, Math.max(6, p.blobs.length * 2));
    const perBlobCost = massCost / p.blobs.length;
    for (const b of p.blobs) {
      b.mass = Math.max(MIN_MASS * 0.5, b.mass - perBlobCost);
      b.vx = (b.vx || 0) + nx * BOOST_THRUST * 0.25;
      b.vz = (b.vz || 0) + nz * BOOST_THRUST * 0.25;
    }
  }

  /**
   * AI Logic for bots.
   * @param {object} p - Bot player.
   * @param {number} dt - Delta time.
   */
  updateBot(p, dt) {
    const b = p.blobs[0]; if (!b) return;
    if (p.botTargetTime > Date.now()) return;
    p.botTargetTime = Date.now() + (400 + Math.random()*400);

    let dx = 0, dz = 0;
    const bMass = p.blobs.reduce((s,bl)=>s+bl.mass,0);

    // AI DECISION TREE: Fleeing > Hunting > Eating
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

  /**
   * Broadcasts the tactical world state to all connected human players.
   * @AI-CONTEXT: Implements INTEREST MANAGEMENT (View distance scales with mass^0.5).
   * @PERF: Uses MessagePack binary encoding to reduce payload size by ~40%.
   */
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
        }
    });

    const globals = {
      flagOrb: this.mode.mode.flagOrb,
      zone: this.mode.mode.zone,
      brStarted: this.mode.mode.gameStarted,
      brLobbyTimer: this.mode.mode.lobbyTimer
    };

    const CULL_DIST_SQ = 2500 * 2500; // Hard cap for visual culling

    for (const socketId in this.players) {
      const p = this.players[socketId];
      if (p.isBot) continue;

      const pSocket = io.sockets.sockets.get(socketId);
      if (!pSocket) continue;

      const myPos = p.blobs && p.blobs[0] ? p.blobs[0] : { x:0, z:0 };
      const myMass = p.blobs ? p.blobs.reduce((s,b)=>s+b.mass,0) : 100;
      
      // INTEREST MANAGEMENT: Dynamic view distance logic (Rule #10)
      const viewDist = 1100 + Math.sqrt(myMass) * 15;
      const viewDistSq = viewDist * viewDist;

      const nearbyCells = this.getNearbyCells(myPos.x, myPos.z, viewDist);
      const visiblePlayersMap = new Map();
      const visibleFoods = [];
      const visibleViruses = [];

      visiblePlayersMap.set(p.id, {
          id:p.id, name:p.name, color:p.color, blobs:p.blobs, score:p.score||0, kills:p.kills||0, xp:p.xp||0, team:p.team,
          shielded: p.shielded, dashing: p.dashing, magnetActive: p.magnetActive, ability: this.abilities.get(p.id),
          lastSeq: p.lastSeq || 0 // Sequence acknowledgement for client prediction
      });

      for (const cell of nearbyCells) {
          visibleFoods.push(...cell.foods);
          visibleViruses.push(...cell.viruses);
          for (const other of cell.blobs) {
              if (visiblePlayersMap.has(other.pid)) continue;
              const op = this.players[other.pid];
              if (!op) continue;
              
              // PERF: Only send essential blob data for non-local players
              visiblePlayersMap.set(op.id, {
                  id:op.id, name:op.name, color:op.color, 
                  blobs:op.blobs.map(b=>({id:b.id, x:Math.round(b.x), z:Math.round(b.z), mass:Math.round(b.mass)})), 
                  score:Math.round(op.score||0), kills:op.kills||0, xp:op.xp||0, team:op.team,
                  shielded: op.shielded, dashing: op.dashing, magnetActive: op.magnetActive, ability: this.abilities.get(op.id)
              });
          }
      }

      const worldState = {
        players: Array.from(visiblePlayersMap.values()),
        foods: visibleFoods,
        viruses: visibleViruses,
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
  const tickStartedAt = Date.now();
  for (const rid in rooms) rooms[rid].tick();
  lastTickDurationMs = Date.now() - tickStartedAt;
}, TICK_MS);

setInterval(() => {
  io.emit('server_stats', collectServerStats());
}, 1000);

// Throttled Persistence: Save data to disk every 30 seconds
setInterval(() => {
  console.log('💾 PERSISTING WORLD DATA...');
  hofStore.save();
  chatStore.save();
}, 30000);

function broadcastPlayerCount() {
  io.emit('playerCount', io.engine.clientsCount);
}

function collectServerStats() {
  const roomsStats = {};
  let totalPlayers = 0;
  let totalBots = 0;
  let totalFoods = 0;
  let totalViruses = 0;
  let totalDecoys = 0;

  for (const [roomId, room] of Object.entries(rooms)) {
    const players = Object.values(room.players || {});
    const bots = players.filter(p => p && p.isBot).length;
    const humans = players.length - bots;
    const foods = Object.keys(room.foods || {}).length;
    const viruses = Object.keys(room.viruses || {}).length;
    const decoys = Array.isArray(room.decoys) ? room.decoys.length : 0;

    roomsStats[roomId] = {
      humans,
      bots,
      players: players.length,
      foods,
      viruses,
      decoys,
      arena: room.arena
    };

    totalPlayers += players.length;
    totalBots += bots;
    totalFoods += foods;
    totalViruses += viruses;
    totalDecoys += decoys;
  }

  const memory = process.memoryUsage();
  return {
    uptimeMs: Date.now() - serverStartedAt,
    clients: io.engine.clientsCount,
    rooms: roomsStats,
    totals: {
      players: totalPlayers,
      bots: totalBots,
      foods: totalFoods,
      viruses: totalViruses,
      decoys: totalDecoys
    },
    tickMs: lastTickDurationMs,
    memory: {
      rss: memory.rss,
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal
    }
  };
}

io.on('connection', socket => {
  broadcastPlayerCount();
  socket.emit('server_stats', collectServerStats());
  socket.emit('chat_history', globalChatBuffer);

  socket.on('send_global_chat', (data) => {
    if (!data || typeof data.text !== 'string') return;
    const now = Date.now();
    if (socket.lastChatTime && now - socket.lastChatTime < 1000) return; // 1s cooldown
    socket.lastChatTime = now;

    const msg = {
      name: (String(data.name || 'ANON')).toUpperCase().slice(0, 16),
      text: data.text.slice(0, 100),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })
    };
    globalChatBuffer.push(msg);
    if (globalChatBuffer.length > MAX_CHAT_LOG) globalChatBuffer.shift();
    io.emit('new_global_chat', msg);
  });

  const handlePlayerJoin = (socket, payload) => {
    // Dynamic Mode Selection: Respect lobby choice for Vibe Jam 2026 audit
    let roomType = (payload && payload.mode) || 'ffa';
    if (roomType === 'teams') roomType = 'team';
    if (!rooms[roomType]) roomType = 'ffa'; 
    
    const room = rooms[roomType];
    if (!room) return;
    
    console.log(`[${roomType}] 🦠 PLAYER JOINED: ${(payload && payload.name) || 'ANON'} (${socket.id})`);
    
    socket.join(roomType);
    socket.roomType = roomType;
    const pos = room.rndArena(true);
    const color = (payload && typeof payload.color === 'string' && /^#[0-9A-F]{6}$/i.test(payload.color)) ? payload.color : '#00ffff';
    const p = {
      id: socket.id, isBot: false,
      name: (payload && typeof payload.name === 'string' ? payload.name : 'PLAYER').toUpperCase().slice(0,16),
      color: color,
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
    const now = Date.now();
    // Rate limit input to ~60Hz (even though server is 20Hz) to allow for jitter but prevent flooding
    if (socket.lastInputTime && now - socket.lastInputTime < 15) return;
    socket.lastInputTime = now;

    const room = rooms[socket.roomType];
    if (!room) return;
    const p = room.players[socket.id];
    if (!p) return;
    try {
      const pkt = msgpack.decode(new Uint8Array(data));
      let dx = typeof pkt.dx === 'number' && Number.isFinite(pkt.dx) ? pkt.dx : 0;
      let dz = typeof pkt.dz === 'number' && Number.isFinite(pkt.dz) ? pkt.dz : 0;
      const mag = Math.hypot(dx, dz);
      if (mag > 1) {
        dx /= mag;
        dz /= mag;
      }
      p.input = { dx, dz };
      p.lastSeq = pkt.seq; 
    } catch(e){
      // Ignore malformed binary input packets
    }
  });

  socket.on('ability', () => {
    const now = Date.now();
    if (socket.lastAbilityTime && now - socket.lastAbilityTime < 500) return;
    socket.lastAbilityTime = now;

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

  socket.on('boost', () => {
    const now = Date.now();
    if (socket.lastBoostTime && now - socket.lastBoostTime < 250) return;
    socket.lastBoostTime = now;

    const room = rooms[socket.roomType];
    if (!room) return;
    const p = room.players[socket.id];
    if (!p) return;

    room.handleBoost(p);
    io.to(socket.id).emit('feedbackBoost');
  });

  socket.on('split', () => {
     const now = Date.now();
     if (socket.lastSplitTime && now - socket.lastSplitTime < 300) return;
     socket.lastSplitTime = now;
     
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
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  const mem = process.memoryUsage();
  console.log(`🎮 PHAGE.LOL v2 → http://${HOST}:${PORT}`);
  console.log(`📊 INITIAL MEMORY: RSS: ${Math.round(mem.rss / 1024 / 1024)}MB | HEAP: ${Math.round(mem.heapUsed / 1024 / 1024)}MB`);
});
