const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public');
// O preset Other publica os arquivos estáticos e compila api/ separadamente.
// Não copiar server.js, routes/, db/ ou middleware/ para public/.
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
if (config.framework !== null || config.outputDirectory !== 'public') {
  throw new Error('Vercel: use framework=null (Other) e outputDirectory=public.');
}
for (const entry of ['api/index.js', 'api/[...path].js', 'server.js']) {
  if (!fs.existsSync(path.join(root, entry))) throw new Error(`Entrada ausente: ${entry}`);
}
fs.mkdirSync(output, { recursive: true });
for (const dir of ['css', 'js', 'assets']) fs.cpSync(path.join(root, dir), path.join(output, dir), { recursive: true });
for (const name of fs.readdirSync(root).filter(name => name.endsWith('.html'))) fs.copyFileSync(path.join(root, name), path.join(output, name));
console.log('Arquivos públicos preparados em public/.');
console.log('Vercel: preset Other; backend em api/; frontend em public/.');
