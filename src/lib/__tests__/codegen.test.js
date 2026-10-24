import { describe, expect, it } from "vitest";
import { createDefaultDesign } from "../design.js";
import { escapeHtml, generateCss, generateHtml, generateTailwind, tw } from "../codegen.js";

describe("code generation", () => {
  it("reflects inspector values in CSS", () => {
    const d = { ...createDefaultDesign(), frost: 31, radius: 9 };
    const css = generateCss(d);
    expect(css).toContain("backdrop-filter: blur(31px)");
    expect(css).toContain("border-radius: 9px");
  });

  it("only emits keyframes for vibes that are on", () => {
    const d = createDefaultDesign();
    expect(generateCss(d)).not.toContain("aura-levitate");
    const css = generateCss({ ...d, vibes: { ...d.vibes, levitate: true } });
    expect(css).toContain("@keyframes aura-levitate");
    expect(css).toContain("animation: aura-levitate");
  });

  it("escapes user text in markup", () => {
    const d = createDefaultDesign();
    d.content.title = '<img src=x onerror="alert(1)">';
    expect(generateHtml(d)).not.toContain("<img src=x");
    expect(escapeHtml("<a&'\">")).toBe("&lt;a&amp;&#39;&quot;&gt;");
  });

  it("uses placeholders instead of embedding images", () => {
    const d = createDefaultDesign();
    d.content.background = "data:image/png;base64,AAAA";
    for (const out of [generateCss(d), generateHtml(d), generateTailwind(d)]) {
      expect(out).not.toContain("data:image");
      expect(out).toContain("aura-background.png");
    }
  });

  it("drops the tilt script when tilt is off", () => {
    const d = createDefaultDesign();
    expect(generateHtml(d)).toContain("data-aura-tilt");
    const off = { ...d, tilt: { ...d.tilt, enabled: false } };
    expect(generateHtml(off)).not.toContain("<script>");
  });

  it("makes Tailwind arbitrary values space-free", () => {
    expect(tw("0 20px 50px rgba(0, 0, 0, 0.4)")).toBe("0_20px_50px_rgba(0,0,0,0.4)");
    const classes = generateTailwind(createDefaultDesign()).match(/class="([^"]*)"/g);
    for (const c of classes) expect(c).not.toMatch(/\[[^\]]* [^\]]*\]/);
  });
});
