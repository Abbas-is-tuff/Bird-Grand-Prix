// Bird-sized hurdle barriers. Jump over them! Hit one and it tips over and slows you down.
import * as THREE from 'three';
import { T, pointAt, laneCenter } from './track.js';

export const BARRIER_HEIGHT = 0.38; // metres (the birds are about 0.7–1.2 m tall)
export const BARRIER_CLEAR = BARRIER_HEIGHT * 0.8; // how high your bird must be when it reaches the bar

let assets = null;
function getAssets() {
  if (assets) return assets;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 16;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#111418' : '#f4f4f0';
    ctx.fillRect(i * 32, 0, 32, 16);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  assets = {
    barMat: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 }),
    postMat: new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.35, metalness: 0.6 }),
    footMat: new THREE.MeshStandardMaterial({ color: 0xe6392f, roughness: 0.5 }),
    bar: new THREE.BoxGeometry(1.06, 0.075, 0.035),
    post: new THREE.CylinderGeometry(0.018, 0.022, BARRIER_HEIGHT, 8),
    foot: new THREE.BoxGeometry(0.05, 0.035, 0.42),
  };
  return assets;
}

export class Barrier {
  // x,z = centre on the ground, h = running direction (heading), dist = metres from the start line
  constructor(scene, x, z, h, dist, lane) {
    const A = getAssets();
    this.dist = dist;
    this.lane = lane;
    this.x = x;
    this.z = z;
    this.h = h;
    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    this.group.rotation.y = h;
    this.tilt = new THREE.Group(); // tips forward when knocked
    this.group.add(this.tilt);
    const H = BARRIER_HEIGHT;
    const bar = new THREE.Mesh(A.bar, A.barMat);
    bar.position.set(0, H - 0.035, 0);
    bar.castShadow = true;
    this.tilt.add(bar);
    for (const sx of [-0.5, 0.5]) {
      const post = new THREE.Mesh(A.post, A.postMat);
      post.position.set(sx, H / 2, 0);
      post.castShadow = true;
      this.tilt.add(post);
      const foot = new THREE.Mesh(A.foot, A.footMat);
      foot.position.set(sx, 0.018, -0.18);
      foot.castShadow = true;
      this.tilt.add(foot);
    }
    scene.add(this.group);
    this.reset();
  }

  reset() {
    this.passed = false;
    this.knocked = false;
    this.t = 0;
    this.tilt.rotation.x = 0;
  }

  knock() {
    this.knocked = true;
    this.t = 0;
  }

  update(dt) {
    if (!this.knocked) return;
    this.t += dt;
    const k = Math.min(1, this.t / 0.32);
    // fall forward with a small bounce at the end
    const fall = k < 1 ? k * k * 1.42 : 1.42 - 0.05 * Math.sin(Math.min(1, (this.t - 0.32) / 0.25) * Math.PI);
    this.tilt.rotation.x = Math.min(1.42, fall);
  }

  dispose() {
    this.group.removeFromParent();
  }
}

// Barriers for one lane. startPoint = race.startPoint(lane), mode = race mode.
export function placeBarriers(scene, distances, lane, startPoint, mode) {
  const out = [];
  const tmp = {};
  for (const dist of distances) {
    if (mode === 'straight') {
      out.push(new Barrier(scene, startPoint.x + dist, T.R + laneCenter(lane), Math.PI / 2, dist, lane));
    } else {
      pointAt(startPoint.s + dist, startPoint.m, laneCenter(lane), tmp);
      out.push(new Barrier(scene, tmp.x, tmp.z, tmp.h, dist, lane));
    }
  }
  return out;
}
