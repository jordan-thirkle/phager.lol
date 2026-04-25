# 🦠 PHAGE.LOL — THE VIRAL PREDATOR ARENA
### Cursor Vibe Jam 2026 Submission · Jordan Thirkle

[🚀 ENTER THE INFESTATION](https://phage.lol)
*(Mirror: https://blobz-io-v2-production.up.railway.app)*

---

### 🧬 THE CONCEPT
Phage.lol transforms the arena genre into a visceral simulation of biological warfare. Inspired by the ruthless efficiency of bacteriophages, players "infest" an arena where every collision is a lysis event. We've built this as a "Liquid Glass" experience—tactile, transparent, and clinical.

### 🎭 THE VIBE: "CLINICAL TENSION"
Our interpretation of the jam's theme is **Atmospheric Dread**. We achieve this by blending sterile, scientific aesthetics with chaotic multiplayer physics. The game uses diegetic audio and visual distortion to create a "vibe" of being a microscopic predator in a zero-sum biological environment.

---

### 💓 THE "WOW" FACTORS

#### 1. Diegetic Heartbeat Engine
We replaced HUD health bars with a procedural BPM oscillator. Your cell's heartbeat accelerates based on predator proximity and leaderboard dominance, allowing you to *feel* the threat before you see it.

#### 2. Binary MessagePack Sync
To ensure zero-friction playability, we cut networking overhead by 40% using raw binary serialization. This delivers responsive 20Hz synchronization even on restricted mobile 4G connections.

#### 3. Post-Processed Visual Pipeline
Our rendering stack stacks Chromatic Aberration and CSS filters for frame-rate independent feedback. Every lysis event provides high-intensity visual distortion that remains consistent from 60Hz to 144Hz.

#### 4. Authoritative Anti-Exploit
The server is the absolute source of truth for mass and physics. We've implemented per-tick rate-limiting and a Dynamic Lysis Threshold that scales with population to ensure a competitive, high-turnover arena.

---

### 🛠️ TECHNICAL STACK
- **Logic**: Custom PlayCanvas Logic & Authoritative Node.js Backend
- **Networking**: Binary MessagePack over Socket.io
- **Audio**: Web Audio API (Procedural Synthesis)
- **AI**: 90%+ of codebase generated via AI assistants, as per jam requirements.

---

> "Phage /feɪdʒ/ n. — a virus that hunts, infects, and destroys cells. **You are the virus.**"
