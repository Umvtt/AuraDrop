// Procedural planes from the spec: lofted fuselage, airfoil wings and tail,
// propeller or jet, guns, stores, landing gear, cockpit with a pilot, and
// markings. +x forward, +y up, z across (left wing +z). Metres.
import * as THREE from "three";
import { airfoilLoft, cyl, deg, latheX, loft, mesh, rbox, tube, V3 } from "./geo.js";
import { insigniaCanvas, insigniaFor, projectDecal, sharkCanvas, textCanvas } from "./decals.js";

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Fuselage cross-section at k (0 = nose, 1 = tail). */
function section(F, k) {
  const L = F.length;
  const w = F.width / 2;
  const h = F.height / 2;
  const nose = F.nose;
  const noseK = nose === "radial" ? 0.06 : nose === "jet" ? 0.1 : 0.16;
  // Width: grows out of the nose, full through the cockpit, tapers to the tail.
  const grow = nose === "radial" ? 0.88 + 0.12 * smooth(0, noseK, k) : nose === "jet" ? 0.7 + 0.3 * smooth(0, noseK, k) : 0.42 + 0.58 * smooth(0, noseK, k);
  const taperStart = 0.5;
  const shrink = 1 - (1 - F.tail) * smooth(taperStart, 1, k);
  const f = grow * shrink;
  // The tail sweeps up, the spine humps behind the cockpit.
  const up = h * 0.55 * smooth(0.45, 1, k);
  const hump = F.hump * h * Math.exp(-(((k - F.canopyAt - 0.08) / 0.16) ** 2));
  return { x: L / 2 - k * L, w: w * f, h: h * f + hump * 0.6, hb: h * f * (k > 0.6 ? 0.85 : 1), y: up + hump * 0.4, n: 2.25 };
}

/** Wing chord and leading-edge x at spanwise distance s (0 = centre). */
function wingShape(W, s) {
  const half = W.span / 2;
  const u = Math.min(1, Math.abs(s) / half);
  let chord;
  switch (W.plan) {
    case "elliptical":
      chord = Math.max(W.tip * 0.35, W.root * Math.sqrt(Math.max(0, 1 - u ** 2.2)));
      break;
    case "delta":
      chord = W.root + (Math.max(0.4, W.tip * 0.5) - W.root) * u;
      break;
    default:
      chord = W.root + (W.tip - W.root) * u;
  }
  const sweep = W.plan === "delta" ? Math.max(45, W.sweep) : W.plan === "swept" ? Math.max(25, W.sweep) : W.sweep;
  // Sweep the quarter-chord line; elliptical wings keep a straight-ish leading edge.
  const lead = -Math.tan(deg(sweep)) * Math.abs(s) + (W.plan === "elliptical" ? (W.root - chord) * 0.12 : (W.root - chord) * 0.25);
  let dy = Math.tan(deg(W.dihedral)) * Math.abs(s);
  if (W.plan === "gull") {
    // Inverted gull: down to a knee at 35% span, then up.
    const knee = half * 0.35;
    dy = Math.abs(s) < knee ? -Math.tan(deg(14)) * Math.abs(s) : -Math.tan(deg(14)) * knee + Math.tan(deg(W.dihedral + 4)) * (Math.abs(s) - knee);
  }
  return { chord, lead, dy };
}

/** A pilot: helmet, head and shoulders. */
function pilot(M) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(0.13, 18, 14).translate(0, 0.22, 0), M.leather));
  g.add(mesh(new THREE.SphereGeometry(0.11, 16, 12).translate(0.03, 0.2, 0), M.skin));
  g.add(mesh(rbox(0.22, 0.24, 0.42, 0.06, -0.02, 0, 0), M.olive));
  g.add(mesh(rbox(0.06, 0.05, 0.16, 0.02, 0.1, 0.24, 0), M.glass)); // goggles
  return g;
}

function bomb(kg, M) {
  const r = 0.09 + Math.cbrt(kg) * 0.022;
  const len = r * 6.5;
  const g = new THREE.Group();
  g.add(mesh(latheX([[0.001, len / 2], [r * 0.7, len * 0.38], [r, len * 0.2], [r, -len * 0.25], [r * 0.45, -len * 0.45], [0.001, -len / 2]], 18), M.olive));
  for (let i = 0; i < 4; i++) {
    const fin = mesh(rbox(len * 0.22, 0.008, r * 1.6, 0.003, -len * 0.42, 0, 0), M.olive);
    fin.rotation.x = (i * Math.PI) / 2 + Math.PI / 4;
    g.add(fin);
  }
  g.userData.len = len;
  g.userData.r = r;
  return g;
}

function wheel(r, w, M) {
  const g = new THREE.Group();
  g.add(mesh(cyl(r, r, w, "z", 22), M.rubber));
  g.add(mesh(cyl(r * 0.55, r * 0.55, w * 1.08, "z", 16), M.steel));
  return g;
}

export function buildPlane(v, M) {
  const s = v.spec;
  const F = s.fuselage;
  const W = s.wing;
  const T = s.tail;
  const jet = F.nose === "jet";
  const root = new THREE.Group();
  root.name = v.name;
  const body = new THREE.Group(); // banks and bobs in flight
  root.add(body);
  const out = { root, body, props: [], flames: [], guns: [], fire: false };
  const L = F.length;
  const skin = () => ({ name: "Skin", t: 2 });

  // --- Fuselage ---------------------------------------------------------------
  const sections = [];
  for (let i = 0; i <= 40; i++) sections.push(section(F, i / 40));
  const cockpitX = L / 2 - F.canopyAt * L;
  const fuselage = mesh(loft(sections, 40), M.paint, (n, p) => (Math.abs(p.x - cockpitX) < 0.9 ? { name: "Cockpit armour", t: F.armor } : skin()));
  body.add(fuselage);
  out.hull = fuselage;
  const at = (k) => section(F, k);
  const noseS = at(0);

  // Nose: spinner + propeller, a radial cowling, or a jet intake.
  const blades = Math.round(s.prop.blades);
  const spinnerMat = M.color(s.prop.spinner, { roughness: 0.4, metalness: 0.3 });
  if (!jet) {
    const prop = new THREE.Group();
    prop.position.set(L / 2 + 0.02, noseS.y, 0);
    const sr = Math.max(0.16, Math.min(noseS.w, noseS.h) * (F.nose === "radial" ? 0.55 : 0.95));
    const spinLen = s.prop.spinStyle === "round" ? sr * 1.1 : sr * 2.1;
    prop.add(mesh(latheX(s.prop.spinStyle === "round" ? [[sr, 0], [sr * 0.95, spinLen * 0.4], [sr * 0.6, spinLen * 0.8], [0.001, spinLen]] : [[sr, 0], [sr * 0.9, spinLen * 0.3], [sr * 0.5, spinLen * 0.75], [0.001, spinLen]], 28), spinnerMat));
    if (s.prop.spinStyle === "spiral") prop.add(mesh(tube(Array.from({ length: 20 }, (_, i) => { const k = i / 19; const r = sr * (1 - k * 0.8) + 0.004; return V3(k * spinLen * 0.85, Math.cos(k * 9) * r, Math.sin(k * 9) * r); }), 0.022, 60, 6), M.color("#f8fafc")));
    const R = s.prop.diameter / 2;
    for (let i = 0; i < blades; i++) {
      const blade = new THREE.Group();
      const shape = airfoilLoft([0, 0.25, 0.6, 0.9, 1].map((u) => ({ s: sr * 0.6 + u * (R - sr * 0.6), chord: 0.24 * (1 - u * 0.55) * (u < 0.25 ? 0.8 + u : 1), x: 0.08, t: 0.09 })), "y", 10);
      shape.rotateY(Math.PI / 2);
      const b = mesh(shape, M.black);
      b.rotation.y = deg(18);
      blade.add(b);
      // Yellow tips, like the real thing.
      blade.add(mesh(rbox(0.02, 0.12, 0.1, 0.01, 0.01, R - 0.07, 0), M.color("#facc15")));
      blade.rotation.x = (i / blades) * Math.PI * 2;
      prop.add(blade);
    }
    const disc = mesh(new THREE.CircleGeometry(R, 48).rotateY(Math.PI / 2), M.propDisc, null, { shadow: false });
    disc.visible = false;
    prop.add(disc);
    out.props.push({ group: prop, disc });
    body.add(prop);
    if (F.nose === "radial") {
      const cr = Math.max(noseS.w, noseS.h) * 1.02;
      body.add(mesh(latheX([[cr * 0.7, 0.02], [cr, -0.08], [cr * 1.02, -0.45], [cr * 0.98, -0.8]], 36).translate(L / 2, noseS.y, 0), M.paintPlain));
      body.add(mesh(cyl(cr * 0.68, cr * 0.68, 0.06, "x", 30).translate(L / 2 - 0.12, noseS.y, 0), M.dark));
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        body.add(mesh(cyl(0.07, 0.07, 0.24, "x", 10).translate(L / 2 - 0.2, noseS.y + Math.cos(a) * cr * 0.48, Math.sin(a) * cr * 0.48), M.steel));
      }
    }
  } else {
    // Jet: nose intake and tailpipe.
    body.add(mesh(cyl(noseS.w * 0.92, noseS.w * 0.92, 0.05, "x", 32).translate(L / 2 - 0.02, noseS.y, 0), M.black));
    body.add(mesh(latheX([[noseS.w * 0.98, 0.05], [noseS.w, -0.05], [noseS.w * 0.92, -0.1]], 32).translate(L / 2, noseS.y, 0), M.chrome));
    const tailS = at(1);
    const pipe = mesh(latheX([[Math.max(0.18, tailS.w * 0.9), 0.1], [Math.max(0.16, tailS.w * 0.85), -0.25]], 28).translate(-L / 2, tailS.y, 0), M.gunmetal);
    body.add(pipe);
    const burner = mesh(new THREE.ConeGeometry(Math.max(0.15, tailS.w * 0.75), 1.4, 20, 1, true).rotateZ(Math.PI / 2).translate(-L / 2 - 0.9, tailS.y, 0), M.burner, null, { shadow: false });
    burner.userData.fx = true;
    out.flames.push(burner);
    body.add(burner);
  }
  // Inline engine exhaust stubs (and their flames).
  if (F.nose === "inline") {
    const ny = noseS.y + noseS.h * 1.6;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const x = L / 2 - 0.45 - i * 0.16;
        const k = (L / 2 - x) / L;
        const sec = at(k);
        const stub = mesh(rbox(0.1, 0.06, 0.08, 0.02, x, sec.y + sec.h * 0.45, side * (sec.w + 0.02)), M.exhaust);
        body.add(stub);
        if (s.details.exhaustFlames) {
          const fl = mesh(new THREE.ConeGeometry(0.04, 0.22, 8).rotateX(side * Math.PI / 2).translate(x - 0.05, sec.y + sec.h * 0.45, side * (sec.w + 0.15)), M.flame, null, { shadow: false });
          fl.userData.fx = true;
          out.flames.push(fl);
          body.add(fl);
        }
      }
    }
    void ny;
  }
  if (F.scoop) {
    const k0 = F.canopyAt + 0.05;
    const sec = at(k0);
    const scoop = loft(
      [0, 0.25, 0.6, 1].map((u) => ({ x: L / 2 - (k0 + u * 0.2) * L, w: sec.w * 0.45 * Math.sin(Math.PI * (0.25 + u * 0.6)), h: 0.22 * Math.sin(Math.PI * (0.2 + u * 0.7)), y: sec.y - sec.hb - 0.05, n: 2.6 })),
      20,
    );
    body.add(mesh(scoop, M.paintPlain, skin));
  }

  // --- Cockpit ----------------------------------------------------------------
  const ck = at(F.canopyAt);
  const canopyLen = F.canopy === "greenhouse" ? L * 0.26 : F.canopy === "framed" ? L * 0.15 : L * 0.13;
  const canopyH = Math.max(0.42, ck.h * 0.75);
  const canopyW = ck.w * (F.canopy === "bubble" ? 0.72 : 0.66);
  const topY = ck.y + ck.h;
  const glass = new THREE.SphereGeometry(1, 32, 18, 0, Math.PI * 2, 0, Math.PI / 2);
  glass.scale(canopyLen / 2, canopyH, canopyW);
  const canopy = mesh(glass, M.glass, () => ({ name: "Canopy glass", t: 6 }));
  canopy.position.set(cockpitX, topY - canopyH * 0.18, 0);
  body.add(canopy);
  if (F.canopy !== "bubble") {
    const ribs = F.canopy === "greenhouse" ? 6 : 3;
    for (let i = 0; i <= ribs; i++) {
      const x = -canopyLen / 2 + (i / ribs) * canopyLen;
      const u = x / (canopyLen / 2);
      const k = Math.sqrt(Math.max(0, 1 - u * u));
      if (k < 0.05) continue;
      const pts = Array.from({ length: 13 }, (_, j) => {
        const a = (j / 12) * Math.PI;
        return V3(x, Math.sin(a) * canopyH * k + 0.004, Math.cos(a) * canopyW * k);
      });
      const rib = mesh(tube(pts, 0.016, 24, 5), M.paintPlain);
      rib.position.copy(canopy.position);
      body.add(rib);
    }
  }
  if (F.canopy === "razorback") {
    const spine = loft(
      [0, 0.5, 1].map((u) => ({ x: cockpitX - canopyLen / 2 - u * L * 0.22, w: canopyW * (1 - u * 0.7) * 0.6, h: canopyH * 0.75 * (1 - u), y: topY - canopyH * 0.18, hb: 0.01, n: 2 })),
      20,
    );
    body.add(mesh(spine, M.paint, skin));
  }
  const p = pilot(M);
  p.position.set(cockpitX - 0.05, topY - canopyH * 0.45, 0);
  body.add(p);
  if (F.canopy === "greenhouse" || s.crew.gunner) {
    const g2 = pilot(M);
    g2.position.set(cockpitX - canopyLen * 0.35, topY - canopyH * 0.45, 0);
    g2.rotation.y = s.crew.gunner ? Math.PI : 0;
    body.add(g2);
  }
  if (s.crew.gunner) {
    const mg = new THREE.Group();
    mg.add(mesh(cyl(0.022, 0.022, 0.9, "x", 8).translate(-0.45, 0, 0), M.gunmetal));
    mg.add(mesh(rbox(0.25, 0.1, 0.08, 0.02, 0, 0, 0), M.gunmetal));
    mg.position.set(cockpitX - canopyLen / 2 - 0.1, topY + 0.05, 0);
    body.add(mg);
  }

  // --- Wings ------------------------------------------------------------------
  const half = W.span / 2;
  const wingX = L / 2 - W.at * L + W.root * 0.5;
  const wingSec = at(W.at);
  const mountY = wingSec.y + (W.mount === "low" ? -wingSec.hb * 0.55 : W.mount === "high" ? wingSec.h * 0.75 : 0);
  const thick = W.profile === "thick" ? 0.16 : W.profile === "laminar" ? 0.1 : 0.13;
  const stations = [];
  const N = 22;
  for (let i = 0; i <= N; i++) {
    // Cosine spacing: more sections near the tips for a clean outline.
    const u = Math.sin(((i / N) * 2 - 1) * (Math.PI / 2));
    const sz = u * half;
    const ws = wingShape(W, sz);
    stations.push({ s: sz, chord: ws.chord, x: wingX + ws.lead, t: thick * (1 - Math.abs(u) * 0.35), dy: mountY + ws.dy });
  }
  const wing = mesh(airfoilLoft(stations, "z", 16), M.paint, () => ({ name: "Wing", t: 2 }));
  body.add(wing);
  out.wing = wing;

  // Wing guns poke out of the leading edge.
  const wingGuns = Math.round(s.guns.wingCount);
  for (let i = 0; i < wingGuns; i++) {
    const side = i % 2 ? -1 : 1;
    const j = Math.floor(i / 2);
    const sz = side * (half * 0.22 + j * 0.32 + (W.plan === "gull" ? half * 0.1 : 0));
    const ws = wingShape(W, sz);
    const r = 0.012 + s.guns.wingCal * 0.0012;
    const len = 0.35 + s.guns.wingCal * 0.012;
    const g = mesh(cyl(r, r, len, "x", 8).translate(wingX + ws.lead + len / 2 - 0.05, mountY + ws.dy, sz), M.gunmetal);
    body.add(g);
    out.guns.push(V3(wingX + ws.lead + len, mountY + ws.dy, sz));
  }
  const noseGuns = Math.round(s.guns.noseCount);
  for (let i = 0; i < noseGuns; i++) {
    const z = (i - (noseGuns - 1) / 2) * 0.13;
    const sec = at(0.08);
    const len = 0.6 + s.guns.noseCal * 0.01;
    const r = 0.012 + s.guns.noseCal * 0.0011;
    body.add(mesh(cyl(r, r, len, "x", 8).translate(L / 2 - 0.2 - len / 2 + 0.3, sec.y + sec.h * 0.9, z), M.gunmetal));
    out.guns.push(V3(L / 2 + 0.1, sec.y + sec.h * 0.9, z));
  }

  // --- Tail -------------------------------------------------------------------
  const tailS = at(0.94);
  const tailX = -L / 2 + 0.25;
  const stabRoot = Math.max(0.6, W.root * 0.45);
  const stabHalf = T.stabSpan / 2;
  const stab = [];
  for (let i = 0; i <= 12; i++) {
    const u = Math.sin(((i / 12) * 2 - 1) * (Math.PI / 2));
    const sz = u * stabHalf;
    const chord = T.fin === "round" ? Math.max(0.2, stabRoot * Math.sqrt(Math.max(0, 1 - Math.abs(u) ** 2.2))) : stabRoot * (1 - Math.abs(u) * 0.45);
    const lead = T.fin === "swept" || jet ? -Math.abs(sz) * 0.5 : 0;
    stab.push({ s: sz, chord, x: tailX + stabRoot + lead, t: 0.09, dy: tailS.y + (jet && T.fin === "swept" ? 0.2 : 0) });
  }
  body.add(mesh(airfoilLoft(stab, "z", 12), M.paint, () => ({ name: "Tailplane", t: 1.5 })));
  const fin = [];
  const finRoot = Math.max(0.8, stabRoot * 1.25);
  const finBase = tailS.y + tailS.h * 0.5;
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    let chord = finRoot * (1 - u * 0.5);
    let lead = 0;
    if (T.fin === "round") chord = Math.max(0.15, finRoot * Math.sqrt(Math.max(0, 1 - u ** 2.4)));
    if (T.fin === "swept") lead = -u * T.finHeight * 0.85;
    if (T.fin === "tall") chord = finRoot * (1 - u * 0.6);
    fin.push({ s: finBase + u * T.finHeight, chord, x: tailX + finRoot + lead, t: 0.1 });
  }
  body.add(mesh(airfoilLoft(fin, "y", 12), M.paint, () => ({ name: "Fin", t: 1.5 })));
  if (T.fin === "tall") body.add(mesh(airfoilLoft([{ s: finBase - 0.05, chord: finRoot * 1.9, x: tailX + finRoot * 1.9, t: 0.06 }, { s: finBase + 0.3, chord: finRoot * 0.9, x: tailX + finRoot, t: 0.08 }], "y", 10), M.paint, skin));

  // --- Stores -------------------------------------------------------------------
  const under = mountY - 0.12;
  const bombs = Math.round(s.stores.bombs);
  for (let i = 0; i < bombs; i++) {
    const b = bomb(s.stores.bombKg, M);
    if (i === 0) b.position.set(wingX - W.root * 0.4, wingSec.y - wingSec.hb - b.userData.r - 0.05, 0);
    else {
      const side = i % 2 ? 1 : -1;
      const j = Math.ceil(i / 2);
      const sz = side * (half * 0.3 + j * 0.45);
      const ws = wingShape(W, sz);
      b.position.set(wingX + ws.lead - ws.chord * 0.45, under + ws.dy - b.userData.r, sz);
    }
    body.add(b);
  }
  const rockets = Math.round(s.stores.rockets);
  for (let i = 0; i < rockets; i++) {
    const side = i % 2 ? 1 : -1;
    const j = Math.floor(i / 2);
    const sz = side * (half * 0.45 + j * 0.22);
    const ws = wingShape(W, sz);
    const r = new THREE.Group();
    r.add(mesh(latheX([[0.001, 0.75], [0.05, 0.6], [0.05, -0.65], [0.03, -0.75]], 10), M.olive));
    r.add(mesh(rbox(0.9, 0.02, 0.03, 0.005, 0, 0.07, 0), M.steel));
    r.position.set(wingX + ws.lead - ws.chord * 0.4, under + ws.dy - 0.06, sz);
    body.add(r);
  }
  if (s.stores.droptank) {
    const len = Math.min(3, L * 0.3);
    body.add(mesh(latheX([[0.001, len / 2], [0.22, len * 0.3], [0.24, 0], [0.2, -len * 0.3], [0.001, -len / 2]], 20).translate(wingX - W.root * 0.3, wingSec.y - wingSec.hb - 0.32, 0), M.steel));
  }

  // --- Landing gear ----------------------------------------------------------------
  const gear = s.gear.type;
  let groundY = 2.6; // flying height when the gear is up
  let pitch = 0;
  if (gear !== "retracted") {
    const strut = 1.0 + F.height * 0.25;
    const wr = 0.3 + F.height * 0.06;
    for (const side of [-1, 1]) {
      const sz = side * Math.min(half * 0.32, 1.6 + (W.plan === "gull" ? 0.5 : 0));
      const ws = wingShape(W, sz);
      const x = wingX + ws.lead - ws.chord * 0.25;
      const top = mountY + ws.dy;
      body.add(mesh(cyl(0.04, 0.05, strut, "y", 10).translate(x, top - strut / 2, sz), M.steel));
      const wh = wheel(wr, 0.16, M);
      wh.position.set(x, top - strut, sz);
      body.add(wh);
      if (gear === "fixed") {
        body.add(mesh(new THREE.SphereGeometry(1, 20, 14).scale(wr * 2.2, wr * 1.35, 0.17).translate(x - wr * 0.3, top - strut + wr * 0.05, sz), M.paintPlain));
      }
    }
    // Tail wheel for piston planes, a nose wheel for jets.
    if (jet) {
      const x = L / 2 - L * 0.12;
      body.add(mesh(cyl(0.04, 0.05, strut, "y", 10).translate(x, noseS.y - strut / 2, 0), M.steel));
      const wh = wheel(0.25, 0.14, M);
      wh.position.set(x, noseS.y - strut, 0);
      body.add(wh);
      groundY = strut + wr - mountY;
    } else {
      const wh = wheel(0.13, 0.08, M);
      const tx = -L / 2 + L * 0.06;
      const ts = at(0.94);
      wh.position.set(tx, ts.y - ts.hb - 0.18, 0);
      body.add(wh);
      body.add(mesh(cyl(0.025, 0.025, 0.2, "y", 8).translate(tx, ts.y - ts.hb - 0.08, 0), M.steel));
      // Sit on the main wheels and the tail wheel: nose up.
      const mainX = wingX - W.root * 0.25;
      const mainBottom = mountY - strut - wr;
      const tailBottom = ts.y - ts.hb - 0.18 - 0.13;
      pitch = Math.atan2(tailBottom - mainBottom, mainX - tx);
      groundY = -mainBottom;
    }
  }
  root.userData.flying = gear === "retracted";

  // --- Antenna, markings ------------------------------------------------------------
  if (s.details.antenna && !jet) {
    const mx = cockpitX - canopyLen * 0.9;
    const top = topY + 0.45;
    body.add(mesh(cyl(0.012, 0.02, 0.55, "y", 6).translate(mx, topY + 0.15, 0), M.dark));
    body.add(mesh(tube([V3(mx, top, 0), V3(tailX + finRoot * 0.5, finBase + T.finHeight * 0.85, 0)], 0.004, 8, 4), M.dark));
  }
  // Nose markings: a coloured cowl ring.
  const noseColor = { yellow: "#facc15", red: "#dc2626" }[s.details.noseColor];
  if (noseColor || s.details.noseColor === "checker") {
    const ring = loft([0, 0.04, 0.08].map((k) => ({ ...at(k), w: at(k).w * 1.006, h: at(k).h * 1.006, hb: at(k).hb * 1.006 })), 40, false);
    body.add(mesh(ring, s.details.noseColor === "checker" ? M.color("#111827") : M.color(noseColor)));
    if (!jet && noseColor) out.props[0]?.group.children[0].material === spinnerMat && (out.props[0].group.children[0].material = M.color(noseColor));
  }

  root.updateMatrixWorld(true);
  const decals = new THREE.Raycaster();
  const hitOn = (obj, from, dir) => {
    decals.set(from, dir);
    return decals.intersectObject(obj, false)[0];
  };
  const mark = insigniaFor(s.markings?.insignia ?? "auto", v.nation, "plane");
  if (mark !== "none") {
    const ic = insigniaCanvas(mark);
    for (const side of [-1, 1]) {
      const sz = side * half * 0.68;
      const ws = wingShape(W, sz);
      const h = hitOn(wing, V3(wingX + ws.lead - ws.chord * 0.45, 20, sz), V3(0, -1, 0));
      if (h) projectDecal(wing, ic, h.point, V3(0, 1, 0), V3(ws.chord * 0.75, ws.chord * 0.75, 0.6), body);
      const fh = hitOn(fuselage, V3(-L * 0.22, at(0.72).y, side * 6), V3(0, 0, -side));
      if (fh) projectDecal(fuselage, ic, fh.point, fh.face.normal.clone().transformDirection(fuselage.matrixWorld), V3(F.height * 0.7, F.height * 0.7, 0.8), body);
    }
  }
  if (s.markings?.number) {
    const { canvas: tc, aspect } = textCanvas(s.markings.number, { color: s.markings.numberColor, outline: s.markings.outline, font: s.markings.font });
    for (const side of [-1, 1]) {
      const fh = hitOn(fuselage, V3(L * 0.02, at(0.5).y, side * 6), V3(0, 0, -side));
      if (fh) projectDecal(fuselage, tc, fh.point, fh.face.normal.clone().transformDirection(fuselage.matrixWorld), V3(F.height * 0.45 * aspect, F.height * 0.45, 0.8), body, { roll: 0 });
    }
  }
  if (s.details.sharkMouth) {
    const sc = sharkCanvas();
    for (const side of [-1, 1]) {
      const fh = hitOn(fuselage, V3(L / 2 - L * 0.1, noseS.y - noseS.h * 0.1, side * 6), V3(0, 0, -side));
      if (fh) projectDecal(fuselage, sc, fh.point, fh.face.normal.clone().transformDirection(fuselage.matrixWorld), V3(L * 0.16, L * 0.08, 0.9), body, { roll: 0 });
    }
  }
  if (s.details.noseColor === "invasion") {
    const stripes = document.createElement("canvas");
    stripes.width = 250;
    stripes.height = 100;
    const g = stripes.getContext("2d");
    for (let i = 0; i < 5; i++) {
      g.fillStyle = i % 2 ? "#111" : "#f5f5f5";
      g.fillRect(i * 50, 0, 50, 100);
    }
    for (const side of [-1, 1]) {
      const fh = hitOn(fuselage, V3(-L * 0.28, at(0.78).y, side * 6), V3(0, 0, -side));
      if (fh) projectDecal(fuselage, stripes, fh.point, fh.face.normal.clone().transformDirection(fuselage.matrixWorld), V3(F.height * 1.1, F.height * 1.6, 1.2), body, { roll: 0 });
      const sz = side * half * 0.4;
      const ws = wingShape(W, sz);
      const h = hitOn(wing, V3(wingX + ws.lead - ws.chord * 0.5, 20, sz), V3(0, -1, 0));
      if (h) projectDecal(wing, stripes, h.point, V3(0, 1, 0), V3(ws.chord * 1.3, half * 0.32, 0.6), body, { roll: Math.PI / 2 });
    }
  }

  // Interior for the X-ray: engine, fuel, ammo, radiator.
  const interior = new THREE.Group();
  const engMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.4, metalness: 0.5, emissive: 0x501020 });
  const fuelMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5, transparent: true, opacity: 0.75, emissive: 0x4a3a05 });
  const ammoMat = new THREE.MeshStandardMaterial({ color: 0xd6a640, metalness: 0.85, roughness: 0.3, emissive: 0x3a2a08 });
  const eL = jet ? L * 0.35 : L * 0.16;
  const eX = jet ? -L * 0.12 : L / 2 - eL / 2 - 0.25;
  const eS = at(jet ? 0.62 : 0.12);
  interior.add(mesh(rbox(eL, eS.h * 1.2, eS.w * 1.2, 0.05, eX, eS.y, 0), engMat, null, { interior: true }));
  interior.add(mesh(rbox(L * 0.1, ck.h * 0.9, ck.w * 1.1, 0.05, cockpitX + canopyLen * 0.6, ck.y, 0), fuelMat, null, { interior: true }));
  for (const side of [-1, 1]) {
    const sz = side * half * 0.3;
    const ws = wingShape(W, sz);
    interior.add(mesh(rbox(ws.chord * 0.35, 0.08, half * 0.25, 0.02, wingX + ws.lead - ws.chord * 0.4, mountY + ws.dy, sz), fuelMat, null, { interior: true }));
    if (wingGuns) interior.add(mesh(rbox(ws.chord * 0.2, 0.07, 0.3, 0.02, wingX + ws.lead - ws.chord * 0.55, mountY + ws.dy, side * (half * 0.22 + 0.4)), ammoMat, null, { interior: true }));
  }
  interior.visible = false;
  body.add(interior);
  out.interior = interior;

  body.rotation.z = pitch;
  root.position.y = 0;
  body.position.y = groundY;
  const baseY = groundY;
  const span = W.span;
  out.size = { length: L, height: groundY + F.height + T.finHeight * 0.6, width: span };
  out.center = V3(0, groundY + F.height * 0.3, 0);

  let spin = 0;
  out.update = (dt, t, anim) => {
    const sp = anim.speed ?? 1;
    const spinning = anim.drive && sp > 0;
    for (const pr of out.props) {
      spin += dt * (spinning ? 40 * sp : 0);
      pr.group.rotation.x = spin;
      // Stills (a tiny dt) show the blades; a spinning prop becomes a blurred disc.
      const fast = spinning && sp > 0.3 && dt > 0.004;
      pr.disc.visible = fast;
      pr.group.children.forEach((c) => {
        if (c !== pr.disc && c.children.length) c.visible = !fast || c === pr.group.children[0];
      });
    }
    for (const f of out.flames) {
      f.visible = spinning && (anim.smoke ?? true);
      f.scale.setScalar(0.85 + Math.sin(t * 40 + f.id) * 0.15);
    }
    if (root.userData.flying) {
      // Gentle flight: bob and bank.
      body.position.y = baseY + Math.sin(t * 0.9) * 0.12;
      body.rotation.x = Math.sin(t * 0.5) * 0.08;
      body.rotation.z = pitch + Math.sin(t * 0.7) * 0.03;
    } else {
      body.position.y = baseY;
      body.rotation.x = 0;
      body.rotation.z = pitch;
    }
    out.fire = anim.gun === "recoil" && (t % 4) < 0.6 && Math.floor(t * 14) % 2 === 0;
  };
  return out;
}
