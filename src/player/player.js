// AuraDrop player: renders a project and runs its button actions.
//
// This file has no imports on purpose. The app uses it for the editor
// canvas and the preview, and the "web page" export inlines this exact
// source, so a shared page behaves the same as the preview in AuraDrop.

const FONT_STACKS = {
  Inter: '"Inter Variable", "Inter", system-ui, sans-serif',
  Impact: 'Impact, "Anton", "Arial Narrow Bold", sans-serif',
  Anton: '"Anton", Impact, sans-serif',
  Bangers: '"Bangers", cursive',
  "Bebas Neue": '"Bebas Neue", sans-serif',
  "Permanent Marker": '"Permanent Marker", cursive',
  "Comic Neue": '"Comic Neue", "Comic Sans MS", cursive',
  Pacifico: '"Pacifico", cursive',
  Lobster: '"Lobster", cursive',
  "Press Start 2P": '"Press Start 2P", monospace',
  "JetBrains Mono": '"JetBrains Mono Variable", "JetBrains Mono", monospace',
};
const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
const UI_FONT = '"Inter Variable", "Inter", "Segoe UI", system-ui, sans-serif';

/** Spots for background orbs and glass tint glows, in percent. */
const SPOTS = [
  [18, 22],
  [82, 30],
  [50, 88],
  [20, 80],
  [80, 74],
];

const PLAYER_CSS = `
.ad-root{position:relative;overflow:hidden;font-family:${UI_FONT};-webkit-font-smoothing:antialiased;user-select:none}
.ad-viewport{position:absolute;inset:0;display:grid;place-items:center;overflow:hidden}
.ad-sizer{position:relative;flex:none}
.ad-stage{position:absolute;left:0;top:0;transform-origin:0 0;overflow:hidden;isolation:isolate}
.ad-shaking{animation:ad-shake-stage .45s cubic-bezier(.36,.07,.19,.97) both}
.ad-bg,.ad-els{position:absolute;inset:0}
.ad-bg img{position:absolute;inset:0;width:100%;height:100%}
.ad-orb{position:absolute;border-radius:50%;pointer-events:none;will-change:transform}
.ad-el{position:absolute;box-sizing:border-box}
.ad-anim{position:absolute;inset:0}
.ad-inner{position:absolute;inset:0;box-sizing:border-box}
.ad-ghost{opacity:.35!important;outline:2px dashed rgba(255,255,255,.55);outline-offset:2px}
.ad-off{display:none!important}
.ad-text{display:flex;align-items:center;white-space:pre-wrap;overflow-wrap:anywhere}
.ad-text>div{box-sizing:border-box;max-width:100%}
.ad-sticker{display:grid;place-items:center;line-height:1;font-family:${EMOJI_FONT}}
.ad-img{overflow:hidden}
.ad-img img{width:100%;height:100%;display:block;-webkit-user-drag:none}
.ad-placeholder{display:grid;place-items:center;border:3px dashed rgba(255,255,255,.45);background:rgba(255,255,255,.06);color:rgba(255,255,255,.75);font:600 clamp(12px,4vmin,28px) ${UI_FONT};text-align:center}
.ad-shape svg{width:100%;height:100%;overflow:visible;display:block}
.ad-glass{overflow:hidden;transition:transform .6s cubic-bezier(.34,1.56,.64,1)}
.ad-glass .ad-tint,.ad-glass .ad-glare{position:absolute;inset:0;border-radius:inherit;pointer-events:none}
.ad-btn{display:flex;align-items:center;justify-content:center;gap:.4em;box-sizing:border-box;line-height:1;white-space:nowrap;overflow:hidden;transition:transform .35s cubic-bezier(.34,1.56,.64,1),box-shadow .25s,filter .25s}
[data-mode=play] .ad-click{cursor:pointer}
[data-mode=play] .ad-btn[data-hover=lift]:hover{transform:translateY(-4%)}
[data-mode=play] .ad-btn[data-hover=grow]:hover{transform:scale(1.06)}
[data-mode=play] .ad-btn[data-hover=glow]:hover{filter:brightness(1.12) drop-shadow(0 0 18px var(--ad-glow))}
[data-mode=play] .ad-btn:active{transform:scale(.95);transition-duration:.08s}
[data-mode=play] .ad-click:not(.ad-button):active .ad-inner{transform:scale(.97)}
.ad-fx{position:absolute;inset:0;pointer-events:none;z-index:5}
.ad-fx canvas{position:absolute;inset:0;width:100%;height:100%}
.ad-modal{position:absolute;inset:0;display:grid;place-items:center;background:rgba(8,9,14,.55);pointer-events:auto;animation:ad-fade .2s ease}
.ad-card{width:min(420px,86%);padding:24px;border-radius:24px;color:#fff;text-align:center;background:rgba(20,21,32,.82);-webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);border:1px solid rgba(255,255,255,.18);box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 20px 50px rgba(0,0,0,.45);animation:ad-pop .45s cubic-bezier(.34,1.56,.64,1)}
.ad-card .ad-emoji{font:56px/1 ${EMOJI_FONT};margin-bottom:8px}
.ad-card h2{margin:0 0 6px;font:700 22px/1.25 ${UI_FONT}}
.ad-card p{margin:0 0 18px;font:400 15px/1.5 ${UI_FONT};color:rgba(255,255,255,.8);white-space:pre-wrap;overflow-wrap:anywhere}
.ad-card .ad-url{font:500 13px/1.4 ui-monospace,Consolas,monospace;color:#a5f3fc;word-break:break-all}
.ad-card .ad-row{display:flex;gap:10px;justify-content:center}
.ad-card button{font:600 15px ${UI_FONT};border:0;border-radius:999px;padding:11px 22px;cursor:pointer;color:#0b0c12;background:linear-gradient(90deg,#a78bfa,#22d3ee);transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
.ad-card button.ad-secondary{color:#fff;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18)}
.ad-card button:active{transform:scale(.95)}
.ad-enter-fade{animation:ad-fade .45s ease both}
.ad-enter-slide{animation:ad-slide .5s cubic-bezier(.22,1,.36,1) both}
.ad-enter-zoom{animation:ad-zoom .5s cubic-bezier(.22,1,.36,1) both}
@keyframes ad-fade{from{opacity:0}}
@keyframes ad-slide{from{opacity:0;transform:translateX(6%)}}
@keyframes ad-zoom{from{opacity:0;transform:scale(.92)}}
@keyframes ad-pop{0%{opacity:0;scale:.6}70%{opacity:1;scale:1.06}100%{scale:1}}
@keyframes ad-shake-stage{10%,90%{translate:-1% 0}20%,80%{translate:2% 0}30%,50%,70%{translate:-3% 0}40%,60%{translate:3% 0}}
@keyframes ad-drift-0{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(6%,-8%) scale(1.12)}66%{transform:translate(-5%,6%) scale(.92)}}
@keyframes ad-drift-1{0%,100%{transform:translate(0,0) scale(1.05)}50%{transform:translate(-9%,-5%) scale(.9)}}
@keyframes ad-drift-2{0%,100%{transform:translate(0,0) scale(.95)}40%{transform:translate(7%,7%) scale(1.15)}75%{transform:translate(-4%,-3%) scale(1)}}
@keyframes ad-a-float{0%,100%{translate:0 0}50%{translate:0 -6%}}
@keyframes ad-a-pulse{0%,100%{scale:1}50%{scale:1.07}}
@keyframes ad-a-bounce{0%,100%{translate:0 0;animation-timing-function:cubic-bezier(.33,0,.66,0)}50%{translate:0 -14%;animation-timing-function:cubic-bezier(.33,1,.66,1)}}
@keyframes ad-a-wiggle{0%,100%{rotate:0deg}25%{rotate:-7deg}75%{rotate:7deg}}
@keyframes ad-a-shake{0%,100%{translate:0 0}20%{translate:-3% 0}40%{translate:3% 0}60%{translate:-2% 0}80%{translate:2% 0}}
@keyframes ad-a-spin{to{rotate:360deg}}
@keyframes ad-a-swing{0%,100%{rotate:-10deg}50%{rotate:10deg}}
@keyframes ad-a-pop{0%{scale:0;opacity:0}70%{scale:1.12;opacity:1}100%{scale:1}}
@keyframes ad-a-slide{from{translate:0 40%;opacity:0}}
@media (prefers-reduced-motion:reduce){.ad-anim,.ad-orb{animation:none!important}}
`;

const ANIM_TIMING = {
  float: ["3.4s", "ease-in-out", "infinite"],
  pulse: ["2.4s", "ease-in-out", "infinite"],
  bounce: ["1.1s", "linear", "infinite"],
  wiggle: ["1.2s", "ease-in-out", "infinite"],
  shake: ["0.6s", "linear", "infinite"],
  spin: ["4s", "linear", "infinite"],
  swing: ["2.2s", "ease-in-out", "infinite"],
  pop: ["0.7s", "cubic-bezier(.34,1.56,.64,1)", "1 both"],
  slide: ["0.8s", "cubic-bezier(.22,1,.36,1)", "1 both"],
};

// ---------------------------------------------------------------------------
// Shared helpers (also used by the PNG exporter)
// ---------------------------------------------------------------------------

function fontStack(id) {
  return FONT_STACKS[id] || FONT_STACKS.Inter;
}

function rgba(hex, a) {
  const n = parseInt(String(hex).slice(1), 16) || 0;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Gradient line for a CSS angle (0deg = up) in a w×h box. */
function gradientLine(angle, w, h) {
  const a = ((angle - 90) * Math.PI) / 180;
  const len = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a));
  const dx = (Math.cos(a) * len) / 2;
  const dy = (Math.sin(a) * len) / 2;
  return [w / 2 - dx, h / 2 - dy, w / 2 + dx, h / 2 + dy];
}

/** SVG path for a shape filling a w×h box, inset by i (half the border). */
function shapePath(kind, w, h, radius, i = 0) {
  const x0 = i;
  const y0 = i;
  const x1 = w - i;
  const y1 = h - i;
  const W = x1 - x0;
  const H = y1 - y0;
  const f = (n) => Math.round(n * 100) / 100;
  const poly = (pts) => "M" + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join(" L") + " Z";
  const rrect = (x, y, rw, rh, r) => {
    r = Math.max(0, Math.min(r, rw / 2, rh / 2));
    return `M${f(x + r)} ${f(y)} H${f(x + rw - r)} A${f(r)} ${f(r)} 0 0 1 ${f(x + rw)} ${f(y + r)} V${f(y + rh - r)} A${f(r)} ${f(r)} 0 0 1 ${f(x + rw - r)} ${f(y + rh)} H${f(x + r)} A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + rh - r)} V${f(y + r)} A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)} Z`;
  };
  switch (kind) {
    case "ellipse": {
      const rx = W / 2;
      const ry = H / 2;
      const cx = x0 + rx;
      return `M${f(cx - rx)} ${f(y0 + ry)} A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(y0 + ry)} A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(y0 + ry)} Z`;
    }
    case "triangle":
      return poly([[x0 + W / 2, y0], [x1, y1], [x0, y1]]);
    case "star": {
      const pts = [];
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 0.42 : 1;
        const a = -Math.PI / 2 + (k * Math.PI) / 5;
        pts.push([x0 + W / 2 + (Math.cos(a) * r * W) / 2, y0 + H * 0.55 + (Math.sin(a) * r * H) / 2 / 1.05]);
      }
      return poly(pts);
    }
    case "heart": {
      const p = (x, y) => `${f(x0 + x * W)} ${f(y0 + y * H)}`;
      return `M${p(0.5, 0.95)} C${p(0.12, 0.7)} ${p(0, 0.42)} ${p(0.1, 0.2)} C${p(0.22, 0.02)} ${p(0.44, 0.05)} ${p(0.5, 0.24)} C${p(0.56, 0.05)} ${p(0.78, 0.02)} ${p(0.9, 0.2)} C${p(1, 0.42)} ${p(0.88, 0.7)} ${p(0.5, 0.95)} Z`;
    }
    case "bubble": {
      const bh = H * 0.8;
      const r = Math.min(radius, W / 2, bh / 2);
      return (
        rrect(x0, y0, W, bh, r).replace(/ Z$/, "") +
        ` M${f(x0 + W * 0.22)} ${f(y0 + bh - 1)} L${f(x0 + W * 0.12)} ${f(y1)} L${f(x0 + W * 0.4)} ${f(y0 + bh - 1)} Z`
      );
    }
    case "arrow":
      return poly([[x0, y0 + H * 0.3], [x0 + W * 0.6, y0 + H * 0.3], [x0 + W * 0.6, y0], [x1, y0 + H / 2], [x0 + W * 0.6, y1], [x0 + W * 0.6, y0 + H * 0.7], [x0, y0 + H * 0.7]]);
    default:
      return rrect(x0, y0, W, H, radius);
  }
}

/** Text-shadow list for a meme-style outline plus an optional drop shadow. */
function textShadow(el) {
  const out = [];
  const sw = el.stroke && el.stroke.width;
  if (sw > 0) {
    const steps = Math.max(16, Math.round(sw * 3));
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2;
      out.push(`${(Math.cos(a) * sw).toFixed(2)}px ${(Math.sin(a) * sw).toFixed(2)}px 0 ${el.stroke.color}`);
    }
  }
  if (el.shadow && el.shadow.on) {
    out.push(`${el.shadow.x}px ${el.shadow.y}px ${el.shadow.blur}px ${rgba(el.shadow.color, el.shadow.opacity)}`);
  }
  return out.join(",") || "none";
}

function imageFilter(f) {
  if (!f) return "none";
  const parts = [];
  if (f.brightness !== 100) parts.push(`brightness(${f.brightness}%)`);
  if (f.contrast !== 100) parts.push(`contrast(${f.contrast}%)`);
  if (f.saturate !== 100) parts.push(`saturate(${f.saturate}%)`);
  if (f.hue) parts.push(`hue-rotate(${f.hue}deg)`);
  if (f.grayscale) parts.push(`grayscale(${f.grayscale}%)`);
  if (f.blur) parts.push(`blur(${f.blur}px)`);
  return parts.join(" ") || "none";
}

function glassTint(el) {
  const cs = el.tint.colors;
  return cs
    .map((c, i) => `radial-gradient(circle at ${SPOTS[i % 5][0]}% ${SPOTS[i % 5][1]}%, ${c} 0%, transparent 62%)`)
    .concat(`linear-gradient(135deg, ${cs[0]}, ${cs[cs.length - 1]})`)
    .join(",");
}

function buttonBackground(el) {
  switch (el.variant) {
    case "solid":
      return el.color;
    case "gradient":
      return `linear-gradient(135deg, ${el.color}, ${el.color2})`;
    case "outline":
      return "transparent";
    default:
      return `linear-gradient(135deg, ${rgba(el.color, 0.42)}, ${rgba(el.color2, 0.42)}), rgba(255,255,255,0.08)`;
  }
}

function safeLink(url) {
  try {
    const u = new URL(String(url).trim());
    return ["http:", "https:", "mailto:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

function createPlayer(root, initialProject, options) {
  const o = Object.assign(
    {
      mode: "play", // "play" | "edit"
      page: 0,
      scale: null, // null = fit the root
      animate: null, // defaults to mode === "play"
      confirmLinks: true,
      keyboard: false,
      openUrl: (url) => window.open(url, "_blank", "noopener"),
      onPageChange: () => {},
      // Extra element types, e.g. { vehicle(el, inner, ctx) }. Kept outside
      // this file so the player stays small; exported pages inline them.
      renderers: {},
    },
    options || {},
  );
  if (o.animate === null) o.animate = o.mode === "play";

  if (!document.getElementById("ad-player-css")) {
    const style = document.createElement("style");
    style.id = "ad-player-css";
    style.textContent = PLAYER_CSS;
    document.head.appendChild(style);
  }

  const make = (tag, cls) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  };
  root.classList.add("ad-root");
  root.dataset.mode = o.mode;
  const viewport = make("div", "ad-viewport");
  const sizer = make("div", "ad-sizer");
  const stage = make("div", "ad-stage");
  const bgLayer = make("div", "ad-bg");
  const elLayer = make("div", "ad-els");
  const fx = make("div", "ad-fx");
  stage.append(bgLayer, elLayer);
  sizer.append(stage);
  viewport.append(sizer, fx);
  root.append(viewport);

  let project = initialProject;
  let pageIndex = Math.min(Math.max(0, o.page | 0), project.pages.length - 1);
  let scale = 1;
  let bgSig = "";
  let destroyed = false;
  const nodes = new Map();
  const visible = new Map(); // runtime show/hide in play mode
  const sounds = new Map();
  const tilts = new Set();
  const views = new Map(); // runtime vehicle view (normal / armor / xray) in play mode

  const page = () => project.pages[pageIndex];
  const asset = (id) => (id && project.assets[id]) || null;

  // --- layout ---------------------------------------------------------------

  function layout() {
    const { w, h } = project.canvas;
    if (o.scale) scale = o.scale;
    else {
      const r = root.getBoundingClientRect();
      scale = Math.max(0.01, Math.min(r.width / w, r.height / h));
    }
    stage.style.width = `${w}px`;
    stage.style.height = `${h}px`;
    stage.style.transform = `scale(${scale})`;
    sizer.style.width = `${w * scale}px`;
    sizer.style.height = `${h * scale}px`;
  }
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => !o.scale && layout()) : null;
  ro?.observe(root);

  // --- background -------------------------------------------------------------

  function renderBackground() {
    const bg = page().bg;
    const { w, h } = project.canvas;
    const sig = JSON.stringify([bg, w, h, o.animate, bg.asset && asset(bg.asset)?.data.length]);
    if (sig === bgSig) return;
    bgSig = sig;
    bgLayer.textContent = "";
    bgLayer.style.background = bg.color;
    if (bg.type === "gradient") {
      bgLayer.style.background = `linear-gradient(${bg.angle}deg, ${bg.colors.join(", ")})`;
    } else if (bg.type === "image" && asset(bg.asset)) {
      const img = make("img");
      img.src = asset(bg.asset).data;
      img.style.objectFit = bg.fit;
      if (bg.blur) {
        img.style.filter = `blur(${bg.blur}px)`;
        img.style.transform = "scale(1.08)";
      }
      bgLayer.append(img);
      if (bg.dim) {
        const dim = make("div");
        dim.style.cssText = `position:absolute;inset:0;background:rgba(0,0,0,${bg.dim})`;
        bgLayer.append(dim);
      }
    }
    if (bg.type === "mesh" && bg.orbs) {
      const size = Math.max(w, h) * 0.6;
      bg.colors.forEach((c, i) => {
        const orb = make("div", "ad-orb");
        const [sx, sy] = SPOTS[i % 5];
        orb.style.cssText += `left:${(sx / 100) * w - size / 2}px;top:${(sy / 100) * h - size / 2}px;width:${size}px;height:${size}px;background:radial-gradient(circle, ${c} 0%, transparent 68%);filter:blur(${Math.round(size * 0.07)}px);opacity:.7`;
        if (o.animate && bg.drift > 0) {
          orb.style.animation = `ad-drift-${i % 3} ${(26 / bg.drift).toFixed(1)}s ease-in-out ${-i * 3.3}s infinite`;
        }
        bgLayer.append(orb);
      });
    }
  }

  // --- elements ---------------------------------------------------------------

  function buildContent(el, inner) {
    inner.textContent = "";
    inner.removeAttribute("style");
    inner.className = "ad-inner";
    switch (el.type) {
      case "text": {
        inner.classList.add("ad-text");
        inner.style.justifyContent = { left: "flex-start", center: "center", right: "flex-end" }[el.align];
        const box = make("div");
        box.textContent = el.text;
        box.style.cssText = `font-family:${fontStack(el.font)};font-size:${el.size}px;font-weight:${el.weight};color:${el.color};text-align:${el.align};letter-spacing:${el.spacing}px;line-height:${el.lineHeight};text-transform:${el.upper ? "uppercase" : "none"};text-shadow:${textShadow(el)}`;
        if (el.bg && el.bg.on) {
          box.style.background = rgba(el.bg.color, el.bg.opacity);
          box.style.padding = `${el.bg.pad}px`;
          box.style.borderRadius = `${el.bg.radius}px`;
        }
        inner.append(box);
        break;
      }
      case "sticker":
        inner.classList.add("ad-sticker");
        inner.style.fontSize = `${Math.min(el.w, el.h) * 0.84}px`;
        inner.textContent = el.emoji;
        break;
      case "image": {
        const a = asset(el.asset);
        inner.classList.add("ad-img");
        inner.style.borderRadius = `${el.radius}px`;
        if (el.border.width) inner.style.border = `${el.border.width}px solid ${el.border.color}`;
        if (el.shadow) inner.style.boxShadow = "0 18px 40px rgba(0,0,0,.45)";
        if (a) {
          const img = make("img");
          img.src = a.data;
          img.alt = "";
          img.draggable = false;
          img.style.objectFit = el.fit;
          img.style.filter = imageFilter(el.filters);
          if (el.flipX || el.flipY) img.style.transform = `scale(${el.flipX ? -1 : 1}, ${el.flipY ? -1 : 1})`;
          inner.append(img);
        } else if (o.mode === "edit") {
          inner.classList.add("ad-placeholder");
          inner.textContent = "🖼️ Drop a picture here";
        }
        break;
      }
      case "shape": {
        inner.classList.add("ad-shape");
        const b = el.border.width;
        const gid = `adg-${el.id}`;
        const fill = el.fill.type === "gradient" ? `url(#${gid})` : el.fill.color;
        let defs = "";
        if (el.fill.type === "gradient") {
          const [x1, y1, x2, y2] = gradientLine(el.fill.angle, el.w, el.h);
          defs = `<defs><linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${el.fill.color}"/><stop offset="1" stop-color="${el.fill.color2}"/></linearGradient></defs>`;
        }
        inner.innerHTML = `<svg viewBox="0 0 ${el.w} ${el.h}" preserveAspectRatio="none">${defs}<path d="${shapePath(el.shape, el.w, el.h, el.radius, b / 2)}" fill="${fill}"${b ? ` stroke="${el.border.color}" stroke-width="${b}" stroke-linejoin="round"` : ""}/></svg>`;
        if (el.shadow) inner.style.filter = "drop-shadow(0 16px 30px rgba(0,0,0,.4))";
        break;
      }
      case "glass": {
        inner.classList.add("ad-glass");
        inner.style.cssText = `border-radius:${el.radius}px;background:rgba(255,255,255,${el.fill});-webkit-backdrop-filter:blur(${el.frost}px) saturate(160%);backdrop-filter:blur(${el.frost}px) saturate(160%);border:1px solid rgba(255,255,255,${el.shine});box-shadow:inset 0 1px 0 rgba(255,255,255,${Math.min(1, el.shine * 1.4)}),inset 0 -1px 0 rgba(255,255,255,${el.shine * 0.35}),0 24px 60px rgba(0,0,0,.4),0 6px 16px rgba(0,0,0,.25)`;
        const tint = make("div", "ad-tint");
        tint.style.cssText = `background:${glassTint(el)};mix-blend-mode:${el.tint.blend};opacity:${el.tint.strength}`;
        const glare = make("div", "ad-glare");
        glare.style.background = `linear-gradient(160deg, rgba(255,255,255,${Math.min(0.6, el.shine * 1.2)}) 0%, transparent 45%)`;
        inner.append(tint, glare);
        break;
      }
      default: {
        const r = o.renderers && o.renderers[el.type];
        if (r) r(el, inner, { mode: o.mode, animate: o.animate, asset, view: views.get(el.id) });
        else if (el.snapshots) {
          // Exported pages: pictures of the vehicle in each view.
          const img = make("img");
          img.src = el.snapshots[views.get(el.id) || el.view] || el.snapshots.normal;
          img.alt = "";
          img.draggable = false;
          img.style.cssText = "width:100%;height:100%;object-fit:contain;display:block";
          inner.append(img);
        }
        break;
      }
      case "button": {
        inner.classList.add("ad-btn");
        inner.dataset.hover = el.hover;
        const outline = el.variant === "outline";
        inner.style.cssText = `border-radius:${el.radius}px;font-family:${fontStack(el.font)};font-size:${el.size}px;font-weight:${el.weight};color:${outline ? el.color : el.textColor};background:${buttonBackground(el)};border:${outline ? `3px solid ${el.color}` : `1px solid rgba(255,255,255,${el.variant === "glass" ? 0.3 : 0.16})`};box-shadow:${el.variant === "outline" ? "none" : `inset 0 1px 0 rgba(255,255,255,.3),0 10px 26px ${rgba(el.color, 0.35)}`};--ad-glow:${el.color}`;
        if (el.variant === "glass") {
          inner.style.webkitBackdropFilter = "blur(16px) saturate(160%)";
          inner.style.backdropFilter = "blur(16px) saturate(160%)";
        }
        if (el.icon) {
          const icon = make("span");
          icon.style.fontFamily = EMOJI_FONT;
          icon.textContent = el.icon;
          inner.append(icon);
        }
        if (el.label) {
          const label = make("span");
          label.textContent = el.label;
          inner.append(label);
        }
        break;
      }
    }
  }

  function isVisible(el) {
    if (o.mode === "edit") return true;
    return visible.has(el.id) ? visible.get(el.id) : !el.hidden;
  }

  function applyElement(el, n) {
    const s = n.wrap.style;
    s.left = `${el.x}px`;
    s.top = `${el.y}px`;
    s.width = `${el.w}px`;
    s.height = `${el.h}px`;
    s.transform = el.rotation ? `rotate(${el.rotation}deg)` : "";
    s.opacity = el.opacity;
    n.wrap.classList.toggle("ad-ghost", o.mode === "edit" && el.hidden);
    n.wrap.classList.toggle("ad-off", !isVisible(el));
    n.wrap.classList.toggle("ad-click", o.mode === "play" && el.actions.length > 0);
    n.wrap.classList.toggle("ad-button", el.type === "button");
    const a = el.anim;
    if (o.animate && a.type !== "none" && ANIM_TIMING[a.type]) {
      const [dur, ease, rest] = ANIM_TIMING[a.type];
      n.anim.style.animation = `ad-a-${a.type} calc(${dur} / ${a.speed}) ${ease} ${a.delay}s ${rest}`;
    } else n.anim.style.animation = "";
    const contentSig = JSON.stringify([el, el.asset && asset(el.asset)?.data.length, views.get(el.id) || null, o.renderers && o.renderers[el.type] ? o.animate : 0]);
    if (contentSig !== n.contentSig) {
      buildContent(el, n.inner);
      n.contentSig = contentSig;
    }
    if (el.type === "glass" && el.tilt && o.mode === "play") tilts.add(el.id);
    else tilts.delete(el.id);
  }

  function renderElements() {
    const els = page().elements;
    const keep = new Set(els.map((e) => e.id));
    for (const [id, n] of nodes) {
      if (!keep.has(id)) {
        n.wrap.remove();
        nodes.delete(id);
        tilts.delete(id);
      }
    }
    els.forEach((el) => {
      let n = nodes.get(el.id);
      if (!n) {
        const wrap = make("div", "ad-el");
        wrap.dataset.id = el.id;
        const anim = make("div", "ad-anim");
        const inner = make("div", "ad-inner");
        anim.append(inner);
        wrap.append(anim);
        wrap.addEventListener("click", () => onElementClick(el.id));
        n = { wrap, anim, inner, contentSig: "" };
        nodes.set(el.id, n);
      }
      applyElement(el, n);
      elLayer.append(n.wrap); // keeps z-order in sync
    });
  }

  function render() {
    layout();
    renderBackground();
    renderElements();
  }

  // --- glass tilt (play) ---------------------------------------------------

  function onPointerMove(e) {
    if (!tilts.size) return;
    for (const id of tilts) {
      const n = nodes.get(id);
      if (!n) continue;
      const r = n.wrap.getBoundingClientRect();
      const nx = Math.max(-1, Math.min(1, (e.clientX - r.left - r.width / 2) / (r.width / 2)));
      const ny = Math.max(-1, Math.min(1, (e.clientY - r.top - r.height / 2) / (r.height / 2)));
      n.inner.style.transitionDuration = ".15s";
      n.inner.style.transform = `perspective(1000px) rotateX(${(-ny * 10).toFixed(2)}deg) rotateY(${(nx * 10).toFixed(2)}deg)`;
    }
  }
  function onPointerLeave() {
    for (const id of tilts) {
      const n = nodes.get(id);
      if (!n) continue;
      n.inner.style.transitionDuration = "";
      n.inner.style.transform = "";
    }
  }
  if (o.mode === "play") {
    root.addEventListener("pointermove", onPointerMove);
    root.addEventListener("pointerleave", onPointerLeave);
  }

  // --- actions ----------------------------------------------------------------

  let running = false;
  async function onElementClick(id) {
    if (o.mode !== "play" || running) return;
    const el = page().elements.find((e) => e.id === id);
    if (!el || !el.actions.length) return;
    running = true;
    try {
      for (const action of el.actions) {
        if (destroyed) break;
        const stop = await runAction(action);
        if (stop) break;
      }
    } finally {
      running = false;
    }
  }

  /** Returns true to stop the remaining actions (e.g. after a page change). */
  async function runAction(a) {
    switch (a.type) {
      case "link": {
        const url = safeLink(a.url);
        if (!url) return false;
        if (!o.confirmLinks || (await dialog({ emoji: "🔗", title: "Open this link?", url, ok: "Open", cancel: "Cancel" }))) {
          o.openUrl(url);
        }
        return false;
      }
      case "sound": {
        const data = asset(a.asset);
        if (!data) return false;
        if (a.stopOthers) sounds.forEach((s) => s.pause());
        let audio = sounds.get(a.asset);
        if (!audio) {
          audio = new Audio(data.data);
          sounds.set(a.asset, audio);
        }
        audio.volume = a.volume;
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return false;
      }
      case "confetti":
        confetti(a.amount);
        return false;
      case "shake":
        stage.classList.remove("ad-shaking");
        void stage.offsetWidth;
        stage.style.animationDuration = `${0.45 * a.strength}s`;
        stage.classList.add("ad-shaking");
        return false;
      case "popup":
        await dialog({ emoji: a.emoji, title: a.title, text: a.text, ok: a.button || "Close" });
        return false;
      case "toggle": {
        const target = page().elements.find((e) => e.id === a.target);
        if (!target) return false;
        const now = isVisible(target);
        visible.set(target.id, a.mode === "show" ? true : a.mode === "hide" ? false : !now);
        const n = nodes.get(target.id);
        if (n) {
          n.wrap.classList.toggle("ad-off", !isVisible(target));
          if (isVisible(target)) {
            n.wrap.classList.remove("ad-enter-fade");
            void n.wrap.offsetWidth;
            n.wrap.classList.add("ad-enter-fade");
          }
        }
        return false;
      }
      case "view": {
        const target = page().elements.find((e) => e.id === a.target && e.type === "vehicle");
        if (!target) return false;
        const order = ["normal", "armor", "xray"];
        const cur = views.get(target.id) || target.view || "normal";
        views.set(target.id, a.view === "cycle" ? order[(order.indexOf(cur) + 1) % 3] : a.view);
        renderElements();
        return false;
      }
      case "page": {
        const pages = project.pages;
        let next = pageIndex;
        if (a.target === "next") next = (pageIndex + 1) % pages.length;
        else if (a.target === "prev") next = (pageIndex - 1 + pages.length) % pages.length;
        else if (a.target === "first") next = 0;
        else next = Math.max(0, pages.findIndex((p) => p.id === a.target));
        goTo(next);
        return true;
      }
    }
    return false;
  }

  function dialog({ emoji, title, text, url, ok, cancel }) {
    return new Promise((resolve) => {
      const modal = make("div", "ad-modal");
      const card = make("div", "ad-card");
      if (emoji) {
        const e = make("div", "ad-emoji");
        e.textContent = emoji;
        card.append(e);
      }
      if (title) {
        const h = make("h2");
        h.textContent = title;
        card.append(h);
      }
      if (text || url) {
        const p = make("p", url ? "ad-url" : "");
        p.textContent = url || text;
        card.append(p);
      }
      const row = make("div", "ad-row");
      const close = (v) => {
        modal.remove();
        window.removeEventListener("keydown", onKey, true);
        resolve(v);
      };
      if (cancel) {
        const c = make("button", "ad-secondary");
        c.type = "button";
        c.textContent = cancel;
        c.onclick = () => close(false);
        row.append(c);
      }
      const b = make("button");
      b.type = "button";
      b.textContent = ok;
      b.onclick = () => close(true);
      row.append(b);
      card.append(row);
      modal.append(card);
      modal.addEventListener("click", (e) => e.target === modal && close(false));
      const onKey = (e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close(false);
        }
      };
      window.addEventListener("keydown", onKey, true);
      fx.append(modal);
      b.focus();
    });
  }

  function confetti(amount) {
    const canvas = make("canvas");
    fx.append(canvas);
    const r = fx.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = r.width * dpr;
    canvas.height = r.height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const colors = ["#a78bfa", "#22d3ee", "#f472b6", "#facc15", "#34d399", "#fb7185", "#ffffff"];
    const parts = Array.from({ length: amount }, () => ({
      x: r.width / 2 + (Math.random() - 0.5) * r.width * 0.2,
      y: r.height * 0.55,
      vx: (Math.random() - 0.5) * r.width * 1.4,
      vy: -(0.6 + Math.random() * 0.9) * r.height * 1.3,
      s: 6 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 12,
      c: colors[(Math.random() * colors.length) | 0],
    }));
    let last = performance.now();
    const start = last;
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, r.width, r.height);
      for (const p of parts) {
        p.vy += r.height * 2.2 * dt;
        p.vx *= 0.985;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (now - start < 3200 && !destroyed) requestAnimationFrame(tick);
      else canvas.remove();
    };
    requestAnimationFrame(tick);
  }

  function goTo(i) {
    if (i === pageIndex || i < 0 || i >= project.pages.length) return;
    pageIndex = i;
    visible.clear();
    bgSig = "";
    render();
    const t = page().transition;
    if (o.mode === "play" && t !== "none") {
      for (const layer of [elLayer, bgLayer]) {
        layer.classList.remove("ad-enter-fade", "ad-enter-slide", "ad-enter-zoom");
        void layer.offsetWidth;
        layer.classList.add(`ad-enter-${t}`);
      }
    }
    o.onPageChange(pageIndex);
  }

  function onKey(e) {
    if (e.target.closest && e.target.closest("input, textarea")) return;
    if (e.key === "ArrowRight") goTo(Math.min(project.pages.length - 1, pageIndex + 1));
    else if (e.key === "ArrowLeft") goTo(Math.max(0, pageIndex - 1));
  }
  if (o.keyboard) window.addEventListener("keydown", onKey);

  render();

  return {
    stage,
    root,
    update(next) {
      project = next;
      if (pageIndex >= project.pages.length) pageIndex = project.pages.length - 1;
      render();
    },
    setPage(i) {
      if (o.mode === "edit") {
        if (i === pageIndex) return;
        pageIndex = i;
        bgSig = "";
        render();
      } else goTo(i);
    },
    getPage: () => pageIndex,
    setScale(s) {
      o.scale = s;
      layout();
    },
    getScale: () => scale,
    setAnimate(on) {
      o.animate = on;
      bgSig = "";
      nodes.forEach((n) => (n.contentSig = ""));
      render();
    },
    nodeFor: (id) => nodes.get(id)?.wrap ?? null,
    destroy() {
      destroyed = true;
      ro?.disconnect();
      sounds.forEach((s) => s.pause());
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", onKey);
      viewport.remove();
      root.classList.remove("ad-root");
    },
  };
}

export { createPlayer, shapePath, gradientLine, textShadow, imageFilter, fontStack, rgba, FONT_STACKS, EMOJI_FONT, SPOTS, safeLink };
