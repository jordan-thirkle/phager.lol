import { BLEND_ADDITIVE, Color, Entity, StandardMaterial } from 'playcanvas';

// ─── PHAGE.LOL Vibe Jam Portal System ───
let exitPortal = null;
let exitInner = null;

let returnPortal = null;
let returnInner = null;

export const PortalSystem = {
    init(config) {
        const { scene, exitPosition, startPosition } = config;
        
        // --- EXIT PORTAL (To Vibe Jam Webring) ---
        if (exitPosition) {
            exitPortal = new Entity('VibeJamExitPortal');
            exitPortal.addComponent('model', { type: 'cylinder' });
            exitPortal.setLocalScale(40, 5, 40);
            exitPortal.setLocalEulerAngles(90, 0, 0);
            exitPortal.setPosition(exitPosition.x, exitPosition.y, exitPosition.z);

            const mat = new StandardMaterial();
            mat.emissive = new Color(0, 1, 1);
            mat.emissiveIntensity = 5;
            mat.opacity = 0.6;
            mat.blendType = BLEND_ADDITIVE;
            mat.update();
            exitPortal.model.meshInstances[0].material = mat;

            exitInner = new Entity('VibeJamVortex');
            exitInner.addComponent('model', { type: 'sphere' });
            exitInner.setLocalScale(30, 30, 1);
            exitInner.setLocalEulerAngles(90, 0, 0);
            const imat = new StandardMaterial();
            imat.emissive = new Color(0, 0.5, 1);
            imat.emissiveIntensity = 8;
            imat.update();
            exitInner.model.meshInstances[0].material = imat;
            exitPortal.addChild(exitInner);

            scene.addChild(exitPortal);
        }

        // --- START (RETURN) PORTAL (Back to previous game) ---
        if (startPosition) {
            returnPortal = new Entity('VibeJamReturnPortal');
            returnPortal.addComponent('model', { type: 'cylinder' });
            returnPortal.setLocalScale(40, 5, 40);
            returnPortal.setLocalEulerAngles(90, 0, 0);
            returnPortal.setPosition(startPosition.x, startPosition.y, startPosition.z);

            const rmat = new StandardMaterial();
            rmat.emissive = new Color(0, 1, 0); // Green to differentiate
            rmat.emissiveIntensity = 5;
            rmat.opacity = 0.6;
            rmat.blendType = BLEND_ADDITIVE;
            rmat.update();
            returnPortal.model.meshInstances[0].material = rmat;

            returnInner = new Entity('VibeJamReturnVortex');
            returnInner.addComponent('model', { type: 'sphere' });
            returnInner.setLocalScale(30, 30, 1);
            returnInner.setLocalEulerAngles(90, 0, 0);
            const rimat = new StandardMaterial();
            rimat.emissive = new Color(0.5, 1, 0);
            rimat.emissiveIntensity = 8;
            rimat.update();
            returnInner.model.meshInstances[0].material = rimat;
            returnPortal.addChild(returnInner);

            scene.addChild(returnPortal);
        }
    },

    update(dt, config) {
        const { getPlayer, onExit, onReturn } = config;
        const playerEnt = getPlayer();

        if (exitPortal && exitInner) {
            exitPortal.rotate(0, 100 * dt, 0);
            exitInner.rotate(0, -200 * dt, 0);

            if (playerEnt && playerEnt.getPosition) {
                const dist = exitPortal.getPosition().distance(playerEnt.getPosition());
                if (dist < 40) {
                    if (onExit) onExit();
                }
            }
        }

        if (returnPortal && returnInner) {
            returnPortal.rotate(0, 100 * dt, 0);
            returnInner.rotate(0, -200 * dt, 0);

            if (playerEnt && playerEnt.getPosition) {
                const dist = returnPortal.getPosition().distance(playerEnt.getPosition());
                if (dist < 40) {
                    if (onReturn) onReturn();
                }
            }
        }
    }
};
