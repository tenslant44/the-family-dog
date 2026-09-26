import * as THREE from 'three';
import { std, box, cyl, ellip } from './models.js';

// Two straight lanes: eastbound z=19.6, westbound z=24.4. Cars U-turn off-screen at |x| = 170.
// The drivers are idiots: they swerve at random, speed up when they spot something in the road,
// and aim for it. Soft poop in the road makes them spin out.
const LX = 170, LANE_A = 19.6, LANE_B = 24.4;
const BASE = 13, FAST = 27;
const HALF_L = 2.1, HALF_W = 0.95, H = 1.55;
const ZMIN = 14.6, ZMAX = 29.4;
const COLORS = [0xd8352a, 0x2f6fbd, 0xf2c14e, 0x3fa05a, 0xeeeeee, 0x7a4ab0];
const rand = (a, b) => a + Math.random() * (b - a);
const TEXAS = ["I love Choosin' Texas!", "I LOVE CHOOSIN' TEXAS!", "I love Choosin' Texas!!!"];
const IDIOT = ['WOOOO!', 'OOPS', 'MY LANE NOW', 'is that a dog?', 'HOLD MY COFFEE'];

function buildCar(color) {
  const g = new THREE.Group();
  const paint = std(color, { roughness: 0.3, metalness: 0.35 });
  const glass = std(0x223040, { roughness: 0.1, metalness: 0.6 });
  const body = new THREE.Group(); g.add(body);
  box(1.8, 0.6, 4.1, paint, 0, 0.62, 0, body);
  box(1.6, 0.55, 2.1, paint, 0, 1.18, -0.25, body);
  box(1.62, 0.42, 1.9, glass, 0, 1.2, -0.25, body, false);
  box(1.82, 0.12, 0.2, std(0x333333), 0, 0.42, 2.05, body);
  box(1.82, 0.12, 0.2, std(0x333333), 0, 0.42, -2.05, body);
  for (const s of [-1, 1]) {
    ellip(0.16, 0.1, 0.05, std(0xfff6d0, { emissive: 0xfff0b0, emissiveIntensity: 0.8 }), s * 0.62, 0.7, 2.06, body, 10);
    ellip(0.14, 0.08, 0.04, std(0xd02020, { emissive: 0xff2020, emissiveIntensity: 0.5 }), s * 0.66, 0.72, -2.06, body, 10);
  }
  // the driver
  ellip(0.14, 0.16, 0.14, std(0xf0c29c), 0.4, 1.28, 0.1, body, 10);
  const wheels = [];
  const tire = std(0x1a1a1a, { roughness: 0.9 });
  for (const [x, z] of [[-0.88, 1.3], [0.88, 1.3], [-0.88, -1.3], [0.88, -1.3]]) {
    const w = cyl(0.36, 0.36, 0.26, tire, x, 0.36, z, g, 14);
    w.rotation.z = Math.PI / 2;
    cyl(0.2, 0.2, 0.27, std(0xbbbbbb, { metalness: 0.8 }), 0, 0, 0, w, 10);
    wheels.push(w);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { g, body, wheels };
}

export class Traffic {
  constructor(scene, hooks) {
    this.hooks = hooks;
    this.cars = [];
    this.enabled = true;
    const n = 5;
    for (let i = 0; i < n; i++) {
      const c = buildCar(COLORS[i % COLORS.length]);
      scene.add(c.g);
      const dir = i % 2 ? -1 : 1;
      this.cars.push({
        ...c, dir, x: -LX + (i / n) * LX * 2, z: dir > 0 ? LANE_A : LANE_B, yaw: 0, speed: BASE, latV: 0,
        swerve: 0, swerveT: rand(1, 3), sees: null, seeCd: 0, spin: 0, spinRate: 0, vel: new THREE.Vector3(),
        pos: new THREE.Vector3(), bubbleY: 2.4, bump: 0, honkCd: 0, relX: null, texan: Math.random() < 0.6, sayCd: rand(4, 18), idiotCd: rand(6, 20),
      });
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    for (const c of this.cars) c.g.visible = enabled;
  }

  spinout(c, strength = 1) {
    if (c.spin > 0) { c.spin = Math.max(c.spin, 2); return; }
    c.spin = rand(2.6, 3.6) * strength;
    c.spinRate = rand(7, 11) * (Math.random() < 0.5 ? -1 : 1);
    c.vel.set(Math.sin(c.yaw), 0, Math.cos(c.yaw)).multiplyScalar(Math.max(c.speed, 12));
    this.hooks.spinout && this.hooks.spinout(c);
  }

  // targets: [{ pos, kind }]
  update(dt, { player, playerPos, dog, john, people, targets, slipAt }) {
    if (!this.enabled) {
      dog.carCd = (dog.carCd || 0) - dt;
      if (people) for (const p of people) p.carCd = (p.carCd || 0) - dt;
      return;
    }
    for (const c of this.cars) {
      c.bump = Math.max(0, c.bump - dt * 3);
      c.honkCd -= dt; c.sayCd -= dt; c.idiotCd -= dt; c.seeCd -= dt;
      const laneZ = c.dir > 0 ? LANE_A : LANE_B;
      if (c.spin > 0) {
        // spun out: slide, spin, go nuts
        c.spin -= dt;
        c.yaw += c.spinRate * dt;
        c.vel.applyAxisAngle(THREE.Object3D.DEFAULT_UP, Math.sin(c.spin * 5) * dt * 1.8);
        c.vel.multiplyScalar(1 - dt * 0.35);
        c.x += c.vel.x * dt; c.z += c.vel.z * dt;
        if (c.z < ZMIN) { c.z = ZMIN; c.vel.z = Math.abs(c.vel.z) * 0.8; c.bump = 1; }
        if (c.z > ZMAX) { c.z = ZMAX; c.vel.z = -Math.abs(c.vel.z) * 0.8; c.bump = 1; }
        c.speed = c.vel.length();
        if (c.spin <= 0) {
          // pick whichever direction it happens to be facing
          c.dir = Math.sin(c.yaw) >= 0 ? 1 : -1;
          c.speed = Math.max(4, Math.abs(c.vel.x));
          c.swerve = 0;
        }
      } else {
        // idiot driving
        c.swerveT -= dt;
        if (c.swerveT <= 0) {
          c.swerveT = rand(0.8, 3.2);
          c.swerve = Math.random() < 0.55 ? rand(-4.2, 4.2) : 0;
        }
        // look for something to aim at
        let best = null, bd = 48;
        for (const t of targets) {
          if (t.pos.z < ZMIN - 1.5 || t.pos.z > ZMAX + 1.5 || t.pos.y > 4) continue;
          const ahead = (t.pos.x - c.x) * c.dir;
          if (ahead > 2 && ahead < bd) { bd = ahead; best = t; }
        }
        if (best && !c.sees && c.seeCd <= 0) {
          c.seeCd = 4;
          this.hooks.spotted && this.hooks.spotted(c, best);
        }
        c.sees = best;
        const wantSpeed = best ? FAST + (c.texan ? 3 : 0) : BASE + Math.sin(c.x * 0.05) * 2;
        c.speed += (wantSpeed - c.speed) * Math.min(1, dt * (best ? 1.4 : 0.6));
        const wantZ = THREE.MathUtils.clamp(best ? best.pos.z : laneZ + c.swerve, ZMIN, ZMAX);
        const dz = wantZ - c.z;
        const latMax = best ? 7 : 4.5;
        c.latV += (THREE.MathUtils.clamp(dz * 3, -latMax, latMax) - c.latV) * Math.min(1, dt * 5);
        c.x += c.dir * c.speed * dt;
        c.z = THREE.MathUtils.clamp(c.z + c.latV * dt, ZMIN, ZMAX);
        const heading = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        const yawWant = heading - c.dir * Math.atan2(c.latV, Math.max(4, c.speed));
        let dy = yawWant - c.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        c.yaw += dy * Math.min(1, dt * 8);
        c.vel.set(c.dir * c.speed, 0, c.latV);
        // U-turn off-screen
        if (c.dir > 0 && c.x > LX) { c.dir = -1; c.z = LANE_B; c.x = LX; c.yaw = -Math.PI / 2; c.speed = BASE; }
        else if (c.dir < 0 && c.x < -LX) { c.dir = 1; c.z = LANE_A; c.x = -LX; c.yaw = Math.PI / 2; c.speed = BASE; }
        // soft poop on the road
        if (slipAt && slipAt(c.x, c.z)) this.spinout(c);
        // chatter
        if (c.texan && c.sayCd <= 0) { c.sayCd = rand(9, 22); if (Math.abs(c.x) < 60) this.hooks.say(c, TEXAS[(Math.random() * TEXAS.length) | 0]); }
        if (c.idiotCd <= 0) { c.idiotCd = rand(14, 30); if (Math.abs(c.x) < 45 && Math.abs(c.swerve) > 2) this.hooks.say(c, IDIOT[(Math.random() * IDIOT.length) | 0]); }
      }
      c.pos.set(c.x, 0, c.z);
      c.g.position.set(c.x, 0, c.z);
      c.g.rotation.y = c.yaw;
      c.body.position.y = Math.sin(c.bump * 12) * c.bump * 0.12;
      c.body.scale.set(1 + c.bump * 0.08, 1 - c.bump * 0.12, 1);
      c.body.rotation.z = c.spin > 0 ? Math.sin(c.spin * 9) * 0.06 : -c.latV * 0.012;
      for (const w of c.wheels) w.rotation.x += c.speed * dt / 0.36;

      // contact tests in the car's frame
      const fwx = Math.sin(c.yaw), fwz = Math.cos(c.yaw);
      const local = (p) => { const rx = p.x - c.x, rz = p.z - c.z; return { a: rx * fwx + rz * fwz, s: rx * fwz - rz * fwx }; };
      const inBox = (p, r, top) => { const l = local(p); return Math.abs(l.a) < HALF_L + r && Math.abs(l.s) < HALF_W + r && p.y < H + top; };
      const spd = Math.max(8, c.speed);
      const hitVel = (p, up, sidePush) => {
        const v = c.vel.lengthSq() > 1 ? c.vel.clone().setLength(spd * 1.05) : new THREE.Vector3(c.dir * spd, 0, 0);
        v.y = up + spd * 0.15;
        v.z += Math.sign(p.z - c.z || 1) * sidePush;
        return v;
      };

      // player
      const pp = playerPos;
      if (inBox(pp, 0.35, 0.2) && player.canBeHit) {
        c.bump = 1; c.relX = null;
        this.hooks.hitPlayer(hitVel(pp, 8, 3), c);
      } else {
        const rel = (pp.x - c.x) * c.dir;
        if (rel > 3 && rel < 26 && Math.abs(pp.z - c.z) < 1.8 && c.honkCd <= 0) { c.honkCd = 3; this.hooks.honk(c); }
        if (c.relX !== null && Math.sign(c.relX) !== Math.sign(rel) && Math.abs(pp.z - c.z) < 2.4 && !player.ragdoll) this.hooks.nearMiss(c);
        c.relX = Math.abs(pp.z - c.z) < 6 ? rel : null;
      }
      // dog
      if (!dog.grabbed && !dog.locked && !dog.inside && (dog.carCd || 0) <= 0 && inBox(dog.pos, 0.4, 0.4)) {
        dog.carCd = 1; c.bump = 1;
        this.hooks.hitDog(hitVel(dog.pos, 9, 3.5), c);
      }
      if (john && john.alive && john.canBeHit && inBox(john.pos, 0.4, 0)) { c.bump = 1; this.hooks.hitJohn(hitVel(john.pos, 7, 2), c); }
      if (people) for (const p of people) {
        if (!p.hittable || (p.carCd || 0) > 0) continue;
        if (inBox(p.center, 0.35, 0.2)) { p.carCd = 1; c.bump = 1; this.hooks.hitPerson(p, hitVel(p.center, 8, 3), c); }
      }
    }
    dog.carCd = (dog.carCd || 0) - dt;
    if (people) for (const p of people) p.carCd = (p.carCd || 0) - dt;
  }
}
