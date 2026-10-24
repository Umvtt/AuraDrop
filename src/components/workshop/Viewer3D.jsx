import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildVehicle } from "../../vehicles3d/vehicle.js";

function skyTexture(xray) {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 0, 256);
  if (xray) {
    grd.addColorStop(0, "#0b1424");
    grd.addColorStop(1, "#050a12");
  } else {
    grd.addColorStop(0, "#6f8aa3");
    grd.addColorStop(0.62, "#c4c3b6");
    grd.addColorStop(1, "#8a8374");
  }
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Interactive 3D view of a vehicle: orbit with the mouse, armour readout
 * under the cursor in the armour view, animations when playing.
 */
export function Viewer3D({ vehicle, view, playing, onArmorHover }) {
  const host = useRef(null);
  const ctx = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    } catch {
      setError("3D isn't available on this PC (WebGL is turned off).");
      return;
    }
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    host.current.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.5;
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 300);
    camera.position.set(8, 3.6, 9);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 3;
    controls.maxDistance = 40;
    controls.target.set(0.5, 1.2, 0);
    scene.add(new THREE.HemisphereLight(0xc9d6e6, 0x5a4a35, 0.7));
    const sun = new THREE.DirectionalLight(0xfff1dd, 3.1);
    sun.position.set(9, 11, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0xbcd2ff, 1.3);
    rim.position.set(-8, 5, -6);
    scene.add(rim);
    // Dirt ground.
    const gc = document.createElement("canvas");
    gc.width = gc.height = 512;
    const g = gc.getContext("2d");
    g.fillStyle = "#6f6450";
    g.fillRect(0, 0, 512, 512);
    g.filter = "blur(3px)";
    for (let i = 0; i < 1500; i++) {
      const v = 70 + Math.random() * 50;
      g.fillStyle = `rgba(${v},${v * 0.88},${v * 0.66},.25)`;
      g.beginPath();
      g.arc(Math.random() * 512, Math.random() * 512, 3 + Math.random() * 14, 0, 7);
      g.fill();
    }
    const gt = new THREE.CanvasTexture(gc);
    gt.wrapS = gt.wrapT = THREE.RepeatWrapping;
    gt.repeat.set(12, 12);
    gt.colorSpace = THREE.SRGBColorSpace;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ map: gt, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(40, 80, 0x38bdf8, 0x1e3a5f);
    grid.material.transparent = true;
    grid.material.opacity = 0.35;
    grid.visible = false;
    scene.add(grid);

    let dirtyResize = () => {};
    const ro = new ResizeObserver(() => {
      const r = host.current?.getBoundingClientRect();
      if (!r?.width) return;
      renderer.setSize(r.width, r.height, false);
      dirtyResize();
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
    });
    ro.observe(host.current);

    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoverAt = null;
    const onMove = (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      hoverAt = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onLeave = () => {
      hoverAt = null;
      ctx.current?.onArmorHover?.(null);
    };
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerleave", onLeave);

    const clock = new THREE.Clock();
    let t = 0;
    let frame = 0;
    let dirty = true;
    dirtyResize = () => (dirty = true);
    controls.addEventListener("change", () => (dirty = true));
    renderer.domElement.addEventListener("pointermove", () => (dirty = true));
    renderer.setAnimationLoop(() => {
      const c = ctx.current;
      const dt = Math.min(0.05, clock.getDelta());
      controls.update();
      // Idle and paused: don't redraw the same picture.
      if (!c.playing && !dirty && !c.needsPose && !c.forceDraw) return;
      dirty = false;
      c.forceDraw = false;
      if (c.built) {
        if (c.playing) {
          t += dt;
          c.built.update(dt, t, camera.position);
        } else if (c.needsPose) {
          c.built.update(0.0001, 0, camera.position);
          c.needsPose = false;
        }
        // Armour readout under the cursor (every few frames).
        if (c.view === "armor" && hoverAt && frame++ % 4 === 0) {
          ray.setFromCamera(mouse, camera);
          const hit = ray.intersectObject(c.built.root, true).find((h) => h.object.visible && !h.object.userData.fxEdge);
          const info = hit ? c.built.armorInfo(hit, ray.ray.direction) : null;
          c.onArmorHover?.(info ? { ...info, x: hoverAt.x, y: hoverAt.y } : null);
        }
      }
      renderer.render(scene, camera);
    });

    ctx.current = { renderer, scene, camera, controls, ground, grid, built: null, onArmorHover, view, playing, needsPose: true };
    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      ctx.current?.built?.dispose();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      gt.dispose();
      ctx.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild when the vehicle changes (briefly debounced while dragging sliders).
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    const timer = setTimeout(() => {
      const next = buildVehicle(vehicle);
      next.setView(c.view);
      if (c.built) {
        c.scene.remove(c.built.root);
        c.built.dispose();
      }
      c.built = next;
      c.scene.add(next.root);
      c.needsPose = true;
      c.forceDraw = true;
    }, c.built ? 120 : 0);
    return () => clearTimeout(timer);
  }, [vehicle]);

  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    c.view = view;
    c.built?.setView(view);
    c.scene.background = skyTexture(view === "xray");
    c.scene.fog = view === "xray" ? null : new THREE.Fog(0xb9b7aa, 25, 70);
    c.ground.visible = view !== "xray";
    c.grid.visible = view === "xray";
    if (view !== "armor") c.onArmorHover?.(null);
    c.forceDraw = true;
  }, [view]);

  useEffect(() => {
    if (!ctx.current) return;
    ctx.current.playing = playing;
    ctx.current.forceDraw = true;
    ctx.current.onArmorHover = onArmorHover;
  }, [playing, onArmorHover]);

  if (error) return <div className="grid h-full place-items-center text-[13px] text-muted">{error}</div>;
  return <div ref={host} className="relative h-full w-full" data-testid="viewer3d" />;
}
