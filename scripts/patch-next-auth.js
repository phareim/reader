const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '../node_modules/next-auth/package.json');

try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  // Add the ./core export if it doesn't exist
  if (!packageJson.exports['./core']) {
    packageJson.exports['./core'] = {
      types: './core/index.d.ts',
      default: './core/index.js'
    };

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('✓ Patched next-auth package.json to export ./core');
  }
} catch (error) {
  console.error('Failed to patch next-auth:', error.message);
  process.exit(1);
}
