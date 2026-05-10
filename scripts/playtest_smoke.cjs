const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const opts = {
  mode: 'ffa',
  name: 'SMOKE',
  baseUrl: 'http://127.0.0.1:3001',
  chromePath: process.env.CHROME_PATH || (os.platform() === 'linux' ? '/usr/bin/google-chrome' : 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'),
  port: 9224,
  screenshot: true,
  openDevtools: false,
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  const next = args[i + 1];
  if (arg === '--mode' && next) opts.mode = next;
  if (arg === '--name' && next) opts.name = next;
  if (arg === '--base-url' && next) opts.baseUrl = next;
  if (arg === '--chrome-path' && next) opts.chromePath = next;
  if (arg === '--port' && next) opts.port = Number(next);
  if (arg === '--no-screenshot') opts.screenshot = false;
  if (arg === '--open-devtools') opts.openDevtools = true;
}

const delay = ms => new Promise(r => setTimeout(r, ms));

function normalizeMode(mode) {
  const value = String(mode || 'ffa').toLowerCase();
  if (value === 'teams' || value === 'team') return 'team';
  if (value === 'br' || value === 'battle' || value === 'battle-royale') return 'br';
  return 'ffa';
}

async function waitForBrowser(port) {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return await res.json();
    } catch {}
    await delay(250);
  }
  throw new Error(`Chrome did not expose a DevTools endpoint on port ${port}`);
}

async function connectToPage(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const entry = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) entry.reject(new Error(msg.error.message || 'CDP error'));
      else entry.resolve(msg.result);
      return;
    }

    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = (msg.params.args || []).map(a => a.value ?? a.description ?? '').join(' ');
      events.push({ kind: 'console', level: msg.params.type, text });
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      events.push({ kind: 'exception', text: msg.params.exceptionDetails.text || 'exception' });
    }
    if (msg.method === 'Log.entryAdded') {
      events.push({ kind: 'log', level: msg.params.entry.level, text: msg.params.entry.text });
    }
  };

  const send = (method, params = {}) => {
    const msgId = ++id;
    ws.send(JSON.stringify({ id: msgId, method, params }));
    return new Promise((resolve, reject) => pending.set(msgId, { resolve, reject }));
  };

  const evalExpr = async (expression, awaitPromise = false) => {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise,
      userGesture: true,
    });
    return res.result ? res.result.value : undefined;
  };

  return { ws, send, evalExpr, events };
}

async function run() {
  const mode = normalizeMode(opts.mode);
  let events = [];
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phage-smoke-'));
  const browserArgs = [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${opts.port}`,
    `--user-data-dir=${profileDir}`,
    opts.baseUrl,
  ];

  const chrome = spawn(opts.chromePath, browserArgs, { stdio: 'ignore' });
  let browserClosed = false;
  const cleanup = () => {
    if (browserClosed) return;
    browserClosed = true;
    try { chrome.kill('SIGTERM'); } catch {}
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  process.on('SIGTERM', () => { cleanup(); process.exit(143); });

  try {
    const version = await waitForBrowser(opts.port);
    let page = null;
    for (let i = 0; i < 40; i++) {
      const list = await fetch(`http://127.0.0.1:${opts.port}/json/list`).then(r => r.json());
      page = list.find(t => t.type === 'page');
      if (page) break;
      await delay(250);
    }
    if (!page) throw new Error('No game page target found');

    const connectedPage = await connectToPage(page.webSocketDebuggerUrl);
    const { ws, send, evalExpr } = connectedPage;
    events = connectedPage.events;

    await send('Runtime.enable');
    await send('Log.enable');
    await send('Page.enable');
    await send('Page.navigate', { url: opts.baseUrl });

    // wait for the page to settle
    for (let i = 0; i < 80; i++) {
      const ready = await evalExpr('document.readyState');
      if (ready === 'complete') break;
      await delay(250);
    }

    for (let i = 0; i < 80; i++) {
      const apiReady = await evalExpr('!!window.startGame && !!window.selectMode && !!window.AppState');
      if (apiReady) break;
      await delay(250);
    }

    for (let i = 0; i < 160; i++) {
      const connected = await evalExpr('!!window.AppState?.socket && window.AppState.socket.connected');
      if (connected) break;
      await delay(250);
    }
    const connected = await evalExpr('!!window.AppState?.socket && window.AppState.socket.connected');
    if (!connected) throw new Error('Socket did not connect before starting the game');

    await evalExpr(`(() => {
      const input = document.getElementById('nameInput');
      if (input) input.value = ${JSON.stringify(opts.name)};
      if (window.selectMode) window.selectMode(${JSON.stringify(mode)});
      if (window.startGame) { console.log('SMOKE: Starting game...'); window.startGame(); } else { console.log('SMOKE: startGame not found'); }
    })()`);

    let started = false;
    for (let i = 0; i < 140; i++) {
      started = await evalExpr('!!window.AppState && window.AppState.gameActive || document.getElementById("hud")?.style.display === "grid"');
      if (started) break;
      await delay(250);
    }
    if (!started) throw new Error(`Game did not become active for mode ${mode}`);

    if (opts.openDevtools) {
      await evalExpr(`(() => {
        if (window.DevTools) {
          window.DevTools.show();
          window.DevTools.setProfilerMode(true);
        }
      })()`);
      await delay(1500);
    }

    await delay(2500);

    const snapshot = await evalExpr(`(() => ({
      mode: window.AppState && window.AppState.selectedMode || null,
      gameActive: !!window.AppState && window.AppState.gameActive,
      socketConnected: !!window.AppState?.socket && window.AppState.socket.connected,
      myId: window.AppState && window.AppState.myId || null,
      players: window.AppState && window.AppState.gameState && window.AppState.gameState.players?.length || 0,
      serverStats: window.AppState && window.AppState.serverStats || null,
      hudVisible: document.getElementById('hud')?.style.display || null,
      fps: Number(document.getElementById('fpsCount')?.textContent || 0),
      ping: Number(document.getElementById('pingCount')?.textContent || 0),
      devOpen: document.getElementById('phage-devtools-root')?.classList.contains('is-open') || false,
      profiler: document.getElementById('dt-profiler-state')?.textContent || null
    }))()`);

    if (!snapshot.socketConnected) throw new Error(`Socket disconnected during ${mode} smoke`);
    if (snapshot.mode !== mode) throw new Error(`Selected mode mismatch: expected ${mode}, got ${snapshot.mode}`);
    if (!snapshot.serverStats) throw new Error('No server telemetry received');
    if (!snapshot.players) throw new Error('No players were visible after start');

    let shotPath = null;
    if (opts.screenshot) {
      const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
      shotPath = path.join(process.cwd(), 'logs', `smoke-${mode}.png`);
      fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    }

    console.log(JSON.stringify({
      mode,
      snapshot,
      screenshot: shotPath,
      recentEvents: events.slice(-20)
    }, null, 2));

    await send('Browser.close').catch(() => {});
    ws.close();
    cleanup();
  } catch (err) {
    cleanup();
    console.error(err.stack || err.message || String(err));
    if (events.length) console.error(JSON.stringify(events.slice(-40), null, 2));
    process.exit(1);
  }
}

run();
