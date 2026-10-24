// Shots against the real 3D model, War Thunder style: the shell hits an
// actual plate, its angle and thickness decide ricochet / non-pen / pen, and
// a penetrating shell sprays fragments that knock out crew and modules.
import * as THREE from "three";
import { effectiveArmor } from "./decals.js";
import { penetration } from "./stats.js";

/** How each shell type behaves. ricochet: angle (from the plate normal) above which it bounces. */
export const SHELLS = {
  AP: { label: "AP", ricochet: 70, normalise: 5, falloff: 0.12, fuse: 0, cone: 16, frags: 14, reach: 2.6 },
  APHE: { label: "APHE", ricochet: 70, normalise: 5, falloff: 0.12, fuse: 1.1, cone: 50, frags: 30, reach: 1.8 },
  APCBC: { label: "APCBC", ricochet: 71, normalise: 5, falloff: 0.11, fuse: 1.1, cone: 48, frags: 30, reach: 1.9 },
  APDS: { label: "APDS", ricochet: 75, normalise: 0, falloff: 0.07, fuse: 0, cone: 14, frags: 16, reach: 3 },
  APFSDS: { label: "APFSDS", ricochet: 78, normalise: 0, falloff: 0.04, fuse: 0, cone: 12, frags: 20, reach: 3.6 },
  HEAT: { label: "HEAT", ricochet: 80, normalise: 0, falloff: 0, fuse: 0, cone: 10, frags: 14, reach: 2.4 },
  HE: { label: "HE", ricochet: 90, normalise: 0, falloff: 0, fuse: 0, cone: 70, frags: 26, reach: 1.4 },
};

/** Penetration (mm) of a gun's shell at a distance in metres. */
export function penAt(gun, distance) {
  const s = SHELLS[gun.shell] ?? SHELLS.APCBC;
  const p0 = penetration(gun.caliber, gun.length, gun.shell);
  return p0 * Math.max(0.35, 1 - s.falloff * (distance / 1000));
}

/** Child-index path from root to obj, so the same part can be found in a copy. */
export function pathOf(root, obj) {
  const path = [];
  for (let o = obj; o && o !== root; o = o.parent) path.unshift(o.parent.children.indexOf(o));
  return path;
}

/** Gather what a shot can hit inside a built vehicle. */
function partsOf(built) {
  const armor = [];
  const modules = [];
  built.root.traverse((o) => {
    if (!o.isMesh || o.userData.fxEdge) return;
    if (o.userData.part) modules.push(o);
    else if (o.userData.armor && !o.userData.interior && !o.userData.decal) armor.push(o);
  });
  return { armor, modules };
}

/** A fresh damage state for a vehicle. */
export function freshState(built) {
  const crew = {};
  built.root.traverse((o) => {
    const p = o.userData.part;
    if (p?.kind === "crew") crew[p.role] = true;
  });
  return { crew, modules: {}, fire: false, ammoRack: false, destroyed: false, hits: 0 };
}

const ROLE_LABEL = { commander: "Commander", gunner: "Gunner", loader: "Loader", driver: "Driver", radio: "Radio operator" };
const MODULE_LABEL = { engine: "Engine", radiator: "Radiator", fuel: "Fuel tank", transmission: "Transmission", ammo: "Ammo rack", breech: "Gun breech" };
export const partLabel = (p) => (p.kind === "crew" ? ROLE_LABEL[p.role] ?? "Crew" : MODULE_LABEL[p.kind] ?? p.kind);

/** Random direction inside a cone around `dir` (half-angle in degrees). */
function coneDir(dir, halfDeg, rnd) {
  const a = (halfDeg * Math.PI) / 180;
  const cosT = 1 - rnd() * (1 - Math.cos(a));
  const sinT = Math.sqrt(1 - cosT * cosT);
  const phi = rnd() * Math.PI * 2;
  const up = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(dir, up).normalize();
  const v = new THREE.Vector3().crossVectors(dir, u);
  return dir.clone().multiplyScalar(cosT).addScaledVector(u, Math.cos(phi) * sinT).addScaledVector(v, Math.sin(phi) * sinT).normalize();
}

/**
 * Fire one shell along a world-space ray at a built vehicle.
 * `state` (from freshState) is updated in place. Returns everything needed to
 * draw the hit camera: the shell path, the plate, fragments and damage.
 */
export function shoot(built, state, { origin, dir, gun, distance = 500, rnd = Math.random }) {
  built.root.updateMatrixWorld(true);
  const shell = SHELLS[gun.shell] ?? SHELLS.APCBC;
  const pen = penAt(gun, distance) * (0.94 + rnd() * 0.12); // a little scatter, like the real thing
  const { armor, modules } = partsOf(built);
  const ray = new THREE.Raycaster(origin.clone(), dir.clone().normalize());
  const hits = ray.intersectObjects(armor, false);
  const result = { pen, shell: gun.shell, origin: origin.clone(), dir: ray.ray.direction.clone(), fragments: [], damaged: [], log: [] };
  state.hits++;
  if (!hits.length) {
    result.outcome = "miss";
    result.end = origin.clone().addScaledVector(ray.ray.direction, 60);
    result.log.push("Missed");
    return result;
  }
  const hit = hits[0];
  const info = built.armorInfo(hit, ray.ray.direction);
  result.point = hit.point.clone();
  result.normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
  if (result.normal.dot(ray.ray.direction) > 0) result.normal.negate();
  result.plate = info?.name ?? "Armour";
  result.thickness = info?.t ?? 0;
  result.angle = info?.angle ?? 0;
  // Full-calibre shells "bite" and turn slightly towards the normal.
  const angle = Math.max(0, result.angle - shell.normalise);
  result.effective = effectiveArmor(result.thickness, angle);
  result.end = result.point.clone();

  if (result.angle > shell.ricochet && rnd() < 0.85) {
    result.outcome = "ricochet";
    const r = ray.ray.direction.clone().reflect(result.normal);
    result.bounce = [result.point.clone(), result.point.clone().addScaledVector(r, 6)];
    result.log.push(`Ricochet off the ${result.plate.toLowerCase()} (${Math.round(result.angle)}°)`);
    return result;
  }
  if (gun.shell === "HE") {
    // HE only matters against thin armour: it "penetrates" by blast.
    if (pen < result.effective) {
      result.outcome = "nonpen";
      result.log.push(`HE blast didn't get through ${Math.round(result.effective)} mm`);
      return result;
    }
  } else if (pen < result.effective) {
    result.outcome = "nonpen";
    result.log.push(`Non-penetration: ${Math.round(pen)} mm pen vs ${Math.round(result.effective)} mm effective`);
    return result;
  }

  // Penetration: the shell carries on (and an APHE shell explodes after its fuse).
  result.outcome = "pen";
  const inside = result.point.clone().addScaledVector(ray.ray.direction, 0.06);
  const burst = inside.clone().addScaledVector(ray.ray.direction, shell.fuse);
  result.end = shell.fuse ? burst.clone() : inside.clone().addScaledVector(ray.ray.direction, shell.reach);
  result.log.push(`Penetration: ${Math.round(pen)} mm vs ${Math.round(result.effective)} mm ${result.plate.toLowerCase()}`);
  const from = shell.fuse ? burst : inside;
  const frag = new THREE.Raycaster();
  const struck = new Map(); // mesh -> part
  const shots = [ray.ray.direction.clone(), ...Array.from({ length: shell.frags }, () => coneDir(ray.ray.direction, shell.cone, rnd))];
  // Leftover energy: big overmatch means more fragments carry further.
  const reach = shell.reach * Math.min(1.5, 0.75 + (pen - result.effective) / Math.max(60, result.effective));
  for (const d of shots) {
    frag.set(from, d);
    frag.far = reach * (0.6 + rnd() * 0.4);
    const h = frag.intersectObjects(modules, false)[0];
    result.fragments.push([from.clone(), h ? h.point.clone() : from.clone().addScaledVector(d, frag.far), !!h]);
    if (h) struck.set(h.object, h.object.userData.part);
  }
  for (const [mesh, part] of struck) {
    const key = part.kind === "crew" ? `crew:${part.role}` : part.kind;
    if (part.kind === "crew") {
      if (!state.crew[part.role]) continue;
      if (rnd() < 0.85) {
        state.crew[part.role] = false;
        result.damaged.push({ part, mesh, path: pathOf(built.root, mesh), state: "dead" });
        result.log.push(`${partLabel(part)} knocked out`);
      } else result.damaged.push({ part, mesh, path: pathOf(built.root, mesh), state: "hurt" });
    } else if (part.kind === "ammo") {
      const boom = rnd() < (shell.fuse ? 0.8 : 0.55);
      result.damaged.push({ part, mesh, path: pathOf(built.root, mesh), state: boom ? "dead" : "hurt" });
      if (boom) {
        state.ammoRack = true;
        result.log.push("Ammo rack detonated!");
      } else result.log.push("Ammo rack hit");
    } else if (!state.modules[key]) {
      state.modules[key] = true;
      result.damaged.push({ part, mesh, path: pathOf(built.root, mesh), state: "dead" });
      result.log.push(`${partLabel(part)} destroyed`);
      if (part.kind === "fuel" && rnd() < 0.45) {
        state.fire = true;
        result.log.push("Fire!");
      }
    }
  }
  if (!struck.size) result.log.push("No modules hit");
  const alive = Object.values(state.crew).filter(Boolean).length;
  if (state.ammoRack) {
    state.destroyed = true;
    result.killedBy = "ammo";
  } else if (alive < 2) {
    state.destroyed = true;
    result.killedBy = "crew";
    result.log.push("Not enough crew left: knocked out");
  }
  result.destroyed = state.destroyed;
  return result;
}

/**
 * Where a gunner would aim from `origin`: a point that really is on the
 * target (turret ring / upper hull favoured), then dispersion in metres.
 */
export function aimPoint(built, origin, spread, rnd = Math.random) {
  built.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(built.out.hull ?? built.root);
  const all = new THREE.Box3().setFromObject(built.root);
  box.max.y = Math.max(box.max.y, all.max.y - 0.25);
  const size = box.getSize(new THREE.Vector3());
  const { armor } = partsOf(built);
  const ray = new THREE.Raycaster();
  let best = box.getCenter(new THREE.Vector3());
  for (let i = 0; i < 12; i++) {
    const c = box.getCenter(new THREE.Vector3());
    c.y = box.min.y + size.y * (0.5 + (rnd() - 0.5) * 0.5);
    c.x += (rnd() - 0.5) * size.x * 0.45;
    c.z += (rnd() - 0.5) * size.z * 0.3;
    ray.set(origin, c.clone().sub(origin).normalize());
    const h = ray.intersectObjects(armor, false)[0];
    if (h) {
      best = h.point;
      break;
    }
  }
  const g = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
  return best.clone().add(new THREE.Vector3(g() * spread, g() * spread * 0.6, g() * spread));
}
