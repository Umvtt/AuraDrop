// PNG export. DOM-to-image libraries can't capture `backdrop-filter`, so we
// repaint the card ourselves on a canvas from the same design model, using
// the same layout constants as the CSS.

import { BLEND_MODES, CARD_LAYOUT, orbLayout } from "./design.js";

const SCENE_PADDING = 96;

/**
 * @param {object} design
 * @param {{ scene?: boolean, scale?: number }} opts
 * @returns {Promise<Uint8Array>} PNG bytes
 */
export async function renderPng(design, { scene = true, scale = 2 } = {}) {
  const W = design.width;
  const H = design.height;
  const pad = scene ? SCENE_PADDING : 0;
  const outW = (W + pad * 2) * scale;
  const outH = (H + pad * 2) * scale;

  const [bgImage, avatarImage] = await Promise.all([
    loadImage(design.content.background),
    loadImage(design.content.avatar),
  ]);
  await loadFonts();

  // The "world" behind the glass: obsidian plus the aura orbs. It is drawn
  // even for card-only exports because the frost needs something to blur.
  const backdrop = makeCanvas(outW, outH);
  paintBackdrop(backdrop.getContext("2d"), design, outW, outH, scale, pad);

  const out = makeCanvas(outW, outH);
  const ctx = out.getContext("2d");
  ctx.scale(scale, scale);

  if (scene) {
    ctx.drawImage(backdrop, 0, 0, outW / scale, outH / scale);
    // Diffuse elevation shadow (matches the CSS box-shadow layers).
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 20;
    roundRect(ctx, pad, pad, W, H, design.radius);
    ctx.fillStyle = "rgba(8, 9, 14, 1)";
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(pad, pad);
  roundRect(ctx, 0, 0, W, H, design.radius);
  ctx.clip();

  // Frosted backdrop.
  ctx.save();
  ctx.filter = `blur(${design.frost}px) saturate(160%)`;
  ctx.drawImage(backdrop, -pad, -pad, outW / scale, outH / scale);
  ctx.restore();

  // Translucent white fill.
  ctx.fillStyle = `rgba(255, 255, 255, ${design.fill})`;
  ctx.fillRect(0, 0, W, H);

  if (bgImage) {
    ctx.save();
    ctx.globalAlpha = design.content.backgroundOpacity;
    drawCover(ctx, bgImage, 0, 0, W, H);
    ctx.restore();
  }

  // Aura tint, blended like the CSS mix-blend-mode.
  ctx.save();
  ctx.globalAlpha = design.aura.strength;
  ctx.globalCompositeOperation =
    BLEND_MODES.find((b) => b.id === design.aura.blend)?.canvas ?? "source-over";
  ctx.drawImage(paintMesh(design.aura, W * scale, H * scale), 0, 0, W, H);
  ctx.restore();

  // Static glare at its resting position.
  const glare = Math.min(0.75, design.shine * 1.6) * 0.55;
  const radial = ctx.createRadialGradient(W * 0.28, H * 0.18, 0, W * 0.28, H * 0.18, Math.max(W, H) * 0.55);
  radial.addColorStop(0, `rgba(255,255,255,${glare})`);
  radial.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, W, H);

  // Inset highlights.
  const inset = ctx.createLinearGradient(0, 0, 0, H);
  inset.addColorStop(0, `rgba(255,255,255,${Math.min(1, design.shine * 1.4)})`);
  inset.addColorStop(0.04, "rgba(255,255,255,0)");
  inset.addColorStop(0.96, "rgba(255,255,255,0)");
  inset.addColorStop(1, `rgba(255,255,255,${design.shine * 0.35})`);
  ctx.fillStyle = inset;
  ctx.fillRect(0, 0, W, H);

  paintContent(ctx, design, avatarImage);
  ctx.restore();

  // Crisp 1px border, drawn on the pixel grid.
  ctx.save();
  ctx.translate(pad, pad);
  roundRect(ctx, 0.5, 0.5, W - 1, H - 1, Math.max(0, design.radius - 0.5));
  ctx.strokeStyle = `rgba(255, 255, 255, ${design.shine})`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  const blob = await new Promise((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't encode the PNG."))), "image/png"),
  );
  return new Uint8Array(await blob.arrayBuffer());
}

function paintBackdrop(ctx, design, w, h, scale, pad) {
  ctx.fillStyle = "#08090e";
  ctx.fillRect(0, 0, w, h);
  if (!design.aura.orbs) return;
  // Orbs are laid out in percent of a stage; map that onto the card plus a
  // generous margin so the colour sits behind and around the glass.
  const areaX = pad * scale - design.width * scale * 0.35;
  const areaY = pad * scale - design.height * scale * 0.35;
  const areaW = design.width * scale * 1.7;
  const areaH = design.height * scale * 1.7;
  ctx.save();
  ctx.filter = `blur(${40 * scale}px)`;
  ctx.globalAlpha = 0.6;
  for (const orb of orbLayout(design.aura)) {
    const cx = areaX + (orb.left / 100) * areaW;
    const cy = areaY + (orb.top / 100) * areaH;
    const r = (orb.size / 2) * scale;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, orb.color);
    g.addColorStop(0.7, hexAlpha(orb.color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  ctx.restore();
}

function paintMesh(aura, w, h) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  // CSS linear-gradient angle → canvas line through the centre.
  const a = ((aura.angle - 90) * Math.PI) / 180;
  const len = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a));
  const dx = (Math.cos(a) * len) / 2;
  const dy = (Math.sin(a) * len) / 2;
  const lin = ctx.createLinearGradient(w / 2 - dx, h / 2 - dy, w / 2 + dx, h / 2 + dy);
  lin.addColorStop(0, aura.points[0].color);
  lin.addColorStop(1, aura.points[aura.points.length - 1].color);
  ctx.fillStyle = lin;
  ctx.fillRect(0, 0, w, h);
  // Radials are listed first in CSS, i.e. painted on top – so paint them
  // last, in reverse order.
  for (const p of [...aura.points].reverse()) {
    const cx = (p.x / 100) * w;
    const cy = (p.y / 100) * h;
    // `circle at x y` with "farthest-corner" sizing, 62% stop.
    const r = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) * 0.62;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, p.color);
    g.addColorStop(1, hexAlpha(p.color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  return c;
}

function paintContent(ctx, design, avatarImage) {
  const L = CARD_LAYOUT;
  const { content } = design;
  const W = design.width;
  const H = design.height;
  const innerW = W - L.padding * 2;
  let y = L.padding;
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";

  if (content.avatar || content.emoji) {
    const r = L.avatar / 2;
    const cx = L.padding + r;
    const cy = y + r;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fill();
    if (avatarImage) {
      ctx.save();
      ctx.clip();
      drawCover(ctx, avatarImage, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = "#fff";
      ctx.font = `28px "Segoe UI Emoji", "Apple Color Emoji", ${L.fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(content.emoji, cx, cy + 1);
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r - 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.stroke();
    ctx.restore();
    y += L.avatar + L.gap;
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  if (content.title) {
    const lineH = L.titleSize * 1.25;
    ctx.font = `650 ${L.titleSize}px ${L.fontFamily}`;
    ctx.fillStyle = "#fff";
    ctx.fillText(ellipsize(ctx, content.title, innerW), L.padding, y + lineH * 0.8);
    y += lineH;
  }

  const buttonTop = H - L.padding - L.buttonHeight;
  if (content.subtitle) {
    y += 6;
    const lineH = L.subtitleSize * 1.45;
    ctx.font = `400 ${L.subtitleSize}px ${L.fontFamily}`;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    const lines = wrap(ctx, content.subtitle, innerW, L.subtitleLines);
    for (const line of lines) {
      if (y + lineH > (content.button ? buttonTop : H - L.padding) + 2) break;
      ctx.fillText(line, L.padding, y + lineH * 0.76);
      y += lineH;
    }
  }

  if (content.button) {
    ctx.font = `600 ${L.buttonSize}px ${L.fontFamily}`;
    const label = ellipsize(ctx, content.button, innerW - L.buttonPadX * 2);
    const bw = Math.min(innerW, ctx.measureText(label).width + L.buttonPadX * 2 + 2);
    const bh = L.buttonHeight;
    roundRect(ctx, L.padding + 0.5, buttonTop + 0.5, bw - 1, bh - 1, bh / 2);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, L.padding + bw / 2, buttonTop + bh / 2 + 1);
  }
}

// ---------------------------------------------------------------------------

/** Canvas text silently falls back if a font isn't loaded yet. */
async function loadFonts() {
  if (!document.fonts) return;
  const family = '"Inter Variable"';
  const L = CARD_LAYOUT;
  try {
    await Promise.all([
      document.fonts.load(`650 ${L.titleSize}px ${family}`),
      document.fonts.load(`400 ${L.subtitleSize}px ${family}`),
      document.fonts.load(`600 ${L.buttonSize}px ${family}`),
    ]);
  } catch {
    // Fall back to the next font in the stack.
  }
  await document.fonts.ready;
}

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.round(w);
  c.height = Math.round(h);
  return c;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

function drawCover(ctx, img, x, y, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  const iw = img.width * s;
  const ih = img.height * s;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

function loadImage(src) {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function hexAlpha(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function ellipsize(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
  return s + "…";
}

function wrap(ctx, text, maxW, maxLines) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width <= maxW || !line) {
      line = test;
    } else {
      lines.push(line);
      line = words[i];
      if (lines.length === maxLines - 1) {
        line = words.slice(i).join(" ");
        break;
      }
    }
  }
  if (line) lines.push(lines.length === maxLines - 1 ? ellipsize(ctx, line, maxW) : line);
  return lines.slice(0, maxLines);
}
