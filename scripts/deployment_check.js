import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

console.log('🧪 PHAGE.LOL DEPLOYMENT SANITY CHECK...');

const checks = [
    { name: 'Server Entry', path: 'server/server.js' },
    { name: 'Client Source', path: 'client/src/main.js' },
    { name: 'Vite Config', path: 'client/vite.config.js' },
    { name: 'Root Package', path: 'package.json' }
];

let failed = false;
checks.forEach(c => {
    const fullPath = path.join(ROOT, c.path);
    if (fs.existsSync(fullPath)) {
        console.log(`✅ ${c.name} found.`);
    } else {
        console.error(`❌ MISSING: ${c.name} at ${c.path}`);
        failed = true;
    }
});

if (!failed) {
    console.log('\n🚀 ALL SYSTEMS GO. READY FOR VIBE JAM 2026.');
} else {
    console.error('\n🛑 DEPLOYMENT ABORTED: MISSING CRITICAL FILES.');
    process.exit(1);
}
