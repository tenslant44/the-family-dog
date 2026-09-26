import * as THREE from 'three';
import { G, collideSphere } from './physics.js';
import { makeBomb, makeMine, makeYogurt, makeBurger } from './throwables.js';
import { std, box, ellip, cyl, makeBat, makeKnife, makePistol, makeGlue, makeBall, makeKnuckles, makeMilk, makeBone, makeGrapes, makeChocolate, makeKibbleBag, makeChainLinks, makeFishToy, makeSnowball } from './models.js';

const rand = (a, b) => a + Math.random() * (b - a);
const tmp = new THREE.Vector3(), dq = new THREE.Quaternion(), eul = new THREE.Euler(), qi = new THREE.Quaternion();
const CH = 0.95;

export class Player {
  constructor(scene, spawn) {
    this.spawn = spawn.clone();
    this.pos = spawn.clone();
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI;
    this.onGround = true;
    this.ragdoll = false; this.voluntary = false; this.knockT = 0; this.ko = 0; this.hurtCd = 0;
    this.rc = new THREE.Vector3(); this.rv = new THREE.Vector3(); this.rq = new THREE.Quaternion(); this.rang = new THREE.Vector3();
    this.getupT = 0;
    this.hp = 100;
    this.infiniteHealth = false;
    this.action = null; this.actionT = 0; this.actionDur = 0.4;
    this.spraying = false;
    this.carrying = false; this.squash = 0;
    this.walkPhase = 0; this.speed = 0; this.t = 0;
    this.build();
    scene.add(this.root);
  }

  build() {
    const skin = std(0xf0c29c), shirt = std(0x2f6fbd), pants = std(0x2b3445), shoe = std(0x222222), cap = std(0xc0392b);
    this.root = new THREE.Group();
    this.center = new THREE.Group(); this.center.position.y = CH; this.root.add(this.center);
    this.legs = [];
    for (const s of [-1, 1]) {
      const p = new THREE.Group(); p.position.set(s * 0.13, -0.1, 0); this.center.add(p);
      box(0.18, 0.8, 0.19, pants, 0, -0.4, 0, p);
      box(0.19, 0.1, 0.3, shoe, 0, -0.82, 0.05, p);
      box(0.2, 0.03, 0.31, std(0xf2f2f2), 0, -0.87, 0.05, p);
      this.legs.push(p);
    }
    this.upper = new THREE.Group(); this.upper.position.y = -0.05; this.center.add(this.upper);
    box(0.52, 0.64, 0.29, shirt, 0, 0.27, 0, this.upper);
    box(0.53, 0.08, 0.3, std(0x3a2a1a), 0, -0.02, 0, this.upper);
    box(0.54, 0.12, 0.3, std(0x2860a8), 0, 0.46, 0, this.upper, false);
    cyl(0.07, 0.08, 0.1, skin, 0, 0.64, 0, this.upper, 8);
    this.headG = new THREE.Group(); this.headG.position.y = 0.8; this.upper.add(this.headG);
    ellip(0.17, 0.19, 0.18, skin, 0, 0, 0, this.headG);
    for (const s of [-1, 1]) ellip(0.022, 0.028, 0.02, std(0x1a1a1a), s * 0.065, 0.03, 0.16, this.headG, 8);
    box(0.08, 0.02, 0.02, std(0x7a3a2a), 0, -0.08, 0.17, this.headG, false);
    ellip(0.18, 0.1, 0.19, cap, 0, 0.1, -0.01, this.headG);
    box(0.25, 0.025, 0.16, cap, 0, 0.1, 0.2, this.headG);
    this.arms = [];
    for (const s of [-1, 1]) {
      const p = new THREE.Group(); p.position.set(s * 0.34, 0.52, 0); this.upper.add(p);
      box(0.15, 0.3, 0.15, shirt, 0, -0.12, 0, p);
      box(0.13, 0.35, 0.13, skin, 0, -0.42, 0, p);
      ellip(0.075, 0.08, 0.075, skin, 0, -0.62, 0, p, 10);
      this.arms.push(p);
    }
    this.holdAnchor = new THREE.Object3D(); this.holdAnchor.position.set(0, 0.3, 0.62); this.center.add(this.holdAnchor);
    this.hand = new THREE.Group(); this.hand.position.set(0, -0.64, 0.03); this.arms[1].add(this.hand);
    this.hand.rotation.x = Math.PI / 2;
    const items = {
      bat: makeBat(), pistol: makePistol(), glue: makeGlue(), ball: makeBall(), knuckles: makeKnuckles(), milk: makeMilk(), bone: makeBone(1),
      grapes: makeGrapes(), chocolate: makeChocolate(), kibble: makeKibbleBag(), chain: makeChainLinks(4), john: makeFishToy(), snowball: makeSnowball(0.09),
      bomb: makeBomb(), mine: makeMine(), yogurt: makeYogurt(), burger: makeBurger(), knife: makeKnife(),
    };
    items.bat.position.y = 0.05;
    items.pistol.rotation.x = -Math.PI / 2; items.pistol.position.z = 0.1;
    items.glue.rotation.x = -Math.PI / 2; items.glue.position.z = 0.02;
    items.knuckles.rotation.x = -Math.PI / 2; items.knuckles.position.set(0, 0.02, 0.06);
    items.kibble.rotation.x = -Math.PI / 2;
    items.milk.rotation.x = -Math.PI / 2;
    items.yogurt.rotation.x = -Math.PI / 2;
    items.bomb.scale.setScalar(0.7); items.mine.scale.setScalar(0.6); items.mine.rotation.x = -Math.PI / 2;
    this.items = items;
    for (const k in items) { items[k].visible = false; this.hand.add(items[k]); items[k].traverse((o) => { if (o.isMesh) o.castShadow = true; }); }
  }

  setTool(id, hasBall = true) {
    for (const k in this.items) this.items[k].visible = k === id && (k !== 'ball' || hasBall);
  }

  handWorld(v) { return this.hand.getWorldPosition(v); }
  holdWorld(v) { return this.holdAnchor.getWorldPosition(v); }
  centerWorld(v) { return this.ragdoll ? v.copy(this.rc) : v.copy(this.pos).setY(this.pos.y + CH); }
  get canBeHit() { return this.hurtCd <= 0 && this.ko <= 0; }

  play(action, dur = 0.4) { this.action = action; this.actionT = 0; this.actionDur = dur; }

  hit(v, dmg) {
    if (!this.canBeHit) return;
    this.hurtCd = 0.35;
    this.hp = this.infiniteHealth ? 100 : Math.max(0, this.hp - dmg);
    this.enterRagdoll(v, false);
    if (this.hp <= 0) { this.ko = 3.5; this.onKO && this.onKO(); }
  }

  enterRagdoll(v, voluntary) {
    if (!this.ragdoll) {
      this.ragdoll = true;
      this.rc.copy(this.pos).setY(this.pos.y + CH);
      eul.set(0, this.yaw, 0, 'YXZ');
      this.rq.setFromEuler(eul);
    }
    this.rv.copy(v);
    this.rang.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(v.length() * 0.7 + (voluntary ? 2 : 3));
    this.voluntary = voluntary;
    this.knockT = voluntary ? 0 : 1.3;
    this.action = null;
  }

  getUp() {
    this.ragdoll = false;
    this.pos.set(this.rc.x, 0, this.rc.z);
    this.vel.set(0, 0, 0);
    this.getupT = 0.45;
    // keep current orientation for the blend
    eul.set(0, this.yaw, 0, 'YXZ');
    qi.setFromEuler(eul).invert();
    this.center.quaternion.copy(qi.multiply(this.rq));
  }

  respawn() {
    this.ragdoll = false; this.ko = 0; this.hp = 100;
    this.pos.copy(this.spawn); this.vel.set(0, 0, 0);
    this.center.quaternion.identity(); this.getupT = 0;
  }

  update(dt, input, aimYaw, controllable) {
    this.t += dt;
    this.hurtCd -= dt;
    if (this.ko > 0) { this.ko -= dt; if (this.ko <= 0) { this.respawn(); this.onRespawn && this.onRespawn(); } }
    else if (!this.ragdoll) this.hp = Math.min(100, this.hp + dt * 2);
    if (this.ragdoll) this.ragStep(dt, input);
    else this.walkStep(dt, input, aimYaw, controllable);
    this.animate(dt);
    this.squash = Math.max(0, this.squash - dt * 4);
    const q = this.squash;
    this.center.scale.set(1 + q * 0.3, 1 - q * 0.35, 1 + q * 0.3);
  }

  walkStep(dt, input, aimYaw, controllable) {
    let d = aimYaw - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 14);
    let mx = 0, mz = 0;
    this.sprinting = false;
    if (controllable) {
      const f = (input.w ? 1 : 0) - (input.s ? 1 : 0);
      const r = (input.d ? 1 : 0) - (input.a ? 1 : 0);
      const sy = Math.sin(aimYaw), cy = Math.cos(aimYaw);
      mx = sy * f - cy * r; mz = cy * f + sy * r;
      const l = Math.hypot(mx, mz);
      if (l > 0) { mx /= l; mz /= l; }
      this.sprinting = input.shift;
      const sp = (input.shift ? 9.5 : 5) * (this.carrying ? 0.72 : 1) * (this.speedMul || 1);
      mx *= sp; mz *= sp;
      if (input.space && this.onGround) { this.vel.y = 7.5; this.onGround = false; }
    }
    const k = Math.min(1, dt * (this.onGround ? 12 : 3));
    this.vel.x += (mx - this.vel.x) * k;
    this.vel.z += (mz - this.vel.z) * k;
    this.vel.y -= G * dt;
    this.pos.addScaledVector(this.vel, dt);
    this.onGround = false;
    tmp.copy(this.pos); tmp.y += 0.5;
    const hit = collideSphere(tmp, 0.4, this.vel, 0, 1);
    if (hit) {
      this.pos.copy(tmp); this.pos.y -= 0.5;
      if (hit.normal.y > 0.5) { this.onGround = true; if (this.vel.y < 0) this.vel.y = 0; }
    }
    tmp.copy(this.pos); tmp.y += 1.3;
    if (collideSphere(tmp, 0.3, this.vel, 0, 1)) { this.pos.x = tmp.x; this.pos.z = tmp.z; }
    if (this.pos.y <= 0) { this.pos.y = 0; this.vel.y = Math.max(0, this.vel.y); this.onGround = true; }
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    this.root.position.copy(this.pos);
    this.root.rotation.set(0, this.yaw, 0);
    if (this.getupT > 0) {
      this.getupT -= dt;
      this.center.quaternion.slerp(qi.identity(), 1 - Math.exp(-12 * dt));
      if (this.getupT <= 0) this.center.quaternion.identity();
    }
    this.center.position.y = CH;
  }

  ragStep(dt, input) {
    this.rv.y -= G * dt;
    this.rc.addScaledVector(this.rv, dt);
    const w = this.rang.length();
    if (w > 0.001) { dq.setFromAxisAngle(tmp.copy(this.rang).divideScalar(w), w * dt); this.rq.premultiply(dq); }
    collideSphere(this.rc, 0.35, this.rv, 0.3, 0.7);
    let grounded = false;
    if (this.rc.y <= 0.22) {
      this.rc.y = 0.22; grounded = true;
      if (this.rv.y < 0) { const imp = -this.rv.y; this.rv.y = imp > 3 ? imp * 0.3 : 0; this.rv.x *= 0.7; this.rv.z *= 0.7; this.rang.multiplyScalar(0.6); }
      const k = Math.max(0, 1 - dt * 4);
      this.rv.x *= k; this.rv.z *= k; this.rang.multiplyScalar(k);
      if (this.rv.lengthSq() < 2) {
        tmp.set(0, 0, 1).applyQuaternion(this.rq);
        const y = Math.atan2(tmp.x, tmp.z);
        eul.set(-Math.PI / 2, isFinite(y) ? this.yaw : 0, 0, 'YXZ');
        this.rq.slerp(dq.setFromEuler(eul), 1 - Math.exp(-4 * dt));
      }
    }
    this.knockT -= dt;
    if (!this.voluntary && this.knockT <= 0 && grounded && this.rv.lengthSq() < 1 && this.ko <= 0) this.getUp();
    this.root.position.set(this.rc.x, this.rc.y - CH, this.rc.z);
    this.root.rotation.set(0, 0, 0);
    this.center.quaternion.copy(this.rq);
  }

  animate(dt) {
    const [la, ra] = this.arms, [ll, rl] = this.legs;
    const t = this.t;
    if (this.ragdoll) {
      const wob = Math.min(1, this.rv.length() * 0.2) + 0.15;
      la.rotation.set(Math.sin(t * 9) * wob, 0, -1.2 - Math.sin(t * 7) * wob * 0.5);
      ra.rotation.set(Math.cos(t * 8) * wob, 0, 1.2 + Math.sin(t * 6) * wob * 0.5);
      ll.rotation.set(Math.sin(t * 10) * wob * 0.6, 0, -0.3);
      rl.rotation.set(Math.cos(t * 9) * wob * 0.6, 0, 0.3);
      this.upper.rotation.set(0, 0, 0);
      this.headG.rotation.set(Math.sin(t * 5) * wob * 0.3, 0, 0);
      return;
    }
    this.walkPhase += dt * (this.speed * 1.9);
    const amp = Math.min(0.9, this.speed * 0.12) * (this.onGround ? 1 : 0.3);
    const sw = Math.sin(this.walkPhase);
    ll.rotation.set(sw * amp, 0, 0); rl.rotation.set(-sw * amp, 0, 0);
    la.rotation.set(-sw * amp * 0.8, 0, -0.08); ra.rotation.set(sw * amp * 0.8, 0, 0.08);
    this.upper.rotation.set(this.sprinting && this.speed > 6 ? 0.2 : 0, 0, 0);
    this.headG.rotation.set(0, 0, 0);
    if (!this.onGround) { ll.rotation.x = -0.4; rl.rotation.x = 0.3; }
    if (this.spraying) { ra.rotation.set(-1.45, 0, 0); }
    if (this.carrying) { la.rotation.set(-1.35, 0, 0.35); ra.rotation.set(-1.35, 0, -0.35); this.upper.rotation.x = -0.08; }
    if (this.action) {
      this.actionT += dt;
      const p = Math.min(1, this.actionT / this.actionDur);
      const bump = Math.sin(p * Math.PI);
      switch (this.action) {
        case 'kick': rl.rotation.x = -bump * 1.8 + 0.3 * (1 - p); this.upper.rotation.x = -bump * 0.25; la.rotation.x = bump * 0.8; break;
        case 'punch': ra.rotation.set(-Math.PI / 2 * bump - 0.1, 0, 0); this.upper.rotation.y = -bump * 0.4; break;
        case 'shoot': ra.rotation.set(-1.45 + bump * 0.2, 0, 0); la.rotation.set(-1.05, 0, 0.3); break;
        case 'uppercut': ra.rotation.set(0.7 - p * 3.3, 0, 0); this.upper.rotation.set(-0.3 + p * 0.1, -0.3 * bump, 0); break;
        case 'bat': {
          const e = 1 - Math.pow(1 - p, 3);
          ra.rotation.set(-1.25, 0, 0.1); la.rotation.set(-1.25, 0, -0.35);
          this.upper.rotation.y = 1.4 - e * 3.0;
          break;
        }
        case 'pet': ra.rotation.set(-1.0 + Math.sin(p * Math.PI * 4) * 0.2, 0, 0); this.upper.rotation.x = 0.45 * bump; break;
        case 'throw': ra.rotation.set(-3.2 + p * 2.4, 0, 0); this.upper.rotation.x = -0.2 + p * 0.3; break;
        case 'kiss': this.upper.rotation.x = 0.55 * bump; this.headG.rotation.x = 0.45 * bump; la.rotation.set(-0.9 * bump, 0, 0); ra.rotation.set(-0.9 * bump, 0, 0); break;
        case 'grabpunch': ra.rotation.set(-Math.PI / 2 * bump - 0.1, 0, 0.5 * (1 - bump)); this.upper.rotation.y = -bump * 0.35; break;
        case 'toss': la.rotation.set(-1.35 - bump * 1.4, 0, 0.3); ra.rotation.set(-1.35 - bump * 1.4, 0, -0.3); this.upper.rotation.x = -0.35 * bump; break;
        case 'give': ra.rotation.set(-1.3 * bump, 0, 0); this.upper.rotation.x = 0.3 * bump; break;
      }
      if (p >= 1) this.action = null;
    }
  }
}
