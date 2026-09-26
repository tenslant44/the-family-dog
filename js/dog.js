import * as THREE from 'three';
import { G, collideSphere } from './physics.js';
import { std, ellip, cyl, mesh, box, canvasTex, makeBone } from './models.js';

export const STAND_H = 0.6;
const R = 0.42;
const rand = (a, b) => a + Math.random() * (b - a);
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), dq = new THREE.Quaternion(), eul = new THREE.Euler();
const GOLD = new THREE.Color(0xd39a4c), LIGHT = new THREE.Color(0xeac27e), EAR = new THREE.Color(0xbf8236);
const GREEN = new THREE.Color(0x8fbf3a), RED = new THREE.Color(0xd8503a);
const TINTS = { green: new THREE.Color(0x5ac83a), rad: new THREE.Color(0x9aff2a), zap: new THREE.Color(0xdff4ff), dark: new THREE.Color(0x201810) };
function tailSad(d) { d.tailSegs.forEach((s, i) => { s.rotation.x = i === 0 ? 0.9 : 0.25; s.rotation.y = 0; }); d.ears.forEach((e, i) => { e.rotation.x = 0.3; e.rotation.z = (i ? 1 : -1) * 0.05; }); }

export class Dog {
  constructor(scene, world, hooks) {
    this.world = world;
    this.hooks = hooks;
    this.name = 'The Family Dog';
    this.pos = world.dogHomePos.clone().setY(STAND_H);
    this.vel = new THREE.Vector3();
    this.q = new THREE.Quaternion();
    this.yaw = -Math.PI / 2;
    this.angVel = new THREE.Vector3();
    this.air = false; this.hop = false; this.getup = 0;
    this.stuck = 0; this.stuckWall = false; this.glue = 0;
    this.mood = 30; this.health = 100; this.infiniteHealth = false; this.dead = false; this.deathT = 0; this.finishPaid = false; this.finishKind = ''; this.finishAirborne = false;
    this.sick = 0; this.sickKind = ''; this.love = 0; this.chew = 0; this.eat = 0; this.ko = 0; this.happy = 0;
    this.lactose = Math.random() < 0.5;
    this.lactoseKnown = false;
    this.target = new THREE.Vector3(); this.wanderT = 0; this.idle = false;
    this.attackCd = 0; this.barkCd = 3; this.fartT = 0; this.poopT = rand(8, 15);
    this.launchInfo = null;
    this.squash = 0; this.walkPhase = 0; this.t = 0;
    this.carry = null;
    this.wasAngry = false;
    this.grabbed = false;
    this.season = 'default'; this.thirst = 100;
    this.distract = 0; this.bugCd = rand(4, 8); this.snapT = 0; this.snapAnim = 0; this.bugSwarm = null;
    this.kissT = 0;
    this.blind = 0; this.blindHard = false; this.sad = 0; this.fear = ''; this.inside = false; this.locked = false;
    this.infiniteLove = false;
    this.tint = ''; this.swell = 1; this.flat = 0; this.fatalFall = false; this.outsideT = 0;
    this.build();
    scene.add(this.root);
  }

  get angry() { return !this.infiniteLove && this.mood < -25 && this.love <= 0 && this.sad <= 0 && !this.fear && this.blind <= 0; }
  get crying() { return this.sad > 0 || !!this.fear || this.locked; }

  build() {
    const furTex = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        g.strokeStyle = Math.random() < 0.5 ? 'rgba(160,110,50,0.25)' : 'rgba(255,240,210,0.3)';
        g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + rand(-2, 2), y + rand(4, 9)); g.stroke();
      }
    }, 2, 2);
    this.mGold = std(GOLD.clone(), { map: furTex, roughness: 0.9 });
    this.mLight = std(LIGHT.clone(), { map: furTex, roughness: 0.95 });
    this.mEar = std(EAR.clone(), { map: furTex, roughness: 0.9 });
    const dark = std(0x16100c, { roughness: 0.25 });
    const root = (this.root = new THREE.Group());
    const body = (this.body = new THREE.Group());
    root.add(body);
    ellip(0.3, 0.3, 0.56, this.mGold, 0, 0, 0, body, 20);
    ellip(0.28, 0.3, 0.3, this.mLight, 0, -0.02, 0.33, body);
    ellip(0.3, 0.29, 0.3, this.mGold, 0, 0.03, -0.36, body);
    ellip(0.2, 0.12, 0.35, this.mLight, 0, -0.2, 0.05, body); // belly feathering
    const neck = ellip(0.18, 0.26, 0.2, this.mGold, 0, 0.22, 0.48, body);
    neck.rotation.x = -0.5;
    this.neckAnchor = new THREE.Object3D(); this.neckAnchor.position.set(0, 0.25, 0.55); body.add(this.neckAnchor);
    // collar
    const collar = mesh(new THREE.TorusGeometry(0.175, 0.03, 8, 20), std(0xc0262e, { roughness: 0.5 }), 0, 0.27, 0.55, body);
    collar.rotation.x = Math.PI / 2 - 0.55;
    const tag = cyl(0.04, 0.04, 0.01, std(0xe6c050, { metalness: 0.9, roughness: 0.3 }), 0, 0.1, 0.72, body, 12);
    tag.rotation.x = Math.PI / 2 - 0.3;
    // head
    const head = (this.head = new THREE.Group());
    head.position.set(0, 0.46, 0.66);
    body.add(head);
    ellip(0.2, 0.19, 0.22, this.mGold, 0, 0, 0, head);
    ellip(0.17, 0.12, 0.1, this.mGold, 0, 0.08, -0.03, head); // forehead
    ellip(0.105, 0.09, 0.16, this.mLight, 0, -0.06, 0.18, head);
    ellip(0.05, 0.04, 0.04, dark, 0, -0.02, 0.33, head, 12);
    const jaw = (this.jaw = new THREE.Group()); jaw.position.set(0, -0.12, 0.1); head.add(jaw);
    ellip(0.09, 0.04, 0.13, this.mLight, 0, 0, 0.07, jaw);
    this.tongue = ellip(0.05, 0.015, 0.08, std(0xe86a7a, { roughness: 0.4 }), 0, -0.01, 0.16, jaw, 10);
    this.eyes = [];
    this.brows = [];
    for (const s of [-1, 1]) {
      const e = ellip(0.036, 0.04, 0.03, dark, s * 0.088, 0.05, 0.175, head, 12);
      ellip(0.01, 0.01, 0.01, std(0xffffff, { emissive: 0xffffff }), s * 0.078, 0.065, 0.2, head, 6);
      this.eyes.push(e);
      const b = box(0.08, 0.018, 0.02, std(0x8a5a26), s * 0.09, 0.105, 0.18, head, false);
      this.brows.push(b);
    }
    this.ears = [];
    for (const s of [-1, 1]) {
      const p = new THREE.Group(); p.position.set(s * 0.16, 0.07, -0.02); head.add(p);
      const e = ellip(0.05, 0.15, 0.1, this.mEar, s * 0.03, -0.11, 0, p);
      p.rotation.z = s * 0.15;
      this.ears.push(p);
    }
    this.mouthBone = makeBone(0.9);
    this.mouthBone.position.set(0, -0.12, 0.26); this.mouthBone.rotation.y = 0;
    this.mouthBone.visible = false;
    head.add(this.mouthBone);
    this.poopMask = new THREE.Group(); head.add(this.poopMask);
    const pm = std(0x6a3e18, { roughness: 0.15 });
    ellip(0.17, 0.09, 0.06, pm, 0, 0.05, 0.18, this.poopMask, 10);
    for (let i = 0; i < 5; i++) ellip(0.04, 0.05, 0.03, pm, rand(-0.14, 0.14), rand(-0.04, 0.02), 0.2, this.poopMask, 6);
    this.poopMask.visible = false;
    this.mouthAnchor = new THREE.Object3D(); this.mouthAnchor.position.set(0, -0.12, 0.3); head.add(this.mouthAnchor);
    // legs
    this.legs = [];
    for (const [x, z, back] of [[-0.17, 0.34, 0], [0.17, 0.34, 0], [-0.17, -0.36, 1], [0.17, -0.36, 1]]) {
      const p = new THREE.Group(); p.position.set(x, -0.1, z); body.add(p);
      ellip(back ? 0.12 : 0.1, 0.19, back ? 0.15 : 0.12, this.mGold, 0, -0.08, 0, p);
      cyl(0.055, 0.05, 0.3, this.mGold, 0, -0.3, 0, p, 10);
      ellip(0.06, 0.1, 0.05, this.mLight, 0, -0.26, back ? 0.05 : -0.05, p, 8); // feathering
      ellip(0.07, 0.05, 0.09, this.mLight, 0, -0.45, 0.025, p, 10);
      this.legs.push(p);
    }
    // tail
    this.tail = new THREE.Group(); this.tail.position.set(0, 0.12, -0.6); body.add(this.tail);
    let parent = this.tail;
    this.tailSegs = [];
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Group(); s.position.set(0, 0, i ? -0.1 : 0); parent.add(s);
      ellip(0.05 - i * 0.005, 0.05, 0.07, this.mGold, 0, 0, -0.05, s, 8);
      ellip(0.03, 0.07 - i * 0.004, 0.06, this.mLight, 0, -0.05, -0.05, s, 6);
      this.tailSegs.push(s);
      parent = s;
    }
    // glue blobs
    this.glueBlobs = [];
    const gm = std(0xf4f1e2, { roughness: 0.1, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 12; i++) {
      const a = rand(0, Math.PI * 2);
      const b = ellip(rand(0.05, 0.09), rand(0.03, 0.06), rand(0.05, 0.09), gm, Math.cos(a) * 0.29, 0.1 + Math.sin(a) * 0.2, rand(-0.5, 0.5), body, 8);
      b.visible = false;
      this.glueBlobs.push(b);
    }
    root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }

  neckWorld(v) { return this.neckAnchor.getWorldPosition(v); }
  mouthWorld(v) { return this.mouthAnchor.getWorldPosition(v); }

  grab() {
    this.grabbed = true;
    this.headGrab = false;
    this.air = false; this.hop = false; this.getup = 0; this.eat = 0; this.distract = 0;
    if (this.stuck > 0) { this.stuck = 0; this.stuckWall = false; }
    if (this.chew > 0) { this.chew = 0; this.mouthBone.visible = false; }
    if (this.carry === 'ball') { this.carry = null; this.hooks.dropBall(this); }
    this.vel.set(0, 0, 0); this.angVel.set(0, 0, 0);
    this.launchInfo = null;
  }

  // let go without a throw: it just drops
  release(v) {
    this.grabbed = false;
    this.headGrab = false;
    this.air = true; this.hop = false;
    this.vel.copy(v);
    this.angVel.set(rand(-1, 1), 0, rand(-1, 1)).multiplyScalar(2);
    this.launchInfo = null;
  }

  launch(v, kind) {
    if (this.dead) return;
    this.grabbed = false;
    if (this.stuck > 0) { this.stuck = 0; this.stuckWall = false; }
    const wasAir = this.air && this.launchInfo;
    this.air = true; this.hop = false; this.getup = 0; this.eat = 0;
    if (this.chew > 0) { this.chew = 0; }
    if (this.carry === 'ball') { this.carry = null; this.hooks.dropBall(this); }
    this.vel.copy(v);
    this.angVel.set(rand(-1, 1), rand(-0.5, 0.5), rand(-1, 1)).normalize().multiplyScalar(v.length() * 0.45 + 3);
    if (!wasAir) this.launchInfo = { from: this.pos.clone(), kind, maxH: this.pos.y, angry: this.angry, hits: 1, t: 0, seq: [kind], slams: 0, smashed: 0, punches: 0, wallStuck: false };
    else { this.launchInfo.kind = kind; this.launchInfo.hits++; this.launchInfo.seq.push(kind); this.hooks.comboHit && this.hooks.comboHit(this, kind); }
  }

  damage(amount, kind) {
    if (this.dead || this.infiniteHealth || amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
    if (this.health === 0) {
      this.dead = true; this.finishKind = kind; this.finishAirborne = this.air && this.pos.y > 1.1; this.finishPaid = false; this.deathT = 4.5;
      this.sick = 0; this.sickKind = ''; this.ko = 0;
      this.hooks.defeated(this);
    }
  }

  respawn() {
    if (this.carry === 'ball') { this.carry = null; this.hooks.dropBall(this); }
    this.teleportHome();
    this.dead = false; this.deathT = 0; this.health = 100; this.mood = 10;
    this.glue = 0; this.sick = 0; this.sickKind = ''; this.ko = 0; this.love = 0;
    this.finishKind = ''; this.finishShotDistance = 0; this.finishAirborne = false;
    this.chew = 0; this.mouthBone.visible = false; this.carCd = 1;
    this.blind = 0; this.sad = 0; this.tint = ''; this.swell = 1; this.flat = 0; this.fatalFall = false; this.locked = false; this.inside = false;
  }

  doHop(dir, up = 5, fwd = 3) {
    this.air = true; this.hop = true;
    this.vel.set(dir.x * fwd, up, dir.z * fwd);
    this.angVel.set(0, 0, 0);
  }

  update(dt, ctx) {
    this.t += dt;
    if (this.infiniteLove && !this.dead) { this.love = 30; this.mood = 100; }
    if (this.inside) { this.root.visible = false; return; }
    this.root.visible = true;
    this.blind = Math.max(0, this.blind - dt);
    this.sad = Math.max(0, this.sad - dt);
    if (this.locked) {
      this.squash = Math.max(0, this.squash - dt * 4);
      this.animate(dt);
      this.root.position.copy(this.pos);
      this.applyScale();
      return;
    }
    this.attackCd -= dt; this.barkCd -= dt;
    this.squash = Math.max(0, this.squash - dt * 4);
    this.glue = Math.max(0, this.glue - dt * 0.025);
    this.happy = Math.max(0, this.happy - dt);
    if (this.love > 0) { this.love -= dt; this.mood = 100; }
    this.season = ctx.season || 'default';
    const summer = this.season === 'summer';
    this.thirst = summer ? Math.max(0, this.thirst - dt * 1.1) : Math.min(100, this.thirst + dt * 6);
    this.kissT = Math.max(0, this.kissT - dt);
    this.snapAnim = Math.max(0, this.snapAnim - dt);
    this.bugCd -= dt;
    if (!this.air) {
      if (summer && this.thirst < 35 && this.love <= 0) this.mood -= dt * 1.8;
      else if (this.mood < 10) this.mood = Math.min(10, this.mood + dt * (summer ? 0.8 : 1.6));
      else if (this.mood > 10 && this.love <= 0) this.mood = Math.max(10, this.mood - dt * (summer ? 1.4 : 0.5));
    }
    this.mood = THREE.MathUtils.clamp(this.mood, -100, 100);
    if (this.dead) {
      if (this.air) this.airStep(dt);
      else {
        this.deathT -= dt;
        this.pos.y = 0.35;
        this.q.slerp(this.uprightQ(Math.PI / 2), 1 - Math.exp(-5 * dt));
        if (this.deathT <= 0) this.hooks.respawn(this);
      }
      this.animate(dt);
      this.root.position.copy(this.pos);
      this.root.quaternion.copy(this.q);
      return;
    }
    if (this.sick > 0) {
      this.sick -= dt;
      this.damage(dt * (this.sickKind === 'milk' ? 1.3 : 1.8), this.sickKind === 'milk' ? 'Milk' : 'Grapes');
      if (this.dead) return;
      if (this.sickKind === 'milk') {
        this.fartT -= dt;
        if (this.fartT <= 0) { this.fartT = rand(1.5, 3); this.hooks.fart(this); }
      }
      if (this.sick <= 0) this.sickKind = '';
    } else if (this.ko <= 0) this.health = Math.min(100, this.health + dt * 1.2);
    if (this.angry && !this.wasAngry) this.hooks.becameAngry(this);
    this.wasAngry = this.angry;

    if (this.grabbed) this.heldStep(dt, ctx);
    else if (this.stuck > 0) {
      this.stuck -= dt;
      if (this.stuck <= 0) {
        this.glue = Math.min(this.glue, 0.08);
        if (this.stuckWall) { this.stuckWall = false; this.air = true; this.vel.set(0, -1, 0); }
        else this.getup = 0.8;
        this.hooks.pop(this, 'unstuck', '#f4f1e2');
        this.puddleImmune = 4;
      }
    } else if (this.air) this.airStep(dt);
    else this.groundStep(dt, ctx);

    if (!this.air && !this.grabbed && this.stuck <= 0 && this.ko <= 0) {
      this.poopT -= dt;
      if (this.poopT <= 0) { this.poopT = rand(18, 32); this.hooks.poop(this); }
    }
    this.animate(dt);
    this.root.position.copy(this.pos);
    if (this.fear && !this.air && !this.grabbed) this.root.position.x += Math.sin(this.t * 60) * 0.02;
    this.root.quaternion.copy(this.q);
    this.applyScale();
  }

  applyScale() {
    const s = this.squash;
    this.body.scale.set(1 + s * 0.35, 1 - s * 0.35, 1 + s * 0.25);
    if (this.flat > 0) this.body.scale.set(1.6, 0.15, 1.4);
    this.root.scale.setScalar(this.swell);
  }

  heldStep(dt, ctx) {
    const p = ctx.player;
    p.holdWorld(this.pos);
    if (this.headGrab) this.pos.y += 0.25;
    this.vel.set(0, 0, 0);
    this.yaw = p.yaw + Math.PI / 2;
    const wig = this.angry ? Math.sin(this.t * 17) * 0.25 : Math.sin(this.t * 6) * 0.08;
    eul.set(wig * 0.4, this.yaw, (this.headGrab ? Math.PI * 0.32 : Math.PI * 0.08) + wig, 'YXZ');
    this.q.setFromEuler(eul);
    this.speed = 0;
  }

  airStep(dt) {
    this.vel.y -= G * dt;
    this.vel.multiplyScalar(1 - 0.06 * dt);
    this.pos.addScaledVector(this.vel, dt);
    if (this.launchInfo) { this.launchInfo.maxH = Math.max(this.launchInfo.maxH, this.pos.y); this.launchInfo.t += dt; }
    const w = this.angVel.length();
    if (w > 0.001) { dq.setFromAxisAngle(tmp.copy(this.angVel).divideScalar(w), w * dt); this.q.premultiply(dq); }
    const hit = collideSphere(this.pos, R, this.vel, 0.42, 0.75);
    if (hit && hit.impact > 6) {
      this.squash = 1;
      this.angVel.multiplyScalar(0.5).add(tmp.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(hit.impact * 0.3));
      this.hooks.slam(this, hit.impact, hit.normal, hit.collider);
      if (this.glue > 0.15 && Math.abs(hit.normal.y) < 0.6) {
        this.stuck = 5; this.stuckWall = true; this.vel.set(0, 0, 0); this.angVel.set(0, 0, 0);
        if (this.launchInfo) this.launchInfo.wallStuck = true;
        this.hooks.pop(this, 'STUCK TO THE WALL', '#f4f1e2');
        return;
      }
    }
    if (hit && hit.normal.y > 0.6 && this.vel.lengthSq() < 4 && this.pos.y > 0.9) {
      // resting on top of something: slide off it
      const c = hit.collider;
      tmp.set(this.pos.x - (c.min.x + c.max.x) / 2, 0, this.pos.z - (c.min.z + c.max.z) / 2);
      if (tmp.lengthSq() < 0.01) tmp.set(1, 0, 0);
      tmp.normalize();
      this.vel.set(tmp.x * 4, 3, tmp.z * 4);
    }
    const floor = this.hop ? STAND_H : R;
    if (this.pos.y <= floor) {
      this.pos.y = floor;
      if (this.hop) { this.air = false; this.hop = false; this.vel.set(0, 0, 0); return; }
      if (this.vel.y < 0) {
        const imp = -this.vel.y;
        if (imp > 6) { this.hooks.thud(this, imp); this.squash = Math.min(1, imp / 14); }
        if (this.glue > 0.15 && imp > 2) {
          this.vel.set(0, 0, 0); this.angVel.set(0, 0, 0);
          this.air = false; this.stuck = 5; this.stuckWall = false;
          this.hooks.pop(this, 'STUCK', '#f4f1e2');
          this.hooks.land(this);
          return;
        }
        this.vel.y = imp > 3 ? imp * 0.36 : 0;
        this.vel.x *= 0.74; this.vel.z *= 0.74;
        this.angVel.multiplyScalar(0.6);
      }
      if (this.vel.y === 0) {
        const k = Math.max(0, 1 - 3.5 * dt);
        this.vel.x *= k; this.vel.z *= k; this.angVel.multiplyScalar(k);
      }
      if (this.vel.lengthSq() < 1.0) this.settle();
    }
  }

  settle() {
    this.air = false; this.vel.set(0, 0, 0); this.angVel.set(0, 0, 0); this.getup = 1.0;
    tmp.set(0, 0, 1).applyQuaternion(this.q);
    if (Math.abs(tmp.x) + Math.abs(tmp.z) > 0.01) this.yaw = Math.atan2(tmp.x, tmp.z);
    this.hooks.land(this);
  }

  uprightQ(roll = 0) {
    eul.set(0, this.yaw, roll, 'YXZ');
    return dq.setFromEuler(eul);
  }

  groundStep(dt, ctx) {
    const { player, john, ball, fx } = ctx;
    if (this.getup > 0) {
      this.getup -= dt;
      this.q.slerp(this.uprightQ(), 1 - Math.exp(-7 * dt));
      this.pos.y += (STAND_H - this.pos.y) * Math.min(1, dt * 6);
      return;
    }
    this.pos.y = STAND_H;
    if (this.ko > 0) {
      this.ko -= dt;
      this.q.slerp(this.uprightQ(Math.PI / 2), 1 - Math.exp(-5 * dt));
      this.pos.y = 0.35;
      if (this.ko <= 0) { this.health = 45; this.getup = 1; this.hooks.pop(this, 'it\'s fine', '#ffffff'); }
      return;
    }
    let tgt = null, speed = 0, stop = 0.2;
    const pp = player.pos;
    if (this.blind > 0) {
      // can't see: stumbles around bumping into stuff
      this.wanderT -= dt;
      if (this.wanderT <= 0) { this.wanderT = rand(0.5, 1.4); this.target.set(this.pos.x + rand(-4, 4), 0, this.pos.z + rand(-4, 4)); }
      tgt = this.target; speed = 2.6; stop = 0.2;
      if (this.barkCd <= 0) { this.barkCd = rand(1.5, 3); this.hooks.pop(this, ['*whimper*', 'I CAN\'T SEE', '*sniff sniff*', '?!?!'][(Math.random() * 4) | 0], '#c8a070', 18); }
    } else if (this.fear === 'cry') {
      // cowering inside the bunker
      tgt = null; speed = 0;
      this.q.slerp(this.uprightQ(0), 0.1);
    } else if (this.fear === 'scared') {
      tgt = this.world.dogHomePos; speed = 5.5; stop = 0.5;
    } else if (this.sad > 0) {
      this.wanderT -= dt;
      if (this.wanderT <= 0) { this.wanderT = rand(4, 8); this.target.set(rand(-13, 13), 0, rand(-9, 12)); }
      tgt = this.target; speed = 0.8; stop = 0.5;
    } else if (this.eat > 0) {
      this.eat -= dt;
      tgt = this.world.bowlPos; speed = 0; this.faceTo(this.world.bowlPos, dt);
      if (this.eat <= 0) { this.world.setFood(false); this.foodWaiting = false; this.mood += 20; this.happy = 3; this.hooks.pop(this, '♥', '#ff5d8f'); if (this.season === 'summer') { this.thirst = 100; this.hooks.pop(this, 'refreshed', '#9fdcff'); } }
    } else if (john && john.alive) {
      tgt = john.pos; speed = 5; stop = 1.0;
      const dist = tmp.subVectors(john.pos, this.pos).setY(0).length();
      if (dist < 1.6 && this.attackCd <= 0 && john.canBeHit) {
        tmp.normalize();
        john.hit(tmp2.copy(tmp).multiplyScalar(7).setY(4.5), 14);
        this.doHop(tmp, 3.5, 3);
        this.attackCd = rand(0.9, 1.4);
        this.hooks.sound('growl', 0.7);
        this.hooks.pop(this, 'CHOMP', '#ffdd55');
      }
    } else if (this.carry === 'ball') {
      tgt = pp; speed = 5; stop = 1.3;
      if (tmp.subVectors(pp, this.pos).setY(0).length() < 1.6) {
        this.carry = null; this.hooks.returnBall(this);
        this.mood += 14; this.happy = 3; this.hooks.pop(this, '♥', '#ff5d8f');
      }
    } else if (ball.state === 'free' && !this.angry && this.chew <= 0) {
      tgt = ball.pos; speed = 6.5; stop = 0;
      if (tmp.subVectors(ball.pos, this.pos).setY(0).length() < 0.75 && ball.pos.y < 0.7) {
        ball.state = 'dog'; this.carry = 'ball';
      }
    } else if (this.distract > 0 && this.bugSwarm) {
      this.distract -= dt;
      const sw = this.bugSwarm.pos;
      tgt = sw; speed = 3.2; stop = 0.75;
      const toB = tmp.subVectors(sw, this.pos).setY(0);
      if (toB.length() < 1.3) {
        this.faceTo(sw, dt);
        this.snapT -= dt;
        if (this.snapT <= 0) {
          this.snapT = rand(0.45, 0.85);
          this.snapAnim = 0.22;
          this.bugSwarm.scatter = 1;
          this.hooks.sound('snap', 0.55);
          this.hooks.bugSnap && this.hooks.bugSnap(this);
          this.hooks.pop(this, ['snap', 'SNAP', '*chomp*', 'snap!'][(Math.random() * 4) | 0], '#e8f4c0', 18);
          this.doHop(toB.normalize(), 3.4, 0.5);
          return;
        }
      }
      if (this.distract <= 0) {
        this.bugCd = rand(9, 18); this.bugSwarm = null;
        if (Math.random() < 0.4) this.hooks.pop(this, ['caught nothing', 'missed', 'it forgot why'][(Math.random() * 3) | 0], '#ffffff', 16);
      }
    } else if (this.angry) {
      if (this.season === 'spring' && this.bugCd <= 0 && Math.random() < dt * 0.12) this.tryDistract(ctx, 4);
      tgt = pp; speed = this.sick > 0 ? 3.5 : 6.8; stop = 1.2;
      const toP = tmp.subVectors(pp, this.pos).setY(0);
      const dist = toP.length();
      toP.normalize();
      if (this.barkCd <= 0) { this.barkCd = rand(2.5, 5); this.hooks.sound(Math.random() < 0.5 ? 'growl' : 'bark', 0.6); }
      if (dist < 2.0 && this.attackCd <= 0 && player.canBeHit) {
        if (player.ragdoll) {
          player.hit(tmp2.copy(toP).multiplyScalar(11).setY(8), 13);
          this.mood += 5;
          this.doHop(toP, 5, 3);
          this.attackCd = 0.75;
          this.hooks.sound('bark', 0.9);
          this.hooks.pop(this, ['CHOMP', 'BONK', 'WHAM', 'RUFF'][(Math.random() * 4) | 0], '#ff7b4a');
        } else if (this.mood < -55) {
          player.hit(tmp2.copy(toP).multiplyScalar(8).setY(5), 9);
          this.doHop(toP, 4, 4);
          this.attackCd = 2.2;
          this.hooks.sound('bark', 0.9);
          this.hooks.pop(this, 'TACKLE', '#ff7b4a');
        } else this.attackCd = 1;
      }
    } else if (this.foodWaiting) {
      tgt = this.world.bowlPos; speed = 4; stop = 0.62;
      if (tmp.subVectors(this.world.bowlPos, this.pos).setY(0).length() < 0.8) { this.eat = 3; this.hooks.sound('eat', 0.8); }
    } else if (this.love > 0) {
      tgt = pp; speed = 5; stop = 2;
    } else if (this.chew > 0) {
      this.chew -= dt;
      if (this.chew <= 0) this.mouthBone.visible = false;
    } else {
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = rand(3, 7);
        this.idle = Math.random() < 0.35;
        this.target.set(rand(-13, 13), 0, rand(-9, 12));
        if (Math.random() < 0.15) this.target.copy(this.world.dogHomePos);
      }
      if (!this.idle) { tgt = this.target; speed = 1.7; stop = 0.5; }
      if (this.season === 'spring' && this.bugCd <= 0 && Math.random() < dt * 0.6) this.tryDistract(ctx, 8);
    }
    if (this.sick > 0 && this.blind <= 0) speed *= 0.55;
    if (this.season === 'summer') speed *= this.thirst < 35 ? 0.55 : 0.72;

    let dx = 0, dz = 0;
    if (tgt && speed > 0) {
      const ox = tgt.x - this.pos.x, oz = tgt.z - this.pos.z;
      const d = Math.hypot(ox, oz);
      if (d > stop) {
        const sp = Math.min(speed, (d - stop) * 3 + 0.5);
        dx = (ox / d) * sp; dz = (oz / d) * sp;
      }
    }
    const k = Math.min(1, dt * 7);
    this.vel.x += (dx - this.vel.x) * k;
    this.vel.z += (dz - this.vel.z) * k;
    this.vel.y = 0;
    this.pos.addScaledVector(this.vel, dt);
    collideSphere(this.pos, R, this.vel, 0, 1);
    this.pos.y = STAND_H;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > 0.3) this.turnTo(Math.atan2(this.vel.x, this.vel.z), dt);
    else if (this.angry || this.love > 0) this.faceTo(pp, dt);
    this.speed = hs;
    const roll = this.sick > 0 ? Math.sin(this.t * 3) * 0.14 : 0;
    this.q.copy(this.uprightQ(roll));
    this.puddleImmune = (this.puddleImmune || 0) - dt;
    if (this.stuck <= 0 && this.puddleImmune <= 0 && fx.puddleAt(this.pos)) {
      this.stuck = 5; this.stuckWall = false; this.vel.set(0, 0, 0);
      this.hooks.pop(this, 'STUCK IN GLUE', '#f4f1e2');
    }
  }

  tryDistract(ctx, range) {
    const bugs = ctx.bugs;
    if (!bugs || !bugs.length) return;
    let best = null, bd = range;
    for (const b of bugs) { const d = Math.hypot(b.pos.x - this.pos.x, b.pos.z - this.pos.z); if (d < bd) { bd = d; best = b; } }
    if (!best) { this.bugCd = rand(2, 4); return; }
    this.bugSwarm = best; this.distract = rand(2.5, 4); this.snapT = 0.3;
    this.hooks.pop(this, '?!', '#ffffff', 22);
  }

  faceTo(p, dt) { this.turnTo(Math.atan2(p.x - this.pos.x, p.z - this.pos.z), dt); }
  turnTo(a, dt) {
    let d = a - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 8);
  }

  animate(dt) {
    const t = this.t;
    const flail = this.air && !this.hop || this.stuck > 0 || this.grabbed;
    const lying = this.chew > 0 && !this.air;
    if (flail) {
      this.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 22 + i * 1.7) * 0.9; l.rotation.z = Math.sin(t * 17 + i) * 0.3; });
    } else if (lying) {
      this.legs.forEach((l, i) => { l.rotation.x = i < 2 ? -1.35 : 1.35; l.rotation.z = 0; });
      this.body.position.y = -0.3;
    } else {
      const sp = this.speed || 0;
      this.walkPhase += dt * (4 + sp * 2.2);
      const amp = Math.min(0.75, sp * 0.22);
      const offs = [0, Math.PI, Math.PI * 0.5, Math.PI * 1.5];
      this.legs.forEach((l, i) => { l.rotation.x = Math.sin(this.walkPhase + offs[i]) * amp; l.rotation.z = 0; });
      this.body.position.y = Math.abs(Math.sin(this.walkPhase)) * amp * 0.05;
    }
    if (!lying && !flail) {} else if (!lying) this.body.position.y = 0;
    // tail
    let rate = 7, amp = 0.35, lift = -0.35;
    if (this.mood > 40 || this.happy > 0 || this.love > 0) { rate = 16; amp = 0.8; lift = -0.6; }
    if (this.angry) { rate = 4; amp = 0.1; lift = -1.0; }
    if (this.sick > 0 || this.ko > 0) { rate = 2; amp = 0.1; lift = 0.5; }
    if (flail) { rate = 25; amp = 0.9; }
    this.tailSegs.forEach((s, i) => {
      s.rotation.y = Math.sin(t * rate - i * 0.5) * amp * (i ? 0.45 : 1);
      s.rotation.x = i === 0 ? lift : 0.2;
    });
    // head / face
    const eating = this.eat > 0;
    this.head.rotation.x = eating ? 0.7 + Math.sin(t * 12) * 0.15 : this.angry ? 0.25 : this.chew > 0 ? 0.3 + Math.sin(t * 8) * 0.05 : Math.sin(t * 1.3) * 0.05;
    this.head.rotation.z = this.sick > 0 ? Math.sin(t * 2.3) * 0.2 : 0;
    this.head.rotation.y = (this.speed || 0) < 0.3 && !this.angry && !eating ? Math.sin(t * 0.7) * 0.35 : 0;
    const open = this.angry ? 0.25 + Math.sin(t * 30) * 0.05 : (this.mood > 30 || this.happy > 0) ? 0.3 : 0.05;
    const panting = this.season === 'summer' && !this.angry && !flail && !eating;
    this.jaw.rotation.x = flail ? 0.5 : eating ? Math.abs(Math.sin(t * 12)) * 0.4 : panting ? 0.38 + Math.sin(t * 16) * 0.08 : open;
    if (this.snapAnim > 0) this.jaw.rotation.x = Math.sin((this.snapAnim / 0.22) * Math.PI) * 0.6;
    this.tongue.visible = !this.angry && (this.mood > 20 || this.happy > 0 || flail || panting) && this.snapAnim <= 0;
    this.tongue.scale.z = panting ? 0.14 : 0.08;
    this.tongue.position.y = panting ? -0.04 : -0.01;
    if (panting) this.body.position.y += Math.sin(t * 16) * 0.012;
    if (this.distract > 0) { this.head.rotation.x = -0.35 + Math.sin(t * 3) * 0.1; this.head.rotation.y = Math.sin(t * 2.2) * 0.4; }
    const sadFace = this.crying && !this.angry;
    if (sadFace && !flail) { this.head.rotation.x = 0.45 + Math.sin(t * 20) * (this.fear ? 0.03 : 0); tailSad(this); }
    this.brows.forEach((b, i) => { const s = i ? 1 : -1; b.rotation.z = this.angry ? -s * 0.5 : (this.sick > 0 || sadFace) ? s * 0.5 : 0; b.position.y = this.angry ? 0.09 : 0.105; });
    this.poopMask.visible = this.blind > 0;
    if (this.blind > 0) this.head.rotation.y = Math.sin(t * 9) * 0.5;
    const eyeY = this.dead || this.ko > 0 ? 0.2 : this.kissT > 0 ? 0.25 : 1;
    this.eyes.forEach((e) => (e.scale.y = 0.04 * eyeY));
    this.ears.forEach((e, i) => {
      const s = i ? 1 : -1;
      e.rotation.x = flail ? Math.sin(t * 20 + i) * 0.9 : this.angry ? -0.4 : 0;
      e.rotation.z = s * (flail ? 0.8 + Math.sin(t * 18 + i) * 0.5 : this.angry ? 0.5 : 0.15);
    });
    // glue blobs
    this.glueBlobs.forEach((b, i) => { b.visible = this.glue > i / 12 * 0.9 + 0.02; });
    // tint
    const sickAmt = this.sick > 0 ? 0.55 : 0;
    const angAmt = this.angry ? Math.min(0.35, (-this.mood - 25) / 150 + 0.12) : 0;
    this.mGold.color.copy(GOLD).lerp(GREEN, sickAmt).lerp(RED, angAmt);
    this.mLight.color.copy(LIGHT).lerp(GREEN, sickAmt * 0.8).lerp(RED, angAmt * 0.8);
    this.mEar.color.copy(EAR).lerp(GREEN, sickAmt).lerp(RED, angAmt);
    if (this.tint) {
      const c = TINTS[this.tint];
      if (c) for (const m of [this.mGold, this.mLight, this.mEar]) m.color.lerp(c, this.tint === 'dark' ? 0.85 : 0.7);
    }
  }

  teleportHome() {
    this.pos.copy(this.world.dogHomePos).setY(STAND_H);
    this.vel.set(0, 0, 0); this.angVel.set(0, 0, 0);
    this.air = false; this.hop = false; this.stuck = 0; this.stuckWall = false; this.getup = 0; this.grabbed = false;
    this.yaw = -Math.PI / 2; this.q.copy(this.uprightQ());
    this.launchInfo = null;
  }
}
