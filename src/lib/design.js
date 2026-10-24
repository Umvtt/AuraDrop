// The design model: one plain object that the stage renders, the code
// generators read and `.auradrop` files store. Everything visual is derived
// from it through the helpers in this file, so the live preview and the
// exported code can't drift apart.

export const FILE_APP_ID = "auradrop";
export const FILE_VERSION = 1;
export const FILE_EXTENSION = "auradrop";

export const LIMITS = {
  frost: [0, 40],
  fill: [0.04, 0.16],
  shine: [0.04, 0.6],
  radius: [4, 36],
  width: [240, 520],
  height: [160, 420],
  angle: [0, 360],
  strength: [0, 1],
  drift: [0, 2],
  tiltMax: [0, 25],
  backgroundOpacity: [0, 1],
  points: [2, 5],
};

export const BLEND_MODES = [
  { id: "normal", label: "Normal", canvas: "source-over" },
  { id: "screen", label: "Glow", canvas: "screen" },
  { id: "overlay", label: "Punchy", canvas: "overlay" },
  { id: "soft-light", label: "Soft", canvas: "soft-light" },
  { id: "color-dodge", label: "Neon", canvas: "color-dodge" },
];

export const VIBES = [
  { id: "levitate", label: "Levitate", emoji: "🎈", hint: "Floats gently up and down" },
  { id: "pulse", label: "Breathing Pulse", emoji: "💗", hint: "Slowly breathes with a glow" },
  { id: "shimmer", label: "Neon Shimmer", emoji: "⚡", hint: "A light streak sweeps across" },
  { id: "squish", label: "Click Squish", emoji: "🫧", hint: "Squishes when you press it" },
];

let idCounter = 0;
export const newPointId = () => `p${Date.now().toString(36)}${(idCounter++).toString(36)}`;

export function createDefaultDesign() {
  return {
    frost: 18,
    fill: 0.08,
    shine: 0.22,
    radius: 24,
    width: 380,
    height: 240,
    aura: {
      angle: 135,
      strength: 0.4,
      blend: "screen",
      orbs: true,
      drift: 1,
      points: [
        { id: newPointId(), color: "#8b5cf6", x: 18, y: 22 },
        { id: newPointId(), color: "#ec4899", x: 82, y: 30 },
        { id: newPointId(), color: "#22d3ee", x: 50, y: 88 },
      ],
    },
    vibes: { levitate: false, pulse: false, shimmer: false, squish: true },
    tilt: { enabled: true, max: 14 },
    content: {
      emoji: "✨",
      title: "Hello, Aura",
      subtitle: "Glass that leans toward your cursor.",
      button: "Let's go",
      avatar: null,
      background: null,
      backgroundOpacity: 0.55,
    },
  };
}

// Starter looks: one click turns the card into something that already looks
// good, which is the fastest way in for a first-time user.
export const STARTER_LOOKS = [
  {
    id: "candy",
    label: "Candy",
    colors: ["#f472b6", "#a78bfa", "#fb7185"],
    patch: { frost: 20, fill: 0.1, shine: 0.3, radius: 32, blend: "screen", strength: 0.45, angle: 120 },
  },
  {
    id: "ocean",
    label: "Ocean",
    colors: ["#0ea5e9", "#22d3ee", "#6366f1"],
    patch: { frost: 24, fill: 0.07, shine: 0.2, radius: 24, blend: "soft-light", strength: 0.6, angle: 200 },
  },
  {
    id: "sunset",
    label: "Sunset",
    colors: ["#f97316", "#f43f5e", "#facc15"],
    patch: { frost: 16, fill: 0.08, shine: 0.26, radius: 20, blend: "overlay", strength: 0.5, angle: 160 },
  },
  {
    id: "mint",
    label: "Mint",
    colors: ["#34d399", "#2dd4bf", "#a3e635"],
    patch: { frost: 28, fill: 0.12, shine: 0.18, radius: 28, blend: "screen", strength: 0.35, angle: 90 },
  },
  {
    id: "cyber",
    label: "Cyber",
    colors: ["#22d3ee", "#d946ef", "#4f46e5"],
    patch: { frost: 10, fill: 0.05, shine: 0.45, radius: 8, blend: "color-dodge", strength: 0.3, angle: 45 },
  },
  {
    id: "frost",
    label: "Ice",
    colors: ["#e0f2fe", "#93c5fd", "#c4b5fd"],
    patch: { frost: 38, fill: 0.15, shine: 0.36, radius: 36, blend: "soft-light", strength: 0.5, angle: 180 },
  },
];

const POINT_LAYOUTS = [
  [18, 22],
  [82, 30],
  [50, 88],
  [20, 80],
  [80, 78],
];

export function applyStarterLook(design, look) {
  const { patch } = look;
  return {
    ...design,
    frost: patch.frost,
    fill: patch.fill,
    shine: patch.shine,
    radius: patch.radius,
    aura: {
      ...design.aura,
      angle: patch.angle,
      blend: patch.blend,
      strength: patch.strength,
      points: look.colors.map((color, i) => ({
        id: newPointId(),
        color,
        x: POINT_LAYOUTS[i][0],
        y: POINT_LAYOUTS[i][1],
      })),
    },
  };
}

export function randomDesign(design, rand = Math.random) {
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const between = (min, max) => min + rand() * (max - min);
  const hue = Math.floor(rand() * 360);
  const count = 2 + Math.floor(rand() * 3);
  const points = Array.from({ length: count }, (_, i) => ({
    id: newPointId(),
    color: hslToHex((hue + i * between(40, 120)) % 360, between(70, 95), between(55, 70)),
    x: Math.round(between(10, 90)),
    y: Math.round(between(10, 90)),
  }));
  return {
    ...design,
    frost: Math.round(between(8, 34)),
    fill: round(between(0.05, 0.14), 2),
    shine: round(between(0.12, 0.45), 2),
    radius: Math.round(between(8, 36)),
    aura: {
      ...design.aura,
      angle: Math.round(between(0, 360)),
      strength: round(between(0.3, 0.7), 2),
      blend: pick(BLEND_MODES).id,
      points,
    },
  };
}

// ---------------------------------------------------------------------------
// Derived values shared by the stage, the code generators and the PNG export
// ---------------------------------------------------------------------------

export function borderAlpha(design) {
  return round(design.shine, 2);
}

export function boxShadow(design) {
  const s = design.shine;
  return [
    `inset 0 1px 0 rgba(255, 255, 255, ${round(Math.min(1, s * 1.4), 2)})`,
    `inset 0 -1px 0 rgba(255, 255, 255, ${round(s * 0.35, 2)})`,
    `inset 0 0 24px rgba(255, 255, 255, ${round(s * 0.3, 2)})`,
    "0 20px 50px rgba(0, 0, 0, 0.4)",
    "0 6px 16px rgba(0, 0, 0, 0.25)",
  ].join(", ");
}

/** The mesh gradient: one radial glow per point over a linear base. */
export function meshGradient(aura) {
  const radials = aura.points.map(
    (p) => `radial-gradient(circle at ${p.x}% ${p.y}%, ${p.color} 0%, transparent 62%)`,
  );
  const first = aura.points[0].color;
  const last = aura.points[aura.points.length - 1].color;
  return [...radials, `linear-gradient(${aura.angle}deg, ${first} 0%, ${last} 100%)`].join(", ");
}

/** Placement of the drifting background orbs around a card. */
export function orbLayout(aura) {
  return aura.points.map((p, i) => ({
    id: p.id,
    color: p.color,
    // Spread the orbs around the card so the glass has colour to frost.
    left: 8 + p.x * 0.84,
    top: 8 + p.y * 0.84,
    size: 300 + ((i * 97) % 140),
    delay: -i * 3.3,
    path: i % 3,
  }));
}

export const CARD_LAYOUT = {
  padding: 28,
  avatar: 56,
  gap: 16,
  titleSize: 22,
  subtitleSize: 14,
  subtitleLines: 3,
  buttonHeight: 36,
  buttonPadX: 18,
  buttonSize: 14,
  // Inter is bundled in the app and loaded from Google Fonts by the exports.
  fontFamily: '"Inter Variable", "Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
};

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

export function serializeDesign(design) {
  return JSON.stringify(
    { app: FILE_APP_ID, version: FILE_VERSION, savedAt: new Date().toISOString(), design },
    null,
    2,
  );
}

/**
 * Parse a `.auradrop` file. Unknown or out-of-range values are replaced with
 * defaults or clamped, so a hand-edited or older file can never break the UI.
 */
export function parseDesignFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This file isn't valid AuraDrop JSON.");
  }
  if (!data || data.app !== FILE_APP_ID || typeof data.design !== "object") {
    throw new Error("This isn't an AuraDrop design file.");
  }
  if (data.version > FILE_VERSION) {
    throw new Error("This design was made with a newer AuraDrop. Please update the app.");
  }
  return sanitizeDesign(data.design);
}

export function sanitizeDesign(input) {
  const d = createDefaultDesign();
  const src = input && typeof input === "object" ? input : {};
  const aura = src.aura && typeof src.aura === "object" ? src.aura : {};
  const vibes = src.vibes && typeof src.vibes === "object" ? src.vibes : {};
  const tilt = src.tilt && typeof src.tilt === "object" ? src.tilt : {};
  const content = src.content && typeof src.content === "object" ? src.content : {};

  const num = (v, [min, max], fallback) =>
    typeof v === "number" && Number.isFinite(v) ? clamp(v, min, max) : fallback;
  const str = (v, fallback, max = 200) => (typeof v === "string" ? v.slice(0, max) : fallback);
  const bool = (v, fallback) => (typeof v === "boolean" ? v : fallback);
  const image = (v) => (typeof v === "string" && v.startsWith("data:image/") ? v : null);

  let points = Array.isArray(aura.points)
    ? aura.points
        .filter((p) => p && isHexColor(p.color))
        .slice(0, LIMITS.points[1])
        .map((p) => ({
          id: newPointId(),
          color: p.color.toLowerCase(),
          x: num(p.x, [0, 100], 50),
          y: num(p.y, [0, 100], 50),
        }))
    : [];
  if (points.length < LIMITS.points[0]) points = d.aura.points;

  return {
    frost: num(src.frost, LIMITS.frost, d.frost),
    fill: num(src.fill, LIMITS.fill, d.fill),
    shine: num(src.shine, LIMITS.shine, d.shine),
    radius: num(src.radius, LIMITS.radius, d.radius),
    width: num(src.width, LIMITS.width, d.width),
    height: num(src.height, LIMITS.height, d.height),
    aura: {
      angle: num(aura.angle, LIMITS.angle, d.aura.angle),
      strength: num(aura.strength, LIMITS.strength, d.aura.strength),
      blend: BLEND_MODES.some((b) => b.id === aura.blend) ? aura.blend : d.aura.blend,
      orbs: bool(aura.orbs, d.aura.orbs),
      drift: num(aura.drift, LIMITS.drift, d.aura.drift),
      points,
    },
    vibes: Object.fromEntries(VIBES.map((v) => [v.id, bool(vibes[v.id], d.vibes[v.id])])),
    tilt: {
      enabled: bool(tilt.enabled, d.tilt.enabled),
      max: num(tilt.max, LIMITS.tiltMax, d.tilt.max),
    },
    content: {
      emoji: str(content.emoji, d.content.emoji, 8),
      title: str(content.title, d.content.title, 80),
      subtitle: str(content.subtitle, d.content.subtitle, 240),
      button: str(content.button, d.content.button, 40),
      avatar: image(content.avatar),
      background: image(content.background),
      backgroundOpacity: num(content.backgroundOpacity, LIMITS.backgroundOpacity, d.content.backgroundOpacity),
    },
  };
}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function round(v, digits = 2) {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

export function isHexColor(v) {
  return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}
