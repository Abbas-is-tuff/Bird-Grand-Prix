// Menus: main menu, quick race setup / bird collection, settings, pause and results.
import { ROSTER, BIRDS } from '../data/roster.js';
import { SPECIES, ratings } from '../data/species.js';
import { RACE_LIST, RACES, TIMES_OF_DAY, DIFFICULTY } from '../data/races.js';
import { PERSONALITIES } from '../ai/aiController.js';
import { settings, saveSettings, getPB, getTrackRecord, isTouch } from '../core/settings.js';
import { formatTime, ordinal } from '../core/utils.js';

const $ = (id) => document.getElementById(id);

export class Menus {
  constructor(game) {
    this.game = game;
    this.portraits = {};
    this.current = null;
    this.prev = null;
    this.sel = {
      bird: BIRDS[settings.lastBird] ? settings.lastBird : 'abbas',
      race: RACES[settings.lastRace] ? settings.lastRace : 'r100',
      time: TIMES_OF_DAY[settings.lastTime] ? settings.lastTime : 'day',
      diff: DIFFICULTY[settings.lastDifficulty] ? settings.lastDifficulty : 'normal',
    };
    document.body.classList.toggle('no-touch', !isTouch);
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-action]');
      if (!b) return;
      this.game.audio.unlock();
      this.action(b.dataset.action, b);
    });
    this.buildSeg('race-pick', RACE_LIST.map((r) => [r.id, r.short]), () => this.sel.race, (v) => { this.sel.race = v; this.refreshDetail(); });
    this.buildSeg('time-pick', Object.values(TIMES_OF_DAY).map((t) => [t.id, t.name]), () => this.sel.time, (v) => { this.sel.time = v; this.game.previewTime(v); });
    this.buildSeg('diff-pick', Object.values(DIFFICULTY).map((d) => [d.id, d.name]), () => this.sel.diff, (v) => { this.sel.diff = v; });
  }

  show(id) {
    for (const s of ['menu', 'setup', 'settings', 'pause', 'results', 'loading', 'career']) $(s).classList.toggle('show', s === id);
    if (id === 'menu') this.updateCareerBadge();
    if (id === 'pause') this.preparePause();
    if (id !== this.current) this.prev = this.current;
    this.current = id;
  }

  hideAll() {
    this.show(null);
  }

  updateCareerBadge() {
    const c = this.game.career;
    const b = $('career-badge');
    if (b) b.textContent = c ? `${c.tier.icon} S${c.season} W${c.week}` : 'NEW';
  }

  preparePause() {
    const career = !!this.game.lastOpts?.careerEventId && !this.game.careerRecorded;
    $('pause-restart').classList.toggle('hidden', career);
    $('pause-quit').textContent = career ? 'WITHDRAW (counts as DNF)' : 'QUIT TO MENU';
  }

  toast(text, dur = 2.4) {
    const t = $('toast');
    t.textContent = text;
    t.classList.add('on');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('on'), dur * 1000);
  }

  action(a, el) {
    const g = this.game;
    switch (a) {
      case 'quick': this.openSetup('race'); break;
      case 'career': g.careerUI.open('home'); break;
      case 'training': g.careerUI.open(g.career ? 'train' : 'home'); break;
      case 'career-continue': g.continueCareer(); break;
      case 'collection': this.openSetup('collection'); break;
      case 'settings':
        this.settingsReturn = this.current;
        this.buildSettings();
        this.show('settings');
        break;
      case 'locked': this.toast(el.dataset.msg || 'Coming in a later phase.'); break;
      case 'back':
        if (this.current === 'settings' && this.settingsReturn === 'pause') this.show('pause');
        else { this.show('menu'); g.toMenu(); }
        break;
      case 'start':
        if (this.mode === 'collection') { this.openSetup('race'); break; }
        settings.lastBird = this.sel.bird; settings.lastRace = this.sel.race; settings.lastTime = this.sel.time; settings.lastDifficulty = this.sel.diff;
        saveSettings();
        this.hideAll();
        g.startRace({ bird: this.sel.bird, race: this.sel.race, time: this.sel.time, difficulty: this.sel.diff });
        break;
      case 'resume': g.resume(); break;
      case 'restart': this.hideAll(); g.restartRace(); break;
      case 'quit': this.hideAll(); g.quitRace(); break;
      case 'again': this.hideAll(); g.restartRace(); break;
      case 'change': g.quitRace(true); this.openSetup('race'); break;
      default: break;
    }
  }

  // ---------------------------------------------------------------- setup / collection
  openSetup(mode) {
    this.mode = mode;
    $('setup-title').textContent = mode === 'collection' ? 'BIRD COLLECTION' : 'QUICK RACE';
    $('race-options').classList.toggle('hidden', mode === 'collection');
    $('start-btn').textContent = mode === 'collection' ? 'RACE WITH THIS BIRD' : 'START RACE';
    this.buildBirdList();
    this.refreshDetail();
    this.show('setup');
    this.game.previewBird(this.sel.bird);
    this.game.previewTime(this.sel.time);
  }

  buildBirdList() {
    const list = $('bird-list');
    list.innerHTML = '';
    const sorted = ROSTER.slice().sort((a, b) => (b.mine ? 1 : 0) - (a.mine ? 1 : 0));
    for (const b of sorted) {
      const card = document.createElement('div');
      card.className = 'bird-card' + (b.id === this.sel.bird ? ' sel' : '');
      const img = this.portraits[b.id]
        ? `<img src="${this.portraits[b.id]}" alt="">`
        : `<div class="swatch" style="background:${b.colors.body}"></div>`;
      card.innerHTML = `${img}${b.mine ? '<span class="mine">★ YOURS</span>' : ''}<span class="num">#${b.number}</span><div class="nm">${b.name}</div><div class="sp">${SPECIES[b.species].name}</div>`;
      card.addEventListener('click', () => {
        this.game.audio.unlock();
        this.sel.bird = b.id;
        list.querySelectorAll('.bird-card').forEach((c) => c.classList.remove('sel'));
        card.classList.add('sel');
        this.refreshDetail();
        this.game.previewBird(b.id);
      });
      list.appendChild(card);
    }
  }

  refreshDetail() {
    const b = BIRDS[this.sel.bird];
    const sp = SPECIES[b.species];
    const stats = Object.assign({}, sp.stats);
    for (const k in b.mods || {}) if (k in stats) stats[k] *= 1 + b.mods[k];
    const r = ratings(stats);
    const bar = (label, v) => `<div class="stat"><span>${label}</span><div class="bar"><div style="width:${v}%"></div></div><span>${v}</span></div>`;
    const pbs = RACE_LIST.map((rc) => {
      const pb = getPB(b.id, rc.id);
      return `<div>${rc.short}: <b>${pb ? formatTime(pb) : '—'}</b></div>`;
    }).join('');
    const pers = PERSONALITIES[b.personality]?.label || '';
    $('bird-detail').innerHTML = `
      <h3>${b.name} <span style="opacity:.5;font-size:.6em">#${b.number}</span></h3>
      <div class="sub">${sp.name}${b.mine ? ' • one of your birds' : ''} • AI style: ${pers}</div>
      <div class="trait">${b.trait}</div>
      ${bar('SPEED', r.speed)}${bar('ACCEL', r.accel)}${bar('STAMINA', r.stamina)}${bar('CORNERING', r.turning)}
      <div class="sub" style="margin-top:6px">${sp.blurb}</div>
      <div class="label">PERSONAL BESTS</div>
      <div class="pbs">${pbs}</div>`;
    const rc = RACES[this.sel.race];
    const rec = getTrackRecord(rc.id);
    $('race-tip').innerHTML = `${rc.tip}${rec ? `<br><b style="color:#ffc93c">Stadium record: ${formatTime(rec.time)} — ${rec.name}</b>` : ''}`;
    this.refreshSegs();
  }

  buildSeg(id, options, get, set) {
    const el = $(id);
    el.innerHTML = '';
    for (const [v, label] of options) {
      const b = document.createElement('button');
      b.textContent = label;
      b.dataset.v = v;
      b.addEventListener('click', () => {
        set(v);
        this.refreshSegs();
      });
      el.appendChild(b);
    }
    el._get = get;
    this.refreshSegs();
  }

  refreshSegs() {
    for (const id of ['race-pick', 'time-pick', 'diff-pick']) {
      const el = $(id);
      if (!el || !el._get) continue;
      const v = el._get();
      el.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b.dataset.v === v));
    }
  }

  // ---------------------------------------------------------------- settings
  buildSettings() {
    const body = $('settings-body');
    body.innerHTML = '';
    const row = (title, desc, options, get, set) => {
      const r = document.createElement('div');
      r.className = 'set-row';
      r.innerHTML = `<div><div class="t">${title}</div><div class="d">${desc}</div></div><div class="seg"></div>`;
      const seg = r.querySelector('.seg');
      const paint = () => seg.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b.dataset.v === String(get())));
      for (const [v, label] of options) {
        const b = document.createElement('button');
        b.textContent = label;
        b.dataset.v = String(v);
        b.addEventListener('click', () => {
          set(v);
          saveSettings();
          paint();
        });
        seg.appendChild(b);
      }
      paint();
      body.appendChild(r);
    };
    const onoff = [[true, 'On'], [false, 'Off']];
    row('Graphics', 'Lower settings run smoother on older phones and tablets. Changing this reloads the game.',
      [['auto', 'Auto'], ['low', 'Low'], ['medium', 'Med'], ['high', 'High']], () => settings.quality, (v) => {
        if (settings.quality === v) return;
        settings.quality = v;
        saveSettings();
        this.toast('Reloading with new graphics…');
        setTimeout(() => location.reload(), 600);
      });
    row('Sound', 'Footsteps, crowd, starter\'s gun and music.', onoff, () => settings.sound, (v) => this.game.audio.setEnabled(v));
    row('Commentary voice', 'Spoken announcements (uses your device\'s voice).', onoff, () => settings.voice, (v) => { settings.voice = v; if (!v) this.game.audio.stopSpeech(); });
    row('Lane assist', 'Your bird steers itself along its lane. Turn off to steer fully by hand.', onoff, () => settings.laneAssist, (v) => { settings.laneAssist = v; });
    row('Name tags', 'Show names above the birds.', onoff, () => settings.nameTags, (v) => { settings.nameTags = v; });
    row('Show FPS', 'Frames per second counter.', onoff, () => settings.showFps, (v) => { settings.showFps = v; });
  }

  // ---------------------------------------------------------------- results
  careerSummaryHTML(sum) {
    const c = this.game.career;
    const lines = [];
    lines.push(`<span class="big">+$${sum.prize.toLocaleString('en-US')}</span> prize money  •  <span class="big">+${sum.rp}</span> ranking points`);
    if (sum.careerBest) lines.push('New career best time!');
    for (const l of sum.lines) lines.push(l);
    if (sum.seasonEnd) lines.push(`Season ${sum.seasonEnd.season} over — you finished ${ordinal(sum.seasonEnd.pos)} in the ${sum.seasonEnd.tierName} standings.`);
    if (sum.promoted) lines.push(`🎉 PROMOTED to ${sum.promoted}!`);
    else if (sum.stayed === 'retry') lines.push('Not in the top 3 — you stay at this level next season.');
    for (const t of sum.newTrophies) lines.push(`${t.icon} Trophy: ${t.name}`);
    if (c && !sum.seasonEnd) lines.push(`Standings: ${ordinal(c.playerRank())} • Freshness ${c.freshness}% • Bank $${Math.round(c.money).toLocaleString('en-US')}`);
    return `<div class="career-sum">${lines.join('<br>')}</div>`;
  }

  showResults(res, pbInfo, careerSum = null) {
    const p = res.player;
    $('results').classList.toggle('career', !!careerSum);
    let banner;
    if (p.dq) banner = `DISQUALIFIED<div class="sub">${p.dq === 'False start' ? 'Two false starts. Wait for the gun!' : 'You stepped inside your lane on a bend.'}</div>`;
    else if (p.time == null) banner = 'DID NOT FINISH<div class="sub">Hold RUN or SPRINT to race.</div>';
    else {
      const head = res.rows.length === 1 ? 'TIME TRIAL COMPLETE' : p.place === 1 ? 'VICTORY!' : `${ordinal(p.place)} PLACE`;
      let sub = `${p.racer.name} • ${res.def.name} • ${formatTime(p.time)} s`;
      if (p.reaction != null) sub += ` • reaction ${p.reaction.toFixed(3)} s`;
      banner = `${head}<div class="sub">${sub}</div>`;
      if (pbInfo?.isPB) banner += `<span class="badge">NEW PERSONAL BEST${pbInfo.prevPB ? ` (was ${formatTime(pbInfo.prevPB)})` : ''}</span>`;
      if (pbInfo?.isRecord) banner += '<span class="badge">NEW STADIUM RECORD</span>';
    }
    $('res-title').textContent = `RESULTS — ${res.def.name.toUpperCase()}`;
    if (careerSum) banner += this.careerSummaryHTML(careerSum);
    $('res-banner').innerHTML = banner;
    const rows = res.rows.map((r) => {
      const me = r.racer.isPlayer;
      const pl = r.place ? r.place : r.dq ? 'DQ' : 'DNF';
      const time = r.time != null && !r.dq ? formatTime(r.time) + (r.estimated ? '*' : '') : '—';
      const gap = r.gap != null && !r.dq ? '+' + r.gap.toFixed(2) : '';
      const rt = r.reaction != null ? r.reaction.toFixed(3) : '—';
      return `<tr class="${me ? 'me' : ''}"><td class="pl">${pl}</td><td><span class="bandc" style="background:${r.racer.bandColor}"></span>${r.racer.name} <span class="spc">${r.racer.species.name} • lane ${r.racer.lane}</span></td><td>${time}</td><td>${gap}</td><td>${rt}</td></tr>`;
    }).join('');
    $('res-table').innerHTML = `<tr><th>POS</th><th>BIRD</th><th>TIME</th><th>GAP</th><th>REACT</th></tr>${rows}`;
    this.show('results');
  }
}
