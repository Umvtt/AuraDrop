import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildVehicle } from "../src/vehicles3d/vehicle.js";
import { createVehicle, PAINTS } from "../src/vehicles3d/spec.js";
import { PRESETS3D } from "../src/vehicles3d/presets.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;
// Sky gradient background.
const sky = document.createElement("canvas");
sky.width = 4; sky.height = 256;
const sg = sky.getContext("2d");
const grd = sg.createLinearGradient(0, 0, 0, 256);
grd.addColorStop(0, "#7d93a8"); grd.addColorStop(0.6, "#c9c8bb"); grd.addColorStop(1, "#8c8576");
sg.fillStyle = grd; sg.fillRect(0, 0, 4, 256);
const skyTex = new THREE.CanvasTexture(sky); skyTex.colorSpace = THREE.SRGBColorSpace;
scene.background = skyTex;
scene.fog = new THREE.Fog(0xb9b7aa, 18, 60);

const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 200);
camera.position.set(7.5, 3.4, 8.5);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0.6, 1.2, 0);
controls.enableDamping = true;

const sun = new THREE.DirectionalLight(0xfff1dd, 3.2);
sun.position.set(9, 11, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xc9d6e6, 0x5a4a35, 0.7));
const rim = new THREE.DirectionalLight(0xbcd2ff, 1.4);
rim.position.set(-8, 5, -6);
scene.add(rim);

// Ground: dirt with tyre ruts.
const gc = document.createElement("canvas"); gc.width = gc.height = 512;
const g = gc.getContext("2d"); g.fillStyle = "#6f6450"; g.fillRect(0, 0, 512, 512);
g.filter='blur(3px)'; for (let i = 0; i < 1500; i++) { const v = 70 + Math.random() * 50; g.fillStyle = `rgba(${v},${v * 0.88},${v * 0.66},.25)`; g.beginPath(); g.arc(Math.random() * 512, Math.random() * 512, 3 + Math.random() * 14, 0, 7); g.fill(); }
const gt = new THREE.CanvasTexture(gc); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(12, 12); gt.colorSpace = THREE.SRGBColorSpace;
const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ map: gt, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const ao = new GTAOPass(scene, camera, innerWidth, innerHeight);
ao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.5, thickness: 1, scale: 1.2 });
composer.addPass(ao);
composer.addPass(new OutputPass());
const params0 = new URLSearchParams(location.search);
let veh = PRESETS3D.find((p) => p.preset === (params0.get("p") || "tiger1"));
const tiger = buildVehicle(veh);
scene.add(tiger.root);
window.tiger = tiger;
const params = new URLSearchParams(location.search);
if (params.get("view")) tiger.setView(params.get("view"));
if (params.get("cam")) { const [x, y, z] = params.get("cam").split(",").map(Number); camera.position.set(x, y, z); }
document.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => tiger.setView(b.dataset.v)));
addEventListener("resize", () => { renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
const clock = new THREE.Clock();
const still = params.has("still");
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta());
  if (!still) tiger.update(dt, clock.elapsedTime, camera.position);
  else tiger.update(0.001, 0, camera.position);
  controls.update();
  composer.render();
  window.__frames = (window.__frames || 0) + 1;
  if (still && window.__frames >= 3) { renderer.setAnimationLoop(null); window.__done = true; }
});
