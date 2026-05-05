import test, { describe, mock } from 'node:test';
import assert from 'node:assert';

describe('mock.module test', async () => {
    mock.module('playcanvas', {
        namedExports: {
            Entity: class MockEntity {
                constructor(name) { this.name = name; }
                addComponent() {}
            },
            StandardMaterial: class MockStandardMaterial {
                update() {}
            },
            Color: class MockColor { constructor(r, g, b) {} },
            BLEND_ADDITIVE: 1
        }
    });

    const { PortalSystem } = await import('./client/src/systems/portals.js');

    test('init works', () => {
        const scene = { addChild: mock.fn() };
        PortalSystem.init({ scene, exitPosition: { x: 0, y: 0, z: 0 } });
        assert.ok(true);
    });
});
