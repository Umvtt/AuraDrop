import { describe, expect, it } from "vitest";
import { gradientLine, safeLink, shapePath, textShadow } from "../../player/player.js";
import { inlinePlayerSource } from "../exportHtml.js";
import { SHAPES } from "../project.js";

describe("player helpers", () => {
  it("draws every shape as a closed path inside its box", () => {
    for (const s of SHAPES) {
      const d = shapePath(s, 200, 100, 20, 2);
      expect(d, s).toMatch(/^M/);
      expect(d.trim().endsWith("Z"), s).toBe(true);
      const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
      expect(Math.max(...nums), s).toBeLessThanOrEqual(200);
    }
  });

  it("points gradients like CSS", () => {
    const [x1, y1, x2, y2] = gradientLine(90, 100, 50); // left to right
    expect([x1, y1, x2, y2].map(Math.round)).toEqual([0, 25, 100, 25]);
  });

  it("builds meme outlines", () => {
    expect(textShadow({ stroke: { width: 0 }, shadow: { on: false } })).toBe("none");
    expect(textShadow({ stroke: { width: 4, color: "#000000" }, shadow: { on: false } }).split(",").length).toBeGreaterThanOrEqual(16);
  });

  it("refuses unsafe links", () => {
    expect(safeLink("javascript:alert(1)")).toBeNull();
    expect(safeLink("https://ok.com")).toBe("https://ok.com/");
  });

  it("inlines as a plain script for web page exports", () => {
    const src = inlinePlayerSource();
    expect(src).toContain("function createPlayer(");
    expect(src).not.toMatch(/^\s*(export|import)\s/m);
    // It must run without a module system.
    expect(new Function(`${src}; return typeof createPlayer;`)()).toBe("function");
  });
});
