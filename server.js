const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const msgpack = require('@msgpack/msgpack');

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
  players[id] = {
    id, isBot: true,
    name: BOT_NAMES[Math.floor(Math.random()*BOT_NAMES.length)],
    color: NEON_COLORS[Math.floor(Math.random()*NEON_COLORS.length)],
    blobs: [{ id: `${id}_0`, x: rndArena(), z: rndArena(), vx: 0, vz: 0, mass: Math.random()*200+100 }],
    score: 0, kills: 0, streak: 0, xp: 0, lastSplit: 0, input: { dx:0, dz:0 },
    archetype: BOT_ARCHETYPES[Math.floor(Math.random()*BOT_ARCHETYPES.length)],
    botTargetTime: 0
  };
}
for(let i=0; i<15; i++) addBot();

function updateBot(p, dt) {
  if (p.botTargetTime > Date.now()) return;
  p.botTargetTime = Date.now() + 500; // Eval every 10 ticks (500ms)

  let bestScore = -Infinity;
  let targetPos = null;
  const b = p.blobs[0];
  if (!b) return;

  // Simple desirability scoring
  for (const tid in players) {
    if (tid === p.id) continue;
    const tp = players[tid];
    if (!tp.blobs || !tp.blobs.length) continue;
    const tb = tp.blobs[0];
    const dist = Math.hypot(b.x-tb.x, b.z-tb.z);
    if (dist > 800) continue;
    const ratio = b.mass / tb.mass;
    const threat = ratio < 0.88 ? -1000 : 0;
    const score = (ratio * 400) - (dist * 0.8) + threat;
    if (score > bestScore) {
      bestScore = score;
      targetPos = { x: tb.x, z: tb.z, type: 'player', ratio };
    }
  }

  if (bestScore < 0 || p.archetype === 'FARMER') {
    let closestF = null, cDist = Infinity;
    for (const fid in foods) {
      const f = foods[fid];
      const dist = Math.hypot(b.x-f.x, b.z-f.z);
      if (dist < cDist && dist < 400) { cDist = dist; closestF = f; }
    }
    if (closestF) targetPos = { x: closestF.x, z: closestF.z, type: 'food' };
  }

  if (targetPos) {
    const dx = targetPos.x - b.x;
    const dz = targetPos.z - b.z;
    const len = Math.hypot(dx, dz) || 1;
    p.input = { dx: dx/len, dz: dz/len };
    if (targetPos.type === 'player' && targetPos.ratio > 2.5 && Math.random() < 0.2 && Date.now() - p.lastSplit > 5000) {
      handleSplit(p);
    }
  } else {
    if(Math.random()<0.2) p.input = { dx: Math.random()*2-1, dz: Math.random()*2-1 };
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
          if (b.mass > ob.mass * 1.12 && Math.hypot(b.x-ob.x, b.z-ob.z) < r * 0.75) {
            b.mass += ob.mass; p.score += ob.mass;
            p.kills++; p.streak++; p.xp += Math.floor(50 + (ob.mass/10));
            eatenBlobs.push({ eaterPid: pid, eaterIdx: i, victimPid: other.pid, victimIdx: other.idx });
            if (!p.isBot) io.to(pid).emit('feedbackEatPlayer', {x:ob.x, z:ob.z, mass:ob.mass, streak:p.streak, color:players[other.pid].color});
            io.emit('kill_feed', { killer: p.name, victim: players[other.pid].name });
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
    players: Object.values(players).map(p => ({ id:p.id, name:p.name, color:p.color, blobs:p.blobs, score:p.score||0, kills:p.kills||0, xp:p.xp||0 })),
    leaderboard: Object.values(players).sort((a,b)=>b.score-a.score).slice(0,10).map(p=>({id:p.id, name:p.name, mass:Math.floor(p.score)})),
    foods, viruses
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
      score:0, kills:0, streak:0, xp:0, lastSplit:0, input:{ dx:0, dz:0 }
    };
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
server.listen(PORT, () => console.log(`\n🎮 BLOBZ.IO v2 → http://localhost:${PORT}\n`));
