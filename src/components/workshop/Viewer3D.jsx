import { useEffect, useImperativeHandle, useRef, useState } from "react";
import * as THREE from "three";
import { createStage, frameVehicle } from "../../vehicles3d/stage.js";
import { engineStart, engineStop, gunShot } from "../../vehicles3d/sound.js";
import { addonParent, moveAddon } from "../../vehicles3d/addons.js";
import { partLabel } from "../../vehicles3d/ballistics.js";
import { applyTweak, EMPTY_TWEAK, parentUnit, unitOf } from "../../vehicles3d/tweaks.js";
import { buildVehicle } from "../../vehicles3d/vehicle.js";

const UP = new THREE.Vector3(0, 1, 0);
const r2d = (r) => Math.round(((r * 180) / Math.PI) * 10) / 10;

/** Where a part would sit at a ray hit: which group it's on, local position and rotation (degrees). */
function placementAt(out, hit) {
  let on = "hull";
  for (let o = hit.object; o; o = o.parent) {
    if (o === out.gunPivot) on = "gun";
    else if (o === out.turret && on === "hull") on = "turret";
  }
  const parent = addonParent(out, on);
  parent.updateWorldMatrix(true, false);
  const pos = parent.worldToLocal(hit.point.clone());
  const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  const inv = new THREE.Quaternion().setFromRotationMatrix(parent.matrixWorld).invert();
  n.applyQuaternion(inv).normalize();
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, n));
  return { on, pos: [pos.x, pos.y, pos.z].map((v) => Math.round(v * 1000) / 1000), rot: [r2d(e.x), r2d(e.y), r2d(e.z)] };
}

/**
 * Interactive 3D view of a vehicle: orbit with the mouse, armour readout
 * under the cursor in the armour view, animations (and sounds) when playing.
 * `ref` exposes { capture(w, h), stage }.
 */
export function Viewer3D({ vehicle, view, playing, onArmorHover, env = "field", sun = null, fov = 32, sound = true, parts = null, ref }) {
  const host = useRef(null);
  const ctx = useRef(null);
  const [error, setError] = useState(null);

  useImperativeHandle(ref, () => ({
    capture: (w, h) => ctx.current?.stage.capture(w, h),
    /** Name of a movable part and the bigger part it belongs to. */
    unitInfo(key) {
      const u = ctx.current?.built?.out.units?.get(key);
      if (!u) return null;
      const p = parentUnit(u);
      return { label: u.userData.unit.label, parentKey: p?.userData.unit.key ?? null, parentLabel: p?.userData.unit.label ?? null };
    },
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

    // Parts: click to place, click a part to select it, drag it over the surface.
    const pick = (e, skipId) => {
      const c = ctx.current;
      if (!c?.built) return null;
      onMove(e);
      ray.setFromCamera(mouse, camera);
      return ray.intersectObject(c.built.root, true).find((h) => h.object.isMesh && h.object.visible && h.face && !h.object.userData.fxEdge && !h.object.userData.decal && (skipId ? h.object.userData.addonId !== skipId : true)) ?? null;
    };
    let drag = null;
    let down = null;
    const onDown = (e) => {
      const c = ctx.current;
      const p = c?.parts;
      down = { x: e.clientX, y: e.clientY };
      if (!p || e.button !== 0) return;
      const hit = pick(e);
      if (p.placing) {
        if (hit && !hit.object.userData.addonId) {
          down.handled = true;
          p.onPlace(placementAt(c.built.out, hit), e.shiftKey);
          e.stopImmediatePropagation();
        }
        return;
      }
      const id = hit?.object.userData.addonId;
      // The vehicle's own parts: drag the selected one (Shift: up and down).
      let unit = !id && hit ? unitOf(hit.object) : null;
      // Dragging anywhere inside the selected part moves it (e.g. the whole turret).
      const selected = p.selectedUnit && c.built.out.units?.get(p.selectedUnit);
      let inside = false;
      for (let o = hit?.object; o && selected; o = o.parent) if (o === selected) inside = true;
      if (inside && !id && p.onMoveUnit) {
        unit = selected;
        down.handled = true;
        const start = new THREE.Vector3().setFromMatrixPosition(unit.matrixWorld);
        const n = e.shiftKey ? camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize().negate() : new THREE.Vector3(0, 1, 0);
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, hit.point);
        const t0 = structuredClone(c.vehicle.tweaks?.[p.selectedUnit] ?? EMPTY_TWEAK());
        drag = { unit, plane, from: hit.point.clone(), t0, t: t0, start, moved: false };
        stage.controls.enabled = false;
        renderer.domElement.setPointerCapture(e.pointerId);
        e.stopImmediatePropagation();
        return;
      }
      if (unit && !id) down.unit = unit;
      if (id) {
        down.handled = true;
        p.onSelect(id);
        const a = c.vehicle.addons.find((x) => x.id === id);
        drag = { id, a: a && structuredClone(a), moved: false };
        stage.controls.enabled = false;
        renderer.domElement.setPointerCapture(e.pointerId);
        e.stopImmediatePropagation();
      }
    };
    const onDrag = (e) => {
      const c = ctx.current;
      if (drag?.unit && c?.built) {
        onMove(e);
        ray.setFromCamera(mouse, camera);
        const p = ray.ray.intersectPlane(drag.plane, new THREE.Vector3());
        if (!p) return;
        const parent = drag.unit.parent;
        const a = parent.worldToLocal(drag.from.clone());
        const b = parent.worldToLocal(p.clone());
        drag.t = { ...drag.t0, pos: drag.t0.pos.map((v, i) => Math.round((v + (b.getComponent(i) - a.getComponent(i))) * 1000) / 1000) };
        drag.moved = true;
        applyTweak(drag.unit, drag.t);
        c.outline?.update();
        stage.invalidate();
        return;
      }
      if (!drag?.a || !c?.built) return;
      const hit = pick(e, drag.id);
      if (!hit) return;
      const pl = placementAt(c.built.out, hit);
      // Moving onto another group (hull → turret) needs a rebuild; keep it on its group while dragging.
      if (pl.on !== drag.a.on) return;
      drag.a.pos = pl.pos;
      drag.a.rot = pl.rot;
      drag.moved = true;
      moveAddon(c.built.out, drag.a);
      c.outline?.update();
      stage.invalidate();
    };
    const onUp = (e) => {
      const c = ctx.current;
      if (drag?.unit) {
        stage.controls.enabled = true;
        if (drag.moved) c?.parts?.onMoveUnit(drag.unit.userData.unit.key, drag.t);
        drag = null;
      } else if (drag) {
        stage.controls.enabled = true;
        if (drag.moved) c?.parts?.onMove(drag.id, { pos: drag.a.pos, rot: drag.a.rot });
        drag = null;
      } else if (c?.parts?.onSelectUnit && down && !down.handled && !c.parts.placing && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 4) {
        // A plain click: select the part under the pointer (or nothing).
        c.parts.onSelect(null);
        const u = down.unit;
        const pu = u && parentUnit(u);
        c.parts.onSelectUnit(u ? u.userData.unit.key : null, u ? { label: u.userData.unit.label, parentKey: pu?.userData.unit.key ?? null, parentLabel: pu?.userData.unit.label ?? null } : null);
      } else if (c?.parts && down && !down.handled && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 4 && !c.parts.placing && !pick(e)?.object.userData.addonId) {
        c.parts.onSelect(null);
      }
      down = null;
    };
    // Capture phase, so a click on a part doesn't also start orbiting.
    renderer.domElement.addEventListener("pointerdown", onDown, true);
    renderer.domElement.addEventListener("pointermove", onDrag);
    renderer.domElement.addEventListener("pointerup", onUp);

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
      // X-ray: name whatever is under the cursor (crew, ammo, engine…).
      if (c.view === "xray" && hoverAt && frame++ % 4 === 0) {
        ray.setFromCamera(mouse, camera);
        const hit = ray.intersectObject(c.built.root, true).find((h) => h.object.visible && h.object.userData.part);
        c.onArmorHover?.(hit ? { xray: true, name: partLabel(hit.object.userData.part), x: hoverAt.x, y: hoverAt.y } : null);
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

    ctx.current = { stage, built: null, onArmorHover, view, playing, needsPose: true, vehicle, sound, parts };
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
      showSelection(c);
      c.needsPose = true;
      c.stage.invalidate();
    }, c.built ? 120 : 0);
    return () => clearTimeout(timer);
  }, [vehicle]);

  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    c.parts = parts;
    host.current.style.cursor = parts?.placing ? "crosshair" : "";
    showSelection(c);
  }, [parts]);

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

  function showSelection(c) {
    if (c.outline) {
      c.stage.scene.remove(c.outline);
      c.outline.dispose();
      c.outline = null;
    }
    const list = c.parts?.selectedId && c.built?.out.addons?.get(c.parts.selectedId);
    const unit = c.parts?.selectedUnit && c.built?.out.units?.get(c.parts.selectedUnit);
    const target = list?.[0] ?? unit;
    if (target) {
      c.outline = new THREE.BoxHelper(target, unit && !list ? 0x38bdf8 : 0xfacc15);
      c.outline.material.depthTest = false;
      c.outline.renderOrder = 20;
      c.stage.scene.add(c.outline);
    }
    c.stage.invalidate();
  }

  if (error) return <div className="grid h-full place-items-center text-[13px] text-muted">{error}</div>;
  return <div ref={host} className="relative h-full w-full" data-testid="viewer3d" />;
}
