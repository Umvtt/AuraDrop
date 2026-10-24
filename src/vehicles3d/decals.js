// Markings: national insignia, numbers, slogans and nose art, drawn into
// canvases and projected onto the (curved) armour with DecalGeometry.
import * as THREE from "three";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";

const NATION_MARK = { usa: "usstar", germany: "cross", ussr: "redstar", uk: "roundel", japan: "hinomaru", italy: "roundel-it", france: "roundel-fr", sweden: "crowns", aura: "aura" };

export function insigniaFor(style, nation, kind) {
  if (style !== "auto") return style;
  const s = NATION_MARK[nation] ?? "star";
  // British tanks didn't carry big roundels; give them a small one anyway.
  return kind === "tank" && s === "usstar" ? "star" : s;
}

function star(g, cx, cy, r, inner = 0.38) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const k = i % 2 ? inner : 1;
    const x = cx + Math.cos(a) * r * k;
    const y = cy + Math.sin(a) * r * k;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
}

/** Square canvas with a national marking. Wide bars for "usstar" with bars. */
export function insigniaCanvas(style, size = 256) {
  const cv = document.createElement("canvas");
  cv.width = size * (style === "usbars" ? 2 : 1);
  cv.height = size;
  const g = cv.getContext("2d");
  const c = size / 2;
  const r = size * 0.46;
  const disc = (rr, col, x = cv.width / 2) => {
    g.fillStyle = col;
    g.beginPath();
    g.arc(x, c, rr, 0, Math.PI * 2);
    g.fill();
  };
  switch (style) {
    case "usstar":
    case "usbars": {
      const x = cv.width / 2;
      if (style === "usbars") {
        g.fillStyle = "#f1f2f0";
        g.fillRect(x - r * 2, c - r * 0.3, r * 4, r * 0.6);
        g.fillStyle = "#1f3a68";
        g.strokeStyle = "#1f3a68";
        g.lineWidth = size * 0.03;
        g.strokeRect(x - r * 2, c - r * 0.3, r * 4, r * 0.6);
      }
      disc(r * 0.82, "#1f3a68", x);
      star(g, x, c, r * 0.8);
      g.fillStyle = "#f1f2f0";
      g.fill();
      break;
    }
    case "star":
      star(g, c, c, r);
      g.fillStyle = "#f1f2f0";
      g.fill();
      break;
    case "cross": {
      const arm = r * 0.42;
      g.fillStyle = "#f1f2f0";
      g.fillRect(c - arm, c - r, arm * 2, r * 2);
      g.fillRect(c - r, c - arm, r * 2, arm * 2);
      g.fillStyle = "#111";
      g.fillRect(c - arm * 0.5, c - r * 0.92, arm, r * 1.84);
      g.fillRect(c - r * 0.92, c - arm * 0.5, r * 1.84, arm);
      break;
    }
    case "redstar":
      star(g, c, c, r);
      g.fillStyle = "#f1f2f0";
      g.fill();
      star(g, c, c, r * 0.84);
      g.fillStyle = "#c8102e";
      g.fill();
      break;
    case "roundel":
      disc(r, "#f2c230");
      disc(r * 0.86, "#1f3a68");
      disc(r * 0.6, "#f1f2f0");
      disc(r * 0.34, "#c8102e");
      break;
    case "roundel-fr":
      disc(r, "#1f3a8a");
      disc(r * 0.66, "#f1f2f0");
      disc(r * 0.33, "#c8102e");
      break;
    case "roundel-it":
      disc(r, "#0f7a3a");
      disc(r * 0.66, "#f1f2f0");
      disc(r * 0.33, "#c8102e");
      break;
    case "hinomaru":
      disc(r, "#f1f2f0");
      disc(r * 0.84, "#bc002d");
      break;
    case "crowns":
      disc(r, "#1f4e9a");
      g.fillStyle = "#f2c230";
      for (const [dx, dy] of [[0, -0.42], [-0.38, 0.28], [0.38, 0.28]]) {
        const x = c + dx * r;
        const y = c + dy * r;
        const s = r * 0.22;
        g.beginPath();
        g.moveTo(x - s, y + s * 0.5);
        g.lineTo(x - s, y - s * 0.5);
        g.lineTo(x - s * 0.5, y);
        g.lineTo(x, y - s * 0.8);
        g.lineTo(x + s * 0.5, y);
        g.lineTo(x + s, y - s * 0.5);
        g.lineTo(x + s, y + s * 0.5);
        g.closePath();
        g.fill();
      }
      break;
    case "aura": {
      disc(r, "#0b0c12");
      g.strokeStyle = "#a78bfa";
      g.lineWidth = r * 0.12;
      g.beginPath();
      g.arc(c, c, r * 0.84, 0, Math.PI * 2);
      g.stroke();
      const grd = g.createLinearGradient(c, c - r * 0.6, c, c + r * 0.6);
      grd.addColorStop(0, "#f0abfc");
      grd.addColorStop(1, "#22d3ee");
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(c, c - r * 0.62);
      g.bezierCurveTo(c + r * 0.3, c - r * 0.2, c + r * 0.45, c, c + r * 0.45, c + r * 0.2);
      g.arc(c, c + r * 0.2, r * 0.45, 0, Math.PI);
      g.bezierCurveTo(c - r * 0.45, c, c - r * 0.3, c - r * 0.2, c, c - r * 0.62);
      g.fill();
      break;
    }
    default:
      return null;
  }
  return cv;
}

const FONTS = {
  stencil: '"Bebas Neue", Impact, sans-serif',
  block: '"Anton", Impact, sans-serif',
  script: '"Permanent Marker", cursive',
  pixel: '"Press Start 2P", monospace',
};

/** Text in a canvas, sized to fit; returns { canvas, aspect }. */
export function textCanvas(text, { color = "#f1f2f0", outline = null, font = "stencil", height = 160 } = {}) {
  const cv = document.createElement("canvas");
  const g = cv.getContext("2d");
  const f = `${font === "pixel" ? 400 : 700} ${height}px ${FONTS[font] ?? FONTS.stencil}`;
  g.font = f;
  const w = Math.max(height * 0.6, Math.ceil(g.measureText(text).width + height * 0.3));
  cv.width = w;
  cv.height = Math.round(height * 1.3);
  g.font = f;
  g.textAlign = "center";
  g.textBaseline = "middle";
  if (outline) {
    g.lineWidth = height * 0.12;
    g.lineJoin = "round";
    g.strokeStyle = outline;
    g.strokeText(text, w / 2, cv.height / 2);
  }
  g.fillStyle = color;
  g.fillText(text, w / 2, cv.height / 2);
  return { canvas: cv, aspect: w / cv.height };
}

/** Shark mouth nose art. */
export function sharkCanvas() {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 256;
  const g = cv.getContext("2d");
  g.fillStyle = "#b3122a";
  g.beginPath();
  g.moveTo(0, 90);
  g.bezierCurveTo(170, 90, 400, 70, 512, 20);
  g.bezierCurveTo(440, 190, 210, 230, 0, 200);
  g.closePath();
  g.fill();
  g.fillStyle = "#fff";
  for (let i = 0; i < 9; i++) {
    const x = 40 + i * 48;
    g.beginPath();
    g.moveTo(x, 92 - i * 4);
    g.lineTo(x + 22, 140 - i * 4);
    g.lineTo(x + 44, 90 - i * 5);
    g.fill();
    g.beginPath();
    g.moveTo(x, 198 - i * 3);
    g.lineTo(x + 22, 150 - i * 4);
    g.lineTo(x + 44, 194 - i * 4);
    g.fill();
  }
  g.beginPath();
  g.arc(440, 50, 22, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#111";
  g.beginPath();
  g.arc(446, 50, 11, 0, Math.PI * 2);
  g.fill();
  return cv;
}

/**
 * Project a canvas onto `target` (a mesh) at `point` (in root space), facing
 * along `normal`. The decal is parented to `parent` so it moves with it.
 */
export function projectDecal(target, canvas, point, normal, size, parent, opts = {}) {
  if (!canvas) return null;
  target.updateWorldMatrix(true, false);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    roughness: 0.75,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -6,
  });
  const n = normal.clone().normalize();
  const o = new THREE.Object3D();
  o.position.copy(point);
  o.lookAt(point.clone().add(n));
  o.rotateZ(opts.roll ?? 0);
  const geo = new DecalGeometry(target, point, o.rotation, size);
  if (!geo.attributes.position.count) return null;
  parent.updateWorldMatrix(true, false);
  geo.applyMatrix4(parent.matrixWorld.clone().invert());
  const m = new THREE.Mesh(geo, mat);
  m.userData.decal = true;
  m.receiveShadow = true;
  m.renderOrder = 2;
  parent.add(m);
  return m;
}

// ---------------------------------------------------------------------------
// Armour colours (shared by the viewer legend)
// ---------------------------------------------------------------------------

export const ARMOR_STOPS = [
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

export function armorColor(mm, out = new THREE.Color()) {
  for (let i = 1; i < ARMOR_STOPS.length; i++) {
    if (mm <= ARMOR_STOPS[i][0]) {
      const [a, ca] = ARMOR_STOPS[i - 1];
      const [b, cb] = ARMOR_STOPS[i];
      return out.set(ca).lerp(new THREE.Color(cb), (mm - a) / (b - a));
    }
  }
  return out.set(ARMOR_STOPS.at(-1)[1]);
}

export function effectiveArmor(t, angleDeg) {
  return t / Math.max(0.12, Math.cos((Math.min(83, Math.max(0, angleDeg)) * Math.PI) / 180));
}
