// Small detailed components shared by the vehicle builders: weld beads,
// hatches, periscopes, grab handles, louvres, lights, fuel drums…
// Each returns an Object3D positioned in the caller's space.
import * as THREE from "three";
import { box, cyl, latheX, merged, mesh, rbox, tube, V3 } from "./geo.js";

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _up = V3(0, 1, 0);

/**
 * Weld beads along polylines: rows of squashed blobs, the way a real weld
 * looks. lines: [[Vector3, Vector3, …], …]. One instanced mesh for all.
 */
export function weldBeads(lines, mat, r = 0.014, step = 0.022) {
  const pts = [];
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i];
      const b = line[i + 1];
      const len = a.distanceTo(b);
      const n = Math.max(1, Math.floor(len / step));
      const dir = b.clone().sub(a).normalize();
      for (let k = 0; k <= n; k++) pts.push({ p: a.clone().lerp(b, k / n), dir });
    }
  }
  if (!pts.length) return new THREE.Group();
  const geo = new THREE.SphereGeometry(r, 7, 5);
  const inst = new THREE.InstancedMesh(geo, mat, pts.length);
  pts.forEach(({ p, dir }, i) => {
    _q.setFromUnitVectors(_up, dir);
    _s.set(1.15 + ((i * 7) % 5) * 0.04, 0.7, 0.75);
    _m.compose(p, _q, _s);
    inst.setMatrixAt(i, _m);
  });
  inst.castShadow = false;
  inst.receiveShadow = true;
  return inst;
}

/** Round crew hatch: ring, domed lid, hinges, handle, lock and an optional periscope. */
export function hatch(M, { r = 0.28, periscope = false, open = false, mat } = {}) {
  const g = new THREE.Group();
  const paint = mat ?? M.paintPlain;
  g.add(mesh(cyl(r * 1.08, r * 1.12, 0.05, "y", 36).translate(0, 0.025, 0), paint));
  const lid = new THREE.Group();
  lid.add(mesh(latheX([[r, 0], [r, 0.03], [r * 0.85, 0.05], [r * 0.4, 0.065], [0.001, 0.07]], 36).rotateZ(Math.PI / 2).translate(0, 0.05, 0), paint));
  // Hinge on the -z side, handle and lock on top.
  lid.add(mesh(cyl(0.022, 0.022, r * 1.1, "x", 10).translate(0, 0.07, -r * 0.98), M.dark));
  for (const x of [-r * 0.35, r * 0.35]) lid.add(mesh(box(0.06, 0.03, r * 0.35, x, 0.075, -r * 0.82), paint));
  lid.add(mesh(tube([[-0.07, 0.08, r * 0.45], [-0.07, 0.13, r * 0.45], [0.07, 0.13, r * 0.45], [0.07, 0.08, r * 0.45]], 0.011, 16, 6), M.steel));
  lid.add(mesh(cyl(0.03, 0.03, 0.03, "y", 10).translate(0, 0.09, 0), M.dark));
  lid.add(mesh(box(0.12, 0.015, 0.025, 0.05, 0.11, 0), M.steel));
  if (periscope) {
    lid.add(mesh(rbox(0.14, 0.08, 0.17, 0.01, 0, 0.12, r * 0.15), paint));
    lid.add(mesh(box(0.015, 0.035, 0.12, 0.072, 0.125, r * 0.15), M.visor));
  }
  if (open) {
    lid.position.set(0, 0.07, -r * 0.98);
    lid.rotation.x = -1.7;
    lid.children.forEach((c) => c.geometry.translate(0, -0.07, r * 0.98));
  }
  g.add(lid);
  return g;
}

/** Periscope head in an armoured guard. */
export function periscope(M, { guard = true, mat } = {}) {
  const g = new THREE.Group();
  const paint = mat ?? M.paintPlain;
  g.add(mesh(rbox(0.16, 0.1, 0.2, 0.012, 0, 0.05, 0), paint));
  g.add(mesh(box(0.018, 0.045, 0.15, 0.08, 0.06, 0), M.visor));
  if (guard) g.add(mesh(tube([[-0.06, 0, -0.14], [-0.04, 0.14, -0.14], [0.12, 0.14, -0.14], [0.14, 0, -0.14]], 0.01, 16, 5).translate(0, 0, 0), paint), mesh(tube([[-0.06, 0, 0.14], [-0.04, 0.14, 0.14], [0.12, 0.14, 0.14], [0.14, 0, 0.14]], 0.01, 16, 5), paint));
  return g;
}

/** Bent grab handle between two points, standing `h` off the surface along `out`. */
export function grabHandle(a, b, out, M, h = 0.07, r = 0.011) {
  const o = out.clone().normalize().multiplyScalar(h);
  const geo = tube([a, a.clone().add(o), b.clone().add(o), b], r, 24, 6);
  return mesh(geo, M.steel);
}

/** Angled louvres (engine deck air intakes). */
export function louvres(M, w, d, slats, mat) {
  const g = new THREE.Group();
  g.add(mesh(rbox(w, 0.04, d, 0.008, 0, 0.02, 0), mat ?? M.paintPlain));
  const geos = [];
  for (let i = 0; i < slats; i++) {
    const s = box(w * 0.94, 0.012, (d / slats) * 0.9).rotateX(0.55).translate(0, 0.045, -d / 2 + (d * (i + 0.5)) / slats);
    geos.push(s);
  }
  g.add(merged(geos, mat ?? M.paintPlain));
  g.add(mesh(box(w * 0.92, 0.01, d * 0.94, 0, 0.03, 0), M.black));
  return g;
}

/** Wire-mesh screen on a frame (engine deck covers). */
export function meshScreen(M, w, d) {
  const g = new THREE.Group();
  const frame = [box(w, 0.03, 0.03, 0, 0.015, -d / 2), box(w, 0.03, 0.03, 0, 0.015, d / 2), box(0.03, 0.03, d, -w / 2, 0.015, 0), box(0.03, 0.03, d, w / 2, 0.015, 0)];
  g.add(merged(frame, M.dark));
  const wires = [];
  for (let i = 1; i < Math.round(w / 0.05); i++) wires.push(box(0.006, 0.006, d, -w / 2 + i * 0.05, 0.03, 0));
  for (let i = 1; i < Math.round(d / 0.05); i++) wires.push(box(w, 0.006, 0.006, 0, 0.034, -d / 2 + i * 0.05));
  g.add(merged(wires, M.dark));
  g.add(mesh(box(w * 0.95, 0.005, d * 0.95, 0, 0.005, 0), M.black));
  return g;
}

/** Headlight with a brush guard. */
export function headlight(M, { guard = true, r = 0.08 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(latheX([[0.001, -r], [r * 0.75, -r * 0.8], [r, r * 0.4], [r, r * 0.7]], 24), M.dark));
  g.add(mesh(cyl(r * 0.88, r * 0.88, 0.008, "x", 24).translate(r * 0.7, 0, 0), M.lamp, null, { glow: true }));
  g.add(mesh(cyl(r * 0.95, r * 0.95, 0.012, "x", 24).translate(r * 0.72, 0, 0), M.chrome));
  g.add(mesh(box(0.035, r * 1.3, 0.03, -r * 0.4, -r * 1.1, 0), M.dark));
  if (guard) g.add(mesh(tube([[r * 0.2, -r * 1.2, -r * 1.2], [r * 1.4, -r * 0.6, -r * 1.1], [r * 1.5, r * 0.4, 0], [r * 1.4, -r * 0.6, r * 1.1], [r * 0.2, -r * 1.2, r * 1.2]], 0.008, 30, 5), M.steel));
  return g;
}

/** Small tail / convoy light box. */
export function tailLight(M) {
  const g = new THREE.Group();
  g.add(mesh(rbox(0.06, 0.1, 0.14, 0.01), M.dark));
  g.add(mesh(box(0.008, 0.035, 0.05, -0.032, 0.02, -0.03), M.tail, null, { glow: true }));
  g.add(mesh(box(0.008, 0.035, 0.05, -0.032, 0.02, 0.03), M.tail, null, { glow: true }));
  return g;
}

/** External fuel drum with straps (T-34, IS). Lies along x. */
export function fuelDrum(M, len = 0.8, r = 0.19, mat) {
  const g = new THREE.Group();
  const paint = mat ?? M.paintPlain;
  g.add(mesh(latheX([[0.001, 0], [r * 0.95, 0], [r, 0.02], [r, len - 0.02], [r * 0.95, len], [0.001, len]], 28).translate(-len / 2, 0, 0), paint));
  for (const f of [0.25, 0.75]) g.add(mesh(new THREE.TorusGeometry(r + 0.006, 0.012, 6, 28).rotateY(Math.PI / 2).translate(-len / 2 + len * f, 0, 0), M.dark));
  for (const f of [0.15, 0.85]) g.add(mesh(new THREE.TorusGeometry(r, 0.009, 6, 28).rotateY(Math.PI / 2).translate(-len / 2 + len * f, 0, 0), paint));
  g.add(mesh(cyl(0.03, 0.03, 0.03, "x", 10).translate(len / 2 + 0.01, r * 0.5, 0), M.dark));
  return g;
}

/** Lifting hook: an arched U welded on. */
export function liftingHook(M, mat, r = 0.05) {
  return mesh(new THREE.TorusGeometry(r, r * 0.3, 6, 14, Math.PI).translate(0, 0, 0), mat ?? M.steel);
}

/** Pistol port plug with chain ring. */
export function pistolPort(M, mat) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.06, 0.07, 0.03, "z", 18), mat ?? M.paintPlain));
  g.add(mesh(cyl(0.035, 0.035, 0.04, "z", 14).translate(0, 0, 0.01), M.dark));
  g.add(mesh(new THREE.TorusGeometry(0.015, 0.005, 6, 10).translate(0, -0.06, 0.02), M.steel));
  return g;
}

/** Vision slit block with an armoured visor flap. Faces +x. */
export function visionSlit(M, w = 0.3, mat) {
  const g = new THREE.Group();
  g.add(mesh(rbox(0.07, 0.12, w, 0.012, 0, 0, 0), mat ?? M.paintPlain));
  g.add(mesh(box(0.02, 0.02, w * 0.75, 0.035, 0.0, 0), M.black));
  g.add(mesh(box(0.05, 0.015, w * 0.9, 0.03, 0.07, 0), mat ?? M.paintPlain));
  return g;
}

/** Spare road wheel (stowed). */
export function spareWheel(M, r = 0.4, w = 0.1, mat) {
  const g = new THREE.Group();
  g.add(mesh(cyl(r, r, w, "z", 32), M.rubber));
  g.add(mesh(cyl(r * 0.84, r * 0.84, w * 1.05, "z", 32), mat ?? M.paintPlain));
  g.add(mesh(cyl(r * 0.2, r * 0.2, w * 1.3, "z", 16), M.dark));
  return g;
}

/** Bolt / rivet heads in a grid on a face. */
export function boltRow(M, from, to, n, mat, r = 0.016, normal = V3(0, 1, 0)) {
  const geos = [];
  for (let i = 0; i < n; i++) {
    const p = from.clone().lerp(to, n === 1 ? 0.5 : i / (n - 1));
    const b = new THREE.CylinderGeometry(r * 0.75, r, r * 1.1, 6);
    b.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), normal.clone().normalize()));
    geos.push(b.translate(p.x, p.y, p.z));
  }
  return merged(geos, mat ?? M.paintPlain);
}
