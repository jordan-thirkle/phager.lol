window.InputSystem = (() => {
  function init(AppState) {
    window.addEventListener('mousemove', e => { 
      AppState.input.dx = (e.clientX / window.innerWidth) * 2 - 1; 
      AppState.input.dz = (e.clientY / window.innerHeight) * 2 - 1; 
    });
    window.addEventListener('keydown', e => {
      if (!AppState.gameActive) return;
      const c = e.code;
      if (c === 'KeyW' || c === 'ArrowUp') AppState.input.w = 1;
      if (c === 'KeyS' || c === 'ArrowDown') AppState.input.s = 1;
      if (c === 'KeyA' || c === 'ArrowLeft') AppState.input.a = 1;
      if (c === 'KeyD' || c === 'ArrowRight') AppState.input.d = 1;
      if (c === 'KeyQ') { e.preventDefault(); AppState.input.ability = true; }
      if (c === 'Space') { e.preventDefault(); AppState.input.split = true; }
      if (c === 'ShiftLeft' || c === 'ShiftRight') { Audio.resume(); Audio.boost(); AppState.input.boost = true; }
    });
    window.addEventListener('keyup', e => {
      const c = e.code;
      if (c === 'KeyW' || c === 'ArrowUp') AppState.input.w = 0;
      if (c === 'KeyS' || c === 'ArrowDown') AppState.input.s = 0;
      if (c === 'KeyA' || c === 'ArrowLeft') AppState.input.a = 0;
      if (c === 'KeyD' || c === 'ArrowRight') AppState.input.d = 0;
    });
  }

  function getDirection(AppState) {
    let finalDX = AppState.input.dx, finalDZ = AppState.input.dz;
    if (AppState.input.w || AppState.input.a || AppState.input.s || AppState.input.d) {
      finalDX = AppState.input.d - AppState.input.a;
      finalDZ = AppState.input.s - AppState.input.w;
      const len = Math.hypot(finalDX, finalDZ) || 1;
      finalDX /= len; finalDZ /= len;
    }
    return { dx: finalDX, dz: finalDZ };
  }

  return { init, getDirection };
})();
