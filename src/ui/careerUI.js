// Career screens: start a career, then the hub with tabs (Home, Train, Race, Standings, Records, Sponsors).
import { Career, TIERS, TRAINING, EXTRAS, SEASON_WEEKS } from '../career/career.js';
import { DRILLS } from '../career/drills.js';
import { ROSTER, BIRDS } from '../data/roster.js';
import { SPECIES, ratings } from '../data/species.js';
import { RACES, TIMES_OF_DAY } from '../data/races.js';
import { formatTime, ordinal } from '../core/utils.js';

const $ = (id) => document.getElementById(id);
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
const pct = (x) => (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + '%';
const TIME_ICON = { day: '☀️', sunset: '🌇', night: '🌙' };

const TABS = [
  ['home', 'HOME'], ['train', 'TRAIN'], ['race', 'RACE'], ['standings', 'STANDINGS'], ['records', 'RECORDS'], ['sponsors', 'SPONSORS'],
];

export class CareerUI {
  constructor(game) {
    this.game = game;
    this.tab = 'home';
    this.startPick = 'abbas';
    this.confirmRetire = false;
    $('career-body').addEventListener('click', (e) => {
      const el = e.target.closest('[data-c]');
      if (!el || el.disabled) return;
      this.game.audio.unlock();
      this.command(el.dataset.c, el.dataset.v, el);
    });
    $('career-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-tab]');
      if (!b) return;
      this.tab = b.dataset.tab;
      this.confirmRetire = false;
      this.render();
    });
  }

  get career() {
    return this.game.career;
  }

  portrait(id) {
    return this.game.menus.portraits[id] || '';
  }

  open(tab) {
    if (tab) this.tab = tab;
    // a drill that was left unfinished (e.g. the app was closed) counts as abandoned
    if (this.career?.pendingTraining && !this.game.race) this.career.finishTraining(0);
    this.render();
    this.game.menus.show('career');
    const c = this.career;
    this.game.previewBird(c ? c.birdId : this.startPick);
  }

  toast(t) {
    this.game.menus.toast(t, 2.8);
  }

  // ---------------------------------------------------------------- commands
  command(cmd, v) {
    const g = this.game;
    const c = this.career;
    switch (cmd) {
      case 'pick':
        this.startPick = v;
        g.previewBird(v);
        this.render();
        break;
      case 'begin':
        g.career = Career.create(this.startPick);
        this.tab = 'home';
        this.render();
        this.toast(`Welcome to the circuit, ${g.career.bird.name}!`);
        break;
      case 'tab':
        this.tab = v;
        this.render();
        break;
      case 'train': {
        const [type, coach] = v.split(':');
        const r = c.startTraining(type, coach === '1');
        if (r.error) {
          this.toast(r.error);
          break;
        }
        g.startDrill(type, coach === '1');
        break;
      }
      case 'physio': {
        const r = c.physio();
        this.toast(r.error || `💆 Physio done: freshness +${-r.fatigue}`);
        this.render();
        break;
      }
      case 'camp': {
        const r = c.camp();
        this.toast(r.error || '⛺ Training camp booked: +1 session this week');
        this.render();
        break;
      }
      case 'enter': {
        const r = c.enter(v);
        if (r.error) {
          this.toast(r.error);
          break;
        }
        g.startCareerRace(r.event);
        break;
      }
      case 'skip': {
        const sum = c.skipWeek();
        this.afterWeek(sum);
        this.render();
        break;
      }
      case 'accept': {
        const r = c.acceptOffer(v);
        this.toast(r.error || 'Contract signed! ✍️');
        this.render();
        break;
      }
      case 'decline':
        c.declineOffers();
        this.render();
        break;
      case 'retire':
        if (!this.confirmRetire) {
          this.confirmRetire = true;
          this.render();
        } else {
          Career.clear();
          g.career = null;
          this.confirmRetire = false;
          this.tab = 'home';
          this.render();
        }
        break;
      default:
        break;
    }
  }

  afterWeek(sum) {
    const msgs = [];
    if (sum.seasonEnd) msgs.push(`Season over: you finished ${ordinal(sum.seasonEnd.pos)}.`);
    if (sum.promoted) msgs.push(`PROMOTED to ${sum.promoted}!`);
    for (const t of sum.newTrophies || []) msgs.push(`${t.icon} ${t.name}`);
    if (msgs.length) this.toast(msgs.join('  •  '));
  }

  // ---------------------------------------------------------------- rendering
  render() {
    const c = this.career;
    if (!c) return this.renderStart();
    const t = c.tier;
    $('career-title').innerHTML = `${c.bird.name} <span class="tierbadge" style="background:${t.color}">${t.icon} ${t.name.toUpperCase()}</span><small>Season ${c.season} • Week ${c.week}/${SEASON_WEEKS}</small>`;
    $('career-money').textContent = money(c.money);
    $('career-tabs').classList.remove('hidden');
    $('career-tabs').innerHTML = TABS.map(([id, label]) => {
      const dot = (id === 'sponsors' && c.offers.length) || (id === 'train' && c.slotsLeft > 0 && this.tab !== 'train') ? '<span class="dot"></span>' : '';
      return `<button data-tab="${id}" class="${this.tab === id ? 'sel' : ''}">${label}${dot}</button>`;
    }).join('');
    const body = $('career-body');
    body.innerHTML = this['render_' + this.tab]();
    body.scrollTop = 0;
  }

  freshBar() {
    const c = this.career;
    const f = c.freshness;
    const col = f > 65 ? '#4dff8a' : f > 40 ? '#ffc93c' : '#ff4d3a';
    const note = f > 65 ? 'Fresh and ready.' : f > 40 ? 'A bit tired — training is less effective.' : 'Exhausted! Rest, recover or see the physio before racing.';
    return `<div class="kv"><span>Freshness</span><b>${f}%</b></div><div class="fresh"><div style="width:${f}%;background:${col}"></div></div><div class="muted">${note}</div>`;
  }

  renderStart() {
    $('career-title').innerHTML = 'NEW CAREER';
    $('career-money').textContent = '';
    $('career-tabs').classList.add('hidden');
    const mine = ROSTER.filter((b) => b.mine);
    const others = ROSTER.filter((b) => !b.mine);
    const card = (b) => `<div class="bird-card ${b.id === this.startPick ? 'sel' : ''}" data-c="pick" data-v="${b.id}">
        ${this.portrait(b.id) ? `<img src="${this.portrait(b.id)}" alt="">` : `<div class="swatch" style="background:${b.colors.body}"></div>`}
        <div class="nm">${b.name}</div><div class="sp">${SPECIES[b.species].name}</div></div>`;
    const b = BIRDS[this.startPick];
    const sp = SPECIES[b.species];
    $('career-body').innerHTML = `
      <div class="ccard" style="margin-bottom:10px">
        <h4>START YOUR RACING CAREER</h4>
        <div class="muted">Pick the bird you will race with. You start as an unknown <b>Beginner</b> at small local meets.
        Train between races, earn prize money and ranking points, and finish a season in the <b>top 3</b> of the standings to be promoted:
        Beginner → Amateur → Professional → Champion.</div>
      </div>
      <div class="label">YOUR BIRDS</div>
      <div class="startgrid">${mine.map(card).join('')}</div>
      <div class="label">OTHER BIRDS</div>
      <div class="startgrid">${others.map(card).join('')}</div>
      <div class="ccard hl" style="margin-top:12px">
        <h4>${b.name} • ${sp.name}</h4>
        <div class="muted">${b.trait}. ${sp.blurb}</div>
        <div class="cbtns"><button class="btn primary big" data-c="begin">BEGIN CAREER WITH ${b.name.toUpperCase()}</button></div>
      </div>`;
  }

  render_home() {
    const c = this.career;
    const t = c.tier;
    const rank = c.playerRank();
    const me = c.standings[c.birdId];
    const sp = c.sponsor;
    const evs = c.events.map((e) => `${e.final ? '🏆 ' : ''}${e.name} — ${RACES[e.raceId].short}`).join('<br>');
    const nextTier = TIERS[c.tierIndex + 1];
    return `<div class="cgrid">
      <div class="ccard">
        <h4>${t.icon} ${t.name} level</h4>
        <div class="muted">${t.blurb}</div>
        <div class="kv" style="margin-top:8px">
          <span>Season standing</span><b>${ordinal(rank)} of ${ROSTER.length}</b>
          <span>Ranking points</span><b>${me.rp}</b>
          <span>Week</span><b>${c.week} of ${SEASON_WEEKS}</b>
        </div>
        <div class="muted" style="margin-top:6px">${nextTier ? `Finish the season in the top 3 to be promoted to <b>${nextTier.name}</b>.` : 'You are at the top level. Win the World Championship!'}</div>
      </div>
      <div class="ccard">
        <h4>Condition</h4>
        ${this.freshBar()}
        <div class="kv" style="margin-top:8px"><span>Training sessions left this week</span><b>${c.slotsLeft}</b></div>
        <div class="cbtns"><button class="btn" data-c="tab" data-v="train">TRAIN</button></div>
      </div>
      <div class="ccard ${c.isFinalWeek ? 'gold' : 'hl'}">
        <h4>${c.isFinalWeek ? 'Championship final this week!' : 'Race day this week'}</h4>
        <div class="muted">${evs}</div>
        <div class="cbtns"><button class="btn primary" data-c="tab" data-v="race">GO TO RACE DAY</button></div>
      </div>
      <div class="ccard">
        <h4>Sponsor</h4>
        ${sp ? `<div class="muted"><b>${sp.name}</b>: ${money(sp.weekly)}/week, ${money(sp.winBonus)} per win. Goal: ${sp.progress}/${sp.goal} top-3 finishes, ${sp.weeksLeft} weeks left.</div>`
    : c.offers.length ? '<div class="muted">You have sponsorship offers waiting!</div><div class="cbtns"><button class="btn" data-c="tab" data-v="sponsors">SEE OFFERS</button></div>'
      : `<div class="muted">${c.tierIndex < 1 ? 'Sponsors start noticing you at Amateur level.' : 'No sponsor right now. New offers come with new seasons.'}</div>`}
      </div>
      <div class="ccard" style="grid-column:1/-1">
        <h4>News</h4>
        <div class="news">${c.news.map((n) => `<div><span>S${n.season} W${n.week}</span>${n.text}</div>`).join('') || '<div class="muted">No news yet.</div>'}</div>
      </div>
    </div>`;
  }

  statRows() {
    const c = this.career;
    const b = c.bird;
    const base = Object.assign({}, SPECIES[b.species].stats);
    for (const k in b.mods || {}) if (k in base) base[k] *= 1 + b.mods[k];
    const trained = Object.assign({}, base);
    for (const k in c.bonus) trained[k] *= 1 + c.bonus[k];
    const rb = ratings(base), rt = ratings(trained);
    const rows = [['speed', 'Top speed', 'sprint'], ['accel', 'Acceleration', 'accel'], ['stamina', 'Stamina', 'endurance'], ['turning', 'Cornering', 'turning']];
    return rows.map(([k, label, tr]) => {
      const T = TRAINING[tr];
      const bonus = c.bonus[T.stat];
      const extra = Math.max(0, rt[k] - rb[k]);
      return `<div class="statrow"><span>${label}</span><div class="bar"><div class="b" style="width:${rb[k]}%"></div><div class="t" style="width:${extra}%"></div></div><span>${pct(bonus)} / max ${pct(T.cap).replace('.0', '')}</span></div>`;
    }).join('');
  }

  render_train() {
    const c = this.career;
    const coachP = c.price('coach'), physioP = c.price('physio'), campP = c.price('camp');
    const none = c.slotsLeft <= 0;
    const cards = Object.values(TRAINING).map((T) => {
      const eff = T.stat ? `${T.label} up • fatigue +${T.fatigue}` : `fatigue ${T.fatigue}`;
      const D = DRILLS[T.id];
      const drillTxt = `Drill: <b>${D.name}</b> — ${D.dist} m${D.barriers.length ? `, ${D.barriers.length} barriers` : ''}`;
      return `<div class="tcard"><div class="ic">${T.icon}</div><div class="nm">${T.name}</div><div class="muted">${T.desc}<br>${drillTxt}<br><b>${eff}</b></div>
        <div class="cbtns"><button class="btn" data-c="train" data-v="${T.id}:0" ${none ? 'disabled' : ''}>TRAIN</button>
        ${T.stat ? `<button class="btn" data-c="train" data-v="${T.id}:1" ${none || c.money < coachP ? 'disabled' : ''}>WITH COACH ${money(coachP)}</button>` : ''}</div></div>`;
    }).join('');
    const log = c.trainingLog.slice(0, 8).map((l) => {
      const T = TRAINING[l.type];
      return `<tr><td>S${l.season} W${l.week}</td><td>${T.icon} ${T.name}${l.coach ? ' (coach)' : ''}</td><td>${l.grade ? `<b>${l.grade}</b> ` : ''}${T.stat ? pct(l.gain) + ' ' + T.label : `${-l.fatigue} fatigue`}</td></tr>`;
    }).join('');
    return `<div class="cgrid">
        <div class="ccard"><h4>This week</h4>
          <div class="kv"><span>Training sessions left</span><b>${c.slotsLeft} / ${c.slots}</b></div>
          ${this.freshBar()}
          <div class="muted" style="margin-top:6px">Every session is a drill you run yourself. Your grade (S, A, B, C or D) decides how much your bird improves: an S is worth three times a D. Gains also shrink near each limit and when your bird is tired.</div>
        </div>
        <div class="ccard"><h4>Trained stats</h4>${this.statRows()}<div class="muted">Blue = natural ability. Gold = gained from training.</div></div>
      </div>
      <div class="trainlist">${cards}</div>
      <div class="cgrid" style="margin-top:8px">
        <div class="ccard"><h4>💆 ${EXTRAS.physio.name}</h4><div class="muted">${EXTRAS.physio.desc}</div>
          <div class="cbtns"><button class="btn" data-c="physio" ${c.physioUsed || c.money < physioP ? 'disabled' : ''}>BOOK ${money(physioP)}</button></div></div>
        <div class="ccard"><h4>⛺ ${EXTRAS.camp.name}</h4><div class="muted">${EXTRAS.camp.desc}</div>
          <div class="cbtns"><button class="btn" data-c="camp" ${c.extraSlots > 0 || c.money < campP ? 'disabled' : ''}>BOOK ${money(campP)}</button></div></div>
      </div>
      <div class="label">TRAINING LOG</div>
      ${log ? `<table class="ctable"><tr><th>WHEN</th><th>SESSION</th><th>GRADE / RESULT</th></tr>${log}</table>` : '<div class="muted">No sessions yet.</div>'}`;
  }

  render_race() {
    const c = this.career;
    const evCards = c.events.map((e) => {
      const r = RACES[e.raceId];
      const field = e.field.map((id) => BIRDS[id].name).join(', ');
      const ok = c.canEnter(e);
      return `<div class="ccard evcard ${e.final ? 'gold' : ''}">
        <div class="eh"><h4>${e.final ? '🏆 ' : ''}${e.name}</h4><span class="dist">${r.short}</span></div>
        <div class="chips"><span>${TIME_ICON[e.time]} ${TIMES_OF_DAY[e.time].name}</span><span>Entry ${e.entry ? money(e.entry) : 'free'}</span><span>1st: ${money(e.prizes[0])} + ${e.rp[0]} RP</span><span>3rd: ${money(e.prizes[2])}</span></div>
        <div class="muted">Rivals: ${field}${e.final ? '<br>The top birds in the standings. Double ranking points, trophies for the top 3.' : ''}</div>
        <div class="cbtns"><button class="btn primary" data-c="enter" data-v="${e.id}" ${ok ? '' : 'disabled'}>${ok ? 'ENTER RACE' : `NEED ${money(e.entry)}`}</button></div>
      </div>`;
    }).join('');
    const cal = Array.from({ length: SEASON_WEEKS }, (_, i) => {
      const w = i + 1;
      const cls = w < c.week ? 'done' : w === c.week ? 'now' : '';
      return `<div class="${cls} ${w === SEASON_WEEKS ? 'fin' : ''}">${w === SEASON_WEEKS ? 'FINAL' : 'W' + w}</div>`;
    }).join('');
    return `<div class="muted" style="margin-bottom:8px">Choose one race this week. Freshness <b>${c.freshness}%</b>${c.freshness < 45 ? ' — your bird is tired and will be slower!' : ''}</div>
      <div class="cgrid">${evCards}</div>
      <div class="cbtns" style="margin-top:10px"><button class="btn" data-c="skip">${c.isFinalWeek ? 'MISS THE FINAL (rest)' : 'SKIP THIS WEEK (rest)'}</button></div>
      <div class="label">SEASON ${c.season} CALENDAR</div><div class="cal">${cal}</div>`;
  }

  render_standings() {
    const c = this.career;
    const rows = c.standingsTable().map((r, i) => `<tr class="${r.isPlayer ? 'me' : ''} ${i < 3 ? 'promo' : ''}">
      <td>${i + 1}</td><td>${this.portrait(r.id) ? `<img src="${this.portrait(r.id)}" alt="">` : ''}${r.name} <span class="muted">${r.species}</span></td>
      <td>${r.races}</td><td>${r.wins}</td><td>${r.podiums}</td><td><b>${r.rp}</b></td></tr>`).join('');
    return `<div class="muted" style="margin-bottom:6px">${c.tier.name} season ${c.season} standings after week ${c.week - 1}. Green line = promotion places (top 3).</div>
      <table class="ctable"><tr><th>POS</th><th>BIRD</th><th>RACES</th><th>WINS</th><th>PODIUMS</th><th>RP</th></tr>${rows}</table>`;
  }

  render_records() {
    const c = this.career;
    const s = c.stats;
    const winRate = s.races ? Math.round((s.wins / s.races) * 100) : 0;
    const bests = ['r100', 'h100', 'r200', 'r400', 'r800'].map((r) => `<span>${RACES[r].short}</span><b>${s.best[r] ? formatTime(s.best[r]) : '—'}</b>`).join('');
    const trophies = c.trophies.map((t) => `<div class="trophy"><span class="ti">${t.icon}</span>${t.name}<div class="ts">Season ${t.season}</div></div>`).join('');
    const hist = c.history.slice(0, 20).map((h) => `<tr><td>S${h.season} W${h.week}</td><td>${h.final ? '🏆 ' : ''}${h.event} <span class="muted">${RACES[h.raceId].short}</span></td>
      <td>${h.place ? ordinal(h.place) : h.dq ? 'DQ' : 'DNF'}</td><td>${h.time ? formatTime(h.time) : '—'}</td><td>${h.prize ? money(h.prize) : '—'}</td></tr>`).join('');
    const seasons = c.seasonLog.map((x) => `<span>S${x.season} ${TIERS.find((t) => t.id === x.tier).name}</span><b>${ordinal(x.pos)}</b>`).join('');
    return `<div class="cgrid">
      <div class="ccard"><h4>Career statistics</h4><div class="kv">
        <span>Seasons</span><b>${s.seasons}</b><span>Races</span><b>${s.races}</b><span>Wins</span><b>${s.wins}</b>
        <span>Podiums</span><b>${s.podiums}</b><span>Win rate</span><b>${winRate}%</b><span>Prize money earned</span><b>${money(s.earnings)}</b>
        <span>Training sessions</span><b>${s.trainingSessions}</b><span>DNF / DQ</span><b>${s.dnf} / ${s.dq}</b></div></div>
      <div class="ccard"><h4>Career best times</h4><div class="kv">${bests}</div>
        ${seasons ? `<h4 style="margin-top:10px">Season finishes</h4><div class="kv">${seasons}</div>` : ''}</div>
    </div>
    <div class="label">TROPHY CABINET (${c.trophies.length})</div>
    ${trophies ? `<div class="trophies">${trophies}</div>` : '<div class="muted">No trophies yet. Win races and finals to fill the cabinet!</div>'}
    <div class="label">RACING HISTORY</div>
    ${hist ? `<table class="ctable"><tr><th>WHEN</th><th>EVENT</th><th>POS</th><th>TIME</th><th>PRIZE</th></tr>${hist}</table>` : '<div class="muted">No races yet.</div>'}
    <div class="cbtns" style="margin-top:16px"><button class="btn ${this.confirmRetire ? 'danger' : ''}" data-c="retire">${this.confirmRetire ? 'TAP AGAIN TO DELETE THIS CAREER' : 'RETIRE & START A NEW CAREER'}</button></div>`;
  }

  render_sponsors() {
    const c = this.career;
    const sp = c.sponsor;
    if (sp) {
      const p = Math.min(100, (sp.progress / sp.goal) * 100);
      return `<div class="ccard gold"><h4>Current contract: ${sp.name}</h4>
        <div class="kv"><span>Weekly pay</span><b>${money(sp.weekly)}</b><span>Bonus per win</span><b>${money(sp.winBonus)}</b>
        <span>Completion bonus</span><b>${money(sp.completion)}</b><span>Weeks left</span><b>${sp.weeksLeft}</b></div>
        <div class="muted" style="margin-top:8px">Goal: ${sp.goal} top-3 finishes before the contract ends (${sp.progress}/${sp.goal}).</div>
        <div class="fresh"><div style="width:${p}%;background:#ffc93c"></div></div></div>`;
    }
    if (!c.offers.length) {
      return `<div class="ccard"><h4>No offers right now</h4><div class="muted">${c.tierIndex < 1 ? 'Sponsors only sign Amateur birds and above. Get promoted first!' : 'New sponsorship offers arrive at the start of each season, or when a contract ends.'}</div></div>`;
    }
    return `<div class="muted" style="margin-bottom:8px">Pick one contract. You get paid every week, plus bonuses — but only reach the big completion bonus if you hit the goal in time.</div>
      <div class="cgrid">${c.offers.map((o) => `<div class="ccard"><h4>${o.name}</h4><div class="kv">
        <span>Weekly pay</span><b>${money(o.weekly)}</b><span>Bonus per win</span><b>${money(o.winBonus)}</b><span>Completion bonus</span><b>${money(o.completion)}</b>
        <span>Goal</span><b>${o.goal} top-3 in ${o.weeks} weeks</b></div>
        <div class="cbtns"><button class="btn primary" data-c="accept" data-v="${o.id}">SIGN CONTRACT</button></div></div>`).join('')}</div>
      <div class="cbtns" style="margin-top:8px"><button class="btn" data-c="decline">NO THANKS (this season)</button></div>`;
  }
}
