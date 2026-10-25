// Build any vehicle from its spec and drive it: views (normal / armour /
// X-ray), animation, armour lookups under the cursor, and cleanup.
import * as THREE from "three";
import { armorColor, effectiveArmor } from "./decals.js";
import { makeMaterials, disposeMaterials } from "./materials.js";
import { attachAddons } from "./addons.js";
import { buildCar } from "./car.js";
import { buildPlane } from "./plane.js";
import { buildTank } from "./tank.js";
import { applyTweaks, collectUnits } from "./tweaks.js";

const builders = { tank: buildTank, plane: buildPlane, car: buildCar };

export function registerBuilder(kind, fn) {
  builders[kind] = fn;
}

/** Armour info for a mesh face: { name, t } or null. */
function armorAt(mesh, normalLocal, pointLocal) {
  const a = mesh.userData.armor;
  if (!a) return null;
  return typeof a === "function" ? a(normalLocal, pointLocal) : a;
}

/** Bake per-face armour colours into a vertex colour attribute. */
function armorColors(m) {
  const geo = m.geometry;
  if (m.isInstancedMesh) return null;
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.computeVertexNormals();
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const color = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    mid.copy(a).add(b).add(c).divideScalar(3);
    const info = armorAt(m, n, mid);
    armorColor(info ? info.t : 0, color);
    for (let k = 0; k < 3; k++) col.set([color.r, color.g, color.b], (i + k) * 3);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/**
 * Build a vehicle. Returns { root, setView(view), update(dt, t, cameraPos),
 * armorInfo(intersection, rayDir), dispose(), size, center }.
 */
export function buildVehicle(v) {
  const isMetal = v.spec.paint.camo === "none" && /^#(c|d|b)/i.test(v.spec.paint.base) && v.kind === "plane";
  const M = makeMaterials(v.spec.paint, { zimmerit: !!v.spec.hull?.zimmerit, metal: isMetal });
  const build = builders[v.kind] ?? buildTank;
  const out = build(v, M);
  out.units = collectUnits(out, M);
  applyTweaks(v, out.units);
  attachAddons(v, out, M);
  const root = out.root;
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh) {
      o.userData.normalMat = o.material;
      o.userData.normalGeo = o.geometry;
      meshes.push(o);
    }
  });
  const xrayMat = new THREE.MeshStandardMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.06, depthWrite: false, roughness: 1, side: THREE.DoubleSide });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.45 });
  const gearMat = new THREE.MeshStandardMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.035, depthWrite: false, roughness: 1 });
  const armorMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });
  const armorInst = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.9 });
  const ghostMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4b, roughness: 0.9, transparent: true, opacity: 0.35, depthWrite: false });
  const extras = [];
  let view = "normal";

  function clearExtras() {
    for (const e of extras) {
      e.parent?.remove(e);
      e.geometry?.dispose();
    }
    extras.length = 0;
  }

  function setView(next) {
    view = next;
    clearExtras();
    for (const m of meshes) {
      // A part the user hid stays hidden in every view.
      if (m.userData.tweak?.hidden) {
        m.visible = false;
        continue;
      }
      const interior = m.userData.interior;
      m.geometry = m.userData.normalGeo;
      if (interior) {
        m.visible = next === "xray";
        m.material = m.userData.normalMat;
        continue;
      }
      if (m.userData.decal) {
        m.visible = next === "normal";
        continue;
      }
      if (m.userData.fx) {
        m.visible = next === "normal";
        continue;
      }
      m.visible = true;
      if (next === "normal") {
        m.material = m.userData.normalMat;
        m.castShadow = true;
      } else if (next === "armor") {
        m.castShadow = true;
        if (m.isInstancedMesh) m.material = armorInst;
        else if (m.userData.armor) {
          m.userData.armorGeo ??= armorColors(m);
          m.geometry = m.userData.armorGeo;
          m.material = armorMat;
        } else m.material = ghostMat;
      } else {
        m.castShadow = false;
        // X-ray: armour as glass with outlines, running gear as a faint ghost, small fittings hidden.
        let gear = false;
        for (let o = m; o; o = o.parent) if (/^gear-/.test(o.name) || o.name === "skirts") gear = true;
        if (!m.userData.armor || (m.isInstancedMesh && !gear)) {
          m.material = gearMat;
          m.visible = gear;
          continue;
        }
        m.material = gear ? gearMat : xrayMat;
        if (gear) continue;
        if (!m.isInstancedMesh && m.userData.armor && m.geometry.attributes.position.count < 20000) {
          const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 28), edgeMat);
          e.userData.fxEdge = true;
          m.add(e);
          extras.push(e);
        }
      }
    }
    if (out.interior) out.interior.visible = next === "xray";
  }

  /** What armour a ray hit, and how thick it is along that ray. */
  function armorInfo(hit, rayDir) {
    let o = hit.object;
    while (o && !o.userData.armor && o.parent) o = o.parent;
    if (!o?.userData.armor || !hit.face) return null;
    const inv = new THREE.Matrix4().copy(o.matrixWorld).invert();
    const pLocal = hit.point.clone().applyMatrix4(inv);
    const nLocal = hit.face.normal.clone();
    const info = armorAt(o, nLocal, pLocal);
    if (!info) return null;
    const nWorld = hit.face.normal.clone().transformDirection(o.matrixWorld);
    const angle = (Math.acos(Math.min(1, Math.abs(nWorld.dot(rayDir.clone().normalize())))) * 180) / Math.PI;
    return { ...info, angle, effective: effectiveArmor(info.t, angle) };
  }

  const anim = () => v.spec.anim ?? {};
  return {
    root,
    out,
    get view() {
      return view;
    },
    setView,
    size: out.size,
    center: out.center,
    update(dt, t, cameraPos) {
      out.update?.(dt, t, anim(), cameraPos);
    },
    armorInfo,
    dispose() {
      clearExtras();
      root.traverse((o) => {
        if (o.isMesh) {
          o.userData.normalGeo?.dispose();
          o.userData.armorGeo?.dispose();
          if (o.userData.decal) {
            o.material.map?.dispose();
            o.material.dispose();
          }
        }
      });
      disposeMaterials(M);
      for (const m of [xrayMat, edgeMat, armorMat, armorInst, ghostMat, gearMat]) m.dispose();
    },
  };
}
