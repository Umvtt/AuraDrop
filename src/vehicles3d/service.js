// One shared WebGL renderer that draws every 3D vehicle on the canvas into
// its own 2D <canvas>, plus snapshots (PNG data URLs) for exports.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildVehicle } from "./vehicle.js";

let renderer = null;
let scene = null;
let camera = null;
const cache = new Map(); // vehicle JSON -> { built, users, last }
const targets = new Set();
let raf = 0;

function init() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  scene.add(new THREE.HemisphereLight(0xc9d6e6, 0x5a4a35, 0.7));
  const sun = new THREE.DirectionalLight(0xfff1dd, 3);
  sun.position.set(9, 11, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xbcd2ff, 1.2);
  rim.position.set(-8, 5, -6);
  scene.add(rim);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.ShadowMaterial({ opacity: 0.35 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = "ground";
  scene.add(ground);
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
}

function acquire(vehicle) {
  const key = JSON.stringify(vehicle);
  let e = cache.get(key);
  if (!e) {
    e = { built: buildVehicle(vehicle), users: 0, view: "normal" };
    cache.set(key, e);
  }
  e.users++;
  return { key, e };
}

function release(key) {
  const e = cache.get(key);
  if (!e) return;
  if (--e.users <= 0) {
    e.built.dispose();
    cache.delete(key);
  }
}

/** Frame the camera on a vehicle from yaw/pitch (degrees) at a zoom. */
function aim(built, { yaw = 35, pitch = 12, zoom = 1 }, aspect) {
  const s = built.size;
  const radius = Math.max(s.length * 0.62, s.height * 1.1, s.width * 0.72);
  const dist = (radius / Math.tan((camera.fov * Math.PI) / 360)) * (aspect < 1.4 ? 1.4 / aspect : 1) * 0.5 / zoom;
  const y = (pitch * Math.PI) / 180;
  const a = (yaw * Math.PI) / 180;
  const c = built.center;
  camera.aspect = aspect;
  camera.position.set(c.x + Math.cos(y) * Math.cos(a) * dist, c.y + Math.sin(y) * dist + 0.3, c.z + Math.cos(y) * Math.sin(a) * dist);
  camera.lookAt(c.x, c.y * 0.8, c.z);
  camera.updateProjectionMatrix();
}

function draw(built, opts, w, h, t, dt) {
  init();
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  scene.getObjectByName("ground").visible = opts.ground !== false;
  if (built.view !== (opts.view ?? "normal")) built.setView(opts.view ?? "normal");
  scene.add(built.root);
  const yaw = opts.spin ? (opts.yaw ?? 35) + t * 12 : opts.yaw;
  aim(built, { ...opts, yaw }, w / h);
  built.update(dt, t, camera.position);
  renderer.render(scene, camera);
  scene.remove(built.root);
}

/** A PNG data URL of a vehicle (for PNG / web page export). */
export function snapshot(vehicle, opts = {}, w = 1200, h = 700) {
  const { key, e } = acquire(vehicle);
  try {
    draw(e.built, { ...opts, animate: false }, w, h, 0, 0.001);
    return renderer.domElement.toDataURL("image/png");
  } finally {
    release(key);
  }
}

/** Keep a vehicle built for frame-by-frame rendering (video export). */
export function hold(vehicle) {
  const { key, e } = acquire(vehicle);
  return {
    /** Draw one frame; returns the WebGL canvas to copy from straight away. */
    frame(opts, w, h, t, dt) {
      draw(e.built, opts, w, h, t, dt);
      return renderer.domElement;
    },
    release: () => release(key),
  };
}

function loop(now) {
  raf = 0;
  const t = now / 1000;
  for (const tg of targets) {
    const { canvas, opts } = tg;
    if (!canvas.isConnected) continue;
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const animated = opts.animate || opts.spin;
    if (!animated && tg.drawn === tg.sig) continue;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(16, Math.round(r.width * dpr));
    const h = Math.max(16, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const dt = tg.lastT ? Math.min(0.05, t - tg.lastT) : 0.016;
    tg.lastT = t;
    draw(tg.entry.built, opts, w, h, animated ? t : 0, animated ? dt : 0.001);
    const g = canvas.getContext("2d");
    g.clearRect(0, 0, w, h);
    g.drawImage(renderer.domElement, 0, 0);
    tg.drawn = tg.sig;
  }
  if (targets.size) raf = requestAnimationFrame(loop);
}

/** Show a vehicle in `canvas`; returns { update(vehicle, opts), dispose() }. */
export function attach(canvas, vehicle, opts) {
  const tg = { canvas, opts, sig: 0, drawn: -1 };
  let held = acquire(vehicle);
  tg.entry = held.e;
  targets.add(tg);
  if (!raf) raf = requestAnimationFrame(loop);
  return {
    update(nextVehicle, nextOpts) {
      const key = JSON.stringify(nextVehicle);
      if (key !== held.key) {
        const next = acquire(nextVehicle);
        release(held.key);
        held = next;
        tg.entry = held.e;
      }
      tg.opts = nextOpts;
      tg.sig++;
      if (!raf) raf = requestAnimationFrame(loop);
    },
    dispose() {
      targets.delete(tg);
      release(held.key);
    },
  };
}
