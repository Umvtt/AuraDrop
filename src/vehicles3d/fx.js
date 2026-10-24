// Small particle effects for the arena: muzzle flashes, tracers, sparks,
// smoke and fire. Each effect updates itself and says when it's finished.
import * as THREE from "three";

let glowTex = null;
let smokeTex = null;

function radial(stops) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  stops.forEach(([o, col]) => grd.addColorStop(o, col));
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const glow = () => (glowTex ??= radial([[0, "rgba(255,255,255,1)"], [0.25, "rgba(255,230,160,.9)"], [0.6, "rgba(255,140,40,.35)"], [1, "rgba(255,80,0,0)"]]));
const puff = () => (smokeTex ??= radial([[0, "rgba(255,255,255,.75)"], [0.5, "rgba(255,255,255,.35)"], [1, "rgba(255,255,255,0)"]]));

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  get busy() {
    return this.list.length > 0;
  }

  add(obj, update) {
    this.scene.add(obj);
    this.list.push({ obj, update, t: 0 });
  }

  update(dt) {
    this.list = this.list.filter((e) => {
      e.t += dt;
      const alive = e.update(e.t, dt, e.obj);
      if (!alive) {
        this.scene.remove(e.obj);
        e.obj.traverse((o) => {
          // Materials only: the shared glow/smoke textures stay.
          o.geometry?.dispose();
          o.material?.dispose?.();
        });
      }
      return alive;
    });
  }

  clear() {
    for (const e of this.list) this.scene.remove(e.obj);
    this.list = [];
  }

  sprite(map, color, additive, opacity = 1) {
    return new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
  }

  /** A bright flash with a light, e.g. at the muzzle or on impact. */
  flash(pos, { size = 1.6, life = 0.12, color = 0xffd27a } = {}) {
    const g = new THREE.Group();
    g.position.copy(pos);
    const s = this.sprite(glow(), color, true);
    s.scale.setScalar(size);
    const l = new THREE.PointLight(color, 40, 12, 2);
    g.add(s, l);
    this.add(g, (t) => {
      const k = Math.max(0, 1 - t / life);
      s.material.opacity = k;
      s.scale.setScalar(size * (0.7 + 0.5 * (1 - k)));
      l.intensity = 40 * k;
      return t < life;
    });
  }

  /** A glowing shell flying from a to b over `time` seconds. */
  tracer(a, b, time, onArrive) {
    const dir = b.clone().sub(a);
    const len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xffcf6b, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const streak = Math.min(2.4, len * 0.35);
    m.scale.y = streak;
    let done = false;
    this.add(m, (t) => {
      const k = Math.min(1, t / time);
      m.position.copy(a).addScaledVector(dir, k).addScaledVector(dir, -(streak / len) * 0.5 * k);
      if (k >= 1 && !done) {
        done = true;
        onArrive?.();
      }
      return k < 1;
    });
  }

  /** Sparks bouncing off armour. */
  sparks(pos, normal, { count = 26, speed = 5, color = 0xffc46b } = {}) {
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    const v = [];
    for (let i = 0; i < count; i++) {
      p.set([pos.x, pos.y, pos.z], i * 3);
      const d = normal.clone().add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).multiplyScalar(1.6)).normalize();
      v.push(d.multiplyScalar(speed * (0.4 + Math.random())));
    }
    geo.setAttribute("position", new THREE.BufferAttribute(p, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.07, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.add(pts, (t, dt) => {
      const a = geo.attributes.position;
      for (let i = 0; i < count; i++) {
        v[i].y -= 9.8 * dt;
        a.setXYZ(i, a.getX(i) + v[i].x * dt, Math.max(0.02, a.getY(i) + v[i].y * dt), a.getZ(i) + v[i].z * dt);
      }
      a.needsUpdate = true;
      pts.material.opacity = Math.max(0, 1 - t / 0.7);
      return t < 0.7;
    });
  }

  /** A puff of smoke (dark for explosions, light for dust). */
  smoke(pos, { size = 1.2, life = 2.2, color = 0x3a3a3a, rise = 0.6, drift = null, opacity = 0.7 } = {}) {
    const s = this.sprite(puff(), color, false, opacity);
    s.position.copy(pos);
    const d = drift ?? new THREE.Vector3((Math.random() - 0.5) * 0.4, rise, (Math.random() - 0.5) * 0.4);
    this.add(s, (t, dt) => {
      const k = t / life;
      s.position.addScaledVector(d, dt);
      s.scale.setScalar(size * (0.6 + k * 1.8));
      s.material.opacity = opacity * Math.max(0, 1 - k) * Math.min(1, t * 6);
      return k < 1;
    });
  }

  /** A fireball: flash, flames and a smoke column. */
  explosion(pos, { big = false } = {}) {
    this.flash(pos, { size: big ? 7 : 3.5, life: big ? 0.45 : 0.25, color: 0xff9a3c });
    for (let i = 0; i < (big ? 14 : 6); i++) {
      const p = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, Math.random() * 0.8, (Math.random() - 0.5) * 1.2));
      this.smoke(p, { size: big ? 2.6 : 1.6, life: 2.5 + Math.random() * 2, color: i % 3 ? 0x2b2b2b : 0x4a4038, rise: 0.8 + Math.random() });
    }
    this.sparks(pos, new THREE.Vector3(0, 1, 0), { count: big ? 60 : 24, speed: big ? 9 : 5, color: 0xff8a3c });
  }

  /** Keep a vehicle burning: flames and smoke until `until()` says stop. */
  burn(pos, until) {
    const g = new THREE.Group();
    g.position.copy(pos);
    const flames = Array.from({ length: 5 }, () => {
      const s = this.sprite(glow(), 0xff7a2a, true, 0.8);
      g.add(s);
      return s;
    });
    const light = new THREE.PointLight(0xff7a2a, 8, 8, 2);
    light.position.y = 0.5;
    g.add(light);
    let next = 0;
    this.add(g, (t) => {
      flames.forEach((s, i) => {
        const f = Math.sin(t * 11 + i * 2.1) * 0.5 + 0.5;
        s.position.set(Math.sin(i * 1.7) * 0.35, 0.25 + f * 0.4 + i * 0.08, Math.cos(i * 2.3) * 0.3);
        s.scale.setScalar(0.7 + f * 0.6);
      });
      light.intensity = 6 + Math.sin(t * 17) * 2;
      if (t > next) {
        next = t + 0.18;
        this.smoke(pos.clone().add(new THREE.Vector3(0, 0.8, 0)), { size: 1.4, life: 4, color: 0x262626, rise: 1.1, opacity: 0.6 });
      }
      return !until();
    });
  }
}
