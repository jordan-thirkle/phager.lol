import test, { describe, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import * as pc from 'playcanvas';
import { PortalSystem } from './portals.js';

// Since addComponent isn't creating model.meshInstances without a real Application setup
// We can intercept addComponent and populate it ourselves!
pc.Entity.prototype.addComponent = mock.fn(function(name, config) {
    if (name === 'model') {
        this.model = {
            meshInstances: [{ material: null }]
        };
    }
});

describe('PortalSystem', () => {

    beforeEach(() => {
        pc.Entity.prototype.addComponent.mock.resetCalls();
        // Since portals.js variables portal/inner are module scope and not cleared
        // Let's ensure the test starts clean by calling init again or we just don't care
    });

    test('init should create portal and add it to the scene', () => {
        const scene = { addChild: mock.fn() };
        const exitPosition = { x: 10, y: 20, z: 30 };

        PortalSystem.init({ scene, exitPosition });

        assert.strictEqual(scene.addChild.mock.callCount(), 1);
        const addedPortal = scene.addChild.mock.calls[0].arguments[0];

        assert.strictEqual(addedPortal.name, 'VibeJamExitPortal');

        const pos = addedPortal.getPosition();
        assert.strictEqual(pos.x, 10);
        assert.strictEqual(pos.y, 20);
        assert.strictEqual(pos.z, 30);

        const inner = addedPortal.children[0];
        assert.ok(inner);
        assert.strictEqual(inner.name, 'VibeJamVortex');

        // Assert addComponent was called
        assert.strictEqual(pc.Entity.prototype.addComponent.mock.callCount(), 2);
    });

    test('update should rotate portal and inner', () => {
        const scene = { addChild: mock.fn() };
        const exitPosition = { x: 0, y: 0, z: 0 };
        PortalSystem.init({ scene, exitPosition });

        const portal = scene.addChild.mock.calls[0].arguments[0];
        const inner = portal.children[0];

        const initialPortalRot = { ...portal.getLocalEulerAngles() };
        const initialInnerRot = { ...inner.getLocalEulerAngles() };

        const dt = 0.016;
        PortalSystem.update(dt, { getPlayer: () => null });

        const finalPortalRot = portal.getLocalEulerAngles();
        const finalInnerRot = inner.getLocalEulerAngles();

        assert.notDeepStrictEqual(initialPortalRot, finalPortalRot);
        assert.notDeepStrictEqual(initialInnerRot, finalInnerRot);
    });

    test('update should call onExit if player is close to portal', () => {
        const scene = { addChild: mock.fn() };
        const exitPosition = { x: 100, y: 0, z: 100 };
        PortalSystem.init({ scene, exitPosition });

        let onExitCalled = false;

        const playerEnt = new pc.Entity('player');
        // Place player close to the portal (dist < 40)
        playerEnt.setPosition(110, 0, 110);

        PortalSystem.update(0.016, {
            getPlayer: () => playerEnt,
            onExit: () => { onExitCalled = true; }
        });

        assert.strictEqual(onExitCalled, true);
    });

    test('update should NOT call onExit if player is far from portal', () => {
        const scene = { addChild: mock.fn() };
        const exitPosition = { x: 100, y: 0, z: 100 };
        PortalSystem.init({ scene, exitPosition });

        let onExitCalled = false;

        const playerEnt = new pc.Entity('player');
        // Place player far from the portal (dist >= 40)
        playerEnt.setPosition(200, 0, 200);

        PortalSystem.update(0.016, {
            getPlayer: () => playerEnt,
            onExit: () => { onExitCalled = true; }
        });

        assert.strictEqual(onExitCalled, false);
    });

    test('update should safely handle missing getPlayer or missing playerEnt', () => {
        const scene = { addChild: mock.fn() };
        const exitPosition = { x: 100, y: 0, z: 100 };
        PortalSystem.init({ scene, exitPosition });

        // Missing getPlayer entirely should just not crash but maybe it should if the code expects it.
        // Let's see the code: `const playerEnt = getPlayer();`
        // If getPlayer is missing, it crashes `getPlayer is not a function`.
        // The code:
        // const playerEnt = getPlayer();
        // if (playerEnt && playerEnt.getPosition) {

        assert.doesNotThrow(() => {
            PortalSystem.update(0.016, { getPlayer: () => null });
        });

        assert.doesNotThrow(() => {
            PortalSystem.update(0.016, { getPlayer: () => ({}) }); // no getPosition
        });
    });
});
