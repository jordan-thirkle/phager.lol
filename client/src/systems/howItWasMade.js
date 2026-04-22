// ─── PHAGE.LOL "How It Was Made" Diagnostic Archive ───

let overlay = null;

const logs = [
    {
        ref: "LOG_001_GENESIS",
        date: "APR 17, 2026",
        title: "SYNTHETIC CELLULAR ISOLATION",
        note: "First successful incubation of a 3D cellular environment. We successfully generated a 3000nm arena and observed initial biomass replication. Primary objective: <b>Zero external dependencies.</b> Everything must evolve from the core script.",
        tech: "Procedural Sphere Geometry, Spatial Hash Grid"
    },
    {
        ref: "LOG_012_SENSORY",
        date: "APR 18, 2026",
        title: "SENSORY & METABOLIC AUDIO",
        note: "The organisms now emit audible frequencies upon engulfment. We've bypassed the need for pre-recorded soundscapes by synthesizing <b>Web Audio oscillators</b> into visceral squelches and metabolic bursts.",
        tech: "Web Audio API Synth Engine, Procedural Canvas Textures"
    },
    {
        ref: "LOG_045_SYNCHRONY",
        date: "APR 19, 2026",
        title: "BINARY NEURAL TRANSMISSION",
        note: "Standard data transmission was too slow for real-time viral coordination. We've shifted to <b>MessagePack Binary Serialization</b>, reducing neural latency by 70%. The phages now move with eerie, singular synchrony.",
        tech: "MessagePack, Client-Side Prediction, Lerp-10 Integration"
    },
    {
        ref: "LOG_089_SOCIAL",
        date: "APR 20, 2026",
        title: "COLONY INTELLIGENCE & HIERARCHY",
        note: "The introduction of Global Comms and the Hall of Fame has sparked competitive behavior. Organisms are now self-identifying and tracking their biological rank. <b>Auth-less persistence</b> ensures no friction during infection.",
        tech: "MetaSystem Persistence, Glassmorphic HUD"
    },
    {
        ref: "LOG_102_LYSIS",
        date: "APR 22, 2026",
        title: "THE LYSIS TRAP PROTOCOL",
        note: "Our most lethal breakthrough. We've programmed a <b>Lysis Trap</b> into the biomass. If a predator attempts to engulf a phage without sufficient metabolic advantage (1.5x ratio), they suffer catastrophic lysis—bursting from within.",
        tech: "Authoritative Collision Arbiter, Viral Fragmentation Physics"
    },
    {
        ref: "LOG_115_AESTHETIC",
        date: "APR 22, 2026",
        title: "MEMBRANOUS INTERFACE OVERHAUL",
        note: "Final stabilization of the <b>Gooey UI filters</b>. Every diagnostic panel now behaves like a living membrane. We've removed all generic cyber-elements, favoring organic, pulsing borders and biological noise overlays.",
        tech: "SVG Gooey Filters, Procedural CSS Noise, Organic Wobble"
    },
    {
        ref: "LOG_128_DYNAMICS",
        date: "APR 23, 2026",
        title: "DYNAMIC KINETIC STEERING",
        note: "The mobile interface has been liberated. Controls now spawn directly under the operator's touch, adapting to any appendage placement. This reduces tactile friction during high-intensity engulfment cycles.",
        tech: "Dynamic Touch-Start Joystick, Responsive Grid Layout"
    },
    {
        ref: "LOG_135_TOTAL_SYNC",
        date: "APR 23, 2026",
        title: "PHAGE PROTOCOL v2.0",
        note: "A total architectural synchronization. We've optimized the neural broadcast state, rounding tactical data to minimize bandwidth while hardening the cellular membrane shaders. The game is now fully authoritative and visceral.",
        tech: "Bit-Packed State Sync, Membrane Fresnel Shaders, Visceral Lysis VFX"
    },
    {
        ref: "LOG_150_LAUNCH",
        date: "APR 24, 2026",
        title: "GLOBAL MUTATION: PHAGE.LOL LIVE",
        note: "The infection has spread to the primary domain. PHAGE.LOL is officially operational. All legacy 'Blobz' traces have been scrubbed. The Vibe Jam 2026 widget is active, and the Portal Webring is feeding biomass from across the metaverse.",
        log: [
            { t: "2026-04-22 19:40", e: "FINAL_REBRANDING", d: "README.md scrubbed. Repository renamed to phage-lol." },
            { t: "2026-04-22 20:05", e: "SCREENSHOT_CAPTURE", d: "High-fidelity gameplay capture confirmed. Submission checklist 100% complete." },
            { t: "2026-04-22 20:10", e: "SYSTEM_STABILIZATION", d: "Join deadlock resolved via socket state-reset. Entity rendering hardened for high-concurrency." }
        ],
        tech: "Production Deployment, Railway CI/CD, Domain Migration"
    },
    {
        ref: "LOG_STABILIZE_FINAL",
        date: "APR 25, 2026",
        title: "ZERO HOUR STABILIZATION",
        note: "Remediated fatal identifier redeclaration conflict in core game loop. Hardened audio engine with defensive null checks to prevent Web Audio API crashes during high-frequency lysis events.",
        tech: "DEFENSIVE JS // RUNTIME AUDIT"
    }
];

export const HowItWasMade = {
    init() {
        if (overlay) return;

        const style = document.createElement('style');
        style.textContent = `
            #hiwm-overlay {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(1, 2, 5, 0.98); backdrop-filter: blur(15px);
                z-index: 9999; display: none; flex-direction: column; align-items: center;
                color: #fff; font-family: 'Courier New', Courier, monospace;
                overflow-y: auto; overflow-x: hidden;
                opacity: 0; transform: scale(1.1);
                transition: opacity 0.4s ease-out, transform 0.4s cubic-bezier(0.19, 1, 0.22, 1);
                background-image: radial-gradient(circle at 50% 50%, rgba(0, 255, 102, 0.03) 0%, transparent 70%);
            }
            #hiwm-overlay.show { opacity: 1; transform: scale(1); }
            .hiwm-close {
                position: fixed; top: 20px; right: 30px; font-size: 32px;
                color: var(--cyan); cursor: pointer; text-shadow: 0 0 10px var(--cyan); z-index: 10000;
            }
            .hiwm-title {
                margin-top: 60px; font-size: 42px; color: var(--cyan); text-align: center;
                text-shadow: 0 0 30px rgba(0, 255, 102, 0.3); letter-spacing: 5px;
                font-family: 'Orbitron'; font-weight: 900;
            }
            .hiwm-timeline {
                position: relative; max-width: 900px; width: 90%; margin: 60px 0;
                padding-left: 40px; border-left: 2px dashed rgba(0, 255, 102, 0.2);
            }
            .hiwm-card {
                background: rgba(0, 10, 5, 0.6); border: 1px solid rgba(0, 255, 102, 0.1);
                border-radius: 4px; padding: 30px; margin-bottom: 50px; position: relative;
                transition: 0.3s;
            }
            .hiwm-card:hover {
                border-color: var(--cyan);
                background: rgba(0, 255, 102, 0.05);
                box-shadow: 0 0 30px rgba(0, 255, 102, 0.1);
            }
            .hiwm-card::before {
                content: '●'; position: absolute; left: -51px; top: 35px;
                color: var(--cyan); font-size: 20px; text-shadow: 0 0 10px var(--cyan);
            }
            .hiwm-card-title { color: var(--cyan); font-size: 18px; margin-bottom: 20px; letter-spacing: 3px; font-family: 'Orbitron'; font-weight: 700; }
            .hiwm-outputs { font-size: 14px; line-height: 1.8; color: #8a8; }
            .hiwm-outputs b { color: #fff; }
            .hiwm-footer {
                margin: 40px 0 80px 0; text-align: center; font-size: 11px; color: #444;
                max-width: 600px; line-height: 1.8; letter-spacing: 1px;
            }
        `;
        document.head.appendChild(style);

        overlay = document.createElement('div');
        overlay.id = 'hiwm-overlay';

        let timelineHtml = '';
        logs.forEach(log => {
            timelineHtml += `
                <div class="hiwm-card">
                    <div style="font-size:10px; color:var(--cyan); opacity:0.6; margin-bottom:10px; letter-spacing:2px;">[ ${log.ref} ] // ${log.date}</div>
                    <div class="hiwm-card-title">${log.title}</div>
                    <div class="hiwm-outputs">${log.note}</div>
                    <div style="margin-top:20px; font-size:9px; color:#555; border-top:1px solid #111; padding-top:10px;">CORE SYSTEMS: ${log.tech}</div>
                </div>
            `;
        });

        overlay.innerHTML = `
            <div class="hiwm-close" id="hiwm-close-btn">×</div>
            <h1 class="hiwm-title">DIAGNOSTIC ARCHIVE</h1>
            <p style="margin-top:10px; color:#ffffff22; font-size:10px; letter-spacing:4px; text-align:center;">CLASSIFIED RESEARCH // VIBE JAM 2026</p>
            
            <div class="hiwm-timeline">
                ${timelineHtml}
            </div>

            <div style="background:rgba(0,255,102,0.02); border:1px solid rgba(0,255,102,0.1); padding:40px; border-radius:4px; text-align:center; margin: 60px auto 100px auto; max-width:700px; width:90%;">
                <div style="font-size:14px; color:var(--cyan); margin-bottom:15px; font-family:'Orbitron'; letter-spacing:3px;">GITHUB_REPOSITORY_ACCESS</div>
                <p style="font-size:11px; color:#444; margin-bottom:25px; line-height:1.8;">The full source history of the Phage Protocol is available for audit. <br>90% AI-Augmented Development Cycle Verified.</p>
                <a href="https://github.com/jordan-thirkle/phage-lol" target="_blank" style="display:inline-block; padding:15px 40px; background:var(--cyan); color:#000; text-decoration:none; font-weight:900; transition:0.3s; font-family:'Orbitron'; letter-spacing:2px; box-shadow: 0 0 30px rgba(0,255,102,0.3);">ESTABLISH_UPLINK</a>
            </div>

            <div class="hiwm-footer">
                PHAGE.LOL IS A PRODUCT OF BIOLOGICAL CHAOS AND ALGORITHMIC PRECISION.<br>
                STAY COMPLIANT. ENGULF EVERYTHING.
            </div>
        `;

        document.body.appendChild(overlay);
        document.getElementById('hiwm-close-btn').addEventListener('click', () => this.close());
    },

    open(AudioEngine) {
        if (!overlay) this.init();
        overlay.style.display = 'flex';
        setTimeout(() => overlay.classList.add('show'), 10);
        if (AudioEngine && AudioEngine.resume) AudioEngine.resume();
    },

    close() {
        if (!overlay) return;
        overlay.classList.remove('show');
        setTimeout(() => overlay.style.display = 'none', 400);
    }
};

