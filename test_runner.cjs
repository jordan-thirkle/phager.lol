const { execSync } = require('child_process');

try {
  execSync('node --test client/src/ui/meta.test.js', { stdio: 'inherit' });
  console.log('Tests passed.');
} catch (e) {
  console.error('Tests failed.');
  process.exit(1);
}
