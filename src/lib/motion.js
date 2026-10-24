// The player's CSS animations as maths, so video and GIF exports can draw
// any moment of them. Keep in step with the keyframes in player.js.

/** CSS cubic-bezier(x1, y1, x2, y2) as a function of progress. */
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= (sx(t) - x) / d;
    }
    t = Math.min(1, Math.max(0, t));
    return sy(t);
  };
}

const EASE = {
  "ease-in-out": bezier(0.42, 0, 0.58, 1),
  linear: (x) => x,
};

// Keyframes: [offset, {tx, ty (fractions of size), s (scale), r (deg), o (opacity)}, easing for the segment that starts here].
const ID = { tx: 0, ty: 0, s: 1, r: 0, o: 1 };
const K = {
  float: { dur: 3.4, ease: "ease-in-out", loop: true, keys: [[0, {}], [0.5, { ty: -0.06 }], [1, {}]] },
  pulse: { dur: 2.4, ease: "ease-in-out", loop: true, keys: [[0, {}], [0.5, { s: 1.07 }], [1, {}]] },
  bounce: { dur: 1.1, loop: true, keys: [[0, {}, bezier(0.33, 0, 0.66, 0)], [0.5, { ty: -0.14 }, bezier(0.33, 1, 0.66, 1)], [1, {}]] },
  wiggle: { dur: 1.2, ease: "ease-in-out", loop: true, keys: [[0, {}], [0.25, { r: -7 }], [0.75, { r: 7 }], [1, {}]] },
  shake: { dur: 0.6, ease: "linear", loop: true, keys: [[0, {}], [0.2, { tx: -0.03 }], [0.4, { tx: 0.03 }], [0.6, { tx: -0.02 }], [0.8, { tx: 0.02 }], [1, {}]] },
  spin: { dur: 4, ease: "linear", loop: true, keys: [[0, {}], [1, { r: 360 }]] },
  swing: { dur: 2.2, ease: "ease-in-out", loop: true, keys: [[0, { r: -10 }], [0.5, { r: 10 }], [1, { r: -10 }]] },
  pop: { dur: 0.7, ease: bezier(0.34, 1.56, 0.64, 1), loop: false, keys: [[0, { s: 0, o: 0 }], [0.7, { s: 1.12 }], [1, {}]] },
  slide: { dur: 0.8, ease: bezier(0.22, 1, 0.36, 1), loop: false, keys: [[0, { ty: 0.4, o: 0 }], [1, {}]] },
};

function sample(def, p) {
  const keys = def.keys;
  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1][0]) i++;
  const [a, pa, ea] = keys[i];
  const [b, pb] = keys[i + 1];
  const ease = ea ?? (typeof def.ease === "function" ? def.ease : EASE[def.ease] ?? EASE.linear);
  const k = ease(b > a ? (p - a) / (b - a) : 1);
  const out = {};
  for (const key of Object.keys(ID)) {
    const va = pa[key] ?? ID[key];
    const vb = pb[key] ?? ID[key];
    out[key] = va + (vb - va) * k;
  }
  return out;
}

/** An element animation at time t (seconds): { tx, ty, s, r, o }. */
export function animAt(anim, t) {
  const def = anim && K[anim.type];
  if (!def || t == null) return ID;
  const period = def.dur / (anim.speed || 1);
  const local = t - (anim.delay || 0);
  if (local < 0) return def.loop ? ID : sample(def, 0);
  const p = def.loop ? (local % period) / period : Math.min(1, local / period);
  return sample(def, p);
}

/** How long until every one-shot animation on a page has finished, and the loop length to aim for. */
export function suggestedLength(page) {
  let longest = 0;
  for (const el of page.elements) {
    const def = K[el.anim?.type];
    if (!def) continue;
    const period = def.dur / (el.anim.speed || 1);
    longest = Math.max(longest, (el.anim.delay || 0) + (def.loop ? period * 2 : period + 1));
  }
  return Math.min(15, Math.max(3, Math.ceil(longest)));
}

// Background orb drift (ad-drift-0/1/2): translate in % of the orb, and scale.
const DRIFT = [
  [[0, { tx: 0, ty: 0, s: 1 }], [0.33, { tx: 0.06, ty: -0.08, s: 1.12 }], [0.66, { tx: -0.05, ty: 0.06, s: 0.92 }], [1, { tx: 0, ty: 0, s: 1 }]],
  [[0, { tx: 0, ty: 0, s: 1.05 }], [0.5, { tx: -0.09, ty: -0.05, s: 0.9 }], [1, { tx: 0, ty: 0, s: 1.05 }]],
  [[0, { tx: 0, ty: 0, s: 0.95 }], [0.4, { tx: 0.07, ty: 0.07, s: 1.15 }], [0.75, { tx: -0.04, ty: -0.03, s: 1 }], [1, { tx: 0, ty: 0, s: 0.95 }]],
];

/** Orb i's drift at time t for a background drift speed. */
export function driftAt(i, drift, t) {
  if (!drift || t == null) return { tx: 0, ty: 0, s: 1 };
  const period = 26 / drift;
  const local = t + i * 3.3;
  const p = (((local % period) + period) % period) / period;
  return sample({ keys: DRIFT[i % 3], ease: "ease-in-out" }, p);
}
