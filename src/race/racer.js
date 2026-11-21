// One competitor in a race: the bird's data, its 3D model, animation and physics body.
import * as THREE from 'three';
import { SPECIES } from '../data/species.js';
import { createBirdModel, WORLD_SCALE } from '../birds/birdModel.js';
import { BirdAnimator } from '../birds/birdAnimator.js';
import { BirdBody } from '../birds/birdPhysics.js';
import { textTexture } from '../world/textures.js';

export const BAND_COLORS = ['#ffcc00', '#ff4d4d', '#3aa0ff', '#3ddc84', '#ff8a00', '#c86bff', '#ffffff', '#ff5fa8'];

// Personal modifiers (mods) and AI difficulty applied to the species stats.
export function computeStats(base, mods = {}, speedMul = 1) {
  const s = Object.assign({}, base);
  for (const k in mods) if (k in s) s[k] = s[k] * (1 + mods[k]);
  s.topSpeed *= speedMul;
  return s;
}

function makeTag(name, number, isPlayer) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = isPlayer ? 'rgba(255,196,40,0.92)' : 'rgba(10,14,24,0.72)';
  const r = 14;
  ctx.beginPath();
  ctx.moveTo(r, 4); ctx.lineTo(252 - r, 4); ctx.quadraticCurveTo(252, 4, 252, 4 + r);
  ctx.lineTo(252, 60 - r); ctx.quadraticCurveTo(252, 60, 252 - r, 60);
  ctx.lineTo(r, 60); ctx.quadraticCurveTo(4, 60, 4, 60 - r); ctx.lineTo(4, 4 + r); ctx.quadraticCurveTo(4, 4, r, 4);
  ctx.fill();
  ctx.fillStyle = isPlayer ? '#1a1200' : '#ffffff';
  ctx.font = 'italic 900 30px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${number}  ${name.toUpperCase()}`, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(1.5, 0.375, 1);
  sp.renderOrder = 10;
  return sp;
}

export class Racer {
  constructor({ bird, isPlayer = false, lane = 1, bandColor = '#ffcc00', speedMul = 1, bonus = null }) {
    this.bird = bird;
    this.name = bird.name;
    this.isPlayer = isPlayer;
    this.lane = lane;
    this.bandColor = bandColor;
    this.species = SPECIES[bird.species];
    this.stats = computeStats(this.species.stats, bird.mods, speedMul);
    // career training bonuses / tiredness
    if (bonus) {
      for (const k of ['topSpeed', 'accel', 'staminaCap', 'grip']) if (bonus[k]) this.stats[k] *= 1 + bonus[k];
    }
    this.startStamina = bonus?.startStamina ?? 1;
    this.model = createBirdModel(bird, bandColor);
    this.anim = new BirdAnimator(this.model);
    const size = this.species.size * WORLD_SCALE;
    this.body = new BirdBody(this.stats, 0.25 * size, this.stats.mass);
    this.ctrl = { throttle: 0, desiredHeading: null, steer: 0 };
    this.tag = makeTag(bird.name, bird.number, isPlayer);
    this.tagHeight = 1.15 * size + 0.35;
    this.loc = { seg: 0, t: 0, d: 0, curv: 0 };
    this.resetRaceState();
  }

  resetRaceState() {
    this.progress = 0;
    this.finished = false;
    this.finishTime = null;
    this.place = 0;
    this.dq = null;
    this.reaction = null;
    this.reacted = false;
    this.laneViolation = 0;
    this.broke = false;
    this.animMode = 'idle';
    this.celebrating = false;
    this.lapsDone = 0;
  }

  dispose() {
    this.model.dispose();
    this.tag.material.map.dispose();
    this.tag.material.dispose();
    this.tag.removeFromParent();
  }
}
