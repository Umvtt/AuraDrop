// Live stats and battle rating, approximate on purpose (a game, not a simulator).

const SHELL = { AP: 0.92, APHE: 0.95, APCBC: 1, APDS: 1.45, APFSDS: 2.9 };
const eff = (t, s) => t / Math.max(0.12, Math.cos((Math.min(83, s) * Math.PI) / 180));
/** Composite armour past 150 mm protects far more per tonne. */
const plate = (area, mm) => area * ((mm <= 150 ? mm : 150 + (mm - 150) * 0.12) / 1000) * 7.85;
const CREW = { 5: 5, 4: 4, 3: 3, 2: 2 };

export function penetration(cal, len, shell) {
  if (shell === "HEAT") return cal * 3.6;
  if (shell === "HE") return Math.max(5, cal * 0.18);
  return 1.64 * cal * (len / 50) * (SHELL[shell] ?? 1);
}

/** War Thunder-style steps: x.0, x.3, x.7. */
export function brStep(v) {
  const x = Math.min(13.7, Math.max(1, v));
  const w = Math.floor(x);
  const f = [0, 0.3, 0.7, 1].reduce((a, b) => (Math.abs(b - (x - w)) < Math.abs(a - (x - w)) ? b : a));
  return Math.round((w + f) * 10) / 10;
}

const row = (key, label, value, unit, bar, digits = 0) => ({
  key,
  label,
  value,
  unit,
  bar: bar == null ? null : Math.min(1, Math.max(0, bar)),
  text: value == null ? "—" : `${Number(value).toFixed(digits)}${unit ? ` ${unit}` : ""}`,
});

export function computeStats(v) {
  const s = v.spec;
  const warnings = [];
  if (v.kind === "plane") return planeStats(v);
  if (v.kind === "car") return carStats(v);
  if (v.kind !== "tank") return { br: null, rows: [], warnings, headline: v.name };
  const H = s.hull;
  const T = s.turret;
  const G = s.gun;
  const L = H.length;
  const W = H.width;
  const Hh = H.height - 0.42;
  const hull = plate(Hh * 0.5 * W, H.front) + plate(Hh * 0.5 * W, H.lower) + plate(L * Hh * 2 * 0.65, H.side) + plate(Hh * W, H.rear) + plate(L * W * 1.4, H.roof);
  const turret = T.style === "none" ? 0 : plate(T.height * T.width, T.front) * 1.15 + plate(T.length * T.height * 2, T.side) + plate(T.height * T.width * 0.8, T.rear) + plate(T.length * T.width, T.roof);
  const tracks = L * (0.5 + s.gear.trackWidth) + s.gear.wheels * 0.1;
  const gun = G.caliber * G.caliber * G.length * 3.2e-6 + 0.15;
  const engine = s.engine.hp * (s.engine.kind === "turbine" ? 0.0009 : 0.0018);
  const skirts = s.gear.skirts === "none" ? 0 : plate(L * 0.6 * 2, s.gear.skirtArmor);
  const crew = CREW[s.crewPreset] ?? 5;
  const mass = (hull + turret + tracks + gun + engine + skirts + s.ammo * 0.022 + s.engine.fuel * 0.00078 + crew * 0.09) * 1.05 + 1;
  const hpt = s.engine.hp / mass;
  const speed = Math.min(85, 13 * Math.sqrt(hpt));
  const pen = penetration(G.caliber, G.length, G.shell);
  const hasLoader = crew >= 4;
  let reload = G.loading === "autoloader" ? 4 + G.caliber / 30 : (2.2 + 0.0035 * Math.pow(G.caliber, 1.6)) * (G.loading === "separate" ? 1.8 : 1) * (hasLoader ? 1 : 1.5);
  if (!hasLoader && G.loading !== "autoloader") warnings.push("No loader in the crew: the gunner loads, so reloading is slower.");
  const hullFront = Math.max(eff(H.front, H.frontSlope), eff(H.lower, H.lowerSlope) * 0.9);
  const turretFront = T.style === "none" ? hullFront : Math.max(eff(T.front, T.frontSlope), G.mantletArmor);
  const side = H.side / Math.cos(((H.sideSlope ?? 0) * Math.PI) / 180) + (s.gear.skirts === "none" ? 0 : s.gear.skirtArmor * 0.5);
  const range = (s.engine.fuel * 240) / s.engine.hp;
  let br = pen <= 200 ? 4.35 * Math.log(Math.max(pen, 20)) - 16.03 : 7.02 + 2.8 * Math.log(pen / 200);
  br += Math.min(0.9, Math.max(-1, (Math.max(hullFront, turretFront) - 80) * 0.012));
  br += Math.min(0.6, Math.max(-0.6, (speed - 40) * 0.02));
  br += Math.min(0.3, Math.max(-0.4, (7 - reload) * 0.05));
  if (mass > 70) warnings.push("Over 70 tonnes: most bridges would give up.");
  if (hpt < 8) warnings.push("Under 8 hp per tonne: it will crawl. Add engine power or lose some armour.");
  return {
    br: brStep(br),
    mass,
    headline: `${G.caliber} mm L/${G.length} · ${Math.round(pen)} mm pen`,
    rows: [
      row("pen", "Penetration", pen, "mm", pen / 600),
      row("reload", "Reload", reload, "s", 1 - reload / 25, 1),
      row("hullFront", "Hull front", hullFront, "mm eff.", hullFront / 700),
      row("turretFront", "Turret front", turretFront, "mm eff.", turretFront / 800),
      row("side", "Side armour", side, "mm", side / 200),
      row("speed", "Top speed", speed, "km/h", speed / 80),
      row("hpt", "Power / weight", hpt, "hp/t", hpt / 30, 1),
      row("mass", "Weight", mass, "t", mass / 80, 1),
      row("crew", "Crew", crew, "", crew / 6),
      row("ammo", "Ammo", s.ammo, "rounds", s.ammo / 120),
      row("range", "Range", range, "km", range / 600),
    ],
    warnings,
  };
}

/** Silly comparisons for meme stat cards. */
export function jokeStats(v) {
  const st = computeStats(v);
  if (!st.mass) return [];
  const val = (k) => st.rows.find((r) => r.key === k)?.value ?? 0;
  const speed = val("speed");
  const pen = val("pen");
  const reload = val("reload");
  const n = (x) => (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10);
  const speedJoke =
    speed < 20 ? "🐢 Slower than a grandma with a shopping trolley" : speed < 32 ? "🏃 About as fast as Usain Bolt (on a good day)" : speed < 45 ? "🛵 Keeps up with a pizza delivery moped" : speed < 60 ? "🚓 Would get a speeding ticket in town" : "🏎️ Overtakes your dad on the motorway";
  if (v.kind === "plane") return [`🐘 Weighs as much as ${n(st.mass / 6)} elephants`, `🦅 ${n(speed / 390)}× a diving falcon`, `🛫 Wingspan of ${n(v.spec.wing.span / 1.8)} tall people lying head to toe`];
  if (v.kind === "car") return [`🐆 Top speed of ${n(speed / 110)} cheetahs`, `🐘 Weighs ${n((st.mass * 1000) / 6000)} of an elephant`, speedJoke];
  return [
    `🐘 Weighs as much as ${n(st.mass / 6)} elephants`,
    speedJoke,
    `🍕 Punches through ${n(pen / 12)} stacked pizzas`,
    `⏱️ Reloads in ${n(reload / 0.7)} “skill issue”s`,
  ];
}

function planeStats(v) {
  const s = v.spec;
  const F = s.fuselage;
  const W = s.wing;
  const warnings = [];
  const jet = F.nose === "jet";
  const area = W.span * (W.root + W.tip) * 0.5 * (W.plan === "elliptical" ? 0.9 : 1);
  const guns = s.guns;
  const empty = 1.2 + F.length * F.width * F.height * 0.09 + area * 0.035 + (jet ? s.engine.thrust * 0.025 : s.engine.hp * 0.00055) + F.armor * 0.004;
  const fuel = s.engine.fuel * 0.00072;
  const stores = s.stores.bombs * s.stores.bombKg * 0.001 + s.stores.rockets * 0.06 + (s.stores.droptank ? 0.35 : 0);
  const mass = empty + fuel + stores + (guns.wingCount + guns.noseCount) * 0.04;
  const loading = (mass * 1000) / area;
  // Speeds are with the gear tucked away (only fixed gear costs speed).
  const drag = 1 + F.width * F.height * (jet ? 0.04 : 0.08) + (F.scoop ? 0.02 : 0) + (s.gear.type === "fixed" ? 0.1 : 0) + stores * 0.05;
  let speed = jet ? 650 + s.engine.thrust * 15 - (W.plan === "swept" || W.plan === "delta" ? 0 : 150) : 300 + Math.sqrt(s.engine.hp) * 8.5 - area * 0.6 + (W.profile === "laminar" ? 18 : 0) + ({ two: 22, turbo: 30, single: 0, none: -25 }[s.engine.charger] ?? 0);
  speed = Math.max(140, speed / drag);
  const climb = jet ? (s.engine.thrust * 1000) / (mass * 1000 * 9.81) * 70 : (s.engine.hp * 0.7457 * 0.8) / (mass * 9.81) * 1.1;
  const turn = 12 + loading / 25; // seconds for a full circle
  const fire = guns.wingCount * guns.wingCal ** 2 * 0.0035 + guns.noseCount * guns.noseCal ** 2 * 0.0045;
  // Litres per hour at cruise: about 0.2 per hp for pistons, 60 per kN for jets.
  const range = (s.engine.fuel / Math.max(1, jet ? s.engine.thrust * 60 : s.engine.hp * 0.2)) * speed * 0.8;
  let br = 1 + (speed - 300) / 85 + fire * 0.06 + (s.stores.bombs * s.stores.bombKg) / 900;
  if (jet) br += 1.5;
  if (loading > 280) warnings.push("Heavy wing loading: it'll turn like a bus. Make the wings bigger or the plane lighter.");
  if (!jet && s.engine.hp / mass < 150) warnings.push("Not much power for its weight: slow climb ahead.");
  return {
    br: brStep(br),
    mass,
    headline: `${Math.round(speed)} km/h · ${guns.wingCount + guns.noseCount} guns`,
    rows: [
      row("speed", "Top speed", speed, "km/h", speed / 1100),
      row("climb", "Climb rate", climb, "m/s", climb / 40, 1),
      row("turn", "Turn time", turn, "s", 1 - turn / 40, 1),
      row("fire", "Firepower", fire, "", fire / 25, 1),
      row("loading", "Wing loading", loading, "kg/m²", loading / 450),
      row("mass", "Weight", mass, "t", mass / 15, 1),
      row("span", "Wingspan", W.span, "m", W.span / 40, 1),
      row("range", "Range", range, "km", range / 3000),
    ],
    warnings,
  };
}

function carStats(v) {
  const B = v.spec.body;
  const E = v.spec.engine;
  const warnings = [];
  const f1 = B.style === "f1";
  const mass = f1 ? 0.8 : 0.75 + B.length * B.width * B.height * 0.055 + E.hp * 0.00025 + (B.style === "pickup" || B.style === "jeep" ? 0.35 : 0);
  const kgPerHp = (mass * 1000) / E.hp;
  const grip = (f1 ? 1.6 : 1) * (0.85 + B.wheelSize * 0.25) * (B.spoiler === "wing" ? 1.1 : 1);
  const zeroTo100 = Math.max(1.8, 1.4 + kgPerHp * 0.42 / Math.min(1.4, grip)) * (E.nitro ? 0.88 : 1);
  const drag = (f1 ? 0.75 : 0.9) * B.width * B.height * (B.style === "jeep" || B.style === "pickup" ? 1.35 : 1);
  const top = Math.min(f1 ? 370 : 420, 95 + Math.cbrt(E.hp / drag) * 30) * (E.nitro ? 1.04 : 1);
  if (kgPerHp > 20) warnings.push("Very little power for its weight: it'll be a calm ride.");
  if (E.hp > 1200 && !f1 && B.spoiler === "none") warnings.push("That much power with no spoiler: hold on tight.");
  return {
    br: null,
    mass,
    headline: `${E.hp} hp · ${zeroTo100.toFixed(1)} s to 100`,
    rows: [
      row("speed", "Top speed", top, "km/h", top / 420),
      row("accel", "0–100 km/h", zeroTo100, "s", 1 - zeroTo100 / 15, 1),
      row("hp", "Power", E.hp, "hp", E.hp / 2000),
      row("kgPerHp", "Weight per hp", kgPerHp, "kg/hp", 1 - kgPerHp / 25, 1),
      row("grip", "Grip", grip * 100, "%", grip / 1.8),
      row("mass", "Weight", mass * 1000, "kg", mass / 3),
    ],
    warnings,
  };
}
