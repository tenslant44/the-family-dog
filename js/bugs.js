import * as THREE from 'three';

const rand = (a, b) => a + Math.random() * (b - a);
const PER = 7, MAXS = 14;

// Spring flies buzzing around trash, the bowl, and poop
export class Bugs {
  constructor(scene) {
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.028, 5, 4), new THREE.MeshBasicMaterial({ color: 0x1a1a14 }), PER * MAXS);
    this.mesh.frustumCulled = false; this.mesh.count = 0;
    scene.add(this.mesh);
    this.swarms = [];
    this.d = new THREE.Object3D();
    this.t = 0;
  }

  // sources: array of Vector3; swarms are kept stable per source object
  sync(sources) {
    const keep = [];
    for (const p of sources.slice(0, MAXS)) {
      let s = this.swarms.find((w) => w.src === p);
      if (!s) s = { src: p, pos: new THREE.Vector3(), scatter: 0, flies: Array.from({ length: PER }, () => ({ a: rand(1.5, 3.5), b: rand(2, 4), c: rand(1.5, 3.5), ph: rand(0, 6.3), r: rand(0.18, 0.4) })) };
      s.pos.set(p.x, 0, p.z);
      keep.push(s);
    }
    this.swarms = keep;
  }

  update(dt, on) {
    this.t += dt;
    this.mesh.visible = on;
    if (!on) return;
    let k = 0;
    for (const s of this.swarms) {
      s.scatter = Math.max(0, s.scatter - dt * 0.6);
      const spread = 1 + s.scatter * 3.5;
      for (const f of s.flies) {
        const t = this.t;
        this.d.position.set(
          s.pos.x + Math.sin(t * f.a + f.ph) * f.r * spread,
          0.35 + Math.sin(t * f.b + f.ph * 2) * 0.18 + s.scatter * 0.8,
          s.pos.z + Math.cos(t * f.c + f.ph) * f.r * spread);
        this.d.updateMatrix();
        this.mesh.setMatrixAt(k++, this.d.matrix);
      }
    }
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
