// Procedural tanks. Everything is generated from the spec (see spec.js):
// hull, turret, gun, running gear, details, interior and markings.
// +x forward, +y up, z across. Ground at y = 0. Metres.
import * as THREE from "three";
import { box, bolts, cyl, deform, deg, latheX, merged, mergeGeometries, mesh, rbox, sideExtrude, topExtrude, tube, V3 } from "./geo.js";
import { insigniaCanvas, insigniaFor, projectDecal, textCanvas } from "./decals.js";
import { CREW_ROLES, crewOf } from "./spec.js";
import { boltRow, fuelDrum, grabHandle, hatch, headlight, liftingHook, louvres, meshScreen, periscope, pistolPort, spareWheel, tailLight, visionSlit, weldBeads } from "./details.js";


// ---------------------------------------------------------------------------
// Layout from the spec
// ---------------------------------------------------------------------------

function layout(spec) {
  const H = spec.hull;
  const G = spec.gear;
  const L = H.length;
  const Wt = H.width;
  const Hh = H.height;
  const tw = G.trackWidth;
  const tz = Wt / 2 - tw / 2;
  const Wl = Math.max(0.9, 2 * (tz - tw / 2) - 0.06);
  const tall = H.style === "tall" || G.style === "churchill";
  const rw = G.style === "churchill" ? Math.min(G.wheelSize, 0.4) / 2 : G.wheelSize / 2;
  const wheelY = rw + 0.07;
  const bogie = G.style === "bogie";
  const trackTop = tall ? Hh - 0.12 : bogie ? 2 * rw + 0.42 : 2 * rw + 0.14 + (G.rollers ? 0.08 : 0);
  const c = 0.42; // hull belly height
  const ys = tall ? Hh - 0.08 : Math.min(Hh - 0.32, Math.max(trackTop + 0.06, c + 0.35));
  const noseY = H.style === "boxy" ? Math.max(c + 0.15, ys - 0.28) : H.style === "modern" ? c + (ys - c) * 0.35 : H.style === "tall" ? c + (Hh - c) * 0.45 : c + (ys - c) * 0.5;
  const rearSlope = { boxy: 8, sloped: 35, rounded: 10, tall: 0, modern: 14 }[H.style] ?? 10;
  const yk = (c + Hh) * 0.5;
  const box_ = H.style === "boxy" ? Math.min(0.42, L * 0.07) : 0;
  const minX = -L / 2 + 0.6;
  const frontX = (y) => {
    let x;
    if (y <= noseY) {
      const k = (noseY - y) / Math.max(0.01, noseY - c);
      x = H.style === "rounded" ? L / 2 - (1 - Math.sqrt(Math.max(0, 1 - k * k))) * Math.min(0.55, Math.tan(deg(H.lowerSlope)) * (noseY - c) + 0.2) : L / 2 - Math.tan(deg(H.lowerSlope)) * (noseY - y);
    } else if (H.style === "boxy") {
      x = y <= ys ? L / 2 - ((y - noseY) / Math.max(0.01, ys - noseY)) * box_ : L / 2 - box_ - Math.tan(deg(H.frontSlope)) * (y - ys);
    } else {
      x = L / 2 - Math.tan(deg(H.frontSlope)) * (y - noseY);
    }
    return Math.max(minX, x);
  };
  const rearX = (y) => -L / 2 + (y > yk ? Math.tan(deg(rearSlope)) * (y - yk) : Math.tan(deg(22)) * (yk - y) * 0.6);
  return { L, Wt, Hh, tw, tz, Wl, tall, rw, wheelY, trackTop, c, ys, noseY, yk, frontX, rearX, rearSlope };
}

/** Polygon between y0 and y1 following the front and rear lines. */
function profileBetween(lay, y0, y1, steps = 6) {
  const ys = [];
  for (let i = 0; i <= steps; i++) ys.push(y0 + ((y1 - y0) * i) / steps);
  for (const k of [lay.noseY, lay.ys, lay.yk]) if (k > y0 + 0.01 && k < y1 - 0.01) ys.push(k);
  ys.sort((a, b) => a - b);
  const front = ys.map((y) => [lay.frontX(y), y]);
  const rear = [...ys].reverse().map((y) => [lay.rearX(y), y]);
  return [...front, ...rear];
}

// ---------------------------------------------------------------------------
// Hull
// ---------------------------------------------------------------------------

function buildHull(spec, lay, M, out) {
  const H = spec.hull;
  const D = spec.details;
  const g = new THREE.Group();
  g.name = "hull";
  const armorFn = (n, p) => {
    if (n.y > 0.8) return { name: "Roof", t: H.roof };
    if (n.y < -0.8) return { name: "Belly", t: Math.round(H.roof * 0.7) };
    if (n.x > 0.25) {
      if (n.y > 0.5 && H.style === "boxy") return { name: "Glacis", t: Math.round(H.front * 0.6) };
      return p.y > lay.noseY + 0.02 ? { name: "Upper front plate", t: H.front } : { name: "Lower front plate", t: H.lower };
    }
    if (n.x < -0.25) return { name: "Rear plate", t: H.rear };
    return { name: p.y > lay.ys ? "Upper side" : "Lower side", t: H.side };
  };
  const paint = H.zimmerit ? M.paint : M.paintPlain;
  // Lower hull (between the tracks) and the superstructure above.
  const lower = sideExtrude(profileBetween(lay, lay.c, lay.ys, H.style === "rounded" ? 10 : 6), lay.Wl, H.style === "rounded" ? 0.06 : 0.02);
  g.add(mesh(lower, H.style === "rounded" ? M.paintCast : paint, armorFn));
  const supW = lay.tall ? lay.Wl : lay.Wt;
  const upper = sideExtrude(profileBetween(lay, lay.ys, lay.Hh), supW, 0.03);
  if (H.sideSlope > 0) {
    const inset = Math.tan(deg(H.sideSlope));
    deform(upper, (v) => {
      const t = Math.max(0, v.y - lay.ys);
      const half = supW / 2;
      v.z = Math.sign(v.z) * Math.max(0.3, Math.abs(v.z) - inset * t * (Math.abs(v.z) / half));
    });
  }
  g.add(mesh(upper, paint, armorFn));
  // Pannier floor under the sponsons (it's what you see above the tracks).
  if (!lay.tall) g.add(mesh(box(lay.L * 0.9, 0.035, lay.Wt - 0.01, (lay.frontX(lay.ys) + lay.rearX(lay.ys)) / 2, lay.ys - 0.025, 0), M.paintPlain, () => ({ name: "Sponson floor", t: 20 })));

  const top = lay.Hh;
  const fxTop = lay.frontX(top);
  const rxTop = lay.rearX(top);
  const deckL = fxTop - rxTop;
  const halfTop = supW / 2 - (H.sideSlope > 0 ? Math.tan(deg(H.sideSlope)) * (top - lay.ys) : 0);

  // Driver's and radio operator's hatches, periscopes and the driver's visor.
  for (const [i, z] of [-halfTop * 0.5, halfTop * 0.5].entries()) {
    const h = hatch(M, { r: 0.27, periscope: true });
    h.position.set(fxTop - 0.5, top, z);
    h.rotation.y = i ? Math.PI : 0;
    g.add(h);
    const p = periscope(M);
    p.position.set(fxTop - 0.12, top, z * 0.8);
    g.add(p);
  }
  if (H.style === "boxy" || H.style === "tall") {
    const vy = top - 0.22;
    const vx = lay.frontX(vy);
    const vis = visionSlit(M, 0.44, paint);
    vis.position.set(vx + 0.035, vy, -halfTop * 0.4);
    g.add(vis);
    // Rain guard above the visor.
    g.add(mesh(box(0.08, 0.02, 0.55, vx + 0.04, vy + 0.13, -halfTop * 0.4), paint));
  }

  // Hull machine gun in a ball mount on the front plate.
  if (D.hullMg) {
    const my = H.style === "boxy" ? top - 0.3 : (lay.noseY + top) / 2;
    const mx = lay.frontX(my);
    const ball = new THREE.SphereGeometry(0.13, 24, 16);
    g.add(mesh(ball.translate(mx, my, halfTop * 0.42), M.paintPlain, () => ({ name: "MG ball mount", t: H.front })));
    g.add(mesh(latheX([[0.03, 0], [0.03, 0.25], [0.017, 0.25], [0.017, 0.6], [0.022, 0.6], [0.022, 0.64]], 12).translate(mx + 0.05, my, halfTop * 0.42), M.gunmetal));
  }

  // Headlights with brush guards.
  if (D.headlights) {
    for (const z of [-halfTop + 0.18, halfTop - 0.18]) {
      const ly = H.style === "boxy" ? top + 0.1 : lay.noseY + 0.14;
      const lx = H.style === "boxy" ? fxTop + 0.06 : lay.frontX(ly) + 0.05;
      const l = headlight(M, { guard: H.style !== "boxy" });
      l.position.set(lx, ly, z);
      g.add(l);
    }
  }

  // Tow hooks / shackles on the nose and rear.
  for (const [x, y] of [[lay.frontX(lay.noseY * 0.95) + 0.06, lay.noseY - 0.05], [lay.rearX(lay.c + 0.2) - 0.06, lay.c + 0.2]]) {
    for (const z of [-lay.Wl * 0.32, lay.Wl * 0.32]) {
      g.add(mesh(new THREE.TorusGeometry(0.065, 0.02, 8, 18).rotateY(Math.PI / 2).translate(x + Math.sign(x) * 0.02, y, z), M.steel));
      g.add(mesh(box(0.12, 0.09, 0.07, x, y + 0.02, z), M.paintPlain));
    }
  }

  // Engine deck: louvres, fan covers under mesh screens, access hatch, fuel caps, lifting eyes.
  const deckX = rxTop + deckL * 0.22;
  const grilleW = Math.min(0.75, halfTop * 0.45);
  for (const z of [-halfTop * 0.48, halfTop * 0.48]) {
    const lv = louvres(M, deckL * 0.2, grilleW, 9, M.paintPlain);
    lv.position.set(deckX, top, z);
    g.add(lv);
    if (spec.engine.kind !== "turbine") {
      g.add(mesh(cyl(grilleW * 0.42, grilleW * 0.44, 0.05, "y", 40).translate(deckX - deckL * 0.16, top + 0.025, z), M.paintPlain));
      const scr = meshScreen(M, grilleW * 0.95, grilleW * 0.95);
      scr.position.set(deckX - deckL * 0.16, top + 0.05, z);
      g.add(scr);
    }
  }
  if (spec.engine.kind === "turbine") {
    const scr = meshScreen(M, deckL * 0.28, halfTop * 1.6);
    scr.position.set(rxTop + deckL * 0.16, top, 0);
    g.add(scr);
  }
  const eh = new THREE.Group();
  eh.add(mesh(rbox(deckL * 0.16, 0.04, halfTop * 0.6, 0.01, 0, 0.02, 0), M.paintPlain));
  eh.add(boltRow(M, V3(-deckL * 0.07, 0.045, -halfTop * 0.27), V3(deckL * 0.07, 0.045, -halfTop * 0.27), 6, M.paintPlain));
  eh.add(boltRow(M, V3(-deckL * 0.07, 0.045, halfTop * 0.27), V3(deckL * 0.07, 0.045, halfTop * 0.27), 6, M.paintPlain));
  eh.add(grabHandle(V3(-0.08, 0.04, 0), V3(0.08, 0.04, 0), V3(0, 1, 0), M, 0.05));
  eh.position.set(deckX + deckL * 0.2, top, 0);
  g.add(eh);
  for (const z of [-halfTop + 0.15, halfTop - 0.15]) {
    g.add(mesh(cyl(0.06, 0.065, 0.04, "y", 16).translate(deckX + deckL * 0.05, top + 0.02, z), M.dark));
    g.add(mesh(box(0.08, 0.012, 0.02, deckX + deckL * 0.05, top + 0.045, z), M.steel));
    for (const x of [fxTop - 0.2, rxTop + 0.2]) {
      const hk = liftingHook(M, M.paintPlain);
      hk.position.set(x, top, z);
      g.add(hk);
    }
  }

  // Weld beads along every plate joint (cast parts have none), plus bolt rows.
  const halfAt = (y) => (y <= lay.ys + 1e-3 ? lay.Wl / 2 : supW / 2 - (H.sideSlope > 0 ? Math.tan(deg(H.sideSlope)) * (y - lay.ys) : 0));
  const welds = [];
  const plateLines = (prof, lowerPart) => {
    const pts = prof.map(([x, y]) => [x, y]);
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      const [nx, ny] = pts[(i + 1) % pts.length];
      if (y < lay.c + 0.02 && ny < lay.c + 0.02) continue;
      const hw = lowerPart ? lay.Wl / 2 : (z) => z;
      for (const s of [-1, 1]) {
        const za = lowerPart ? s * hw : s * halfAt(Math.max(y, lay.ys + 0.002));
        const zb = lowerPart ? s * hw : s * halfAt(Math.max(ny, lay.ys + 0.002));
        welds.push([V3(x, y, za), V3(nx, ny, zb)]);
      }
      if (y > lay.c + 0.02) {
        const zw = lowerPart ? lay.Wl / 2 : halfAt(Math.max(y, lay.ys + 0.002));
        welds.push([V3(x, y, -zw), V3(x, y, zw)]);
      }
    }
  };
  if (H.style !== "rounded") plateLines(profileBetween(lay, lay.c, lay.ys, 2), true);
  plateLines(profileBetween(lay, lay.ys, lay.Hh, 2), false);
  if (H.bolts && H.style !== "modern") g.add(weldBeads(welds, M.paintPlain, 0.013));
  if (H.bolts) {
    const pts = [];
    const n = Math.floor(deckL / 0.32);
    for (let i = 0; i <= n; i++) for (const z of [-halfTop + 0.06, halfTop - 0.06]) pts.push([rxTop + 0.1 + (deckL - 0.2) * (i / n), top + 0.008, z]);
    if (H.style === "tall") for (let i = 0; i < 24; i++) for (const s of [-1, 1]) for (const y of [lay.c + 0.2, top - 0.1]) pts.push([-lay.L * 0.45 + (i * lay.L * 0.9) / 23, y, s * (supW / 2 + 0.005)]);
    g.add(merged(bolts(pts, 0.017), M.paintPlain));
    // Interlocked plate ends at the front corners (very German).
    if (H.style === "boxy") {
      for (const s of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const y0 = lay.ys + ((top - lay.ys) * k) / 3;
          g.add(mesh(box(0.07, (top - lay.ys) / 3 - 0.02, 0.1, lay.frontX(y0) + 0.025 + (k % 2) * 0.02, y0 + (top - lay.ys) / 6, s * (supW / 2 - 0.043)), paint, armorFn));
        }
      }
    }
  }

  // Cast transmission cover (Sherman): bolted flange across the nose.
  if (H.style === "rounded") {
    const ny = lay.ys - 0.04;
    const nx = lay.frontX(ny);
    g.add(mesh(box(0.05, 0.06, lay.Wl + 0.06, nx - 0.01, ny, 0), M.paintCastPlain));
    g.add(boltRow(M, V3(nx + 0.02, ny + 0.035, -lay.Wl / 2), V3(nx + 0.02, ny + 0.035, lay.Wl / 2), 18, M.paintPlain, 0.016));
    for (const z of [-lay.Wl * 0.25, lay.Wl * 0.25]) g.add(mesh(new THREE.SphereGeometry(0.12, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(-Math.PI / 2).translate(lay.frontX(lay.noseY) - 0.03, lay.noseY, z), M.paintCastPlain));
  }

  // Fenders and mudguards over the track ends.
  if (D.fenders && !lay.tall) {
    for (const s of [-1, 1]) {
      const z = s * lay.tz;
      // Mudguards continue the track guard past the hull front and rear, gently bent down.
      const guard = (x0, x1, drop) => {
        const y0 = lay.ys - 0.015;
        const dx = x1 - x0;
        if (Math.abs(dx) < 0.12) return;
        const l = Math.hypot(dx, drop);
        const m = mesh(box(l, 0.022, lay.tw + 0.08), M.paintPlain);
        m.position.set((x0 + x1) / 2, y0 - drop / 2, z);
        m.rotation.z = Math.atan2(-drop, dx);
        g.add(m);
      };
      guard(Math.min(lay.frontX(lay.ys), lay.L / 2) - 0.03, lay.L / 2 + 0.22, 0.13);
      guard(Math.max(lay.rearX(lay.ys), -lay.L / 2) + 0.03, -lay.L / 2 - 0.14, 0.05);
      // Side rail along the track guard.
      g.add(mesh(box(lay.L * 0.95, 0.04, 0.025, 0, lay.ys - 0.02, s * (lay.Wt / 2 + 0.005)), M.paintPlain));
    }
  }

  // Grab rails along the upper sides and on the deck.
  if (D.grabRails) {
    for (const s of [-1, 1]) {
      const y = top - 0.12;
      const z = s * (halfAt(y) + 0.005);
      for (const x of [lay.L * 0.18, -lay.L * 0.12]) g.add(grabHandle(V3(x - 0.18, y, z), V3(x + 0.18, y, z), V3(0, 0, s), M, 0.06));
    }
  }
  // Appliqué armour welded over the ammo stowage (Sherman style).
  if (D.applique) {
    for (const s of [-1, 1]) {
      const y = (lay.ys + top) / 2;
      const z = s * (halfAt(y) + 0.013);
      for (const x of [lay.L * 0.12, -lay.L * 0.08]) {
        const pl = mesh(rbox(0.75, (top - lay.ys) * 0.75, 0.025, 0.01, x, y, z), paint, () => ({ name: "Appliqué armour", t: H.side + 25 }));
        g.add(pl);
      }
    }
  }
  // Spare track links on the glacis.
  if (D.glacisTracks) {
    const link = trackLinkGeometry(0.13, Math.min(0.55, lay.tw), spec.gear.style === "modern");
    const yA = lay.noseY + 0.05;
    const yB = Math.min(top - 0.25, yA + 0.6);
    const n = Math.max(2, Math.floor((yB - yA) / 0.14));
    for (const zc of [-lay.Wl * 0.22, lay.Wl * 0.22]) {
      for (let i = 0; i < n; i++) {
        const y = yA + (i * (yB - yA)) / n;
        const l = mesh(link.clone(), M.trackSteel);
        l.position.set(lay.frontX(y) + 0.04, y, zc);
        l.rotation.set(0, 0, deg(H.frontSlope) - Math.PI / 2);
        g.add(l);
      }
      g.add(mesh(box(0.03, 0.03, 0.62, lay.frontX(yB) + 0.05, yB, zc), M.dark));
    }
  }
  // External fuel drums on the rear sides (Soviet style).
  if (D.fuelDrums) {
    for (const s of [-1, 1]) {
      for (const x of [-lay.L * 0.32, -lay.L * 0.14]) {
        const y = lay.ys + 0.22;
        const d = fuelDrum(M, 0.62, 0.17);
        d.position.set(x, y, s * (halfAt(y) + 0.2));
        g.add(d);
        g.add(mesh(box(0.05, 0.3, 0.04, x - 0.2, y - 0.08, s * (halfAt(y) + 0.03)), M.dark));
        g.add(mesh(box(0.05, 0.3, 0.04, x + 0.2, y - 0.08, s * (halfAt(y) + 0.03)), M.dark));
      }
    }
  }
  // Spare road wheels on the rear.
  if (D.spareWheels) {
    for (const z of [-lay.Wl * 0.28, lay.Wl * 0.28]) {
      const w = spareWheel(M, lay.rw * 0.95, 0.12);
      w.rotation.y = Math.PI / 2;
      w.position.set(lay.rearX(lay.yk) - 0.09, lay.yk, z);
      g.add(w);
    }
  }
  // Rear plate: tail lights, tow pintle, jack block, track adjusters.
  {
    const ry = lay.yk + 0.1;
    const rx = lay.rearX(ry);
    for (const z of [-lay.Wl * 0.42, lay.Wl * 0.42]) {
      const tl = tailLight(M);
      tl.position.set(rx - 0.04, top - 0.12, z);
      g.add(tl);
    }
    g.add(mesh(rbox(0.12, 0.12, 0.2, 0.02, lay.rearX(lay.c + 0.15) - 0.08, lay.c + 0.15, 0), M.dark));
    g.add(mesh(new THREE.TorusGeometry(0.05, 0.016, 6, 14).rotateY(Math.PI / 2).translate(lay.rearX(lay.c + 0.15) - 0.16, lay.c + 0.15, 0), M.steel));
    g.add(mesh(rbox(0.5, 0.16, 0.16, 0.02, rx - 0.11, ry - 0.25, -lay.Wl * 0.15), M.wood));
    for (const s of [-1, 1]) g.add(mesh(cyl(0.05, 0.05, 0.25, "x", 12).translate(-lay.L / 2 + 0.05, lay.wheelY + 0.2, s * (lay.Wl / 2 + 0.06)), M.dark));
  }
  // Sherman / Pershing extras: ventilator dome, siren.
  if (H.style === "rounded" || H.style === "sloped") {
    g.add(mesh(new THREE.SphereGeometry(0.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(fxTop - 0.95, top, 0), M.paintCastPlain));
    if (H.style === "rounded") {
      const siren = new THREE.Group();
      siren.add(mesh(cyl(0.06, 0.06, 0.1, "x", 16), M.dark));
      siren.add(mesh(cyl(0.05, 0.05, 0.02, "x", 16).translate(0.06, 0, 0), M.chrome));
      siren.position.set(lay.frontX(lay.noseY + 0.15) + 0.08, lay.noseY + 0.2, lay.Wl * 0.1);
      g.add(siren);
    }
  }

  // Tow cables with eyes, along the sides.
  if (D.cables) {
    for (const s of [-1, 1]) {
      const z = s * (halfTop + 0.03);
      const y = (lay.ys + top) / 2;
      const pts = [];
      for (let i = 0; i <= 24; i++) pts.push([rxTop + 0.3 + (deckL - 0.6) * (i / 24), y + Math.sin(i * 1.3) * 0.008, z]);
      g.add(mesh(tube(pts, 0.022, 120, 8), M.cable));
      for (const x of [rxTop + 0.3, fxTop - 0.3]) {
        g.add(mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 14).translate(x, y, z), M.cable));
        g.add(mesh(box(0.05, 0.08, 0.04, x, y, z - s * 0.01), M.dark));
      }
    }
  }

  // Shovel, axe, sledgehammer, jack and gun-cleaning rods.
  if (D.tools) {
    const z = halfTop + 0.04;
    const y = (lay.ys + top) / 2 + 0.12;
    const tools = [];
    const handle = (x, len) => tools.push(cyl(0.016, 0.016, len, "x", 8).translate(x, y, z));
    handle(-lay.L * 0.05, 0.95);
    g.add(merged(tools, M.wood));
    g.add(mesh(box(0.24, 0.2, 0.02, -lay.L * 0.05 + 0.55, y, z), M.steel));
    g.add(mesh(box(0.1, 0.16, 0.06, lay.L * 0.18, y - 0.04, z), M.steel));
    g.add(mesh(cyl(0.016, 0.016, 0.7, "x", 8).translate(lay.L * 0.18 - 0.35, y - 0.04, z), M.wood));
    g.add(mesh(rbox(0.5, 0.1, 0.12, 0.02, lay.L * 0.3, top + 0.05, -halfTop + 0.12), M.dark));
    const rods = [];
    for (let i = 0; i < 3; i++) rods.push(cyl(0.012, 0.012, deckL * 0.55, "x", 6).translate(deckX + deckL * 0.25, top + 0.03, -halfTop + 0.3 + i * 0.035));
    g.add(merged(rods, M.steel));
  }

  // Exhausts.
  const ex = [];
  const rearTopX = lay.rearX(top - 0.3);
  if (D.exhaust === "mufflers") {
    for (const z of [-0.45, 0.45]) {
      const x = rearTopX - 0.12;
      g.add(mesh(cyl(0.075, 0.075, 0.7, "y", 16).translate(x, top - 0.45, z), M.exhaust));
      g.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.55, 20, 1, true, Math.PI, Math.PI).translate(x - 0.02, top - 0.48, z), M.paintPlain));
      ex.push(V3(x, top - 0.06, z));
    }
    for (const z of [-lay.Wl * 0.38, lay.Wl * 0.38]) g.add(mesh(cyl(0.16, 0.16, 0.48, "y", 20).translate(lay.rearX(lay.yk) - 0.15, lay.yk, z), M.paintPlain));
  } else if (D.exhaust === "pipes") {
    for (const z of [-lay.Wl * 0.25, lay.Wl * 0.25]) {
      const x = lay.rearX(lay.yk) - 0.05;
      const pipe = cyl(0.07, 0.07, 0.3, "x", 16).rotateZ(0.5).translate(x, lay.yk + 0.05, z);
      g.add(mesh(pipe, M.exhaust));
      ex.push(V3(x - 0.15, lay.yk + 0.12, z));
    }
  } else if (D.exhaust === "deflector") {
    g.add(mesh(rbox(0.25, 0.4, lay.Wl * 0.8, 0.03, lay.rearX(lay.yk) - 0.14, lay.yk - 0.1, 0), M.paintPlain));
    ex.push(V3(lay.rearX(lay.yk) - 0.25, lay.yk - 0.3, 0));
  } else {
    g.add(mesh(rbox(0.06, 0.45, lay.Wl * 0.7, 0.02, lay.rearX(top - 0.3) - 0.03, top - 0.3, 0), M.dark));
    const grille = [];
    for (let i = 0; i < 10; i++) grille.push(box(0.07, 0.4, 0.015, lay.rearX(top - 0.3) - 0.05, top - 0.3, -lay.Wl * 0.33 + (i * lay.Wl * 0.66) / 9));
    g.add(merged(grille, M.black));
    ex.push(V3(lay.rearX(top - 0.3) - 0.1, top - 0.3, 0));
  }
  out.exhausts = ex;

  // Antennas on the hull rear deck.
  for (let i = 0; i < Math.max(0, D.antennas - 1); i++) addAntenna(g, M, V3(rxTop + 0.4, top, (i % 2 ? -1 : 1) * (halfTop - 0.2)), 2.2, out);

  // Stowage.
  if (D.stowage === "logs" || D.stowage === "heavy") {
    const log = cyl(0.12, 0.12, lay.Wt * 0.95, "z", 14);
    g.add(mesh(log.translate(rxTop + 0.12, top + 0.13, 0), M.wood));
    for (const z of [-0.5, 0.5]) g.add(mesh(new THREE.TorusGeometry(0.13, 0.012, 6, 16).translate(rxTop + 0.12, top + 0.13, z), M.dark));
  }
  if (D.stowage === "field" || D.stowage === "heavy") {
    for (let i = 0; i < 3; i++) g.add(jerrycan(M, V3(rxTop + 0.4 + i * 0.25, top + 0.17, halfTop - 0.25)));
    g.add(mesh(rbox(0.6, 0.3, 0.4, 0.02, deckX - 0.2, top + 0.15, -halfTop + 0.35), M.wood));
    g.add(mesh(rbox(0.6, 0.3, 0.4, 0.02, deckX - 0.2, top + 0.15, -halfTop + 0.35).scale(1, 0.12, 1.02).translate(0, top * 0.88 + 0.28, 0), M.dark));
  }
  if (D.stowage === "heavy") {
    g.add(mesh(cyl(0.18, 0.18, lay.Wt * 0.6, "z", 16).translate(deckX + 0.4, top + 0.18, 0), M.canvas));
    for (const z of [-0.6, 0, 0.6]) g.add(mesh(new THREE.TorusGeometry(0.185, 0.01, 6, 16).translate(deckX + 0.4, top + 0.18, z), M.olive));
  }
  if (D.sandbags) {
    const bags = [];
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 6; i++) {
        const y = lay.noseY + 0.12 + row * 0.15;
        const b = new THREE.SphereGeometry(0.17, 12, 8).scale(1, 0.45, 1.6).translate(lay.frontX(y) + 0.05, y, -lay.Wl / 2 + 0.25 + i * (lay.Wl - 0.5) / 5 + (row % 2) * 0.1);
        bags.push(b);
      }
    }
    g.add(merged(bags, M.sand, () => ({ name: "Sandbags", t: 15 })));
  }

  out.deckTop = top;
  out.halfTop = halfTop;
  return g;
}

function jerrycan(M, at) {
  const g = new THREE.Group();
  g.add(mesh(rbox(0.16, 0.34, 0.24, 0.02), M.olive));
  g.add(mesh(box(0.17, 0.02, 0.2, 0, 0.04, 0), M.dark));
  g.add(mesh(cyl(0.02, 0.02, 0.05, "y", 8).translate(0.03, 0.19, 0.06), M.dark));
  g.position.copy(at);
  return g;
}

function addAntenna(parent, M, at, len, out) {
  const base = mesh(cyl(0.04, 0.05, 0.12, "y", 12).translate(at.x, at.y + 0.06, at.z), M.dark);
  parent.add(base);
  const whip = new THREE.Group();
  whip.position.set(at.x, at.y + 0.12, at.z);
  whip.add(mesh(cyl(0.006, 0.01, len, "y", 6).translate(0, len / 2, 0), M.black, null, { shadow: false }));
  parent.add(whip);
  (out.antennas ??= []).push(whip);
}

// ---------------------------------------------------------------------------
// Running gear
// ---------------------------------------------------------------------------

/** Road wheel: rubber tyre + pressed-steel dish + hub with bolts. */
function wheelGeometry(r, width, style) {
  const rubberT = style === "christie" || style === "modern" || style === "bogie" ? 0.16 : 0.13;
  const tyre = new THREE.LatheGeometry(
    [
      [r * (1 - rubberT), -width / 2],
      [r * 0.97, -width / 2],
      [r, -width * 0.35],
      [r, width * 0.35],
      [r * 0.97, width / 2],
      [r * (1 - rubberT), width / 2],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    44,
  ).rotateX(Math.PI / 2);
  const rim = 1 - rubberT;
  const disc = new THREE.LatheGeometry(
    [
      [0.001, width * 0.62],
      [r * 0.15, width * 0.62],
      [r * 0.2, width * 0.42],
      [r * 0.5 * rim, width * 0.26],
      [r * 0.62 * rim, width * 0.36],
      [r * 0.97 * rim, width * 0.42],
      [r * rim, width * 0.3],
      [r * rim, -width * 0.3],
      [r * 0.2, -width * 0.4],
      [0.001, -width * 0.4],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    44,
  ).rotateX(Math.PI / 2);
  const parts = [disc];
  const nb = style === "christie" ? 0 : 8;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    parts.push(cyl(0.013, 0.013, 0.03, "z", 6).translate(Math.cos(a) * r * 0.11, Math.sin(a) * r * 0.11, width * 0.65));
  }
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * Math.PI * 2 + 0.2;
    parts.push(cyl(0.01, 0.01, 0.02, "z", 6).translate(Math.cos(a) * r * 0.72 * rim, Math.sin(a) * r * 0.72 * rim, width * 0.42));
  }
  if (style === "christie" || style === "spoked") {
    // Lightening holes (T-34 style): dark discs on the dish.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      parts.push(cyl(r * 0.1, r * 0.1, 0.01, "z", 12).translate(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, width * 0.3));
    }
  }
  const hub = cyl(r * 0.16, r * 0.14, width * 0.3, "z", 16).translate(0, 0, width * 0.68);
  parts.push(hub);
  return { tyre, disc: mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)).map(stripAttrs)) };
}

function stripAttrs(g) {
  for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
}

function sprocketGeometry(r, width) {
  const parts = [];
  const teeth = Math.round(r * 40);
  for (const z of [-width * 0.32, width * 0.32]) {
    parts.push(cyl(r * 0.9, r * 0.9, 0.05, "z", 48).translate(0, 0, z));
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      parts.push(box(0.065, 0.1, 0.05).rotateZ(a).translate(Math.cos(a) * r * 0.96, Math.sin(a) * r * 0.96, z));
    }
  }
  parts.push(cyl(r * 0.36, r * 0.36, width * 0.9, "z", 24));
  parts.push(cyl(r * 0.22, r * 0.18, 0.12, "z", 16).translate(0, 0, width * 0.5));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    parts.push(cyl(0.018, 0.018, 0.05, "z", 6).translate(Math.cos(a) * r * 0.27, Math.sin(a) * r * 0.27, width * 0.48));
  }
  return mergeGeometries(parts.map((p) => stripAttrs(p.index ? p.toNonIndexed() : p)));
}

/** One track link: shoe plate, grousers or rubber pads, end connectors, guide horn and pins. */
function trackLinkGeometry(pitch, width, modern) {
  const parts = [box(pitch * 0.9, 0.05, width * 0.82)];
  if (modern) {
    for (const s of [-1, 1]) parts.push(box(pitch * 0.7, 0.035, width * 0.36, 0, -0.04, s * width * 0.22));
  } else {
    parts.push(box(0.024, 0.032, width * 0.8, -pitch * 0.24, -0.038, 0));
    parts.push(box(0.024, 0.032, width * 0.8, pitch * 0.24, -0.038, 0));
  }
  // End connectors along both edges (what you see from the side).
  for (const s of [-1, 1]) {
    parts.push(box(pitch * 0.55, 0.085, 0.07, pitch * 0.2, 0, s * (width / 2 - 0.035)));
    parts.push(cyl(0.022, 0.022, 0.09, "z", 8).translate(pitch * 0.48, 0, s * (width / 2 - 0.035)));
  }
  // Guide horns between the wheel pairs.
  parts.push(box(pitch * 0.5, 0.11, 0.035, -pitch * 0.05, 0.075, -0.06));
  parts.push(box(pitch * 0.5, 0.11, 0.035, -pitch * 0.05, 0.075, 0.06));
  parts.push(cyl(0.016, 0.016, width * 0.95, "z", 8).translate(pitch / 2, 0, 0));
  return mergeGeometries(parts.map((p) => stripAttrs(p.index ? p.toNonIndexed() : p)));
}

function buildRunningGear(spec, lay, M, side, out) {
  const G = spec.gear;
  const g = new THREE.Group();
  g.name = `gear-${side > 0 ? "right" : "left"}`;
  const z = side * lay.tz;
  const rw = lay.rw;
  const front = lay.L / 2 + 0.02;
  const rear = -lay.L / 2 - 0.02;
  const rs = Math.min(0.46, Math.max(0.3, rw * 1.05));
  const ri = rs * 0.86;
  const spY = lay.tall ? lay.trackTop - rs - 0.05 : Math.max(lay.wheelY + 0.12, lay.trackTop - rs - 0.04);
  const idY = lay.tall ? lay.trackTop - ri - 0.05 : Math.max(lay.wheelY + 0.05, spY - 0.06);
  const spX = G.drive === "front" ? front - rs * 0.4 : rear + rs * 0.4;
  const idX = G.drive === "front" ? rear + ri * 0.4 : front - ri * 0.4;
  const sp = { x: spX, y: spY, r: rs };
  const id = { x: idX, y: idY, r: ri };
  const wheels = [];
  const ww = G.style === "interleaved" ? 0.1 : Math.min(0.22, lay.tw * 0.32);
  const wheel = (x, y, r, zz, style = G.style) => {
    const geo = wheelGeometry(r, ww, style);
    const w = new THREE.Group();
    w.add(mesh(geo.tyre, M.rubber));
    w.add(mesh(geo.disc, M.paintPlain));
    w.position.set(x, y, zz);
    if (side < 0) w.rotation.y = Math.PI;
    w.userData.r = r;
    w.userData.part2 = "wheel";
    g.add(w);
    wheels.push(w);
    return w;
  };
  // Road wheel stations between the sprocket and the idler.
  const x0 = Math.min(spX, idX) + (G.drive === "front" ? ri : rs) + rw * 0.95;
  const x1 = Math.max(spX, idX) - (G.drive === "front" ? rs : ri) - rw * 0.95;
  const n = G.style === "bogie" ? Math.max(2, Math.round(G.wheels / 2)) * 2 : G.wheels;
  const xs = [];
  if (G.style === "bogie") {
    const bogies = n / 2;
    for (let b = 0; b < bogies; b++) {
      const cx = x0 + (bogies === 1 ? (x1 - x0) / 2 : ((x1 - x0) * b) / (bogies - 1));
      xs.push(cx - rw * 1.05, cx + rw * 1.05);
      // Bogie bracket up to the return roller, volute spring housings, wheel arms and the skid.
      const rollerY = lay.trackTop - 0.13;
      const bz = z - side * ww * 0.15;
      g.add(mesh(rbox(rw * 0.9, rollerY - lay.wheelY + 0.05, ww * 1.6, 0.04, cx, (rollerY + lay.wheelY) / 2 + 0.02, bz), M.paintCastPlain));
      for (const dx of [-rw * 0.55, rw * 0.55]) {
        g.add(mesh(cyl(rw * 0.28, rw * 0.32, rw * 0.9, "y", 18).translate(cx + dx * 0.6, lay.wheelY + rw * 0.95, bz), M.paintCastPlain));
        g.add(mesh(box(rw * 1.3, 0.09, 0.07, cx + dx * 1.05, lay.wheelY + rw * 0.35, bz).rotateZ(0), M.paintCastPlain));
      }
      g.add(mesh(box(rw * 1.6, 0.05, 0.12, cx, rollerY + 0.06, bz), M.paintCastPlain));
      const rr = wheel(cx + rw * 0.35, rollerY, 0.11, z, "torsion");
      rr.userData.roller = true;
      rr.userData.part2 = "roller";
      g.add(mesh(cyl(0.035, 0.035, lay.Wl / 2 - Math.abs(bz) + Math.abs(z), "z", 10).translate(cx, lay.wheelY + rw * 0.8, side * (lay.Wl / 2 + Math.abs(bz)) / 2), M.dark));
    }
  } else {
    for (let i = 0; i < n; i++) xs.push(x0 + (n === 1 ? (x1 - x0) / 2 : ((x1 - x0) * i) / (n - 1)));
  }
  xs.forEach((x, i) => {
    if (G.style === "interleaved") {
      const offs = i % 2 ? [lay.tw * 0.38, -lay.tw * 0.08] : [lay.tw * 0.15, -lay.tw * 0.32];
      for (const o of offs) wheel(x, lay.wheelY, rw, z + side * o);
    } else if (G.style === "churchill") {
      wheel(x, lay.wheelY, rw, z + side * lay.tw * 0.2);
    } else {
      // Dual wheels: one each side of the guide horns.
      wheel(x, lay.wheelY, rw, z + side * lay.tw * 0.22);
      wheel(x, lay.wheelY, rw, z - side * lay.tw * 0.22);
    }
    // Suspension arm toward the hull.
    if (G.style !== "bogie" && !lay.tall) g.add(mesh(box(rw * 0.9, 0.08, 0.06).rotateZ(0.25).translate(x - rw * 0.35, lay.wheelY + 0.05, side * (lay.Wl / 2 + 0.04)), M.dark));
  });
  // Return rollers.
  const rollerY = lay.trackTop - 0.13;
  for (let i = 0; i < G.rollers; i++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / G.rollers;
    const r = wheel(x, rollerY, 0.1, z, "torsion");
    r.userData.roller = true;
    r.userData.part2 = "roller";
  }
  // Sprocket and idler.
  const spr = mesh(sprocketGeometry(rs, lay.tw), M.paintPlain);
  spr.position.set(spX, spY, z);
  spr.userData.r = rs;
  spr.userData.part2 = "sprocket";
  g.add(spr);
  wheels.push(spr);
  const idler = new THREE.Group();
  const ig = wheelGeometry(ri, 0.1, "torsion");
  for (const o of [-lay.tw * 0.25, lay.tw * 0.25]) {
    const d = mesh(ig.disc, M.paintPlain);
    d.position.z = o;
    idler.add(d);
  }
  idler.position.set(idX, idY, z);
  idler.userData.r = ri;
  idler.userData.part2 = "idler";
  if (side < 0) idler.rotation.y = Math.PI;
  g.add(idler);
  wheels.push(idler);

  // Track: instanced links along a closed path around everything.
  const pts = [];
  const arc = (c, r, a0, a1, steps) => {
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      pts.push(V3(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, 0));
    }
  };
  const fr = sp.x > id.x ? sp : id;
  const re = sp.x > id.x ? id : sp;
  const firstX = Math.min(...xs);
  const lastX = Math.max(...xs);
  const tt = 0.04;
  pts.push(V3(firstX, tt, 0), V3(lastX, tt, 0));
  arc({ x: fr.x, y: fr.y }, fr.r + tt, -Math.PI * 0.42, Math.PI * 0.55, 10);
  const topY = Math.max(fr.y, re.y) + Math.max(fr.r, re.r) + tt;
  const runTop = G.rollers || G.style === "bogie" || lay.tall ? Math.min(topY, lay.trackTop) : lay.wheelY + rw + tt + 0.02;
  pts.push(V3(fr.x - (fr.r + 0.4), runTop + (G.rollers ? 0 : 0.0), 0), V3((fr.x + re.x) / 2, runTop - (G.rollers ? 0.03 : 0.01), 0), V3(re.x + re.r + 0.4, runTop, 0));
  arc({ x: re.x, y: re.y }, re.r + tt, Math.PI * 0.45, Math.PI * 1.42, 10);
  const curve = new THREE.CatmullRomCurve3(pts, true, "centripetal", 0.2);
  const length = curve.getLength();
  const pitch = G.style === "modern" ? 0.16 : 0.13;
  const count = Math.floor(length / pitch);
  const inst = new THREE.InstancedMesh(trackLinkGeometry(pitch, lay.tw, G.style === "modern"), M.trackSteel, count);
  inst.castShadow = true;
  inst.receiveShadow = true;
  inst.userData.armor = () => ({ name: "Track", t: 20 });
  const dummy = new THREE.Object3D();
  const samples = [];
  const N = 600;
  for (let i = 0; i < N; i++) {
    const u = i / N;
    samples.push({ p: curve.getPointAt(u), a: Math.atan2(curve.getTangentAt(u).y, curve.getTangentAt(u).x) });
  }
  const place = (offset) => {
    for (let i = 0; i < count; i++) {
      const u = ((((i * pitch + offset) % length) + length) % length) / length;
      const s = samples[Math.floor(u * N) % N];
      dummy.position.set(s.p.x, s.p.y, z);
      dummy.rotation.set(0, 0, s.a);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  };
  place(0);
  g.add(inst);
  out.tracks.push({ place, length, wheels });
  return g;
}

/** Side skirts hung along the hull: Schürzen on brackets, rubber flaps, bolted armour or ERA. */
function buildSkirts(spec, lay, M) {
  const G = spec.gear;
  const kind = G.skirts;
  if (kind === "none") return null;
  const g = new THREE.Group();
  g.name = "skirts";
  const top = lay.tall ? lay.Hh - 0.1 : lay.ys - 0.03;
  const bottom = { rubber: lay.wheelY + lay.rw * 0.2, armour: lay.wheelY - lay.rw * 0.15, era: lay.wheelY + lay.rw * 0.15, panels: lay.trackTop - 0.32 }[kind] ?? lay.trackTop - 0.3;
  const h = Math.max(0.16, top - bottom);
  const len = lay.L * 0.86;
  const pitch = { era: 0.34, rubber: 0.55, armour: 1.15, panels: 0.95 }[kind] ?? 1;
  const panels = Math.max(2, Math.round(len / pitch));
  const pw = len / panels;
  const thick = kind === "armour" ? Math.min(0.12, Math.max(0.035, G.skirtArmor / 500)) : kind === "era" ? 0.12 : kind === "rubber" ? 0.025 : 0.012;
  const gap = kind === "panels" ? 0.035 : kind === "rubber" ? 0.03 : 0.01;
  const standoff = kind === "panels" ? 0.1 : 0.015;
  const armor = () => ({ name: kind === "era" ? "Reactive armour" : kind === "rubber" ? "Rubber skirt" : "Side skirt", t: G.skirtArmor });
  const mat = kind === "rubber" ? M.color("#2f2f2c", { roughness: 0.95 }) : M.paintPlain;
  for (const s of [-1, 1]) {
    const z = s * (lay.Wt / 2 + standoff + thick / 2);
    const hullZ = s * (lay.Wt / 2 - 0.02);
    if (kind === "panels") {
      // Rail on brackets standing off the track guard; the plates hang from it.
      g.add(mesh(box(len + 0.02, 0.035, 0.03, 0, top + 0.01, z - s * thick), M.dark));
      for (let i = 0; i <= panels; i++) {
        const x = -len / 2 + pw * i + (i === 0 ? 0.06 : i === panels ? -0.06 : 0);
        g.add(mesh(box(0.035, 0.035, Math.abs(z - hullZ), x, top + 0.01, (z + hullZ) / 2), M.dark));
      }
    } else if (kind === "rubber" || kind === "armour") {
      g.add(mesh(box(len, 0.05, thick + 0.02, 0, top - 0.02, z), kind === "rubber" ? M.dark : M.paintPlain, armor));
    }
    for (let i = 0; i < panels; i++) {
      const x = -len / 2 + pw * (i + 0.5);
      const w = pw - gap;
      if (kind === "era") {
        g.add(mesh(rbox(w, h, thick, 0.012, x, top - h / 2, z), M.paintPlain, armor));
        g.add(merged(bolts([[x - w * 0.3, top - 0.05, z + s * (thick / 2 + 0.005)], [x + w * 0.3, top - 0.05, z + s * (thick / 2 + 0.005)]], 0.015, "z"), M.dark));
        continue;
      }
      // The end plates have their lower outer corner cut away, like the real thing.
      const c = Math.min(h * 0.45, w * 0.4);
      const front = i === panels - 1;
      const rear = i === 0;
      const hw = w / 2;
      const hh = h / 2;
      const prof = [[-hw + (rear ? c : 0), -hh], [hw - (front ? c : 0), -hh], [hw, -hh + (front ? c : 0)], [hw, hh], [-hw, hh], [-hw, -hh + (rear ? c : 0)]];
      const p = mesh(sideExtrude(prof, thick, Math.min(0.006, thick / 4)).translate(x, top - h / 2, z), mat, armor);
      g.add(p);
      if (kind === "rubber") {
        // Moulded ribs across each flap.
        for (const dy of [0.25, 0.5, 0.75]) g.add(mesh(box(w * 0.92, 0.025, 0.012, x, top - h * dy, z + s * (thick / 2 + 0.004)), mat));
      }
      if (kind === "armour") {
        const bz = z + s * (thick / 2 + 0.004);
        g.add(merged(bolts([[x - w * 0.38, top - 0.08, bz], [x, top - 0.08, bz], [x + w * 0.38, top - 0.08, bz], [x - w * 0.38, top - h + 0.1, bz], [x + w * 0.38, top - h + 0.1, bz]], 0.016, "z"), M.dark));
      }
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// Turret, mantlet and gun
// ---------------------------------------------------------------------------

function turretOutline(style, Lt, W) {
  const pts = [];
  const xf = Lt * 0.44;
  switch (style) {
    case "horseshoe": {
      const r = W / 2;
      const xr = -Lt * 0.56 + r;
      pts.push([xf, -W / 2 + 0.02], [xf, W / 2 - 0.02]);
      for (let i = 0; i <= 24; i++) {
        const a = Math.PI / 2 + (i / 24) * Math.PI;
        pts.push([xr + Math.cos(a) * r, Math.sin(a) * r]);
      }
      return pts;
    }
    case "box":
      return [[xf, -W * 0.42], [xf, W * 0.42], [xf - 0.12, W / 2], [-Lt * 0.56 + 0.1, W / 2], [-Lt * 0.56, W * 0.42], [-Lt * 0.56, -W * 0.42], [-Lt * 0.56 + 0.1, -W / 2], [xf - 0.12, -W / 2]];
    case "sloped":
      return [[xf, -W * 0.36], [xf, W * 0.36], [xf - Lt * 0.25, W / 2], [-Lt * 0.5, W * 0.46], [-Lt * 0.56, W * 0.3], [-Lt * 0.56, -W * 0.3], [-Lt * 0.5, -W * 0.46], [xf - Lt * 0.25, -W / 2]];
    case "flat":
      return [[xf + Lt * 0.04, -W * 0.22], [xf + Lt * 0.04, W * 0.22], [xf - Lt * 0.06, W / 2], [-Lt * 0.56, W * 0.44], [-Lt * 0.56, -W * 0.44], [xf - Lt * 0.06, -W / 2]];
    case "wedge":
      return [[xf + Lt * 0.18, -W * 0.12], [xf + Lt * 0.18, W * 0.12], [xf - Lt * 0.12, W / 2], [-Lt * 0.56, W * 0.44], [-Lt * 0.56, -W * 0.44], [xf - Lt * 0.12, -W / 2]];
    default: {
      // Cast / round: a super-ellipse, fuller at the front.
      const n = style === "round" ? 2.4 : 2.8;
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * Lt * 0.5;
        pts.push([x - Lt * 0.06, Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * (W / 2) * (c > 0 ? 0.92 : 1)]);
      }
      return pts;
    }
  }
}

function buildTurret(spec, lay, M, out) {
  const T = spec.turret;
  const Gn = spec.gun;
  const H = spec.hull;
  const yaw = new THREE.Group();
  yaw.name = "turret";
  const casemate = T.style === "none";
  const Lt = T.length;
  const W = T.width;
  const Ht = T.height;
  const paint = H.zimmerit ? M.paint : M.paintPlain;
  const armorFn = (n) => {
    if (n.y > 0.78) return { name: "Turret roof", t: T.roof };
    if (n.x > 0.42) return { name: "Turret front", t: T.front };
    if (n.x < -0.5) return { name: "Turret rear", t: T.rear };
    return { name: "Turret side", t: T.side };
  };
  let frontX;
  let gunY = lay.Hh - 0.35;
  let shell = null;
  let probe = null;
  // Where the turret surface really is (curved turrets need this so parts sit on them).
  const ray = new THREE.Raycaster();
  const hitP = (o, d) => {
    if (!probe) return null;
    ray.set(o, d);
    return ray.intersectObject(probe, false)[0]?.point ?? null;
  };
  const surf = {
    top: (x, z) => hitP(V3(x, 20, z), V3(0, -1, 0))?.y ?? null,
    side: (x, y, s) => hitP(V3(x, y, s * 20), V3(0, 0, -s))?.z ?? null,
    front: (y, z) => hitP(V3(30, y, z), V3(-1, 0, 0))?.x ?? null,
    rear: (y, z) => hitP(V3(-30, y, z), V3(1, 0, 0))?.x ?? null,
  };
  if (!casemate) {
    yaw.position.set(-lay.L / 2 + lay.L * T.at, lay.Hh, 0);
    const outline = turretOutline(T.style, Lt, W);
    const geo = topExtrude(outline, Ht, T.style === "cast" || T.style === "round" ? 0.05 : 0.03, 32, 6);
    const fs = Math.tan(deg(T.frontSlope));
    const dome = T.style === "cast" ? 0.3 : T.style === "round" ? 0.22 : 0;
    const sideIn = T.style === "sloped" ? Math.tan(deg(25)) : T.style === "flat" || T.style === "wedge" ? Math.tan(deg(8)) : 0;
    deform(geo, (v) => {
      const k = v.y / Ht;
      if (dome) {
        const sc = 1 - dome * Math.pow(Math.max(0, k), 1.8);
        v.x = v.x * sc;
        v.z = v.z * sc;
      }
      if (sideIn) v.z = Math.sign(v.z) * Math.max(0.2, Math.abs(v.z) - sideIn * v.y);
      if (fs && v.x > 0) v.x -= fs * v.y * Math.min(1, v.x / (Lt * 0.3));
    });
    shell = mesh(geo, paint, armorFn);
    yaw.add(shell);
    // Turret ring collar.
    yaw.add(mesh(cyl(W * 0.42, W * 0.44, 0.08, "y", 40).translate(-0.05, 0.0, 0), M.paintPlain, () => ({ name: "Turret ring", t: T.side })));
    probe = new THREE.Mesh(geo);
    probe.updateMatrixWorld(true);
    gunY = Ht * 0.48;
    frontX = surf.front(gunY, 0) ?? outline.reduce((m, [x]) => Math.max(m, x), -9) - fs * Ht * 0.5;
  } else {
    // Casemate: the gun comes out of the hull's front plate.
    frontX = lay.frontX(gunY);
  }

  // Mantlet + gun on an elevation pivot, sitting on the real front face.
  const k = Math.min(1.6, Math.max(0.55, Gn.caliber / 88));
  const pivot = new THREE.Group();
  pivot.name = "gun-pivot";
  pivot.position.set(frontX, gunY, 0);
  (casemate ? out.hull : yaw).add(pivot);
  const mArmor = () => ({ name: "Gun mantlet", t: Gn.mantletArmor });
  const mW = Math.min(W * (Gn.mantlet === "box" ? 0.72 : 0.5), (Gn.mantlet === "box" ? 1.5 : 1.05) * k);
  const mH = Math.min(Ht * 0.86, (Gn.mantlet === "slab" ? 0.55 : 0.68) * k);
  let mantFront;
  if (Gn.mantlet === "box") {
    pivot.add(mesh(rbox(0.36 * k, mH, mW, 0.06, 0.08 * k, 0, 0), paint, mArmor));
    mantFront = 0.26 * k;
  } else if (Gn.mantlet === "saukopf") {
    // Rounded "pig's head": a half-buried cylinder across the turret face.
    pivot.add(mesh(cyl(mH / 2, mH / 2, mW, "z", 40), M.paintCast, mArmor));
    pivot.add(mesh(rbox(0.12, mH * 0.95, mW * 1.02, 0.02, -0.04, 0, 0), M.paintCast, mArmor));
    mantFront = mH / 2;
  } else if (Gn.mantlet === "cast") {
    pivot.add(mesh(new THREE.SphereGeometry(0.34 * k, 36, 24).scale(0.85, mH / (0.68 * k), mW / (0.68 * k)).translate(0.04 * k, 0, 0), M.paintCast, mArmor));
    mantFront = 0.33 * k;
  } else {
    pivot.add(mesh(rbox(0.3 * k, mH, mW, 0.03, 0.1 * k, 0, 0), paint, mArmor));
    pivot.add(mesh(rbox(0.12 * k, mH * 0.75, mW * 0.7, 0.02, 0.28 * k, 0, 0), paint, mArmor));
    mantFront = 0.34 * k;
  }
  // Sight apertures and the coaxial MG.
  for (const z of [mW * 0.28, mW * 0.37]) pivot.add(mesh(cyl(0.03, 0.03, 0.08, "x", 12).translate(mantFront - 0.02, mH * 0.18, z), M.black));
  pivot.add(mesh(latheX([[0.03, 0], [0.03, 0.12], [0.016, 0.12], [0.016, 0.3]], 10).translate(mantFront - 0.06, mH * 0.05, -mW * 0.33), M.gunmetal));

  const recoil = new THREE.Group();
  recoil.name = "barrel";
  pivot.add(recoil);
  const cal = Gn.caliber / 1000;
  const len = cal * Gn.length;
  const rb = cal * 1.45;
  const rm = cal * 0.95;
  const start = mantFront - 0.05;
  const prof = [[0.001, 0], [rb * 1.1, 0], [rb * 1.1, 0.25 * k], [rb, 0.3 * k], [rb * 0.95, len * 0.3], [rm * 1.05, len * 0.65], [rm, len], [cal * 0.5, len], [cal * 0.5, len + 0.01]];
  recoil.add(mesh(latheX(prof, 32).translate(start, 0, 0), M.paintPlain, () => ({ name: "Gun barrel", t: 30 })));
  if (Gn.evacuator) recoil.add(mesh(latheX([[rm, 0], [rm * 1.7, 0.08], [rm * 1.75, len * 0.1], [rm * 1.6, len * 0.13], [rm, len * 0.15]], 28).translate(start + len * 0.55, 0, 0), M.paintPlain));
  if (Gn.sleeve) for (const f of [0.22, 0.42, 0.75]) recoil.add(mesh(cyl(rm * 1.45, rm * 1.45, 0.05, "x", 24).translate(start + len * f, 0, 0), M.dark));
  for (let i = 0; i < Gn.kills; i++) recoil.add(mesh(cyl(rb * 0.98, rb * 0.98, 0.022, "x", 24).translate(start + 0.4 * k + i * 0.045, 0, 0), M.color("#f1f2f0")));
  const mz = start + len;
  if (Gn.brake === "double") {
    recoil.add(mesh(cyl(rm * 1.25, rm * 1.25, rm * 5.5, "x", 24).translate(mz + rm * 2.6, 0, 0), M.paintPlain));
    for (const f of [1.0, 3.6]) {
      recoil.add(mesh(rbox(rm * 1.3, rm * 3.2, rm * 4, rm * 0.3, mz + rm * f, 0, 0), M.paintPlain));
      recoil.add(mesh(box(rm * 0.9, rm * 2.3, rm * 4.05, mz + rm * f, 0, 0), M.black));
    }
  } else if (Gn.brake === "single") {
    recoil.add(mesh(rbox(rm * 3, rm * 2.8, rm * 3.4, rm * 0.4, mz + rm * 1.4, 0, 0), M.paintPlain));
    recoil.add(mesh(box(rm * 1.6, rm * 2, rm * 3.45, mz + rm * 1.4, 0, 0), M.black));
  } else if (Gn.brake === "slotted") {
    recoil.add(mesh(cyl(rm * 1.4, rm * 1.4, rm * 4, "x", 24).translate(mz + rm * 2, 0, 0), M.paintPlain));
    for (let i = 0; i < 4; i++) recoil.add(mesh(box(rm * 0.4, rm * 0.6, rm * 3, mz + rm * (0.7 + i * 0.9), rm * 1.2, 0), M.black));
  }
  out.muzzle = new THREE.Object3D();
  out.muzzle.position.set(mz + (Gn.brake === "none" ? 0 : rm * 5), 0, 0);
  recoil.add(out.muzzle);
  out.gunPivot = pivot;
  out.barrel = recoil;
  out.turret = yaw;
  out.turretShell = shell;
  if (casemate) return yaw;

  // Everything below sits on the actual turret surface (curved turrets too).
  const topY = (x, z, fallback = Ht) => surf.top(x, z) ?? fallback;
  const sideZ = (x, y, s, fallback) => surf.side(x, y, s) ?? fallback;
  const rearX = surf.rear(Ht * 0.45, 0) ?? turretOutline(T.style, Lt, W).reduce((m, [x]) => Math.min(m, x), 9);

  // Commander's cupola.
  const cupX = -Lt * 0.22;
  const cupZ = W * 0.22;
  if (T.cupola !== "none") {
    const cup = new THREE.Group();
    // Seat it a little into the roof so it never floats on a sloped/domed top.
    cup.position.set(cupX, topY(cupX, cupZ) - 0.035, cupZ);
    if (T.cupola === "modern") {
      cup.add(mesh(rbox(0.5, 0.38, 0.42, 0.05, 0, 0.17, 0), M.paintPlain));
      cup.add(mesh(box(0.02, 0.18, 0.3, 0.26, 0.22, 0), M.visor));
      cup.add(mesh(cyl(0.05, 0.05, 0.25, "y", 12).translate(-0.12, 0.45, 0.1), M.dark));
    } else {
      cup.add(mesh(cyl(0.34, 0.37, 0.28, "y", 40).translate(0, 0.14, 0), M.paintCastPlain, () => ({ name: "Cupola", t: T.side })));
      if (T.cupola === "blocks" || T.cupola === "mg") {
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          cup.add(mesh(box(0.035, 0.07, 0.15).rotateY(-a).translate(Math.cos(a) * 0.35, 0.17, Math.sin(a) * 0.35), M.visor));
          cup.add(mesh(box(0.06, 0.02, 0.17).rotateY(-a).translate(Math.cos(a) * 0.36, 0.22, Math.sin(a) * 0.36), M.paintPlain));
        }
      }
      const lid = hatch(M, { r: 0.29, mat: M.paintPlain });
      lid.position.y = 0.28;
      cup.add(lid);
      if (T.cupola === "mg") {
        cup.add(mesh(new THREE.TorusGeometry(0.37, 0.02, 6, 32).rotateX(Math.PI / 2).translate(0, 0.36, 0), M.dark));
        const mg = new THREE.Group();
        mg.add(mesh(rbox(0.3, 0.12, 0.1, 0.02, 0.1, 0, 0), M.gunmetal));
        mg.add(mesh(latheX([[0.03, 0], [0.03, 0.5], [0.02, 0.5], [0.02, 0.85]], 10).translate(0.2, 0, 0), M.gunmetal));
        mg.add(mesh(rbox(0.14, 0.12, 0.08, 0.01, 0.05, -0.1, 0.08), M.olive));
        mg.position.set(0.22, 0.52, 0);
        cup.add(mg);
        cup.add(mesh(cyl(0.02, 0.02, 0.2, "y", 8).translate(0.25, 0.43, 0), M.dark));
      }
    }
    yaw.add(cup);
  }
  // Loader's hatch, ventilator, periscopes.
  {
    const hx = -Lt * 0.08;
    const hz = -W * 0.22;
    const h = hatch(M, { r: 0.26, periscope: true });
    h.position.set(hx, topY(hx, hz) - 0.02, hz);
    yaw.add(h);
    const vx = Lt * 0.2;
    yaw.add(mesh(new THREE.SphereGeometry(0.11, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(vx, topY(vx, -W * 0.05) - 0.02, -W * 0.05), M.paintCastPlain));
    for (const z of [W * 0.05, -W * 0.38]) {
      const px = Lt * 0.05;
      const p = periscope(M);
      p.position.set(px, topY(px, z) - 0.02, z);
      yaw.add(p);
    }
  }
  if (T.style !== "flat" && T.style !== "wedge") {
    // Pistol ports and vision slits on the sides.
    for (const s of [-1, 1]) {
      const ppx = -Lt * 0.3;
      const z1 = sideZ(ppx, Ht * 0.45, s, s * W * 0.45);
      const pp = pistolPort(M, paint);
      pp.position.set(ppx, Ht * 0.45, z1);
      if (s < 0) pp.rotation.y = Math.PI;
      yaw.add(pp);
      const vx = Lt * 0.12;
      const z2 = sideZ(vx, Ht * 0.55, s, s * W * 0.45);
      const vs = visionSlit(M, 0.22, paint);
      vs.rotation.y = -s * Math.PI / 2;
      vs.position.set(vx, Ht * 0.55, z2);
      yaw.add(vs);
    }
  } else {
    // Modern sights and the gunner's primary sight box.
    const sx = Lt * 0.15;
    const sz = -W * 0.28;
    const sy = topY(sx, sz);
    yaw.add(mesh(rbox(0.5, 0.34, 0.36, 0.04, sx, sy + 0.16, sz), M.paintPlain));
    yaw.add(mesh(box(0.02, 0.2, 0.28, sx + 0.26, sy + 0.18, sz), M.visor));
    for (const s of [-1, 1]) yaw.add(mesh(rbox(Lt * 0.5, 0.06, 0.12, 0.02, -Lt * 0.1, topY(-Lt * 0.1, s * W * 0.4) + 0.03, s * W * 0.4), M.dark));
    // Blow-out panel seams on the roof.
    yaw.add(merged([box(Lt * 0.3, 0.012, 0.01, -Lt * 0.3, Ht + 0.005, W * 0.2), box(Lt * 0.3, 0.012, 0.01, -Lt * 0.3, Ht + 0.005, -W * 0.2), box(0.01, 0.012, W * 0.4, -Lt * 0.15, Ht + 0.005, 0)], M.black));
  }
  // Lifting eyes on the roof edge.
  for (const [x, z] of [[Lt * 0.22, W * 0.32], [Lt * 0.22, -W * 0.32], [-Lt * 0.35, W * 0.28], [-Lt * 0.35, -W * 0.28]]) {
    const hk = liftingHook(M, M.paintPlain, 0.045);
    hk.position.set(x, topY(x, z) - 0.005, z);
    yaw.add(hk);
  }
  // Grab rails around the turret sides.
  for (const s of [-1, 1]) {
    const y = Ht * 0.78;
    const za = sideZ(-Lt * 0.25, y, s, s * W * 0.45);
    const zb = sideZ(Lt * 0.05, y, s, s * W * 0.45);
    yaw.add(grabHandle(V3(-Lt * 0.25, y, za), V3(Lt * 0.05, y, zb), V3(0, 0, s), M, 0.05, 0.01));
  }

  // Smoke dischargers, bolted to the sides.
  for (const s of [-1, 1]) {
    for (let i = 0; i < T.smoke; i++) {
      const x = Lt * 0.3 - i * 0.11;
      const y = Ht * 0.72;
      const z = sideZ(x, y, s, s * W * 0.47);
      const tubeG = cyl(0.045, 0.045, 0.26, "y", 14).rotateZ(-0.7).rotateX(s * 0.5);
      yaw.add(mesh(tubeG.translate(x, y + 0.06, z + s * 0.06), M.paintPlain));
      yaw.add(mesh(box(0.08, 0.06, 0.08, x, y, z + s * 0.03), M.paintPlain));
    }
  }
  // Spare track links on the turret sides.
  if (T.spareLinks) {
    const link = trackLinkGeometry(0.13, 0.5, false).rotateX(Math.PI / 2).rotateZ(Math.PI / 2);
    for (const s of [-1, 1]) {
      for (let i = 0; i < T.spareLinks; i++) {
        const x = -Lt * 0.05 - i * 0.135;
        const z = sideZ(x, Ht * 0.32, s, s * W * 0.5);
        const l = mesh(link.clone(), M.trackSteel);
        l.position.set(x, Ht * 0.32, z + s * 0.045);
        if (s < 0) l.rotation.y = Math.PI;
        yaw.add(l);
      }
      yaw.add(mesh(box(T.spareLinks * 0.135 + 0.05, 0.03, 0.03, -Lt * 0.05 - ((T.spareLinks - 1) * 0.135) / 2, Ht * 0.6, sideZ(-Lt * 0.1, Ht * 0.6, s, s * W * 0.5) + s * 0.02), M.dark));
    }
  }
  // Rear stowage.
  if (T.bustle === "bin") {
    yaw.add(mesh(rbox(0.46, 0.42, W * 0.6, 0.04, rearX - 0.2, Ht * 0.45, 0), M.paintPlain));
    yaw.add(mesh(box(0.48, 0.03, W * 0.61, rearX - 0.2, Ht * 0.67, 0), M.paintPlain));
    yaw.add(merged(bolts([[rearX - 0.43, Ht * 0.5, -W * 0.15], [rearX - 0.43, Ht * 0.5, W * 0.15]], 0.02, "x"), M.dark));
  } else if (T.bustle === "basket") {
    const rails = [];
    for (const y of [Ht * 0.3, Ht * 0.7]) rails.push(tube([[rearX + 0.1, y, -W * 0.45], [rearX - 0.35, y, -W * 0.4], [rearX - 0.4, y, 0], [rearX - 0.35, y, W * 0.4], [rearX + 0.1, y, W * 0.45]], 0.015, 40, 6));
    yaw.add(merged(rails, M.dark));
    yaw.add(mesh(cyl(0.16, 0.16, W * 0.6, "z", 14).translate(rearX - 0.18, Ht * 0.45, 0), M.canvas));
  } else if (T.bustle === "modern") {
    yaw.add(mesh(rbox(0.75, Ht * 0.8, W * 0.85, 0.05, rearX - 0.3, Ht * 0.45, 0), paint, () => ({ name: "Turret bustle", t: T.rear })));
  }
  // Turret antennas.
  if (spec.details.antennas > 0) {
    const ax = rearX + 0.3;
    const az = -W * 0.3;
    addAntenna(yaw, M, V3(ax, topY(ax, az) - 0.02, az), 2.4, out);
  }
  return yaw;
}

// ---------------------------------------------------------------------------
// Interior (X-ray)
// ---------------------------------------------------------------------------

/**
 * A crew member, facing +x, standing on y = 0. Seated unless `standing`.
 * `m` = { id, role, name, height (cm) }. Every body part carries the
 * ballistics tag so fragments can knock them out.
 */
function crewFigure(m, standing = false) {
  const k = m.height / 175;
  const color = (CREW_ROLES.find((r) => r[0] === m.role) ?? CREW_ROLES[1])[2];
  const uniform = new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: color, emissiveIntensity: 0.3 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe0b48a, roughness: 0.6, emissive: 0x3a2412, emissiveIntensity: 0.3 });
  const helmet = new THREE.MeshStandardMaterial({ color: 0x3b3326, roughness: 0.8 });
  const boots = new THREE.MeshStandardMaterial({ color: 0x1f1a14, roughness: 0.8 });
  const g = new THREE.Group();
  const part = { kind: "crew", role: m.role, id: m.id, name: m.name };
  const limb = (a, b, r, mat) => {
    const len = a.distanceTo(b);
    const geo = new THREE.CapsuleGeometry(r, Math.max(0.01, len), 4, 10);
    const o = mesh(geo, mat, null, { interior: true });
    o.position.copy(a).add(b).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize());
    o.userData.part = part;
    g.add(o);
    return o;
  };
  const hipY = standing ? 0.92 * k : 0.47 * k;
  const shoulderY = hipY + 0.52 * k;
  const lean = standing ? 0.02 : 0.06 * k;
  // Legs.
  for (const s of [-1, 1]) {
    const hip = V3(0, hipY, s * 0.1 * k);
    if (standing) {
      const knee = V3(0.03 * k, 0.48 * k, s * 0.1 * k);
      limb(hip, knee, 0.075 * k, uniform);
      limb(knee, V3(0, 0.08 * k, s * 0.1 * k), 0.06 * k, uniform);
      g.add(mesh(rbox(0.26 * k, 0.09 * k, 0.11 * k, 0.03, 0.06 * k, 0.045 * k, s * 0.1 * k), boots, null, { interior: true }));
    } else {
      const knee = V3(0.44 * k, hipY + 0.04 * k, s * 0.11 * k);
      limb(hip, knee, 0.078 * k, uniform);
      limb(knee, V3(0.48 * k, 0.08 * k, s * 0.11 * k), 0.062 * k, uniform);
      g.add(mesh(rbox(0.26 * k, 0.09 * k, 0.11 * k, 0.03, 0.54 * k, 0.045 * k, s * 0.11 * k), boots, null, { interior: true }));
    }
  }
  // Torso, neck and head with a padded tanker's helmet and headphones.
  limb(V3(0, hipY + 0.12 * k, 0), V3(lean, shoulderY - 0.06 * k, 0), 0.16 * k, uniform);
  limb(V3(lean, shoulderY, 0), V3(lean + 0.01, shoulderY + 0.1 * k, 0), 0.05 * k, skin);
  const head = mesh(new THREE.SphereGeometry(0.105 * k, 18, 14), skin, null, { interior: true });
  head.position.set(lean + 0.02 * k, shoulderY + 0.2 * k, 0);
  head.userData.part = part;
  g.add(head);
  const hat = mesh(new THREE.SphereGeometry(0.118 * k, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), helmet, null, { interior: true });
  hat.position.copy(head.position).add(V3(-0.01 * k, 0.015 * k, 0));
  hat.userData.part = part;
  g.add(hat);
  for (const s of [-1, 1]) g.add(mesh(cyl(0.04 * k, 0.04 * k, 0.03 * k, "z", 12).translate(head.position.x, head.position.y, s * 0.11 * k), boots, null, { interior: true }));
  // Arms: reaching for the controls (or holding a round, for a standing loader).
  for (const s of [-1, 1]) {
    const sh = V3(lean, shoulderY - 0.03 * k, s * 0.2 * k);
    const elbow = V3(lean + 0.16 * k, shoulderY - 0.28 * k, s * 0.22 * k);
    const hand = standing ? V3(lean + 0.36 * k, shoulderY - 0.22 * k, s * 0.12 * k) : V3(lean + 0.42 * k, shoulderY - 0.3 * k, s * 0.17 * k);
    limb(sh, elbow, 0.055 * k, uniform);
    limb(elbow, hand, 0.048 * k, uniform);
    const h = mesh(new THREE.SphereGeometry(0.045 * k, 10, 8), skin, null, { interior: true });
    h.position.copy(hand);
    g.add(h);
  }
  if (!standing) {
    // Seat.
    g.add(mesh(rbox(0.42 * k, 0.07, 0.42 * k, 0.02, 0.02, hipY - 0.06 * k, 0), new THREE.MeshStandardMaterial({ color: 0x334155 }), null, { interior: true }));
    g.add(mesh(cyl(0.035, 0.035, Math.max(0.05, hipY - 0.1 * k), "y", 8).translate(0.02, (hipY - 0.1 * k) / 2, 0), new THREE.MeshStandardMaterial({ color: 0x334155 }), null, { interior: true }));
  }
  g.userData.role = m.role;
  g.userData.crewId = m.id;
  return g;
}

function buildInterior(spec, lay, out) {
  const g = new THREE.Group();
  g.name = "interior";
  const crew = crewOf(spec);
  const floor = lay.c + 0.05;
  const fxs = lay.frontX(lay.noseY + 0.2);
  const tParent = spec.turret.style === "none" ? null : out.turret;
  const T = spec.turret;
  const turretRoles = ["commander", "gunner", "loader"];
  // Seats in order of preference per place; extra crew fill the next free seat.
  const hullSeats = [[fxs - 0.78, -lay.Wl * 0.24], [fxs - 0.78, lay.Wl * 0.24], [fxs - 1.6, -lay.Wl * 0.24], [fxs - 1.6, lay.Wl * 0.24], [fxs - 2.3, 0]];
  const turretSeats = { commander: [-T.length * 0.26, T.width * 0.2, -0.18], gunner: [T.length * 0.06, T.width * 0.2, -0.36], loader: [-0.02, -T.width * 0.2, null] };
  const extraTurret = [[-T.length * 0.28, -T.width * 0.2, -0.3], [T.length * 0.02, 0, -0.4]];
  const usedHull = new Set();
  const usedTurret = new Set();
  let extra = 0;
  const hullSeat = (m) => {
    const pref = m.role === "driver" ? 0 : m.role === "radio" ? 1 : 2;
    for (let i = pref; i < hullSeats.length + pref; i++) {
      const idx = i % hullSeats.length;
      if (!usedHull.has(idx)) {
        usedHull.add(idx);
        return hullSeats[idx];
      }
    }
    return hullSeats[0];
  };
  for (const m of crew) {
    const inTurret = m.seat === "turret" || (m.seat === "auto" && turretRoles.includes(m.role));
    const standing = m.role === "loader" && inTurret;
    const f = crewFigure(m, standing);
    if (inTurret && tParent) {
      let seat = !usedTurret.has(m.role) ? turretSeats[m.role] : null;
      if (seat) usedTurret.add(m.role);
      else seat = extraTurret[extra++ % extraTurret.length];
      const k = m.height / 175;
      // Seated: the seat top sits at `seat[2]` below the turret ring; the standing loader is on the hull floor.
      const y = standing && seat[2] === null ? floor - lay.Hh : (seat[2] ?? -0.3) - 0.47 * k;
      f.position.set(seat[0] + m.dx, y, seat[1] + m.dz);
      tParent.add(f);
    } else if (inTurret) {
      // No turret (casemate): the fighting compartment behind the drivers.
      const seat = hullSeat({ role: "extra" });
      f.position.set(seat[0] + m.dx, floor, seat[1] + m.dz);
      g.add(f);
    } else {
      const seat = hullSeat(m);
      f.position.set(seat[0] + m.dx, floor, seat[1] + m.dz);
      g.add(f);
    }
  }
  // Ammunition, stowed where it really goes and always inside the hull:
  // an autoloader carousel under the turret, racks in the sponsons and
  // upright floor bins beside the turret basket. Two-piece ammo stows the
  // projectiles and the propellant charges separately.
  const cal = spec.gun.caliber / 1000;
  const twoPiece = spec.gun.loading === "separate" || spec.gun.loading === "autoloader";
  const caseLen = Math.min(twoPiece ? 0.75 : 1.1, cal * (twoPiece ? 5 : 6.5));
  const projLen = cal * 3.6;
  const roundLen = twoPiece ? projLen : caseLen + projLen;
  const r = cal * 0.75;
  const brass = new THREE.MeshStandardMaterial({ color: 0xd6a640, metalness: 0.85, roughness: 0.3, emissive: 0x3a2a08 });
  const tip = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.6, roughness: 0.4, emissive: 0x1f2937 });
  // One round along +x from its base: a brass case and a projectile (or just the projectile for two-piece ammo).
  const roundG = twoPiece
    ? mergeGeometries([cyl(cal * 0.5, cal * 0.5, projLen * 0.7, "x", 10).translate(projLen * 0.35, 0, 0), cyl(cal * 0.5, cal * 0.12, projLen * 0.3, "x", 10).translate(projLen * 0.85, 0, 0)].map((x) => stripAttrs(x.toNonIndexed())))
    : mergeGeometries([cyl(r, r, caseLen, "x", 10).translate(caseLen / 2, 0, 0), cyl(cal * 0.5, cal * 0.15, projLen, "x", 10).translate(caseLen + projLen / 2, 0, 0)].map((x) => stripAttrs(x.toNonIndexed())));
  const chargeG = cyl(r, r * 0.9, caseLen, "x", 10).translate(caseLen / 2, 0, 0);
  const rounds = [];
  const charges = [];
  const total = Math.min(spec.ammo, 96);
  const turretX = out.turret ? out.turret.position.x : -lay.L / 2 + lay.L * T.at;
  const ringR = Math.min(lay.Wl / 2 - 0.12, T.width * 0.4);
  const engLen = Math.min(lay.L * 0.25, 0.8 + spec.engine.hp / 1500);
  const firewall = -lay.L / 2 + 0.35 + engLen + 0.85;
  const place = (list, x, y, z, ry = 0, rz = 0) => list.push([x, y, z, ry, rz]);
  let left = total;
  // 1. Autoloader carousel: rounds lying in a ring on the floor, pointing outwards.
  if (spec.gun.loading === "autoloader" && left > 0) {
    const n = Math.min(left, 22);
    const rr = Math.max(0.25, ringR - roundLen);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      place(rounds, turretX + Math.cos(a) * rr, floor + r + 0.02, Math.sin(a) * rr, -a);
      place(charges, turretX + Math.cos(a) * rr, floor + r * 3 + 0.04, Math.sin(a) * rr, -a);
    }
    left -= n;
  }
  // 2. Sponson racks along the hull, both sides, up to three layers.
  const spInner = lay.Wl / 2 + 0.04;
  const spOuter = lay.Wt / 2 - 0.1 - Math.tan(deg(spec.hull.sideSlope ?? 0)) * 0.3;
  const spX0 = firewall;
  const spX1 = Math.min(lay.frontX(lay.ys + 0.2), lay.L / 2) - 0.25;
  if (!lay.tall && spOuter - spInner > r * 2.2 && spX1 - spX0 > roundLen + 0.1 && left > 0) {
    const cols = Math.max(1, Math.floor((spOuter - spInner) / (r * 2.3)));
    const layers = Math.max(1, Math.min(3, Math.floor((lay.Hh - 0.12 - lay.ys) / (r * 2.3))));
    const bays = Math.max(1, Math.floor((spX1 - spX0) / (roundLen + 0.12)));
    for (let b = 0; b < bays && left > 0; b++) {
      const x = spX0 + b * (roundLen + 0.12);
      for (const side of [-1, 1]) {
        for (let L = 0; L < layers; L++) {
          for (let c = 0; c < cols && left > 0; c++) {
            place(rounds, x, lay.ys + 0.04 + r + L * r * 2.3, side * (spInner + r + c * r * 2.3));
            left--;
          }
        }
        // Rack frame.
        g.add(mesh(box(roundLen + 0.06, 0.025, spOuter - spInner, x + roundLen / 2, lay.ys + 0.03, side * (spInner + spOuter) / 2), new THREE.MeshStandardMaterial({ color: 0x475569 }), null, { interior: true }));
      }
    }
  }
  // 3. Floor bins: rounds standing upright beside the turret basket.
  if (left > 0) {
    const pitch = r * 2.4;
    const binZ = Math.max(ringR * 0.55, lay.Wl / 2 - 0.25);
    const maxH = lay.Hh - floor - 0.1;
    const upright = roundLen + (twoPiece ? 0 : 0) < maxH;
    const perSide = Math.ceil(left / 2);
    const rows = Math.max(1, Math.floor(0.36 / pitch));
    for (let i = 0; i < perSide * 2 && left > 0; i++) {
      const side = i % 2 ? 1 : -1;
      const j = Math.floor(i / 2);
      const col = Math.floor(j / rows);
      const row = j % rows;
      const x = turretX - ringR * 0.9 + col * pitch;
      if (x > turretX + ringR * 1.1) break;
      const z = side * (binZ - row * pitch);
      if (upright) place(rounds, x, floor + 0.02, z, 0, Math.PI / 2);
      else place(rounds, x, floor + r + 0.02, z);
      left--;
    }
  }
  // Two-piece ammo: charges in bins along the hull floor between the sponsons.
  if (twoPiece && spec.gun.loading === "separate") {
    const n = Math.min(rounds.length, 40);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const j = Math.floor(i / 2);
      place(charges, firewall + 0.1 + (j % 5) * (r * 2.3), floor + 0.02, side * (lay.Wl * 0.18 + Math.floor(j / 5) * r * 2.3), 0, Math.PI / 2);
    }
  }
  const instanced = (geo, mat, list) => {
    if (!list.length) return;
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    inst.userData.interior = true;
    const d = new THREE.Object3D();
    list.forEach(([x, y, z, ry, rz], i) => {
      d.position.set(x, y, z);
      d.rotation.set(0, ry, rz);
      d.updateMatrix();
      inst.setMatrixAt(i, d.matrix);
    });
    g.add(inst);
    return inst;
  };
  const shellsInst = instanced(roundG, twoPiece ? tip : brass, rounds);
  const chargesInst = instanced(chargeG, brass, charges);
  for (const x of [shellsInst, chargesInst]) if (x) x.userData.part = { kind: "ammo" };
  // Engine, radiators, fuel tanks, transmission.
  const hp = spec.engine.hp;
  const engMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.4, metalness: 0.5, emissive: 0x501020 });
  const eng = new THREE.Group();
  const el = Math.min(lay.L * 0.25, 0.8 + hp / 1500);
  const ew = Math.min(lay.Wl * 0.55, 0.6 + hp / 3000);
  eng.add(mesh(rbox(el, 0.55, ew, 0.04), engMat, null, { interior: true }));
  if (spec.engine.kind === "turbine") eng.add(mesh(cyl(0.25, 0.3, el * 0.9, "x", 20).translate(0, 0.35, 0), engMat, null, { interior: true }));
  else for (let i = 0; i < 6; i++) for (const s of [-1, 1]) eng.add(mesh(rbox(el / 7, 0.22, 0.2, 0.02, -el / 2 + el / 12 + (i * el) / 6.2, 0.36, s * ew * 0.3), engMat, null, { interior: true }));
  eng.position.set(-lay.L / 2 + el / 2 + 0.35, lay.c + 0.45, 0);
  g.add(eng);
  const radMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4, emissive: 0x0c3a52 });
  for (const s of [-1, 1]) g.add(mesh(box(el * 0.7, 0.45, 0.22, eng.position.x, lay.c + 0.75, s * (lay.Wl / 2 - 0.2)), radMat, null, { interior: true }));
  const fuelMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5, transparent: true, opacity: 0.75, emissive: 0x4a3a05 });
  for (const s of [-1, 1]) g.add(mesh(rbox(0.7, 0.5, 0.3, 0.05, eng.position.x + el / 2 + 0.45, lay.c + 0.4, s * (lay.Wl / 2 - 0.25)), fuelMat, null, { interior: true }));
  const trMat = new THREE.MeshStandardMaterial({ color: 0xa78bfa, roughness: 0.4, metalness: 0.5, emissive: 0x2a1a50 });
  const tx = spec.gear.drive === "front" ? lay.L / 2 - 0.55 : -lay.L / 2 + 0.25;
  g.add(mesh(rbox(0.6, 0.45, lay.Wl * 0.7, 0.05, tx, lay.c + 0.35, 0), trMat, null, { interior: true }));
  if (spec.gear.drive === "front") g.add(mesh(cyl(0.06, 0.06, lay.L * 0.6, "x", 10).translate(0, lay.c + 0.25, 0), trMat, null, { interior: true }));
  // Gun breech inside the turret.
  const breech = mesh(rbox(Math.min(1.4, cal * 11), cal * 3.5, cal * 3.6, 0.02, -cal * 4, 0, 0), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.3 }), null, { interior: true });
  out.gunPivot.add(breech);
  // Tag modules so shots can damage them (see ballistics.js).
  const kinds = new Map([[engMat, "engine"], [radMat, "radiator"], [fuelMat, "fuel"], [trMat, "transmission"], [brass, "ammo"]]);
  g.traverse((o) => {
    if (o.isMesh && kinds.has(o.material)) o.userData.part = { kind: kinds.get(o.material) };
  });
  breech.userData.part = { kind: "breech" };
  g.visible = false;
  return g;
}

// ---------------------------------------------------------------------------
// Markings
// ---------------------------------------------------------------------------

function applyMarkings(v, lay, out, M) {
  const mk = v.spec.markings;
  const style = insigniaFor(mk.insignia, v.nation, "tank");
  const ray = new THREE.Raycaster();
  const hitOn = (targets, from, dir) => {
    ray.set(from, dir.clone().normalize());
    const h = ray.intersectObjects(targets, false)[0];
    return h ? { point: h.point, normal: h.face.normal.clone().transformDirection(h.object.matrixWorld) } : null;
  };
  out.root.updateMatrixWorld(true);
  const hullMeshes = out.hull.children.filter((c) => c.isMesh && c.userData.armor);
  const turretMeshes = out.turretShell ? [out.turretShell] : [];
  const sideY = (lay.ys + lay.Hh) / 2;
  for (const s of [-1, 1]) {
    // National marking on the hull sides (or the turret for Soviet stars).
    if (style !== "none") {
      const onTurret = (style === "redstar" || style === "aura") && turretMeshes.length;
      const targets = onTurret ? turretMeshes : hullMeshes;
      const x = onTurret ? out.turret.position.x - v.spec.turret.length * 0.28 : -lay.L * 0.05;
      const y = onTurret ? out.turret.position.y + v.spec.turret.height * 0.62 : sideY;
      const hit = hitOn(targets, V3(x, y, s * 6), V3(0, 0, -s));
      const size = onTurret ? v.spec.turret.height * 0.6 : Math.min(0.55, lay.Hh - lay.ys);
      if (hit) projectDecal(hit.object ?? targets[0], insigniaCanvas(style), hit.point, hit.normal, V3(size, size, 0.4), onTurret ? out.turret : out.hull);
    }
    // Number on the turret sides.
    if (mk.number && turretMeshes.length) {
      const { canvas, aspect } = textCanvas(mk.number, { color: mk.numberColor, outline: mk.outline, font: mk.font });
      const hit = hitOn(turretMeshes, V3(out.turret.position.x + v.spec.turret.length * 0.18, out.turret.position.y + v.spec.turret.height * 0.62, s * 6), V3(0, 0, -s));
      const h = v.spec.turret.height * 0.36;
      if (hit) projectDecal(turretMeshes[0], canvas, hit.point, hit.normal, V3(h * aspect, h, 0.6), out.turret, { roll: 0 });
    }
    if (mk.slogan) {
      const { canvas, aspect } = textCanvas(mk.slogan, { color: mk.numberColor, outline: null, font: "block", height: 120 });
      const targets = turretMeshes.length ? turretMeshes : hullMeshes;
      const base = turretMeshes.length ? out.turret.position : V3(0, sideY, 0);
      const hit = hitOn(targets, V3(base.x - (turretMeshes.length ? v.spec.turret.length * 0.2 : 0), base.y + (turretMeshes.length ? v.spec.turret.height * 0.22 : 0), s * 6), V3(0, 0, -s));
      const h = 0.14;
      if (hit) projectDecal(targets[0], canvas, hit.point, hit.normal, V3(h * aspect, h, 0.6), turretMeshes.length ? out.turret : out.hull);
    }
  }
  void M;
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

export function buildTank(v, M) {
  const spec = v.spec;
  const lay = layout(spec);
  const root = new THREE.Group();
  root.name = v.name;
  const out = { root, tracks: [], antennas: [], exhausts: [] };
  const body = new THREE.Group(); // bounces on the suspension
  root.add(body);
  const hull = buildHull(spec, lay, M, out);
  out.hull = hull;
  body.add(hull);
  for (const s of [-1, 1]) root.add(buildRunningGear(spec, lay, M, s, out));
  const skirts = buildSkirts(spec, lay, M);
  if (skirts) body.add(skirts);
  out.skirts = skirts;
  const turret = buildTurret(spec, lay, M, out);
  if (spec.turret.style !== "none") body.add(turret);
  const interior = buildInterior(spec, lay, out);
  body.add(interior);
  out.interior = interior;
  out.body = body;
  applyMarkings(v, lay, out, M);
  out.layout = lay;
  out.size = { length: lay.L + (spec.gun.caliber * spec.gun.length) / 1000, height: lay.Hh + spec.turret.height + 0.4, width: lay.Wt };
  out.center = V3((spec.gun.caliber * spec.gun.length) / 2000, (lay.Hh + spec.turret.height) / 2, 0);

  // --- animation -------------------------------------------------------------
  let trackOffset = 0;
  // Moved parts (see tweaks.js) keep their offsets while animating.
  const tw = (o, kind, i) => {
    const t = o?.userData.tweak;
    const b = o?.userData.unit?.base;
    if (kind === "rot") return (t ? deg(t.rot[i]) : 0) + (b ? b.rot.toArray()[i] : 0);
    return (t ? t.pos[i] : 0) + (b ? b.pos.toArray()[i] : 0);
  };
  out.update = (dt, t, anim, cameraPos) => {
    const sp = anim.speed ?? 1;
    if (anim.drive && sp > 0) {
      trackOffset += dt * sp * 1.4;
      for (const tr of out.tracks) {
        tr.place(-trackOffset);
        // Wheels mirrored onto the left side (turned 180°) spin about a flipped axis.
        for (const w of tr.wheels) w.rotation.z -= ((Math.abs(w.rotation.y) > 1 ? -1 : 1) * dt * sp * 1.4) / (w.userData.r || 0.4);
      }
    }
    if (anim.bob) {
      body.position.y = Math.sin(t * 3.1) * 0.012 + Math.sin(t * 7.3) * 0.004;
      body.rotation.z = Math.sin(t * 1.7) * 0.006;
    } else {
      body.position.y = 0;
      body.rotation.z = 0;
    }
    if (out.turret && spec.turret.style !== "none") {
      if (anim.turret === "scan") out.turret.rotation.y = Math.sin(t * 0.3) * 0.6;
      else if (anim.turret === "spin") out.turret.rotation.y = (t * 0.35) % (Math.PI * 2);
      else if (anim.turret === "aim" && cameraPos) {
        const p = out.turret.getWorldPosition(V3(0, 0, 0));
        const target = Math.atan2(-(cameraPos.z - p.z), cameraPos.x - p.x);
        out.turret.rotation.y += (target - out.turret.rotation.y) * Math.min(1, dt * 2);
      } else out.turret.rotation.y = 0;
      out.turret.rotation.y += tw(out.turret, "rot", 1);
    }
    if (anim.gun === "elevate") out.gunPivot.rotation.z = Math.sin(t * 0.6) * deg(spec.gun.depression ?? 8) * 0.8 + deg(3);
    else out.gunPivot.rotation.z = 0;
    out.gunPivot.rotation.z += tw(out.gunPivot, "rot", 2);
    if (anim.gun === "recoil") {
      const k = (t % 5) / 5;
      const kick = k < 0.02 ? k / 0.02 : Math.max(0, 1 - (k - 0.02) / 0.35);
      out.barrel.position.x = -kick * Math.min(0.5, spec.gun.caliber / 250) + tw(out.barrel, "pos", 0);
      out.fire = k < 0.06;
    } else {
      out.barrel.position.x = tw(out.barrel, "pos", 0);
      out.fire = false;
    }
    for (const a of out.antennas) {
      a.rotation.z = Math.sin(t * 2.3 + a.position.x) * 0.05 + body.rotation.z * 3;
      a.rotation.x = Math.sin(t * 1.9) * 0.03;
    }
  };
  return out;
}
