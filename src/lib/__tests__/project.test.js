import { describe, expect, it } from "vitest";
import {
  TEMPLATES,
  createElement,
  createProject,
  duplicatePage,
  makeFromTemplate,
  migrateV1,
  parseProjectFile,
  pruneAssets,
  safeUrl,
  sanitizeProject,
  serializeProject,
} from "../project.js";

describe("projects", () => {
  it("round-trips through a .auradrop file", () => {
    const p = makeFromTemplate("quiz");
    expect(parseProjectFile(serializeProject(p))).toEqual(p);
  });

  it("every template is valid as-is", () => {
    for (const t of TEMPLATES) {
      const p = makeFromTemplate(t.id);
      expect(sanitizeProject(structuredClone(p)), t.id).toEqual(p);
    }
  });

  it("rejects other files and newer versions", () => {
    expect(() => parseProjectFile("nope")).toThrow(/valid/);
    expect(() => parseProjectFile(JSON.stringify({ app: "x" }))).toThrow(/isn't an AuraDrop/);
    expect(() => parseProjectFile(JSON.stringify({ app: "auradrop", version: 99, project: {} }))).toThrow(/newer/);
  });

  it("cleans hostile or broken files", () => {
    const p = sanitizeProject({
      canvas: { w: 999999, h: -5 },
      pages: [
        {
          id: "p1",
          elements: [
            { type: "text", id: "a", text: 5, size: 99999, color: "red", actions: [{ type: "link", url: "javascript:alert(1)" }, { type: "evil" }] },
            { type: "script", id: "b" },
            { type: "image", id: "a", asset: "missing" },
            { type: "button", id: "c", actions: [{ type: "page", target: "nowhere" }, { type: "sound", asset: "img" }] },
          ],
        },
      ],
      assets: {
        img: { data: "data:image/png;base64,AAAA" },
        bad: { data: "javascript:1" },
        "../x": { data: "data:image/png;base64,AA" },
      },
    });
    expect(p.canvas).toEqual({ w: 4000, h: 200 });
    const [text, image, button] = p.pages[0].elements;
    expect(p.pages[0].elements).toHaveLength(3); // unknown type dropped
    expect(text.size).toBe(800);
    expect(text.color).toBe("#ffffff");
    expect(text.actions).toHaveLength(1); // unknown action dropped
    expect(safeUrl(text.actions[0].url)).toBeNull(); // kept as text, never opened
    expect(image.id).not.toBe("a"); // duplicate ids regenerated
    expect(image.asset).toBeNull();
    expect(button.actions[0].target).toBe("next");
    expect(button.actions[1].asset).toBeNull(); // an image can't be a sound
    expect(Object.keys(p.assets)).toEqual(["img"]);
  });

  it("only opens web and mail links", () => {
    expect(safeUrl("https://example.com")).toBe("https://example.com/");
    expect(safeUrl(" mailto:me@x.com ")).toBe("mailto:me@x.com");
    for (const bad of ["javascript:alert(1)", "file:///C:/Windows", "data:text/html,hi", "example.com", ""]) {
      expect(safeUrl(bad), bad).toBeNull();
    }
  });

  it("migrates the original single-card files", () => {
    const p = sanitizeProject(
      migrateV1({
        frost: 30,
        content: { title: "Hi", emoji: "🎈", button: "Go", avatar: "data:image/png;base64,AA" },
        aura: { points: [{ color: "#ff0000" }, { color: "#00ff00" }] },
      }),
    );
    expect(p.pages[0].elements.map((e) => e.type)).toEqual(["glass", "image", "text", "button"]);
    expect(p.pages[0].elements[0].frost).toBe(30);
    expect(p.pages[0].bg.colors).toEqual(["#ff0000", "#00ff00"]);
    expect(Object.keys(p.assets)).toHaveLength(1);
  });

  it("duplicating a page re-points its show/hide actions", () => {
    const p = createProject();
    const target = createElement("sticker", p.canvas);
    const button = createElement("button", p.canvas, { actions: [{ type: "toggle", target: target.id, mode: "toggle" }] });
    p.pages[0].elements.push(target, button);
    const copy = duplicatePage(p.pages[0]);
    expect(copy.id).not.toBe(p.pages[0].id);
    expect(copy.elements[0].id).not.toBe(target.id);
    expect(copy.elements[1].actions[0].target).toBe(copy.elements[0].id);
  });

  it("drops unused pictures and sounds", () => {
    const p = createProject();
    p.assets = {
      a: { kind: "image", data: "data:image/png;base64,A", name: "a" },
      b: { kind: "audio", data: "data:audio/mpeg;base64,A", name: "b" },
    };
    p.pages[0].elements.push(createElement("button", p.canvas, { actions: [{ type: "sound", asset: "b", volume: 1, stopOthers: false }] }));
    expect(Object.keys(pruneAssets(p).assets)).toEqual(["b"]);
  });
});
