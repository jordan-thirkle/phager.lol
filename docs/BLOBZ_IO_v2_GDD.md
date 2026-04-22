# BLOBZ.IO — Complete Technical & Game Design Document v2.0
> **For developer / AI agent implementation. Every section is a concrete build spec.**

---

## Table of Contents
1. [Project Overview & Jam Compliance](#1-project-overview--jam-compliance)
2. [Architecture Overview](#2-architecture-overview)
3. [Core Game Mechanics (Expanded)](#3-core-game-mechanics-expanded)
4. [Ability System (NEW)](#4-ability-system-new)
5. [Game Modes (NEW)](#5-game-modes-new)
6. [Progression & Meta-Game (Expanded)](#6-progression--meta-game-expanded)
7. [Bot AI v2 (Expanded)](#7-bot-ai-v2-expanded)
8. [Procedural Asset Generation (Expanded)](#8-procedural-asset-generation-expanded)
9. [Networking & Server Architecture (Expanded)](#9-networking--server-architecture-expanded)
10. [Client Rendering & Game Loop (Expanded)](#10-client-rendering--game-loop-expanded)
11. [UI/UX System (Expanded)](#11-uiux-system-expanded)
12. [Mobile & Accessibility Support (NEW)](#12-mobile--accessibility-support-new)
13. [Performance Targets & Optimization Guide](#13-performance-targets--optimization-guide)
14. [File & Module Structure](#14-file--module-structure)

---

## 1. Project Overview & Jam Compliance

**BLOBZ.IO** is a fast-paced 3D multiplayer arena growth game (agar.io lineage) in a neon cyberpunk aesthetic, built for Vibe Jam 2026 using the PlayCanvas WebGL engine in pure script mode (no editor).

### Hard Constraints (unchanged)
| Rule | Implementation |
|---|---|
| Zero external assets | All textures, audio, and geometry generated via Canvas 2D / Web Audio API at runtime |
| No loading screens | All generation is synchronous or completes within a single frame before the main menu renders |
| PlayCanvas engine only | `https://code.playcanvas.com/playcanvas-stable.min.js` via CDN |

### New v2 Goals
- Support **3 distinct game modes** with a single shared codebase via a `GameMode` strategy class
- Add a **full ability system** (4 abilities per player, cooldown-driven)
- Improve bot AI to **5 behavior archetypes** with emergent group tactics
- Add **mobile touch support** with a virtual joystick and tap-to-split
- Implement a **spectator camera** with smooth fly-through interpolation
- Add a **persistent meta-progression** layer: unlockable skins, titles, and ability loadouts stored in `localStorage`

---

## 2. Architecture Overview

```
/
├── index.html          # Single HTML shell; loads PlayCanvas + game.js
├── server.js           # Node.js authoritative game server (Socket.io)
├── src/
│   ├── game.js         # Entry point: bootstraps PlayCanvas, connects modules
│   ├── modes/
│   │   ├── ModeManager.js      # Strategy pattern: swaps mode logic at runtime
│   │   ├── FFA.js              # Free-For-All (default)
│   │   ├── TeamArena.js        # 2-team CTF-lite mode
│   │   └── BattleRoyale.js     # Shrinking arena + last-blob-standing
│   ├── abilities/
│   │   ├── AbilitySystem.js    # Cooldown tracker, activation pipeline
│   │   ├── ability_shield.js
│   │   ├── ability_magnet.js
│   │   ├── ability_dash.js
│   │   └── ability_decoy.js
│   ├── audio.js        # Web Audio synth (expanded)
│   ├── skins.js        # Canvas 2D texture generator (expanded)
│   ├── particles.js    # Object-pooled particle engine (expanded)
│   ├── camera.js       # Camera controller (extracted from game.js)
│   ├── hud.js          # All HTML overlay rendering
│   ├── minimap.js      # Canvas radar (extracted)
│   ├── input.js        # Unified input: keyboard, mouse, touch, gamepad
│   └── meta.js         # localStorage persistence layer
```

### State Machine (Client)
```
MENU → [Play / Spectate / Settings]
  ↓
MODE_SELECT → [FFA | Team | Battle Royale]
  ↓
CONNECTING → (socket handshake + world snapshot)
  ↓
PLAYING ←→ SPECTATING (on death)
  ↓
DEAD (death screen: 3s) → MENU
```

---

## 3. Core Game Mechanics (Expanded)

### 3.1 Arena

| Property | FFA | Team Arena | Battle Royale |
|---|---|---|---|
| Size | 3000×3000 | 2500×2500 | 4000×4000 → shrinks |
| Floor grid | Cyan neon | Blue/Red split | Orange neon |
| Food orbs | 700 | 500 | 600 |
| Viruses | 20 | 15 | 25 |
| Shrink wall (BR only) | — | — | Starts at t=60s, 2u/s |

The arena floor is a **procedural grid shader**: grid lines pulse with a sine wave keyed to `Date.now()`, creating a living, breathing floor without any texture files. Boundary walls emit a constant outer glow using additive `pc.Layer` transparency.

### 3.2 Mass, Movement & Physics

**Mass → Radius conversion:**
```javascript
// radius grows sub-linearly so large blobs don't become screen-filling
radius = Math.pow(mass, 0.45) * 2.2;
```

**Movement speed (server-authoritative):**
```javascript
speed = BASE_SPEED * Math.pow(mass, -0.22) * modeSpeedMultiplier;
// Minimum speed floor: 60 units/s (prevents full stop)
// Boost applies multiplicative: speed *= 2.4 for 0.6s
```

**Mass Decay:**
- FFA: `mass *= 0.9997` per server tick (aggressive, forces action)
- Team Arena: `mass *= 0.9999` (slower — rewards coordination)
- Battle Royale: No natural decay (shrink wall provides pressure instead)
- **Minimum mass:** 40 (prevents players from shrinking below playability)

### 3.3 Splitting

- `SPACE` or double-tap on mobile
- Halves current blobs, launches new half at `velocity = speed * 8` in current movement direction
- Maximum 16 simultaneous blobs per player (unchanged)
- **New — Merge Timer:** Split blobs cannot recombine for `Math.max(15, mass / 30)` seconds. Displayed as a small countdown arc on each floating blob.
- **New — Smart Merge:** Blobs automatically begin merging when the timer expires; no player input required.

### 3.4 Boosting

- `W` / `SHIFT` / swipe-up on mobile
- Costs 20 mass; minimum mass to boost: 80
- **v2 change:** Boost now emits a trail of 5 small "afterimage" ghost blobs (purely visual, no collision) that fade over 0.4s. Implemented via the particle pool.

### 3.5 Viruses (Expanded)

- Still 20 per arena (respawn 5s after being consumed)
- **New — Virus Shooting:** If a player feeds 7 mass orbs (W-key eject) into a virus, it splits and launches a new virus in that direction. This is the primary counterplay for large players.
- **New — Virus Color:** Color shifts from green → yellow as it absorbs fed mass, giving visual feedback on "charge level."
- Explosion behavior unchanged: >200 mass player explodes into up to 8 pieces.

### 3.6 Mass Ejection (Feeding)

- `W` key ejects a small orb (cost: 16 mass, orb value: 12 mass — net loss is intentional to discourage spam)
- Primary uses: feed teammates (Team mode), charge viruses, bait smaller players
- Ejected orbs are physics objects: they travel 120 units then decelerate to a stop and become collectible food

---

## 4. Ability System (NEW)

Each player has **one equipped active ability** (chosen at the menu) and **two passive perks** (unlocked via meta-progression). Abilities have a cooldown displayed as a radial progress arc on the HUD.

### 4.1 Active Abilities

#### 🛡️ SHIELD
| Property | Value |
|---|---|
| Cooldown | 18s |
| Duration | 4s |
| Effect | Immune to being eaten; virus explosions still apply |
| Visual | Pulsing white hexagonal force-field mesh around the blob |
| Audio | Rising choir-style sine chord via Web Audio |
| Counter | Large players can still push shielded blobs using mass eject |

#### 🧲 MAGNET
| Property | Value |
|---|---|
| Cooldown | 22s |
| Duration | 3s |
| Effect | All food orbs within `radius * 8` are pulled toward the player |
| Visual | Concentric ring pulse expanding outward (particle system, no texture) |
| Audio | Low wobbling sawtooth sweep |
| Counter | Viruses in range are NOT attracted (intentional) |

#### ⚡ DASH
| Property | Value |
|---|---|
| Cooldown | 12s |
| Duration | Instant (0.3s movement window) |
| Effect | Launches the player's largest blob at `speed * 15`, temporarily separating it |
| Visual | Motion-blur trail (3 semi-transparent ghost blobs) |
| Audio | Sharp square-wave crack |
| Counter | High skill ceiling — easy to overshoot into a virus |

#### 👻 DECOY
| Property | Value |
|---|---|
| Cooldown | 25s |
| Duration | 6s |
| Effect | Spawns a fake blob of equal visual size; decoy has no mass and disappears on contact |
| Visual | Decoy has an interior "static" shimmer via animated canvas texture |
| Audio | Glitchy stutter noise (square wave with frequency jitter) |
| Counter | Bots are NOT fooled by decoys (they check mass ratio, not position) |

### 4.2 Passive Perks

| Perk | Unlock Level | Effect |
|---|---|---|
| Tough Skin | 5 | Virus explosion reduces you to max 4 pieces (not 8) |
| Efficient Boost | 8 | Boost costs 14 mass instead of 20 |
| Quick Merge | 12 | Merge timer reduced by 25% |
| Apex Hunger | 16 | You can eat players at ≥8% mass advantage (down from 12%) |
| Iron Core | 20 | Minimum mass floored at 80 instead of 40 |
| Ghost Eject | 25 | Mass ejection (W) is invisible to enemy players for 1.5s |

---

## 5. Game Modes (NEW)

All modes share the same server tick loop. A `GameMode` strategy object is injected at room creation and provides mode-specific overrides to collision, scoring, and win-condition logic.

### 5.1 Free-For-All (FFA)
The default mode. First to 10,000 mass wins (triggers "CHAMPION" screen for all players). Otherwise runs indefinitely. Leaderboard is mass-ranked.

### 5.2 Team Arena (2-Team)
- Players assigned to Red or Blue team at join time (auto-balanced by count)
- **Team HUD:** Shows ally positions on minimap with friendly color
- **Friendly fire disabled:** You cannot eat teammates
- **Flag Orb:** A single large golden orb spawns at center. Carrying it grants +2 XP/s. The team holding it when the 5-minute timer expires wins
- **Team Leaderboard:** Shows combined mass per team + top 3 individual contributors

### 5.3 Battle Royale
- 20-player max lobby; game starts when ≥8 players ready
- **Safe Zone:** A visible green cylinder defines the safe area. It begins shrinking at t=60s. Players outside the shrink wall lose 2 mass/s (death if mass < min)
- **Shrink Schedule:**

| Phase | Start Time | Wall Speed |
|---|---|---|
| 1 | 60s | 2 units/s |
| 2 | 180s | 5 units/s |
| 3 | 300s | 12 units/s |

- **Zone visual:** Outer zone is a semi-transparent red cylinder (additive blend). Inner edge pulses blue
- **Placement tracking:** All deaths are ranked; final standings shown on end screen
- **No decay:** Mass only lost by virus/combat; shrink wall provides all pressure

---

## 6. Progression & Meta-Game (Expanded)

### 6.1 XP & Levels

| Action | XP Reward |
|---|---|
| Eat food orb | +1 |
| Eat player | `+50 + (target_mass / 10)` |
| Kill streak bonus | `+25 × streak_count` |
| Survive 5 minutes | +100 |
| Win a match | +500 |
| First blood (session) | +75 |

**Level thresholds** (cumulative XP):
```
1→2: 100    2→3: 250    3→4: 500    4→5: 900
5→10: +700/level    10→20: +1500/level    20+: +3000/level
```

### 6.2 Player Titles & Color Tiers

| Level | Title | Badge Color | Blob Aura |
|---|---|---|---|
| 1–4 | SPAWN | Gray (#888) | None |
| 5–9 | HUNTER | Green (#4eff91) | Faint pulse |
| 10–14 | PREDATOR | Cyan (#00eaff) | Slow orbit ring |
| 15–19 | APEX | Orange (#ff8c00) | Flame trail |
| 20–24 | PHANTOM | Magenta (#ff00cc) | Ghost shimmer |
| 25–29 | GODLIKE | Yellow (#ffe000) | Lightning arcs |
| 30+ | IMMORTAL | Red (#ff2244) | Full aura system |

Aura effects are rendered purely via particles.js — no textures.

### 6.3 Kill Streaks (Expanded)

| Kills | Message | Audio |
|---|---|---|
| 2 | DOUBLE KILL | 2-note chord |
| 3 | TRIPLE KILL | 3-note chord |
| 4 | QUAD KILL | 4-note chord |
| 5 | PENTA KILL | Arpeggio sweep |
| 7 | RAMPAGE!!! | Discordant stab |
| 10 | UNSTOPPABLE | Sub-bass boom |
| 15 | GODMODE | Full synth swell |

Streak resets on death OR on virus explosion.

### 6.4 Achievements System (NEW)

Stored in `localStorage.blobz_achievements` as a bitmask.

| ID | Name | Criteria | Reward |
|---|---|---|---|
| 1 | First Blood | Eat 1 player | Unlock "Dots" skin |
| 2 | Mass Monster | Reach 5000 mass | Unlock "Hexagon" skin |
| 3 | Untouchable | Win FFA without dying | Unlock "PHANTOM" title early |
| 4 | Virus King | Trigger 10 virus explosions on enemies | Unlock "Lightning" skin |
| 5 | Speed Demon | Boost 50 times in one session | Unlock "Dash" ability |
| 6 | Team Player | Win 3 Team Arena matches | Unlock "Checkers" skin |
| 7 | Last One Standing | Win Battle Royale | Unlock "IMMORTAL" badge effect |
| 8 | Pacifist | Reach 2000 mass eating only food | Unlock "Swirl" skin |

### 6.5 Cosmetic Loadout (NEW)

Accessible from the main menu under "CUSTOMIZE":
- **Skin pattern** (8 options — unlocked via achievements/level)
- **Primary color** (HSL color picker — full freedom)
- **Active ability** (3 unlocked by default; 4th unlocked at level 10)
- **Title** (display title shown on the leaderboard)

All stored in `localStorage.blobz_loadout`.

---

## 7. Bot AI v2 (Expanded)

The server maintains **12–15 bots** (auto-scaled to keep arena density ≥ 40% of max player count). Bots run on the server tick thread and use the same physics pipeline as players.

### 7.1 Bot Archetypes

| Archetype | Name Pool | Mass Range | Behavior |
|---|---|---|---|
| HUNTER | NEXUS, CIPHER, ROGUE | 300–800 | Aggressively pursues any player at ≤85% own mass |
| FARMER | ECHO, NOVA, FLUX | 80–400 | Prioritizes food; avoids combat unless cornered |
| DEFENDER | ATLAS, TITAN | 500–1200 | Patrols center; uses viruses offensively |
| GHOST | SPECTER, WRAITH | 150–500 | Splits constantly to chase; bait-and-ambush playstyle |
| APEX | VORTEX, OMEGA | 800–2500 | All-around: hunts players, shoots viruses, uses position |

### 7.2 Target Evaluation (Updated)

```javascript
// Bot desirability score — higher = more attractive target
function scoreTarget(bot, target) {
  const massRatio = bot.mass / target.mass;
  const distance = vec3Distance(bot.pos, target.pos);
  const threat = massRatio < 0.88 ? -Infinity : 0; // never chase if target can eat you
  const virusNear = virusesNear(target.pos, 80) ? -200 : 0; // don't chase into viruses
  const abilityBonus = target.activeAbility === 'SHIELD' ? -150 : 0; // avoid shielded
  return (massRatio * 400) - (distance * 0.8) + threat + virusNear + abilityBonus;
}
```

### 7.3 Group Behavior (NEW)

HUNTER-archetype bots with mass within 20% of each other will enter **PACK MODE** if within 300 units of a large player:
- They converge from opposite sides (server computes flanking angle)
- The bot with higher mass acts as "bait" to trigger a split; the second bot sweeps in
- Pack mode dissolves if either bot dies or the target escapes >500 units

### 7.4 Bot Ability Use

Bots randomly receive an ability at spawn (weighted toward lower-tier abilities). Usage rules:
- SHIELD: Activate when a larger player is within `radius * 3`
- MAGNET: Activate when ≥10 food orbs are within range
- DASH: Activate when target is fleeing and within 200 units
- DECOY: Activate when mass is being lost rapidly (under pressure)

---

## 8. Procedural Asset Generation (Expanded)

### 8.1 audio.js — Web Audio Synth (Expanded)

All sounds use the Web Audio API. The `AudioContext` is resumed on first user gesture.

**New sound events:**

| Event | Synthesis Method |
|---|---|
| Shield activate | Choir: 3 oscillators at unison + octave, slow attack, 0.5s decay |
| Magnet pulse | Wobble: LFO-modulated bandpass filter on white noise |
| Dash crack | Square wave, 1ms attack, 50ms decay, pitch 800→200 Hz |
| Decoy spawn | Frequency jitter: square wave with `Math.random()` freq per 20ms frame |
| Zone damage (BR) | Sub-bass sine 40 Hz + high-frequency crackle, loops while active |
| Achievement unlock | 5-note ascending major arpeggio, sine wave, slow fade |
| Match win | Full 8-note fanfare: chord stacking via scheduled `oscillator.start()` |

**Master volume / mute:** Routed through a single `GainNode` (master bus). Mute button in settings toggles `masterGain.gain.value` between 0 and 1.

### 8.2 skins.js — Canvas Texture Generator (Expanded)

All textures 256×256px baked to `pc.Texture` at startup.

**Existing patterns:** solid, dots, stripes, stars, hexagon, swirl, lightning, checkers

**New patterns (v2):**

| Pattern | Algorithm |
|---|---|
| Plasma | Animated UV noise: `sin(x*f + t) + sin(y*f2 + t)` mapped to HSL — static snapshot baked at startup |
| Circuit | L-system-like recursive horizontal/vertical line segments with 90° branches |
| Glitch | Horizontal scanline displacement: rows randomly shifted ±N pixels, creating datamoshing effect |
| Void | Concentric dark rings with faint star-field overlay |

**Aura overlays (NEW):** Title-tier auras are separate 128×128 `pc.Texture` animated via a `pc.Script` that updates UV offset each frame. No canvas redraw — UV scrolling only.

### 8.3 particles.js — Particle Engine (Expanded)

Pool size increased from 300 → **600 entities**.

**New effect profiles:**

| Effect | Particle Count | Behavior |
|---|---|---|
| Shield break | 40 | Hexagonal outward burst, white→transparent |
| Magnet field | 20 (looping) | Slow inward spiral, electric blue |
| Dash trail | 15 | Short-lived ghost copies of player blob, alpha 0.3→0 |
| Shrink wall contact | 30 | Red sparks emitted while inside danger zone |
| Achievement popup | 25 | Gold stars radiating from HUD element |
| Virus charge | 12 (looping) | Orbiting green motes, speed increases with charge |

**Optimization:** Particles beyond camera frustum are skipped via `camera.frustum.containsSphere(pos, 1)` check before `entity.enabled = true`.

---

## 9. Networking & Server Architecture (Expanded)

### 9.1 Protocol

- **Transport:** Socket.io with WebSocket (polling fallback disabled in production)
- **Tick rate:** 20Hz server → client (unchanged)
- **Client → server input rate:** Uncapped (sent on every `requestAnimationFrame`); server de-duplicates
- **Packet format:** MessagePack (via `msgpack-lite`) instead of JSON — ~40% smaller payload

### 9.2 Server Message Types

**Server → Client:**

| Message | Payload | Notes |
|---|---|---|
| `world_state` | `{players, food, viruses, ts}` | Full state, sent at 20Hz |
| `delta_state` | `{changed[], removed[]}` | Partial update for unchanged entities (v2 optimization) |
| `kill_feed` | `{killer, victim, mode}` | Broadcast to all |
| `ability_event` | `{playerId, ability, ts}` | Triggers client-side VFX |
| `zone_update` | `{center, radius}` | BR only |
| `match_end` | `{winner, scores[]}` | Triggers end screen |

**Client → Server:**

| Message | Payload |
|---|---|
| `input` | `{dx, dz, split, boost, ability, seq}` |
| `join` | `{name, skin, ability, ts}` |
| `spectate` | `{targetId}` |

### 9.3 Delta State Compression (NEW)

The server tracks a per-client `lastSentState` snapshot. On each tick:
1. Compare current state to `lastSentState`
2. Emit only entities that have changed position by `>0.5` units or changed mass by `>1`
3. Send `delta_state` instead of full `world_state` after the first full snapshot

This reduces bandwidth by ~60% in a full 20-player lobby.

### 9.4 Anti-Cheat Measures (Expanded)

| Check | Method |
|---|---|
| Speed validation | Server rejects inputs causing velocity > `MAX_SPEED * 1.1` |
| Mass validation | Server recalculates all mass changes; client values are display-only |
| Input rate limit | Max 120 input packets/s per client; excess dropped |
| Sequence numbers | `seq` field on inputs detects replay attacks |
| Ability cooldown | Server tracks cooldown independently; client activation is a "request" not a command |

### 9.5 Room System (NEW)

- Rooms capped at **20 players** for FFA, **10v10** for Team, **20** for BR
- Server auto-creates new rooms when current room is ≥80% full
- Room state: `LOBBY → STARTING (3s countdown) → ACTIVE → ENDED`
- Players can **spectate** a full room while waiting for a slot

---

## 10. Client Rendering & Game Loop (Expanded)

### 10.1 Render Pipeline

```
PlayCanvas render loop (60Hz+)
  ├── Server tick interpolation (lerp entities to target state)
  ├── Ability VFX update (UV scroll, particle systems)
  ├── Camera update (centroid + zoom + smoothing)
  ├── Aura system update (animate per-level effects)
  ├── Minimap draw (Canvas 2D, every 3rd frame = 20Hz)
  └── HUD update (DOM, throttled at 10Hz)
```

### 10.2 Interpolation (Expanded)

```javascript
// v1 used constant lerp factor; v2 adapts to ping
const lerpFactor = Math.min(1, (12 + ping * 0.05) * dt);
entity.setPosition(pc.Vec3.lerp(current, target, lerpFactor));
```

High-ping players (>150ms) get a slightly more aggressive lerp to avoid visual rubber-banding.

### 10.3 Camera System (Extracted to camera.js)

**Centroid calculation:** Average position of all player blobs, weighted by mass.
```javascript
centroid = blobs.reduce((acc, b) => acc.add(b.pos.scale(b.mass)), Vec3.ZERO)
           .scale(1 / totalMass);
```

**Zoom:**
```javascript
targetHeight = BASE_HEIGHT + Math.sqrt(totalMass) * 1.8;
currentHeight = lerp(currentHeight, targetHeight, 2 * dt); // smooth zoom
```

**Spectator Camera (NEW):** When spectating, camera uses a **dolly path** — it orbits the target player at a slowly rotating angle, giving the impression of a cinematic broadcast camera. Orbit speed: 0.15 rad/s.

### 10.4 Input System (Extracted to input.js)

**Unified input abstraction:**
```javascript
// All input sources write to a single InputState object
InputState = {
  dx: 0, dz: 0,        // normalized movement vector
  split: false,         // edge-triggered
  boost: false,         // edge-triggered
  ability: false,       // edge-triggered
  spectateNext: false   // spectator mode
}
```

**Sources:**
- Mouse: cursor offset from center → normalized direction
- WASD / Arrow keys: 8-directional with diagonal normalization
- Touch: Virtual joystick (left thumb zone) + tap buttons (right zone)
- Gamepad: Left stick for movement, face buttons for actions (v2 addition)

### 10.5 World-to-Screen Name Tags (Improved)

Name tags now use **CSS transforms** (`transform: translate3d(x, y, 0)`) instead of setting `left`/`top` directly. This forces GPU compositing and eliminates layout reflow, improving overlay performance from ~8ms → ~0.5ms per frame on mid-range devices.

---

## 11. UI/UX System (Expanded)

### 11.1 Main Menu
- Animated background: a live mini-game preview with 5 bots playing FFA (rendered at 30fps in a small PlayCanvas canvas)
- **Sections:** PLAY, CUSTOMIZE, LEADERBOARD (all-time best mass from `localStorage`), SETTINGS
- Name field: persisted to `localStorage.blobz_name`

### 11.2 HUD Layout

```
┌─────────────────────────────────────────────────┐
│ [Kill Feed]        [LEADERBOARD top 10]          │
│                                                   │
│          (3D ARENA)                               │
│                                                   │
│ [MINIMAP]  [XP Bar + Level + Title]  [ABILITY]   │
│            [Mass counter]            [Cooldown]  │
│ [FPS/PING] [Streak popup center]    [Mode info]  │
└─────────────────────────────────────────────────┘
```

### 11.3 Minimap (Extracted to minimap.js)
- Renders at 200×200px, bottom-left
- **Draws:** Walls (white), food (dim white dots), viruses (green), allies (blue), enemies (red), self (bright white)
- **v2:** Scale indicator ("1 cm = 300 units") rendered as a pixel-ruler line
- **v2:** Zone boundary (BR) drawn as an orange arc

### 11.4 Ability HUD (NEW)
- Circular icon with radial cooldown sweep (canvas-drawn, same technique as pie charts)
- Keybind label (Q / tap icon)
- Name tag on hover
- Flashes white on activation

### 11.5 Death Screen (Expanded)
- Shows: rank, survival time, total mass gained, players eaten, largest mass reached
- **"Killed by" callout:** Shows the blob that ate you with their skin rendered (Canvas 2D snapshot)
- **Replay prompt:** "SPECTATE [KILLER]" button transitions camera to killer's POV
- 3-second auto-dismiss countdown, or tap/click to dismiss immediately

### 11.6 Settings Panel (NEW)
- Master volume slider
- Toggle: Mouse steering / WASD steering
- Toggle: Glow layer (performance)
- Toggle: Grid layer (performance)
- Toggle: Particles (accessibility)
- Toggle: Name tags
- Keybind rebinding for: Split, Boost, Ability (stored in `localStorage.blobz_settings`)

---

## 12. Mobile & Accessibility Support (NEW)

### 12.1 Touch Controls

- **Left zone (60% width):** Virtual joystick — rendered as two concentric circles on a Canvas overlay
  - Outer ring: fixed position, 90px radius
  - Inner dot: follows thumb, clamped to outer ring radius
  - Direction vector normalized and fed to `InputState.dx / dz`
- **Right zone (40% width):**
  - Single tap → split
  - Double tap → boost
  - Hold (250ms) → activate ability
- **Pinch:** Not used (camera zoom is mass-driven only)

### 12.2 Responsive Layout

- Canvas and HUD scale via CSS `vw/vh` units. PlayCanvas canvas uses `width: 100vw; height: 100vh`
- HUD font sizes use `clamp(10px, 2vw, 16px)` to stay readable on small screens
- Minimap shrinks to 120×120px on viewport widths < 500px

### 12.3 Performance Scaling

On first load, the client benchmarks with a 10ms canvas fill test and auto-selects a profile:

| Profile | Triggers On | Changes |
|---|---|---|
| HIGH | >50fps detected | All effects enabled |
| MEDIUM | 30–50fps | Particles halved, glow off |
| LOW | <30fps | Particles off, grid simplified, name tags limited to 5 nearest |

Player can override in settings.

### 12.4 Accessibility
- All HUD text meets WCAG 2.1 AA contrast ratios against dark background
- Ability icons include text labels (not icon-only)
- Colorblind mode (toggle in settings): Replaces red/green team colors with orange/purple

---

## 13. Performance Targets & Optimization Guide

| Metric | Target | Technique |
|---|---|---|
| Initial load | <200ms to first frame | All asset gen in first frame; no network requests for assets |
| Server tick cost | <8ms/tick at 20 players | Delta compression; spatial hash for collision broadphase |
| Client frame time | <16ms (60fps) | CSS transforms for overlays; frustum culling for particles |
| Memory (client) | <180MB | Particle pool (no GC); texture atlas for all canvas-generated textures |
| Network (steady state) | <4KB/s per player | MessagePack + delta state |

### Collision Broadphase (Server)
Replace naive O(n²) check with a **spatial hash grid**:
```javascript
// Grid cell size = 200 units (≈ max blob radius)
// Each cell stores a list of entity IDs
// Only check collisions between entities in same/adjacent cells
const cellKey = (x, z) => `${Math.floor(x/200)},${Math.floor(z/200)}`;
```
This reduces collision checks from O(n²) to O(n × k) where k ≈ 4–8.

---

## 14. File & Module Structure

```
blobz-io/
├── package.json          # Node deps: socket.io, msgpack-lite, express
├── server.js             # Authoritative game server
├── public/
│   ├── index.html        # Single page app shell
│   └── src/
│       ├── game.js           # PlayCanvas bootstrap + main game loop
│       ├── modes/
│       │   ├── ModeManager.js
│       │   ├── FFA.js
│       │   ├── TeamArena.js
│       │   └── BattleRoyale.js
│       ├── abilities/
│       │   ├── AbilitySystem.js
│       │   ├── ability_shield.js
│       │   ├── ability_magnet.js
│       │   ├── ability_dash.js
│       │   └── ability_decoy.js
│       ├── audio.js
│       ├── skins.js
│       ├── particles.js
│       ├── camera.js
│       ├── hud.js
│       ├── minimap.js
│       ├── input.js
│       └── meta.js
```

### Dependency Versions
```json
{
  "socket.io": "^4.7.0",
  "msgpack-lite": "^0.1.26",
  "express": "^4.18.0"
}
```
CDN (loaded in index.html, no npm):
```html
<script src="https://code.playcanvas.com/playcanvas-stable.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/msgpack-lite/0.1.26/msgpack.min.js"></script>
```

---

## Appendix A: Implementation Priority

For a jam build, implement in this order:

1. **Server + FFA mode** (base mechanics, spatial hash collision)
2. **Client rendering** (PlayCanvas bootstrap, interpolation, camera)
3. **Procedural assets** (audio.js, skins.js, particles.js)
4. **HUD + minimap** (leaderboard, kill feed, XP bar)
5. **Ability system** (AbilitySystem.js + SHIELD + DASH first)
6. **Bot AI v2** (archetypes + pack behavior)
7. **Team Arena + Battle Royale modes**
8. **Mobile touch controls**
9. **Meta-progression** (achievements, cosmetics, localStorage)
10. **Performance profiling + auto-scaling**

---

## Appendix B: Known Edge Cases to Handle

| Situation | Handling |
|---|---|
| Player disconnects mid-split | Server destroys all blobs belonging to that socket |
| Two players eat each other simultaneously | Server resolves by processing higher-seq-number input first |
| Virus spawns on top of player | Viruses spawn at random positions validated to be >150 units from any player |
| Ability activated at 0 cooldown exactly | Cooldown stored as `remainingMs`; activation gated by `remainingMs <= 0` |
| BR: player AFK at start | Auto-kicked after 30s of zero input during active match |
| Packet arrives out of order | `seq` numbers used; stale packets (seq < lastProcessed) are dropped |

---

*Document version 2.0 — Ready for implementation. All systems are self-contained and zero-asset-dependency compliant.*
