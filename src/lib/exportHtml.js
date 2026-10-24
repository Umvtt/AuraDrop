// "Export as web page": one .html file with everything inside – the player,
// the project (images and sounds included) and the fonts it uses – so it
// opens in any browser, on any device, with working buttons.

import playerSource from "../player/player.js?raw";
import { embeddedFontCss, usedFonts } from "./fonts.js";
import { pruneAssets } from "./project.js";

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** JSON that can sit inside a <script> without closing it early. */
const scriptJson = (value) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

/** The player as a classic script (drop the ES module export line). */
export function inlinePlayerSource() {
  const src = playerSource.replace(/^export \{[^}]*\};?\s*$/m, "");
  if (/^\s*(export|import)\s/m.test(src)) throw new Error("player.js must not import or export anything else");
  return src;
}

/** Web pages don't carry the 3D engine: vehicles become pictures of each view. */
async function withVehicleSnapshots(project) {
  if (!project.pages.some((p) => p.elements.some((e) => e.type === "vehicle"))) return project;
  const svc = await import("../vehicles3d/service.js");
  const pages = project.pages.map((pg) => ({
    ...pg,
    elements: pg.elements.map((el) => {
      if (el.type !== "vehicle") return el;
      const k = Math.min(1.5, 1400 / Math.max(el.w, el.h)) || 1;
      const shot = (view) => svc.snapshot(el.vehicle, { view, yaw: el.yaw, pitch: el.pitch, zoom: el.zoom, ground: el.ground }, Math.round(el.w * k), Math.round(el.h * k));
      const { vehicle, ...rest } = el;
      void vehicle;
      return { ...rest, snapshots: { normal: shot("normal"), armor: shot("armor"), xray: shot("xray") } };
    }),
  }));
  return { ...project, pages };
}

export async function buildWebPage(project) {
  const clean = await withVehicleSnapshots(pruneAssets(project));
  const fonts = await embeddedFontCss(usedFonts(clean));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="AuraDrop">
<title>${escapeHtml(clean.name)}</title>
<style>
${fonts}
html,body{margin:0;height:100%;background:#050608;overflow:hidden}
#aura{position:fixed;inset:0}
.nav{position:fixed;left:50%;bottom:14px;translate:-50% 0;display:flex;gap:8px;z-index:10}
.nav button{width:10px;height:10px;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.35);cursor:pointer}
.nav button[aria-current=true]{background:#fff}
</style>
</head>
<body>
<div id="aura"></div>
<script>
${inlinePlayerSource()}
(function () {
  var project = ${scriptJson(clean)};
  var nav = document.createElement("nav");
  nav.className = "nav";
  var player = createPlayer(document.getElementById("aura"), project, {
    mode: "play",
    confirmLinks: false,
    keyboard: true,
    onPageChange: mark
  });
  function mark(i) {
    Array.prototype.forEach.call(nav.children, function (b, j) { b.setAttribute("aria-current", String(i === j)); });
  }
  if (project.pages.length > 1) {
    project.pages.forEach(function (p, i) {
      var b = document.createElement("button");
      b.title = p.name;
      b.setAttribute("aria-label", p.name);
      b.onclick = function () { player.setPage(i); };
      nav.appendChild(b);
    });
    document.body.appendChild(nav);
    mark(0);
  }
})();
</script>
</body>
</html>
`;
}
