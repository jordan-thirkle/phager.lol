// ─── BLOBZ.IO Audio Engine (Web Audio API, no downloads) ───
const Audio = (() => {
  let ctx = null;
  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  function synth({ freq = 440, freq2 = freq, type = 'sine', duration = 0.15, vol = 0.3, delay = 0 }) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 2000;
    osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
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
    eatFood() { synth({ freq: 300, freq2: 600, type: 'sine', duration: 0.08, vol: 0.15 }); },
    eatPlayer() {
      synth({ freq: 200, freq2: 800, type: 'sawtooth', duration: 0.2, vol: 0.4 });
      synth({ freq: 400, freq2: 1200, type: 'sine', duration: 0.3, vol: 0.3, delay: 0.05 });
    },
    split() {
      synth({ freq: 500, freq2: 300, type: 'square', duration: 0.12, vol: 0.2 });
      synth({ freq: 600, freq2: 400, type: 'square', duration: 0.12, vol: 0.2, delay: 0.06 });
    },
    boost() { synth({ freq: 150, freq2: 400, type: 'sawtooth', duration: 0.18, vol: 0.25 }); },
    die() {
      synth({ freq: 600, freq2: 100, type: 'sawtooth', duration: 0.5, vol: 0.5 });
      synth({ freq: 300, freq2: 80, type: 'sine', duration: 0.6, vol: 0.4, delay: 0.1 });
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
    }
  };
})();
