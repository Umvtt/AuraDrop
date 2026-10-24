// Materials: paint with world-space camouflage, weathering and zimmerit,
// plus steel, rubber, glass and friends. Paint textures are generated.
import * as THREE from "three";

function rngFrom(seed) {
  let s = (seed >>> 0) % 2147483647 || 7;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** Paint the camouflage pattern into a square canvas that tiles. */
export function camoCanvas(paint, size = 512) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const g = cv.getContext("2d");
  const rnd = rngFrom(paint.seed ?? 7);
  const { base, c1, c2, c3 } = paint;
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  const wrap = (fn) => {
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) fn(ox, oy);
  };
  const blob = (color, n, rmin, rmax, stretch = 1.9, blur = 5) => {
    for (let i = 0; i < n; i++) {
      const cx = rnd() * size;
      const cy = rnd() * size;
      const r = rmin + rnd() * (rmax - rmin);
      const rot = rnd() * Math.PI;
      const pts = [];
      const k = 14;
      for (let j = 0; j < k; j++) {
        const a = (j / k) * Math.PI * 2;
        const rr = r * (0.5 + rnd() * 0.7);
        pts.push([Math.cos(a) * rr * stretch, Math.sin(a) * rr]);
      }
      wrap((ox, oy) => {
        g.save();
        g.translate(cx + ox, cy + oy);
        g.rotate(rot);
        g.beginPath();
        pts.forEach(([x, y], j) => {
          const [nx, ny] = pts[(j + 1) % k];
          j ? g.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2) : g.moveTo((x + nx) / 2, (y + ny) / 2);
        });
        g.closePath();
        g.fillStyle = color;
        g.fill();
        g.restore();
      });
    }
  };
  switch (paint.camo) {
    case "twotone":
      blob(c1, 8, size * 0.06, size * 0.12, 2.2);
      break;
    case "ambush":
      blob(c1, 8, size * 0.05, size * 0.1);
      blob(c2, 7, size * 0.04, size * 0.09);
      // The famous "light dots" of ambush camo.
      for (let i = 0; i < 120; i++) {
        const x = rnd() * size;
        const y = rnd() * size;
        g.fillStyle = i % 3 ? c3 : c1;
        g.beginPath();
        g.arc(x, y, size * (0.0025 + rnd() * 0.0025), 0, Math.PI * 2);
        g.fill();
      }
      break;
    case "stripes":
      g.lineCap = "round";
      for (let i = 0; i < 14; i++) {
        const x = rnd() * size;
        wrap((ox) => {
          g.strokeStyle = i % 3 === 2 ? c2 : c1;
          g.lineWidth = size * (0.015 + rnd() * 0.02);
          g.beginPath();
          g.moveTo(x + ox, -20);
          g.bezierCurveTo(x + ox + size * 0.1, size * 0.3, x + ox - size * 0.08, size * 0.6, x + ox + size * 0.04, size + 20);
          g.stroke();
        });
      }
      break;
    case "splinter":
      for (let i = 0; i < 22; i++) {
        const cx = rnd() * size;
        const cy = rnd() * size;
        const s = size * (0.08 + rnd() * 0.14);
        const pts = [[0, 0], [s * (0.7 + rnd()), s * (rnd() - 0.5)], [s * (rnd() - 0.2), s * (0.6 + rnd() * 0.7)]];
        wrap((ox, oy) => {
          g.fillStyle = i % 2 ? c1 : c2;
          g.beginPath();
          pts.forEach(([x, y], j) => (j ? g.lineTo(cx + ox + x, cy + oy + y) : g.moveTo(cx + ox + x, cy + oy + y)));
          g.closePath();
          g.fill();
        });
      }
      break;
    case "winter":
      // Green base showing through brushed whitewash.
      g.fillStyle = c1;
      g.fillRect(0, 0, size, size);
      blob(base, 14, size * 0.08, size * 0.2, 2.5, 10);
      for (let i = 0; i < 400; i++) {
        g.strokeStyle = base;
        g.globalAlpha = 0.25;
        g.lineWidth = 3 + rnd() * 6;
        const x = rnd() * size;
        const y = rnd() * size;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (rnd() - 0.5) * 60, y + rnd() * 30);
        g.stroke();
      }
      g.globalAlpha = 1;
      break;
    case "digital": {
      const px = size / 48;
      for (let i = 0; i < 900; i++) {
        g.fillStyle = [c1, c2, c3][i % 3];
        g.fillRect(Math.floor(rnd() * 48) * px, Math.floor(rnd() * 48) * px, px * (1 + Math.floor(rnd() * 3)), px * (1 + Math.floor(rnd() * 2)));
      }
      break;
    }
    case "desert":
      blob(c1, 5, size * 0.08, size * 0.16, 2, 12);
      blob(c2, 4, size * 0.05, size * 0.1, 2, 10);
      break;
    case "racing":
      // Stripes are drawn by the shader along the vehicle's length.
      break;
    default:
  }
  // One soft blur pass gives every blob a sprayed edge (much faster than blurring each).
  if (["twotone", "ambush", "desert", "winter"].includes(paint.camo)) {
    const tmp = document.createElement("canvas");
    tmp.width = tmp.height = size;
    const t = tmp.getContext("2d");
    t.drawImage(cv, 0, 0);
    g.save();
    g.filter = "blur(2.5px)";
    // Draw the tile 3×3 so the blur wraps around the edges too.
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) g.drawImage(tmp, ox, oy);
    g.restore();
  }
  // Fine paint grain from a small cached noise tile (no per-pixel work on the big texture).
  g.save();
  g.globalAlpha = 0.18;
  g.globalCompositeOperation = "overlay";
  g.fillStyle = g.createPattern(grainTile(), "repeat");
  g.fillRect(0, 0, size, size);
  g.restore();
  return cv;
}

let grain = null;
function grainTile() {
  if (grain) return grain;
  grain = document.createElement("canvas");
  grain.width = grain.height = 96;
  const g = grain.getContext("2d");
  const img = g.createImageData(96, 96);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 90;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return grain;
}

let zimTex = null;
/** Zimmerit ridges (bump-like brightness pattern). */
function zimmeritTexture() {
  if (zimTex) return zimTex;
  const size = 512;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const g = cv.getContext("2d");
  g.fillStyle = "#808080";
  g.fillRect(0, 0, size, size);
  const rows = 14;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 28; c++) {
      const x = (c / 28) * size;
      const y = (r / rows) * size + (c % 2 ? size / rows / 2 : 0);
      const grd = g.createLinearGradient(x, 0, x + size / 28, 0);
      grd.addColorStop(0, "#585858");
      grd.addColorStop(0.45, "#b8b8b8");
      grd.addColorStop(1, "#585858");
      g.fillStyle = grd;
      g.fillRect(x + 2, y, size / 28 - 4, size / rows - 4);
    }
  }
  zimTex = new THREE.CanvasTexture(cv);
  zimTex.wrapS = zimTex.wrapT = THREE.RepeatWrapping;
  return zimTex;
}

const PAINT_GLSL_HEAD = `
varying vec3 vWPos;
varying vec3 vWNorm;
uniform sampler2D uCamo;
uniform sampler2D uZim;
uniform float uZimOn;
uniform float uWear;
uniform float uScale;
uniform float uRacing;
uniform vec3 uStripe;
uniform float uGround;
uniform float uBump;
uniform float uBumpKind;
vec3 perturbNormalArb2(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection) {
  vec3 vSigmaX = normalize(dFdx(surf_pos.xyz));
  vec3 vSigmaY = normalize(dFdy(surf_pos.xyz));
  vec3 vN = surf_norm;
  vec3 R1 = cross(vSigmaY, vN);
  vec3 R2 = cross(vN, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDirection;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}
vec3 triTex(sampler2D t, vec3 p, vec3 n, float k) {
  vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z);
  return texture2D(t, p.zy * k).rgb * w.x + texture2D(t, p.xz * k).rgb * w.y + texture2D(t, p.xy * k).rgb * w.z;
}
float vhash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(vhash(i), vhash(i + vec2(1, 0)), f.x), mix(vhash(i + vec2(0, 1)), vhash(i + vec2(1, 1)), f.x), f.y); }
`;

// Height for bump: 0 rolled plate, 1 cast steel, 2 zimmerit.
const BUMP_GLSL = `
float bumpH = 0.0;
{
  vec3 bp = vWPos;
  float rolled = vnoise(bp.xy * 1.7 + bp.z) * 0.6 + vnoise(bp.zy * 6.0) * 0.25 + vnoise(bp.xz * 40.0) * 0.05;
  float castN = vnoise(bp.xy * 9.0 + bp.z * 7.0) * 0.5 + vnoise(bp.zy * 23.0 + bp.x * 5.0) * 0.35 + vnoise(bp.xz * 48.0) * 0.25;
  bumpH = uBumpKind < 0.5 ? rolled * 0.35 : uBumpKind < 1.5 ? castN : rolled * 0.3;
  if (uBumpKind > 1.5 && abs(vWNorm.y) < 0.6) bumpH += triTex(uZim, vWPos, vWNorm, 1.4).r * 1.6;
}
vec2 dHdxy = vec2(dFdx(bumpH), dFdy(bumpH)) * uBump;
normal = perturbNormalArb2(-vViewPosition, normal, dHdxy, faceDirection);
`;

const PAINT_GLSL_BODY = `
vec3 paintCol = pow(triTex(uCamo, vWPos, vWNorm, 0.22 / uScale), vec3(2.2));
if (uRacing > 0.5) {
  float s = abs(vWPos.z);
  float band = step(0.12, s) * step(s, 0.22) + step(s, 0.06);
  band *= step(0.2, vWNorm.y + 0.3);
  paintCol = mix(paintCol, uStripe, band);
}
float nA = vnoise(vWPos.xz * 3.0 + vWPos.y * 2.0) * 0.6 + vnoise(vWPos.xy * 9.0) * 0.4;
// Mud low down, dust on top faces, grime streaks on vertical plates, chipped edges.
float mud = smoothstep(uGround + 0.9, uGround + 0.25, vWPos.y + nA * 0.35) * uWear;
paintCol = mix(paintCol, vec3(0.15, 0.115, 0.08), mud * 0.85);
float dust = smoothstep(0.6, 1.0, vWNorm.y) * 0.25 * nA * uWear;
paintCol = mix(paintCol, vec3(0.42, 0.36, 0.27), dust);
float streak = vnoise(vec2(dot(vWPos.xz, vec2(1.0)) * 14.0, vWPos.y * 0.6));
paintCol *= 1.0 - smoothstep(0.55, 1.0, streak) * 0.22 * uWear * (1.0 - abs(vWNorm.y));
float chip = smoothstep(0.93, 0.97, vnoise(vWPos.xy * 22.0 + vWPos.z * 13.0)) * smoothstep(0.3, 0.9, vnoise(vWPos.zy * 2.0));
paintCol = mix(paintCol, vec3(0.07, 0.065, 0.06), chip * 0.6 * uWear);
if (uZimOn > 0.5 && abs(vWNorm.y) < 0.6) {
  float z = triTex(uZim, vWPos, vWNorm, 1.4).r;
  paintCol *= 0.88 + z * 0.24;
}
diffuseColor.rgb *= paintCol;
`;

/** Paint material for a vehicle (shared by all its painted pieces). */
const camoCache = new Map();
function camoTexture(paint) {
  const key = JSON.stringify([paint.base, paint.c1, paint.c2, paint.c3, paint.camo, paint.seed]);
  let entry = camoCache.get(key);
  if (!entry) {
    const tex = new THREE.CanvasTexture(camoCanvas(paint));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    entry = { tex, users: 0 };
    camoCache.set(key, entry);
  }
  entry.users++;
  return {
    tex: entry.tex,
    release() {
      if (--entry.users <= 0) {
        entry.tex.dispose();
        camoCache.delete(key);
      }
    },
  };
}

/** bump: 0 rolled plate, 1 cast steel, 2 zimmerit. */
export function paintMaterial(paint, { zimmerit = false, groundY = 0, metal = false, bump = 0 } = {}) {
  const camo = camoTexture(paint);
  const tex = camo.tex;
  const gloss = paint.gloss ?? 0.1;
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: metal ? 0.32 : 0.85 - gloss * 0.6,
    metalness: metal ? 0.75 : 0.08,
    clearcoat: gloss > 0.4 ? gloss : 0,
    clearcoatRoughness: 0.15,
  });
  const uniforms = {
    uCamo: { value: tex },
    uZim: { value: zimmeritTexture() },
    uZimOn: { value: zimmerit ? 1 : 0 },
    uWear: { value: paint.wear ?? 0.3 },
    uScale: { value: paint.scale ?? 1 },
    uRacing: { value: paint.camo === "racing" ? 1 : 0 },
    uStripe: { value: new THREE.Color(paint.c1).convertSRGBToLinear() },
    uGround: { value: groundY },
    uBump: { value: metal ? 0.004 : bump === 1 ? 0.03 : bump === 2 || zimmerit ? 0.022 : 0.012 },
    uBumpKind: { value: zimmerit ? 2 : bump },
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNorm;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n#ifdef USE_INSTANCING\nvWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\nvWNorm = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);\n#else\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNorm = normalize(mat3(modelMatrix) * objectNormal);\n#endif");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${PAINT_GLSL_HEAD}`)
      .replace("#include <map_fragment>", PAINT_GLSL_BODY)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n${BUMP_GLSL}`);
  };
  mat.customProgramCacheKey = () => "auradrop-paint";
  mat.userData.dispose = () => camo.release();
  return mat;
}

const std = (o) => new THREE.MeshStandardMaterial(o);

/** Everything a vehicle is made of. */
export function makeMaterials(paint, opts = {}) {
  const painted = paintMaterial(paint, opts);
  const plain = paintMaterial(paint, { ...opts, zimmerit: false });
  const cast = paintMaterial(paint, { ...opts, zimmerit: false, bump: 1 });
  const castZ = opts.zimmerit ? paintMaterial(paint, { ...opts, bump: 1 }) : cast;
  return {
    paint: painted,
    paintPlain: plain,
    paintCast: castZ,
    paintCastPlain: cast,
    steel: std({ color: 0x4a4744, roughness: 0.5, metalness: 0.75 }),
    bare: std({ color: 0x9aa0a8, roughness: 0.35, metalness: 0.9 }),
    chrome: std({ color: 0xe6e9ee, roughness: 0.08, metalness: 1 }),
    trackSteel: std({ color: 0x3a322b, roughness: 0.78, metalness: 0.55 }),
    rubber: std({ color: 0x181818, roughness: 0.93, metalness: 0 }),
    dark: std({ color: 0x1d1e20, roughness: 0.6, metalness: 0.35 }),
    black: std({ color: 0x0d0d0e, roughness: 0.5, metalness: 0.2 }),
    gunmetal: std({ color: 0x2b2d30, roughness: 0.4, metalness: 0.8 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x9fc4e0, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.35, transmission: 0.2, ior: 1.45, side: THREE.DoubleSide, depthWrite: false }),
    visor: new THREE.MeshPhysicalMaterial({ color: 0x40607a, roughness: 0.05, metalness: 0.2, clearcoat: 1 }),
    lamp: std({ color: 0xfff6dc, emissive: 0xffe9b0, emissiveIntensity: 0.6, roughness: 0.1 }),
    tail: std({ color: 0xff3030, emissive: 0xff1010, emissiveIntensity: 0.8, roughness: 0.2 }),
    wood: std({ color: 0x6d4c2e, roughness: 0.88 }),
    canvas: std({ color: 0x6b6a4a, roughness: 0.95 }),
    rust: std({ color: 0x5c3a22, roughness: 0.92, metalness: 0.3 }),
    exhaust: std({ color: 0x4a3225, roughness: 0.85, metalness: 0.45 }),
    cable: std({ color: 0x2a2a2a, roughness: 0.55, metalness: 0.65 }),
    brass: std({ color: 0xc9a24a, roughness: 0.3, metalness: 0.9 }),
    seam: std({ color: 0x5a503c, roughness: 0.95, metalness: 0.1 }),
    sand: std({ color: 0x8c7a56, roughness: 1 }),
    skin: std({ color: 0xd9a77e, roughness: 0.7 }),
    olive: std({ color: 0x4a4a2e, roughness: 0.9 }),
    leather: std({ color: 0x5a3a1f, roughness: 0.75 }),
    flame: new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    burner: new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }),
    smoke: new THREE.MeshStandardMaterial({ color: 0x777777, transparent: true, opacity: 0.35, depthWrite: false, roughness: 1 }),
    propDisc: new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }),
    color: (hex, o = {}) => std({ color: new THREE.Color(hex), roughness: 0.6, metalness: 0.1, ...o }),
  };
}

export function disposeMaterials(M) {
  for (const m of new Set(Object.values(M))) {
    if (m && m.isMaterial) {
      m.userData.dispose?.();
      m.dispose();
    }
  }
}
