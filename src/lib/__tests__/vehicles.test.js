import { describe, expect, it } from "vitest";
import { createVehicle, crewOf, sanitizeVehicle, setPath } from "../../vehicles3d/spec.js";
import { brStep, computeStats, penetration } from "../../vehicles3d/stats.js";
import { CARS, PLANES, TANKS } from "../../vehicles3d/presets.js";
import { createProject, parseProjectFile, serializeProject, makeFromTemplate } from "../project.js";

describe("3D vehicles", () => {
  it("has eighteen tank presets with plausible battle ratings", () => {
    expect(TANKS).toHaveLength(18);
    const br = Object.fromEntries(TANKS.map((t) => [t.preset, computeStats(t).br]));
    expect(br.tiger1).toBe(6.7);
    expect(br.sherman).toBeLessThan(br.tiger1);
    expect(br.abrams).toBeGreaterThan(9);
    expect(br.kingtiger).toBeGreaterThan(br.tiger1);
    expect(br.t54).toBeGreaterThan(br.is2);
  });

  it("has plane and car presets with sensible stats", () => {
    expect(PLANES.length).toBeGreaterThanOrEqual(8);
    expect(CARS.length).toBeGreaterThanOrEqual(6);
    const speed = (v) => computeStats(v).rows.find((r) => r.key === "speed").value;
    const p = Object.fromEntries(PLANES.map((v) => [v.preset, v]));
    expect(speed(p.mig15)).toBeGreaterThan(speed(p.p51d));
    expect(speed(p.p51d)).toBeGreaterThan(speed(p.stuka));
    expect(computeStats(p.spitfire9).br).toBeGreaterThan(1);
    const c = Object.fromEntries(CARS.map((v) => [v.preset, v]));
    expect(speed(c.hyper)).toBeGreaterThan(speed(c.jeep));
    for (const v of [...PLANES, ...CARS]) for (const r of computeStats(v).rows) expect(Number.isFinite(r.value)).toBe(true);
  });

  it("keeps a valid custom crew and part moves", () => {
    const v = createVehicle("tank");
    expect(crewOf(v.spec)).toHaveLength(5);
    const crew = Array.from({ length: 12 }, (_, i) => ({ id: `m${i}`, role: i ? "loader" : "astronaut", name: "x".repeat(40), height: i % 2 ? 230 : 120 }));
    const s = sanitizeVehicle({ ...v, spec: { ...v.spec, crew }, tweaks: { turret: { pos: [99, 0, 0], rot: [0, 0, 0], scale: 9, hidden: true }, bad: null } });
    expect(s.spec.crew).toHaveLength(8);
    expect(s.spec.crew[0].role).toBe("loader");
    expect(s.spec.crew.every((m) => m.height >= 150 && m.height <= 200 && m.name.length <= 24)).toBe(true);
    expect(s.tweaks.turret).toEqual({ pos: [10, 0, 0], rot: [0, 0, 0], scale: 5, hidden: true });
    expect(s.tweaks.bad).toBeUndefined();
    // Fewer loaders: slower reload.
    const noLoader = { ...v, spec: { ...v.spec, crew: crewOf(v.spec).filter((m) => m.role !== "loader") } };
    const reload = (x) => computeStats(x).rows.find((r) => r.key === "reload").value;
    expect(reload(noLoader)).toBeGreaterThan(reload(v));
  });

  it("matches published penetration roughly", () => {
    expect(Math.round(penetration(88, 56, "APCBC"))).toBeGreaterThan(150);
    expect(Math.round(penetration(75, 40, "APCBC"))).toBeLessThan(110);
    expect(brStep(6.6)).toBe(6.7);
    expect(brStep(4.1)).toBe(4);
  });

  it("thicker armour makes a tank heavier and slower", () => {
    const v = createVehicle("tank");
    const heavy = { ...v, spec: setPath(v.spec, "hull.side", 180) };
    const a = computeStats(v);
    const b = computeStats(heavy);
    expect(b.mass).toBeGreaterThan(a.mass);
    expect(b.rows.find((r) => r.key === "speed").value).toBeLessThan(a.rows.find((r) => r.key === "speed").value);
  });

  it("sanitizes untrusted vehicles", () => {
    const v = sanitizeVehicle({ kind: "tank", name: 5, spec: { hull: { length: 999, style: "nope" }, gun: { caliber: "x" } }, addons: [{ type: "evil" }] });
    expect(v.spec.hull.length).toBe(10);
    expect(v.spec.hull.style).toBe("boxy");
    expect(v.spec.gun.caliber).toBe(88);
    expect(v.addons).toEqual([]);
  });

  it("round-trips a project with a vehicle, groups and guides", () => {
    const p = makeFromTemplate("versus");
    p.pages[0].elements[0].group = "g1";
    p.pages[0].elements[1].group = "g1";
    p.pages[0].guides = { x: [100], y: [] };
    const back = parseProjectFile(serializeProject(p));
    const el = back.pages[0].elements[0];
    expect(el.type).toBe("vehicle");
    expect(el.vehicle.spec.hull.length).toBeCloseTo(p.pages[0].elements[0].vehicle.spec.hull.length);
    expect(el.group).toBe("g1");
    expect(back.pages[0].guides.x).toEqual([100]);
    const btn = back.pages[0].elements.find((e) => e.type === "button");
    expect(btn.actions[0]).toMatchObject({ type: "view", view: "cycle", target: el.id });
    expect(createProject().pages[0].guides).toEqual({ x: [], y: [] });
  });
});
