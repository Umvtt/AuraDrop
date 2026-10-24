// War Thunder style hit camera: an X-ray still of the target at the moment
// of the hit, with the shell's path, its fragments and what they broke.
import * as THREE from "three";
import { partLabel } from "./ballistics.js";
import { buildVehicle } from "./vehicle.js";

let renderer = null;

const resolve = (root, path) => path.reduce((o, i) => o?.children[i], root);

function rod(a, b, r, mat) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.max(0.001, len), 8, 1, true), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

const TITLE = {
  pen: ["PENETRATION", "#f97316"],
  nonpen: ["NON-PENETRATION", "#94a3b8"],
  ricochet: ["RICOCHET", "#facc15"],
  miss: ["MISS", "#64748b"],
};

/**
 * Render the hit camera for `result` (from ballistics.shoot) on `vehicle`
 * posed like `pose` = { matrix: number[16], turretYaw, gunElev }.
 * `deadCrew`: roles knocked out before this shot. Returns a PNG data URL.
 */
export function hitCamImage(vehicle, pose, result, { deadCrew = [], w = 720, h = 420, title } = {}) {
  renderer ??= new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1220);
  scene.add(new THREE.HemisphereLight(0xc7d7ff, 0x223344, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 2);
  key.position.set(5, 8, 4);
  scene.add(key);

  const copy = buildVehicle(vehicle);
  copy.root.matrixAutoUpdate = false;
  copy.root.matrix.fromArray(pose.matrix);
  if (copy.out.turret) copy.out.turret.rotation.y = pose.turretYaw ?? 0;
  if (copy.out.gunPivot) copy.out.gunPivot.rotation.z = pose.gunElev ?? 0;
  copy.setView("xray");
  scene.add(copy.root);
  copy.root.updateMatrixWorld(true);

  const extra = [];
  const mat = (color, opacity = 1) => {
    const m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthTest: false });
    extra.push(m);
    return m;
  };
  // Knocked-out crew from earlier shots in grey, this shot's damage in red/orange.
  const grey = mat(0x475569);
  copy.root.traverse((o) => {
    const p = o.userData.part;
    if (p?.kind === "crew" && deadCrew.includes(p.role)) o.material = grey;
  });
  for (const d of result.damaged ?? []) {
    const m = d.path && resolve(copy.root, d.path);
    if (m?.isMesh) {
      m.material = mat(d.state === "dead" ? 0xef4444 : 0xfb923c);
      m.renderOrder = 5;
    }
  }

  const group = new THREE.Group();
  scene.add(group);
  const shellMat = mat(0xfde047);
  const fragMat = mat(0xfb923c, 0.85);
  const fragHitMat = mat(0xef4444);
  const target = result.point ?? result.end;
  const start = target.clone().addScaledVector(result.dir, -4);
  group.add(rod(start, target, 0.035, shellMat));
  if (result.outcome === "pen") {
    group.add(rod(target, result.end, 0.03, shellMat));
    for (const [a, b, hit] of result.fragments) group.add(rod(a, b, hit ? 0.014 : 0.008, hit ? fragHitMat : fragMat));
  }
  if (result.bounce) group.add(rod(result.bounce[0], result.bounce[1], 0.025, mat(0xffffff, 0.8)));
  if (result.point) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.09, 0.14, 24), mat(TITLE[result.outcome]?.[1] ? new THREE.Color(TITLE[result.outcome][1]).getHex() : 0xffffff));
    ring.position.copy(result.point).addScaledVector(result.normal, 0.02);
    ring.lookAt(result.point.clone().add(result.normal));
    group.add(ring);
  }
  group.traverse((o) => (o.renderOrder = 10));

  // Look at the impact from beside the shell's path.
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(result.dir, up).normalize();
  if (side.lengthSq() < 0.1) side.set(1, 0, 0);
  const focus = result.outcome === "pen" ? target.clone().lerp(result.end, 0.35) : target.clone();
  const camera = new THREE.PerspectiveCamera(34, w / h, 0.05, 100);
  camera.position.copy(focus).addScaledVector(result.dir, -4.2).addScaledVector(side, 2.6).addScaledVector(up, 1.9);
  camera.lookAt(focus);
  renderer.render(scene, camera);

  // Text overlay.
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const g = out.getContext("2d");
  g.drawImage(renderer.domElement, 0, 0);
  const vg = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,.55)");
  g.fillStyle = vg;
  g.fillRect(0, 0, w, h);
  const [label, color] = result.destroyed ? ["TARGET DESTROYED", "#ef4444"] : TITLE[result.outcome] ?? TITLE.miss;
  g.font = "800 26px Inter, system-ui, sans-serif";
  g.fillStyle = color;
  g.fillText(label, 18, 38);
  g.font = "600 13px Inter, system-ui, sans-serif";
  g.fillStyle = "rgba(255,255,255,.9)";
  const lines = [];
  if (title) lines.push(title);
  if (result.point) lines.push(`${result.shell} · ${Math.round(result.pen)} mm pen → ${result.plate}: ${Math.round(result.thickness)} mm at ${Math.round(result.angle)}° = ${Math.round(result.effective)} mm`);
  lines.forEach((l, i) => g.fillText(l, 18, 62 + i * 18));
  // Damage list, bottom left.
  const dmg = (result.damaged ?? []).map((d) => [partLabel(d.part), d.state === "dead" ? "#f87171" : "#fdba74"]);
  if (result.killedBy === "ammo") dmg.unshift(["Ammo rack detonated", "#ef4444"]);
  g.font = "600 12px Inter, system-ui, sans-serif";
  dmg.slice(0, 8).forEach(([t, c], i) => {
    const y = h - 16 - (Math.min(dmg.length, 8) - 1 - i) * 18;
    g.fillStyle = c;
    g.beginPath();
    g.arc(24, y - 4, 4, 0, 7);
    g.fill();
    g.fillStyle = "rgba(255,255,255,.92)";
    g.fillText(t, 34, y);
  });
  g.font = "600 10px Inter, system-ui, sans-serif";
  g.fillStyle = "rgba(255,255,255,.45)";
  g.textAlign = "right";
  g.fillText("AuraDrop hit camera", w - 12, h - 10);

  scene.remove(copy.root);
  copy.dispose();
  group.traverse((o) => o.geometry?.dispose());
  for (const m of extra) m.dispose();
  return out.toDataURL("image/png");
}
