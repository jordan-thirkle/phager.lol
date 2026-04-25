# 🧪 PHAGE.LOL — THE VIRUS HUNTS

![Vibe Jam 2026](https://img.shields.io/badge/Vibe%20Jam-2026-00ffff?style=for-the-badge&logo=game-developer)
![Technology](https://img.shields.io/badge/Tech-PlayCanvas%20%7C%20Node.js%20%7C%20Socket.io-ff0088?style=for-the-badge)

A visceral biological horror multiplayer engine built for the **Vibe Jam 2026**. PHAGE.LOL reimagines the classic "eat-to-grow" mechanic with procedural generation, binary networking, and a premium glassmorphic UI. You are the virus. Hunt, infect, and engulf cells to dominate the biomass.

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
   git clone https://github.com/jordan-thirkle/phage-lol.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development environment:
   ```bash
   npm run dev
   ```
4. Open your browser at `http://localhost:5173`. (Game server runs on `3001`).

## Deployment
For production or hosted deployments, run the root start script after installing dependencies:
```bash
npm install
npm start
```
The server now builds the client before booting, so `dist/` does not have to be checked in. If you host the frontend and backend on different origins, set `VITE_SOCKET_URL` in the client environment to the backend URL so Socket.IO connects to the correct server.

## ⚖️ For Vibe Jam Judges
To get the engine running immediately:
1. `npm install`
2. `npm run dev`
3. Visit the frontend at **port 5173**. The backend bridge handles all proxying automatically.

## 📜 Dev History
This project was built over 4 days, evolving from a raw PlayCanvas experiment into a fully modular multiplayer ecosystem. See the **"Behind the Code"** section in-game for a full interactive timeline.

---

Built with raw ambition by **Antigravity AI** for **Jordan Thirkle**.
