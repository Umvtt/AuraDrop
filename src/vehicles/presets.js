import { createPart, createVehicle, fitVehicle, PAINTS } from "./engine.js";

// Ready-made vehicles. Real ones are approximate: built from the same parts
// anyone can use, with published armour, guns and engines rounded off.
// Every preset is just a starting point – open it and change anything.

const GROUND = 20; // gap under the tracks / wheels inside the workbench

function paint(id, extra = {}) {
  const p = PAINTS.find((x) => x.id === id) ?? PAINTS[0];
  return { base: p.base, colors: [...p.colors], camo: p.camo, scale: 1, wear: 0.18, seed: 1234, ...extra };
}

/** Add a part and return it. */
function add(v, type, box, params = {}, extra = {}) {
  const p = createPart(type, { x: box.x, y: box.y });
  if (box.w != null) p.w = Math.round(box.w);
  if (box.h != null) p.h = Math.round(box.h);
  p.x = Math.round(box.x);
  p.y = Math.round(box.y);
  p.params = { ...p.params, ...params };
  Object.assign(p, extra);
  v.parts.push(p);
  return p;
}

// ---------------------------------------------------------------------------
// Tanks
// ---------------------------------------------------------------------------

/**
 * Lay out a tank from a spec. Sizes are in cm; the tank faces right.
 * spec: L (hull length), H (hull height), track {…}, hull {…}, turret {…},
 * gun {…}, mantlet {…}, engine, fuel, ammo, crew, extras(v, parts).
 */
function tank(spec) {
  const v = createVehicle("tank", { name: spec.name, nation: spec.nation, preset: spec.id });
  v.size = { w: Math.max(1000, Math.round(spec.L + (spec.gun.caliber * spec.gun.length) / 10 * 0.75 + 120)), h: 440 };
  v.paint = paint(spec.paint ?? "olive", spec.paintExtra);
  const ground = v.size.h - GROUND;
  const x0 = Math.round((v.size.w - spec.L) / 2) - 40;
  const th = spec.track.h ?? 105;
  const clearance = spec.clearance ?? 45;

  // Interior first (drawn under the hull; visible in X-ray).
  const hullTop = ground - spec.H;
  const inside = (fx, fy, w, h) => ({ x: x0 + spec.L * fx, y: hullTop + (spec.H - clearance) * fy, w, h });
  const rearDrive = spec.track.drive === "rear";
  add(v, "engine", inside(0.06, 0.25, spec.L * 0.22, spec.H * 0.38), { kind: spec.engine.kind, hp: spec.engine.hp });
  add(v, "module", inside(rearDrive ? 0.02 : 0.82, 0.55, spec.L * 0.13, spec.H * 0.25), { kind: "transmission" });
  add(v, "fuel", inside(0.3, 0.55, spec.L * 0.12, spec.H * 0.25), { liters: spec.fuel });
  add(v, "ammo", inside(0.45, 0.48, spec.L * 0.18, spec.H * 0.3), { rounds: spec.ammo });
  add(v, "module", inside(0.06, 0.05, spec.L * 0.12, spec.H * 0.16), { kind: "radiator" });

  const hull = add(v, "hull", { x: x0, y: hullTop, w: spec.L, h: spec.H - clearance }, spec.hull);
  // Crew in the hull: driver and radio operator up front.
  const crew = spec.crew ?? ["commander", "gunner", "loader", "driver", "radio"];
  if (crew.includes("driver")) add(v, "crew", inside(0.74, 0.08, 46, 72), { role: "driver" });
  if (crew.includes("radio")) add(v, "crew", inside(0.64, 0.12, 46, 72), { role: "radio" });

  add(v, "tracks", { x: x0 - 10, y: ground - th, w: spec.L + 20, h: th }, spec.track);
  if (spec.skirts) add(v, "skirts", { x: x0 + spec.L * 0.06, y: ground - th - 6, w: spec.L * 0.86, h: th * 0.55 }, spec.skirts);

  // Turret and what rides on it.
  const T = spec.turret;
  const tx = x0 + spec.L * (T.at ?? 0.5) - T.w / 2;
  const ty = hullTop - T.h + 4;
  const turret = add(v, "turret", { x: tx, y: ty, w: T.w, h: T.h }, T.params);
  const tc = (fx, fy, w, h) => ({ x: tx + T.w * fx, y: ty + T.h * fy, w, h });
  for (const [i, role] of ["commander", "gunner", "loader"].filter((r) => crew.includes(r)).entries()) {
    add(v, "crew", tc(0.12 + i * 0.26, 0.15, 44, 70), { role }, { parent: turret.id });
  }
  add(v, "module", tc(0.62, 0.35, T.w * 0.28, T.h * 0.35), { kind: "breech" }, { parent: turret.id });
  const G = spec.gun;
  const gun = createPart("gun");
  gun.params = { ...gun.params, ...G };
  const r = Math.max(2.5, G.caliber / 10);
  const brake = G.brake === "none" ? 0 : r * (G.brake === "double" ? 5 : 3.2);
  gun.w = Math.round((G.caliber * G.length) / 10 + brake);
  gun.h = Math.round(r * 2 * (G.brake === "none" ? 1.15 : 1.75));
  const M = spec.mantlet;
  gun.x = Math.round(tx + T.w - 4);
  gun.y = Math.round(ty + T.h * (T.gunY ?? 0.45) - gun.h / 2);
  gun.parent = turret.id;
  gun.anim.pivot = [0, 0.5];
  v.parts.push(gun);
  if (M) add(v, "mantlet", { x: tx + T.w - M.w * 0.45, y: ty + T.h * (T.gunY ?? 0.45) - M.h / 2, w: M.w, h: M.h }, M.params, { parent: turret.id });
  turret.anim = { ...turret.anim, pivot: [0.5, 0.6] };

  spec.extras?.(v, { x0, ground, hullTop, hull, turret, tx, ty, T, gun, L: spec.L, H: spec.H, th });
  // Something to watch: the tracks roll and the gun fires in previews.
  for (const p of v.parts) {
    if (p.type === "tracks") p.anim = { ...p.anim, type: "roll", speed: 1 };
  }
  gun.anim = { ...gun.anim, type: "recoil", range: Math.round(r * 3.5), speed: 0.8 };
  v.approx = true;
  return fitVehicle(v, 50);
}

// Small helpers for common details.
const cupola = (v, k, fx = 0.22, style = "blocks") => add(v, "cupola", { x: k.tx + k.T.w * fx, y: k.ty - 26, w: 64, h: 32 }, { style }, { parent: k.turret.id });
const marking = (v, box, style = "auto") => add(v, "insignia", box, { style });
const number = (v, box, text, colorHex = "#f1f2f0", outline = null, font = "stencil") => add(v, "number", box, { text, color: colorHex, hasOutline: !!outline, outline: outline ?? "#111111", font });
/** Exhaust on the rear plate (follows the hull's rear slope). */
function exhaust(v, k, style = "muffler") {
  const hp = k.hull.params;
  const hh = k.hull.h;
  const rearY = hh * 0.5;
  const rx = Math.min(k.hull.w * 0.3, Math.tan((hp.rearSlope * Math.PI) / 180) * rearY);
  const y = hh * 0.2;
  const edge = rx * (1 - y / rearY);
  return add(v, "exhaust", { x: k.x0 + edge - 30, y: k.hullTop + y - 12, w: 44, h: 24 }, { style }, { anim: { type: "smoke", speed: 1, range: null, delay: 0, reverse: false, pivot: [0.5, 0.5] } });
}
const antenna = (v, k, fx = 0.08, h = 170) => add(v, "antenna", { x: k.tx + k.T.w * fx, y: k.ty - h + 6, w: 10, h }, {}, { parent: k.turret.id, anim: { type: "swing", speed: 0.7, range: 4, delay: 0, reverse: false, pivot: [0.5, 1] } });
const light = (v, k, fx = 0.93) => add(v, "light", { x: k.x0 + k.L * fx, y: k.hullTop - 14, w: 26, h: 18 }, { style: "round" });
const tool = (v, k, style, fx, fy, w, h) => add(v, "stowage", { x: k.x0 + k.L * fx, y: k.hullTop + fy, w, h }, { style });
const hullMg = (v, k, fx = 0.86, fy = 18) => add(v, "mg", { x: k.x0 + k.L * fx, y: k.hullTop + fy, w: 70, h: 14 }, { mount: "ball" });

export const TANKS = [
  tank({
    id: "tiger1",
    name: "Tiger I",
    nation: "germany",
    paint: "dunkelgelb",
    L: 630,
    H: 190,
    hull: { style: "welded", front: 100, frontSlope: 9, nose: 0.42, lower: 100, lowerSlope: 25, side: 80, rear: 80, rearSlope: 9, roof: 25, width: 3.55 },
    track: { wheels: "interleaved", count: 8, rollers: 0, drive: "front", links: "wide", width: 72, h: 110 },
    turret: { w: 300, h: 92, at: 0.5, gunY: 0.48, params: { style: "boxy", front: 100, frontSlope: 8, side: 80, rear: 80, roof: 25, width: 2.4, bustle: false } },
    mantlet: { w: 56, h: 82, params: { style: "box", armor: 120 } },
    gun: { caliber: 88, length: 56, shell: "APCBC", loading: "unitary", brake: "double" },
    engine: { kind: "petrol", hp: 700 },
    fuel: 540,
    ammo: 92,
    extras(v, k) {
      cupola(v, k, 0.15);
      antenna(v, k, 0.05);
      add(v, "smoke", { x: k.tx + k.T.w * 0.8, y: k.ty + 10, w: 26, h: 34 }, { count: 3 }, { parent: k.turret.id });
      light(v, k, 0.9);
      hullMg(v, k, 0.88, 16);
      tool(v, k, "cable", 0.12, 22, 260, 14);
      tool(v, k, "shovel", 0.55, 40, 120, 18);
      exhaust(v, k);
      number(v, { x: k.tx + 70, y: k.ty + 30, w: 120, h: 44 }, "131", "#b3122a", "#f1f2f0");
      marking(v, { x: k.x0 + k.L * 0.62, y: k.hullTop + 40, w: 42, h: 42 }, "cross");
    },
  }),
  tank({
    id: "panther",
    name: "Panther Ausf. A",
    nation: "germany",
    paint: "dunkelgelb",
    L: 687,
    H: 185,
    hull: { style: "welded", front: 80, frontSlope: 55, nose: 0.55, lower: 60, lowerSlope: 55, side: 50, rear: 40, rearSlope: 30, roof: 16, width: 3.27 },
    track: { wheels: "interleaved", count: 8, rollers: 0, drive: "front", links: "steel", width: 66, h: 106 },
    turret: { w: 290, h: 92, at: 0.48, gunY: 0.5, params: { style: "sloped", front: 110, frontSlope: 11, side: 45, rear: 45, roof: 16, width: 2.3 } },
    mantlet: { w: 50, h: 86, params: { style: "round", armor: 100 } },
    gun: { caliber: 75, length: 70, shell: "APCBC", loading: "unitary", brake: "double" },
    engine: { kind: "petrol", hp: 700 },
    fuel: 720,
    ammo: 79,
    extras(v, k) {
      cupola(v, k, 0.18);
      antenna(v, k, 0.05);
      hullMg(v, k, 0.78, 30);
      exhaust(v, k, "pipe");
      tool(v, k, "cable", 0.1, 30, 300, 14);
      number(v, { x: k.tx + 60, y: k.ty + 30, w: 120, h: 44 }, "424", "#f1f2f0", "#111111");
      marking(v, { x: k.x0 + k.L * 0.45, y: k.hullTop + 50, w: 40, h: 40 }, "cross");
    },
  }),
  tank({
    id: "pz4h",
    name: "Panzer IV Ausf. H",
    nation: "germany",
    paint: "dunkelgelb",
    paintExtra: { camo: "twotone" },
    L: 589,
    H: 175,
    hull: { style: "welded", front: 80, frontSlope: 14, nose: 0.4, lower: 80, lowerSlope: 20, side: 30, rear: 20, rearSlope: 10, roof: 12, width: 2.88 },
    track: { wheels: "bogie", count: 8, rollers: 4, drive: "front", links: "steel", width: 40, h: 98 },
    skirts: { style: "panels", armor: 5, panels: 6 },
    turret: { w: 250, h: 78, at: 0.5, gunY: 0.5, params: { style: "boxy", front: 50, frontSlope: 10, side: 30, rear: 30, roof: 10, width: 2.0, bustle: true } },
    mantlet: { w: 40, h: 56, params: { style: "box", armor: 50 } },
    gun: { caliber: 75, length: 48, shell: "APCBC", loading: "unitary", brake: "double" },
    engine: { kind: "petrol", hp: 300 },
    fuel: 470,
    ammo: 87,
    extras(v, k) {
      cupola(v, k, 0.15);
      antenna(v, k, 0.03);
      hullMg(v, k, 0.86, 14);
      exhaust(v, k);
      number(v, { x: k.tx + 70, y: k.ty + 22, w: 100, h: 38 }, "612", "#f1f2f0", "#111111");
      marking(v, { x: k.x0 + k.L * 0.3, y: k.ground - k.th - 2, w: 34, h: 34 }, "cross");
    },
  }),
  tank({
    id: "t34-85",
    name: "T-34-85",
    nation: "ussr",
    paint: "4bo",
    L: 610,
    H: 178,
    hull: { style: "welded", front: 45, frontSlope: 60, nose: 0.5, lower: 45, lowerSlope: 53, side: 45, rear: 45, rearSlope: 47, roof: 20, width: 3.0 },
    track: { wheels: "christie", count: 5, rollers: 0, drive: "rear", links: "steel", width: 50, h: 110 },
    turret: { w: 290, h: 92, at: 0.5, gunY: 0.52, params: { style: "cast", front: 90, frontSlope: 0, side: 75, rear: 52, roof: 20, width: 2.2 } },
    mantlet: { w: 52, h: 66, params: { style: "cast", armor: 90 } },
    gun: { caliber: 85, length: 55, shell: "APHE", loading: "unitary", brake: "none" },
    engine: { kind: "diesel", hp: 500 },
    fuel: 545,
    ammo: 55,
    extras(v, k) {
      cupola(v, k, 0.25, "hatch");
      antenna(v, k, 0.1);
      hullMg(v, k, 0.78, 32);
      add(v, "stowage", { x: k.x0 + 30, y: k.hullTop + 36, w: 70, h: 26 }, { style: "box" });
      add(v, "fuel", { x: k.x0 + 20, y: k.hullTop + 20, w: 100, h: 36 }, { liters: 270, kind: "diesel" });
      exhaust(v, k, "pipe");
      number(v, { x: k.tx + 80, y: k.ty + 34, w: 110, h: 40 }, "24", "#f1f2f0");
      marking(v, { x: k.tx + 30, y: k.ty + 28, w: 36, h: 36 }, "redstar");
    },
  }),
  tank({
    id: "kv1",
    name: "KV-1",
    nation: "ussr",
    paint: "4bo",
    L: 675,
    H: 190,
    hull: { style: "welded", front: 75, frontSlope: 30, nose: 0.42, lower: 75, lowerSlope: 25, side: 75, rear: 60, rearSlope: 20, roof: 30, width: 3.3 },
    track: { wheels: "solid", count: 6, rollers: 3, drive: "rear", links: "steel", width: 70, h: 100 },
    turret: { w: 270, h: 98, at: 0.5, gunY: 0.5, params: { style: "boxy", front: 75, frontSlope: 10, side: 75, rear: 75, roof: 30, width: 2.4 } },
    mantlet: { w: 44, h: 60, params: { style: "box", armor: 90 } },
    gun: { caliber: 76, length: 42, shell: "APHE", loading: "unitary", brake: "none" },
    engine: { kind: "diesel", hp: 600 },
    fuel: 600,
    ammo: 114,
    extras(v, k) {
      cupola(v, k, 0.3, "hatch");
      antenna(v, k, 0.06);
      hullMg(v, k, 0.84, 22);
      exhaust(v, k, "pipe");
      number(v, { x: k.tx + 70, y: k.ty + 36, w: 120, h: 40 }, "ЗА РОДИНУ", "#f1f2f0", null, "block");
    },
  }),
  tank({
    id: "is2",
    name: "IS-2",
    nation: "ussr",
    paint: "4bo",
    L: 690,
    H: 182,
    hull: { style: "cast", front: 120, frontSlope: 60, nose: 0.5, lower: 100, lowerSlope: 30, side: 90, rear: 60, rearSlope: 40, roof: 30, width: 3.07 },
    track: { wheels: "solid", count: 6, rollers: 3, drive: "rear", links: "steel", width: 65, h: 100 },
    turret: { w: 300, h: 98, at: 0.5, gunY: 0.52, params: { style: "cast", front: 100, frontSlope: 0, side: 90, rear: 60, roof: 30, width: 2.5 } },
    mantlet: { w: 56, h: 70, params: { style: "cast", armor: 100 } },
    gun: { caliber: 122, length: 43, shell: "APHE", loading: "separate", brake: "double" },
    engine: { kind: "diesel", hp: 520 },
    fuel: 520,
    ammo: 28,
    crew: ["commander", "gunner", "loader", "driver"],
    extras(v, k) {
      cupola(v, k, 0.15, "mg");
      antenna(v, k, 0.05);
      exhaust(v, k, "pipe");
      add(v, "fuel", { x: k.x0 + 10, y: k.hullTop + 28, w: 110, h: 40 }, { liters: 270, kind: "diesel" });
      number(v, { x: k.tx + 80, y: k.ty + 36, w: 110, h: 40 }, "301", "#f1f2f0");
    },
  }),
  tank({
    id: "sherman",
    name: "M4A3 (75) W Sherman",
    nation: "usa",
    paint: "olive",
    L: 590,
    H: 200,
    hull: { style: "welded", front: 63, frontSlope: 47, nose: 0.62, lower: 51, lowerSlope: 35, side: 38, rear: 38, rearSlope: 10, roof: 19, width: 2.62 },
    track: { wheels: "bogie", count: 6, rollers: 0, drive: "front", links: "pads", width: 42, h: 104 },
    turret: { w: 240, h: 90, at: 0.48, gunY: 0.5, params: { style: "round", front: 76, frontSlope: 30, side: 51, rear: 51, roof: 25, width: 2.1 } },
    mantlet: { w: 46, h: 62, params: { style: "cast", armor: 89 } },
    gun: { caliber: 75, length: 40, shell: "APCBC", loading: "unitary", brake: "none" },
    engine: { kind: "petrol", hp: 500 },
    fuel: 636,
    ammo: 104,
    extras(v, k) {
      cupola(v, k, 0.2, "mg");
      antenna(v, k, 0.04);
      hullMg(v, k, 0.82, 26);
      light(v, k, 0.86);
      tool(v, k, "logs", 0.15, -8, 180, 16);
      tool(v, k, "jerrycans", 0.02, 30, 60, 40);
      exhaust(v, k, "pipe");
      marking(v, { x: k.x0 + k.L * 0.42, y: k.hullTop + 40, w: 62, h: 62 }, "star");
      number(v, { x: k.tx + 30, y: k.ty + 40, w: 80, h: 30 }, "A-12", "#f1f2f0");
    },
  }),
  tank({
    id: "pershing",
    name: "M26 Pershing",
    nation: "usa",
    paint: "olive",
    L: 633,
    H: 180,
    hull: { style: "welded", front: 102, frontSlope: 46, nose: 0.52, lower: 76, lowerSlope: 53, side: 76, rear: 51, rearSlope: 10, roof: 22, width: 3.51 },
    track: { wheels: "solid", count: 6, rollers: 5, drive: "rear", links: "steel", width: 61, h: 100 },
    turret: { w: 290, h: 90, at: 0.5, gunY: 0.5, params: { style: "round", front: 102, frontSlope: 0, side: 76, rear: 76, roof: 25, width: 2.4, bustle: true } },
    mantlet: { w: 50, h: 66, params: { style: "cast", armor: 114 } },
    gun: { caliber: 90, length: 50, shell: "APCBC", loading: "unitary", brake: "single" },
    engine: { kind: "petrol", hp: 500 },
    fuel: 696,
    ammo: 70,
    extras(v, k) {
      cupola(v, k, 0.22, "mg");
      antenna(v, k, 0.04);
      hullMg(v, k, 0.84, 26);
      light(v, k, 0.88);
      exhaust(v, k, "pipe");
      marking(v, { x: k.x0 + k.L * 0.4, y: k.hullTop + 38, w: 60, h: 60 }, "star");
    },
  }),
  tank({
    id: "churchill7",
    name: "Churchill Mk VII",
    nation: "uk",
    paint: "olive",
    paintExtra: { base: "#5c5a3f" },
    L: 744,
    H: 230,
    clearance: 40,
    hull: { style: "riveted", front: 152, frontSlope: 0, nose: 0.6, lower: 140, lowerSlope: 20, side: 95, rear: 50, rearSlope: 0, roof: 20, width: 3.25 },
    track: { wheels: "solid", count: 11, rollers: 0, drive: "rear", links: "steel", width: 55, h: 150 },
    turret: { w: 230, h: 96, at: 0.42, gunY: 0.5, params: { style: "boxy", front: 152, frontSlope: 0, side: 95, rear: 95, roof: 20, width: 2.0 } },
    mantlet: { w: 40, h: 60, params: { style: "cast", armor: 152 } },
    gun: { caliber: 75, length: 36, shell: "APCBC", loading: "unitary", brake: "none" },
    engine: { kind: "petrol", hp: 350 },
    fuel: 682,
    ammo: 84,
    extras(v, k) {
      cupola(v, k, 0.25, "hatch");
      antenna(v, k, 0.05);
      hullMg(v, k, 0.9, 40);
      exhaust(v, k);
      marking(v, { x: k.x0 + k.L * 0.55, y: k.hullTop + 30, w: 44, h: 44 }, "roundel");
      number(v, { x: k.x0 + k.L * 0.2, y: k.hullTop + 30, w: 120, h: 34 }, "T.31", "#f1f2f0");
    },
  }),
  tank({
    id: "leopard2a4",
    name: "Leopard 2A4",
    nation: "germany",
    paint: "nato",
    L: 772,
    H: 170,
    hull: { style: "welded", front: 350, frontSlope: 50, nose: 0.4, lower: 450, lowerSlope: 40, side: 60, rear: 30, rearSlope: 10, roof: 30, width: 3.7 },
    track: { wheels: "modern", count: 7, rollers: 4, drive: "rear", links: "pads", width: 63, h: 100 },
    skirts: { style: "rubber", armor: 40, panels: 7 },
    turret: { w: 360, h: 82, at: 0.48, gunY: 0.45, params: { style: "flat", front: 750, frontSlope: 0, side: 120, rear: 60, roof: 40, width: 3.5, bustle: false, ports: false } },
    mantlet: { w: 36, h: 52, params: { style: "slab", armor: 400 } },
    gun: { caliber: 120, length: 44, shell: "APFSDS", loading: "unitary", brake: "none", evacuator: true, sleeve: true },
    engine: { kind: "diesel", hp: 1500 },
    fuel: 1160,
    ammo: 42,
    crew: ["commander", "gunner", "loader", "driver"],
    extras(v, k) {
      cupola(v, k, 0.2, "blocks");
      antenna(v, k, 0.05, 200);
      add(v, "smoke", { x: k.tx + 10, y: k.ty + 6, w: 30, h: 40 }, { count: 4 }, { parent: k.turret.id });
      add(v, "light", { x: k.x0 + k.L * 0.93, y: k.hullTop - 12, w: 24, h: 16 }, { style: "led" });
      exhaust(v, k, "pipe");
      marking(v, { x: k.tx + k.T.w * 0.55, y: k.ty + 26, w: 34, h: 34 }, "cross");
      number(v, { x: k.tx + k.T.w * 0.25, y: k.ty + 26, w: 90, h: 34 }, "211", "#111111");
    },
  }),
  tank({
    id: "abrams",
    name: "M1A1 Abrams",
    nation: "usa",
    paint: "desert",
    L: 792,
    H: 170,
    hull: { style: "welded", front: 100, frontSlope: 82, nose: 0.22, lower: 560, lowerSlope: 30, side: 60, rear: 30, rearSlope: 15, roof: 30, width: 3.66 },
    track: { wheels: "modern", count: 7, rollers: 2, drive: "rear", links: "pads", width: 63, h: 100 },
    skirts: { style: "panels", armor: 60, panels: 6 },
    turret: { w: 400, h: 80, at: 0.5, gunY: 0.42, params: { style: "flat", front: 800, frontSlope: 0, side: 150, rear: 60, roof: 40, width: 3.6, bustle: false, ports: false } },
    mantlet: { w: 34, h: 50, params: { style: "slab", armor: 400 } },
    gun: { caliber: 120, length: 44, shell: "APFSDS", loading: "unitary", brake: "none", evacuator: true, sleeve: true },
    engine: { kind: "turbine", hp: 1500 },
    fuel: 1900,
    ammo: 40,
    crew: ["commander", "gunner", "loader", "driver"],
    extras(v, k) {
      cupola(v, k, 0.24, "mg");
      antenna(v, k, 0.03, 200);
      add(v, "smoke", { x: k.tx + k.T.w * 0.78, y: k.ty + 6, w: 30, h: 40 }, { count: 6 }, { parent: k.turret.id });
      add(v, "exhaust", { x: k.x0 - 26, y: k.hullTop + 20, w: 40, h: 30 }, { style: "muffler" }, { anim: { type: "flicker", speed: 1, range: null, delay: 0, reverse: false, pivot: [0.5, 0.5] } });
      marking(v, { x: k.tx + k.T.w * 0.5, y: k.ty + 22, w: 34, h: 34 }, "star");
      number(v, { x: k.x0 + k.L * 0.15, y: k.hullTop + 20, w: 120, h: 30 }, "BAD ROMANCE", "#111111", null, "block");
    },
  }),
  tank({
    id: "t72a",
    name: "T-72A",
    nation: "ussr",
    paint: "4bo",
    L: 692,
    H: 160,
    hull: { style: "welded", front: 205, frontSlope: 68, nose: 0.55, lower: 80, lowerSlope: 60, side: 80, rear: 40, rearSlope: 20, roof: 20, width: 3.59 },
    track: { wheels: "solid", count: 6, rollers: 3, drive: "rear", links: "steel", width: 58, h: 102 },
    skirts: { style: "rubber", armor: 10, panels: 6 },
    turret: { w: 300, h: 84, at: 0.5, gunY: 0.55, params: { style: "cast", front: 410, frontSlope: 0, side: 120, rear: 60, roof: 40, width: 2.6, ports: false } },
    mantlet: { w: 34, h: 44, params: { style: "cast", armor: 300 } },
    gun: { caliber: 125, length: 48, shell: "APFSDS", loading: "autoloader", brake: "none", evacuator: true, sleeve: true },
    engine: { kind: "diesel", hp: 780 },
    fuel: 1200,
    ammo: 44,
    crew: ["commander", "gunner", "driver"],
    extras(v, k) {
      cupola(v, k, 0.22, "mg");
      antenna(v, k, 0.05, 190);
      add(v, "smoke", { x: k.tx + k.T.w * 0.7, y: k.ty + 4, w: 26, h: 40 }, { count: 4 }, { parent: k.turret.id });
      tool(v, k, "logs", 0.02, -6, 220, 18);
      add(v, "fuel", { x: k.x0 + 20, y: k.hullTop + 20, w: 110, h: 40 }, { liters: 400, kind: "diesel" });
      exhaust(v, k, "pipe");
      number(v, { x: k.tx + k.T.w * 0.3, y: k.ty + 34, w: 110, h: 40 }, "512", "#f1f2f0");
    },
  }),
];

// ---------------------------------------------------------------------------
// Planes
// ---------------------------------------------------------------------------

function plane(spec) {
  const v = createVehicle("plane", { name: spec.name, nation: spec.nation, preset: spec.id });
  v.size = { w: Math.max(1200, spec.L + 260), h: 520 };
  v.paint = paint(spec.paint ?? "olive", spec.paintExtra);
  const L = spec.L;
  const H = spec.H;
  const fx = Math.round((v.size.w - L) / 2) - 20;
  const fy = Math.round(v.size.h / 2 - H / 2);
  const at = (rx, ry, w, h) => ({ x: fx + L * rx, y: fy + H * ry, w, h });
  const jet = spec.engine.kind === "jet";

  // Internals.
  add(v, "engine", at(jet ? 0.25 : 0.82, 0.2, jet ? L * 0.35 : L * 0.14, H * 0.6), spec.engine);
  add(v, "fuel", at(0.6, 0.25, L * 0.12, H * 0.45), { liters: spec.fuel, kind: jet ? "kerosene" : "petrol" });
  add(v, "ammo", at(0.52, 0.6, L * 0.08, H * 0.3), { rounds: spec.ammo ?? 500, kind: "belts" });

  // Far-side tailplane and the tail sit behind the fuselage.
  const finStyle = spec.fin ?? "round";
  const finH = spec.finH ?? H * 1.1;
  add(v, "fin", { x: fx - 6, y: fy - finH + H * 0.42, w: spec.finW ?? L * 0.15, h: finH }, { style: finStyle });
  const fus = add(v, "fuselage", { x: fx, y: fy, w: L, h: H }, { style: spec.style ?? "inline", tail: spec.tail ?? 0.3, hump: spec.hump ?? 0.18, scoop: !!spec.scoop });
  add(v, "stabilizer", { x: fx - 4, y: fy + H * (spec.stabY ?? 0.3), w: L * 0.17, h: 22 });

  // Cockpit.
  const cw = spec.canopyW ?? L * 0.17;
  const cx = fx + L * (spec.canopyAt ?? 0.5);
  add(v, "pilot", { x: cx + cw * 0.25, y: fy - H * 0.22, w: 38, h: 44 }, { gear: jet ? "jet" : "leather" });
  if (spec.gunner) add(v, "pilot", { x: cx - cw * 0.35, y: fy - H * 0.2, w: 36, h: 42 }, { gear: "leather" });
  add(v, "canopy", { x: cx, y: fy - H * 0.32, w: cw, h: H * 0.42 }, { style: spec.canopy ?? "bubble", frames: spec.frames ?? 1 });

  // Nose.
  if (!jet) {
    if (spec.style === "radial" || spec.cowl === "radial") add(v, "cowling", { x: fx + L - 40, y: fy - H * 0.03, w: 90, h: H * 1.06 }, { style: "radial", ringOn: !!spec.ring, ring: spec.ring ?? "#000000" });
    add(v, "exhaust", { x: fx + L * 0.82, y: fy + H * 0.3, w: 60, h: 18 }, { style: "stack" }, { anim: { type: "flicker", speed: 1, range: null, delay: 0, reverse: false, pivot: [0.5, 0.5] } });
    const d = spec.prop.diameter * 100;
    const prop = add(v, "propeller", { x: fx + L + (spec.style === "radial" || spec.cowl === "radial" ? 40 : -8), y: fy + H * 0.45 - d / 2, w: 64, h: d }, spec.prop);
    prop.anim = { ...prop.anim, type: "spin", speed: 1, pivot: [0.6, 0.5] };
  } else {
    const n = add(v, "nozzle", { x: fx - 30, y: fy + H * 0.32, w: 60, h: H * 0.42 }, { afterburner: false });
    n.anim = { ...n.anim, type: "none" };
  }

  // Wing, guns and gear.
  const chord = spec.chord * 100;
  const wing = add(v, "wing", { x: fx + L * (spec.wingAt ?? 0.48), y: fy + H * (spec.wingY ?? 0.62), w: chord, h: spec.wingH ?? 34 }, { span: spec.span, plan: spec.plan ?? "straight", profile: spec.profile ?? "classic" });
  for (const g of spec.guns) {
    if (g.place === "wing") add(v, "pgun", { x: wing.x + chord * 0.7, y: wing.y + 8, w: Math.max(60, g.caliber * 5), h: 14 }, g);
    else add(v, "pgun", { x: fx + L * 0.7, y: fy + H * 0.12, w: L * 0.3, h: 12 }, g);
  }
  add(v, "gear", { x: wing.x + chord * 0.35, y: wing.y + 10, w: 70, h: H * 1.1 }, { kind: spec.fixedGear ? "fixed" : "main", up: !spec.fixedGear });
  if (!jet) add(v, "gear", { x: fx + 20, y: fy + H * 0.6, w: 34, h: 50 }, { kind: "tail", up: true });
  for (const b of spec.bombs ?? []) add(v, "bomb", { x: wing.x + (b.dx ?? 0), y: wing.y + 30 + (b.dy ?? 0), w: Math.max(70, Math.cbrt(b.kg) * 26), h: Math.max(16, Math.cbrt(b.kg) * 5.5) }, { kg: b.kg });
  if (spec.rockets) add(v, "rocket", { x: wing.x + 10, y: wing.y + 28, w: 150, h: 18 }, { count: spec.rockets });
  if (spec.droptank) add(v, "droptank", { x: fx + L * 0.4, y: fy + H + 6, w: 190, h: 38 }, { liters: spec.droptank });

  // Markings.
  add(v, "insignia", { x: fx + L * (spec.markAt ?? 0.24), y: fy + H * 0.25, w: H * 0.55, h: H * 0.55 }, { style: spec.marking ?? "auto" });
  if (spec.code) add(v, "number", { x: fx + L * 0.3, y: fy + H * 0.28, w: L * 0.14, h: H * 0.42 }, { text: spec.code, color: spec.codeColor ?? "#f1f2f0", font: "stencil" });
  spec.extras?.(v, { fx, fy, L, H, wing, fus, at });
  v.approx = true;
  return fitVehicle(v, 50);
}

export const PLANES = [
  plane({
    id: "spitfire5",
    name: "Spitfire Mk Vb",
    nation: "uk",
    paint: "olive",
    paintExtra: { base: "#6a6d55", colors: ["#4b5a3c", "#8d917e", "#3a4430"], camo: "twotone", wear: 0.08 },
    L: 912,
    H: 112,
    span: 11.2,
    chord: 2.1,
    plan: "elliptical",
    canopy: "framed",
    frames: 2,
    fin: "round",
    engine: { kind: "inline", hp: 1470, charger: "single" },
    prop: { blades: 3, diameter: 3.3, spinner: "#3b3e2f", tips: "#f2c230" },
    guns: [{ caliber: 20, count: 2, place: "wing" }, { caliber: 7.7, count: 4, place: "wing" }],
    fuel: 386,
    code: "ZD·C",
  }),
  plane({
    id: "bf109f4",
    name: "Bf 109 F-4",
    nation: "germany",
    paint: "rlm",
    L: 894,
    H: 108,
    span: 9.9,
    chord: 1.7,
    plan: "straight",
    canopy: "framed",
    frames: 3,
    fin: "angular",
    engine: { kind: "inline", hp: 1350, charger: "single" },
    prop: { blades: 3, diameter: 3.0, spinner: "#2a2d31", tips: "#2a2d31", spinStyle: "spiral" },
    guns: [{ caliber: 20, count: 1, place: "nose" }, { caliber: 7.92, count: 2, place: "nose" }],
    fuel: 400,
    marking: "cross",
    code: "7",
    codeColor: "#f2c230",
  }),
  plane({
    id: "p51d",
    name: "P-51D Mustang",
    nation: "usa",
    paint: "silver",
    L: 983,
    H: 118,
    span: 11.3,
    chord: 2.2,
    plan: "straight",
    profile: "laminar",
    canopy: "bubble",
    frames: 0,
    fin: "tall",
    scoop: true,
    engine: { kind: "inline", hp: 1490, charger: "two" },
    prop: { blades: 4, diameter: 3.4, spinner: "#c8102e", tips: "#f2c230" },
    guns: [{ caliber: 12.7, count: 6, place: "wing" }],
    fuel: 1000,
    code: "WZ·I",
    codeColor: "#111111",
    extras(v, k) {
      add(v, "stripes", { x: k.fx + k.L * 0.9, y: k.fy + 4, w: 60, h: k.H * 0.75 }, { style: "checker", a: "#f2c230", b: "#111111", count: 4 });
    },
  }),
  plane({
    id: "a6m2",
    name: "A6M2 Zero",
    nation: "japan",
    paint: "silver",
    paintExtra: { base: "#a8a98f", colors: ["#8f907a", "#c4c4ad", "#76775f"], wear: 0.12 },
    L: 906,
    H: 120,
    style: "radial",
    span: 12,
    chord: 1.9,
    plan: "elliptical",
    canopy: "greenhouse",
    frames: 4,
    fin: "round",
    engine: { kind: "radial", hp: 950, charger: "single" },
    prop: { blades: 3, diameter: 2.9, spinner: "#9a9a8a", tips: "#3a2a1a", spinStyle: "round" },
    ring: "#141518",
    guns: [{ caliber: 20, count: 2, place: "wing" }, { caliber: 7.7, count: 2, place: "nose" }],
    fuel: 518,
    droptank: 330,
    marking: "hinomaru",
    markAt: 0.2,
    code: "AI-102",
    codeColor: "#111111",
  }),
  plane({
    id: "il2",
    name: "Il-2 (1943)",
    nation: "ussr",
    paint: "4bo",
    paintExtra: { camo: "twotone", colors: ["#2c321d", "#6b7044", "#1b1f12"] },
    L: 1160,
    H: 140,
    style: "attacker",
    span: 14.6,
    chord: 2.6,
    plan: "straight",
    profile: "thick",
    canopy: "framed",
    frames: 3,
    canopyW: 230,
    gunner: true,
    fin: "round",
    engine: { kind: "inline", hp: 1720, charger: "none" },
    prop: { blades: 3, diameter: 3.6, spinner: "#2a2d31", tips: "#2a2d31" },
    guns: [{ caliber: 23, count: 2, place: "wing" }, { caliber: 7.62, count: 2, place: "wing" }],
    bombs: [{ kg: 100, dx: 30 }, { kg: 100, dx: 110 }],
    rockets: 4,
    fuel: 724,
    marking: "redstar",
    extras(v, k) {
      // The famous armoured tub around the engine and cockpit.
      add(v, "plate", { x: k.fx + k.L * 0.55, y: k.fy + 6, w: k.L * 0.4, h: k.H * 0.8 }, { armor: 7, slope: 0, both: true, width: 1.2 }, { color: "#3b4526" });
      number(v, { x: k.fx + k.L * 0.1, y: k.fy + k.H * 0.3, w: 120, h: 50 }, "7", "#f1f2f0");
    },
  }),
  plane({
    id: "fw190a5",
    name: "Fw 190 A-5",
    nation: "germany",
    paint: "rlm",
    L: 900,
    H: 122,
    style: "radial",
    span: 10.5,
    chord: 1.75,
    plan: "straight",
    canopy: "bubble",
    frames: 1,
    fin: "angular",
    engine: { kind: "radial", hp: 1700, charger: "single" },
    prop: { blades: 3, diameter: 3.3, spinner: "#2a2d31", tips: "#2a2d31", spinStyle: "spiral" },
    ring: "#f2c230",
    guns: [{ caliber: 20, count: 4, place: "wing" }, { caliber: 7.92, count: 2, place: "nose" }],
    fuel: 525,
    marking: "cross",
    code: "12",
    codeColor: "#f2c230",
  }),
  plane({
    id: "ju87b",
    name: "Ju 87 B Stuka",
    nation: "germany",
    paint: "rlm",
    paintExtra: { base: "#5f6a5c", colors: ["#3d4436", "#70776a", "#2b3027"] },
    L: 1110,
    H: 140,
    span: 13.8,
    chord: 2.4,
    plan: "gull",
    profile: "thick",
    canopy: "greenhouse",
    frames: 5,
    canopyW: 260,
    gunner: true,
    fin: "angular",
    fixedGear: true,
    engine: { kind: "inline", hp: 1200, charger: "single" },
    prop: { blades: 3, diameter: 3.4, spinner: "#2a2d31", tips: "#2a2d31" },
    guns: [{ caliber: 7.92, count: 2, place: "wing" }],
    bombs: [{ kg: 500, dx: -60, dy: 30 }],
    fuel: 480,
    marking: "cross",
    code: "S2+AK",
  }),
  plane({
    id: "f86f",
    name: "F-86F Sabre",
    nation: "usa",
    paint: "silver",
    L: 1140,
    H: 130,
    style: "jet",
    tail: 0.42,
    hump: 0.1,
    span: 11.3,
    chord: 2.6,
    plan: "swept",
    canopy: "bubble",
    frames: 0,
    canopyAt: 0.62,
    fin: "swept",
    finH: 190,
    engine: { kind: "jet", thrust: 26.3 },
    guns: [{ caliber: 12.7, count: 6, place: "nose" }],
    fuel: 1650,
    ammo: 1800,
    code: "FU-178",
    codeColor: "#111111",
    markAt: 0.52,
    extras(v, k) {
      add(v, "stripes", { x: k.fx + k.L * 0.15, y: k.fy + 4, w: 70, h: k.H * 0.9 }, { style: "band", a: "#f2c230" });
    },
  }),
  plane({
    id: "mig15",
    name: "MiG-15bis",
    nation: "ussr",
    paint: "silver",
    L: 1010,
    H: 140,
    style: "jet",
    tail: 0.45,
    hump: 0.12,
    span: 10.1,
    chord: 2.6,
    plan: "swept",
    canopy: "bubble",
    frames: 0,
    canopyAt: 0.6,
    fin: "swept",
    finH: 230,
    engine: { kind: "jet", thrust: 26.5 },
    guns: [{ caliber: 37, count: 1, place: "nose" }, { caliber: 23, count: 2, place: "nose" }],
    fuel: 1420,
    ammo: 200,
    marking: "redstar",
    markAt: 0.08,
    code: "726",
    codeColor: "#c8102e",
  }),
];

// ---------------------------------------------------------------------------
// Cars
// ---------------------------------------------------------------------------

function car(spec) {
  const v = createVehicle("car", { name: spec.name, nation: spec.nation ?? "aura", preset: spec.id });
  v.size = { w: 700, h: 260 };
  v.paint = paint(spec.paint ?? "racing-red", { wear: 0, ...spec.paintExtra });
  const L = spec.L ?? 460;
  const H = spec.H ?? 150;
  const x = Math.round((v.size.w - L) / 2);
  const ground = v.size.h - GROUND;
  const y = ground - H;
  const wb = spec.wheelbase ?? 0.18;
  const r = spec.wheel ?? 36;
  add(v, "engine", { x: x + L * (spec.mid ? 0.3 : 0.72), y: y + H * 0.35, w: L * 0.2, h: H * 0.32 }, { kind: spec.engineKind ?? "petrol", hp: spec.hp });
  add(v, "fuel", { x: x + L * 0.08, y: y + H * 0.5, w: L * 0.14, h: H * 0.2 }, { liters: spec.fuel ?? 60 });
  if (spec.nitro) add(v, "module", { x: x + L * 0.2, y: y + H * 0.42, w: 70, h: 30 }, { kind: "nitro" });
  add(v, "pilot", { x: x + L * (spec.seat ?? 0.42), y: y + H * 0.18, w: 34, h: 40 }, { role: "driver", gear: spec.helmet ?? "racing" });
  add(v, "carbody", { x, y, w: L, h: H }, { style: spec.style, wheelbase: wb, arch: (r * 1.15) / H });
  for (const fx of [wb, 1 - wb]) {
    const wheel = add(v, "carwheel", { x: x + L * fx - r, y: ground - r * 2, w: r * 2, h: r * 2 }, { rim: spec.rim ?? "sport" });
    wheel.anim = { ...wheel.anim, type: "spin", speed: 1.5 };
  }
  if (spec.spoiler) add(v, "spoiler", { x: x - 6, y: y + H * (spec.spoilerY ?? 0.08), w: 90, h: 40 }, { style: spec.spoiler });
  add(v, "light", { x: x + L - 22, y: y + H * (spec.lightY ?? 0.48), w: 24, h: 14 }, { style: "led", on: true });
  add(v, "light", { x: x - 2, y: y + H * (spec.lightY ?? 0.48), w: 18, h: 14 }, { style: "tail", on: true }, { flipX: true });
  if (spec.exhaust !== false) add(v, "exhaust", { x: x - 30, y: ground - H * 0.3, w: 40, h: 16 }, { style: "pipe" }, { anim: { type: spec.flames ? "flicker" : "none", speed: 1, range: null, delay: 0, reverse: false, pivot: [0.5, 0.5] } });
  if (spec.number) add(v, "number", { x: x + L * 0.42, y: y + H * 0.42, w: 70, h: 44 }, { text: spec.number, color: "#111111", font: "block", hasOutline: true, outline: "#f1f2f0" });
  spec.extras?.(v, { x, y, L, H, ground });
  return fitVehicle(v, 40);
}

export const CARS = [
  car({ id: "jeep", name: "Willys MB Jeep", nation: "usa", paint: "olive", paintExtra: { wear: 0.25 }, style: "jeep", hp: 60, rim: "steel", wheel: 34, helmet: "cap", fuel: 57, flames: false, L: 340, H: 150, wheelbase: 0.17, seat: 0.4, extras(v, k) {
    add(v, "insignia", { x: k.x + k.L * 0.78, y: k.y + k.H * 0.38, w: 40, h: 40 }, { style: "usstar" });
    add(v, "mg", { x: k.x + k.L * 0.35, y: k.y - 26, w: 110, h: 16 }, { caliber: 12.7, mount: "pintle" });
    add(v, "stowage", { x: k.x - 10, y: k.y + k.H * 0.3, w: 30, h: 44 }, { style: "jerrycans" });
  } }),
  car({ id: "street", name: "Street Racer", paint: "racing-red", style: "sports", hp: 450, spoiler: "wing", number: "7", nitro: true, flames: true }),
  car({ id: "rally", name: "Rally Legend", paint: "silver", paintExtra: { base: "#f1f2f0", colors: ["#1f4e9a", "#c8102e", "#111"], camo: "racing" }, style: "rally", hp: 320, rim: "multi", spoiler: "wing", number: "21", wheel: 34 }),
  car({ id: "muscle", name: "Muscle Car", paint: "racing-red", paintExtra: { base: "#141518", colors: ["#f1f2f0", "#333", "#000"] }, style: "muscle", hp: 650, rim: "chrome", spoiler: "ducktail", spoilerY: 0.3, flames: true }),
  car({ id: "auragt", name: "Aura GT (concept)", paint: "aura", style: "super", hp: 1100, mid: true, rim: "multi", spoiler: "lip", spoilerY: 0.35, nitro: true, flames: true, H: 130, lightY: 0.55 }),
  car({ id: "openwheel", name: "Open-wheel Racer", paint: "racing-red", paintExtra: { base: "#0f766e", colors: ["#f2c230", "#111", "#fff"], camo: "racing" }, style: "f1", hp: 950, rim: "multi", spoiler: "wing", spoilerY: 0.05, number: "44", wheel: 34, H: 110, seat: 0.4, lightY: 0.6 }),
];

export const PRESETS = [...TANKS, ...PLANES, ...CARS];

/** A fresh copy of a preset (new ids so it can be changed freely). */
export function presetCopy(id) {
  const p = PRESETS.find((x) => x.preset === id);
  if (!p) return null;
  const copy = structuredClone(p);
  copy.id = `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return copy;
}

/** Starter for "build from scratch": a basic chassis to shape. */
export function starter(kind) {
  if (kind === "plane") {
    const v = presetCopy("spitfire5");
    v.name = "My plane";
    v.preset = null;
    v.parts = v.parts.filter((p) => !["number", "insignia"].includes(p.type));
    return v;
  }
  if (kind === "car") {
    const v = presetCopy("street");
    v.name = "My car";
    v.preset = null;
    v.parts = v.parts.filter((p) => !["number"].includes(p.type));
    return v;
  }
  if (kind === "other") {
    const v = createVehicle("other", { name: "My creation" });
    return v;
  }
  const v = presetCopy("sherman");
  v.name = "My tank";
  v.preset = null;
  v.parts = v.parts.filter((p) => !["number", "insignia", "stowage"].includes(p.type));
  return v;
}
