// Career mode: one bird's journey from unknown racer to world champion.
// Everything is saved on the device (localStorage) after every action.
import { ROSTER, BIRDS } from '../data/roster.js';
import { SPECIES, ratings } from '../data/species.js';
import { RACES } from '../data/races.js';
import { clamp, rand, shuffle, pick } from '../core/utils.js';
import {
  TIERS, TRAINING, EXTRAS, SEASON_WEEKS, START_MONEY, TRAINING_SLOTS, PRIZE_SPLIT, RP_TABLE,
  RACE_FATIGUE, SPONSOR_NAMES, MILESTONES,
} from './careerData.js';

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
      return new Career(d);
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
    for (const b of ROSTER) this.standings[b.id] = { rp: 0, races: 0, wins: 0, podiums: 0 };
    this.week = 1;
    this.generateEvents();
    this.makeOffers();
  }

  generateEvents() {
    const t = this.tier;
    if (this.isFinalWeek) {
      this.events = [this.makeEvent(t.cup, pick(t.races), pick(t.times), true, 0)];
      return;
    }
    const races = shuffle(t.races);
    this.events = [0, 1].map((i) => this.makeEvent(
      t.events[(this.week * 2 + i + this.season) % t.events.length],
      races[i % races.length], pick(t.times), false, i,
    ));
  }

  makeEvent(name, raceId, time, final, i) {
    const t = this.tier;
    const others = ROSTER.filter((b) => b.id !== this.birdId).map((b) => b.id);
    let field;
    if (final) {
      field = others.sort((a, b) => this.standings[b].rp - this.standings[a].rp).slice(0, 5);
    } else {
      field = shuffle(others).slice(0, 5);
    }
    const [lo, hi] = t.oppSpeed;
    const oppSpeed = field.map((id) => +clamp(rand(lo, hi) + (birdStrength(id) - 55) / 2500, lo - 0.01, hi + 0.01).toFixed(4));
    const distMul = raceId === 'r800' ? 1.25 : raceId === 'r400' ? 1.12 : 1;
    const top = t.prize * (final ? 3 : 1) * distMul;
    return {
      id: `${this.season}-${this.week}-${i}`,
      name, raceId, time, final,
      entry: final ? 0 : t.entry,
      prizes: PRIZE_SPLIT.map((f) => Math.round((top * f) / 5) * 5),
      rp: RP_TABLE.map((x) => x * t.rpMult * (final ? 2 : 1)),
      field, oppSpeed,
    };
  }

  // ------------------------------------------------------------------ training
  train(typeId, coach = false) {
    const tr = TRAINING[typeId];
    if (!tr) return { error: 'Unknown training.' };
    if (this.slotsLeft <= 0) return { error: 'No training sessions left this week. Race or skip to next week.' };
    const cost = coach ? this.price('coach') : 0;
    if (this.money < cost) return { error: `Not enough money for a coach ($${cost}).` };
    this.money -= cost;
    this.slotsUsed++;
    this.stats.trainingSessions++;
    let result;
    if (!tr.stat) {
      const before = this.fatigue;
      this.fatigue = clamp(this.fatigue + tr.fatigue * (coach ? 1.4 : 1), 0, 100);
      result = { type: typeId, fatigue: Math.round(this.fatigue - before) };
    } else {
      const cur = this.bonus[tr.stat];
      const eff = clamp(1.1 - this.fatigue / 100, 0.25, 1);
      const gain = tr.gain * (1 - cur / tr.cap) * eff * (coach ? 1.6 : 1) * rand(0.85, 1.15);
      this.bonus[tr.stat] = Math.min(tr.cap, cur + gain);
      const before = this.fatigue;
      this.fatigue = clamp(this.fatigue + tr.fatigue * (coach ? 1.15 : 1), 0, 100);
      result = { type: typeId, stat: tr.stat, label: tr.label, gain, fatigue: Math.round(this.fatigue - before), tired: eff < 0.6, nearCap: cur / tr.cap > 0.8 };
    }
    this.trainingLog.unshift({ season: this.season, week: this.week, type: typeId, coach, gain: result.gain || 0, fatigue: result.fatigue });
    this.trainingLog = this.trainingLog.slice(0, 30);
    this.save();
    return result;
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
  raceModifiers() {
    const pen = Math.max(0, this.fatigue - 35) * 0.0012;
    return {
      topSpeed: this.bonus.topSpeed - pen,
      accel: this.bonus.accel - pen,
      staminaCap: this.bonus.staminaCap,
      grip: this.bonus.grip,
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

    // trophies for the championship final
    if (ev.final && place && place <= 3) {
      const medal = ['Gold', 'Silver', 'Bronze'][place - 1];
      this.addTrophy({ id: `cup-${this.season}`, name: `${ev.name} — ${medal}`, icon: ['🏆', '🥈', '🥉'][place - 1], tier: t.id }, sum);
    }
    this.history.unshift({
      season: this.season, week: this.week, event: ev.name, raceId: ev.raceId, place,
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

  simulatedPlace(id) {
    const z = (birdStrength(id) - 55) / 15;
    return clamp(Math.round(3.5 - 1.3 * z + gauss()), 1, 6);
  }

  advanceWeek(sum, ran) {
    const t = this.tier;
    const final = this.isFinalWeek;
    // everyone else races somewhere this week
    for (const b of ROSTER) {
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
    return ROSTER.map((b) => ({ id: b.id, name: b.name, species: SPECIES[b.species].name, isPlayer: b.id === this.birdId, ...this.standings[b.id] }))
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

export { TIERS, TRAINING, EXTRAS, SEASON_WEEKS };
