// Tank sounds, synthesised with WebAudio (no sound files to ship).
let ctx = null;
let master = null;
let noiseBuf = null;
let muted = (() => {
  try {
    return localStorage.getItem("auradrop.muted") === "1";
  } catch {
    return false;
  }
})();

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    // A gentle limiter so stacked explosions don't clip.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 8;
    master.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try {
    localStorage.setItem("auradrop.muted", m ? "1" : "0");
  } catch {
    // Storage may be unavailable; the setting just won't stick.
  }
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.55, ctx.currentTime, 0.05);
  if (m) engineStop();
}

function noise(dur, { type = "lowpass", freq = 800, q = 0.7, gain = 1, attack = 0.002, decay = dur, sweep = null, at = 0 } = {}) {
  const a = audio();
  if (!a || muted) return;
  const t = a.currentTime + at;
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

function tone(dur, { type = "sine", freq = 100, to = null, gain = 0.5, attack = 0.005, at = 0 } = {}) {
  const a = audio();
  if (!a || muted) return;
  const t = a.currentTime + at;
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Main gun: a sharp crack plus a deep boom; bigger guns are lower and longer. */
export function gunShot(caliber = 88, { at = 0, distance = 0 } = {}) {
  const k = Math.min(1.6, Math.max(0.5, caliber / 90));
  const far = Math.min(0.8, distance / 2500);
  noise(0.12, { type: "highpass", freq: 1800 * (1 - far * 0.7), gain: 0.9 * (1 - far), decay: 0.12, at });
  noise(1.4 * k, { type: "lowpass", freq: 900 / k, sweep: 90, gain: 1, decay: 1.3 * k, at });
  tone(0.6 * k, { freq: 70 / k, to: 32, gain: 0.8, at });
}

export function ricochet({ at = 0 } = {}) {
  noise(0.05, { type: "bandpass", freq: 3200, q: 3, gain: 0.6, at });
  tone(0.55, { type: "triangle", freq: 2400, to: 900, gain: 0.18, at: at + 0.02 });
}

/** Shell hitting armour: a heavy clang; a penetration adds a crunch. */
export function impact(pen, { at = 0 } = {}) {
  tone(0.5, { type: "square", freq: 220, to: 160, gain: 0.12, at });
  tone(0.9, { type: "sine", freq: 640, to: 590, gain: 0.16, at });
  noise(0.25, { type: "bandpass", freq: 1500, q: 1.2, gain: 0.7, at });
  if (pen) noise(0.6, { type: "lowpass", freq: 600, sweep: 120, gain: 0.8, at: at + 0.03 });
}

export function explosion({ at = 0, big = false } = {}) {
  const k = big ? 1.8 : 1;
  noise(2.2 * k, { type: "lowpass", freq: 1200, sweep: 60, gain: 1, attack: 0.01, decay: 2 * k, at });
  tone(1.4 * k, { freq: 55, to: 22, gain: 0.9, at });
  if (big) for (let i = 0; i < 6; i++) noise(0.3, { type: "bandpass", freq: 900 + Math.random() * 1500, q: 2, gain: 0.35, at: at + 0.3 + Math.random() * 1.6 });
}

// --- engine loop ---------------------------------------------------------------
let engine = null;

/** Start (or retune) the engine drone. load 0 = idle, 1 = full throttle. */
export function engineStart(hp = 600, load = 0.2) {
  const a = audio();
  if (!a || muted) return;
  const base = 28 + 18 * Math.min(1.5, 600 / Math.max(150, hp));
  if (!engine) {
    const o1 = a.createOscillator();
    const o2 = a.createOscillator();
    o1.type = "sawtooth";
    o2.type = "square";
    const f = a.createBiquadFilter();
    f.type = "lowpass";
    f.Q.value = 2;
    const g = a.createGain();
    g.gain.value = 0.0001;
    // Rumble: noise through a low filter.
    const n = a.createBufferSource();
    n.buffer = noiseBuf;
    n.loop = true;
    const nf = a.createBiquadFilter();
    nf.type = "lowpass";
    nf.frequency.value = 180;
    const ng = a.createGain();
    ng.gain.value = 0.5;
    // Cylinder "chug": amplitude wobble.
    const lfo = a.createOscillator();
    const lg = a.createGain();
    lg.gain.value = 0.25;
    const w = a.createGain();
    w.gain.value = 0.75;
    lfo.connect(lg).connect(w.gain);
    o1.connect(f);
    o2.connect(f);
    n.connect(nf).connect(ng).connect(f);
    f.connect(w).connect(g).connect(master);
    o1.start();
    o2.start();
    n.start();
    lfo.start();
    engine = { o1, o2, f, g, lfo, n };
  }
  const t = a.currentTime;
  const rpm = base * (1 + load * 1.4);
  engine.o1.frequency.setTargetAtTime(rpm, t, 0.4);
  engine.o2.frequency.setTargetAtTime(rpm * 0.5, t, 0.4);
  engine.lfo.frequency.setTargetAtTime(rpm / 4, t, 0.4);
  engine.f.frequency.setTargetAtTime(220 + load * 500, t, 0.4);
  engine.g.gain.setTargetAtTime(0.09 + load * 0.08, t, 0.3);
}

export function engineStop() {
  if (!engine || !ctx) return;
  const e = engine;
  engine = null;
  e.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25);
  setTimeout(() => {
    for (const n of [e.o1, e.o2, e.lfo, e.n]) n.stop();
  }, 1200);
}
