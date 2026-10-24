import { describe, expect, it } from "vitest";
import {
  applyStarterLook,
  createDefaultDesign,
  parseDesignFile,
  randomDesign,
  sanitizeDesign,
  serializeDesign,
  STARTER_LOOKS,
} from "../design.js";

const withoutIds = (d) => ({ ...d, aura: { ...d.aura, points: d.aura.points.map(({ id, ...p }) => p) } });

describe(".auradrop files", () => {
  it("round-trips a design", () => {
    const design = createDefaultDesign();
    expect(withoutIds(parseDesignFile(serializeDesign(design)))).toEqual(withoutIds(design));
  });

  it("rejects files from other apps and newer versions", () => {
    expect(() => parseDesignFile("not json")).toThrow(/valid/);
    expect(() => parseDesignFile(JSON.stringify({ app: "other", design: {} }))).toThrow(/isn't an AuraDrop/);
    expect(() => parseDesignFile(JSON.stringify({ app: "auradrop", version: 99, design: {} }))).toThrow(/newer/);
  });

  it("clamps and repairs hand-edited values", () => {
    const d = sanitizeDesign({
      frost: 999,
      radius: -5,
      aura: { blend: "bogus", points: [{ color: "#ff0000", x: 500, y: 10 }] },
      content: { title: 42, background: "javascript:alert(1)" },
    });
    expect(d.frost).toBe(40);
    expect(d.radius).toBe(4);
    expect(d.aura.blend).toBe("screen");
    // Fewer than two valid points falls back to the defaults.
    expect(d.aura.points).toHaveLength(3);
    expect(d.content.title).toBe("Hello, Aura");
    expect(d.content.background).toBeNull();
  });

  it("starter looks and Surprise me stay within limits", () => {
    for (const look of STARTER_LOOKS) {
      const d = applyStarterLook(createDefaultDesign(), look);
      expect(sanitizeDesign(d).frost).toBe(d.frost);
    }
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 50; i++) {
      const d = randomDesign(createDefaultDesign(), rand);
      const s = sanitizeDesign(d);
      expect(withoutIds(s)).toEqual(withoutIds(d));
    }
  });
});
