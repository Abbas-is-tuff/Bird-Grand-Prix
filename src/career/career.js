// Career mode: one bird's journey from unknown racer to world champion.
// Everything is saved on the device (localStorage) after every action.
import { ROSTER, BIRDS } from '../data/roster.js';
import { SPECIES, ratings } from '../data/species.js';
import { RACES } from '../data/races.js';
import { clamp, rand, shuffle, pick } from '../core/utils.js';
import {
  TIERS, TRAINING, EXTRAS, SEASON_WEEKS, START_MONEY, TRAINING_SLOTS, PRIZE_SPLIT, RP_TABLE,
  RACE_FATIGUE, SPONSOR_NAMES, MILESTONES, TIER_VENUES, CUP_VENUES, TRAVEL_MODES, travelScale,
  HOTEL_PER_WEEK, HOME_REST_BONUS, GEAR, JET_LAG_PENALTY, HOME_CROWD_BONUS, TRAVEL_EVENTS, KM_PER_UNIT,
} from './careerData.js';
import { VENUES, HOME_VENUE, venueDistance } from '../data/venues.js';

const KEY = 'bgp.career.v1';

// How strong a computer bird is overall (0-100), used to simulate races you don't see.
export function birdStrength(id) {
  const b = BIRDS[id];
  const st = Object.assign({}, SPECIES[b.species].stats);
  for (const k in b.mods || {}) if (k in st) st[k] *= 1 + b.mods[k];
  const r = ratings(st);
  return (r.speed * 1.3 + r.accel * 0.7 + r.stamina * 0.7 + r.turning * 0.3) / 3;
}

function gauss() {
  return (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.2;
}

export class Career {
  constructor(data) {
    Object.assign(this, data);
  }

  // ------------------------------------------------------------------ create / save / load
  static create(birdId) {
    const c = new Career({
      v: 1, birdId, season: 1, week: 1, tierIndex: 0,
      money: START_MONEY, fatigue: 10,
      bonus: { topSpeed: 0, accel: 0, staminaCap: 0, grip: 0 },
      slotsUsed: 0, extraSlots: 0, physioUsed: false,
      trainingLog: [], history: [], trophies: [], milestones: [], news: [],
      stats: { races: 0, wins: 0, podiums: 0, earnings: 0, dnf: 0, dq: 0, best: {}, winsBy: {}, seasons: 1, trainingSessions: 0 },
      standings: {}, sponsor: null, offers: [], events: [], seasonLog: [],
      location: HOME_VENUE, jetLag: 0, travelLog: [], gear: { diet: 0, claws: 0, feathers: 0, warmup: 0 },
      visited: { [HOME_VENUE]: { visits: 1, races: 0, wins: 0, best: {} } },
    });
    c.startSeason();
    c.addNews(`${c.bird.name} signs up for the Beginner circuit. A star is born?`);
    c.save();
    return c;
  }

  static load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || d.v !== 1 || !BIRDS[d.birdId]) return null;
      const c = new Career(d);
      // careers saved before travel existed: start them at home
      c.gear ||= { diet: 0, claws: 0, feathers: 0, warmup: 0 };
      for (const b of c.league) c.standings[b.id] ||= { rp: 0, races: 0, wins: 0, podiums: 0 };
      if (!c.location || !VENUES[c.location]) {
        c.location = HOME_VENUE;
        c.jetLag = 0;
        c.travelLog = [];
        c.visited = { [HOME_VENUE]: { visits: 1, races: 0, wins: 0, best: {} } };
        for (const e of c.events || []) e.venue ||= HOME_VENUE;
      }
      return c;
    } catch (e) {
      return null;
    }
  }

  static clear() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this)); } catch (e) { /* storage unavailable */ }
  }

  // ------------------------------------------------------------------ handy getters
  get bird() { return BIRDS[this.birdId]; }
  get tier() { return TIERS[this.tierIndex]; }
  get slots() { return TRAINING_SLOTS + this.extraSlots; }
  get slotsLeft() { return Math.max(0, this.slots - this.slotsUsed); }
  get freshness() { return Math.round(100 - this.fatigue); }
  get isFinalWeek() { return this.week === SEASON_WEEKS; }
  price(extraId) { return EXTRAS[extraId].price * this.tier.costMult; }

  addNews(text) {
    this.news.unshift({ season: this.season, week: this.week, text });
    this.news = this.news.slice(0, 8);
  }

  // ------------------------------------------------------------------ seasons & events
  startSeason() {
    this.standings = {};
    for (const b of this.league) this.standings[b.id] = { rp: 0, races: 0, wins: 0, podiums: 0 };
    this.week = 1;
    this.generateEvents();
    this.makeOffers();
  }

  generateEvents() {
    const t = this.tier;
    if (this.isFinalWeek) {
      const venue = CUP_VENUES[this.tierIndex];
      this.events = [this.makeEvent(t.cup, pick(t.races), this.timeFor(venue), true, 0, venue)];
      return;
    }
    const races = shuffle(t.races);
    // one event close to where you are now, one somewhere else on the circuit
    const list = TIER_VENUES[this.tierIndex];
    const near = list.slice().sort((a, b) => venueDistance(this.location, a) - venueDistance(this.location, b));
    const v0 = list.includes(this.location) && Math.random() < 0.7 ? this.location : near[Math.random() < 0.6 ? 0 : 1];
    const others = list.filter((x) => x !== v0);
    const v1 = others[Math.floor(Math.random() * others.length)];
    this.events = [v0, v1].map((venue, i) => this.makeEvent(
      t.events[(this.week * 2 + i + this.season) % t.events.length],
      races[i % races.length], this.timeFor(venue), false, i, venue,
    ));
  }

  timeFor(venueId) {
    const v = VENUES[venueId];
    if (v.indoor) return 'indoor';
    const ok = this.tier.times.filter((x) => v.times.includes(x));
    return pick(ok.length ? ok : ['day']);
  }

  makeEvent(name, raceId, time, final, i, venue = HOME_VENUE) {
    const t = this.tier;
    const others = this.league.filter((b) => b.id !== this.birdId).map((b) => b.id);
    let field;
    if (final) {
      field = others.sort((a, b) => this.standings[b].rp - this.standings[a].rp).slice(0, 5);
    } else {
      field = shuffle(others).slice(0, 5);
    }
    const [lo, hi] = t.oppSpeed;
    const oppSpeed = field.map((id) => +clamp(rand(lo, hi) + (birdStrength(id) - 55) / 2500, lo - 0.01, hi + 0.01).toFixed(4));
    const d = RACES[raceId].dist;
    const distMul = d >= 3000 ? 1.6 : d >= 1200 ? 1.4 : d >= 800 ? 1.25 : d >= 400 ? 1.12 : 1;
    const top = t.prize * (final ? 3 : 1) * distMul * VENUES[venue].prestige;
    return {
      id: `${this.season}-${this.week}-${i}`,
      name, raceId, time, final, venue,
      entry: final ? 0 : t.entry,
      prizes: PRIZE_SPLIT.map((f) => Math.round((top * f) / 5) * 5),
      rp: RP_TABLE.map((x) => x * t.rpMult * (final ? 2 : 1)),
      field, oppSpeed,
    };
  }

  // ------------------------------------------------------------------ training
  // Can this training session start? (slots and money)
  canTrain(typeId, coach = false) {
    if (!TRAINING[typeId]) return { error: 'Unknown training.' };
    if (this.slotsLeft <= 0) return { error: 'No training sessions left this week. Race or skip to next week.' };
    const cost = coach ? this.price('coach') : 0;
    if (this.money < cost) return { error: `Not enough money for a coach ($${cost}).` };
    return { ok: true, cost };
  }

  // Pay for the session and remember it while the drill is being played.
  startTraining(typeId, coach = false) {
    const ok = this.canTrain(typeId, coach);
    if (ok.error) return ok;
    this.money -= ok.cost;
    this.pendingTraining = { type: typeId, coach };
    this.save();
    return { ok: true };
  }

  // Apply the result of the drill. mult comes from your grade (0.5 for D … 1.5 for S, 0 if abandoned).
  finishTraining(mult = 1, grade = 'B') {
    const pt = this.pendingTraining;
    if (!pt) return null;
    this.pendingTraining = null;
    const { type: typeId, coach } = pt;
    const tr = TRAINING[typeId];
    this.slotsUsed++;
    this.stats.trainingSessions++;
    let result;
    const quit = mult <= 0;
    if (!tr.stat) {
      const before = this.fatigue;
      this.fatigue = clamp(this.fatigue + tr.fatigue * (coach ? 1.4 : 1) * (quit ? 0 : mult), 0, 100);
      result = { type: typeId, fatigue: Math.round(this.fatigue - before) };
    } else {
      const cur = this.bonus[tr.stat];
      const eff = clamp(1.1 - this.fatigue / 100, 0.25, 1);
      const gain = quit ? 0 : tr.gain * (1 - cur / tr.cap) * eff * (coach ? 1.6 : 1) * mult;
      this.bonus[tr.stat] = Math.min(tr.cap, cur + gain);
      const before = this.fatigue;
      this.fatigue = clamp(this.fatigue + tr.fatigue * (coach ? 1.15 : 1) * (quit ? 0.5 : 1), 0, 100);
      result = { type: typeId, stat: tr.stat, label: tr.label, gain, fatigue: Math.round(this.fatigue - before), tired: eff < 0.6, nearCap: cur / tr.cap > 0.8 };
    }
    result.grade = quit ? '—' : grade;
    this.trainingLog.unshift({ season: this.season, week: this.week, type: typeId, coach, gain: result.gain || 0, fatigue: result.fatigue, grade: result.grade });
    this.trainingLog = this.trainingLog.slice(0, 30);
    this.save();
    return result;
  }

  // Instant training (used by automatic tests): start + finish with an average grade.
  train(typeId, coach = false) {
    const r = this.startTraining(typeId, coach);
    if (r.error) return r;
    return this.finishTraining(1, 'B');
  }

  physio() {
    if (this.physioUsed) return { error: 'The physio is booked once per week.' };
    const cost = this.price('physio');
    if (this.money < cost) return { error: `Not enough money ($${cost}).` };
    this.money -= cost;
    this.physioUsed = true;
    const before = this.fatigue;
    this.fatigue = clamp(this.fatigue - 40, 0, 100);
    this.save();
    return { fatigue: Math.round(this.fatigue - before) };
  }

  camp() {
    if (this.extraSlots > 0) return { error: 'Only one training camp per week.' };
    const cost = this.price('camp');
    if (this.money < cost) return { error: `Not enough money ($${cost}).` };
    this.money -= cost;
    this.extraSlots = 1;
    this.save();
    return { ok: true };
  }

  // What training + tiredness do to your bird on race day.
  // Your league: all the game's birds plus your own (if you race with a bird you designed).
  get league() {
    return ROSTER.filter((b) => !b.custom || b.id === this.birdId);
  }

  gearBonus(stat) {
    let v = 0;
    for (const [id, g] of Object.entries(GEAR)) if (g.stat === stat) v += g.levels[this.gear?.[id] || 0].bonus;
    return v;
  }

  buyGear(id) {
    const g = GEAR[id];
    const lv = (this.gear[id] || 0) + 1;
    const next = g?.levels[lv];
    if (!next) return { error: 'Already the best.' };
    if (this.tierIndex < next.minTier) return { error: `Needs ${TIERS[next.minTier].name} level.` };
    if (this.money < next.cost) return { error: `You need $${next.cost}.` };
    this.money -= next.cost;
    this.gear[id] = lv;
    this.addNews(`${this.bird.name} gets new gear: ${next.name}.`);
    this.save();
    return { ok: true, item: next };
  }

  raceModifiers() {
    const pen = Math.max(0, this.fatigue - 35) * 0.0012 + (this.jetLag > 0 ? JET_LAG_PENALTY : 0);
    const home = this.location === HOME_VENUE ? HOME_CROWD_BONUS : 0;
    return {
      topSpeed: this.bonus.topSpeed - pen + home + this.gearBonus('topSpeed'),
      accel: this.bonus.accel - pen + this.gearBonus('accel'),
      staminaCap: this.bonus.staminaCap + this.gearBonus('staminaCap'),
      grip: this.bonus.grip + this.gearBonus('grip'),
      startStamina: 1 - Math.max(0, this.fatigue - 50) / 200,
    };
  }

  // ------------------------------------------------------------------ racing
  canEnter(ev) {
    return this.money >= ev.entry;
  }

  enter(eventId) {
    const ev = this.events.find((e) => e.id === eventId);
    if (!ev) return { error: 'Event not found.' };
    if (!this.canEnter(ev)) return { error: `You need $${ev.entry} to enter.` };
    if (ev.venue && ev.venue !== this.location) return { error: `This race is in ${VENUES[ev.venue].city}. Travel there first.` };
    this.money -= ev.entry;
    this.pendingEvent = ev.id;
    this.save();
    return { event: ev };
  }

  // res = race results (or null if you withdrew). Returns a summary for the results screen.
  recordRace(eventId, res) {
    const ev = this.events.find((e) => e.id === eventId);
    if (!ev || this.pendingEvent !== eventId) return null;
    this.pendingEvent = null;
    const t = this.tier;
    const sum = { event: ev, tierName: t.name, prize: 0, rp: 0, place: null, newTrophies: [], lines: [] };
    const p = res?.player;
    const place = p && !p.dq && p.time != null ? p.place : null;
    sum.place = place;
    this.stats.races++;
    if (place) {
      sum.prize = ev.prizes[place - 1] || 0;
      sum.rp = ev.rp[place - 1] || 0;
      this.money += sum.prize;
      this.stats.earnings += sum.prize;
      if (place === 1) {
        this.stats.wins++;
        this.stats.winsBy[ev.raceId] = (this.stats.winsBy[ev.raceId] || 0) + 1;
      }
      if (place <= 3) this.stats.podiums++;
      const prev = this.stats.best[ev.raceId];
      if (prev == null || p.time < prev) {
        this.stats.best[ev.raceId] = p.time;
        sum.careerBest = true;
      }
    } else if (p?.dq) this.stats.dq++;
    else this.stats.dnf++;

    // standings for everyone who ran
    const ran = new Set([this.birdId]);
    if (res) {
      for (const row of res.rows) {
        const id = row.racer.bird.id;
        ran.add(id);
        const s = this.standings[id];
        s.races++;
        if (row.place && !row.dq) {
          s.rp += ev.rp[row.place - 1] || 0;
          if (row.place === 1) s.wins++;
          if (row.place <= 3) s.podiums++;
        }
      }
      const winner = res.rows[0];
      if (winner && !winner.racer.isPlayer) this.addNews(`${winner.racer.name} wins the ${ev.name} (${RACES[ev.raceId].short}).`);
    } else {
      this.standings[this.birdId].races++;
    }
    if (place === 1) this.addNews(`${this.bird.name} wins the ${ev.name}!`);

    // sponsor
    if (this.sponsor) {
      if (place === 1) {
        this.money += this.sponsor.winBonus;
        this.stats.earnings += this.sponsor.winBonus;
        sum.lines.push(`${this.sponsor.name} win bonus: +$${this.sponsor.winBonus}`);
      }
      if (place && place <= 3) this.sponsor.progress++;
    }
    this.fatigue = clamp(this.fatigue + (RACE_FATIGUE[ev.raceId] || 12), 0, 100);
    this.jetLag = 0;
    const vs = this.visit(ev.venue || this.location);
    vs.races++;
    if (place === 1) vs.wins++;
    if (place && (vs.best[ev.raceId] == null || p.time < vs.best[ev.raceId])) vs.best[ev.raceId] = p.time;

    // trophies for the championship final
    if (ev.final && place && place <= 3) {
      const medal = ['Gold', 'Silver', 'Bronze'][place - 1];
      this.addTrophy({ id: `cup-${this.season}`, name: `${ev.name} — ${medal}`, icon: ['🏆', '🥈', '🥉'][place - 1], tier: t.id }, sum);
    }
    this.history.unshift({
      season: this.season, week: this.week, event: ev.name, raceId: ev.raceId, place, venue: ev.venue,
      time: p?.time ?? null, prize: sum.prize, rp: sum.rp, dq: p?.dq || null, final: ev.final,
    });
    this.history = this.history.slice(0, 60);
    this.advanceWeek(sum, ran);
    this.checkMilestones(sum);
    this.save();
    return sum;
  }

  // Skip racing this week (extra rest).
  skipWeek() {
    const sum = { skipped: true, newTrophies: [], lines: [] };
    this.fatigue = clamp(this.fatigue - 10, 0, 100);
    this.advanceWeek(sum, new Set([this.birdId]));
    this.checkMilestones(sum);
    this.save();
    return sum;
  }

  // ------------------------------------------------------------------ travel
  visit(venueId) {
    this.visited[venueId] ||= { visits: 0, races: 0, wins: 0, best: {} };
    return this.visited[venueId];
  }

  distanceTo(venueId) {
    return venueDistance(this.location, venueId);
  }

  kmTo(venueId) {
    return Math.round((this.distanceTo(venueId) * KM_PER_UNIT) / 10) * 10;
  }

  travelOptions(venueId) {
    const d = this.distanceTo(venueId);
    const scale = travelScale(this.tierIndex);
    const opts = Object.values(TRAVEL_MODES).map((m) => {
      const cost = Math.round((m.cost(d) * scale) / 5) * 5;
      const o = { mode: m.id, icon: m.icon, name: m.name, cost, slots: m.slots(d), fatigue: Math.round(m.fatigue(d)), jetLag: m.jetLag(d), ok: true, why: '' };
      if (d > m.maxDist) { o.ok = false; o.why = 'too far'; }
      else if (this.money < cost) { o.ok = false; o.why = `need $${cost}`; }
      return o;
    });
    // broke and stranded away from home? the club pays for the cheapest way back
    if (venueId === HOME_VENUE && !opts.some((o) => o.ok)) {
      const o = opts.find((x) => x.why !== 'too far');
      if (o) Object.assign(o, { cost: 0, ok: true, why: '', free: true });
    }
    return opts;
  }

  travel(venueId, modeId) {
    if (!VENUES[venueId]) return { error: 'Unknown place.' };
    if (venueId === this.location) return { error: 'You are already here.' };
    const o = this.travelOptions(venueId).find((x) => x.mode === modeId);
    if (!o || !o.ok) return { error: o?.why === 'too far' ? `Too far to go by ${o.name.toLowerCase()}.` : `Not enough money for the ${o?.name.toLowerCase() || 'trip'}.` };
    const from = this.location;
    this.money -= o.cost;
    // travelling eats training time; if there's no time left the trip is extra tiring
    const missing = Math.max(0, o.slots - this.slotsLeft);
    this.slotsUsed = Math.min(this.slots, this.slotsUsed + o.slots);
    this.fatigue = clamp(this.fatigue + o.fatigue + missing * 6, 0, 100);
    if (o.jetLag) this.jetLag = 1;
    this.location = venueId;
    const v = this.visit(venueId);
    const firstVisit = v.visits === 0;
    v.visits++;
    this.stats.travelKm = (this.stats.travelKm || 0) + this.kmBetween(from, venueId);
    if (modeId === 'plane') this.stats.flights = (this.stats.flights || 0) + 1;
    // something might happen on the way
    let event = null;
    if (Math.random() < 0.35) {
      const pool = TRAVEL_EVENTS.filter((e) => e.modes.includes(modeId));
      const e = pool[Math.floor(Math.random() * pool.length)];
      if (e) {
        event = { text: e.text };
        if (e.fatigue) this.fatigue = clamp(this.fatigue + e.fatigue, 0, 100);
        if (e.money) {
          const m = Math.round(e.money * travelScale(this.tierIndex));
          this.money = Math.max(0, this.money + m);
          if (m > 0) this.stats.earnings += m;
          event.money = m;
        }
        event.fatigue = e.fatigue || 0;
      }
    }
    this.travelLog.unshift({ season: this.season, week: this.week, from, to: venueId, mode: modeId, cost: o.cost, event: event?.text || null });
    this.travelLog = this.travelLog.slice(0, 30);
    this.addNews(`${this.bird.name} travels by ${o.name.toLowerCase()} to ${VENUES[venueId].city}.${firstVisit ? ' First visit!' : ''}`);
    const sum = { newTrophies: [] };
    this.checkMilestones(sum);
    this.save();
    return { ok: true, option: o, event, firstVisit, trophies: sum.newTrophies };
  }

  kmBetween(a, b) {
    return Math.round((venueDistance(a, b) * KM_PER_UNIT) / 10) * 10;
  }

  simulatedPlace(id) {
    const z = (birdStrength(id) - 55) / 15;
    return clamp(Math.round(3.5 - 1.3 * z + gauss()), 1, 6);
  }

  advanceWeek(sum, ran) {
    const t = this.tier;
    const final = this.isFinalWeek;
    // everyone else races somewhere this week
    for (const b of this.league) {
      if (ran.has(b.id)) continue;
      const pl = this.simulatedPlace(b.id);
      const s = this.standings[b.id];
      s.races++;
      s.rp += RP_TABLE[pl - 1] * t.rpMult * (final ? 2 : 1);
      if (pl === 1) s.wins++;
      if (pl <= 3) s.podiums++;
    }
    // recovery + slow loss of training if you stop training
    this.fatigue = clamp(this.fatigue - 12, 0, 100);
    if (this.location === HOME_VENUE) {
      this.fatigue = clamp(this.fatigue - HOME_REST_BONUS, 0, 100);
      sum.lines.push(`A week sleeping in your own nest at home: +${HOME_REST_BONUS} freshness`);
    } else {
      const hotel = Math.round(HOTEL_PER_WEEK * travelScale(this.tierIndex));
      this.money = Math.max(0, this.money - hotel);
      sum.lines.push(`Hotel in ${VENUES[this.location].city}: -$${hotel}`);
    }
    if (this.jetLag > 0) this.jetLag--;
    for (const k in this.bonus) this.bonus[k] *= 0.99;
    // sponsor pay and contract check
    if (this.sponsor) {
      const sp = this.sponsor;
      this.money += sp.weekly;
      this.stats.earnings += sp.weekly;
      sum.lines.push(`${sp.name} weekly pay: +$${sp.weekly}`);
      sp.weeksLeft--;
      if (sp.progress >= sp.goal) {
        this.money += sp.completion;
        this.stats.earnings += sp.completion;
        sum.lines.push(`Contract completed! ${sp.name} bonus: +$${sp.completion}`);
        this.addNews(`${this.bird.name} completes the ${sp.name} contract.`);
        this.sponsor = null;
      } else if (sp.weeksLeft <= 0) {
        sum.lines.push(`The ${sp.name} contract ended without the bonus.`);
        this.sponsor = null;
      }
    }
    this.slotsUsed = 0;
    this.extraSlots = 0;
    this.physioUsed = false;
    if (this.week >= SEASON_WEEKS) this.endSeason(sum);
    else this.week++;
    this.generateEvents();
    this.makeOffers();
  }

  standingsTable() {
    return this.league.map((b) => ({ id: b.id, name: b.name, species: SPECIES[b.species].name, isPlayer: b.id === this.birdId, ...this.standings[b.id] }))
      .sort((a, b) => b.rp - a.rp || b.wins - a.wins || a.name.localeCompare(b.name));
  }

  playerRank() {
    return this.standingsTable().findIndex((r) => r.isPlayer) + 1;
  }

  endSeason(sum) {
    const t = this.tier;
    const pos = this.playerRank();
    sum.seasonEnd = { pos, tierName: t.name, season: this.season };
    this.seasonLog.push({ season: this.season, tier: t.id, pos });
    if (pos === 1) this.addTrophy({ id: `season-${this.season}`, name: `${t.name} Season Champion (S${this.season})`, icon: '🏆', tier: t.id }, sum);
    if (pos <= 3 && this.tierIndex < TIERS.length - 1) {
      this.tierIndex++;
      sum.promoted = this.tier.name;
      this.addTrophy({ id: `promo-${this.tier.id}`, name: `Promoted to ${this.tier.name}`, icon: this.tier.icon, tier: this.tier.id }, sum);
      this.addNews(`${this.bird.name} is promoted to the ${this.tier.name} level!`);
    } else if (pos <= 3) {
      sum.stayed = 'top';
    } else {
      sum.stayed = 'retry';
      this.addNews(`${this.bird.name} finishes ${pos}${pos === 2 ? 'nd' : pos === 3 ? 'rd' : 'th'} and stays at ${t.name} level.`);
    }
    this.season++;
    this.stats.seasons++;
    this.startSeason();
  }

  addTrophy(tr, sum) {
    if (this.trophies.some((x) => x.id === tr.id && x.name === tr.name)) return;
    const full = Object.assign({ season: this.season }, tr);
    this.trophies.unshift(full);
    sum?.newTrophies.push(full);
  }

  checkMilestones(sum) {
    for (const m of MILESTONES) {
      if (this.milestones.includes(m.id)) continue;
      if (m.test(this)) {
        this.milestones.push(m.id);
        this.addTrophy({ id: 'm-' + m.id, name: m.name, icon: m.icon, tier: 'milestone' }, sum);
      }
    }
  }

  // ------------------------------------------------------------------ sponsors / contracts
  makeOffers() {
    if (this.tierIndex < 1 || this.sponsor || this.offers.length || this.declinedSeason === this.season) return;
    const t = this.tier;
    const base = 22 * t.costMult;
    const names = shuffle(SPONSOR_NAMES);
    this.offers = [0, 1].map((i) => {
      const goal = 2 + Math.floor(Math.random() * 3) + i;
      const weeks = goal + 2 + Math.floor(Math.random() * 3);
      return {
        id: `${this.season}-${this.week}-${i}`,
        name: names[i],
        weekly: Math.round((base * rand(0.8, 1.3) * (1 + i * 0.25)) / 5) * 5,
        winBonus: Math.round((base * rand(3, 5)) / 5) * 5,
        completion: Math.round((base * goal * rand(6, 9)) / 10) * 10,
        goal, weeks,
      };
    });
  }

  acceptOffer(id) {
    const o = this.offers.find((x) => x.id === id);
    if (!o || this.sponsor) return { error: 'Offer not available.' };
    this.sponsor = Object.assign({}, o, { progress: 0, weeksLeft: o.weeks });
    this.offers = [];
    this.addNews(`${this.bird.name} signs a sponsorship contract with ${o.name}.`);
    this.save();
    return { ok: true };
  }

  declineOffers() {
    this.offers = [];
    this.declinedSeason = this.season;
    this.save();
  }
}

export { TIERS, TRAINING, EXTRAS, SEASON_WEEKS, TRAVEL_MODES, GEAR };
