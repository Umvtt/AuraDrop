// Prototype: a detailed, procedurally built Tiger I in Three.js.
// Units are metres. +x is forward, +y is up, z is across the hull.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

/** Procedural camouflage canvas (dunkelgelb with olive and red-brown). */
function camoCanvas(size = 1024, seed = 7) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const g = cv.getContext("2d");
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = "#a38f5c";
  g.fillRect(0, 0, size, size);
  const blob = (color, n, rmin, rmax) => {
    for (let i = 0; i < n; i++) {
      const cx = rnd() * size;
      const cy = rnd() * size;
      const r = rmin + rnd() * (rmax - rmin);
      for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
        g.save();
        g.translate(cx + ox, cy + oy);
        g.rotate(rnd() * Math.PI);
        g.beginPath();
        const pts = 12;
        for (let k = 0; k <= pts; k++) {
          const a = (k / pts) * Math.PI * 2;
          const rr = r * (0.55 + rnd() * 0.6);
          const x = Math.cos(a) * rr * 1.9;
          const y = Math.sin(a) * rr;
          k ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.closePath();
        g.filter = "blur(6px)";
        g.fillStyle = color;
        g.fill();
        g.restore();
      }
    }
  };
  blob("#4b5631", 9, size * 0.05, size * 0.1);
  blob("#5e3a25", 7, size * 0.04, size * 0.08);
  // Fine paint noise.
  const img = g.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 8;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  return cv;
}

/** Zimmerit: the ridged anti-magnetic paste on German tanks, as a bump map. */
function zimmeritCanvas(size = 512) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const g = cv.getContext("2d");
  g.fillStyle = "#808080";
  g.fillRect(0, 0, size, size);
  const rows = 16;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 32; c++) {
      const x = (c / 32) * size;
      const y = (r / rows) * size + (c % 2 ? size / rows / 2 : 0);
      const grd = g.createLinearGradient(x, 0, x + size / 32, 0);
      grd.addColorStop(0, "#5a5a5a");
      grd.addColorStop(0.5, "#b0b0b0");
      grd.addColorStop(1, "#5a5a5a");
      g.fillStyle = grd;
      g.fillRect(x + 2, y, size / 32 - 4, size / rows - 3);
    }
  }
  return cv;
}

/**
 * Paint material with world-space (triplanar) camo, so the pattern flows
 * across every plate, plus mud on the lower parts and optional zimmerit.
 */
function paintMaterial({ camo, zimmerit = null, roughness = 0.78 }) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness, metalness: 0.12 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCamo = { value: camo };
    shader.uniforms.uZim = { value: zimmerit };
    shader.uniforms.uUseZim = { value: zimmerit ? 1 : 0 };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNorm;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNorm = normalize(mat3(modelMatrix) * objectNormal);");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vWPos;
varying vec3 vWNorm;
uniform sampler2D uCamo;
uniform sampler2D uZim;
uniform float uUseZim;
vec3 tri(sampler2D t, vec3 p, vec3 n, float k) {
  vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z);
  return texture2D(t, p.zy * k).rgb * w.x + texture2D(t, p.xz * k).rgb * w.y + texture2D(t, p.xy * k).rgb * w.z;
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }`,
      )
      .replace(
        "#include <map_fragment>",
        `vec3 camo = tri(uCamo, vWPos, vWNorm, 0.22);
camo = pow(camo, vec3(2.2));
// Mud and dust collect low down and on horizontal faces.
float n = noise(vWPos.xz * 3.0 + vWPos.y * 2.0) * 0.6 + noise(vWPos.xy * 9.0) * 0.4;
float mud = smoothstep(1.15, 0.35, vWPos.y + n * 0.35);
vec3 mudCol = vec3(0.16, 0.12, 0.08);
camo = mix(camo, mudCol, mud * 0.75);
float dust = smoothstep(0.6, 1.0, vWNorm.y) * 0.18 * n;
camo = mix(camo, vec3(0.45, 0.38, 0.28), dust);
// Paint chips on edges (approximate with noise).
float chip = smoothstep(0.93, 0.97, noise(vWPos.xy * 22.0 + vWPos.z * 13.0)) * smoothstep(0.3, 0.9, noise(vWPos.zy * 2.0));
camo = mix(camo, vec3(0.07, 0.065, 0.06), chip * 0.6);
// Streaks of grime running down vertical plates.
float streak = noise(vec2(dot(vWPos.xz, vec2(1.0)) * 14.0, vWPos.y * 0.6));
camo *= 1.0 - smoothstep(0.55, 1.0, streak) * 0.18 * (1.0 - abs(vWNorm.y));
if (uUseZim > 0.5 && abs(vWNorm.y) < 0.6) {
  float z = tri(uZim, vWPos, vWNorm, 1.4).r;
  camo *= 0.82 + z * 0.36;
}
diffuseColor.rgb *= camo;`,
      );
  };
  mat.customProgramCacheKey = () => `paint-${zimmerit ? 1 : 0}`;
  return mat;
}

function makeMaterials() {
  const camo = new THREE.CanvasTexture(camoCanvas());
  camo.wrapS = camo.wrapT = THREE.RepeatWrapping;
  camo.colorSpace = THREE.NoColorSpace;
  const zim = new THREE.CanvasTexture(zimmeritCanvas());
  zim.wrapS = zim.wrapT = THREE.RepeatWrapping;
  return {
    paint: paintMaterial({ camo, zimmerit: zim }),
    paintPlain: paintMaterial({ camo }),
    steel: new THREE.MeshStandardMaterial({ color: 0x4a4744, roughness: 0.55, metalness: 0.7 }),
    trackSteel: new THREE.MeshStandardMaterial({ color: 0x3b332c, roughness: 0.75, metalness: 0.55 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x1b1a19, roughness: 0.92, metalness: 0 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1e1f21, roughness: 0.6, metalness: 0.3 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x8fb8d8, roughness: 0.05, metalness: 0, transmission: 0.4, transparent: true, opacity: 0.85 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0x332a10, roughness: 0.1 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x6d4c2e, roughness: 0.85 }),
    rust: new THREE.MeshStandardMaterial({ color: 0x5c3a22, roughness: 0.9, metalness: 0.3 }),
    exhaust: new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: 0.8, metalness: 0.4 }),
    cable: new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.6 }),
  };
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Extrude a side profile [[x, y]…] across the hull (z from -w/2 to w/2). */
function sideExtrude(profile, width, bevel = 0.015) {
  const shape = new THREE.Shape(profile.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1 });
  g.translate(0, 0, -width / 2 + bevel);
  g.computeVertexNormals();
  return g;
}

/** Extrude a top-view outline [[x, z]…] upwards by `height`. */
function topExtrude(outline, height, bevel = 0.02) {
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: height - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, steps: 1, curveSegments: 24 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  g.computeVertexNormals();
  return g;
}

function box(w, h, d, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

/** Cylinder lying along x. */
function cylX(r1, r2, len, seg = 24) {
  const g = new THREE.CylinderGeometry(r2, r1, len, seg);
  g.rotateZ(-Math.PI / 2);
  return g;
}
/** Cylinder lying along z (wheels). */
function cylZ(r, len, seg = 32) {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateX(Math.PI / 2);
  return g;
}

function mesh(geo, mat, armor = null, opts = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.armor = armor; // { t: mm, slope: deg, name }
  m.userData.exterior = opts.interior ? false : true;
  m.userData.interior = !!opts.interior;
  return m;
}

// ---------------------------------------------------------------------------
// Running gear
// ---------------------------------------------------------------------------

/** Pressed-steel road wheel with a rubber tyre, dish, hub and bolts. */
function roadWheelGeometry(r = 0.4, width = 0.1) {
  const tyrePts = [];
  const prof = [
    [r * 0.82, -width / 2],
    [r * 0.97, -width / 2],
    [r, -width * 0.35],
    [r, width * 0.35],
    [r * 0.97, width / 2],
    [r * 0.82, width / 2],
  ];
  for (const [x, y] of prof) tyrePts.push(new THREE.Vector2(x, y));
  const tyre = new THREE.LatheGeometry(tyrePts, 40);
  tyre.rotateX(Math.PI / 2);
  const discPts = [
    [0.001, width * 0.62],
    [r * 0.16, width * 0.62],
    [r * 0.2, width * 0.45],
    [r * 0.55, width * 0.28],
    [r * 0.66, width * 0.36],
    [r * 0.8, width * 0.42],
    [r * 0.84, width * 0.3],
    [r * 0.84, -width * 0.3],
    [r * 0.2, -width * 0.4],
    [0.001, -width * 0.4],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const disc = new THREE.LatheGeometry(discPts, 40);
  disc.rotateX(Math.PI / 2);
  const bolts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const b = new THREE.CylinderGeometry(0.014, 0.014, 0.03, 6);
    b.rotateX(Math.PI / 2);
    b.translate(Math.cos(a) * r * 0.11, Math.sin(a) * r * 0.11, width * 0.65);
    bolts.push(b);
    const rb = new THREE.CylinderGeometry(0.01, 0.01, 0.02, 6);
    rb.rotateX(Math.PI / 2);
    rb.translate(Math.cos(a + 0.2) * r * 0.74, Math.sin(a + 0.2) * r * 0.74, width * 0.44);
    bolts.push(rb);
  }
  return { tyre, disc: mergeGeometries([disc, ...bolts]) };
}

function sprocketGeometry(r = 0.42, teeth = 18) {
  const parts = [];
  for (const z of [-0.12, 0.12]) {
    const ring = cylZ(r * 0.9, 0.05, 48);
    ring.translate(0, 0, z);
    parts.push(ring);
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const t = box(0.07, 0.11, 0.05);
      t.rotateZ(a);
      t.translate(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95, z);
      parts.push(t);
    }
  }
  const hub = cylZ(r * 0.35, 0.36, 24);
  parts.push(hub);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const b = cylZ(0.02, 0.06, 6);
    b.translate(Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25, 0.19);
    parts.push(b);
  }
  return mergeGeometries(parts);
}

/** One track link: plate with grousers and a guide horn. */
function trackLinkGeometry(pitch = 0.13, width = 0.725) {
  const parts = [box(pitch * 0.92, 0.035, width, 0, 0, 0)];
  // Grousers (ground-facing ridges).
  parts.push(box(0.025, 0.03, width * 0.95, -pitch * 0.25, -0.03, 0));
  parts.push(box(0.025, 0.03, width * 0.95, pitch * 0.25, -0.03, 0));
  // Guide horns (inside, between the wheel rows).
  parts.push(box(pitch * 0.5, 0.08, 0.03, 0, 0.055, -0.08));
  parts.push(box(pitch * 0.5, 0.08, 0.03, 0, 0.055, 0.08));
  // Pin ends.
  const pin = cylZ(0.015, width + 0.04, 8);
  pin.translate(pitch / 2, 0, 0);
  parts.push(pin);
  return mergeGeometries(parts);
}

/** Closed loop around sprocket, road wheels and idler; returns a sampler. */
function trackPath({ sprocket, idler, groundY, topY, frontX, rearX }) {
  // Build a smooth closed curve through key points (counter-clockwise when seen from +z).
  const pts = [];
  const arc = (c, r, a0, a1, n) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push(new THREE.Vector3(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, 0));
    }
  };
  // Bottom run from rear to front.
  pts.push(new THREE.Vector3(rearX, groundY, 0));
  pts.push(new THREE.Vector3(frontX, groundY, 0));
  // Up and around the sprocket (front).
  arc(sprocket, sprocket.r, -Math.PI * 0.45, Math.PI * 0.55, 10);
  // Top run back over the wheels (slight sag).
  pts.push(new THREE.Vector3((sprocket.x + idler.x) / 2 + 1, topY - 0.02, 0));
  pts.push(new THREE.Vector3((sprocket.x + idler.x) / 2 - 1, topY - 0.02, 0));
  // Around the idler (rear).
  arc(idler, idler.r, Math.PI * 0.5, Math.PI * 1.45, 10);
  const curve = new THREE.CatmullRomCurve3(pts, true, "centripetal", 0.2);
  return curve;
}

function buildRunningGear(M, side) {
  const g = new THREE.Group();
  const z = side * 1.42;
  const wheelR = 0.4;
  const wheelY = 0.45;
  const axles = [];
  for (let i = 0; i < 8; i++) axles.push(2.3 - i * 0.665);
  const { tyre, disc } = roadWheelGeometry(wheelR, 0.11);
  const wheels = [];
  // Interleaved: odd axles carry outer + inner wheels, even axles the middle one.
  axles.forEach((x, i) => {
    const offsets = i % 2 ? [0.29, -0.06] : [0.12, -0.24];
    for (const off of offsets) {
      const w = new THREE.Group();
      w.add(mesh(tyre, M.rubber));
      w.add(mesh(disc, M.paintPlain));
      w.position.set(x, wheelY, z + side * off);
      if (side < 0) w.rotation.y = Math.PI;
      g.add(w);
      wheels.push(w);
    }
  });
  // Drive sprocket (front) and idler (rear).
  const spr = mesh(sprocketGeometry(0.42), M.paintPlain);
  spr.position.set(2.98, 0.78, z);
  g.add(spr);
  wheels.push(spr);
  const idl = new THREE.Group();
  const { tyre: it, disc: id } = roadWheelGeometry(0.33, 0.1);
  for (const off of [-0.12, 0.12]) {
    const a = mesh(id, M.paintPlain);
    a.position.z = off;
    idl.add(a);
  }
  idl.position.set(-3.02, 0.72, z);
  g.add(idl);
  wheels.push(idl);

  // Tracks as instanced links along the path.
  const curve = trackPath({ sprocket: { x: 2.98, y: 0.78, r: 0.47 }, idler: { x: -3.02, y: 0.72, r: 0.4 }, groundY: 0.035, topY: wheelY + wheelR + 0.07, frontX: 2.55, rearX: -2.6 });
  const length = curve.getLength();
  const pitch = 0.13;
  const count = Math.floor(length / pitch);
  const link = trackLinkGeometry(pitch, 0.725);
  const inst = new THREE.InstancedMesh(link, M.trackSteel, count);
  inst.castShadow = true;
  inst.receiveShadow = true;
  inst.userData.exterior = true;
  inst.userData.armor = { t: 20, slope: 0, name: "Track" };
  const dummy = new THREE.Object3D();
  const place = (offset) => {
    for (let i = 0; i < count; i++) {
      const u = (((i * pitch + offset) % length) + length) % length / length;
      const p = curve.getPointAt(u);
      const t = curve.getTangentAt(u);
      dummy.position.set(p.x, p.y, z + side * 0.02);
      dummy.rotation.set(0, 0, Math.atan2(t.y, t.x));
      // Links face outward from the loop: flip the ones on top.
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  };
  place(0);
  g.add(inst);
  return { group: g, wheels, place, length, side };
}

// ---------------------------------------------------------------------------
// Hull
// ---------------------------------------------------------------------------

function buildHull(M) {
  const g = new THREE.Group();
  // Lower hull between the tracks.
  const lower = sideExtrude(
    [
      [-3.05, 0.5],
      [2.62, 0.5],
      [3.12, 0.96],
      [3.12, 1.06],
      [2.78, 1.27],
      [-3.0, 1.27],
      [-3.16, 1.0],
    ],
    1.82,
  );
  g.add(mesh(lower, M.paint, { t: 100, slope: 25, name: "Lower front plate" }));
  // Superstructure, wide enough to cover the tracks.
  const sup = sideExtrude(
    [
      [-3.12, 1.25],
      [2.72, 1.25],
      [2.72, 1.9],
      [-3.04, 1.9],
    ],
    3.42,
  );
  g.add(mesh(sup, M.paint, { t: 80, slope: 0, name: "Hull side" }));
  // Front driver's plate (100 mm) as its own thick slab for the armour view.
  const front = mesh(box(0.1, 0.66, 3.3, 2.71, 1.575, 0), M.paint, { t: 100, slope: 9, name: "Upper front plate" });
  front.rotation.z = 0;
  g.add(front);
  // Short near-horizontal glacis between the plates.
  const glacis = mesh(box(0.42, 0.06, 1.8), M.paint, { t: 60, slope: 80, name: "Glacis" });
  glacis.position.set(2.93, 1.17, 0);
  glacis.rotation.z = -0.55;
  g.add(glacis);
  // Rear plate.
  g.add(mesh(box(0.08, 0.95, 1.82, -3.12, 1.0, 0), M.paint, { t: 80, slope: 8, name: "Rear plate" }));

  // Driver's visor block and the hull MG ball mount.
  g.add(mesh(box(0.08, 0.13, 0.42, 2.79, 1.68, -0.62), M.paint, { t: 100, slope: 0, name: "Driver's visor" }));
  g.add(mesh(box(0.02, 0.025, 0.28, 2.835, 1.68, -0.62), M.dark));
  const ball = new THREE.SphereGeometry(0.14, 24, 16, 0, Math.PI);
  ball.rotateY(Math.PI / 2);
  ball.translate(2.76, 1.6, 0.68);
  g.add(mesh(ball, M.paintPlain));
  const mg = cylX(0.022, 0.018, 0.55, 12);
  mg.translate(3.0, 1.6, 0.68);
  g.add(mesh(mg, M.dark));
  const mgJacket = cylX(0.035, 0.035, 0.28, 12);
  mgJacket.translate(2.95, 1.6, 0.68);
  g.add(mesh(mgJacket, M.dark));

  // Headlights (Bosch) on the front plate corners.
  for (const z of [-1.45, 1.45]) {
    const housing = cylX(0.08, 0.06, 0.16, 20);
    housing.translate(2.82, 1.98, z);
    g.add(mesh(housing, M.dark));
    const lens = cylX(0.065, 0.065, 0.01, 20);
    lens.translate(2.905, 1.98, z);
    g.add(mesh(lens, M.lamp));
    g.add(mesh(box(0.04, 0.1, 0.03, 2.76, 1.92, z), M.dark));
  }

  // Front mudguards (over the sprockets) and fenders along the sides.
  for (const s of [-1, 1]) {
    const guard = mesh(box(0.6, 0.025, 0.76), M.paintPlain);
    guard.position.set(3.0, 1.18, s * 1.42);
    guard.rotation.z = -0.38;
    g.add(guard);
    g.add(mesh(box(0.4, 0.02, 0.74, -3.2, 1.25, s * 1.42), M.paintPlain));
  }

  // Hull roof hatches for the driver and radio operator, with periscopes.
  for (const z of [-0.85, 0.85]) {
    const hatch = new THREE.CylinderGeometry(0.28, 0.29, 0.05, 32);
    hatch.translate(2.1, 1.925, z);
    g.add(mesh(hatch, M.paintPlain));
    const hinge = cylX(0.03, 0.03, 0.3, 10);
    hinge.translate(2.1, 1.96, z + (z < 0 ? 0.27 : -0.27));
    g.add(mesh(hinge, M.dark));
    const peri = box(0.12, 0.08, 0.16, 2.5, 1.94, z * 0.75);
    g.add(mesh(peri, M.paintPlain));
    g.add(mesh(box(0.01, 0.04, 0.12, 2.565, 1.94, z * 0.75), M.glass));
  }

  // Engine deck: fan covers and grilles.
  for (const z of [-0.75, 0.75]) {
    const fan = new THREE.CylinderGeometry(0.34, 0.34, 0.06, 40);
    fan.translate(-2.15, 1.93, z);
    g.add(mesh(fan, M.paintPlain));
    for (let i = -3; i <= 3; i++) g.add(mesh(box(0.6, 0.025, 0.018, -2.15, 1.965, z + i * 0.08), M.dark));
    g.add(mesh(box(0.85, 0.05, 0.6, -1.25, 1.925, z), M.paintPlain));
    for (let i = -4; i <= 4; i++) g.add(mesh(box(0.8, 0.02, 0.02, -1.25, 1.955, z + i * 0.06), M.dark));
  }
  g.add(mesh(box(0.7, 0.05, 0.5, -0.4, 1.925, 0), M.paintPlain)); // engine access hatch

  // Exhausts with sheet-metal guards on the rear plate, and the air filters.
  for (const z of [-0.45, 0.45]) {
    const pipe = new THREE.CylinderGeometry(0.075, 0.075, 0.75, 16);
    pipe.translate(-3.25, 1.45, z);
    g.add(mesh(pipe, M.exhaust));
    const guard = new THREE.CylinderGeometry(0.13, 0.13, 0.55, 20, 1, true, -Math.PI / 2, Math.PI);
    guard.rotateY(Math.PI);
    guard.translate(-3.28, 1.4, z);
    g.add(mesh(guard, M.paintPlain));
  }
  for (const z of [-1.1, 1.1]) {
    const filter = new THREE.CylinderGeometry(0.16, 0.16, 0.5, 20);
    filter.translate(-3.28, 1.1, z);
    g.add(mesh(filter, M.paintPlain));
  }
  // Tow cables along the hull sides, with eyes at the ends.
  for (const s of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const x = -2.6 + (5 * i) / 30;
      pts.push(new THREE.Vector3(x, 1.72 + Math.sin(i * 0.9) * 0.012, s * 1.73));
    }
    const cable = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.022, 8);
    g.add(mesh(cable, M.cable));
    for (const x of [-2.6, 2.4]) {
      const clamp = box(0.05, 0.08, 0.05, x, 1.72, s * 1.72);
      g.add(mesh(clamp, M.dark));
    }
  }
  // Tools: shovel and axe on the side, spare track links on the glacis.
  for (const s of [-1, 1]) {
    const handle = cylX(0.018, 0.018, 0.9, 8);
    handle.translate(0.6, 1.52, s * 1.72);
    g.add(mesh(handle, M.wood));
    g.add(mesh(box(0.25, 0.2, 0.02, 1.15, 1.52, s * 1.72), M.steel));
  }
  // Interlocking plate ends at the front corners, weld seams and bolt rows.
  const seam = new THREE.MeshStandardMaterial({ color: 0x6b5d42, roughness: 0.95, metalness: 0.1 });
  for (const s of [-1, 1]) {
    g.add(mesh(box(0.07, 0.66, 0.1, 2.78, 1.575, s * 1.66), M.paint));
    g.add(mesh(box(0.06, 0.3, 0.1, 3.0, 1.0, s * 0.87), M.paint));
    const weldTop = cylX(0.012, 0.012, 5.7, 6);
    weldTop.translate(-0.17, 1.9, s * 1.7);
    g.add(mesh(weldTop, seam));
    const weldFront = new THREE.CylinderGeometry(0.012, 0.012, 0.64, 6);
    weldFront.translate(2.73, 1.575, s * 1.62);
    g.add(mesh(weldFront, seam));
  }
  const weldNose = new THREE.CylinderGeometry(0.012, 0.012, 3.3, 6);
  weldNose.rotateX(Math.PI / 2);
  weldNose.translate(2.74, 1.25, 0);
  g.add(mesh(weldNose, seam));
  const boltGeo = new THREE.CylinderGeometry(0.018, 0.02, 0.025, 6);
  const bolts = [];
  for (let i = 0; i < 9; i++) {
    for (const z of [-0.25, 0.25]) bolts.push(boltGeo.clone().translate(-0.75 + i * 0.09 + 0.02, 1.955, z));
  }
  for (let i = 0; i < 14; i++) for (const s of [-1, 1]) bolts.push(boltGeo.clone().translate(-2.6 + i * 0.4, 1.92, s * 1.62));
  g.add(mesh(mergeGeometries(bolts), M.paintPlain));
  // Tow shackles on the nose.
  for (const z of [-0.6, 0.6]) {
    const eye = new THREE.TorusGeometry(0.07, 0.022, 8, 16);
    eye.rotateY(Math.PI / 2);
    eye.translate(3.2, 0.95, z);
    g.add(mesh(eye, M.steel));
    g.add(mesh(box(0.12, 0.08, 0.06, 3.14, 0.98, z), M.paintPlain));
  }
  // Side skirt rails (Tiger had a thin side plate over the upper track run).
  for (const s of [-1, 1]) g.add(mesh(box(5.8, 0.03, 0.02, -0.1, 1.27, s * 1.72), M.paintPlain));

  return g;
}

// ---------------------------------------------------------------------------
// Turret
// ---------------------------------------------------------------------------

function buildTurret(M) {
  const g = new THREE.Group();
  // Horseshoe outline seen from above: flat front, round rear.
  const outline = [];
  const R = 1.08;
  outline.push([0.78, -0.98], [0.78, 0.98]);
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI / 2 + (i / 24) * Math.PI;
    outline.push([-0.25 + Math.cos(a) * R * 1.0, Math.sin(a) * 1.0 * (i === 0 || i === 24 ? 0.98 : 1)]);
  }
  const shell = topExtrude(outline, 0.86, 0.03);
  g.add(mesh(shell, M.paint, { t: 80, slope: 0, name: "Turret side" }));
  // Roof (25 mm) slightly inset.
  const roof = topExtrude(outline.map(([x, z]) => [x * 0.98, z * 0.97]), 0.03, 0.01);
  roof.translate(0, 0.86, 0);
  g.add(mesh(roof, M.paintPlain, { t: 25, slope: 85, name: "Turret roof" }));
  // Front plate (100 mm).
  g.add(mesh(box(0.11, 0.86, 2.1, 0.82, 0.43, 0), M.paint, { t: 100, slope: 0, name: "Turret front" }));

  // Gun mantlet (box shape with rounded edges, 120 mm) and the gun.
  const mant = new THREE.Group();
  const mantShape = new THREE.Shape();
  const mw = 0.42;
  const mh = 0.72;
  const rr = 0.09;
  mantShape.moveTo(-mw / 2 + rr, -mh / 2);
  mantShape.lineTo(mw / 2 - rr, -mh / 2);
  mantShape.quadraticCurveTo(mw / 2, -mh / 2, mw / 2, -mh / 2 + rr);
  mantShape.lineTo(mw / 2, mh / 2 - rr);
  mantShape.quadraticCurveTo(mw / 2, mh / 2, mw / 2 - rr, mh / 2);
  mantShape.lineTo(-mw / 2 + rr, mh / 2);
  mantShape.quadraticCurveTo(-mw / 2, mh / 2, -mw / 2, mh / 2 - rr);
  mantShape.lineTo(-mw / 2, -mh / 2 + rr);
  mantShape.quadraticCurveTo(-mw / 2, -mh / 2, -mw / 2 + rr, -mh / 2);
  const mantGeo = new THREE.ExtrudeGeometry(mantShape, { depth: 1.55, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 3 });
  mantGeo.translate(0, 0, -0.775);
  mant.add(mesh(mantGeo, M.paint, { t: 120, slope: 0, name: "Gun mantlet" }));
  // Binocular sight ports and the coaxial MG.
  for (const z of [0.42, 0.55]) {
    const port = cylX(0.035, 0.035, 0.06, 12);
    port.translate(0.23, 0.12, z);
    mant.add(mesh(port, M.dark));
  }
  const coax = cylX(0.03, 0.03, 0.08, 12);
  coax.translate(0.23, 0.05, -0.52);
  mant.add(mesh(coax, M.dark));

  // 8.8 cm KwK 36 L/56: lathe-turned barrel with a double-baffle muzzle brake.
  const gun = new THREE.Group();
  const barrelPts = [
    [0.001, 0],
    [0.135, 0],
    [0.135, 0.35],
    [0.11, 0.4],
    [0.105, 1.6],
    [0.095, 3.0],
    [0.088, 4.6],
    [0.088, 4.62],
    [0.04, 4.62],
    [0.04, 4.65],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const barrel = new THREE.LatheGeometry(barrelPts, 32);
  barrel.rotateZ(-Math.PI / 2);
  gun.add(mesh(barrel, M.paintPlain, { t: 30, slope: 0, name: "Gun barrel" }));
  // Muzzle brake: body plus two baffles, with side vents.
  const brake = new THREE.Group();
  brake.add(mesh(cylX(0.11, 0.11, 0.5, 24), M.paintPlain));
  for (const x of [-0.1, 0.12]) {
    const baffle = box(0.12, 0.3, 0.36, x, 0, 0);
    brake.add(mesh(baffle, M.paintPlain));
    brake.add(mesh(box(0.08, 0.2, 0.37, x, 0, 0), M.dark));
  }
  const muzzle = cylX(0.05, 0.05, 0.02, 16);
  muzzle.translate(0.26, 0, 0);
  brake.add(mesh(muzzle, M.dark));
  brake.position.x = 4.85;
  gun.add(brake);
  gun.position.set(0.18, 0, 0);
  mant.add(gun);
  mant.position.set(0.98, 0.46, 0.05);
  g.add(mant);

  // Commander's cupola with vision blocks and hatch.
  const cup = new THREE.Group();
  const cupBody = new THREE.CylinderGeometry(0.34, 0.36, 0.26, 40);
  cupBody.translate(0, 0.13, 0);
  cup.add(mesh(cupBody, M.paintPlain, { t: 80, slope: 0, name: "Cupola" }));
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i / 4) * Math.PI;
    const vb = box(0.04, 0.07, 0.16);
    vb.rotateY(-a);
    vb.translate(Math.cos(a) * 0.35, 0.16, Math.sin(a) * 0.35);
    cup.add(mesh(vb, M.glass));
  }
  const lid = new THREE.CylinderGeometry(0.3, 0.32, 0.05, 40);
  lid.translate(0, 0.29, 0);
  cup.add(mesh(lid, M.paintPlain));
  cup.position.set(-0.45, 0.86, 0.55);
  g.add(cup);

  // Loader's hatch, ventilator, pistol ports and the escape hatch.
  const lh = new THREE.CylinderGeometry(0.26, 0.26, 0.04, 30);
  lh.translate(-0.2, 0.9, -0.45);
  g.add(mesh(lh, M.paintPlain));
  const vent = new THREE.SphereGeometry(0.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  vent.translate(0.35, 0.88, -0.15);
  g.add(mesh(vent, M.paintPlain));
  for (const s of [-1, 1]) {
    const pp = cylZ(0.05, 0.05, 16);
    pp.translate(-0.55, 0.45, s * 1.02);
    g.add(mesh(pp, M.dark));
  }
  // Smoke dischargers: three angled tubes each side at the front.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const tube = new THREE.CylinderGeometry(0.045, 0.045, 0.24, 14);
      tube.rotateZ(-0.6);
      tube.rotateX(s * 0.35);
      tube.translate(0.55 - i * 0.12, 0.7, s * (1.0 + i * 0.03));
      g.add(mesh(tube, M.paintPlain));
    }
  }
  // Spare track links on the turret sides.
  const spare = trackLinkGeometry(0.13, 0.55);
  spare.rotateX(Math.PI / 2);
  spare.rotateZ(Math.PI / 2);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const l = mesh(spare.clone().rotateY(s < 0 ? Math.PI : 0), M.trackSteel);
      l.position.set(0.42 - i * 0.135, 0.45, s * 1.05);
      g.add(l);
    }
  }
  // Stowage bin (Rommelkiste) at the back.
  const bin = new THREE.Group();
  bin.add(mesh(box(0.42, 0.42, 1.25, 0, 0, 0), M.paintPlain));
  bin.add(mesh(box(0.44, 0.04, 1.27, 0, 0.21, 0), M.paintPlain));
  bin.position.set(-1.53, 0.42, 0);
  g.add(bin);
  // Turret number "131" as decals (canvas texture planes).
  for (const s of [-1, 1]) {
    const cv = document.createElement("canvas");
    cv.width = 256;
    cv.height = 128;
    const c = cv.getContext("2d");
    c.font = "bold 100px 'Bebas Neue', Impact, sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.lineWidth = 10;
    c.strokeStyle = "#f1f2f0";
    c.strokeText("131", 128, 66);
    c.fillStyle = "#a3111f";
    c.fillText("131", 128, 66);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.31), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -4 }));
    plane.position.set(-0.3, 0.5, s * 1.012);
    if (s < 0) plane.rotation.y = Math.PI;
    plane.userData.decal = true;
    g.add(plane);
  }
  // The turret sits on its ring, slightly forward of the hull centre.
  g.position.set(-0.1, 1.9, 0);
  return { group: g, mantlet: mant, gun };
}

// ---------------------------------------------------------------------------
// Interior (X-ray)
// ---------------------------------------------------------------------------

function crewMember(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: color, emissiveIntensity: 0.25 });
  const body = new THREE.CapsuleGeometry(0.17, 0.4, 6, 12);
  body.translate(0, 0.45, 0);
  g.add(mesh(body, mat, null, { interior: true }));
  const head = new THREE.SphereGeometry(0.13, 16, 12);
  head.translate(0, 0.9, 0);
  g.add(mesh(head, mat, null, { interior: true }));
  return g;
}

function buildInterior(turret) {
  const g = new THREE.Group();
  const add = (obj, x, y, z, parent = g) => {
    obj.position.set(x, y, z);
    parent.add(obj);
    return obj;
  };
  // Crew: driver and radio operator in the hull, three in the turret.
  add(crewMember(0x4ade80), 2.1, 0.6, -0.75);
  add(crewMember(0x60a5fa), 2.1, 0.6, 0.75);
  add(crewMember(0xfacc15), -0.6, -0.65, 0.5, turret.group);
  add(crewMember(0xf87171), 0.2, -0.75, 0.45, turret.group);
  add(crewMember(0xfb923c), 0.0, -0.75, -0.55, turret.group);
  // Ammunition racks in the sponsons: rows of 88 mm rounds.
  const shell = mergeGeometries([cylX(0.045, 0.045, 0.57, 10).translate(-0.06, 0, 0), cylX(0.044, 0.02, 0.25, 10).translate(0.35, 0, 0)]);
  const brass = new THREE.MeshStandardMaterial({ color: 0xd6a640, metalness: 0.8, roughness: 0.3, emissive: 0x3a2a08 });
  for (const s of [-1, 1]) {
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 2; j++) {
        const m = mesh(shell, brass, null, { interior: true });
        m.rotation.y = Math.PI / 2;
        add(m, 1.0 - i * 0.12, 1.4 + j * 0.13, s * 1.25);
      }
    }
  }
  // Engine (Maybach HL 230) and radiators at the back.
  const engMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.4, metalness: 0.5, emissive: 0x501020 });
  const engine = new THREE.Group();
  engine.add(mesh(box(1.25, 0.6, 0.8), engMat, null, { interior: true }));
  for (let i = 0; i < 6; i++) {
    for (const s of [-1, 1]) engine.add(mesh(box(0.14, 0.22, 0.22, -0.5 + i * 0.2, 0.38, s * 0.28), engMat, null, { interior: true }));
  }
  add(engine, -1.9, 1.05, 0);
  const radMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4, emissive: 0x0c3a52 });
  for (const s of [-1, 1]) add(mesh(box(0.9, 0.5, 0.25), radMat, null, { interior: true }), -1.9, 1.35, s * 1.05);
  // Fuel tanks either side of the engine.
  const fuelMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5, transparent: true, opacity: 0.75, emissive: 0x4a3a05 });
  for (const s of [-1, 1]) add(mesh(box(0.8, 0.55, 0.3), fuelMat, null, { interior: true }), -2.55, 0.9, s * 0.6);
  // Transmission at the front.
  const trMat = new THREE.MeshStandardMaterial({ color: 0xa78bfa, roughness: 0.4, metalness: 0.5, emissive: 0x2a1a50 });
  add(mesh(box(0.6, 0.5, 1.2), trMat, null, { interior: true }), 2.55, 0.8, 0);
  // Gun breech inside the turret.
  const breech = mesh(box(0.9, 0.3, 0.32), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.3 }), null, { interior: true });
  add(breech, 0.4, 0.46, 0.05, turret.group);
  g.visible = false;
  turret.group.children.forEach((c) => {
    if (c.userData.interior) c.visible = false;
  });
  return g;
}

// ---------------------------------------------------------------------------
// Assembly, views and animation
// ---------------------------------------------------------------------------

const ARMOR_STOPS = [
  [0, 0x38bdf8],
  [15, 0x2dd4bf],
  [30, 0x22c55e],
  [50, 0xa3e635],
  [80, 0xfacc15],
  [120, 0xf97316],
  [180, 0xef4444],
  [260, 0xdb2777],
  [400, 0x9333ea],
];
export function armorColor(mm) {
  const c = new THREE.Color();
  for (let i = 1; i < ARMOR_STOPS.length; i++) {
    if (mm <= ARMOR_STOPS[i][0]) {
      const [a, ca] = ARMOR_STOPS[i - 1];
      const [b, cb] = ARMOR_STOPS[i];
      return c.set(ca).lerp(new THREE.Color(cb), (mm - a) / (b - a));
    }
  }
  return c.set(ARMOR_STOPS.at(-1)[1]);
}

export function buildTiger() {
  const M = makeMaterials();
  const root = new THREE.Group();
  root.name = "Tiger I";
  const hull = buildHull(M);
  root.add(hull);
  const gear = [buildRunningGear(M, 1), buildRunningGear(M, -1)];
  gear.forEach((r) => root.add(r.group));
  const turret = buildTurret(M);
  root.add(turret.group);
  const interior = buildInterior(turret);
  root.add(interior);

  // Remember original materials for switching views.
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh) {
      o.userData.mat = o.material;
      meshes.push(o);
    }
  });
  const xrayMat = new THREE.MeshStandardMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.07, depthWrite: false, roughness: 1, side: THREE.DoubleSide });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.35 });
  const edges = [];

  let view = "normal";
  function setView(next) {
    view = next;
    edges.forEach((e) => e.parent.remove(e));
    edges.length = 0;
    for (const m of meshes) {
      const interiorPart = m.userData.interior;
      if (interiorPart) {
        m.visible = next === "xray";
        continue;
      }
      if (m.userData.decal) {
        m.visible = next === "normal";
        continue;
      }
      if (next === "normal") {
        m.material = m.userData.mat;
        m.castShadow = true;
      } else if (next === "armor") {
        const a = m.userData.armor;
        m.material = a ? new THREE.MeshStandardMaterial({ color: armorColor(a.t / Math.max(0.15, Math.cos((a.slope * Math.PI) / 180))), roughness: 0.6 }) : new THREE.MeshStandardMaterial({ color: 0x3a3f4b, roughness: 0.9, transparent: true, opacity: 0.5 });
      } else {
        m.material = xrayMat;
        m.castShadow = false;
        if (!m.isInstancedMesh && m.geometry.attributes.position.count < 4000) {
          const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), edgeMat);
          m.add(e);
          edges.push(e);
        }
      }
    }
    interior.visible = next === "xray";
  }

  // Animation: tracks roll, wheels turn, the turret scans and the gun fires now and then.
  let trackOffset = 0;
  function update(dt, t, { drive = 0.8, animateTurret = true } = {}) {
    trackOffset += dt * drive;
    gear.forEach((r) => {
      r.place(-trackOffset);
      r.wheels.forEach((w) => (w.rotation.z -= (dt * drive) / 0.4));
    });
    if (animateTurret) {
      turret.group.rotation.y = Math.sin(t * 0.25) * 0.5;
      turret.mantlet.rotation.z = Math.sin(t * 0.4) * 0.05;
      const k = (t % 6) / 6;
      turret.gun.position.x = 0.18 - (k < 0.03 ? k / 0.03 : Math.max(0, 1 - (k - 0.03) / 0.3)) * 0.35;
    }
  }

  return { root, setView, update, get view() { return view; } };
}
