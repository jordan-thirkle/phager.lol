// ─── PHAGE.LOL Input System ───
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
let mouseDir = { dx: 0, dz: 0 };
let keybinds = { split: 'Space', boost: 'ShiftLeft', ability: 'KeyQ' };

function initTouch() {
  const overlay = document.getElementById('touch-overlay');
  if (!overlay) return;
  overlay.style.display = 'block';
  overlay.innerHTML = `
    <div id="joystick-base"><div id="joystick-knob"></div></div>
    <div id="touch-split" class="touch-btn">SPLIT</div>
    <div id="touch-boost" class="touch-btn">BOOST</div>
    <div id="touch-ability" class="touch-btn">ABILITY</div>
  `;

  window.addEventListener('touchstart', e => {
    InputState._touchActive = true;
    for (const t of e.changedTouches) {
      const x = t.clientX, y = t.clientY;
      if (x < window.innerWidth * 0.5 && !joystick.active) {
          joystick.active = true; joystick.id = t.identifier;
          joystick.ox = x; joystick.oy = y;
          joystick.x = x; joystick.y = y;
          const jBase = document.getElementById('joystick-base');
          if (jBase) {
              jBase.style.display = 'block';
              jBase.style.left = `${x - 50}px`;
              jBase.style.top = `${y - 50}px`;
          }
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
        const jBase = document.getElementById('joystick-base');
        if (jBase) jBase.style.display = 'none';
        const jKnob = document.getElementById('joystick-knob');
        if (jKnob) { 
          jKnob.style.left = '30px'; 
          jKnob.style.top = '30px';
          jKnob.style.transform = 'scale(1)';
        }
      }
    }
    if (e.touches.length === 0) InputState._touchActive = false;
  });
}

export const InputSystem = {
  InputState,

  init(AppState, MetaSystem) {
    this.reinitBindings(MetaSystem);
    if ('ontouchstart' in window) initTouch();

    window.addEventListener('keydown', e => { 
      keys[e.code] = true;
      if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    window.addEventListener('blur', () => { keys = {}; });

    window.addEventListener('mousemove', e => {
      if (!AppState.gameActive || InputState._touchActive) return;
      if (MetaSystem && !MetaSystem.getSetting('mouseSteer')) {
          mouseDir = { dx: 0, dz: 0 };
          return;
      }

      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      let dx = e.clientX - centerX;
      let dz = e.clientY - centerY;
      const dist = Math.hypot(dx, dz);
      if (dist > 20) {
        mouseDir.dx = dx / dist;
        mouseDir.dz = dz / dist;
      } else {
        mouseDir.dx = 0; mouseDir.dz = 0;
      }
    });
  },

  reinitBindings(MetaSystem) {
    if (MetaSystem) {
      keybinds = MetaSystem.getSetting('keybinds') || keybinds;
    }
  },

  update(dt) {
    let finalDX = 0, finalDZ = 0;

    let kx = 0, kz = 0;
    if (keys['KeyW'] || keys['ArrowUp']) kz -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) kz += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) kx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) kx += 1;

    if (kx !== 0 || kz !== 0) {
      const len = Math.hypot(kx, kz);
      finalDX = kx / len;
      finalDZ = kz / len;
    } else {
        const pads = navigator.getGamepads();
        const gp = pads[0];
        if (gp && Math.hypot(gp.axes[0], gp.axes[1]) > 0.15) {
            finalDX = gp.axes[0];
            finalDZ = gp.axes[1];
        } else if (joystick.active) {
            const dx = joystick.x - joystick.ox;
            const dy = joystick.y - joystick.oy;
            const dist = Math.hypot(dx, dy);
            if (dist > 12) {
                finalDX = dx / Math.max(dist, 90);
                finalDZ = dy / Math.max(dist, 90);
                const jKnob = document.getElementById('joystick-knob');
                if (jKnob) {
                    const moveX = (dx / dist) * Math.min(dist, 40);
                    const moveY = (dy / dist) * Math.min(dist, 40);
                    jKnob.style.left = `${30 + moveX}px`;
                    jKnob.style.top = `${30 + moveY}px`;
                    
                    // Liquid distortion: stretch in movement direction
                    const stretch = 1 + (dist / 100) * 0.3;
                    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                    jKnob.style.transform = `rotate(${angle}deg) scaleX(${stretch})`;
                }
            }
        } else if (!InputState._touchActive) {
            finalDX = mouseDir.dx;
            finalDZ = mouseDir.dz;
        }
    }

    InputState.dx = finalDX;
    InputState.dz = finalDZ;

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
    
    touchBtns.split = false;
    touchBtns.boost = false;
    touchBtns.ability = false;
    touchBtns.next = false;
  }
};
