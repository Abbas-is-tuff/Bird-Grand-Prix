// Builds the game into ONE file. Run from this folder:  npm install  then  node build.mjs
//   index.html        - the built game (GitHub Pages serves this; works offline with sw.js)
//   play-offline.html - the same game without the icon/manifest links, to open straight from disk
// While coding, open dev.html instead (it loads the files in src/ one by one).
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';

const out = await build({
  entryPoints: ['src/main.js'],
  bundle: true, minify: true, format: 'esm', write: false, target: ['es2020', 'safari15'],
  legalComments: 'none',
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('style.css', 'utf8');
let html = readFileSync('dev.html', 'utf8');
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, '');
html = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>${css}</style>`);
html = html.replace('<script type="module" src="src/main.js"></script>', () => `<script type="module">${js}</script>`);
writeFileSync('index.html', html);
const single = html
  .replace('<link rel="apple-touch-icon" href="icon.png">', '').replace('<link rel="icon" type="image/png" href="icon.png">', '')
  .replace('<link rel="manifest" href="manifest.webmanifest">', '');
writeFileSync('play-offline.html', single);
console.log('index.html + play-offline.html', (html.length / 1024).toFixed(0) + ' KB');
