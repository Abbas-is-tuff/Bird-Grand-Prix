// Renders a small 3D portrait of every bird for the selection cards.
import * as THREE from 'three';
import { createBirdModel } from '../birds/birdModel.js';
import { BirdAnimator } from '../birds/birdAnimator.js';

export function renderPortraits(renderer, birds, size = 160) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x3a3226, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(2, 3, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc4ff, 1.4);
  rim.position.set(-3, 2, -2);
  scene.add(rim);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
  const buf = new Uint8Array(size * size * 4);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const out = {};
  const prevClear = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  const lin2srgb = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    const s = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    lin2srgb[i] = Math.round(Math.min(1, s) * 255);
  }
  renderer.setClearColor(0x000000, 0);
  for (const b of birds) {
    const model = createBirdModel(b);
    const anim = new BirdAnimator(model);
    anim.reset(0, 0, 0);
    for (let i = 0; i < 4; i++) {
      anim.update(1 / 30, { x: 0, z: 0, h: -0.65, vx: 0, vz: 0, speed: 0, accel: 0, latAcc: 0, yawRate: 0, slip: 0 }, 'idle');
    }
    model.head.rotation.y = 0;
    model.blob.visible = false;
    scene.add(model.root);
    const box = new THREE.Box3().setFromObject(model.headMesh);
    const bodyBox = new THREE.Box3().setFromObject(model.bodyMesh);
    const c = new THREE.Vector3();
    box.getCenter(c);
    const bc = new THREE.Vector3();
    bodyBox.getCenter(bc);
    const target = c.clone().lerp(bc, 0.45);
    const dist = model.S * 2.4;
    cam.position.set(target.x + dist * 0.75, target.y + dist * 0.15, target.z + dist * 0.65);
    cam.lookAt(target);
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
    renderer.setRenderTarget(null);
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const si = ((size - 1 - y) * size + x) * 4;
        const di = (y * size + x) * 4;
        const a = buf[si + 3];
        // un-premultiply is not needed (straight alpha in render target)
        img.data[di] = lin2srgb[buf[si]];
        img.data[di + 1] = lin2srgb[buf[si + 1]];
        img.data[di + 2] = lin2srgb[buf[si + 2]];
        img.data[di + 3] = a;
      }
    }
    ctx.clearRect(0, 0, size, size);
    ctx.putImageData(img, 0, 0);
    out[b.id] = canvas.toDataURL('image/png');
    scene.remove(model.root);
    model.dispose();
  }
  rt.dispose();
  renderer.setClearColor(prevClear, prevAlpha);
  return out;
}
