import { describe, expect, it } from "vitest";
import { computeTilt, glareAngle, isSettled, springStep } from "../tilt.js";

const rect = { left: 100, top: 100, width: 200, height: 100 };

describe("tilt physics", () => {
  it("is flat at the centre", () => {
    const t = computeTilt(200, 150, rect, 15);
    expect(t.rx).toBeCloseTo(0);
    expect(t.ry).toBeCloseTo(0);
    expect(t.intensity).toBe(0);
  });

  it("leans toward the cursor and clamps at max", () => {
    const right = computeTilt(300, 150, rect, 15);
    expect(right.ry).toBe(15);
    expect(right.gx).toBe(100);
    const farTop = computeTilt(200, -5000, rect, 15);
    expect(farTop.rx).toBe(15);
  });

  it("points the glare at the cursor", () => {
    expect(glareAngle(100, 50)).toBeCloseTo(90); // right
    expect(glareAngle(50, 0)).toBeCloseTo(0); // up
  });

  it("springs settle on the target", () => {
    let s = { value: 15, velocity: 0 };
    let overshoot = false;
    for (let i = 0; i < 240; i++) {
      s = springStep(s, 0, 1 / 60, 120, 11);
      if (s.value < 0) overshoot = true;
    }
    expect(overshoot).toBe(true);
    expect(isSettled(s, 0, 0.05)).toBe(true);
  });
});
