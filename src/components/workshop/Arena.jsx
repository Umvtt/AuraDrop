import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { aimPoint, freshState, SHELLS, shoot } from "../../vehicles3d/ballistics.js";
import { Effects } from "../../vehicles3d/fx.js";
import { explosion, gunShot, impact, ricochet } from "../../vehicles3d/sound.js";
import { createStage, frameVehicle } from "../../vehicles3d/stage.js";
import { computeStats } from "../../vehicles3d/stats.js";
import { buildVehicle } from "../../vehicles3d/vehicle.js";

const TRAVERSE = (24 * Math.PI) / 180; // turret turn rate, rad/s
const SPEED = { AP: 790, APHE: 780, APCBC: 800, APDS: 1200, APFSDS: 1650, HEAT: 900, HE: 700 };
const reloadOf = (v) => computeStats(v).rows.find((r) => r.key === "reload")?.value ?? 7;

/** Snapshot of how a vehicle stands, for the hit camera. */
function poseOf(b) {
  b.root.updateMatrixWorld(true);
  return { matrix: b.root.matrixWorld.toArray(), turretYaw: b.out.turret?.rotation.y ?? 0, gunElev: b.out.gunPivot?.rotation.z ?? 0 };
}

/** Darken a knocked-out vehicle: everything goes sooty. */
function scorch(b) {
  const done = new Set();
  b.root.traverse((o) => {
    const m = o.material;
    if (!o.isMesh || !m?.color || done.has(m) || o.userData.interior) return;
    done.add(m);
    m.color.multiplyScalar(0.35);
  });
}

/**
 * The arena. mode "test": click on the vehicle to fire `weapon` at it.
 * mode "duel": `vehicle` and `opponent` face off and fire until one is
 * knocked out; a new `fight` number starts a new round.
 */
export function Arena({ mode, vehicle, opponent, weapon, distance, fight, speed = 1, sound, env = "field", onShot, onEnd, onState }) {
  const host = useRef(null);
  const ctx = useRef(null);
  const [error, setError] = useState(null);
  const props = useRef();
  props.current = { weapon, distance, speed, sound, onShot, onEnd, onState, vehicle, opponent };

  // One stage for the arena's lifetime.
  useEffect(() => {
    let stage;
    try {
      stage = createStage(host.current, { shadowExtent: 26, groundSize: 160, shadowSize: 2048 });
    } catch {
      setError("3D isn't available on this PC (WebGL is turned off).");
      return;
    }
    const fx = new Effects(stage.scene);
    const c = { stage, fx, tanks: [], running: false };
    ctx.current = c;
    stage.frame((dt) => tick(c, dt * (props.current.speed ?? 1)));
    const onClick = (e) => {
      if (!c.testMode || !c.tanks[0]) return;
      const r = stage.renderer.domElement.getBoundingClientRect();
      const m = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(m, stage.camera);
      testShot(c, ray.ray.origin, ray.ray.direction);
    };
    // A click (not a drag) fires.
    let down = null;
    const onDown = (e) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) onClick(e);
      down = null;
    };
    stage.renderer.domElement.addEventListener("pointerdown", onDown);
    stage.renderer.domElement.addEventListener("pointerup", onUp);
    return () => {
      fx.clear();
      for (const t of c.tanks) t.built.dispose();
      stage.dispose();
      ctx.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    ctx.current?.stage.setEnv(env);
  }, [env]);

  // (Re)build the scene for the mode / vehicles / round.
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    c.fx.clear();
    for (const t of c.tanks) {
      c.stage.scene.remove(t.built.root);
      t.built.dispose();
    }
    c.tanks = [];
    c.testMode = mode === "test";
    c.running = false;
    c.shots = 0;
    if (mode === "test") {
      const b = buildVehicle(vehicle);
      c.stage.scene.add(b.root);
      b.update(0.0001, 0, c.stage.camera.position);
      c.tanks = [{ id: "you", built: b, vehicle, state: freshState(b) }];
      frameVehicle(c.stage, b.size, b.center, new THREE.Vector3(0.9, 0.25, 0.45));
      props.current.onState?.({ you: c.tanks[0].state });
      return;
    }
    // Duel: face to face along x, a gap that grows with the distance setting.
    const gap = Math.min(42, 14 + props.current.distance / 90);
    const mk = (v, id, x, flip) => {
      const b = buildVehicle(v);
      b.root.position.set(x, 0, flip ? 0.6 : -0.6);
      b.root.rotation.y = flip ? Math.PI : 0;
      c.stage.scene.add(b.root);
      b.update(0.0001, 0, c.stage.camera.position);
      return { id, built: b, vehicle: v, state: freshState(b), reload: reloadOf(v), cool: 1 + Math.random() * 1.2, alive: true, dead: false };
    };
    c.tanks = [mk(vehicle, "A", -gap / 2 - (vehicle.spec.hull?.length ?? 6) * 0.1, false), mk(opponent, "B", gap / 2, true)];
    c.tanks[0].enemy = c.tanks[1];
    c.tanks[1].enemy = c.tanks[0];
    // Frame both vehicles from the side, slightly behind yours.
    const cam = c.stage.camera;
    const span = gap + (vehicle.spec.hull?.length ?? 6) + (opponent.spec.hull?.length ?? 6) + 4;
    const dist = span / 2 / (Math.tan((cam.fov * Math.PI) / 360) * Math.max(0.6, cam.aspect));
    c.stage.controls.target.set(0, 1.2, 0);
    cam.position.set(-span * 0.1, dist * 0.24 + 2, dist * 0.8);
    c.stage.controls.update();
    c.stage.invalidate();
    props.current.onState?.({ A: c.tanks[0].state, B: c.tanks[1].state });
    c.running = fight > 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, vehicle, opponent, fight]);

  // Distance changes in a duel take effect next round; in the test only penetration changes.

  function testShot(c, origin, dir) {
    const p = props.current;
    const t = c.tanks[0];
    const result = shoot(t.built, t.state, { origin, dir, gun: p.weapon, distance: p.distance });
    const deadBefore = Object.entries(t.state.crew).filter(([, a]) => !a).map(([r]) => r);
    const entry = { id: Date.now() + Math.random(), shooter: "you", targetId: "you", vehicle: t.vehicle, pose: poseOf(t.built), result, deadCrew: deadBefore.filter((r) => !result.damaged.some((d) => d.part.role === r)) };
    if (p.sound) gunShot(p.weapon.caliber, { distance: p.distance });
    landEffects(c, t, result, 0);
    p.onShot?.(entry);
    p.onState?.({ you: t.state });
  }

  function landEffects(c, target, result, delay) {
    const p = props.current;
    const at = result.point ?? result.end;
    if (result.outcome === "miss") {
      c.fx.smoke(new THREE.Vector3(at.x, 0.1, at.z), { color: 0x8a7a60, size: 1.4, life: 1.6, rise: 0.4 });
      return;
    }
    if (result.outcome === "ricochet") {
      c.fx.sparks(at, result.normal, { count: 34, speed: 6 });
      if (result.bounce) c.fx.tracer(result.bounce[0], result.bounce[1], 0.25);
      if (p.sound) ricochet({ at: delay });
    } else if (result.outcome === "nonpen") {
      c.fx.sparks(at, result.normal, { count: 40, speed: 4 });
      c.fx.flash(at, { size: 1.2, life: 0.1 });
      if (p.sound) impact(false, { at: delay });
    } else {
      c.fx.flash(at, { size: 1.8, life: 0.18, color: 0xffa34a });
      c.fx.sparks(at, result.normal, { count: 20, speed: 3 });
      c.fx.smoke(at, { size: 0.8, life: 1.4, color: 0x555555 });
      if (p.sound) impact(true, { at: delay });
    }
    if (result.destroyed && !target.dead) {
      target.dead = true;
      target.alive = false;
      const box = new THREE.Box3().setFromObject(target.built.out.hull ?? target.built.root);
      const center = box.getCenter(new THREE.Vector3());
      center.y = box.max.y;
      const big = result.killedBy === "ammo";
      c.fx.explosion(center, { big });
      if (p.sound) explosion({ big, at: delay + 0.05 });
      scorch(target.built);
      c.fx.burn(center, () => !ctx.current || !c.tanks.includes(target));
    } else if (target.state.fire && !target.burning) {
      target.burning = true;
      const box = new THREE.Box3().setFromObject(target.built.out.hull ?? target.built.root);
      const center = box.getCenter(new THREE.Vector3());
      center.y = box.max.y;
      c.fx.burn(center, () => !ctx.current || !c.tanks.includes(target) || target.dead);
    }
  }

  function fire(c, t) {
    const p = props.current;
    const enemy = t.enemy;
    const muzzle = t.built.out.muzzle.getWorldPosition(new THREE.Vector3());
    const spread = 0.1 + (p.distance / 1000) * 0.35;
    const aim = aimPoint(enemy.built, muzzle, spread);
    const dir = aim.clone().sub(muzzle).normalize();
    const deadBefore = Object.entries(enemy.state.crew).filter(([, a]) => !a).map(([r]) => r);
    const pose = poseOf(enemy.built);
    const result = shoot(enemy.built, enemy.state, { origin: muzzle, dir, gun: t.vehicle.spec.gun, distance: p.distance });
    c.shots++;
    // Muzzle flash, recoil, dust, then the shell's flight.
    c.fx.flash(muzzle.clone().addScaledVector(dir, 0.4), { size: 2.4, life: 0.12 });
    c.fx.smoke(muzzle.clone().addScaledVector(dir, 0.8), { size: 1.6, life: 1.6, color: 0x9a948a, rise: 0.3, opacity: 0.55 });
    t.kick = 1;
    if (p.sound) gunShot(t.vehicle.spec.gun.caliber, { distance: t.id === "A" ? 60 : p.distance });
    const flight = Math.max(0.12, Math.min(1.6, p.distance / (SPEED[t.vehicle.spec.gun.shell] ?? 800)));
    const at = result.point ?? result.end;
    c.fx.tracer(muzzle, at, flight, () => {
      landEffects(c, enemy, result, 0);
      p.onShot?.({ id: Date.now() + Math.random(), shooter: t.id, targetId: enemy.id, vehicle: enemy.vehicle, pose, result, deadCrew: deadBefore });
      p.onState?.({ A: c.tanks[0].state, B: c.tanks[1].state });
      if (enemy.dead && c.running) {
        c.running = false;
        setTimeout(() => props.current.onEnd?.({ winner: t.id, reason: result.killedBy }), 1200);
      }
    });
    // Reload: slower when the loader is out.
    const loaderOut = t.state.crew.loader === false;
    t.cool = t.reload * (loaderOut ? 1.6 : 1) * (0.92 + Math.random() * 0.16);
  }

  function tick(c, dt) {
    c.fx.update(dt);
    let busy = c.fx.busy;
    for (const t of c.tanks) {
      if (t.kick) {
        t.kick = Math.max(0, t.kick - dt * 3);
        t.built.out.barrel.position.x = -t.kick * Math.min(0.5, t.vehicle.spec.gun.caliber / 250);
        busy = true;
      }
    }
    if (!c.running || c.testMode) return busy;
    for (const t of c.tanks) {
      if (!t.alive) continue;
      const crewLeft = Object.values(t.state.crew).filter(Boolean).length;
      if (crewLeft < 2) continue;
      // Turn the turret onto the enemy.
      const enemy = t.enemy;
      const target = enemy.built.root.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      let aimed = true;
      if (t.built.out.turret && t.vehicle.spec.turret.style !== "none") {
        const local = t.built.root.worldToLocal(target.clone());
        const tp = t.built.out.turret.position;
        const want = Math.atan2(-(local.z - tp.z), local.x - tp.x);
        const cur = t.built.out.turret.rotation.y;
        const diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
        const step = Math.sign(diff) * Math.min(Math.abs(diff), TRAVERSE * dt);
        t.built.out.turret.rotation.y = cur + step;
        aimed = Math.abs(diff) < 0.03;
      }
      t.cool -= dt;
      if (t.cool <= 0 && aimed && enemy.alive) fire(c, t);
      busy = true;
    }
    // Nobody can win (both out of crew or a long stalemate): call it a draw.
    if (c.running && (c.shots > 60 || c.tanks.every((t) => Object.values(t.state.crew).filter(Boolean).length < 2))) {
      c.running = false;
      setTimeout(() => props.current.onEnd?.({ winner: null }), 800);
    }
    return busy;
  }

  if (error) return <div className="grid h-full place-items-center text-[13px] text-muted">{error}</div>;
  return <div ref={host} className={`relative h-full w-full ${mode === "test" ? "cursor-crosshair" : ""}`} data-testid="arena" />;
}

export const SHELL_OPTIONS = Object.keys(SHELLS);
