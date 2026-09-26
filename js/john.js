import * as THREE from 'three';
import { G, collideSphere } from './physics.js';
import { std, ellip, cyl, box, mesh } from './models.js';

const rand = (a, b) => a + Math.random() * (b - a);
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

// John the Fish: stands up like a human, boxes The Family Dog.
export class John {
  constructor(scene, hooks) {
    this.hooks = hooks;
    this.scene = scene;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.alive = false; this.active = false;
    this.hp = 100; this.timer = 0; this.punchCd = 0; this.knock = 0; this.koT = 0; this.hurtCd = 0;
    this.yaw = 0; this.t = 0; this.punchArm = 0; this.punchT = 0;
    this.build();
    this.root.visible = false;
    scene.add(this.root);
  }

  build() {
    const scale = std(0x4f8fd0, { roughness: 0.35, metalness: 0.2 });
    const belly = std(0xd8e6f0, { roughness: 0.4 });
    const fin = std(0x2f68a8, { roughness: 0.5, side: THREE.DoubleSide });
    const glove = std(0xd8262a, { roughness: 0.35 });
    this.root = new THREE.Group();
    this.bodyG = new THREE.Group(); this.bodyG.position.y = 0.75; this.root.add(this.bodyG);
    ellip(0.32, 0.55, 0.26, scale, 0, 0.35, 0, this.bodyG, 20);
    ellip(0.24, 0.42, 0.1, belly, 0, 0.3, 0.19, this.bodyG);
    // face near the top
    for (const s of [-1, 1]) {
      ellip(0.08, 0.08, 0.05, std(0xffffff), s * 0.19, 0.68, 0.14, this.bodyG, 12);
      ellip(0.04, 0.04, 0.03, std(0x111111), s * 0.2, 0.68, 0.19, this.bodyG, 8);
      const brow = box(0.12, 0.025, 0.02, std(0x1e3e66), s * 0.19, 0.78, 0.17, this.bodyG, false);
      brow.rotation.z = s * -0.35;
    }
    ellip(0.1, 0.05, 0.06, std(0xe06a7a), 0, 0.5, 0.22, this.bodyG, 10);
    // dorsal fin + tail fin (on the back)
    const dShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.35, 0.1), new THREE.Vector2(0.0, 0.55)]);
    const dorsal = mesh(new THREE.ExtrudeGeometry(dShape, { depth: 0.02, bevelEnabled: false }), fin, 0.01, 0.1, -0.2, this.bodyG);
    dorsal.rotation.y = Math.PI / 2;
    const tail = mesh(new THREE.ConeGeometry(0.25, 0.35, 4), fin, 0, 0.9, -0.05, this.bodyG);
    tail.scale.set(1, 1, 0.2);
    // shorts
    cyl(0.3, 0.33, 0.25, std(0xf2d23a), 0, -0.08, 0, this.bodyG, 16);
    box(0.62, 0.06, 0.5, std(0xffffff), 0, 0.04, 0, this.bodyG, false).scale.set(0.98, 1, 0.98);
    // legs
    this.legs = [];
    for (const s of [-1, 1]) {
      const p = new THREE.Group(); p.position.set(s * 0.15, -0.15, 0); this.bodyG.add(p);
      cyl(0.06, 0.055, 0.5, scale, 0, -0.28, 0, p, 8);
      box(0.14, 0.1, 0.24, std(0xf4f4f4), 0, -0.56, 0.04, p);
      this.legs.push(p);
    }
    // arms with gloves
    this.arms = [];
    for (const s of [-1, 1]) {
      const p = new THREE.Group(); p.position.set(s * 0.33, 0.4, 0); this.bodyG.add(p);
      const a = cyl(0.05, 0.045, 0.4, scale, 0, -0.18, 0, p, 8);
      ellip(0.11, 0.1, 0.12, glove, 0, -0.4, 0.02, p, 12);
      this.arms.push(p);
    }
    this.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }

  spawn(at) {
    this.pos.copy(at); this.pos.y = 0;
    this.vel.set(0, 0, 0);
    this.alive = true; this.active = true;
    this.hp = 100; this.timer = 30; this.knock = 0; this.koT = 0;
    this.root.visible = true;
    this.root.rotation.set(0, 0, 0);
  }

  get canBeHit() { return this.alive && this.hurtCd <= 0; }

  hit(v, dmg) {
    if (!this.canBeHit) return;
    this.hurtCd = 0.3;
    this.vel.copy(v);
    this.knock = 0.8;
    this.hp -= dmg;
    this.hooks.pop(this.pos, `-${dmg}`, '#ff8a8a');
    if (this.hp <= 0) { this.alive = false; this.koT = 2.2; this.hooks.johnKO(); }
  }

  update(dt, dog) {
    if (!this.active) return;
    this.t += dt;
    this.hurtCd -= dt; this.punchCd -= dt; this.punchT = Math.max(0, this.punchT - dt);
    if (this.alive) {
      this.timer -= dt;
      if (this.timer <= 0) { this.alive = false; this.koT = 0.01; this.hooks.johnLeaves(); }
    }
    if (!this.alive) {
      this.koT -= dt;
      this.root.rotation.x += (-Math.PI / 2 - this.root.rotation.x) * Math.min(1, dt * 6);
      this.physics(dt);
      if (this.koT <= 0) { this.active = false; this.root.visible = false; this.hooks.poof(this.pos); }
      this.sync();
      return;
    }
    const to = tmp.subVectors(dog.pos, this.pos).setY(0);
    const dist = to.length();
    to.normalize();
    this.yaw = Math.atan2(to.x, to.z);
    if (this.knock > 0) {
      this.knock -= dt;
    } else if (!dog.air && dog.stuck <= 0 || dog.stuck > 0) {
      const want = dist > 1.15 ? 3.8 : 0;
      this.vel.x += (to.x * want - this.vel.x) * Math.min(1, dt * 8);
      this.vel.z += (to.z * want - this.vel.z) * Math.min(1, dt * 8);
      if (dist < 1.5 && this.punchCd <= 0 && !dog.air) {
        this.punchCd = rand(0.6, 0.95);
        this.punchArm = 1 - this.punchArm; this.punchT = 0.25;
        const heavy = Math.random() < 0.25;
        dog.launch(tmp2.copy(to).multiplyScalar(heavy ? 12 : 6).setY(heavy ? 7 : 4), 'John');
        dog.mood -= 6;
        this.hooks.sound('punch', 0.8);
        this.hooks.pop(dog.pos, heavy ? 'HAYMAKER' : ['POW', 'JAB', 'BAP'][(Math.random() * 3) | 0], '#ffd84a');
      }
    } else {
      // dog is airborne: bounce on toes
      this.vel.x *= 0.9; this.vel.z *= 0.9;
    }
    this.physics(dt);
    this.sync();
  }

  physics(dt) {
    this.vel.y -= G * dt;
    this.pos.addScaledVector(this.vel, dt);
    tmp.copy(this.pos); tmp.y += 0.6;
    if (collideSphere(tmp, 0.4, this.vel, 0.2, 0.9)) { this.pos.copy(tmp); this.pos.y -= 0.6; }
    if (this.pos.y < 0) { this.pos.y = 0; this.vel.y = 0; if (this.knock <= 0) { this.vel.x *= 0.9; this.vel.z *= 0.9; } }
  }

  sync() {
    const t = this.t;
    this.root.position.copy(this.pos);
    if (this.alive) {
      this.root.rotation.set(0, this.yaw, 0);
      this.bodyG.position.y = 0.75 + Math.abs(Math.sin(t * 8)) * 0.05;
      this.legs[0].rotation.x = Math.sin(t * 8) * 0.25; this.legs[1].rotation.x = -Math.sin(t * 8) * 0.25;
      this.arms.forEach((a, i) => {
        const punching = this.punchT > 0 && this.punchArm === i;
        a.rotation.x = punching ? -1.6 : -1.0 + Math.sin(t * 8 + i) * 0.1;
        a.rotation.z = (i ? 1 : -1) * (punching ? -0.1 : -0.35);
      });
      this.bodyG.rotation.y = Math.sin(t * 4) * 0.15;
    } else {
      this.root.rotation.y = this.yaw;
    }
  }
}
