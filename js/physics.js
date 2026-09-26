import * as THREE from 'three';

export const G = 22;
export const colliders = [];

export function addBox(minx, miny, minz, maxx, maxy, maxz, tag = 'solid') {
  const c = { min: new THREE.Vector3(minx, miny, minz), max: new THREE.Vector3(maxx, maxy, maxz), tag };
  colliders.push(c);
  return c;
}

export function removeCollider(c) {
  const i = colliders.indexOf(c);
  if (i >= 0) colliders.splice(i, 1);
}

const n = new THREE.Vector3();
const nt = new THREE.Vector3();

// Push a sphere out of every box and bounce its velocity.
// Returns the strongest impact of this step (or null).
export function collideSphere(pos, r, vel, e = 0.4, fr = 0.85) {
  let best = null;
  for (const c of colliders) {
    if (pos.x + r < c.min.x || pos.x - r > c.max.x || pos.y + r < c.min.y || pos.y - r > c.max.y || pos.z + r < c.min.z || pos.z - r > c.max.z) continue;
    const cx = Math.max(c.min.x, Math.min(pos.x, c.max.x));
    const cy = Math.max(c.min.y, Math.min(pos.y, c.max.y));
    const cz = Math.max(c.min.z, Math.min(pos.z, c.max.z));
    const dx = pos.x - cx, dy = pos.y - cy, dz = pos.z - cz;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > r * r) continue;
    let pen;
    if (d2 < 1e-8) {
      const o = [
        [pos.x - c.min.x, -1, 0, 0], [c.max.x - pos.x, 1, 0, 0],
        [pos.y - c.min.y, 0, -1, 0], [c.max.y - pos.y, 0, 1, 0],
        [pos.z - c.min.z, 0, 0, -1], [c.max.z - pos.z, 0, 0, 1],
      ].sort((a, b) => a[0] - b[0])[0];
      n.set(o[1], o[2], o[3]);
      pen = o[0] + r;
    } else {
      const d = Math.sqrt(d2);
      n.set(dx / d, dy / d, dz / d);
      pen = r - d;
    }
    pos.addScaledVector(n, pen);
    const vn = vel.dot(n);
    if (vn < 0) {
      nt.copy(n).multiplyScalar(vn);
      vel.sub(nt).multiplyScalar(fr).addScaledVector(n, -vn * e);
      if (!best || -vn > best.impact) best = { impact: -vn, normal: n.clone(), collider: c };
    } else if (!best) {
      best = { impact: 0, normal: n.clone(), collider: c };
    }
  }
  return best;
}
