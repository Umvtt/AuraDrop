// Moving the vehicle's own parts: every sub-assembly (turret, gun, wheels,
// skirts…) and every detail on the hull and turret becomes a "unit" with a
// stable key, so offsets saved in v.tweaks find the same part after a rebuild.
import * as THREE from "three";

const NAMED = {
  hull: "Hull",
  turret: "Turret",
  "gun-pivot": "Gun and mantlet",
  barrel: "Barrel",
  skirts: "Side skirts",
  "gear-left": "Running gear (left)",
  "gear-right": "Running gear (right)",
  wheel: "Road wheel",
  roller: "Return roller",
  sprocket: "Drive sprocket",
  idler: "Idler wheel",
  track: "Track",
  cupola: "Cupola",
  body: "Body",
};

function materialLabel(o, M, parent) {
  // Armour pieces: ask the plate's own armour function, facing out from the middle.
  let armored = null;
  o.traverse((x) => (armored ??= typeof x.userData.armor === "function" && !x.isInstancedMesh ? x : null));
  if (armored) {
    const box = new THREE.Box3().setFromObject(armored, true);
    if (!box.isEmpty()) {
      const c = armored.worldToLocal(box.getCenter(new THREE.Vector3()));
      const mid = armored.worldToLocal(new THREE.Box3().setFromObject(parent, true).getCenter(new THREE.Vector3()));
      const n = c.clone().sub(mid);
      if (n.lengthSq() > 1e-6) {
        const name = armored.userData.armor(n.normalize(), c)?.name;
        if (name) return name;
      }
    }
  }
  let m = null;
  o.traverse((x) => (m ??= x.isMesh ? (Array.isArray(x.material) ? x.material[0] : x.material) : null));
  if (!m) return "Part";
  const names = { steel: "Steel fitting", rubber: "Rubber", lamp: "Light", glass: "Glass", wood: "Wooden part", canvas: "Canvas", trackSteel: "Track links", dark: "Fitting", exhaust: "Exhaust", gunmetal: "Gun part", chrome: "Chrome part", brass: "Brass part", leather: "Leather", sand: "Sandbag", olive: "Kit" };
  for (const [k, label] of Object.entries(names)) if (M[k] === m) return label;
  return "Armour / bodywork";
}

const r2 = (v) => Math.round(v * 50) / 50;

/** Find the movable units of a built vehicle. Returns Map key → object (with userData.unit). */
export function collectUnits(out, M) {
  const units = new Map();
  const root = out.root;
  root.updateMatrixWorld(true);
  const add = (obj, key, label) => {
    let k = key;
    for (let n = 2; units.has(k); n++) k = `${key}#${n}`;
    obj.userData.unit = { key: k, label, base: { pos: obj.position.clone(), rot: obj.rotation.clone(), scale: obj.scale.clone() } };
    units.set(k, obj);
  };
  const empty = (o) => {
    let has = false;
    o.traverse((x) => (has ||= !!(x.isMesh || x.isPoints)));
    return !has;
  };
  const skip = (o) => empty(o) || o.userData.addonId || o.userData.decal || o.userData.fx || o.userData.interior || o.name === "interior" || o.isLight || o.userData.fxEdge;
  const signature = (child, parent) => {
    const box = new THREE.Box3().setFromObject(child, true);
    if (box.isEmpty()) return "e";
    const c = parent.worldToLocal(box.getCenter(new THREE.Vector3()));
    const s = box.getSize(new THREE.Vector3());
    return [c.x, c.y, c.z, s.x, s.y, s.z].map(r2).join(",");
  };
  // Every direct child of these groups is a unit (named ones get friendly names).
  const containers = [out.hull, out.turret, out.gunPivot, out.barrel, out.body && out.body !== out.hull ? out.body : null].filter((g) => g?.isGroup);
  const named = (o) => NAMED[o.name] ?? NAMED[o.userData.part2];
  for (const parent of new Set(containers)) {
    const pk = parent.name || "body";
    for (const child of parent.children) {
      if (skip(child) || child.userData.unit) continue;
      if (containers.includes(child)) {
        add(child, child.name, NAMED[child.name] ?? "Part");
        continue;
      }
      const label = named(child) ?? materialLabel(child, M, parent);
      add(child, child.name && NAMED[child.name] ? `${pk}/${child.name}` : `${pk}/${signature(child, parent)}`, label);
    }
  }
  // Running gear sides, their wheels, sprockets and tracks; car wheels.
  for (const g of root.children.concat(out.body?.children ?? [])) {
    if (!/^gear-/.test(g.name) || g.userData.unit) continue;
    add(g, g.name, NAMED[g.name]);
    for (const child of g.children) {
      const kind = child.userData.part2 ?? (child.isInstancedMesh ? "track" : null);
      if (kind) add(child, `${g.name}/${kind}`, NAMED[kind]);
    }
  }
  for (const w of out.carWheels ?? []) add(w, `wheel-${w.userData.wheelKey}`, "Wheel");
  for (const k of ["turret", "gun-pivot", "barrel", "hull", "skirts"]) {
    const o = k === "turret" ? out.turret : k === "gun-pivot" ? out.gunPivot : k === "barrel" ? out.barrel : k === "hull" ? out.hull : out.skirts;
    if (o && !o.userData.unit && o.isObject3D) add(o, k, NAMED[k]);
  }
  return units;
}

const deg = (d) => (d * Math.PI) / 180;

/** Put one unit where its tweak says (relative to where the build put it). */
export function applyTweak(obj, t) {
  const b = obj.userData.unit?.base;
  if (!b) return;
  obj.position.copy(b.pos);
  obj.rotation.copy(b.rot);
  obj.scale.copy(b.scale);
  obj.visible = true;
  obj.userData.tweak = t ?? null;
  if (!t) return;
  obj.position.x += t.pos[0];
  obj.position.y += t.pos[1];
  obj.position.z += t.pos[2];
  obj.rotation.x += deg(t.rot[0]);
  obj.rotation.y += deg(t.rot[1]);
  obj.rotation.z += deg(t.rot[2]);
  obj.scale.multiplyScalar(t.scale);
  obj.visible = !t.hidden;
}

export function applyTweaks(v, units) {
  for (const [key, t] of Object.entries(v.tweaks ?? {})) {
    const obj = units.get(key);
    if (obj) applyTweak(obj, t);
  }
}

/** The unit an object belongs to (climbing up), or null. */
export function unitOf(obj) {
  for (let o = obj; o; o = o.parent) if (o.userData.unit) return o;
  return null;
}

/** The next bigger unit containing this one (e.g. cupola → turret). */
export function parentUnit(obj) {
  return obj?.parent ? unitOf(obj.parent) : null;
}

export const EMPTY_TWEAK = () => ({ pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, hidden: false });
