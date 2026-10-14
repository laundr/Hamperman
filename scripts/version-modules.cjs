const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

// Version the entire module graph: a new entry URL alone still imports cached dependencies.
module.exports = function versionModules(root, output) {
  const sources = fs.readdirSync(path.join(root, 'js')).sort()
    .filter(file => file.endsWith('.js') && file !== 'pixi.min.js')
    .map(file => [file, fs.readFileSync(path.join(root, 'js', file), 'utf8')]);
  const version = createHash('sha256').update(JSON.stringify(sources)).digest('hex').slice(0, 12);
  const names = new Map(sources.map(([file]) => [file, file.replace(/\.js$/, `.${version}.js`)]));
  for (const [file, source] of sources) {
    const versioned = source.replace(/(\bfrom\s+['"])(\.\/[^'"]+\.js)(['"])/g, (_, before, relative, after) => {
      const target = names.get(relative.slice(2));
      if (!target) throw new Error(`Unknown module import ${relative} in ${file}`);
      return `${before}./${target}${after}`;
    });
    fs.writeFileSync(path.join(output, 'js', names.get(file)), versioned);
  }
  return `js/${names.get('game.js')}`;
};
