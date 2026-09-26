import * as THREE from 'three';
import { G, addBox, removeCollider, collideSphere } from './physics.js';
import { snowMat, makeSnowball } from './models.js';

const rand = (a, b) => a + Math.random() * (b - a);
const CELL = 0.9, BH = 0.5, MAX_STACK = 4, MAX_BLOCKS = 90;
const blockGeo = new THREE.BoxGeometry(CELL * 0.98, BH * 0.98, CELL * 0.98);

// Snowballs + stackable snow wall blocks (winter only)
export class Snow {
  constructor(scene, hooks) {
    this.scene = scene; this.hooks = hooks;
    this.balls = [];
    this.blocks = []; // { mesh, col, gx, gz, level, grow }
  }

  throwBall(from, vel) {
    const m = makeSnowball(0.1);
    m.position.copy(from);
    m.castShadow = true;
    this.scene.add(m);
    this.balls.push({ m, v: vel.clone(), life: 4 });
  }

  stackAt(gx, gz) { return this.blocks.filter((b) => b.gx === gx && b.gz === gz); }

  // place a block on the grid cell in front of the player; returns true if placed
  place(p, bodies) {
    const gx = Math.round(p.x / CELL), gz = Math.round(p.z / CELL);
    const x = gx * CELL, z = gz * CELL;
    if (z > 16.4 && z < 27.6) return 'road';
    const stack = this.stackAt(gx, gz);
    if (stack.length >= MAX_STACK) return 'tall';
    const level = stack.length;
    const y0 = level * BH;
    for (const b of bodies) {
      if (Math.abs(b.pos.x - x) < CELL / 2 + b.r && Math.abs(b.pos.z - z) < CELL / 2 + b.r && b.pos.y - b.r < y0 + BH && b.pos.y + b.h > y0) return 'blocked';
    }
    const m = new THREE.Mesh(blockGeo, snowMat);
    m.castShadow = m.receiveShadow = true;
    m.position.set(x + rand(-0.03, 0.03), y0 + BH / 2, z + rand(-0.03, 0.03));
    m.rotation.y = rand(-0.05, 0.05);
    m.scale.setScalar(0.01);
    this.scene.add(m);
    const col = addBox(x - CELL / 2, y0, z - CELL / 2, x + CELL / 2, y0 + BH, z + CELL / 2, 'snow');
    this.blocks.push({ mesh: m, col, gx, gz, level, grow: 0 });
    if (this.blocks.length > MAX_BLOCKS) { const o = this.blocks[0]; this.smash(o, false); }
    this.hooks.placed(m.position);
    return 'ok';
  }

  // remove a block and everything stacked above it
  smash(block, fx = true) {
    const doomed = this.blocks.filter((b) => b.gx === block.gx && b.gz === block.gz && b.level >= block.level);
    for (const b of doomed) {
      this.scene.remove(b.mesh); removeCollider(b.col);
      this.blocks.splice(this.blocks.indexOf(b), 1);
      if (fx) this.hooks.smashed(b.mesh.position);
    }
  }

  smashCollider(col) { const b = this.blocks.find((k) => k.col === col); if (b) this.smash(b); }

  clear() {
    for (const b of this.blocks) { this.scene.remove(b.mesh); removeCollider(b.col); }
    this.blocks = [];
    for (const s of this.balls) this.scene.remove(s.m);
    this.balls = [];
  }

  update(dt, dog, people = []) {
    for (const b of this.blocks) if (b.grow < 1) { b.grow = Math.min(1, b.grow + dt * 7); b.mesh.scale.setScalar(0.4 + b.grow * 0.6); }
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const s = this.balls[i];
      s.life -= dt;
      s.v.y -= G * dt;
      s.m.position.addScaledVector(s.v, dt);
      s.m.rotation.x += dt * 8;
      let dead = s.life <= 0;
      if (!dead && s.m.position.distanceTo(dog.pos) < 0.6) { this.hooks.hitDog(s.v.clone(), s.m.position.clone()); dead = true; }
      if (!dead) for (const p of people) {
        if (p.hittable && s.m.position.distanceTo(p.center) < 0.52) {
          this.hooks.hitPerson(p, s.v.clone(), s.m.position.clone()); dead = true; break;
        }
      }
      if (!dead && (s.m.position.y < 0.1 || collideSphere(s.m.position, 0.1, s.v, 0, 1))) { this.hooks.splat(s.m.position.clone()); dead = true; }
      if (dead) { this.scene.remove(s.m); this.balls.splice(i, 1); }
    }
  }
}
