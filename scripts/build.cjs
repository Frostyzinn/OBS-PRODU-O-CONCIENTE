const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public');
fs.mkdirSync(output, { recursive: true });
for (const dir of ['css', 'js', 'assets']) fs.cpSync(path.join(root, dir), path.join(output, dir), { recursive: true });
for (const name of fs.readdirSync(root).filter(name => name.endsWith('.html'))) fs.copyFileSync(path.join(root, name), path.join(output, name));
console.log('Arquivos públicos preparados em public/.');
