window.CameraSystem = (() => {
  let orbitAngle = 0;

  function update(AppState, dt) {
    if (AppState.spectating) {
      updateSpectator(AppState, dt);
      return;
    }
    const me = AppState.gameState.players.find(p => p.id === AppState.myId);
    if (!me || !me.blobs || !me.blobs.length) return;

    let cx = 0, cz = 0, totalMass = 0;
    for (const b of me.blobs) {
      cx += b.x * b.mass;
      cz += b.z * b.mass;
      totalMass += b.mass;
    }
    cx /= totalMass; cz /= totalMass;
    
    // Zoom logic based on v2 specs: BASE_HEIGHT + Math.sqrt(totalMass) * 1.8
    const BASE_HEIGHT = 450;
    const targetH = Math.min(1800, BASE_HEIGHT + Math.sqrt(totalMass) * 1.8);
    const ls = Math.min(1, 6 * dt);
    
    AppState.cam.x += (cx - AppState.cam.x) * ls;
    AppState.cam.z += (cz - AppState.cam.z) * ls;
    AppState.cam.h += (targetH - AppState.cam.h) * (2 * dt); // 2*dt smooth zoom from GDD

    let sx = 0, sz = 0;
    if (AppState.shakeAmt > 0.5) {
      sx = (Math.random() - 0.5) * AppState.shakeAmt;
      sz = (Math.random() - 0.5) * AppState.shakeAmt;
      AppState.shakeAmt *= 0.8;
    }

    AppState.cameraEnt.setPosition(AppState.cam.x + sx, AppState.cam.h, AppState.cam.z + AppState.cam.h * 0.12 + sz);
    AppState.cameraEnt.lookAt(new pc.Vec3(AppState.cam.x, 0, AppState.cam.z));
  }

  function worldToScreen(AppState, wx, wy, wz) {
    if (!AppState.cameraEnt || !AppState.cameraEnt.camera) return null;
    const pos = new pc.Vec3(wx, wy, wz);
    const scrPos = new pc.Vec3();
    AppState.cameraEnt.camera.worldToScreen(pos, scrPos);
    if (scrPos.z < 0) return null; // Behind camera
    // Use CSS transforms approach
    return { x: scrPos.x, y: scrPos.y };
  }

  return { update, worldToScreen };
})();
