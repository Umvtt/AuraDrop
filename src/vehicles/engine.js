// AuraDrop vehicle engine: parts, drawing, armour / X-ray views, animation
// and live stats for the Workshop's tanks, planes and cars.
//
// No imports on purpose, like the player: exported web pages inline this
// file so vehicles look and move the same everywhere.
//
// Vehicles are drawn side-on, facing right. Units are centimetres: a part
// 630 wide is 6.3 m long. Stats come from the parts (armour thickness and
// slope, gun calibre, engine power…) using simple, approximate formulas.

const VEHICLE_VERSION = 1;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const n2 = (v) => Math.round(v * 100) / 100;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rad = (d) => (d * Math.PI) / 180;
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

/** Closed polygon path from [[x, y], …]. */
function poly(pts) {
  return `M${pts.map(([x, y]) => `${n2(x)} ${n2(y)}`).join("L")}Z`;
}
function rrect(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (!r) return `M${n2(x)} ${n2(y)}h${n2(w)}v${n2(h)}h${n2(-w)}Z`;
  return `M${n2(x + r)} ${n2(y)}H${n2(x + w - r)}A${n2(r)} ${n2(r)} 0 0 1 ${n2(x + w)} ${n2(y + r)}V${n2(y + h - r)}A${n2(r)} ${n2(r)} 0 0 1 ${n2(x + w - r)} ${n2(y + h)}H${n2(x + r)}A${n2(r)} ${n2(r)} 0 0 1 ${n2(x)} ${n2(y + h - r)}V${n2(y + r)}A${n2(r)} ${n2(r)} 0 0 1 ${n2(x + r)} ${n2(y)}Z`;
}
function ellipsePath(cx, cy, rx, ry) {
  return `M${n2(cx - rx)} ${n2(cy)}A${n2(rx)} ${n2(ry)} 0 1 0 ${n2(cx + rx)} ${n2(cy)}A${n2(rx)} ${n2(ry)} 0 1 0 ${n2(cx - rx)} ${n2(cy)}Z`;
}

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((c) => clamp(Math.round(c), 0, 255).toString(16).padStart(2, "0")).join("")}`;
}
/** Lighten (k > 0) or darken (k < 0) a colour. */
function shade(hex, k) {
  const rgb = hexToRgb(hex);
  return rgbToHex(rgb.map((c) => (k >= 0 ? c + (255 - c) * k : c * (1 + k))));
}
function mix(a, b, t) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex(x.map((c, i) => c + (y[i] - c) * t));
}

/** Deterministic random numbers (camo, weathering), seeded per vehicle. */
function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

let renderCounter = 0;

// ---------------------------------------------------------------------------
// Nations, paint and camouflage
// ---------------------------------------------------------------------------

const NATIONS = [
  { id: "usa", label: "USA", flag: "🇺🇸", tank: "#4b5320", plane: "#5d6b4a" },
  { id: "germany", label: "Germany", flag: "🇩🇪", tank: "#8a7f5a", plane: "#7d8790" },
  { id: "ussr", label: "USSR", flag: "☭", tank: "#4f5b34", plane: "#6b7a5c" },
  { id: "uk", label: "Great Britain", flag: "🇬🇧", tank: "#5c5a3f", plane: "#6a6d55" },
  { id: "japan", label: "Japan", flag: "🇯🇵", tank: "#6f6a45", plane: "#8a8a7a" },
  { id: "italy", label: "Italy", flag: "🇮🇹", tank: "#b49a68", plane: "#9b8b62" },
  { id: "france", label: "France", flag: "🇫🇷", tank: "#5a6346", plane: "#75806a" },
  { id: "sweden", label: "Sweden", flag: "🇸🇪", tank: "#4e5a3c", plane: "#5f6b52" },
  { id: "aura", label: "Aura Federation", flag: "💜", tank: "#3b3a5a", plane: "#3b3a5a" },
];

const CAMOS = [
  { id: "none", label: "Plain" },
  { id: "twotone", label: "Two-tone" },
  { id: "ambush", label: "Ambush (three-tone)" },
  { id: "stripes", label: "Tiger stripes" },
  { id: "splinter", label: "Splinter" },
  { id: "winter", label: "Winter whitewash" },
  { id: "digital", label: "Digital" },
  { id: "desert", label: "Desert blotches" },
  { id: "racing", label: "Racing stripes" },
];

/** Classic paint schemes to pick from in one click. */
const PAINTS = [
  { id: "olive", label: "Olive drab", base: "#4b5320", colors: ["#3a4019", "#6b5d3a", "#262915"], camo: "none" },
  { id: "dunkelgelb", label: "Dunkelgelb ambush", base: "#b8a46a", colors: ["#5b6b3a", "#7a4b2e", "#d8c78e"], camo: "ambush" },
  { id: "4bo", label: "4BO green", base: "#4f5b34", colors: ["#3b4526", "#6b7044", "#2c321d"], camo: "none" },
  { id: "winter", label: "Winter", base: "#e8ebe7", colors: ["#4f5b34", "#c9cfc8", "#9aa39a"], camo: "winter" },
  { id: "desert", label: "Desert", base: "#c2a46e", colors: ["#9a7a4a", "#6e7a52", "#e0c896"], camo: "desert" },
  { id: "caunter", label: "Splinter", base: "#a9a78a", colors: ["#5f6750", "#3d4436", "#c7c3a2"], camo: "splinter" },
  { id: "nato", label: "NATO three-tone", base: "#4a5a3a", colors: ["#2b2b25", "#6b4a32", "#38452c"], camo: "ambush" },
  { id: "digital", label: "Digital woodland", base: "#5c6a4c", colors: ["#3a4433", "#857a5a", "#22281e"], camo: "digital" },
  { id: "navy", label: "Navy blue", base: "#2d3e5c", colors: ["#1e2a40", "#53698f", "#11192a"], camo: "none" },
  { id: "rlm", label: "RLM grey", base: "#8d969c", colors: ["#5f6a5c", "#70776a", "#b8c0c6"], camo: "splinter" },
  { id: "silver", label: "Bare metal", base: "#c8ced6", colors: ["#a5adb7", "#e5e9ee", "#8b929b"], camo: "none" },
  { id: "racing-red", label: "Racing red", base: "#c8102e", colors: ["#ffffff", "#111111", "#8a0b1f"], camo: "racing" },
  { id: "aura", label: "Aura neon", base: "#2b1b4a", colors: ["#a78bfa", "#22d3ee", "#ec4899"], camo: "stripes" },
];

/** SVG <pattern> for a vehicle's paint (or a flat fill). */
function camoPattern(id, paint, size) {
  const [c1, c2, c3] = paint.colors;
  const base = paint.base;
  const r = rng(paint.seed || 7);
  const tile = Math.round(Math.max(size.w, size.h) * 0.42 * (paint.scale || 1));
  const blob = (color, count, minR, maxR) => {
    let out = "";
    for (let i = 0; i < count; i++) {
      const cx = r() * tile;
      const cy = r() * tile;
      const pts = [];
      const rr0 = minR + r() * (maxR - minR);
      const sides = 9 + Math.floor(r() * 5);
      const stretch = 1.3 + r() * 1.1;
      const tilt = (r() - 0.5) * 0.9;
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2;
        const rr1 = rr0 * (0.45 + r() * 0.95);
        const x = Math.cos(a) * rr1 * stretch;
        const y = Math.sin(a) * rr1;
        pts.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)]);
      }
      // Smooth the blob through midpoints for organic edges.
      let d = "";
      for (let k = 0; k < pts.length; k++) {
        const p = pts[k];
        const q = pts[(k + 1) % pts.length];
        const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        d += k === 0 ? `M${n2(m[0])} ${n2(m[1])}` : "";
        const nxt = pts[(k + 1) % pts.length];
        const nm = [(nxt[0] + pts[(k + 2) % pts.length][0]) / 2, (nxt[1] + pts[(k + 2) % pts.length][1]) / 2];
        d += `Q${n2(nxt[0])} ${n2(nxt[1])} ${n2(nm[0])} ${n2(nm[1])}`;
      }
      // Tile seamlessly: repeat blobs that cross an edge.
      for (const [ox, oy] of [[0, 0], [-tile, 0], [0, -tile], [-tile, -tile]]) {
        out += `<path d="${d}" fill="${color}" transform="translate(${ox} ${oy})"/>`;
      }
    }
    return out;
  };
  let body = "";
  switch (paint.camo) {
    case "twotone":
      body = blob(c1, 5, tile * 0.1, tile * 0.2);
      break;
    case "ambush":
      body = blob(c1, 4, tile * 0.09, tile * 0.17) + blob(c2, 4, tile * 0.08, tile * 0.15);
      for (let i = 0; i < 40; i++) body += `<circle cx="${n2(r() * tile)}" cy="${n2(r() * tile)}" r="${n2(tile * 0.008 + r() * tile * 0.006)}" fill="${i % 2 ? c3 : c1}"/>`;
      break;
    case "stripes":
      for (let i = 0; i < 9; i++) {
        const x = (i / 9) * tile * 1.2 - tile * 0.1;
        const w = tile * (0.02 + r() * 0.03);
        body += `<path d="M${n2(x)} ${-10}Q${n2(x + tile * 0.12)} ${n2(tile * 0.35)} ${n2(x - tile * 0.04)} ${n2(tile * 0.6)}T${n2(x + tile * 0.06)} ${tile + 10}" fill="none" stroke="${i % 3 === 2 ? c2 : c1}" stroke-width="${n2(w)}" stroke-linecap="round"/>`;
      }
      break;
    case "splinter":
      for (let i = 0; i < 14; i++) {
        const cx = r() * tile;
        const cy = r() * tile;
        const s = tile * (0.1 + r() * 0.14);
        const pts = [[cx, cy], [cx + s * (0.6 + r()), cy + s * (r() - 0.5)], [cx + s * (r() - 0.2), cy + s * (0.6 + r() * 0.6)]];
        body += `<path d="${poly(pts)}" fill="${i % 2 ? c1 : c2}"/>`;
      }
      break;
    case "winter":
      // The pattern background is the green; whitewash goes on top in streaks.
      body = blob(base, 9, tile * 0.1, tile * 0.2);
      return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${tile}" height="${tile}"><rect width="${tile}" height="${tile}" fill="${c1}"/>${body}${blob(c2, 4, tile * 0.04, tile * 0.08)}</pattern>`;
    case "digital": {
      const px = tile / 24;
      for (let i = 0; i < 160; i++) {
        const x = Math.floor(r() * 24) * px;
        const y = Math.floor(r() * 24) * px;
        const w = px * (1 + Math.floor(r() * 3));
        body += `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(px)}" fill="${[c1, c2, c3][i % 3]}"/>`;
      }
      break;
    }
    case "desert":
      body = blob(c1, 4, tile * 0.1, tile * 0.2) + blob(c3, 3, tile * 0.05, tile * 0.1);
      break;
    case "racing": {
      // Two long stripes along the body (pattern tile is tall so they run horizontally).
      const h = size.h;
      return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${size.w}" height="${h}"><rect width="${size.w}" height="${h}" fill="${base}"/><rect y="${n2(h * 0.44)}" width="${size.w}" height="${n2(h * 0.035)}" fill="${c1}"/><rect y="${n2(h * 0.5)}" width="${size.w}" height="${n2(h * 0.035)}" fill="${c1}"/></pattern>`;
    }
    default:
      return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="10" height="10"><rect width="10" height="10" fill="${base}"/></pattern>`;
  }
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${tile}" height="${tile}"><rect width="${tile}" height="${tile}" fill="${base}"/>${body}</pattern>`;
}

// ---------------------------------------------------------------------------
// Armour colours
// ---------------------------------------------------------------------------

/** Effective thickness of a plate: what a flat-flying shell has to go through. */
function effectiveArmor(t, slope) {
  return t / Math.max(0.12, Math.cos(rad(clamp(slope || 0, 0, 83))));
}

const ARMOR_SCALE = [
  [0, "#38bdf8"],
  [15, "#2dd4bf"],
  [30, "#22c55e"],
  [50, "#a3e635"],
  [80, "#facc15"],
  [120, "#f97316"],
  [180, "#ef4444"],
  [260, "#db2777"],
  [400, "#9333ea"],
  [650, "#4c1d95"],
];

function armorColor(mm) {
  for (let i = 1; i < ARMOR_SCALE.length; i++) {
    const [b, cb] = ARMOR_SCALE[i];
    const [a, ca] = ARMOR_SCALE[i - 1];
    if (mm <= b) return mix(ca, cb, (mm - a) / (b - a));
  }
  return ARMOR_SCALE.at(-1)[1];
}

// ---------------------------------------------------------------------------
// Render context: what parts call to draw themselves
// ---------------------------------------------------------------------------

const XR_FILL = "rgba(125,211,252,0.06)";
const XR_STROKE = "rgba(125,211,252,0.7)";
const MATERIALS = {
  steel: "#5b6168",
  metal: "#8a919b",
  dark: "#2a2d31",
  rubber: "#1d1f22",
  black: "#141518",
  glass: "#9fd7ff",
  brass: "#c9a24a",
  copper: "#b5653a",
  red: "#c8102e",
  white: "#f1f2f0",
  wood: "#7a5634",
  canvas: "#7a7656",
  light: "#fff3c4",
  chrome: "#d9dee5",
  yellow: "#f2c230",
};

/**
 * Build the drawing context for one part. Parts draw in their own box
 * (0..w, 0..h); the context decides fills for the current view.
 */
function makeCtx(env, part, def) {
  const { view, pid } = env;
  const painted = part.color ? part.color : `url(#${pid}-camo)`;
  const internal = !!def.internal;
  const xray = view === "xray" && !internal;
  const armorView = view === "armor";
  const ctx = {
    view,
    w: part.w,
    h: part.h,
    pid,
    part,
    anim: env.animate && part.anim && part.anim.type !== "none" ? part.anim.type : null,
    speed: (part.anim && part.anim.speed) || 1,
    labels: env.labels,
    nation: env.nation,
    /** Seconds string for SMIL, scaled by the part's animation speed. */
    dur: (base) => `${n2(base / ((part.anim && part.anim.speed) || 1))}s`,
    paintColor: part.color || env.paint.base,
    /** Fill for a role. Painted surfaces use the camo pattern. */
    fill(role) {
      if (xray) return XR_FILL;
      if (armorView && !internal) return role === "glass" ? "rgba(20,24,32,.7)" : "rgba(58,63,75,.55)";
      if (role === "paint") return painted;
      if (role === "paintDark") return part.color ? shade(part.color, -0.3) : shade(env.paint.base, -0.3);
      if (role === "paintLight") return part.color ? shade(part.color, 0.15) : shade(env.paint.base, 0.15);
      return MATERIALS[role] || role;
    },
    /** A filled shape with lighting. role: paint | steel | rubber | glass… */
    shape(d, role = "paint", opts = {}) {
      const f = ctx.fill(role);
      if (xray) return `<path d="${d}" fill="${XR_FILL}" stroke="${XR_STROKE}" stroke-width="1.3" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`;
      if (armorView && !internal) return `<path d="${d}" fill="${f}" stroke="rgba(0,0,0,.35)" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
      let out = `<path d="${d}" fill="${f}"${opts.opacity != null ? ` opacity="${opts.opacity}"` : ""}/>`;
      if (opts.shade !== false && role !== "glass" && role !== "light") {
        out += `<path d="${d}" fill="url(#${pid}-${opts.round ? "round" : "shade"})" pointer-events="none"/>`;
      }
      if (role === "glass") out += `<path d="${d}" fill="url(#${pid}-glass)" pointer-events="none"/>`;
      if (opts.wear !== false && env.paint.wear > 0 && (role === "paint" || role === "paintDark")) {
        out += `<path d="${d}" fill="url(#${pid}-dirt)" opacity="${n2(env.paint.wear)}" pointer-events="none"/>`;
      }
      if (opts.outline !== false) out += `<path d="${d}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="${opts.sw ?? 1.2}" stroke-linejoin="round" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      return out;
    },
    /**
     * An armour plate: painted normally, coloured by effective thickness
     * in the armour view, and hoverable (data-plate) everywhere.
     */
    plate(key, d, t, slope, label, lx, ly) {
      const eff = effectiveArmor(t, slope);
      const data = ` data-plate="${esc(part.id)}:${key}" data-label="${esc(label)}" data-t="${n2(t)}" data-slope="${n2(slope)}"`;
      if (armorView) {
        let out = `<path d="${d}" fill="${armorColor(eff)}" stroke="rgba(0,0,0,.55)" stroke-width="1" vector-effect="non-scaling-stroke"${data}/>`;
        if (env.labels && lx != null) out += `<text x="${n2(lx)}" y="${n2(ly)}" class="vx-mm" font-size="${n2(clamp(Math.min(part.w, part.h) * 0.16, 9, 28))}">${Math.round(t)}</text>`;
        return out;
      }
      return ctx.shape(d, "paint").replace("<path ", `<path${data} `);
    },
    /** Thin detail lines (panel lines, hatches). */
    line(d, opacity = 0.45, width = 1) {
      if (armorView && !internal) return "";
      const stroke = xray ? "rgba(125,211,252,.35)" : `rgba(0,0,0,${opacity})`;
      return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
    },
    /** Light edge highlight. */
    glint(d, opacity = 0.35, width = 1.2) {
      if (view !== "normal" || internal) return "";
      return `<path d="${d}" fill="none" stroke="rgba(255,255,255,${opacity})" stroke-width="${width}" stroke-linecap="round" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
    },
    bolts(points, r = 2.2) {
      if (view !== "normal") return "";
      return points.map(([x, y]) => `<circle cx="${n2(x)}" cy="${n2(y)}" r="${n2(r)}" fill="rgba(0,0,0,.35)"/><circle cx="${n2(x - r * 0.25)}" cy="${n2(y - r * 0.25)}" r="${n2(r * 0.45)}" fill="rgba(255,255,255,.28)"/>`).join("");
    },
    /** A small caption, shown in X-ray (internals) or with labels on. */
    label(x, y, text, size) {
      if (!env.labels || view === "normal") return "";
      return `<text x="${n2(x)}" y="${n2(y)}" class="vx-label" font-size="${n2(size || clamp(Math.min(part.w, part.h) * 0.22, 8, 22))}">${esc(text)}</text>`;
    },
    xray,
    armorView,
    internal,
  };
  return ctx;
}

// ---------------------------------------------------------------------------
// Shared drawing pieces
// ---------------------------------------------------------------------------

/** Road wheel / car wheel with rim, hub and bolts. style decides the look. */
function wheel(c, cx, cy, r, style = "solid", spinDur = null) {
  const rubber = c.fill("rubber");
  const steel = c.fill("steel");
  let g = "";
  if (c.xray) {
    g = `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" fill="${XR_FILL}" stroke="${XR_STROKE}" stroke-width="1.2" vector-effect="non-scaling-stroke"/><circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r * 0.3)}" fill="none" stroke="${XR_STROKE}" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
  } else if (c.armorView) {
    g = `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" fill="rgba(58,63,75,.55)" stroke="rgba(0,0,0,.35)" vector-effect="non-scaling-stroke"/>`;
  } else {
    const rim = style === "steel" || style === "spoked" || style === "christie" ? c.fill("paintDark") : style === "chrome" ? c.fill("chrome") : style === "sport" || style === "multi" ? c.fill("metal") : c.fill("paint");
    const tire = style === "christie" || style === "solid" || style === "spoked" || style === "interleaved" ? 0.12 : 0.26;
    g += `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" fill="${rubber}"/>`;
    // Tread hint on tyres.
    if (tire > 0.2) {
      g += `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r * 0.94)}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="${n2(r * 0.08)}" stroke-dasharray="${n2(r * 0.12)} ${n2(r * 0.1)}"/>`;
    }
    g += `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r * (1 - tire))}" fill="${rim}"/>`;
    g += `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r * (1 - tire))}" fill="url(#${c.pid}-round)"/>`;
    const inner = r * (1 - tire);
    let spokes = "";
    if (style === "spoked" || style === "sport") {
      const count = style === "sport" ? 5 : 8;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        spokes += `<path d="M${n2(cx + Math.cos(a) * inner * 0.3)} ${n2(cy + Math.sin(a) * inner * 0.3)}L${n2(cx + Math.cos(a) * inner * 0.88)} ${n2(cy + Math.sin(a) * inner * 0.88)}" stroke="rgba(0,0,0,.45)" stroke-width="${n2(inner * (style === "sport" ? 0.22 : 0.12))}" stroke-linecap="round"/>`;
      }
    } else if (style === "multi") {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        spokes += `<path d="M${n2(cx + Math.cos(a) * inner * 0.32)} ${n2(cy + Math.sin(a) * inner * 0.32)}L${n2(cx + Math.cos(a + 0.18) * inner * 0.9)} ${n2(cy + Math.sin(a + 0.18) * inner * 0.9)}" stroke="rgba(0,0,0,.4)" stroke-width="${n2(inner * 0.07)}"/>`;
      }
    } else if (style === "offroad" || style === "steel") {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        spokes += `<circle cx="${n2(cx + Math.cos(a) * inner * 0.62)}" cy="${n2(cy + Math.sin(a) * inner * 0.62)}" r="${n2(inner * 0.11)}" fill="rgba(0,0,0,.45)"/>`;
      }
    } else {
      // Pressed steel road wheel: dish ring and rim bolts.
      spokes += `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(inner * 0.72)}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="${n2(inner * 0.05)}"/>`;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        spokes += `<circle cx="${n2(cx + Math.cos(a) * inner * 0.86)}" cy="${n2(cy + Math.sin(a) * inner * 0.86)}" r="${n2(inner * 0.045)}" fill="rgba(0,0,0,.45)"/>`;
      }
    }
    // Hub cap and nuts.
    let hub = `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(inner * 0.3)}" fill="${steel}"/><circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(inner * 0.3)}" fill="url(#${c.pid}-round)"/>`;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      hub += `<circle cx="${n2(cx + Math.cos(a) * inner * 0.19)}" cy="${n2(cy + Math.sin(a) * inner * 0.19)}" r="${n2(inner * 0.035)}" fill="rgba(0,0,0,.55)"/>`;
    }
    g += spokes + hub;
    g += `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
    // A wear mark makes spinning visible.
    g += `<circle cx="${n2(cx + inner * 0.55)}" cy="${n2(cy - inner * 0.2)}" r="${n2(inner * 0.06)}" fill="rgba(255,255,255,.18)"/>`;
  }
  if (spinDur) g = `<g>${g}<animateTransform attributeName="transform" type="rotate" from="0 ${n2(cx)} ${n2(cy)}" to="360 ${n2(cx)} ${n2(cy)}" dur="${spinDur}" repeatCount="indefinite"/></g>`;
  return g;
}

/** A barrel from (x0, y) to (x1, y), radius r: tube with shading. */
function barrel(c, x0, x1, y, r, taper = 0.85) {
  const d = `M${n2(x0)} ${n2(y - r)}L${n2(x1)} ${n2(y - r * taper)}L${n2(x1)} ${n2(y + r * taper)}L${n2(x0)} ${n2(y + r)}Z`;
  if (c.xray || c.armorView) return c.shape(d, "steel");
  return `<path d="${d}" fill="${c.fill("paint")}"/><path d="${d}" fill="url(#${c.pid}-tube)"/><path d="${d}" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
}

/** Text in a part (numbers, names). */
function decalText(c, text, x, y, size, color, font, anchor = "middle", stroke = null) {
  if (c.view !== "normal") return "";
  return `<text x="${n2(x)}" y="${n2(y)}" font-size="${n2(size)}" text-anchor="${anchor}" dominant-baseline="central" font-family="${esc(font)}" font-weight="800" fill="${color}"${stroke ? ` stroke="${stroke}" stroke-width="${n2(size * 0.08)}" paint-order="stroke"` : ""}>${esc(text)}</text>`;
}

// ---------------------------------------------------------------------------
// Part catalogue
// ---------------------------------------------------------------------------
//
// Every part: { type, label, cat, kinds, size: [w, h], params: [...],
//   anims, pivot, internal, mass(p, part) (tonnes), render(c, p) }.
// Param specs: { k, label, type: range|select|toggle|text|color|armor|slope, … }.

const armor = (k, label, def, max = 300) => ({ k, label, type: "armor", min: 0, max, step: 1, def, unit: "mm" });
const slope = (k, label, def) => ({ k, label, type: "slope", min: 0, max: 80, step: 1, def, unit: "°" });
const range = (k, label, min, max, def, step = 1, unit = "") => ({ k, label, type: "range", min, max, def, step, unit });
const select = (k, label, options, def) => ({ k, label, type: "select", options, def });
const toggle = (k, label, def) => ({ k, label, type: "toggle", def });
const text = (k, label, def, max = 24) => ({ k, label, type: "text", def, max });
const color = (k, label, def) => ({ k, label, type: "color", def });
/**
 * Plate mass in tonnes: area m² × thickness. Past 150 mm, thickness is
 * treated as composite armour, which protects far more per tonne.
 */
const steelT = (areaM2, mm) => areaM2 * ((mm <= 150 ? mm : 150 + (mm - 150) * 0.12) / 1000) * 7.85;

const SHELLS = [
  ["AP", "AP (solid shot)"],
  ["APHE", "APHE"],
  ["APCBC", "APCBC"],
  ["APDS", "APDS"],
  ["APFSDS", "APFSDS (dart)"],
  ["HEAT", "HEAT"],
  ["HE", "HE"],
];

const PARTS = {};
function part(def) {
  PARTS[def.type] = { kinds: ["any"], anims: [], pivot: [0.5, 0.5], params: [], mass: () => 0, ...def };
}

// --- Tank: hull & turret ---------------------------------------------------

part({
  type: "hull",
  label: "Hull",
  cat: "Hull & turret",
  kinds: ["tank"],
  size: [640, 150],
  role: "hull",
  params: [
    select("style", "Build", [["welded", "Welded plates"], ["riveted", "Riveted"], ["cast", "Cast (rounded)"]], "welded"),
    armor("front", "Upper glacis", 100, 400),
    slope("frontSlope", "Glacis angle", 10),
    range("nose", "Glacis height", 0.15, 0.9, 0.45, 0.01),
    armor("lower", "Lower plate", 80, 300),
    slope("lowerSlope", "Lower plate angle", 25),
    armor("side", "Side", 80, 200),
    armor("rear", "Rear", 80, 200),
    slope("rearSlope", "Rear angle", 9),
    armor("roof", "Roof / floor", 25, 100),
    range("width", "Hull width", 1.8, 4.2, 3.4, 0.1, "m"),
    toggle("fender", "Fenders", true),
  ],
  mass(p, part) {
    const L = part.w / 100;
    const H = part.h / 100;
    const W = p.width;
    const up = (H * p.nose) / Math.cos(rad(p.frontSlope));
    const low = (H * (1 - p.nose)) / Math.cos(rad(p.lowerSlope));
    // Only part of the side is a full plate (the lower hull sits behind the tracks).
    return steelT(up * W, p.front) + steelT(low * W, p.lower) + steelT(L * H * 2 * 0.65, p.side) + steelT(H * W, p.rear) + steelT(L * W * 1.4, p.roof);
  },
  render(c, p) {
    const { w, h } = c;
    const noseY = h * p.nose;
    const fx = Math.min(w * 0.45, Math.tan(rad(p.frontSlope)) * noseY);
    const lx = Math.min(w * 0.35, Math.tan(rad(p.lowerSlope)) * (h - noseY));
    const rearY = h * 0.5;
    const rx = Math.min(w * 0.3, Math.tan(rad(p.rearSlope)) * rearY);
    const rlx = Math.min(w * 0.25, Math.tan(rad(32)) * (h - rearY));
    const pts = [[rx, 0], [w - fx, 0], [w, noseY], [w - lx, h], [rlx, h], [0, rearY]];
    let d = poly(pts);
    if (p.style === "cast") {
      // Round every corner for a cast hull.
      const r = Math.min(w, h) * 0.12;
      d = "";
      pts.forEach((pt, i) => {
        const a = pts[(i + pts.length - 1) % pts.length];
        const b = pts[(i + 1) % pts.length];
        const da = Math.hypot(a[0] - pt[0], a[1] - pt[1]);
        const db = Math.hypot(b[0] - pt[0], b[1] - pt[1]);
        const k1 = Math.min(r, da / 2) / da;
        const k2 = Math.min(r, db / 2) / db;
        const p1 = [pt[0] + (a[0] - pt[0]) * k1, pt[1] + (a[1] - pt[1]) * k1];
        const p2 = [pt[0] + (b[0] - pt[0]) * k2, pt[1] + (b[1] - pt[1]) * k2];
        d += `${i === 0 ? "M" : "L"}${n2(p1[0])} ${n2(p1[1])}Q${n2(pt[0])} ${n2(pt[1])} ${n2(p2[0])} ${n2(p2[1])}`;
      });
      d += "Z";
    }
    const band = (t) => clamp(t * 0.07, 2.5, w * 0.05);
    const bf = band(p.front);
    const bl = band(p.lower);
    const br = band(p.rear);
    const rt = clamp(p.roof * 0.12, 2, 9);
    let out = c.plate("side", d, p.side, 0, "Side", w * 0.45, h * 0.62);
    out += c.plate("front", poly([[w - fx, 0], [w, noseY], [w - bf, noseY], [w - fx - bf, 0]]), p.front, p.frontSlope, "Upper glacis", w - fx / 2 - bf, noseY * 0.45);
    out += c.plate("lower", poly([[w, noseY], [w - lx, h], [w - lx - bl, h], [w - bl, noseY]]), p.lower, p.lowerSlope, "Lower plate", w - lx / 2 - bl * 1.6, noseY + (h - noseY) * 0.55);
    out += c.plate("rear", poly([[0, rearY], [rx, 0], [rx + br, 0], [br, rearY]]), p.rear, p.rearSlope, "Rear", rx / 2 + br * 1.4, rearY * 0.5);
    out += c.plate("roof", poly([[rx + br, 0], [w - fx - bf, 0], [w - fx - bf - rt * 0.4, rt], [rx + br + rt * 0.4, rt]]), p.roof, 82, "Roof");
    // Fender line above the tracks and a weld or rivet seam.
    if (p.fender) {
      const fy = h * 0.48;
      out += c.shape(rrect(rlx * 0.5 - w * 0.015, fy - h * 0.035, w - lx * 0.4 - rlx * 0.5 + w * 0.03, h * 0.07, 2), "paintDark", { outline: true });
    }
    if (p.style === "riveted") {
      const row = [];
      for (let x = rx + 14; x < w - fx - 10; x += 22) row.push([x, rt + 7]);
      for (let x = rlx + 14; x < w - lx - 10; x += 22) row.push([x, h - 9]);
      out += c.bolts(row, clamp(h * 0.02, 1.6, 3.2));
    } else if (p.style === "welded") {
      out += c.line(`M${n2(w - fx - bf)} ${n2(rt)}L${n2(w - bf)} ${n2(noseY)}`, 0.25);
    }
    // Panel lines and highlights.
    out += c.line(`M${n2(w * 0.18)} ${n2(h * 0.18)}h${n2(w * 0.22)}M${n2(w * 0.5)} ${n2(h * 0.18)}h${n2(w * 0.18)}`, 0.25);
    out += c.glint(`M${n2(rx + 4)} 1.5L${n2(w - fx - 2)} 1.5`, 0.3);
    return out;
  },
});

const TURRET_STYLES = [
  ["boxy", "Boxy (Tiger)"],
  ["sloped", "Sloped (Panther)"],
  ["cast", "Cast dome (T-34 / IS)"],
  ["round", "Round (Sherman)"],
  ["wedge", "Wedge (modern)"],
  ["flat", "Flat & wide (Abrams)"],
  ["small", "Small cone"],
];

part({
  type: "turret",
  label: "Turret",
  cat: "Hull & turret",
  kinds: ["tank"],
  size: [300, 95],
  role: "turret",
  anims: ["traverse", "swing", "bob"],
  pivot: [0.55, 0.6],
  params: [
    select("style", "Shape", TURRET_STYLES, "boxy"),
    armor("front", "Turret front", 100, 900),
    slope("frontSlope", "Front angle", 8),
    armor("side", "Turret side", 80, 300),
    armor("rear", "Turret rear", 80, 300),
    armor("roof", "Turret roof", 25, 120),
    range("width", "Turret width", 1.2, 3.8, 2.3, 0.1, "m"),
    toggle("bustle", "Stowage bin", false),
    toggle("ports", "Vision ports", true),
  ],
  mass(p, part) {
    const L = part.w / 100;
    const H = part.h / 100;
    return steelT(H * p.width, p.front) * 1.15 + steelT(L * H * 2, p.side) + steelT(H * p.width * 0.8, p.rear) + steelT(L * p.width, p.roof);
  },
  render(c, p) {
    const { w, h } = c;
    const fs = Math.tan(rad(p.frontSlope));
    let d;
    switch (p.style) {
      case "sloped": {
        const f = Math.min(w * 0.35, fs * h + h * 0.35);
        d = poly([[w * 0.06, h * 0.12], [w - f, 0], [w, h * 0.72], [w - h * 0.08, h], [w * 0.02, h], [0, h * 0.3]]);
        break;
      }
      case "cast":
        d = `M${n2(w * 0.04)} ${n2(h)}C${n2(-w * 0.02)} ${n2(h * 0.45)} ${n2(w * 0.1)} ${n2(h * 0.02)} ${n2(w * 0.45)} 0C${n2(w * 0.8)} ${n2(-h * 0.02)} ${n2(w)} ${n2(h * 0.3)} ${n2(w)} ${n2(h * 0.7)}L${n2(w * 0.97)} ${n2(h)}Z`;
        break;
      case "round":
        d = `M${n2(w * 0.02)} ${n2(h)}C${n2(-w * 0.03)} ${n2(h * 0.5)} ${n2(w * 0.08)} ${n2(h * 0.05)} ${n2(w * 0.4)} ${n2(h * 0.03)}L${n2(w * 0.78)} 0C${n2(w * 0.95)} ${n2(h * 0.05)} ${n2(w)} ${n2(h * 0.45)} ${n2(w * 0.99)} ${n2(h)}Z`;
        break;
      case "wedge": {
        const f = Math.max(w * 0.3, Math.min(w * 0.55, fs * h * 1.6));
        d = poly([[0, h * 0.25], [w * 0.05, h * 0.08], [w - f, 0], [w, h * 0.55], [w - h * 0.12, h], [w * 0.03, h]]);
        break;
      }
      case "flat": {
        const f = Math.min(w * 0.3, fs * h * 0.9 + h * 0.2);
        d = poly([[0, h * 0.22], [w * 0.02, h * 0.04], [w - f, 0], [w, h * 0.42], [w - h * 0.1, h], [w * 0.06, h], [0, h * 0.6]]);
        break;
      }
      case "small":
        d = poly([[w * 0.08, h], [w * 0.2, h * 0.08], [w * 0.75, 0], [w * 0.95, h * 0.3], [w, h]]);
        break;
      default: {
        const f = Math.min(w * 0.2, fs * h);
        d = `M${n2(w * 0.03)} ${n2(h)}C${n2(-w * 0.01)} ${n2(h * 0.6)} ${n2(w * 0.01)} ${n2(h * 0.12)} ${n2(w * 0.12)} ${n2(h * 0.04)}L${n2(w - f)} 0L${n2(w)} ${n2(h * 0.08)}L${n2(w)} ${n2(h)}Z`;
      }
    }
    let out = c.plate("side", d, p.side, 0, "Turret side", w * 0.42, h * 0.55);
    // Front face band (the armour you see edge-on) and the roof line.
    const bw = clamp(p.front * 0.05, 3, w * 0.09);
    out += c.plate("front", rrect(w - bw - 1, h * 0.12, bw, h * 0.86, 2), p.front, p.frontSlope, "Turret front", w - bw - 12, h * 0.4);
    out += c.plate("roof", rrect(w * 0.15, 0.5, w * 0.6, clamp(p.roof * 0.1, 2, 6), 2), p.roof, 85, "Roof");
    if (p.ports) {
      out += c.shape(rrect(w * 0.3, h * 0.35, w * 0.06, h * 0.12, 3), "dark", { shade: false });
      out += c.shape(rrect(w * 0.62, h * 0.3, w * 0.07, h * 0.1, 3), "dark", { shade: false });
    }
    out += c.line(`M${n2(w * 0.1)} ${n2(h * 0.25)}Q${n2(w * 0.5)} ${n2(h * 0.18)} ${n2(w * 0.85)} ${n2(h * 0.22)}`, 0.22);
    out += c.glint(`M${n2(w * 0.15)} 2Q${n2(w * 0.5)} 0 ${n2(w * 0.8)} 2`, 0.35);
    if (p.bustle) out += c.shape(rrect(-w * 0.16, h * 0.18, w * 0.2, h * 0.62, 6), "paint");
    return out;
  },
});

part({
  type: "mantlet",
  label: "Gun mantlet",
  cat: "Hull & turret",
  kinds: ["tank"],
  size: [60, 80],
  role: "plate",
  params: [select("style", "Shape", [["box", "Box"], ["round", "Rounded (pig's head)"], ["cast", "Cast ball"], ["slab", "Slab (modern)"]], "box"), armor("armor", "Mantlet armour", 120, 600), slope("slope", "Angle", 0)],
  mass: (p, part) => steelT((part.w * part.h) / 1e4 * 1.2, p.armor),
  render(c, p) {
    const { w, h } = c;
    const d =
      p.style === "round"
        ? `M0 0H${n2(w * 0.5)}C${n2(w * 1.05)} 0 ${n2(w * 1.05)} ${n2(h)} ${n2(w * 0.5)} ${n2(h)}H0Z`
        : p.style === "cast"
          ? ellipsePath(w / 2, h / 2, w / 2, h / 2)
          : p.style === "slab"
            ? poly([[0, 0], [w * 0.8, 0], [w, h * 0.25], [w, h * 0.75], [w * 0.8, h], [0, h]])
            : rrect(0, 0, w, h, Math.min(w, h) * 0.12);
    return c.plate("main", d, p.armor, p.slope, "Mantlet", w * 0.5, h * 0.5) + c.bolts([[w * 0.25, h * 0.15], [w * 0.25, h * 0.85]], 2);
  },
});

// --- Tank: weapons --------------------------------------------------------

part({
  type: "gun",
  label: "Main gun",
  cat: "Weapons",
  kinds: ["tank", "any"],
  size: [500, 36],
  role: "gun",
  anims: ["recoil", "swing", "flicker"],
  internalAnims: ["flicker"],
  pivot: [0, 0.5],
  params: [
    range("caliber", "Calibre", 20, 155, 88, 1, "mm"),
    range("length", "Barrel length", 15, 75, 56, 1, "calibres"),
    select("shell", "Main shell", SHELLS, "APCBC"),
    select("loading", "Loading", [["unitary", "One piece"], ["separate", "Two piece (slow)"], ["autoloader", "Autoloader"]], "unitary"),
    select("brake", "Muzzle brake", [["double", "Double baffle"], ["single", "Single baffle"], ["none", "None"], ["slotted", "Slotted"]], "double"),
    toggle("evacuator", "Fume extractor", false),
    toggle("sleeve", "Thermal sleeve", false),
  ],
  // The part box follows the barrel: long guns are long.
  fit(p) {
    const r = Math.max(2.5, p.caliber / 10);
    const brake = p.brake === "none" ? 0 : r * (p.brake === "double" ? 5 : 3.2);
    return { w: Math.round((p.caliber * p.length) / 10 + brake), h: Math.round(r * 2 * (p.brake === "none" ? 1.15 : 1.75)) };
  },
  fromSize(p, w) {
    const r = Math.max(2.5, p.caliber / 10);
    const brake = p.brake === "none" ? 0 : r * (p.brake === "double" ? 5 : 3.2);
    return { length: clamp(Math.round(((w - brake) * 10) / p.caliber), 15, 75) };
  },
  mass: (p) => (p.caliber * p.caliber * p.length * 3.2e-6) + 0.15,
  render(c, p) {
    const { w, h } = c;
    const cy = h / 2;
    // Same proportions as fit(): bore radius from the box height.
    const r = h / 2 / (p.brake === "none" ? 1.15 : 1.75);
    const bl = p.brake === "none" ? 0 : Math.min(w * 0.3, r * (p.brake === "double" ? 5 : 3.2));
    const end = w - bl;
    let out = barrel(c, 0, end + 1, cy, r * 1.25, 0.72);
    if (p.sleeve) {
      for (let i = 1; i < 4; i++) out += c.shape(rrect((end * i) / 4 - 6, cy - r * 1.05, 12, r * 2.1, 2), "paintDark", { shade: false });
    }
    if (p.evacuator) out += c.shape(ellipsePath(end * 0.62, cy, end * 0.06, r * 1.55), "paint", { round: true });
    if (p.brake === "double") {
      out += c.shape(rrect(end, cy - h / 2 + 1, bl * 0.45, h - 2, 2), "steel", { round: true });
      out += c.shape(rrect(end + bl * 0.55, cy - h / 2 + 1, bl * 0.45, h - 2, 2), "steel", { round: true });
      out += c.shape(rrect(end, cy - r * 0.7, bl, r * 1.4, 1), "steel");
    } else if (p.brake === "single") {
      out += c.shape(rrect(end, cy - h / 2 + 1, bl, h - 2, 3), "steel", { round: true });
    } else if (p.brake === "slotted") {
      out += c.shape(rrect(end, cy - r * 1.2, bl, r * 2.4, 2), "steel", { round: true });
      for (let i = 0; i < 4; i++) out += c.line(`M${n2(end + bl * (0.2 + i * 0.2))} ${n2(cy - r)}v${n2(r * 2)}`, 0.6, 1.5);
    }
    if (c.anim === "flicker" && c.view === "normal") {
      out += `<g opacity="0"><path d="M${n2(w)} ${n2(cy)}l${n2(h * 1.4)} ${n2(-h * 0.7)}l${n2(-h * 0.3)} ${n2(h * 0.7)}l${n2(h * 0.3)} ${n2(h * 0.7)}Z" fill="url(#${c.pid}-flame)"/><animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.04;.12;1" dur="${c.dur(2.5)}" repeatCount="indefinite"/></g>`;
    }
    return out;
  },
});

part({
  type: "mg",
  label: "Machine gun",
  cat: "Weapons",
  size: [70, 12],
  role: "mg",
  anims: ["swing", "flicker"],
  internalAnims: ["flicker"],
  pivot: [0.1, 0.5],
  params: [range("caliber", "Calibre", 6, 15, 7.92, 0.01, "mm"), select("mount", "Mount", [["ball", "Hull ball mount"], ["coax", "Coaxial"], ["pintle", "Roof (AA)"]], "ball")],
  mass: () => 0.05,
  render(c, p) {
    const { w, h } = c;
    let out = "";
    if (p.mount === "ball") out += c.shape(ellipsePath(h * 0.9, h / 2, h * 0.9, h * 0.75), "paint", { round: true });
    if (p.mount === "pintle") out += c.shape(rrect(w * 0.18, h * 0.55, w * 0.06, h * 2.6, 1), "steel");
    out += barrel(c, h * 0.6, w, h / 2, h * 0.22, 0.9);
    out += c.shape(rrect(h * 0.6, h * 0.15, w * 0.32, h * 0.7, 2), "dark");
    if (c.anim === "flicker" && c.view === "normal") {
      out += `<g opacity="0"><circle cx="${n2(w + h * 0.6)}" cy="${n2(h / 2)}" r="${n2(h * 0.8)}" fill="url(#${c.pid}-flame)"/><animate attributeName="opacity" values="0;1;0" dur="${c.dur(0.18)}" repeatCount="indefinite"/></g>`;
    }
    return out;
  },
});

part({
  type: "smoke",
  label: "Smoke launchers",
  cat: "Weapons",
  kinds: ["tank"],
  size: [40, 30],
  params: [range("count", "Tubes", 1, 6, 3)],
  mass: () => 0.05,
  render(c, p) {
    const { w, h } = c;
    let out = "";
    const step = h / p.count;
    for (let i = 0; i < p.count; i++) out += c.shape(rrect(0, i * step + step * 0.12, w, step * 0.76, step * 0.3), "paintDark", { round: true });
    return out;
  },
});

// --- Tank: running gear ------------------------------------------------------

const WHEEL_STYLES = [
  ["solid", "Steel road wheels"],
  ["spoked", "Spoked"],
  ["interleaved", "Interleaved (Tiger / Panther)"],
  ["christie", "Big Christie wheels"],
  ["bogie", "Bogies (Sherman)"],
  ["modern", "Modern rubber-tyred"],
];

part({
  type: "tracks",
  label: "Tracks & wheels",
  cat: "Running gear",
  kinds: ["tank"],
  size: [640, 120],
  role: "tracks",
  anims: ["roll", "bob"],
  internalAnims: ["roll"],
  params: [
    select("wheels", "Road wheels", WHEEL_STYLES, "interleaved"),
    range("count", "Wheels per side", 3, 12, 8),
    range("rollers", "Return rollers", 0, 6, 0),
    select("drive", "Drive sprocket", [["front", "Front"], ["rear", "Rear"]], "front"),
    select("links", "Track", [["steel", "Steel links"], ["pads", "Rubber pads"], ["wide", "Wide winter tracks"]], "steel"),
    range("width", "Track width", 30, 95, 72, 1, "cm"),
  ],
  mass: (p, part) => (part.w / 100) * (0.5 + p.width / 100) + p.count * 0.1,
  render(c, p) {
    const { w, h } = c;
    const t = clamp(h * 0.085, 5, 16);
    const rs = h * 0.19;
    const front = [w - rs - t * 0.9, h * 0.32];
    const rear = [rs + t * 0.9, h * 0.32];
    const sprocket = p.drive === "front" ? front : rear;
    const idler = p.drive === "front" ? rear : front;
    const count = p.wheels === "bogie" ? Math.max(2, Math.round(p.count / 2)) * 2 : p.count;
    const big = p.wheels === "christie" || p.wheels === "interleaved";
    const startX = rs * 2 + t;
    const endX = w - rs * 2 - t;
    const span = endX - startX;
    const rw = Math.min(big ? h * 0.36 : h * 0.24, (span / count) * (p.wheels === "interleaved" ? 0.85 : 0.5));
    const wy = h - rw - t;
    const xs = [];
    for (let i = 0; i < count; i++) xs.push(startX + rw + (count === 1 ? span / 2 - rw : ((span - rw * 2) * i) / (count - 1)));
    const topY = Math.min(sprocket[1], idler[1]) - rs;
    const wheelsDur = c.anim === "roll" ? c.dur((2 * Math.PI * rw) / 180) : null;
    // Track belt: bottom run, around the sprocket, top run (with a little sag), around the idler.
    const x0 = xs[0];
    const x1 = xs[xs.length - 1];
    const R = rs + t / 2;
    const belt =
      `M${n2(x0)} ${n2(h - t / 2)}L${n2(x1)} ${n2(h - t / 2)}` +
      `Q${n2(w - t / 2)} ${n2(h - t / 2)} ${n2(front[0] + R)} ${n2(front[1])}` +
      `A${n2(R)} ${n2(R)} 0 0 0 ${n2(front[0])} ${n2(front[1] - R)}` +
      `Q${n2(w / 2)} ${n2(topY - t / 2 + (p.rollers ? 0 : rs * 0.35))} ${n2(rear[0])} ${n2(rear[1] - R)}` +
      `A${n2(R)} ${n2(R)} 0 0 0 ${n2(rear[0] - R)} ${n2(rear[1])}` +
      `Q${n2(t / 2)} ${n2(h - t / 2)} ${n2(x0)} ${n2(h - t / 2)}Z`;
    let out = "";
    if (c.xray || c.armorView) {
      out += `<path d="${belt}" fill="none" stroke="${c.xray ? XR_STROKE : "rgba(58,63,75,.8)"}" stroke-width="${n2(t)}" stroke-linejoin="round" opacity="${c.xray ? 0.5 : 1}"/>`;
    } else {
      out += `<path d="${belt}" fill="none" stroke="#24262a" stroke-width="${n2(t)}" stroke-linejoin="round"/>`;
      const link = p.links === "wide" ? t * 0.9 : t * 0.65;
      const dash = `${n2(link)} ${n2(link * 0.45)}`;
      const anim = c.anim === "roll" ? `<animate attributeName="stroke-dashoffset" from="0" to="${n2(link * 1.45)}" dur="${c.dur(0.25)}" repeatCount="indefinite"/>` : "";
      out += `<path d="${belt}" fill="none" stroke="${p.links === "pads" ? "#3a3c40" : "#5f6369"}" stroke-width="${n2(t * 0.62)}" stroke-dasharray="${dash}" stroke-linejoin="round">${anim}</path>`;
      out += `<path d="${belt}" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
    }
    // Return rollers on top.
    for (let i = 0; i < p.rollers; i++) {
      const x = startX + ((endX - startX) * (i + 1)) / (p.rollers + 1);
      out += wheel(c, x, topY + rs * 0.3, rs * 0.32, "solid", wheelsDur);
    }
    // Sprocket (teeth) and idler.
    if (!c.xray && !c.armorView) {
      out += `<circle cx="${n2(sprocket[0])}" cy="${n2(sprocket[1])}" r="${n2(rs * 1.02)}" fill="none" stroke="#3b3e43" stroke-width="${n2(rs * 0.22)}" stroke-dasharray="${n2(rs * 0.3)} ${n2(rs * 0.22)}">${wheelsDur ? `<animateTransform attributeName="transform" type="rotate" from="0 ${n2(sprocket[0])} ${n2(sprocket[1])}" to="360 ${n2(sprocket[0])} ${n2(sprocket[1])}" dur="${wheelsDur}" repeatCount="indefinite"/>` : ""}</circle>`;
    }
    out += wheel(c, sprocket[0], sprocket[1], rs * 0.85, "steel", wheelsDur);
    out += wheel(c, idler[0], idler[1], rs * 0.8, "spoked", wheelsDur);
    // Road wheels (interleaved: a back row slightly offset, then the front row).
    if (p.wheels === "interleaved") {
      xs.forEach((x, i) => i % 2 && (out += wheel(c, x, wy, rw * 0.98, "solid", wheelsDur)));
      xs.forEach((x, i) => !(i % 2) && (out += wheel(c, x, wy, rw, "solid", wheelsDur)));
    } else if (p.wheels === "bogie") {
      for (let i = 0; i < xs.length; i += 2) {
        const a = xs[i];
        const b = xs[i + 1] ?? a;
        const mid = (a + b) / 2;
        out += c.shape(rrect(mid - rw * 1.1, wy - rw * 1.25, rw * 2.2, rw * 1.1, rw * 0.3), "paintDark");
        out += wheel(c, mid, wy - rw * 1.45, rw * 0.38, "solid", wheelsDur);
        out += wheel(c, a, wy, rw, "spoked", wheelsDur) + wheel(c, b, wy, rw, "spoked", wheelsDur);
      }
    } else {
      xs.forEach((x) => (out += wheel(c, x, wy, rw, p.wheels === "christie" ? "christie" : p.wheels === "modern" ? "sport" : p.wheels, wheelsDur)));
    }
    return out;
  },
});

part({
  type: "skirts",
  label: "Side skirts",
  cat: "Running gear",
  kinds: ["tank"],
  size: [520, 50],
  role: "plate",
  params: [select("style", "Type", [["panels", "Steel panels"], ["rubber", "Rubber flaps"], ["mesh", "Wire mesh"], ["era", "Reactive blocks"]], "panels"), armor("armor", "Thickness", 8, 120), range("panels", "Panels", 2, 12, 6)],
  mass: (p, part) => steelT((part.w * part.h) / 1e4 * 2, p.armor),
  render(c, p) {
    const { w, h } = c;
    let out = "";
    const step = w / p.panels;
    for (let i = 0; i < p.panels; i++) {
      const x = i * step;
      const d = p.style === "era" ? rrect(x + 1.5, 1, step - 3, h - 2, 2) : poly([[x + 1, 0], [x + step - 1, 0], [x + step - 1, h - (i === p.panels - 1 ? h * 0.25 : 0)], [x + 1, h]]);
      if (p.style === "mesh" && c.view === "normal") {
        out += `<path d="${d}" fill="none" stroke="${c.fill("paintDark")}" stroke-width="2"/><path d="${d}" fill="url(#${c.pid}-mesh)" opacity=".8"/>`;
      } else out += c.plate(`p${i}`, d, p.armor, 0, p.style === "era" ? "Reactive armour" : "Skirt", x + step / 2, h / 2);
      if (p.style !== "rubber") out += c.bolts([[x + 6, 6], [x + step - 6, 6]], 1.8);
    }
    return out;
  },
});

// --- Tank: details ----------------------------------------------------------------

part({
  type: "cupola",
  label: "Commander's cupola",
  cat: "Details",
  kinds: ["tank"],
  size: [70, 36],
  params: [select("style", "Style", [["blocks", "Vision blocks"], ["hatch", "Simple hatch"], ["mg", "With MG mount"]], "blocks")],
  mass: () => 0.3,
  render(c, p) {
    const { w, h } = c;
    let out = c.shape(rrect(w * 0.05, h * 0.25, w * 0.9, h * 0.75, 6), "paint");
    out += c.shape(rrect(0, 0, w, h * 0.3, 5), "paintDark");
    if (p.style === "blocks") for (let i = 0; i < 4; i++) out += c.shape(rrect(w * (0.12 + i * 0.21), h * 0.45, w * 0.12, h * 0.25, 2), "glass", { outline: false });
    if (p.style === "mg") out += barrel(c, w * 0.5, w * 1.5, h * 0.12, 2.2);
    return out;
  },
});

part({
  type: "hatch",
  label: "Hatch",
  cat: "Details",
  size: [60, 12],
  params: [],
  render(c) {
    const { w, h } = c;
    return c.shape(rrect(0, 0, w, h, h / 2), "paintDark") + c.shape(rrect(w * 0.4, -h * 0.3, w * 0.2, h * 0.5, 2), "steel");
  },
});

part({
  type: "periscope",
  label: "Periscope",
  cat: "Details",
  size: [16, 16],
  render(c) {
    const { w, h } = c;
    return c.shape(rrect(0, h * 0.3, w, h * 0.7, 2), "paintDark") + c.shape(rrect(w * 0.15, 0, w * 0.7, h * 0.35, 2), "glass");
  },
});

part({
  type: "light",
  label: "Headlight",
  cat: "Details",
  size: [26, 18],
  anims: ["blink", "flicker"],
  params: [select("style", "Style", [["round", "Round lamp"], ["notek", "Blackout (Notek)"], ["led", "LED"], ["tail", "Tail light (red)"]], "round"), toggle("on", "Lit", false)],
  render(c, p) {
    const { w, h } = c;
    const lit = p.on || c.anim;
    const lens = p.style === "tail" ? "#ff3b3b" : "#fff3c4";
    let out = c.shape(rrect(0, 0, w * 0.55, h, 3), "paintDark");
    out += c.shape(ellipsePath(w * 0.62, h / 2, w * 0.38, h * 0.48), lit && c.view === "normal" ? lens : "glass");
    if (lit && c.view === "normal") out += `<ellipse cx="${n2(w * 1.2)}" cy="${n2(h / 2)}" rx="${n2(w * 1.6)}" ry="${n2(h * 1.4)}" fill="url(#${c.pid}-${p.style === "tail" ? "glowred" : "glow"})" pointer-events="none"/>`;
    return out;
  },
});

part({
  type: "exhaust",
  label: "Exhaust",
  cat: "Details",
  size: [40, 24],
  anims: ["smoke", "flicker"],
  internalAnims: ["smoke", "flicker"],
  params: [select("style", "Style", [["muffler", "Muffler"], ["pipe", "Pipe"], ["stack", "Stacks (aircraft)"]], "muffler")],
  render(c, p) {
    const { w, h } = c;
    let out = "";
    if (p.style === "stack") {
      for (let i = 0; i < 3; i++) out += c.shape(poly([[i * w * 0.33, h * 0.25], [i * w * 0.33 + w * 0.26, 0], [i * w * 0.33 + w * 0.3, h * 0.45], [i * w * 0.33 + w * 0.05, h * 0.75]]), "dark");
    } else if (p.style === "pipe") {
      out += barrel(c, 0, w, h / 2, h * 0.3, 1);
    } else out += c.shape(rrect(0, 0, w * 0.85, h, h / 2), "dark", { round: true }) + c.shape(rrect(w * 0.8, h * 0.3, w * 0.2, h * 0.4, 2), "black");
    if (c.view !== "normal" || !c.anim) return out;
    if (c.anim === "flicker") {
      const fx = p.style === "stack" ? w * 0.5 : w;
      return out + `<g><path d="M${n2(fx)} ${n2(h * 0.2)}q${n2(w * 0.5)} ${n2(h * 0.3)} ${n2(w * 0.9)} ${n2(h * 0.3)}q${n2(-w * 0.4)} ${n2(h * 0.1)} ${n2(-w * 0.9)} ${n2(h * 0.4)}z" fill="url(#${c.pid}-flame)"/><animate attributeName="opacity" values="1;.4;.9;.3;1" dur="${c.dur(0.3)}" repeatCount="indefinite"/></g>`;
    }
    // Smoke puffs drifting up and back.
    let puffs = "";
    for (let i = 0; i < 3; i++) {
      const dur = c.dur(2.4);
      puffs += `<circle cx="${n2(w * 0.9)}" cy="${n2(h * 0.3)}" r="${n2(h * 0.3)}" fill="rgba(120,120,120,.45)" opacity="0"><animate attributeName="opacity" values="0;.7;0" dur="${dur}" begin="${n2(i * 0.8)}s" repeatCount="indefinite"/><animate attributeName="r" values="${n2(h * 0.2)};${n2(h * 1.2)}" dur="${dur}" begin="${n2(i * 0.8)}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 0;${n2(-w * 1.6)} ${n2(-h * 3)}" dur="${dur}" begin="${n2(i * 0.8)}s" repeatCount="indefinite"/></circle>`;
    }
    return out + puffs;
  },
});

part({
  type: "antenna",
  label: "Antenna",
  cat: "Details",
  size: [10, 160],
  anims: ["swing"],
  pivot: [0.5, 1],
  params: [toggle("flag", "Pennant", false), color("flagColor", "Pennant colour", "#c8102e")],
  render(c, p) {
    const { w, h } = c;
    let out = c.shape(rrect(0, h * 0.9, w, h * 0.1, 2), "dark");
    out += c.view === "normal" ? `<path d="M${n2(w / 2)} ${n2(h * 0.9)}L${n2(w / 2)} 0" stroke="#2a2d31" stroke-width="2" stroke-linecap="round"/>` : c.line(`M${n2(w / 2)} ${n2(h * 0.9)}L${n2(w / 2)} 0`, 0.6, 1.5);
    if (p.flag && c.view === "normal") out += `<path d="M${n2(w / 2)} 2l${n2(w * 3.5)} ${n2(h * 0.04)}l${n2(-w * 3.5)} ${n2(h * 0.05)}Z" fill="${p.flagColor}"/>`;
    return out;
  },
});

part({
  type: "stowage",
  label: "Stowage",
  cat: "Details",
  size: [80, 34],
  params: [select("style", "What", [["box", "Tool box"], ["jerrycans", "Jerrycans"], ["tracks", "Spare track links"], ["logs", "Log / beam"], ["tarp", "Rolled tarp"], ["shovel", "Shovel & axe"], ["cable", "Tow cable"]], "box")],
  mass: () => 0.1,
  render(c, p) {
    const { w, h } = c;
    switch (p.style) {
      case "jerrycans": {
        let out = "";
        const n = Math.max(1, Math.round(w / (h * 0.7)));
        for (let i = 0; i < n; i++) out += c.shape(rrect((i * w) / n + 1, 0, w / n - 2, h, 3), "paintDark") + c.line(`M${n2((i * w) / n + 4)} ${n2(h * 0.25)}l${n2(w / n - 8)} ${n2(h * 0.5)}`, 0.3);
        return out;
      }
      case "tracks": {
        let out = "";
        const n = Math.max(2, Math.round(w / (h * 0.35)));
        for (let i = 0; i < n; i++) out += c.shape(rrect((i * w) / n, 0, w / n - 1.5, h, 2), "steel", { shade: false });
        return out;
      }
      case "logs":
        return c.shape(rrect(0, 0, w, h, h / 2), "wood", { round: true }) + c.line(`M${n2(w * 0.1)} ${n2(h * 0.4)}h${n2(w * 0.5)}M${n2(w * 0.3)} ${n2(h * 0.65)}h${n2(w * 0.55)}`, 0.3);
      case "tarp":
        return c.shape(rrect(0, 0, w, h, h / 2), "canvas", { round: true }) + c.line(`M${n2(w * 0.3)} 0v${n2(h)}M${n2(w * 0.7)} 0v${n2(h)}`, 0.5, 2);
      case "shovel":
        return c.shape(rrect(0, h * 0.4, w * 0.75, h * 0.18, 2), "wood") + c.shape(poly([[w * 0.72, h * 0.15], [w, h * 0.3], [w, h * 0.7], [w * 0.72, h * 0.85]]), "steel");
      case "cable":
        return `<path d="M0 ${n2(h / 2)}Q${n2(w / 4)} 0 ${n2(w / 2)} ${n2(h / 2)}T${n2(w)} ${n2(h / 2)}" fill="none" stroke="${c.view === "normal" ? "#3a3d42" : XR_STROKE}" stroke-width="${n2(h * 0.25)}" stroke-linecap="round"/>`;
      default:
        return c.shape(rrect(0, 0, w, h, 3), "paintDark") + c.shape(rrect(w * 0.4, h * 0.35, w * 0.2, h * 0.2, 2), "steel");
    }
  },
});

part({
  type: "era",
  label: "Reactive armour",
  cat: "Details",
  kinds: ["tank"],
  size: [120, 50],
  role: "plate",
  params: [range("cols", "Blocks across", 1, 10, 4), range("rows", "Rows", 1, 4, 2), armor("armor", "Protection", 120, 500)],
  mass: (p) => p.cols * p.rows * 0.06,
  render(c, p) {
    const { w, h } = c;
    let out = "";
    const bw = w / p.cols;
    const bh = h / p.rows;
    for (let i = 0; i < p.cols; i++)
      for (let j = 0; j < p.rows; j++) out += c.plate(`b${i}${j}`, rrect(i * bw + 1, j * bh + 1, bw - 2, bh - 2, 2), p.armor, 0, "Reactive armour", i * bw + bw / 2, j * bh + bh / 2) + c.bolts([[i * bw + 4, j * bh + 4], [i * bw + bw - 4, j * bh + 4]], 1.2);
    return out;
  },
});

// --- Crew & internal modules (seen in X-ray) ------------------------------------

const CREW_ROLES = [
  ["commander", "Commander", "#facc15"],
  ["gunner", "Gunner", "#f87171"],
  ["loader", "Loader", "#fb923c"],
  ["driver", "Driver", "#4ade80"],
  ["radio", "Radio operator / MG", "#60a5fa"],
  ["pilot", "Pilot", "#22d3ee"],
  ["rear-gunner", "Rear gunner", "#c084fc"],
];

part({
  type: "crew",
  label: "Crew member",
  cat: "Crew & modules",
  size: [44, 70],
  internal: true,
  role: "crew",
  params: [select("role", "Role", CREW_ROLES.map(([id, l]) => [id, l]), "gunner")],
  mass: () => 0.09,
  render(c, p) {
    const { w, h } = c;
    const col = (CREW_ROLES.find((r) => r[0] === p.role) || CREW_ROLES[1])[2];
    if (c.view === "normal" || c.armorView) return "";
    let out = `<rect x="${n2(w * 0.1)}" y="${n2(h * 0.62)}" width="${n2(w * 0.8)}" height="${n2(h * 0.12)}" rx="3" fill="${shade(col, -0.45)}"/>`;
    out += `<path d="${rrect(w * 0.22, h * 0.3, w * 0.56, h * 0.42, w * 0.2)}" fill="${col}" fill-opacity=".85"/>`;
    out += `<circle cx="${n2(w / 2)}" cy="${n2(h * 0.17)}" r="${n2(Math.min(w, h) * 0.17)}" fill="${col}"/>`;
    out += `<path d="${rrect(w * 0.2, h * 0.74, w * 0.2, h * 0.26, 3)}" fill="${shade(col, -0.2)}"/>`;
    out += c.label(w / 2, h + 12, CREW_ROLES.find((r) => r[0] === p.role)?.[1] ?? "Crew", 11);
    return out;
  },
});

part({
  type: "pilot",
  label: "Pilot / driver (visible)",
  cat: "Crew & modules",
  size: [40, 46],
  role: "crew",
  params: [select("role", "Role", [["pilot", "Pilot"], ["driver", "Driver"], ["commander", "Commander"]], "pilot"), select("gear", "Headgear", [["leather", "Leather helmet"], ["jet", "Jet helmet"], ["racing", "Racing helmet"], ["cap", "Cap"]], "leather"), color("suit", "Colour", "#5b4a34")],
  mass: () => 0.09,
  render(c, p) {
    const { w, h } = c;
    if (c.armorView) return "";
    const helmet = p.gear === "jet" ? "#d9dee5" : p.gear === "racing" ? "#e11d48" : p.gear === "cap" ? "#3f4a3a" : "#5b3a1f";
    if (c.xray) return `<circle cx="${n2(w * 0.5)}" cy="${n2(h * 0.3)}" r="${n2(w * 0.24)}" fill="#22d3ee" fill-opacity=".85"/><path d="${rrect(w * 0.15, h * 0.52, w * 0.7, h * 0.48, w * 0.2)}" fill="#22d3ee" fill-opacity=".6"/>`;
    let out = `<path d="${rrect(w * 0.12, h * 0.55, w * 0.76, h * 0.6, w * 0.25)}" fill="${p.suit}"/>`;
    out += `<circle cx="${n2(w * 0.52)}" cy="${n2(h * 0.32)}" r="${n2(w * 0.24)}" fill="#e8b48a"/>`;
    out += `<path d="M${n2(w * 0.27)} ${n2(h * 0.34)}A${n2(w * 0.26)} ${n2(w * 0.26)} 0 0 1 ${n2(w * 0.79)} ${n2(h * 0.3)}L${n2(w * 0.8)} ${n2(h * 0.2)}Q${n2(w * 0.5)} ${n2(-h * 0.02)} ${n2(w * 0.25)} ${n2(h * 0.22)}Z" fill="${helmet}"/>`;
    if (p.gear === "leather" || p.gear === "jet") out += `<path d="${rrect(w * 0.55, h * 0.24, w * 0.3, h * 0.1, 3)}" fill="#1e293b"/>`;
    return out;
  },
});

part({
  type: "ammo",
  label: "Ammo rack",
  cat: "Crew & modules",
  size: [110, 60],
  internal: true,
  role: "ammo",
  params: [range("rounds", "Rounds", 1, 200, 30), select("kind", "Shells", [["shells", "Tank shells"], ["belts", "MG / cannon belts"], ["rockets", "Rockets"]], "shells")],
  mass: (p) => p.rounds * (p.kind === "belts" ? 0.00025 : p.kind === "rockets" ? 0.03 : 0.022),
  render(c, p) {
    const { w, h } = c;
    if (c.view === "normal" || c.armorView) return "";
    let out = `<path d="${rrect(0, 0, w, h, 4)}" fill="rgba(251,146,60,.12)" stroke="#fb923c" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`;
    const shown = Math.min(p.rounds, 24);
    const cols = Math.max(1, Math.ceil(Math.sqrt((shown * w) / h)));
    const rows = Math.ceil(shown / cols);
    const cw = w / cols;
    const rh = h / rows;
    for (let i = 0; i < shown; i++) {
      const x = (i % cols) * cw + cw * 0.15;
      const y = Math.floor(i / cols) * rh + rh * 0.22;
      out += `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(cw * 0.5)}" height="${n2(rh * 0.56)}" rx="1.5" fill="#d6a640"/><path d="M${n2(x + cw * 0.5)} ${n2(y)}h${n2(cw * 0.15)}l${n2(cw * 0.15)} ${n2(rh * 0.28)}l${n2(-cw * 0.15)} ${n2(rh * 0.28)}h${n2(-cw * 0.15)}Z" fill="#9aa1ab"/>`;
    }
    return out + c.label(w / 2, h + 12, `Ammo ×${p.rounds}`, 11);
  },
});

part({
  type: "fuel",
  label: "Fuel tank",
  cat: "Crew & modules",
  size: [100, 50],
  internal: true,
  role: "fuel",
  params: [range("liters", "Fuel", 20, 2000, 300, 10, "L"), select("kind", "Fuel", [["petrol", "Petrol"], ["diesel", "Diesel"], ["kerosene", "Jet fuel"]], "petrol")],
  mass: (p) => p.liters * 0.00078 + 0.04,
  render(c, p) {
    const { w, h } = c;
    if (c.view === "normal" || c.armorView) return "";
    const col = p.kind === "diesel" ? "#a3e635" : p.kind === "kerosene" ? "#38bdf8" : "#facc15";
    let out = `<path d="${rrect(0, 0, w, h, Math.min(w, h) * 0.2)}" fill="${col}" fill-opacity=".14" stroke="${col}" stroke-width="1.3" vector-effect="non-scaling-stroke"/>`;
    out += `<path d="M2 ${n2(h * 0.35)}q${n2(w * 0.12)} -6 ${n2(w * 0.25)} 0t${n2(w * 0.25)} 0t${n2(w * 0.25)} 0t${n2(w * 0.25 - 4)} 0V${n2(h - 2)}H2Z" fill="${col}" fill-opacity=".45"/>`;
    return out + c.label(w / 2, h + 12, `Fuel ${p.liters} L`, 11);
  },
});

const ENGINE_TYPES = [
  ["petrol", "Petrol V12 / V8"],
  ["diesel", "Diesel"],
  ["turbine", "Gas turbine"],
  ["inline", "Inline (aircraft)"],
  ["radial", "Radial (aircraft)"],
  ["jet", "Jet engine"],
  ["electric", "Electric"],
];

part({
  type: "engine",
  label: "Engine",
  cat: "Crew & modules",
  size: [130, 70],
  internal: true,
  role: "engine",
  params: [
    select("kind", "Type", ENGINE_TYPES, "petrol"),
    range("hp", "Power", 40, 3000, 700, 10, "hp"),
    range("thrust", "Thrust (jets)", 5, 150, 26, 0.5, "kN"),
    select("charger", "Supercharger", [["single", "Single stage"], ["two", "Two-stage (high altitude)"], ["turbo", "Turbocharged"], ["none", "None"]], "single"),
  ],
  mass: (p) => (p.kind === "jet" ? p.thrust * 0.04 : p.kind === "turbine" ? p.hp * 0.0009 : p.kind === "inline" || p.kind === "radial" ? p.hp * 0.00062 : p.kind === "electric" ? p.hp * 0.0011 : p.hp * 0.0018),
  render(c, p) {
    const { w, h } = c;
    if (c.view === "normal" || c.armorView) return "";
    const col = "#f43f5e";
    let out = `<path d="${rrect(0, h * 0.22, w, h * 0.78, 6)}" fill="${col}" fill-opacity=".16" stroke="${col}" stroke-width="1.3" vector-effect="non-scaling-stroke"/>`;
    if (p.kind === "jet" || p.kind === "turbine") {
      for (let i = 0; i < 6; i++) out += `<path d="M${n2(w * (0.12 + i * 0.13))} ${n2(h * 0.3)}v${n2(h * 0.6)}" stroke="${col}" stroke-width="2" opacity=".7"/>`;
    } else if (p.kind === "radial") {
      out += `<circle cx="${n2(w / 2)}" cy="${n2(h * 0.6)}" r="${n2(h * 0.34)}" fill="none" stroke="${col}" stroke-width="2"/>`;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        out += `<circle cx="${n2(w / 2 + Math.cos(a) * h * 0.26)}" cy="${n2(h * 0.6 + Math.sin(a) * h * 0.26)}" r="${n2(h * 0.06)}" fill="${col}" opacity=".7"/>`;
      }
    } else {
      const cyl = p.kind === "electric" ? 0 : 6;
      for (let i = 0; i < cyl; i++) out += `<rect x="${n2(w * (0.08 + i * 0.145))}" y="0" width="${n2(w * 0.11)}" height="${n2(h * 0.3)}" rx="2" fill="${col}" opacity=".6"/>`;
      if (p.kind === "electric") out += `<path d="M${n2(w * 0.55)} ${n2(h * 0.3)}l${n2(-w * 0.12)} ${n2(h * 0.3)}h${n2(w * 0.1)}l${n2(-w * 0.06)} ${n2(h * 0.32)}l${n2(w * 0.16)} ${n2(-h * 0.38)}h${n2(-w * 0.1)}z" fill="${col}"/>`;
    }
    return out + c.label(w / 2, h + 12, p.kind === "jet" ? `Jet ${p.thrust} kN` : `${p.kind === "turbine" ? "Turbine" : "Engine"} ${p.hp} hp`, 11);
  },
});

part({
  type: "module",
  label: "Module",
  cat: "Crew & modules",
  size: [80, 50],
  internal: true,
  params: [select("kind", "What", [["transmission", "Transmission"], ["radiator", "Radiator"], ["breech", "Gun breech"], ["radio", "Radio"], ["battery", "Batteries"], ["nitro", "Nitro tank"], ["oil", "Oil tank"]], "transmission")],
  mass: () => 0.3,
  render(c, p) {
    const { w, h } = c;
    if (c.view === "normal" || c.armorView) return "";
    const cols = { transmission: "#a78bfa", radiator: "#38bdf8", breech: "#94a3b8", radio: "#60a5fa", battery: "#4ade80", nitro: "#22d3ee", oil: "#d97706" };
    const col = cols[p.kind] || "#a78bfa";
    let out = `<path d="${rrect(0, 0, w, h, 5)}" fill="${col}" fill-opacity=".16" stroke="${col}" stroke-width="1.3" vector-effect="non-scaling-stroke"/>`;
    if (p.kind === "transmission") {
      out += `<circle cx="${n2(w * 0.35)}" cy="${n2(h / 2)}" r="${n2(h * 0.3)}" fill="none" stroke="${col}" stroke-width="3" stroke-dasharray="3 2"/><circle cx="${n2(w * 0.68)}" cy="${n2(h / 2)}" r="${n2(h * 0.2)}" fill="none" stroke="${col}" stroke-width="3" stroke-dasharray="3 2"/>`;
    } else if (p.kind === "radiator") {
      for (let i = 1; i < 8; i++) out += `<path d="M${n2((w * i) / 8)} 3v${n2(h - 6)}" stroke="${col}" stroke-width="1.5"/>`;
    } else if (p.kind === "breech") {
      out += `<path d="${rrect(w * 0.1, h * 0.25, w * 0.8, h * 0.5, 3)}" fill="${col}" opacity=".6"/>`;
    } else if (p.kind === "nitro") {
      out += `<path d="${rrect(w * 0.1, h * 0.2, w * 0.8, h * 0.6, h * 0.3)}" fill="${col}" opacity=".55"/>`;
    }
    const names = { transmission: "Transmission", radiator: "Radiator", breech: "Breech", radio: "Radio", battery: "Batteries", nitro: "Nitro", oil: "Oil" };
    return out + c.label(w / 2, h + 12, names[p.kind] || "Module", 11);
  },
});

// --- Planes ---------------------------------------------------------------------

const FUSELAGE_STYLES = [
  ["inline", "Sleek inline-engine fighter"],
  ["radial", "Radial-engine fighter"],
  ["attacker", "Armoured attacker"],
  ["jet", "Jet (nose intake)"],
  ["bomber", "Bomber"],
  ["stubby", "Stubby racer"],
];

part({
  type: "fuselage",
  label: "Fuselage",
  cat: "Fuselage & wings",
  kinds: ["plane"],
  size: [880, 140],
  role: "fuselage",
  params: [
    select("style", "Style", FUSELAGE_STYLES, "inline"),
    range("tail", "Tail taper", 0.15, 0.6, 0.32, 0.01),
    range("hump", "Spine height", 0, 0.5, 0.18, 0.01),
    toggle("scoop", "Belly radiator scoop", false),
    toggle("panels", "Panel lines", true),
  ],
  mass: (p, part) => (part.w / 100) * (p.style === "bomber" ? 0.6 : p.style === "attacker" ? 0.32 : 0.11),
  render(c, p) {
    const { w, h } = c;
    const tailH = h * p.tail;
    const top = h * 0.08;
    const noseTop = p.style === "radial" || p.style === "stubby" ? h * 0.06 : p.style === "jet" ? h * 0.2 : h * 0.3;
    const noseBot = p.style === "radial" || p.style === "stubby" ? h * 0.94 : p.style === "jet" ? h * 0.8 : h * 0.78;
    const spine = top - h * p.hump * 0.4;
    // Facing right: nose at x = w, tail at x = 0.
    let d =
      `M${n2(w)} ${n2(noseTop)}` +
      `C${n2(w * 0.92)} ${n2(top)} ${n2(w * 0.78)} ${n2(spine)} ${n2(w * 0.62)} ${n2(spine)}` +
      `C${n2(w * 0.35)} ${n2(spine)} ${n2(w * 0.12)} ${n2(h * 0.18)} 0 ${n2(h * 0.4 - tailH / 2)}` +
      `L0 ${n2(h * 0.4 + tailH / 2)}` +
      `C${n2(w * 0.15)} ${n2(h * 0.78)} ${n2(w * 0.4)} ${n2(h)} ${n2(w * 0.62)} ${n2(h)}` +
      `C${n2(w * 0.8)} ${n2(h)} ${n2(w * 0.93)} ${n2(noseBot + h * 0.04)} ${n2(w)} ${n2(noseBot)}Z`;
    if (p.style === "jet") {
      // Open nose intake.
      d = d.replace(`M${n2(w)} ${n2(noseTop)}`, `M${n2(w - h * 0.06)} ${n2(noseTop)}`);
    }
    let out = c.shape(d, "paint", { round: false });
    if (p.style === "jet") out += c.shape(ellipsePath(w - h * 0.04, (noseTop + noseBot) / 2, h * 0.07, (noseBot - noseTop) / 2), "black", { shade: false });
    if (p.scoop) out += c.shape(`M${n2(w * 0.42)} ${n2(h * 0.97)}C${n2(w * 0.46)} ${n2(h * 1.28)} ${n2(w * 0.6)} ${n2(h * 1.28)} ${n2(w * 0.64)} ${n2(h * 0.98)}Z`, "paint");
    if (p.panels) {
      out += c.line(`M${n2(w * 0.3)} ${n2(h * 0.14)}C${n2(w * 0.3)} ${n2(h * 0.5)} ${n2(w * 0.3)} ${n2(h * 0.7)} ${n2(w * 0.3)} ${n2(h * 0.85)}M${n2(w * 0.5)} ${n2(spine + 4)}V${n2(h * 0.96)}M${n2(w * 0.8)} ${n2(h * 0.12)}V${n2(h * 0.94)}`, 0.22);
      out += c.line(`M${n2(w * 0.05)} ${n2(h * 0.45)}C${n2(w * 0.3)} ${n2(h * 0.52)} ${n2(w * 0.6)} ${n2(h * 0.55)} ${n2(w * 0.95)} ${n2(h * 0.52)}`, 0.15);
    }
    out += c.glint(`M${n2(w * 0.95)} ${n2(noseTop + 3)}C${n2(w * 0.8)} ${n2(top + 3)} ${n2(w * 0.4)} ${n2(spine + 4)} ${n2(w * 0.1)} ${n2(h * 0.24)}`, 0.35, 1.6);
    return out;
  },
});

part({
  type: "wing",
  label: "Wing",
  cat: "Fuselage & wings",
  kinds: ["plane"],
  size: [240, 34],
  role: "wing",
  params: [
    range("span", "Wingspan", 4, 45, 11.2, 0.1, "m"),
    select("plan", "Shape", [["elliptical", "Elliptical"], ["straight", "Straight / tapered"], ["swept", "Swept (jet)"], ["delta", "Delta"], ["gull", "Inverted gull"]], "elliptical"),
    select("profile", "Airfoil", [["classic", "Classic"], ["laminar", "Laminar flow"], ["thick", "Thick (bomber)"]], "classic"),
    toggle("far", "Show far wing", false),
  ],
  mass: (p, part) => p.span * (part.w / 100) * 0.78 * 0.034,
  render(c, p) {
    const { w, h } = c;
    let out = "";
    // The far wing peeks out above the fuselage line in a three-quarter hint.
    if (p.far && c.view === "normal") {
      const sweep = p.plan === "swept" || p.plan === "delta" ? w * 0.35 : w * 0.1;
      out += `<path d="M${n2(w * 0.08)} ${n2(h * 0.35)}L${n2(w * 0.12 - sweep)} ${n2(-h * 0.6)}L${n2(w * 0.55 - sweep)} ${n2(-h * 0.62)}L${n2(w * 0.95)} ${n2(h * 0.3)}Z" fill="${c.fill("paintDark")}" opacity=".55"/>`;
    }
    const t = p.profile === "laminar" ? 0.7 : p.profile === "thick" ? 1 : 0.85;
    const d =
      p.plan === "delta"
        ? poly([[0, h * 0.5], [w, h * 0.3], [w, h * 0.7]])
        : `M${n2(w)} ${n2(h * 0.5)}C${n2(w)} ${n2(h * (0.5 - 0.5 * t))} ${n2(w * 0.85)} ${n2(h * (0.5 - 0.5 * t))} ${n2(w * 0.7)} ${n2(h * (0.5 - 0.5 * t))}C${n2(w * 0.35)} ${n2(h * (0.52 - 0.35 * t))} ${n2(w * 0.1)} ${n2(h * 0.45)} 0 ${n2(h * 0.55)}C${n2(w * 0.25)} ${n2(h * (0.5 + 0.3 * t))} ${n2(w * 0.7)} ${n2(h * (0.5 + 0.45 * t))} ${n2(w * 0.85)} ${n2(h * (0.5 + 0.42 * t))}C${n2(w * 0.95)} ${n2(h * (0.5 + 0.38 * t))} ${n2(w)} ${n2(h * 0.6)} ${n2(w)} ${n2(h * 0.5)}Z`;
    out += c.shape(d, "paint", { round: true });
    if (c.view === "normal") out += `<path d="${d}" fill="rgba(255,255,255,.12)"/>`;
    out += c.glint(`M${n2(w * 0.98)} ${n2(h * 0.42)}C${n2(w * 0.9)} ${n2(h * (0.5 - 0.5 * t) + 1)} ${n2(w * 0.6)} ${n2(h * (0.5 - 0.5 * t) + 1)} ${n2(w * 0.35)} ${n2(h * 0.35)}`, 0.5, 1.5);
    out += c.line(`M${n2(w * 0.2)} ${n2(h * 0.5)}L${n2(w * 0.32)} ${n2(h * 0.52)}`, 0.4);
    return out;
  },
});

part({
  type: "stabilizer",
  label: "Tailplane",
  cat: "Fuselage & wings",
  kinds: ["plane"],
  size: [140, 20],
  role: "stab",
  params: [toggle("far", "Show far side", false)],
  mass: () => 0.05,
  render(c, p) {
    const { w, h } = c;
    let out = p.far && c.view === "normal" ? `<path d="M${n2(w * 0.1)} ${n2(h * 0.4)}L${n2(-w * 0.05)} ${n2(-h * 1.2)}L${n2(w * 0.45)} ${n2(-h * 1.2)}L${n2(w * 0.9)} ${n2(h * 0.4)}Z" fill="${c.fill("paintDark")}" opacity=".5"/>` : "";
    out += c.shape(`M0 ${n2(h * 0.5)}C${n2(w * 0.2)} 0 ${n2(w * 0.7)} 0 ${n2(w)} ${n2(h * 0.45)}C${n2(w * 0.7)} ${n2(h)} ${n2(w * 0.2)} ${n2(h)} 0 ${n2(h * 0.5)}Z`, "paint", { round: true });
    out += c.line(`M${n2(w * 0.35)} ${n2(h * 0.15)}V${n2(h * 0.85)}`, 0.35);
    return out;
  },
});

part({
  type: "fin",
  label: "Tail fin & rudder",
  cat: "Fuselage & wings",
  kinds: ["plane"],
  size: [130, 150],
  role: "fin",
  params: [select("style", "Shape", [["round", "Rounded (Spitfire)"], ["angular", "Angular (Bf 109)"], ["tall", "Tall with fillet (P-51)"], ["swept", "Swept (jet)"], ["twin", "Bomber"]], "round"), toggle("rudder", "Rudder line", true)],
  mass: () => 0.05,
  render(c, p) {
    const { w, h } = c;
    let d;
    switch (p.style) {
      case "angular":
        d = poly([[0, h], [w * 0.05, h * 0.15], [w * 0.4, 0], [w * 0.62, h * 0.08], [w, h]]);
        break;
      case "tall":
        d = `M0 ${n2(h)}L${n2(w * 0.08)} ${n2(h * 0.12)}Q${n2(w * 0.12)} 0 ${n2(w * 0.35)} 0L${n2(w * 0.45)} ${n2(h * 0.05)}Q${n2(w * 0.55)} ${n2(h * 0.6)} ${n2(w)} ${n2(h * 0.92)}L${n2(w)} ${n2(h)}Z`;
        break;
      case "swept":
        d = poly([[0, h], [w * 0.05, h * 0.05], [w * 0.32, 0], [w * 0.55, h * 0.15], [w, h]]);
        break;
      case "twin":
        d = rrect(0, 0, w * 0.7, h, w * 0.25);
        break;
      default:
        d = `M0 ${n2(h)}L0 ${n2(h * 0.4)}C0 ${n2(h * 0.05)} ${n2(w * 0.35)} 0 ${n2(w * 0.5)} ${n2(h * 0.12)}C${n2(w * 0.65)} ${n2(h * 0.3)} ${n2(w * 0.7)} ${n2(h * 0.7)} ${n2(w)} ${n2(h)}Z`;
    }
    let out = c.shape(d, "paint");
    if (p.rudder) out += c.line(`M${n2(w * 0.28)} ${n2(h * 0.1)}C${n2(w * 0.3)} ${n2(h * 0.5)} ${n2(w * 0.3)} ${n2(h * 0.8)} ${n2(w * 0.28)} ${n2(h)}`, 0.35);
    return out;
  },
});

part({
  type: "canopy",
  label: "Canopy",
  cat: "Fuselage & wings",
  kinds: ["plane", "car"],
  size: [170, 50],
  params: [select("style", "Style", [["bubble", "Bubble"], ["framed", "Framed"], ["razorback", "Razorback"], ["greenhouse", "Greenhouse"]], "bubble"), range("frames", "Frames", 0, 6, 1)],
  render(c, p) {
    const { w, h } = c;
    const d =
      p.style === "razorback"
        ? `M0 ${n2(h)}L${n2(w * 0.25)} ${n2(h * 0.1)}L${n2(w * 0.7)} 0C${n2(w * 0.9)} ${n2(h * 0.2)} ${n2(w)} ${n2(h * 0.6)} ${n2(w)} ${n2(h)}Z`
        : p.style === "greenhouse"
          ? rrect(0, 0, w, h * 1.2, h * 0.3)
          : p.style === "framed"
            ? `M0 ${n2(h)}C${n2(w * 0.05)} ${n2(h * 0.3)} ${n2(w * 0.3)} 0 ${n2(w * 0.55)} 0L${n2(w * 0.75)} ${n2(h * 0.05)}L${n2(w)} ${n2(h)}Z`
            : `M0 ${n2(h)}C0 ${n2(h * 0.2)} ${n2(w * 0.3)} 0 ${n2(w * 0.55)} 0C${n2(w * 0.85)} 0 ${n2(w)} ${n2(h * 0.4)} ${n2(w)} ${n2(h)}Z`;
    let out = c.shape(d, "glass", { outline: true, opacity: c.view === "normal" ? 0.7 : undefined });
    for (let i = 1; i <= p.frames; i++) out += c.line(`M${n2((w * i) / (p.frames + 1))} ${n2(h * 0.08)}L${n2((w * i) / (p.frames + 1) + w * 0.03)} ${n2(h)}`, 0.7, 1.6);
    out += c.glint(`M${n2(w * 0.15)} ${n2(h * 0.55)}C${n2(w * 0.25)} ${n2(h * 0.2)} ${n2(w * 0.45)} ${n2(h * 0.12)} ${n2(w * 0.6)} ${n2(h * 0.12)}`, 0.6, 2);
    return out;
  },
});

part({
  type: "cowling",
  label: "Engine cowling",
  cat: "Engine & prop",
  kinds: ["plane"],
  size: [110, 130],
  params: [select("style", "Style", [["radial", "Radial (round)"], ["inline", "Inline (pointed)"]], "radial"), toggle("flaps", "Cooling gills", true), color("ring", "Nose ring colour", "#000000"), toggle("ringOn", "Painted nose ring", false)],
  mass: () => 0.08,
  render(c, p) {
    const { w, h } = c;
    let out;
    if (p.style === "radial") {
      out = c.shape(`M0 ${n2(h * 0.05)}C${n2(w * 0.6)} 0 ${n2(w)} ${n2(h * 0.12)} ${n2(w)} ${n2(h * 0.5)}C${n2(w)} ${n2(h * 0.88)} ${n2(w * 0.6)} ${n2(h)} 0 ${n2(h * 0.95)}Z`, "paint", { round: true });
      if (p.ringOn) out += c.shape(`M${n2(w * 0.72)} ${n2(h * 0.07)}C${n2(w)} ${n2(h * 0.15)} ${n2(w)} ${n2(h * 0.85)} ${n2(w * 0.72)} ${n2(h * 0.93)}Z`, p.ring);
      if (p.flaps) for (let i = 0; i < 5; i++) out += c.line(`M${n2(w * 0.08)} ${n2(h * (0.15 + i * 0.17))}l${n2(-w * 0.06)} ${n2(h * 0.04)}`, 0.5, 1.4);
    } else {
      out = c.shape(`M0 0C${n2(w * 0.5)} 0 ${n2(w)} ${n2(h * 0.3)} ${n2(w)} ${n2(h * 0.5)}C${n2(w)} ${n2(h * 0.7)} ${n2(w * 0.5)} ${n2(h)} 0 ${n2(h)}Z`, "paint", { round: true });
      out += c.line(`M${n2(w * 0.3)} ${n2(h * 0.08)}V${n2(h * 0.92)}`, 0.25);
    }
    return out;
  },
});

part({
  type: "propeller",
  label: "Propeller & spinner",
  cat: "Engine & prop",
  kinds: ["plane"],
  size: [60, 330],
  role: "prop",
  anims: ["spin"],
  internalAnims: ["spin"],
  pivot: [0.6, 0.5],
  params: [range("blades", "Blades", 2, 6, 3), range("diameter", "Diameter", 1.5, 5, 3.3, 0.1, "m"), color("spinner", "Spinner colour", "#2a2d31"), color("tips", "Blade tips", "#f2c230"), select("spinStyle", "Spinner", [["pointed", "Pointed"], ["round", "Round"], ["spiral", "Spiral (Luftwaffe)"]], "pointed")],
  mass: (p) => 0.06 * p.blades,
  render(c, p) {
    const { w, h } = c;
    const cx = w * 0.6;
    const cy = h / 2;
    const spinning = c.anim === "spin";
    let out = "";
    // Blades are seen edge-on: each is a stripe whose length follows the sine of its angle.
    const blade = (len, up) => {
      const y1 = up ? cy - len : cy;
      const tip = h * 0.06;
      if (c.xray || c.armorView) return `<path d="${rrect(cx - w * 0.07, y1, w * 0.14, len, w * 0.07)}" fill="${c.xray ? XR_FILL : "rgba(58,63,75,.55)"}" stroke="${c.xray ? XR_STROKE : "none"}" vector-effect="non-scaling-stroke"/>`;
      return `<path d="${rrect(cx - w * 0.08, y1, w * 0.16, len, w * 0.08)}" fill="#2a2d31"/><path d="${rrect(cx - w * 0.08, up ? y1 : cy + len - tip, w * 0.16, tip, w * 0.06)}" fill="${p.tips}"/>`;
    };
    if (spinning && c.view === "normal") {
      out += `<ellipse cx="${n2(cx)}" cy="${n2(cy)}" rx="${n2(w * 0.32)}" ry="${n2(h / 2)}" fill="url(#${c.pid}-prop)"/>`;
      const per = c.dur(0.09);
      // Each blade pair shrinks and grows like it would turning edge-on.
      const shown = Math.min(p.blades, 3);
      for (let i = 0; i < shown; i++) {
        out += `<g opacity=".5" transform="translate(0 ${n2(cy)})"><g><animateTransform attributeName="transform" type="scale" values="1 1;1 0.04;1 1" dur="${per}" begin="${n2(-(i * 0.09) / shown)}s" repeatCount="indefinite"/><g transform="translate(0 ${n2(-cy)})">${blade(h / 2, true)}${blade(h / 2, false)}</g></g></g>`;
      }
    } else {
      for (let i = 0; i < p.blades; i++) {
        const a = (i / p.blades) * Math.PI * 2 + 0.4;
        const len = Math.abs(Math.sin(a)) * (h / 2);
        if (len > h * 0.04) out += blade(len, Math.sin(a) > 0);
      }
    }
    const sd =
      p.spinStyle === "round"
        ? `M0 ${n2(cy - h * 0.09)}C${n2(w * 0.9)} ${n2(cy - h * 0.1)} ${n2(w * 0.9)} ${n2(cy + h * 0.1)} 0 ${n2(cy + h * 0.09)}Z`
        : `M0 ${n2(cy - h * 0.085)}C${n2(w * 0.5)} ${n2(cy - h * 0.08)} ${n2(w)} ${n2(cy - h * 0.01)} ${n2(w)} ${n2(cy)}C${n2(w)} ${n2(cy + h * 0.01)} ${n2(w * 0.5)} ${n2(cy + h * 0.08)} 0 ${n2(cy + h * 0.085)}Z`;
    out += c.shape(sd, p.spinner, { round: true });
    if (p.spinStyle === "spiral" && c.view === "normal") {
      out += `<path d="M${n2(w * 0.1)} ${n2(cy - h * 0.07)}C${n2(w * 0.5)} ${n2(cy - h * 0.06)} ${n2(w * 0.4)} ${n2(cy + h * 0.06)} ${n2(w * 0.85)} ${n2(cy)}" fill="none" stroke="#fff" stroke-width="${n2(w * 0.08)}"/>`;
    }
    return out;
  },
});

part({
  type: "gear",
  label: "Landing gear",
  cat: "Fuselage & wings",
  kinds: ["plane"],
  size: [70, 120],
  role: "gear",
  anims: ["spin"],
  params: [select("kind", "Type", [["main", "Main gear"], ["tail", "Tail wheel"], ["nose", "Nose wheel"], ["fixed", "Fixed with spats"]], "main"), toggle("up", "Retracted (in flight)", false)],
  mass: () => 0.12,
  render(c, p) {
    const { w, h } = c;
    if (p.up) return c.view === "normal" ? "" : c.line(rrect(0, 0, w, h * 0.3, 4), 0.4);
    const r = p.kind === "tail" ? w * 0.28 : w * 0.45;
    const cx = w / 2;
    const cy = h - r;
    let out = "";
    if (p.kind === "fixed") {
      out += c.shape(rrect(cx - w * 0.12, 0, w * 0.24, h * 0.6, 4), "paint");
      out += wheel(c, cx, cy, r, "solid");
      out += c.shape(`M${n2(cx - r * 1.2)} ${n2(cy)}C${n2(cx - r * 1.2)} ${n2(cy - r * 1.5)} ${n2(cx + r * 1.2)} ${n2(cy - r * 1.5)} ${n2(cx + r * 1.2)} ${n2(cy)}C${n2(cx + r)} ${n2(cy + r * 0.8)} ${n2(cx - r)} ${n2(cy + r * 0.8)} ${n2(cx - r * 1.2)} ${n2(cy)}Z`, "paint");
      return out;
    }
    out += c.shape(rrect(cx - w * 0.06, 0, w * 0.12, cy, 2), "steel");
    if (p.kind === "main") out += c.shape(poly([[cx + w * 0.06, h * 0.05], [cx + w * 0.5, h * 0.12], [cx + w * 0.5, cy * 0.7], [cx + w * 0.06, cy * 0.8]]), "paint");
    out += wheel(c, cx, cy, r, "sport", c.anim === "spin" ? c.dur(0.6) : null);
    return out;
  },
});

part({
  type: "pgun",
  label: "Aircraft guns",
  cat: "Weapons",
  kinds: ["plane"],
  size: [120, 16],
  role: "pgun",
  anims: ["flicker"],
  internalAnims: ["flicker"],
  params: [range("caliber", "Calibre", 7, 37, 20, 0.1, "mm"), range("count", "Number of guns", 1, 8, 2), select("place", "Where", [["wing", "In the wings"], ["nose", "In the nose / cowling"], ["pod", "Gun pod"]], "wing")],
  mass: (p) => p.count * (p.caliber * p.caliber * 0.00011 + 0.01),
  render(c, p) {
    const { w, h } = c;
    const r = clamp(p.caliber / 18, 1.2, h * 0.4);
    let out = "";
    if (p.place === "pod") out += c.shape(rrect(0, h * 0.1, w * 0.7, h * 0.8, h * 0.4), "paint", { round: true });
    out += barrel(c, w * 0.15, w, h / 2, r, 0.95);
    if (c.anim === "flicker" && c.view === "normal") out += `<g><path d="M${n2(w)} ${n2(h / 2)}l${n2(h * 1.4)} ${n2(-h * 0.6)}l${n2(-h * 0.4)} ${n2(h * 0.6)}l${n2(h * 0.4)} ${n2(h * 0.6)}Z" fill="url(#${c.pid}-flame)"/><animate attributeName="opacity" values="1;0;1;0" dur="${c.dur(0.16)}" repeatCount="indefinite"/></g>`;
    return out;
  },
});

part({
  type: "bomb",
  label: "Bomb",
  cat: "Weapons",
  kinds: ["plane"],
  size: [120, 30],
  role: "bomb",
  params: [range("kg", "Weight", 25, 2000, 250, 25, "kg"), color("band", "Nose band", "#f2c230")],
  mass: (p) => p.kg / 1000,
  render(c, p) {
    const { w, h } = c;
    let out = c.shape(`M${n2(w * 0.18)} ${n2(h * 0.1)}C${n2(w * 0.7)} 0 ${n2(w)} ${n2(h * 0.3)} ${n2(w)} ${n2(h / 2)}C${n2(w)} ${n2(h * 0.7)} ${n2(w * 0.7)} ${n2(h)} ${n2(w * 0.18)} ${n2(h * 0.9)}Z`, "#3d4a32", { round: true });
    out += c.shape(poly([[0, 0], [w * 0.22, h * 0.25], [w * 0.22, h * 0.75], [0, h]]), "#3d4a32");
    out += c.shape(rrect(w * 0.8, h * 0.2, w * 0.05, h * 0.6, 1), p.band, { shade: false });
    return out;
  },
});

part({
  type: "rocket",
  label: "Rockets",
  cat: "Weapons",
  kinds: ["plane", "tank"],
  size: [150, 18],
  role: "rocket",
  params: [range("count", "Rockets", 1, 16, 4), select("style", "Type", [["rail", "On rails"], ["pod", "Rocket pod"]], "rail")],
  mass: (p) => p.count * 0.03,
  render(c, p) {
    const { w, h } = c;
    if (p.style === "pod") return c.shape(rrect(0, 0, w, h, h / 2), "paint", { round: true }) + c.shape(ellipsePath(w - 2, h / 2, 3, h * 0.42), "black", { shade: false });
    return c.shape(rrect(0, h * 0.65, w * 0.8, h * 0.18, 1), "steel") + c.shape(`M${n2(w * 0.1)} ${n2(h * 0.15)}H${n2(w * 0.85)}Q${n2(w)} ${n2(h * 0.35)} ${n2(w * 0.85)} ${n2(h * 0.55)}H${n2(w * 0.1)}Z`, "#4a5a3a", { round: true }) + c.shape(poly([[0, 0], [w * 0.12, h * 0.15], [w * 0.12, h * 0.55], [0, h * 0.7]]), "dark");
  },
});

part({
  type: "droptank",
  label: "Drop tank",
  cat: "Weapons",
  kinds: ["plane"],
  size: [180, 36],
  role: "droptank",
  params: [range("liters", "Fuel", 50, 1500, 300, 10, "L")],
  mass: (p) => p.liters * 0.00075 + 0.03,
  render(c) {
    const { w, h } = c;
    return c.shape(`M0 ${n2(h / 2)}C${n2(w * 0.1)} 0 ${n2(w * 0.7)} 0 ${n2(w)} ${n2(h / 2)}C${n2(w * 0.7)} ${n2(h)} ${n2(w * 0.1)} ${n2(h)} 0 ${n2(h / 2)}Z`, "metal", { round: true }) + c.shape(rrect(w * 0.35, -h * 0.3, w * 0.25, h * 0.32, 2), "steel");
  },
});

part({
  type: "nozzle",
  label: "Jet nozzle",
  cat: "Engine & prop",
  kinds: ["plane"],
  size: [70, 56],
  anims: ["flicker"],
  internalAnims: ["flicker"],
  params: [toggle("afterburner", "Afterburner flame", true)],
  render(c, p) {
    const { w, h } = c;
    let out = "";
    if (c.anim === "flicker" && p.afterburner && c.view === "normal") {
      out += `<g><path d="M${n2(w * 0.1)} ${n2(h * 0.18)}L${n2(-w * 2.2)} ${n2(h / 2)}L${n2(w * 0.1)} ${n2(h * 0.82)}Z" fill="url(#${c.pid}-burner)"/><animateTransform attributeName="transform" type="scale" values="1 1;1.08 0.92;0.95 1.05;1 1" dur="${c.dur(0.2)}" repeatCount="indefinite" additive="sum"/><animate attributeName="opacity" values="1;.75;1" dur="${c.dur(0.12)}" repeatCount="indefinite"/></g>`;
    }
    out += c.shape(poly([[0, h * 0.15], [w, 0], [w, h], [0, h * 0.85]]), "steel", { round: true });
    out += c.shape(ellipsePath(w * 0.05, h / 2, w * 0.08, h * 0.35), "black", { shade: false });
    return out;
  },
});

part({
  type: "scoop",
  label: "Radiator / air scoop",
  cat: "Engine & prop",
  kinds: ["plane", "car"],
  size: [120, 30],
  params: [],
  render(c) {
    const { w, h } = c;
    return c.shape(`M0 0H${n2(w * 0.6)}C${n2(w * 0.85)} 0 ${n2(w)} ${n2(h * 0.4)} ${n2(w)} ${n2(h)}H${n2(w * 0.15)}Q0 ${n2(h)} 0 ${n2(h * 0.6)}Z`, "paint", { round: true }) + c.shape(rrect(w * 0.85, h * 0.3, w * 0.12, h * 0.65, 2), "black", { shade: false });
  },
});

part({
  type: "mast",
  label: "Antenna mast",
  cat: "Details",
  kinds: ["plane"],
  size: [26, 50],
  params: [toggle("wire", "Antenna wire to tail", false), range("wireLen", "Wire length", 50, 600, 300)],
  render(c, p) {
    const { w, h } = c;
    let out = c.shape(poly([[w * 0.2, h], [w * 0.5, 0], [w * 0.8, 0], [w * 0.95, h]]), "paint");
    if (p.wire && c.view === "normal") out += `<path d="M${n2(w * 0.55)} 2L${n2(-p.wireLen)} ${n2(h * 0.2)}" stroke="#222" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
    return out;
  },
});

part({
  type: "pitot",
  label: "Pitot tube",
  cat: "Details",
  kinds: ["plane"],
  size: [60, 6],
  render(c) {
    return barrel(c, 0, c.w, c.h / 2, c.h * 0.35, 0.6);
  },
});

part({
  type: "plate",
  label: "Armour plate",
  cat: "Hull & turret",
  size: [80, 60],
  role: "plate",
  params: [armor("armor", "Thickness", 20, 800), slope("slope", "Angle", 0), toggle("both", "Both sides", true), range("width", "Depth (into the screen)", 0, 4, 0, 0.1, "m")],
  mass: (p, part) => steelT((part.w * part.h) / 1e4 * (p.both ? 2 : 1), p.armor) + steelT((part.h / 100) * p.width, p.armor),
  render(c, p) {
    const { w, h } = c;
    return c.plate("main", rrect(0, 0, w, h, 2), p.armor, p.slope, "Plate", w / 2, h / 2) + c.bolts([[5, 5], [w - 5, 5], [5, h - 5], [w - 5, h - 5]], 1.8);
  },
});

// --- Cars ------------------------------------------------------------------------

const CAR_STYLES = [
  ["sports", "Sports coupé"],
  ["super", "Supercar"],
  ["muscle", "Muscle car"],
  ["sedan", "Saloon"],
  ["hatch", "Hatchback"],
  ["rally", "Rally car"],
  ["jeep", "Military jeep"],
  ["pickup", "Pickup truck"],
  ["truck", "Army truck"],
  ["f1", "Open-wheel racer"],
];

/** Car body outline (facing right) for a style, in a w × h box. Returns { d, glass }. */
function carShape(style, w, h) {
  switch (style) {
    case "super":
      return {
        d: `M0 ${n2(h * 0.62)}C0 ${n2(h * 0.45)} ${n2(w * 0.08)} ${n2(h * 0.4)} ${n2(w * 0.2)} ${n2(h * 0.36)}C${n2(w * 0.35)} ${n2(h * 0.08)} ${n2(w * 0.55)} ${n2(h * 0.04)} ${n2(w * 0.68)} ${n2(h * 0.3)}C${n2(w * 0.8)} ${n2(h * 0.42)} ${n2(w)} ${n2(h * 0.5)} ${n2(w)} ${n2(h * 0.72)}L${n2(w * 0.98)} ${n2(h * 0.85)}H${n2(w * 0.02)}Z`,
        glass: `M${n2(w * 0.3)} ${n2(h * 0.3)}C${n2(w * 0.4)} ${n2(h * 0.13)} ${n2(w * 0.53)} ${n2(h * 0.12)} ${n2(w * 0.63)} ${n2(h * 0.32)}Z`,
      };
    case "muscle":
      return {
        d: poly([[0, h * 0.42], [w * 0.22, h * 0.36], [w * 0.32, h * 0.12], [w * 0.6, h * 0.1], [w * 0.7, h * 0.36], [w, h * 0.42], [w, h * 0.82], [0, h * 0.82]]),
        glass: poly([[w * 0.35, h * 0.17], [w * 0.58, h * 0.15], [w * 0.66, h * 0.35], [w * 0.3, h * 0.36]]),
      };
    case "sedan":
      return {
        d: `M0 ${n2(h * 0.45)}L${n2(w * 0.2)} ${n2(h * 0.38)}L${n2(w * 0.32)} ${n2(h * 0.08)}H${n2(w * 0.64)}L${n2(w * 0.76)} ${n2(h * 0.38)}L${n2(w)} ${n2(h * 0.45)}V${n2(h * 0.8)}Q${n2(w)} ${n2(h * 0.86)} ${n2(w * 0.97)} ${n2(h * 0.86)}H${n2(w * 0.03)}Q0 ${n2(h * 0.86)} 0 ${n2(h * 0.8)}Z`,
        glass: poly([[w * 0.35, h * 0.14], [w * 0.62, h * 0.14], [w * 0.72, h * 0.36], [w * 0.26, h * 0.36]]),
      };
    case "hatch":
      return {
        d: `M0 ${n2(h * 0.2)}Q${n2(w * 0.02)} ${n2(h * 0.08)} ${n2(w * 0.15)} ${n2(h * 0.06)}H${n2(w * 0.55)}L${n2(w * 0.75)} ${n2(h * 0.38)}L${n2(w)} ${n2(h * 0.46)}V${n2(h * 0.84)}H0Z`,
        glass: poly([[w * 0.12, h * 0.12], [w * 0.53, h * 0.12], [w * 0.7, h * 0.36], [w * 0.1, h * 0.36]]),
      };
    case "rally":
      return {
        d: `M0 ${n2(h * 0.3)}Q${n2(w * 0.04)} ${n2(h * 0.12)} ${n2(w * 0.2)} ${n2(h * 0.1)}H${n2(w * 0.58)}L${n2(w * 0.76)} ${n2(h * 0.38)}L${n2(w)} ${n2(h * 0.46)}V${n2(h * 0.8)}H0Z`,
        glass: poly([[w * 0.22, h * 0.16], [w * 0.56, h * 0.16], [w * 0.7, h * 0.37], [w * 0.2, h * 0.37]]),
      };
    case "jeep":
      return {
        d: poly([[0, h * 0.35], [w * 0.62, h * 0.35], [w * 0.66, h * 0.08], [w * 0.69, h * 0.08], [w * 0.7, h * 0.35], [w, h * 0.4], [w, h * 0.78], [w * 0.92, h * 0.78], [w * 0.92, h * 0.6], [w * 0.68, h * 0.6], [w * 0.68, h * 0.78], [w * 0.32, h * 0.78], [w * 0.32, h * 0.6], [w * 0.08, h * 0.6], [w * 0.08, h * 0.78], [0, h * 0.78]]),
        glass: rrect(w * 0.655, h * 0.1, w * 0.03, h * 0.22, 1),
      };
    case "pickup":
      return {
        d: poly([[0, h * 0.4], [w * 0.4, h * 0.4], [w * 0.45, h * 0.06], [w * 0.68, h * 0.06], [w * 0.78, h * 0.38], [w, h * 0.44], [w, h * 0.82], [0, h * 0.82]]),
        glass: poly([[w * 0.48, h * 0.12], [w * 0.66, h * 0.12], [w * 0.74, h * 0.36], [w * 0.46, h * 0.36]]),
      };
    case "truck":
      return {
        d: poly([[0, h * 0.12], [w * 0.62, h * 0.12], [w * 0.62, h * 0.3], [w * 0.7, h * 0.02], [w * 0.86, h * 0.02], [w * 0.88, h * 0.4], [w, h * 0.45], [w, h * 0.8], [0, h * 0.8]]),
        glass: poly([[w * 0.72, h * 0.08], [w * 0.84, h * 0.08], [w * 0.855, h * 0.36], [w * 0.7, h * 0.36]]),
      };
    case "f1":
      return {
        d: `M0 ${n2(h * 0.35)}H${n2(w * 0.12)}V${n2(h * 0.55)}H${n2(w * 0.35)}C${n2(w * 0.42)} ${n2(h * 0.3)} ${n2(w * 0.5)} ${n2(h * 0.3)} ${n2(w * 0.56)} ${n2(h * 0.52)}L${n2(w)} ${n2(h * 0.66)}V${n2(h * 0.76)}H0Z`,
        glass: "",
      };
    default:
      return {
        d: `M0 ${n2(h * 0.55)}C0 ${n2(h * 0.38)} ${n2(w * 0.1)} ${n2(h * 0.36)} ${n2(w * 0.24)} ${n2(h * 0.33)}C${n2(w * 0.36)} ${n2(h * 0.08)} ${n2(w * 0.58)} ${n2(h * 0.06)} ${n2(w * 0.7)} ${n2(h * 0.32)}C${n2(w * 0.85)} ${n2(h * 0.38)} ${n2(w)} ${n2(h * 0.44)} ${n2(w)} ${n2(h * 0.62)}V${n2(h * 0.8)}H0Z`,
        glass: `M${n2(w * 0.32)} ${n2(h * 0.32)}C${n2(w * 0.4)} ${n2(h * 0.14)} ${n2(w * 0.56)} ${n2(h * 0.13)} ${n2(w * 0.65)} ${n2(h * 0.33)}Z`,
      };
  }
}

part({
  type: "carbody",
  label: "Car body",
  cat: "Car body",
  kinds: ["car"],
  size: [460, 150],
  role: "body",
  params: [
    select("style", "Style", CAR_STYLES, "sports"),
    range("wheelbase", "Wheel arches at", 0.12, 0.3, 0.18, 0.01),
    range("arch", "Arch size", 0.15, 0.4, 0.24, 0.01),
    toggle("doors", "Door lines", true),
    toggle("handles", "Handles & mirrors", true),
  ],
  mass: (p, part) => (part.w / 100) * (p.style === "truck" ? 1.1 : p.style === "f1" ? 0.12 : p.style === "jeep" ? 0.25 : 0.27),
  render(c, p) {
    const { w, h } = c;
    const s = carShape(p.style, w, h);
    let out = c.shape(s.d, "paint");
    // Wheel arches cut darkness into the body.
    const ar = h * p.arch;
    for (const x of [w * p.wheelbase, w * (1 - p.wheelbase)]) {
      out += c.shape(`M${n2(x - ar)} ${n2(h * 0.86)}A${n2(ar)} ${n2(ar)} 0 0 1 ${n2(x + ar)} ${n2(h * 0.86)}Z`, "black", { shade: false, outline: false });
    }
    if (s.glass) out += c.shape(s.glass, "glass");
    if (p.doors && p.style !== "f1") {
      out += c.line(`M${n2(w * 0.36)} ${n2(h * 0.38)}V${n2(h * 0.78)}M${n2(w * 0.6)} ${n2(h * 0.38)}V${n2(h * 0.78)}`, 0.35);
      out += c.line(`M${n2(w * 0.02)} ${n2(h * 0.6)}H${n2(w * 0.98)}`, 0.15);
    }
    if (p.handles && p.style !== "f1") {
      out += c.shape(rrect(w * 0.52, h * 0.45, w * 0.05, h * 0.03, 2), "chrome", { shade: false });
      out += c.shape(rrect(w * 0.66, h * 0.33, w * 0.04, h * 0.05, 3), "paintDark");
    }
    out += c.glint(`M${n2(w * 0.05)} ${n2(h * 0.47)}C${n2(w * 0.3)} ${n2(h * 0.42)} ${n2(w * 0.7)} ${n2(h * 0.42)} ${n2(w * 0.95)} ${n2(h * 0.5)}`, 0.4, 1.6);
    return out;
  },
});

part({
  type: "carwheel",
  label: "Wheel",
  cat: "Wheels",
  kinds: ["car", "any"],
  size: [72, 72],
  role: "carwheel",
  anims: ["spin", "bob"],
  params: [select("rim", "Rim", [["sport", "5-spoke"], ["multi", "Multi-spoke"], ["steel", "Steel"], ["offroad", "Off-road"], ["chrome", "Chrome dish"], ["solid", "Painted"]], "sport"), range("tyre", "Tyre width", 15, 40, 24, 1, "cm")],
  mass: () => 0.025,
  render(c, p) {
    const r = Math.min(c.w, c.h) / 2;
    return wheel(c, c.w / 2, c.h / 2, r, p.rim);
  },
});

part({
  type: "spoiler",
  label: "Spoiler / wing",
  cat: "Car body",
  kinds: ["car"],
  size: [90, 40],
  role: "spoiler",
  params: [select("style", "Style", [["wing", "Big wing"], ["lip", "Lip"], ["ducktail", "Duck tail"]], "wing")],
  mass: () => 0.02,
  render(c, p) {
    const { w, h } = c;
    if (p.style === "lip") return c.shape(poly([[0, h * 0.6], [w, h * 0.4], [w, h], [0, h]]), "paintDark");
    if (p.style === "ducktail") return c.shape(`M0 ${n2(h)}Q${n2(w * 0.6)} ${n2(h * 0.6)} ${n2(w)} 0V${n2(h)}Z`, "paint");
    return c.shape(rrect(0, 0, w, h * 0.22, h * 0.1), "paintDark") + c.shape(rrect(w * 0.2, h * 0.2, w * 0.08, h * 0.8, 2), "dark") + c.shape(rrect(w * 0.7, h * 0.2, w * 0.08, h * 0.8, 2), "dark") + c.shape(rrect(-2, -h * 0.05, w * 0.06, h * 0.35, 2), "dark");
  },
});

part({
  type: "bumper",
  label: "Bumper / bull bar",
  cat: "Car body",
  kinds: ["car"],
  size: [40, 40],
  params: [select("style", "Style", [["bumper", "Bumper"], ["bullbar", "Bull bar"], ["splitter", "Splitter"]], "bumper")],
  render(c, p) {
    const { w, h } = c;
    if (p.style === "bullbar") return c.shape(rrect(0, 0, w * 0.25, h, 4), "dark") + c.shape(rrect(0, h * 0.2, w, h * 0.12, 3), "dark") + c.shape(rrect(0, h * 0.62, w, h * 0.12, 3), "dark");
    if (p.style === "splitter") return c.shape(poly([[0, h * 0.7], [w, h * 0.85], [w, h], [0, h]]), "black");
    return c.shape(rrect(0, h * 0.2, w, h * 0.6, h * 0.25), "black");
  },
});

// --- Generic shapes (build anything) ---------------------------------------------

const SHAPE_KINDS = [
  ["box", "Box"],
  ["rounded", "Rounded box"],
  ["ellipse", "Ellipse"],
  ["triangle", "Triangle"],
  ["trapezoid", "Trapezoid"],
  ["wedge", "Wedge"],
  ["hexagon", "Hexagon"],
  ["tube", "Tube"],
  ["star", "Star"],
  ["diamond", "Diamond"],
];

function genericPath(kind, w, h, r) {
  switch (kind) {
    case "rounded":
      return rrect(0, 0, w, h, Math.min(w, h) * r);
    case "ellipse":
      return ellipsePath(w / 2, h / 2, w / 2, h / 2);
    case "triangle":
      return poly([[0, h], [w / 2, 0], [w, h]]);
    case "trapezoid":
      return poly([[0, h], [w * r, 0], [w * (1 - r), 0], [w, h]]);
    case "wedge":
      return poly([[0, 0], [w, h * r], [w, h], [0, h]]);
    case "hexagon":
      return poly([[w * 0.25, 0], [w * 0.75, 0], [w, h / 2], [w * 0.75, h], [w * 0.25, h], [0, h / 2]]);
    case "tube":
      return rrect(0, 0, w, h, h / 2);
    case "diamond":
      return poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]);
    case "star": {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? 0.4 : 1;
        pts.push([w / 2 + Math.cos(a) * (w / 2) * rr, h / 2 + Math.sin(a) * (h / 2) * rr]);
      }
      return poly(pts);
    }
    default:
      return rrect(0, 0, w, h, 0);
  }
}

part({
  type: "shape",
  label: "Shape",
  cat: "Shapes",
  size: [100, 60],
  anims: ["spin", "swing", "bob", "slide", "pulse", "flicker", "blink"],
  params: [select("shape", "Shape", SHAPE_KINDS, "box"), range("round", "Roundness / slant", 0, 0.5, 0.2, 0.01), select("material", "Material", [["paint", "Vehicle paint"], ["paintDark", "Dark paint"], ["steel", "Steel"], ["metal", "Bare metal"], ["rubber", "Rubber"], ["glass", "Glass"], ["chrome", "Chrome"], ["wood", "Wood"], ["canvas", "Canvas"], ["light", "Light"]], "paint"), armor("armor", "Armour (0 = none)", 0, 600), range("weight", "Weight", 0, 20, 0, 0.05, "t")],
  mass: (p, part) => p.weight + (p.armor ? steelT((part.w * part.h) / 1e4, p.armor) : 0),
  render(c, p) {
    const d = genericPath(p.shape, c.w, c.h, p.round);
    if (p.armor > 0) return c.plate("main", d, p.armor, 0, "Plate", c.w / 2, c.h / 2);
    return c.shape(d, p.material, { round: p.shape === "ellipse" || p.shape === "tube" });
  },
});

part({
  type: "wheelgen",
  label: "Wheel (generic)",
  cat: "Shapes",
  size: [60, 60],
  anims: ["spin", "bob"],
  params: [select("style", "Style", [["solid", "Steel"], ["spoked", "Spoked"], ["sport", "Sport"], ["offroad", "Off-road"], ["christie", "Rubber-rimmed"]], "spoked")],
  render(c, p) {
    return wheel(c, c.w / 2, c.h / 2, Math.min(c.w, c.h) / 2, p.style);
  },
});

// --- Decals ---------------------------------------------------------------------------

/** National markings. Historic ones are simplified; no swastikas, ever. */
function insignia(c, style, w, h, nation) {
  const s = style === "auto" ? { usa: "usstar", germany: "cross", ussr: "redstar", uk: "roundel", japan: "hinomaru", italy: "roundel-it", france: "roundel-fr", sweden: "crowns", aura: "aura" }[nation] || "star" : style;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2;
  const star = (x, y, rr, fill) => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const k = i % 2 ? 0.38 : 1;
      pts.push([x + Math.cos(a) * rr * k, y + Math.sin(a) * rr * k]);
    }
    return `<path d="${poly(pts)}" fill="${fill}"/>`;
  };
  switch (s) {
    case "usstar":
      return `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r * 0.62)}" fill="#1f3a68"/>${w > h * 1.6 ? `<rect x="${n2(cx - r * 1.5)}" y="${n2(cy - r * 0.22)}" width="${n2(r * 3)}" height="${n2(r * 0.44)}" fill="#fff"/><rect x="${n2(cx - r * 1.5)}" y="${n2(cy - r * 0.08)}" width="${n2(r * 3)}" height="${n2(r * 0.16)}" fill="#b22234"/>` : ""}<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r * 0.62)}" fill="#1f3a68"/>${star(cx, cy, r * 0.6, "#fff")}`;
    case "cross":
      return `<path d="M${n2(cx - r * 0.2)} ${n2(cy - r)}h${n2(r * 0.4)}v${n2(r * 0.8)}h${n2(r * 0.8)}v${n2(r * 0.4)}h${n2(-r * 0.8)}v${n2(r * 0.8)}h${n2(-r * 0.4)}v${n2(-r * 0.8)}h${n2(-r * 0.8)}v${n2(-r * 0.4)}h${n2(r * 0.8)}Z" fill="#fff"/><path d="M${n2(cx - r * 0.1)} ${n2(cy - r * 0.9)}h${n2(r * 0.2)}v${n2(r * 0.8)}h${n2(r * 0.8)}v${n2(r * 0.2)}h${n2(-r * 0.8)}v${n2(r * 0.8)}h${n2(-r * 0.2)}v${n2(-r * 0.8)}h${n2(-r * 0.8)}v${n2(-r * 0.2)}h${n2(r * 0.8)}Z" fill="#111"/>`;
    case "redstar":
      return star(cx, cy, r, "#fff") + star(cx, cy, r * 0.82, "#c8102e");
    case "roundel":
      return `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" fill="#f2c230"/><circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r * 0.85)}" fill="#1f3a68"/><circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r * 0.6)}" fill="#fff"/><circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r * 0.35)}" fill="#c8102e"/>`;
    case "roundel-fr":
      return `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" fill="#c8102e"/><circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r * 0.66)}" fill="#fff"/><circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r * 0.33)}" fill="#1f3a8a"/>`;
    case "roundel-it":
      return `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" fill="#c8102e"/><circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r * 0.66)}" fill="#fff"/><circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r * 0.33)}" fill="#0f7a3a"/>`;
    case "hinomaru":
      return `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" fill="#fff"/><circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r * 0.84)}" fill="#bc002d"/>`;
    case "crowns":
      return `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" fill="#1f4e9a"/>${[[0, -0.42], [-0.38, 0.25], [0.38, 0.25]].map(([dx, dy]) => `<path d="M${n2(cx + dx * r - r * 0.2)} ${n2(cy + dy * r + r * 0.12)}l${n2(r * 0.05)} ${n2(-r * 0.24)}l${n2(r * 0.1)} ${n2(r * 0.12)}l${n2(r * 0.05)} ${n2(-r * 0.16)}l${n2(r * 0.05)} ${n2(r * 0.16)}l${n2(r * 0.1)} ${n2(-r * 0.12)}l${n2(r * 0.05)} ${n2(r * 0.24)}z" fill="#f2c230"/>`).join("")}`;
    case "aura":
      return `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" fill="#0b0c12"/><circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r * 0.86)}" fill="none" stroke="#a78bfa" stroke-width="${n2(r * 0.12)}"/><path d="M${n2(cx)} ${n2(cy - r * 0.62)}C${n2(cx + r * 0.25)} ${n2(cy - r * 0.2)} ${n2(cx + r * 0.42)} ${n2(cy)} ${n2(cx + r * 0.42)} ${n2(cy + r * 0.18)}A${n2(r * 0.42)} ${n2(r * 0.42)} 0 0 1 ${n2(cx - r * 0.42)} ${n2(cy + r * 0.18)}C${n2(cx - r * 0.42)} ${n2(cy)} ${n2(cx - r * 0.25)} ${n2(cy - r * 0.2)} ${n2(cx)} ${n2(cy - r * 0.62)}Z" fill="#22d3ee"/>`;
    default:
      return star(cx, cy, r, "#fff");
  }
}

part({
  type: "insignia",
  label: "National marking",
  cat: "Decals",
  size: [70, 70],
  params: [select("style", "Marking", [["auto", "Match the nation"], ["usstar", "US star"], ["cross", "Balkenkreuz"], ["redstar", "Red star"], ["roundel", "RAF roundel"], ["roundel-fr", "French roundel"], ["roundel-it", "Italian roundel"], ["hinomaru", "Hinomaru"], ["crowns", "Three crowns"], ["aura", "Aura"], ["star", "White star"]], "auto")],
  render(c, p) {
    if (c.view !== "normal") return "";
    return insignia(c, p.style, c.w, c.h, c.nation);
  },
});

const DECAL_FONTS = [
  ["stencil", "Stencil"],
  ["block", "Block"],
  ["pixel", "Pixel"],
  ["script", "Script"],
];
const DECAL_FONT_CSS = {
  stencil: '"Bebas Neue", Impact, sans-serif',
  block: '"Anton", Impact, sans-serif',
  pixel: '"Press Start 2P", monospace',
  script: '"Permanent Marker", cursive',
};

part({
  type: "number",
  label: "Number / text",
  cat: "Decals",
  size: [90, 50],
  params: [text("text", "Text", "217", 24), select("font", "Font", DECAL_FONTS, "stencil"), color("color", "Colour", "#f1f2f0"), color("outline", "Outline", "#111111"), toggle("hasOutline", "Outline", false)],
  render(c, p) {
    const size = Math.min(c.h * 0.95, (c.w / Math.max(1, String(p.text).length)) * 1.6);
    return decalText(c, p.text, c.w / 2, c.h / 2, size, p.color, DECAL_FONT_CSS[p.font] || DECAL_FONT_CSS.stencil, "middle", p.hasOutline ? p.outline : null);
  },
});

part({
  type: "kills",
  label: "Kill marks",
  cat: "Decals",
  size: [120, 30],
  params: [range("count", "Marks", 1, 40, 5), select("mark", "Mark", [["ring", "Barrel rings"], ["star", "Stars"], ["tank", "Tank silhouettes"], ["plane", "Plane silhouettes"], ["bar", "Bars"]], "ring"), color("color", "Colour", "#f1f2f0")],
  render(c, p) {
    if (c.view !== "normal") return "";
    const { w, h } = c;
    const step = w / p.count;
    let out = "";
    for (let i = 0; i < p.count; i++) {
      const x = i * step + step / 2;
      if (p.mark === "ring") out += `<rect x="${n2(x - step * 0.2)}" y="0" width="${n2(step * 0.4)}" height="${n2(h)}" fill="${p.color}"/>`;
      else if (p.mark === "bar") out += `<rect x="${n2(x - step * 0.12)}" y="${n2(h * 0.1)}" width="${n2(step * 0.24)}" height="${n2(h * 0.8)}" fill="${p.color}"/>`;
      else if (p.mark === "tank") out += `<path d="M${n2(x - step * 0.4)} ${n2(h * 0.75)}h${n2(step * 0.8)}l${n2(-step * 0.08)} ${n2(h * 0.2)}h${n2(-step * 0.64)}zM${n2(x - step * 0.2)} ${n2(h * 0.75)}v${n2(-h * 0.25)}h${n2(step * 0.35)}v${n2(h * 0.25)}zM${n2(x + step * 0.15)} ${n2(h * 0.58)}h${n2(step * 0.3)}v${n2(h * 0.07)}h${n2(-step * 0.3)}z" fill="${p.color}"/>`;
      else if (p.mark === "plane") out += `<path d="M${n2(x - step * 0.4)} ${n2(h * 0.5)}h${n2(step * 0.8)}M${n2(x)} ${n2(h * 0.15)}v${n2(h * 0.7)}M${n2(x - step * 0.3)} ${n2(h * 0.3)}v${n2(h * 0.4)}" stroke="${p.color}" stroke-width="${n2(step * 0.12)}" stroke-linecap="round"/>`;
      else {
        const rr = Math.min(step, h) * 0.45;
        const pts = [];
        for (let k = 0; k < 10; k++) {
          const a = -Math.PI / 2 + (k * Math.PI) / 5;
          pts.push([x + Math.cos(a) * rr * (k % 2 ? 0.4 : 1), h / 2 + Math.sin(a) * rr * (k % 2 ? 0.4 : 1)]);
        }
        out += `<path d="${poly(pts)}" fill="${p.color}"/>`;
      }
    }
    return out;
  },
});

part({
  type: "sharkmouth",
  label: "Shark mouth",
  cat: "Decals",
  size: [150, 70],
  params: [],
  render(c) {
    if (c.view !== "normal") return "";
    const { w, h } = c;
    let teeth = "";
    for (let i = 0; i < 9; i++) {
      const x = w * 0.08 + i * w * 0.1;
      teeth += `<path d="M${n2(x)} ${n2(h * 0.4)}l${n2(w * 0.05)} ${n2(h * 0.17)}l${n2(w * 0.05)} ${n2(-h * 0.17)}z" fill="#fff"/><path d="M${n2(x)} ${n2(h * 0.75)}l${n2(w * 0.05)} ${n2(-h * 0.17)}l${n2(w * 0.05)} ${n2(h * 0.17)}z" fill="#fff"/>`;
    }
    return `<path d="M0 ${n2(h * 0.4)}C${n2(w * 0.3)} ${n2(h * 0.38)} ${n2(w * 0.8)} ${n2(h * 0.35)} ${n2(w)} ${n2(h * 0.25)}C${n2(w * 0.85)} ${n2(h * 0.7)} ${n2(w * 0.4)} ${n2(h * 0.85)} 0 ${n2(h * 0.75)}Z" fill="#b3122a"/>${teeth}<circle cx="${n2(w * 0.86)}" cy="${n2(h * 0.12)}" r="${n2(h * 0.1)}" fill="#fff"/><circle cx="${n2(w * 0.87)}" cy="${n2(h * 0.12)}" r="${n2(h * 0.05)}" fill="#111"/>`;
  },
});

part({
  type: "stripes",
  label: "Stripes",
  cat: "Decals",
  size: [80, 120],
  params: [select("style", "Style", [["invasion", "Invasion stripes"], ["checker", "Checkerboard"], ["band", "Single band"], ["chevron", "Chevrons"]], "invasion"), color("a", "Colour 1", "#f1f2f0"), color("b", "Colour 2", "#141518"), range("count", "Count", 1, 12, 5)],
  render(c, p) {
    if (c.view !== "normal") return "";
    const { w, h } = c;
    let out = "";
    if (p.style === "checker") {
      const s = Math.min(w, h) / p.count;
      for (let x = 0; x < w; x += s) for (let y = 0; y < h; y += s) out += `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(Math.min(s, w - x))}" height="${n2(Math.min(s, h - y))}" fill="${Math.round(x / s + y / s) % 2 ? p.b : p.a}"/>`;
    } else if (p.style === "band") {
      out += `<rect width="${n2(w)}" height="${n2(h)}" fill="${p.a}"/>`;
    } else if (p.style === "chevron") {
      for (let i = 0; i < p.count; i++) out += `<path d="M0 ${n2((h * i) / p.count)}l${n2(w / 2)} ${n2(h / p.count / 2)}l${n2(w / 2)} ${n2(-h / p.count / 2)}v${n2(h / p.count / 2)}l${n2(-w / 2)} ${n2(h / p.count / 2)}l${n2(-w / 2)} ${n2(-h / p.count / 2)}z" fill="${i % 2 ? p.b : p.a}"/>`;
    } else {
      const s = w / p.count;
      for (let i = 0; i < p.count; i++) out += `<rect x="${n2(i * s)}" width="${n2(s)}" height="${n2(h)}" fill="${i % 2 ? p.b : p.a}"/>`;
    }
    return out;
  },
});

part({
  type: "emoji",
  label: "Emoji sticker",
  cat: "Decals",
  size: [50, 50],
  anims: ["spin", "swing", "bob", "pulse"],
  params: [text("emoji", "Emoji", "💀", 8)],
  render(c, p) {
    if (c.view !== "normal") return "";
    return `<text x="${n2(c.w / 2)}" y="${n2(c.h / 2)}" font-size="${n2(Math.min(c.w, c.h) * 0.85)}" text-anchor="middle" dominant-baseline="central" font-family='"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'>${esc(p.emoji)}</text>`;
  },
});

// ---------------------------------------------------------------------------
// Parts: defaults and helpers
// ---------------------------------------------------------------------------

const ANIMS = [
  { id: "none", label: "None" },
  { id: "spin", label: "Spin", hint: "Propellers, wheels, radar", range: null },
  { id: "roll", label: "Roll tracks", hint: "Wheels turn and the track moves" },
  { id: "traverse", label: "Traverse", hint: "Attached parts (the gun) swing around", range: [10, 90, 50, "°"] },
  { id: "swing", label: "Swing / elevate", hint: "Back and forth around the pivot", range: [1, 90, 10, "°"] },
  { id: "recoil", label: "Recoil", hint: "Kicks back after firing", range: [2, 200, 30, "cm"] },
  { id: "bob", label: "Bob", hint: "Bounces up and down", range: [1, 60, 4, "cm"] },
  { id: "slide", label: "Slide", hint: "Moves sideways and back", range: [1, 300, 20, "cm"] },
  { id: "pulse", label: "Pulse", hint: "Grows and shrinks", range: [1, 50, 8, "%"] },
  { id: "flicker", label: "Flicker / fire", hint: "Flames, muzzle flash, lights" },
  { id: "blink", label: "Blink", hint: "On and off" },
  { id: "smoke", label: "Smoke", hint: "Puffs of exhaust smoke" },
];

let partCounter = 0;
const partId = () => `p${Date.now().toString(36)}${(partCounter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function defaultParams(def) {
  return Object.fromEntries(def.params.map((s) => [s.k, s.def]));
}

/** Params of a part, filled in with defaults. */
function paramsOf(part) {
  const def = PARTS[part.type];
  return def ? { ...defaultParams(def), ...part.params } : { ...part.params };
}

function defaultAnim(def) {
  return { type: "none", speed: 1, range: null, delay: 0, reverse: false, pivot: [...def.pivot] };
}

/** A new part of `type` at (x, y) – or centred in the workbench. */
function createPart(type, at = {}) {
  const def = PARTS[type];
  if (!def) throw new Error(`Unknown part ${type}`);
  const params = defaultParams(def);
  let [w, h] = def.size;
  if (def.fit) ({ w, h } = def.fit(params));
  return {
    id: partId(),
    type,
    name: "",
    x: Math.round(at.x ?? 0),
    y: Math.round(at.y ?? 0),
    w,
    h,
    rotation: 0,
    flipX: false,
    flipY: false,
    parent: null,
    behind: false,
    color: null,
    hidden: false,
    params,
    anim: defaultAnim(def),
    ...at.extra,
  };
}

function partLabel(part) {
  return part.name || PARTS[part.type]?.label || part.type;
}

// ---------------------------------------------------------------------------
// Drawing a whole vehicle
// ---------------------------------------------------------------------------

function buildDefs(pid, v) {
  return `<defs>
${camoPattern(`${pid}-camo`, v.paint, v.size)}
<linearGradient id="${pid}-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".24"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".72" stop-color="#000" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient>
<radialGradient id="${pid}-round" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></radialGradient>
<linearGradient id="${pid}-tube" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset=".28" stop-color="#fff" stop-opacity=".38"/><stop offset=".5" stop-color="#fff" stop-opacity=".04"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>
<linearGradient id="${pid}-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset=".4" stop-color="#fff" stop-opacity=".06"/><stop offset=".62" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#0b1220" stop-opacity=".35"/></linearGradient>
<linearGradient id="${pid}-dirt" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#4a3a26" stop-opacity="0"/><stop offset="1" stop-color="#4a3a26" stop-opacity=".95"/></linearGradient>
<radialGradient id="${pid}-glow"><stop offset="0" stop-color="#fff3c4" stop-opacity=".95"/><stop offset="1" stop-color="#fff3c4" stop-opacity="0"/></radialGradient>
<radialGradient id="${pid}-glowred"><stop offset="0" stop-color="#ff4d4d" stop-opacity=".9"/><stop offset="1" stop-color="#ff4d4d" stop-opacity="0"/></radialGradient>
<linearGradient id="${pid}-flame" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fffbe0"/><stop offset=".3" stop-color="#ffc24a"/><stop offset=".7" stop-color="#ff5a1f" stop-opacity=".7"/><stop offset="1" stop-color="#ff5a1f" stop-opacity="0"/></linearGradient>
<linearGradient id="${pid}-burner" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#eaf6ff"/><stop offset=".22" stop-color="#7dd3fc"/><stop offset=".55" stop-color="#f97316" stop-opacity=".75"/><stop offset="1" stop-color="#f97316" stop-opacity="0"/></linearGradient>
<radialGradient id="${pid}-prop"><stop offset="0" stop-color="#1e1e1e" stop-opacity=".04"/><stop offset=".75" stop-color="#1e1e1e" stop-opacity=".2"/><stop offset=".94" stop-color="#f2c230" stop-opacity=".35"/><stop offset="1" stop-color="#f2c230" stop-opacity="0"/></radialGradient>
<radialGradient id="${pid}-ground"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<pattern id="${pid}-mesh" patternUnits="userSpaceOnUse" width="6" height="6"><path d="M0 0L6 6M6 0L0 6" stroke="#222" stroke-width=".8"/></pattern>
</defs>`;
}

/** Wrap SVG in a SMIL animation of `a` around the pivot (px, py). */
function animate(a, inner, px, py) {
  const sp = a.speed || 1;
  const d = (base) => `${n2(base / sp)}s`;
  const begin = a.delay ? ` begin="${n2(a.delay)}s"` : "";
  const spec = ANIMS.find((x) => x.id === a.type);
  const r = a.range ?? (spec && spec.range ? spec.range[2] : 10);
  const ease = ` calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" keyTimes="0;.5;1"`;
  const X = n2(px);
  const Y = n2(py);
  switch (a.type) {
    case "spin":
      return `<g>${inner}<animateTransform attributeName="transform" type="rotate" from="0 ${X} ${Y}" to="${a.reverse ? -360 : 360} ${X} ${Y}" dur="${d(1.6)}" repeatCount="indefinite"${begin}/></g>`;
    case "swing":
      return `<g>${inner}<animateTransform attributeName="transform" type="rotate" values="${-r} ${X} ${Y};${r} ${X} ${Y};${-r} ${X} ${Y}" dur="${d(2.4)}"${ease} repeatCount="indefinite"${begin}/></g>`;
    case "bob":
      return `<g>${inner}<animateTransform attributeName="transform" type="translate" values="0 0;0 ${-r};0 0" dur="${d(0.9)}"${ease} repeatCount="indefinite"${begin}/></g>`;
    case "slide":
      return `<g>${inner}<animateTransform attributeName="transform" type="translate" values="0 0;${a.reverse ? -r : r} 0;0 0" dur="${d(2.4)}"${ease} repeatCount="indefinite"${begin}/></g>`;
    case "recoil":
      return `<g>${inner}<animateTransform attributeName="transform" type="translate" values="0 0;${-r} 0;${-r} 0;0 0;0 0" keyTimes="0;.03;.09;.4;1" dur="${d(2.5)}" repeatCount="indefinite"${begin}/></g>`;
    case "pulse":
      return `<g transform="translate(${X} ${Y})"><g><animateTransform attributeName="transform" type="scale" values="1;${n2(1 + r / 100)};1" dur="${d(1.4)}"${ease} repeatCount="indefinite"${begin}/><g transform="translate(${-X} ${-Y})">${inner}</g></g></g>`;
    case "flicker":
      return `<g>${inner}<animate attributeName="opacity" values="1;.35;.9;.5;1" dur="${d(0.45)}" repeatCount="indefinite"${begin}/></g>`;
    case "blink":
      return `<g>${inner}<animate attributeName="opacity" values="1;0" keyTimes="0;.5" calcMode="discrete" dur="${d(1)}" repeatCount="indefinite"${begin}/></g>`;
    default:
      return inner;
  }
}

/** Attached parts turning with a turret: they foreshorten like they swing toward you. */
function traverse(a, kids, px, py) {
  const sp = a.speed || 1;
  const k = n2(Math.cos(rad(clamp(a.range ?? 50, 5, 90))));
  const X = n2(px);
  const Y = n2(py);
  return `<g transform="translate(${X} ${Y})"><g><animateTransform attributeName="transform" type="scale" values="1 1;${k} 1;1 1;${k} 1;1 1" keyTimes="0;.25;.5;.75;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1;.45 0 .55 1" dur="${n2(7 / sp)}s" repeatCount="indefinite"${a.delay ? ` begin="${n2(a.delay)}s"` : ""}/><g transform="translate(${-X} ${-Y})">${kids}</g></g></g>`;
}

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The vehicle as an SVG string.
 * opts: view (normal | armor | xray), animate, labels, ground, selected (part id).
 */
function renderVehicleSvg(v, opts = {}) {
  const view = opts.view || "normal";
  const env = {
    view,
    animate: !!opts.animate && !reducedMotion(),
    labels: opts.labels ?? view !== "normal",
    pid: `vx${(++renderCounter).toString(36)}`,
    paint: v.paint,
    nation: v.nation,
  };
  const ids = new Set(v.parts.map((p) => p.id));
  const kids = new Map();
  for (const part of v.parts) {
    const key = part.parent && ids.has(part.parent) && part.parent !== part.id ? part.parent : "";
    if (!kids.has(key)) kids.set(key, []);
    kids.get(key).push(part);
  }
  const seen = new Set();
  const draw = (part) => {
    if (seen.has(part.id)) return ""; // guards against parent loops
    seen.add(part.id);
    const def = PARTS[part.type];
    if (!def || part.hidden) return "";
    const p = paramsOf(part);
    const c = makeCtx(env, part, def);
    let body;
    try {
      body = def.render(c, p);
    } catch {
      body = "";
    }
    const flip = part.flipX || part.flipY ? ` translate(${part.flipX ? n2(part.w) : 0} ${part.flipY ? n2(part.h) : 0}) scale(${part.flipX ? -1 : 1} ${part.flipY ? -1 : 1})` : "";
    const children = kids.get(part.id) || [];
    const before = children.filter((k) => k.behind).map(draw).join("");
    let after = children.filter((k) => !k.behind).map(draw).join("");
    const a = part.anim || {};
    const active = env.animate && a.type && a.type !== "none";
    const px = part.x + (a.pivot ? a.pivot[0] : 0.5) * part.w;
    const py = part.y + (a.pivot ? a.pivot[1] : 0.5) * part.h;
    if (active && a.type === "traverse" && after) after = traverse(a, after, px, py);
    let g = `${before}<g data-part="${esc(part.id)}" transform="translate(${n2(part.x)} ${n2(part.y)})${flip}">${body}</g>${after}`;
    if (active && a.type !== "traverse" && !(def.internalAnims || []).includes(a.type)) g = animate(a, g, px, py);
    if (part.rotation) g = `<g transform="rotate(${n2(part.rotation)} ${n2(part.x + part.w / 2)} ${n2(part.y + part.h / 2)})">${g}</g>`;
    return g;
  };
  const top = (kids.get("") || []).map(draw).join("");
  // Anything left (only possible with a parent loop) is drawn at the top level.
  const rest = v.parts.filter((p) => !seen.has(p.id)).map(draw).join("");
  const { w, h } = v.size;
  const ground = (opts.ground ?? v.kind !== "plane") && view === "normal" ? `<ellipse cx="${n2(w / 2)}" cy="${n2(h - 6)}" rx="${n2(w * 0.47)}" ry="${n2(Math.max(8, h * 0.035))}" fill="url(#${env.pid}-ground)"/>` : "";
  const cls = `vx vx-${view}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n2(w)} ${n2(h)}" class="${cls}" preserveAspectRatio="xMidYMid meet" overflow="visible" font-family="Inter, 'Segoe UI', sans-serif">${VEHICLE_SVG_STYLE}${buildDefs(env.pid, v)}${ground}${top}${rest}</svg>`;
}

const VEHICLE_SVG_STYLE = `<style>.vx-mm{fill:#fff;font-weight:800;text-anchor:middle;dominant-baseline:central;paint-order:stroke;stroke:rgba(0,0,0,.65);stroke-width:3px;pointer-events:none}.vx-label{fill:#e2f3ff;font-weight:700;text-anchor:middle;paint-order:stroke;stroke:rgba(4,10,20,.8);stroke-width:3px;pointer-events:none}</style>`;

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

const SHELL_FACTOR = { AP: 0.92, APHE: 0.95, APCBC: 1, APDS: 1.45, APFSDS: 2.9 };

/** Armour penetration at close range (mm), from calibre, barrel length and shell. */
function penetration(cal, length, shell) {
  if (shell === "HEAT") return cal * 3.6;
  if (shell === "HE") return Math.max(5, cal * 0.18);
  return 1.64 * cal * (length / 50) * (SHELL_FACTOR[shell] ?? 1);
}

function reloadTime(cal, loading, hasLoader) {
  if (loading === "autoloader") return 4 + cal / 30;
  let t = 2.2 + 0.0035 * Math.pow(cal, 1.6);
  if (loading === "separate") t *= 1.8;
  if (!hasLoader) t *= 1.5;
  return t;
}

/** War Thunder-style steps: x.0, x.3, x.7. */
function brStep(v) {
  const x = clamp(v, 1, 13.7);
  const whole = Math.floor(x);
  const frac = x - whole;
  const steps = [0, 0.3, 0.7, 1];
  const best = steps.reduce((a, b) => (Math.abs(b - frac) < Math.abs(a - frac) ? b : a));
  return Math.round((whole + best) * 10) / 10;
}

function resolved(v) {
  return v.parts.filter((p) => !p.hidden && PARTS[p.type]).map((part) => ({ part, def: PARTS[part.type], p: paramsOf(part) }));
}

function totalMass(list) {
  let m = 0;
  for (const { part, def, p } of list) {
    try {
      m += Math.max(0, def.mass(p, part) || 0);
    } catch {
      // A broken part just doesn't weigh anything.
    }
  }
  return m;
}

const row = (key, label, value, unit, bar, digits = 0) => ({ key, label, value, unit, bar: bar == null ? null : clamp(bar, 0, 1), text: value == null ? "—" : `${Number(value).toFixed(digits)}${unit ? ` ${unit}` : ""}` });

function tankStats(list, warn) {
  const of = (role) => list.filter((x) => x.def.role === role);
  const mass = totalMass(list) * 1.05 + 1;
  const engines = list.filter((x) => x.part.type === "engine" && x.p.kind !== "jet");
  const hp = engines.reduce((s, x) => s + x.p.hp, 0);
  const hasTracks = of("tracks").length > 0 || list.some((x) => x.part.type === "carwheel");
  if (!engines.length) warn.push("No engine yet: add one from Crew & modules (it's hidden inside, see it in X-ray).");
  if (!hasTracks) warn.push("No tracks or wheels: it won't go anywhere.");
  const hpt = hp / mass;
  const speed = engines.length && hasTracks ? clamp(13 * Math.sqrt(hpt), 3, 85) : 0;
  const guns = of("gun").sort((a, b) => b.p.caliber - a.p.caliber);
  const gun = guns[0];
  const crew = list.filter((x) => x.def.role === "crew");
  const hasLoader = crew.length === 0 || crew.some((x) => x.p.role === "loader");
  const pen = gun ? penetration(gun.p.caliber, gun.p.length, gun.p.shell) : 0;
  const reload = gun ? reloadTime(gun.p.caliber, gun.p.loading, hasLoader) : null;
  if (gun && !hasLoader && gun.p.loading !== "autoloader") warn.push("Nobody is the loader, so the gunner loads: slower reload.");
  const hull = of("hull").sort((a, b) => b.part.w * b.part.h - a.part.w * a.part.h)[0];
  const turret = of("turret").sort((a, b) => b.part.w * b.part.h - a.part.w * a.part.h)[0];
  const mantlet = list.find((x) => x.part.type === "mantlet");
  const hullFront = hull ? Math.max(effectiveArmor(hull.p.front, hull.p.frontSlope), effectiveArmor(hull.p.lower, hull.p.lowerSlope) * 0.9) : 0;
  const turretFront = turret ? Math.max(effectiveArmor(turret.p.front, turret.p.frontSlope), mantlet ? effectiveArmor(mantlet.p.armor, mantlet.p.slope) : 0) : 0;
  const skirts = of("plate").filter((x) => x.part.type === "skirts").reduce((m, x) => Math.max(m, x.p.armor), 0);
  const side = (hull ? hull.p.side : 0) + skirts * 0.5;
  const rounds = list.filter((x) => x.part.type === "ammo" && x.p.kind === "shells").reduce((s, x) => s + x.p.rounds, 0);
  const fuel = list.filter((x) => x.part.type === "fuel").reduce((s, x) => s + x.p.liters, 0);
  const range = hp ? (fuel * 240) / hp : 0;
  let br = 1;
  // Firepower sets the base; past ~200 mm (modern darts) it grows slower.
  if (gun) br = pen <= 200 ? 4.35 * Math.log(Math.max(pen, 20)) - 16.03 : 7.02 + 2.8 * Math.log(pen / 200);
  br += clamp((Math.max(hullFront, turretFront) - 80) * 0.012, -1, 0.9);
  br += clamp((speed - 40) * 0.02, -0.6, 0.6);
  if (reload) br += clamp((7 - reload) * 0.05, -0.4, 0.3);
  return {
    mass,
    br: brStep(br),
    rows: [
      row("pen", "Penetration", gun ? pen : null, "mm", pen / 600),
      row("cal", "Main gun", gun ? gun.p.caliber : null, "mm", gun ? gun.p.caliber / 155 : 0),
      row("reload", "Reload", reload, "s", reload ? 1 - reload / 25 : 0, 1),
      row("hullFront", "Hull front", hullFront || null, "mm eff.", hullFront / 700),
      row("turretFront", "Turret front", turretFront || null, "mm eff.", turretFront / 800),
      row("side", "Side armour", side || null, "mm", side / 200),
      row("speed", "Top speed", speed, "km/h", speed / 80),
      row("hpt", "Power / weight", hp ? hpt : null, "hp/t", hpt / 30, 1),
      row("mass", "Weight", mass, "t", mass / 80, 1),
      row("crew", "Crew", crew.length || null, "", crew.length / 6),
      row("ammo", "Ammo", rounds || null, "rounds", rounds / 120),
      row("range", "Range", range || null, "km", range / 600),
    ],
    headline: gun ? `${gun.p.caliber} mm L/${gun.p.length} · ${Math.round(pen)} mm pen` : "No main gun",
  };
}

function planeStats(list, warn) {
  const of = (role) => list.filter((x) => x.def.role === role);
  const crew = of("crew").length;
  const mass = totalMass(list) + 0.15 + (crew ? 0 : 0.09);
  const engines = list.filter((x) => x.part.type === "engine");
  const jets = engines.filter((x) => x.p.kind === "jet");
  const props = engines.filter((x) => x.p.kind !== "jet");
  const hp = props.reduce((s, x) => s + x.p.hp, 0);
  const thrust = jets.reduce((s, x) => s + x.p.thrust, 0);
  if (!engines.length) warn.push("No engine yet: add one (Crew & modules), it's inside the nose.");
  if (props.length && !of("prop").length) warn.push("A piston engine needs a propeller.");
  const wings = of("wing");
  if (!wings.length) warn.push("No wings! Add a wing so it can fly.");
  const area = wings.reduce((s, x) => s + x.p.span * (x.part.w / 100) * 0.78, 0);
  const fus = of("fuselage")[0];
  let aero = fus ? { inline: 0.95, radial: 0.88, attacker: 0.72, jet: 1, bomber: 0.75, stubby: 0.9 }[fus.p.style] ?? 0.9 : 0.85;
  if (list.some((x) => x.part.type === "gear" && x.p.kind === "fixed" && !x.p.up)) aero *= 0.88;
  aero *= Math.pow(0.97, list.filter((x) => ["bomb", "rocket", "droptank"].includes(x.def.role)).length);
  if (wings.some((x) => x.p.profile === "laminar")) aero *= 1.04;
  const charger = props.some((x) => x.p.charger === "two") ? 1.08 : props.some((x) => x.p.charger === "turbo") ? 1.05 : props.some((x) => x.p.charger === "none") ? 0.93 : 1;
  const swept = wings.some((x) => x.p.plan === "swept" || x.p.plan === "delta");
  let speed = 0;
  if (thrust) speed = 338 * Math.pow(thrust, 0.35) * aero * (swept ? 1 : 0.9) * Math.pow(5 / mass, 0.06);
  else if (hp && of("prop").length) speed = 58 * Math.cbrt(hp) * aero * charger * Math.pow(3.5 / mass, 0.08);
  if (!wings.length) speed = 0;
  const climb = thrust ? (12 * thrust) / mass : (0.038 * hp) / mass;
  const loading = area ? (mass * 1000) / area : null;
  const turn = loading ? 7 + loading / 11 : null;
  const guns = of("pgun");
  const burst = guns.reduce((s, x) => s + x.p.count * 0.2 * Math.pow(x.p.caliber / 7.7, 1.9), 0);
  const bombs = of("bomb").reduce((s, x) => s + x.p.kg, 0);
  const rockets = of("rocket").reduce((s, x) => s + x.p.count, 0);
  const fuel = list.filter((x) => x.part.type === "fuel" || x.part.type === "droptank").reduce((s, x) => s + x.p.liters, 0);
  let br = 8.7 * Math.log(Math.max(speed, 150)) - 52.2 + 0.3 * Math.log(Math.max(burst, 0.2) / 0.8) + clamp((climb - 15) * 0.03, -0.5, 0.5) + (bombs ? Math.min(0.6, bombs / 2000) : 0);
  if (!speed) br = 1;
  return {
    mass,
    br: brStep(br),
    rows: [
      row("speed", "Top speed", speed || null, "km/h", speed / 1200),
      row("climb", "Climb rate", climb || null, "m/s", climb / 60, 1),
      row("turn", "Turn time", turn, "s", turn ? 1 - (turn - 12) / 25 : 0, 1),
      row("burst", "Burst mass", burst || null, "kg/s", burst / 8, 2),
      row("guns", "Guns", guns.reduce((s, x) => s + x.p.count, 0) || null, "", null),
      row("bombs", "Bombs", bombs || null, "kg", bombs / 2000),
      row("rockets", "Rockets", rockets || null, "", rockets / 16),
      row("power", thrust ? "Thrust" : "Engine power", thrust || hp || null, thrust ? "kN" : "hp", thrust ? thrust / 80 : hp / 2500),
      row("mass", "Weight", mass, "t", mass / 30, 2),
      row("wing", "Wing loading", loading, "kg/m²", loading ? loading / 400 : 0),
      row("fuel", "Fuel", fuel || null, "L", fuel / 2500),
    ],
    headline: thrust ? `${Math.round(speed)} km/h jet` : `${Math.round(speed)} km/h · ${hp} hp`,
  };
}

const CAR_CLASSES = ["E", "D", "C", "B", "A", "S", "S+", "X"];

function carStats(list, warn) {
  const of = (role) => list.filter((x) => x.def.role === role);
  const mass = totalMass(list) + 0.25;
  const engines = list.filter((x) => x.part.type === "engine");
  const hp = engines.reduce((s, x) => s + (x.p.kind === "jet" ? x.p.thrust * 30 : x.p.hp), 0);
  if (!engines.length) warn.push("No engine yet: add one (Crew & modules), it's under the bonnet.");
  const wheels = of("carwheel");
  if (wheels.length < 2) warn.push("Add wheels so it can drive.");
  const body = of("body")[0];
  let aero = body ? { f1: 1.12, super: 1.08, sports: 1, muscle: 0.95, sedan: 0.92, hatch: 0.9, rally: 0.95, jeep: 0.72, pickup: 0.8, truck: 0.66 }[body.p.style] ?? 0.9 : 0.85;
  const spoilers = of("spoiler");
  if (spoilers.some((x) => x.p.style === "wing")) aero *= 0.97;
  const kgPerHp = hp ? (mass * 1000) / hp : null;
  const sprint = kgPerHp ? clamp(1.6 + 0.85 * Math.pow(kgPerHp, 0.9), 1.6, 40) : null;
  const top = hp && wheels.length >= 2 ? 26 * Math.pow(hp, 0.4) * aero : 0;
  const grip = clamp(30 + wheels.reduce((s, x) => s + x.p.tyre, 0) / Math.max(1, wheels.length) + spoilers.length * 8 + (body?.p.style === "f1" ? 20 : 0), 0, 100);
  const nitro = list.some((x) => x.part.type === "module" && x.p.kind === "nitro");
  const score = (top / 420) * 5 + (sprint ? 3 / sprint : 0) * 2 + grip / 100 + (nitro ? 0.4 : 0);
  const cls = CAR_CLASSES[clamp(Math.floor(score * 1.2), 0, CAR_CLASSES.length - 1)];
  return {
    mass,
    br: null,
    cls,
    rows: [
      row("top", "Top speed", top || null, "km/h", top / 450),
      row("sprint", "0–100 km/h", sprint, "s", sprint ? 1 - sprint / 15 : 0, 1),
      row("power", "Power", hp || null, "hp", hp / 1500),
      row("pw", "Power / weight", hp ? hp / mass : null, "hp/t", hp / mass / 800),
      row("grip", "Grip", grip, "", grip / 100),
      row("mass", "Weight", mass, "t", mass / 4, 2),
    ],
    headline: nitro ? `${hp} hp + nitro` : `${hp} hp`,
  };
}

/** Live stats for a vehicle. Approximate on purpose: it's a game, not a simulator. */
function computeStats(v) {
  const list = resolved(v);
  const warnings = [];
  let s;
  if (v.kind === "plane") s = planeStats(list, warnings);
  else if (v.kind === "car") s = carStats(list, warnings);
  else if (v.kind === "tank") s = tankStats(list, warnings);
  else {
    const mass = totalMass(list);
    const hp = list.filter((x) => x.part.type === "engine").reduce((sum, x) => sum + x.p.hp, 0);
    s = { mass, br: null, rows: [row("mass", "Weight", mass, "t", mass / 60, 1), row("parts", "Parts", v.parts.length, "", v.parts.length / 80), row("power", "Power", hp || null, "hp", hp / 2000)], headline: `${v.parts.length} parts` };
  }
  return { ...s, kind: v.kind, warnings, parts: v.parts.length };
}

// ---------------------------------------------------------------------------
// Vehicles: create, validate
// ---------------------------------------------------------------------------

const KINDS = [
  { id: "tank", label: "Tank", size: { w: 1000, h: 420 } },
  { id: "plane", label: "Plane", size: { w: 1200, h: 460 } },
  { id: "car", label: "Car", size: { w: 700, h: 260 } },
  { id: "other", label: "Anything", size: { w: 1000, h: 500 } },
];

let vehicleCounter = 0;
function createVehicle(kind = "tank", extra = {}) {
  const k = KINDS.find((x) => x.id === kind) || KINDS[0];
  const nation = extra.nation || "usa";
  const n = NATIONS.find((x) => x.id === nation) || NATIONS[0];
  return {
    v: VEHICLE_VERSION,
    id: `v${Date.now().toString(36)}${(vehicleCounter++).toString(36)}`,
    name: extra.name || `My ${k.label.toLowerCase()}`,
    kind: k.id,
    nation,
    size: { ...k.size },
    paint: { base: kind === "plane" ? n.plane : n.tank, colors: ["#3a4019", "#6b5d3a", "#262915"], camo: "none", scale: 1, wear: 0.15, seed: Math.floor(Math.random() * 1e6) },
    parts: [],
    preset: null,
    ...extra,
  };
}

const isHexColor = (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
const num = (v, min, max, fallback) => (typeof v === "number" && Number.isFinite(v) ? clamp(v, min, max) : fallback);
const str = (v, fallback, max) => (typeof v === "string" ? v.slice(0, max) : fallback);
const okId = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);

function sanitizeParams(def, raw) {
  const out = {};
  for (const s of def.params) {
    const v = raw ? raw[s.k] : undefined;
    switch (s.type) {
      case "range":
      case "armor":
      case "slope":
        out[s.k] = num(v, s.min, s.max, s.def);
        break;
      case "select":
        out[s.k] = s.options.some((o) => o[0] === v) ? v : s.def;
        break;
      case "toggle":
        out[s.k] = typeof v === "boolean" ? v : s.def;
        break;
      case "color":
        out[s.k] = isHexColor(v) ? v.toLowerCase() : s.def;
        break;
      default:
        out[s.k] = str(v, s.def, s.max || 40);
    }
  }
  return out;
}

const MAX_PARTS = 400;

/** Validate a vehicle from a file or the hangar. Unknown parts are dropped. */
function sanitizeVehicle(input) {
  const src = input && typeof input === "object" ? input : {};
  const kind = KINDS.some((k) => k.id === src.kind) ? src.kind : "tank";
  const base = createVehicle(kind);
  const paint = src.paint || {};
  const v = {
    v: VEHICLE_VERSION,
    id: okId(src.id) ? src.id : base.id,
    name: str(src.name, base.name, 60) || base.name,
    kind,
    nation: NATIONS.some((n) => n.id === src.nation) ? src.nation : "usa",
    size: { w: Math.round(num(src.size && src.size.w, 100, 4000, base.size.w)), h: Math.round(num(src.size && src.size.h, 60, 3000, base.size.h)) },
    paint: {
      base: isHexColor(paint.base) ? paint.base.toLowerCase() : base.paint.base,
      colors: [0, 1, 2].map((i) => (Array.isArray(paint.colors) && isHexColor(paint.colors[i]) ? paint.colors[i].toLowerCase() : base.paint.colors[i])),
      camo: CAMOS.some((c) => c.id === paint.camo) ? paint.camo : "none",
      scale: num(paint.scale, 0.3, 3, 1),
      wear: num(paint.wear, 0, 1, 0.15),
      seed: Math.round(num(paint.seed, 0, 1e9, 7)),
    },
    parts: [],
    preset: typeof src.preset === "string" ? src.preset.slice(0, 40) : null,
    approx: src.approx === true,
  };
  const ids = new Set();
  for (const raw of Array.isArray(src.parts) ? src.parts.slice(0, MAX_PARTS) : []) {
    if (!raw || typeof raw !== "object" || !PARTS[raw.type]) continue;
    const def = PARTS[raw.type];
    let id = okId(raw.id) ? raw.id : partId();
    if (ids.has(id)) id = partId();
    ids.add(id);
    const a = raw.anim || {};
    const pivot = Array.isArray(a.pivot) ? [num(a.pivot[0], -2, 3, def.pivot[0]), num(a.pivot[1], -2, 3, def.pivot[1])] : [...def.pivot];
    v.parts.push({
      id,
      type: raw.type,
      name: str(raw.name, "", 40),
      x: num(raw.x, -5000, 9000, 0),
      y: num(raw.y, -5000, 9000, 0),
      w: num(raw.w, 1, 6000, def.size[0]),
      h: num(raw.h, 1, 6000, def.size[1]),
      rotation: num(raw.rotation, -360, 360, 0),
      flipX: raw.flipX === true,
      flipY: raw.flipY === true,
      parent: okId(raw.parent) ? raw.parent : null,
      behind: raw.behind === true,
      color: isHexColor(raw.color) ? raw.color.toLowerCase() : null,
      hidden: raw.hidden === true,
      params: sanitizeParams(def, raw.params),
      anim: {
        type: ANIMS.some((x) => x.id === a.type) ? a.type : "none",
        speed: num(a.speed, 0.1, 6, 1),
        range: a.range == null ? null : num(a.range, -400, 400, 10),
        delay: num(a.delay, 0, 20, 0),
        reverse: a.reverse === true,
        pivot,
      },
    });
  }
  // Parents must exist and can't point at themselves.
  for (const part of v.parts) if (part.parent && (!ids.has(part.parent) || part.parent === part.id)) part.parent = null;
  return v;
}

/** Bounding box of the visible parts (rotation included). */
function partsBounds(parts) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of parts) {
    if (p.hidden) continue;
    const r = rad(p.rotation || 0);
    const w = Math.abs(p.w * Math.cos(r)) + Math.abs(p.h * Math.sin(r));
    const h = Math.abs(p.w * Math.sin(r)) + Math.abs(p.h * Math.cos(r));
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    x0 = Math.min(x0, cx - w / 2);
    y0 = Math.min(y0, cy - h / 2);
    x1 = Math.max(x1, cx + w / 2);
    y1 = Math.max(y1, cy + h / 2);
  }
  return Number.isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

/** Shrink-wrap the workbench around the parts (ground vehicles keep their wheels on the floor). */
function fitVehicle(v, margin = 40) {
  const b = partsBounds(v.parts);
  if (!b) return v;
  const bottom = v.kind === "plane" || v.kind === "other" ? margin : 20;
  const dx = Math.round(margin - b.x);
  const dy = Math.round(margin - b.y);
  return {
    ...v,
    size: { w: Math.round(b.w + margin * 2), h: Math.round(b.h + margin + bottom) },
    parts: v.parts.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
  };
}

/** Part types for a kind, grouped by category (for the library). */
function libraryFor(kind) {
  const cats = new Map();
  for (const def of Object.values(PARTS)) {
    if (!(def.kinds.includes("any") || def.kinds.includes(kind) || kind === "other")) continue;
    if (!cats.has(def.cat)) cats.set(def.cat, []);
    cats.get(def.cat).push(def);
  }
  return [...cats.entries()].map(([cat, defs]) => ({ cat, defs }));
}

export { VEHICLE_VERSION, PARTS, ANIMS, NATIONS, CAMOS, PAINTS, KINDS, ARMOR_SCALE, CREW_ROLES, armorColor, effectiveArmor, penetration, brStep, renderVehicleSvg, computeStats, createVehicle, createPart, sanitizeVehicle, paramsOf, partLabel, libraryFor, shade, fitVehicle, partsBounds };
