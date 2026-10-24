// Geometry helpers for building vehicles out of shaped pieces.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export { mergeGeometries };
export const V2 = (x, y) => new THREE.Vector2(x, y);
export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/** Drop repeated / collinear points (they make ExtrudeGeometry produce NaNs). */
export function dedupe(pts, eps = 1e-4) {
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > eps) out.push(p);
  }
  while (out.length > 2 && Math.hypot(out[0][0] - out.at(-1)[0], out[0][1] - out.at(-1)[1]) <= eps) out.pop();
  // Remove collinear middles.
  for (let i = out.length - 1; i >= 0 && out.length > 3; i--) {
    const a = out[(i + out.length - 1) % out.length];
    const b = out[i];
    const c = out[(i + 1) % out.length];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cross) < 1e-7) out.splice(i, 1);
  }
  return out;
}

/** Extrude a side profile [[x, y]…] across z (centred). `bevel` rounds the edges. */
export function sideExtrude(profile, width, bevel = 0.015, curveSegments = 12) {
  const shape = new THREE.Shape(dedupe(profile).map(([x, y]) => V2(x, y)));
  const b = Math.min(bevel, width / 4);
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, width - b * 2), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 2, steps: 1, curveSegments });
  g.translate(0, 0, -width / 2 + b);
  return g;
}

/** Extrude a top-view outline [[x, z]…] upward by `height`. */
export function topExtrude(outline, height, bevel = 0.02, curveSegments = 24, steps = 1) {
  const shape = new THREE.Shape(dedupe(outline).map(([x, z]) => V2(x, -z)));
  const b = Math.min(bevel, height / 4);
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, height - b * 2), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 3, steps, curveSegments });
  g.rotateX(-Math.PI / 2);
  g.translate(0, b, 0);
  return g;
}

/** Move every vertex through fn(v: Vector3) and refresh normals. */
export function deform(geo, fn) {
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    fn(v);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export function box(w, h, d, x = 0, y = 0, z = 0) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}

/** Rounded box (bevelled on every edge). */
export function rbox(w, h, d, r = 0.02, x = 0, y = 0, z = 0) {
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const s = new THREE.Shape();
  const hw = w / 2 - r;
  const hh = h / 2 - r;
  s.moveTo(-hw, -h / 2);
  s.lineTo(hw, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -hh);
  s.lineTo(w / 2, hh);
  s.quadraticCurveTo(w / 2, h / 2, hw, h / 2);
  s.lineTo(-hw, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, hh);
  s.lineTo(-w / 2, -hh);
  s.quadraticCurveTo(-w / 2, -h / 2, -hw, -h / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - r * 2, bevelEnabled: true, bevelThickness: r, bevelSize: 0, bevelSegments: 3, curveSegments: 4 });
  g.translate(x, y, z - d / 2 + r);
  return g;
}

/** Cylinder along x (barrels), y (default) or z (wheels). */
export function cyl(r1, r2, len, axis = "y", seg = 24, open = false) {
  const g = new THREE.CylinderGeometry(r2, r1, len, seg, 1, open);
  if (axis === "x") g.rotateZ(-Math.PI / 2);
  if (axis === "z") g.rotateX(Math.PI / 2);
  return g;
}

/** Lathe a radius profile [[r, along]…] around the x axis (barrels, spinners, bombs). */
export function latheX(profile, seg = 32) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => V2(Math.max(0.0005, r), y)), seg);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/**
 * Loft: join cross-sections along x. sections: [{ x, w, h, y, n }] where each
 * section is a super-ellipse (n = 2 round, higher = boxier) of half-width w,
 * half-height h centred at height y. Smooth fuselages and car bodies.
 */
export function loft(sections, around = 32, cap = true) {
  const pos = [];
  const idx = [];
  const ring = (s) => {
    const n = s.n ?? 2.4;
    for (let i = 0; i < around; i++) {
      const a = (i / around) * Math.PI * 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const yy = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n) * (sn >= 0 ? s.h : s.hb ?? s.h);
      const zz = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * s.w;
      pos.push(s.x, s.y + yy, zz);
    }
  };
  sections.forEach(ring);
  for (let k = 0; k < sections.length - 1; k++) {
    for (let i = 0; i < around; i++) {
      const a = k * around + i;
      const b = k * around + ((i + 1) % around);
      const c = (k + 1) * around + i;
      const d = (k + 1) * around + ((i + 1) % around);
      idx.push(a, c, b, b, c, d);
    }
  }
  if (cap) {
    for (const [k, flip] of [[0, true], [sections.length - 1, false]]) {
      const s = sections[k];
      const center = pos.length / 3;
      pos.push(s.x, s.y, 0);
      for (let i = 0; i < around; i++) {
        const a = k * around + i;
        const b = k * around + ((i + 1) % around);
        flip ? idx.push(center, a, b) : idx.push(center, b, a);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Wing / fin loft: airfoil sections along a spanwise axis. stations:
 * [{ s (span pos), chord, x (leading edge), t (thickness ratio), dy }].
 * axis "z" for wings, "y" for fins.
 */
export function airfoilLoft(stations, axis = "z", res = 18) {
  const pos = [];
  const idx = [];
  const foil = (u, t) => 5 * t * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u ** 3 - 0.1036 * u ** 4);
  const ringPts = [];
  for (let i = 0; i <= res; i++) ringPts.push(1 - (1 - Math.cos((i / res) * Math.PI)) / 2); // TE→LE
  const count = ringPts.length * 2 - 2;
  for (const st of stations) {
    const upper = ringPts.map((u) => [u, foil(u, st.t ?? 0.12)]);
    const lower = ringPts.slice(1, -1).reverse().map((u) => [u, -foil(u, st.t ?? 0.12)]);
    for (const [u, v] of [...upper, ...lower]) {
      const x = st.x + (1 - u) * st.chord; // leading edge at the front (+x)
      const th = v * st.chord;
      if (axis === "z") pos.push(x - st.chord, (st.dy ?? 0) + th, st.s);
      else pos.push(x - st.chord, st.s, th);
    }
  }
  for (let k = 0; k < stations.length - 1; k++) {
    for (let i = 0; i < count; i++) {
      const a = k * count + i;
      const b = k * count + ((i + 1) % count);
      const c = (k + 1) * count + i;
      const d = (k + 1) * count + ((i + 1) % count);
      idx.push(a, b, c, b, d, c);
    }
  }
  // Tip caps.
  for (const [k, flip] of [[0, true], [stations.length - 1, false]]) {
    for (let i = 1; i < count - 1; i++) {
      const a = k * count;
      const b = k * count + i;
      const c = k * count + i + 1;
      flip ? idx.push(a, c, b) : idx.push(a, b, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A tube along a list of points (cables, pipes, rails). */
export function tube(points, r = 0.02, seg = 64, radial = 8, closed = false) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : V3(...p))), closed), seg, r, radial, closed);
}

/** Mesh with shadows and armour/interior tags. */
export function mesh(geo, mat, armor = null, opts = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = opts.shadow !== false;
  m.receiveShadow = true;
  m.userData.armor = armor;
  m.userData.interior = !!opts.interior;
  if (opts.decal) m.userData.decal = true;
  if (opts.glow) m.userData.glow = true;
  return m;
}

/** Bake many small geometries into one mesh (bolts, rivets, grille bars). */
export function merged(geos, mat, armor = null, opts) {
  const list = geos.filter(Boolean).map((g) => (g.index ? g.toNonIndexed() : g));
  // Mixed attribute sets can't merge; keep only position/normal/uv.
  list.forEach((g) => {
    for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
  });
  return mesh(mergeGeometries(list), mat, armor, opts);
}

/** Rows of bolt heads. */
export function bolts(points, r = 0.018, axis = "y") {
  return points.map(([x, y, z]) => {
    const b = new THREE.CylinderGeometry(r * 0.8, r, r * 1.2, 6);
    if (axis === "x") b.rotateZ(-Math.PI / 2);
    if (axis === "z") b.rotateX(Math.PI / 2);
    return b.translate(x, y, z);
  });
}

export const deg = (d) => (d * Math.PI) / 180;
