// Bundled fonts. Importing this module loads them all into the app; the
// exporters use the file URLs to embed just the fonts a project uses.

import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/jetbrains-mono/wght.css";
import "@fontsource/anton/400.css";
import "@fontsource/bangers/400.css";
import "@fontsource/bebas-neue/400.css";
import "@fontsource/permanent-marker/400.css";
import "@fontsource/comic-neue/400.css";
import "@fontsource/comic-neue/700.css";
import "@fontsource/pacifico/400.css";
import "@fontsource/lobster/400.css";
import "@fontsource/press-start-2p/400.css";

import inter from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import jetbrains from "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url";
import anton from "@fontsource/anton/files/anton-latin-400-normal.woff2?url";
import bangers from "@fontsource/bangers/files/bangers-latin-400-normal.woff2?url";
import bebas from "@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2?url";
import marker from "@fontsource/permanent-marker/files/permanent-marker-latin-400-normal.woff2?url";
import comic400 from "@fontsource/comic-neue/files/comic-neue-latin-400-normal.woff2?url";
import comic700 from "@fontsource/comic-neue/files/comic-neue-latin-700-normal.woff2?url";
import pacifico from "@fontsource/pacifico/files/pacifico-latin-400-normal.woff2?url";
import lobster from "@fontsource/lobster/files/lobster-latin-400-normal.woff2?url";
import pixel from "@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2?url";

/** font id -> @font-face sources ("Impact" falls back to Anton off Windows). */
const FILES = {
  Inter: [{ family: "Inter Variable", weight: "100 900", url: inter }],
  "JetBrains Mono": [{ family: "JetBrains Mono Variable", weight: "100 800", url: jetbrains }],
  Impact: [{ family: "Anton", weight: "400", url: anton }],
  Anton: [{ family: "Anton", weight: "400", url: anton }],
  Bangers: [{ family: "Bangers", weight: "400", url: bangers }],
  "Bebas Neue": [{ family: "Bebas Neue", weight: "400", url: bebas }],
  "Permanent Marker": [{ family: "Permanent Marker", weight: "400", url: marker }],
  "Comic Neue": [
    { family: "Comic Neue", weight: "400", url: comic400 },
    { family: "Comic Neue", weight: "700", url: comic700 },
  ],
  Pacifico: [{ family: "Pacifico", weight: "400", url: pacifico }],
  Lobster: [{ family: "Lobster", weight: "400", url: lobster }],
  "Press Start 2P": [{ family: "Press Start 2P", weight: "400", url: pixel }],
};

/** Font ids used by a project (the player UI itself always needs Inter). */
export function usedFonts(project) {
  const ids = new Set(["Inter"]);
  for (const page of project.pages) {
    for (const el of page.elements) if (el.font) ids.add(el.font);
  }
  return [...ids];
}

/** Make sure fonts are ready before drawing text on a canvas. */
export async function loadFonts(ids) {
  if (!document.fonts) return;
  const loads = [];
  for (const id of ids) {
    for (const f of FILES[id] ?? []) {
      const weight = f.weight.split(" ").pop();
      loads.push(document.fonts.load(`${weight === "900" ? 700 : weight} 32px "${f.family}"`).catch(() => {}));
    }
  }
  await Promise.all(loads);
  await document.fonts.ready;
}

async function toDataUrl(url) {
  const res = await fetch(url);
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:font/woff2;base64,${btoa(bin)}`;
}

/** @font-face rules with the fonts inlined, for self-contained exports. */
export async function embeddedFontCss(ids) {
  const seen = new Set();
  const rules = [];
  for (const id of ids) {
    for (const f of FILES[id] ?? []) {
      const key = `${f.family}/${f.weight}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rules.push(
        `@font-face{font-family:"${f.family}";font-style:normal;font-display:swap;font-weight:${f.weight};src:url(${await toDataUrl(f.url)}) format("woff2")}`,
      );
    }
  }
  return rules.join("\n");
}
