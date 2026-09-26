import * as THREE from 'three';
import { G, colliders } from './physics.js';
import { std, mesh } from './models.js';

const rand = (a, b) => a + Math.random() * (b - a);
const tmp = new THREE.Vector3();

export class FX {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.labels = document.getElementById('labels');
    // glue drops
    this.dropMax = 400;
    this.drops = [];
    this.dropMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 4), std(0xf6f2dc, { roughness: 0.15 }), this.dropMax);
    this.dropMesh.count = 0;
    this.dropMesh.frustumCulled = false;
    scene.add(this.dropMesh);
    // puddles
    this.puddles = [];
    this.puddleGeo = new THREE.CircleGeometry(1, 18);
    this.puddleMat = std(0xf3efd8, { roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2 });
    // puffs
    this.puffs = [];
    this.puffGeo = new THREE.IcosahedronGeometry(1, 1);
    this.pops = [];
    this.poops = [];
    this.poopMat = std(0x5a3a1c, { roughness: 0.35 });
    this.dummy = new THREE.Object3D();
    // comic impact bursts
    this.bursts = [];
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const star = (ro, ri, fill) => {
      g.beginPath();
      for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, r = i % 2 ? ri : ro * (0.85 + (i % 4 === 0 ? 0.15 : 0)); g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); }
      g.closePath(); g.fillStyle = fill; g.fill();
    };
    star(62, 34, '#ff8a2a'); star(50, 26, '#ffe14a'); star(30, 16, '#ffffff');
    this.burstTex = new THREE.CanvasTexture(c);
    this.burstTex.colorSpace = THREE.SRGBColorSpace;
  }

  // ---------- comic impact burst ----------
  burst(p, size = 0.9, life = 0.22) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.burstTex, transparent: true, depthTest: false, depthWrite: false, fog: false }));
    m.position.copy(p);
    m.material.rotation = rand(0, Math.PI);
    m.renderOrder = 999;
    this.scene.add(m);
    this.bursts.push({ m, life, max: life, size });
  }

  flash(strength = 0.5) {
    const el = document.getElementById('flash');
    if (!el) return;
    el.style.transition = 'none';
    el.style.opacity = strength;
    requestAnimationFrame(() => { el.style.transition = 'opacity .35s'; el.style.opacity = 0; });
  }

  // ---------- glue ----------
  sprayGlue(from, dir) {
    for (let i = 0; i < 3; i++) {
      if (this.drops.length >= this.dropMax) this.drops.shift();
      const v = dir.clone().multiplyScalar(rand(8, 10)).add(tmp.set(rand(-0.5, 0.5), rand(-0.3, 0.8), rand(-0.5, 0.5)));
      this.drops.push({ p: from.clone(), v, life: 3 });
    }
  }

  updateDrops(dt, dog) {
    const dp = dog.pos;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.v.y -= G * 0.6 * dt;
      d.p.addScaledVector(d.v, dt);
      d.life -= dt;
      let dead = d.life <= 0;
      if (!dead && d.p.distanceToSquared(dp) < 0.3) { dog.glue = Math.min(1, dog.glue + 0.008); dead = true; dog.glueHits = (dog.glueHits || 0) + 1; }
      if (!dead && d.p.y <= 0.02) { this.addPuddle(d.p); dead = true; }
      if (!dead) for (const c of colliders) {
        if (d.p.x > c.min.x && d.p.x < c.max.x && d.p.y > c.min.y && d.p.y < c.max.y && d.p.z > c.min.z && d.p.z < c.max.z) { dead = true; break; }
      }
      if (dead) this.drops.splice(i, 1);
    }
    this.dropMesh.count = this.drops.length;
    for (let i = 0; i < this.drops.length; i++) {
      this.dummy.position.copy(this.drops[i].p);
      this.dummy.scale.set(1, 1.6, 1);
      this.dummy.updateMatrix();
      this.dropMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.dropMesh.instanceMatrix.needsUpdate = true;
  }

  addPuddle(p) {
    for (const pd of this.puddles) {
      if (Math.hypot(pd.x - p.x, pd.z - p.z) < pd.r + 0.1) { pd.r = Math.min(1.1, pd.r + 0.012); pd.life = 40; pd.m.scale.setScalar(pd.r); return; }
    }
    if (this.puddles.length > 40) { const o = this.puddles.shift(); this.scene.remove(o.m); }
    const m = mesh(this.puddleGeo, this.puddleMat, p.x, 0.035, p.z, this.scene, false);
    m.rotation.x = -Math.PI / 2;
    const r = 0.18;
    m.scale.setScalar(r);
    this.puddles.push({ x: p.x, z: p.z, r, life: 40, m });
  }

  puddleAt(p) {
    for (const pd of this.puddles) if (pd.r > 0.3 && Math.hypot(pd.x - p.x, pd.z - p.z) < pd.r) return true;
    return false;
  }

  // ---------- puffs (poof / fart / dust) ----------
  puff(p, { color = 0xffffff, n = 8, size = 0.35, spread = 1.2, up = 1, life = 0.8, opacity = 0.9 } = {}) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: true, opacity, depthWrite: false, flatShading: true });
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.puffGeo, mat);
      m.position.copy(p).add(tmp.set(rand(-0.3, 0.3), rand(-0.1, 0.3), rand(-0.3, 0.3)));
      m.scale.setScalar(size * rand(0.6, 1.2));
      this.scene.add(m);
      this.puffs.push({ m, v: new THREE.Vector3(rand(-1, 1) * spread, rand(0.3, 1) * up, rand(-1, 1) * spread), life, max: life, s: m.scale.x, mat, op: opacity });
    }
  }

  updatePuffs(dt) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life -= dt;
      const k = 1 - b.life / b.max;
      b.m.scale.setScalar(b.size * (0.5 + k * 0.9));
      b.m.material.opacity = Math.min(1, (1 - k) * 2.5);
      if (b.life <= 0) { this.scene.remove(b.m); b.m.material.dispose(); this.bursts.splice(i, 1); }
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const f = this.puffs[i];
      f.life -= dt;
      f.m.position.addScaledVector(f.v, dt);
      f.v.multiplyScalar(1 - dt * 2);
      const k = f.life / f.max;
      f.m.scale.setScalar(f.s * (1.6 - k * 0.6));
      f.mat.opacity = f.op * k;
      if (f.life <= 0) { this.scene.remove(f.m); this.puffs.splice(i, 1); }
    }
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      const pd = this.puddles[i];
      pd.life -= dt;
      if (pd.life < 3) pd.m.scale.setScalar(pd.r * Math.max(0.01, pd.life / 3));
      if (pd.life <= 0) { this.scene.remove(pd.m); this.puddles.splice(i, 1); }
    }
  }

  // ---------- poop ----------
  addPoop(p) {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const t = mesh(new THREE.TorusGeometry(0.1 - i * 0.03, 0.045 - i * 0.008, 6, 12), this.poopMat, 0, 0.04 + i * 0.05, 0, g);
      t.rotation.x = Math.PI / 2;
    }
    mesh(new THREE.ConeGeometry(0.03, 0.06, 6), this.poopMat, 0, 0.18, 0, g);
    g.position.set(p.x, 0, p.z);
    this.scene.add(g);
    this.poops.push(g);
    if (this.poops.length > 10) this.scene.remove(this.poops.shift());
  }

  // ---------- HTML pops ----------
  project(p, out) {
    tmp.copy(p).project(this.camera);
    out.x = (tmp.x * 0.5 + 0.5) * innerWidth;
    out.y = (-tmp.y * 0.5 + 0.5) * innerHeight;
    out.vis = tmp.z < 1 && tmp.z > -1;
    return out;
  }

  pop(p, text, color = '#fff', size = 26, life = 1.1) {
    const el = document.createElement('div');
    el.className = 'pop';
    el.textContent = text;
    el.style.color = color;
    el.style.fontSize = size + 'px';
    this.labels.appendChild(el);
    this.pops.push({ el, p: p.clone().add(tmp.set(rand(-0.3, 0.3), 0.9, rand(-0.3, 0.3))), life, max: life, vy: 1.2 });
  }

  bubble(target, text, life = 4) {
    const el = document.createElement('div');
    el.className = 'bubble';
    el.textContent = text;
    this.labels.appendChild(el);
    this.pops.push({ el, target, life, max: life, bubble: true });
  }

  updatePops(dt) {
    const o = {};
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const q = this.pops[i];
      q.life -= dt;
      let wp;
      if (q.bubble) { wp = tmp.copy(q.target.pos); wp.y += q.target.bubbleY || 1.6; }
      else { q.p.y += q.vy * dt; wp = q.p; }
      this.project(wp, o);
      const k = q.life / q.max;
      q.el.style.left = o.x + 'px';
      q.el.style.top = o.y + 'px';
      q.el.style.opacity = o.vis ? Math.min(1, k * 3) : 0;
      if (!q.bubble) q.el.style.transform = `translate(-50%,-50%) scale(${0.7 + Math.min(1, (1 - k) * 8) * 0.4})`;
      if (q.life <= 0) { q.el.remove(); this.pops.splice(i, 1); }
    }
  }

  update(dt, dog) {
    this.updateDrops(dt, dog);
    this.updatePuffs(dt);
    this.updatePops(dt);
  }
}
