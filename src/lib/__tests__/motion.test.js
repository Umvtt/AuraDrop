import { describe, expect, it } from "vitest";
import { describeChange } from "../describe.js";
import { animAt, bezier, driftAt, suggestedLength } from "../motion.js";
import { createElement, createProject } from "../project.js";

describe("motion", () => {
  it("bezier matches the end points and is monotonic for ease-in-out", () => {
    const e = bezier(0.42, 0, 0.58, 1);
    expect(e(0)).toBe(0);
    expect(e(1)).toBe(1);
    expect(e(0.5)).toBeCloseTo(0.5, 3);
    expect(e(0.25)).toBeLessThan(e(0.5));
  });

  it("float peaks half way and loops", () => {
    const a = { type: "float", speed: 1, delay: 0 };
    expect(animAt(a, 0).ty).toBeCloseTo(0);
    expect(animAt(a, 1.7).ty).toBeCloseTo(-0.06, 3);
    expect(animAt(a, 3.4).ty).toBeCloseTo(0, 3);
  });

  it("one-shot animations hold their first frame during the delay and end at rest", () => {
    const a = { type: "pop", speed: 1, delay: 1 };
    expect(animAt(a, 0.5).o).toBe(0);
    expect(animAt(a, 5).s).toBeCloseTo(1);
    expect(animAt(a, 5).o).toBe(1);
  });

  it("no animation and still frames are the identity", () => {
    expect(animAt({ type: "none" }, 2)).toEqual({ tx: 0, ty: 0, s: 1, r: 0, o: 1 });
    expect(animAt({ type: "spin", speed: 1, delay: 0 }, null).r).toBe(0);
    expect(driftAt(0, 1, null).s).toBe(1);
  });

  it("suggests a length that fits the page's animations", () => {
    const p = createProject();
    expect(suggestedLength(p.pages[0])).toBe(3);
    p.pages[0].elements.push(createElement("text", p.canvas, { anim: { type: "float", speed: 0.5, delay: 0 } }));
    expect(suggestedLength(p.pages[0])).toBe(14);
  });
});

describe("history labels", () => {
  const base = () => {
    const p = createProject();
    p.pages[0].elements.push(createElement("text", p.canvas, { name: "Title" }));
    return p;
  };
  const withEl = (p, fn) => ({ ...p, pages: [{ ...p.pages[0], elements: p.pages[0].elements.map(fn) }] });

  it("names adds, deletes, moves and restyles", () => {
    const a = base();
    expect(describeChange(null, a)).toBe("Opened");
    const added = { ...a, pages: [{ ...a.pages[0], elements: [...a.pages[0].elements, createElement("sticker", a.canvas, { name: "Sticker" })] }] };
    expect(describeChange(a, added)).toBe("Added Sticker");
    expect(describeChange(added, a)).toBe("Deleted Sticker");
    expect(describeChange(a, withEl(a, (e) => ({ ...e, x: e.x + 10 })))).toBe("Moved Title");
    expect(describeChange(a, withEl(a, (e) => ({ ...e, x: 1, w: 50 })))).toBe("Resized Title");
    expect(describeChange(a, withEl(a, (e) => ({ ...e, color: "#ff0000", font: "Anton" })))).toBe("Restyled Title");
    expect(describeChange(a, { ...a, pages: [{ ...a.pages[0], bg: { ...a.pages[0].bg, color: "#000" } }] })).toBe("Changed the background");
  });
});
