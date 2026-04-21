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
            date: "APR 17, 2026", time: "14:30", title: "THE INITIAL SPARK",
            prompt: "Build a 3D agar.io clone in PlayCanvas with zero external assets.",
            built: [
                "Drafted the 'Blobz' core physics loop.",
                "Implemented spatial food spawning across a 3000x3000px arena.",
                "Created the first 3D procedural sphere model using PlayCanvas primitives."
            ]
        },
        {
            date: "APR 18, 2026", time: "09:00", title: "PROCEDURAL BREAKTHROUGH",
            prompt: "Generate all textures and audio in-browser. No downloads.",
            built: [
                "Engineered 'skins.js' to generate 2D canvas patterns as dynamic textures.",
                "Built 'audio.js'—a Web Audio synth that creates 'pop' and 'boost' sounds from oscillators.",
                "Result: A 0kb asset footprint for faster load times."
            ]
        },
        {
            date: "APR 19, 2026", time: "22:15", title: "NETWORKING V2: THE BINARY REFACTOR",
            prompt: "Reduce latency by moving from JSON to binary serialization.",
            built: [
                "Integrated MessagePack to compress world states by ~70%.",
                "Implemented Client-Side Prediction and Linear Interpolation for buttery-smooth movement.",
                "Optimized the server-side spatial hash grid to handle 100+ entities."
            ]
        },
        {
            date: "APR 20, 2026", time: "11:45", title: "THE SOCIAL HUB EVOLUTION",
            prompt: "Make the game feel alive. Add chat, levels, and persistent stats.",
            built: [
                "Designed a Glassmorphic Hub UI with real-time Global Comms.",
                "Created the MetaSystem for persistent XP tracking and achievements.",
                "Implemented the Hall of Fame to showcase the all-time legends."
            ]
        },
        {
            date: "APR 21, 2026", time: "09:30", title: "THE PRODUCTION POLISH",
            prompt: "Fix race conditions, optimize GitHub, and finalize Vibe Jam submission.",
            built: [
                "Crushed the 'null pointer' race conditions during startup.",
                "Unified the Social Hub logic to run independently of the 3D Engine.",
                "Finalized the professional GitHub documentation and repository infrastructure."
            ]
        }
    ];

    let timelineHtml = '';
    data.forEach(d => {
        timelineHtml += `
            <div class="hiwm-card">
                <div style="font-size:10px; color:#0ff; opacity:0.6; margin-bottom:5px; letter-spacing:1px;">${d.date} • ${d.time}</div>
                <div class="hiwm-card-title">${d.title}</div>
                <div class="hiwm-prompt">PROMPT USED: \n${d.prompt}</div>
                <div class="hiwm-outputs">
                    <ul>${d.built.map(b => `<li>${b}</li>`).join('')}</ul>
                </div>
            </div>
        `;
    });

    overlay.innerHTML = `
        <div class="hiwm-close" onclick="window.closeHowItWasMade()">×</div>
        <h1 class="hiwm-title">BEHIND THE CODE</h1>
        <p style="margin-top:10px; color:#ffffff55; font-size:12px; letter-spacing:2px; text-align:center;">VIBE JAM 2026 SUBMISSION</p>
        
        <div class="hiwm-timeline">
            ${timelineHtml}
        </div>

        <div style="background:rgba(0,255,255,0.05); border:1px solid rgba(0,255,255,0.3); padding:30px; border-radius:15px; text-align:center; margin: 40px auto 60px auto; max-width:600px; width:90%; backdrop-filter:blur(10px);">
            <div style="font-size:18px; color:#0ff; margin-bottom:15px; font-family:'Orbitron'; letter-spacing:2px;">SOURCE CODE</div>
            <p style="font-size:13px; color:#aaa; margin-bottom:20px; line-height:1.6;">Explore the full repository, commit history, and system architecture on GitHub.</p>
            <a href="https://github.com/jordan-thirkle/blobz-io-v2" target="_blank" style="display:inline-block; padding:14px 35px; background:#0ff; color:#000; text-decoration:none; font-weight:900; border-radius:30px; transition:0.3s; font-family:'Orbitron'; letter-spacing:1px; box-shadow: 0 0 20px rgba(0,255,255,0.4);">VIEW ON GITHUB</a>
        </div>

        <div class="hiwm-footer">
            Built with PlayCanvas, Node.js, and raw ambition.<br>
            All assets (Audio, Textures, Models) are generated procedurally at runtime.
        </div>
    `;


    document.body.appendChild(overlay);

    window.openHowItWasMade = function() {
        overlay.style.display = 'flex';
        setTimeout(() => overlay.classList.add('show'), 10);
    };

    window.closeHowItWasMade = function() {
        overlay.classList.remove('show');
        setTimeout(() => overlay.style.display = 'none', 300);
    };
}
