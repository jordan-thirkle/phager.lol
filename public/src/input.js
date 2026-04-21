window.InputSystem = (() => {
  const InputState = {
    dx: 0, dz: 0,
    split: false,
    boost: false,
    ability: false,
    spectateNext: false,
    _splitHeld: false,
    _boostHeld: false,
    _abilityHeld: false,
    _nextHeld: false,
    _touchActive: false
  };
  let keys = {};

  let joystick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
  let touchBtns = {};

  function init(AppState) {
    reinitBindings();
    if ('ontouchstart' in window) initTouch();

    window.addEventListener('keydown', e => { 
      keys[e.code] = true;
      if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    window.addEventListener('blur', () => { keys = {}; });

    window.addEventListener('mousemove', e => {
      if (!AppState.gameActive || InputState._touchActive) return;
      const meta = window.MetaSystem;
      if (meta && !meta.getSetting('mouseSteer')) return;

      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      let dx = e.clientX - centerX;
      let dz = e.clientY - centerY;
      const dist = Math.hypot(dx, dz);
      if (dist > 20) {
        dx /= dist; dz /= dist;
        InputState.dx = dx;
        InputState.dz = dz;
      } else {
        InputState.dx = 0; InputState.dz = 0;
      }
    });

    // Gamepad support
    setInterval(updateGamepad, 16);
  }

  function reinitBindings() {
    const meta = window.MetaSystem;
    if (meta) {
      keybinds = meta.getSetting('keybinds') || keybinds;
    }
  }

  function updateGamepad() {
    const pads = navigator.getGamepads();
    const gp = pads[0];
    if (!gp) return;

    // Left Stick
    const lx = gp.axes[0], lz = gp.axes[1];
    if (Math.hypot(lx, lz) > 0.15) {
      InputState.dx = lx;
      InputState.dz = lz;
    }

    // Buttons (0: Cross/A, 1: Circle/B, 2: Square/X, 3: Triangle/Y)
    if (gp.buttons[0].pressed) keys[keybinds.split] = true;
    if (gp.buttons[1].pressed) keys[keybinds.boost] = true;
    if (gp.buttons[2].pressed) keys[keybinds.ability] = true;
  }

  function update(dt) {
    // WASD / Arrows
    let kx = 0, kz = 0;
    if (keys['KeyW'] || keys['ArrowUp']) kz -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) kz += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) kx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) kx += 1;

    if (kx !== 0 || kz !== 0) {
      const len = Math.hypot(kx, kz);
      InputState.dx = kx / len;
      InputState.dz = kz / len;
    }

    // Joystick override
    if (joystick.active) {
      const dx = joystick.x - joystick.ox;
      const dy = joystick.y - joystick.oy;
      const dist = Math.hypot(dx, dy);
      if (dist > 12) {
        InputState.dx = dx / Math.max(dist, 90);
        InputState.dz = dy / Math.max(dist, 90);
      } else {
        InputState.dx = 0; InputState.dz = 0;
      }
      const jInner = document.getElementById('joystick-inner');
      if (jInner) {
          jInner.style.left = `calc(50% + ${dx}px)`;
          jInner.style.top = `calc(50% + ${dy}px)`;
      }
    }

    // Edge triggers
    const splitDown = keys[keybinds.split] || touchBtns.split;
    InputState.split = splitDown && !InputState._splitHeld;
    InputState._splitHeld = splitDown;

    const boostDown = keys[keybinds.boost] || touchBtns.boost;
    InputState.boost = boostDown && !InputState._boostHeld;
    InputState._boostHeld = boostDown;

    const abilityDown = keys[keybinds.ability] || touchBtns.ability;
    InputState.ability = abilityDown && !InputState._abilityHeld;
    InputState._abilityHeld = abilityDown;

    const nextDown = keys['Tab'] || touchBtns.next;
    InputState.spectateNext = nextDown && !InputState._nextHeld;
    InputState._nextHeld = nextDown;
    
    // Reset touch buttons for edge triggering
    touchBtns.split = false;
    touchBtns.boost = false;
    touchBtns.ability = false;
    touchBtns.next = false;
  }

  function initTouch() {
    const overlay = document.getElementById('touch-overlay');
    overlay.style.display = 'block';
    overlay.innerHTML = `
      <div id="joystick-outer"><div id="joystick-inner"></div></div>
      <div id="touch-split" class="touch-btn">SPLIT</div>
      <div id="touch-boost" class="touch-btn">BOOST</div>
      <div id="touch-ability" class="touch-btn">ABILITY</div>
    `;

    window.addEventListener('touchstart', e => {
      InputState._touchActive = true;
      for (const t of e.changedTouches) {
        const x = t.clientX, y = t.clientY;
        if (x < window.innerWidth * 0.6 && !joystick.active) {
            joystick.active = true; joystick.id = t.identifier;
            const rect = document.getElementById('joystick-outer').getBoundingClientRect();
            joystick.ox = rect.left + rect.width / 2;
            joystick.oy = rect.top + rect.height / 2;
            joystick.x = x; joystick.y = y;
        } else {
            const el = document.elementFromPoint(x, y);
            if (el && el.id === 'touch-split') touchBtns.split = true;
            if (el && el.id === 'touch-boost') touchBtns.boost = true;
            if (el && el.id === 'touch-ability') touchBtns.ability = true;
        }
      }
    }, { passive: false });

    window.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === joystick.id) {
          joystick.x = t.clientX; joystick.y = t.clientY;
        }
      }
    }, { passive: false });

    window.addEventListener('touchend', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === joystick.id) {
          joystick.active = false; joystick.id = null;
          InputState.dx = 0; InputState.dz = 0;
          const jInner = document.getElementById('joystick-inner');
          if (jInner) { jInner.style.left = '50%'; jInner.style.top = '50%'; }
        }
      }
      if (e.touches.length === 0) InputState._touchActive = false;
    });
  }

  return { init, update, reinitBindings, InputState };
})();
