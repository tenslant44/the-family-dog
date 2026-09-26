import * as THREE from 'three';
import { G, collideSphere, colliders } from './physics.js';
import { std, mesh, ellip, cyl, box } from './models.js';

const rand = (a, b) => a + Math.random() * (b - a);
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
const ROAD = [16.9, 27.1];

const softMat = std(0x7a4a1e, { roughness: 0.12, metalness: 0.05 });
const hardMat = std(0x3e2812, { roughness: 0.95, flatShading: true });

export function makePoop(soft) {
  const g = new THREE.Group();
  const m = soft ? softMat : hardMat;
  if (soft) {
    for (let i = 0; i < 3; i++) {
      const t = mesh(new THREE.TorusGeometry(0.11 - i * 0.03, 0.05 - i * 0.008, 8, 14), m, 0, 0.035 + i * 0.04, 0, g);
      t.rotation.x = Math.PI / 2; t.scale.z = 0.8;
    }
    ellip(0.05, 0.035, 0.05, m, 0, 0.14, 0, g, 8);
  } else {
    for (let i = 0; i < 3; i++) {
      const t = mesh(new THREE.TorusGeometry(0.09 - i * 0.022, 0.042 - i * 0.006, 5, 8), m, 0, 0.04 + i * 0.06, 0, g);
      t.rotation.x = Math.PI / 2;
    }
    mesh(new THREE.ConeGeometry(0.03, 0.08, 5), m, 0, 0.22, 0, g);
  }
  return g;
}
export function makeSplat() {
  const g = new THREE.Group();
  const m = mesh(new THREE.CircleGeometry(0.32, 14), std(0x6a3e18, { roughness: 0.1, polygonOffset: true, polygonOffsetFactor: -3 }), 0, 0.03, 0, g, false);
  m.rotation.x = -Math.PI / 2; m.scale.set(1, 0.7, 1);
  for (let i = 0; i < 5; i++) ellip(rand(0.04, 0.09), 0.025, rand(0.04, 0.09), softMat, rand(-0.25, 0.25), 0.02, rand(-0.18, 0.18), g, 8);
  return g;
}
export function makeBomb() {
  const g = new THREE.Group();
  ellip(0.16, 0.16, 0.16, std(0x1a1a1e, { roughness: 0.3, metalness: 0.4 }), 0, 0, 0, g, 16);
  cyl(0.05, 0.05, 0.06, std(0x555555, { metalness: 0.7 }), 0, 0.16, 0, g, 10);
  const f = cyl(0.012, 0.012, 0.12, std(0xc9b58a), 0.02, 0.24, 0, g, 5); f.rotation.z = -0.4;
  return g;
}
export function makeMine() {
  const g = new THREE.Group();
  cyl(0.22, 0.25, 0.08, std(0x4a5a3a, { roughness: 0.6, metalness: 0.3 }), 0, 0.04, 0, g, 16);
  cyl(0.06, 0.06, 0.04, std(0x8a8a8a, { metalness: 0.8 }), 0, 0.1, 0, g, 10);
  const led = ellip(0.02, 0.02, 0.02, std(0xff2020, { emissive: 0xff2020, emissiveIntensity: 1.5 }), 0.12, 0.09, 0, g, 6);
  g.userData.led = led;
  return g;
}
export function makeYogurt() {
  const g = new THREE.Group();
  cyl(0.07, 0.055, 0.12, std(0xf4f0f8, { roughness: 0.4 }), 0, 0, 0, g, 16);
  cyl(0.071, 0.071, 0.05, std(0x3a6aff), 0, 0.01, 0, g, 16);
  cyl(0.075, 0.075, 0.01, std(0xd8d8e0, { metalness: 0.8, roughness: 0.3 }), 0, 0.065, 0, g, 16);
  return g;
}
export function makeBurger() {
  const g = new THREE.Group();
  cyl(0.22, 0.2, 0.08, std(0xd99549), 0, 0.04, 0, g, 16);
  cyl(0.23, 0.23, 0.065, std(0x59301a), 0, 0.11, 0, g, 16);
  cyl(0.23, 0.23, 0.02, std(0x81b14c), 0, 0.155, 0, g, 16);
  ellip(0.22, 0.095, 0.22, std(0xe5ae62), 0, 0.22, 0, g, 16);
  return g;
}

export class Throwables {
  constructor(scene, hooks) {
    this.scene = scene; this.hooks = hooks;
    this.poops = [];
    this.bombs = [];
    this.mines = [];
    this.held = null;
    // aim arc
    const N = 48;
    this.arcPts = new Float32Array(N * 3);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(this.arcPts, 3));
    this.arc = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: 0.85, depthTest: false }));
    this.arc.renderOrder = 998; this.arc.frustumCulled = false; this.arc.visible = false;
    scene.add(this.arc);
    this.ring = mesh(new THREE.RingGeometry(0.3, 0.42, 24), new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.8, depthTest: false, side: THREE.DoubleSide }), 0, 0, 0, scene, false);
    this.ring.renderOrder = 998; this.ring.visible = false;
    this.N = N;
  }

  // ---------- aim ----------
  showArc(from, vel, visible = true) {
    if (!visible) { this.arc.visible = this.ring.visible = false; return; }
    const p = tmp.copy(from), v = tmp2.copy(vel), dt = 0.045;
    let n = 0, landed = false;
    for (; n < this.N; n++) {
      this.arcPts[n * 3] = p.x; this.arcPts[n * 3 + 1] = p.y; this.arcPts[n * 3 + 2] = p.z;
      if (landed) continue;
      v.y -= G * dt; p.addScaledVector(v, dt);
      if (p.y <= 0.02) { p.y = 0.02; landed = true; this.ring.position.set(p.x, 0.04, p.z); this.ring.rotation.set(-Math.PI / 2, 0, 0); }
      else if (n > 2) for (const c of colliders) {
        if (p.x > c.min.x && p.x < c.max.x && p.y > c.min.y && p.y < c.max.y && p.z > c.min.z && p.z < c.max.z) { landed = true; this.ring.position.copy(p); this.ring.lookAt(p.x + v.x, p.y + v.y, p.z + v.z); break; }
      }
    }
    this.arc.geometry.attributes.position.needsUpdate = true;
    this.arc.computeLineDistances();
    this.arc.visible = true; this.ring.visible = landed;
  }

  // ---------- poop ----------
  addPoop(p, soft = Math.random() < 0.5) {
    const g = makePoop(soft);
    g.position.set(p.x, 0, p.z); g.rotation.y = rand(0, 6.28);
    this.scene.add(g);
    this.poops.push({ g, soft, state: 'ground', vel: new THREE.Vector3(), splat: false });
    const ground = this.poops.filter((q) => q.state === 'ground');
    if (ground.length > 14) this.remove(ground[0]);
  }
  remove(q) {
    this.scene.remove(q.g);
    const i = this.poops.indexOf(q); if (i >= 0) this.poops.splice(i, 1);
    if (this.held === q) this.held = null;
  }
  nearestPoop(p, range = 1.6) {
    let best = null, bd = range;
    for (const q of this.poops) {
      if (q.state !== 'ground') continue;
      const d = Math.hypot(q.g.position.x - p.x, q.g.position.z - p.z);
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  }
  pickUp(q) {
    if (q.splat) { this.scene.remove(q.g); q.g = makePoop(true); this.scene.add(q.g); q.splat = false; }
    q.state = 'held'; this.held = q;
  }
  throwHeld(from, vel) {
    const q = this.held; if (!q) return;
    this.held = null;
    q.state = 'air'; q.g.position.copy(from); q.vel.copy(vel); q.t = 0;
  }
  placeHeld(at) {
    const q = this.held; if (!q) return;
    this.held = null;
    q.state = 'ground'; q.g.position.set(at.x, 0, at.z); q.g.rotation.set(0, rand(0, 6), 0);
    if (q.soft) this.makeSplat(q);
  }
  makeSplat(q) {
    this.scene.remove(q.g);
    const p = q.g.position.clone();
    q.g = makeSplat(); q.g.position.set(p.x, 0, p.z); q.g.rotation.y = rand(0, 6);
    this.scene.add(q.g); q.splat = true;
  }
  // soft poop in the road under a car?
  slipAt(x, z) {
    for (const q of this.poops) {
      if (q.state !== 'ground' || !q.soft) continue;
      const p = q.g.position;
      if (p.z < ROAD[0] - 0.3 || p.z > ROAD[1] + 0.3) continue;
      if (Math.abs(p.x - x) < 2.2 && Math.abs(p.z - z) < 1.1) {
        this.hooks.slip(p.clone());
        this.remove(q);
        return true;
      }
    }
    return false;
  }

  // ---------- bombs & mines ----------
  throwBomb(from, vel) {
    const g = makeBomb(); g.position.copy(from); this.scene.add(g);
    this.bombs.push({ g, vel: vel.clone(), fuse: 2.2, spin: new THREE.Vector3(rand(-6, 6), rand(-6, 6), rand(-6, 6)) });
  }
  placeMine(at) {
    const g = makeMine(); g.position.set(at.x, 0, at.z); this.scene.add(g);
    this.mines.push({ g, arm: 1.2, t: 0 });
    if (this.mines.length > 8) { const m = this.mines.shift(); this.scene.remove(m.g); }
  }

  update(dt, ctx) {
    const { playerHand, targets } = ctx;
    // held poop follows the hand
    if (this.held) this.held.g.position.copy(playerHand);
    for (let i = this.poops.length - 1; i >= 0; i--) {
      const q = this.poops[i];
      if (q.state !== 'air') continue;
      q.t += dt;
      q.vel.y -= G * dt;
      q.g.position.addScaledVector(q.vel, dt);
      q.g.rotation.x += dt * 9; q.g.rotation.z += dt * 6;
      const p = q.g.position;
      // face / body hits
      const hit = this.hooks.poopHit(q, p);
      if (hit) { this.remove(q); continue; }
      const c = collideSphere(p, 0.12, q.vel, q.soft ? 0 : 0.4, 0.6);
      if (p.y <= 0.05 || (c && c.impact > 3)) {
        if (q.soft) { this.hooks.splat(p.clone(), true); p.y = Math.max(0, p.y); if (p.y > 0.3) { this.remove(q); continue; } q.state = 'ground'; q.g.rotation.set(0, 0, 0); this.makeSplat(q); }
        else if (p.y <= 0.05) {
          p.y = 0.05;
          if (q.vel.y < -3) { q.vel.y *= -0.35; q.vel.x *= 0.6; q.vel.z *= 0.6; this.hooks.splat(p.clone(), false); }
          else { q.state = 'ground'; q.g.position.y = 0; q.g.rotation.set(0, rand(0, 6), 0); }
        }
      }
      if (p.length() > 300) this.remove(q);
    }
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.fuse -= dt;
      b.vel.y -= G * dt;
      b.g.position.addScaledVector(b.vel, dt);
      collideSphere(b.g.position, 0.16, b.vel, 0.4, 0.7);
      if (b.g.position.y < 0.16) { b.g.position.y = 0.16; if (b.vel.y < 0) b.vel.y *= -0.4; b.vel.x *= 1 - dt * 3; b.vel.z *= 1 - dt * 3; b.spin.multiplyScalar(1 - dt * 3); }
      b.g.rotation.x += b.spin.x * dt; b.g.rotation.z += b.spin.z * dt;
      if (Math.random() < 0.6) this.hooks.fuseSpark(tmp.copy(b.g.position).setY(b.g.position.y + 0.25));
      const s = 1 + Math.max(0, 0.5 - b.fuse) * 0.8 * Math.abs(Math.sin(b.fuse * 40));
      b.g.scale.setScalar(s);
      if (b.fuse <= 0) { this.scene.remove(b.g); this.bombs.splice(i, 1); this.hooks.explode(b.g.position.clone(), 1); }
    }
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i];
      m.t += dt; m.arm -= dt;
      m.g.userData.led.visible = m.arm > 0 ? Math.sin(m.t * 30) > 0 : Math.sin(m.t * 6) > 0;
      if (m.arm > 0) continue;
      const mp = m.g.position;
      for (const t of targets) {
        if (Math.abs(t.pos.x - mp.x) < (t.r || 0.8) && Math.abs(t.pos.z - mp.z) < (t.r || 0.8) && t.pos.y < 1.6) {
          this.scene.remove(m.g); this.mines.splice(i, 1);
          this.hooks.explode(mp.clone(), 0.9);
          break;
        }
      }
    }
  }
}
