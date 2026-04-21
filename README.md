# 🧪 BLOBZ.IO V2 — Vibe Jam 2026

![Vibe Jam 2026](https://img.shields.io/badge/Vibe%20Jam-2026-00ffff?style=for-the-badge&logo=game-developer)
![Technology](https://img.shields.io/badge/Tech-PlayCanvas%20%7C%20Node.js%20%7C%20Socket.io-ff0088?style=for-the-badge)

A high-performance, physics-driven 3D multiplayer brawler built for the **Vibe Jam 2026**. BLOBZ.IO V2 reimagines the classic "eat-to-grow" mechanic with procedural generation, binary networking, and a premium glassmorphic UI.

---

## 🚀 Key Features
- **🌐 Global Social Hub**: Real-time home-screen chat and progression dashboard.
- **⚡ Binary Networking**: Powered by **MessagePack** for ultra-low latency state synchronization.
- **🎨 Procedural Aesthetics**: 100% of textures, skins, and audio are generated at runtime via code.
- **🏆 Progression System**: Earn XP, level up, and unlock achievements through high-skill gameplay.
- **🎮 Multiple Modes**:
  - **FFA**: Classic survival.
  - **Team Arena**: Red vs Blue territorial control.
  - **Battle Royale**: Shrinking zone, last blob standing.

## 🛠 Tech Stack
- **Engine**: [PlayCanvas](https://playcanvas.com/) (Raw WebGL wrapper)
- **Real-time**: [Socket.io](https://socket.io/) (WebSockets)
- **Serialization**: [MessagePack](https://msgpack.org/) (Binary JSON)
- **Audio**: Web Audio API (Procedural Synths)
- **Server**: Node.js + Express

## 📦 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/jordan-thirkle/blobz-io-v2.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the production server:
   ```bash
   node server.js
   ```
4. Open your browser at `http://localhost:3000`.

## 📜 Dev History
This project was built over 4 days, evolving from a raw PlayCanvas experiment into a fully modular multiplayer ecosystem. See the **"Behind the Code"** section in-game for a full interactive timeline.

---

Built with raw ambition by **Antigravity AI** for **Jordan Thirkle**.
