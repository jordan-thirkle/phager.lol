# SUBMISSION_GUIDELINES.MD — PHAGE.LOL
### Cursor Vibe Jam 2026 Entry · Jordan Thirkle · @jordan_thirkle (https://jordanthirkle.com)

---

## 🎮 Project Overview

**Game:** Phage.lol — a real-time multiplayer browser game  
**Domain:** https://phage.lol  
**Legacy URL:** https://blobz-io-v2-production.up.railway.app/ *(update to phage.lol ASAP)*  
**Tagline:** Eat or be eaten.  
**Jam:** Cursor Vibe Jam 2026 (April 1 – May 1, 2026 @ 13:37 UTC)  
**Submission email:** jordantthirkle@gmail.com  
**Deadline:** May 1, 2026 @ 13:37 UTC — every hour counts.

---

## 🧬 Branding & Identity

### Name
**Phage.lol**

A **bacteriophage** (phage) is a virus that hunts, latches onto, and destroys cells — injecting itself and consuming from within. It is one of the most ruthless predators in biology. It does not negotiate. It does not miss.

That is the game.

---

### Hero Section Copy
The homepage/title screen must include the following, in this order:

**1. Logo / Heading**
```
PHAGE.LOL
```

**2. Definition line — directly below the logo**
```
phage /feɪdʒ/ n. — a virus that hunts, infects, and destroys cells.
                    You are the virus.
```

**3. Word-of-mouth hook — displayed on the landing/lobby screen as a dialogue exchange**

Render this as a styled chat/dialogue UI element (monospace or terminal aesthetic works well):

```
"what are you playing?"
"phage.lol"
"...what?"
"just go to phage.lol"
```

This should feel like a real overheard conversation — minimal styling, no explanation, no call to action. The domain sells itself. Place it somewhere visible on the landing screen, below the fold or as a subtle aside — not competing with the play button.

---

### Tone
- Clinical meets chaotic. The name is scientific, the game is anarchic.
- Never "cute" — blobs are cells, cells get destroyed.
- Lean into the biology. Players are organisms. Mass is biomass. Death is lysis.
- The `.lol` TLD is intentional irony — keep the game itself feeling sharp and competitive.

### Naming Conventions in UI
Replace all legacy "BLOBZ" references with biology-accurate language:

| Old | New |
|---|---|
| Blob | Cell / Phage |
| Eat | Engulf / Consume |
| Death screen "DEVOURED" | Keep — it's perfect |
| Mass | Biomass |
| Grow | Expand / Replicate |

---
| Mode | Description |
|---|---|
| **FFA** | Free For All — eat or be eaten |
| **Teams** | Team Arena — Red vs Blue |
| **Battle Royale** | Shrinking zone — last blob standing |

### Controls
| Input | Action |
|---|---|
| Mouse / WASD | Move |
| Space | Split |
| W / Shift | Boost |
| Q | Ability / Power |

---

## 🏆 Winning the Jam — What Judges Care About

These are the judging criteria inferred from Vibe Jam 2026. Build toward all of them:

1. **Fun factor** — Is it immediately engaging? Does it have game feel?
2. **Technical ambition** — Multiplayer, real-time, polished mechanics.
3. **Polish** — No rough edges, smooth UX, responsive design.
4. **Instant playability** — Zero friction from load to gameplay (see Rule #8).
5. **Mobile readiness** — Judges explicitly ask. Build for it.
6. **Portal integration** — Optional but earns players and visibility via webring.
7. **Most Popular sub-prize** — Driven by player count via the widget tracker.

---

## ⚠️ CRITICAL JAM COMPLIANCE — NON-NEGOTIABLE

The following are **disqualification risks**. The AI agent must always verify these are intact:

### 1. Widget Script (REQUIRED — disqualified without it)
This MUST be present in the game's HTML at all times:
```html
<script async src="https://vibej.am/2026/widget.js"></script>
```
- Never remove, comment out, or defer this.
- It must be on the live production domain.
- It tracks player counts for the Most Popular sub-prize.

### 2. Instant Load (REQUIRED)
- NO loading screens.
- NO heavy asset downloads on initial load.
- Players must be in the game within ~2 seconds.
- Lazy-load anything non-essential after gameplay starts.

### 3. No Login / No Signup (REQUIRED)
- Game must be freely playable with zero auth friction.
- Username prompt is the ONLY acceptable gating.
- **COMPLIANCE NOTE**: Social login (Twitter/X OAuth) was explicitly rejected to avoid friction. Linking is handled via the `@handle` username convention in the HUD/HOF.

### 4. Single Domain (REQUIRED for tracking)
- Stay on one domain/subdomain — the widget tracks by domain.
- Do not split the game across multiple origins.

### 5. AI-Written Code (REQUIRED — 90% minimum)
- At least 90% of code must be AI-generated.
- This is an AI-augmented project — fully compliant by design.

### 6. Documentation & Transparency (REQUIRED)
- The `howItWasMade.js` file MUST be updated after every significant feature or fix.
- The AI assistant must document every prompt and architectural decision to ensure 100% transparency for judges.
- Commits must be professional and follow the Conventional Commits format to demonstrate a clean development history.

---

## 🌀 Portal Webring — Implement This for Free Players

Adding a portal gets Phage.lol listed in the Vibe Jam webring and drives organic player traffic.

### Exit Portal
When a player enters the portal, redirect to:
```
https://vibej.am/portal/2026
```

Include player state as query params:
```
https://vibej.am/portal/2026?username=PLAYER&color=HEX&speed=N&ref=phage.lol
```

**Supported params to forward:**
- `username=` — player name
- `color=` — hex or named colour
- `speed=` — metres per second
- `ref=` — this game's URL (so they can return)
- `hp=` — health/mass (1–100 range)
- `team=` — current team if in team mode

### Start Portal (for incoming ?portal=true visitors)
When URL contains `?portal=true` and `?ref=`:
1. Skip all intro screens — drop player straight into game.
2. Spawn a visible return portal in the world.
3. When player enters return portal, redirect back to `?ref=` URL passing all params again.

**Sample portal code (Three.js):**
```html
<script src="https://vibej.am/2026/portal/sample.js"></script>
<script>
  initVibeJamPortals({
    scene: yourScene,
    getPlayer: () => yourPlayerObject3D,
    spawnPoint:   { x: 0, y: 0, z: 0 },
    exitPosition: { x: -200, y: 200, z: -300 },
  });
  // Inside your animate loop: animateVibeJamPortals();
</script>
```

> All portal params are optional — never rely on their presence.  
> `?portal=true` is always added by the redirector — use it to detect portal arrivals.

---

## 🛠 Tech Stack

| Layer | Tech |
|---|---|
| **Hosting** | Railway (production) |
| **Frontend** | Browser canvas game |
| **Networking** | Real-time multiplayer (Socket.io or similar) |
| **Engine** | PlayCanvas (Custom Canvas Engine) |
| **Language** | JavaScript (ES6+) |
| **Assets** | Procedural Primitives & CSS3 Effects |

> Update this table when stack changes.

---

## ✅ Global Coding Rules

### Architecture
- **Server is authoritative.** All game state, kills, XP, mass, and scoring live server-side. The client renders only.
- Never trust client-reported values. Validate and clamp all inputs server-side.
- Clean up player state immediately on socket disconnect.
- Rate-limit all socket events to prevent abuse.

### Code Quality
- Write clean, readable, well-commented code.
- Small, single-responsibility functions only.
- No magic numbers — extract all constants to a `config.js` / `constants.ts` file.
- No `console.log` in production — use a `debug(msg)` helper gated by a `DEBUG` flag.
- Never leave dead/commented-out code in the codebase. Delete it.

### Performance
- Target 60fps client rendering. Profile before optimising.
- Use object pooling for blobs, pellets, and particles — never `new` inside the game loop.
- Minimise DOM updates. Batch canvas draw calls.
- Lazy-load non-critical assets (sounds, cosmetics) after the game is running.
- Keep initial bundle small — jam requires instant load.

### Security
- Sanitise all socket payloads before processing.
- Validate XP gains, kills, and mass changes server-side.
- Protect against socket flooding and oversized messages.
- Never expose full game state to clients — send only what they need.

### Mobile
- Support touch controls (the submission form asks about mobile readiness).
- Test on a real mobile device before every significant release.
- Ensure the canvas scales correctly on small viewports.

---

## 📝 Git Commit Rules

All commits must follow **Conventional Commits** format:

```
<type>(<scope>): <short imperative summary in lowercase>

[optional body — explain WHY, not just what]

[optional footer — Closes #N / Breaking: ...]
```

### Commit Types
| Type | Use for |
|---|---|
| `feat` | New game feature or mechanic |
| `fix` | Bug fix |
| `perf` | Performance improvement |
| `refactor` | Code restructure, no behaviour change |
| `style` | UI, CSS, visual polish |
| `chore` | Deps, config, tooling, CI |
| `docs` | README, comments, submission_guidelines.md |
| `revert` | Reverting a previous commit |

### Scopes
`server`, `client`, `ui`, `physics`, `lobby`, `ffa`, `teams`, `battle-royale`, `portal`, `socket`, `auth`, `deploy`, `perf`, `widget`

### Rules
- Subject line ≤ 72 characters. Lowercase. Imperative mood ("add", not "added").
- Every commit must leave the game in a **runnable, deployable state**.
- Never commit broken or untested code to `main`.
- Use the body to explain *why* the change was made.
- Reference issues/PRs in the footer where applicable.

### Examples

```
feat(battle-royale): implement shrinking safe zone with damage scaling

Zone radius decreases linearly over 5 minutes. Damage outside
zone scales from 1hp/s to 10hp/s as zone closes. Fully server-side.

Closes #14
```

```
fix(socket): clamp player mass to prevent negative values on split

Negative mass caused NaN to propagate across the entire game state.
Now clamped to a minimum of 1 on all split events.
```

```
perf(client): batch pellet draw calls using offscreen canvas

Reduces main thread paint time ~40% on mid-range mobile devices.
Profiled on iPhone 12 and Pixel 6.
```

```
feat(portal): add vibe jam webring exit and start portals

Exit portal redirects to vibej.am/portal/2026 with player state.
Start portal spawns on ?portal=true arrival and returns player
to ?ref= on re-entry. Closes #21
```

```
chore(deploy): update railway env vars for production widget domain

Widget tracking requires single-domain. Removed staging subdomain
alias to ensure vibej.am widget counts correctly.
```

---

## 🚀 Deployment Rules

- `main` = production. It must always be stable and live on Railway.
- Use feature branches for all active work. Merge via PR or squash commit.
- **Test locally before every Railway deploy.**
- Document all new environment variables in `.env.example`.
- After any deploy, verify the live URL loads instantly and the widget script is present.

### Pre-deploy Checklist
- [ ] Widget script `https://vibej.am/2026/widget.js` is in the HTML
- [ ] Game loads in < 2 seconds with no loading screen
- [ ] No login or signup required to play
- [ ] Mobile touch controls work
- [ ] All three game modes functional (FFA, Teams, Battle Royale)
- [ ] Socket disconnect handled cleanly
- [ ] No `console.log` calls in production build
- [ ] `DEBUG` flag is `false`

---

## 🗂 File & Folder Conventions

- `camelCase` for JS/TS source files
- `kebab-case` for assets, HTML, and config files
- Group by feature where possible (not by file type)
- Delete dead code — never comment it out and leave it

---

## 🎮 Game Design Rules

- Balance changes must include written reasoning in the commit body.
- New mechanics must not break FFA, Teams, or Battle Royale modes.
- Physics, speed, or mass formula changes must be noted explicitly in the commit.
- XP and level progression are **server-authoritative** — never adjust client-side.
- Game feel > visual complexity. Prioritise responsiveness and feedback.

---

## 📋 Submission Status

| Field | Value |
|---|---|
| Submitted | ✅ Yes (can update until deadline) |
| Widget installed | ✅ Verify on every deploy |
| Portal added | ✅ Yes |
| Mobile ready | ✅ Yes (Touch/Gamepad/Responsive) |
| Screenshot uploaded | ✅ Yes |
| Pitch sentence | "A bacteriophage hunts and destroys cells — so do you. Real-time multiplayer across three brutal game modes." |
| Engine declared | PlayCanvas |
| AI tool declared | Antigravity AI |
| 90% AI code | ✅ Yes |
| No login / free to play | ✅ Yes |
| No loading screens | ✅ Verify on every deploy |
| Multiplayer | ✅ Yes |

---

> **Deadline: May 1, 2026 @ 13:37 UTC**  
> Every improvement before then counts. Ship often. Stay compliant. Win.
