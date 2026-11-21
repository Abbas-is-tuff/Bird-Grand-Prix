// Garage screen: change how your birds look, design brand-new birds, and buy career gear.
import { ROSTER, BIRDS } from '../data/roster.js';
import { SPECIES } from '../data/species.js';
import { PERSONALITIES } from '../ai/aiController.js';
import { renderPortraits } from './portraits.js';
import { GEAR, TIERS } from '../career/careerData.js';
import {
  SWATCHES, BAND_SWATCHES, ACCESSORIES, GOLD_BAND, COLOR_GROUPS, unlocked, getLook, setLook,
  newBirdDraft, saveCustomBird, deleteCustomBird, designFromColors, templateColors, colorsFromDesign,
} from '../core/garage.js';

const $ = (id) => document.getElementById(id);
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
const TABS = [['look', 'LOOK'], ['design', 'DESIGN'], ['gear', 'GEAR']];

export class GarageUI {
  constructor(game) {
    this.game = game;
    this.tab = 'look';
    this.birdId = null;
    this.draft = null; // a bird being designed (not saved yet)
    this.group = 'body';
    this.confirmDelete = false;
    $('garage').addEventListener('click', (e) => {
      const el = e.target.closest('[data-g]');
      if (!el || el.disabled) return;
      this.game.audio.unlock();
      this.command(el.dataset.g, el.dataset.v, el);
    });
    $('garage').addEventListener('input', (e) => {
      const el = e.target;
      if (el.dataset.in === 'name' && this.draft) this.draft.name = el.value.slice(0, 14);
      if (el.dataset.in === 'color' && this.draft) {
        this.draft.design[this.group] = el.value;
        this.preview(true);
      }
    });
    $('garage').addEventListener('change', (e) => {
      if (e.target.dataset.in === 'color') this.render();
    });
  }

  get career() {
    return this.game.career;
  }

  mine() {
    return ROSTER.filter((b) => b.mine);
  }

  open(id, tab, returnTo = 'menu') {
    if (tab) this.tab = tab;
    this.returnTo = returnTo;
    const list = this.mine();
    this.birdId = id && BIRDS[id]?.mine ? id : this.birdId && BIRDS[this.birdId] ? this.birdId : list[0].id;
    this.draft = null;
    this.confirmDelete = false;
    this.render();
    this.game.menus.show('garage');
    this.preview(true);
  }

  // the bird shown in 3D next to the panel
  preview(force = false) {
    if (this.draft) {
      // a temporary bird just for the preview
      BIRDS.__draft = { ...this.draft, id: '__draft', mods: {}, colors: colorsFromDesign(this.draft.species, this.draft.design) };
      this.game.previewBird('__draft', true);
      return;
    }
    this.game.previewBird(this.birdId, force);
  }

  refreshPortrait(id) {
    const b = BIRDS[id];
    if (!b) return;
    const p = renderPortraits(this.game.renderer, [b]);
    Object.assign(this.game.menus.portraits, p);
  }

  toast(t) {
    this.game.menus.toast(t, 2.6);
  }

  // ---------------------------------------------------------------- commands
  command(cmd, v) {
    switch (cmd) {
      case 'close':
        this.draft = null;
        delete BIRDS.__draft;
        if (this.returnTo === 'career' && this.career) {
          this.game.previewBird(this.career.birdId, true);
          this.game.careerUI.open('home');
          return;
        }
        this.game.menus.show('menu');
        this.game.previewBird(this.game.menus.sel.bird, true);
        this.game.toMenu();
        return;
      case 'tab':
        this.tab = v;
        this.confirmDelete = false;
        break;
      case 'bird':
        this.draft = null;
        this.birdId = v;
        this.confirmDelete = false;
        if (this.tab === 'design' && BIRDS[v].custom) this.startEdit(v);
        else if (this.tab === 'design') this.draft = null;
        this.preview(true);
        break;
      case 'new':
        this.draft = newBirdDraft();
        this.draft.isNew = true;
        this.tab = 'design';
        this.group = 'body';
        this.preview(true);
        break;
      case 'band':
        setLook(this.birdId, { band: v });
        this.preview(true);
        this.refreshPortrait(this.birdId);
        break;
      case 'acc': {
        const a = ACCESSORIES.find((x) => x.id === v);
        if (a.unlock && !unlocked(a.unlock, this.career)) {
          this.toast(`🔒 ${a.lockText}`);
          return;
        }
        setLook(this.birdId, { acc: v });
        this.preview(true);
        this.refreshPortrait(this.birdId);
        break;
      }
      case 'lockedband':
        this.toast(`🔒 ${GOLD_BAND.lockText}`);
        return;
      case 'acccolor':
        setLook(this.birdId, { accColor: v });
        this.preview(true);
        this.refreshPortrait(this.birdId);
        break;
      // ---- designing
      case 'species':
        this.draft.species = v;
        this.draft.design = designFromColors(v, templateColors(v));
        if (!COLOR_GROUPS.find((gr) => gr.id === this.group && (!gr.only || gr.only.includes(v)))) this.group = 'body';
        this.preview(true);
        break;
      case 'pers':
        this.draft.personality = v;
        break;
      case 'group':
        this.group = v;
        break;
      case 'swatch':
        this.draft.design[this.group] = v;
        this.preview(true);
        break;
      case 'save': {
        const name = (this.draft.name || '').trim();
        if (!name) {
          this.toast('Give your bird a name first.');
          return;
        }
        this.draft.name = name;
        const b = saveCustomBird(this.draft);
        delete BIRDS.__draft;
        this.refreshPortrait(b.id);
        this.toast(this.draft.isNew ? `🐣 ${b.name} has joined the Grand Prix!` : `Saved ${b.name}.`);
        this.birdId = b.id;
        this.startEdit(b.id);
        this.preview(true);
        break;
      }
      case 'cancel':
        this.draft = null;
        delete BIRDS.__draft;
        if (BIRDS[this.birdId]?.custom) this.startEdit(this.birdId);
        this.preview(true);
        break;
      case 'delete': {
        const id = this.birdId;
        if (this.career?.birdId === id) {
          this.toast('This bird is racing in your career. Retire the career first.');
          return;
        }
        if (!this.confirmDelete) {
          this.confirmDelete = true;
          break;
        }
        const name = BIRDS[id].name;
        deleteCustomBird(id);
        delete this.game.menus.portraits[id];
        if (this.game.menus.sel.bird === id) this.game.menus.sel.bird = 'abbas';
        this.draft = null;
        this.confirmDelete = false;
        this.birdId = this.mine()[0].id;
        this.toast(`${name} flew away.`);
        this.preview(true);
        break;
      }
      // ---- gear
      case 'buy': {
        const r = this.career.buyGear(v);
        if (r.error) {
          this.toast(r.error);
          return;
        }
        this.toast(`${GEAR[v].icon} ${r.item.name} bought!`);
        break;
      }
    }
    this.render();
  }

  startEdit(id) {
    const b = BIRDS[id];
    this.draft = { id: b.id, name: b.name, species: b.species, number: b.number, personality: b.personality, design: { ...b.design } };
  }

  // ---------------------------------------------------------------- drawing
  render() {
    if (this.tab === 'design' && !this.draft && BIRDS[this.birdId]?.custom) this.startEdit(this.birdId);
    const c = this.career;
    $('garage-money').textContent = c ? money(c.money) : '';
    const port = (id) => this.game.menus.portraits[id] || '';
    $('garage-birds').innerHTML = this.mine().map((b) => `
      <button class="gbird ${b.id === this.birdId && !this.draft?.isNew ? 'sel' : ''}" data-g="bird" data-v="${b.id}">
        ${port(b.id) ? `<img src="${port(b.id)}" alt="">` : `<div class="swatch" style="background:${b.colors.body}"></div>`}
        <span>${b.name}</span>${b.custom ? '<i>NEW</i>' : ''}
      </button>`).join('') + `<button class="gbird add ${this.draft?.isNew ? 'sel' : ''}" data-g="new"><b>＋</b><span>New bird</span></button>`;
    $('garage-tabs').innerHTML = TABS.map(([id, n]) => `<button class="${this.tab === id ? 'sel' : ''}" data-g="tab" data-v="${id}">${n}</button>`).join('');
    $('garage-body').innerHTML = this[`render_${this.tab}`]();
  }

  swatches(list, current, cmd, extra = '') {
    return `<div class="swatches">${list.map((col) => `<button class="sw ${col.toLowerCase() === (current || '').toLowerCase() ? 'sel' : ''}" style="background:${col}" data-g="${cmd}" data-v="${col}" title="${col}"></button>`).join('')}${extra}</div>`;
  }

  render_look() {
    if (this.draft?.isNew) return `<div class="muted">Save your new bird in DESIGN first, then come back to dress it up.</div>`;
    const b = BIRDS[this.birdId];
    const look = getLook(b.id);
    const goldOk = unlocked(GOLD_BAND.unlock, this.career);
    const bands = this.swatches(BAND_SWATCHES.filter((x) => x !== GOLD_BAND.color), look.band, 'band',
      goldOk ? `<button class="sw gold ${look.band === GOLD_BAND.color ? 'sel' : ''}" style="background:${GOLD_BAND.color}" data-g="band" data-v="${GOLD_BAND.color}" title="Gold"></button>`
        : `<button class="sw locked" data-g="lockedband" title="${GOLD_BAND.lockText}">🔒</button>`);
    const acc = look.acc || 'none';
    const accs = ACCESSORIES.map((a) => {
      const lock = a.unlock && !unlocked(a.unlock, this.career);
      return `<button class="${acc === a.id ? 'sel' : ''} ${lock ? 'lockd' : ''}" data-g="acc" data-v="${a.id}">${lock ? '🔒' : a.icon} ${a.name}</button>`;
    }).join('');
    const cur = ACCESSORIES.find((a) => a.id === acc);
    return `
      <div class="label">LEG BAND <span class="muted" style="letter-spacing:0">— the coloured ring on ${b.name}'s leg</span></div>
      ${bands}
      ${goldOk ? '' : `<div class="muted small">🔒 Gold band: ${GOLD_BAND.lockText.toLowerCase()}.</div>`}
      <div class="label">ACCESSORY</div>
      <div class="seg acc-seg">${accs}</div>
      ${cur?.colored ? `<div class="label">ACCESSORY COLOUR</div>${this.swatches(SWATCHES, look.accColor || '#e0392b', 'acccolor')}` : ''}
      ${acc === 'vest' ? `<div class="muted small">The vest shows ${b.name}'s race number: ${b.number}.</div>` : ''}
      <div class="muted small" style="margin-top:12px">Looks are just for fun — they don't change speed. ${b.name} wears them in every race.</div>`;
  }

  render_design() {
    if (!this.draft) {
      const b = BIRDS[this.birdId];
      return `<div class="ccard"><h4>${b.name} is a real bird</h4>
        <div class="muted">${b.name}'s feathers are painted to match the real ${b.name}, so they can't be changed here. Change the band and accessory in LOOK, or design a brand-new bird of your own.</div>
        <div class="cbtns"><button class="btn primary" data-g="new">＋ DESIGN A NEW BIRD</button></div></div>`;
    }
    const d = this.draft;
    const groups = COLOR_GROUPS.filter((gr) => !gr.only || gr.only.includes(d.species));
    const cur = d.design[this.group];
    const sp = SPECIES[d.species];
    return `
      <div class="label">NAME</div>
      <input class="gname" data-in="name" maxlength="14" value="${d.name.replace(/"/g, '&quot;')}" placeholder="Bird name">
      <div class="label">SPECIES <span class="muted" style="letter-spacing:0">— decides body shape, running style and stats</span></div>
      <div class="seg">${Object.values(SPECIES).map((s) => `<button class="${d.species === s.id ? 'sel' : ''}" data-g="species" data-v="${s.id}">${s.name}</button>`).join('')}</div>
      <div class="muted small" style="margin-top:4px">${sp.blurb}</div>
      <div class="label">FEATHER COLOURS</div>
      <div class="seg groups">${groups.map((gr) => `<button class="${this.group === gr.id ? 'sel' : ''}" data-g="group" data-v="${gr.id}"><i class="dotc" style="background:${d.design[gr.id]}"></i>${gr.name}</button>`).join('')}</div>
      ${this.swatches(SWATCHES, cur, 'swatch', `<label class="sw picker" title="Any colour"><input type="color" data-in="color" value="${cur}">🎨</label>`)}
      <div class="label">RACING STYLE <span class="muted" style="letter-spacing:0">— how it races when the computer runs it</span></div>
      <div class="seg">${Object.entries(PERSONALITIES).map(([id, p]) => `<button class="${d.personality === id ? 'sel' : ''}" data-g="pers" data-v="${id}">${p.label}</button>`).join('')}</div>
      <div class="cbtns">
        <button class="btn primary" data-g="save">${d.isNew ? '🐣 HATCH THIS BIRD' : 'SAVE CHANGES'}</button>
        ${d.isNew ? '<button class="btn" data-g="cancel">CANCEL</button>' : `<button class="btn ${this.confirmDelete ? 'danger' : ''}" data-g="delete">${this.confirmDelete ? 'TAP AGAIN TO DELETE' : 'DELETE BIRD'}</button>`}
      </div>
      <div class="muted small" style="margin-top:8px">Race #${d.number}. Designed birds race in Quick Race, can start a Career, and sometimes turn up as rivals.</div>`;
  }

  render_gear() {
    const c = this.career;
    if (!c) {
      return `<div class="ccard"><h4>Gear is for Career mode</h4><div class="muted">Start a career to buy gear with your prize money. Gear makes your career bird a little faster, fitter and grippier.</div></div>`;
    }
    const rows = Object.entries(GEAR).map(([id, g]) => {
      const lv = c.gear[id] || 0;
      const now = g.levels[lv];
      const next = g.levels[lv + 1];
      let btn;
      if (!next) btn = '<span class="muted"><b>MAX</b></span>';
      else if (c.tierIndex < next.minTier) btn = `<button class="btn" disabled>🔒 ${TIERS[next.minTier].name.toUpperCase()}</button>`;
      else btn = `<button class="btn ${c.money >= next.cost ? 'primary' : ''}" data-g="buy" data-v="${id}" ${c.money >= next.cost ? '' : 'disabled'}>${next.name.toUpperCase()} ${money(next.cost)}</button>`;
      const pips = g.levels.slice(1).map((_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
      return `<div class="ccard gear">
        <div class="eh"><h4>${g.icon} ${g.name}</h4><span class="pips">${pips}</span></div>
        <div class="muted">Now: <b>${now.name}</b>${now.bonus ? ` (+${(now.bonus * 100).toFixed(1)}% ${g.statName})` : ''}${next ? `<br>Next: ${next.name} → +${(next.bonus * 100).toFixed(1)}% ${g.statName}` : ''}</div>
        <div class="cbtns">${btn}</div>
      </div>`;
    }).join('');
    return `<div class="muted" style="margin-bottom:8px">Gear for <b>${c.bird.name}</b>, your career bird. Upgrades last forever and stack with training.</div><div class="cgrid">${rows}</div>`;
  }
}
