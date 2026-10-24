// A 3D stage shared by the Workshop viewer and the arena: renderer, lights,
// sky and ground in several environments, orbit controls, render-on-demand
// and high-resolution captures (photo mode).
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export const ENVIRONMENTS = [
  { id: "field", label: "Field" },
  { id: "desert", label: "Desert" },
  { id: "snow", label: "Snow" },
  { id: "forest", label: "Forest" },
  { id: "studio", label: "Studio" },
  { id: "night", label: "Night" },
];

const ENV = {
  field: { sky: ["#6f8aa3", "#c4c3b6", "#8a8374"], ground: "#6f6450", speck: [70, 50, 0.88, 0.66], fog: 0xb9b7aa, sun: 0xfff1dd, sunI: 3.1, hemi: [0xc9d6e6, 0x5a4a35, 0.7], exposure: 0.95 },
  desert: { sky: ["#7fa6c9", "#e9d7b0", "#c8a874"], ground: "#c2a06a", speck: [150, 60, 0.86, 0.6], fog: 0xe6d6b4, sun: 0xffe2b8, sunI: 3.8, hemi: [0xe9e2d0, 0x9a7a4a, 0.8], exposure: 1 },
  snow: { sky: ["#93a9c2", "#dfe5ec", "#cfd6de"], ground: "#e3e8ee", speck: [200, 50, 1, 1.04], fog: 0xdfe5ec, sun: 0xf1f5ff, sunI: 2.6, hemi: [0xdde7f5, 0x9aa6b5, 0.9], exposure: 0.9 },
  forest: { sky: ["#5d7d92", "#a9b7a6", "#55634a"], ground: "#4f5a38", speck: [60, 40, 1.05, 0.7], fog: 0x8d9a86, sun: 0xfff0d0, sunI: 2.6, hemi: [0xb7c9c0, 0x3c4a2c, 0.75], exposure: 0.95 },
  studio: { sky: ["#2b2e36", "#1a1c22", "#0e0f13"], ground: "#24262d", speck: null, fog: null, sun: 0xffffff, sunI: 3.2, hemi: [0xcfd8e6, 0x22252c, 0.55], exposure: 1, rim: 2.4 },
  night: { sky: ["#0b1220", "#1b2538", "#151a24"], ground: "#2c2b2a", speck: [40, 25, 1, 0.95], fog: 0x121826, sun: 0x9fb6ff, sunI: 0.9, hemi: [0x334466, 0x111111, 0.35], exposure: 1.05 },
};

function skyTexture(stops) {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 0, 256);
  stops.forEach((s, i) => grd.addColorStop(i === 1 ? 0.62 : i / (stops.length - 1), s));
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function groundTexture(env) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = env.ground;
  g.fillRect(0, 0, 512, 512);
  if (env.speck) {
    const [base, range, kg, kb] = env.speck;
    g.filter = "blur(3px)";
    for (let i = 0; i < 1500; i++) {
      const v = base + Math.random() * range;
      g.fillStyle = `rgba(${v},${v * kg},${v * kb},.25)`;
      g.beginPath();
      g.arc(Math.random() * 512, Math.random() * 512, 3 + Math.random() * 14, 0, 7);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(12, 12);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Create a stage inside `host`. Call `frame(fn)` to run code every frame
 * (return true from fn to keep redrawing), `invalidate()` to redraw once.
 */
export function createStage(host, { shadowSize = 1536, groundSize = 60, fov = 32, shadowExtent = 9 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 400);
  camera.position.set(8, 3.6, 9);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 2.5;
  controls.maxDistance = 60;
  controls.target.set(0.5, 1.2, 0);
  const hemi = new THREE.HemisphereLight(0xc9d6e6, 0x5a4a35, 0.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dd, 3.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sun.shadow.camera, { left: -shadowExtent, right: shadowExtent, top: shadowExtent, bottom: -shadowExtent, near: 1, far: 80 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0xbcd2ff, 1.3);
  rim.position.set(-8, 5, -6);
  scene.add(rim);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(groundSize, 64), new THREE.MeshStandardMaterial({ roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(40, 80, 0x38bdf8, 0x1e3a5f);
  grid.material.transparent = true;
  grid.material.opacity = 0.35;
  grid.visible = false;
  scene.add(grid);

  let sunAngle = 40;
  let sunHeight = 50;
  const placeSun = () => {
    const a = (sunAngle * Math.PI) / 180;
    const h = (sunHeight * Math.PI) / 180;
    const r = 16;
    sun.position.set(Math.cos(a) * Math.cos(h) * r, Math.sin(h) * r, Math.sin(a) * Math.cos(h) * r);
    sun.target.position.set(0, 0, 0);
  };
  placeSun();

  const textures = new Set();
  let envId = null;
  const setEnv = (id) => {
    const e = ENV[id] ?? ENV.field;
    envId = id;
    for (const t of textures) t.dispose();
    textures.clear();
    const sky = skyTexture(e.sky);
    const gt = groundTexture(e);
    textures.add(sky).add(gt);
    scene.background = sky;
    scene.fog = e.fog ? new THREE.Fog(e.fog, 45, 180) : null;
    ground.material.map = gt;
    ground.material.color.set(0xffffff);
    ground.material.roughness = id === "studio" ? 0.55 : 1;
    ground.material.metalness = id === "studio" ? 0.2 : 0;
    ground.material.needsUpdate = true;
    hemi.color.set(e.hemi[0]);
    hemi.groundColor.set(e.hemi[1]);
    hemi.intensity = e.hemi[2];
    sun.color.set(e.sun);
    sun.intensity = e.sunI;
    rim.intensity = e.rim ?? 1.3;
    renderer.toneMappingExposure = e.exposure;
    scene.environmentIntensity = id === "night" ? 0.15 : 0.5;
    invalidate();
  };
  /** X-ray look: dark sky and a blueprint grid. */
  const setXray = (on) => {
    if (on) {
      const sky = skyTexture(["#0b1424", "#081020", "#050a12"]);
      textures.add(sky);
      scene.background = sky;
      scene.fog = null;
      ground.visible = false;
      grid.visible = true;
    } else {
      ground.visible = true;
      grid.visible = false;
      setEnv(envId ?? "field");
    }
    invalidate();
  };

  // Render on demand: frame callbacks say whether they changed anything.
  const frames = new Set();
  let dirty = true;
  const invalidate = () => (dirty = true);
  controls.addEventListener("change", invalidate);
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta());
    controls.update();
    let busy = false;
    for (const f of frames) if (f(dt)) busy = true;
    if (!busy && !dirty) return;
    dirty = false;
    renderer.render(scene, camera);
  });

  const ro = new ResizeObserver(() => {
    const r = host.getBoundingClientRect();
    if (!r.width) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    invalidate();
  });
  ro.observe(host);

  /** Render a still at any size (PNG data URL); the view on screen is untouched. */
  const capture = (w, h) => {
    const size = renderer.getSize(new THREE.Vector2());
    const pr = renderer.getPixelRatio();
    const aspect = camera.aspect;
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL("image/png");
    renderer.setPixelRatio(pr);
    renderer.setSize(size.x, size.y, false);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    invalidate();
    return url;
  };

  setEnv("field");

  return {
    renderer,
    scene,
    camera,
    controls,
    sun,
    ground,
    grid,
    setEnv,
    setXray,
    setSun(angle, height) {
      sunAngle = angle;
      sunHeight = height;
      placeSun();
      invalidate();
    },
    setFov(f) {
      camera.fov = f;
      camera.updateProjectionMatrix();
      invalidate();
    },
    frame(fn) {
      frames.add(fn);
      return () => frames.delete(fn);
    },
    invalidate,
    capture,
    dispose() {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      controls.dispose();
      for (const t of textures) t.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

/** Point the camera so a vehicle of `size` around `center` fills the view. */
export function frameVehicle(stage, size, center, dir = new THREE.Vector3(0.66, 0.3, 0.69)) {
  const { camera, controls } = stage;
  const radius = Math.max(size.length * 0.5, size.height * 0.85, size.width * 0.6);
  const dist = (radius / Math.tan((camera.fov * Math.PI) / 360)) * (camera.aspect < 1.3 ? 1.3 / camera.aspect : 1) * 0.95;
  controls.target.set(center.x, center.y * 0.75, center.z);
  camera.position.copy(controls.target).addScaledVector(dir.clone().normalize(), dist);
  controls.update();
  stage.invalidate();
}
