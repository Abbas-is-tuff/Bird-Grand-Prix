// Bird Grand Prix - entry point. Starts the game and shows any start-up error on screen.
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
