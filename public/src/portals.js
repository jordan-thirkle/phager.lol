// ─── PHAGE.LOL Vibe Jam Portal System (PlayCanvas) ───
window.initVibeJamPortals = (config) => {
    const { scene, getPlayer, spawnPoint, exitPosition, onExit } = config;
    
    // Create Portal Visuals
    const portal = new pc.Entity('VibeJamExitPortal');
    portal.addComponent('model', { type: 'cylinder' }); // Using cylinder as a base for a ring
    portal.setLocalScale(40, 5, 40);
    portal.setLocalEulerAngles(90, 0, 0);
    portal.setPosition(exitPosition.x, exitPosition.y, exitPosition.z);
    
    const mat = new pc.StandardMaterial();
    mat.emissive = new pc.Color(0, 1, 1);
    mat.emissiveIntensity = 5;
    mat.opacity = 0.6;
    mat.blendType = pc.BLEND_ADDITIVE;
    mat.update();
    portal.model.meshInstances[0].material = mat;
    
    // Inner vortex
    const inner = new pc.Entity('VibeJamVortex');
    inner.addComponent('model', { type: 'sphere' });
    inner.setLocalScale(30, 30, 1);
    inner.setLocalEulerAngles(90, 0, 0);
    const imat = new pc.StandardMaterial();
    imat.emissive = new pc.Color(0, 0.5, 1);
    imat.emissiveIntensity = 8;
    imat.update();
    inner.model.meshInstances[0].material = imat;
    portal.addChild(inner);
    
    scene.addChild(portal);
    
    window.animateVibeJamPortals = (dt) => {
        portal.rotate(0, 100 * dt, 0);
        inner.rotate(0, -200 * dt, 0);
        
        const playerEnt = getPlayer();
        if (playerEnt) {
            const dist = portal.getPosition().distance(playerEnt.getPosition());
            if (dist < 40) {
                if (onExit) onExit();
            }
        }
    };
};
