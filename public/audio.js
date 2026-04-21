// ─── BLOBZ.IO Audio Engine (Web Audio API, no downloads) ───
window.Audio = (() => {
  let ctx = null;
  let masterGain = null;

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.8;
    masterGain.connect(ctx.destination);
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  function synth({ freq = 440, freq2 = freq, type = 'sine', duration = 0.15, vol = 0.3, delay = 0 }) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 2000;
    osc.connect(filter); filter.connect(gain); gain.connect(masterGain);
    osc.type = type;
    const t = ctx.currentTime + delay;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq2, t + duration);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t); osc.stop(t + duration + 0.05);
  }

  return {
    init, resume,
    eatFood() { 
      synth({ freq: 200, freq2: 50, type: 'sine', duration: 0.1, vol: 0.2 }); 
      // Add a small squelch
      const t = ctx.currentTime;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 15;
      f.frequency.setValueAtTime(1000, t); f.frequency.exponentialRampToValueAtTime(100, t + 0.1);
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 150;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.05, t); g.gain.linearRampToValueAtTime(0, t + 0.1);
      o.connect(f); f.connect(g); g.connect(masterGain);
      o.start(t); o.stop(t + 0.12);
    },
    eatPlayer() {
      synth({ freq: 150, freq2: 40, type: 'sawtooth', duration: 0.3, vol: 0.5 });
      // Rupture sound
      const t = ctx.currentTime;
      for(let i=0; i<3; i++) {
        synth({ freq: 300 + i*100, freq2: 50, type: 'square', duration: 0.2, vol: 0.15, delay: i*0.05 });
      }
    },
    split() {
      synth({ freq: 400, freq2: 150, type: 'triangle', duration: 0.15, vol: 0.3 });
      synth({ freq: 300, freq2: 100, type: 'sine', duration: 0.15, vol: 0.2, delay: 0.05 });
    },
    boost() { synth({ freq: 120, freq2: 350, type: 'sawtooth', duration: 0.2, vol: 0.2 }); },
    die() {
      synth({ freq: 400, freq2: 40, type: 'sawtooth', duration: 0.8, vol: 0.6 });
      synth({ freq: 200, freq2: 20, type: 'sine', duration: 1.0, vol: 0.5, delay: 0.1 });
    },
    lysis() {
        const t = ctx.currentTime;
        [0, 50, 100, 150].forEach(d => {
            synth({ freq: 1200 - d*2, freq2: 100, type: 'square', duration: 0.4, vol: 0.2, delay: d/1000 });
        });
    },
    levelUp() {
      [0, 100, 200, 350].forEach((d, i) => {
        synth({ freq: [400, 500, 600, 900][i], type: 'sine', duration: 0.18, vol: 0.35, delay: d / 1000 });
      });
    },
    streak(n) {
      const freqs = [0, 0, 500, 700, 900, 1100, 1400];
      const f = freqs[Math.min(n, 6)] || 1400;
      synth({ freq: f * 0.7, freq2: f, type: 'sawtooth', duration: 0.3, vol: 0.4 });
      synth({ freq: f, freq2: f * 1.5, type: 'sine', duration: 0.4, vol: 0.5, delay: 0.1 });
    },
    spawn() { synth({ freq: 200, freq2: 500, type: 'sine', duration: 0.3, vol: 0.3 }); },
    virusHit() {
      [0, 60, 120, 180].forEach((d, i) => {
        synth({ freq: 600 - i * 120, type: 'square', duration: 0.15, vol: 0.25, delay: d / 1000 });
      });
    },
    playShieldActivate() {
      const t = ctx.currentTime;
      [220, 440, 880].forEach(f => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(masterGain);
        osc.type = 'sine'; osc.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.15, t + 0.3);
        g.gain.linearRampToValueAtTime(0, t + 0.8);
        osc.start(t); osc.stop(t + 0.85);
      });
    },
    playMagnetPulse() {
      const t = ctx.currentTime;
      const bufferSize = 2048;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      
      const source = ctx.createBufferSource();
      source.buffer = buffer; source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = 800;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 4;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 400;
      lfo.connect(lfoGain); lfoGain.connect(filter.frequency);
      
      const g = ctx.createGain();
      source.connect(filter); filter.connect(g); g.connect(masterGain);
      g.gain.setValueAtTime(0.3, t); g.gain.linearRampToValueAtTime(0, t + 0.4);
      lfo.start(t); source.start(t); lfo.stop(t + 0.45); source.stop(t + 0.45);
    },
    playDashCrack() {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(masterGain);
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(200, t + 0.05);
      g.gain.setValueAtTime(0.4, t);
      g.gain.linearRampToValueAtTime(0, t + 0.05);
      osc.start(t); osc.stop(t + 0.1);
    },
    playDecoySpawn() {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(masterGain);
      osc.type = 'square';
      g.gain.setValueAtTime(0.2, t); g.gain.linearRampToValueAtTime(0, t + 0.3);
      osc.start(t); osc.stop(t + 0.3);
      // Frequency jitter
      for (let i = 0; i < 15; i++) {
          osc.frequency.setValueAtTime(150 + Math.random() * 400, t + i * 0.02);
      }
    },
    playAchievementUnlock() {
        const t = ctx.currentTime;
        [262, 294, 330, 392, 440].forEach((f, i) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.connect(g); g.connect(masterGain);
            osc.type = 'sine'; osc.frequency.setValueAtTime(f, t + i * 0.12);
            g.gain.setValueAtTime(0, t + i * 0.12);
            g.gain.linearRampToValueAtTime(0.2, t + i * 0.12 + 0.1);
            g.gain.linearRampToValueAtTime(0, t + i * 0.12 + 0.5);
            osc.start(t + i * 0.12); osc.stop(t + i * 0.12 + 0.55);
        });
    },
    setVolume(v) {
      if (masterGain) masterGain.gain.setTargetAtTime(v, ctx.currentTime, 0.1);
    }
  };
})();
