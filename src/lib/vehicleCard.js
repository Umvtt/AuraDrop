import { createElement, newId } from "./project.js";
import { NATIONS } from "../vehicles3d/spec.js";
import { computeStats } from "../vehicles3d/stats.js";

/** A vehicle element sized to fit `box` (canvas units). */
export function vehicleElement(vehicle, canvas, box) {
  const w = box?.w ?? Math.round(canvas.w * 0.7);
  const h = box?.h ?? Math.round(w * 0.58);
  return createElement("vehicle", canvas, {
    vehicle,
    name: vehicle.name,
    w,
    h,
    x: Math.round(box?.x ?? (canvas.w - w) / 2),
    y: Math.round(box?.y ?? (canvas.h - h) / 2),
  });
}

/** A grouped stat card: glass panel, the vehicle, name, BR badge and key stats. */
export function statCard(vehicle, canvas) {
  const st = computeStats(vehicle);
  const nation = NATIONS.find((n) => n.id === vehicle.nation);
  const W = Math.min(canvas.w * 0.92, canvas.h * 1.5);
  const H = Math.min(canvas.h * 0.9, W * 0.62);
  const x = (canvas.w - W) / 2;
  const y = (canvas.h - H) / 2;
  const g = newId("g");
  const u = W / 100;
  const els = [
    createElement("glass", canvas, { x, y, w: W, h: H, radius: Math.round(u * 3), tilt: false, name: "Card", tint: { colors: ["#f59e0b", "#a78bfa", "#22d3ee"], strength: 0.25, blend: "screen" } }),
    vehicleElement(vehicle, canvas, { x: x + u * 2, y: y + H * 0.2, w: W * 0.6, h: H * 0.72 }),
    createElement("text", canvas, { text: vehicle.name, font: "Bebas Neue", weight: 400, size: Math.round(u * 6.2), align: "left", x: x + u * 4, y: y + u * 2.5, w: W * 0.7, h: u * 8, shadow: { on: false }, name: "Vehicle name" }),
    createElement("text", canvas, { text: `${nation?.flag ?? ""} ${nation?.label ?? ""}${vehicle.approx ? "  ·  approximate" : ""}`, size: Math.round(u * 2.2), weight: 500, align: "left", color: "#cbd5f5", x: x + u * 4, y: y + u * 10, w: W * 0.6, h: u * 4, shadow: { on: false }, name: "Nation" }),
  ];
  if (st.br) {
    els.push(
      createElement("shape", canvas, { shape: "rect", radius: Math.round(u * 2), fill: { type: "gradient", color: "#fbbf24", color2: "#f43f5e", angle: 135 }, x: x + W - u * 17, y: y + u * 3, w: u * 13, h: u * 11, name: "BR badge" }),
      createElement("text", canvas, { text: `BR ${st.br.toFixed(1)}`, font: "Bebas Neue", weight: 400, size: Math.round(u * 5), color: "#0b0c12", x: x + W - u * 17, y: y + u * 3, w: u * 13, h: u * 11, shadow: { on: false }, name: "BR" }),
    );
  }
  const lines = st.rows.slice(0, 7).map((r) => `${r.label}: ${r.text}`).join("\n");
  els.push(createElement("text", canvas, { text: lines, size: Math.round(u * 2.3), weight: 600, align: "left", lineHeight: 1.6, x: x + W * 0.64, y: y + H * 0.26, w: W * 0.33, h: H * 0.66, shadow: { on: false }, color: "#eef0ff", name: "Stats" }));
  for (const e of els) e.group = g;
  return els;
}
