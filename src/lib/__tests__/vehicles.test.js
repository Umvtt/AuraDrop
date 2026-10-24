import { describe, expect, it } from "vitest";
import { createVehicle, sanitizeVehicle, setPath } from "../../vehicles3d/spec.js";
import { brStep, computeStats, penetration } from "../../vehicles3d/stats.js";
import { TANKS } from "../../vehicles3d/presets.js";
import { createProject, parseProjectFile, serializeProject, makeFromTemplate } from "../project.js";

describe("3D vehicles", () => {
  it("has twelve tank presets with plausible battle ratings", () => {
    expect(TANKS).toHaveLength(12);
    const br = Object.fromEntries(TANKS.map((t) => [t.preset, computeStats(t).br]));
    expect(br.tiger1).toBe(6.7);
    expect(br.sherman).toBeLessThan(br.tiger1);
    expect(br.abrams).toBeGreaterThan(9);
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
