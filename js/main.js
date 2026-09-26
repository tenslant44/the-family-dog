import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { G, collideSphere, colliders } from './physics.js';
import { buildWorld, insideYard, YARD } from './world.js';
import { Dog } from './dog.js';
import { Player } from './player.js';
import { John } from './john.js';
import { FX } from './fx.js';
import { initAudio, play } from './audio.js';
import { Snow } from './snow.js';
import { Bugs } from './bugs.js';
import { Traffic } from './cars.js';
import { createProgress } from './progress.js';
import { rateFinish } from './finishes.js';
import { Peta } from './peta.js';
import { People } from './people.js';
import { EBikes } from './ebikes.js';
import { Throwables, makeBomb, makeMine, makeYogurt, makeBurger } from './throwables.js';
import { std, ellip, makeBall, makeShoe, makeFist, makeHeart, makeGlue, makeKibbleBag, makeBat, makeKnife, makePistol, makeMilk, makeKnuckles, makeBone, makeFishToy, makeGrapes, makeChocolate, makeChainLinks, makeLips, makeSnowball } from './models.js';

const rand = (a, b) => a + Math.random() * (b - a);
const $ = (id) => document.getElementById(id);
const touchMode = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && innerWidth <= 900);
if (touchMode) document.body.classList.add('touch-device');

// ---------- Renderer / scene ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 1500);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const world = buildWorld(scene);
const fx = new FX(scene, camera);
const player = new Player(scene, world.spawn);

// ---------- Save ----------
const save = Object.assign({ coins: 0, best: 0, bestH: 0, bestTraffic: 0, season: 'default', inv: {}, selectedTool: 'kick', pistolAmmo: 8, infiniteHealth: false, trafficEnabled: true, infiniteLove: false }, JSON.parse(localStorage.getItem('familydog-save') || '{}'));
const persist = () => localStorage.setItem('familydog-save', JSON.stringify(save));
const progress = createProgress({ save, persist, play });
player.infiniteHealth = save.infiniteHealth === true;

// ---------- UI helpers ----------
let toastTimer = 0;
function toast(text, dur = 3) { const t = $('toast'); t.textContent = text; t.classList.add('on'); toastTimer = dur; }
let resultTimer = 0;
function showResult(kind, value, grade, coins, extra, comboNames = '') {
  const r = $('result');
  r.innerHTML = `<div class="k">${kind}</div><div class="d">${value}</div><div class="g">${grade}</div>${comboNames ? `<div class="combo">${comboNames}</div>` : ''}<div class="c">+${coins} coins</div>${extra ? `<div class="x">${extra}</div>` : ''}`;
  r.classList.add('on');
  resultTimer = 3.2;
}

// ---------- Ball ----------
const ball = { mesh: makeBall(), pos: new THREE.Vector3(), vel: new THREE.Vector3(), state: 'player', freeT: 0 };
ball.mesh.visible = false;
scene.add(ball.mesh);

// ---------- Dog ----------
const hooks = {
  slam(d, impact, normal, collider) {
    if (d.launchInfo) d.launchInfo.slams++;
    if (collider && collider.tag === 'snow' && impact > 11) {
      if (d.launchInfo) d.launchInfo.smashed++;
      snow.smashCollider(collider); fx.pop(d.pos, 'SMASH', '#e8f4ff', 30);
    }
    play('slam', Math.min(1, impact / 22 + 0.3));
    d.damage(Math.min(22, impact * 0.65), 'Collision');
    shake = Math.max(shake, Math.min(0.5, impact * 0.018));
    if (impact > 9) fx.pop(d.pos, 'SLAM!', '#ffffff', 34);
    fx.puff(d.pos, { color: 0xd8c8a8, n: 6, size: 0.25, spread: 1.5 });
  },
  thud(d, imp) {
    if (d.fatalFall) { fatalDogFall(d); return; }
    d.damage(Math.min(18, imp * 0.45), 'Collision');
    play('kick', Math.min(0.7, imp / 25), 0.8);
    fx.puff(d.pos.clone().setY(0.1), { color: 0x9a8a62, n: 5, size: 0.22, spread: 1.4, up: 0.6 });
  },
  land(d) { if (d.fatalFall) fatalDogFall(d); onDogLand(d); },
  defeated(d) {
    if (d.grabbed) { d.grabbed = false; player.carrying = false; }
    if (chained) setChain(false);
    fx.burst(d.pos, 1.5);
    fx.pop(d.pos, 'DEFEATED!', '#ffe477', 40);
    play('slam', 0.7);
    if (!d.air) awardFinish(d, d.launchInfo);
  },
  respawn(d) {
    awardFinish(d, d.launchInfo);
    fx.puff(d.pos.clone(), { n: 10, size: 0.5 });
    d.respawn();
    fx.puff(d.pos.clone(), { n: 12, size: 0.45 });
    fx.pop(d.pos, 'BACK AGAIN!', '#fff', 23);
    play('poof', 0.7);
  },
  comboHit(d) { fx.pop(d.pos, `${d.launchInfo.hits} HIT COMBO!`, '#ffdf66', 30); },
  bugSnap() { progress.stat('bugSnaps'); },
  becameAngry(d) { play('growl', 0.9); fx.pop(d.pos, '!!', '#ff4a3a', 40); },
  pop(d, text, color) { fx.pop(d.pos, text, color); },
  sound(n, v) { play(n, v); },
  fart(d) {
    play('fart', 0.7);
    const back = new THREE.Vector3(0, 0, -0.7).applyQuaternion(d.q).add(d.pos);
    fx.puff(back, { color: 0x9ac23a, n: 7, size: 0.3, spread: 0.8, up: 0.5, life: 1.6, opacity: 0.6 });
  },
  poop(d) {
    progress.stat('poops');
    const back = new THREE.Vector3(0, 0, -0.75).applyQuaternion(d.q).add(d.pos);
    throwables.addPoop(back);
    const lines = [
      'The Family Dog pooped. It will not be eating that.',
      'Another one. Nobody is cleaning that up.',
      'Somewhere, Obese Sonic\'s stomach growls.',
      'It pooped again. This is why we hate the dog.',
    ];
    toast(lines[(Math.random() * lines.length) | 0], 3.5);
  },
  dropBall(d) {
    d.mouthWorld(ball.pos); ball.vel.set(0, 1, 0); ball.state = 'free'; ball.freeT = 0;
  },
  returnBall() { ball.state = 'player'; refreshHeld(); fx.pop(player.pos.clone().setY(1), 'got the ball', '#d8ef3a', 18); },
};
const dog = new Dog(scene, world, hooks);
dog.infiniteHealth = save.infiniteHealth === true;
dog.infiniteLove = save.infiniteLove === true;

const john = new John(scene, {
  pop: (p, t, c) => fx.pop(p, t, c),
  sound: (n, v) => play(n, v),
  johnKO: () => { progress.unlock('fishdown'); toast('John the Fish has been knocked out. He will be fine.'); play('bark', 0.9); },
  johnLeaves: () => { toast('John the Fish wins by decision and goes home.'); },
  poof: (p) => { fx.puff(p.clone().setY(0.8), { n: 10, size: 0.4 }); play('poof', 0.7); },
});

const peta = new Peta(scene, {
  sparks: (p, color) => fx.puff(p.clone(), { color, n: 3, size: 0.09, spread: 0.5, life: 0.25 }),
  sound: (name, vol) => play(name, vol, 1, name === 'saw' || name === 'zap' ? 0.7 : 0.06),
  pop: (p, text, color, size) => fx.pop(p, text, color, size),
  flash: (v) => fx.flash(v),
  done(st, d) {
    if ('state' in d) {
      d.root.visible = true;
      d.pos.copy(st.drop); d.center.copy(st.drop).setY(0.28);
      d.vel.set(0, 0, 0); d.state = 'down'; d.stateT = 3;
      d.hp = Math.max(d.hp, 20);
      fx.burst(d.center, 1);
      fx.pop(d.center, 'CARTOON RECOVERY!', '#ffe477', 26);
      progress.unlock('petaCivilian');
      if (progress.stat('petaCivilians') >= 5) progress.unlock('petaCivilian5');
      if (d.kind === 'mother') progress.unlock('petaMother');
    } else {
      d.pos.copy(st.drop); d.vel.set(0, 0, 0); d.air = false;
      d.swell = 1; d.flat = 0;
      fx.burst(d.pos.clone().setY(0.9), 1.5);
      fx.pop(d.pos, st.name.toUpperCase(), '#ffd84a', 34);
      d.damage(999, st.kind);
      awardFinish(d, null);
      progress.unlock('petaDog');
      if (progress.stat('petaDogs') >= 10) progress.unlock('petaDog10');
    }
    if (st.id === 'shredder') progress.unlock('petaShredder');
    progress.unlock(`petaStation_${st.id}`);
    if (st.id === 'grinder') {
      progress.unlock('petaGrinder');
      if (progress.stat('petaBurgerOutputs') >= 5) progress.unlock('petaBurger5');
      const burgerProp = makeBurger();
      burgerProp.position.copy(st.drop).setY(0.3);
      burgerProp.scale.setScalar(2.3);
      scene.add(burgerProp);
      schedule(8, () => scene.remove(burgerProp));
      save.inv.burger = (save.inv.burger || 0) + 1;
      toast('A cartoon hamburger popped out. Burger added to your hotbar.', 3.5);
      rebuildHotbar();
      progress.unlock('petaBurger');
    }
    save.petaStations = save.petaStations || {};
    save.petaStations[st.id] = true;
    persist();
    if (Object.keys(save.petaStations).length >= peta.stations.length) progress.unlock('allPetaStations');
    if (save.stats.petaCivilians && save.stats.petaDogs) progress.unlock('petaBoth');
    people.witness(d.pos, 'dog');
  },
});
const people = new People(scene, {
  bubble: (p, text, life) => fx.bubble(p, text, life),
  sound: (name, vol) => play(name, vol),
  poof: (p) => { fx.puff(p.clone().setY(0.7), { n: 8, size: 0.35 }); play('poof', 0.4); },
  slam: (p, imp) => { fx.burst(p.center, 0.8); play('slam', Math.min(1, imp / 25)); },
  thud: (p, imp) => { fx.puff(p.center, { n: 5, size: 0.24 }); play('kick', Math.min(0.8, imp / 20)); },
  fatal: (p) => { fx.pop(p.center, 'FALL DAMAGE!', '#ffdc77', 31); fx.burst(p.center, 1.3); },
  ko: (p) => { fx.pop(p.center, 'K.O.!', '#ffd84a', 30); progress.civilianKo(); },
  petDog: (p) => {
    dog.happy = 1.5; dog.mood = Math.min(100, dog.mood + 2);
    fx.pop(dog.pos, '♥', '#ff80a0', 22);
    if (progress.stat('civilianPetDogs') >= 5) progress.unlock('civilianPetDog5');
  },
  hit: (p, kind) => progress.civilianHit(p, kind),
  chat: (p) => progress.civilianChat(p),
  witness: (p, state) => progress.civilianWitness(p, state),
  shove: () => progress.unlock('civilianShoved'),
  landed(p, flight) {
    const found = progress.findCivilianCombos(flight, p);
    if (!found.length) return;
    const coins = found.reduce((sum, c) => sum + c.bonus, 0);
    progress.addCoins(coins);
    fx.pop(p.center, `+${coins} COINS`, '#ffe477', 27);
    showResult('CIVILIAN COMBO', `${found.length} FOUND`, '★', coins, found.map(c => c.name).join(' + '));
    play('coins', 0.7);
  },
});
const ebikes = new EBikes(scene, {
  bubble: (rider, text, life) => fx.bubble(rider, text, life),
  riderHit(rider, cause) {
    fx.pop(rider.center, cause === 'rider' ? 'RIDER COLLISION!' : 'E-BIKE TUMBLE!', '#ffd84a', 27);
    play('boing', 0.65);
  },
  dismount(rider, cause) {
    fx.burst(rider.pos.clone().setY(0.9), 0.9);
    fx.pop(rider.pos.clone().setY(1.3), 'BIKE WIPEOUT!', '#ffd84a', 29);
    play('boing', 0.65);
    if (progress.stat('bikeKnockoffs') >= 10) progress.unlock('bikeKnock10');
    progress.unlock(cause === 'dog' ? 'bikeDog' : 'bikeYank');
  },
  mount(rider) {
    fx.pop(rider.pos.clone().setY(1), 'BIKE STOLEN!', '#ffd84a', 29);
    progress.unlock('bikeThief');
    save.bikesStolen = save.bikesStolen || {};
    save.bikesStolen[rider.index] = true;
    persist();
    if (Object.keys(save.bikesStolen).length >= 2) progress.unlock('bikeCollector');
    toast('Bike stolen. Ride with WASD; F to park.', 3);
  },
  distance(total, at) {
    if (total >= 100) progress.unlock('bikeCentury');
    if (total >= 500) progress.unlock('bikeMarathon');
    if (at.z > 17 && at.z < 27) progress.unlock('bikeRoad');
  },
});
const throwables = new Throwables(scene, {
  poopHit(q, at) {
    const dogFace = dog.head.getWorldPosition(new THREE.Vector3());
    if (!dog.dead && !dog.grabbed && !dog.inside && !dog.locked &&
        (at.distanceTo(dog.pos) < 0.7 || at.distanceTo(dogFace) < 0.42)) {
      const face = at.distanceTo(dogFace) < 0.46;
      if (face) {
        dog.blind = Math.max(dog.blind, q.soft ? 9 : 5);
        dog.blindHard = !q.soft;
        progress.unlock(q.soft ? 'softDogBlind' : 'hardDogBlind');
      }
      dog.mood = Math.min(dog.mood, -15);
      dog.squash = 0.6;
      if (!q.soft) {
        dog.damage(13, 'Poop');
        dog.launch(q.vel.clone().multiplyScalar(0.45).setY(5), 'Poop');
      }
      fx.pop(dog.pos, face ? 'BLINDED!' : 'SPLAT!', q.soft ? '#a8d060' : '#d5a065', 32);
      fx.bubble(dog, face ? 'I CAN\'T SEE!' : 'UGH!', 2.5);
      fx.puff(at, { color: 0x754421, n: 8, size: 0.16 });
      play('splat', 0.8);
      people.witness(at, 'dog');
      return true;
    }
    for (const p of people.list) {
      if (!p.hittable || at.distanceTo(p.center.clone().add(new THREE.Vector3(0, 0.6, 0))) > 0.42) continue;
      p.blind(q.soft ? 9 : 5, !q.soft);
      progress.unlock('civilianPoop');
      if (progress.stat('civilianPoopHits') >= 5) progress.unlock('civilianPoop5');
      fx.pop(p.center, 'BLINDED!', '#c8a070', 28);
      fx.puff(at, { color: 0x754421, n: 6, size: 0.12 });
      play('splat', 0.7);
      people.witness(at, 'person');
      return true;
    }
    return false;
  },
  splat: (p, soft) => { fx.puff(p, { color: 0x754421, n: soft ? 7 : 3, size: 0.12 }); play('splat', 0.35); },
  slip: (p) => {
    fx.pop(p, 'SLIP!', '#ffd84a', 29);
    progress.unlock('firstSpinout');
    if (progress.stat('roadSpinouts') >= 5) progress.unlock('fiveSpinouts');
  },
  fuseSpark: (p) => fx.puff(p, { color: 0xffae22, n: 1, size: 0.05, life: 0.2 }),
  explode,
});
// A few piles are available before the first timed dog poop.
for (const [x, z, soft] of [[-7, 6, true], [4, 3, false], [-1, 11, true]]) throwables.addPoop(new THREE.Vector3(x, 0, z), soft);

player.onKO = () => { progress.unlock('beatup'); toast('You got beat up by The Family Dog.', 3); play('bark', 1); if (chained) setChain(false); };
player.onRespawn = () => { dog.mood = Math.max(dog.mood, -10); };

// ---------- Items ----------
const TOOLS = [
  { id: 'kick', name: 'Kick', icon: makeShoe },
  { id: 'punch', name: 'Punch', icon: () => makeFist() },
  { id: 'pet', name: 'Pet', icon: () => makeHeart() },
  { id: 'kiss', name: 'Kiss', icon: () => makeLips() },
  { id: 'glue', name: 'Glue', icon: makeGlue },
  { id: 'ball', name: 'Ball', icon: () => makeBall() },
  { id: 'kibble', name: 'Feed', icon: makeKibbleBag },
  { id: 'snowball', name: 'Snowball', icon: () => makeSnowball(0.1) },
  { id: 'burger', name: 'Burger', icon: makeBurger },
];
const SHOP = [
  { id: 'bat', name: 'Bat', price: 60, perm: true, icon: makeBat, desc: 'Like kicking, but you swing a bat. Sprint for a home run.' },
  { id: 'pistol', name: 'Pistol', price: 180, perm: true, icon: makePistol, desc: 'Semi-auto firearm. 8 rounds, click to fire; G to reload. Shoot airborne targets to chain combos.' },
  { id: 'milk', name: 'Milk', price: 25, icon: makeMilk, desc: 'If it\'s lactose intolerant, this is poison. If not, pure joy.' },
  { id: 'knuckles', name: 'Brass Knuckles', price: 90, perm: true, icon: makeKnuckles, desc: 'Why does the dog even deserve this? Uppercut sends it skyward.' },
  { id: 'bone', name: 'Bone', price: 15, icon: () => makeBone(1), desc: 'A good deed. For once.' },
  { id: 'john', name: 'John the Fish', price: 120, icon: makeFishToy, desc: 'Stands up like a human, with arms and legs. Boxes the dog.' },
  { id: 'grapes', name: 'Grapes', price: 30, icon: makeGrapes, desc: 'Gives it medical problems.' },
  { id: 'chocolate', name: 'Chocolate', price: 35, icon: makeChocolate, desc: 'Wildcard. Hurts the dog, but it will love you.' },
  { id: 'chain', name: 'Chain', price: 75, perm: true, icon: () => makeChainLinks(3), desc: 'Ties you and the dog together. Where it goes, you go.' },
  { id: 'bomb', name: 'Bomb', price: 40, icon: makeBomb, desc: 'Click to throw. Aim with the arc. Two second fuse. Big boom.' },
  { id: 'mine', name: 'Land Mine', price: 50, icon: makeMine, desc: 'Click to bury one. Goes off when the dog, a person, or a car steps on it.' },
  { id: 'yogurt', name: 'Yogurt', price: 20, icon: makeYogurt, desc: 'Reminds the dog of Obese Sonic. It gets very, very sad.' },
  { id: 'knife', name: 'Toy Knife', price: 95, perm: true, icon: makeKnife, desc: 'Right click to stab. Hold Shift and right click to slice. No gore.' },
];
const ALL = [...TOOLS, ...SHOP];
const icons = {};
(function renderIcons() {
  const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setSize(96, 96);
  r.outputColorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Scene();
  s.add(new THREE.HemisphereLight(0xffffff, 0x777777, 2.2));
  const dl = new THREE.DirectionalLight(0xffffff, 2); dl.position.set(2, 3, 4); s.add(dl);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
  for (const it of ALL) {
    const m = it.icon();
    const holder = new THREE.Group(); holder.add(m);
    holder.rotation.set(0.4, -0.6, it.id === 'bat' ? 0.9 : 0.15);
    s.add(holder);
    const b = new THREE.Box3().setFromObject(holder);
    const c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3()).length();
    holder.position.sub(c);
    cam.position.set(0, 0, sz * 1.9); cam.lookAt(0, 0, 0);
    r.render(s, cam);
    icons[it.id] = r.domElement.toDataURL();
    s.remove(holder);
  }
  r.dispose(); r.forceContextLoss();
})();

const owned = (id) => id === 'snowball' ? season === 'winter' : id === 'burger' ? (save.inv.burger || 0) > 0 : TOOLS.some((t) => t.id === id) || (save.inv[id] || 0) > 0;
let hotbar = [];
let season = ['default', 'spring', 'summer', 'winter'].includes(save.season) ? save.season : 'default';
let selId = save.selectedTool || 'kick';
function rebuildHotbar() {
  hotbar = ALL.filter((it) => owned(it.id));
  if (!hotbar.some((h) => h.id === selId)) { selId = 'kick'; save.selectedTool = selId; persist(); }
  const hb = $('hotbar');
  hb.innerHTML = '';
  hotbar.forEach((it, i) => {
    const el = document.createElement('div');
    el.className = 'slot' + (it.id === selId ? ' sel' : '');
    const cnt = !it.perm && SHOP.includes(it) ? `<span class="ct">x${save.inv[it.id]}</span>` : '';
    el.innerHTML = `<span class="n">${i < 9 ? i + 1 : i === 9 ? 0 : ''}</span>${cnt}<img src="${icons[it.id]}" width="34" height="34"><div>${it.name}</div>`;
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.setAttribute('aria-label', `Select ${it.name}`);
    el.setAttribute('aria-pressed', String(it.id === selId));
    el.addEventListener('click', () => select(it.id));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(it.id); }
    });
    hb.appendChild(el);
  });
  refreshHeld();
}
function select(id) { selId = id; if (!dogCamManual) dogCam = 0; save.selectedTool = id; persist(); rebuildHotbar(); }
function refreshHeld() {
  const map = { kick: null, punch: null, pet: null, kiss: null };
  player.setTool(selId in map ? null : selId, ball.state === 'player');
}
rebuildHotbar();

// ---------- Shop ----------
let shopOpen = false;
function renderShop() {
  $('shopCoins').textContent = save.coins;
  const box = $('shopItems');
  box.innerHTML = '';
  for (const it of SHOP) {
    const have = save.inv[it.id] || 0;
    const el = document.createElement('div');
    el.className = 'item';
    const ownedPerm = it.perm && have > 0;
    el.innerHTML = `<img class="ic" src="${icons[it.id]}" width="40" height="40"><div class="nm">${it.name}${!it.perm && have ? ` <small>(x${have})</small>` : ''}</div>
      <button ${ownedPerm || save.coins < it.price ? 'disabled' : ''}>${ownedPerm ? 'Owned' : it.price + ' c'}</button><div class="ds">${it.desc}</div>`;
    el.querySelector('button').onclick = () => {
      if (save.coins < it.price || ownedPerm) return;
      save.coins -= it.price;
      save.inv[it.id] = have + 1;
      persist();
      if (it.id === 'pistol') progress.unlock('armed');
      play('coins', 0.6);
      renderShop(); rebuildHotbar();
    };
    box.appendChild(el);
  }
}
function openShop() {
  closeAchievements();
  if (touchMode) releaseTouchInputs();
  closeTouchMore();
  shopOpen = true; renderShop();
  $('shop').classList.remove('hidden');
  if (noLock) locked = false; else document.exitPointerLock();
  syncTouchControls();
}
function closeShop() {
  shopOpen = false;
  $('shop').classList.add('hidden');
  if (noLock) locked = true; else canvas.requestPointerLock();
  syncTouchControls();
}
$('shopClose').onclick = closeShop;
let achOpen = false;
function openAchievements() {
  if (!started || shopOpen || achOpen) return;
  if (touchMode) releaseTouchInputs();
  closeTouchMore();
  achOpen = true;
  progress.renderPanel();
  $('achPanel').classList.remove('hidden');
  if (noLock) locked = false;
  else if (document.pointerLockElement === canvas) document.exitPointerLock();
  $('paused').classList.add('hidden');
  syncTouchControls();
}
function closeAchievements() {
  if (!achOpen) return;
  achOpen = false;
  $('achPanel').classList.add('hidden');
  if (noLock) locked = true;
  else if (started && !shopOpen) canvas.requestPointerLock();
  syncTouchControls();
}
$('achOpen').onclick = openAchievements;
$('achClose').onclick = closeAchievements;

// ---------- Input ----------
const input = { w: false, a: false, s: false, d: false, shift: false, space: false, b: false };
let locked = false, started = false, mouseHeld = false;
let camYaw = Math.atan2(dog.pos.x - player.pos.x, dog.pos.z - player.pos.z), camPitch = 0.3;
player.yaw = camYaw;
$('play').onclick = () => {
  initAudio();
  started = true;
  document.body.classList.add('game-started');
  $('start').classList.add('hidden');
  enterGameControl();
  toast('That\'s The Family Dog. Sprint + kick to send it out of the yard.', 4.5);
  syncTouchControls();
};
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('click', () => { if (!touchMode && started && !locked && !shopOpen && !achOpen) enterGameControl(); });
document.addEventListener('pointerlockchange', () => {
  if (touchMode) {
    noLock = true;
    locked = started && !shopOpen && !achOpen;
    $('paused').classList.add('hidden');
    if (!locked) releaseTouchInputs();
    return;
  }
  noLock = false;
  locked = document.pointerLockElement === canvas;
  $('paused').classList.toggle('hidden', locked || !started || shopOpen || achOpen);
  if (!locked) mouseHeld = false;
});
let noLock = false;
function enterGameControl() {
  if (!started || shopOpen || achOpen) return;
  if (touchMode || !canvas.requestPointerLock) {
    noLock = true;
    locked = true;
    $('paused').classList.add('hidden');
    return;
  }
  try { canvas.requestPointerLock(); }
  catch {
    noLock = true; locked = true;
    $('paused').classList.add('hidden');
  }
}
document.addEventListener('pointerlockerror', () => {
  if (!started || shopOpen || achOpen) return;
  noLock = true; locked = true; $('paused').classList.add('hidden');
});
document.addEventListener('mousemove', (e) => {
  if (!locked || touchMode) return;
  if (noLock && !(e.buttons & 2) && !(e.buttons & 1)) return;
  if (dogCam && !dogCamManual && (Math.abs(e.movementX) + Math.abs(e.movementY) > 1)) dogCam = 0;
  camYaw -= e.movementX * 0.0024;
  camPitch = THREE.MathUtils.clamp(camPitch + e.movementY * 0.002, -0.45, 1.1);
});
document.addEventListener('mousedown', (e) => {
  if (touchMode) return;
  if (!locked || (e.button !== 0 && e.button !== 2)) return;
  if (dogCam) { if (!dogCamManual) dogCam = 0; return; }
  if (e.button === 2) {
    if (selId !== 'knife') return;
    e.preventDefault();
    useTool();
    return;
  }
  if (selId === 'knife') return;
  mouseHeld = true;
  useTool();
});
document.addEventListener('mouseup', (e) => { if (!touchMode && e.button === 0) mouseHeld = false; });
document.addEventListener('wheel', (e) => {
  if (!locked) return;
  const i = hotbar.findIndex((h) => h.id === selId);
  const n = (i + (e.deltaY > 0 ? 1 : -1) + hotbar.length) % hotbar.length;
  select(hotbar[n].id);
});
const keyMap = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', ShiftLeft: 'shift', ShiftRight: 'shift', Space: 'space', KeyB: 'b' };
addEventListener('keydown', (e) => {
  if (e.code === 'KeyH' && !e.repeat) { achOpen ? closeAchievements() : openAchievements(); return; }
  if (e.code === 'Escape' && achOpen) { closeAchievements(); return; }
  if (achOpen) return;
  if (keyMap[e.code]) { input[keyMap[e.code]] = true; if (e.code === 'Space') e.preventDefault(); }
  if (dogCam && !dogCamManual && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyF', 'KeyQ'].includes(e.code)) dogCam = 0;
  if (e.code === 'KeyE') {
    if (shopOpen) closeShop();
    else if (locked && nearShop()) openShop();
    else if (locked && nearStation()) useStation();
  }
  if (!locked) return;
  if (e.code === 'KeyI' && !e.repeat) toggleInfiniteHealth();
  if (e.code === 'KeyV' && !e.repeat) toggleTraffic();
  if (e.code === 'KeyL' && !e.repeat) toggleInfiniteLove();
  if (e.code === 'KeyC' && !e.repeat) toggleDogCamera();
  const m = e.code.match(/^Digit(\d)$/);
  if (m) { const idx = m[1] === '0' ? 9 : +m[1] - 1; if (hotbar[idx]) select(hotbar[idx].id); }
  if (e.code === 'KeyF' && !e.repeat) tryGrab();
  if (e.code === 'KeyQ' && !e.repeat) throwDog();
  if (e.code === 'KeyG' && !e.repeat && locked && !player.ragdoll && player.ko <= 0 && selId === 'pistol') reloadPistol();
  if (e.code === 'KeyT' && !e.repeat) cycleSeason();
  if (e.code === 'KeyR') toggleRagdoll();
});
addEventListener('keyup', (e) => { if (keyMap[e.code]) input[keyMap[e.code]] = false; if (e.code === 'KeyF') dropDog(); });
const nearStation = () => ((dog.grabbed || carryPerson) && !peta.active ? peta.nearest(player.pos, 2.2) : null);
function useStation() {
  const st = nearStation();
  if (!st) return;
  const actor = carryPerson || dog;
  carryPerson = null;
  actor.grabbed = false; actor.headGrab = false; player.carrying = false; headGrip = false;
  if (chained) setChain(false);
  peta.run(st, actor);
  if (actor === dog) { dog.yaw = player.yaw; dog.q.copy(dog.uprightQ()); }
  people.witness(player.pos, actor === dog ? 'dog' : 'person');
  play('whimper', 0.9);
}
const nearShop = () => player.pos.distanceTo(world.shopPos) < 3.2 && !player.ragdoll;

function toggleInfiniteHealth() {
  if (shopOpen) return;
  save.infiniteHealth = !save.infiniteHealth;
  player.infiniteHealth = dog.infiniteHealth = save.infiniteHealth;
  if (save.infiniteHealth) {
    player.hp = 100;
    if (player.ko > 0) { player.ko = 0; if (player.ragdoll) player.getUp(); }
    if (dog.dead) { awardFinish(dog, dog.launchInfo); dog.respawn(); }
    else dog.health = 100;
  }
  persist();
  toast(`Infinite health ${save.infiniteHealth ? 'ON' : 'OFF'}`, 2);
}
function toggleTraffic() {
  if (shopOpen) return;
  save.trafficEnabled = !save.trafficEnabled;
  traffic.setEnabled(save.trafficEnabled);
  persist();
  toast(`Traffic ${save.trafficEnabled ? 'ON' : 'OFF'}`, 2);
  syncTouchControls();
}
function toggleInfiniteLove() {
  if (shopOpen) return;
  save.infiniteLove = !save.infiniteLove;
  dog.infiniteLove = save.infiniteLove;
  if (dog.infiniteLove) {
    dog.mood = 100; dog.love = 30; dog.happy = Math.max(3, dog.happy);
    fx.pop(dog.pos, '♥ FOREVER', '#ff83a4', 30);
  } else dog.love = 0;
  persist();
  toast(`Infinite dog love ${save.infiniteLove ? 'ON' : 'OFF'}`, 2);
  syncTouchControls();
}
function toggleDogCamera() {
  if (shopOpen) return;
  dogCamManual = !dogCamManual;
  dogCam = dogCamManual ? 1 : 0;
  dogCamHold = 0;
}
function toggleRagdoll() {
  if (player.ko > 0) return;
  if (player.ragdoll) { if (player.knockT <= 0) player.getUp(); }
  else {
    player.enterRagdoll(player.vel.clone().add(new THREE.Vector3(0, 1.5, 0)), true);
    if (dog.angry) toast('Uh oh. It\'s angry.', 2);
  }
}
function cycleSeason() { setSeason(SEASONS[(SEASONS.indexOf(season) + 1) % SEASONS.length], true); }
let touchMoreOpen = false;
function closeTouchMore() {
  touchMoreOpen = false;
  syncTouchControls();
}
function syncTouchControls() {
  if (!touchMode) return;
  const controls = $('mobileControls');
  if (!controls) return;
  const setText = (el, value) => { if (el.textContent !== value) el.textContent = value; };
  const setAttr = (el, name, value) => { if (el.getAttribute(name) !== value) el.setAttribute(name, value); };
  controls.classList.toggle('modal-open', shopOpen || achOpen);
  $('touchMoreTray').classList.toggle('hidden', !touchMoreOpen);
  setAttr($('touchMore'), 'aria-expanded', String(touchMoreOpen));
  setText($('touchGrab').querySelector('b'), ebikes.riding ? 'PARK' : dog.grabbed || carryPerson || carryRider ? 'DROP' : ebikes.nearbyRider(player.pos) ? 'RIDER' : ebikes.nearest(player.pos, 2) ? 'BIKE' : 'GRAB');
  setAttr($('touchGrab'), 'aria-label', ebikes.riding ? 'Park the bicycle' : dog.grabbed || carryPerson || carryRider ? 'Drop what you carry' : 'Grab the dog, a person, rider, poop, or bicycle');
  setText($('touchRagdoll'), player.ragdoll ? 'GET UP' : 'RAGDOLL');
  setText($('touchDogCam'), dogCamManual ? 'CAM ON' : 'DOG CAM');
  setAttr($('touchDogCam'), 'aria-pressed', String(dogCamManual));
  setText($('touchHealth'), save.infiniteHealth ? '∞ ON' : '∞ HEALTH');
  setAttr($('touchHealth'), 'aria-pressed', String(save.infiniteHealth));
  setText($('touchTraffic'), save.trafficEnabled ? 'TRAFFIC ON' : 'TRAFFIC OFF');
  setAttr($('touchTraffic'), 'aria-pressed', String(save.trafficEnabled));
  setText($('touchLove'), save.infiniteLove ? '♥ LOVE ON' : '♥ LOVE OFF');
  setAttr($('touchLove'), 'aria-pressed', String(save.infiniteLove));
  setText($('touchSeason'), season.toUpperCase());
  setAttr($('touchSeason'), 'aria-label', `Cycle season; current season is ${season}`);
  $('touchBuild').classList.toggle('hidden', season !== 'winter');
  $('touchReload').disabled = !owned('pistol') || selId !== 'pistol' || pistolAmmo === MAG_SIZE || reloadT > 0;
  $('touchShop').textContent = nearStation() ? 'USE PETA' : nearShop() ? 'SHOP HERE' : 'SHOP';
}
function releaseTouchInputs() {
  for (const k of ['w', 'a', 's', 'd', 'shift', 'space', 'b']) input[k] = false;
  mouseHeld = false;
  $('touchSprint')?.setAttribute('aria-pressed', 'false');
  $('touchBuild')?.setAttribute('aria-pressed', 'false');
  if ($('stickKnob')) $('stickKnob').style.transform = 'translate(0, 0)';
  stickPointer = null;
  lookPointer = null;
}
function touchReady() { return touchMode && started && locked && !shopOpen && !achOpen; }
function captureTouch(el, e) {
  try { el.setPointerCapture(e.pointerId); } catch {}
}
function bindTouchHold(id, onStart, onEnd) {
  const el = $(id), pointers = new Set();
  el.addEventListener('pointerdown', (e) => {
    if (!touchReady() || pointers.has(e.pointerId)) return;
    e.preventDefault();
    pointers.add(e.pointerId); captureTouch(el, e); onStart(e);
  });
  const end = (e) => {
    if (!pointers.delete(e.pointerId)) return;
    e.preventDefault(); onEnd(e);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('lostpointercapture', end);
}
function bindTouchPress(id, action) {
  const el = $(id), pointers = new Set();
  el.addEventListener('pointerdown', (e) => {
    if (!touchReady() || pointers.has(e.pointerId)) return;
    e.preventDefault();
    pointers.add(e.pointerId); captureTouch(el, e); action(e);
  });
  const end = (e) => { if (pointers.delete(e.pointerId)) e.preventDefault(); };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('lostpointercapture', end);
}

let stickPointer = null, lookPointer = null, lookLastX = 0, lookLastY = 0, lookTravel = 0;
function updateStick(e) {
  const rect = $('moveStick').getBoundingClientRect();
  const limit = rect.width * 0.34;
  let dx = e.clientX - (rect.left + rect.width / 2), dy = e.clientY - (rect.top + rect.height / 2);
  const length = Math.hypot(dx, dy);
  if (length > limit) { dx *= limit / length; dy *= limit / length; }
  const nx = dx / limit, ny = dy / limit;
  $('stickKnob').style.transform = `translate(${dx}px, ${dy}px)`;
  input.a = nx < -0.23; input.d = nx > 0.23;
  input.w = ny < -0.23; input.s = ny > 0.23;
}
if (touchMode) {
  const stick = $('moveStick');
  stick.addEventListener('pointerdown', (e) => {
    if (!touchReady()) return;
    e.preventDefault();
    stickPointer = e.pointerId; captureTouch(stick, e); updateStick(e);
  });
  const endStick = (e) => {
    if (stickPointer !== e.pointerId) return;
    stickPointer = null;
    input.w = input.a = input.s = input.d = false;
    $('stickKnob').style.transform = 'translate(0, 0)';
  };
  stick.addEventListener('pointerup', endStick);
  stick.addEventListener('pointercancel', endStick);
  stick.addEventListener('lostpointercapture', endStick);
  stick.addEventListener('pointermove', (e) => { if (stickPointer === e.pointerId) { e.preventDefault(); updateStick(e); } });

  bindTouchHold('touchSprint', () => { input.shift = true; $('touchSprint').setAttribute('aria-pressed', 'true'); }, () => { input.shift = false; $('touchSprint').setAttribute('aria-pressed', 'false'); });
  bindTouchHold('touchJump', () => { input.space = true; }, () => { input.space = false; });
  bindTouchHold('touchBuild', () => { input.b = true; $('touchBuild').setAttribute('aria-pressed', 'true'); }, () => { input.b = false; $('touchBuild').setAttribute('aria-pressed', 'false'); });
  bindTouchHold('touchUse', () => { mouseHeld = true; useTool(); }, () => { mouseHeld = false; });
  bindTouchPress('touchGrab', () => { if (dog.grabbed || carryPerson || carryRider) dropDog(); else tryGrab(); syncTouchControls(); });
  bindTouchPress('touchThrow', throwDog);
  bindTouchPress('touchMore', () => { touchMoreOpen = !touchMoreOpen; syncTouchControls(); });
  bindTouchPress('touchCloseMore', closeTouchMore);
  bindTouchPress('touchRagdoll', toggleRagdoll);
  bindTouchPress('touchReload', () => { if (selId === 'pistol') reloadPistol(); });
  bindTouchPress('touchDogCam', toggleDogCamera);
  bindTouchPress('touchSeason', cycleSeason);
  bindTouchPress('touchHealth', toggleInfiniteHealth);
  bindTouchPress('touchTraffic', toggleTraffic);
  bindTouchPress('touchLove', toggleInfiniteLove);
  bindTouchPress('touchShop', () => {
    if (nearStation()) useStation();
    else if (nearShop()) openShop();
    else toast('Walk to the street stand to shop.', 1.5);
  });
  bindTouchPress('touchAchievements', openAchievements);

  document.addEventListener('pointerdown', (e) => {
    if (!touchReady() || e.target.closest('#mobileControls, #bottom, button, .slot, #shop, #achPanel, #start')) return;
    e.preventDefault();
    lookPointer = e.pointerId;
    lookLastX = e.clientX; lookLastY = e.clientY; lookTravel = 0;
  });
  document.addEventListener('pointermove', (e) => {
    if (lookPointer !== e.pointerId) return;
    e.preventDefault();
    const dx = e.clientX - lookLastX, dy = e.clientY - lookLastY;
    lookTravel += Math.hypot(dx, dy);
    lookLastX = e.clientX; lookLastY = e.clientY;
    if (dogCam && !dogCamManual && lookTravel > 2) dogCam = 0;
    camYaw -= dx * 0.0052;
    camPitch = THREE.MathUtils.clamp(camPitch + dy * 0.004, -0.45, 1.1);
  });
  const endLook = (e) => {
    if (lookPointer !== e.pointerId) return;
    if (lookTravel < 10 && touchReady()) useTool();
    lookPointer = null;
  };
  document.addEventListener('pointerup', endLook);
  document.addEventListener('pointercancel', endLook);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseTouchInputs(); });
}

// ---------- Actions ----------
const scheduled = [];
const schedule = (t, fn) => scheduled.push({ t, fn });
let actionCd = 0, shake = 0, slowT = 0;
let dogCam = 0, dogCamHold = 0, dogCamManual = false;
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), pc = new THREE.Vector3();

function fwd() { return new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw)); }
function interactionDog(range = 2.3) {
  return dogInReach(range) && !dog.air && dog.ko <= 0 ? dog : null;
}
function dogInReach(range = 2.3) {
  if (dog.dead || dog.inside || dog.locked) return false;
  player.centerWorld(pc);
  const d = tmpV.subVectors(dog.pos, pc);
  if (Math.abs(d.y) > 2) return false;
  d.y = 0;
  const dist = d.length();
  if (dist > range) return false;
  return dist < 0.9 || d.normalize().dot(fwd()) > 0.15;
}
function consume(id) {
  save.inv[id]--;
  if (save.inv[id] <= 0) { delete save.inv[id]; }
  persist();
  rebuildHotbar();
}
function angerOnHit(amount) {
  if (dog.sad <= 0 && !dog.fear) { dog.love = 0; dog.mood = Math.min(dog.mood - amount, -35); }
  people.witness(player.pos, 'dog');
}
function startDogCam() { dogCam = 1; dogCamHold = 0; }
const MAG_SIZE = 8;
let pistolAmmo = Number.isInteger(save.pistolAmmo) && save.pistolAmmo >= 0 && save.pistolAmmo <= MAG_SIZE ? save.pistolAmmo : MAG_SIZE, reloadT = 0;
function reloadPistol() {
  if (reloadT > 0 || pistolAmmo === MAG_SIZE || !owned('pistol')) return;
  reloadT = 1.35;
  toast('Reloading...', 1.1);
}
function firePistol() {
  if (reloadT > 0) return;
  if (!pistolAmmo) { reloadPistol(); return; }
  pistolAmmo--; save.pistolAmmo = pistolAmmo; persist(); actionCd = 0.28;
  player.play('shoot', 0.24);
  play('pistol', 0.8, 1, 0.02);
  shake = Math.max(shake, 0.12);
  const muzzle = player.handWorld(new THREE.Vector3()).addScaledVector(fwd(), 0.2);
  fx.burst(muzzle, 0.24, 0.11);
  const ray = new THREE.Ray(camera.position.clone(), camera.getWorldDirection(new THREE.Vector3()));
  const point = new THREE.Vector3();
  let nearest = 65, hitDog = false;
  const dogCenter = dog.pos.clone().add(new THREE.Vector3(0, 0.16, 0));
  if (!dog.dead && ray.intersectSphere(new THREE.Sphere(dogCenter, 0.64), point)) {
    const dogDist = camera.position.distanceTo(point);
    if (dogDist <= 65) { nearest = dogDist; hitDog = true; }
  }
  let hitP = null;
  for (const pp of people.list) {
    if (!pp.hittable) continue;
    if (ray.intersectSphere(new THREE.Sphere(pp.center, 0.5), tmpV)) {
      const d = camera.position.distanceTo(tmpV);
      if (d < nearest) { nearest = d; hitDog = false; hitP = pp; point.copy(tmpV); }
    }
  }
  let hitBike = null;
  for (const r of ebikes.riders) {
    if (r.mode !== 'npc') continue;
    if (ray.intersectSphere(new THREE.Sphere(r.pos.clone().setY(0.85), 0.9), tmpV)) {
      const d = camera.position.distanceTo(tmpV);
      if (d < nearest) { nearest = d; hitDog = false; hitP = null; hitBike = r; point.copy(tmpV); }
    }
  }
  let obstacle = null;
  for (const c of colliders) {
    const p = ray.intersectBox(new THREE.Box3(c.min, c.max), new THREE.Vector3());
    if (p) {
      const d = camera.position.distanceTo(p);
      if (d < nearest - 0.05) { nearest = d; hitDog = false; hitP = null; hitBike = null; obstacle = p; }
    }
  }
  const end = ray.at(nearest, new THREE.Vector3());
  const tracer = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([muzzle, end]),
    new THREE.LineBasicMaterial({ color: 0xffde8b, transparent: true, opacity: 0.8, depthWrite: false })
  );
  scene.add(tracer);
  schedule(0.09, () => { scene.remove(tracer); tracer.geometry.dispose(); tracer.material.dispose(); });
  if (hitDog) {
    const airborne = dog.air && !!dog.launchInfo;
    const impulse = airborne ? dog.vel.clone().addScaledVector(ray.direction, 14) : ray.direction.clone().multiplyScalar(21);
    impulse.y = Math.max(airborne ? dog.vel.y + 5 : 5, impulse.y);
    dog.launch(impulse, 'Pistol');
    dog.finishShotDistance = nearest;
    dog.damage(11, 'Pistol');
    angerOnHit(24);
    dog.squash = 1;
    fx.burst(point, 0.75); fx.pop(dog.pos, 'BANG!', '#ffdc77', 31);
    progress.unlock('firstshot');
    progress.stat('pistolHits');
    if (airborne) progress.unlock('skeet');
    if (nearest >= 25) progress.unlock('longshot');
  } else if (hitP) {
    hitP.hit(ray.direction.clone().multiplyScalar(14).setY(5), 30, 'Pistol');
    fx.burst(point, 0.7); fx.pop(hitP.center, 'BANG!', '#ffdc77', 28);
    people.witness(player.pos, 'person');
  } else if (hitBike) {
    ebikes.knock(hitBike);
    fx.pop(point, 'TIRE POP!', '#ffffff', 27);
    people.witness(hitBike.pos, 'person');
  } else if (obstacle) {
    fx.puff(obstacle, { color: 0xffdf9f, n: 4, size: 0.08, spread: 0.5, life: 0.3 });
  }
  if (!pistolAmmo) reloadPistol();
}
function aimDir() {
  const target = camera.position.clone().add(camera.getWorldDirection(tmpV2).multiplyScalar(14));
  return target.sub(player.handWorld(new THREE.Vector3())).normalize();
}

function useTool() {
  if (!canAct() || actionCd > 0) return;
  if (dog.grabbed || carryPerson || carryRider) { grabPunch(); return; }
  if (throwables.held) { placePoop(); return; }
  const sprint = input.shift;
  const f = fwd();
  switch (selId) {
    case 'pistol': firePistol(); break;
    case 'burger': {
      actionCd = 0.65; player.play('give', 0.4);
      player.centerWorld(pc);
      const f = fwd();
      const p = people.nearest(pc, f, 2.6);
      const r = ebikes.riders.find(r => (r.mode === 'npc' || r.mode === 'parked' && r.kid.visible)
        && player.pos.distanceTo(r.mode === 'npc' ? r.pos : r.kid.position) < 2.5);
      const pet = interactionDog(2.5);
      consume('burger');
      play('eat', 0.7);
      const knows = Math.random() < 0.38;
      if (p) {
        p.say(knows ? 'Wait. What is IN this burger?!' : 'Wicked good burger! I live in Massachusetts!', 3);
        fx.pop(p.center, knows ? 'THEY KNOW!' : 'YUM!', knows ? '#f79258' : '#a5dd74', 27);
        progress.unlock(knows ? 'burgerSuspicious' : 'burgerUnaware');
        if (p.kind === 'mother') progress.unlock('burgerMother');
      } else if (r) {
        fx.bubble(r, knows ? 'Whoa. Is this from PETA?!' : 'Thanks, jackass! This is delicious!', 3);
        fx.pop(r.center, knows ? 'SUSPICIOUS!' : 'YUM!', '#ffd84a', 25);
        progress.unlock('burgerRider');
      } else if (pet) {
        if (knows) { pet.sad = 5; fx.bubble(pet, '*sniff sniff* ...no thanks', 2.5); }
        else { pet.mood = Math.min(100, pet.mood + 25); pet.happy = 5; fx.pop(pet.pos, '♥ YUM!', '#ff9eb7', 26); }
        progress.unlock('burgerDog');
      } else if (john.active && john.pos.distanceTo(player.pos) < 2.5) {
        fx.pop(john.pos, knows ? 'JOHN KNOWS!' : 'JOHN APPROVES!', '#8ac7ff', 26);
        progress.unlock('burgerJohn');
      } else {
        fx.pop(player.pos.clone().setY(1.5), knows ? 'WAIT... WHAT?!' : 'NOT BAD!', '#ffd84a', 25);
        toast(knows ? 'You suddenly recognize the burger wrapper.' : 'You ate the burger. Probably best not to ask.', 2.6);
        progress.unlock('burgerSelf');
      }
      progress.stat('burgersServed');
      if (save.stats.burgersServed >= 10) progress.unlock('burgerChef');
      people.witness(player.pos, p || r ? 'person' : 'dog');
      break;
    }
    case 'knife': {
      actionCd = 0.55; player.play('bat', 0.4);
      schedule(0.14, () => {
        const f = fwd();
        const p = people.nearest(player.centerWorld(new THREE.Vector3()), f, 2.2);
        const closeDog = dogInReach(2.3);
        if (!closeDog && !p) { hitPerson(2.3, f.multiplyScalar(8).setY(5), 8, 'BONK'); return; }
        const target = closeDog ? dog : p;
        const head = target.head.getWorldPosition(new THREE.Vector3());
        const move = input.shift ? 'SLICE!' : 'STAB!';
        const impulse = f.multiplyScalar(move === 'SLICE!' ? 14 : 8).setY(4);
        play('whoosh', 0.7); play('bat', 0.55);
        fx.burst(head, 0.8); fx.pop(head, move, '#ffd76b', 31);
        if (closeDog) {
          dog.launch(impulse, move);
          dog.damage(move === 'SLICE!' ? 24 : 15, move);
          angerOnHit(22);
        } else {
          p.hit(impulse, 17, move);
          progress.unlock('knifeCivilian');
          people.witness(p.pos, 'person');
        }
        progress.unlock(move === 'SLICE!' ? 'knifeSlice' : 'knifeStab');
      });
      break;
    }
    case 'kick': {
      actionCd = 0.4; player.play('kick', 0.38);
      schedule(0.12, () => {
        if (!dogInReach(2.4)) { hitPerson(2.4, sprint ? f.clone().multiplyScalar(30).setY(16) : f.clone().multiplyScalar(20).setY(7), sprint ? 25 : 14, sprint ? 'LAUNCH!' : 'KICK'); return; }
        if (dog.stuck > 0 && !sprint) { play('kick', 0.8); dog.squash = 1; angerOnHit(8); fx.pop(dog.pos, 'IT\'S STUCK', '#f4f1e2'); return; }
        if (dog.stuck > 0) fx.pop(dog.pos, 'RIPPED FREE', '#f4f1e2', 30);
        if (sprint) {
          const m = (dog.angry ? 1.12 : 1) * rand(0.93, 1.07);
          dog.launch(f.multiplyScalar(30 * m).setY(16 * m), 'Sprint Kick');
          dog.damage(19, 'Sprint Kick');
          angerOnHit(45);
          play('kick', 1, 0.85); play('whoosh', 0.8);
          slowT = 0.22; shake = 0.5; startDogCam();
          fx.pop(dog.pos, 'LAUNCH!', '#ffd84a', 40);
        } else {
          dog.launch(f.multiplyScalar(20).setY(7), 'Kick');
          dog.damage(11, 'Kick');
          angerOnHit(35);
          play('kick', 0.9); shake = 0.2;
        }
      });
      break;
    }
    case 'punch': {
      actionCd = 0.3; player.play('punch', 0.28);
      schedule(0.08, () => {
        if (!dogInReach(2.0)) { hitPerson(2.0, f.clone().multiplyScalar(8).setY(4), 9, 'PUNCH'); return; }
        play('punch', 0.9);
        if (dog.stuck > 0) { dog.squash = 1; angerOnHit(10); fx.pop(dog.pos, 'BAP', '#fff'); return; }
        dog.launch(f.multiplyScalar(8).setY(4), 'Punch');
        dog.damage(7, 'Punch');
        angerOnHit(18); fx.pop(dog.pos, 'PUNCH', '#fff'); shake = 0.12;
      });
      break;
    }
    case 'knuckles': {
      actionCd = 0.5; player.play('uppercut', 0.42);
      schedule(0.15, () => {
        if (!dogInReach(2.1)) { hitPerson(2.1, f.clone().multiplyScalar(2).setY(sprint ? 40 : 30), 22, 'UPPERCUT'); return; }
        play('punch', 1, 0.8); play('whoosh', 0.7, 1.2);
        if (dog.stuck > 0) fx.pop(dog.pos, 'RIPPED FREE', '#f4f1e2');
        dog.launch(f.multiplyScalar(2).setY(sprint ? 42 : 31), 'Uppercut');
        dog.damage(18, 'Uppercut');
        angerOnHit(40); slowT = 0.18; shake = 0.45; startDogCam();
        fx.pop(dog.pos, 'UPPERCUT', '#ffd84a', 38);
      });
      break;
    }
    case 'bat': {
      actionCd = 0.55; player.play('bat', 0.42);
      schedule(0.16, () => {
        if (!dogInReach(2.9)) { hitPerson(2.9, sprint ? f.clone().multiplyScalar(44).setY(20) : f.clone().multiplyScalar(26).setY(9), sprint ? 35 : 20, sprint ? 'HOME RUN!' : 'CRACK'); return; }
        play('bat', 1);
        if (dog.stuck > 0) fx.pop(dog.pos, 'RIPPED FREE', '#f4f1e2');
        if (sprint) {
          const m = (dog.angry ? 1.1 : 1) * rand(0.94, 1.06);
          dog.launch(f.multiplyScalar(44 * m).setY(20 * m), 'Home Run');
          dog.damage(24, 'Home Run');
          play('whoosh', 0.9); slowT = 0.3; shake = 0.6; startDogCam();
          fx.pop(dog.pos, 'HOME RUN!', '#ffd84a', 44);
        } else {
          dog.launch(f.multiplyScalar(26).setY(9), 'Bat');
          dog.damage(16, 'Bat');
          shake = 0.3; fx.pop(dog.pos, 'CRACK', '#fff', 32);
        }
        angerOnHit(45);
      });
      break;
    }
    case 'pet': {
      actionCd = 0.5; player.play('pet', 0.5);
      const target = interactionDog(2.2);
      if (!target) {
        const p = people.nearest(player.centerWorld(new THREE.Vector3()), f, 2.2);
        if (p) { p.say('Uh... I live in Massachusetts?', 2.5); fx.pop(p.center, '?', '#ff8fb0', 25); progress.unlock('civilianPet'); }
        return;
      }
      if (target.angry && Math.random() < 0.45) {
        schedule(0.15, () => { player.hit(f.multiplyScalar(-6).setY(4), 6); play('bark', 0.9); fx.pop(target.pos, 'SNAP', '#ff7b4a', 30); });
        return;
      }
      target.mood += target.angry ? 6 : 12; target.happy = 2.5;
      progress.stat('pets');
      fx.pop(target.pos, '♥', '#ff5d8f', 30);
      if (Math.random() < 0.5) play('happy', 0.6);
      break;
    }
    case 'kiss': {
      actionCd = 0.6; player.play('kiss', 0.55);
      const target = interactionDog(2.1);
      if (!target || !aimingAtHead(target)) {
        const p = people.nearest(player.centerWorld(new THREE.Vector3()), f, 2.1);
        if (p) { p.say('Wicked weird. I live in Massachusetts!', 2.5); fx.pop(p.center, 'MWAH?', '#ff8fb0', 24); play('kiss', 0.5); progress.unlock('civilianKiss'); }
        else toast('Aim for the top of its head.', 1.4);
        return;
      }
      if (target.angry && Math.random() < 0.5) {
        schedule(0.15, () => { player.hit(f.multiplyScalar(-6).setY(4), 6); play('bark', 0.9); fx.pop(target.pos, 'NOPE', '#ff7b4a', 30); });
        return;
      }
      schedule(0.25, () => {
        target.mood += target.angry ? 7 : 14; target.happy = 3; target.kissT = 1.2;
        progress.stat('kisses');
        play('kiss', 0.7);
        fx.pop(target.head.getWorldPosition(tmpV), 'mwah', '#ff8fb0', 22);
        fx.pop(target.pos, '♥', '#ff5d8f', 30);
        if (Math.random() < 0.6) fx.bubble(target, KISS_LINES[(Math.random() * KISS_LINES.length) | 0], 3.2);
      });
      break;
    }
    case 'snowball': {
      actionCd = 0.35; player.play('throw', 0.35);
      schedule(0.12, () => {
        const from = player.handWorld(new THREE.Vector3());
        const v = aimDir().multiplyScalar(21); v.y += 2.5;
        snow.throwBall(from, v);
        play('whoosh', 0.35, 1.6);
      });
      break;
    }
    case 'ball': {
      if (ball.state !== 'player') {
        toast(ball.state === 'dog' ? 'The Family Dog has the ball.' : 'Go pick the ball back up.', 1.8);
        actionCd = 0.3; return;
      }
      actionCd = 0.45; player.play('throw', 0.4);
      schedule(0.14, () => {
        player.handWorld(ball.pos);
        ball.vel.copy(aimDir()).multiplyScalar(15).y += 2.5;
        ball.state = 'free'; ball.freeT = 0;
        refreshHeld();
        if (dog.angry) schedule(0.8, () => fx.pop(dog.pos, '...no.', '#fff', 20));
      });
      break;
    }
    case 'kibble': {
      actionCd = 0.6; player.play('give', 0.4);
      if (player.pos.distanceTo(world.bowlPos) > 3.5) { toast('Walk over to the bowl (by the dog house).', 2); return; }
      world.setFood(true, season === 'summer'); dog.foodWaiting = true;
      play('eat', 0.4, 1.3);
      fx.pop(world.bowlPos.clone().setY(0.2), season === 'summer' ? 'food + water' : 'bowl filled', '#ffe0a0', 18);
      toast('The Family Dog is heading to the bowl.', 2);
      break;
    }
    case 'milk': case 'bone': case 'grapes': case 'chocolate': {
      actionCd = 0.6; player.play('give', 0.4);
      const target = interactionDog(2.4);
      if (!target) { toast('Get closer to a dog.', 1.5); return; }
      const id = selId;
      consume(id);
      play('eat', 0.8);
      if (id === 'milk') {
        target.lactoseKnown = true;
        progress.unlock('science');
        target.thirst = Math.min(100, target.thirst + 70);
        if (season === 'summer') schedule(0.4, () => fx.pop(target.pos, 'hydrated', '#9fdcff', 20));
        if (target.lactose) {
          target.sick = 25; target.sickKind = 'milk'; target.mood -= 10;
          target.damage(30, 'Milk');
          fx.pop(target.pos, 'LACTOSE INTOLERANT', '#9ac23a', 28);
          schedule(0.6, () => hooks.fart(target));
        } else {
          target.mood += 45; target.happy = 5;
          fx.pop(target.pos, '♥ ♥ ♥', '#ff5d8f', 30);
          fx.bubble(target, `${target.name} loves the milk.`, 4.5);
          play('happy', 0.8);
        }
      } else if (id === 'bone') {
        target.chew = 12; target.mouthBone.visible = true; target.mood += 55; target.happy = 5;
        fx.pop(target.pos, 'GOOD DEED', '#7ee07a', 30);
        play('happy', 0.8);
      } else if (id === 'grapes') {
        target.sick = 30; target.sickKind = 'grapes'; target.damage(20, 'Grapes');
        fx.pop(target.pos, 'MEDICAL PROBLEMS', '#9ac23a', 28);
        fx.bubble(target, '*has medical problems*', 3.5);
      } else if (id === 'chocolate') {
        progress.unlock('bought');
        target.love = 30; target.mood = 100; target.happy = 5;
        target.damage(30, 'Chocolate');
        fx.pop(target.pos, 'IT LOVES YOU', '#ff5d8f', 32);
        for (let i = 0; i < 4; i++) schedule(i * 0.25, () => fx.pop(target.pos, '♥', '#ff5d8f', 28));
        play('happy', 1);
      }
      break;
    }
    case 'bomb': {
      actionCd = 0.5; player.play('throw', 0.4);
      schedule(0.14, () => {
        const from = player.handWorld(new THREE.Vector3());
        throwables.throwBomb(from, throwVel(15));
        consume('bomb');
        play('whoosh', 0.5, 0.9);
      });
      break;
    }
    case 'mine': {
      actionCd = 0.6; player.play('give', 0.4);
      const at = player.pos.clone().addScaledVector(f, 1.3);
      throwables.placeMine(at);
      consume('mine');
      play('crunch', 0.5);
      fx.pop(at, 'MINE ARMED', '#ff5a3a', 20);
      break;
    }
    case 'yogurt': {
      actionCd = 0.6; player.play('give', 0.4);
      const target = interactionDog(2.4);
      if (!target) { toast('Get closer to a dog.', 1.5); return; }
      consume('yogurt');
      play('eat', 0.7);
      target.sad = 28; target.love = 0; target.mood = Math.min(target.mood, -10); target.happy = 0;
      progress.unlock('yogurtMemory');
      fx.pop(target.pos, 'OBESE SONIC FLASHBACK', '#7ab4ff', 26);
      schedule(0.6, () => { fx.bubble(target, 'The yogurt reminds it of Obese Sonic. It misses him so much.', 4.5); play('whimper', 0.8); });
      toast('It remembers Obese Sonic eating yogurt. It is devastated.', 3.5);
      break;
    }
    case 'john': {
      actionCd = 0.8;
      if (john.active) { toast('John is already out there.', 1.5); return; }
      consume('john');
      player.centerWorld(pc);
      const at = tmpV.subVectors(pc, dog.pos).setY(0);
      if (at.lengthSq() < 0.01) at.set(1, 0, 0);
      at.normalize().multiplyScalar(2.5).add(dog.pos);
      at.x = THREE.MathUtils.clamp(at.x, -60, 60);
      john.spawn(at);
      fx.puff(at.clone().setY(0.8), { n: 12, size: 0.45 }); play('poof', 0.8);
      fx.pop(at, 'JOHN THE FISH', '#6fb4ff', 32);
      toast('John the Fish has entered the yard. They fight!', 2.5);
      break;
    }
    case 'chain': {
      actionCd = 0.5; player.play('give', 0.3);
      if (chained) { setChain(false); toast('Unchained.', 1.2); return; }
      if (!dogInReach(2.6)) { toast('Get closer to The Family Dog.', 1.5); return; }
      setChain(true);
      toast('You and The Family Dog are now chained together.', 2.5);
      break;
    }
  }
}
// ---------- People: melee ----------
function hitPerson(range, v, dmg, word) {
  player.centerWorld(pc);
  const p = people.nearest(pc, fwd(), range);
  if (!p) {
    const bike = ebikes.yank(player.pos, fwd(), range);
    if (bike) { player.play('punch', 0.28); shake = Math.max(shake, 0.16); }
    return bike;
  }
  p.hit(v, dmg, word);
  play(word === 'CRACK' || word === 'HOME RUN!' ? 'bat' : 'punch', 0.9);
  fx.burst(p.center.clone(), 0.8);
  fx.pop(p.center, word, '#ffffff', 30);
  shake = Math.max(shake, 0.2);
  people.witness(player.pos, 'person');
  return true;
}
function canAct() { return locked && !shopOpen && !achOpen && !player.ragdoll && player.ko <= 0 && dogCam === 0; }

// ---------- Grab / throw ----------
let grabT = 0, grabHits = 0;
const PUNCH_WORDS = ['BAP', 'POW', 'WHAP', 'BONK', 'THWACK', 'BIFF'];
let carryPerson = null;
let carryRider = null;
let headGrip = false;
function aimOnHead(at, tolerance = 0.45) {
  const dir = camera.getWorldDirection(new THREE.Vector3());
  const ray = at.clone().sub(camera.position);
  const along = ray.dot(dir);
  return along > 0 && ray.addScaledVector(dir, -along).length() < tolerance;
}
function tryGrab() {
  if (!canAct() || dog.grabbed || carryPerson || carryRider) return;
  if (ebikes.riding) {
    ebikes.park(); player.speedMul = 1; toast('Bike parked. Press F to ride again.', 2);
    return;
  }
  if (throwables.held) { placePoop(); return; }
  const rider = ebikes.grabRider(player.pos);
  if (rider) {
    headGrip = input.shift || aimOnHead(rider.kid.localToWorld(new THREE.Vector3(0, 0.7, 0)));
    rider.headGrab = headGrip;
    carryRider = rider; player.carrying = true;
    player.play('give', 0.35); play('whoosh', 0.5);
    fx.pop(rider.center, 'GOTCHA!', '#ffd84a', 24);
    progress.unlock('bikeRiderGrab');
    if (headGrip) { fx.pop(rider.center, 'HEAD GRAB!', '#ffcf7a', 25); progress.unlock('headGrabRider'); }
    people.witness(player.pos, 'person');
    return;
  }
  if (ebikes.mount(player.pos)) { player.speedMul = 2.15; return; }
  if (ebikes.yank(player.pos, fwd(), 2.1)) { player.play('give', 0.35); people.witness(player.pos, 'person'); return; }
  if (!dogInReach(2.4)) {
    player.centerWorld(pc);
    const p = people.nearest(pc, fwd(), 2.2);
    if (p) {
      headGrip = input.shift || aimOnHead(p.head.getWorldPosition(new THREE.Vector3()));
      p.grab(); carryPerson = p; player.carrying = true; grabT = 0; grabHits = 0;
      p.headGrab = headGrip;
      play('whoosh', 0.35, 1.5); fx.pop(p.center, 'GOTCHA', '#ffffff', 22);
      people.witness(player.pos, 'person');
      if (headGrip) { fx.pop(p.center, 'HEAD GRAB!', '#ffcf7a', 24); progress.unlock('headGrabCivilian'); }
      return;
    }
    const q = throwables.nearestPoop(player.pos, 1.7);
    if (q) {
      throwables.pickUp(q); player.play('give', 0.3); play('splat', 0.4, 1.4);
      fx.pop(player.pos.clone().setY(1), q.soft ? 'SOFT ONE. EW.' : 'HARD ONE. NICE.', '#c8a070', 20);
      return;
    }
    player.play('give', 0.25); return;
  }
  const f = fwd();
  if (dog.angry && Math.random() < 0.3) {
    player.play('give', 0.3);
    schedule(0.1, () => { player.hit(f.multiplyScalar(-6).setY(4), 6); play('bark', 0.9); fx.pop(dog.pos, 'SNAP', '#ff7b4a', 30); dog.attackCd = 0.3; });
    return;
  }
  if (dog.stuck > 0) fx.pop(dog.pos, 'RIPPED FREE', '#f4f1e2', 26);
  dog.grab();
  headGrip = input.shift || aimOnHead(dog.head.getWorldPosition(new THREE.Vector3()));
  dog.headGrab = headGrip;
  if (headGrip) { fx.pop(dog.pos, 'HEAD GRAB!', '#ffcf7a', 24); progress.unlock('headGrabDog'); }
  player.carrying = true;
  grabT = 0; grabHits = 0;
  play('whoosh', 0.35, 1.5);
  fx.pop(dog.pos, dog.angry ? 'GRRR' : 'GOTCHA', dog.angry ? '#ff7b4a' : '#ffffff', 22);
  if (dog.angry) toast('It is not happy about this.', 1.6);
}
function dropDog() {
  headGrip = false;
  if (carryPerson) { carryPerson.release(tmpV.copy(player.vel).setY(1.5)); carryPerson = null; player.carrying = false; return; }
  if (carryRider) { carryRider.headGrab = false; carryRider.launch(tmpV.copy(player.vel).setY(1.5)); carryRider = null; player.carrying = false; return; }
  if (!dog.grabbed) return;
  dog.release(tmpV.copy(player.vel).setY(1.5));
  player.carrying = false;
}
// Aimed throw: follows the crosshair, lobbed a little upward. The arc preview uses the same numbers.
function throwVel(S) {
  const cd = camera.getWorldDirection(new THREE.Vector3());
  const e = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(cd.y, -1, 1)) + 0.42, -0.35, 1.25);
  const h = new THREE.Vector3(cd.x, 0, cd.z).normalize();
  return h.multiplyScalar(Math.cos(e) * S).setY(Math.sin(e) * S);
}
const dogThrowS = () => (input.shift ? 31 : 23) * (dog.angry ? 1.08 : 1);
const personThrowS = () => (input.shift ? 26 : 19);
const POOP_S = 17;
function throwDog() {
  if (!canAct()) return;
  if (carryRider) {
    const r = carryRider; carryRider = null; player.carrying = false;
    if (headGrip) progress.unlock('headThrowRider');
    headGrip = false;
    r.headGrab = false;
    player.play('toss', 0.35);
    r.launch(throwVel(personThrowS()));
    progress.unlock('bikeRiderThrow');
    if (progress.stat('bikeRiderThrows') >= 10) progress.unlock('bikeRiderThrow10');
    play('whoosh', 0.8); fx.pop(r.center, 'YEET!', '#ffd84a', 30);
    people.witness(player.pos, 'person');
    return;
  }
  if (carryPerson) {
    const p = carryPerson; carryPerson = null; player.carrying = false;
    player.play('toss', 0.35);
    p.hit(throwVel(personThrowS()), input.shift ? 18 : 12, 'Throw');
    if (headGrip && p.flight) { p.flight.seq.push('Head Grab'); p.flight.hits++; progress.unlock('headThrowCivilian'); }
    headGrip = false;
    p.headGrab = false;
    play('whoosh', 0.9); fx.pop(p.center, input.shift ? 'YEET!' : 'THROW', '#ffd84a', 34);
    shake = Math.max(shake, 0.25);
    people.witness(player.pos, 'person');
    return;
  }
  if (throwables.held) {
    player.play('throw', 0.35);
    const from = player.handWorld(new THREE.Vector3());
    throwables.throwHeld(from, throwVel(POOP_S));
    play('whoosh', 0.5, 1.3);
    return;
  }
  if (!dog.grabbed) return;
  const sprint = input.shift;
  const S = dogThrowS() * rand(0.97, 1.03);
  player.carrying = false;
  player.play('toss', 0.35);
  dog.launch(throwVel(S), 'Throw');
  if (headGrip && dog.launchInfo) { dog.launchInfo.seq.push('Head Grab'); dog.launchInfo.hits++; progress.unlock('headThrowDog'); }
  headGrip = false;
  dog.headGrab = false;
  if (grabHits > 0) { dog.launchInfo.hits += Math.min(grabHits, 8); dog.launchInfo.punches = grabHits; }
  dog.damage(sprint ? 18 : 13, 'Throw');
  angerOnHit(30);
  play('whoosh', 0.9); play('kick', 0.5, 1.3);
  shake = Math.max(shake, sprint ? 0.4 : 0.22);
  fx.pop(dog.pos, sprint ? 'YEET!' : 'THROW', '#ffd84a', sprint ? 40 : 32);
  if (sprint) { slowT = 0.18; startDogCam(); }
}
function grabPunch() {
  actionCd = 0.22; player.play('grabpunch', 0.22);
  if (carryRider) {
    const r = carryRider;
    schedule(0.07, () => {
      if (carryRider !== r) return;
      play('boing', 0.6);
      fx.pop(r.center, 'BONK!', '#ffffff', 24);
      fx.burst(r.center, 0.5);
    });
    return;
  }
  if (carryPerson) {
    const p = carryPerson;
    schedule(0.07, () => {
      if (carryPerson !== p) return;
      play('punch', 0.9, rand(0.9, 1.15));
      p.damage(5, 'Punch');
      fx.burst(p.center.clone(), 0.7);
      fx.pop(p.center, PUNCH_WORDS[(Math.random() * PUNCH_WORDS.length) | 0], '#ffffff', 24);
      if (Math.random() < 0.3) p.say(['OW!', 'STOP IT!', 'I LIVE IN MASSACHUSETTS!'][(Math.random() * 3) | 0], 1.5);
      shake = Math.max(shake, 0.14);
    });
    return;
  }
  schedule(0.07, () => {
    if (!dog.grabbed) return;
    play('punch', 0.9, rand(0.9, 1.15));
    dog.squash = 1; angerOnHit(12); grabHits++;
    dog.damage(4, 'Punch');
    const at = dog.pos.clone(); at.y += 0.15;
    fx.burst(at, 0.75);
    fx.puff(at, { color: 0xeac27e, n: 3, size: 0.1, spread: 1.4, up: 0.9, life: 0.4 });
    fx.pop(dog.pos, PUNCH_WORDS[(Math.random() * PUNCH_WORDS.length) | 0], '#ffffff', 24 + Math.min(grabHits, 8) * 2);
    shake = Math.max(shake, 0.14);
  });
}
function breakFree() {
  progress.unlock('knew');
  const f = fwd();
  dog.release(new THREE.Vector3(f.x * 2, 4.5, f.z * 2));
  player.carrying = false;
  dog.attackCd = 0.2;
  player.centerWorld(pc);
  player.hit(f.clone().multiplyScalar(-8).setY(5.5), 8);
  player.squash = 1;
  fx.burst(pc.clone().setY(pc.y + 0.3), 1);
  play('bark', 1); play('growl', 0.7);
  fx.pop(dog.pos, 'BREAKS FREE', '#ff7b4a', 32);
  shake = Math.max(shake, 0.35);
  toast('It broke free. You knew this would happen.', 2.5);
}
function placePoop() {
  const at = player.pos.clone().addScaledVector(fwd(), 1.1);
  const soft = throwables.held.soft;
  throwables.placeHeld(at);
  player.play('give', 0.3); play('splat', 0.5);
  const road = at.z > 16.9 && at.z < 27.1;
  fx.pop(at, soft && road ? 'SLIPPERY...' : 'PLACED', '#c8a070', 20);
  if (soft && road) toast('Soft poop in the road. Wait for a car.', 2.5);
  if (soft && road) progress.unlock('softRoadTrap');
}
function explode(pos, power = 1) {
  const radius = 7 * power;
  play('boom', 0.95);
  fx.flash(0.5); fx.burst(pos.clone().setY(pos.y + 0.6), 3 * power);
  fx.puff(pos.clone().setY(pos.y + 0.3), { color: 0x333333, n: 22, size: 0.6, spread: 3 * power, life: 1.4 });
  fx.pop(pos.clone().setY(pos.y + 1.5), 'KABOOM!', '#ffd84a', 48);
  shake = Math.max(shake, 0.8 * power);
  const impulse = (target) => {
    const diff = target.clone().sub(pos), d = diff.length();
    if (d >= radius) return null;
    diff.y = Math.max(0.5, diff.y);
    diff.normalize().multiplyScalar((12 + 20 * (1 - d / radius)) * power);
    diff.y = Math.max(9, diff.y + 7);
    return diff;
  };
  if (!dog.dead && !dog.locked && !dog.inside) {
    const v = impulse(dog.pos);
    if (v) { dog.launch(v, 'Bomb'); dog.damage(42 * power, 'Bomb'); angerOnHit(25); }
  }
  let crowd = 0;
  for (const p of people.list) {
    if (!p.hittable) continue;
    const v = impulse(p.center);
    if (v) { p.hit(v, 55 * power, 'Bomb'); crowd++; }
  }
  if (crowd >= 2) progress.unlock('bombCrowd');
  const pv = impulse(player.centerWorld(new THREE.Vector3()));
  if (pv) player.hit(pv, 32 * power);
  if (john.active) {
    const jv = impulse(john.pos);
    if (jv) john.hit(jv, 40 * power);
  }
  if (traffic.enabled) for (const car of traffic.cars) if (Math.hypot(car.x - pos.x, car.z - pos.z) < radius + 2) traffic.spinout(car, power);
  for (const r of ebikes.riders) if (r.mode === 'npc' && r.pos.distanceTo(pos) < radius && ebikes.knock(r)) progress.unlock('bombBike');
  people.witness(pos, 'bomb');
}
function fatalDogFall(d) {
  if (!d.fatalFall || d.dead) return;
  d.fatalFall = false;
  d.damage(999, 'Fall');
  fx.pop(d.pos, 'FALL DAMAGE!', '#ffd84a', 36);
  fx.burst(d.pos, 1.5);
}
function checkWindow(entity, old, velocity, dt, isDog = false) {
  if (isDog ? (!entity.air || entity.grabbed || entity.dead || entity.inside) : !entity.air) return;
  for (const w of world.windows) {
    if (w.broken > 0) continue;
    const offset = old.clone().sub(w.center);
    const front = offset.dot(w.normal);
    const toward = velocity.dot(w.normal);
    if (front < -0.1 || front > (w.name === 'your house' ? 1.15 : 3) || toward > -8) continue;
    if (front + toward * dt > (w.name === 'your house' ? 0.4 : 2.1)) continue;
    const at = old.clone().addScaledVector(velocity, dt * 0.5).sub(w.center);
    if (Math.abs(at.dot(w.right)) > w.w / 2 + 0.32 || Math.abs(at.y) > w.h / 2 + 0.45) continue;
    w.broken = 10; w.glass.visible = false;
    if (!isDog) {
      progress.unlock('civilianWindow');
      if (w.high) progress.unlock('civilianHighWindow');
    }
    fx.burst(w.center, 1.25);
    fx.pop(w.center, 'CRASH!', '#e4f8ff', 31);
    fx.puff(w.center, { color: 0xaadfff, n: 10, size: 0.13, spread: 1.3 });
    play('glass', 0.85);
    people.witness(w.center, isDog ? 'dog' : 'person');
    const launch = w.normal.clone().multiplyScalar(5 + Math.min(8, Math.abs(toward) * 0.25)).setY(w.high ? 2.5 : 4.8);
    if (isDog) {
      entity.inside = true; entity.root.visible = false;
      entity.vel.set(0, 0, 0);
      schedule(0.55, () => {
        if (entity.dead) { entity.inside = false; return; }
        entity.inside = false;
        entity.pos.copy(w.center).addScaledVector(w.normal, w.name === 'your house' ? 1.1 : 2.2);
        entity.fatalFall = w.high;
        entity.launch(launch, 'Window');
        fx.pop(entity.pos, 'JUMPS OUT!', '#ffffff', 27);
      });
    } else {
      entity.state = 'inside'; entity.root.visible = false;
      entity.vel.set(0, 0, 0);
      schedule(0.55, () => {
        if (entity.state !== 'inside') return;
        entity.center.copy(w.center).addScaledVector(w.normal, w.name === 'your house' ? 1.1 : 2.2);
        entity.pos.copy(entity.center).add(new THREE.Vector3(0, -0.95, 0));
        entity.root.visible = true;
        entity.launch(launch, 'Window');
        entity.fatalFall = w.high;
        fx.pop(entity.center, 'JUMPS OUT!', '#ffffff', 27);
      });
    }
    return;
  }
}
function bounceTrampoline(entity, isPlayer = false, isPerson = false) {
  const t = world.trampoline;
  const p = isPlayer ? (player.ragdoll ? player.rc : player.pos) : isPerson ? entity.center : entity.pos;
  const v = isPlayer ? (player.ragdoll ? player.rv : player.vel) : entity.vel;
  const floor = t.h + (isPlayer && !player.ragdoll ? 0 : isPerson ? 0.28 : 0.35);
  if (v.y >= -1 || p.y < floor - 0.3 || p.y > floor + 0.3 || Math.hypot(p.x - t.pos.x, p.z - t.pos.z) > t.r) return;
  p.y = floor;
  v.y = Math.max(12, -v.y * 1.55);
  if (!isPlayer && !isPerson) { entity.air = true; entity.hop = false; }
  if (isPlayer && !player.ragdoll) player.onGround = false;
  if (isPerson) {
    progress.unlock('trampolineCivilian');
    if (entity.flight) { entity.flight.seq.push('Trampoline'); entity.flight.hits++; }
  } else if (isPlayer) progress.unlock('trampolinePlayer');
  else {
    progress.unlock('trampolineDog');
    if (entity.launchInfo) { entity.launchInfo.seq.push('Trampoline'); entity.launchInfo.hits++; }
  }
  t.boing();
  play('boing', 0.85); fx.pop(p, 'BOING!', '#81ceff', 30);
}
function dogHitsPeople(oldDog, oldPeople, incoming, dt) {
  dog.personCd = Math.max(0, (dog.personCd || 0) - dt);
  if (!dog.air || dog.dead || dog.grabbed || dog.inside || dog.locked || dog.personCd > 0 || incoming.length() < 7) return;
  for (let i = 0; i < people.list.length; i++) {
    const p = people.list[i];
    if (!p.hittable || (p.dogImpactCd || 0) > 0) continue;
    const start = oldDog.clone().sub(oldPeople[i]);
    const movement = dog.pos.clone().sub(oldDog).sub(p.center.clone().sub(oldPeople[i]));
    const length2 = movement.lengthSq();
    const u = length2 > 0.00001 ? THREE.MathUtils.clamp(-start.dot(movement) / length2, 0, 1) : 0;
    const gap = start.addScaledVector(movement, u);
    const reach = p.kind === 'mother' ? 0.98 : 0.82;
    if (gap.lengthSq() > reach * reach) continue;
    p.dogImpactCd = 1.2; dog.personCd = 0.25;
    const side = p.center.clone().sub(dog.pos).setY(0);
    if (side.lengthSq() < 0.001) side.copy(incoming).setY(0);
    side.normalize();
    const force = Math.min(24, incoming.length());
    const shove = incoming.clone().multiplyScalar(0.55).addScaledVector(side, 7).setY(6 + force * 0.25);
    p.hit(shove, 12 + force * 0.6, 'Dog Collision');
    if (dog.launchInfo) {
      dog.launchInfo.hits++;
      dog.launchInfo.seq.push('Pedestrian');
      hooks.comboHit(dog);
    }
    dog.vel.addScaledVector(side, -force * 0.4).multiplyScalar(0.7);
    dog.vel.y = Math.max(4, dog.vel.y);
    dog.squash = 0.7;
    fx.burst(p.center, 1.2);
    fx.pop(p.center, 'DOG COLLISION!', '#ffd84a', 32);
    play('slam', 0.75); shake = Math.max(shake, 0.26);
    progress.unlock('dogPeople');
    progress.stat('dogPeopleHits');
    people.witness(p.pos, 'person');
    return;
  }
}
// Test the full path through each physics step so quick throws cannot pass between targets.
function sweptBodyHit(a0, a1, b0, b1, reach) {
  const start = a0.clone().sub(b0);
  const movement = a1.clone().sub(a0).sub(b1.clone().sub(b0));
  const length2 = movement.lengthSq();
  const u = length2 > 0.00001 ? THREE.MathUtils.clamp(-start.dot(movement) / length2, 0, 1) : 0;
  return start.addScaledVector(movement, u).lengthSq() <= reach * reach;
}
function civilianHitsCivilians(oldPeople, oldRiders) {
  for (let i = 0; i < people.list.length; i++) {
    const source = people.list[i];
    if (!source.air || source.civilianImpactCd > 0 || source.vel.length() < 6) continue;
    for (let j = 0; j < people.list.length; j++) {
      if (i === j) continue;
      const target = people.list[j];
      if (!target.hittable || target.civilianImpactCd > 0) continue;
      if (!sweptBodyHit(oldPeople[i], source.center, oldPeople[j], target.center, target.kind === 'mother' ? 0.95 : 0.8)) continue;
      const impulse = source.vel.clone().multiplyScalar(0.65).setY(Math.max(5, source.vel.y * 0.4 + 5));
      target.hit(impulse, 12, 'Civilian Collision');
      source.civilianImpactCd = 0.23; target.civilianImpactCd = 0.45;
      if (source.flight) { source.flight.seq.push('Civilian Collision'); source.flight.hits++; }
      source.vel.multiplyScalar(0.65); source.vel.y = Math.max(3, source.vel.y);
      fx.burst(target.center, 1); fx.pop(target.center, 'HUMAN BOWLING!', '#ffd84a', 29);
      play('slam', 0.7); shake = Math.max(shake, 0.2);
      progress.unlock('civilianToCivilian');
      if (progress.stat('civilianCollisionHits') >= 10) progress.unlock('civilianToCivilian10');
      if (source.flight && source.flight.seq.filter(k => k === 'Civilian Collision').length >= 2) progress.unlock('civilianMultiStrike');
      if (source.kind === 'mother' || target.kind === 'mother') progress.unlock('civilianMotherCollision');
      people.witness(target.pos, 'person');
      break;
    }
  }
  for (let i = 0; i < people.list.length; i++) {
    const source = people.list[i];
    if (!source.air || source.civilianImpactCd > 0 || source.vel.length() < 6) continue;
    for (let j = 0; j < ebikes.riders.length; j++) {
      const rider = ebikes.riders[j];
      if (rider.mode === 'player' || rider.riderState === 'held' || rider.riderState === 'hidden' || rider.impactCd > 0) continue;
      if (rider.mode === 'parked' && !rider.kid.visible) continue;
      if (!sweptBodyHit(oldPeople[i], source.center, oldRiders[j], rider.center, 0.85)) continue;
      if (!ebikes.hitRider(rider, source.vel.clone().multiplyScalar(0.6).setY(6), 'person')) continue;
      source.civilianImpactCd = 0.3;
      if (source.flight) { source.flight.seq.push('E-Bike Rider'); source.flight.hits++; }
      source.vel.multiplyScalar(0.65); source.vel.y = Math.max(3, source.vel.y);
      fx.burst(rider.center, 1); play('boing', 0.7);
      progress.unlock('civilianToRider');
      if (progress.stat('civilianRiderHits') >= 5) progress.unlock('civilianToRider5');
      people.witness(rider.pos, 'person');
      break;
    }
  }
  for (let j = 0; j < ebikes.riders.length; j++) {
    const rider = ebikes.riders[j];
    if (rider.riderState !== 'air' || rider.impactCd > 0 || rider.riderVel.length() < 6) continue;
    for (let i = 0; i < people.list.length; i++) {
      const target = people.list[i];
      if (!target.hittable || target.civilianImpactCd > 0) continue;
      if (!sweptBodyHit(oldRiders[j], rider.center, oldPeople[i], target.center, target.kind === 'mother' ? 0.95 : 0.8)) continue;
      target.hit(rider.riderVel.clone().multiplyScalar(0.7).setY(6), 12, 'Rider Collision');
      target.civilianImpactCd = 0.45;
      rider.impactCd = 0.25; rider.riderVel.multiplyScalar(0.6); rider.riderVel.y = Math.max(3, rider.riderVel.y);
      fx.burst(target.center, 1.1); fx.pop(target.center, 'BIKE KID BOWLING!', '#ffd84a', 28);
      play('boing', 0.8); shake = Math.max(shake, 0.2);
      progress.unlock('riderToCivilian');
      if (progress.stat('riderCivilianHits') >= 5) progress.unlock('riderToCivilian5');
      if (target.kind === 'mother') progress.unlock('riderHitsMother');
      people.witness(target.pos, 'person');
      break;
    }
  }
}
function updateGrab(dt) {
  if (carryRider) {
    player.carrying = true;
    if (player.ragdoll || player.ko > 0 || carryRider.riderState !== 'held') dropDog();
    return;
  }
  if (carryPerson) {
    player.carrying = true;
    if (player.ragdoll || player.ko > 0 || !carryPerson.grabbed) dropDog();
    return;
  }
  player.carrying = dog.grabbed;
  if (!dog.grabbed) return;
  grabT += dt;
  if (player.ragdoll || player.ko > 0) { dropDog(); return; }
  if (dog.angry && grabT > 0.5) {
    const rate = 0.3 + Math.min(0.9, (-dog.mood - 25) / 90);
    if (Math.random() < rate * dt) breakFree();
  }
}

// ---------- Kiss ----------
const KISS_LINES = [
  'A kiss on the head. It pretends not to care. It cares.',
  'It leans into it. Just a little.',
  'For one second, everything is fine.',
  'Soft head. Good dog. Allegedly.',
];
function aimingAtHead(target = dog) {
  const h = target.head.getWorldPosition(new THREE.Vector3());
  h.y += 0.08;
  player.centerWorld(pc);
  if (pc.distanceTo(h) > 2.1) return false;
  const dir = camera.getWorldDirection(tmpV2);
  const w = h.sub(camera.position);
  const t = w.dot(dir);
  if (t < 0) return false;
  return w.addScaledVector(dir, -t).length() < 0.5;
}

// ---------- Seasons ----------
const SEASONS = ['default', 'spring', 'summer', 'winter'];
const SEASON_NAME = { default: 'Default', spring: 'Spring', summer: 'Summer', winter: 'Winter' };
const SEASON_LINES = {
  default: 'Back to normal. Whatever normal is around here.',
  spring: 'Spring. The flies are back. The dog is thrilled.',
  summer: 'Heatwave. The Family Dog is panting. Keep its bowl full.',
  winter: 'Winter. Snowballs are in your hotbar. Hold B to build a wall.',
};
function setSeason(n, announce) {
  progress.seasonSeen(n);
  season = n; save.season = n; persist();
  world.setSeason(n, renderer);
  $('heat').classList.toggle('on', n === 'summer');
  if (n !== 'winter') snow.clear();
  if (selId === 'snowball' && n !== 'winter') selId = 'kick';
  if (n === 'winter' && announce) selId = 'snowball';
  save.selectedTool = selId; persist();
  rebuildHotbar();
  $('season').innerHTML = `${SEASON_NAME[n]} <kbd>T</kbd>`;
  if (announce) toast(SEASON_LINES[n], 3.5);
}

// ---------- Snow ----------
const snow = new Snow(scene, {
  hitDog(v, p) {
    if (dog.dead) return;
    play('splat', 0.8);
    fx.puff(p, { color: 0xffffff, n: 8, size: 0.16, spread: 1.6, up: 1, life: 0.6 });
    fx.burst(p, 0.5);
    fx.pop(dog.pos, ['SPLAT', 'POOF', 'BONK', 'FWUMP'][(Math.random() * 4) | 0], '#e8f4ff', 26);
    dog.squash = 0.8; shake = Math.max(shake, 0.08);
    if (dog.grabbed) return;
    if (dog.air && dog.launchInfo) {
      dog.vel.addScaledVector(v.normalize(), 3); dog.launchInfo.hits++;
      dog.launchInfo.seq.push('Snowball'); hooks.comboHit(dog);
    }
    else if (!dog.air && dog.stuck <= 0 && dog.ko <= 0) { dog.mood -= 7; dog.doHop(v.setY(0).normalize(), 2.5, 1.5); }
    dog.damage(4, 'Snowball');
  },
  hitPerson(p, v, at) {
    p.hit(v.normalize().multiplyScalar(5).setY(3), 5, 'Snowball');
    fx.puff(at, { color: 0xffffff, n: 8, size: 0.15 });
    fx.pop(p.center, 'SPLAT!', '#e8f4ff', 25);
    play('splat', 0.7);
    people.witness(at, 'person');
  },
  splat(p) { play('splat', 0.35, 1.2); fx.puff(p, { color: 0xffffff, n: 4, size: 0.12, spread: 1, up: 0.6, life: 0.45 }); },
  placed(p) { play('crunch', 0.5); fx.puff(p, { color: 0xffffff, n: 4, size: 0.2, spread: 0.8, up: 0.5, life: 0.5 }); },
  smashed(p) { play('crunch', 0.8, 0.8); fx.puff(p, { color: 0xffffff, n: 8, size: 0.3, spread: 1.8, up: 1.2, life: 0.8 }); },
});
let buildT = 0, buildWarnT = 0;
function updateBuild(dt) {
  if (!(input.b && season === 'winter' && canAct() && !dog.grabbed)) { buildT = 0; return; }
  buildT -= dt; buildWarnT -= dt;
  if (buildT > 0) return;
  buildT = 0.28;
  const at = player.pos.clone().addScaledVector(fwd(), 1.5);
  const res = snow.place(at, [{ pos: player.pos, r: 0.4, h: 1.9 }, { pos: dog.pos, r: 0.45, h: 0.5 }]);
  if (res === 'ok') { player.play('give', 0.25); progress.stat('blocks'); }
  else if (buildWarnT <= 0 && res !== 'blocked') { buildWarnT = 2; toast(res === 'road' ? 'Not on the road.' : 'That stack is tall enough.', 1.3); }
}

// ---------- Spring bugs ----------
const bugs = new Bugs(scene);
function updateBugs(dt) {
  const on = season === 'spring';
  if (on) bugs.sync([world.trashPos, world.bowlPos, ...throwables.poops.filter((q) => q.state === 'ground').map((q) => q.g.position)]);
  bugs.update(dt, on);
}

// ---------- Traffic ----------
const PLAYER_CAR_LINES = [
  'You got hit by a car. Walk it off.',
  'The car did not stop. Nobody around here stops.',
  'Hit by a car. The dog saw the whole thing and felt nothing.',
];
const DOG_CAR_LINES = [
  'The Family Dog didn\'t look both ways. Typical.',
  'The driver didn\'t even slow down. Honestly, fair.',
  'It\'s fine. It bounced.',
];
let lastNear = -9;
const traffic = new Traffic(scene, {
  hitPlayer(v) {
    if (dog.grabbed) { dog.launch(v.clone().multiplyScalar(1.1), 'Traffic'); fx.pop(dog.pos, 'FUMBLE', '#fff', 24); }
    player.hit(v, 0);
    player.squash = 1;
    player.centerWorld(pc);
    fx.burst(pc, 1.4); fx.flash(0.35);
    fx.pop(pc, 'HONK!', '#ffd84a', 38);
    play('horn', 0.8); play('slam', 0.8);
    shake = Math.max(shake, 0.55);
    progress.addCoins(5); progress.unlock('jaywalker'); progress.stat('carHitsMe');
    schedule(0.6, () => { fx.pop(player.centerWorld(new THREE.Vector3()), 'CLOSE CALL +5', '#ffd84a', 24); play('coins', 0.5); });
    toast(PLAYER_CAR_LINES[(Math.random() * PLAYER_CAR_LINES.length) | 0], 3);
    lastNear = elapsed;
  },
  hitDog(v) {
    if (dog.dead) return;
    progress.unlock('lookboth');
    dog.launch(v, 'Traffic');
    dog.damage(35, 'Traffic');
    dog.squash = 1; dog.mood -= 15;
    fx.burst(dog.pos, 1.4); fx.flash(0.25);
    fx.pop(dog.pos, 'HONK!', '#ffd84a', 40);
    play('horn', 0.8); play('slam', 0.9); play('whoosh', 0.7);
    shake = Math.max(shake, 0.5); slowT = 0.2;
    if (canAct()) startDogCam();
    toast(DOG_CAR_LINES[(Math.random() * DOG_CAR_LINES.length) | 0], 3.5);
  },
  hitJohn(v) {
    john.hit(v, 35);
    fx.burst(john.pos.clone().setY(1.2), 1.2);
    fx.pop(john.pos, 'HONK!', '#ffd84a', 36);
    play('horn', 0.7); play('slam', 0.7); shake = Math.max(shake, 0.3);
  },
  nearMiss() {
    if (elapsed - lastNear < 1.5 || player.hurtCd > -0.5) return;
    lastNear = elapsed;
    progress.addCoins(3); progress.stat('nearMiss');
    fx.pop(player.pos.clone().setY(1.6), 'CLOSE CALL +3', '#ffd84a', 24);
    play('coins', 0.4);
  },
  honk() { play('horn', 0.55); },
  hitPerson(p, v) {
    if (p.grabbed) return;
    p.hit(v, 45, 'Traffic');
    fx.burst(p.center.clone(), 1.3);
    fx.pop(p.center, 'HONK!', '#ffd84a', 36);
    play('horn', 0.7); play('slam', 0.8);
    shake = Math.max(shake, 0.3);
  },
  say(c, text) { fx.bubble(c, text, 2.8); },
  spotted(c, t) { if (Math.random() < 0.5) play('horn', 0.4, 1.2); if (Math.random() < 0.35) fx.bubble(c, ['FLOOR IT!', 'I SEE IT!', 'TEN POINTS!', 'WATCH THIS!'][(Math.random() * 4) | 0], 2); },
  spinout(c) {
    play('screech', 0.9);
    fx.pop(c.pos.clone().setY(1.5), 'SPUN OUT!', '#ffd84a', 34);
    fx.bubble(c, ['WHOA WHOA WHOA', 'AAAAAAA', 'IS THAT POOP?!', 'I love Choosin\' Texaaaaas!'][(Math.random() * 4) | 0], 2.5);
    progress.addCoins(8);
    toast('The car slipped on the poop and lost it. +8', 2.5);
  },
});
traffic.setEnabled(save.trafficEnabled !== false);

// ---------- Glue spray ----------
let glueAcc = 0, squirtT = 0;
function updateGlue(dt) {
  player.spraying = selId === 'glue' && mouseHeld && canAct();
  if (!player.spraying) return;
  glueAcc += dt;
  const from = player.handWorld(new THREE.Vector3());
  from.addScaledVector(aimDir(), 0.2);
  const dir = aimDir();
  while (glueAcc > 1 / 60) { glueAcc -= 1 / 60; fx.sprayGlue(from, dir); }
  squirtT -= dt;
  if (squirtT <= 0) { squirtT = 0.35; play('squirt', 0.45); }
}

// ---------- Chain ----------
const CHAIN_L = 5.5, CN = 20;
let chained = false;
const chainPts = Array.from({ length: CN }, () => ({ p: new THREE.Vector3(), o: new THREE.Vector3() }));
const linkGeo = new THREE.TorusGeometry(0.06, 0.018, 6, 12);
const chainMesh = new THREE.InstancedMesh(linkGeo, std(0x9aa0a6, { metalness: 0.9, roughness: 0.35 }), CN - 1);
chainMesh.castShadow = true; chainMesh.visible = false; chainMesh.frustumCulled = false;
scene.add(chainMesh);
function setChain(on) {
  chained = on; chainMesh.visible = on;
  if (on) {
    const a = player.handWorld(new THREE.Vector3()), b = dog.neckWorld(new THREE.Vector3());
    chainPts.forEach((c, i) => { c.p.lerpVectors(a, b, i / (CN - 1)); c.o.copy(c.p); });
    play('punch', 0.4, 1.6);
  }
}
function movePlayer(v) { if (player.ragdoll) player.rc.add(v); else player.pos.add(v); }
function chainConstraint() {
  if (!chained) return;
  player.centerWorld(pc);
  const d = tmpV.subVectors(dog.pos, pc);
  const len = d.length();
  if (len <= CHAIN_L) return;
  const n = d.divideScalar(len), ex = len - CHAIN_L;
  const flying = dog.air && !dog.hop;
  let pv = player.ragdoll ? player.rv : player.vel;
  const vr = dog.vel.dot(n) - pv.dot(n);
  if (dog.stuck > 0) {
    movePlayer(n.clone().multiplyScalar(ex));
    if (vr < 0) pv.addScaledVector(n, -vr);
  } else if (flying) {
    if (!player.ragdoll && vr > 4) { player.enterRagdoll(pv.clone(), false); player.knockT = 1.8; pv = player.rv; fx.pop(pc, 'YANK', '#fff', 26); }
    if (vr > 0) { dog.vel.addScaledVector(n, -vr * 0.55); pv.addScaledVector(n, vr * 0.45); }
    dog.pos.addScaledVector(n, -ex * 0.5);
    movePlayer(n.clone().multiplyScalar(ex * 0.5));
  } else if (player.ragdoll) {
    movePlayer(n.clone().multiplyScalar(ex));
    if (vr > 0) pv.addScaledVector(n, vr);
  } else {
    dog.pos.addScaledVector(n, -ex);
  }
}
function updateChainRope(dt) {
  if (!chained) return;
  const a = player.handWorld(new THREE.Vector3()), b = dog.neckWorld(new THREE.Vector3());
  const seg = CHAIN_L / (CN - 1);
  const g = 9.8 * dt * dt;
  for (let i = 1; i < CN - 1; i++) {
    const c = chainPts[i];
    tmpV.subVectors(c.p, c.o).multiplyScalar(0.96);
    c.o.copy(c.p);
    c.p.add(tmpV); c.p.y -= g;
  }
  chainPts[0].p.copy(a); chainPts[CN - 1].p.copy(b);
  for (let it = 0; it < 12; it++) {
    for (let i = 0; i < CN - 1; i++) {
      const p1 = chainPts[i].p, p2 = chainPts[i + 1].p;
      tmpV.subVectors(p2, p1);
      const l = tmpV.length() || 1e-4;
      if (l <= seg) continue;
      const corr = tmpV.multiplyScalar((l - seg) / l);
      if (i === 0) p2.sub(corr);
      else if (i + 1 === CN - 1) p1.add(corr);
      else { p1.addScaledVector(corr, 0.5); p2.addScaledVector(corr, -0.5); }
    }
    for (let i = 1; i < CN - 1; i++) if (chainPts[i].p.y < 0.03) chainPts[i].p.y = 0.03;
  }
  const dmy = new THREE.Object3D(), Y = new THREE.Vector3(0, 1, 0), qr = new THREE.Quaternion().setFromAxisAngle(Y, Math.PI / 2);
  for (let i = 0; i < CN - 1; i++) {
    const p1 = chainPts[i].p, p2 = chainPts[i + 1].p;
    dmy.position.lerpVectors(p1, p2, 0.5);
    tmpV.subVectors(p2, p1);
    const l = tmpV.length() || 1e-4;
    dmy.quaternion.setFromUnitVectors(Y, tmpV.divideScalar(l));
    if (i % 2) dmy.quaternion.multiply(qr);
    dmy.scale.set(1, Math.max(1, l / 0.12) * 1.1, 1);
    dmy.updateMatrix();
    chainMesh.setMatrixAt(i, dmy.matrix);
  }
  chainMesh.instanceMatrix.needsUpdate = true;
}

// ---------- Rating ----------
function grade(v, table) { for (const [t, g] of table) if (v >= t) return g; return 'D'; }
function awardFinish(d, flight) {
  if (!d.dead || d.finishPaid) return;
  d.finishPaid = true;
  const finish = rateFinish({ kind: d.finishKind, flight, pos: d.pos, shotDistance: d.finishShotDistance || 0, airborne: d.finishAirborne });
  const variety = save.lastFinishKind && save.lastFinishKind !== d.finishKind ? 12 : 0;
  const coins = finish.coins + variety;
  save.lastFinishKind = d.finishKind;
  const count = progress.finishStat();
  progress.addCoins(coins);
  for (const style of finish.styles) progress.unlock(style.id);
  if (finish.styles.length > (save.bestFinishStyles || 0)) save.bestFinishStyles = finish.styles.length;
  persist();
  const extra = [
    ...finish.styles.map(s => `${s.name} +${s.coins}`),
    variety ? 'new finishing move +12' : '',
    `defeat #${count}`,
  ].filter(Boolean).join(' · ');
  showResult('FINISH', finish.name.toUpperCase(), '★', coins, extra, finish.styles.length > 1 ? `${finish.styles.length} STYLE BONUSES` : '');
  fx.pop(d.pos, `+${coins} COINS`, '#ffe477', 31);
  play('coins', 1);
}
function onDogLand(d) {
  const L = d.launchInfo;
  d.launchInfo = null;
  if (dogCam) dogCamHold = 1.8;
  if (!L) { awardFinish(d, null); return; }
  const out = !insideYard(d.pos);
  const dist = Math.hypot(d.pos.x - L.from.x, d.pos.z - L.from.z);
  const combos = progress.findCombos({ L, seq: L.seq || [L.kind], out, dist, pos: d.pos });
  const bonus = combos.reduce((sum, c) => sum + c.bonus, 0);
  const mult = (L.angry ? 1.5 : 1) * (L.hits > 1 ? 1.25 : 1) * (1 + combos.length * 0.25);
  const extras = [];
  if (L.angry) extras.push('angry bonus x1.5');
  if (L.hits > 1) extras.push(`${L.hits}-hit chain x1.25`);
  if (combos.length) extras.push(`${combos.map(c => c.name).join(' + ')} · +${bonus} combo coins · x${(1 + combos.length * 0.25).toFixed(2)}`);
  if (out) {
    progress.unlock('liftoff');
    if (dist >= 50) progress.unlock('flyer50');
    if (dist >= 100) progress.unlock('orbit');
    if (L.seq?.[0] === 'Throw') progress.unlock('yeet');
  }
  if (L.maxH >= 30 && (L.seq || []).includes('Uppercut')) progress.unlock('sky');
  const reward = (title, value, rank, base) => {
    const coins = base + bonus;
    progress.addCoins(coins);
    if (rank === 'S' || rank === 'SSS') progress.unlock('srank');
    showResult(title, value, rank, coins, extras.join(' · '), combos.map(c => c.name).join(' + '));
    play('coins', 0.9);
    awardFinish(d, L);
    if (out) returnDogSoon();
  };
  if (L.kind === 'Traffic') {
    const assist = (L.seq || []).some(k => k !== 'Traffic');
    extras.push(assist ? 'traffic assist +15' : 'hit by a car +5');
    if (dist > (save.bestTraffic || 0)) { save.bestTraffic = dist; extras.push('new best traffic'); }
    reward(assist ? 'TRAFFIC ASSIST' : 'HIT BY A CAR', dist.toFixed(1) + ' m', grade(dist, [[60, 'S'], [42, 'A'], [28, 'B'], [16, 'C']]), Math.max(3, Math.round(dist * mult)) + (assist ? 15 : 5));
    return;
  }
  if (L.kind === 'Uppercut' && L.maxH > 5) {
    const h = L.maxH;
    const newBest = h > save.bestH;
    if (newBest) { save.bestH = h; extras.push('new best height'); }
    reward('HEIGHT', h.toFixed(1) + ' m', grade(h, [[45, 'S'], [34, 'A'], [24, 'B'], [15, 'C']]), Math.round(h * 1.2 * mult));
    return;
  }
  if (!out) {
    if (combos.length) reward('COMBO!', `${combos.length} FOUND`, '', Math.max(1, Math.round(dist * mult)));
    else awardFinish(d, L);
    return;
  }
  if (dist > save.best) { save.best = dist; extras.push('new best distance'); }
  reward(L.kind.toUpperCase(), dist.toFixed(1) + ' m', grade(dist, [[110, 'SSS'], [85, 'S'], [65, 'A'], [45, 'B'], [28, 'C']]), Math.max(1, Math.round(dist * mult)));
}
function returnDogSoon() {
  schedule(2.6, () => {
    if (insideYard(dog.pos) || dog.air || dog.dead) return;
    fx.puff(dog.pos.clone(), { n: 10, size: 0.4 });
    dog.teleportHome();
    fx.puff(dog.pos.clone(), { n: 10, size: 0.4 });
    play('poof', 0.6);
    fx.pop(dog.pos, 'back home', '#fff', 18);
    if (chained) { setChain(false); toast('The chain snapped.', 2); }
  });
}

// ---------- Labels ----------
const dogTag = document.createElement('div');
dogTag.className = 'tag3d';
dogTag.innerHTML = '<div class="ico"></div><div class="nm">The Family Dog</div>';
$('labels').appendChild(dogTag);
const johnTag = document.createElement('div');
johnTag.className = 'tag3d';
johnTag.innerHTML = '<div class="nm" style="color:#9fd0ff">John</div>';
$('labels').appendChild(johnTag);
const proj = {};
function updateTags() {
  const ico = dogTag.firstChild;
  let symbol = '', color = '#fff';
  if (dog.dead || dog.ko > 0) { symbol = 'zzz'; }
  else if (dog.grabbed) { symbol = dog.angry ? '!!' : '?'; color = dog.angry ? '#ff4a3a' : '#fff'; }
  else if (dog.stuck > 0) { symbol = 'stuck'; color = '#f4f1e2'; }
  else if (dog.love > 0) { symbol = '♥'; color = '#ff5d8f'; }
  else if (dog.angry) { symbol = '!!'; color = '#ff4a3a'; }
  else if (dog.sick > 0) { symbol = '~ ~'; color = '#9ac23a'; }
  else if (dog.happy > 0 || dog.mood > 50) { symbol = '♪'; color = '#ffe07a'; }
  ico.textContent = symbol; ico.style.color = color;
  fx.project(tmpV.copy(dog.pos).setY(dog.pos.y + 1.05), proj);
  const distance = camera.position.distanceTo(dog.pos);
  dogTag.style.display = proj.vis && distance < 45 ? '' : 'none';
  dogTag.style.left = proj.x + 'px'; dogTag.style.top = proj.y + 'px';
  if (john.active) {
    fx.project(tmpV.copy(john.pos).setY(john.pos.y + 2), proj);
    johnTag.style.display = proj.vis ? '' : 'none';
    johnTag.style.left = proj.x + 'px'; johnTag.style.top = proj.y + 'px';
  } else johnTag.style.display = 'none';
}

// ---------- HUD ----------
let hudT = 0;
function updateHUD(dt) {
  hudT -= dt;
  if (hudT > 0) return;
  hudT = 0.1;
  const trackedDog = interactionDog(4.5) || dog;
  $('dogName').textContent = trackedDog.name;
  $('dogName').style.color = '#ffd27a';
  $('moodMark').style.left = ((trackedDog.mood + 100) / 2) + '%';
  $('dogHp').style.width = Math.max(0, trackedDog.health) + '%';
  $('healthMode').classList.toggle('hidden', !save.infiniteHealth);
  $('trafficMode').classList.toggle('hidden', save.trafficEnabled);
  $('loveMode').classList.toggle('hidden', !save.infiniteLove);
  const tags = [];
  if (trackedDog.dead) tags.push(['Defeated', '']);
  else if (trackedDog.ko > 0) tags.push(['Passed out', '']);
  if (trackedDog.infiniteLove) tags.push(['Loves you forever', 'love']);
  else if (trackedDog.love > 0) tags.push(['Loves you', 'love']);
  if (trackedDog.fear) tags.push([trackedDog.fear === 'cry' ? 'Crying inside PETA' : 'Scared of PETA', 'sick']);
  else if (trackedDog.sad > 0) tags.push(['Sad about Obese Sonic', 'sick']);
  if (trackedDog.blind > 0) tags.push([trackedDog.blindHard ? 'Blinded by hard poop' : 'Blinded by soft poop', 'stuck']);
  else if (trackedDog.angry) tags.push(['Angry', 'angry']);
  else if (trackedDog.mood > 50 || trackedDog.happy > 0) tags.push(['Happy', 'happy']);
  if (trackedDog.sick > 0) tags.push([trackedDog.sickKind === 'milk' ? 'Lactose poisoning' : 'Medical problems', 'sick']);
  if (trackedDog.stuck > 0) tags.push(['Stuck', 'stuck']);
  else if (trackedDog.glue > 0.1) tags.push(['Sticky', 'stuck']);
  if (trackedDog.chew > 0) tags.push(['Chewing bone', 'happy']);
  if (chained && trackedDog === dog) tags.push(['Chained to you', '']);
  if (trackedDog.grabbed) tags.push(['Being held', '']);
  if (trackedDog.distract > 0) tags.push(['Distracted by a bug', '']);
  if (season === 'summer') tags.push(trackedDog.thirst < 35 ? ['Parched', 'angry'] : ['Panting', '']);
  if (trackedDog.lactoseKnown) tags.push([trackedDog.lactose ? 'Lactose intolerant' : 'Not lactose intolerant', '']);
  $('tags').innerHTML = tags.map(([t, c]) => `<b class="${c}">${t}</b>`).join('');
  $('thirstRow').style.display = season === 'summer' ? '' : 'none';
  $('dogTh').style.width = trackedDog.thirst + '%';
  $('coins').textContent = save.coins;
  $('finishes').textContent = save.stats?.finishes ? `${save.stats.finishes} finishes · best ${save.bestFinishStyles || 0} styles` : '';
  $('ammo').classList.toggle('hidden', selId !== 'pistol');
  $('ammo').textContent = reloadT > 0 ? 'RELOADING...' : `${pistolAmmo} / ${MAG_SIZE}  ·  G reload`;
  const flight = trackedDog === dog && dog.air && dog.launchInfo;
  $('comboLive').textContent = flight && flight.hits > 1 ? `${flight.hits} HIT COMBO` : '';
  $('best').textContent = [save.best ? `best ${save.best.toFixed(1)} m` : '', save.bestH ? `height ${save.bestH.toFixed(1)} m` : '', save.bestTraffic ? `traffic ${save.bestTraffic.toFixed(1)} m` : ''].filter(Boolean).join(' · ');
  $('phpFill').style.width = player.hp + '%';
  $('php').style.opacity = player.hp < 100 || save.infiniteHealth ? 1 : 0;
  const nearbyDogTarget = interactionDog(2.6);
  let pr = '';
  if (player.ko > 0) pr = 'Knocked out...';
  else if (player.ragdoll && player.voluntary) pr = '<kbd>R</kbd> get up';
  else if (ebikes.riding) pr = '<kbd>WASD</kbd> ride · <kbd>F</kbd> park bike';
  else if (nearStation()) pr = `<kbd>E</kbd> ${nearStation().name}`;
  else if (dog.grabbed || carryPerson || carryRider) pr = '<kbd>Click</kbd> punch · <kbd>Q</kbd> aim and throw · release <kbd>F</kbd> to drop';
  else if (throwables.held) pr = '<kbd>Click</kbd> place poop · <kbd>Q</kbd> aim and throw';
  else if (ebikes.nearbyRider(player.pos)) pr = '<kbd>F</kbd> pick up rider · <kbd>Q</kbd> throw into civilians';
  else if (ebikes.nearest(player.pos, 2)) pr = `<kbd>F</kbd> ${ebikes.nearest(player.pos, 2).mode === 'parked' ? 'ride unattended e-bike' : 'pull rider off e-bike'}`;
  else if (throwables.nearestPoop(player.pos, 1.6)) pr = '<kbd>F</kbd> pick up poop · <kbd>Q</kbd> throw';
  else if (nearShop() && !shopOpen) pr = '<kbd>E</kbd> Shop';
  else if (selId === 'knife') pr = touchMode
    ? '<small><kbd>USE</kbd> stab · <kbd>RUN</kbd> + USE slice</small>'
    : '<small><kbd>Right Click</kbd> stab · <kbd>Shift</kbd> + Right Click slice</small>';
  else if (nearbyDogTarget) {
    const target = nearbyDogTarget;
    const tool = ALL.find(item => item.id === selId)?.name || 'item';
    const directDogTools = ['pet', 'kiss', 'ball', 'burger', 'milk', 'bone', 'grapes', 'chocolate', 'yogurt'];
    pr = selId === 'kibble'
      ? `<small>Take Feed to the bowl for ${target.name}</small>`
      : directDogTools.includes(selId)
        ? `<small><kbd>Click</kbd> ${tool} with ${target.name}</small>`
        : `<small>Nearby: ${target.name} · try Pet, Kiss, Ball, or a treat</small>`;
  }
  else if (selId === 'snowball') pr = '<small>hold <kbd>B</kbd> to build a wall</small>';
  $('prompt').innerHTML = pr;
}

// ---------- Ball physics ----------
function updateBall(dt) {
  if (ball.state === 'free') {
    ball.freeT += dt;
    ball.vel.y -= G * dt;
    ball.pos.addScaledVector(ball.vel, dt);
    collideSphere(ball.pos, 0.085, ball.vel, 0.6, 0.9);
    if (ball.pos.y < 0.085) {
      ball.pos.y = 0.085;
      if (ball.vel.y < 0) ball.vel.y = -ball.vel.y * 0.55;
      if (ball.vel.y < 0.6) ball.vel.y = 0;
      ball.vel.x *= 1 - dt * 1.5; ball.vel.z *= 1 - dt * 1.5;
    }
    if (ball.freeT > 1 && player.pos.distanceTo(tmpV.copy(ball.pos).setY(0)) < 1.1 && !player.ragdoll) { ball.state = 'player'; refreshHeld(); }
    if (ball.pos.length() > 200) { ball.state = 'player'; refreshHeld(); }
  }
  if (ball.state === 'dog') dog.mouthWorld(ball.pos);
  ball.mesh.visible = ball.state === 'free' || ball.state === 'dog';
  ball.mesh.position.copy(ball.pos);
  if (ball.state === 'free') ball.mesh.rotation.x += ball.vel.length() * dt * 5;
}

// ---------- Camera ----------
const camNormal = new THREE.Vector3(), lookNormal = new THREE.Vector3();
const camDog = new THREE.Vector3(), lookDog = new THREE.Vector3();
const dogCamOff = new THREE.Vector3(0, 3, -8);
let camBlend = 0;
function updateCamera(dt, realDt) {
  const f = new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw));
  const right = new THREE.Vector3(-Math.cos(camYaw), 0, Math.sin(camYaw));
  player.centerWorld(lookNormal).y += 0.65;
  const dist = 4.6;
  camNormal.copy(lookNormal).addScaledVector(f, -Math.cos(camPitch) * dist).addScaledVector(right, 0.6);
  camNormal.y += Math.sin(camPitch) * dist;
  lookNormal.addScaledVector(right, 0.6);
  if (camNormal.y < 0.3) camNormal.y = 0.3;
  if (camNormal.z < -11.6 && Math.abs(camNormal.x) < 14.4 && camNormal.y < 9.5) camNormal.z = -11.6;

  if (dogCam) {
    const hv = tmpV.set(dog.vel.x, 0, dog.vel.z);
    if (hv.lengthSq() > 4) dogCamOff.lerp(hv.normalize().multiplyScalar(-8).setY(3.2), 1 - Math.exp(-2 * realDt));
    camDog.copy(dog.pos).add(dogCamOff);
    if (camDog.y < 0.5) camDog.y = 0.5;
    lookDog.copy(dog.pos);
    if (!dogCamManual && !dog.air && dog.launchInfo === null) {
      dogCamHold -= realDt;
      if (dogCamHold <= 0) dogCam = 0;
    }
  }
  camBlend += ((dogCam ? 1 : 0) - camBlend) * Math.min(1, realDt * (dogCam ? 3 : 9));
  const e = camBlend * camBlend * (3 - 2 * camBlend);
  camera.position.lerpVectors(camNormal, camDog, e);
  const look = tmpV2.lerpVectors(lookNormal, lookDog, e);
  if (shake > 0) {
    camera.position.x += rand(-1, 1) * shake * 0.3;
    camera.position.y += rand(-1, 1) * shake * 0.3;
    shake = Math.max(0, shake - realDt * 1.5);
  }
  camera.lookAt(look);
}

// ---------- Main loop ----------
const clock = new THREE.Clock();
let elapsed = 0;
function frame() {
  requestAnimationFrame(frame);
  const realDt = Math.min(0.05, clock.getDelta());
  let scale = 1;
  if (slowT > 0) { slowT -= realDt; scale = 0.25; }
  const dt = realDt * scale;
  elapsed += dt;
  actionCd -= realDt;

  for (let i = scheduled.length - 1; i >= 0; i--) {
    scheduled[i].t -= dt;
    if (scheduled[i].t <= 0) { const fn = scheduled[i].fn; scheduled.splice(i, 1); fn(); }
  }

  const controllable = locked && !shopOpen && !achOpen;
  if (ebikes.riding && (player.ragdoll || player.ko > 0 || dog.grabbed || carryPerson || carryRider)) ebikes.park();
  player.speedMul = ebikes.riding ? 2.15 : 1;
  if (reloadT > 0) { reloadT -= realDt; if (reloadT <= 0) { reloadT = 0; pistolAmmo = MAG_SIZE; save.pistolAmmo = pistolAmmo; persist(); } }
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const sd = dt / steps;
  const ctx = { player, john, ball, fx, season, bugs: season === 'spring' ? bugs.swarms : null };
  for (let i = 0; i < steps; i++) {
    const dogOld = dog.pos.clone(), dogVel = dog.vel.clone();
    const peopleOld = people.list.map(p => p.center.clone());
    const peopleVel = people.list.map(p => p.vel.clone());
    const riderOld = ebikes.riders.map(r => r.center);
    player.update(sd, ebikes.riding ? { ...input, space: false } : input, camYaw, controllable);
    dog.update(sd, ctx);
    if (dog.air) checkWindow(dog, dogOld, dogVel, sd, true);
    bounceTrampoline(dog);
    john.update(sd, dog);
    people.update(sd, { playerPos: player.pos, dog, player });
    ebikes.updateRiders(sd, player);
    dogHitsPeople(dogOld, peopleOld, dogVel, sd);
    civilianHitsCivilians(peopleOld, riderOld);
    for (let n = 0; n < people.list.length; n++) {
      const p = people.list[n];
      if (p.air) { checkWindow(p, peopleOld[n], peopleVel[n], sd); bounceTrampoline(p, false, true); }
    }
    bounceTrampoline(player, true);
    updateBall(sd);
    chainConstraint();
    updateGrab(sd);
  }
  const playerPos = player.ragdoll ? player.rc : player.pos;
  ebikes.update(dt, player, dog.pos);
  if (dog.air && dog.vel.length() > 7 && ebikes.dogBump(dog)) {
    dog.vel.y = Math.max(5, dog.vel.y);
    dog.vel.x *= -0.55; dog.vel.z *= -0.55;
    if (dog.launchInfo) { dog.launchInfo.seq.push('E-Bike'); dog.launchInfo.hits++; }
    fx.pop(dog.pos, 'E-BIKE BONK!', '#ffd84a', 27);
    play('boing', 0.7);
  }
  const carTargets = [
    { pos: playerPos }, ...people.list.filter(p => p.hittable).map(p => ({ pos: p.center })),
    ...(!dog.dead && !dog.grabbed && !dog.inside && !dog.locked ? [{ pos: dog.pos }] : []),
  ];
  traffic.update(dt, { player, playerPos, dog, john, people: people.list, targets: carTargets, slipAt: (x, z) => throwables.slipAt(x, z) });
  throwables.update(dt, {
    playerHand: player.handWorld(new THREE.Vector3()),
    targets: [...carTargets, ...(traffic.enabled ? traffic.cars.map(c => ({ pos: c.pos, r: 2 })) : [])],
  });
  peta.update(dt, playerPos, dog);
  if (!dog.dead && !dog.inside && !dog.locked) {
    dog.fear = peta.inside(dog.pos) ? 'cry' : peta.near(dog.pos, 6) ? 'scared' : '';
    if (dog.crying && Math.random() < dt * 2) {
      fx.puff(dog.head.getWorldPosition(new THREE.Vector3()), { color: 0x88c8ff, n: 2, size: 0.065, spread: 0.18, life: 0.5 });
      if (Math.random() < 0.17) play('whimper', 0.28);
    }
  } else if (!dog.locked) dog.fear = '';
  if (!insideYard(dog.pos) && !dog.air && !dog.grabbed && !dog.inside && !dog.dead && !dog.locked) {
    dog.outsideT += dt;
    if (dog.outsideT > 12) { dog.teleportHome(); dog.outsideT = 0; fx.pop(dog.pos, 'BACK HOME', '#fff', 20); }
  } else dog.outsideT = 0;
  for (const w of world.windows) if (w.broken > 0) {
    w.broken -= dt;
    if (w.broken <= 0) w.glass.visible = true;
  }
  snow.update(dt, dog, people.list);
  updateBuild(realDt);
  updateBugs(dt);
  world.setSnowCenter(camera.position);
  // player/dog body separation on the ground
  if (!dog.air && !dog.grabbed && !player.ragdoll && dog.stuck <= 0) {
    const dx = dog.pos.x - player.pos.x, dz = dog.pos.z - player.pos.z, dd = Math.hypot(dx, dz);
    if (dd < 0.85 && dd > 0.001) { const push = (0.85 - dd) / dd; dog.pos.x += dx * push * 0.5; dog.pos.z += dz * push * 0.5; player.pos.x -= dx * push * 0.5; player.pos.z -= dz * push * 0.5; }
  }
  if (dog.glue >= 0.45 && !dog.air && !dog.grabbed && dog.stuck <= 0 && dog.ko <= 0) {
    dog.stuck = 6; dog.stuckWall = false; dog.vel.set(0, 0, 0);
    fx.pop(dog.pos, 'GLUED', '#f4f1e2', 30); dog.mood -= 10;
  }
  if (dog.pos.y < -5 || dog.pos.length() > 300) {
    if (dog.dead) { awardFinish(dog, dog.launchInfo); dog.respawn(); }
    else dog.teleportHome();
  }
  updateGlue(dt);
  refreshHeldIfNeeded();
  updateChainRope(dt);
  fx.update(dt, dog);
  for (const u of world.updaters) u(dt, elapsed);
  updateCamera(dt, realDt);
  const showAim = !dogCam && (dog.grabbed || carryPerson || carryRider || throwables.held || (selId === 'bomb' && owned('bomb'))) && canAct();
  if (showAim) throwables.showArc(player.handWorld(new THREE.Vector3()), throwVel(dog.grabbed ? dogThrowS() : carryPerson || carryRider ? personThrowS() : throwables.held ? POOP_S : 15));
  else throwables.showArc(null, null, false);
  updateTags();
  updateHUD(realDt);
  syncTouchControls();
  if (toastTimer > 0) { toastTimer -= realDt; if (toastTimer <= 0) $('toast').classList.remove('on'); }
  if (resultTimer > 0) { resultTimer -= realDt; if (resultTimer <= 0) $('result').classList.remove('on'); }
  $('crosshair').style.display = dogCam ? 'none' : '';
  $('dogCamHint').classList.toggle('hidden', !dogCamManual);
  renderer.render(scene, camera);
}
setSeason(season, false);
let lastBallState = ball.state;
function refreshHeldIfNeeded() { if (ball.state !== lastBallState) { lastBallState = ball.state; refreshHeld(); } }
frame();
