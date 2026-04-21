const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const msgpack = require('@msgpack/msgpack');
const AbilitySystem = require('./public/src/abilities/AbilitySystem');
const ModeManager = require('./public/src/modes/ModeManager');
const FFA = require('./public/src/modes/FFA');
const TeamArena = require('./public/src/modes/TeamArena');
const BattleRoyale = require('./public/src/modes/BattleRoyale');

app.use(express.static('public'));

const TICK_MS = 1000 / 20;
const MIN_MASS = 40;
const MAX_MASS = 25000;
const BASE_SPEED = 220;
const SPLIT_SPEED = 800;
const BOOST_THRUST = 550;
const BOOST_MASS_COST = 20;
const MAX_BLOBS = 16;
const CELL_SIZE = 200;

let globalChatBuffer = [];
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
    this.lastVirusId = 0;
    this.gameTime = 0;

    for(let i=0; i<700; i++) this.spawnFood();
    for(let i=0; i<20; i++) this.spawnVirus();
    this.botTimer = setInterval(() => this.scaleBots(), 10000);
  }

  rndArena() { return (Math.random() - 0.5) * this.arena; }

  spawnFood() {
    this.lastFoodId++;
    this.foods[this.lastFoodId] = { id: this.lastFoodId, x: this.rndArena(), z: this.rndArena(), mass: 3, color: '#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0') };
  }

  spawnVirus() {
    this.lastVirusId++;
    let vx, vz;
    do { vx=this.rndArena(); vz=this.rndArena(); } while(Object.values(this.players).some(p=>p.blobs&&p.blobs.some(b=>Math.hypot(b.x-vx, b.z-vz)<150)));
    this.viruses[this.lastVirusId] = { id: this.lastVirusId, x: vx, z: vz };
  }

  scaleBots() {
    const humanCount = Object.values(this.players).filter(p => !p.isBot).length;
    const targetBotCount = Math.max(5, 15 - humanCount);
    const currentBots = Object.values(this.players).filter(p => p.isBot);
    if (currentBots.length < targetBotCount) this.addBot();
    else if (currentBots.length > targetBotCount) {
      const lowest = currentBots.sort((a,b) => a.score - b.score)[0];
      if (lowest) this.removePlayer(lowest.id);
    }
  }

  addBot() {
    const id = 'bot_' + Math.random().toString(36).substr(2, 9);
    const archetypes = ['HUNTER', 'FARMER', 'DEFENDER', 'GHOST', 'APEX'];
    const archetype = archetypes[Math.floor(Math.random()*archetypes.length)];
    let ability = 'SHIELD';
    const weight = Math.random();
    if (weight > 0.8) ability = 'DECOY';
    else if (weight > 0.6) ability = 'DASH';
    else if (weight > 0.4) ability = 'MAGNET';

    const bot = {
      id, isBot: true,
      name: ['NEXUS', 'CIPHER', 'ROGUE', 'ECHO', 'NOVA', 'FLUX', 'ATLAS', 'TITAN'][Math.floor(Math.random()*8)],
      color: ['#ff0088','#00ffff','#ffff00','#ff6600','#00ff88','#ff00ff'][Math.floor(Math.random()*6)],
      blobs: [{ id: `${id}_0`, x: this.rndArena(), z: this.rndArena(), vx: 0, vz: 0, mass: Math.random()*200+100 }],
      score: 0, kills: 0, streak: 0, xp: 0, lastSplit: 0, input: { dx:0, dz:0 },
      archetype,
      botTargetTime: 0,
      activeAbility: ability
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
      const cx = Math.floor(f.x / CELL_SIZE), cz = Math.floor(f.z / CELL_SIZE);
      const key = `${cx},${cz}`;
      if (!this.grid.has(key)) this.grid.set(key, { foods: [], viruses: [], blobs: [] });
      this.grid.get(key).foods.push(f);
    }
    for (const id in this.viruses) {
      const v = this.viruses[id];
      const cx = Math.floor(v.x / CELL_SIZE), cz = Math.floor(v.z / CELL_SIZE);
      const key = `${cx},${cz}`;
      if (!this.grid.has(key)) this.grid.set(key, { foods: [], viruses: [], blobs: [] });
      this.grid.get(key).viruses.push(v);
    }
    for (const pid in this.players) {
      const p = this.players[pid];
      if (!p.blobs) continue;
      for (let i = 0; i < p.blobs.length; i++) {
        const b = p.blobs[i];
        const cx = Math.floor(b.x / CELL_SIZE), cz = Math.floor(b.z / CELL_SIZE);
        const key = `${cx},${cz}`;
        if (!this.grid.has(key)) this.grid.set(key, { foods: [], viruses: [], blobs: [] });
        this.grid.get(key).blobs.push({ pid, idx: i, blob: b });
      }
    }
  }

  getNearbyCells(x, z) {
    const cx = Math.floor(x / CELL_SIZE), cz = Math.floor(z / CELL_SIZE);
    const cells = [];
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const key = `${cx+i},${cz+j}`;
        if (this.grid.has(key)) cells.push(this.grid.get(key));
      }
    }
    return cells;
  }

  tick() {
    const dt = TICK_MS / 1000;
    this.gameTime += TICK_MS;
    this.buildSpatialHash();
    
    const appState = {
      players: this.players, foods: this.foods, viruses: this.viruses,
      abilities: this.abilities, decoys: this.decoys,
      getNearbyCells: (x, z) => this.getNearbyCells(x, z)
    };
    AbilitySystem.tick(appState, TICK_MS);
    this.mode.onTick(this, TICK_MS);

    for (const pid in this.players) {
      const p = this.players[pid];
      if (!p.blobs) continue;
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
        const speed = BASE_SPEED * this.mode.getSpeedMultiplier() * Math.pow(totalMass / p.blobs.length, -0.22);
        for (const b of p.blobs) {
          b.x += dx * speed * dt;
          b.z += dz * speed * dt;
          b.x = Math.max(-this.arena/2, Math.min(this.arena/2, b.x));
          b.z = Math.max(-this.arena/2, Math.min(this.arena/2, b.z));
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
        for (const f of cell.foods) {
          if (this.foods[f.id] && Math.hypot(b.x-f.x, b.z-f.z) < r) {
            b.mass += f.mass; p.score += f.mass; p.xp += 1;
            delete this.foods[f.id];
            if (!p.isBot) io.to(p.id).emit('feedbackEatFood', {x:f.x, z:f.z});
          }
        }
        for (const v of cell.viruses) {
          if (this.viruses[v.id] && b.mass > 200 && Math.hypot(b.x-v.x, b.z-v.z) < r) {
            delete this.viruses[v.id];
            this.explodeVirus(p, i);
            break;
          }
        }
        for (const other of cell.blobs) {
          if (other.pid === p.id) continue;
          const ob = other.blob;
          if (!ob || !b) continue;
          const target = this.players[other.pid];
          if (target && this.mode.canEat(p, target) && Math.hypot(b.x-ob.x, b.z-ob.z) < r * 0.75) {
            b.mass += ob.mass; p.score += ob.mass;
            p.kills++; p.streak++; p.xp += Math.floor(50 + (ob.mass/10));
            eatenBlobs.push({ eaterPid: p.id, eaterIdx: i, victimPid: other.pid, victimIdx: other.idx });
            if (!p.isBot) io.to(p.id).emit('feedbackEatPlayer', {x:ob.x, z:ob.z, mass:ob.mass, streak:p.streak, color:target.color});
            io.to(this.id).emit('kill_feed', { killer: p.name, victim: target.name });
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
            else io.to(e.victimPid).emit('dead', { killedBy: this.players[e.eaterPid].name });
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
    p.botTargetTime = Date.now() + 500;
    let cDist = Infinity, moveTarget = null;
    for (const fid in this.foods) {
      const f = this.foods[fid], d = Math.hypot(b.x-f.x, b.z-f.z);
      if (d < cDist) { cDist = d; moveTarget = f; }
    }
    if (moveTarget) {
      const dx = moveTarget.x - b.x, dz = moveTarget.z - b.z, l = Math.hypot(dx, dz) || 1;
      p.input = { dx: dx/l, dz: dz/l };
    }
  }

  broadcastState() {
    const worldState = {
      players: Object.values(this.players).map(p => ({
          id:p.id, name:p.name, color:p.color, blobs:p.blobs, score:p.score||0, kills:p.kills||0, xp:p.xp||0, team:p.team,
          shielded: p.shielded, dashing: p.dashing, magnetActive: p.magnetActive, ability: this.abilities.get(p.id)
      })),
      leaderboard: Object.values(this.players).sort((a,b)=>b.score-a.score).slice(0,10).map(p=>({id:p.id, name:p.name, mass:Math.floor(p.score)})),
      foods: this.foods, viruses: this.viruses, decoys: this.decoys
    };
    io.to(this.id).emit('world_state', msgpack.encode(worldState));
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
    io.emit('new_global_chat', msg);
  });

  socket.on('join', (data) => {
    let payload = data;
    try { if(data instanceof Uint8Array) payload = msgpack.decode(data); } catch(e){}
    const roomType = payload.mode || 'ffa';
    const room = rooms[roomType];
    if (!room) return;
    socket.join(roomType);
    socket.roomType = roomType;
    const p = {
      id: socket.id, isBot: false,
      name: (payload.name || 'PLAYER').toUpperCase().slice(0,16),
      color: payload.color || '#00ffff',
      blobs: [{ id: `${socket.id}_0`, x: room.rndArena(), z: room.rndArena(), vx: 0, vz: 0, mass: 100 }],
      score: 0, kills: 0, streak: 0, xp: 0, lastSplit: 0, input: { dx:0, dz:0 },
      activeAbility: payload.ability || 'SHIELD'
    };
    room.players[socket.id] = p;
    room.abilities.set(socket.id, { ability: p.activeAbility, remainingMs: 0, active: false, activeDuration: 0 });
    room.mode.onPlayerJoin(p, room);
    socket.emit('init', msgpack.encode({ id: socket.id }));
  });

  socket.on('input', data => {
    const room = rooms[socket.roomType];
    if (!room) return;
    const p = room.players[socket.id];
    if (!p) return;
    try {
      const pkt = msgpack.decode(new Uint8Array(data));
      p.input = { dx: pkt.dx, dz: pkt.dz };
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

server.listen(3000, () => console.log('🎮 BLOBZ.IO v2 → http://localhost:3000'));
