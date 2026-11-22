// Multiplayer screen (Phase 6): two players on one device, or online rooms.
import { ROSTER, BIRDS } from '../data/roster.js';
import { RACES, RACE_LIST } from '../data/races.js';
import { VENUE_LIST, VENUES } from '../data/venues.js';
import { ONLINE_RACES } from '../net/online.js';
import { shuffle } from '../core/utils.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export class MultiplayerUI {
  constructor(game) {
    this.game = game;
    this.tab = 'local';
    this.local = { p1: 'abbas', p2: 'cookie', race: 'r100', venue: 'featherfield', ai: 2 };
    this.joinCode = '';
    this.busy = false;
    this.msg = '';
    const s = game.online;
    s.on('peers', () => this.current() && this.tab === 'online' && this.render());
    $('multi').addEventListener('click', (e) => {
      const el = e.target.closest('[data-m]');
      if (!el || el.disabled) return;
      this.game.audio.unlock();
      this.command(el.dataset.m, el.dataset.v);
    });
    $('multi').addEventListener('input', (e) => {
      if (e.target.dataset.in === 'code') this.joinCode = e.target.value;
    });
  }

  current() {
    return this.game.menus.current === 'multi';
  }

  open(tab) {
    if (tab) this.tab = tab;
    this.local.p1 = this.game.menus.sel.bird || this.local.p1;
    this.render();
    this.game.menus.show('multi');
    this.game.previewBird(this.tab === 'local' ? this.local.p1 : this.game.menus.sel.bird);
    if (this.game.online.available == null) this.game.online.check().then(() => this.current() && this.render());
  }

  toast(t) {
    this.game.menus.toast(t, 2.8);
  }

  async command(cmd, v) {
    const g = this.game;
    const s = g.online;
    switch (cmd) {
      case 'close':
        g.menus.show('menu');
        g.toMenu();
        return;
      case 'tab':
        this.tab = v;
        break;
      case 'p1':
      case 'p2':
        this.local[cmd] = v;
        g.previewBird(v);
        break;
      case 'race':
        this.local.race = v;
        break;
      case 'venue':
        this.local.venue = v;
        break;
      case 'ai':
        this.local.ai = +v;
        break;
      case 'start-local': {
        const L = this.local;
        const opp = shuffle(ROSTER.filter((b) => !b.custom && b.id !== L.p1 && b.id !== L.p2).map((b) => b.id)).slice(0, L.ai);
        g.menus.hideAll();
        g.startRace({ bird: L.p1, player2: L.p2, race: L.race, venue: L.venue, time: VENUES[L.venue].indoor ? 'indoor' : 'day', difficulty: 'normal', opponents: opp });
        return;
      }
      // ---- online
      case 'newroom':
        this.joinCode = Math.random().toString(36).slice(2, 6);
        await this.join();
        return;
      case 'join':
        await this.join();
        return;
      case 'leave':
        await s.leave();
        break;
      case 'mybird':
        g.menus.sel.bird = v;
        g.previewBird(v);
        s.publishBird();
        break;
      case 'ready':
        s.set({ ready: !s.state.ready });
        break;
      case 'ocfg': {
        const [k, val] = v.split(':');
        s.set({ cfg: { ...s.hostConfig(), [k]: val } });
        break;
      }
      case 'ostart':
        if (!s.startRace()) this.toast('You need at least one other player who is READY.');
        break;
    }
    this.render();
  }

  async join() {
    this.busy = true;
    this.render();
    try {
      await this.game.online.join(this.joinCode);
      this.msg = '';
    } catch (e) {
      this.msg = e?.message || 'Could not join that room.';
    }
    this.busy = false;
    this.render();
  }

  render() {
    $('multi-tabs').innerHTML = [['local', 'SAME DEVICE'], ['online', 'ONLINE']]
      .map(([id, n]) => `<button class="${this.tab === id ? 'sel' : ''}" data-m="tab" data-v="${id}">${n}</button>`).join('');
    $('multi-body').innerHTML = this.tab === 'local' ? this.renderLocal() : this.renderOnline();
  }

  birdStrip(cmd, current, list = ROSTER) {
    const port = this.game.menus.portraits;
    return `<div class="garage-birds mstrip">${list.filter((b) => !b.net).map((b) => `
      <button class="gbird ${b.id === current ? 'sel' : ''}" data-m="${cmd}" data-v="${b.id}">
        ${port[b.id] ? `<img src="${port[b.id]}" alt="">` : `<div class="swatch" style="background:${b.colors.body}"></div>`}
        <span>${esc(b.name)}</span></button>`).join('')}</div>`;
  }

  seg(cmd, items, cur) {
    return `<div class="seg">${items.map(([id, name, dis]) => `<button class="${id === cur ? 'sel' : ''}" data-m="${cmd}" data-v="${id}" ${dis ? 'disabled' : ''}>${name}</button>`).join('')}</div>`;
  }

  renderLocal() {
    const L = this.local;
    return `
      <div class="muted">Two players on one keyboard or one iPad. Each player holds their own side of the screen.</div>
      <div class="label">PLAYER 1 <span class="muted" style="letter-spacing:0">— keys W run, Left Shift sprint, A / D steer, Space jump • touch: left side</span></div>
      ${this.birdStrip('p1', L.p1)}
      <div class="label">PLAYER 2 <span class="muted" style="letter-spacing:0">— keys ↑ run, Right Shift sprint, ← / → steer, ↓ jump • touch: right side</span></div>
      ${this.birdStrip('p2', L.p2)}
      <div class="label">RACE</div>
      ${this.seg('race', RACE_LIST.filter((r) => !r.elimination || true).map((r) => [r.id, r.name]), L.race)}
      <div class="muted small" style="margin-top:4px">${RACES[L.race].tip}</div>
      <div class="label">STADIUM</div>
      ${this.seg('venue', VENUE_LIST.map((v) => [v.id, `${v.icon} ${v.name}`]), L.venue)}
      <div class="label">COMPUTER BIRDS</div>
      ${this.seg('ai', [['0', 'None — just us'], ['2', '2 birds'], ['4', '4 birds']], String(L.ai))}
      <div class="cbtns"><button class="btn primary" data-m="start-local" ${L.p1 === L.p2 ? 'disabled' : ''}>START 2-PLAYER RACE</button></div>
      ${L.p1 === L.p2 ? '<div class="muted small">Pick two different birds.</div>' : ''}`;
  }

  renderOnline() {
    const s = this.game.online;
    if (s.available == null) return '<div class="muted">Checking if online play works here…</div>';
    if (!s.available) {
      return `<div class="ccard"><h4>🌐 Online play isn't available here</h4>
        <div class="muted">Online races work when the game is opened from its <b>Claude page</b> (the link Claude gave you), not from GitHub Pages or a downloaded file.
        Your friend needs to be signed in to Claude and invited to the page (use the page's <b>Share</b> menu).<br><br>
        On this device you can still play <b>SAME DEVICE</b> with a friend.</div></div>`;
    }
    if (!s.connected) {
      return `
        <div class="muted">Race friends on other devices in real time. One of you makes a room, the others type the same code.</div>
        <div class="cbtns"><button class="btn primary" data-m="newroom" ${this.busy ? 'disabled' : ''}>＋ NEW ROOM</button></div>
        <div class="label">OR JOIN A ROOM</div>
        <div class="joinrow"><input class="gname" data-in="code" maxlength="8" placeholder="Room code" value="${esc(this.joinCode)}" autocapitalize="off" autocomplete="off">
        <button class="btn" data-m="join" ${this.busy ? 'disabled' : ''}>${this.busy ? 'JOINING…' : 'JOIN'}</button></div>
        ${this.msg ? `<div class="muted" style="color:#ff8a7a;margin-top:6px">${esc(this.msg)}</div>` : ''}
        <div class="muted small" style="margin-top:12px">Your friend must be signed in to Claude and invited to this page with the <b>Share</b> menu. Everyone in a room sees everyone's bird and race.</div>`;
    }
    const players = s.players();
    const host = s.host();
    const amHost = s.isHost();
    const cfg = s.hostConfig();
    const port = this.game.menus.portraits;
    const list = players.map((p) => {
      const b = p.presence.bird || {};
      const me = p.peer === s.me;
      const known = BIRDS[b.id] && !BIRDS[b.id].custom && !BIRDS[b.id].net;
      const img = (me || known) && port[b.id] ? `<img src="${port[b.id]}" alt="">` : `<div class="swatch" style="background:${/^#[0-9a-f]{6}$/i.test(b.colors?.body || '') ? b.colors.body : '#888'}"></div>`;
      return `<div class="mplayer ${me ? 'me' : ''}">${img}<b>${esc(String(b.name || 'Player').slice(0, 14))}</b>
        <span class="muted">#${(b.number | 0) || '?'}${p.guest ? ' • guest' : ''}</span>
        <span class="tagx">${p === host ? '👑 HOST' : p.presence.ready ? '✅ READY' : '… not ready'}${me ? ' • YOU' : ''}</span></div>`;
    }).join('') || '<div class="muted">Connecting…</div>';
    const readyCount = players.filter((p) => p.peer !== host?.peer && p.presence.ready).length;
    const hostControls = amHost ? `
      <div class="label">RACE <span class="muted" style="letter-spacing:0">— you're the host, you choose</span></div>
      ${this.seg('ocfg', ONLINE_RACES.map((id) => [`race:${id}`, RACES[id].name]), `race:${cfg.race}`)}
      <div class="label">STADIUM</div>
      ${this.seg('ocfg', VENUE_LIST.map((v) => [`venue:${v.id}`, `${v.icon} ${v.name}`]), `venue:${cfg.venue}`)}
      <div class="cbtns"><button class="btn primary" data-m="ostart" ${readyCount ? '' : 'disabled'}>START RACE (${readyCount + 1} birds)</button></div>
      ${readyCount ? '' : '<div class="muted small">Waiting for another player to press READY.</div>'}`
      : `<div class="ccard"><h4>Next race: ${RACES[cfg.race].name}</h4><div class="muted">${VENUES[cfg.venue]?.icon || ''} ${VENUES[cfg.venue]?.name || ''}. The host starts the race when everyone is ready.</div>
        <div class="cbtns"><button class="btn ${s.state.ready ? '' : 'primary'}" data-m="ready">${s.state.ready ? 'NOT READY' : "I'M READY"}</button></div></div>`;
    return `
      <div class="roomcode">ROOM <b>${esc(s.code.toUpperCase())}</b><button class="btn small ghost" data-m="leave">LEAVE</button></div>
      <div class="muted small">Tell your friends this code. They open this same game page, go to MULTIPLAYER → ONLINE and join it.</div>
      <div class="label">PLAYERS (${players.length})</div>
      <div class="mplayers">${list}</div>
      <div class="label">YOUR BIRD</div>
      ${this.birdStrip('mybird', this.game.menus.sel.bird, ROSTER.filter((b) => b.mine || true))}
      ${hostControls}`;
  }
}
