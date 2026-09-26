import * as THREE from 'three';

export const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });

export function mesh(geo, mat, x = 0, y = 0, z = 0, parent = null, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
export const box = (w, h, d, mat, x, y, z, parent, cast = true) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent, cast);
export function ellip(sx, sy, sz, mat, x, y, z, parent, seg = 16) {
  const m = mesh(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75)), mat, x, y, z, parent);
  m.scale.set(sx, sy, sz);
  return m;
}
export function cyl(rt, rb, h, mat, x, y, z, parent, seg = 12) {
  return mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, parent);
}

export function canvasTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function labelTex(text, { w = 512, h = 96, bg = '#f4e6c8', fg = '#5a3212', font = 'bold 56px Trebuchet MS', border = '#7a4a1e' } = {}) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = border; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 3);
  });
}

const boneMat = std(0xf3ead6, { roughness: 0.6 });
export function makeBone(s = 1) {
  const g = new THREE.Group();
  const shaft = cyl(0.035, 0.035, 0.28, boneMat, 0, 0, 0, g);
  shaft.rotation.z = Math.PI / 2;
  for (const x of [-0.15, 0.15]) for (const z of [-0.035, 0.035]) ellip(0.05, 0.05, 0.05, boneMat, x, 0, z, g, 10);
  g.scale.setScalar(s);
  return g;
}

export function makeBat() {
  const g = new THREE.Group();
  const wood = std(0xc99a5b, { roughness: 0.5 });
  cyl(0.055, 0.022, 0.8, wood, 0, 0.4, 0, g);
  cyl(0.024, 0.024, 0.18, std(0x222222), 0, -0.05, 0, g);
  cyl(0.035, 0.035, 0.02, std(0x222222), 0, -0.15, 0, g);
  ellip(0.055, 0.02, 0.055, wood, 0, 0.8, 0, g);
  return g;
}
export function makeKnife() {
  const g = new THREE.Group();
  const steel = std(0xc6d3df, { metalness: 0.85, roughness: 0.23 });
  box(0.09, 0.36, 0.025, std(0x35363c), 0, -0.18, 0, g);
  box(0.18, 0.04, 0.055, std(0xe5bc52), 0, 0.02, 0, g);
  const blade = mesh(new THREE.ConeGeometry(0.085, 0.48, 4), steel, 0, 0.28, 0, g);
  blade.rotation.y = Math.PI / 4;
  return g;
}

export function makePistol() {
  const g = new THREE.Group();
  const metal = std(0x30343a, { metalness: 0.72, roughness: 0.28 });
  const slide = std(0x535b64, { metalness: 0.78, roughness: 0.24 });
  const grip = std(0x292323, { roughness: 0.8 });
  box(0.14, 0.12, 0.36, metal, 0, 0.07, 0.06, g);
  box(0.155, 0.075, 0.32, slide, 0, 0.16, 0.07, g);
  box(0.12, 0.09, 0.065, metal, 0, 0.06, 0.275, g);
  box(0.105, 0.22, 0.115, grip, 0, -0.09, -0.075, g).rotation.x = -0.22;
  box(0.018, 0.025, 0.027, std(0xddd3b3), 0, 0.207, 0.235, g);
  return g;
}

export function makeGlue() {
  const g = new THREE.Group();
  cyl(0.05, 0.055, 0.18, std(0xf6f6f0, { roughness: 0.4 }), 0, 0, 0, g);
  const lab = cyl(0.056, 0.056, 0.08, std(0xe8a020), 0, 0, 0, g);
  lab.castShadow = false;
  cyl(0.02, 0.035, 0.06, std(0xe25b1a), 0, 0.12, 0, g);
  cyl(0.006, 0.012, 0.04, std(0xe25b1a), 0, 0.17, 0, g);
  return g;
}

export function makeBall(r = 0.085) {
  const tex = canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = '#d8ef3a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f7fbe8'; g.lineWidth = 5;
    g.beginPath();
    for (let x = 0; x <= w; x++) { const y = h / 2 + Math.sin((x / w) * Math.PI * 2) * h * 0.28; x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  });
  return mesh(new THREE.SphereGeometry(r, 16, 12), std(0xffffff, { map: tex, roughness: 0.95 }));
}

export function makeKnuckles() {
  const g = new THREE.Group();
  const gold = std(0xe0b347, { metalness: 0.9, roughness: 0.25 });
  for (let i = 0; i < 4; i++) {
    const t = mesh(new THREE.TorusGeometry(0.03, 0.011, 8, 16), gold, (i - 1.5) * 0.066, 0, 0, g);
  }
  const bar = box(0.26, 0.035, 0.025, gold, 0, -0.045, 0, g);
  return g;
}

export function makeMilk() {
  const g = new THREE.Group();
  box(0.12, 0.2, 0.12, std(0xfafafa), 0, 0, 0, g);
  const roof = box(0.12, 0.06, 0.09, std(0x3c7fd0), 0, 0.12, 0, g);
  roof.rotation.x = Math.PI / 4; roof.scale.set(1, 0.7, 0.7);
  box(0.122, 0.06, 0.122, std(0x3c7fd0), 0, -0.02, 0, g, false);
  return g;
}

export function makeGrapes() {
  const g = new THREE.Group();
  const m = std(0x6b2a7a, { roughness: 0.35 });
  let k = 0;
  for (let row = 0; row < 5; row++) {
    const n = 5 - row;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + row;
      const rr = n * 0.012;
      mesh(new THREE.SphereGeometry(0.028, 10, 8), m, Math.cos(a) * rr, 0.1 - row * 0.042, Math.sin(a) * rr, g);
      k++;
    }
  }
  cyl(0.006, 0.006, 0.06, std(0x5a7a2a), 0, 0.14, 0, g);
  return g;
}

export function makeChocolate() {
  const g = new THREE.Group();
  box(0.2, 0.03, 0.1, std(0x4a2512, { roughness: 0.4 }), 0, 0, 0, g);
  box(0.12, 0.032, 0.104, std(0xb8262c), 0.05, 0, 0, g);
  return g;
}

export function makeKibbleBag() {
  const g = new THREE.Group();
  box(0.2, 0.26, 0.08, std(0xd2472e), 0, 0, 0, g);
  box(0.201, 0.08, 0.081, std(0xf2c14e), 0, 0.02, 0, g);
  return g;
}

export function makeChainLinks(n = 3) {
  const g = new THREE.Group();
  const m = std(0x9aa0a6, { metalness: 0.9, roughness: 0.35 });
  for (let i = 0; i < n; i++) {
    const t = mesh(new THREE.TorusGeometry(0.035, 0.01, 6, 12), m, 0, i * 0.055, 0, g);
    t.scale.set(1, 1.5, 1);
    t.rotation.y = i % 2 ? Math.PI / 2 : 0;
  }
  return g;
}

export function makeShoe() {
  const g = new THREE.Group();
  box(0.12, 0.08, 0.26, std(0x2b2b2b), 0, 0, 0.03, g);
  box(0.125, 0.025, 0.27, std(0xf2f2f2), 0, -0.05, 0.03, g);
  return g;
}

export function makeFist(color = 0xf1c19a) {
  const g = new THREE.Group();
  ellip(0.07, 0.06, 0.07, std(color), 0, 0, 0, g);
  return g;
}

export function makeHeart(color = 0xe8457a) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.08);
  s.bezierCurveTo(-0.12, 0.0, -0.08, 0.1, 0, 0.05);
  s.bezierCurveTo(0.08, 0.1, 0.12, 0.0, 0, -0.08);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 });
  geo.center();
  return mesh(geo, std(color, { roughness: 0.4 }));
}

// Little fish head for the hotbar icon / stand display
export function makeFishToy() {
  const g = new THREE.Group();
  ellip(0.12, 0.08, 0.05, std(0x4f8fd0), 0, 0, 0, g);
  const tail = mesh(new THREE.ConeGeometry(0.06, 0.08, 4), std(0x3a6fae), -0.14, 0, 0, g);
  tail.rotation.z = Math.PI / 2;
  ellip(0.022, 0.022, 0.012, std(0xffffff), 0.07, 0.02, 0.043, g, 8);
  ellip(0.011, 0.011, 0.01, std(0x111111), 0.075, 0.02, 0.052, g, 8);
  return g;
}

export function makeLips(color = 0xe0344e) {
  const g = new THREE.Group();
  const m = std(color, { roughness: 0.3 });
  const top = ellip(0.09, 0.035, 0.04, m, 0, 0.022, 0, g, 14);
  const bot = ellip(0.08, 0.04, 0.04, m, 0, -0.024, 0, g, 14);
  for (const s of [-1, 1]) { const b = ellip(0.05, 0.03, 0.035, m, s * 0.04, 0.032, 0.002, g, 10); b.rotation.z = s * 0.3; }
  return g;
}

export const snowMat = std(0xf4f8fc, { roughness: 0.85 });
export function makeSnowball(r = 0.1) {
  const m = mesh(new THREE.IcosahedronGeometry(r, 1), snowMat);
  return m;
}
