// Procedural cars from the spec: lofted body and glasshouse per style, wheels
// with real rims, lights, spoilers, exhausts with flames and nitro, a driver.
// +x forward, +y up, z across. Ground at y = 0. Metres.
import * as THREE from "three";
import { cyl, latheX, loft, mesh, rbox, tube, V3 } from "./geo.js";
import { textCanvas, projectDecal } from "./decals.js";

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Per style: belt line (hood/trunk) height as a share of height, cabin span
// (0 = front bumper, 1 = rear), roof height, how boxy, nose/tail rounding.
const STYLES = {
  sports: { belt: 0.55, nose: 0.42, tail: 0.6, cab: [0.38, 0.74], roof: 1, n: 2.6, rake: 0.55, open: false },
  super: { belt: 0.5, nose: 0.3, tail: 0.62, cab: [0.33, 0.66], roof: 0.92, n: 2.4, rake: 0.75, open: false },
  muscle: { belt: 0.62, nose: 0.6, tail: 0.66, cab: [0.42, 0.74], roof: 1, n: 4, rake: 0.35, open: false },
  sedan: { belt: 0.56, nose: 0.5, tail: 0.6, cab: [0.3, 0.76], roof: 1, n: 3.2, rake: 0.35, open: false },
  hatch: { belt: 0.56, nose: 0.48, tail: 0.66, cab: [0.3, 0.95], roof: 1, n: 3.2, rake: 0.4, open: false },
  rally: { belt: 0.56, nose: 0.48, tail: 0.66, cab: [0.3, 0.94], roof: 1, n: 3.2, rake: 0.42, open: false },
  jeep: { belt: 0.62, nose: 0.62, tail: 0.62, cab: [0.36, 0.5], roof: 0, n: 6, rake: 0.1, open: true },
  pickup: { belt: 0.58, nose: 0.56, tail: 0.58, cab: [0.3, 0.56], roof: 1, n: 4.5, rake: 0.25, open: false },
};

function driver(M) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(0.13, 18, 14).translate(0, 0.62, 0), M.color("#f8fafc", { roughness: 0.3 })));
  g.add(mesh(rbox(0.06, 0.08, 0.22, 0.02, 0.11, 0.62, 0), M.visor));
  g.add(mesh(rbox(0.3, 0.42, 0.42, 0.08, -0.04, 0.3, 0), M.dark));
  return g;
}

function wheel(r, w, rims, M) {
  const g = new THREE.Group();
  const tyre = latheX([[r * 0.68, w / 2], [r * 0.94, w / 2], [r, w * 0.3], [r, -w * 0.3], [r * 0.94, -w / 2], [r * 0.68, -w / 2]], 36);
  tyre.rotateY(Math.PI / 2); // axis along z
  g.add(mesh(tyre, M.rubber));
  const rimR = r * 0.68;
  const rimMat = rims === "steel" ? M.steel : rims === "offroad" ? M.dark : M.chrome;
  const face = w * 0.42;
  g.add(mesh(cyl(rimR, rimR, w * 0.7, "z", 28), M.dark));
  // Rim lip; steel wheels get a solid face, the others show spokes.
  g.add(mesh(new THREE.TorusGeometry(rimR * 0.97, 0.025, 8, 32).translate(0, 0, face), rimMat));
  if (rims === "steel") g.add(mesh(cyl(rimR * 0.95, rimR * 0.95, 0.02, "z", 28).translate(0, 0, face - 0.01), rimMat));
  g.add(mesh(cyl(r * 0.16, r * 0.16, 0.05, "z", 16).translate(0, 0, face + 0.02), rimMat));
  const spokes = rims === "sport" ? 5 : rims === "multi" ? 10 : rims === "deep" ? 6 : rims === "offroad" ? 6 : 0;
  for (let i = 0; i < spokes; i++) {
    const s = mesh(rbox(rimR * 0.92, rims === "multi" ? 0.035 : 0.09, 0.05, 0.015, rimR * 0.5, 0, face - (rims === "deep" ? 0.06 : 0.01)), rimMat);
    const piv = new THREE.Group();
    piv.add(s);
    piv.rotation.z = (i / spokes) * Math.PI * 2;
    g.add(piv);
  }
  if (rims === "steel") for (let i = 0; i < 6; i++) g.add(mesh(cyl(0.035, 0.035, 0.03, "z", 10).translate(Math.cos((i / 6) * 6.283) * rimR * 0.55, Math.sin((i / 6) * 6.283) * rimR * 0.55, face + 0.02), M.dark));
  // Brake disc and calliper behind the spokes.
  g.add(mesh(cyl(rimR * 0.8, rimR * 0.8, 0.03, "z", 28).translate(0, 0, face - 0.08), M.steel));
  g.add(mesh(rbox(0.12, 0.2, 0.08, 0.02, rimR * 0.62, rimR * 0.1, face - 0.06), M.color("#dc2626", { roughness: 0.4 })));
  return g;
}

export function buildCar(v, M) {
  const B = v.spec.body;
  const E = v.spec.engine;
  const root = new THREE.Group();
  root.name = v.name;
  const body = new THREE.Group(); // bounces on the suspension
  root.add(body);
  const out = { root, body, wheels: [], flames: [], nitro: [], fire: false };
  const L = B.length;
  const W = B.width;
  const H = B.height;
  const wr = B.wheelSize / 2;
  const tyreW = 0.18 + wr * 0.35;
  const f1 = B.style === "f1";
  const st = STYLES[B.style] ?? STYLES.sports;
  const ride = f1 ? 0.06 : B.style === "jeep" || B.style === "pickup" ? 0.32 : B.style === "rally" ? 0.2 : B.style === "super" ? 0.1 : 0.14;
  const frontAxle = (B.wheelbase * L) / 2 + (f1 ? 0.25 : 0);
  const rearAxle = -(B.wheelbase * L) / 2;
  const panel = () => ({ name: "Body panel", t: 1 });
  const paint = M.paint;

  if (!f1) {
    // --- Lower body: a loft whose top follows hood, cabin base and trunk ---------------
    // The belt line always clears the wheels so there's room for arches.
    const belt = Math.max(H * st.belt, 2 * wr + 0.16);
    const archTop = 2 * wr + 0.05;
    const arch = (x) => Math.max(...[frontAxle, rearAxle].map((ax) => 1 - smooth(wr * 0.92, wr * 1.3, Math.abs(x - ax))));
    const sections = [];
    const N = 80;
    for (let i = 0; i <= N; i++) {
      const k = i / N; // 0 front .. 1 rear
      const x = L / 2 - k * L;
      const noseRound = smooth(0, 0.08, k) * (1 - smooth(0.93, 1, k));
      const top = ride + (belt - ride) * (st.nose + (1 - st.nose) * smooth(0, 0.22, k)) * (1 - (1 - st.tail) * smooth(0.86, 1, k));
      // Over each wheel the body's underside lifts into an arch.
      const bottom = Math.min(top - 0.06, ride + (archTop - ride) * arch(x));
      const hh = (top - bottom) / 2;
      sections.push({ x, w: (W / 2) * (0.84 + 0.16 * noseRound), h: Math.max(0.03, hh), y: bottom + hh, n: st.n });
    }
    const lower = mesh(loft(sections, 48), paint, panel);
    body.add(lower);
    out.hull = lower;
    // Dark wheel-well liners inside each arch.
    for (const x of [frontAxle, rearAxle]) {
      const liner = new THREE.CylinderGeometry(wr * 1.12, wr * 1.12, W * 0.9, 24, 1, true, -Math.PI / 2, Math.PI);
      liner.rotateX(Math.PI / 2);
      body.add(mesh(liner.translate(x, wr, 0), M.black));
    }

    // --- Glasshouse and roof --------------------------------------------------------
    const [c0, c1] = st.cab;
    if (!st.open) {
      // Cabin: tinted glass all round with a body-coloured roof on top.
      const roofY = Math.max(H, belt + 0.38);
      const cabin = [];
      const M2 = 28;
      const fastback = B.style === "hatch" || B.style === "rally" ? 0.12 : st.rake * 0.5;
      for (let i = 0; i <= M2; i++) {
        const u = i / M2;
        const k = c0 + (c1 - c0) * u;
        const x = L / 2 - k * L;
        const rise = smooth(0, st.rake * 0.5, u) * (1 - smooth(1 - fastback, 1, u));
        const hh = (roofY - belt) * Math.max(0.03, rise) * st.roof;
        cabin.push({ x, w: (W / 2) * (0.8 - 0.08 * rise), h: hh, y: belt - 0.02, hb: 0.02, n: 3.6 });
      }
      const tint = M.color("#1b2433", { roughness: 0.05, metalness: 0.55, transparent: true, opacity: 0.78 });
      body.add(mesh(loft(cabin, 48, true, { split: 0.82 }), [tint, paint], () => ({ name: "Glass", t: 4 })));
      // B-pillar and a chrome window line.
      const mid = cabin[Math.round(M2 * 0.5)];
      for (const s of [-1, 1]) {
        body.add(mesh(rbox(0.1, mid.h * 0.82, 0.02, 0.01, mid.x, belt + mid.h * 0.41, s * mid.w * 0.96), paint));
        body.add(mesh(tube(cabin.slice(2, -2).map((c) => V3(c.x, belt + 0.01, s * c.w * 0.995)), 0.012, 40, 4), M.chrome));
      }
    } else {
      // Jeep: fold-down windscreen frame and open tub with seats.
      const x = L / 2 - c0 * L;
      body.add(mesh(rbox(0.06, H - belt, W * 0.86, 0.02, x, belt + (H - belt) / 2, 0), M.glass));
      body.add(mesh(tube([V3(x, belt, -W * 0.43), V3(x, H, -W * 0.43), V3(x, H, W * 0.43), V3(x, belt, W * 0.43)], 0.03, 24, 6), paint));
      for (const s of [-1, 1]) body.add(mesh(rbox(0.5, 0.5, 0.45, 0.06, x - 0.6, belt + 0.1, s * W * 0.22), M.canvas));
      body.add(mesh(rbox(0.5, 0.4, W * 0.8, 0.06, x - 1.4, belt + 0.05, 0), M.canvas));
    }
    if (B.style === "pickup") {
      // Open bed behind the cab.
      const x0 = L / 2 - st.cab[1] * L - 0.05;
      const len = x0 + L / 2 - 0.1;
      body.add(mesh(rbox(len, 0.04, W * 0.84, 0.01, x0 - len / 2, belt - 0.02, 0), M.dark));
      for (const s of [-1, 1]) body.add(mesh(rbox(len, 0.3, 0.05, 0.01, x0 - len / 2, belt + 0.12, s * W * 0.42), paint));
      body.add(mesh(rbox(0.05, 0.3, W * 0.84, 0.01, -L / 2 + 0.12, belt + 0.12, 0), paint));
    }
    if (B.style === "jeep") {
      const sw = wheel(wr, tyreW, B.rims, M);
      sw.rotation.y = Math.PI / 2;
      sw.position.set(-L / 2 - tyreW / 2, belt + 0.05, 0);
      body.add(sw);
      body.add(mesh(rbox(0.05, 0.12, W * 0.3, 0.02, L / 2 + 0.02, belt - 0.15, 0), M.dark)); // grille slots
    }

    // Lights, grille, mirrors, door handles.
    const lightY = ride + (belt - ride) * st.nose * 0.85;
    for (const s of [-1, 1]) {
      const hl = mesh(new THREE.SphereGeometry(0.11, 18, 12).scale(0.5, 0.6, 1.4).translate(L / 2 - 0.05, lightY, s * W * 0.33), M.lamp);
      body.add(hl);
      body.add(mesh(rbox(0.05, 0.08, W * 0.18, 0.02, -L / 2 + 0.03, ride + (belt - ride) * st.tail * 0.8, s * W * 0.34), M.tail));
      const mx = L / 2 - c0 * L - 0.25;
      body.add(mesh(new THREE.SphereGeometry(0.07, 12, 8).scale(1, 0.75, 1.4).translate(mx, belt + 0.08, s * (W / 2 + 0.06)), paint));
      body.add(mesh(rbox(0.12, 0.02, 0.02, 0.008, L / 2 - c0 * L - 0.6, belt - 0.12, s * W * 0.5), M.chrome));
    }
    body.add(mesh(rbox(0.04, (belt - ride) * 0.25, W * 0.45, 0.02, L / 2 - 0.01, ride + (belt - ride) * 0.35, 0), M.black));

    // Spoilers, splitter, scoop.
    const tailTop = ride + (belt - ride) * st.tail;
    if (B.spoiler === "lip" || B.spoiler === "ducktail") body.add(mesh(rbox(0.25, B.spoiler === "ducktail" ? 0.1 : 0.04, W * 0.85, 0.02, -L / 2 + 0.2, tailTop + 0.03, 0), paint));
    if (B.spoiler === "wing") {
      body.add(mesh(rbox(0.42, 0.04, W * 0.95, 0.02, -L / 2 + 0.2, tailTop + 0.38, 0), M.dark));
      for (const s of [-1, 1]) body.add(mesh(rbox(0.12, 0.36, 0.03, 0.01, -L / 2 + 0.22, tailTop + 0.18, s * W * 0.32), M.dark));
      for (const s of [-1, 1]) body.add(mesh(rbox(0.5, 0.18, 0.02, 0.01, -L / 2 + 0.2, tailTop + 0.38, s * W * 0.475), M.dark));
    }
    if (B.splitter) body.add(mesh(rbox(0.3, 0.025, W * 0.92, 0.01, L / 2 - 0.05, ride + 0.02, 0), M.black));
    if (B.roofScoop) {
      if (B.style === "rally" || B.style === "jeep" || B.style === "pickup") {
        body.add(mesh(rbox(0.12, 0.08, W * 0.6, 0.02, L / 2 - st.cab[0] * L - 0.15, H + 0.05, 0), M.dark));
        for (let i = 0; i < 4; i++) body.add(mesh(cyl(0.07, 0.07, 0.05, "x", 16).translate(L / 2 - st.cab[0] * L - 0.08, H + 0.05, (i - 1.5) * W * 0.15), M.lamp));
      } else body.add(mesh(rbox(0.6, 0.12, 0.5, 0.05, L / 2 - st.cab[0] * L - 0.5, H + 0.04, 0), paint));
    }
    if (B.style === "muscle") {
      // Hood scoop: a raised, body-coloured bulge with a dark intake.
      body.add(mesh(rbox(L * 0.24, 0.09, W * 0.3, 0.045, L / 2 - L * 0.2, belt + 0.03, 0), paint));
      body.add(mesh(rbox(0.04, 0.06, W * 0.24, 0.015, L / 2 - L * 0.08, belt + 0.05, 0), M.black));
    }
    if (B.style === "rally") for (const s of [-1, 1]) body.add(mesh(rbox(0.02, 0.3, tyreW * 1.2, 0.01, rearAxle - wr - 0.08, ride + 0.05, s * (W / 2 - tyreW * 0.6)), M.black));

    // Driver behind the wheel.
    const d = driver(M);
    d.position.set(L / 2 - (c0 + (c1 - c0) * 0.42) * L, ride + 0.05, W * 0.2);
    body.add(d);
    body.add(mesh(new THREE.TorusGeometry(0.17, 0.025, 8, 24).rotateY(Math.PI / 2).translate(L / 2 - (c0 + (c1 - c0) * 0.3) * L, belt - 0.02, W * 0.2), M.black));
  } else {
    // --- Open-wheel racer -------------------------------------------------------------
    const tub = [];
    for (let i = 0; i <= 30; i++) {
      const k = i / 30;
      const x = L / 2 + 0.3 - k * (L + 0.3);
      const w = 0.12 + 0.3 * smooth(0, 0.35, k) + 0.15 * smooth(0.35, 0.5, k) * (1 - smooth(0.62, 0.95, k));
      const hh = 0.08 + 0.2 * smooth(0, 0.4, k) - 0.06 * smooth(0.75, 1, k);
      tub.push({ x, w, h: hh, y: ride + 0.14 + hh * 0.6 + 0.15 * smooth(0.35, 0.6, k) * (1 - smooth(0.7, 1, k)), n: 2.8 });
    }
    const tubMesh = mesh(loft(tub, 32), paint, panel);
    body.add(tubMesh);
    out.hull = tubMesh;
    // Sidepods, halo, airbox, wings.
    for (const s of [-1, 1]) body.add(mesh(loft([0, 0.3, 1].map((u) => ({ x: L * 0.12 - u * L * 0.45, w: 0.2 * (1 - u * 0.5), h: 0.17 * (1 - u * 0.4), y: ride + 0.27, n: 3 })).map((q) => ({ ...q })), 20).translate(0, 0, s * 0.48), paint, panel));
    const cx = L * 0.02;
    body.add(mesh(tube([V3(cx + 0.55, ride + 0.62, 0), V3(cx + 0.1, ride + 0.85, 0), V3(cx - 0.3, ride + 0.8, 0.28), V3(cx - 0.35, ride + 0.55, 0.3)], 0.03, 24, 8), M.dark));
    body.add(mesh(tube([V3(cx + 0.1, ride + 0.85, 0), V3(cx - 0.3, ride + 0.8, -0.28), V3(cx - 0.35, ride + 0.55, -0.3)], 0.03, 24, 8), M.dark));
    body.add(mesh(loft([0, 0.5, 1].map((u) => ({ x: cx - 0.5 - u * 1.4, w: 0.16 * (1 - u * 0.5), h: 0.22 * (1 - u * 0.8), y: ride + 0.7 - u * 0.25, n: 2.6 })), 20), paint, panel));
    body.add(mesh(rbox(0.5, 0.03, W * 0.98, 0.01, L / 2 + 0.15, ride + 0.08, 0), M.dark));
    for (const s of [-1, 1]) body.add(mesh(rbox(0.5, 0.18, 0.02, 0.01, L / 2 + 0.15, ride + 0.15, s * W * 0.49), paint));
    body.add(mesh(rbox(0.38, 0.04, W * 0.72, 0.01, -L / 2 + 0.05, ride + 0.85, 0), M.dark));
    body.add(mesh(rbox(0.3, 0.035, W * 0.72, 0.01, -L / 2 + 0.12, ride + 0.72, 0), M.dark));
    for (const s of [-1, 1]) body.add(mesh(rbox(0.55, 0.45, 0.02, 0.01, -L / 2 + 0.08, ride + 0.62, s * W * 0.36), paint));
    const d = driver(M);
    d.position.set(cx - 0.05, ride + 0.18, 0);
    d.scale.setScalar(0.9);
    body.add(d);
    // Suspension arms to each wheel.
    for (const x of [frontAxle, rearAxle]) for (const s of [-1, 1]) for (const dy of [-0.06, 0.08]) body.add(mesh(tube([V3(x, ride + 0.25 + dy, s * 0.25), V3(x, wr + dy, s * (W / 2 - tyreW / 2))], 0.015, 4, 4), M.dark));
  }

  // --- Wheels ------------------------------------------------------------------------
  const trackZ = f1 ? W / 2 - tyreW / 2 : W / 2 - tyreW / 2 - 0.03;
  for (const [x, front] of [[frontAxle, true], [rearAxle, false]]) {
    for (const s of [-1, 1]) {
      const g = new THREE.Group();
      const w = wheel(wr, tyreW * (f1 && !front ? 1.25 : 1), B.rims, M);
      if (s < 0) w.rotation.y = Math.PI;
      g.add(w);
      g.position.set(x, wr, s * trackZ);
      g.userData.r = wr;
      g.userData.front = front;
      g.userData.wheelKey = `${front ? "f" : "r"}${s > 0 ? "r" : "l"}`;
      (out.carWheels ??= []).push(g);
      root.add(g);
      out.wheels.push(w);
    }
  }

  // --- Exhausts, flames, nitro -----------------------------------------------------------
  const exY = f1 ? ride + 0.55 : ride + 0.12;
  const pipes = f1 ? [0] : B.style === "muscle" || B.style === "super" ? [-0.32, 0.32] : [0.3];
  for (const z of pipes) {
    const x = f1 ? -L / 2 + 0.55 : -L / 2 - 0.02;
    body.add(mesh(cyl(0.05, 0.055, 0.2, "x", 14).translate(x, exY, z * W), M.chrome));
    const fl = mesh(new THREE.ConeGeometry(0.07, 0.6, 12).rotateZ(Math.PI / 2).translate(x - 0.4, exY, z * W), M.flame, null, { shadow: false });
    fl.userData.fx = true;
    fl.visible = false;
    out.flames.push(fl);
    body.add(fl);
    if (E.nitro) {
      const n = mesh(new THREE.ConeGeometry(0.06, 0.9, 12).rotateZ(Math.PI / 2).translate(x - 0.55, exY, z * W), M.burner, null, { shadow: false });
      n.userData.fx = true;
      n.visible = false;
      out.nitro.push(n);
      body.add(n);
    }
  }

  // Markings: race number on the doors.
  const num = v.spec.markings?.number;
  if (num && out.hull) {
    root.updateMatrixWorld(true);
    const { canvas: tc, aspect } = textCanvas(num, { color: v.spec.markings.numberColor, outline: v.spec.markings.outline, font: v.spec.markings.font });
    const ray = new THREE.Raycaster();
    for (const s of [-1, 1]) {
      ray.set(V3(f1 ? -L * 0.05 : 0, f1 ? ride + 0.3 : ride + H * 0.3, s * 6), V3(0, 0, -s));
      const h = ray.intersectObject(out.hull, false)[0];
      if (h) projectDecal(out.hull, tc, h.point, h.face.normal.clone().transformDirection(out.hull.matrixWorld), V3(0.45 * aspect, 0.45, 0.6), body, { roll: 0 });
    }
  }

  // X-ray interior: engine, fuel, nitro bottles.
  const interior = new THREE.Group();
  const engMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.4, metalness: 0.5, emissive: 0x501020 });
  const fuelMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5, transparent: true, opacity: 0.75, emissive: 0x4a3a05 });
  const ex = E.layout === "front" ? L / 2 - L * 0.2 : E.layout === "mid" ? -L * 0.08 : -L / 2 + L * 0.18;
  const el = 0.5 + Math.min(0.6, E.hp / 2500);
  interior.add(mesh(rbox(el, 0.45, Math.min(W * 0.6, 0.75), 0.05, ex, ride + 0.32, 0), engMat, null, { interior: true }));
  interior.add(mesh(rbox(0.45, 0.25, W * 0.5, 0.05, -L / 2 + 0.6, ride + 0.2, 0), fuelMat, null, { interior: true }));
  if (E.nitro) for (const s of [-1, 1]) interior.add(mesh(cyl(0.09, 0.09, 0.7, "x", 16).translate(-L * 0.15, ride + 0.35, s * 0.2), new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x0b2a6b }), null, { interior: true }));
  interior.visible = false;
  body.add(interior);
  out.interior = interior;

  out.size = { length: L + (f1 ? 0.6 : 0), height: f1 ? 1.1 : H, width: W };
  out.center = V3(0, (f1 ? 1 : H) / 2, 0);

  let roll = 0;
  out.update = (dt, t, anim) => {
    const sp = anim.speed ?? 1;
    const driving = anim.drive && sp > 0;
    if (driving) {
      roll -= (dt * sp * 6) / wr;
      for (const w of out.wheels) w.rotation.z = (w.rotation.y ? -1 : 1) * roll;
    }
    if (anim.bob) {
      body.position.y = Math.sin(t * 4.1) * 0.01 + Math.sin(t * 9.3) * 0.004;
      body.rotation.z = Math.sin(t * 2.1) * 0.004;
    } else {
      body.position.y = 0;
      body.rotation.z = 0;
    }
    // Flames pop on the overrun; nitro burns blue every few seconds.
    const pop = E.flames && driving && (t % 3.2) < 0.5 && Math.floor(t * 18) % 2 === 0;
    for (const f of out.flames) {
      f.visible = !!pop && dt > 0.004;
      f.scale.setScalar(0.8 + Math.random() * 0.4);
    }
    const boost = driving && (t % 6) > 4.2 && dt > 0.004;
    for (const n of out.nitro) {
      n.visible = boost;
      n.scale.set(1 + Math.random() * 0.2, 1, 1);
    }
  };
  return out;
}
