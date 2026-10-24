// Code generation. `generateCss` is also injected into the live stage, so
// what you see while designing is exactly what you copy out.

import { borderAlpha, boxShadow, CARD_LAYOUT, meshGradient, orbLayout, round } from "./design.js";

export const PLACEHOLDER_BACKGROUND = "aura-background.png";
export const PLACEHOLDER_AVATAR = "aura-avatar.png";

const SPRING_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";
/** The card's font, so pasted code looks exactly like the preview. */
export const FONT_CSS_URL = "https://fonts.googleapis.com/css2?family=Inter:wght@400..700&display=swap";
const FONT_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="${FONT_CSS_URL}" />`;
const DRIFT_BASE_SECONDS = 26;

/**
 * CSS value for a user image. "inline" embeds the data URL, "placeholder"
 * points at a file name for exported code, and "live" reads a custom property
 * so the stage doesn't re-parse a multi-megabyte stylesheet on every slider move.
 */
function imageValue(dataUrl, placeholder, mode, liveVar) {
  if (!dataUrl) return null;
  if (mode === "live") return `var(${liveVar})`;
  return `url("${mode === "inline" ? dataUrl : placeholder}")`;
}

function driftDuration(aura) {
  return aura.drift > 0 ? `${round(DRIFT_BASE_SECONDS / aura.drift, 1)}s` : null;
}

function floatAnimations(vibes) {
  const list = [];
  if (vibes.levitate) list.push("aura-levitate 4.5s ease-in-out infinite");
  if (vibes.pulse) list.push("aura-pulse 5s ease-in-out infinite");
  return list;
}

function glowAnimations(vibes) {
  const list = [];
  if (vibes.pulse) list.push("aura-glow 5s ease-in-out infinite");
  if (vibes.shimmer) list.push("aura-neon 3.2s ease-in-out infinite");
  return list;
}

const usesGlow = (vibes) => vibes.pulse || vibes.shimmer;

// ---------------------------------------------------------------------------
// Keyframes (shared by every export format)
// ---------------------------------------------------------------------------

export function keyframesCss(design) {
  const { vibes, aura } = design;
  const blocks = [];
  if (aura.orbs && aura.drift > 0) {
    blocks.push(`@keyframes aura-drift-0 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(6%, -8%) scale(1.12); }
  66% { transform: translate(-5%, 6%) scale(0.92); }
}
@keyframes aura-drift-1 {
  0%, 100% { transform: translate(0, 0) scale(1.05); }
  50% { transform: translate(-9%, -5%) scale(0.9); }
}
@keyframes aura-drift-2 {
  0%, 100% { transform: translate(0, 0) scale(0.95); }
  40% { transform: translate(7%, 7%) scale(1.15); }
  75% { transform: translate(-4%, -3%) scale(1); }
}`);
  }
  if (vibes.levitate) {
    blocks.push(`@keyframes aura-levitate {
  0%, 100% { translate: 0 0; }
  50% { translate: 0 -12px; }
}`);
  }
  if (vibes.pulse) {
    blocks.push(`@keyframes aura-pulse {
  0%, 100% { scale: 1; }
  50% { scale: 1.03; }
}
@keyframes aura-glow {
  0%, 100% { opacity: 0.25; }
  50% { opacity: 0.7; }
}`);
  }
  if (vibes.shimmer) {
    blocks.push(`@keyframes aura-shimmer {
  0% { background-position: 160% 0; }
  60%, 100% { background-position: -60% 0; }
}
@keyframes aura-neon {
  0%, 100% { filter: blur(26px) hue-rotate(0deg); }
  50% { filter: blur(30px) hue-rotate(40deg); }
}`);
  }
  return blocks.join("\n");
}

// ---------------------------------------------------------------------------
// Plain CSS
// ---------------------------------------------------------------------------

/**
 * @param {object} design
 * @param {{ images?: "inline" | "placeholder" | "live", scene?: boolean }} opts
 */
export function generateCss(design, opts = {}) {
  const { images = "placeholder", scene = true } = opts;
  const { aura, vibes, content } = design;
  const L = CARD_LAYOUT;
  const bg = imageValue(content.background, PLACEHOLDER_BACKGROUND, images, "--aura-bg-image");
  const avatar = imageValue(content.avatar, PLACEHOLDER_AVATAR, images, "--aura-avatar-image");
  const out = [];

  if (scene) {
    out.push(`.aura-scene {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 520px;
  overflow: hidden;
  background: #08090e;
}`);
    if (aura.orbs) {
      const duration = driftDuration(aura);
      out.push(`.aura-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  opacity: 0.6;
  pointer-events: none;${duration ? `\n  animation: ${duration} ease-in-out infinite;` : ""}
}`);
      orbLayout(aura).forEach((orb, i) => {
        out.push(`.aura-orb--${i + 1} {
  left: ${round(orb.left, 1)}%;
  top: ${round(orb.top, 1)}%;
  width: ${orb.size}px;
  height: ${orb.size}px;
  margin: -${orb.size / 2}px 0 0 -${orb.size / 2}px;
  background: radial-gradient(circle, ${orb.color} 0%, transparent 70%);${
    duration ? `\n  animation-name: aura-drift-${orb.path};\n  animation-delay: ${orb.delay}s;` : ""
  }
}`);
      });
    }
  }

  const floatAnims = floatAnimations(vibes);
  out.push(`.aura-float {
  position: relative;
  z-index: 0;${floatAnims.length ? `\n  animation: ${floatAnims.join(", ")};` : ""}
}`);

  if (usesGlow(vibes)) {
    out.push(`.aura-glow {
  position: absolute;
  inset: -14px;
  z-index: -1;
  border-radius: ${design.radius + 14}px;
  background: ${meshGradient(aura)};
  filter: blur(26px);
  opacity: 0.45;
  pointer-events: none;
  animation: ${glowAnimations(vibes).join(", ")};
}`);
  }

  out.push(`.aura-card {
  position: relative;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: ${design.width}px;
  height: ${design.height}px;
  padding: ${L.padding}px;
  overflow: hidden;
  border-radius: ${design.radius}px;
  border: 1px solid rgba(255, 255, 255, ${borderAlpha(design)});
  background: rgba(255, 255, 255, ${round(design.fill, 3)});
  -webkit-backdrop-filter: blur(${design.frost}px) saturate(160%);
  backdrop-filter: blur(${design.frost}px) saturate(160%);
  box-shadow: ${boxShadow(design)};
  color: #fff;
  font-family: ${L.fontFamily};
  transform: perspective(1000px) rotateX(0deg) rotateY(0deg);
  will-change: transform;${
    vibes.squish ? `\n  transition: scale 0.45s ${SPRING_EASE};\n  cursor: pointer;` : ""
  }
}`);
  if (vibes.squish) {
    out.push(`.aura-card:active {
  scale: 0.96;
  transition-duration: 0.12s;
}`);
  }

  out.push(`.aura-card__layer {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
}`);
  if (bg) {
    out.push(`.aura-card__bg {
  background: ${bg} center / cover no-repeat;
  opacity: ${round(content.backgroundOpacity, 2)};
}`);
  }
  out.push(`.aura-card__tint {
  background: ${meshGradient(aura)};
  mix-blend-mode: ${aura.blend};
  opacity: ${round(aura.strength, 2)};
}`);
  if (vibes.shimmer) {
    out.push(`.aura-card__shimmer {
  background: linear-gradient(105deg, transparent 38%, rgba(255, 255, 255, 0.38) 50%, transparent 62%);
  background-size: 250% 100%;
  mix-blend-mode: screen;
  animation: aura-shimmer 3.2s ease-in-out infinite;
}`);
  }
  const glare = round(Math.min(0.75, design.shine * 1.6), 2);
  out.push(`.aura-card__glare {
  background:
    radial-gradient(circle at var(--aura-gx, 28%) var(--aura-gy, 18%), rgba(255, 255, 255, ${glare}) 0%, transparent 55%),
    linear-gradient(var(--aura-ga, 160deg), rgba(255, 255, 255, ${round(glare * 0.5, 2)}) 0%, transparent 55%);
  opacity: var(--aura-gi, 0.55);
}`);

  out.push(`.aura-card__content {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}
.aura-card__avatar {
  display: grid;
  place-items: center;
  flex: none;
  width: ${L.avatar}px;
  height: ${L.avatar}px;
  margin-bottom: ${L.gap}px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: ${avatar ? `${avatar} center / cover no-repeat` : "rgba(255, 255, 255, 0.14)"};
  font-size: 28px;
  line-height: 1;
}
.aura-card__title {
  margin: 0;
  font-size: ${L.titleSize}px;
  font-weight: 650;
  line-height: 1.25;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.aura-card__subtitle {
  display: -webkit-box;
  margin: 6px 0 0;
  overflow: hidden;
  font-size: ${L.subtitleSize}px;
  line-height: 1.45;
  opacity: 0.75;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: ${L.subtitleLines};
}
.aura-card__button {
  align-self: flex-start;
  height: ${L.buttonHeight}px;
  margin-top: auto;
  padding: 0 ${L.buttonPadX}px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  color: inherit;
  font: 600 ${L.buttonSize}px/1 ${L.fontFamily};
  cursor: pointer;
  transition: scale 0.3s ${SPRING_EASE}, background 0.2s;
}
.aura-card__button:hover { background: rgba(255, 255, 255, 0.26); }
.aura-card__button:active { scale: 0.96; }`);

  const keyframes = keyframesCss(design);
  if (keyframes) out.push(keyframes);

  out.push(`@media (prefers-reduced-motion: reduce) {
  .aura-orb, .aura-float, .aura-glow, .aura-card__shimmer { animation: none; }
}`);

  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cardMarkup(design, cls, indent) {
  const { content, vibes } = design;
  const pad = (n) => " ".repeat(indent + n);
  const lines = [];
  lines.push(`${pad(0)}<div class="${cls.float}">`);
  if (usesGlow(vibes)) lines.push(`${pad(2)}<div class="${cls.glow}"></div>`);
  lines.push(`${pad(2)}<div class="${cls.card}"${design.tilt.enabled ? " data-aura-tilt" : ""}>`);
  if (content.background) lines.push(`${pad(4)}<div class="${cls.bg}"></div>`);
  lines.push(`${pad(4)}<div class="${cls.tint}"></div>`);
  if (vibes.shimmer) lines.push(`${pad(4)}<div class="${cls.shimmer}"></div>`);
  lines.push(`${pad(4)}<div class="${cls.glare}"></div>`);
  lines.push(`${pad(4)}<div class="${cls.content}">`);
  const avatarText = content.avatar ? "" : escapeHtml(content.emoji);
  if (content.avatar || content.emoji) {
    lines.push(`${pad(6)}<div class="${cls.avatar}" aria-hidden="true">${avatarText}</div>`);
  }
  if (content.title) lines.push(`${pad(6)}<h3 class="${cls.title}">${escapeHtml(content.title)}</h3>`);
  if (content.subtitle) lines.push(`${pad(6)}<p class="${cls.subtitle}">${escapeHtml(content.subtitle)}</p>`);
  if (content.button) {
    lines.push(`${pad(6)}<button class="${cls.button}" type="button">${escapeHtml(content.button)}</button>`);
  }
  lines.push(`${pad(4)}</div>`);
  lines.push(`${pad(2)}</div>`);
  lines.push(`${pad(0)}</div>`);
  return lines;
}

const BEM = {
  scene: "aura-scene",
  orb: (i) => `aura-orb aura-orb--${i + 1}`,
  float: "aura-float",
  glow: "aura-glow",
  card: "aura-card",
  bg: "aura-card__layer aura-card__bg",
  tint: "aura-card__layer aura-card__tint",
  shimmer: "aura-card__layer aura-card__shimmer",
  glare: "aura-card__layer aura-card__glare",
  content: "aura-card__content",
  avatar: "aura-card__avatar",
  title: "aura-card__title",
  subtitle: "aura-card__subtitle",
  button: "aura-card__button",
};

function sceneMarkup(design, cls) {
  const lines = [`<div class="${cls.scene}" data-aura-scene>`];
  if (design.aura.orbs) {
    design.aura.points.forEach((_, i) => lines.push(`  <div class="${cls.orb(i)}"></div>`));
  }
  lines.push(...cardMarkup(design, cls, 2));
  lines.push("</div>");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Tilt script (optional in HTML / Tailwind exports)
// ---------------------------------------------------------------------------

export function tiltScript(design) {
  return `<script>
  // AuraDrop tilt: spring-smoothed 3D tilt with a glare that follows the cursor.
  (() => {
    const MAX = ${design.tilt.max}, K = 170, D = 18;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.querySelectorAll("[data-aura-tilt]").forEach((card) => {
      const anchor = card.parentElement;
      const area = card.closest("[data-aura-scene]") || anchor;
      const s = { rx: [0, 0], ry: [0, 0], gx: [28, 0], gy: [18, 0], gi: [0.55, 0] };
      const t = { rx: 0, ry: 0, gx: 28, gy: 18, gi: 0.55 };
      let raf = 0, last = 0;
      const step = (now) => {
        const dt = last ? Math.min(0.032, (now - last) / 1000) : 1 / 60;
        last = now;
        let moving = false;
        for (const k in s) {
          const [v, vel] = s[k];
          const nv = vel + (-K * (v - t[k]) - D * vel) * dt;
          s[k] = [v + nv * dt, nv];
          if (Math.abs(s[k][0] - t[k]) > 0.01 || Math.abs(nv) > 0.01) moving = true;
        }
        const ga = Math.atan2(s.gy[0] - 50, s.gx[0] - 50) * 180 / Math.PI + 90;
        card.style.transform = \`perspective(1000px) rotateX(\${s.rx[0]}deg) rotateY(\${s.ry[0]}deg)\`;
        card.style.setProperty("--aura-gx", s.gx[0] + "%");
        card.style.setProperty("--aura-gy", s.gy[0] + "%");
        card.style.setProperty("--aura-ga", ga + "deg");
        card.style.setProperty("--aura-gi", s.gi[0]);
        raf = moving ? requestAnimationFrame(step) : 0;
        if (!moving) last = 0;
      };
      const kick = () => { if (!raf) raf = requestAnimationFrame(step); };
      area.addEventListener("pointermove", (e) => {
        const r = anchor.getBoundingClientRect();
        const nx = Math.max(-1, Math.min(1, (e.clientX - r.left - r.width / 2) / (r.width / 2)));
        const ny = Math.max(-1, Math.min(1, (e.clientY - r.top - r.height / 2) / (r.height / 2)));
        Object.assign(t, { rx: -ny * MAX, ry: nx * MAX, gx: 50 + nx * 50, gy: 50 + ny * 50, gi: 0.35 + 0.65 * Math.min(1, Math.hypot(nx, ny)) });
        kick();
      });
      area.addEventListener("pointerleave", () => {
        Object.assign(t, { rx: 0, ry: 0, gx: 28, gy: 18, gi: 0.55 });
        kick();
      });
    });
  })();
</script>`;
}

export function generateHtml(design) {
  const parts = [FONT_LINK, "<style>", indentBlock(generateCss(design), 2), "</style>", "", sceneMarkup(design, BEM)];
  if (design.tilt.enabled) parts.push("", tiltScript(design));
  return parts.join("\n") + imageNote(design);
}

// ---------------------------------------------------------------------------
// Tailwind (v3.3+ / v4 arbitrary values)
// ---------------------------------------------------------------------------

/** Tailwind arbitrary values use `_` for spaces. */
export const tw = (value) => String(value).trim().replace(/\s*,\s*/g, ",").replace(/\s+/g, "_");

export function tailwindClasses(design) {
  const { aura, vibes, content } = design;
  const L = CARD_LAYOUT;
  const glare = round(Math.min(0.75, design.shine * 1.6), 2);
  const bg = content.background ? PLACEHOLDER_BACKGROUND : null;
  const avatar = content.avatar ? PLACEHOLDER_AVATAR : null;
  const duration = driftDuration(aura);
  const floatAnims = floatAnimations(vibes);
  const layer = "absolute inset-0 rounded-[inherit] pointer-events-none";

  return {
    scene: "relative grid place-items-center min-h-[520px] overflow-hidden bg-[#08090e]",
    orb: (i) => {
      const orb = orbLayout(aura)[i];
      return [
        "absolute rounded-full blur-[40px] opacity-60 pointer-events-none",
        `left-[${round(orb.left, 1)}%] top-[${round(orb.top, 1)}%]`,
        `size-[${orb.size}px] -ml-[${orb.size / 2}px] -mt-[${orb.size / 2}px]`,
        `bg-[${tw(`radial-gradient(circle, ${orb.color} 0%, transparent 70%)`)}]`,
        duration ? `animate-[aura-drift-${orb.path}_${duration}_ease-in-out_infinite] [animation-delay:${orb.delay}s]` : "",
      ]
        .filter(Boolean)
        .join(" ");
    },
    float: ["relative z-0", floatAnims.length ? `[animation:${tw(floatAnims.join(", "))}]` : ""]
      .filter(Boolean)
      .join(" "),
    glow: [
      "absolute -inset-[14px] -z-10 pointer-events-none blur-[26px] opacity-45",
      `rounded-[${design.radius + 14}px]`,
      `bg-[${tw(meshGradient(aura))}]`,
      `[animation:${tw(glowAnimations(vibes).join(", "))}]`,
    ].join(" "),
    card: [
      "relative flex flex-col box-border overflow-hidden text-white",
      `w-[${design.width}px] h-[${design.height}px] p-[${L.padding}px]`,
      `rounded-[${design.radius}px] border border-white/[${borderAlpha(design)}]`,
      `bg-white/[${round(design.fill, 3)}] backdrop-blur-[${design.frost}px] backdrop-saturate-[1.6]`,
      `shadow-[${tw(boxShadow(design))}]`,
      `[font-family:${tw(L.fontFamily.replace(/"/g, "'"))}]`,
      "[transform:perspective(1000px)] will-change-transform",
      vibes.squish ? `cursor-pointer transition-[scale] duration-[450ms] ease-[${tw(SPRING_EASE)}] active:scale-96 active:duration-[120ms]` : "",
    ]
      .filter(Boolean)
      .join(" "),
    bg: `${layer} bg-[url(${bg})] bg-cover bg-center opacity-[${round(content.backgroundOpacity, 2)}]`,
    tint: `${layer} bg-[${tw(meshGradient(aura))}] mix-blend-${aura.blend} opacity-[${round(aura.strength, 2)}]`,
    shimmer: `${layer} mix-blend-screen bg-[length:250%_100%] bg-[${tw(
      "linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.38) 50%, transparent 62%)",
    )}] animate-[aura-shimmer_3.2s_ease-in-out_infinite]`,
    glare: `${layer} opacity-[var(--aura-gi,0.55)] bg-[${tw(
      `radial-gradient(circle at var(--aura-gx,28%) var(--aura-gy,18%), rgba(255,255,255,${glare}) 0%, transparent 55%), linear-gradient(var(--aura-ga,160deg), rgba(255,255,255,${round(glare * 0.5, 2)}) 0%, transparent 55%)`,
    )}]`,
    content: "relative flex flex-1 flex-col min-h-0",
    avatar: [
      `grid place-items-center flex-none size-[${L.avatar}px] mb-[${L.gap}px] rounded-full border border-white/30 text-[28px] leading-none`,
      avatar ? `bg-[url(${avatar})] bg-cover bg-center` : "bg-white/[0.14]",
    ].join(" "),
    title: `m-0 truncate text-[${L.titleSize}px] font-[650] leading-tight tracking-[-0.01em]`,
    subtitle: `mt-1.5 mb-0 line-clamp-${L.subtitleLines} text-[${L.subtitleSize}px] leading-[1.45] opacity-75`,
    button: `self-start mt-auto h-[${L.buttonHeight}px] px-[${L.buttonPadX}px] rounded-full border border-white/35 bg-white/[0.16] hover:bg-white/[0.26] text-[${L.buttonSize}px] font-semibold leading-none cursor-pointer transition-[scale,background-color] duration-300 ease-[${tw(SPRING_EASE)}] active:scale-96`,
  };
}

export function generateTailwind(design) {
  const cls = tailwindClasses(design);
  const parts = [FONT_LINK];
  const keyframes = keyframesCss(design);
  if (keyframes) {
    parts.push("<!-- Keyframes for the animate-[…] utilities (add once to your global CSS). -->");
    parts.push("<style>", indentBlock(keyframes, 2), "</style>", "");
  }
  parts.push(sceneMarkup(design, cls));
  if (design.tilt.enabled) parts.push("", tiltScript(design));
  return parts.join("\n") + imageNote(design);
}

// ---------------------------------------------------------------------------

function imageNote(design) {
  const names = [];
  if (design.content.background) names.push(PLACEHOLDER_BACKGROUND);
  if (design.content.avatar) names.push(PLACEHOLDER_AVATAR);
  if (!names.length) return "";
  return `\n\n<!-- Images are referenced as ${names.join(" and ")} — save them next to this file. -->`;
}

function indentBlock(text, n) {
  const pad = " ".repeat(n);
  return text
    .split("\n")
    .map((line) => (line ? pad + line : line))
    .join("\n");
}

export function generateCode(design, kind) {
  if (kind === "css") return `@import url("${FONT_CSS_URL}");\n\n` + generateCss(design) + cssImageNote(design);
  if (kind === "html") return generateHtml(design);
  return generateTailwind(design);
}

function cssImageNote(design) {
  const note = imageNote(design);
  return note ? note.replace("<!--", "/*").replace("-->", "*/") : "";
}
