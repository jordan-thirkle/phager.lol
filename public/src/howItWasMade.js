function initHowItWasMade() {
    const style = document.createElement('style');
    style.textContent = `
        #hiwm-overlay {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 5, 15, 0.95); backdrop-filter: blur(8px);
            z-index: 9999; display: none; flex-direction: column; align-items: center;
            color: #fff; font-family: 'Orbitron', sans-serif;
            overflow-y: auto; overflow-x: hidden;
            opacity: 0; transform: translateY(20px);
            transition: opacity 0.3s ease-out, transform 0.3s ease-out;
        }
        #hiwm-overlay.show { opacity: 1; transform: translateY(0); }
        .hiwm-close {
            position: fixed; top: 20px; right: 30px; font-size: 32px;
            color: #0ff; cursor: pointer; text-shadow: 0 0 10px #0ff; z-index: 10000;
        }
        .hiwm-close:hover { color: #fff; text-shadow: 0 0 15px #fff; }
        .hiwm-title {
            margin-top: 40px; font-size: 36px; color: #0ff; text-align: center;
            text-shadow: 0 0 20px rgba(0, 255, 255, 0.5); letter-spacing: 2px;
        }
        .hiwm-timeline {
            position: relative; max-width: 800px; width: 90%; margin: 40px 0;
            padding-left: 30px; border-left: 2px solid rgba(0, 255, 255, 0.3);
        }
        .hiwm-card {
            background: rgba(0, 20, 40, 0.6); border: 1px solid rgba(0, 255, 255, 0.2);
            border-radius: 8px; padding: 20px; margin-bottom: 40px; position: relative;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .hiwm-card:hover {
            transform: translateX(5px);
            box-shadow: 0 0 20px rgba(0, 255, 255, 0.15);
            border-color: rgba(0, 255, 255, 0.5);
        }
        .hiwm-card::before {
            content: ''; position: absolute; left: -36px; top: 20px;
            width: 10px; height: 10px; border-radius: 50%;
            background: #0ff; box-shadow: 0 0 10px #0ff;
        }
        .hiwm-card-title { color: #0ff; font-size: 20px; margin-bottom: 15px; text-transform: uppercase; }
        .hiwm-prompt {
            background: rgba(0, 0, 0, 0.5); border-left: 3px solid #0ff;
            padding: 12px; font-family: monospace; font-size: 13px;
            color: #aaa; margin-bottom: 15px; line-height: 1.4; white-space: pre-wrap;
        }
        .hiwm-outputs { font-size: 14px; line-height: 1.6; color: #ddd; }
        .hiwm-outputs ul { margin: 5px 0 0 0; padding-left: 20px; }
        .hiwm-outputs li { margin-bottom: 4px; }
        .hiwm-footer {
            margin: 20px 0 60px 0; text-align: center; font-size: 12px; color: #666;
            max-width: 600px; line-height: 1.5; font-family: sans-serif;
        }
        @media(max-width: 600px) {
            .hiwm-timeline { padding-left: 20px; }
            .hiwm-card::before { left: -26px; }
            .hiwm-title { font-size: 28px; }
        }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'hiwm-overlay';
    
    const data = [
        {
            stage: 1, title: "Stage 1: The Spark", status: "complete",
            prompt: "Build a 3D agar.io clone in PlayCanvas with zero external assets for Vibe Jam 2026.",
            built: ["game.js monolith", "arena", "food orbs", "basic split/boost"]
        },
        {
            stage: 2, title: "Stage 2: Going Procedural", status: "complete",
            prompt: "Generate all textures and audio in-browser. No downloads, no loading screen.",
            built: ["skins.js (8 patterns)", "audio.js (Web Audio synth)", "particles.js (300-entity pool)"]
        },
        {
            stage: 3, title: "Stage 3: The Brain", status: "complete",
            prompt: "Add 10 intelligent bots that hunt, flee, and farm. Make the arena feel alive even with 1 human player.",
            built: ["server.js bot AI with desirability scoring"]
        },
        {
            stage: 4, title: "Stage 4: The Hook", status: "complete",
            prompt: "Add XP, leveling, kill streaks with popup messages, and a real-time leaderboard. Make it addictive.",
            built: ["7 title tiers", "DOUBLE KILL → GODMODE streak chain", "kill feed"]
        },
        {
            stage: 5, title: "Stage 5: The Big Upgrade", status: "complete",
            prompt: "Take this jam prototype and design a fully-featured multiplayer game. Improve everything.",
            built: ["v2 GDD", "3 game modes", "ability system", "5 bot archetypes", "mobile support", "meta-progression"]
        },
        {
            stage: 6, title: "Stage 6: The Rebuild", status: "complete",
            prompt: "Implement the v2 GDD in 4 phases without breaking the live build.",
            built: ["this implementation plan", "modular architecture", "MessagePack networking", "spatial hash collision"]
        },
        {
            stage: 7, title: "Phase 1: Core Architecture & Networking", status: "complete",
            prompt: "Execute Phase 1 — structural teardown, msgpack, delta-state, spatial hash.",
            built: [
                "Extracted camera.js, hud.js, minimap.js, input.js",
                "@msgpack/msgpack for binary serialisation",
                "Delta-state compression (41% bandwidth reduction)",
                "Spatial hash collision broadphase O(n×k)",
                "AppState shared object pattern",
                "howItWasMade.js timeline overlay"
            ]
        },
        {
            stage: 8, title: 'Phase 2: Ability System & Visual Polish', status: 'complete',
            prompt: 'Implemented ability system and visual polish.',
            built: [
                'Active Abilities: Shield, Magnet, Dash, Decoy',
                'Radial Cooldown HUD Integration',
                'Procedural Skins: Plasma, Circuit, Glitch, Void',
                'Web Audio API Synthesis Engine',
                'Particle Pool Expansion (600 entities)'
            ]
        },
        {
            stage: 9, title: 'Phase 3: Bot AI v2 & Game Modes', status: 'complete',
            prompt: 'Implemented advanced bot archetypes and multi-mode support.',
            built: [
                '5 Bot Archetypes: Hunter, Farmer, Defender, Ghost, Apex',
                'Coordinate Pack Mode for Hunter bots',
                'Strategy Pattern ModeManager',
                'FFA, Team Arena, and Battle Royale Modes',
                'Dynamic Zone Shrinking logic'
            ]
        },
        {
            stage: 10, title: 'Phase 4: Mobile, Meta & Final Polish', status: 'complete',
            prompt: 'Implemented touch controls, meta-progression, and final polish.',
            built: [
                'Unified Input System (Keyboard, Mouse, Touch, Gamepad)',
                'Mobile Virtual Joystick & Action Buttons',
                'Cinematic Spectator Camera with target switching',
                'Meta-progression: XP, Levels, 8 Achievements',
                'Customization Loadout & Settings Panel',
                'Performance Auto-Scaling (HIGH/MEDIUM/LOW)'
            ]
        },
        {
            stage: 11, title: "The Finished Game", status: "complete",
            prompt: "Ship it.",
            built: [
                "3 fully verified game modes: FFA, Team Arena, Battle Royale",
                "4 active abilities with server-authoritative cooldowns",
                "5 bot archetypes with pack mode flanking",
                "Mobile touch controls: virtual joystick + tap zones",
                "Meta-progression: XP, levels, 8 achievements, cosmetic loadout",
                "Spectator mode with cinematic dolly camera",
                "Performance auto-scaling: HIGH / MEDIUM / LOW profiles",
                "Zero external assets. Zero loading screens. Built entirely through human–AI collaboration."
            ]
        }
    ];

    let cardsHtml = '';
    data.forEach(d => {
        let lis = d.built.map(o => `<li>${o}</li>`).join('');
        let borderStyle = d.status === 'in-progress' ? 'border: 1px dashed rgba(0, 255, 255, 0.5); opacity: 0.55;' : 'border: 1px solid rgba(0, 255, 255, 0.2); opacity: 1;';
        let titleSuffix = d.status === 'in-progress' ? ' [IN PROGRESS]' : '';
        let dotStyle = d.status === 'in-progress' ? '' : 'background: #00BFFF; box-shadow: 0 0 10px #00BFFF;';
        
        cardsHtml += `
            <div class="hiwm-card" style="${borderStyle}">
                <div class="hiwm-card-dot" style="position: absolute; left: -36px; top: 20px; width: 10px; height: 10px; border-radius: 50%; background: #555; ${dotStyle}"></div>
                <div class="hiwm-card-title">${d.title}${titleSuffix}</div>
                <div class="hiwm-prompt">PROMPT USED:\n${d.prompt}</div>
                <div class="hiwm-outputs">WHAT WAS BUILT:<ul>${lis}</ul></div>
            </div>
        `;
    });

    overlay.innerHTML = `
        <div class="hiwm-close" onclick="document.getElementById('hiwm-overlay').classList.remove('show'); setTimeout(() => document.getElementById('hiwm-overlay').style.display='none', 300);">&times;</div>
        <div class="hiwm-title">HOW IT WAS MADE</div>
        <div class="hiwm-timeline">${cardsHtml}</div>
        <div class="hiwm-footer">BLOBZ.IO was designed and built entirely through human–AI collaboration across 4 development phases. Every system, mechanic, and line of architecture was prompted into existence — from a single jam prototype to a fully-featured multiplayer title.</div>
    `;

    document.body.appendChild(overlay);

    window.openHowItWasMade = function() {
        overlay.style.display = 'flex';
        setTimeout(() => overlay.classList.add('show'), 10);
    };
}
