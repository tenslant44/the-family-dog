import * as THREE from 'three';
import { std, box, cyl, ellip } from './models.js';
import { G, collideSphere } from './physics.js';

const rand = (a, b) => a + Math.random() * (b - a);
const LINES = [
  'Move it, dumbass! E-bike coming through!',
  'Holy shit, that dog has better brakes than me!',
  'You absolute walnut! Watch the road!',
  'My mom says I am a pain in the ass. Whatever!',
  'Screw this hill! The battery is doing all the work!',
  'Hey, bozo! I live in Massachusetts!',
  'What the hell is that dog doing?',
  'Eat my dust, you dingus!',
  'My mom hates me and I hate this stupid helmet!',
  'Outta the way, jackass!',
];
const pick = () => LINES[(Math.random() * LINES.length) | 0];
const tube = (parent, material, a, b, radius = 0.035) => {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const part = cyl(radius, radius, start.distanceTo(end), material,
    (start.x + end.x) / 2, (start.y + end.y) / 2, (start.z + end.z) / 2, parent, 8);
  part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
  return part;
};

class Rider {
  constructor(scene, index) {
    this.index = index;
    this.pos = new THREE.Vector3();
    this.bubbleY = 2.2;
    this.dir = index % 2 ? -1 : 1;
    this.lane = this.dir > 0 ? 15.2 : 28.8;
    this.pos.set(index ? 24 : -29, 0, this.lane);
    this.speed = rand(5.5, 7);
    this.sayT = rand(1, 4);
    this.bumpCd = 0;
    this.root = new THREE.Group(); scene.add(this.root);
    const paint = std(index ? 0x44debd : 0xffb640, { metalness: 0.35, roughness: 0.4 });
    const metal = std(0x40434b, { metalness: 0.7 });
    const tire = std(0x1c1e24);
    const skin = std(index ? 0xa87250 : 0xf0c29c);
    this.wheels = [];
    for (const x of [-0.65, 0.65]) {
      const w = cyl(0.35, 0.35, 0.09, tire, x, 0.35, 0, this.root, 16);
      w.rotation.x = Math.PI / 2;
      cyl(0.27, 0.27, 0.098, std(0x777777, { metalness: 0.8 }), 0, 0, 0, w, 16);
      this.wheels.push(w);
    }
    tube(this.root, paint, [-0.65, 0.35, 0], [-0.1, 0.9, 0]);
    tube(this.root, paint, [0.65, 0.35, 0], [-0.1, 0.9, 0]);
    tube(this.root, paint, [-0.65, 0.35, 0], [0.65, 0.35, 0]);
    tube(this.root, metal, [0.65, 0.35, 0], [0.78, 1.03, 0]);
    tube(this.root, metal, [0.65, 1.03, -0.32], [0.65, 1.03, 0.32]);
    box(0.38, 0.2, 0.2, metal, -0.15, 0.7, 0, this.root); // battery
    box(0.28, 0.06, 0.2, std(0x222222), -0.25, 1.04, 0, this.root);
    const kid = new THREE.Group(); scene.add(kid); this.kid = kid;
    ellip(0.22, 0.28, 0.18, std(index ? 0x8b5dd4 : 0x32a1e0), 0, 0.26, 0, kid, 12);
    ellip(0.17, 0.17, 0.16, skin, 0, 0.7, 0, kid, 12);
    ellip(0.18, 0.09, 0.17, std(index ? 0xff624f : 0xffe15a), 0, 0.82, 0, kid, 12); // helmet
    for (const z of [-0.12, 0.12]) {
      tube(kid, skin, [0.12, 0.38, z], [0.82, -0.04, z], 0.055);
      tube(kid, std(0x303741), [-0.1, 0.04, z], [-0.36, -0.35, z], 0.075);
    }
    this.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.kid.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.mode = 'npc';
    this.fallT = 0;
    this.returnT = 0;
    this.riderState = 'mounted';
    this.riderVel = new THREE.Vector3();
    this.impactCd = 0;
  }

  get center() { return this.kid.position.clone().add(new THREE.Vector3(0, 0.42, 0)); }

  dismount(bubble, cause = 'player') {
    if (this.mode !== 'npc') return false;
    this.mode = 'parked';
    this.speed = rand(5.5, 7);
    this.fallT = 3;
    this.returnT = 20;
    this.riderState = 'fallen';
    this.kid.position.copy(this.pos).add(new THREE.Vector3(0.6, 0.1, 0.65));
    this.kid.rotation.set(0, 0, -Math.PI / 2);
    bubble(this, cause === 'dog' ? 'Whoa! What the hell, dog?!' : 'Hey! That\'s my bike, jackass!', 2.7);
    return true;
  }

  grab() {
    if (this.mode !== 'parked' || this.riderState !== 'fallen') return false;
    this.riderState = 'held';
    this.kid.visible = true;
    this.riderVel.set(0, 0, 0);
    this.returnT = Math.max(this.returnT, 20);
    return true;
  }

  launch(velocity) {
    if (this.riderState !== 'held' && this.riderState !== 'fallen' && this.riderState !== 'air') return false;
    this.riderState = 'air';
    this.kid.visible = true;
    this.riderVel.copy(velocity);
    this.impactCd = 0.05;
    this.returnT = Math.max(this.returnT, 20);
    return true;
  }

  riderStep(dt, player) {
    this.impactCd = Math.max(0, this.impactCd - dt);
    if (this.riderState === 'held') {
      const at = player.holdWorld(new THREE.Vector3());
      this.kid.position.copy(at).add(new THREE.Vector3(0, this.headGrab ? -0.19 : -0.42, 0));
      this.kid.rotation.set(0, player.yaw, this.headGrab ? -Math.PI * 0.7 : -Math.PI / 2);
    } else if (this.riderState === 'air') {
      this.riderVel.y -= G * dt;
      this.kid.position.addScaledVector(this.riderVel, dt);
      const center = this.center;
      collideSphere(center, 0.3, this.riderVel, 0.3, 0.75);
      this.kid.position.copy(center).y -= 0.42;
      this.kid.rotation.z += dt * 7;
      if (this.kid.position.y <= 0.12) {
        this.kid.position.y = 0.12;
        this.riderVel.y = this.riderVel.y < -3 ? -this.riderVel.y * 0.25 : 0;
        this.riderVel.x *= 0.68; this.riderVel.z *= 0.68;
        if (this.riderVel.lengthSq() < 1.5) {
          this.riderState = 'fallen';
          this.fallT = 3;
          this.kid.rotation.set(0, 0, -Math.PI / 2);
        }
      }
    }
  }

  update(dt, player, dog, bubble, onDistance) {
    this.bumpCd = Math.max(0, this.bumpCd - dt);
    this.sayT -= dt;
    if (this.mode === 'npc') {
      this.pos.x += this.dir * this.speed * dt;
      if (Math.abs(this.pos.x) > 72) this.pos.x = -this.dir * 72;
      this.root.rotation.y = this.dir > 0 ? 0 : Math.PI;
    } else if (this.mode === 'player') {
      const distance = Math.hypot(this.pos.x - player.pos.x, this.pos.z - player.pos.z);
      if (distance < 3) onDistance(distance, player.pos);
      this.pos.copy(player.pos);
      this.root.rotation.y = player.yaw - Math.PI / 2;
    } else {
      if (this.riderState !== 'held' && this.riderState !== 'air') this.returnT -= dt;
      if (this.returnT <= 0) {
        this.mode = 'npc';
        this.riderState = 'mounted';
        this.pos.set(-this.dir * 65, 0, this.lane);
      }
    }
    this.root.position.copy(this.pos);
    if (this.mode === 'npc') {
      this.kid.visible = true;
      this.kid.position.copy(this.root.localToWorld(new THREE.Vector3(-0.3, 1.1, 0)));
      this.kid.rotation.set(0, this.root.rotation.y, Math.sin(performance.now() * 0.007) * 0.025);
    } else if (this.riderState === 'fallen' && this.fallT > 0) {
      this.fallT -= dt;
      this.kid.visible = true;
      if (this.fallT <= 0) this.kid.visible = false;
    }
    for (const w of this.wheels) if (this.mode !== 'parked') w.rotation.y += dt * (this.mode === 'npc' ? this.dir * this.speed : player.speed) / 0.35;
    if (this.mode === 'npc' && this.sayT <= 0) {
      this.sayT = rand(3, 6);
      if (Math.abs(this.pos.x - player.pos.x) < 25 || Math.abs(this.pos.x - dog.x) < 14) bubble(this, pick(), 2.8);
    }
  }

  dogBump(dog, bubble) {
    if (this.mode !== 'npc' || this.bumpCd > 0) return false;
    if (dog.pos.distanceTo(this.pos.clone().setY(0.9)) > 1.15) return false;
    this.bumpCd = 2;
    this.dismount(bubble, 'dog');
    return true;
  }
}

export class EBikes {
  constructor(scene, hooks) {
    this.hooks = hooks;
    this.riders = [new Rider(scene, 0), new Rider(scene, 1)];
    this.riding = null;
    this.rideDistance = 0;
  }
  update(dt, player, dog) {
    for (const r of this.riders) r.update(dt, player, dog, this.hooks.bubble, (distance, pos) => {
      this.rideDistance += distance;
      this.hooks.distance(this.rideDistance, pos);
    });
  }
  updateRiders(dt, player) {
    for (const r of this.riders) r.riderStep(dt, player);
  }
  nearbyRider(pos, distance = 2.4) {
    return this.riders.find(r => r.mode === 'parked' && r.riderState === 'fallen' && r.kid.visible
      && Math.hypot(r.kid.position.x - pos.x, r.kid.position.z - pos.z) < distance) || null;
  }
  grabRider(pos, distance = 2.4) {
    const r = this.nearbyRider(pos, distance);
    return r && r.grab() ? r : null;
  }
  hitRider(r, impulse, cause = 'person') {
    if (r.mode === 'npc') {
      if (!r.dismount(this.hooks.bubble, cause)) return false;
      this.hooks.dismount(r, cause);
    }
    if (r.mode !== 'parked' || r.riderState === 'held' || r.riderState === 'hidden') return false;
    if (!r.launch(impulse)) return false;
    r.impactCd = 0.25;
    this.hooks.riderHit?.(r, cause);
    return true;
  }
  dogBump(dog) {
    const r = this.riders.find(r => r.dogBump(dog, this.hooks.bubble));
    if (!r) return false;
    this.hooks.dismount(r, 'dog');
    return true;
  }
  knock(r) {
    if (!r || !r.dismount(this.hooks.bubble)) return false;
    this.hooks.dismount(r, 'player');
    return true;
  }
  nearest(pos, distance = 2) {
    return this.riders.find(r => r.mode !== 'player' && Math.hypot(r.pos.x - pos.x, r.pos.z - pos.z) < distance) || null;
  }
  yank(pos, dir, distance = 2) {
    const r = this.riders.find(r => {
      if (r.mode !== 'npc') return false;
      const delta = r.pos.clone().sub(pos).setY(0);
      return delta.length() < distance && (delta.length() < 1 || delta.normalize().dot(dir) > 0);
    });
    if (!r) return false;
    return this.knock(r);
  }
  mount(pos) {
    if (this.riding) return false;
    const r = this.riders.find(r => r.mode === 'parked' && r.riderState !== 'held' && r.riderState !== 'air' && Math.hypot(r.pos.x - pos.x, r.pos.z - pos.z) < 2);
    if (!r) return false;
    r.mode = 'player';
    this.riding = r;
    this.rideDistance = 0;
    this.hooks.mount(r);
    return true;
  }
  park() {
    if (!this.riding) return;
    this.riding.mode = 'parked';
    this.riding.returnT = 20;
    this.riding = null;
  }
}
