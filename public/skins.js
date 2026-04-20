// ─── BLOBZ.IO Skin Texture Generator (Canvas 2D → PlayCanvas Texture) ───
const Skins = (() => {
  const SIZE = 256;
  const PATTERNS = ['solid','dots','stripes','stars','hexagon','swirl','lightning','checkers', 'plasma', 'circuit', 'glitch', 'void'];

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return { r, g, b, str: `rgb(${r},${g},${b})` };
  }
  function lighter(hex, amt=80) {
    const {r,g,b} = hexToRgb(hex);
    return `rgb(${Math.min(255,r+amt)},${Math.min(255,g+amt)},${Math.min(255,b+amt)})`;
  }
  function darker(hex, amt=60) {
    const {r,g,b} = hexToRgb(hex);
    return `rgb(${Math.max(0,r-amt)},${Math.max(0,g-amt)},${Math.max(0,b-amt)})`;
  }

  function drawBase(ctx, color) {
    const grad = ctx.createRadialGradient(90, 80, 20, 128, 128, 128);
    grad.addColorStop(0, lighter(color, 100));
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, darker(color, 80));
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(128, 128, 120, 0, Math.PI * 2); ctx.fill();
  }

  function patternDots(ctx, color) {
    ctx.fillStyle = lighter(color, 120);
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, r = 65 + (i % 3) * 20;
      ctx.beginPath(); ctx.arc(128 + Math.cos(a)*r, 128 + Math.sin(a)*r, 10, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function patternStripes(ctx, color) {
    ctx.strokeStyle = lighter(color, 100); ctx.lineWidth = 12; ctx.globalAlpha = 0.4;
    ctx.save(); ctx.translate(128,128); ctx.rotate(Math.PI/4);
    for (let i = -150; i < 150; i += 30) {
      ctx.beginPath(); ctx.moveTo(i, -150); ctx.lineTo(i, 150); ctx.stroke();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  function patternStars(ctx, color) {
    ctx.fillStyle = lighter(color, 140); ctx.globalAlpha = 0.6;
    const drawStar = (cx, cy, r, spikes) => {
      let rot = -Math.PI/2, step = Math.PI/spikes;
      ctx.beginPath(); ctx.moveTo(cx, cy - r);
      for (let i = 0; i < spikes * 2; i++) {
        const rr = i % 2 === 0 ? r : r * 0.4;
        ctx.lineTo(cx + Math.cos(rot) * rr, cy + Math.sin(rot) * rr);
        rot += step;
      }
      ctx.closePath(); ctx.fill();
    };
    drawStar(128, 128, 55, 5);
    drawStar(60, 65, 18, 4); drawStar(195, 75, 14, 4);
    drawStar(75, 185, 12, 4); drawStar(185, 185, 16, 4);
    ctx.globalAlpha = 1;
  }

  function patternHexagon(ctx, color) {
    ctx.strokeStyle = lighter(color, 110); ctx.lineWidth = 8; ctx.globalAlpha = 0.45;
    const hex = (cx, cy, r) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
        i === 0 ? ctx.moveTo(cx + Math.cos(a)*r, cy + Math.sin(a)*r)
                : ctx.lineTo(cx + Math.cos(a)*r, cy + Math.sin(a)*r);
      }
      ctx.closePath(); ctx.stroke();
    };
    hex(128, 128, 80); hex(128, 128, 50); hex(128, 128, 25);
    ctx.globalAlpha = 1;
  }

  function patternSwirl(ctx, color) {
    ctx.strokeStyle = lighter(color, 120); ctx.lineWidth = 10; ctx.globalAlpha = 0.5;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 6; a += 0.05) {
      const r = a * 12, x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r;
      a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  function patternLightning(ctx, color) {
    ctx.fillStyle = lighter(color, 130); ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(145, 40); ctx.lineTo(115, 115); ctx.lineTo(135, 115);
    ctx.lineTo(105, 210); ctx.lineTo(155, 130); ctx.lineTo(135, 130);
    ctx.lineTo(165, 40); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  }

  function patternCheckers(ctx, color) {
    ctx.fillStyle = lighter(color, 90); ctx.globalAlpha = 0.35;
    const sq = 32;
    for (let x = 0; x < SIZE; x += sq) {
      for (let y = 0; y < SIZE; y += sq) {
        if ((x / sq + y / sq) % 2 === 0) ctx.fillRect(x, y, sq, sq);
      }
    }
    ctx.globalAlpha = 1;
  }

  function patternSolid(ctx, color) {
    // Just shine highlight
    ctx.fillStyle = lighter(color, 160); ctx.globalAlpha = 0.25;
    ctx.beginPath(); ctx.ellipse(100, 90, 35, 22, -Math.PI/4, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;
  }

  function patternPlasma(ctx, color) {
    const phase = 2.1;
    const { r, g, b } = hexToRgb(color);
    // Convert RGB to HSL-ish
    for (let x = 0; x < SIZE; x += 4) {
      for (let y = 0; y < SIZE; y += 4) {
        const v = Math.abs(Math.sin(x * 0.05 + phase) + Math.sin(y * 0.04 + phase * 1.3) + Math.sin((x + y) * 0.03));
        const offset = v * 30;
        ctx.fillStyle = `rgb(${Math.min(255, r + offset)}, ${Math.min(255, g + offset)}, ${Math.min(255, b + offset)})`;
        ctx.fillRect(x, y, 4, 4);
      }
    }
  }

  function patternCircuit(ctx, color) {
    ctx.strokeStyle = lighter(color, 80);
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 2;
    const drawLine = (x, y, depth) => {
      if (depth > 6) return;
      const len = Math.random() * 40 + 10;
      const horizontal = Math.random() > 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const nx = x + (horizontal ? len : 0);
      const ny = y + (!horizontal ? len : 0);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      
      // Junction dot
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(nx, ny, 3, 0, Math.PI * 2); ctx.fill();
      
      if (Math.random() < 0.4) drawLine(nx, ny, depth + 1);
      if (Math.random() < 0.4) drawLine(nx, ny, depth + 1);
    };
    drawLine(128, 128, 0);
    for(let i=0; i<5; i++) drawLine(Math.random()*SIZE, Math.random()*SIZE, 2);
    ctx.globalAlpha = 1;
  }

  function patternGlitch(ctx, color) {
    for (let i = 0; i < 40; i++) {
      const y = Math.floor(Math.random() * SIZE);
      const h = Math.floor(Math.random() * 4) + 1;
      const offset = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 16 + 8);
      try {
          const data = ctx.getImageData(0, y, SIZE, h);
          ctx.putImageData(data, offset, y);
          if (offset > 0) ctx.putImageData(data, offset - SIZE, y);
          else ctx.putImageData(data, offset + SIZE, y);
      } catch(e) {}
    }
  }

  function patternVoid(ctx, color) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, SIZE, SIZE);
    const radii = [20, 40, 65, 95, 130, 160];
    radii.forEach((r, i) => {
      ctx.beginPath();
      ctx.arc(128, 128, r, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.7 - (i * 0.1);
      ctx.lineWidth = 3;
      ctx.stroke();
    });
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 1;
    for (let i = 0; i < 80; i++) {
      ctx.fillRect(Math.random() * SIZE, Math.random() * SIZE, 1, 1);
    }
  }

  const drawers = { solid:patternSolid, dots:patternDots, stripes:patternStripes, stars:patternStars,
    hexagon:patternHexagon, swirl:patternSwirl, lightning:patternLightning, checkers:patternCheckers,
    plasma:patternPlasma, circuit:patternCircuit, glitch:patternGlitch, void:patternVoid };

  function patternIndexForId(id) {
    let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return h % PATTERNS.length;
  }

  const cache = {};
  function getTexture(app, id, color) {
    const key = `${id}_${color}`;
    if (cache[key]) return cache[key];
    const cv = document.createElement('canvas'); cv.width = SIZE; cv.height = SIZE;
    const ctx = cv.getContext('2d');
    const patName = PATTERNS[patternIndexForId(id)];
    drawBase(ctx, color);
    // Clip pattern to circle
    ctx.save(); ctx.beginPath(); ctx.arc(128,128,120,0,Math.PI*2); ctx.clip();
    drawers[patName](ctx, color);
    ctx.restore();
    // Edge glow
    const rim = ctx.createRadialGradient(128,128,100,128,128,128);
    rim.addColorStop(0,'transparent'); rim.addColorStop(1, lighter(color, 60));
    ctx.globalAlpha = 0.6; ctx.fillStyle = rim;
    ctx.beginPath(); ctx.arc(128,128,128,0,Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;

    const tex = new pc.Texture(app.graphicsDevice, { width:SIZE, height:SIZE, format:pc.PIXELFORMAT_RGBA8, mipmaps:true });
    tex.setSource(cv);
    cache[key] = tex;
    return tex;
  }

  return { getTexture, patternIndexForId, PATTERNS };
})();
