// Online multiplayer (Phase 6).
// Uses the "room" feature of the Claude page this game is published on: everyone who has the
// game open and joins the same room code can race together. It only works on the Claude page
// (not on GitHub Pages), and only for people the page is shared with.
//
// How it works, simply:
//  - Each player keeps a small "presence" note up to date: name, bird, ready, and during a race
//    where their bird is (x, z, speed...) about 15 times a second.
//  - The HOST is the player whose id sorts first. The host picks the race and presses START,
//    which puts a "go" note (race, venue, lanes) in the host's presence.
//  - Every game then runs the race itself. Your own bird uses normal physics; the other players'
//    birds are moved to where their games say they are (NetController).
//  - Each game times its own bird from its own starting gun, so times are fair.
import { BIRDS } from '../data/roster.js';
import { RACES } from '../data/races.js';
import { getLook, setTempLook } from '../core/garage.js';
import { dampAngle, clamp } from '../core/utils.js';
import { Emitter } from '../core/utils.js';

export const ONLINE_RACES = ['r60', 'r100', 'h100', 'r200', 'r400', 'h400', 'r800'];
const SEND_HZ = 15;

export class OnlineSession extends Emitter {
  constructor(game) {
    super();
    this.game = game;
    this.lobby = null; // the page's room (null = online not available here)
    this.room = null; // the named room for our code
    this.code = null;
    this.peers = [];
    this.me = null; // my peer label
    this.state = { v: 1, ready: false };
    this.lastGoSeq = 0;
    this.goSeq = 0;
    this.sendT = 0;
    this.available = null; // null = still checking
    this.unsub = null;
  }

  // Is online play possible on this page? (resolves true/false)
  async check() {
    if (this.available != null) return this.available;
    try {
      const use = window.claude && window.claude.use;
      this.lobby = use ? await window.claude.use('room') : null;
    } catch (e) {
      this.lobby = null;
    }
    this.available = !!this.lobby;
    return this.available;
  }

  get connected() {
    return !!this.room;
  }

  async join(code) {
    code = String(code || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
    if (!code) throw new Error('Type a room code.');
    if (!(await this.check())) throw new Error('Online play only works on the Claude page.');
    await this.leave();
    this.room = await this.lobby.join('bgp-' + code);
    this.code = code;
    this.lastGoSeq = 0;
    this.state = { v: 1, ready: false };
    this.unsub = this.room.onPeers((ch) => {
      this.peers = ch.peers.filter((p) => p.kind === 'viewer');
      const mine = this.peers.find((p) => p.sameTab);
      if (mine) this.me = mine.peer;
      this.emit('peers', this.peers);
      this.checkGo();
    });
    this.publishBird();
    return code;
  }

  async leave() {
    if (this.unsub) this.unsub();
    this.unsub = null;
    if (this.room) {
      try {
        await this.room.leave();
      } catch (e) { /* ignore */ }
    }
    this.room = null;
    this.code = null;
    this.peers = [];
    this.emit('peers', this.peers);
  }

  set(patch) {
    Object.assign(this.state, patch);
    for (const k in patch) if (patch[k] === null) delete this.state[k];
    if (this.room) this.room.presence(patch).catch(() => {});
  }

  // Tell everyone which bird I race with (all its colours, so designed birds work on their device too).
  publishBird() {
    const b = BIRDS[this.game.menus.sel.bird] || BIRDS.abbas;
    this.set({
      bird: { id: b.id, name: b.name, species: b.species, number: b.number, colors: b.colors, look: getLook(b.id) },
    });
  }

  // ------------------------------------------------------------- who is who
  players() {
    // people who have told us their bird, sorted by id; the first one is the host
    return this.peers.filter((p) => p.presence && p.presence.bird).sort((a, b) => (a.peer < b.peer ? -1 : 1));
  }

  host() {
    return this.players()[0] || null;
  }

  isHost() {
    const h = this.host();
    return !!h && h.peer === this.me;
  }

  hostConfig() {
    const h = this.host();
    const cfg = h?.presence?.cfg || {};
    return {
      race: ONLINE_RACES.includes(cfg.race) ? cfg.race : 'r100',
      venue: typeof cfg.venue === 'string' ? cfg.venue : 'featherfield',
      time: typeof cfg.time === 'string' ? cfg.time : 'day',
    };
  }

  // host only: start a race for everyone who is ready (the host is always in)
  startRace() {
    if (!this.isHost()) return false;
    const ps = this.players().filter((p) => p.peer === this.me || p.presence.ready);
    if (ps.length < 2) return false;
    const lanePool = ps.length <= 6 ? [2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6, 7, 8];
    const lanes = {};
    ps.slice(0, 8).forEach((p, i) => { lanes[p.peer] = lanePool[i]; });
    this.goSeq = Math.max(this.goSeq, this.lastGoSeq) + 1;
    const cfg = this.hostConfig();
    this.set({ go: { seq: this.goSeq, ...cfg, lanes, hold: +(1.4 + Math.random()).toFixed(2), at: Date.now() } });
    return true;
  }

  // everyone: has the host just said GO?
  checkGo() {
    const h = this.host();
    const go = h?.presence?.go;
    if (!go || typeof go.seq !== 'number' || go.seq <= this.lastGoSeq) return;
    if (Date.now() - (go.at || 0) > 20000 && this.lastGoSeq === 0 && h.peer !== this.me) {
      // an old start from before we arrived: wait for the next one
      this.lastGoSeq = go.seq;
      return;
    }
    this.lastGoSeq = go.seq;
    if (!go.lanes || !go.lanes[this.me]) return; // not in this race
    if (!RACES[go.race] || !ONLINE_RACES.includes(go.race)) return;
    const remotes = [];
    for (const p of this.players()) {
      if (p.peer === this.me || !go.lanes[p.peer]) continue;
      remotes.push({ key: p.peer, birdId: this.remoteBird(p), lane: clamp(go.lanes[p.peer] | 0, 1, 8) });
    }
    this.set({ rs: null, ready: false });
    this.emit('go', { go, remotes, lane: clamp(go.lanes[this.me] | 0, 1, 8) });
  }

  // turn another player's presence into a bird our game can build
  remoteBird(p) {
    const src = p.presence.bird || {};
    const id = 'net-' + p.peer.replace(/[^a-z0-9]/gi, '').slice(0, 20);
    const base = BIRDS[src.id] && !BIRDS[src.id].custom ? BIRDS[src.id] : null;
    const species = ['lovebird', 'cockatiel', 'pigeon', 'parrot', 'budgerigar', 'canary', 'roadrunner', 'quail'].includes(src.species) ? src.species : base?.species || 'lovebird';
    const colors = {};
    if (src.colors && typeof src.colors === 'object') {
      for (const [k, v] of Object.entries(src.colors)) if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) colors[k] = v;
    }
    BIRDS[id] = {
      id, name: String(src.name || 'Player').slice(0, 14), species, number: (src.number | 0) || 99,
      personality: 'consistent', trait: 'Online player', mods: {},
      colors: Object.keys(colors).length ? colors : base?.colors || BIRDS.abbas.colors, net: true,
    };
    const look = src.look && typeof src.look === 'object' ? src.look : {};
    setTempLook(id, {
      band: /^#[0-9a-f]{6}$/i.test(look.band || '') ? look.band : undefined,
      acc: ['none', 'headband', 'cap', 'goggles', 'scarf', 'vest', 'crown'].includes(look.acc) ? look.acc : 'none',
      accColor: /^#[0-9a-f]{6}$/i.test(look.accColor || '') ? look.accColor : undefined,
    });
    return id;
  }

  // ------------------------------------------------------------- racing
  // called every frame by the game during an online race
  sendRaceState(race, dt) {
    if (!this.room) return;
    this.sendT -= dt;
    const p = race.player;
    const finishedNow = p.finished && !this.sentFinish;
    if (this.sendT > 0 && !finishedNow) return;
    this.sendT = 1 / SEND_HZ;
    if (p.finished) this.sentFinish = true;
    const b = p.body;
    const r2 = (v) => Math.round(v * 100) / 100;
    this.set({
      rs: {
        seq: this.lastGoSeq, x: r2(b.x), z: r2(b.z), h: r2(b.h), vx: r2(b.vx), vz: r2(b.vz), y: r2(b.y), p: r2(p.progress),
        ft: p.finished && !p.dq ? Math.round(p.finishTime * 1000) / 1000 : null, dq: p.dq || null, rt: r2(race.raceTime),
      },
    });
  }

  remoteState(key) {
    const p = this.peers.find((x) => x.peer === key);
    const rs = p?.presence?.rs;
    if (!rs || rs.seq !== this.lastGoSeq) return null;
    return { rs, at: p.updatedAt };
  }
}

// Moves another player's bird to where their game says it is, smoothly.
export class NetController {
  constructor(racer, race, session) {
    this.r = racer;
    this.race = race;
    this.s = session;
  }

  newRace() {}

  update(dt) {
    const r = this.r;
    const b = r.body;
    const got = this.s.remoteState(r.netKey);
    if (!got) {
      b.speed = 0;
      b.vx = b.vz = 0;
      return;
    }
    const st = got.rs;
    const age = clamp((Date.now() - got.at) / 1000, 0, 0.3);
    const tx = st.x + st.vx * age;
    const tz = st.z + st.vz * age;
    const dx = tx - b.x, dz = tz - b.z;
    if (dx * dx + dz * dz > 16) {
      b.x = tx;
      b.z = tz;
    } else {
      const k = Math.min(1, dt * 10);
      b.x += dx * k;
      b.z += dz * k;
    }
    const prevSpeed = b.speed;
    b.vx = st.vx;
    b.vz = st.vz;
    b.speed = Math.hypot(st.vx, st.vz);
    b.accel = (b.speed - prevSpeed) / Math.max(dt, 1e-3);
    b.accel = clamp(b.accel, -8, 8);
    b.h = dampAngle(b.h, st.h, 10, dt);
    b.y = Math.max(0, st.y || 0);
    b.latAcc = 0;
    b.yawRate = 0;
    b.slip = 0;
    b.stamina = 1;
    if (st.dq && !r.dq) {
      r.dq = String(st.dq).slice(0, 20);
      if (!r.finished) {
        r.finished = true;
        r.finishTime = null;
      }
    }
    if (st.ft != null && typeof st.ft === 'number') {
      r.finishTime = st.ft; // their own time, from their own gun
      r.netFinished = true;
    }
  }
}
