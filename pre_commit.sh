node -e "
const fs = require('fs');
const code = fs.readFileSync('server/server.js', 'utf8');
if (code.includes('origin: true')) {
  console.error('Error: Insecure origin: true found');
  process.exit(1);
}
console.log('Pre-commit hook passed');
"
