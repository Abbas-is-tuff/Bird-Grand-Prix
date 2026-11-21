// Packs the whole game into ONE file: play-offline.html (double-click to play, no server needed).
// Usage (needs Node.js):  npm install   then   node build.mjs
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const out = await build({
  entryPoints: [join(here, 'src/main.js')],
  bundle: true, minify: true, format: 'esm', write: false, target: ['es2020', 'safari15'], legalComments: 'none',
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(join(here, 'style.css'), 'utf8');
let html = readFileSync(join(here, 'index.html'), 'utf8');
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, '');
html = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>${css}</style>`);
html = html.replace('<link rel="apple-touch-icon" href="icon.png">', '').replace('<link rel="icon" type="image/png" href="icon.png">', '');
html = html.replace('<script type="module" src="src/main.js"></script>', () => `<script type="module">${js}</script>`);
writeFileSync(join(here, 'play-offline.html'), html);
console.log('Built play-offline.html', Math.round(html.length / 1024) + ' KB');
