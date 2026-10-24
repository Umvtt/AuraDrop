// Tank meme stickers: little SVG pictures with a white die-cut edge. They're
// added as pictures, so they can be resized, flipped, outlined and animated.

const FONT = "Impact, 'Arial Black', 'Segoe UI', sans-serif";
const EDGE = `stroke="#fff" stroke-width="10" stroke-linejoin="round" paint-order="stroke"`;
const shadow = `<filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-opacity=".35"/></filter>`;
const wrap = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${shadow}</defs><g filter="url(#s)">${body}</g></svg>`;
/** Font size that fits `str` into `width` px (Impact-ish glyphs are ~0.6 em wide). */
const fit = (str, width, max) => Math.min(max, Math.floor(width / (str.length * 0.6)));

/** Bold sticker text; `o` overrides the white edge: { stroke, sw, opacity }. */
const text = (x, y, size, fill, str, o = {}) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="900" fill="${fill}" text-anchor="middle" stroke="${o.stroke ?? "#fff"}" stroke-width="${o.sw ?? 10}" stroke-linejoin="round" paint-order="stroke"${o.opacity ? ` opacity="${o.opacity}"` : ""}>${str}</text>`;

function stamp(label, color, rot = -8) {
  return wrap(
    420,
    200,
    `<g transform="rotate(${rot} 210 100)"><rect x="30" y="40" width="360" height="120" rx="18" fill="#fff"/><rect x="42" y="52" width="336" height="96" rx="12" fill="none" stroke="${color}" stroke-width="10"/>${text(210, 125, fit(label, 320, 66), color, label, { sw: 0 })}</g>`,
  );
}

function burst(label, sub) {
  const pts = [];
  for (let i = 0; i < 24; i++) {
    const r = i % 2 ? 120 : 175;
    const a = (i / 24) * Math.PI * 2;
    pts.push(`${(220 + Math.cos(a) * r * 1.15).toFixed(1)},${(180 + Math.sin(a) * r * 0.9).toFixed(1)}`);
  }
  return wrap(
    440,
    360,
    `<polygon points="${pts.join(" ")}" fill="#facc15" ${EDGE}/><polygon points="${pts.join(" ")}" fill="#f97316" transform="translate(220 180) scale(.72) translate(-220 -180)"/>${text(220, 182, 54, "#7f1d1d", label, { sw: 6 })}${sub ? text(220, 236, 30, "#fff", sub, { stroke: "#7f1d1d", sw: 6 }) : ""}`,
  );
}

function bubble(label, color = "#fff", ink = "#111827") {
  return wrap(
    440,
    260,
    `<path d="M40 40 h360 a26 26 0 0 1 26 26 v110 a26 26 0 0 1 -26 26 h-230 l-70 46 l16 -46 h-76 a26 26 0 0 1 -26 -26 v-110 a26 26 0 0 1 26 -26 z" fill="${color}" ${EDGE}/>${text(220, 140, fit(label, 340, 60), ink, label, { sw: 0 })}`,
  );
}

function sign(label, sub, bg, ink = "#fff") {
  return wrap(
    420,
    230,
    `<rect x="20" y="20" width="380" height="${sub ? 170 : 130}" rx="22" fill="${bg}" ${EDGE}/>${text(210, sub ? 105 : 108, fit(label, 340, 60), ink, label, { sw: 0 })}${sub ? text(210, 160, fit(sub, 330, 32), ink, sub, { sw: 0, opacity: 0.85 }) : ""}`,
  );
}

/** A round, cute cartoon tank. */
function chibi(body, dark, gun = 1) {
  return wrap(
    440,
    300,
    `<g ${EDGE.replace('stroke-width="10"', 'stroke-width="14"')}>
      <rect x="40" y="170" width="300" height="80" rx="40" fill="#374151"/>
      <path d="M60 175 Q70 120 140 115 H280 Q330 118 340 175 Z" fill="${body}"/>
      <ellipse cx="200" cy="112" rx="88" ry="62" fill="${body}"/>
      <rect x="270" y="92" width="${120 * gun}" height="26" rx="13" fill="${dark}"/>
    </g>
    <rect x="40" y="170" width="300" height="80" rx="40" fill="#374151"/>
    ${[80, 135, 190, 245, 300].map((x) => `<circle cx="${x}" cy="210" r="22" fill="#9ca3af" stroke="#1f2937" stroke-width="6"/>`).join("")}
    <path d="M60 175 Q70 120 140 115 H280 Q330 118 340 175 Z" fill="${body}"/>
    <rect x="270" y="92" width="${120 * gun}" height="26" rx="13" fill="${dark}"/>
    <rect x="${270 + 120 * gun - 10}" y="86" width="22" height="38" rx="6" fill="${dark}"/>
    <ellipse cx="200" cy="112" rx="88" ry="62" fill="${body}"/>
    <ellipse cx="200" cy="58" rx="30" ry="12" fill="${dark}"/>
    <circle cx="172" cy="112" r="13" fill="#111827"/><circle cx="226" cy="112" r="13" fill="#111827"/>
    <circle cx="176" cy="107" r="4.5" fill="#fff"/><circle cx="230" cy="107" r="4.5" fill="#fff"/>
    <path d="M186 136 Q200 148 214 136" stroke="#111827" stroke-width="6" fill="none" stroke-linecap="round"/>
    <ellipse cx="148" cy="130" rx="12" ry="7" fill="#f472b6" opacity=".55"/><ellipse cx="252" cy="130" rx="12" ry="7" fill="#f472b6" opacity=".55"/>`,
  );
}

function killMarker() {
  return wrap(
    360,
    260,
    `<path d="M40 40 H320 V190 L180 235 L40 190 Z" fill="#b91c1c" ${EDGE}/>
     <circle cx="180" cy="100" r="44" fill="none" stroke="#fff" stroke-width="10"/>
     <path d="M180 42 V158 M122 100 H238" stroke="#fff" stroke-width="10"/>
     ${text(180, 192, 34, "#fff", "-1 TANK", { sw: 0 })}`,
  );
}

function flag() {
  return wrap(
    360,
    320,
    `<rect x="70" y="30" width="16" height="270" rx="8" fill="#78350f" ${EDGE}/>
     <path d="M86 40 Q170 20 230 50 T330 50 V170 Q270 150 220 170 T86 160 Z" fill="#fff" stroke="#e5e7eb" stroke-width="6"/>
     ${text(208, 118, 44, "#111827", "SEND HELP", { sw: 0 })}`,
  );
}

function skull(label) {
  return wrap(
    360,
    300,
    `<circle cx="180" cy="120" r="92" fill="#111827" ${EDGE}/>
     <path d="M118 112 a62 58 0 1 1 124 0 v28 h-22 v24 h-80 v-24 h-22 z" fill="#f3f4f6"/>
     <circle cx="152" cy="112" r="17" fill="#111827"/><circle cx="208" cy="112" r="17" fill="#111827"/>
     <path d="M180 128 l-10 18 h20 z" fill="#111827"/>
     ${text(180, 268, 40, "#ef4444", label)}`,
  );
}

function fire() {
  return wrap(
    320,
    360,
    `<path d="M160 30 C210 100 270 130 260 220 C255 290 210 330 160 330 C100 330 60 290 60 225 C60 170 100 150 110 100 C130 130 140 140 150 150 C150 110 140 70 160 30 Z" fill="#f97316" ${EDGE}/>
     <path d="M160 140 C190 180 220 200 215 250 C212 290 190 310 160 310 C125 310 105 285 105 250 C105 220 130 205 140 180 C150 200 158 205 162 210 C162 185 150 165 160 140 Z" fill="#facc15"/>
     ${text(160, 300, 46, "#7f1d1d", "ON FIRE", { sw: 6 })}`,
  );
}

export const TANK_STICKERS = [
  { id: "bias", name: "BIAS stamp", svg: stamp("BIAS!", "#dc2626") },
  { id: "skill", name: "Skill issue stamp", svg: stamp("SKILL ISSUE", "#7c3aed", 6) },
  { id: "ammo", name: "Ammo racked", svg: burst("AMMO", "RACKED!") },
  { id: "boom", name: "Kaboom", svg: burst("KABOOM!") },
  { id: "rico", name: "Ricochet bubble", svg: bubble("RICOCHET!") },
  { id: "nonpen", name: "Non-pen bubble", svg: bubble("NON-PEN?!", "#1f2937", "#fde68a") },
  { id: "kill", name: "-1 tank", svg: killMarker() },
  { id: "tracked", name: "Tracked sign", svg: sign("TRACKED", "please send a mechanic", "#ca8a04") },
  { id: "onemore", name: "One more game", svg: sign("1 MORE GAME", "it's 3 a.m.", "#1d4ed8") },
  { id: "crew", name: "Crew knocked out", svg: skull("CREW: GONE") },
  { id: "fire", name: "On fire", svg: fire() },
  { id: "flag", name: "Send help flag", svg: flag() },
  { id: "chibi-green", name: "Chibi tank (green)", svg: chibi("#4d7c0f", "#365314") },
  { id: "chibi-desert", name: "Chibi tank (desert)", svg: chibi("#d4a64a", "#8a6a24", 1.15) },
  { id: "chibi-grey", name: "Chibi tank (grey)", svg: chibi("#6b7280", "#374151", 0.8) },
];

export const stickerUrl = (s) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s.svg)}`;
