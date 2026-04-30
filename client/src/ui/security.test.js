import { test, mock } from 'node:test';
import assert from 'node:assert';

// ---- DOM MOCKS ----
const createMockElement = () => {
    const el = {
        style: {},
        appendChild: mock.fn(),
        lastChild: null,
        innerHTML: '',
        textContent: '',
        className: '',
        remove: mock.fn(),
    };
    el.appendChild = mock.fn((child) => {
        el.lastChild = child;
    });
    return el;
};

global.document = {
    getElementById: mock.fn(() => createMockElement()),
    createElement: mock.fn(() => createMockElement()),
};

// Mock PlayCanvas Vec3
global.Vec3 = class { constructor(x,y,z) { this.x=x;this.y=y;this.z=z; } clone() { return new global.Vec3(this.x,this.y,this.z); } };

// Import HudSystem
import { HudSystem } from './hud.js';

test('HudSystem XSS Vulnerabilities', async (t) => {
    await t.test('pushKillfeed should escape attackerName and targetName', () => {
        const kf = createMockElement();
        document.getElementById = mock.fn((id) => id === 'kf' ? kf : createMockElement());

        const maliciousName = '<img src=x onerror=alert(1)>';
        HudSystem.pushKillfeed(maliciousName, maliciousName, '#fff');

        const lastAdded = kf.lastChild;
        assert.ok(lastAdded, 'Should have added an element to killfeed');
        assert.ok(!lastAdded.innerHTML.includes(maliciousName), 'innerHTML should not contain raw malicious script');
    });

    await t.test('updateHallOfFame should escape entry name', () => {
        const list = createMockElement();
        document.getElementById = mock.fn((id) => id === 'hof-list' ? list : createMockElement());

        const maliciousName = '<svg onload=alert(1)>';
        const hof = [{ name: maliciousName, mass: 1000, date: Date.now() }];

        // Reset AppState cache for the test
        global.AppState = { uiCache: { hof: '' } };

        HudSystem.updateHallOfFame(hof);

        assert.ok(list.appendChild.mock.callCount() > 0);
        const firstEntry = list.lastChild;
        assert.ok(!firstEntry.innerHTML.includes(maliciousName), 'Hall of Fame should escape malicious names');
    });

    await t.test('updateLeaderboard should escape player names', () => {
        const lbList = createMockElement();
        document.getElementById = mock.fn((id) => id === 'lbList' ? lbList : createMockElement());

        const maliciousName = '"><script>alert(1)</script>';
        const AppState = {
            myId: 'me',
            gameState: {
                leaderboard: [{ id: 'other', name: maliciousName, mass: 500 }]
            },
            uiCache: { leaderboard: '' }
        };

        HudSystem.updateLeaderboard(AppState);

        // Check if the malicious name is escaped in the innerHTML
        // The maliciousName is '"><script>alert(1)</script>'
        // It should NOT appear as-is in the innerHTML
        assert.ok(!lbList.innerHTML.includes(maliciousName), 'Leaderboard should escape malicious names');
    });
});
