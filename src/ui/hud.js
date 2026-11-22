// In-race heads-up display: position, timer, distance, stamina, standings, mini-map, messages.
import { formatTime, clamp } from '../core/utils.js';
import { T } from '../world/track.js';

const $ = (id) => document.getElementById(id);
const SUFFIX = (n) => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

export class HUD {
  constructor() {
    this.root = $('hud');
    this.place = $('hud-place');
    this.of = $('hud-of');
    this.lap = $('hud-lap');
    this.time = $('hud-time');
    this.dist = $('hud-dist');
    this.tick = $('hud-ticker');
    this.stand = $('standings');
    this.stam = $('stamina-fill');
    this.speed = $('hud-speed');
    this.msg = $('bigmsg');
    this.hintEl = $('hint');
    this.camName = $('cam-name');
    this.fps = $('fps');
    this.map = $('minimap');
    this.mctx = this.map.getContext('2d');
    this.standTimer = 0;
    this.timers = {};
    this.rows = [];
  }

  show(on) {
    this.root.classList.toggle('hidden', !on);
  }

  setCameraName(n) {
    this.camName.textContent = n;
  }

  _timed(key, el, dur) {
    clearTimeout(this.timers[key]);
    el.classList.add('on');
    if (dur > 0) this.timers[key] = setTimeout(() => el.classList.remove('on'), dur * 1000);
  }

  ticker(text) {
    this.tick.textContent = text;
    this._timed('tick', this.tick, 3.8);
  }

  big(text, cls = '', dur = 1.2) {
    this.msg.textContent = text;
    this.msg.className = cls;
    void this.msg.offsetWidth;
    this._timed('msg', this.msg, dur);
  }

  flashBarrier() {
    this.lap.classList.remove('flash');
    void this.lap.offsetWidth;
    this.lap.classList.add('flash');
  }

  hideBig() {
    this.msg.classList.remove('on');
  }

  hint(text, dur = 3) {
    this.hintEl.textContent = text;
    this._timed('hint', this.hintEl, dur);
  }

  hideHint() {
    clearTimeout(this.timers.hint);
    this.hintEl.classList.remove('on');
  }

  reset(race) {
    this.rows = [];
    this.stand.innerHTML = '';
    for (let i = 0; i < race.racers.length; i++) {
      const row = document.createElement('div');
      row.className = 'srow';
      row.innerHTML = '<span class="p"></span><span class="band"></span><span class="n"></span><span class="gap"></span>';
      this.stand.appendChild(row);
      this.rows.push(row);
    }
    this.of.textContent = '/' + race.racers.length;
    this.root.classList.toggle('has-jump', race.barrierDists.length > 0);
    this.root.classList.toggle('solo', race.racers.length === 1);
    this.lap.textContent = '';
    this.tick.classList.remove('on');
    this.hideBig();
    this.hideHint();
  }

  update(dt, race, fps) {
    const p = race.player;
    const D = race.def.dist;
    // position
    const place = p.place || 1;
    this.place.innerHTML = `${place}<small style="font-size:0.45em">${SUFFIX(place)}</small>`;
    // timer
    let t = 0;
    if (race.phase === 'running' || race.phase === 'done') t = p.finished ? p.finishTime : race.raceTime;
    this.time.textContent = formatTime(t);
    // distance + lap
    if (p.dq) this.dist.textContent = p.dq === 'False start' ? 'DISQUALIFIED (false start)' : 'DISQUALIFIED (lane violation)';
    else if (p.finished) this.dist.textContent = 'FINISHED';
    else {
      const label = race.drill ? race.def.name.toUpperCase() : race.def.short.toUpperCase();
      let txt = `${label}  •  ${Math.max(0, Math.ceil(D - p.progress))} m TO GO`;
      const nb = p.barriers.length ? race.nextBarrier(p) : null;
      if (nb && race.phase === 'running') txt += `  •  BARRIER IN ${Math.max(0, Math.ceil(nb.dist - p.progress))} m`;
      this.dist.textContent = txt;
    }
    if (p.barriers.length) {
      this.lap.textContent = `BARRIERS ${p.barriersCleared}/${p.barriers.length}`;
    } else if (race.def.laps > 1) {
      const lap = clamp(race.def.laps - Math.ceil((race.def.dist - Math.max(0, p.progress)) / 400) + 1, 1, race.def.laps);
      this.lap.textContent = p.finished ? '' : `LAP ${lap}/${race.def.laps}`;
    }
    // stamina + speed
    this.stam.style.width = (p.body.stamina * 100).toFixed(1) + '%';
    this.stam.style.backgroundPosition = `${(1 - p.body.stamina) * 0}px 0`;
    this.speed.textContent = Math.round(p.body.speed * 3.6) + ' km/h';
    // standings (updated a few times a second)
    this.standTimer -= dt;
    if (this.standTimer <= 0) {
      this.standTimer = 0.15;
      const list = race.standings;
      const lead = list[0];
      list.forEach((r, i) => {
        const row = this.rows[i];
        if (!row) return;
        row.classList.toggle('me', r.isPlayer);
        row.children[0].textContent = i + 1;
        row.children[1].style.background = r.bandColor;
        row.children[2].textContent = r.name;
        let gap = '';
        if (r.dq) gap = 'DQ';
        else if (r.finished) gap = i === 0 ? formatTime(r.finishTime) : '+' + (r.finishTime - lead.finishTime).toFixed(2);
        else if (i === 0) gap = race.phase === 'running' ? 'LEAD' : '';
        else if (lead.finished) gap = '';
        else gap = '-' + Math.max(0, lead.progress - r.progress).toFixed(1) + 'm';
        row.children[3].textContent = gap;
      });
    }
    this.drawMap(race);
    if (fps != null) this.fps.textContent = fps.toFixed(0) + ' fps';
    else this.fps.textContent = '';
  }

  drawMap(race) {
    const c = this.mctx;
    const w = this.map.width, h = this.map.height;
    c.clearRect(0, 0, w, h);
    const extX = T.L / 2 + T.R + T.WALL + 2;
    const extZ = T.R + T.WALL + 2;
    const s = Math.min((w - 12) / (2 * extX + T.CHUTE * 0.4), (h - 12) / (2 * extZ));
    const ox = w / 2 + T.CHUTE * 0.2 * s, oz = h / 2;
    const P = (x, z) => [ox + x * s, oz + z * s];
    const ring = (d, style, width) => {
      c.beginPath();
      const r = (T.R + d) * s;
      const [ax, az] = P(-T.L / 2, 0);
      const [bx, bz] = P(T.L / 2, 0);
      c.moveTo(ax, az + r);
      c.lineTo(bx, bz + r);
      c.arc(bx, bz, r, Math.PI / 2, -Math.PI / 2, true);
      c.lineTo(ax, az - r);
      c.arc(ax, az, r, -Math.PI / 2, Math.PI / 2, true);
      c.strokeStyle = style;
      c.lineWidth = width;
      c.stroke();
    };
    ring(T.EDGE / 2, 'rgba(200,70,55,0.9)', T.EDGE * s);
    ring(0, 'rgba(255,255,255,0.5)', 1);
    // finish line
    const [fx, fz] = P(T.FINISH_X, T.R);
    c.fillStyle = '#fff';
    c.fillRect(fx - 1, fz, 2, T.EDGE * s);
    for (const r of race.racers) {
      const [x, z] = P(r.body.x, r.body.z);
      c.beginPath();
      c.arc(x, z, r.isPlayer ? 4 : 3, 0, Math.PI * 2);
      c.fillStyle = r.bandColor;
      c.fill();
      if (r.isPlayer) {
        c.lineWidth = 1.5;
        c.strokeStyle = '#fff';
        c.stroke();
      }
    }
  }
}
