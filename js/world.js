import * as THREE from 'three';
import { addBox } from './physics.js';
import { std, mesh, box, ellip, cyl, canvasTex, labelTex, makeBone, makeBat, makeMilk, makeGrapes, makeChocolate, makeFishToy, makeKnuckles } from './models.js';

export const YARD = { minX: -16, maxX: 16, minZ: -12, maxZ: 14 };
export const insideYard = (p) => p.x > YARD.minX && p.x < YARD.maxX && p.z > YARD.minZ && p.z < YARD.maxZ;

const rand = (a, b) => a + Math.random() * (b - a);

function noiseTex(base, specks, size = 256, rx = 1, ry = 1, n = 3000, sMin = 1, sMax = 3) {
  return canvasTex(size, size, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) {
      g.fillStyle = specks[(Math.random() * specks.length) | 0];
      g.globalAlpha = rand(0.2, 0.7);
      const s = rand(sMin, sMax);
      g.fillRect(Math.random() * w, Math.random() * h, s, s);
    }
    g.globalAlpha = 1;
  }, rx, ry);
}

export function buildWorld(scene) {
  const updaters = [];

  // ---------- Sky & light ----------
  const skyGeo = new THREE.SphereGeometry(600, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color(0.24, 0.52, 0.9) }, uHor: { value: new THREE.Color(0.78, 0.88, 0.96) }, uLow: { value: new THREE.Color(0.62, 0.72, 0.62) } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uLow; varying vec3 vP; void main(){ float h = normalize(vP).y;
      vec3 c = mix(uHor, uTop, smoothstep(0.0, 0.55, h)); c = mix(c, uLow, smoothstep(0.0,-0.1,h)); gl_FragColor = vec4(c,1.); }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
  scene.fog = new THREE.Fog(0xc6dcec, 90, 380);

  const hemi = new THREE.HemisphereLight(0xd6ecff, 0x6a8a44, 0.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
  sun.position.set(28, 48, 30);
  sun.target.position.set(0, 0, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48; sc.near = 1; sc.far = 140;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // ---------- Ground ----------
  const grassTex = noiseTex('#5f9a3a', ['#4d8a2c', '#6fae45', '#80b850', '#3f7424', '#8a9a40'], 256, 120, 120, 5000);
  const snowTex = noiseTex('#eef3f8', ['#dde6ef', '#ffffff', '#cdd8e4', '#e6eef6'], 256, 120, 120, 4500, 1, 4);
  const groundMat = std(0xffffff, { map: grassTex, roughness: 1 });
  const ground = mesh(new THREE.PlaneGeometry(900, 900), groundMat, 0, 0, 0, scene, false);
  ground.rotation.x = -Math.PI / 2;

  // ---------- Grass blades ----------
  const grassUniforms = { uTime: { value: 0 } };
  const grassMeshes = [];
  function grassField(count, xr, zr, skip, hScale = 1) {
    const geo = new THREE.PlaneGeometry(0.07, 0.34, 1, 3);
    geo.translate(0, 0.17, 0);
    const p = geo.attributes.position, nm = geo.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const t = p.getY(i) / 0.34;
      p.setX(i, p.getX(i) * (1 - t * 0.92));
      p.setZ(i, t * t * 0.07);
      nm.setXYZ(i, 0, 1, 0);
    }
    const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = grassUniforms.uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying float vH;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vH = uv.y;
          vec4 ip = instanceMatrix * vec4(0.,0.,0.,1.);
          float w = sin(uTime*1.7 + ip.x*0.31 + ip.z*0.23)*0.6 + sin(uTime*3.3 + ip.x*1.7 + ip.z)*0.25;
          transformed.x += w * uv.y * uv.y * 0.1;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vH;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(0.45, 1.15, vH);');
    };
    const im = new THREE.InstancedMesh(geo, mat, count);
    im.receiveShadow = true;
    const d = new THREE.Object3D(), col = new THREE.Color();
    let k = 0, tries = 0;
    while (k < count && tries < count * 4) {
      tries++;
      const x = rand(xr[0], xr[1]), z = rand(zr[0], zr[1]);
      if (skip && skip(x, z)) continue;
      d.position.set(x, 0, z);
      d.rotation.set(rand(-0.15, 0.15), rand(0, Math.PI * 2), rand(-0.15, 0.15));
      const s = rand(0.6, 1.35) * hScale;
      d.scale.set(rand(0.8, 1.3), s, 1);
      d.updateMatrix();
      im.setMatrixAt(k, d.matrix);
      col.setHSL(rand(0.22, 0.3), rand(0.45, 0.65), rand(0.3, 0.45));
      im.setColorAt(k, col);
      k++;
    }
    im.count = k;
    scene.add(im);
    grassMeshes.push(im);
  }
  const yardSkip = (x, z) =>
    (x > -8.2 && x < 4.2 && z < -6.8) || // patio
    (x > 9.9 && x < 12.1 && z > -7.9 && z < -6.1) || // dog house
    (x > -14.2 && x < -10.8 && z > -8 && z < -6) || // garden bed
    (x < -14.4 && z > -6.2 && z < 10.2) || // flower bed
    (Math.hypot(x + 3, z - 7) < 1.3); // kiddie pool
  grassField(52000, [-15.9, 15.9], [-11.9, 13.9], yardSkip);
  grassField(9000, [-40, 40], [30, 58], (x, z) => (x > 0 && x < 8.5 && z < 36.5) || Math.abs(x + 20) < 7 && z > 39 || Math.abs(x - 24) < 7 && z > 39, 0.8);
  updaters.push((dt, t) => { grassUniforms.uTime.value = t; });

  // ---------- Fence ----------
  const woodTex = canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = '#b98b5c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = `rgba(${90 + Math.random() * 40},${55 + Math.random() * 20},30,${rand(0.15, 0.4)})`;
      g.lineWidth = rand(0.5, 2);
      const x = Math.random() * w;
      g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + rand(-4, 4), h / 3, x + rand(-4, 4), h * 0.66, x + rand(-3, 3), h); g.stroke();
    }
    g.fillStyle = '#5a3a1e55';
    for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 3, 6, 0, 0, 7); g.fill(); }
  });
  const boardMat = std(0xffffff, { map: woodTex, roughness: 0.9 });
  const postMat = std(0x9b6f45, { map: woodTex });
  const fenceH = 1.95;
  const segs = [
    [-16, -12, -16, 14], [16, -12, 16, 14], [-16, 14, -1.6, 14], [1.6, 14, 16, 14],
  ];
  let boardCount = 0;
  for (const s of segs) boardCount += Math.floor(Math.hypot(s[2] - s[0], s[3] - s[1]) / 0.155);
  const boardGeo = new THREE.BoxGeometry(0.148, 1, 0.025);
  const boards = new THREE.InstancedMesh(boardGeo, boardMat, boardCount);
  boards.castShadow = boards.receiveShadow = true;
  const d = new THREE.Object3D(), col = new THREE.Color();
  let bi = 0;
  for (const s of segs) {
    const dx = s[2] - s[0], dz = s[3] - s[1], len = Math.hypot(dx, dz);
    const n = Math.floor(len / 0.155);
    const ang = -Math.atan2(dz, dx);
    // inward normal
    const nx = -dz / len, nz = dx / len;
    const cx = (s[0] + s[2]) / 2, cz = (s[1] + s[3]) / 2;
    const inward = (nx * -cx + nz * (1 - cz)) > 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const h = fenceH + rand(-0.04, 0.03);
      d.position.set(s[0] + dx * t, h / 2, s[1] + dz * t);
      d.rotation.set(0, ang, rand(-0.01, 0.01));
      d.scale.set(1, h, 1);
      d.updateMatrix();
      boards.setMatrixAt(bi, d.matrix);
      col.setHSL(0.075, rand(0.3, 0.45), rand(0.75, 0.95));
      boards.setColorAt(bi, col);
      bi++;
    }
    // rails + posts on the inside
    for (const y of [0.35, 1.6]) {
      const r = box(len, 0.09, 0.05, postMat, cx + nx * 0.04 * inward, y, cz + nz * 0.04 * inward, scene);
      r.rotation.y = ang;
    }
    const posts = Math.ceil(len / 2.4);
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      box(0.11, 2.05, 0.11, postMat, s[0] + dx * t + nx * 0.07 * inward, 1.02, s[1] + dz * t + nz * 0.07 * inward, scene);
    }
    addBox(Math.min(s[0], s[2]) - 0.12, 0, Math.min(s[1], s[3]) - 0.12, Math.max(s[0], s[2]) + 0.12, 2.0, Math.max(s[1], s[3]) + 0.12, 'fence');
  }
  scene.add(boards);
  // open gate
  const gate = new THREE.Group();
  gate.position.set(1.6, 0, 14);
  gate.rotation.y = 1.25;
  for (let i = 0; i < 20; i++) box(0.148, 1.8, 0.025, boardMat, -0.08 - i * 0.155, 0.95, 0, gate);
  for (const y of [0.4, 1.5]) box(3.1, 0.09, 0.05, postMat, -1.55, y, -0.04, gate);
  const brace = box(3.3, 0.08, 0.04, postMat, -1.55, 0.95, -0.05, gate);
  brace.rotation.z = 0.36;
  cyl(0.03, 0.03, 0.12, std(0x333333, { metalness: 0.8 }), -2.9, 1.1, 0.04, gate).rotation.x = Math.PI / 2;
  scene.add(gate);

  // ---------- House ----------
  const sidingTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e9e1cf'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      const grd = g.createLinearGradient(0, y, 0, y + 16);
      grd.addColorStop(0, '#f3ecdc'); grd.addColorStop(0.85, '#ddd3bd'); grd.addColorStop(1, '#b9ae96');
      g.fillStyle = grd; g.fillRect(0, y, w, 16);
    }
  }, 10, 12);
  const trim = std(0xfbfbf6, { roughness: 0.6 });
  const house = new THREE.Group();
  scene.add(house);
  box(28, 6, 12, std(0xffffff, { map: sidingTex }), 0, 3, -18, house);
  box(28.2, 0.5, 12.2, std(0x9c9a94, { map: noiseTex('#a09d96', ['#8a877f', '#b5b2aa'], 128, 8, 1, 800) }), 0, 0.25, -18, house);
  for (const x of [-13.95, 13.95]) box(0.22, 6, 0.22, trim, x, 3, -11.95, house);
  box(28.1, 0.18, 0.2, trim, 0, 3.05, -11.92, house);
  // roof
  const shingleTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#4a4e57'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = -(y % 32 ? 16 : 0); x < w; x += 32) {
      g.fillStyle = `hsl(220,6%,${rand(24, 36)}%)`; g.fillRect(x + 1, y + 1, 30, 14);
      g.fillStyle = '#0003'; g.fillRect(x, y + 13, 32, 3);
    }
  }, 14, 4);
  const roofMat = std(0xffffff, { map: shingleTex, roughness: 0.95 });
  const slope = Math.atan2(3, 6.6), slen = Math.hypot(6.6, 3) + 0.5;
  const r1 = box(29.2, 0.22, slen, roofMat, 0, 7.45, -14.7, house); r1.rotation.x = slope;
  const r2 = box(29.2, 0.22, slen, roofMat, 0, 7.45, -21.3, house); r2.rotation.x = -slope;
  box(29.3, 0.3, 0.35, std(0x3a3e45), 0, 9.08, -18, house);
  const gShape = new THREE.Shape([new THREE.Vector2(-6.2, 0), new THREE.Vector2(6.2, 0), new THREE.Vector2(0, 2.85)]);
  for (const x of [-14, 13.9]) {
    const gm = mesh(new THREE.ExtrudeGeometry(gShape, { depth: 0.1, bevelEnabled: false }), std(0xffffff, { map: sidingTex }), x, 6, -18, house);
    gm.rotation.y = Math.PI / 2;
  }
  box(1.2, 2.6, 1.2, std(0x9a4b36, { map: noiseTex('#9a4b36', ['#7a3522', '#b0624a', '#6b2d1d'], 64, 1, 2, 300, 3, 6) }), 8, 9.2, -19.5, house);
  box(1.4, 0.2, 1.4, std(0x666666), 8, 10.55, -19.5, house);
  // gutter + downspout
  const gut = std(0xf0f0ea, { roughness: 0.5 });
  box(28.8, 0.16, 0.18, gut, 0, 6.02, -11.25, house);
  box(0.14, 6, 0.14, gut, 13.7, 3, -11.35, house);
  box(0.14, 0.14, 0.5, gut, 13.7, 0.12, -11.1, house);
  // windows
  const glass = std(0x7f9fb8, { roughness: 0.08, metalness: 0.5 });
  const curtain = std(0xf2e8d0, { roughness: 1 });
  const shutter = std(0x2f5a45, { roughness: 0.7 });
  const windows = [];
  function windowAt(x, y, w = 1.4, h = 1.3) {
    const z = -11.95;
    const gl = box(w, h, 0.04, glass, x, y, z + 0.02, house, false);
    windows.push({ center: new THREE.Vector3(x, y, z + 0.05), normal: new THREE.Vector3(0, 0, 1), right: new THREE.Vector3(1, 0, 0), w, h, glass: gl, broken: 0, high: y > 3.5, name: 'your house' });
    box(w * 0.22, h * 0.92, 0.02, curtain, x - w * 0.37, y, z + 0.05, house, false);
    box(w * 0.22, h * 0.92, 0.02, curtain, x + w * 0.37, y, z + 0.05, house, false);
    const f = 0.09;
    box(w + f * 2, f, 0.12, trim, x, y + h / 2 + f / 2, z + 0.06, house);
    box(w + f * 2, f, 0.12, trim, x, y - h / 2 - f / 2, z + 0.06, house);
    box(f, h, 0.12, trim, x - w / 2 - f / 2, y, z + 0.06, house);
    box(f, h, 0.12, trim, x + w / 2 + f / 2, y, z + 0.06, house);
    box(0.05, h, 0.06, trim, x, y, z + 0.06, house);
    box(w, 0.05, 0.06, trim, x, y, z + 0.06, house);
    box(w + 0.4, 0.08, 0.25, trim, x, y - h / 2 - 0.12, z + 0.12, house);
    for (const s of [-1, 1]) {
      const sh = box(0.45, h + 0.1, 0.05, shutter, x + s * (w / 2 + 0.35), y, z + 0.04, house);
      for (let i = 0; i < 6; i++) box(0.4, 0.03, 0.02, std(0x264a38), x + s * (w / 2 + 0.35), y - h / 2 + 0.15 + i * (h / 6), z + 0.075, house, false);
    }
  }
  windowAt(-10, 1.8); windowAt(9, 1.8); windowAt(3.2, 2.0, 1.2, 0.9);
  for (const x of [-10, -3, 3.2, 9]) windowAt(x, 4.5, 1.3, 1.3);
  // door
  const doorX = -3;
  box(1.05, 2.15, 0.08, std(0x7c3b22, { roughness: 0.55 }), doorX, 1.45, -11.93, house);
  for (const [px, py] of [[-0.24, 0.55], [0.24, 0.55], [-0.24, -0.35], [0.24, -0.35]]) box(0.36, 0.6, 0.03, std(0x6a3019), doorX + px, 1.45 + py, -11.88, house);
  ellip(0.045, 0.045, 0.045, std(0xd8b04a, { metalness: 0.9, roughness: 0.3 }), doorX + 0.4, 1.4, -11.84, house, 10);
  box(1.3, 0.1, 0.12, trim, doorX, 2.58, -11.9, house);
  box(0.1, 2.25, 0.12, trim, doorX - 0.6, 1.47, -11.9, house);
  box(0.1, 2.25, 0.12, trim, doorX + 0.6, 1.47, -11.9, house);
  const conc = std(0xb5b2aa, { map: noiseTex('#b5b2aa', ['#9f9c94', '#c7c4bc'], 128, 2, 1, 1500) });
  box(1.9, 0.2, 0.9, conc, doorX, 0.1, -11.5, house);
  box(1.9, 0.2, 0.45, conc, doorX, 0.3, -11.72, house);
  addBox(doorX - 0.95, 0, -12, doorX + 0.95, 0.2, -11.05, 'step');
  // porch light
  box(0.18, 0.28, 0.1, std(0x222222), doorX + 0.95, 2.3, -11.9, house);
  ellip(0.06, 0.09, 0.06, std(0xfff4c0, { emissive: 0xffd88a, emissiveIntensity: 0.7 }), doorX + 0.95, 2.28, -11.82, house, 10);
  // AC unit
  const ac = box(1.0, 0.9, 0.8, std(0xd4d6d2, { roughness: 0.5 }), 11.3, 0.45, -11.4, house);
  cyl(0.36, 0.36, 0.02, std(0x3a3a3a), 11.3, 0.91, -11.4, house, 20);
  addBox(10.8, 0, -12, 11.8, 0.9, -11, 'ac');
  addBox(-14, 0, -24, 14, 9, -12, 'house');

  // ---------- Patio ----------
  const tileTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c9c3b6'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      g.fillStyle = `hsl(35,${rand(6, 14)}%,${rand(70, 80)}%)`; g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
    }
    for (let i = 0; i < 600; i++) { g.fillStyle = '#0001'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }, 6, 2.5);
  box(12.4, 0.08, 5.2, std(0xffffff, { map: tileTex, roughness: 0.9 }), -2, 0.04, -9.4, scene);
  // table + umbrella
  const tx = -5.4, tz = -9.2;
  const metal = std(0x2d2f33, { metalness: 0.6, roughness: 0.4 });
  cyl(0.75, 0.75, 0.05, std(0xeeeeee, { roughness: 0.3 }), tx, 0.74, tz, scene, 24);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.78; const l = cyl(0.02, 0.02, 0.74, metal, tx + Math.cos(a) * 0.55, 0.37, tz + Math.sin(a) * 0.55, scene); }
  cyl(0.025, 0.025, 2.4, std(0xdddddd), tx, 1.2, tz, scene);
  const umbTex = canvasTex(256, 32, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4f1e8' : '#2c7a8c'; g.fillRect(i * 32, 0, 32, h); } });
  const umb = mesh(new THREE.ConeGeometry(1.6, 0.55, 8, 1, true), std(0xffffff, { map: umbTex, side: THREE.DoubleSide }), tx, 2.25, tz, scene);
  ellip(0.05, 0.05, 0.05, std(0xdddddd), tx, 2.54, tz, scene);
  addBox(tx - 0.75, 0, tz - 0.75, tx + 0.75, 0.78, tz + 0.75, 'table');
  function chair(x, z, ry) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
    const w = std(0xf3f0e6, { roughness: 0.5 });
    box(0.55, 0.06, 0.55, w, 0, 0.45, 0, g);
    const b = box(0.55, 0.65, 0.05, w, 0, 0.8, -0.3, g); b.rotation.x = -0.18;
    for (const sx of [-0.25, 0.25]) for (const sz of [-0.24, 0.24]) box(0.05, 0.45, 0.05, w, sx, 0.22, sz, g);
    for (const sx of [-0.27, 0.27]) box(0.06, 0.05, 0.5, w, sx, 0.65, 0, g);
    scene.add(g);
    addBox(x - 0.35, 0, z - 0.35, x + 0.35, 0.5, z + 0.35, 'chair');
  }
  chair(tx - 1.2, tz, Math.PI / 2); chair(tx + 1.2, tz, -Math.PI / 2); chair(tx, tz + 1.2, Math.PI);
  // grill
  const gx = 1.8, gz = -9.6;
  const kettle = std(0x1b1b1d, { roughness: 0.35, metalness: 0.3 });
  const bowlG = mesh(new THREE.SphereGeometry(0.34, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), kettle, gx, 0.85, gz, scene);
  mesh(new THREE.SphereGeometry(0.345, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), kettle, gx, 0.88, gz, scene);
  cyl(0.02, 0.02, 0.1, std(0x222222), gx, 1.25, gz, scene);
  box(0.2, 0.04, 0.04, std(0x6b4a2a), gx, 1.3, gz, scene);
  for (let i = 0; i < 3; i++) { const a = i * 2.09; const l = cyl(0.018, 0.018, 0.75, metal, gx + Math.cos(a) * 0.22, 0.38, gz + Math.sin(a) * 0.22, scene); l.rotation.set(Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2); }
  addBox(gx - 0.35, 0, gz - 0.35, gx + 0.35, 1.2, gz + 0.35, 'grill');

  // ---------- Bushes along house ----------
  const bushMat = [std(0x3d7a2e, { flatShading: true }), std(0x4a8a36, { flatShading: true }), std(0x2f6624, { flatShading: true })];
  function bush(x, z, s = 1) {
    for (let i = 0; i < 5; i++) {
      const m = mesh(new THREE.IcosahedronGeometry(rand(0.35, 0.55) * s, 1), bushMat[i % 3], x + rand(-0.45, 0.45) * s, rand(0.3, 0.6) * s, z + rand(-0.2, 0.2) * s, scene);
      m.rotation.set(rand(0, 3), rand(0, 3), 0);
    }
  }
  for (let x = -13.2; x < -8.5; x += 1.3) bush(x, -11.3);
  for (let x = 5; x < 10.4; x += 1.3) bush(x, -11.3);
  bush(15, 12.8, 1.2); bush(-15, 12.9, 1.1);

  // ---------- Flower bed (west fence) ----------
  box(1.4, 0.12, 16.4, std(0x4a3222, { map: noiseTex('#4a3222', ['#3a2518', '#5c4030', '#2c1c12'], 128, 1, 8, 2000) }), -15.2, 0.06, 2, scene, false);
  box(0.08, 0.2, 16.4, std(0x8a6a4a), -14.47, 0.1, 2, scene);
  const nF = 150;
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.015, 1, 5), std(0x3f7a2a), nF);
  const heads = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.07, 0), std(0xffffff, { roughness: 0.6, flatShading: true }), nF);
  const leafs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 6, 4), std(0x4f9a36), nF);
  const fc = [0xe64a6a, 0xf5d547, 0xf08a2a, 0xb462e0, 0xffffff, 0xff7fb0, 0x4a7ae0];
  for (let i = 0; i < nF; i++) {
    const x = rand(-15.8, -14.6), z = rand(-5.9, 9.9), h = rand(0.3, 0.7);
    d.position.set(x, h / 2, z); d.rotation.set(rand(-0.1, 0.1), 0, rand(-0.1, 0.1)); d.scale.set(1, h, 1); d.updateMatrix(); stems.setMatrixAt(i, d.matrix);
    d.position.set(x, h, z); d.scale.setScalar(rand(0.8, 1.3)); d.updateMatrix(); heads.setMatrixAt(i, d.matrix);
    heads.setColorAt(i, col.setHex(fc[(Math.random() * fc.length) | 0]));
    d.position.set(x + 0.04, h * 0.4, z); d.scale.set(1.3, 0.3, 0.7); d.updateMatrix(); leafs.setMatrixAt(i, d.matrix);
  }
  for (const m of [stems, heads, leafs]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
  const flowers = [stems, heads, leafs];

  // ---------- Garden bed ----------
  const gbx = -12.5, gbz = -7;
  const plank = std(0x8a5f3a, { map: woodTex });
  box(3.2, 0.4, 0.1, plank, gbx, 0.2, gbz - 0.95, scene); box(3.2, 0.4, 0.1, plank, gbx, 0.2, gbz + 0.95, scene);
  box(0.1, 0.4, 2, plank, gbx - 1.6, 0.2, gbz, scene); box(0.1, 0.4, 2, plank, gbx + 1.6, 0.2, gbz, scene);
  box(3.1, 0.34, 1.8, std(0x3e2a1a, { map: noiseTex('#3e2a1a', ['#2e1e12', '#523826'], 64, 2, 1, 600) }), gbx, 0.17, gbz, scene, false);
  for (let i = 0; i < 6; i++) {
    const lx = gbx - 1.2 + i * 0.48;
    for (let j = 0; j < 4; j++) { const l = ellip(0.14, 0.08, 0.14, std(0x6ab83a, { flatShading: true }), lx + rand(-0.05, 0.05), 0.42, gbz - 0.45 + rand(-0.05, 0.05), scene, 6); l.rotation.set(rand(-0.4, 0.4), rand(0, 3), rand(-0.4, 0.4)); }
  }
  for (let i = 0; i < 4; i++) {
    const sx = gbx - 1.1 + i * 0.73;
    cyl(0.015, 0.015, 1.2, std(0x9b7a50), sx, 0.8, gbz + 0.45, scene);
    ellip(0.2, 0.3, 0.2, std(0x3f8a2a, { flatShading: true }), sx, 0.75, gbz + 0.45, scene, 6);
    for (let k = 0; k < 3; k++) ellip(0.05, 0.05, 0.05, std(0xd8321e, { roughness: 0.3 }), sx + rand(-0.15, 0.15), rand(0.5, 1.0), gbz + 0.45 + rand(-0.15, 0.15), scene, 8);
  }
  addBox(gbx - 1.65, 0, gbz - 1, gbx + 1.65, 0.4, gbz + 1, 'garden');

  // ---------- Stepping stones ----------
  const stoneMat = std(0x9a978f, { map: noiseTex('#9a978f', ['#86837b', '#aeaba3', '#77746c'], 64, 1, 1, 400) });
  const path = new THREE.CatmullRomCurve3([new THREE.Vector3(-3, 0, -6.6), new THREE.Vector3(-2.5, 0, -2), new THREE.Vector3(0.6, 0, 3), new THREE.Vector3(-0.4, 0, 9), new THREE.Vector3(0, 0, 14.6)]);
  for (let i = 0; i <= 16; i++) {
    const p = path.getPoint(i / 16);
    const s = mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.06, 9), stoneMat, p.x + rand(-0.1, 0.1), 0.03, p.z, scene);
    s.scale.set(rand(0.9, 1.2), 1, rand(0.75, 1)); s.rotation.y = rand(0, 3);
  }

  // ---------- Trees ----------
  const bark = std(0x6b4a30, { map: noiseTex('#6b4a30', ['#5a3c24', '#7c583a', '#4a301c'], 64, 1, 3, 500, 1, 5) });
  const leafMats = [0x3f7f2a, 0x4d9133, 0x356e24, 0x5a9a3a].map((c) => std(c, { flatShading: true, roughness: 0.9 }));
  function tree(x, z, s = 1, collide = true) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    cyl(0.22 * s, 0.38 * s, 4 * s, bark, 0, 2 * s, 0, g);
    for (let i = 0; i < 3; i++) {
      const b = cyl(0.07 * s, 0.14 * s, 1.8 * s, bark, 0, 0, 0, g);
      const a = i * 2.1 + rand(0, 1);
      b.position.set(Math.cos(a) * 0.55 * s, 3.4 * s, Math.sin(a) * 0.55 * s);
      b.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8);
    }
    for (let i = 0; i < 11; i++) {
      const a = rand(0, Math.PI * 2), r = rand(0, 1.9) * s;
      const m = mesh(new THREE.IcosahedronGeometry(rand(1.0, 1.6) * s, 1), leafMats[i % 4], Math.cos(a) * r, rand(4.3, 6.2) * s, Math.sin(a) * r, g);
      m.rotation.set(rand(0, 3), rand(0, 3), 0);
    }
    if (collide) addBox(x - 0.35 * s, 0, z - 0.35 * s, x + 0.35 * s, 4.5 * s, z + 0.35 * s, 'tree');
    return g;
  }
  const oak = tree(-10.5, 5, 1.35);
  // tire swing
  const branch = cyl(0.1, 0.13, 3.4, bark, 1.5, 5.3, 0, oak);
  branch.rotation.z = Math.PI / 2 + 0.08;
  const swing = new THREE.Group(); swing.position.set(2.4, 5.25, 0); oak.add(swing);
  const rope = cyl(0.025, 0.025, 4.2, std(0xc9b58a), 0, -2.1, 0, swing);
  const tire = mesh(new THREE.TorusGeometry(0.38, 0.14, 12, 24), std(0x202022, { roughness: 0.9 }), 0, -4.5, 0, swing);
  tire.rotation.y = 0.4;
  updaters.push((dt, t) => { swing.rotation.z = Math.sin(t * 1.3) * 0.07; swing.rotation.x = Math.sin(t * 0.9) * 0.04; });
  tree(12.8, 10.5, 1.05);
  // outside trees
  const outTrees = [[-24, 6], [-28, 22], [36, 22], [-40, -4], [40, -2], [-8, 52], [14, 56], [36, 34], [-38, 36], [-60, 20], [62, 18], [0, -34], [-22, -34], [24, -36]];
  for (const [x, z] of outTrees) tree(x, z, rand(0.9, 1.4));

  // ---------- Yard props ----------
  // kiddie pool
  const poolMat = std(0x3aa0e0, { roughness: 0.4, side: THREE.DoubleSide });
  mesh(new THREE.CylinderGeometry(1.2, 1.15, 0.32, 28, 1, true), poolMat, -3, 0.16, 7, scene);
  mesh(new THREE.TorusGeometry(1.2, 0.07, 8, 32), std(0x4ab4f0, { roughness: 0.4 }), -3, 0.32, 7, scene).rotation.x = Math.PI / 2;
  const waterMat = std(0x7fd0f0, { roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.8 });
  const water = mesh(new THREE.CircleGeometry(1.15, 28), waterMat, -3, 0.24, 7, scene, false);
  water.rotation.x = -Math.PI / 2;
  const duck = new THREE.Group(); duck.position.set(-2.6, 0.27, 6.8); scene.add(duck);
  ellip(0.11, 0.08, 0.14, std(0xf6d23a, { roughness: 0.4 }), 0, 0, 0, duck);
  ellip(0.07, 0.07, 0.07, std(0xf6d23a, { roughness: 0.4 }), 0, 0.1, 0.08, duck);
  ellip(0.03, 0.015, 0.04, std(0xf07a1a), 0, 0.09, 0.16, duck, 8);
  let duckFrozen = false;
  updaters.push((dt, t) => { if (duckFrozen) return; duck.position.x = -3 + Math.cos(t * 0.4) * 0.6; duck.position.z = 7 + Math.sin(t * 0.4) * 0.6; duck.rotation.y = -t * 0.4; duck.position.y = 0.27 + Math.sin(t * 2) * 0.01; });
  // hose reel
  const reel = new THREE.Group(); reel.position.set(-13.4, 0, -11.2); scene.add(reel);
  box(0.6, 0.06, 0.4, std(0x2f6b3a), 0, 0.03, 0, reel);
  for (const x of [-0.25, 0.25]) box(0.04, 0.6, 0.04, std(0x2f6b3a), x, 0.3, 0, reel);
  mesh(new THREE.TorusGeometry(0.2, 0.07, 8, 20), std(0x3caa4a, { roughness: 0.5 }), 0, 0.45, 0, reel).rotation.y = Math.PI / 2;
  for (let i = 0; i < 3; i++) { const h = mesh(new THREE.TorusGeometry(0.5 + i * 0.12, 0.03, 6, 28), std(0x3caa4a, { roughness: 0.5 }), -12.2, 0.03, -10 + i * 0.05, scene); h.rotation.x = Math.PI / 2; }
  // frisbee + chew ring + sprinkler
  mesh(new THREE.CylinderGeometry(0.14, 0.13, 0.03, 20), std(0xe8322a, { roughness: 0.4 }), 4.5, 0.03, 3.4, scene).rotation.x = 0.1;
  mesh(new THREE.TorusGeometry(0.1, 0.035, 8, 16), std(0x3a7ae0, { roughness: 0.4 }), 6.5, 0.035, -2, scene).rotation.x = Math.PI / 2;
  cyl(0.05, 0.08, 0.12, std(0x2a2a2a), 6, 0.06, 5.5, scene);
  box(0.4, 0.03, 0.04, std(0x999999, { metalness: 0.6 }), 6, 0.14, 5.5, scene);

  // ---------- Trash can ----------
  const trashPos = new THREE.Vector3(14.6, 0, -10.6);
  const tc = new THREE.Group(); tc.position.copy(trashPos); scene.add(tc);
  const tcm = std(0x5d676e, { metalness: 0.6, roughness: 0.45 });
  cyl(0.36, 0.3, 0.9, tcm, 0, 0.45, 0, tc, 18);
  for (const y of [0.2, 0.5, 0.78]) cyl(0.365, 0.365, 0.03, std(0x4a5258, { metalness: 0.6 }), 0, y, 0, tc, 18);
  const lid = cyl(0.4, 0.4, 0.05, tcm, 0.05, 0.93, 0.02, tc, 18); lid.rotation.z = -0.12;
  box(0.16, 0.05, 0.05, std(0x333333), 0.05, 0.99, 0.02, tc);
  ellip(0.12, 0.08, 0.1, std(0x2a2a2a, { roughness: 0.6 }), -0.25, 0.08, 0.35, tc, 8);
  addBox(trashPos.x - 0.38, 0, trashPos.z - 0.38, trashPos.x + 0.38, 0.95, trashPos.z + 0.38, 'trash');

  // ---------- Dog house ----------
  const dh = new THREE.Group();
  dh.position.set(11, 0, -7);
  dh.rotation.y = -Math.PI / 2;
  scene.add(dh);
  const red = std(0xb8392c, { map: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#b8392c'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) { g.fillStyle = '#0002'; g.fillRect(x, 0, 2, h); } }, 1, 1) });
  const dhTrim = std(0xf6f1e6);
  box(0.08, 1.0, 1.6, red, -0.61, 0.5, 0, dh); box(0.08, 1.0, 1.6, red, 0.61, 0.5, 0, dh);
  const frontShape = new THREE.Shape([new THREE.Vector2(-0.65, 0), new THREE.Vector2(0.65, 0), new THREE.Vector2(0.65, 1.0), new THREE.Vector2(0, 1.52), new THREE.Vector2(-0.65, 1.0)]);
  const back = mesh(new THREE.ExtrudeGeometry(frontShape, { depth: 0.08, bevelEnabled: false }), red, 0, 0, -0.8, dh);
  const hole = new THREE.Path();
  hole.moveTo(-0.3, 0.04); hole.lineTo(0.3, 0.04); hole.lineTo(0.3, 0.5); hole.absarc(0, 0.5, 0.3, 0, Math.PI, false); hole.lineTo(-0.3, 0.04);
  frontShape.holes.push(hole);
  mesh(new THREE.ExtrudeGeometry(frontShape, { depth: 0.08, bevelEnabled: false }), red, 0, 0, 0.72, dh);
  box(1.14, 0.95, 1.46, std(0x1a120c, { roughness: 1 }), 0, 0.48, -0.04, dh, false);
  box(1.3, 0.06, 1.6, std(0x5a3a22), 0, 0.03, 0, dh);
  const dhRoof = std(0x3a3f48, { map: shingleTex.clone() });
  dhRoof.map.repeat.set(1.5, 1.5);
  const rs = Math.atan2(0.52, 0.65), rl = Math.hypot(0.65, 0.52) + 0.18;
  const rr1 = box(rl, 0.06, 1.95, dhRoof, -0.36, 1.3, 0, dh); rr1.rotation.z = rs;
  const rr2 = box(rl, 0.06, 1.95, dhRoof, 0.36, 1.3, 0, dh); rr2.rotation.z = -rs;
  box(0.1, 0.1, 1.98, dhTrim, 0, 1.56, 0, dh);
  for (const s of [-1, 1]) { const tr = box(0.06, 1.0, 0.1, dhTrim, s * 0.66, 0.5, 0.78, dh); }
  const plate = mesh(new THREE.PlaneGeometry(0.72, 0.13), std(0xffffff, { map: labelTex('THE FAMILY DOG', { w: 512, h: 92, font: 'bold 50px Trebuchet MS' }) }), 0, 0.88, 0.81, dh, false);
  addBox(10.2, 0, -7.7, 11.8, 1.55, -6.3, 'doghouse');
  const dogHomePos = new THREE.Vector3(9.3, 0, -7);

  // ---------- Bowl ----------
  const bowlPos = new THREE.Vector3(8.9, 0, -5.3);
  const prof = [[0.0, 0], [0.16, 0], [0.2, 0.02], [0.24, 0.1], [0.26, 0.11], [0.25, 0.12], [0.21, 0.06], [0.0, 0.05]].map(([x, y]) => new THREE.Vector2(x, y));
  const bowl = mesh(new THREE.LatheGeometry(prof, 28), std(0xc4ccd4, { metalness: 0.85, roughness: 0.25 }), bowlPos.x, 0, bowlPos.z, scene);
  const kib = new THREE.Group(); kib.position.copy(bowlPos); scene.add(kib);
  const kibMat = std(0x8a4a22, { roughness: 0.9 });
  for (let i = 0; i < 40; i++) { const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * 0.19; const k = ellip(0.025, 0.018, 0.025, kibMat, Math.cos(a) * r, 0.08 + rand(0, 0.04), Math.sin(a) * r, kib, 6); }
  kib.visible = false;
  const bowlWater = mesh(new THREE.CircleGeometry(0.2, 20), std(0x6cc4ee, { roughness: 0.05, transparent: true, opacity: 0.85 }), bowlPos.x, 0.1, bowlPos.z, scene, false);
  bowlWater.rotation.x = -Math.PI / 2; bowlWater.visible = false;
  const bowlBone = makeBone(1.1);
  bowlBone.position.set(bowlPos.x + 0.05, 0.14, bowlPos.z); bowlBone.rotation.set(0.1, 0.6, 0.1);
  scene.add(bowlBone);
  const dishLabel = mesh(new THREE.PlaneGeometry(0.2, 0.05), std(0xffffff, { map: labelTex('DOG', { w: 128, h: 32, font: 'bold 26px Trebuchet MS', bg: '#c4ccd4', fg: '#333', border: '#c4ccd4' }) }), bowlPos.x, 0.07, bowlPos.z + 0.225, scene, false);
  dishLabel.rotation.x = -0.35;
  addBox(bowlPos.x - 0.22, 0, bowlPos.z - 0.22, bowlPos.x + 0.22, 0.12, bowlPos.z + 0.22, 'bowl');

  // ---------- Street ----------
  const sideTex = canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#c4c0b8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) { g.fillStyle = Math.random() < 0.5 ? '#0001' : '#fff2'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = '#8f8b84'; g.fillRect(0, 0, 2, h);
  }, 200, 1);
  const sw1 = mesh(new THREE.PlaneGeometry(400, 2.6), std(0xffffff, { map: sideTex }), 0, 0.03, 15.6, scene, false); sw1.rotation.x = -Math.PI / 2;
  const sw2 = mesh(new THREE.PlaneGeometry(400, 2.6), std(0xffffff, { map: sideTex }), 0, 0.03, 28.4, scene, false); sw2.rotation.x = -Math.PI / 2;
  const asphalt = noiseTex('#3b3d42', ['#2f3135', '#4a4c52', '#55575c'], 256, 60, 2, 6000);
  const road = mesh(new THREE.PlaneGeometry(400, 10), std(0xffffff, { map: asphalt, roughness: 0.95 }), 0, 0.02, 22, scene, false); road.rotation.x = -Math.PI / 2;
  const curbMat = std(0xa9a59d);
  box(400, 0.15, 0.2, curbMat, 0, 0.075, 16.95, scene); box(400, 0.15, 0.2, curbMat, 0, 0.075, 27.05, scene);
  const dash = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 0.14), std(0xf0c030, { roughness: 0.7 }), 100);
  for (let i = 0; i < 100; i++) { d.position.set(-200 + i * 4, 0.025, 22); d.rotation.set(-Math.PI / 2, 0, 0); d.scale.set(1, 1, 1); d.updateMatrix(); dash.setMatrixAt(i, d.matrix); }
  dash.receiveShadow = true; scene.add(dash);
  for (const z of [17.4, 26.6]) { const l = mesh(new THREE.PlaneGeometry(400, 0.12), std(0xeeeeee), 0, 0.025, z, scene, false); l.rotation.x = -Math.PI / 2; }
  // lamps
  function lamp(x, z, dir) {
    const m = std(0x3a3d42, { metalness: 0.5, roughness: 0.5 });
    cyl(0.07, 0.1, 5.2, m, x, 2.6, z, scene);
    const arm = box(0.08, 0.08, 1.4, m, x, 5.1, z + dir * 0.65, scene);
    box(0.35, 0.14, 0.6, m, x, 5.05, z + dir * 1.35, scene);
    box(0.28, 0.03, 0.5, std(0xfff6d8, { emissive: 0xfff0c0, emissiveIntensity: 0.4 }), x, 4.97, z + dir * 1.35, scene, false);
    addBox(x - 0.12, 0, z - 0.12, x + 0.12, 5.2, z + 0.12, 'lamp');
  }
  lamp(-12, 16.5, 1); lamp(18, 16.5, 1); lamp(-30, 27.5, -1); lamp(0, 27.5, -1); lamp(34, 27.5, -1);
  // mailbox
  const mb = new THREE.Group(); mb.position.set(-3.2, 0, 15.3); scene.add(mb);
  box(0.1, 1.05, 0.1, std(0x6b4a30), 0, 0.52, 0, mb);
  box(0.24, 0.26, 0.5, std(0x2a2d35, { metalness: 0.4, roughness: 0.4 }), 0, 1.15, 0, mb);
  mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 14, 1, false, 0, Math.PI), std(0x2a2d35, { metalness: 0.4, roughness: 0.4 }), 0, 1.28, 0, mb).rotation.set(Math.PI / 2, 0, Math.PI / 2);
  box(0.02, 0.2, 0.06, std(0xd8321e), 0.13, 1.35, -0.1, mb);
  addBox(-3.35, 0, 15.0, -3.05, 1.4, 15.6, 'mailbox');
  // hydrant
  const hy = new THREE.Group(); hy.position.set(12, 0, 28.2); scene.add(hy);
  const hm = std(0xd8321e, { roughness: 0.5 });
  cyl(0.14, 0.16, 0.6, hm, 0, 0.3, 0, hy); ellip(0.14, 0.12, 0.14, hm, 0, 0.62, 0, hy); cyl(0.05, 0.05, 0.44, hm, 0, 0.42, 0, hy).rotation.z = Math.PI / 2;
  addBox(11.8, 0, 28, 12.2, 0.7, 28.4, 'hydrant');

  // ---------- Neighbor houses ----------
  function nHouse(x, z, ry, color, roofC) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    const sid = sidingTex.clone(); sid.repeat.set(5, 6);
    box(12, 4, 9, std(color, { map: sid }), 0, 2, 0, g);
    const rm = std(roofC, { map: shingleTex.clone(), roughness: 0.95 });
    const s = Math.atan2(2.2, 5), l = Math.hypot(5, 2.2) + 0.4;
    const a = box(12.6, 0.2, l, rm, 0, 5.1, 2.4, g); a.rotation.x = s;
    const b = box(12.6, 0.2, l, rm, 0, 5.1, -2.4, g); b.rotation.x = -s;
    const tri = new THREE.Shape([new THREE.Vector2(-4.5, 0), new THREE.Vector2(4.5, 0), new THREE.Vector2(0, 2.1)]);
    for (const sx of [-6, 5.95]) { const t = mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.05, bevelEnabled: false }), std(color, { map: sid }), sx, 4, 0, g); t.rotation.y = Math.PI / 2; }
    g.updateMatrixWorld(true);
    const nrm = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    const rgt = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    for (const wx of [-3.5, 3.5]) {
      const gl = box(1.4, 1.2, 0.05, glass, wx, 2.1, 4.52, g, false);
      windows.push({ center: g.localToWorld(new THREE.Vector3(wx, 2.1, 4.56)), normal: nrm.clone(), right: rgt.clone(), w: 1.4, h: 1.2, glass: gl, broken: 0, high: false, name: 'the neighbors' });
      box(1.6, 0.1, 0.1, trim, wx, 2.75, 4.55, g); box(1.6, 0.1, 0.1, trim, wx, 1.45, 4.55, g);
      box(0.06, 1.2, 0.08, trim, wx, 2.1, 4.55, g);
    }
    box(1.1, 2.2, 0.06, std(0x5a2a1a), 0, 1.1, 4.52, g);
    box(12.1, 0.4, 9.1, std(0x9c9a94), 0, 0.2, 0, g);
    const c = Math.abs(Math.sin(ry)) > 0.5;
    const hx = c ? 4.5 : 6, hz = c ? 6 : 4.5;
    addBox(x - hx, 0, z - hz, x + hx, 6.2, z + hz, 'nhouse');
  }
  nHouse(-22, 44, Math.PI, 0xc9d8e8, 0x5a4a44);
  nHouse(26, 44, Math.PI, 0xf0d6a8, 0x3f4a5a);
  nHouse(-32, -8, Math.PI / 2, 0xd8e8c9, 0x4a4a52);
  nHouse(33, -8, -Math.PI / 2, 0xe8c9c9, 0x44403a);
  nHouse(-58, 44, Math.PI, 0xe0e0d0, 0x5a3a3a);
  nHouse(60, 44, Math.PI, 0xc8c0e0, 0x3a3a4a);
  // neighbor fences (simple)
  for (const [x1, z1, x2, z2] of [[-40, -20, -40, 14], [40, -20, 40, 14], [-17, -20, -17.1, -12]]) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const f = box(0.08, 1.4, len, std(0xe9e4d8, { roughness: 0.7 }), (x1 + x2) / 2, 0.7, (z1 + z2) / 2, scene);
  }

  // ---------- Stand across the street ----------
  const stand = new THREE.Group(); stand.position.set(4, 0, 33); scene.add(stand);
  const sw = std(0xa87a4a, { map: woodTex });
  box(3.8, 1.05, 0.9, sw, 0, 0.52, -0.3, stand);
  box(4.0, 0.08, 1.1, std(0x7a5230, { map: woodTex }), 0, 1.08, -0.3, stand);
  for (const x of [-1.85, 1.85]) for (const z of [-0.7, 0.8]) box(0.12, 2.8, 0.12, sw, x, 1.4, z, stand);
  const awnTex = canvasTex(256, 64, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#fff6e8' : '#e0412e'; g.fillRect(i * 32, 0, 32, h); } g.fillStyle = '#0002'; g.fillRect(0, h - 6, w, 6); });
  const awn = box(4.3, 0.06, 2.2, std(0xffffff, { map: awnTex }), 0, 2.85, 0.1, stand); awn.rotation.x = -0.18;
  for (let i = 0; i < 8; i++) { const sc2 = mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.04, 12, 1, false, 0, Math.PI), std(i % 2 ? 0xfff6e8 : 0xe0412e, { side: THREE.DoubleSide }), -1.88 + i * 0.54, 2.6, -1.0, stand); sc2.rotation.set(Math.PI / 2, 0, Math.PI / 2); }
  const sign = mesh(new THREE.PlaneGeometry(2.4, 0.6), std(0xffffff, { map: labelTex('ITEMS', { w: 512, h: 128, font: 'bold 96px Trebuchet MS', bg: '#ffd24a', fg: '#7a2a0a', border: '#7a2a0a' }) }), 0, 3.5, -0.95, stand, false);
  sign.rotation.y = Math.PI;
  box(2.5, 0.7, 0.05, sw, 0, 3.5, -0.9, stand);
  const disp = [[makeMilk(), -1.4, 0], [makeGrapes(), -0.85, 0], [makeChocolate(), -0.35, 0], [makeBone(1), 0.2, 0], [makeFishToy(), 0.8, 0], [makeKnuckles(), 1.35, 0]];
  for (const [m, x] of disp) { m.position.set(x, 1.22, -0.4); m.rotation.y = Math.PI; stand.add(m); }
  const bat = makeBat(); bat.position.set(1.95, 0.1, -0.85); bat.rotation.z = 0.25; stand.add(bat);
  // shopkeeper
  const sk = new THREE.Group(); sk.position.set(0, 0, 0.6); stand.add(sk);
  const skin = std(0xd9a07a);
  box(0.5, 0.6, 0.3, std(0x3a7a4a), 0, 1.25, 0, sk);
  box(0.42, 0.5, 0.02, std(0xf4f0e0), 0, 1.2, -0.16, sk);
  ellip(0.17, 0.19, 0.17, skin, 0, 1.75, 0, sk);
  cyl(0.19, 0.19, 0.06, std(0x2a2a2a), 0, 1.9, 0, sk, 16);
  cyl(0.13, 0.15, 0.18, std(0x2a2a2a), 0, 2.0, 0, sk, 16);
  for (const x of [-0.06, 0.06]) ellip(0.02, 0.025, 0.02, std(0x111111), x, 1.78, -0.155, sk, 8);
  ellip(0.08, 0.03, 0.03, std(0x4a3020), 0, 1.68, -0.16, sk, 8);
  for (const x of [-0.12, 0.12]) box(0.16, 0.9, 0.18, std(0x333a4a), x, 0.45, 0, sk);
  for (const x of [-0.33, 0.33]) box(0.13, 0.55, 0.13, std(0x3a7a4a), x, 1.3, 0, sk);
  updaters.push((dt, t) => { sk.rotation.y = Math.sin(t * 0.7) * 0.25; sk.position.y = Math.abs(Math.sin(t * 1.4)) * 0.02; });
  addBox(2.1, 0, 32.2, 5.9, 1.1, 33.6, 'stand');
  const shopPos = new THREE.Vector3(4, 0, 31.6);

  // ---------- Trampoline ----------
  const trampPos = new THREE.Vector3(8, 0, 8.5), TRAMP_R = 1.7, TRAMP_H = 0.75;
  const tg = new THREE.Group(); tg.position.copy(trampPos); scene.add(tg);
  const tMetal = std(0x9aa3ad, { metalness: 0.7, roughness: 0.35 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const l = cyl(0.04, 0.04, TRAMP_H, tMetal, Math.cos(a) * TRAMP_R, TRAMP_H / 2, Math.sin(a) * TRAMP_R, tg, 8); }
  const trampMat = mesh(new THREE.CircleGeometry(TRAMP_R - 0.12, 32), std(0x151518, { roughness: 0.9 }), 0, TRAMP_H, 0, tg);
  trampMat.rotation.x = -Math.PI / 2;
  const pad = mesh(new THREE.TorusGeometry(TRAMP_R, 0.13, 8, 36), std(0x2b7de0, { roughness: 0.5 }), 0, TRAMP_H, 0, tg);
  pad.rotation.x = Math.PI / 2;
  let trampBounce = 0;
  updaters.push((dt) => { trampBounce = Math.max(0, trampBounce - dt * 3); trampMat.position.y = TRAMP_H - Math.sin(trampBounce * 9) * trampBounce * 0.25; });
  const trampoline = { pos: trampPos, r: TRAMP_R - 0.1, h: TRAMP_H, boing() { trampBounce = 1; } };

  // ---------- WELCOME TO MASSACHUSETTS ----------
  const maSign = new THREE.Group(); maSign.position.set(-7.5, 0, 37); scene.add(maSign);
  const maTex = canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#1d3f7a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffffff'; g.lineWidth = 12; g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 64px Trebuchet MS'; g.fillText('WELCOME TO', w / 2, 76);
    g.font = 'bold 118px Trebuchet MS'; g.fillText('MASSACHUSETTS', w / 2, 170);
    g.font = 'bold 26px Trebuchet MS'; g.fillStyle = '#ffd24a'; g.fillText('WICKED SMAHT SINCE 1788', w / 2, 226);
  });
  const signPost = std(0x6e5a44, { map: woodTex });
  for (const x of [-6, 6]) box(0.45, 8.5, 0.45, signPost, x, 4.25, 0.2, maSign);
  box(16.6, 4.6, 0.3, std(0x223a66), 0, 6.6, 0.1, maSign);
  const maBoard = mesh(new THREE.PlaneGeometry(16, 4), std(0xffffff, { map: maTex, roughness: 0.6 }), 0, 6.6, -0.07, maSign, false);
  maBoard.rotation.y = Math.PI;
  const maSubTex = labelTex("We're all stupid jackasses!", { w: 1024, h: 128, font: 'bold 65px Trebuchet MS', bg: '#ffd24a', fg: '#1d3f7a', border: '#ffffff' });
  box(13.2, 1.15, 0.24, std(0x223a66), 0, 3.45, 0.1, maSign);
  const maSubtitle = mesh(new THREE.PlaneGeometry(13, 1), std(0xffffff, { map: maSubTex, roughness: 0.65 }), 0, 3.45, -0.04, maSign, false);
  maSubtitle.rotation.y = Math.PI;
  for (const x of [-13.5, -1.5]) addBox(x - 0.25, 0, 36.95, x + 0.25, 8.5, 37.45, 'sign');
  addBox(-15.8, 4.3, 36.9, 0.8, 8.9, 37.3, 'sign');

  // ---------- Clouds ----------
  const cloudMat = std(0xffffff, { roughness: 1, flatShading: true, emissive: 0xffffff, emissiveIntensity: 0.25, fog: false });
  const clouds = [];
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Group();
    g.position.set(rand(-300, 300), rand(70, 110), rand(-250, 250));
    for (let k = 0; k < 6; k++) { const m = mesh(new THREE.IcosahedronGeometry(rand(6, 11), 1), cloudMat, rand(-14, 14), rand(-2, 3), rand(-6, 6), g, false); m.scale.y = 0.6; }
    scene.add(g); clouds.push(g);
  }
  updaters.push((dt) => { for (const c of clouds) { c.position.x += dt * 1.5; if (c.position.x > 320) c.position.x = -320; } });

  // ---------- Seasons ----------
  const leafOrig = leafMats.map((m) => m.color.getHex());
  const bushOrig = bushMat.map((m) => m.color.getHex());
  const grassMats = grassMeshes.map((m) => m.material);
  const SEASON_LOOK = {
    default: { top: [0.24, 0.52, 0.9], hor: [0.78, 0.88, 0.96], low: [0.62, 0.72, 0.62], fog: [0xc6dcec, 90, 380], hemi: [0xd6ecff, 0x6a8a44, 0.7], sun: [0xfff0d8, 2.6], ground: 0xffffff, grass: 0xffffff, env: 0.35 },
    spring: { top: [0.26, 0.58, 0.96], hor: [0.84, 0.93, 0.98], low: [0.62, 0.78, 0.6], fog: [0xd4e8f4, 90, 380], hemi: [0xe4f4ff, 0x78a050, 0.8], sun: [0xfff6e4, 2.5], ground: 0xffffff, grass: 0xffffff, env: 0.4 },
    summer: { top: [0.36, 0.56, 0.84], hor: [0.98, 0.85, 0.64], low: [0.8, 0.7, 0.5], fog: [0xf0d6a8, 28, 210], hemi: [0xffe8c0, 0x9a8040, 0.85], sun: [0xffcf8a, 3.1], ground: 0xe8d890, grass: 0xe6d27a, env: 0.45 },
    winter: { top: [0.5, 0.62, 0.78], hor: [0.9, 0.93, 0.96], low: [0.86, 0.89, 0.92], fog: [0xdfe7ef, 40, 240], hemi: [0xe8f0ff, 0xb8c4d0, 0.95], sun: [0xe6eeff, 1.9], ground: 0xffffff, grass: 0xffffff, env: 0.5 },
  };
  // falling snow
  const SNOW_N = 1600;
  const snowGeo = new THREE.BufferGeometry();
  const snowPos = new Float32Array(SNOW_N * 3);
  for (let i = 0; i < SNOW_N; i++) { snowPos[i * 3] = rand(-35, 35); snowPos[i * 3 + 1] = rand(0, 22); snowPos[i * 3 + 2] = rand(-35, 35); }
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const flakeTex = canvasTex(32, 32, (g) => { const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, '#fff'); r.addColorStop(1, '#fff0'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); });
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ size: 0.16, map: flakeTex, transparent: true, depthWrite: false, color: 0xffffff }));
  snow.frustumCulled = false; snow.visible = false;
  scene.add(snow);
  let snowCenter = new THREE.Vector3();
  updaters.push((dt, t) => {
    if (!snow.visible) return;
    const a = snowGeo.attributes.position.array;
    for (let i = 0; i < SNOW_N; i++) {
      a[i * 3 + 1] -= dt * (1.2 + (i % 7) * 0.12);
      a[i * 3] += Math.sin(t * 0.7 + i) * dt * 0.3;
      if (a[i * 3 + 1] < 0) a[i * 3 + 1] += 22;
    }
    snowGeo.attributes.position.needsUpdate = true;
    snow.position.set(snowCenter.x, 0, snowCenter.z);
  });

  function setSeason(name, renderer) {
    const L = SEASON_LOOK[name] || SEASON_LOOK.default;
    skyMat.uniforms.uTop.value.setRGB(...L.top, THREE.LinearSRGBColorSpace);
    skyMat.uniforms.uHor.value.setRGB(...L.hor, THREE.LinearSRGBColorSpace);
    skyMat.uniforms.uLow.value.setRGB(...L.low, THREE.LinearSRGBColorSpace);
    scene.fog.color.setHex(L.fog[0]); scene.fog.near = L.fog[1]; scene.fog.far = L.fog[2];
    hemi.color.setHex(L.hemi[0]); hemi.groundColor.setHex(L.hemi[1]); hemi.intensity = L.hemi[2];
    sun.color.setHex(L.sun[0]); sun.intensity = L.sun[1];
    scene.environmentIntensity = L.env;
    if (renderer) renderer.toneMappingExposure = name === 'summer' ? 1.08 : 1.0;
    const winter = name === 'winter';
    groundMat.map = winter ? snowTex : grassTex; groundMat.color.setHex(L.ground); groundMat.needsUpdate = true;
    grassMeshes.forEach((m) => (m.visible = !winter));
    grassMats.forEach((m) => m.color.setHex(L.grass));
    flowers.forEach((m) => (m.visible = !winter));
    leafMats.forEach((m, i) => {
      if (winter) m.color.setHex(i % 2 ? 0xe9eff4 : 0xd6e2ea);
      else if (name === 'spring') m.color.setHex(i % 2 ? 0xf4b6cf : leafOrig[i]);
      else if (name === 'summer') m.color.setHex(new THREE.Color(leafOrig[i]).lerp(new THREE.Color(0x8a8a2a), 0.25).getHex());
      else m.color.setHex(leafOrig[i]);
    });
    bushMat.forEach((m, i) => m.color.setHex(winter ? [0xdfe8ee, 0xeef3f7, 0xcfdbe4][i] : bushOrig[i]));
    waterMat.color.setHex(winter ? 0xdaf0fb : 0x7fd0f0); waterMat.opacity = winter ? 0.97 : 0.8; waterMat.roughness = winter ? 0.25 : 0.05;
    duckFrozen = winter;
    snow.visible = winter;
  }

  return {
    sun, updaters, bowlPos, dogHomePos, shopPos, trashPos, setSeason, windows, trampoline,
    setSnowCenter(v) { snowCenter.copy(v); },
    setFood(v, water = false) { kib.visible = v; bowlWater.visible = v && water; },
    spawn: new THREE.Vector3(2.5, 0, -3),
  };
}
