// Bird Grand Prix - entry point. Starts the game and shows any start-up error on screen.
import './core/garage.js'; // loads your designed birds before anything else
import { Game } from './core/game.js';

function showError(err) {
  const el = document.getElementById('loadtext');
  if (el) el.textContent = 'Something went wrong: ' + (err && err.message ? err.message : err);
  console.error(err);
}

window.addEventListener('error', (e) => showError(e.error || e.message));

try {
  const game = new Game(document.getElementById('app'));
  window.bgp = game; // handy for debugging in the browser console
  game.init().catch(showError);
} catch (err) {
  showError(err);
}

// ---- Offline mode: save the game on this device so it opens without internet.
// Only on a real website (like GitHub Pages) that has the offline helper (sw.js) next to it.
const offlineOk = 'serviceWorker' in navigator && document.querySelector('link[rel=manifest]') &&
  (location.protocol === 'https:' || location.hostname === 'localhost');
if (offlineOk) {
  navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => {
    const v = document.querySelector('.version');
    if (v && !v.dataset.off) {
      v.dataset.off = 1;
      v.textContent += ' • ✈️ Saved for offline play';
    }
  }).catch(() => { /* no offline helper here: the game still works online */ });
}
if (location.protocol === 'file:') {
  addEventListener('load', () => {
    const v = document.querySelector('.version');
    if (v) v.textContent += ' • ✈️ Offline file';
  });
}
