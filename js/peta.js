import * as THREE from 'three';
import { addBox } from './physics.js';
import { std, mesh, box, cyl, ellip, canvasTex, labelTex } from './models.js';

const rand = (a, b) => a + Math.random() * (b - a);
// Bunker footprint (world): x 19..31, z 1..12, door on the street side (z = 12)
export const BUNKER = { minX: 19, maxX: 40, minZ: 1, maxZ: 12, h: 3.6, doorX: 25.3, doorW: 2.6, doorH: 2.6 };
const tmp = new THREE.Vector3();

function concreteTex(base, rx, ry) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { g.fillStyle = Math.random() < 0.5 ? '#0002' : '#fff1'; const s = rand(1, 4); g.fillRect(Math.random() * w, Math.random() * h, s, s); }
    g.strokeStyle = '#0003'; g.lineWidth = 2;
    for (let y = 0; y < h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  }, rx, ry);
}

export class Peta {
  constructor(scene, hooks) {
    this.scene = scene; this.hooks = hooks;
    this.active = null;
    this.stations = [];
    this.wallMats = [];
    this.build();
  }

  build() {
    const B = BUNKER, s = this.scene;
    const g = (this.root = new THREE.Group()); s.add(g);
    const wallMat = std(0xffffff, { map: concreteTex('#8d8f86', 3, 1.2), roughness: 0.95, transparent: true });
    this.wallMats.push(wallMat);
    const t = 0.4, H = B.h;
    const wall = (x1, z1, x2, z2, y1 = 0, y2 = H) => {
      const w = x2 - x1, d = z2 - z1, h = y2 - y1;
      box(w, h, d, wallMat, (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2, g);
      addBox(x1, y1, z1, x2, y2, z2, 'bunker');
    };
    const dL = B.doorX - B.doorW / 2, dR = B.doorX + B.doorW / 2;
    wall(B.minX, B.minZ, B.maxX, B.minZ + t);
    wall(B.minX, B.minZ, B.minX + t, B.maxZ);
    wall(31 - t, B.minZ, 31, 5.8);
    wall(31 - t, 8.2, 31, B.maxZ);
    wall(31 - t, 5.8, 31, 8.2, B.doorH, H);
    wall(B.maxX - t, B.minZ, B.maxX, B.maxZ);
    wall(31, 6.4, 35, 6.4 + t);
    wall(37.5, 6.4, B.maxX, 6.4 + t);
    wall(35, 6.4, 37.5, 6.4 + t, B.doorH, H);
    wall(B.minX, B.maxZ - t, dL, B.maxZ);
    wall(dR, B.maxZ - t, B.maxX, B.maxZ);
    wall(dL, B.maxZ - t, dR, B.maxZ, B.doorH, H);
    // roof: one-sided so the camera can see in from above/inside
    const roofTex = concreteTex('#6f716a', 3, 3);
    const roof = mesh(new THREE.PlaneGeometry(12, B.maxZ - B.minZ + 0.3), std(0xffffff, { map: roofTex, roughness: 1, transparent: true }), 25, H + 0.02, (B.minZ + B.maxZ) / 2, g, false);
    this.roof = roof;
    this.roofs = [roof];
    roof.rotation.x = -Math.PI / 2;
    const annexRoof = mesh(new THREE.PlaneGeometry(9, 11.3), std(0x777970, { roughness: 1, transparent: true }), 35.5, H + 0.02, 6.5, g, false);
    annexRoof.rotation.x = -Math.PI / 2; this.roofs.push(annexRoof);
    addBox(B.minX, H, B.minZ, B.maxX, H + 0.2, B.maxZ, 'bunker');
    // hazard stripes around the top
    const hz = canvasTex(256, 32, (c, w, h) => { c.fillStyle = '#f2c230'; c.fillRect(0, 0, w, h); c.fillStyle = '#1a1a1a'; for (let x = -32; x < w; x += 32) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + 16, 0); c.lineTo(x + 32, 0); c.lineTo(x + 16, h); c.fill(); } }, 8, 1);
    const hzMat = std(0xffffff, { map: hz, transparent: true });
    this.wallMats.push(hzMat);
    box(B.maxX - B.minX + 0.1, 0.3, 0.05, hzMat, (B.minX + B.maxX) / 2, H - 0.2, B.maxZ + 0.03, g, false);
    // sandbags
    const bag = std(0xb09a6a, { roughness: 1 });
    for (let i = 0; i < 9; i++) for (let r = 0; r < 2; r++) {
      const x = B.minX + 0.5 + i * 0.6 + (r ? 0.3 : 0);
      if (x > dL - 0.3) continue;
      ellip(0.3, 0.14, 0.2, bag, x, 0.14 + r * 0.24, B.maxZ + 0.35, g, 8);
    }
    // big PETA sign on the roof
    const petaTex = canvasTex(1024, 320, (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1b7a3a'; c.fillRect(0, 0, w, 26); c.fillRect(0, h - 26, w, 26);
      c.fillStyle = '#1b7a3a'; c.font = 'bold 250px Arial Black, Trebuchet MS'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('PETA', w / 2, h / 2 + 10);
    });
    const sg = new THREE.Group(); sg.position.set(B.doorX - 0.3, H, B.maxZ - 0.6); g.add(sg);
    for (const x of [-3, 3]) box(0.2, 2.2, 0.2, std(0x333333, { metalness: 0.5 }), x, 1.1, 0, sg);
    box(8.2, 2.7, 0.15, std(0xeeeeee), 0, 2.2, -0.05, sg);
    mesh(new THREE.PlaneGeometry(8, 2.5), std(0xffffff, { map: petaTex, roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.12, emissiveMap: petaTex }), 0, 2.2, 0.04, sg, false);
    // poster by the door
    const posterTex = canvasTex(512, 384, (c, w, h) => {
      c.fillStyle = '#fff8e8'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#1b7a3a'; c.lineWidth = 14; c.strokeRect(7, 7, w - 14, h - 14);
      c.fillStyle = '#1b7a3a'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = 'bold 64px Trebuchet MS'; c.fillText('100% ETHICAL.', w / 2, 80);
      c.fillStyle = '#c0141c'; c.font = 'bold 50px Trebuchet MS'; c.fillText('Fuck EVERYONE', w / 2, 175); c.fillText('who owns a pet!', w / 2, 235);
      c.fillStyle = '#555'; c.font = 'italic 24px Trebuchet MS'; c.fillText('- PETA, probably', w / 2, 320);
    });
    mesh(new THREE.PlaneGeometry(2.4, 1.8), std(0xffffff, { map: posterTex, roughness: 0.8 }), 21.8, 1.7, B.maxZ + 0.02, g, false);
    // interior floor + lights
    const floor = mesh(new THREE.PlaneGeometry(B.maxX - B.minX - 0.8, B.maxZ - B.minZ - 0.8), std(0x55574f, { map: concreteTex('#55574f', 3, 3), roughness: 1 }), (B.minX + B.maxX) / 2, 0.012, (B.minZ + B.maxZ) / 2, g, false);
    floor.rotation.x = -Math.PI / 2;
    this.redLight = new THREE.PointLight(0xff3020, 6, 14, 1.6);
    this.redLight.position.set((B.minX + B.maxX) / 2, H - 0.4, (B.minZ + B.maxZ) / 2);
    g.add(this.redLight);
    ellip(0.15, 0.15, 0.15, std(0xff4030, { emissive: 0xff2010, emissiveIntensity: 2 }), this.redLight.position.x, H - 0.2, this.redLight.position.z, g, 10);
    this.buildStations(g);
    this.buildAnnex(g);
  }

  buildAnnex(g) {
    const metal = std(0x9098a0, { metalness: 0.75 });
    const dark = std(0x22272c, { metalness: 0.45 });
    const label = (text, x, z) => {
      const m = mesh(new THREE.PlaneGeometry(3.7, 0.55),
        std(0xffffff, { map: labelTex(text, { w: 640, h: 110, bg: '#1a1a1a', fg: '#ffd24a', border: '#ffd24a', font: 'bold 48px Trebuchet MS' }) }),
        x, 2.9, z, g, false);
      return m;
    };
    // Two connected rooms: animated conveyor stations, no character geometry is cut.
    for (const [id, name, z, color] of [['shredder', 'Shredder Room', 3.6, 0xfda444], ['grinder', 'Burger Grinder', 9.1, 0xe5b650]]) {
      const x = 35.4;
      box(3, 0.65, 1.8, dark, x, 0.5, z, g);
      for (const sx of [-1.25, 1.25]) {
        const roller = cyl(0.26, 0.26, 1.9, metal, x + sx, 0.92, z, g, 16);
        roller.rotation.x = Math.PI / 2;
      }
      const lamp = ellip(0.17, 0.17, 0.17, std(color, { emissive: color, emissiveIntensity: 0.8 }), x, 2.1, z, g, 12);
      const belt = box(2.4, 0.12, 1.3, std(0x454545), x, 0.9, z, g);
      label(name.toUpperCase(), x, z + 1.1);
      this.station({ id, name, kind: id === 'grinder' ? 'Grinder' : 'Shredder',
        pos: new THREE.Vector3(x, 1.25, z),
        drop: new THREE.Vector3(38.3, 0, z),
        dur: 2.6,
        tick: (st, k, actor, dt) => {
          belt.position.x = x + Math.sin(k * 18) * 0.06;
          lamp.scale.setScalar(1 + Math.sin(k * 40) * 0.25);
          if (k > 0.25 && k < 0.85 && Math.random() < 0.35) this.hooks.sparks(tmp.set(x + rand(-1, 1), 1.1, z + rand(-0.6, 0.6)), color);
          if (k > 0.55 && k < 0.9) actor.root.visible = false;
          if (k > 0.85) actor.root.visible = true;
          if (k > 0.3 && Math.random() < 0.08) this.hooks.sound('saw', 0.4);
        } });
    }
  }

  station(def) { this.stations.push({ t: 0, ...def }); }

  buildStations(g) {
    const metal = std(0x7f878f, { metalness: 0.8, roughness: 0.3 });
    const dark = std(0x2a2c30, { metalness: 0.5, roughness: 0.5 });
    const label = (text, x, z, ry = 0) => {
      const m = mesh(new THREE.PlaneGeometry(1.4, 0.3), std(0xffffff, { map: labelTex(text, { w: 512, h: 110, bg: '#1a1a1a', fg: '#ffd24a', border: '#ffd24a', font: 'bold 54px Trebuchet MS' }) }), x, 2.35, z, g, false);
      m.rotation.y = ry;
    };
    // 1. Buzzsaw
    {
      const x = 21.3, z = 3.1;
      box(1.8, 0.9, 1.0, dark, x, 0.45, z, g); addBox(x - 0.9, 0, z - 0.5, x + 0.9, 0.9, z + 0.5, 'bunker');
      const saw = new THREE.Group(); saw.position.set(x + 0.4, 0.9, z); g.add(saw);
      const blade = cyl(0.55, 0.55, 0.03, std(0xd8dde2, { metalness: 1, roughness: 0.2 }), 0, 0, 0, saw, 24);
      blade.rotation.x = Math.PI / 2;
      for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; const tth = mesh(new THREE.ConeGeometry(0.05, 0.1, 3), metal, Math.cos(a) * 0.58, Math.sin(a) * 0.58, 0, saw); tth.rotation.z = a - Math.PI / 2; }
      label('BUZZSAW', x, 1.45 + 0.1, 0);
      this.station({ id: 'saw', name: 'Buzzsaw', kind: 'Buzzsaw', pos: new THREE.Vector3(x - 0.5, 1.25, z), drop: new THREE.Vector3(x, 0, z + 1.3), dur: 2.6, obj: saw,
        tick: (st, k, dog, dt) => {
          saw.rotation.z -= dt * (k > 0 ? 40 : 0);
          dog.pos.x = x - 0.5 + Math.min(1, k * 1.4) * 0.75;
          if (k > 0.45) { this.hooks.sparks(tmp.set(x + 0.2, 1.3, z + rand(-0.2, 0.2)), 0xffd24a); this.hooks.sound('saw', 0.5); dog.squash = 0.6; }
        } });
    }
    // 2. Lethal injection
    {
      const x = 24.8, z = 2.6;
      box(2.0, 0.08, 0.8, std(0xe8e8e8), x, 0.85, z, g);
      for (const sx of [-0.9, 0.9]) box(0.06, 0.85, 0.7, metal, x + sx, 0.42, z, g);
      addBox(x - 1, 0, z - 0.4, x + 1, 0.9, z + 0.4, 'bunker');
      cyl(0.025, 0.025, 2.2, metal, x + 1.2, 1.1, z - 0.3, g);
      box(0.2, 0.3, 0.06, std(0x9fd0ff, { transparent: true, opacity: 0.7 }), x + 1.2, 2.0, z - 0.3, g);
      const syr = new THREE.Group(); syr.position.set(x, 2.4, z); g.add(syr);
      cyl(0.12, 0.12, 0.8, std(0xdff2ff, { transparent: true, opacity: 0.6, roughness: 0.1 }), 0, 0.4, 0, syr, 16);
      const juice = cyl(0.1, 0.1, 0.7, std(0x6aff3a, { emissive: 0x3aff10, emissiveIntensity: 0.6 }), 0, 0.4, 0, syr, 12);
      cyl(0.012, 0.004, 0.5, metal, 0, -0.25, 0, syr, 6);
      const plunger = cyl(0.03, 0.03, 0.5, metal, 0, 1.0, 0, syr, 6);
      label('LETHAL INJECTION', x, z + 0.5 + 0.02, 0);
      this.station({ id: 'inject', name: 'Lethal Injection', kind: 'Injection', pos: new THREE.Vector3(x, 1.2, z), drop: new THREE.Vector3(x, 0, z + 1.3), dur: 2.8,
        tick: (st, k, dog) => {
          syr.position.y = 2.4 - Math.min(1, k * 2) * 0.75;
          const p = Math.max(0, (k - 0.5) * 2);
          juice.scale.y = Math.max(0.02, 1 - p); juice.position.y = 0.05 + 0.35 * (1 - p);
          plunger.position.y = 1.0 - p * 0.6;
          if (k > 0.5) { dog.tint = 'green'; dog.squash = Math.sin(k * 60) * 0.3 + 0.3; }
          if (k >= 1) syr.position.y = 2.4;
        } });
    }
    // 3. Radiation chamber
    {
      const x = 28.4, z = 2.9;
      cyl(0.9, 0.9, 0.15, dark, x, 0.075, z, g, 24);
      cyl(0.9, 0.9, 0.15, dark, x, 2.4, z, g, 24);
      const glassMat = std(0x9aff9a, { transparent: true, opacity: 0.25, roughness: 0.05, emissive: 0x20ff20, emissiveIntensity: 0.05 });
      cyl(0.85, 0.85, 2.2, glassMat, x, 1.25, z, g, 24).castShadow = false;
      addBox(x - 0.9, 0, z - 0.9, x - 0.7, 2.5, z + 0.9, 'bunker'); addBox(x + 0.7, 0, z - 0.9, x + 0.9, 2.5, z + 0.9, 'bunker'); addBox(x - 0.9, 0, z - 0.9, x + 0.9, 2.5, z - 0.7, 'bunker');
      const tre = canvasTex(128, 128, (c) => { c.fillStyle = '#f2d020'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#111'; c.beginPath(); c.arc(64, 64, 12, 0, 7); c.fill(); for (let i = 0; i < 3; i++) { const a = i * 2.094 - 1.57; c.beginPath(); c.moveTo(64, 64); c.arc(64, 64, 52, a - 0.52, a + 0.52); c.closePath(); c.fill(); } c.fillStyle = '#f2d020'; c.beginPath(); c.arc(64, 64, 20, 0, 7); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(64, 64, 11, 0, 7); c.fill(); });
      mesh(new THREE.PlaneGeometry(0.8, 0.8), std(0xffffff, { map: tre }), x, 2.9, z, g, false);
      const glow = new THREE.PointLight(0x40ff40, 0, 6, 1.5); glow.position.set(x, 1.3, z); g.add(glow);
      label('RADIATION', x, z + 0.95, 0);
      this.station({ id: 'rad', name: 'Radiation Chamber', kind: 'Radiation', pos: new THREE.Vector3(x, 0.6, z), drop: new THREE.Vector3(x, 0, z + 1.6), dur: 3,
        tick: (st, k, dog) => {
          glow.intensity = k > 0 && k < 1 ? 5 + Math.sin(k * 80) * 3 : 0;
          glassMat.emissiveIntensity = k > 0 && k < 1 ? 0.6 : 0.05;
          dog.tint = 'rad'; dog.swell = 1 + k * 0.6;
          if (Math.random() < 0.3) this.hooks.sparks(tmp.set(x + rand(-0.5, 0.5), rand(0.3, 2), z + rand(-0.5, 0.5)), 0x60ff40);
          if (k >= 1) { glow.intensity = 0; glassMat.emissiveIntensity = 0.05; }
        } });
    }
    // 4. Spike pit
    {
      const x = 29.2, z = 7;
      const pit = mesh(new THREE.PlaneGeometry(2, 2), std(0x0a0a0a, { roughness: 1 }), x, 0.02, z, g, false); pit.rotation.x = -Math.PI / 2;
      for (const [ox, oz, w, d] of [[0, -1.05, 2.2, 0.1], [0, 1.05, 2.2, 0.1], [-1.05, 0, 0.1, 2.2], [1.05, 0, 0.1, 2.2]]) box(w, 0.25, d, std(0xf2c230), x + ox, 0.12, z + oz, g);
      const spikeMat = std(0xcfd4d8, { metalness: 0.9, roughness: 0.25 });
      for (let i = 0; i < 16; i++) mesh(new THREE.ConeGeometry(0.07, 0.7, 6), spikeMat, x - 0.75 + (i % 4) * 0.5, 0.35, z - 0.75 + ((i / 4) | 0) * 0.5, g);
      label('SPIKE PIT', x - 1.25, z, Math.PI / 2);
      this.station({ id: 'spike', name: 'Spike Pit', kind: 'Impaled', pos: new THREE.Vector3(x, 2.4, z), drop: new THREE.Vector3(x - 1.8, 0, z), dur: 2.2,
        tick: (st, k, dog) => {
          if (k < 0.5) dog.pos.y = 2.4 + Math.sin(k * 30) * 0.05;
          else dog.pos.y = Math.max(0.55, 2.4 - (k - 0.5) * 2 * 2.4 * 2.2);
          if (k > 0.72 && !st.hitFx) { st.hitFx = true; this.hooks.sound('slam', 1); this.hooks.pop(dog.pos, 'IMPALED!', '#ff5040', 40); dog.squash = 1; }
        } });
    }
    // 5. Hydraulic press
    {
      const x = 29, z = 10.2;
      box(1.6, 0.5, 1.2, dark, x, 0.25, z, g);
      for (const sx of [-0.7, 0.7]) box(0.16, 3.2, 0.16, metal, x + sx, 1.6, z, g);
      box(1.7, 0.3, 1.3, dark, x, 3.3, z, g);
      const plate = box(1.3, 0.35, 1.0, std(0xb82c20, { metalness: 0.4, roughness: 0.5 }), x, 2.8, z, g);
      addBox(x - 0.8, 0, z - 0.6, x + 0.8, 0.5, z + 0.6, 'bunker');
      label('HYDRAULIC PRESS', x - 1.1, z, Math.PI / 2);
      this.station({ id: 'press', name: 'Hydraulic Press', kind: 'Press', pos: new THREE.Vector3(x, 0.85, z), drop: new THREE.Vector3(x - 1.8, 0, z), dur: 2.8,
        tick: (st, k, dog) => {
          const y = k < 0.7 ? 2.8 - k / 0.7 * 1.2 : k < 0.78 ? 1.6 - (k - 0.7) / 0.08 * 0.85 : 0.75;
          plate.position.y = k >= 1 ? 2.8 : y;
          if (k > 0.78) { dog.flat = 1; if (!st.hitFx) { st.hitFx = true; this.hooks.sound('slam', 1); this.hooks.pop(dog.pos, 'CRUNCH', '#ffffff', 40); } }
        } });
    }
    // 6. Electric chair
    {
      const x = 20.6, z = 7;
      const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = Math.PI / 2; g.add(c);
      const wood = std(0x5a3a22, { roughness: 0.8 });
      box(0.9, 0.12, 0.9, wood, 0, 0.7, 0, c); box(0.9, 1.4, 0.12, wood, 0, 1.4, -0.42, c);
      for (const sx of [-0.4, 0.4]) for (const sz of [-0.4, 0.4]) box(0.1, 0.7, 0.1, wood, sx, 0.35, sz, c);
      for (const sx of [-0.45, 0.45]) box(0.1, 0.1, 0.9, wood, sx, 1.0, 0, c);
      const helm = cyl(0.25, 0.3, 0.2, metal, 0, 2.15, -0.1, c, 14);
      const cable = cyl(0.03, 0.03, 1.2, std(0x111111), 0, 2.6, -0.4, c, 6); cable.rotation.x = 0.5;
      addBox(x - 0.5, 0, z - 0.5, x + 0.5, 0.75, z + 0.5, 'bunker');
      label('ELECTRIC CHAIR', x + 0.2, z - 0.9, Math.PI / 2);
      this.station({ id: 'zap', name: 'Electric Chair', kind: 'Electrocuted', pos: new THREE.Vector3(x, 1.2, z), drop: new THREE.Vector3(x + 1.6, 0, z), dur: 2.8,
        tick: (st, k, dog) => {
          if (k > 0.25 && k < 1) {
            dog.pos.x = x + rand(-0.06, 0.06); dog.pos.y = 1.2 + rand(-0.05, 0.08);
            dog.tint = Math.random() < 0.5 ? 'zap' : 'dark'; dog.squash = Math.random();
            if (Math.random() < 0.5) this.hooks.sparks(tmp.set(x + rand(-0.4, 0.4), rand(1, 2.3), z + rand(-0.4, 0.4)), 0x9fdcff);
            this.hooks.sound('zap', 0.6);
            if (Math.random() < 0.06) this.hooks.flash(0.25);
          }
          if (k >= 1) dog.tint = 'dark';
        } });
    }
    // 7. Anvil drop
    {
      const x = 21.3, z = 10.4;
      const xm = canvasTex(128, 128, (c) => { c.clearRect(0, 0, 128, 128); c.strokeStyle = '#e8281c'; c.lineWidth = 16; c.beginPath(); c.moveTo(16, 16); c.lineTo(112, 112); c.moveTo(112, 16); c.lineTo(16, 112); c.stroke(); });
      const xp = mesh(new THREE.PlaneGeometry(1.2, 1.2), std(0xffffff, { map: xm, transparent: true }), x, 0.02, z, g, false); xp.rotation.x = -Math.PI / 2;
      const anvil = new THREE.Group(); anvil.position.set(x, 3.2, z); g.add(anvil);
      const am = std(0x2a2a2e, { metalness: 0.7, roughness: 0.4 });
      box(0.9, 0.2, 0.45, am, 0, 0, 0, anvil); box(0.4, 0.3, 0.3, am, 0, -0.22, 0, anvil); box(0.7, 0.14, 0.45, am, 0, -0.42, 0, anvil);
      const hornM = mesh(new THREE.ConeGeometry(0.12, 0.4, 8), am, -0.6, 0, 0, anvil); hornM.rotation.z = Math.PI / 2;
      cyl(0.01, 0.01, 0.4, std(0x999999), 0, 0.3, 0, anvil, 4);
      label('ANVIL', x + 0.9, z, -Math.PI / 2);
      this.station({ id: 'anvil', name: 'Anvil Drop', kind: 'Anvil', pos: new THREE.Vector3(x, 0.6, z), drop: new THREE.Vector3(x + 1.6, 0, z), dur: 2.2,
        tick: (st, k, dog) => {
          const y = k < 0.55 ? 3.2 : Math.max(0.55, 3.2 - (k - 0.55) / 0.12 * 2.65);
          anvil.position.y = k >= 1 ? 3.2 : y;
          if (y <= 0.56) { dog.flat = 1; if (!st.hitFx) { st.hitFx = true; this.hooks.sound('slam', 1); this.hooks.pop(dog.pos, 'CLANG', '#ffffff', 40); } }
        } });
    }
  }

  inside(p) { const B = BUNKER; return p.x > B.minX && p.x < B.maxX && p.z > B.minZ && p.z < B.maxZ && p.y < B.h; }
  near(p, m = 9) { const B = BUNKER; return p.x > B.minX - m && p.x < B.maxX + m && p.z > B.minZ - m && p.z < B.maxZ + m; }

  nearest(p, range = 1.9) {
    let best = null, bd = range;
    for (const st of this.stations) { const d = Math.hypot(st.pos.x - p.x, st.pos.z - p.z); if (d < bd) { bd = d; best = st; } }
    return best;
  }

  run(st, actor) {
    if (this.active) return false;
    this.active = { st, actor, t: 0 };
    st.hitFx = false;
    actor.locked = true;
    if ('state' in actor) { actor.state = 'station'; actor.grabbed = false; actor.flight = null; actor.vel.set(0, 0, 0); actor.center.copy(st.pos); }
    actor.pos.copy(st.pos);
    this.hooks.pop(actor.pos, st.name.toUpperCase(), '#7eff7a', 30);
    return true;
  }

  update(dt, playerPos, dog) {
    // fade walls when the player is inside, so the camera can see
    const inside = this.inside(playerPos) || !!this.active;
    for (const m of this.wallMats) { m.opacity += ((inside ? 0.18 : 1) - m.opacity) * Math.min(1, dt * 6); m.depthWrite = m.opacity > 0.9; }
    for (const roof of this.roofs) {
      roof.material.opacity += ((inside ? 0.06 : 1) - roof.material.opacity) * Math.min(1, dt * 6);
      roof.material.depthWrite = roof.material.opacity > 0.9;
    }
    this.redLight.intensity = 5 + Math.sin(performance.now() * 0.006) * 2.5;
    const a = this.active;
    if (!a) return;
    a.t += dt;
    const k = Math.min(1, a.t / a.st.dur);
    a.st.tick(a.st, k, a.actor, dt);
    if (k >= 1) {
      this.active = null;
      a.actor.locked = false;
      a.actor.root.visible = true;
      this.hooks.done(a.st, a.actor);
    }
  }
}
