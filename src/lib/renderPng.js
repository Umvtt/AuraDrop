// PNG export: draws one page of a project on a canvas. DOM screenshots can't
// capture backdrop-filter, so every element type is painted here from the
// same model and geometry the player uses (shape paths, gradient lines,
// glass tint spots), including real frosted blur for glass.

import { EMOJI_FONT, SPOTS, curveLayout, fontStack, gradientLine, imageFilter, rgba, shapePath } from "../player/player.js";
import { loadFonts, usedFonts } from "./fonts.js";
import { animAt, driftAt } from "./motion.js";

/**
 * @param {object} project
 * @param {number} pageIndex
 * @param {{ scale?: number }} opts
 * @returns {Promise<Uint8Array>} PNG bytes
 */
export async function renderPng(project, pageIndex = 0, { scale } = {}) {
  const { w, h } = project.canvas;
  // Small canvases (classic 800px memes) export at 2× so they stay crisp;
  // standard sizes like 1080 posts keep their exact pixel size.
  const canvas = await renderCanvas(project, pageIndex, scale ?? (Math.max(w, h) < 1000 ? 2 : 1));
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't encode the PNG."))), "image/png"),
  );
  return new Uint8Array(await blob.arrayBuffer());
}

/** A small JPEG data URL of the first page, for the projects library. */
export async function renderThumb(project, size = 360) {
  const { w, h } = project.canvas;
  const canvas = await renderCanvas(project, 0, size / Math.max(w, h));
  return canvas.toDataURL("image/jpeg", 0.78);
}

async function renderCanvas(project, pageIndex, s) {
  const frames = await prepareFrames(project, pageIndex, s, { live: false });
  frames.draw(null);
  frames.dispose();
  return frames.canvas;
}

/**
 * Get ready to draw a page many times (video / GIF): fonts and pictures load
 * once, then draw(t) paints the page as it looks t seconds in, animations,
 * drifting background and moving 3D vehicles included. draw(null) is a still.
 */
export async function prepareFrames(project, pageIndex, s, { live = true } = {}) {
  const page = project.pages[pageIndex];
  const { w, h } = project.canvas;
  await loadFonts(usedFonts(project));
  const vehicles = page.elements.filter((e) => e.type === "vehicle" && !e.hidden);
  const movers = live ? vehicles.filter((e) => e.animate || e.spin) : [];
  const images = await loadImages(project, page, new Set(movers.map((e) => e.id)));
  // Moving vehicles are drawn live from the shared 3D renderer every frame.
  const svc = movers.length ? await import("../vehicles3d/service.js") : null;
  const held = new Map(movers.map((e) => [e.id, svc.hold(e.vehicle)]));

  const canvas = makeCanvas(w * s, h * s);
  const ctx = canvas.getContext("2d");
  let last = 0;

  const draw = (t) => {
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.clearRect(0, 0, w, h);
    drawBackground(ctx, page.bg, w, h, images, t);
    const dt = t == null ? 0.001 : Math.max(0.001, t - last);
    last = t ?? 0;
    for (const el of page.elements) {
      if (el.hidden || el.opacity <= 0) continue;
      const m = animAt(el.anim, t);
      if (m.o <= 0 || m.s <= 0) continue;
      ctx.save();
      ctx.translate(el.x + el.w / 2, el.y + el.h / 2);
      ctx.rotate((el.rotation * Math.PI) / 180);
      ctx.translate(m.tx * el.w, m.ty * el.h);
      ctx.rotate((m.r * Math.PI) / 180);
      ctx.scale(m.s, m.s);
      ctx.translate(-el.w / 2, -el.h / 2);
      ctx.globalAlpha = el.opacity * m.o;
      const hold = held.get(el.id);
      if (hold) {
        const k = Math.min(2, 1200 / Math.max(el.w, el.h)) || 1;
        const src = hold.frame({ view: el.view, yaw: el.yaw, pitch: el.pitch, zoom: el.zoom, spin: el.spin, animate: el.animate, ground: el.ground }, Math.round(el.w * k), Math.round(el.h * k), t ?? 0, dt);
        ctx.drawImage(src, 0, 0, el.w, el.h);
      } else DRAW[el.type]?.(ctx, el, { images, canvas, s });
      ctx.restore();
    }
  };
  return { canvas, draw, dispose: () => held.forEach((x) => x.release()) };
}

// ---------------------------------------------------------------------------

function drawCurvedText(ctx, el) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  const glyphs = curveLayout(el, (t) => ctx.measureText(t).width);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const each = (fn) =>
    glyphs.forEach((g) => {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.angle);
      fn(g.ch);
      ctx.restore();
    });
  if (el.shadow?.on) {
    ctx.save();
    ctx.shadowColor = rgba(el.shadow.color, el.shadow.opacity);
    ctx.shadowBlur = el.shadow.blur;
    ctx.shadowOffsetX = el.shadow.x;
    ctx.shadowOffsetY = el.shadow.y;
    ctx.fillStyle = el.color;
    each((ch) => ctx.fillText(ch, 0, 0));
    ctx.restore();
  }
  if (el.stroke.width) {
    ctx.strokeStyle = el.stroke.color;
    ctx.lineWidth = el.stroke.width * 2;
    ctx.lineJoin = "round";
    each((ch) => ctx.strokeText(ch, 0, 0));
  }
  ctx.fillStyle = el.color;
  each((ch) => ctx.fillText(ch, 0, 0));
}

function drawBackground(ctx, bg, w, h, images, t = null) {
  ctx.fillStyle = bg.color;
  ctx.fillRect(0, 0, w, h);
  if (bg.type === "gradient") {
    const [x1, y1, x2, y2] = gradientLine(bg.angle, w, h);
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    bg.colors.forEach((c, i) => g.addColorStop(bg.colors.length === 1 ? 0 : i / (bg.colors.length - 1), c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else if (bg.type === "image" && images.get(bg.asset)) {
    ctx.save();
    if (bg.blur) ctx.filter = `blur(${bg.blur}px)`;
    const k = bg.blur ? 1.08 : 1;
    drawFit(ctx, images.get(bg.asset), (w - w * k) / 2, (h - h * k) / 2, w * k, h * k, bg.fit);
    ctx.restore();
    if (bg.dim) {
      ctx.fillStyle = `rgba(0,0,0,${bg.dim})`;
      ctx.fillRect(0, 0, w, h);
    }
  } else if (bg.type === "mesh" && bg.orbs) {
    const size = Math.max(w, h) * 0.6;
    ctx.save();
    ctx.filter = `blur(${Math.round(size * 0.07)}px)`;
    ctx.globalAlpha = 0.7;
    bg.colors.forEach((c, i) => {
      const [sx, sy] = SPOTS[i % 5];
      const d = driftAt(i, bg.drift, t);
      const cx = (sx / 100) * w + d.tx * size;
      const cy = (sy / 100) * h + d.ty * size;
      const r = (size / 2) * d.s;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, c);
      g.addColorStop(0.68, rgba(c, 0));
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    });
    ctx.restore();
  }
}

/** Blur what's already been drawn behind a clip – the glass effect. */
function frost(ctx, canvas, blur, s) {
  const snapshot = makeCanvas(canvas.width, canvas.height);
  snapshot.getContext("2d").drawImage(canvas, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.filter = `blur(${blur * s}px) saturate(160%)`;
  ctx.drawImage(snapshot, 0, 0);
  ctx.restore();
}

const DRAW = {
  vehicle(ctx, el, { images }) {
    const img = images.get(`veh:${el.id}`);
    if (img) ctx.drawImage(img, 0, 0, el.w, el.h);
  },
  text(ctx, el) {
    const size = el.size;
    ctx.font = `${el.weight} ${size}px ${fontStack(el.font)}`;
    if (el.curve) return drawCurvedText(ctx, el);
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${el.spacing}px`;
    const raw = el.upper ? el.text.toUpperCase() : el.text;
    const pad = el.bg?.on ? el.bg.pad : 0;
    const lines = wrapText(ctx, raw, Math.max(1, el.w - pad * 2));
    const lh = size * el.lineHeight;
    const blockH = lines.length * lh;
    const top = (el.h - blockH) / 2;
    const widths = lines.map((l) => ctx.measureText(l).width);
    const xFor = (lw) => (el.align === "left" ? pad : el.align === "right" ? el.w - pad - lw : (el.w - lw) / 2);

    if (el.bg?.on) {
      const bw = Math.min(el.w, Math.max(...widths) + pad * 2);
      const bx = el.align === "left" ? 0 : el.align === "right" ? el.w - bw : (el.w - bw) / 2;
      ctx.fillStyle = rgba(el.bg.color, el.bg.opacity);
      ctx.beginPath();
      ctx.roundRect(bx, top - pad, bw, blockH + pad * 2, el.bg.radius);
      ctx.fill();
    }
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const each = (fn) => lines.forEach((l, i) => fn(l, xFor(widths[i]), top + lh * i + lh / 2));
    if (el.shadow?.on) {
      ctx.save();
      ctx.shadowColor = rgba(el.shadow.color, el.shadow.opacity);
      ctx.shadowBlur = el.shadow.blur;
      ctx.shadowOffsetX = el.shadow.x;
      ctx.shadowOffsetY = el.shadow.y;
      ctx.fillStyle = el.stroke.width ? el.stroke.color : el.color;
      if (el.stroke.width) {
        ctx.strokeStyle = el.stroke.color;
        ctx.lineWidth = el.stroke.width * 2;
        ctx.lineJoin = "round";
        each((l, x, y) => ctx.strokeText(l, x, y));
      } else each((l, x, y) => ctx.fillText(l, x, y));
      ctx.restore();
    }
    if (el.stroke.width) {
      ctx.strokeStyle = el.stroke.color;
      ctx.lineWidth = el.stroke.width * 2;
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      each((l, x, y) => ctx.strokeText(l, x, y));
    }
    ctx.fillStyle = el.color;
    each((l, x, y) => ctx.fillText(l, x, y));
  },

  sticker(ctx, el) {
    const size = Math.min(el.w, el.h) * 0.84;
    ctx.font = `${size}px ${EMOJI_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(el.emoji, el.w / 2, el.h / 2 + size * 0.04);
  },

  image(ctx, el, { images, s }) {
    const img = images.get(el.asset);
    if (!img) return;
    if ((el.mask && el.mask !== "none") || el.outline?.width > 0) return drawMaskedImage(ctx, el, img, s);
    if (el.shadow) outerShadow(ctx, el.w, el.h, Math.min(el.radius, el.w / 2, el.h / 2), "rgba(0,0,0,.45)", 40, 18);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, el.w, el.h, Math.min(el.radius, el.w / 2, el.h / 2));
    ctx.clip();
    const f = el.filters;
    ctx.filter = imageFilter(f, el.outline, s);
    if (el.flipX || el.flipY) {
      ctx.translate(el.flipX ? el.w : 0, el.flipY ? el.h : 0);
      ctx.scale(el.flipX ? -1 : 1, el.flipY ? -1 : 1);
    }
    drawFit(ctx, img, 0, 0, el.w, el.h, el.fit);
    ctx.restore();
    if (el.border.width) {
      ctx.strokeStyle = el.border.color;
      ctx.lineWidth = el.border.width;
      const b = el.border.width / 2;
      ctx.beginPath();
      ctx.roundRect(b, b, el.w - b * 2, el.h - b * 2, Math.max(0, Math.min(el.radius, el.w / 2, el.h / 2) - b));
      ctx.stroke();
    }
  },

  shape(ctx, el) {
    const b = el.border.width;
    const path = new Path2D(shapePath(el.shape, el.w, el.h, el.radius, b / 2));
    if (el.fill.type === "gradient") {
      const [x1, y1, x2, y2] = gradientLine(el.fill.angle, el.w, el.h);
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, el.fill.color);
      g.addColorStop(1, el.fill.color2);
      ctx.fillStyle = g;
    } else ctx.fillStyle = el.fill.color;
    if (el.shadow) {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.4)";
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 16;
      ctx.fill(path);
      ctx.restore();
    }
    ctx.fill(path);
    if (b) {
      ctx.strokeStyle = el.border.color;
      ctx.lineWidth = b;
      ctx.lineJoin = "round";
      ctx.stroke(path);
    }
  },

  glass(ctx, el, { canvas, s }) {
    const r = Math.min(el.radius, el.w / 2, el.h / 2);
    // Elevation shadow first, then frost what's behind inside the clip.
    outerShadow(ctx, el.w, el.h, r, "rgba(0,0,0,.4)", 60, 24);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, el.w, el.h, r);
    ctx.clip();
    frost(ctx, canvas, el.frost, s);
    ctx.fillStyle = `rgba(255,255,255,${el.fill})`;
    ctx.fillRect(0, 0, el.w, el.h);
    // Tint
    ctx.save();
    ctx.globalAlpha *= el.tint.strength;
    ctx.globalCompositeOperation = el.tint.blend === "normal" ? "source-over" : el.tint.blend;
    const cs = el.tint.colors;
    const lin = ctx.createLinearGradient(0, 0, el.w, el.h);
    lin.addColorStop(0, cs[0]);
    lin.addColorStop(1, cs[cs.length - 1]);
    ctx.fillStyle = lin;
    ctx.fillRect(0, 0, el.w, el.h);
    for (let i = cs.length - 1; i >= 0; i--) {
      const [sx, sy] = SPOTS[i % 5];
      const cx = (sx / 100) * el.w;
      const cy = (sy / 100) * el.h;
      const rad = Math.hypot(Math.max(cx, el.w - cx), Math.max(cy, el.h - cy)) * 0.62;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, cs[i]);
      g.addColorStop(1, rgba(cs[i], 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, el.w, el.h);
    }
    ctx.restore();
    // Glare
    const [x1, y1, x2, y2] = gradientLine(160, el.w, el.h);
    const glare = ctx.createLinearGradient(x1, y1, x2, y2);
    glare.addColorStop(0, `rgba(255,255,255,${Math.min(0.6, el.shine * 1.2)})`);
    glare.addColorStop(0.45, "rgba(255,255,255,0)");
    ctx.fillStyle = glare;
    ctx.fillRect(0, 0, el.w, el.h);
    ctx.restore();

    ctx.strokeStyle = `rgba(255,255,255,${el.shine})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(0.5, 0.5, el.w - 1, el.h - 1, Math.max(0, r - 0.5));
    ctx.stroke();
  },

  button(ctx, el, { canvas, s }) {
    const r = Math.min(el.radius, el.w / 2, el.h / 2);
    const outline = el.variant === "outline";
    if (!outline) outerShadow(ctx, el.w, el.h, r, rgba(el.color, 0.35), 26, 10);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, el.w, el.h, r);
    ctx.clip();
    if (el.variant === "glass") {
      frost(ctx, canvas, 16, s);
      ctx.fillStyle = "rgba(255,255,255,.08)";
      ctx.fillRect(0, 0, el.w, el.h);
      const g = ctx.createLinearGradient(...gradientLine(135, el.w, el.h));
      g.addColorStop(0, rgba(el.color, 0.42));
      g.addColorStop(1, rgba(el.color2, 0.42));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, el.w, el.h);
    } else if (el.variant === "gradient") {
      const g = ctx.createLinearGradient(...gradientLine(135, el.w, el.h));
      g.addColorStop(0, el.color);
      g.addColorStop(1, el.color2);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, el.w, el.h);
    } else if (el.variant === "solid") {
      ctx.fillStyle = el.color;
      ctx.fillRect(0, 0, el.w, el.h);
    }
    ctx.restore();
    ctx.lineWidth = outline ? 3 : 1;
    ctx.strokeStyle = outline ? el.color : `rgba(255,255,255,${el.variant === "glass" ? 0.3 : 0.16})`;
    ctx.beginPath();
    const b = ctx.lineWidth / 2;
    ctx.roundRect(b, b, el.w - b * 2, el.h - b * 2, Math.max(0, r - b));
    ctx.stroke();

    // Label: optional emoji icon + text, centred together.
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const gap = el.icon && el.label ? el.size * 0.4 : 0;
    ctx.font = `${el.size}px ${EMOJI_FONT}`;
    const iw = el.icon ? ctx.measureText(el.icon).width : 0;
    ctx.font = `${el.weight} ${el.size}px ${fontStack(el.font)}`;
    const tw = el.label ? ctx.measureText(el.label).width : 0;
    let x = (el.w - (iw + gap + tw)) / 2;
    if (el.icon) {
      ctx.font = `${el.size}px ${EMOJI_FONT}`;
      ctx.fillText(el.icon, x, el.h / 2);
      x += iw + gap;
    }
    if (el.label) {
      ctx.font = `${el.weight} ${el.size}px ${fontStack(el.font)}`;
      ctx.fillStyle = outline ? el.color : el.textColor;
      ctx.fillText(el.label, x, el.h / 2 + el.size * 0.04);
    }
  },
};

// ---------------------------------------------------------------------------

/** A shadow that, like CSS box-shadow, only shows outside the shape. */
/** A picture clipped to a shape; drawn off-screen first so the shadow follows the shape. */
/**
 * A picture clipped to a shape (a mask, or its rounded box), drawn off-screen
 * first so the shadow and sticker outline follow the shape and aren't cut off.
 */
function drawMaskedImage(ctx, el, img, s) {
  const masked = el.mask && el.mask !== "none";
  const kind = masked ? el.mask : "rect";
  const r = masked ? Math.min(el.w, el.h) * 0.2 : Math.min(el.radius, el.w / 2, el.h / 2);
  const off = makeCanvas(el.w * s, el.h * s);
  const g = off.getContext("2d");
  g.scale(s, s);
  g.clip(new Path2D(shapePath(kind, el.w, el.h, r)));
  g.filter = imageFilter(el.filters, null, s);
  if (el.flipX || el.flipY) {
    g.translate(el.flipX ? el.w : 0, el.flipY ? el.h : 0);
    g.scale(el.flipX ? -1 : 1, el.flipY ? -1 : 1);
  }
  drawFit(g, img, 0, 0, el.w, el.h, el.fit);
  ctx.save();
  if (el.shadow) {
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 18;
  }
  if (el.outline?.width > 0) ctx.filter = imageFilter(NEUTRAL, el.outline, s);
  ctx.drawImage(off, 0, 0, el.w, el.h);
  ctx.restore();
  if (el.border.width) {
    ctx.strokeStyle = el.border.color;
    ctx.lineWidth = el.border.width;
    ctx.lineJoin = "round";
    ctx.stroke(new Path2D(shapePath(kind, el.w, el.h, r, el.border.width / 2)));
  }
}

const NEUTRAL = { brightness: 100, contrast: 100, saturate: 100, hue: 0, grayscale: 0, blur: 0 };

function outerShadow(ctx, w, h, r, color, blur, offsetY) {
  ctx.save();
  const outside = new Path2D();
  outside.rect(-1e5, -1e5, 2e5, 2e5);
  outside.roundRect(0, 0, w, h, r);
  ctx.clip(outside, "evenodd");
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = offsetY;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, r);
  ctx.fill();
  ctx.restore();
}

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function drawFit(ctx, img, x, y, w, h, fit) {
  if (fit === "fill") return ctx.drawImage(img, x, y, w, h);
  const k = fit === "contain" ? Math.min(w / img.width, h / img.height) : Math.max(w / img.width, h / img.height);
  const iw = img.width * k;
  const ih = img.height * k;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

async function loadImages(project, page, skip = new Set()) {
  const ids = new Set();
  if (page.bg.type === "image" && page.bg.asset) ids.add(page.bg.asset);
  for (const el of page.elements) if (el.type === "image" && el.asset) ids.add(el.asset);
  const map = new Map();
  // 3D vehicles: render a still from the same angle and view.
  const vehicles = page.elements.filter((e) => e.type === "vehicle" && !e.hidden && !skip.has(e.id));
  if (vehicles.length) {
    const svc = await import("../vehicles3d/service.js");
    for (const el of vehicles) {
      const k = Math.min(2, 1600 / Math.max(el.w, el.h)) || 1;
      const url = svc.snapshot(el.vehicle, { view: el.view, yaw: el.yaw, pitch: el.pitch, zoom: el.zoom, ground: el.ground }, Math.round(el.w * k), Math.round(el.h * k));
      await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => (map.set(`veh:${el.id}`, img), resolve());
        img.onerror = resolve;
        img.src = url;
      });
    }
  }
  await Promise.all(
    [...ids].map(
      (id) =>
        new Promise((resolve) => {
          const a = project.assets[id];
          if (!a) return resolve();
          const img = new Image();
          img.onload = () => {
            map.set(id, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = a.data;
        }),
    ),
  );
  return map;
}

/** Wrap text like the player's pre-wrap + overflow-wrap:anywhere. */
export function wrapText(ctx, text, maxW) {
  const out = [];
  for (const para of text.split("\n")) {
    const words = para.split(/(\s+)/);
    let line = "";
    for (const word of words) {
      const test = line + word;
      if (!line || ctx.measureText(test).width <= maxW) {
        line = test;
        continue;
      }
      out.push(line.trimEnd());
      line = word.trimStart();
      // A single word wider than the box breaks anywhere.
      while (line && ctx.measureText(line).width > maxW) {
        let cut = line.length - 1;
        while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxW) cut--;
        out.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    out.push(line.trimEnd());
  }
  return out;
}
