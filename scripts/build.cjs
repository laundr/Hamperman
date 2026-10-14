const fs = require('node:fs');
const path = require('node:path');
const versionModules = require('./version-modules.cjs');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const soundPath = 'node_modules/pixi-sound/dist/pixi-sound.js';

// Check the dependency before clearing a previous build.
const sound = fs.readFileSync(path.join(root, soundPath));
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const entry of ['credits.html', 'js', 'styles', 'sprites', 'sounds', 'fonts', 'inputData']) {
  fs.cpSync(path.join(root, entry), path.join(output, entry), { recursive: true });
}

fs.mkdirSync(path.join(output, 'vendor'), { recursive: true });
fs.writeFileSync(path.join(output, 'vendor/pixi-sound.js'), sound);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const gamePath = versionModules(root, output);
fs.writeFileSync(path.join(output, 'index.html'), html
  .replace(soundPath, 'vendor/pixi-sound.js')
  .replace('src="js/game.js"', `src="${gamePath}"`));

console.log('Static game built in dist/');
