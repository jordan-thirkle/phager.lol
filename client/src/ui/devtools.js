import { AppState, LS } from '../core/state.js';

const STORAGE_KEY = 'phage_devtools_open';
const PERF_OVERRIDE_KEY = 'dev_perf_profile';
const PROFILER_STORAGE_KEY = 'phage_devtools_profiler';
const LOG_LIMIT = 80;
const UPDATE_INTERVAL = 1000;
const PROFILER_RENDER_INTERVAL = 2000;
const SAMPLE_INTERVAL_VISIBLE = 500;
const SAMPLE_INTERVAL_HIDDEN = 2000;
const HISTORY_MS = 15000;
const DELTA_WINDOW_MS = 10000;

const refs = {
  game: null,
  MetaSystem: null,
  HudSystem: null,
  ParticleSystem: null,
  root: null,
  panel: null,
  log: null,
  status: null,
  runtime: null,
  network: null,
  server: null,
  gameplay: null,
  profiler: null,
  settings: null,
  perf: null,
  summary: null,
  profilerPill: null,
  clientChart: null,
  serverChart: null,
  deltaGrid: null,
  profilerState: null,
  packetRate: null,
  stateGap: null,
  myMass: null,
  myBlobs: null,
  entityCounts: null,
  sessionKills: null,
  peakMass: null,
  playerCount: null,
  socketState: null,
  socketId: null,
  socketUrl: null,
  worldStateAge: null,
  pendingInputs: null,
  clientSeq: null,
  processedSeq: null,
  frameTime: null,
  fps: null,
  triangles: null,
  drawCalls: null,
  heap: null,
  device: null,
  perfProfile: null,
};

const eventLog = [];
const packetTimes = [];
const samples = [];
let latestSample = null;
let lastPacketLogAt = 0;
let visible = false;
let initialized = false;
let bound = false;
let renderAccum = 0;
let profilerRenderAccum = 0;
let sampleAccum = 0;
let profilerMode = true;

function nowLabel(ts = Date.now()) {
  return new Date(ts).toLocaleTimeString([], {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function fmtInt(n) {
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : '0';
}

function fmtMs(ms) {
  if (!Number.isFinite(ms)) return '-';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtBytes(bytes) {
  if (!Number.isFinite(bytes)) return '-';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getDeviceSummary() {
  const mem = navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'unknown';
  const cores = navigator.hardwareConcurrency || 'unknown';
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 'yes' : 'no';
  return `mem ${mem} | cores ${cores} | motion ${reducedMotion}`;
}

function getCounts() {
  const players = Array.isArray(AppState.gameState.players) ? AppState.gameState.players : [];
  let blobCount = 0;
  let alivePlayers = 0;
  let me = null;

  for (const p of players) {
    if (!p || !Array.isArray(p.blobs) || !p.blobs.length) continue;
    alivePlayers++;
    blobCount += p.blobs.length;
    if (p.id === AppState.myId) me = p;
  }

  const foodCount = Object.keys(AppState.fEnts || {}).length;
  const virusCount = Object.keys(AppState.vEnts || {}).length;
  const decoyCount = Array.isArray(AppState.gameState.decoys) ? AppState.gameState.decoys.length : 0;
  const playerEntCount = Object.keys(AppState.pEnts || {}).length;
  const particleStats = refs.ParticleSystem?.getStats?.() || null;
  const totalEntities = playerEntCount + foodCount + virusCount + decoyCount + (particleStats?.active || 0);
  const myMass = me?.blobs?.reduce((sum, b) => sum + (b?.mass || 0), 0) || 0;

  return {
    alivePlayers,
    blobCount,
    foodCount,
    virusCount,
    decoyCount,
    playerEntCount,
    totalEntities,
    myMass,
    myBlobs: me?.blobs?.length || 0,
    me
  };
}

function getPacketRate() {
  const cutoff = Date.now() - 5000;
  while (packetTimes.length && packetTimes[0] < cutoff) packetTimes.shift();
  return packetTimes.length / 5;
}

function getHistoryWindow(now = Date.now(), windowMs = HISTORY_MS) {
  const cutoff = now - windowMs;
  return samples.filter(sample => sample.ts >= cutoff);
}

function getSampleNearest(ts) {
  if (!samples.length) return null;
  let best = samples[0];
  let bestDist = Math.abs(samples[0].ts - ts);
  for (const sample of samples) {
    const dist = Math.abs(sample.ts - ts);
    if (dist < bestDist) {
      best = sample;
      bestDist = dist;
    }
  }
  return best;
}

function captureSample(dt) {
  const now = Date.now();
  const fps = dt > 0 ? 1 / dt : 0;
  const stats = AppState.app?.stats;
  const drawCalls = stats ? (stats.drawCalls?.total ?? stats.drawCalls ?? 0) : 0;
  const triangles = stats?.frame?.triangles ?? 0;
  const counts = getCounts();
  const packetRate = getPacketRate();
  const server = AppState.serverStats || null;
  const frameMs = dt * 1000;
  const heapUsed = performance.memory?.usedJSHeapSize ?? 0;
  const heapTotal = performance.memory?.jsHeapSizeLimit ?? 0;

  samples.push({
    ts: now,
    fps,
    frameMs,
    drawCalls,
    triangles,
    entities: counts.totalEntities,
    players: counts.alivePlayers,
    foods: counts.foodCount,
    viruses: counts.virusCount,
    myMass: counts.myMass,
    packetRate,
    serverTickMs: server?.tickMs ?? 0,
    serverClients: server?.clients ?? 0,
    serverPlayers: server?.totals?.players ?? 0,
    serverBots: server?.totals?.bots ?? 0,
    serverFoods: server?.totals?.foods ?? 0,
    serverViruses: server?.totals?.viruses ?? 0,
    serverDecoys: server?.totals?.decoys ?? 0,
    heapUsed,
    heapTotal
  });

  const cutoff = now - HISTORY_MS;
  while (samples.length && samples[0].ts < cutoff) samples.shift();
}

function formatDelta(current, past, precision = 0, unit = '') {
  if (!Number.isFinite(current) || !Number.isFinite(past)) return '-';
  const delta = current - past;
  const sign = delta > 0 ? '+' : '';
  const pct = Math.abs(past) > 0.0001 ? ` (${sign}${((delta / Math.abs(past)) * 100).toFixed(0)}%)` : '';
  return `${sign}${delta.toFixed(precision)}${unit}${pct}`;
}

function formatValue(value, precision = 0, unit = '') {
  if (!Number.isFinite(value)) return '-';
  if (unit === 'B') return fmtBytes(value);
  if (unit) return `${value.toFixed(precision)}${unit}`;
  return precision > 0 ? value.toFixed(precision) : fmtInt(value);
}

function renderDeltaRows(nowSample) {
  if (!refs.deltaGrid) return;
  if (!nowSample) {
    refs.deltaGrid.innerHTML = '<div class="dt-delta-empty">No history yet. Keep the game running for a few seconds.</div>';
    return;
  }

  const past = getSampleNearest(nowSample.ts - DELTA_WINDOW_MS);
  if (!past) {
    refs.deltaGrid.innerHTML = '<div class="dt-delta-empty">Waiting for 10 seconds of history.</div>';
    return;
  }

  const rows = [
    ['FPS', nowSample.fps, past.fps, 0, ''],
    ['Frame ms', nowSample.frameMs, past.frameMs, 1, 'ms'],
    ['Draw calls', nowSample.drawCalls, past.drawCalls, 0, ''],
    ['Triangles', nowSample.triangles, past.triangles, 0, ''],
    ['Entities', nowSample.entities, past.entities, 0, ''],
    ['Players', nowSample.players, past.players, 0, ''],
    ['Packet Hz', nowSample.packetRate, past.packetRate, 1, ''],
    ['Server tick', nowSample.serverTickMs, past.serverTickMs, 1, 'ms'],
    ['Heap', nowSample.heapUsed, past.heapUsed, 0, 'B'],
    ['My mass', nowSample.myMass, past.myMass, 0, ''],
  ];

  refs.deltaGrid.innerHTML = rows.map(([label, current, previous, precision, unit]) => {
    const delta = formatDelta(current, previous, precision, unit);
    const diff = current - previous;
    const tone = diff > 0 ? 'up' : (diff < 0 ? 'down' : 'flat');
    return `
      <div class="dt-delta-row ${tone}">
        <span class="dt-delta-label">${label}</span>
        <span class="dt-delta-current">${formatValue(current, precision, unit)}</span>
        <span class="dt-delta-change">${delta}</span>
      </div>
    `;
  }).join('');
}

function drawChart(canvas, samplesList, seriesDefs, windowMs = HISTORY_MS) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.clientWidth || canvas.width;
  const height = canvas.clientHeight || canvas.height;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, 0, width, height);

  const now = Date.now();
  const visible = samplesList.filter(sample => sample.ts >= now - windowMs);
  if (!visible.length) {
    ctx.fillStyle = 'rgba(215,251,255,0.45)';
    ctx.font = '11px Orbitron, monospace';
    ctx.fillText('collecting samples...', 14, height / 2);
    return;
  }

  const sampled = visible.length > 48
    ? visible.filter((_, idx) => idx === visible.length - 1 || idx % 2 === 0)
    : visible;

  const padding = { top: 16, right: 12, bottom: 18, left: 12 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  ctx.strokeStyle = 'rgba(0,242,255,0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(padding.left, padding.top, plotW, plotH);

  // grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  for (let i = 1; i < 4; i++) {
    const y = padding.top + (plotH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + plotW, y);
    ctx.stroke();
  }

  const minTs = sampled[0].ts;
  const maxTs = sampled[sampled.length - 1].ts;
  const timeSpan = Math.max(1, maxTs - minTs);

  const scales = seriesDefs.map(def => {
    const values = sampled.map(sample => Number(sample[def.key] || 0));
    let min = Number.isFinite(def.min) ? def.min : Math.min(...values);
    let max = Number.isFinite(def.max) ? def.max : Math.max(...values);
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 1;
    if (max - min < 1) max = min + 1;
    const pad = (max - min) * 0.15;
    return {
      ...def,
      min: min - pad,
      max: max + pad,
      values
    };
  });

  for (const series of scales) {
    ctx.strokeStyle = series.color;
    ctx.fillStyle = series.fill || series.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    sampled.forEach((sample, idx) => {
      const value = Number(sample[series.key] || 0);
      const x = padding.left + ((sample.ts - minTs) / timeSpan) * plotW;
      const yNorm = clamp((value - series.min) / (series.max - series.min), 0, 1);
      const y = padding.top + plotH - yNorm * plotH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const last = sampled[sampled.length - 1];
    const lastValue = Number(last[series.key] || 0);
    const lastX = padding.left + plotW - 2;
    const lastNorm = clamp((lastValue - series.min) / (series.max - series.min), 0, 1);
    const lastY = padding.top + plotH - lastNorm * plotH;
    ctx.fillStyle = series.color;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // labels
  ctx.fillStyle = 'rgba(215,251,255,0.85)';
  ctx.font = '10px Orbitron, monospace';
  ctx.textBaseline = 'top';
  let lx = padding.left + 4;
  for (const series of scales) {
    const last = visible[visible.length - 1];
    const lastValue = Number(last[series.key] || 0);
    const label = `${series.label}: ${series.format ? series.format(lastValue) : fmtInt(lastValue)}`;
    ctx.fillStyle = series.color;
    ctx.fillRect(lx, 4, 8, 8);
    ctx.fillStyle = 'rgba(215,251,255,0.85)';
    ctx.fillText(label, lx + 12, 2);
    lx += ctx.measureText(label).width + 26;
  }
}

function renderProfiler(nowSample) {
  if (!refs.clientChart || !refs.serverChart || !refs.deltaGrid) return;
  if (!profilerMode) {
    if (refs.profilerState) refs.profilerState.textContent = 'off';
    return;
  }

  if (refs.profilerState) refs.profilerState.textContent = `${samples.length} samples`;
  drawChart(refs.clientChart, samples, [
    { key: 'fps', label: 'FPS', color: '#40ff8a', max: 120, format: v => `${v.toFixed(0)}` },
    { key: 'frameMs', label: 'Frame', color: '#ffcc00', max: 80, format: v => `${v.toFixed(1)}ms` },
    { key: 'drawCalls', label: 'Draws', color: '#00f2ff', max: 800, format: v => fmtInt(v) },
  ]);

  drawChart(refs.serverChart, samples, [
    { key: 'entities', label: 'Entities', color: '#00f2ff', max: 1500, format: v => fmtInt(v) },
    { key: 'packetRate', label: 'Net', color: '#ff55aa', max: 40, format: v => `${v.toFixed(1)}hz` },
    { key: 'serverTickMs', label: 'Tick', color: '#40ff8a', max: 100, format: v => `${v.toFixed(1)}ms` },
  ]);

  renderDeltaRows(nowSample);
}

function pushLog(type, message, meta = '') {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    message,
    meta,
    ts: Date.now()
  };
  eventLog.push(entry);
  while (eventLog.length > LOG_LIMIT) eventLog.shift();
  if (refs.log) renderLog();
}

function renderLog() {
  if (!refs.log) return;
  refs.log.innerHTML = eventLog.slice().reverse().map(entry => `
    <div class="dt-log-row dt-${entry.type}">
      <span class="dt-log-time">${nowLabel(entry.ts)}</span>
      <span class="dt-log-type">${entry.type}</span>
      <span class="dt-log-msg">${entry.message}</span>
      ${entry.meta ? `<span class="dt-log-meta">${entry.meta}</span>` : ''}
    </div>
  `).join('');
}

function setVisible(nextVisible) {
  visible = !!nextVisible;
  if (refs.root) refs.root.classList.toggle('is-open', visible);
  if (refs.panel) refs.panel.setAttribute('aria-hidden', visible ? 'false' : 'true');
  LS.set('devtools_open', visible);
}

function toggle(force) {
  DevTools.toggle(force);
}

function setProfilerMode(nextMode) {
  profilerMode = !!nextMode;
  LS.set(PROFILER_STORAGE_KEY, profilerMode);
  if (refs.profilerPill) {
    refs.profilerPill.textContent = profilerMode ? 'profiler on' : 'profiler off';
  }
  if (refs.profilerState) {
    refs.profilerState.textContent = profilerMode ? 'sampling...' : 'paused';
  }
}

function toggleProfiler(force) {
  const next = typeof force === 'boolean' ? force : !profilerMode;
  setProfilerMode(next);
  pushLog('success', `profiler ${profilerMode ? 'enabled' : 'disabled'}`);
  renderProfiler(latestSample);
}

function ensureStyles() {
  if (document.getElementById('phage-devtools-style')) return;
  const style = document.createElement('style');
  style.id = 'phage-devtools-style';
  style.textContent = `
    #phage-devtools-root {
      position: fixed;
      top: 52px;
      right: 16px;
      z-index: 40000;
      pointer-events: none;
      font-family: Inter, system-ui, sans-serif;
      color: #d7fbff;
    }
    #phage-devtools-toggle {
      pointer-events: auto;
      position: absolute;
      top: 0;
      right: 0;
      width: 46px;
      height: 46px;
      border-radius: 999px;
      border: 1px solid rgba(0, 242, 255, 0.4);
      background: rgba(4, 10, 18, 0.9);
      color: #00f2ff;
      font-family: Orbitron, monospace;
      font-weight: 900;
      letter-spacing: 1px;
      cursor: pointer;
      box-shadow: 0 0 24px rgba(0, 242, 255, 0.18);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    #phage-devtools-toggle:hover {
      transform: translateY(-1px);
      box-shadow: 0 0 32px rgba(0, 242, 255, 0.28);
    }
    #phage-devtools-panel {
      pointer-events: auto;
      width: min(460px, calc(100vw - 32px));
      max-height: calc(100vh - 80px);
      margin-top: 56px;
      border-radius: 18px;
      border: 1px solid rgba(0, 242, 255, 0.18);
      background: rgba(4, 8, 14, 0.94);
      backdrop-filter: blur(18px) saturate(180%);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55), inset 0 0 0 1px rgba(255,255,255,0.03);
      overflow: hidden;
      display: none;
    }
    #phage-devtools-root.is-open #phage-devtools-panel {
      display: block;
    }
    .dt-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      padding: 14px 16px;
      border-bottom: 1px solid rgba(0, 242, 255, 0.12);
      background: linear-gradient(180deg, rgba(0, 242, 255, 0.07), rgba(0,0,0,0));
    }
    .dt-title {
      font-family: Orbitron, monospace;
      font-size: 13px;
      letter-spacing: 3px;
      color: #00f2ff;
      margin-bottom: 4px;
    }
    .dt-subtitle {
      font-size: 11px;
      opacity: 0.7;
      line-height: 1.4;
    }
    .dt-headline {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 10px;
      flex-wrap: wrap;
    }
    .dt-headline-copy {
      font-size: 11px;
      color: rgba(215, 251, 255, 0.72);
    }
    .dt-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }
    .dt-btn {
      border: 1px solid rgba(0, 242, 255, 0.18);
      background: rgba(255,255,255,0.03);
      color: #d7fbff;
      border-radius: 10px;
      padding: 8px 10px;
      font-size: 11px;
      cursor: pointer;
      transition: background 0.2s ease, transform 0.2s ease, border-color 0.2s ease;
    }
    .dt-btn:hover {
      background: rgba(0, 242, 255, 0.08);
      border-color: rgba(0, 242, 255, 0.35);
      transform: translateY(-1px);
    }
    .dt-body {
      max-height: calc(100vh - 150px);
      overflow: auto;
      padding: 14px;
      display: grid;
      gap: 12px;
    }
    .dt-card {
      border: 1px solid rgba(0, 242, 255, 0.10);
      border-radius: 14px;
      padding: 12px;
      background: rgba(255,255,255,0.02);
    }
    .dt-card.profiler-card {
      display: grid;
      gap: 10px;
    }
    .dt-card h4 {
      margin: 0 0 10px 0;
      font-family: Orbitron, monospace;
      letter-spacing: 2px;
      font-size: 10px;
      color: #00f2ff;
      text-transform: uppercase;
    }
    .dt-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .dt-row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      font-size: 12px;
      line-height: 1.4;
      padding: 6px 0;
      border-bottom: 1px dashed rgba(255,255,255,0.06);
    }
    .dt-row:last-child { border-bottom: none; }
    .dt-label { opacity: 0.65; }
    .dt-value {
      color: #ffffff;
      font-variant-numeric: tabular-nums;
      text-align: right;
    }
    .dt-pill {
      display: inline-flex;
      align-items: center;
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid rgba(0, 242, 255, 0.18);
      background: rgba(0, 242, 255, 0.06);
      color: #00f2ff;
      font-size: 11px;
      font-family: Orbitron, monospace;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .dt-toggle-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .dt-toggle {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      border-radius: 10px;
      padding: 10px 12px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.03);
      color: #d7fbff;
      cursor: pointer;
    }
    .dt-toggle strong {
      display: block;
      font-size: 12px;
      margin-bottom: 2px;
    }
    .dt-toggle span {
      display: block;
      font-size: 10px;
      opacity: 0.65;
    }
    .dt-toggle.active {
      border-color: rgba(0, 242, 255, 0.35);
      background: rgba(0, 242, 255, 0.09);
    }
    .dt-log {
      display: grid;
      gap: 6px;
      max-height: 220px;
      overflow: auto;
      font-size: 11px;
    }
    .dt-log-row {
      display: grid;
      grid-template-columns: 82px 74px 1fr;
      gap: 8px;
      align-items: start;
      padding: 6px 8px;
      border-radius: 8px;
      background: rgba(255,255,255,0.02);
    }
    .dt-log-time { color: rgba(215,251,255,0.45); font-variant-numeric: tabular-nums; }
    .dt-log-type { font-family: Orbitron, monospace; letter-spacing: 1px; color: #00f2ff; text-transform: uppercase; }
    .dt-log-msg { color: #fff; }
    .dt-log-meta { grid-column: 1 / -1; opacity: 0.55; font-size: 10px; }
    .dt-error .dt-log-type { color: #ff5577; }
    .dt-warn .dt-log-type { color: #ffcc00; }
    .dt-success .dt-log-type { color: #40ff8a; }
    .dt-chart-wrap {
      display: grid;
      gap: 8px;
    }
    .dt-chart {
      width: 100%;
      height: 120px;
      display: block;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.05);
      background: rgba(0,0,0,0.22);
    }
    .dt-chart-caption {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      font-size: 10px;
      letter-spacing: 1px;
      color: rgba(215,251,255,0.55);
      text-transform: uppercase;
      font-family: Orbitron, monospace;
    }
    .dt-delta-grid {
      display: grid;
      gap: 6px;
    }
    .dt-delta-row {
      display: grid;
      grid-template-columns: 110px 1fr auto;
      gap: 8px;
      align-items: center;
      padding: 7px 10px;
      border-radius: 10px;
      background: rgba(255,255,255,0.03);
      font-size: 11px;
    }
    .dt-delta-row.up { border-left: 3px solid rgba(64,255,138,0.8); }
    .dt-delta-row.down { border-left: 3px solid rgba(255,85,119,0.8); }
    .dt-delta-row.flat { border-left: 3px solid rgba(0,242,255,0.35); }
    .dt-delta-label { opacity: 0.65; }
    .dt-delta-current { text-align: right; font-variant-numeric: tabular-nums; }
    .dt-delta-change { text-align: right; color: rgba(215,251,255,0.82); font-variant-numeric: tabular-nums; }
    .dt-delta-empty {
      font-size: 11px;
      opacity: 0.55;
      padding: 8px 2px;
    }
    @media (max-width: 900px) {
      #phage-devtools-root {
        top: auto;
        bottom: 12px;
        right: 12px;
        left: 12px;
      }
      #phage-devtools-panel {
        width: auto;
        max-height: 60vh;
      }
      .dt-grid, .dt-toggle-list {
        grid-template-columns: 1fr;
      }
      .dt-log-row {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

function buildDOM() {
  const root = document.createElement('div');
  root.id = 'phage-devtools-root';
  root.innerHTML = `
    <button id="phage-devtools-toggle" title="Toggle dev tools (F2)">DEV</button>
    <aside id="phage-devtools-panel" aria-hidden="true">
      <div class="dt-head">
        <div>
          <div class="dt-title">DEV TOOLS</div>
          <div class="dt-subtitle">Live diagnostics, runtime toggles, network logs, and safe debug actions.</div>
          <div class="dt-headline">
            <span class="dt-pill" id="dt-status-pill">offline</span>
            <span class="dt-headline-copy" id="dt-summary-line">0 entities</span>
            <span class="dt-pill" id="dt-profiler-pill">profiler on</span>
          </div>
        </div>
        <div class="dt-actions">
          <button class="dt-btn" data-action="copy">Copy Snapshot</button>
          <button class="dt-btn" data-action="reconnect">Reconnect</button>
          <button class="dt-btn" data-action="respawn">Respawn</button>
          <button class="dt-btn" data-action="reload">Reload</button>
          <button class="dt-btn" data-action="profile">Profiler</button>
          <button class="dt-btn" data-action="hide">Hide</button>
        </div>
      </div>
      <div class="dt-body">
        <section class="dt-card profiler-card">
          <div class="dt-chart-caption">
            <span>Client rolling window</span>
            <span id="dt-profiler-state">sampling...</span>
          </div>
          <canvas id="dt-client-chart" class="dt-chart" width="420" height="120"></canvas>
          <div class="dt-chart-caption">
            <span>Server and network rolling window</span>
            <span>last 30s</span>
          </div>
          <canvas id="dt-server-chart" class="dt-chart" width="420" height="120"></canvas>
          <div class="dt-chart-caption">
            <span>Changes over the last 10 seconds</span>
            <span>delta view</span>
          </div>
          <div class="dt-delta-grid" id="dt-delta-grid"></div>
        </section>
        <section class="dt-card">
          <h4>Runtime</h4>
          <div class="dt-grid" id="dt-runtime"></div>
        </section>
        <section class="dt-card">
          <h4>Network</h4>
          <div class="dt-grid" id="dt-network"></div>
        </section>
        <section class="dt-card">
          <h4>Server</h4>
          <div class="dt-grid" id="dt-server"></div>
        </section>
        <section class="dt-card">
          <h4>Gameplay</h4>
          <div class="dt-grid" id="dt-gameplay"></div>
        </section>
        <section class="dt-card">
          <h4>Settings</h4>
          <div class="dt-toggle-list" id="dt-settings"></div>
        </section>
        <section class="dt-card">
          <h4>Performance</h4>
          <div class="dt-grid" id="dt-perf"></div>
        </section>
        <section class="dt-card">
          <h4>Event Log</h4>
          <div class="dt-log" id="dt-log"></div>
        </section>
      </div>
    </aside>
  `;
  document.body.appendChild(root);
  return root;
}

function assignRefs(root) {
  refs.root = root;
  refs.panel = root.querySelector('#phage-devtools-panel');
  refs.status = root.querySelector('#dt-status-pill');
  refs.summary = root.querySelector('#dt-summary-line');
  refs.profilerPill = root.querySelector('#dt-profiler-pill');
  refs.profilerState = root.querySelector('#dt-profiler-state');
  refs.clientChart = root.querySelector('#dt-client-chart');
  refs.serverChart = root.querySelector('#dt-server-chart');
  refs.deltaGrid = root.querySelector('#dt-delta-grid');
  refs.log = root.querySelector('#dt-log');
  refs.runtime = root.querySelector('#dt-runtime');
  refs.network = root.querySelector('#dt-network');
  refs.server = root.querySelector('#dt-server');
  refs.gameplay = root.querySelector('#dt-gameplay');
  refs.settings = root.querySelector('#dt-settings');
  refs.perf = root.querySelector('#dt-perf');
}

function bindUIEvents(root) {
  root.querySelector('#phage-devtools-toggle').addEventListener('click', () => toggle());
  root.addEventListener('click', e => {
    const btn = e.target.closest?.('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    if (action === 'hide') toggle(false);
    if (action === 'reload') window.location.reload();
    if (action === 'copy') copySnapshot();
    if (action === 'reconnect') reconnectSocket();
    if (action === 'respawn') refs.game?.respawn?.();
    if (action === 'profile') toggleProfiler();
  });
}

function ensureUI() {
  if (initialized) return;
  ensureStyles();

  const root = buildDOM();
  assignRefs(root);
  bindUIEvents(root);

  visible = LS.get('devtools_open', false);
  setVisible(visible);
  initialized = true;
}

function bindHotkeys() {
  if (bound) return;
  bound = true;
  window.addEventListener('keydown', e => {
    if (e.code === 'F2') {
      e.preventDefault();
      toggle();
    }
    if (e.code === 'Escape' && visible) {
      toggle(false);
    }
  });

  window.addEventListener('error', e => {
    const msg = e?.message || 'window error';
    pushLog('error', msg, `${e.filename || ''}:${e.lineno || 0}:${e.colno || 0}`);
  });

  window.addEventListener('unhandledrejection', e => {
    const msg = e?.reason?.message || String(e?.reason || 'unhandled rejection');
    pushLog('error', msg);
  });
}

function renderRows(target, rows) {
  if (!target) return;
  target.innerHTML = rows.map(([label, value]) => `
    <div class="dt-row">
      <span class="dt-label">${label}</span>
      <span class="dt-value">${value}</span>
    </div>
  `).join('');
}

function renderSettings() {
  if (!refs.settings || !refs.MetaSystem) return;
  const settings = refs.MetaSystem.getData().settings || {};
  const items = [
    ['glowLayer', 'Glow', 'Light child on player blobs'],
    ['gridLayer', 'Grid', 'Arena grid lines'],
    ['particles', 'Particles', 'Spawned visual effects'],
    ['nameTags', 'Nametags', 'Player labels above blobs'],
    ['mouseSteer', 'Mouse', 'Mouse steering input'],
  ];

  refs.settings.innerHTML = items.map(([key, label, desc]) => `
    <button class="dt-toggle ${settings[key] ? 'active' : ''}" data-setting="${key}">
      <div>
        <strong>${label}</strong>
        <span>${desc}</span>
      </div>
      <div class="dt-pill">${settings[key] ? 'ON' : 'OFF'}</div>
    </button>
  `).join('') + `
    <button class="dt-toggle ${AppState.perfProfile === 'LOW' ? 'active' : ''}" data-perf="LOW">
      <div>
        <strong>Perf: Low</strong>
        <span>Reduce visual load aggressively</span>
      </div>
      <div class="dt-pill">LOW</div>
    </button>
    <button class="dt-toggle ${AppState.perfProfile === 'MEDIUM' ? 'active' : ''}" data-perf="MEDIUM">
      <div>
        <strong>Perf: Medium</strong>
        <span>Balanced profile for most machines</span>
      </div>
      <div class="dt-pill">MED</div>
    </button>
    <button class="dt-toggle ${AppState.perfProfile === 'HIGH' ? 'active' : ''}" data-perf="HIGH">
      <div>
        <strong>Perf: High</strong>
        <span>Full fidelity, highest cost</span>
      </div>
      <div class="dt-pill">HI</div>
    </button>
  `;

  refs.settings.querySelectorAll('[data-setting]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-setting');
      const next = !refs.MetaSystem.getSetting(key);
      applySetting(key, next);
    });
  });

  refs.settings.querySelectorAll('[data-perf]').forEach(btn => {
    btn.addEventListener('click', () => {
      setPerfProfile(btn.getAttribute('data-perf'));
    });
  });
}

function applySetting(key, value) {
  if (!refs.MetaSystem) return;
  refs.MetaSystem.setSetting(key, value);
  refs.game?.applyRuntimeSettings?.();
  pushLog('success', `${key} set to ${value ? 'on' : 'off'}`);
}

function setPerfProfile(profile) {
  const next = profile || 'MEDIUM';
  AppState.perfProfile = next;
  LS.set(PERF_OVERRIDE_KEY, next);
  pushLog('success', `perf profile set to ${next}`);
  renderSettings();
  update(true);
}

function reconnectSocket() {
  if (!refs.game) return;
  pushLog('warn', 'reconnecting socket');
  try {
    AppState.socket?.disconnect?.();
  } catch {}
  AppState.socket = null;
  refs.game.connectSocket?.();
}

async function copySnapshot() {
  const snapshot = JSON.stringify(getSnapshot(), null, 2);
  try {
    await navigator.clipboard.writeText(snapshot);
    pushLog('success', 'snapshot copied to clipboard');
  } catch {
    pushLog('warn', 'clipboard copy failed');
  }
}

function getSnapshot() {
  const counts = getCounts();
  const meta = refs.MetaSystem?.getData?.() || {};
  const socket = AppState.socket;
  const fps = Number(document.getElementById('fpsCount')?.textContent || 0);

  return {
    time: new Date().toISOString(),
    fps,
    game: {
      active: AppState.gameActive,
      starting: AppState.gameStarting,
      spectating: AppState.spectating,
      mode: AppState.selectedMode,
      ability: AppState.selectedAbility,
      perfProfile: AppState.perfProfile,
      arenaSize: AppState.arenaSize
    },
    player: {
      id: AppState.myId,
      name: AppState.myName,
      color: AppState.myColor,
      mass: Math.floor(counts.myMass),
      blobs: counts.myBlobs,
      peakMass: AppState.myStats?.peakMass || 0,
      sessionKills: AppState.myStats?.sessionKills || 0
    },
    network: {
      connected: !!socket?.connected,
      id: socket?.id || null,
      pendingInputs: AppState.pendingInputs?.length || 0,
      clientSeq: AppState.clientSeq,
      lastProcessedSeq: AppState.lastProcessedSeq,
      packetRate: Number(getPacketRate().toFixed(2)),
      stateGapMs: AppState.lastPingTime ? Date.now() - AppState.lastPingTime : null
    },
    server: AppState.serverStats || null,
    counts: {
      alivePlayers: counts.alivePlayers,
      blobs: counts.blobCount,
      foods: counts.foodCount,
      viruses: counts.virusCount,
      decoys: counts.decoyCount,
      entities: counts.totalEntities
    },
    meta: {
      totalXP: meta.totalXP,
      level: meta.level,
      totalGames: meta.totalGames,
      totalKills: meta.totalKills
    }
  };
}

function updateRuntimePanel(snapshot, frameTime, drawCalls, triangles, mem) {
  renderRows(refs.runtime, [
    ['FPS', fmtInt(snapshot?.fps || 0)],
    ['Frame', `${frameTime.toFixed(1)}ms`],
    ['Draw Calls', fmtInt(drawCalls)],
    ['Triangles', fmtInt(triangles)],
    ['Heap', mem],
    ['Device', getDeviceSummary()],
  ]);
}

function updateNetworkPanel(socket, stateGap, packetRate) {
  renderRows(refs.network, [
    ['Socket', socket?.connected ? 'CONNECTED' : 'DISCONNECTED'],
    ['Socket ID', socket?.id || '-'],
    ['State Gap', fmtMs(stateGap)],
    ['Packet Rate', `${packetRate.toFixed(1)} Hz`],
    ['Pending Inputs', fmtInt(AppState.pendingInputs?.length || 0)],
    ['Seq', `${AppState.clientSeq} / ${AppState.lastProcessedSeq}`],
  ]);
}

function updateServerPanel() {
  const server = AppState.serverStats;
  renderRows(refs.server, server ? [
    ['Clients', fmtInt(server.clients || 0)],
    ['Uptime', fmtMs(server.uptimeMs || 0)],
    ['Tick', fmtMs(server.tickMs || 0)],
    ['Players', fmtInt(server.totals?.players || 0)],
    ['Bots', fmtInt(server.totals?.bots || 0)],
    ['Memory', server.memory ? `${fmtBytes(server.memory.heapUsed)} / ${fmtBytes(server.memory.heapTotal)}` : 'n/a'],
  ] : [
    ['Clients', '-'],
    ['Uptime', '-'],
    ['Tick', '-'],
    ['Players', '-'],
    ['Bots', '-'],
    ['Memory', '-'],
  ]);
}

function updateGameplayPanel(counts) {
  renderRows(refs.gameplay, [
    ['Mode', AppState.selectedMode || '-'],
    ['Ability', AppState.selectedAbility || '-'],
    ['My Mass', fmtInt(counts.myMass)],
    ['My Blobs', fmtInt(counts.myBlobs)],
    ['Peak Mass', fmtInt(AppState.myStats?.peakMass || 0)],
    ['Kills', fmtInt(AppState.myStats?.sessionKills || 0)],
    ['Players', fmtInt(counts.alivePlayers)],
    ['Entities', fmtInt(counts.totalEntities)],
  ]);
}

function updatePerfPanel() {
  renderRows(refs.perf, [
    ['Profile', AppState.perfProfile || '-'],
    ['Particles', refs.ParticleSystem?.getStats?.()?.active ? `${fmtInt(refs.ParticleSystem.getStats().active)} active` : 'off / idle'],
    ['Arena', fmtInt(AppState.arenaSize || 0)],
    ['My ID', AppState.myId || '-'],
    ['Name', AppState.myName || '-'],
    ['Color', AppState.myColor || '-'],
  ]);
}

function updateHeaderLabels(snapshot, counts, socket, stateGap, packetRate, frameTime, drawCalls, triangles, mem) {
  if (refs.status) {
    refs.status.textContent = `${socket?.connected ? 'online' : 'offline'} | ${counts.alivePlayers} phages | ${packetRate.toFixed(1)} Hz`;
  }
  if (refs.summary) {
    refs.summary.textContent = `${counts.totalEntities} entities | ${counts.blobCount} blobs | ${counts.foodCount} food`;
  }
  if (refs.packetRate) refs.packetRate.textContent = `${packetRate.toFixed(1)} Hz`;
  if (refs.stateGap) refs.stateGap.textContent = fmtMs(stateGap);
  if (refs.myMass) refs.myMass.textContent = fmtInt(counts.myMass);
  if (refs.myBlobs) refs.myBlobs.textContent = fmtInt(counts.myBlobs);
  if (refs.entityCounts) refs.entityCounts.textContent = `${counts.totalEntities} total`;
  if (refs.sessionKills) refs.sessionKills.textContent = fmtInt(AppState.myStats?.sessionKills || 0);
  if (refs.peakMass) refs.peakMass.textContent = fmtInt(AppState.myStats?.peakMass || 0);
  if (refs.playerCount) refs.playerCount.textContent = fmtInt(counts.alivePlayers);
  if (refs.socketState) refs.socketState.textContent = socket?.connected ? 'connected' : 'disconnected';
  if (refs.socketId) refs.socketId.textContent = socket?.id || '-';
  if (refs.worldStateAge) refs.worldStateAge.textContent = fmtMs(stateGap);
  if (refs.pendingInputs) refs.pendingInputs.textContent = fmtInt(AppState.pendingInputs?.length || 0);
  if (refs.clientSeq) refs.clientSeq.textContent = fmtInt(AppState.clientSeq);
  if (refs.processedSeq) refs.processedSeq.textContent = fmtInt(AppState.lastProcessedSeq);
  if (refs.frameTime) refs.frameTime.textContent = `${frameTime.toFixed(1)}ms`;
  if (refs.fps) refs.fps.textContent = snapshot?.fps ? fmtInt(snapshot.fps) : refs.fps?.textContent || '0';
  if (refs.triangles) refs.triangles.textContent = fmtInt(triangles);
  if (refs.drawCalls) refs.drawCalls.textContent = fmtInt(drawCalls);
  if (refs.heap) refs.heap.textContent = mem;
  if (refs.device) refs.device.textContent = getDeviceSummary();
  if (refs.perfProfile) refs.perfProfile.textContent = AppState.perfProfile || '-';
  const tickRate = document.getElementById('tick-rate');
  if (tickRate) tickRate.textContent = `${packetRate.toFixed(1)}Hz`;
}

function updateSummary(snapshot, dt) {
  if (!refs.summary) return;
  const counts = getCounts();
  const socket = AppState.socket;
  const stateGap = AppState.lastPingTime ? Date.now() - AppState.lastPingTime : 0;
  const packetRate = getPacketRate();
  const frameTime = dt ? dt * 1000 : 0;
  const stats = AppState.app?.stats;
  const drawCalls = stats ? (stats.drawCalls?.total ?? stats.drawCalls ?? 0) : 0;
  const triangles = stats?.frame?.triangles ?? 0;
  const mem = performance.memory ? `${fmtBytes(performance.memory.usedJSHeapSize)} / ${fmtBytes(performance.memory.jsHeapSizeLimit)}` : 'n/a';

  updateRuntimePanel(snapshot, frameTime, drawCalls, triangles, mem);
  updateNetworkPanel(socket, stateGap, packetRate);
  updateServerPanel();
  updateGameplayPanel(counts);
  updatePerfPanel();
  updateHeaderLabels(snapshot, counts, socket, stateGap, packetRate, frameTime, drawCalls, triangles, mem);
}

function update(force = false) {
  if (!initialized) return;
  if (!force && !visible && !profilerMode) return;
  const dt = AppState._lastDt || 0;
  const sampleInterval = visible
    ? (profilerMode ? SAMPLE_INTERVAL_VISIBLE : SAMPLE_INTERVAL_HIDDEN)
    : SAMPLE_INTERVAL_HIDDEN;
  sampleAccum += dt;
  while (sampleAccum >= sampleInterval / 1000) {
    captureSample(sampleInterval / 1000);
    latestSample = samples[samples.length - 1] || latestSample;
    sampleAccum -= sampleInterval / 1000;
  }

  renderAccum += dt * 1000;
  profilerRenderAccum += dt * 1000;

  if (!force && !visible) return;
  if (!force && renderAccum < UPDATE_INTERVAL && profilerRenderAccum < PROFILER_RENDER_INTERVAL) return;

  if (force || renderAccum >= UPDATE_INTERVAL) {
    renderAccum = 0;
    updateSummary(getSnapshot(), dt);
  }

  if (force || profilerRenderAccum >= PROFILER_RENDER_INTERVAL) {
    profilerRenderAccum = 0;
    renderProfiler(latestSample);
  }
}

export const DevTools = {
  init({ game, MetaSystem, HudSystem, ParticleSystem }) {
    refs.game = game;
    refs.MetaSystem = MetaSystem;
    refs.HudSystem = HudSystem;
    refs.ParticleSystem = ParticleSystem;
    ensureUI();
    bindHotkeys();
    renderSettings();

  const override = LS.get(PERF_OVERRIDE_KEY, '');
  if (override && ['LOW', 'MEDIUM', 'HIGH'].includes(override)) {
    AppState.perfProfile = override;
  }

  const profilerOverride = LS.get(PROFILER_STORAGE_KEY, true);
  setProfilerMode(profilerOverride !== false);

  pushLog('success', 'dev tools ready', 'F2 to toggle');
  update(true);
  },

  toggle(force) {
    if (typeof force === 'boolean') setVisible(force);
    else setVisible(!visible);
    if (visible) {
      renderSettings();
      update(true);
    }
  },

  show() { this.toggle(true); },
  hide() { this.toggle(false); },

  recordSocket(event, detail = '') {
    if (event === 'world_state') {
      packetTimes.push(Date.now());
      const now = Date.now();
      if (now - lastPacketLogAt > 1000) {
        lastPacketLogAt = now;
        pushLog('info', event, detail);
      }
      return;
    }
    pushLog(event === 'connect_error' || event === 'disconnect' ? 'warn' : 'info', event, detail);
  },

  record(type, message, meta = '') {
    pushLog(type, message, meta);
  },

  update(dt) {
    AppState._lastDt = dt;
    if (!initialized) return;
    if (!visible && !profilerMode) return;
    update(false);
  },

  setSetting: applySetting,
  setPerfProfile,
  getSnapshot,
  copySnapshot,
  reconnectSocket,
  toggleProfiler,
  setProfilerMode,
  isVisible: () => visible
};
