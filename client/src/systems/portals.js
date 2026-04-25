import { BLEND_ADDITIVE, Color, Entity, StandardMaterial } from 'playcanvas';

// ─── PHAGE.LOL Vibe Jam Portal System ───
let portal = null;
let inner = null;

export const PortalSystem = {
    init(config) {
        const { scene, exitPosition } = config;
        
        portal = new Entity('VibeJamExitPortal');
        portal.addComponent('model', { type: 'cylinder' });
        portal.setLocalScale(40, 5, 40);
        portal.setLocalEulerAngles(90, 0, 0);
        portal.setPosition(exitPosition.x, exitPosition.y, exitPosition.z);
        
        const mat = new StandardMaterial();
        mat.emissive = new Color(0, 1, 1);
        mat.emissiveIntensity = 5;
        mat.opacity = 0.6;
        mat.blendType = BLEND_ADDITIVE;
        mat.update();
        portal.model.meshInstances[0].material = mat;
        
        inner = new Entity('VibeJamVortex');
        inner.addComponent('model', { type: 'sphere' });
        inner.setLocalScale(30, 30, 1);
        inner.setLocalEulerAngles(90, 0, 0);
        const imat = new StandardMaterial();
        imat.emissive = new Color(0, 0.5, 1);
        imat.emissiveIntensity = 8;
        imat.update();
        inner.model.meshInstances[0].material = imat;
        portal.addChild(inner);
        
        scene.addChild(portal);
    },

    update(dt, config) {
        if (!portal || !inner) return;
        const { getPlayer, onExit } = config;

        portal.rotate(0, 100 * dt, 0);
        inner.rotate(0, -200 * dt, 0);
        
        const playerEnt = getPlayer();
        if (playerEnt && playerEnt.getPosition) {
            const dist = portal.getPosition().distance(playerEnt.getPosition());
            if (dist < 40) {
                if (onExit) onExit();
            }
        }
    }
};
