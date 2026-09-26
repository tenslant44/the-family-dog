import * as THREE from 'three';
import { G, collideSphere } from './physics.js';
import { std, box, ellip, cyl } from './models.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const tmp = new THREE.Vector3(), dq = new THREE.Quaternion(), eul = new THREE.Euler();
const CH = 0.95;
const SIDEWALKS = [15.6, 28.4];

const CATCH = 'I live in Massachusetts!';
const DUMB = [
  'I live in Massachusetts!',
  'Hi! I live in Massachusetts!',
  'Wicked nice day. I live in Massachusetts!',
  'Where\'s the Dunkin\'? I live in Massachusetts!',
  'I pahked my cah in Hahvahd Yahd!',
  'Is this Texas? NO! I live in Massachusetts!',
  'Did you know I live in Massachusetts?',
  'Uhhh... Massachusetts!',
  'I can\'t spell Massachusetts but I live there!',
  'I tried to microwave a traffic cone. Wicked hot.',
  'My GPS said turn left, so I turned the phone left.',
  'Is the ocean wet, or is it just from Massachusetts?',
  'I lost my keys in my hand again. Damn it.',
  'I thought a yield sign meant free vegetables.',
  'That e-bike has more horsepower than my car!',
  'If I close my eyes, the traffic disappears!',
  'I live in Massachusetts! Wait, what state is this?',
];
const MOM_LINES = [
  'I suck at being a parent. Ask my kids.',
  'I hate those damn kids. Where did they go?',
  'My kids are on e-bikes again. I suck at parenting!',
  'Everything my kids do annoys the hell out of me.',
  'I tried grounding my kid. They rode away on a bike.',
  'My kids said I am a terrible mom. They have a point.',
  'I live in Massachusetts! My kids probably do too.',
  'I hate the noise, I hate the mess, and I hate that e-bike.',
];
const DOG_LINES = ['Aww, a wicked cute dog! I live in Massachusetts!', 'Good boy! I live in Massachusetts!', 'Does the dog live in Massachusetts too?', 'Who\'s a good Massachusetts dog?'];
const SCOLD = ['HEY! STOP THAT!', 'Knock it off, guy!', 'I\'m calling PETA!', 'That\'s not very Massachusetts of you!', 'STOP! I live in Massachusetts!', 'What is WRONG with you?!'];
const RECORD = ['*recording* this is going on TikTok', '*recording* nobody\'s gonna believe this', '*recording* wicked crazy', '*recording* I live in Massachusetts and I\'m seeing THIS'];
const HURT = ['OW!', 'MY BACK!', 'WHAT THE HECK', 'I LIVE IN MASSACHUSETTS!', 'OUCH, GUY!', 'I\'M TELLING MY MA'];
const BLIND = ['I CAN\'T SEE!', 'IS THIS POOP?!', 'IT\'S IN MY EYES!', 'EWWW!'];

const SHIRTS = [0xd84a3a, 0x3a8ad8, 0x4ab85a, 0xe8b83a, 0x9a5ad8, 0xf0f0f0, 0x2a2a2a, 0xe87aa8, 0x1d3f7a];
const SKINS = [0xf0c29c, 0xd9a07a, 0xa87250, 0x7a5236, 0xf6d6b8];
const HAIR = [0x2a1a10, 0x6a3a1a, 0xd8b050, 0x111111, 0x8a8a8a, 0xb84a1a];

class Person {
  constructor(scene, mgr, kind = 'adult') {
    this.mgr = mgr;
    this.kind = kind;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.center = new THREE.Vector3(); this.q = new THREE.Quaternion(); this.ang = new THREE.Vector3();
    this.bubbleY = 2.2;
    this.build();
    scene.add(this.root);
    this.reset(true);
  }

  build() {
    const skin = std(pick(SKINS)), shirt = std(this.kind === 'mother' ? pick([0xa93f89, 0x3e9b9a, 0xe88452]) : pick(SHIRTS)), pants = std(pick([0x2b3445, 0x3a3a3a, 0x5a4a3a, 0x1d2a4a, 0x6a6a72]));
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.body.position.y = CH; this.root.add(this.body);
    this.legs = [];
    for (const s of [-1, 1]) {
      const p = new THREE.Group(); p.position.set(s * 0.13, -0.1, 0); this.body.add(p);
      box(0.18, 0.8, 0.19, pants, 0, -0.4, 0, p);
      box(0.19, 0.1, 0.3, std(0x222222), 0, -0.82, 0.05, p);
      this.legs.push(p);
    }
    this.upper = new THREE.Group(); this.upper.position.y = -0.05; this.body.add(this.upper);
    box(0.52, 0.64, 0.29, shirt, 0, 0.27, 0, this.upper);
    if (this.kind === 'mother') {
      this.body.scale.set(1.28, 1.04, 1.35);
      ellip(0.4, 0.36, 0.34, shirt, 0, 0.2, 0.09, this.upper, 14);
      ellip(0.16, 0.06, 0.16, std(0x3a2a24), 0, -0.18, 0.26, this.upper, 12);
    }
    this.head = new THREE.Group(); this.head.position.y = 0.8; this.upper.add(this.head);
    ellip(0.17, 0.19, 0.18, skin, 0, 0, 0, this.head);
    this.eyes = [];
    for (const s of [-1, 1]) this.eyes.push(ellip(0.03, 0.035, 0.02, std(0x1a1a1a), s * 0.065, 0.03, 0.16, this.head, 8));
    this.mouth = ellip(0.05, 0.03, 0.02, std(0x7a2a2a), 0, -0.08, 0.165, this.head, 8);
    if (Math.random() < 0.5) ellip(0.18, 0.1, 0.19, std(pick(HAIR)), 0, 0.1, -0.02, this.head);
    else { ellip(0.18, 0.08, 0.19, std(0x1d3f7a), 0, 0.1, -0.01, this.head); box(0.25, 0.025, 0.16, std(0xc0141c), 0, 0.1, 0.2, this.head); }
    this.poopFace = ellip(0.13, 0.1, 0.06, std(0x5a3a1c, { roughness: 0.3 }), 0, 0.02, 0.16, this.head, 10);
    this.poopFace.visible = false;
    this.arms = [];
    for (const s of [-1, 1]) {
      const p = new THREE.Group(); p.position.set(s * 0.34, 0.52, 0); this.upper.add(p);
      box(0.14, 0.62, 0.14, shirt, 0, -0.28, 0, p);
      ellip(0.07, 0.075, 0.07, skin, 0, -0.62, 0, p, 8);
      this.arms.push(p);
    }
    this.phone = box(0.08, 0.15, 0.02, std(0x111111, { emissive: 0x3a6aff, emissiveIntensity: 0.4 }), 0, -0.68, 0.06, this.arms[1]);
    this.phone.visible = false;
    this.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }

  reset(initial = false) {
    this.walkDir = Math.random() < 0.5 ? 1 : -1;
    this.lane = pick(SIDEWALKS) + rand(-0.5, 0.5);
    const x = initial ? rand(-45, 45) : -this.walkDir * rand(55, 70);
    this.pos.set(x, 0, this.lane); this.vel.set(0, 0, 0);
    this.center.copy(this.pos).setY(CH);
    this.yaw = this.walkDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.state = 'walk'; this.stateT = 0;
    this.speed = this.kind === 'mother' ? rand(0.8, 1.25) : rand(1.2, 1.9);
    this.hp = 100; this.blindT = 0; this.angryT = 0;
    this.sayCd = rand(2, 7); this.chatCd = rand(3, 8); this.dogCd = rand(5, 12);
    this.witnessCd = 0; this.focus = null; this.fatalFall = false;
    this.dogImpactCd = 0;
    this.civilianImpactCd = 0;
    this.flight = null; this.heldPunches = 0;
    this.grabbed = false; this.inside = 0; this.win = null;
    this.phone.visible = false; this.poopFace.visible = false;
    this.root.visible = true;
    this.t = rand(0, 10);
    this.body.quaternion.identity();
  }

  get air() { return this.state === 'air'; }
  get hittable() { return !this.grabbed && this.state !== 'inside' && this.state !== 'station' && this.state !== 'gone'; }
  get busy() { return this.state !== 'walk'; }

  say(text, life = 3) { this.mgr.hooks.bubble(this, text, life); }

  launch(v, kind = 'Hit') {
    if (this.state === 'gone') return;
    this.grabbed = false;
    if (this.state !== 'air') this.center.copy(this.pos).setY(Math.max(this.pos.y + CH, 0.6));
    if (!this.flight) this.flight = { from: this.center.clone(), seq: [], hits: 0, maxH: this.center.y, t: 0, slams: 0, punches: this.heldPunches };
    this.flight.seq.push(kind);
    this.flight.hits++;
    this.heldPunches = 0;
    this.state = 'air';
    this.vel.copy(v);
    this.ang.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(v.length() * 0.6 + 3);
    if (this.q.lengthSq() < 0.5) this.q.identity();
    eul.set(0, this.yaw, 0, 'YXZ'); if (kind !== 'keep') this.q.setFromEuler(eul);
    this.lastKind = kind;
  }

  damage(n, kind) {
    if (this.state === 'gone') return;
    this.hp -= n;
    this.lastKind = kind;
    if (this.state === 'held' && kind === 'Punch') this.heldPunches++;
  }

  hit(v, dmg, kind) {
    this.launch(v, kind);
    this.damage(dmg, kind);
    this.mgr.hooks.hit?.(this, kind);
    this.angryT = 12;
    this.phone.visible = false;
    if (Math.random() < 0.6) this.say(pick(HURT), 1.8);
  }

  blind(t, hard) {
    this.blindT = Math.max(this.blindT, t);
    this.poopFace.visible = true;
    this.phone.visible = false;
    this.say(pick(BLIND), 2.2);
    if (hard) this.hit(tmp.set(rand(-2, 2), 4, rand(-2, 2)), 12, 'Poop');
  }

  grab() { this.grabbed = true; this.headGrab = false; this.state = 'held'; this.flight = null; this.heldPunches = 0; this.phone.visible = false; this.say(pick(['PUT ME DOWN!', 'HEY! I live in Massachusetts!', 'WHAT ARE YOU DOING', 'AAAAA']), 2); }
  release(v) { this.grabbed = false; this.headGrab = false; this.launch(v, 'Drop'); }

  update(dt, ctx) {
    this.t += dt;
    this.dogImpactCd = Math.max(0, this.dogImpactCd - dt);
    this.civilianImpactCd = Math.max(0, this.civilianImpactCd - dt);
    this.sayCd -= dt; this.chatCd -= dt; this.dogCd -= dt; this.witnessCd -= dt;
    this.angryT = Math.max(0, this.angryT - dt);
    if (this.blindT > 0) { this.blindT -= dt; if (this.blindT <= 0) this.poopFace.visible = false; }
    switch (this.state) {
      case 'held': this.heldStep(ctx); break;
      case 'air': this.airStep(dt); break;
      case 'down': this.stateT -= dt; if (this.stateT <= 0) this.getUp(); this.lying(); break;
      case 'ko': this.stateT -= dt; this.lying(); if (this.stateT <= 0) { this.mgr.hooks.poof(this.pos); this.state = 'gone'; this.root.visible = false; this.stateT = rand(3, 6); } break;
      case 'gone': this.stateT -= dt; if (this.stateT <= 0) this.reset(); break;
      case 'inside': break;
      case 'station': break;
      default: this.groundStep(dt, ctx);
    }
    this.animate(dt);
  }

  heldStep(ctx) {
    ctx.player.holdWorld(this.center);
    this.center.y += this.headGrab ? 0.32 : 0.1;
    this.pos.copy(this.center).setY(this.center.y - CH);
    eul.set(0, ctx.player.yaw + Math.PI / 2, Math.PI / 2 + (this.headGrab ? 0.35 : -0.2), 'YXZ');
    this.q.setFromEuler(eul);
    this.vel.set(0, 0, 0);
  }

  airStep(dt) {
    if (this.flight) { this.flight.t += dt; this.flight.maxH = Math.max(this.flight.maxH, this.center.y); }
    this.vel.y -= G * dt;
    this.center.addScaledVector(this.vel, dt);
    const w = this.ang.length();
    if (w > 0.001) { dq.setFromAxisAngle(tmp.copy(this.ang).divideScalar(w), w * dt); this.q.premultiply(dq); }
    const hit = collideSphere(this.center, 0.4, this.vel, 0.35, 0.75);
    if (hit && hit.impact > 7) { this.damage(Math.min(20, hit.impact * 0.6), 'Collision'); if (this.flight) this.flight.slams++; this.mgr.hooks.slam(this, hit.impact); }
    if (this.center.y <= 0.28) {
      this.center.y = 0.28;
      if (this.vel.y < 0) {
        const imp = -this.vel.y;
        if (imp > 7) { this.damage(Math.min(25, imp * 0.8), 'Fall'); this.mgr.hooks.thud(this, imp); }
        if (this.fatalFall) { this.fatalFall = false; this.hp = 0; this.mgr.hooks.fatal(this); }
        this.vel.y = imp > 3 ? imp * 0.3 : 0;
        this.vel.x *= 0.7; this.vel.z *= 0.7; this.ang.multiplyScalar(0.6);
      }
      const k = Math.max(0, 1 - dt * 4);
      this.vel.x *= k; this.vel.z *= k; this.ang.multiplyScalar(k);
      if (this.vel.lengthSq() < 1) {
        this.pos.set(this.center.x, 0, this.center.z);
        const flight = this.flight; this.flight = null;
        if (flight) this.mgr.hooks.landed?.(this, flight);
        if (this.hp <= 0) { this.state = 'ko'; this.stateT = 6; this.mgr.hooks.ko(this); }
        else { this.state = 'down'; this.stateT = rand(1.5, 2.8); }
      }
    }
    this.pos.copy(this.center).setY(this.center.y - CH);
  }

  lying() {
    tmp.set(0, 0, 1).applyQuaternion(this.q);
    eul.set(-Math.PI / 2, this.yaw, 0, 'YXZ');
    this.q.slerp(dq.setFromEuler(eul), 0.1);
    this.center.set(this.pos.x, 0.28, this.pos.z);
  }

  getUp() {
    this.state = this.angryT > 0 ? 'mad' : 'walk';
    this.stateT = 4;
    this.pos.y = 0;
    this.center.copy(this.pos).setY(CH);
    if (this.state === 'mad') this.say(pick(SCOLD), 2.5);
    // if it got knocked far from the sidewalk, head back to the nearest one
    this.lane = Math.abs(this.pos.z - SIDEWALKS[0]) < Math.abs(this.pos.z - SIDEWALKS[1]) ? SIDEWALKS[0] : SIDEWALKS[1];
  }

  faceTo(p, dt) {
    const a = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    let d = a - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 6);
  }

  groundStep(dt, ctx) {
    const { playerPos, dog, player } = ctx;
    let mx = 0, mz = 0;
    const toP = Math.hypot(playerPos.x - this.pos.x, playerPos.z - this.pos.z);
    this.stateT -= dt;
    if (this.blindT > 0) {
      // stumble around blindly
      this.yaw += Math.sin(this.t * 3.1) * dt * 3;
      mx = Math.sin(this.yaw) * 1.3; mz = Math.cos(this.yaw) * 1.3;
    } else if (this.state === 'record') {
      this.phone.visible = true;
      if (this.focus) this.faceTo(this.focus, dt);
      if (this.stateT <= 0) { this.state = 'walk'; this.phone.visible = false; if (Math.random() < 0.5) this.say('Posted it. I live in Massachusetts!', 2.5); }
    } else if (this.state === 'scold' || this.state === 'mad') {
      const f = this.focus || playerPos;
      this.faceTo(f, dt);
      const d = Math.hypot(f.x - this.pos.x, f.z - this.pos.z);
      if (d > 2.4 && d < 25) { mx = (f.x - this.pos.x) / d * 2.6; mz = (f.z - this.pos.z) / d * 2.6; }
      // mad people shove you
      if (this.state === 'mad' && toP < 1.5 && player.canBeHit && !player.ragdoll && Math.random() < dt * 1.2) {
        player.hit(tmp.set(playerPos.x - this.pos.x, 0, playerPos.z - this.pos.z).normalize().multiplyScalar(6).setY(4), 4);
        this.say(pick(['TAKE THAT!', 'SHOVE!', 'That\'s for the dog!']), 1.8);
        this.mgr.hooks.sound('punch', 0.6);
        this.mgr.hooks.shove?.(this);
        this.stateT = Math.min(this.stateT, 1);
      }
      if (this.stateT <= 0) this.state = 'walk';
    } else if (this.state === 'chat') {
      this.faceTo(playerPos, dt);
      if (this.stateT <= 0 || toP > 5) this.state = 'walk';
    } else if (this.state === 'petdog') {
      const d = Math.hypot(dog.pos.x - this.pos.x, dog.pos.z - this.pos.z);
      this.faceTo(dog.pos, dt);
      if (d > 1.1 && !dog.air) { mx = (dog.pos.x - this.pos.x) / d * 2; mz = (dog.pos.z - this.pos.z) / d * 2; }
      else if (Math.random() < dt * 0.8) { this.mgr.hooks.petDog(this); }
      if (this.stateT <= 0 || dog.air || dog.grabbed || dog.angry || d > 9) this.state = 'walk';
    } else {
      // walking along the sidewalk, drifting back to it
      const dz = this.lane - this.pos.z;
      mx = this.walkDir * this.speed; mz = THREE.MathUtils.clamp(dz * 1.5, -2, 2);
      if (Math.abs(this.pos.x) > 75) this.reset();
      if (this.chatCd <= 0 && toP < 3.2 && !player.ragdoll) { this.chatCd = rand(8, 15); this.state = 'chat'; this.stateT = 3; this.say(pick(this.kind === 'mother' ? MOM_LINES : DUMB), 3); this.mgr.hooks.chat?.(this); }
      else if (this.dogCd <= 0) {
        this.dogCd = rand(8, 16);
        const dd = Math.hypot(dog.pos.x - this.pos.x, dog.pos.z - this.pos.z);
        if (dd < 7 && !dog.angry && !dog.air && !dog.grabbed && !dog.dead) { this.state = 'petdog'; this.stateT = 6; this.say(pick(DOG_LINES), 3); }
      }
      if (this.sayCd <= 0 && toP < 40) { this.sayCd = rand(5, 12); if (this.state === 'walk') this.say(this.kind === 'mother' ? pick(MOM_LINES) : Math.random() < 0.4 ? CATCH : pick(DUMB), 2.8); }
    }
    this.vel.x += (mx - this.vel.x) * Math.min(1, dt * 8);
    this.vel.z += (mz - this.vel.z) * Math.min(1, dt * 8);
    this.vel.y = 0;
    this.pos.addScaledVector(this.vel, dt);
    tmp.copy(this.pos); tmp.y = 0.6;
    if (collideSphere(tmp, 0.35, this.vel, 0, 1)) { this.pos.x = tmp.x; this.pos.z = tmp.z; }
    this.pos.y = 0;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > 0.4 && this.state !== 'record' && this.state !== 'chat') {
      const a = Math.atan2(this.vel.x, this.vel.z);
      let d = a - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * Math.min(1, dt * 8);
    }
    this.speedNow = hs;
    this.center.copy(this.pos).setY(CH);
    eul.set(0, this.yaw, 0, 'YXZ'); this.q.setFromEuler(eul);
  }

  witness(at, kind) {
    if (this.witnessCd > 0 || !['walk', 'chat', 'petdog', 'record'].includes(this.state) || this.blindT > 0) return;
    this.witnessCd = rand(6, 10);
    this.focus = at.clone();
    if (this.state === 'record' || Math.random() < 0.55) { this.state = 'record'; this.stateT = rand(6, 9); this.say(pick(RECORD), 3); }
    else { this.state = 'scold'; this.stateT = rand(3, 5); this.say(this.kind === 'mother' ? pick(['My kid better not be watching this!', 'I suck at parenting, but even I know to stop!', ...MOM_LINES]) : pick(SCOLD), 2.8); }
    this.mgr.hooks.witness?.(this, this.state, kind);
  }

  animate(dt) {
    const [la, ra] = this.arms, [ll, rl] = this.legs;
    const t = this.t;
    if (this.state === 'air' || this.state === 'held' || this.state === 'down' || this.state === 'ko') {
      this.root.position.set(this.center.x, this.center.y - CH, this.center.z);
      this.root.rotation.set(0, 0, 0);
      this.body.quaternion.copy(this.q);
      const flail = this.state === 'air' || this.state === 'held' ? 1 : 0.1;
      la.rotation.set(Math.sin(t * 13) * flail, 0, -1.3); ra.rotation.set(Math.cos(t * 12) * flail, 0, 1.3);
      ll.rotation.set(Math.sin(t * 14) * flail * 0.6, 0, -0.3); rl.rotation.set(Math.cos(t * 13) * flail * 0.6, 0, 0.3);
      this.mouth.scale.set(0.05, 0.05, 0.02);
      this.eyes.forEach((e) => (e.scale.y = this.state === 'ko' ? 0.005 : 0.035));
      return;
    }
    this.body.quaternion.identity();
    this.root.position.copy(this.pos);
    this.root.rotation.set(0, this.yaw, 0);
    const sp = this.speedNow || 0;
    this.phase = (this.phase || 0) + dt * sp * 2.6;
    const amp = Math.min(0.8, sp * 0.3), sw = Math.sin(this.phase);
    ll.rotation.set(sw * amp, 0, 0); rl.rotation.set(-sw * amp, 0, 0);
    la.rotation.set(-sw * amp * 0.8, 0, -0.08); ra.rotation.set(sw * amp * 0.8, 0, 0.08);
    this.head.rotation.set(0, 0, 0);
    if (this.state === 'record') { ra.rotation.set(-1.7, 0, -0.25); la.rotation.set(-1.5, 0, 0.3); }
    if (this.state === 'scold' || this.state === 'mad') { ra.rotation.set(-2.6 + Math.sin(t * 12) * 0.3, 0, 0.2); this.head.rotation.z = Math.sin(t * 9) * 0.1; }
    if (this.state === 'chat') { this.head.rotation.z = Math.sin(t * 3) * 0.2; ra.rotation.set(-0.9 + Math.sin(t * 6) * 0.3, 0, 0); }
    if (this.state === 'petdog') { ra.rotation.set(-0.8 + Math.sin(t * 8) * 0.2, 0, 0); this.upper.rotation.x = 0.35; } else this.upper.rotation.x = 0;
    if (this.blindT > 0) { la.rotation.set(-2.4, 0, 0.3); ra.rotation.set(-2.4, 0, -0.3); this.head.rotation.x = Math.sin(t * 8) * 0.2; }
    this.mouth.scale.set(0.05, this.bubbleT > 0 ? 0.03 + Math.abs(Math.sin(t * 14)) * 0.03 : 0.015, 0.02);
    this.eyes.forEach((e) => (e.scale.y = 0.035));
  }
}

export class People {
  constructor(scene, hooks, n = 8) {
    this.hooks = hooks;
    this.list = Array.from({ length: n }, (_, i) => new Person(scene, this, i < 3 ? 'mother' : 'adult'));
  }
  update(dt, ctx) { for (const p of this.list) p.update(dt, ctx); }
  witness(at, kind) {
    for (const p of this.list) if (p.state !== 'gone' && p.pos.distanceTo(at) < 24) p.witness(at, kind);
  }
  // nearest hittable person in front of `from` along `fwd`
  nearest(from, fwd, range) {
    let best = null, bd = range;
    for (const p of this.list) {
      if (!p.hittable) continue;
      tmp.subVectors(p.center, from);
      if (Math.abs(tmp.y) > 2) continue;
      tmp.y = 0;
      const d = tmp.length();
      if (d > bd) continue;
      if (d > 0.9 && tmp.normalize().dot(fwd) < 0.15) continue;
      bd = d; best = p;
    }
    return best;
  }
}
