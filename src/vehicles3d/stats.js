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
  return [
    `🐘 Weighs as much as ${n(st.mass / 6)} elephants`,
    speedJoke,
    `🍕 Punches through ${n(pen / 12)} stacked pizzas`,
    `⏱️ Reloads in ${n(reload / 0.7)} “skill issue”s`,
  ];
}
