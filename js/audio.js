const NAMES = ['kick', 'slam', 'bark', 'growl', 'coins', 'squirt', 'bat', 'punch', 'whoosh', 'eat', 'fart', 'happy', 'poof', 'horn', 'splat', 'crunch', 'kiss', 'snap', 'achieve', 'pistol', 'boom', 'glass', 'boing', 'screech', 'saw', 'zap', 'whimper'];

let ctx = null;
const buffers = {};
const lastPlay = {};

export function initAudio() {
  if (ctx) { ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  for (const n of NAMES) {
    fetch(`sfx/${n}.wav`).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)).then((buf) => (buffers[n] = buf)).catch(() => {});
  }
}

export function play(name, vol = 1, rate = 1, minGap = 0.06) {
  if (!ctx || !buffers[name]) return;
  const now = ctx.currentTime;
  if (lastPlay[name] && now - lastPlay[name] < minGap) return;
  lastPlay[name] = now;
  const src = ctx.createBufferSource();
  src.buffer = buffers[name];
  src.playbackRate.value = rate * (0.92 + Math.random() * 0.16);
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(g).connect(ctx.destination);
  src.start();
}
