// All textures are painted in code at start-up (no image files needed, no copyright worries).
import * as THREE from 'three';
import { mulberry32 } from '../core/utils.js';

const cache = {};
let maxAniso = 4;

export function setMaxAnisotropy(a) {
  maxAniso = a;
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(c, { srgb = true, repeat = [1, 1], wrap = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (wrap) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = maxAniso;
  t.needsUpdate = true;
  return t;
}

// Fills pixels with a base colour plus random grain.
function grain(ctx, w, h, base, amount, seed, speckle = 0) {
  const rng = mulberry32(seed);
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let i = 0; i < w * h; i++) {
    let n = (rng() - 0.5) * amount;
    if (speckle && rng() < speckle) n -= amount * 1.2 * rng();
    d[i * 4] = base[0] + n;
    d[i * 4 + 1] = base[1] + n;
    d[i * 4 + 2] = base[2] + n;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

export function tartanTextures() {
  if (cache.tartan) return cache.tartan;
  const w = 512;
  const c = canvas(w, w);
  const ctx = c.getContext('2d');
  grain(ctx, w, w, [176, 62, 48], 26, 11, 0.08);
  // rubber granules
  const rng = mulberry32(5);
  for (let i = 0; i < 2600; i++) {
    const v = rng();
    ctx.fillStyle = v < 0.5 ? 'rgba(120,30,22,0.55)' : 'rgba(210,95,75,0.35)';
    const r = 0.6 + rng() * 1.4;
    ctx.beginPath();
    ctx.arc(rng() * w, rng() * w, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const bc = canvas(256, 256);
  grain(bc.getContext('2d'), 256, 256, [128, 128, 128], 90, 23, 0.15);
  cache.tartan = {
    map: toTexture(c, { repeat: [0.25, 0.25] }),
    bump: toTexture(bc, { srgb: false, repeat: [0.5, 0.5] }),
  };
  return cache.tartan;
}

export function grassTextures() {
  if (cache.grass) return cache.grass;
  // Infield: mowing stripes + detail
  const W = 1024, H = 512;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const stripes = 14;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? '#4f8a33' : '#5c9a3b';
    ctx.fillRect((i * W) / stripes, 0, W / stripes + 1, H);
  }
  const rng = mulberry32(77);
  for (let i = 0; i < 26000; i++) {
    const g = 90 + rng() * 90;
    ctx.fillStyle = `rgba(${g * 0.45},${g},${g * 0.35},${0.12 + rng() * 0.2})`;
    ctx.fillRect(rng() * W, rng() * H, 1 + rng() * 2, 1 + rng() * 3);
  }
  // Detail grass for close-ups (tiles a lot)
  const d = canvas(256, 256);
  const dctx = d.getContext('2d');
  grain(dctx, 256, 256, [92, 140, 62], 40, 9);
  for (let i = 0; i < 3000; i++) {
    const g = 70 + rng() * 120;
    dctx.strokeStyle = `rgba(${g * 0.5},${g},${g * 0.3},0.6)`;
    dctx.beginPath();
    const x = rng() * 256, y = rng() * 256;
    dctx.moveTo(x, y);
    dctx.lineTo(x + (rng() - 0.5) * 3, y - 2 - rng() * 5);
    dctx.stroke();
  }
  cache.grass = {
    infield: toTexture(c, { repeat: [1, 1], wrap: false }),
    detail: toTexture(d, { repeat: [60, 60] }),
    detailBump: toTexture(d, { srgb: false, repeat: [60, 60] }),
  };
  return cache.grass;
}

export function groundTexture() {
  if (cache.ground) return cache.ground;
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  grain(ctx, 256, 256, [88, 128, 60], 34, 31);
  cache.ground = toTexture(c, { repeat: [90, 90] });
  return cache.ground;
}

export function concreteTexture() {
  if (cache.concrete) return cache.concrete;
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  grain(ctx, 256, 256, [168, 166, 160], 22, 41, 0.03);
  cache.concrete = toTexture(c, { repeat: [20, 20] });
  return cache.concrete;
}

// Body feathers: overlapping scallops (grey so it can be tinted by the bird's colours).
export function featherTextures() {
  if (cache.feather) return cache.feather;
  const S = 256;
  const c = canvas(S, S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgb(225,225,225)';
  ctx.fillRect(0, 0, S, S);
  const cols = 10, rows = 14;
  const fw = S / cols, fh = S / rows;
  for (let r = -1; r <= rows + 1; r++) {
    for (let col = -1; col <= cols + 1; col++) {
      const x = col * fw + (r % 2 ? fw / 2 : 0);
      const y = r * fh;
      const g = ctx.createRadialGradient(x, y + fh * 0.2, 1, x, y + fh * 0.45, fw * 0.75);
      g.addColorStop(0, 'rgb(255,255,255)');
      g.addColorStop(0.7, 'rgb(244,244,244)');
      g.addColorStop(1, 'rgb(212,212,212)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y + fh * 0.35, fw * 0.62, fh * 1.05, 0, 0, Math.PI);
      ctx.fill();
      ctx.strokeStyle = 'rgba(140,140,140,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x, y + fh * 0.35, fw * 0.62, fh * 1.05, 0, 0.15, Math.PI - 0.15);
      ctx.stroke();
    }
  }
  // fine barbs
  const rng = mulberry32(3);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  for (let i = 0; i < 900; i++) {
    const x = rng() * S, y = rng() * S;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rng() - 0.5) * 4, y + 3 + rng() * 4);
    ctx.stroke();
  }
  const map = toTexture(c, { repeat: [6, 9] });
  const bump = toTexture(c, { srgb: false, repeat: [6, 9] });
  cache.feather = { map, bump };
  return cache.feather;
}

// Single flight/tail feather: central shaft + barbs. u across the vane, v along it.
export function vaneTexture() {
  if (cache.vane) return cache.vane;
  const w = 64, h = 256;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgb(200,200,200)');
  g.addColorStop(0.42, 'rgb(246,246,246)');
  g.addColorStop(0.5, 'rgb(255,255,255)');
  g.addColorStop(0.58, 'rgb(246,246,246)');
  g.addColorStop(1, 'rgb(196,196,196)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // barbs (angled toward the tip)
  ctx.lineWidth = 1;
  for (let y = -40; y < h + 40; y += 3) {
    ctx.strokeStyle = `rgba(150,150,150,${0.25 + ((y * 7) % 10) / 40})`;
    ctx.beginPath();
    ctx.moveTo(w / 2, y);
    ctx.lineTo(0, y - 18);
    ctx.moveTo(w / 2, y);
    ctx.lineTo(w, y - 18);
    ctx.stroke();
  }
  // rachis (shaft)
  ctx.fillStyle = 'rgb(255,255,250)';
  ctx.fillRect(w / 2 - 1.5, 0, 3, h);
  // canvas top = tip (v=1)
  const t = toTexture(c, { wrap: false });
  cache.vane = t;
  return t;
}

export function scaleTexture() {
  if (cache.scales) return cache.scales;
  const S = 64;
  const c = canvas(S, S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgb(225,225,225)';
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(90,90,90,0.55)';
  for (let y = 0; y < S; y += 8) {
    for (let x = (y / 8) % 2 ? 4 : 0; x < S; x += 8) {
      ctx.strokeRect(x + 0.5, y + 0.5, 7, 7);
    }
  }
  const t = toTexture(c, { repeat: [2, 6] });
  cache.scales = t;
  return t;
}

// Soft round shadow under each bird (contact shadow).
export function blobTexture() {
  if (cache.blob) return cache.blob;
  const S = 128;
  const c = canvas(S, S);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.75)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.35)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  cache.blob = t;
  return t;
}

// Fictional sponsors - all names invented for this game.
export const SPONSORS = [
  { name: 'SEEDCO', bg: '#123a7a', fg: '#ffd23c' },
  { name: 'FEATHER FUEL', bg: '#d8262a', fg: '#ffffff' },
  { name: 'MILLET MART', bg: '#f2c230', fg: '#2a1a08' },
  { name: 'PERCH AIR', bg: '#0f6b5a', fg: '#ffffff' },
  { name: 'NEST HOMES', bg: '#ffffff', fg: '#20304a' },
  { name: 'CHIRP MOBILE', bg: '#6a2bb8', fg: '#ffffff' },
  { name: 'WINGSPAN TV', bg: '#111111', fg: '#38c6ff' },
  { name: 'SKYWAY BANK', bg: '#0c4fa8', fg: '#ffffff' },
];

export function adTexture(i) {
  const key = 'ad' + i;
  if (cache[key]) return cache[key];
  const sp = SPONSORS[i % SPONSORS.length];
  const c = canvas(512, 64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = sp.bg;
  ctx.fillRect(0, 0, 512, 64);
  ctx.fillStyle = sp.fg;
  ctx.font = 'italic 900 40px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sp.name, 256, 34);
  const t = toTexture(c, { wrap: false });
  cache[key] = t;
  return t;
}

export function textTexture(text, { w = 128, h = 128, font = 'bold 96px Arial', color = '#ffffff', bg = null } = {}) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 4);
  const t = toTexture(c, { wrap: false });
  return t;
}

export function windowsTexture() {
  if (cache.windows) return cache.windows;
  const c = canvas(128, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8d97a3';
  ctx.fillRect(0, 0, 128, 256);
  const rng = mulberry32(99);
  for (let y = 6; y < 256; y += 14) {
    for (let x = 6; x < 128; x += 14) {
      const lit = rng();
      ctx.fillStyle = lit > 0.75 ? '#f6e7b0' : lit > 0.4 ? '#56708c' : '#3d4d60';
      ctx.fillRect(x, y, 9, 9);
    }
  }
  cache.windows = toTexture(c, { repeat: [1, 1] });
  return cache.windows;
}
