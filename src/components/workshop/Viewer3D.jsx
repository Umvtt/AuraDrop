import { useEffect, useImperativeHandle, useRef, useState } from "react";
import * as THREE from "three";
import { createStage, frameVehicle } from "../../vehicles3d/stage.js";
import { engineStart, engineStop, gunShot } from "../../vehicles3d/sound.js";
import { buildVehicle } from "../../vehicles3d/vehicle.js";

/**
 * Interactive 3D view of a vehicle: orbit with the mouse, armour readout
 * under the cursor in the armour view, animations (and sounds) when playing.
 * `ref` exposes { capture(w, h), stage }.
 */
export function Viewer3D({ vehicle, view, playing, onArmorHover, env = "field", sun = null, fov = 32, sound = true, ref }) {
  const host = useRef(null);
  const ctx = useRef(null);
  const [error, setError] = useState(null);

  useImperativeHandle(ref, () => ({
    capture: (w, h) => ctx.current?.stage.capture(w, h),
    get stage() {
      return ctx.current?.stage;
    },
  }));

  useEffect(() => {
    let stage;
    try {
      stage = createStage(host.current);
    } catch {
      setError("3D isn't available on this PC (WebGL is turned off).");
      return;
    }
    const { renderer, camera } = stage;
    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoverAt = null;
    const onMove = (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      hoverAt = { x: e.clientX - r.left, y: e.clientY - r.top };
      stage.invalidate();
    };
    const onLeave = () => {
      hoverAt = null;
      ctx.current?.onArmorHover?.(null);
    };
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerleave", onLeave);

    let t = 0;
    let frame = 0;
    let fired = false;
    stage.frame((dt) => {
      const c = ctx.current;
      if (!c?.built) return false;
      let busy = false;
      if (c.playing) {
        t += dt;
        c.built.update(dt, t, camera.position);
        busy = true;
        const f = !!c.built.out.fire;
        if (f && !fired && c.sound) gunShot(c.vehicle.spec.gun?.caliber ?? 88, { distance: 300 });
        fired = f;
      } else if (c.needsPose) {
        c.built.update(0.0001, 0, camera.position);
        c.needsPose = false;
        busy = true;
      }
      // Armour readout under the cursor (every few frames).
      if (c.view === "armor" && hoverAt && frame++ % 4 === 0) {
        ray.setFromCamera(mouse, camera);
        const hit = ray.intersectObject(c.built.root, true).find((h) => h.object.visible && !h.object.userData.fxEdge);
        const info = hit ? c.built.armorInfo(hit, ray.ray.direction) : null;
        c.onArmorHover?.(info ? { ...info, x: hoverAt.x, y: hoverAt.y } : null);
      }
      return busy;
    });

    ctx.current = { stage, built: null, onArmorHover, view, playing, needsPose: true, vehicle, sound };
    return () => {
      engineStop();
      ctx.current?.built?.dispose();
      stage.dispose();
      ctx.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild when the vehicle changes (briefly debounced while dragging sliders).
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    c.vehicle = vehicle;
    const timer = setTimeout(() => {
      const next = buildVehicle(vehicle);
      next.setView(c.view);
      if (c.built) {
        c.stage.scene.remove(c.built.root);
        c.built.dispose();
      }
      c.built = next;
      // Frame the vehicle so it fills the view (first time, and when a different one is loaded).
      if (c.framedId !== vehicle.id) {
        c.framedId = vehicle.id;
        frameVehicle(c.stage, next.size, next.center);
      }
      c.stage.scene.add(next.root);
      c.needsPose = true;
      c.stage.invalidate();
    }, c.built ? 120 : 0);
    return () => clearTimeout(timer);
  }, [vehicle]);

  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    c.view = view;
    c.built?.setView(view);
    c.stage.setXray(view === "xray");
    if (view !== "armor") c.onArmorHover?.(null);
  }, [view]);

  useEffect(() => {
    const c = ctx.current;
    if (!c || view === "xray") return;
    c.stage.setEnv(env);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env]);

  useEffect(() => {
    ctx.current?.stage.setSun(sun?.angle ?? 40, sun?.height ?? 50);
  }, [sun]);

  useEffect(() => {
    ctx.current?.stage.setFov(fov);
  }, [fov]);

  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    c.playing = playing;
    c.sound = sound;
    c.onArmorHover = onArmorHover;
    c.stage.invalidate();
    const drive = vehicle.spec.anim?.drive;
    if (playing && sound) engineStart(vehicle.spec.engine?.hp ?? 600, drive ? 0.45 : 0.1);
    else engineStop();
  }, [playing, sound, onArmorHover, vehicle.spec.anim?.drive, vehicle.spec.engine?.hp]);

  if (error) return <div className="grid h-full place-items-center text-[13px] text-muted">{error}</div>;
  return <div ref={host} className="relative h-full w-full" data-testid="viewer3d" />;
}
