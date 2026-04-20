const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const msgpack = require('@msgpack/msgpack');
const AbilitySystem = require('./public/src/abilities/AbilitySystem');

app.use(express.static('public'));

// ─── CONFIG ───────────────────────────────────────────────────
const ARENA = 3000;
const TICK_MS = 1000 / 20;
const MIN_MASS = 40;
const MAX_MASS = 25000;
const BASE_SPEED = 220;
const MASS_LOSS_RATE = 0.9997;
const SPLIT_SPEED = 800;
const BOOST_THRUST = 550;
const BOOST_MASS_COST = 20;
const MAX_BLOBS = 16;
const FOOD_COUNT = 700;
const VIRUS_COUNT = 20;

// ─── STATE ────────────────────────────────────────────────────
let players = {};
let foods = {};
let viruses = {};

// ─── APP STATE (for shared system access) ─────────────────────
const AppState = {
  players,
  foods,
  viruses,
  abilities: new Map(), // Keyed by socketId
  decoys: [],           // GDD §4.1 DECOY
  getNearbyCells: null  // Will be set after getNearbyCells is defined
};

let lastFoodId = 0, lastVirusId = 0;

function rndArena() { return (Math.random() - 0.5) * ARENA; }
function spawnFood() {
  lastFoodId++;
  foods[lastFoodId] = { id: lastFoodId, x: rndArena(), z: rndArena(), mass: 3, color: '#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0') };
  return foods[lastFoodId];
}
function spawnVirus() {
  lastVirusId++;
  let vx, vz;
  do { vx=rndArena(); vz=rndArena(); } while(Object.values(players).some(p=>p.blobs&&p.blobs.some(b=>Math.hypot(b.x-vx, b.z-vz)<150)));
  viruses[lastVirusId] = { id: lastVirusId, x: vx, z: vz };
}

for(let i=0; i<FOOD_COUNT; i++) spawnFood();
for(let i=0; i<VIRUS_COUNT; i++) spawnVirus();

// ─── BOT AI ───────────────────────────────────────────────────
const BOT_NAMES = ['NEXUS', 'CIPHER', 'ROGUE', 'ECHO', 'NOVA', 'FLUX', 'ATLAS', 'TITAN', 'SPECTER', 'WRAITH', 'VORTEX', 'OMEGA'];
const BOT_ARCHETYPES = ['HUNTER', 'FARMER', 'DEFENDER', 'GHOST', 'APEX'];
const NEON_COLORS = ['#ff0088','#00ffff','#ffff00','#ff6600','#00ff88','#ff00ff','#88ff00','#0088ff','#ff4488','#ffbb00'];

function addBot() {
  const id = 'bot_' + Math.random().toString(36).substr(2, 9);
  const archetype = BOT_ARCHETYPES[Math.floor(Math.random()*BOT_ARCHETYPES.length)];
  const abilityWeight = Math.random();
  let ability = 'SHIELD';
  if (abilityWeight > 0.85) ability = 'DECOY';
  else if (abilityWeight > 0.65) ability = 'DASH';
  else if (abilityWeight > 0.40) ability = 'MAGNET';

  players[id] = {
    id, isBot: true,
    name: BOT_NAMES[Math.floor(Math.random()*BOT_NAMES.length)],
    color: NEON_COLORS[Math.floor(Math.random()*NEON_COLORS.length)],
    blobs: [{ id: `${id}_0`, x: rndArena(), z: rndArena(), vx: 0, vz: 0, mass: Math.random()*200+100 }],
    score: 0, kills: 0, streak: 0, xp: 0, lastSplit: 0, input: { dx:0, dz:0 },
    archetype: archetype,
    botTargetTime: 0,
    activeAbility: ability,
    lastMassLossTime: Date.now(),
    lastMass: 0
  };
  AppState.abilities.set(id, { ability: ability, remainingMs: 0, active: false, activeDuration: 0 });
}
for(let i=0; i<15; i++) addBot();

function scoreTarget(bot, target) {
  if (target.isDecoy) return -Infinity;
  const b = bot.blobs[0];
  const tb = target.blobs[0];
  if (!b || !tb) return -Infinity;
  
  const botMass = bot.blobs.reduce((s,b)=>s+b.mass,0);
  const targetMass = target.blobs.reduce((s,b)=>s+b.mass,0);
  const massRatio = botMass / targetMass;
  if (massRatio < 0.88) return -Infinity; 
  
  const distance = Math.hypot(b.x - tb.x, b.z - tb.z);
  if (distance > 800) return -Infinity;

  let virusNear = 0;
  const cells = getNearbyCells(tb.x, tb.z);
  for (const cell of cells) {
    for (const v of cell.viruses) {
      if (Math.hypot(tb.x - v.x, tb.z - v.z) < 80) { virusNear = -200; break; }
    }
    if (virusNear) break;
  }
  
  const shielded = target.shielded ? -300 : 0;
  const archetypeBonus = getArchetypeBonus(bot.archetype, massRatio, distance);
  
  return (massRatio * 400) - (distance * 0.8) + virusNear + shielded + archetypeBonus;
}

function getArchetypeBonus(archetype, massRatio, distance) {
  switch(archetype) {
    case 'HUNTER':  return distance < 400 ? 300 : 100;
    case 'FARMER':  return -500;
    case 'DEFENDER': return massRatio > 2 ? 200 : -100;
    case 'GHOST':   return massRatio > 1.1 ? 150 : -200;
    case 'APEX':    return 200;
    default: return 0;
  }
}

function updateBot(p, dt) {
  const b = p.blobs[0];
  if (!b) return;
  const totalMass = p.blobs.reduce((s,b)=>s+b.mass,0);

  // PACK MODE (Task 3)
  if (p.archetype === 'HUNTER' && !p.packRole) {
    const partner = Object.values(players).find(op => {
      if (op.id === p.id || op.archetype !== 'HUNTER' || !op.blobs || !op.blobs[0]) return false;
      const opMass = op.blobs.reduce((s,bl)=>s+bl.mass,0);
      const dist = Math.hypot(b.x - op.blobs[0].x, b.z - op.blobs[0].z);
      const massDiff = Math.abs(totalMass - opMass) / totalMass;
      return dist < 300 && massDiff < 0.2;
    });

    if (partner) {
      const target = Object.values(players).find(tp => {
        if (!tp.blobs || !tp.blobs[0]) return false;
        const tMass = tp.blobs.reduce((s,bl)=>s+bl.mass,0);
        const dist = Math.hypot(b.x - tp.blobs[0].x, b.z - tp.blobs[0].z);
        return tMass > totalMass * 1.3 && dist < 400;
      });

      if (target) {
        p.packRole = totalMass > partner.blobs.reduce((s,bl)=>s+bl.mass,0) ? 'bait' : 'sweep';
        p.packPartner = partner.id;
        p.packTarget = target.id;
        partner.packRole = p.packRole === 'bait' ? 'sweep' : 'bait';
        partner.packPartner = p.id;
        partner.packTarget = target.id;
      }
    }
  }

  // Handle active pack role
  if (p.packRole) {
    const partner = players[p.packPartner];
    const target = players[p.packTarget];
    if (!partner || !target || !target.blobs || !target.blobs[0] || Math.hypot(b.x - partner.blobs[0].x, b.z - partner.blobs[0].z) > 400) {
      delete p.packRole; delete p.packPartner; delete p.packTarget;
    } else {
      const tb = target.blobs[0];
      const dist = Math.hypot(b.x - tb.x, b.z - tb.z);
      if (dist > 500) {
        delete p.packRole; delete p.packPartner; delete p.packTarget;
      } else {
        if (p.packRole === 'bait') {
           // Approaches directly
           p.input = { dx: (tb.x - b.x)/dist, dz: (tb.z - b.z)/dist };
           if (dist < 180) handleSplit(p);
        } else {
           // Flanking/Sweep: approach from opposite side
           const bait = partner.blobs[0];
           const flankAngle = Math.atan2(tb.z - bait.z, tb.x - bait.x) + Math.PI;
           const tx = tb.x + Math.cos(flankAngle) * 150;
           const tz = tb.z + Math.sin(flankAngle) * 150;
           const dx = tx - b.x, dz = tz - b.z;
           const dLen = Math.hypot(dx, dz) || 1;
           p.input = { dx: dx/dLen, dz: dz/dLen };
        }
        return; // Skip normal behavior
      }
    }
  }

  // Ability Usage Logic (Task 2)
  const abilityData = AppState.abilities.get(p.id);
  if (abilityData && abilityData.remainingMs <= 0 && !abilityData.active) {
    let shouldActivate = false;
    const ability = abilityData.ability;
    
    if (ability === 'SHIELD') {
      const threat = Object.values(players).find(tp => {
        if (tp.id === p.id || !tp.blobs || !tp.blobs[0]) return false;
        const dist = Math.hypot(b.x - tp.blobs[0].x, b.z - tp.blobs[0].z);
        const tMass = tp.blobs.reduce((s,bl)=>s+bl.mass,0);
        return dist < 200 && tMass > totalMass * 1.1;
      });
      if (threat) shouldActivate = true;
    } else if (ability === 'MAGNET') {
      let targetsInRange = 0;
      for(const tid in players) {
        if(tid === p.id) continue;
        const tp = players[tid];
        if(!tp.blobs || !tp.blobs[0]) continue;
        if(Math.hypot(b.x-tp.blobs[0].x, b.z-tp.blobs[0].z) < 600) targetsInRange++;
      }
      const radius = Math.pow(totalMass/p.blobs.length, 0.45) * 2.2;
      let foodNearby = 0;
      getNearbyCells(b.x, b.z).forEach(c => foodNearby += c.foods.length);
      if (targetsInRange < 3 && foodNearby >= 8) shouldActivate = true;
    } else if (ability === 'DASH') {
        // Target fleeing and dist < 250
        // (Simplified for now: if we have a target and we're moving toward it)
    } else if (ability === 'DECOY') {
      if (totalMass < p.lastMass * 0.85 && Date.now() - p.lastMassLossTime < 3000) shouldActivate = true;
    }

    if (shouldActivate) {
      if (AbilitySystem.tryActivate(p.id, AppState)) {
        io.emit('ability_event', { playerId: p.id, ability, ts: Date.now() });
      }
    }
  }
  p.lastMass = totalMass;
  if (totalMass < p.lastMass) p.lastMassLossTime = Date.now();

  if (p.botTargetTime > Date.now()) return;
  p.botTargetTime = Date.now() + 500;

  let bestScore = -Infinity;
  let targetPlayer = null;

  for (const tid in players) {
    if (tid === p.id) continue;
    const tp = players[tid];
    if (!tp.blobs || !tp.blobs.length) continue;
    const score = scoreTarget(p, tp);
    if (score > bestScore) {
      bestScore = score;
      targetPlayer = tp;
    }
  }

  // Archetype Behavior (Task 1)
  let moveTarget = null;

  if (p.archetype === 'HUNTER') {
    if (targetPlayer) moveTarget = targetPlayer.blobs[0];
    else {
      let closestF = null, cDist = Infinity;
      for (const fid in foods) {
        const f = foods[fid];
        const dist = Math.hypot(b.x-f.x, b.z-f.z);
        if (dist < cDist) { cDist = dist; closestF = f; }
      }
      if (closestF) moveTarget = closestF;
    }
  } else if (p.archetype === 'FARMER') {
    let bestCell = null, maxFood = -1;
    grid.forEach(cell => {
      if (cell.foods.length > maxFood) {
        maxFood = cell.foods.length;
        bestCell = cell;
      }
    });
    // Just find nearest food in best cell or overall
    let closestF = null, cDist = Infinity;
    for (const fid in foods) {
      const f = foods[fid];
      const dist = Math.hypot(b.x-f.x, b.z-f.z);
      if (dist < cDist) { cDist = dist; closestF = f; }
    }
    moveTarget = closestF;
    // Flee
    const threat = Object.values(players).find(tp => tp.id !== p.id && tp.blobs && tp.blobs[0] && Math.hypot(b.x-tp.blobs[0].x, b.z-tp.blobs[0].z) < 250 && tp.score > p.score);
    if (threat) {
      const dx = b.x - threat.blobs[0].x, dz = b.z - threat.blobs[0].z;
      const len = Math.hypot(dx, dz) || 1;
      p.input = { dx: dx/len, dz: dz/len };
      return;
    }
  } else if (p.archetype === 'DEFENDER') {
    const waypoints = [{x:0,z:0}, {x:200,z:0}, {x:0,z:200}];
    p.waypointIdx = p.waypointIdx || 0;
    const wp = waypoints[p.waypointIdx];
    if (Math.hypot(b.x-wp.x, b.z-wp.z) < 50) p.waypointIdx = (p.waypointIdx + 1) % waypoints.length;
    moveTarget = wp;
    // Shoot virus
    const largePlayer = Object.values(players).find(tp => tp.id !== p.id && tp.blobs && tp.blobs[0] && Math.hypot(b.x-tp.blobs[0].x, b.z-tp.blobs[0].z) < 500 && tp.score > totalMass * 1.5);
    if (largePlayer && Date.now() - (p.lastShoot||0) > 1000) {
       // logic to shoot virus (placeholder for Task 1)
       p.lastShoot = Date.now();
    }
  } else if (p.archetype === 'GHOST') {
     if (targetPlayer) {
       moveTarget = targetPlayer.blobs[0];
       if (Date.now() - (p.lastGhostSplit||0) > (8000 + Math.random()*4000)) {
         handleSplit(p);
         p.lastGhostSplit = Date.now();
       }
     }
  } else if (p.archetype === 'APEX') {
    if (targetPlayer && totalMass > 600) moveTarget = targetPlayer.blobs[0];
    else if (totalMass < 300) {
      // Farm
    }
  }

  if (moveTarget) {
    const dx = moveTarget.x - b.x;
    const dz = moveTarget.z - b.z;
    const len = Math.hypot(dx, dz) || 1;
    p.input = { dx: dx/len, dz: dz/len };
  }
}

// ─── SPATIAL HASH ─────────────────────────────────────────────
const CELL_SIZE = 200;
let grid = new Map();

function buildSpatialHash() {
  grid.clear();
  // Insert foods
  for (const id in foods) {
    const f = foods[id];
    const cx = Math.floor(f.x / CELL_SIZE), cz = Math.floor(f.z / CELL_SIZE);
    const key = `${cx},${cz}`;
    if (!grid.has(key)) grid.set(key, { foods: [], viruses: [], blobs: [] });
    grid.get(key).foods.push(f);
  }
  // Insert viruses
  for (const id in viruses) {
    const v = viruses[id];
    const cx = Math.floor(v.x / CELL_SIZE), cz = Math.floor(v.z / CELL_SIZE);
    const key = `${cx},${cz}`;
    if (!grid.has(key)) grid.set(key, { foods: [], viruses: [], blobs: [] });
    grid.get(key).viruses.push(v);
  }
  // Insert blobs
  for (const pid in players) {
    const p = players[pid];
    if (!p.blobs) continue;
    for (let i = 0; i < p.blobs.length; i++) {
      const b = p.blobs[i];
      const cx = Math.floor(b.x / CELL_SIZE), cz = Math.floor(b.z / CELL_SIZE);
      const key = `${cx},${cz}`;
      if (!grid.has(key)) grid.set(key, { foods: [], viruses: [], blobs: [] });
      grid.get(key).blobs.push({ pid, idx: i, blob: b });
    }
  }
}

function getNearbyCells(x, z) {
  const cx = Math.floor(x / CELL_SIZE), cz = Math.floor(z / CELL_SIZE);
  const cells = [];
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const key = `${cx+i},${cz+j}`;
      if (grid.has(key)) cells.push(grid.get(key));
    }
  }
  return cells;
}
AppState.getNearbyCells = getNearbyCells;

// ─── PHYSICS & COLLISIONS ──────────────────────────────────────
function massToRadius(m) { return Math.pow(m, 0.45) * 2.2; }

function checkEating() {
  let eatenFoods = [], eatenViruses = [], eatenBlobs = [];

  for (const pid in players) {
    const p = players[pid];
    if (!p.blobs) continue;
    for (let i=0; i<p.blobs.length; i++) {
      const b = p.blobs[i];
      const r = massToRadius(b.mass);
      const nearby = getNearbyCells(b.x, b.z);

      for (const cell of nearby) {
        // Food
        for (const f of cell.foods) {
          if (foods[f.id] && Math.hypot(b.x-f.x, b.z-f.z) < r) {
            b.mass += f.mass; p.score += f.mass; p.xp += 1;
            eatenFoods.push(f.id); delete foods[f.id];
            if (!p.isBot) io.to(pid).emit('feedbackEatFood', {x:f.x, z:f.z});
          }
        }
        // Viruses
        for (const v of cell.viruses) {
          if (viruses[v.id] && b.mass > 200 && Math.hypot(b.x-v.x, b.z-v.z) < r) {
            eatenViruses.push(v.id); delete viruses[v.id];
            explodeVirus(p, i);
            break; // blob was destroyed/split
          }
        }
        // Other blobs
        for (const other of cell.blobs) {
          if (other.pid === pid) continue;
          const ob = other.blob;
          if (!ob || !b) continue;
          if (players[other.pid].shielded) continue; // SHIELD counter
          if (b.mass > ob.mass * 1.12 && Math.hypot(b.x-ob.x, b.z-ob.z) < r * 0.75) {
            b.mass += ob.mass; p.score += ob.mass;
            p.kills++; p.streak++; p.xp += Math.floor(50 + (ob.mass/10));
            eatenBlobs.push({ eaterPid: pid, eaterIdx: i, victimPid: other.pid, victimIdx: other.idx });
            if (!p.isBot) io.to(pid).emit('feedbackEatPlayer', {x:ob.x, z:ob.z, mass:ob.mass, streak:p.streak, color:players[other.pid].color});
            io.emit('kill_feed', { killer: p.name, victim: players[other.pid].name });
          }
        }
        
        // Decoys
        for (let j = AppState.decoys.length - 1; j >= 0; j--) {
          const decoy = AppState.decoys[j];
          if (decoy.ownerId === pid) continue;
          if (Math.hypot(b.x - decoy.x, b.z - decoy.z) < r + massToRadius(decoy.mass) * 0.5) {
            AppState.decoys.splice(j, 1);
            if (!p.isBot) io.to(pid).emit('decoyHit');
          }
        }
      }
    }
  }

  // Process blob deaths
  for (const e of eatenBlobs) {
    const vp = players[e.victimPid];
    if (vp && vp.blobs && vp.blobs[e.victimIdx]) {
      vp.blobs.splice(e.victimIdx, 1);
      if (vp.blobs.length === 0) {
        if (vp.isBot) { setTimeout(() => addBot(), 3000); delete players[e.victimPid]; }
        else io.to(e.victimPid).emit('dead', { killedBy: players[e.eaterPid].name });
      }
    }
  }

  while (Object.keys(foods).length < FOOD_COUNT) spawnFood();
  while (Object.keys(viruses).length < VIRUS_COUNT) spawnVirus();
}

function explodeVirus(p, blobIdx) {
  const b = p.blobs[blobIdx];
  const parts = Math.min(8, MAX_BLOBS - p.blobs.length + 1);
  if (parts <= 1) return;
  const newMass = b.mass / parts;
  p.blobs.splice(blobIdx, 1);
  p.streak = 0;
  for (let i=0; i<parts; i++) {
    const angle = (Math.PI*2/parts)*i;
    p.blobs.push({
      id: `${p.id}_${Date.now()}_${i}`,
      x: b.x, z: b.z, mass: newMass,
      vx: Math.cos(angle) * SPLIT_SPEED * 0.8,
      vz: Math.sin(angle) * SPLIT_SPEED * 0.8
    });
  }
  if (!p.isBot) io.to(p.id).emit('virusHit', {x:b.x, z:b.z});
}

function handleSplit(p) {
  if (Date.now() - p.lastSplit < 500) return;
  const canSplit = p.blobs.filter(b => b.mass >= MIN_MASS * 2);
  if (canSplit.length === 0 || p.blobs.length >= MAX_BLOBS) return;
  p.lastSplit = Date.now();
  let toAdd = [];
  for (const b of canSplit) {
    if (p.blobs.length + toAdd.length >= MAX_BLOBS) break;
    b.mass /= 2;
    const dx = p.input?.dx || 1, dz = p.input?.dz || 0;
    toAdd.push({
      id: `${p.id}_${Date.now()}_${Math.random()}`,
      x: b.x, z: b.z, mass: b.mass,
      vx: dx * SPLIT_SPEED, vz: dz * SPLIT_SPEED
    });
  }
  p.blobs.push(...toAdd);
  if (!p.isBot) io.to(p.id).emit('splitEffect');
}

// ─── TICK LOOP ────────────────────────────────────────────────
let payloadLogTimer = 0;
setInterval(() => {
  const dt = TICK_MS / 1000;
  
  buildSpatialHash();
  AbilitySystem.tick(AppState, TICK_MS);

  for (const pid in players) {
    const p = players[pid];
    if (!p.blobs) continue;
    if (p.isBot) updateBot(p, dt);

    for (const blob of p.blobs) {
      blob.x += (blob.vx||0) * dt;
      blob.z += (blob.vz||0) * dt;
      blob.vx = (blob.vx||0) * 0.87;
      blob.vz = (blob.vz||0) * 0.87;
      blob.x = Math.max(-ARENA/2, Math.min(ARENA/2, blob.x));
      blob.z = Math.max(-ARENA/2, Math.min(ARENA/2, blob.z));
      blob.mass = Math.max(MIN_MASS, blob.mass * MASS_LOSS_RATE);
    }

    if (p.input) {
      const { dx, dz } = p.input;
      const totalMass = p.blobs.reduce((s,b)=>s+b.mass,0);
      const speed = BASE_SPEED * Math.pow(totalMass / p.blobs.length, -0.22);
      for (const blob of p.blobs) {
        blob.x += dx * speed * dt;
        blob.z += dz * speed * dt;
        blob.x = Math.max(-ARENA/2, Math.min(ARENA/2, blob.x));
        blob.z = Math.max(-ARENA/2, Math.min(ARENA/2, blob.z));
      }
    }
  }

  checkEating();

  // Network Serialization
  const ts = Date.now();
  const worldState = {
    players: Object.values(players).map(p => ({ 
        id:p.id, name:p.name, color:p.color, blobs:p.blobs, score:p.score||0, kills:p.kills||0, xp:p.xp||0,
        shielded: p.shielded, dashing: p.dashing, ability: AppState.abilities.get(p.id)
    })),
    leaderboard: Object.values(players).sort((a,b)=>b.score-a.score).slice(0,10).map(p=>({id:p.id, name:p.name, mass:Math.floor(p.score)})),
    foods, viruses, decoys: AppState.decoys
  };
  const wsBuffer = msgpack.encode(worldState);

  payloadLogTimer++;
  if (payloadLogTimer === 100) {
      console.log(`Payload Size: ${JSON.stringify(worldState).length} bytes (JSON) vs ${wsBuffer.byteLength} bytes (MsgPack)`);
      payloadLogTimer = 0;
  }

  for (const [id, socket] of io.sockets.sockets) {
    if (!socket.clientState) socket.clientState = { lastSeq: 0 };
    
    // Delta-state compression
    const seqGap = socket.clientState.clientSeq ? (socket.serverSeq - socket.clientState.clientSeq) : 0;
    if (!socket.clientState.hasFullState || seqGap > 3) {
      socket.emit('world_state', wsBuffer);
      socket.clientState.hasFullState = true;
    } else {
      // Create delta state (simplified for v2 phase 1: just send players and new foods/viruses if any)
      const ds = {
        players: worldState.players,
        leaderboard: worldState.leaderboard,
        ts
      };
      socket.emit('delta_state', msgpack.encode(ds));
    }
    socket.serverSeq = (socket.serverSeq || 0) + 1;
  }

}, TICK_MS);


// ─── SOCKET ───────────────────────────────────────────────────
io.on('connection', socket => {
  console.log(`+ ${socket.id}`);
  socket.serverSeq = 0;

  socket.on('join', (data) => {
    let payload;
    try { payload = msgpack.decode(new Uint8Array(data)); } catch(e) { payload = data; } // Fallback if client isn't msgpack yet
    const name = payload.name || 'PLAYER';
    const color = payload.color || '#00ffff';
    players[socket.id] = {
      id: socket.id, isBot: false,
      name: name.toUpperCase().slice(0,16),
      color: color,
      blobs: [{ id:`${socket.id}_r${Date.now()}`, x:rndArena(), z:rndArena(), vx:0, vz:0, mass:MIN_MASS }],
      score:0, kills:0, streak:0, xp:0, lastSplit:0, input:{ dx:0, dz:0 },
      activeAbility: payload.ability || 'SHIELD'
    };
    AppState.abilities.set(socket.id, { ability: payload.ability || 'SHIELD', remainingMs: 0, active: false, activeDuration: 0 });
    socket.emit('init', msgpack.encode({ id:socket.id, arenaSize:ARENA }));
  });

  socket.on('input', (data) => {
    let payload;
    try { payload = msgpack.decode(new Uint8Array(data)); } catch(e) { payload = data; }
    const p = players[socket.id];
    if (!p) return;
    p.input = { dx: Math.max(-1,Math.min(1,payload.dx||0)), dz: Math.max(-1,Math.min(1,payload.dz||0)) };
    if (socket.clientState) socket.clientState.clientSeq = payload.seq;
  });

  socket.on('ability', () => {
    if (AbilitySystem.tryActivate(socket.id, AppState)) {
        const p = players[socket.id];
        const ability = AppState.abilities.get(socket.id).ability;
        io.emit('ability_event', { playerId: socket.id, ability, ts: Date.now() });
    }
  });

  socket.on('split', () => { if (players[socket.id]) handleSplit(players[socket.id]); });
  
  socket.on('boost', () => {
    const p = players[socket.id];
    if (!p || !p.blobs) return;
    for (const blob of p.blobs) {
      if (blob.mass < MIN_MASS + BOOST_MASS_COST) continue;
      blob.mass -= BOOST_MASS_COST;
      const dx = p.input?.dx || 0, dz = p.input?.dz || 0;
      const len = Math.hypot(dx, dz) || 1;
      blob.vx = (dx/len) * BOOST_THRUST;
      blob.vz = (dz/len) * BOOST_THRUST;
    }
    socket.emit('feedbackBoost');
  });

  socket.on('respawn', (data) => {
    let payload;
    try { payload = msgpack.decode(new Uint8Array(data)); } catch(e) { payload = data; }
    players[socket.id] = {
      id: socket.id, isBot: false,
      name: (payload.name||'PLAYER').toUpperCase().slice(0,16),
      color: payload.color||'#00ffff',
      blobs: [{ id:`${socket.id}_r${Date.now()}`, x:rndArena(), z:rndArena(), vx:0, vz:0, mass:MIN_MASS }],
      score:0, kills:0, streak:0, xp:0, lastSplit:0, input:{ dx:0, dz:0 }
    };
    socket.emit('respawned', msgpack.encode({ id: socket.id }));
    socket.clientState.hasFullState = false; // Force full state next tick
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    console.log(`- ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
// ─── TICK LOOP ───────────────────────────────────────────────
setInterval(() => {
  const humanCount = Object.values(players).filter(p => !p.isBot).length;
  const targetBotCount = Math.max(5, 15 - humanCount);
  const currentBots = Object.values(players).filter(p => p.isBot);
  
  if (currentBots.length < targetBotCount) {
    addBot();
  } else if (currentBots.length > targetBotCount) {
    const lowest = currentBots.sort((a,b) => a.score - b.score)[0];
    if (lowest) {
      delete players[lowest.id];
      AppState.abilities.delete(lowest.id);
    }
  }
}, 10000);

server.listen(PORT, () => console.log(`\n🎮 BLOBZ.IO v2 → http://localhost:${PORT}\n`));
