import { FONT_STACKS } from "../player/player.js";
import { createVehicle, sanitizeVehicle } from "../vehicles3d/spec.js";

// AuraDrop projects: a canvas with pages, each holding layered elements
// (text, images, stickers, shapes, glass panels, buttons). Buttons – or any
// element – can run actions when clicked in preview.
//
// The same plain object is rendered by the player (preview, editor canvas,
// exported web pages), drawn by the PNG exporter and stored in .auradrop.

export const FILE_APP_ID = "auradrop";
export const FILE_VERSION = 2;
export const FILE_EXTENSION = "auradrop";

export const CANVAS_PRESETS = [
  { id: "square", label: "Square post", w: 1080, h: 1080 },
  { id: "meme", label: "Classic meme", w: 800, h: 800 },
  { id: "story", label: "Story / phone", w: 1080, h: 1920 },
  { id: "wide", label: "Widescreen", w: 1920, h: 1080 },
  { id: "card", label: "Card", w: 1200, h: 800 },
  { id: "banner", label: "Banner", w: 1500, h: 500 },
];

export const CANVAS_LIMITS = { min: 200, max: 4000 };

/** Fonts bundled with the app (and embedded into exported web pages). */
export const FONTS = [
  { id: "Inter", label: "Inter", weights: [400, 500, 600, 700, 800, 900] },
  { id: "Impact", label: "Impact (meme)", weights: [400] },
  { id: "Anton", label: "Anton", weights: [400] },
  { id: "Bangers", label: "Bangers", weights: [400] },
  { id: "Bebas Neue", label: "Bebas Neue", weights: [400] },
  { id: "Permanent Marker", label: "Marker", weights: [400] },
  { id: "Comic Neue", label: "Comic Neue", weights: [400, 700] },
  { id: "Pacifico", label: "Pacifico", weights: [400] },
  { id: "Lobster", label: "Lobster", weights: [400] },
  { id: "Press Start 2P", label: "Pixel", weights: [400] },
  { id: "JetBrains Mono", label: "Mono", weights: [400, 700, 800] },
].map((f) => ({ ...f, css: FONT_STACKS[f.id] }));

export const ELEMENT_TYPES = ["text", "sticker", "image", "shape", "glass", "button", "vehicle"];
export const SHAPES = ["rect", "ellipse", "triangle", "star", "heart", "bubble", "arrow"];
export const ANIMATIONS = [
  { id: "none", label: "None" },
  { id: "float", label: "Float" },
  { id: "pulse", label: "Pulse" },
  { id: "bounce", label: "Bounce" },
  { id: "wiggle", label: "Wiggle" },
  { id: "shake", label: "Shake" },
  { id: "spin", label: "Spin" },
  { id: "swing", label: "Swing" },
  { id: "pop", label: "Pop in" },
  { id: "slide", label: "Slide in" },
];
export const ACTION_TYPES = [
  { id: "link", label: "Open a link", emoji: "🔗" },
  { id: "sound", label: "Play a sound", emoji: "🔊" },
  { id: "confetti", label: "Confetti", emoji: "🎉" },
  { id: "shake", label: "Shake screen", emoji: "📳" },
  { id: "popup", label: "Show a popup", emoji: "💬" },
  { id: "toggle", label: "Show / hide", emoji: "👁️" },
  { id: "page", label: "Go to page", emoji: "📄" },
  { id: "view", label: "Vehicle view", emoji: "🔍" },
];
export const BACKGROUNDS = ["mesh", "gradient", "solid", "image"];
export const BLEND_MODES = ["normal", "screen", "overlay", "soft-light", "color-dodge"];
export const TRANSITIONS = ["fade", "slide", "zoom", "none"];

let counter = 0;
export const newId = (prefix = "e") =>
  `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// ---------------------------------------------------------------------------
// Element factories
// ---------------------------------------------------------------------------

const NAMES = { text: "Text", sticker: "Sticker", image: "Image", shape: "Shape", glass: "Glass panel", button: "Button", vehicle: "Vehicle" };

function base(type, props) {
  return {
    id: newId(),
    type,
    name: NAMES[type],
    x: 0,
    y: 0,
    w: 300,
    h: 120,
    rotation: 0,
    opacity: 1,
    hidden: false,
    locked: false,
    anim: { type: "none", speed: 1, delay: 0 },
    actions: [],
    group: null,
    ...props,
  };
}

export const DEFAULTS = {
  text: () => ({
    text: "Your text here",
    font: "Inter",
    size: 64,
    weight: 800,
    color: "#ffffff",
    align: "center",
    upper: false,
    spacing: 0,
    lineHeight: 1.15,
    stroke: { width: 0, color: "#000000" },
    shadow: { on: true, color: "#000000", blur: 18, x: 0, y: 6, opacity: 0.45 },
    bg: { on: false, color: "#000000", opacity: 0.5, pad: 16, radius: 16 },
  }),
  sticker: () => ({ emoji: "😂" }),
  image: () => ({
    asset: null,
    fit: "cover",
    radius: 0,
    border: { width: 0, color: "#ffffff" },
    shadow: false,
    flipX: false,
    flipY: false,
    filters: { brightness: 100, contrast: 100, saturate: 100, blur: 0, hue: 0, grayscale: 0 },
  }),
  shape: () => ({
    shape: "rect",
    fill: { type: "gradient", color: "#a78bfa", color2: "#22d3ee", angle: 135 },
    radius: 32,
    border: { width: 0, color: "#ffffff" },
    shadow: true,
  }),
  glass: () => ({
    frost: 20,
    fill: 0.08,
    shine: 0.24,
    radius: 32,
    tint: { colors: ["#8b5cf6", "#ec4899", "#22d3ee"], strength: 0.35, blend: "screen" },
    tilt: true,
  }),
  vehicle: () => ({
    vehicle: createVehicle("tank"),
    view: "normal",
    yaw: 35,
    pitch: 12,
    zoom: 1,
    spin: false,
    animate: true,
    ground: true,
  }),
  button: () => ({
    label: "Click me",
    icon: "✨",
    font: "Inter",
    size: 30,
    weight: 700,
    textColor: "#ffffff",
    variant: "glass",
    color: "#8b5cf6",
    color2: "#22d3ee",
    radius: 999,
    hover: "lift",
  }),
};

const SIZES = {
  text: [700, 160],
  sticker: [220, 220],
  image: [520, 400],
  shape: [360, 260],
  glass: [640, 420],
  button: [380, 104],
  vehicle: [760, 440],
};

/** A new element centred on the canvas. */
export function createElement(type, canvas, overrides = {}) {
  const [w, h] = SIZES[type];
  const scale = Math.min(1, (Math.min(canvas.w, canvas.h) * 0.8) / Math.max(w, h));
  const sw = Math.round(w * scale);
  const sh = Math.round(h * scale);
  const el = base(type, {
    ...DEFAULTS[type](),
    w: sw,
    h: sh,
    x: Math.round((canvas.w - sw) / 2),
    y: Math.round((canvas.h - sh) / 2),
  });
  if (type === "button") el.actions = [{ type: "confetti", amount: 120 }];
  return deepMerge(el, overrides);
}

export function createAction(type, project) {
  switch (type) {
    case "link":
      return { type, url: "https://" };
    case "sound":
      return { type, asset: null, volume: 1, stopOthers: false };
    case "confetti":
      return { type, amount: 120 };
    case "shake":
      return { type, strength: 1 };
    case "popup":
      return { type, emoji: "🎉", title: "Nice!", text: "You found the secret button.", button: "Close" };
    case "toggle":
      return { type, target: null, mode: "toggle" };
    case "page":
      return { type, target: "next" };
    case "view":
      return { type, target: null, view: "cycle" };
    default:
      return { type };
  }
}

export function createPage(name = "Page", bg) {
  return {
    id: newId("p"),
    name,
    transition: "fade",
    bg: {
      type: "mesh",
      color: "#08090e",
      colors: ["#8b5cf6", "#ec4899", "#22d3ee"],
      angle: 135,
      asset: null,
      fit: "cover",
      dim: 0,
      blur: 0,
      orbs: true,
      drift: 1,
      ...bg,
    },
    guides: { x: [], y: [] },
    elements: [],
  };
}

export function createProject({ name = "Untitled", w = 1080, h = 1080, pages } = {}) {
  return {
    name,
    canvas: { w, h },
    pages: pages ?? [createPage("Page 1")],
    assets: {},
  };
}

export function duplicateElement(el, offset = 24) {
  return { ...structuredClone(el), id: newId(), x: el.x + offset, y: el.y + offset, name: `${el.name} copy` };
}

export function duplicatePage(page) {
  const copy = structuredClone(page);
  copy.id = newId("p");
  copy.name = `${page.name} copy`;
  const ids = new Map();
  copy.elements.forEach((el) => {
    const id = newId();
    ids.set(el.id, id);
    el.id = id;
  });
  // Show/hide actions point at elements on the same page.
  copy.elements.forEach((el) =>
    el.actions.forEach((a) => {
      if (a.type === "toggle" && ids.has(a.target)) a.target = ids.get(a.target);
    }),
  );
  return copy;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const meme = (canvas, text, y, extra = {}) =>
  createElement("text", canvas, {
    text,
    font: "Impact",
    weight: 400,
    size: Math.round(canvas.w / 10),
    upper: true,
    stroke: { width: Math.max(4, Math.round(canvas.w / 160)), color: "#000000" },
    shadow: { on: false },
    x: Math.round(canvas.w * 0.04),
    w: Math.round(canvas.w * 0.92),
    h: Math.round(canvas.w / 5.5),
    y,
    name: "Caption",
    ...extra,
  });

export const TEMPLATES = [
  {
    id: "blank",
    label: "Blank canvas",
    emoji: "✨",
    hint: "Start from nothing",
    make: (size) => createProject({ name: "Untitled", ...size }),
  },
  {
    id: "meme",
    label: "Classic meme",
    emoji: "😂",
    hint: "Picture + top and bottom text",
    size: "meme",
    make: (size) => {
      const p = createProject({ name: "My meme", ...size });
      const c = p.canvas;
      const page = p.pages[0];
      page.bg = { ...page.bg, type: "solid", color: "#111111", orbs: false };
      page.elements.push(
        createElement("image", c, { x: 0, y: 0, w: c.w, h: c.h, name: "Meme picture", locked: false }),
        meme(c, "When the code works", Math.round(c.h * 0.03)),
        meme(c, "on the first try", Math.round(c.h * 0.97 - c.w / 5.5)),
      );
      return p;
    },
  },
  {
    id: "two-panel",
    label: "Two-panel",
    emoji: "🙅",
    hint: "Nah vs yeah reaction meme",
    size: "square",
    make: (size) => {
      const p = createProject({ name: "Two-panel meme", ...size });
      const c = p.canvas;
      const page = p.pages[0];
      page.bg = { ...page.bg, type: "solid", color: "#ffffff", orbs: false };
      const half = Math.round(c.h / 2);
      const col = Math.round(c.w / 2);
      const caption = (text, y) =>
        createElement("text", c, {
          text,
          font: "Inter",
          weight: 800,
          size: Math.round(c.w / 18),
          color: "#111111",
          shadow: { on: false },
          x: col + 24,
          y: y + 24,
          w: col - 48,
          h: half - 48,
          name: "Caption",
        });
      page.elements.push(
        createElement("image", c, { x: 0, y: 0, w: col, h: half, name: "Top picture" }),
        createElement("image", c, { x: 0, y: half, w: col, h: c.h - half, name: "Bottom picture" }),
        caption("Doing homework", 0),
        caption("Making memes about doing homework", half),
        createElement("sticker", c, { emoji: "🙅", x: col - 100, y: half - 220, w: 160, h: 160 }),
        createElement("sticker", c, { emoji: "👉", x: col - 100, y: c.h - 220, w: 160, h: 160 }),
      );
      return p;
    },
  },
  {
    id: "reaction",
    label: "Reaction",
    emoji: "😱",
    hint: "Huge emoji + punchline",
    size: "square",
    make: (size) => {
      const p = createProject({ name: "Reaction", ...size });
      const c = p.canvas;
      const page = p.pages[0];
      page.bg.colors = ["#f97316", "#f43f5e", "#facc15"];
      page.elements.push(
        createElement("sticker", c, {
          emoji: "😱",
          w: Math.round(c.w * 0.5),
          h: Math.round(c.w * 0.5),
          x: Math.round(c.w * 0.25),
          y: Math.round(c.h * 0.12),
          anim: { type: "wiggle", speed: 1, delay: 0 },
        }),
        createElement("text", c, {
          text: "Me seeing the group chat after 5 minutes",
          size: Math.round(c.w / 16),
          x: Math.round(c.w * 0.06),
          w: Math.round(c.w * 0.88),
          h: Math.round(c.h * 0.22),
          y: Math.round(c.h * 0.68),
        }),
      );
      return p;
    },
  },
  {
    id: "soundboard",
    label: "Soundboard",
    emoji: "🔊",
    hint: "Buttons that play sounds",
    size: "wide",
    make: (size) => {
      const p = createProject({ name: "Soundboard", ...size });
      const c = p.canvas;
      const page = p.pages[0];
      page.bg.colors = ["#6366f1", "#22d3ee", "#d946ef"];
      page.elements.push(
        createElement("text", c, { text: "My soundboard", size: Math.round(c.h / 11), y: Math.round(c.h * 0.08), h: Math.round(c.h / 7) }),
      );
      const labels = [["📯", "Airhorn"], ["🥁", "Ba dum tss"], ["😂", "Laugh"], ["🐐", "Goat"], ["💥", "Boom"], ["🦆", "Quack"]];
      const cols = 3;
      const bw = Math.round(c.w * 0.26);
      const bh = Math.round(c.h * 0.17);
      const gap = Math.round(c.w * 0.03);
      const left = Math.round((c.w - cols * bw - (cols - 1) * gap) / 2);
      labels.forEach(([icon, label], i) => {
        page.elements.push(
          createElement("button", c, {
            label,
            icon,
            w: bw,
            h: bh,
            radius: 28,
            size: Math.round(bh / 3.6),
            x: left + (i % cols) * (bw + gap),
            y: Math.round(c.h * 0.32) + Math.floor(i / cols) * (bh + gap),
            name: `${label} button`,
            actions: [{ type: "sound", asset: null, volume: 1, stopOthers: true }],
          }),
        );
      });
      page.elements.push(
        createElement("text", c, {
          text: "Tip: select a button and add a sound in “When clicked”",
          size: Math.round(c.h / 40),
          weight: 500,
          shadow: { on: false },
          y: Math.round(c.h * 0.88),
          h: Math.round(c.h / 18),
          color: "#cbd5f5",
        }),
      );
      return p;
    },
  },
  {
    id: "links",
    label: "Link hub",
    emoji: "🔗",
    hint: "Your links in one glass page",
    size: "story",
    make: (size) => {
      const p = createProject({ name: "My links", ...size });
      const c = p.canvas;
      const page = p.pages[0];
      page.elements.push(
        createElement("glass", c, { x: Math.round(c.w * 0.08), y: Math.round(c.h * 0.08), w: Math.round(c.w * 0.84), h: Math.round(c.h * 0.84) }),
        createElement("sticker", c, { emoji: "😎", w: 220, h: 220, x: Math.round(c.w / 2 - 110), y: Math.round(c.h * 0.13), anim: { type: "float", speed: 1, delay: 0 } }),
        createElement("text", c, { text: "@yourname", size: 72, y: Math.round(c.h * 0.27), h: 110 }),
        createElement("text", c, { text: "memes • games • glass", size: 36, weight: 500, y: Math.round(c.h * 0.32), h: 70, color: "#dbe4ff", shadow: { on: false } }),
      );
      [["▶️", "YouTube", "https://youtube.com"], ["🎮", "Discord", "https://discord.com"], ["📸", "Instagram", "https://instagram.com"], ["🎵", "TikTok", "https://tiktok.com"]].forEach(
        ([icon, label, url], i) =>
          page.elements.push(
            createElement("button", c, {
              label,
              icon,
              w: Math.round(c.w * 0.68),
              h: 130,
              radius: 36,
              size: 42,
              x: Math.round(c.w * 0.16),
              y: Math.round(c.h * 0.42) + i * 170,
              name: `${label} link`,
              actions: [{ type: "link", url }],
            }),
          ),
      );
      return p;
    },
  },
  {
    id: "quiz",
    label: "Quiz",
    emoji: "❓",
    hint: "Question with right and wrong pages",
    size: "wide",
    make: (size) => {
      const q = createPage("Question");
      const right = createPage("Correct", { colors: ["#34d399", "#22d3ee", "#a3e635"] });
      const wrong = createPage("Wrong", { colors: ["#f43f5e", "#f97316", "#a855f7"] });
      const p = createProject({ name: "Quiz", ...size, pages: [q, right, wrong] });
      const c = p.canvas;
      q.elements.push(
        createElement("glass", c, { x: Math.round(c.w * 0.12), y: Math.round(c.h * 0.12), w: Math.round(c.w * 0.76), h: Math.round(c.h * 0.76) }),
        createElement("text", c, { text: "Which one is a fruit?", size: Math.round(c.h / 11), y: Math.round(c.h * 0.22), h: Math.round(c.h / 6) }),
        createElement("button", c, { label: "Tomato", icon: "🍅", w: Math.round(c.w * 0.25), h: 140, size: 44, x: Math.round(c.w * 0.2), y: Math.round(c.h * 0.55), actions: [{ type: "page", target: right.id }] }),
        createElement("button", c, { label: "Carrot", icon: "🥕", w: Math.round(c.w * 0.25), h: 140, size: 44, x: Math.round(c.w * 0.55), y: Math.round(c.h * 0.55), actions: [{ type: "page", target: wrong.id }] }),
      );
      right.elements.push(
        createElement("text", c, { text: "Correct! 🎉", size: Math.round(c.h / 7), y: Math.round(c.h * 0.3), h: Math.round(c.h / 4), anim: { type: "pop", speed: 1, delay: 0 } }),
        createElement("button", c, { label: "Play again", icon: "🔁", w: 420, h: 120, size: 38, y: Math.round(c.h * 0.65), actions: [{ type: "confetti", amount: 160 }, { type: "page", target: q.id }] }),
      );
      wrong.elements.push(
        createElement("text", c, { text: "Nope! Tomatoes are fruit 🍅", size: Math.round(c.h / 12), y: Math.round(c.h * 0.3), h: Math.round(c.h / 4), anim: { type: "shake", speed: 1, delay: 0 } }),
        createElement("button", c, { label: "Try again", icon: "↩️", w: 420, h: 120, size: 38, y: Math.round(c.h * 0.65), actions: [{ type: "page", target: q.id }] }),
      );
      return p;
    },
  },
  {
    id: "glass-card",
    label: "Glass card",
    emoji: "🫧",
    hint: "The original AuraDrop card",
    size: "card",
    make: (size) => {
      const p = createProject({ name: "Glass card", ...size });
      const c = p.canvas;
      const page = p.pages[0];
      const gw = Math.round(c.w * 0.56);
      const gh = Math.round(c.h * 0.56);
      const gx = Math.round((c.w - gw) / 2);
      const gy = Math.round((c.h - gh) / 2);
      page.elements.push(
        createElement("glass", c, { x: gx, y: gy, w: gw, h: gh }),
        createElement("sticker", c, { emoji: "✨", x: gx + 44, y: gy + 40, w: 90, h: 90 }),
        createElement("text", c, { text: "Hello, Aura", size: 52, align: "left", x: gx + 48, y: gy + 150, w: gw - 96, h: 70, shadow: { on: false } }),
        createElement("text", c, { text: "Glass that leans toward your cursor.", size: 26, weight: 500, align: "left", color: "#dbe4ff", x: gx + 48, y: gy + 220, w: gw - 96, h: 50, shadow: { on: false } }),
        createElement("button", c, { label: "Let's go", icon: "", w: 200, h: 64, size: 24, x: gx + 48, y: gy + gh - 104, actions: [{ type: "confetti", amount: 120 }] }),
      );
      return p;
    },
  },
];

TEMPLATES.splice(1, 0,
  {
    id: "tank-card",
    label: "Tank card",
    emoji: "🪖",
    hint: "A 3D tank with its stats and BR",
    size: "card",
    make: (size) => {
      const p = createProject({ name: "Tank card", ...size });
      p.pages[0].bg = { ...p.pages[0].bg, type: "gradient", colors: ["#2b2f1f", "#0b0c12"], angle: 160 };
      const v = PRESET_FOR_TEMPLATES[0] ?? createVehicle("tank", { name: "My tank" });
      p.pages[0].elements = vehicleCardFactory ? vehicleCardFactory(v, p.canvas) : [createElement("vehicle", p.canvas, { vehicle: v, name: v.name })];
      return p;
    },
  },
  {
    id: "versus",
    label: "Versus",
    emoji: "⚔️",
    hint: "Two tanks face off – click to see armour",
    size: "wide",
    make: (size) => {
      const p = createProject({ name: "Tiger vs Sherman", ...size });
      const c = p.canvas;
      const pg = p.pages[0];
      pg.bg = { ...pg.bg, colors: ["#f97316", "#8b5cf6", "#0ea5e9"] };
      const [a, b] = PRESET_FOR_TEMPLATES.length ? PRESET_FOR_TEMPLATES : [createVehicle("tank", { name: "Tank A" }), createVehicle("tank", { name: "Tank B" })];
      const left = createElement("vehicle", c, { vehicle: a, name: a?.name, x: Math.round(c.w * 0.02), y: Math.round(c.h * 0.22), w: Math.round(c.w * 0.46), h: Math.round(c.h * 0.55), yaw: 30 });
      const right = createElement("vehicle", c, { vehicle: b, name: b?.name, x: Math.round(c.w * 0.52), y: Math.round(c.h * 0.22), w: Math.round(c.w * 0.46), h: Math.round(c.h * 0.55), yaw: 150 });
      pg.elements.push(
        left,
        right,
        createElement("text", c, { text: "VS", font: "Bangers", weight: 400, size: Math.round(c.h / 5), x: Math.round(c.w * 0.4), w: Math.round(c.w * 0.2), y: Math.round(c.h * 0.36), h: Math.round(c.h * 0.25), anim: { type: "pulse", speed: 1, delay: 0 } }),
        createElement("text", c, { text: a?.name ?? "", font: "Bebas Neue", weight: 400, size: Math.round(c.h / 12), x: Math.round(c.w * 0.04), w: Math.round(c.w * 0.42), y: Math.round(c.h * 0.08), h: Math.round(c.h / 9) }),
        createElement("text", c, { text: b?.name ?? "", font: "Bebas Neue", weight: 400, size: Math.round(c.h / 12), x: Math.round(c.w * 0.54), w: Math.round(c.w * 0.42), y: Math.round(c.h * 0.08), h: Math.round(c.h / 9) }),
        createElement("button", c, { label: "Armour", icon: "🛡️", w: 300, h: 90, size: 30, x: Math.round(c.w * 0.1), y: Math.round(c.h * 0.82), actions: [{ type: "view", target: left.id, view: "cycle" }] }),
        createElement("button", c, { label: "Armour", icon: "🛡️", w: 300, h: 90, size: 30, x: Math.round(c.w * 0.62), y: Math.round(c.h * 0.82), actions: [{ type: "view", target: right.id, view: "cycle" }] }),
      );
      return p;
    },
  },
);

// Filled in by the app (keeps this module free of the stats/card code).
let vehicleCardFactory = null;
let PRESET_FOR_TEMPLATES = [];
export function registerVehicleTemplates(cardFn, presets) {
  vehicleCardFactory = cardFn;
  PRESET_FOR_TEMPLATES = presets;
}

export function makeFromTemplate(templateId, presetId) {
  const t = TEMPLATES.find((x) => x.id === templateId) ?? TEMPLATES[0];
  const preset = CANVAS_PRESETS.find((x) => x.id === (presetId ?? t.size)) ?? CANVAS_PRESETS[0];
  return t.make({ w: preset.w, h: preset.h });
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

export function serializeProject(project) {
  return JSON.stringify({ app: FILE_APP_ID, version: FILE_VERSION, savedAt: new Date().toISOString(), project });
}

/**
 * Parse a .auradrop file (current or the original single-card format).
 * Everything is validated and clamped: files may come from anyone.
 */
export function parseProjectFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This file isn't valid AuraDrop JSON.");
  }
  if (!data || data.app !== FILE_APP_ID) throw new Error("This isn't an AuraDrop file.");
  if (typeof data.version !== "number" || data.version > FILE_VERSION) {
    throw new Error("This file was made with a newer AuraDrop. Please update the app.");
  }
  if (data.version === 1) return sanitizeProject(migrateV1(data.design ?? {}));
  return sanitizeProject(data.project);
}

/** Version 1 files held a single glass card. Rebuild it as a project. */
export function migrateV1(d) {
  const p = createProject({ name: "Glass card", w: 1200, h: 800 });
  const c = p.canvas;
  const page = p.pages[0];
  const aura = d.aura ?? {};
  const colors = Array.isArray(aura.points) ? aura.points.map((pt) => pt?.color).filter(isHex) : [];
  if (colors.length >= 2) page.bg.colors = colors.slice(0, 5);
  page.bg.orbs = aura.orbs !== false;
  page.bg.drift = num(aura.drift, 0, 2, 1);
  const content = d.content ?? {};
  const gw = num(d.width, 240, 520, 380) * 1.6;
  const gh = num(d.height, 160, 420, 240) * 1.6;
  const gx = Math.round((c.w - gw) / 2);
  const gy = Math.round((c.h - gh) / 2);
  const assets = p.assets;
  const addAsset = (data) => {
    if (typeof data !== "string" || !data.startsWith("data:image/")) return null;
    const id = newId("a");
    assets[id] = { kind: "image", name: "image", data };
    return id;
  };
  const vibes = d.vibes ?? {};
  page.elements.push(
    createElement("glass", c, {
      x: gx,
      y: gy,
      w: gw,
      h: gh,
      frost: num(d.frost, 0, 40, 18),
      fill: num(d.fill, 0, 0.3, 0.08),
      shine: num(d.shine, 0, 0.6, 0.22),
      radius: num(d.radius, 0, 60, 24) * 1.6,
      tint: { colors: colors.length >= 2 ? colors.slice(0, 5) : ["#8b5cf6", "#ec4899", "#22d3ee"], strength: num(aura.strength, 0, 1, 0.35), blend: BLEND_MODES.includes(aura.blend) ? aura.blend : "screen" },
      tilt: d.tilt?.enabled !== false,
      anim: { type: vibes.levitate ? "float" : vibes.pulse ? "pulse" : "none", speed: 1, delay: 0 },
    }),
  );
  const bgAsset = addAsset(content.background);
  if (bgAsset) {
    page.elements.push(createElement("image", c, { asset: bgAsset, x: gx, y: gy, w: gw, h: gh, radius: num(d.radius, 0, 60, 24) * 1.6, opacity: num(content.backgroundOpacity, 0, 1, 0.55) }));
  }
  const avatar = addAsset(content.avatar);
  if (avatar) page.elements.push(createElement("image", c, { asset: avatar, x: gx + 45, y: gy + 45, w: 90, h: 90, radius: 45 }));
  else if (content.emoji) page.elements.push(createElement("sticker", c, { emoji: String(content.emoji).slice(0, 8), x: gx + 45, y: gy + 40, w: 90, h: 90 }));
  if (content.title) page.elements.push(createElement("text", c, { text: String(content.title).slice(0, 200), size: 36, align: "left", x: gx + 45, y: gy + 150, w: gw - 90, h: 54, shadow: { on: false } }));
  if (content.subtitle) page.elements.push(createElement("text", c, { text: String(content.subtitle).slice(0, 500), size: 22, weight: 500, align: "left", color: "#dbe4ff", x: gx + 45, y: gy + 208, w: gw - 90, h: 90, shadow: { on: false } }));
  if (content.button) page.elements.push(createElement("button", c, { label: String(content.button).slice(0, 60), icon: "", w: 190, h: 58, size: 22, x: gx + 45, y: gy + gh - 100 }));
  return p;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const MAX_ELEMENTS = 400;
const MAX_PAGES = 50;

function num(v, min, max, fallback) {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}
const str = (v, fallback, max = 500) => (typeof v === "string" ? v.slice(0, max) : fallback);
const bool = (v, fallback) => (typeof v === "boolean" ? v : fallback);
const pick = (v, list, fallback) => (list.includes(v) ? v : fallback);
export const isHex = (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
const color = (v, fallback) => (isHex(v) ? v.toLowerCase() : fallback);
const id = (v) => (typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : newId());

/** Only web and mail links can be opened from a project. */
export function safeUrl(url) {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  try {
    const u = new URL(trimmed);
    return ["http:", "https:", "mailto:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

function sanitizeAction(a, pageIds) {
  if (!a || typeof a !== "object") return null;
  switch (a.type) {
    case "link":
      return { type: "link", url: str(a.url, "https://", 2000) };
    case "sound":
      return { type: "sound", asset: typeof a.asset === "string" ? a.asset : null, volume: num(a.volume, 0, 1, 1), stopOthers: bool(a.stopOthers, false) };
    case "confetti":
      return { type: "confetti", amount: num(a.amount, 10, 500, 120) };
    case "shake":
      return { type: "shake", strength: num(a.strength, 0.2, 3, 1) };
    case "popup":
      return { type: "popup", emoji: str(a.emoji, "", 16), title: str(a.title, "", 120), text: str(a.text, "", 1000), button: str(a.button, "Close", 40) || "Close" };
    case "toggle":
      return { type: "toggle", target: typeof a.target === "string" ? a.target : null, mode: pick(a.mode, ["toggle", "show", "hide"], "toggle") };
    case "page":
      return { type: "page", target: ["next", "prev", "first"].includes(a.target) || pageIds.has(a.target) ? a.target : "next" };
    case "view":
      return { type: "view", target: typeof a.target === "string" ? a.target : null, view: pick(a.view, ["cycle", "normal", "armor", "xray"], "cycle") };
    default:
      return null;
  }
}

function sanitizeElement(e, pageIds) {
  if (!e || typeof e !== "object" || !ELEMENT_TYPES.includes(e.type)) return null;
  const d = DEFAULTS[e.type]();
  const out = {
    id: id(e.id),
    type: e.type,
    name: str(e.name, NAMES[e.type], 80) || NAMES[e.type],
    x: num(e.x, -10000, 10000, 0),
    y: num(e.y, -10000, 10000, 0),
    w: num(e.w, 4, 10000, 200),
    h: num(e.h, 4, 10000, 100),
    rotation: num(e.rotation, -3600, 3600, 0),
    opacity: num(e.opacity, 0, 1, 1),
    hidden: bool(e.hidden, false),
    locked: bool(e.locked, false),
    anim: {
      type: pick(e.anim?.type, ANIMATIONS.map((a) => a.id), "none"),
      speed: num(e.anim?.speed, 0.1, 5, 1),
      delay: num(e.anim?.delay, 0, 30, 0),
    },
    actions: Array.isArray(e.actions) ? e.actions.slice(0, 20).map((a) => sanitizeAction(a, pageIds)).filter(Boolean) : [],
    group: typeof e.group === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(e.group) ? e.group : null,
  };
  const sub = (obj, defaults, rules) =>
    Object.fromEntries(Object.entries(defaults).map(([k, v]) => [k, rules[k] ? rules[k](obj?.[k], v) : v]));
  switch (e.type) {
    case "text":
      Object.assign(out, {
        text: str(e.text, d.text, 2000),
        font: pick(e.font, FONTS.map((f) => f.id), d.font),
        size: num(e.size, 4, 800, d.size),
        weight: num(e.weight, 100, 900, d.weight),
        color: color(e.color, d.color),
        align: pick(e.align, ["left", "center", "right"], d.align),
        upper: bool(e.upper, d.upper),
        spacing: num(e.spacing, -20, 100, 0),
        lineHeight: num(e.lineHeight, 0.6, 3, d.lineHeight),
        stroke: { width: num(e.stroke?.width, 0, 40, 0), color: color(e.stroke?.color, "#000000") },
        shadow: {
          on: bool(e.shadow?.on, false),
          color: color(e.shadow?.color, "#000000"),
          blur: num(e.shadow?.blur, 0, 100, 18),
          x: num(e.shadow?.x, -100, 100, 0),
          y: num(e.shadow?.y, -100, 100, 6),
          opacity: num(e.shadow?.opacity, 0, 1, 0.45),
        },
        bg: {
          on: bool(e.bg?.on, false),
          color: color(e.bg?.color, "#000000"),
          opacity: num(e.bg?.opacity, 0, 1, 0.5),
          pad: num(e.bg?.pad, 0, 200, 16),
          radius: num(e.bg?.radius, 0, 200, 16),
        },
      });
      break;
    case "sticker":
      out.emoji = str(e.emoji, d.emoji, 16) || d.emoji;
      break;
    case "image":
      Object.assign(out, {
        asset: typeof e.asset === "string" ? e.asset : null,
        fit: pick(e.fit, ["cover", "contain", "fill"], "cover"),
        radius: num(e.radius, 0, 5000, 0),
        border: { width: num(e.border?.width, 0, 100, 0), color: color(e.border?.color, "#ffffff") },
        shadow: bool(e.shadow, false),
        flipX: bool(e.flipX, false),
        flipY: bool(e.flipY, false),
        filters: sub(e.filters, d.filters, {
          brightness: (v, f) => num(v, 0, 300, f),
          contrast: (v, f) => num(v, 0, 300, f),
          saturate: (v, f) => num(v, 0, 300, f),
          blur: (v, f) => num(v, 0, 50, f),
          hue: (v, f) => num(v, -180, 180, f),
          grayscale: (v, f) => num(v, 0, 100, f),
        }),
      });
      break;
    case "shape":
      Object.assign(out, {
        shape: pick(e.shape, SHAPES, "rect"),
        fill: {
          type: pick(e.fill?.type, ["solid", "gradient"], "solid"),
          color: color(e.fill?.color, d.fill.color),
          color2: color(e.fill?.color2, d.fill.color2),
          angle: num(e.fill?.angle, 0, 360, 135),
        },
        radius: num(e.radius, 0, 5000, 0),
        border: { width: num(e.border?.width, 0, 100, 0), color: color(e.border?.color, "#ffffff") },
        shadow: bool(e.shadow, false),
      });
      break;
    case "glass":
      Object.assign(out, {
        frost: num(e.frost, 0, 60, d.frost),
        fill: num(e.fill, 0, 0.5, d.fill),
        shine: num(e.shine, 0, 0.8, d.shine),
        radius: num(e.radius, 0, 5000, d.radius),
        tint: {
          colors: Array.isArray(e.tint?.colors) && e.tint.colors.filter(isHex).length >= 1 ? e.tint.colors.filter(isHex).slice(0, 5) : d.tint.colors,
          strength: num(e.tint?.strength, 0, 1, d.tint.strength),
          blend: pick(e.tint?.blend, BLEND_MODES, d.tint.blend),
        },
        tilt: bool(e.tilt, true),
      });
      break;
    case "vehicle":
      Object.assign(out, {
        vehicle: sanitizeVehicle(e.vehicle),
        view: pick(e.view, ["normal", "armor", "xray"], "normal"),
        yaw: num(e.yaw, -360, 360, 35),
        pitch: num(e.pitch, -10, 80, 12),
        zoom: num(e.zoom, 0.4, 3, 1),
        spin: bool(e.spin, false),
        animate: bool(e.animate, true),
        ground: bool(e.ground, true),
      });
      break;
    case "button":
      Object.assign(out, {
        label: str(e.label, d.label, 120),
        icon: str(e.icon, "", 16),
        font: pick(e.font, FONTS.map((f) => f.id), d.font),
        size: num(e.size, 6, 300, d.size),
        weight: num(e.weight, 100, 900, d.weight),
        textColor: color(e.textColor, d.textColor),
        variant: pick(e.variant, ["glass", "solid", "gradient", "outline"], d.variant),
        color: color(e.color, d.color),
        color2: color(e.color2, d.color2),
        radius: num(e.radius, 0, 5000, d.radius),
        hover: pick(e.hover, ["lift", "glow", "grow", "none"], d.hover),
      });
      break;
  }
  return out;
}

function sanitizePage(p, pageIds, index) {
  const d = createPage();
  const bg = p?.bg ?? {};
  return {
    id: pageIds.list[index],
    name: str(p?.name, `Page ${index + 1}`, 60) || `Page ${index + 1}`,
    transition: pick(p?.transition, TRANSITIONS, "fade"),
    bg: {
      type: pick(bg.type, BACKGROUNDS, "mesh"),
      color: color(bg.color, d.bg.color),
      colors: Array.isArray(bg.colors) && bg.colors.filter(isHex).length >= 1 ? bg.colors.filter(isHex).slice(0, 5) : d.bg.colors,
      angle: num(bg.angle, 0, 360, 135),
      asset: typeof bg.asset === "string" ? bg.asset : null,
      fit: pick(bg.fit, ["cover", "contain"], "cover"),
      dim: num(bg.dim, 0, 1, 0),
      blur: num(bg.blur, 0, 60, 0),
      orbs: bool(bg.orbs, true),
      drift: num(bg.drift, 0, 3, 1),
    },
    guides: {
      x: Array.isArray(p?.guides?.x) ? p.guides.x.filter((v) => typeof v === "number" && Number.isFinite(v)).slice(0, 50).map((v) => Math.round(v)) : [],
      y: Array.isArray(p?.guides?.y) ? p.guides.y.filter((v) => typeof v === "number" && Number.isFinite(v)).slice(0, 50).map((v) => Math.round(v)) : [],
    },
    elements: Array.isArray(p?.elements)
      ? p.elements.slice(0, MAX_ELEMENTS).map((e) => sanitizeElement(e, pageIds.set)).filter(Boolean)
      : [],
  };
}

export function sanitizeProject(input) {
  const src = input && typeof input === "object" ? input : {};
  const rawPages = Array.isArray(src.pages) && src.pages.length ? src.pages.slice(0, MAX_PAGES) : [createPage("Page 1")];
  const list = rawPages.map((p) => id(p?.id));
  // Duplicate ids would confuse page targets; regenerate them.
  const seen = new Set();
  list.forEach((pid, i) => {
    if (seen.has(pid)) list[i] = newId("p");
    seen.add(list[i]);
  });
  const pageIds = { list, set: new Set(list) };

  const assets = {};
  if (src.assets && typeof src.assets === "object") {
    for (const [key, a] of Object.entries(src.assets)) {
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(key) || !a || typeof a.data !== "string") continue;
      const isImage = a.data.startsWith("data:image/");
      const isAudio = a.data.startsWith("data:audio/");
      if (!isImage && !isAudio) continue;
      assets[key] = { kind: isImage ? "image" : "audio", name: str(a.name, "file", 120), data: a.data };
    }
  }

  const project = {
    name: str(src.name, "Untitled", 120) || "Untitled",
    canvas: {
      w: Math.round(num(src.canvas?.w, CANVAS_LIMITS.min, CANVAS_LIMITS.max, 1080)),
      h: Math.round(num(src.canvas?.h, CANVAS_LIMITS.min, CANVAS_LIMITS.max, 1080)),
    },
    pages: rawPages.map((p, i) => sanitizePage(p, pageIds, i)),
    assets,
  };

  // Element ids must be unique; references to missing assets are cleared.
  const ids = new Set();
  for (const page of project.pages) {
    for (const el of page.elements) {
      if (ids.has(el.id)) el.id = newId();
      ids.add(el.id);
      if ((el.type === "image") && el.asset && assets[el.asset]?.kind !== "image") el.asset = null;
      el.actions.forEach((a) => {
        if (a.type === "sound" && a.asset && assets[a.asset]?.kind !== "audio") a.asset = null;
      });
    }
    if (page.bg.asset && assets[page.bg.asset]?.kind !== "image") page.bg.asset = null;
  }
  return project;
}

/** Drop assets nothing refers to (after deleting images or sounds). */
export function pruneAssets(project) {
  const used = new Set();
  for (const page of project.pages) {
    if (page.bg.asset) used.add(page.bg.asset);
    for (const el of page.elements) {
      if (el.asset) used.add(el.asset);
      el.actions.forEach((a) => a.asset && used.add(a.asset));
    }
  }
  const assets = Object.fromEntries(Object.entries(project.assets).filter(([k]) => used.has(k)));
  return Object.keys(assets).length === Object.keys(project.assets).length ? project : { ...project, assets };
}

export function deepMerge(target, patch) {
  const out = { ...target };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) && target[k] && typeof target[k] === "object" && !Array.isArray(target[k])
      ? deepMerge(target[k], v)
      : v;
  }
  return out;
}

export function fontCss(fontId) {
  return (FONTS.find((f) => f.id === fontId) ?? FONTS[0]).css;
}
