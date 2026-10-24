// Plain-words labels for history entries: what changed between two versions.

const label = (e) => e.name || e.type;
const KEY_WORDS = [
  [["x", "y"], "Moved"],
  [["x", "y", "w", "h"], "Resized"],
  [["rotation"], "Rotated"],
  [["text", "label", "emoji"], "Edited"],
  [["color", "fill", "textColor", "color2", "tint"], "Recoloured"],
  [["font", "size", "weight", "spacing", "lineHeight", "upper", "curve", "align"], "Restyled"],
  [["filters", "outline", "mask", "border", "radius", "shadow", "stroke", "bg"], "Restyled"],
  [["asset", "original"], "Changed the picture of"],
  [["anim"], "Animated"],
  [["actions"], "Changed what happens on click for"],
  [["hidden"], "Showed/hid"],
  [["locked"], "Locked/unlocked"],
  [["opacity"], "Changed the opacity of"],
  [["group"], "Grouped"],
  [["vehicle", "view", "yaw", "pitch", "zoom", "spin"], "Changed the vehicle"],
  [["flipX", "flipY"], "Flipped"],
  [["name"], "Renamed"],
];

function verbFor(keys) {
  for (const [ks, word] of KEY_WORDS) if (keys.every((k) => ks.includes(k))) return word;
  // Mixed style tweaks (e.g. font and colour together) still read as restyling.
  if (keys.every((k) => KEY_WORDS.some(([ks, w]) => (w === "Restyled" || w === "Recoloured") && ks.includes(k)))) return "Restyled";
  return "Edited";
}

/** One short sentence describing how `next` differs from `prev`. */
export function describeChange(prev, next) {
  if (!prev) return "Opened";
  if (prev.pages.length !== next.pages.length) return next.pages.length > prev.pages.length ? "Added a page" : "Deleted a page";
  if (prev.canvas !== next.canvas && (prev.canvas.w !== next.canvas.w || prev.canvas.h !== next.canvas.h)) return "Resized the canvas";
  if (prev.name !== next.name) return "Renamed the project";
  for (let i = 0; i < next.pages.length; i++) {
    const a = prev.pages[i];
    const b = next.pages[i];
    if (a === b) continue;
    if (a.id !== b.id) return "Reordered pages";
    if (a.elements !== b.elements) {
      const before = new Map(a.elements.map((e) => [e.id, e]));
      const after = new Map(b.elements.map((e) => [e.id, e]));
      const added = b.elements.filter((e) => !before.has(e.id));
      const removed = a.elements.filter((e) => !after.has(e.id));
      if (added.length) return added.length === 1 ? `Added ${label(added[0])}` : `Added ${added.length} layers`;
      if (removed.length) return removed.length === 1 ? `Deleted ${label(removed[0])}` : `Deleted ${removed.length} layers`;
      const changed = b.elements.filter((e) => before.get(e.id) !== e);
      if (!changed.length) return "Reordered layers";
      const keys = [...new Set(changed.flatMap((e) => Object.keys(e).filter((k) => e[k] !== before.get(e.id)[k])))];
      const verb = verbFor(keys);
      return changed.length === 1 ? `${verb} ${label(changed[0])}` : `${verb} ${changed.length} layers`;
    }
    if (a.bg !== b.bg) return "Changed the background";
    if (a.guides !== b.guides) return "Moved a guide";
    if (a.name !== b.name) return "Renamed a page";
    if (a.transition !== b.transition) return "Changed the page transition";
    return "Edited the page";
  }
  if (prev.pages.some((p, i) => p !== next.pages[i])) return "Reordered pages";
  return "Edited";
}
