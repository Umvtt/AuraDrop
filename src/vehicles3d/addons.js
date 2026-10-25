// Hand-placed parts ("add-ons"): built at their size, placed on the hull,
// turret or gun, optionally mirrored to the other side.
import * as THREE from "three";
import { cyl, latheX, mesh, rbox, sideExtrude, tube, V3 } from "./geo.js";
import { ADDONS } from "./spec.js";

const deg = (d) => (d * Math.PI) / 180;

/** Build one part's meshes for size [x, y, z] (metres), standing on y = 0. */
function shape(a, M) {
  const [x, y, z] = a.size;
  const g = new THREE.Group();
  const paint = a.color ? M.color(a.color, { roughness: 0.7 }) : M.paint;
  const armored = (name) => () => ({ name, t: a.armor });
  switch (a.type) {
    case "box":
      g.add(mesh(rbox(x, y, z, Math.min(x, y, z) * 0.08, 0, y / 2, 0), paint, armored("Add-on")));
      break;
    case "cylinder":
      g.add(mesh(cyl(x / 2, z / 2 || x / 2, y, "y", 24).translate(0, y / 2, 0), paint, armored("Add-on")));
      break;
    case "sphere":
      g.add(mesh(new THREE.SphereGeometry(0.5, 24, 16).scale(x, y, z).translate(0, y / 2, 0), paint, armored("Add-on")));
      break;
    case "wedge":
      g.add(mesh(sideExtrude([[-x / 2, 0], [x / 2, 0], [-x / 2, y]], z, 0.01).translate(0, 0, 0), paint, armored("Add-on")));
      break;
    case "plate":
      g.add(mesh(rbox(x, y, z, Math.min(z * 0.4, 0.01), 0, y / 2, 0), paint, armored("Add-on armour plate")));
      for (const [bx, by] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(mesh(cyl(0.02, 0.02, z + 0.02, "z", 8).translate((bx * x) / 2.6, y / 2 + (by * y) / 2.6, 0), M.steel));
      break;
    case "era": {
      const cols = Math.max(1, Math.round(x / 0.16));
      const rows = Math.max(1, Math.round(z / 0.16));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) g.add(mesh(rbox((x / cols) * 0.9, y, (z / rows) * 0.9, 0.01, -x / 2 + (i + 0.5) * (x / cols), y / 2, -z / 2 + (j + 0.5) * (z / rows)), paint, armored("Reactive armour")));
      break;
    }
    case "sandbags":
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) g.add(mesh(new THREE.SphereGeometry(0.5, 14, 10).scale(x / 2.2, y / 2, z / 1.6).translate(-x / 3 + (i * x) / 3 + (j ? x / 6 : 0), y * (0.25 + j * 0.5), 0), M.sand));
      break;
    case "spare": {
      const links = Math.max(2, Math.round(x / 0.16));
      for (let i = 0; i < links; i++) g.add(mesh(rbox((x / links) * 0.92, y, z, 0.01, -x / 2 + (i + 0.5) * (x / links), y / 2, 0), M.trackSteel));
      break;
    }
    case "jerrycan":
      g.add(mesh(rbox(x, y, z, 0.02, 0, y / 2, 0), a.color ? paint : M.olive));
      g.add(mesh(rbox(x * 0.6, 0.04, z * 0.3, 0.01, 0, y + 0.02, 0), M.dark));
      break;
    case "crate":
      g.add(mesh(rbox(x, y, z, 0.015, 0, y / 2, 0), M.wood));
      for (const s of [-1, 1]) g.add(mesh(rbox(0.03, y * 1.02, z * 1.02, 0.005, (s * x) / 2.6, y / 2, 0), M.dark));
      break;
    case "log":
      g.add(mesh(cyl(y / 2, y / 2, x, "x", 14).translate(0, y / 2, 0), M.wood));
      break;
    case "tarp":
      g.add(mesh(cyl(y / 2, y / 2, x, "x", 16).translate(0, y / 2, 0), M.canvas));
      for (const s of [-1, 1]) g.add(mesh(new THREE.TorusGeometry(y / 2 + 0.005, 0.012, 6, 16).rotateY(Math.PI / 2).translate((s * x) / 3, y / 2, 0), M.leather));
      break;
    case "helmet":
      g.add(mesh(new THREE.SphereGeometry(0.5, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(x, y * 2, z), a.color ? paint : M.olive));
      break;
    case "mg":
      g.add(mesh(rbox(x * 0.35, y, z, 0.01, -x * 0.1, y / 2, 0), M.gunmetal));
      g.add(mesh(cyl(y * 0.18, y * 0.18, x * 0.65, "x", 10).translate(x * 0.35, y * 0.6, 0), M.gunmetal));
      g.add(mesh(cyl(y * 0.12, y * 0.12, y * 1.5, "y", 8).translate(-x * 0.1, -y * 0.5, 0), M.gunmetal));
      break;
    case "rocketpod":
      g.add(mesh(cyl(y / 2, y / 2, x, "x", 20).translate(0, y / 2, 0), paint));
      for (let i = 0; i < 7; i++) {
        const a7 = (i / 6) * Math.PI * 2;
        const r = i === 6 ? 0 : y * 0.28;
        g.add(mesh(cyl(y * 0.08, y * 0.08, 0.02, "x", 8).translate(x / 2 + 0.005, y / 2 + Math.cos(a7) * r, Math.sin(a7) * r), M.black));
      }
      break;
    case "smoke":
      for (let i = 0; i < 3; i++) g.add(mesh(cyl(x * 0.22, x * 0.22, y, "y", 12).rotateZ(deg(30)).translate(0, y / 2, -z / 2 + ((i + 0.5) * z) / 3), M.dark));
      break;
    case "antenna":
      g.add(mesh(cyl(x / 2, x / 3, y, "y", 6).translate(0, y / 2, 0), M.dark));
      g.add(mesh(cyl(x, x, 0.05, "y", 10).translate(0, 0.025, 0), M.steel));
      break;
    case "light":
      g.add(mesh(cyl(x / 2, x / 2.2, z, "x", 18).translate(0, y / 2, 0), M.dark));
      g.add(mesh(cyl(x / 2.2, x / 2.2, 0.01, "x", 18).translate(z / 2 + 0.005, y / 2, 0), M.lamp));
      break;
    case "periscope":
      g.add(mesh(rbox(x, y, z, 0.01, 0, y / 2, 0), M.steel));
      g.add(mesh(rbox(0.01, y * 0.4, z * 0.8, 0.002, x / 2, y * 0.6, 0), M.glass));
      break;
    case "hatch":
      g.add(mesh(cyl(x / 2, x / 2, y, "y", 24).translate(0, y / 2, 0), paint));
      g.add(mesh(tube([V3(-x * 0.15, y, 0), V3(-x * 0.1, y + 0.05, 0), V3(x * 0.1, y + 0.05, 0), V3(x * 0.15, y, 0)], 0.01, 12, 5), M.steel));
      break;
    case "exhaust":
      g.add(mesh(cyl(x / 2, x / 2, y, "y", 14, true).translate(0, y / 2, 0), M.exhaust));
      break;
    case "searchlight":
      g.add(mesh(latheX([[y * 0.3, -x / 2], [y * 0.45, 0], [y * 0.5, x / 2]], 20).translate(0, y / 2, 0), M.dark));
      g.add(mesh(cyl(y * 0.47, y * 0.47, 0.01, "x", 20).translate(x / 2 + 0.005, y / 2, 0), M.lamp));
      break;
    case "flag": {
      g.add(mesh(cyl(0.012, 0.012, y, "y", 6).translate(0, y / 2, 0), M.dark));
      const cloth = new THREE.PlaneGeometry(x, y * 0.35, 12, 4);
      const p = cloth.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) + x / 2) * 6) * 0.04 * ((p.getX(i) + x / 2) / x));
      cloth.computeVertexNormals();
      const m = mesh(cloth.translate(x / 2, y * 0.8, 0), a.color ? M.color(a.color, { side: THREE.DoubleSide }) : M.color("#dc2626", { side: THREE.DoubleSide }));
      g.add(m);
      break;
    }
    case "crew": {
      const s = y / 0.9;
      g.add(mesh(new THREE.CapsuleGeometry(0.16 * s, 0.4 * s, 6, 12).translate(0, 0.45 * s, 0), M.olive));
      g.add(mesh(new THREE.SphereGeometry(0.11 * s, 16, 12).translate(0, 0.85 * s, 0), M.skin));
      g.add(mesh(new THREE.SphereGeometry(0.13 * s, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.88 * s, 0), M.leather));
      break;
    }
    default:
      g.add(mesh(rbox(x, y, z, 0.01, 0, y / 2, 0), paint));
  }
  return g;
}

function place(group, a, mirrored) {
  group.position.set(a.pos[0], a.pos[1], mirrored ? -a.pos[2] : a.pos[2]);
  group.rotation.set(deg(mirrored ? -a.rot[0] : a.rot[0]), deg(mirrored ? -a.rot[1] : a.rot[1]), deg(a.rot[2]));
}

/** Where parts mounted "on" hull / turret / gun attach in a built vehicle. */
export function addonParent(out, on) {
  if (on === "turret" && out.turret) return out.turret;
  if (on === "gun" && out.gunPivot) return out.gunPivot;
  return out.body ?? out.root;
}

/** Build and attach all of a vehicle's parts. */
export function attachAddons(v, out, M) {
  out.addons = new Map();
  for (const a of v.addons ?? []) {
    if (!ADDONS.some((d) => d.id === a.type)) continue;
    const list = [];
    for (const mirrored of a.mirror ? [false, true] : [false]) {
      const g = shape(a, M);
      g.name = `addon:${a.id}`;
      place(g, a, mirrored);
      g.traverse((o) => (o.userData.addonId = a.id));
      addonParent(out, a.on).add(g);
      list.push(g);
    }
    out.addons.set(a.id, list);
  }
}

/** Move a part's meshes live (while dragging), without a rebuild. */
export function moveAddon(out, a) {
  const list = out.addons?.get(a.id);
  if (!list) return;
  list.forEach((g, i) => place(g, a, i === 1));
}
