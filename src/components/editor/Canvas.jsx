import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { Maximize, Minus, Plus, Scan } from "lucide-react";
import { createPlayer, fontStack } from "../../player/player.js";
import { playerRenderers } from "../../lib/renderers.js";
import { IconButton } from "../controls.jsx";

const HANDLES = [
  { id: "nw", sx: -1, sy: -1, cursor: "nwse-resize" },
  { id: "n", sx: 0, sy: -1, cursor: "ns-resize" },
  { id: "ne", sx: 1, sy: -1, cursor: "nesw-resize" },
  { id: "e", sx: 1, sy: 0, cursor: "ew-resize" },
  { id: "se", sx: 1, sy: 1, cursor: "nwse-resize" },
  { id: "s", sx: 0, sy: 1, cursor: "ns-resize" },
  { id: "sw", sx: -1, sy: 1, cursor: "nesw-resize" },
  { id: "w", sx: -1, sy: 0, cursor: "ew-resize" },
];
const SNAP_PX = 6;
const MIN_SIZE = 8;
const RULER = 20;
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const rad = (d) => (d * Math.PI) / 180;
const clampZoom = (z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/** Bounding box of an element including its rotation. */
export function rotatedBounds(el) {
  if (!el.rotation) return { x: el.x, y: el.y, w: el.w, h: el.h };
  const r = rad(el.rotation);
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  const w = el.w * c + el.h * s;
  const h = el.w * s + el.h * c;
  return { x: el.x + el.w / 2 - w / 2, y: el.y + el.h / 2 - h / 2, w, h };
}

function unionBounds(list) {
  if (!list.length) return null;
  const bs = list.map(rotatedBounds);
  const x = Math.min(...bs.map((b) => b.x));
  const y = Math.min(...bs.map((b) => b.y));
  return { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x, h: Math.max(...bs.map((b) => b.y + b.h)) - y };
}

const hitId = (clientX, clientY) =>
  document.elementsFromPoint(clientX, clientY).find((n) => n.closest?.(".ad-el"))?.closest(".ad-el")?.dataset.id ?? null;

/**
 * The editing canvas: the real player in edit mode, with selection (single,
 * multiple, marquee), move/resize/rotate, snapping to other layers, guides
 * and the grid, rulers, zoom/pan and inline text editing on top.
 */
export const Canvas = forwardRef(function Canvas(
  {
    project,
    pageIndex,
    selectedIds,
    onSelect,
    onUpdate,
    onDuplicate,
    onCommitText,
    onContextMenu,
    onGuides,
    animate,
    dropTarget,
    grid = { show: false, snap: false, size: 40 },
    rulers = true,
  },
  ref,
) {
  const hostRef = useRef(null);
  const areaRef = useRef(null);
  const playerRef = useRef(null);
  const [zoom, setZoom] = useState(null); // null = fit
  const [fitScale, setFitScale] = useState(1);
  const [box, setBox] = useState(null); // stage offset within the area
  const [scroll, setScroll] = useState({ left: 0, top: 0 });
  const [snapLines, setSnapLines] = useState([]);
  const [editing, setEditing] = useState(null); // element id being text-edited
  const [hover, setHover] = useState(null);
  const [marquee, setMarquee] = useState(null);
  const [readout, setReadout] = useState(null); // {x, y, text} near the cursor
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);
  const [guideDrag, setGuideDrag] = useState(null); // {axis, at}
  const drag = useRef(null);
  const zoomAnchor = useRef(null);
  const page = project.pages[pageIndex];
  const guides = page.guides ?? { x: [], y: [] };
  const selection = page.elements.filter((e) => selectedIds.includes(e.id));
  const single = selection.length === 1 ? selection[0] : null;
  const scale = zoom ?? fitScale;

  // --- player ---------------------------------------------------------------

  useEffect(() => {
    const player = createPlayer(hostRef.current, project, { mode: "edit", page: pageIndex, scale: 1, animate, renderers: playerRenderers });
    playerRef.current = player;
    return () => player.destroy();
    // The player is created once; later changes go through update().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => playerRef.current?.update(project), [project]);
  useEffect(() => playerRef.current?.setPage(pageIndex), [pageIndex]);
  useEffect(() => playerRef.current?.setAnimate(animate), [animate]);

  // Where the stage sits inside the scroll area (overlay coordinates).
  const updateBox = useCallback(() => {
    const player = playerRef.current;
    const area = areaRef.current;
    if (!player || !area) return;
    const a = area.getBoundingClientRect();
    const st = player.stage.getBoundingClientRect();
    setBox((b) => {
      const next = { left: st.left - a.left + area.scrollLeft, top: st.top - a.top + area.scrollTop };
      return b && b.left === next.left && b.top === next.top ? b : next;
    });
  }, []);

  // Fit the canvas into the available space (minus a margin).
  const measure = useCallback(() => {
    const area = areaRef.current;
    if (!area) return;
    const r = area.getBoundingClientRect();
    const s = Math.max(MIN_ZOOM, Math.min((r.width - 80) / project.canvas.w, (r.height - 80) / project.canvas.h));
    setFitScale(s);
  }, [project.canvas.w, project.canvas.h]);
  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(() => {
      measure();
      requestAnimationFrame(updateBox);
    });
    ro.observe(areaRef.current);
    return () => ro.disconnect();
  }, [measure, updateBox]);

  useLayoutEffect(() => {
    playerRef.current?.setScale(scale);
    updateBox();
    // Keep the point under the cursor in place when zooming with the wheel.
    const anchor = zoomAnchor.current;
    zoomAnchor.current = null;
    if (anchor) {
      const st = playerRef.current.stage.getBoundingClientRect();
      const area = areaRef.current;
      area.scrollLeft += st.left + anchor.cx * scale - anchor.clientX;
      area.scrollTop += st.top + anchor.cy * scale - anchor.clientY;
      updateBox();
    }
  }, [scale, project.canvas.w, project.canvas.h, updateBox]);

  // --- coordinates -----------------------------------------------------------

  const toCanvas = useCallback(
    (clientX, clientY) => {
      const s = playerRef.current.stage.getBoundingClientRect();
      return { x: (clientX - s.left) / scale, y: (clientY - s.top) / scale };
    },
    [scale],
  );

  const zoomTo = useCallback(
    (z, anchorClient) => {
      const next = clampZoom(z);
      const area = areaRef.current;
      const r = area.getBoundingClientRect();
      const at = anchorClient ?? { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      const p = toCanvas(at.x, at.y);
      zoomAnchor.current = { clientX: at.x, clientY: at.y, cx: p.x, cy: p.y };
      setZoom(next);
    },
    [toCanvas],
  );

  const zoomToBounds = useCallback(
    (b) => {
      const area = areaRef.current;
      const r = area.getBoundingClientRect();
      const z = clampZoom(Math.min((r.width - 120) / Math.max(1, b.w), (r.height - 120) / Math.max(1, b.h)));
      // Centre the bounds: anchor its centre to the middle of the area.
      zoomAnchor.current = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
      setZoom(z);
      if (z === scale) {
        const st = playerRef.current.stage.getBoundingClientRect();
        area.scrollLeft += st.left + (b.x + b.w / 2) * z - (r.left + r.width / 2);
        area.scrollTop += st.top + (b.y + b.h / 2) * z - (r.top + r.height / 2);
        zoomAnchor.current = null;
      }
    },
    [scale],
  );

  useImperativeHandle(
    ref,
    () => ({
      toCanvas,
      /** Topmost element under a screen point (for drops), or null. */
      elementAt(clientX, clientY) {
        const id = hitId(clientX, clientY);
        return page.elements.find((e) => e.id === id) ?? null;
      },
      isOverCanvas(clientX, clientY) {
        const s = playerRef.current?.stage.getBoundingClientRect();
        return !!s && clientX >= s.left && clientX <= s.right && clientY >= s.top && clientY <= s.bottom;
      },
      zoomIn: () => zoomTo(scale * 1.25),
      zoomOut: () => zoomTo(scale / 1.25),
      zoomFit: () => setZoom(null),
      zoomActual: () => zoomTo(1),
      zoomToSelection: () => {
        const b = unionBounds(selection);
        if (b) zoomToBounds(b);
      },
      startEditing: (id) => setEditing(id),
    }),
    [toCanvas, page.elements, scale, zoomTo, zoomToBounds, selection],
  );

  // --- snapping ----------------------------------------------------------------

  /** Snap a box (canvas units) being moved: edges and centres to the canvas, other layers, guides and the grid. */
  function snapBox(b, exclude, useGrid) {
    const { w: cw, h: ch } = project.canvas;
    const t = SNAP_PX / scale;
    const xs = [0, cw / 2, cw, ...guides.x];
    const ys = [0, ch / 2, ch, ...guides.y];
    for (const o of page.elements) {
      if (exclude.includes(o.id) || o.hidden) continue;
      const ob = rotatedBounds(o);
      xs.push(ob.x, ob.x + ob.w / 2, ob.x + ob.w);
      ys.push(ob.y, ob.y + ob.h / 2, ob.y + ob.h);
    }
    const found = [];
    const snapAxis = (pos, size, lines, axis) => {
      let best = null;
      for (const off of [0, size / 2, size]) {
        for (const line of lines) {
          const d = line - (pos + off);
          if (Math.abs(d) <= t && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, line };
        }
      }
      if (best) {
        found.push({ axis, at: best.line });
        return pos + best.d;
      }
      if (useGrid) return Math.round(pos / grid.size) * grid.size;
      return pos;
    };
    return { x: snapAxis(b.x, b.w, xs, "x"), y: snapAxis(b.y, b.h, ys, "y"), lines: found };
  }

  // --- pointer interactions ------------------------------------------------------

  function startPan(e) {
    const area = areaRef.current;
    area.setPointerCapture(e.pointerId);
    drag.current = { kind: "pan", x: e.clientX, y: e.clientY, left: area.scrollLeft, top: area.scrollTop };
    setPanning(true);
  }

  function onPointerDown(e) {
    if (editing) return;
    if (e.button === 1 || (e.button === 0 && spaceDown)) {
      e.preventDefault();
      return startPan(e);
    }
    if (e.button !== 0) return;
    if (e.target.closest?.("[data-handle]")) return;
    const id = e.target.closest?.(".ad-el")?.dataset.id;
    const el = page.elements.find((x) => x.id === id);
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    if (!el) {
      // Empty space: marquee selection.
      if (!additive) onSelect(null);
      areaRef.current.setPointerCapture(e.pointerId);
      const p = toCanvas(e.clientX, e.clientY);
      drag.current = { kind: "marquee", start: p, base: additive ? selectedIds : [] };
      return;
    }
    if (additive) {
      onSelect(el.id, { add: true });
      return;
    }
    const inSelection = selectedIds.includes(el.id);
    if (!inSelection) onSelect(el.id);
    // Which elements move: the selection if we grabbed part of it, else the
    // element (and its group).
    let ids = inSelection ? selectedIds : el.group ? page.elements.filter((x) => x.group === el.group).map((x) => x.id) : [el.id];
    ids = ids.filter((i) => !page.elements.find((x) => x.id === i)?.locked);
    if (!ids.length) return;
    e.preventDefault();
    areaRef.current.setPointerCapture(e.pointerId);
    drag.current = {
      kind: "move",
      ids,
      clicked: el.id,
      // Clicking one layer of a multi-selection (not just its own group) narrows to it.
      narrow: inSelection && selectedIds.length > 1 && !(el.group && selectedIds.every((sid) => page.elements.find((x) => x.id === sid)?.group === el.group)),
      alt: e.altKey,
      start: toCanvas(e.clientX, e.clientY),
      els: page.elements.filter((x) => ids.includes(x.id)).map((x) => ({ ...x })),
      moved: false,
    };
  }

  function startHandle(e, handle) {
    const live = selection.filter((x) => !x.locked);
    if (!live.length) return;
    e.preventDefault();
    e.stopPropagation();
    areaRef.current.setPointerCapture(e.pointerId);
    const start = toCanvas(e.clientX, e.clientY);
    if (single) {
      drag.current = { kind: handle.id === "rot" ? "rotate" : "resize", handle, id: single.id, start, el: { ...single } };
    } else {
      drag.current = { kind: "group-resize", handle, start, box: unionBounds(live), els: live.map((x) => ({ ...x })) };
    }
  }

  function onPointerMove(e) {
    const d = drag.current;
    if (!d) {
      // Hover outline for whatever is under the pointer.
      if (!spaceDown && !editing) {
        const id = e.target.closest?.(".ad-el")?.dataset.id ?? null;
        setHover((h) => (h === id ? h : id));
      }
      return;
    }
    if (d.kind === "pan") {
      const area = areaRef.current;
      area.scrollLeft = d.left - (e.clientX - d.x);
      area.scrollTop = d.top - (e.clientY - d.y);
      return;
    }
    const p = toCanvas(e.clientX, e.clientY);
    const at = (text) => setReadout({ x: e.clientX, y: e.clientY, text });

    if (d.kind === "marquee") {
      const r = { x: Math.min(d.start.x, p.x), y: Math.min(d.start.y, p.y), w: Math.abs(p.x - d.start.x), h: Math.abs(p.y - d.start.y) };
      setMarquee(r);
      if (r.w * scale < 3 && r.h * scale < 3) return;
      const hits = page.elements
        .filter((el) => {
          const b = rotatedBounds(el);
          return b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y;
        })
        .map((el) => el.id);
      onSelect([...new Set([...d.base, ...hits])]);
      return;
    }

    if (d.kind === "move") {
      const dx = p.x - d.start.x;
      const dy = p.y - d.start.y;
      if (!d.moved && Math.hypot(dx, dy) * scale < 3) return;
      if (!d.moved) {
        d.moved = true;
        // Alt-drag leaves a copy behind: duplicate, then move the copies.
        if (d.alt && onDuplicate) {
          const copies = onDuplicate(d.ids);
          if (copies?.length === d.ids.length) {
            const byOld = new Map(d.ids.map((id, i) => [id, copies[i]]));
            d.els = d.els.map((x) => ({ ...x, id: byOld.get(x.id) }));
            d.ids = copies;
          }
        }
      }
      const b0 = unionBounds(d.els);
      let nx = b0.x + dx;
      let ny = b0.y + dy;
      if (!e.ctrlKey) {
        const s = snapBox({ x: nx, y: ny, w: b0.w, h: b0.h }, d.ids, grid.snap);
        nx = s.x;
        ny = s.y;
        setSnapLines(s.lines);
      } else setSnapLines([]);
      const ox = Math.round(nx - b0.x);
      const oy = Math.round(ny - b0.y);
      const orig = new Map(d.els.map((x) => [x.id, x]));
      onUpdate(d.ids, (el) => {
        const o = orig.get(el.id);
        return o ? { ...el, x: o.x + ox, y: o.y + oy } : el;
      });
      at(`${Math.round(b0.x + ox)}, ${Math.round(b0.y + oy)}`);
      return;
    }

    if (d.kind === "rotate") {
      const el = d.el;
      const cx = el.x + el.w / 2;
      const cy = el.y + el.h / 2;
      let angle = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
      if (e.shiftKey) angle = Math.round(angle / 15) * 15;
      else if (Math.abs(((angle % 90) + 90) % 90) < 3 || Math.abs(((angle % 90) + 90) % 90) > 87) angle = Math.round(angle / 90) * 90;
      angle = ((angle + 540) % 360) - 180;
      const rotation = Math.round(angle * 10) / 10;
      onUpdate([d.id], (x) => ({ ...x, rotation }));
      at(`${Math.round(rotation)}°`);
      return;
    }

    if (d.kind === "resize") {
      // Resize in the element's own (rotated) frame, keeping the opposite
      // edge or corner where it is.
      const el = d.el;
      const { sx, sy } = d.handle;
      const r = rad(el.rotation);
      const wx = p.x - d.start.x;
      const wy = p.y - d.start.y;
      const lx = wx * Math.cos(r) + wy * Math.sin(r);
      const ly = -wx * Math.sin(r) + wy * Math.cos(r);
      let w = sx ? el.w + sx * lx : el.w;
      let h = sy ? el.h + sy * ly : el.h;
      const ratioByDefault = ["image", "sticker", "vehicle"].includes(el.type);
      const keepRatio = sx && sy && ratioByDefault !== e.shiftKey;
      if (keepRatio) {
        const k = Math.max(w / el.w, h / el.h);
        w = el.w * k;
        h = el.h * k;
      }
      w = Math.max(MIN_SIZE, w);
      h = Math.max(MIN_SIZE, h);
      if (grid.snap && !el.rotation && !keepRatio) {
        if (sx) w = Math.max(MIN_SIZE, Math.round((sx > 0 ? el.x + w : el.x + el.w - w) / grid.size) * grid.size * sx - (sx > 0 ? el.x : -(el.x + el.w)));
        if (sy) h = Math.max(MIN_SIZE, Math.round((sy > 0 ? el.y + h : el.y + el.h - h) / grid.size) * grid.size * sy - (sy > 0 ? el.y : -(el.y + el.h)));
      }
      const shiftX = ((w - el.w) / 2) * sx;
      const shiftY = ((h - el.h) / 2) * sy;
      const cx = el.x + el.w / 2 + shiftX * Math.cos(r) - shiftY * Math.sin(r);
      const cy = el.y + el.h / 2 + shiftX * Math.sin(r) + shiftY * Math.cos(r);
      const next = { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w: Math.round(w), h: Math.round(h) };
      onUpdate([d.id], (x) => ({ ...x, ...next }));
      at(`${next.w} × ${next.h}`);
      return;
    }

    if (d.kind === "group-resize") {
      const { sx, sy } = d.handle;
      const b = d.box;
      const dx = p.x - d.start.x;
      const dy = p.y - d.start.y;
      let kx = sx ? Math.max(0.05, (b.w + sx * dx) / b.w) : 1;
      let ky = sy ? Math.max(0.05, (b.h + sy * dy) / b.h) : 1;
      // Corners keep proportions (Shift frees them); edges stretch.
      if (sx && sy && !e.shiftKey) kx = ky = Math.max(kx, ky);
      const ax = sx > 0 ? b.x : sx < 0 ? b.x + b.w : b.x + b.w / 2;
      const ay = sy > 0 ? b.y : sy < 0 ? b.y + b.h : b.y + b.h / 2;
      const orig = new Map(d.els.map((x) => [x.id, x]));
      const uniform = kx === ky ? kx : null;
      onUpdate(
        d.els.map((x) => x.id),
        (el) => {
          const o = orig.get(el.id);
          if (!o) return el;
          const cx = ax + (o.x + o.w / 2 - ax) * kx;
          const cy = ay + (o.y + o.h / 2 - ay) * ky;
          const w = Math.max(MIN_SIZE, o.w * kx);
          const h = Math.max(MIN_SIZE, o.h * ky);
          const next = { ...el, x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w: Math.round(w), h: Math.round(h) };
          // Proportional scaling also scales text.
          if (uniform && (o.type === "text" || o.type === "button")) next.size = Math.max(4, Math.round(o.size * uniform));
          return next;
        },
      );
      at(`${Math.round(b.w * kx)} × ${Math.round(b.h * ky)}`);
    }
  }

  function onPointerUp(e) {
    const d = drag.current;
    drag.current = null;
    setSnapLines([]);
    setMarquee(null);
    setReadout(null);
    setPanning(false);
    // A plain click on one layer of a multi-selection selects just that one.
    if (d?.kind === "move" && !d.moved && d.narrow && !e.shiftKey) onSelect(d.clicked);
  }

  function onDoubleClick(e) {
    // Pointer capture retargets the event to the area; hit-test instead.
    const id = hitId(e.clientX, e.clientY);
    const el = page.elements.find((x) => x.id === id);
    if (!el) return;
    // Double-click inside a group picks that one layer first.
    if (el.group && selectedIds.length > 1) {
      onSelect(el.id, { deep: true });
      return;
    }
    if (!el.locked && (el.type === "text" || el.type === "button" || el.type === "sticker")) {
      onSelect(el.id, { deep: true });
      setEditing(el.id);
    }
  }

  function onContext(e) {
    e.preventDefault();
    const id = hitId(e.clientX, e.clientY);
    if (id && !selectedIds.includes(id)) onSelect(id);
    if (!id && selectedIds.length) onSelect(null);
    onContextMenu?.({ clientX: e.clientX, clientY: e.clientY, id });
  }

  // Ctrl+wheel zooms toward the cursor; plain wheel scrolls; Shift+wheel scrolls sideways.
  function onWheel(e) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoomTo(scale * Math.exp(-e.deltaY * 0.0022), { x: e.clientX, y: e.clientY });
  }
  useEffect(() => {
    const area = areaRef.current;
    area.addEventListener("wheel", onWheel, { passive: false });
    return () => area.removeEventListener("wheel", onWheel);
  });

  // Hold Space to pan.
  useEffect(() => {
    const typing = (e) => e.target.closest?.("input, textarea, select, [contenteditable=true]");
    const down = (e) => {
      if (e.code === "Space" && !typing(e) && !e.repeat) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e) => e.code === "Space" && setSpaceDown(false);
    const blur = () => setSpaceDown(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // Stop editing when the selection changes.
  useEffect(() => {
    if (editing && !(selectedIds.length === 1 && selectedIds[0] === editing)) setEditing(null);
  }, [selectedIds, editing]);

  // --- guides from the rulers -------------------------------------------------------

  function startGuide(e, axis, index = null) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setGuideDrag({ axis, index, at: null });
  }
  function moveGuide(e) {
    if (!guideDrag) return;
    const p = toCanvas(e.clientX, e.clientY);
    const at = Math.round(guideDrag.axis === "x" ? p.x : p.y);
    setGuideDrag((g) => ({ ...g, at, client: guideDrag.axis === "x" ? e.clientX : e.clientY }));
  }
  function endGuide(e) {
    const g = guideDrag;
    setGuideDrag(null);
    if (!g || g.at === null) return;
    const area = areaRef.current.getBoundingClientRect();
    // Dropped back on the ruler: remove it.
    const offRuler = g.axis === "x" ? e.clientX > area.left + RULER : e.clientY > area.top + RULER;
    const list = [...guides[g.axis]];
    if (g.index !== null) list.splice(g.index, 1);
    if (offRuler) list.push(g.at);
    onGuides?.({ ...guides, [g.axis]: list });
  }

  // --- overlay geometry -----------------------------------------------------------

  const toArea = (x, y) => ({ left: box.left + x * scale, top: box.top + y * scale });
  const rectStyle = (r) => (box ? { ...toArea(r.x, r.y), width: r.w * scale, height: r.h * scale } : null);
  const overlay =
    single && box ? { ...rectStyle(single), transform: single.rotation ? `rotate(${single.rotation}deg)` : undefined } : null;
  const multiBox = !single && selection.length > 1 && box ? unionBounds(selection) : null;
  const hoverEl = hover && !selectedIds.includes(hover) ? page.elements.find((x) => x.id === hover) : null;
  const editingEl = editing ? page.elements.find((x) => x.id === editing) : null;
  const allLocked = selection.length > 0 && selection.every((x) => x.locked);
  const cursor = panning ? "grabbing" : spaceDown ? "grab" : undefined;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={areaRef}
        className="canvas-area scroll-thin relative min-h-0 flex-1 overflow-auto"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContext}
        onScroll={(e) => setScroll({ left: e.currentTarget.scrollLeft, top: e.currentTarget.scrollTop })}
        data-testid="canvas-area"
        style={{ cursor }}
      >
        <div
          ref={hostRef}
          className="relative"
          style={{
            width: Math.max(project.canvas.w * scale + 160, 10),
            height: Math.max(project.canvas.h * scale + 160, 10),
            minWidth: "100%",
            minHeight: "100%",
          }}
        />

        {box && <div className="canvas-shadow pointer-events-none absolute" style={rectStyle({ x: 0, y: 0, w: project.canvas.w, h: project.canvas.h })} />}

        {grid.show && box && (
          <div
            className="pointer-events-none absolute"
            data-testid="grid"
            style={{
              ...rectStyle({ x: 0, y: 0, w: project.canvas.w, h: project.canvas.h }),
              backgroundImage: "linear-gradient(rgba(255,255,255,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.09) 1px, transparent 1px)",
              backgroundSize: `${grid.size * scale}px ${grid.size * scale}px`,
            }}
          />
        )}

        {box &&
          ["x", "y"].map((axis) =>
            guides[axis].map((g, i) => (
              <div
                key={`${axis}${i}`}
                className="guide-line absolute"
                data-handle="guide"
                title="Drag to move – drag onto the ruler to remove"
                onPointerDown={(e) => startGuide(e, axis, i)}
                onPointerMove={moveGuide}
                onPointerUp={endGuide}
                style={
                  axis === "x"
                    ? { left: box.left + g * scale - 2, top: 0, width: 5, height: "100%", cursor: "ew-resize", minHeight: box.top * 2 + project.canvas.h * scale }
                    : { top: box.top + g * scale - 2, left: 0, height: 5, width: "100%", cursor: "ns-resize", minWidth: box.left * 2 + project.canvas.w * scale }
                }
              >
                <span className={axis === "x" ? "absolute inset-y-0 left-[2px] w-px bg-[#38bdf8]" : "absolute inset-x-0 top-[2px] h-px bg-[#38bdf8]"} />
              </div>
            )),
          )}

        {snapLines.map((g, i) =>
          box ? (
            <div
              key={i}
              className="pointer-events-none absolute bg-[#f472b6]"
              style={
                g.axis === "x"
                  ? { left: box.left + g.at * scale, top: box.top, width: 1, height: project.canvas.h * scale }
                  : { top: box.top + g.at * scale, left: box.left, height: 1, width: project.canvas.w * scale }
              }
            />
          ) : null,
        )}

        {dropTarget && box && (
          <div
            className="pointer-events-none absolute grid place-items-center rounded-sm border-2 border-dashed border-accent-2 bg-accent-2/10 text-[13px] font-semibold text-white"
            style={
              dropTarget.el
                ? { ...rectStyle(dropTarget.el), transform: `rotate(${dropTarget.el.rotation}deg)` }
                : rectStyle({ x: 0, y: 0, w: project.canvas.w, h: project.canvas.h })
            }
          >
            <span className="rounded-lg bg-black/60 px-2.5 py-1">{dropTarget.label}</span>
          </div>
        )}

        {hoverEl && box && !drag.current && (
          <div
            className="pointer-events-none absolute rounded-[2px] border border-accent-2/70"
            data-testid="hover"
            style={{ ...rectStyle(hoverEl), transform: hoverEl.rotation ? `rotate(${hoverEl.rotation}deg)` : undefined }}
          />
        )}

        {/* Thin outlines for each member of a multi-selection. */}
        {multiBox &&
          selection.map((el) => (
            <div
              key={el.id}
              className="pointer-events-none absolute border border-accent-2/60"
              style={{ ...rectStyle(el), transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined }}
            />
          ))}

        {overlay && !editingEl && (
          <div className="pointer-events-none absolute" style={overlay} data-testid="selection">
            <div className={`absolute -inset-px rounded-[2px] border ${single.locked ? "border-dashed border-amber-300" : "border-accent-2"}`} />
            {!single.locked && (
              <>
                {HANDLES.map((h) => (
                  <span
                    key={h.id}
                    data-handle={h.id}
                    onPointerDown={(e) => startHandle(e, h)}
                    className="sel-handle pointer-events-auto absolute"
                    style={{ left: `${(h.sx + 1) * 50}%`, top: `${(h.sy + 1) * 50}%`, cursor: h.cursor }}
                  />
                ))}
                <span className="absolute left-1/2 h-5 w-px -translate-x-1/2 bg-accent-2" style={{ top: -22 }} />
                <span
                  data-handle="rot"
                  title="Drag to rotate (Shift snaps to 15°)"
                  onPointerDown={(e) => startHandle(e, { id: "rot" })}
                  className="pointer-events-auto absolute left-1/2 grid size-5 -translate-x-1/2 cursor-grab place-items-center rounded-full border-2 border-accent-2 bg-white text-[10px] text-[#0b0c12] shadow active:cursor-grabbing"
                  style={{ top: -36 }}
                >
                  ↻
                </span>
              </>
            )}
          </div>
        )}

        {multiBox && (
          <div className="pointer-events-none absolute" style={rectStyle(multiBox)} data-testid="selection" data-count={selection.length}>
            <div className={`absolute -inset-px rounded-[2px] border ${allLocked ? "border-dashed border-amber-300" : "border-accent-2"}`} />
            {!allLocked &&
              HANDLES.map((h) => (
                <span
                  key={h.id}
                  data-handle={h.id}
                  onPointerDown={(e) => startHandle(e, h)}
                  className="sel-handle pointer-events-auto absolute"
                  style={{ left: `${(h.sx + 1) * 50}%`, top: `${(h.sy + 1) * 50}%`, cursor: h.cursor }}
                />
              ))}
            <span className="absolute -top-6 left-0 rounded-md bg-accent-2 px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-[#0b0c12]">
              {selection.length} selected
            </span>
          </div>
        )}

        {marquee && box && marquee.w * scale > 2 && (
          <div className="pointer-events-none absolute rounded-[2px] border border-accent-2 bg-accent-2/10" style={rectStyle(marquee)} data-testid="marquee" />
        )}

        {editingEl && box && (
          <InlineEditor
            el={editingEl}
            style={{ ...rectStyle(editingEl), transform: editingEl.rotation ? `rotate(${editingEl.rotation}deg)` : undefined }}
            scale={scale}
            onDone={(value) => {
              setEditing(null);
              if (value !== null) onCommitText(editingEl, value);
            }}
          />
        )}
      </div>

      {rulers && box && (
        <Rulers
          box={box}
          scroll={scroll}
          scale={scale}
          canvas={project.canvas}
          highlight={single ? rotatedBounds(single) : multiBox}
          onStartGuide={startGuide}
          onMoveGuide={moveGuide}
          onEndGuide={endGuide}
        />
      )}
      {guideDrag?.at != null && (
        <div
          className="pointer-events-none fixed z-40 bg-[#38bdf8]"
          style={guideDrag.axis === "x" ? { left: guideDrag.client, top: 0, bottom: 0, width: 1 } : { top: guideDrag.client, left: 0, right: 0, height: 1 }}
        >
          <span className="absolute top-2 left-2 rounded bg-[#38bdf8] px-1 font-mono text-[10px] text-[#0b0c12]">{guideDrag.at}</span>
        </div>
      )}

      {readout && (
        <div className="pointer-events-none fixed z-40 rounded-md bg-[#0b0c12]/90 px-1.5 py-0.5 font-mono text-[10.5px] text-white shadow-lg ring-1 ring-white/10" style={{ left: readout.x + 14, top: readout.y + 16 }}>
          {readout.text}
        </div>
      )}

      {/* Zoom controls */}
      <div className="glass-float absolute right-3 bottom-3 flex items-center gap-0.5 rounded-xl p-0.5 text-[11.5px]">
        <IconButton label="Zoom out (Ctrl −)" onClick={() => zoomTo(scale / 1.25)}>
          <Minus size={15} />
        </IconButton>
        <button
          type="button"
          onClick={() => setZoom(null)}
          title="Fit to window (Shift+1)"
          className="press focus-ring min-w-14 rounded-lg px-2 py-1.5 font-mono text-[11px] text-ink/85 hover:bg-white/10"
          data-testid="zoom-label"
        >
          {zoom === null ? "Fit" : `${Math.round(scale * 100)}%`}
        </button>
        <IconButton label="Zoom in (Ctrl +)" onClick={() => zoomTo(scale * 1.25)}>
          <Plus size={15} />
        </IconButton>
        <span className="mx-0.5 h-4 w-px bg-white/10" />
        <IconButton label="Actual size (Ctrl+0)" onClick={() => zoomTo(1)}>
          <Maximize size={14} />
        </IconButton>
        <IconButton label="Zoom to selection (Shift+2)" disabled={!selection.length} onClick={() => selection.length && zoomToBounds(unionBounds(selection))}>
          <Scan size={14} />
        </IconButton>
      </div>
    </div>
  );
});

/** Pixel rulers along the top and left, in canvas units. Drag out of them to make guides. */
function Rulers({ box, scroll, scale, canvas, highlight, onStartGuide, onMoveGuide, onEndGuide }) {
  const topRef = useRef(null);
  const leftRef = useRef(null);

  useLayoutEffect(() => {
    const draw = (cv, horizontal) => {
      if (!cv) return;
      const dpr = window.devicePixelRatio || 1;
      const len = horizontal ? cv.clientWidth : cv.clientHeight;
      cv.width = (horizontal ? len : RULER) * dpr;
      cv.height = (horizontal ? RULER : len) * dpr;
      const g = cv.getContext("2d");
      g.scale(dpr, dpr);
      g.fillStyle = "rgba(14,15,23,0.92)";
      g.fillRect(0, 0, horizontal ? len : RULER, horizontal ? RULER : len);
      const origin = (horizontal ? box.left - scroll.left : box.top - scroll.top) - RULER * 0;
      // Selection extent.
      if (highlight) {
        const a = origin + (horizontal ? highlight.x : highlight.y) * scale;
        const b = (horizontal ? highlight.w : highlight.h) * scale;
        g.fillStyle = "rgba(34,211,238,0.22)";
        if (horizontal) g.fillRect(a, 0, b, RULER);
        else g.fillRect(0, a, RULER, b);
      }
      // Pick a tick spacing that's ~ 60px apart on screen.
      const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
      const major = steps.find((s) => s * scale >= 60) ?? 5000;
      const minor = major / (major % 5 === 0 ? 5 : 4);
      const from = Math.floor(-origin / scale / minor) * minor;
      const to = (len - origin) / scale;
      g.strokeStyle = "rgba(255,255,255,0.18)";
      g.fillStyle = "rgba(200,205,230,0.7)";
      g.font = "9px 'JetBrains Mono Variable', monospace";
      g.beginPath();
      for (let v = from; v <= to; v += minor) {
        const at = Math.round(origin + v * scale) + 0.5;
        const isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6;
        const tick = isMajor ? 9 : 4;
        if (horizontal) {
          g.moveTo(at, RULER);
          g.lineTo(at, RULER - tick);
          if (isMajor) g.fillText(String(Math.round(v)), at + 3, 9);
        } else {
          g.moveTo(RULER, at);
          g.lineTo(RULER - tick, at);
          if (isMajor) {
            g.save();
            g.translate(9, at - 3);
            g.rotate(-Math.PI / 2);
            g.fillText(String(Math.round(v)), 0, 0);
            g.restore();
          }
        }
      }
      g.stroke();
      // Canvas edges.
      g.fillStyle = "rgba(167,139,250,0.55)";
      const end = origin + (horizontal ? canvas.w : canvas.h) * scale;
      if (horizontal) {
        g.fillRect(origin, RULER - 2, end - origin, 2);
      } else g.fillRect(RULER - 2, origin, 2, end - origin);
      g.fillStyle = "rgba(255,255,255,0.08)";
      if (horizontal) g.fillRect(0, RULER - 1, len, 1);
      else g.fillRect(RULER - 1, 0, 1, len);
    };
    draw(topRef.current, true);
    draw(leftRef.current, false);
  });

  const handlers = (axis) => ({
    onPointerDown: (e) => onStartGuide(e, axis),
    onPointerMove: onMoveGuide,
    onPointerUp: onEndGuide,
  });
  return (
    <>
      <canvas ref={topRef} className="absolute top-0 right-0 left-0 h-5 w-full cursor-ns-resize" style={{ height: RULER }} title="Drag down to add a guide" {...handlers("y")} data-testid="ruler-top" />
      <canvas ref={leftRef} className="absolute top-0 bottom-0 left-0 w-5 cursor-ew-resize" style={{ width: RULER, height: "100%" }} title="Drag right to add a guide" {...handlers("x")} />
      <div className="absolute top-0 left-0 bg-[#0e0f17]" style={{ width: RULER, height: RULER }} />
    </>
  );
}

function InlineEditor({ el, style, scale, onDone }) {
  const ref = useRef(null);
  const initial = el.type === "text" ? el.text : el.type === "button" ? el.label : el.emoji;
  useEffect(() => {
    ref.current.focus();
    ref.current.select();
  }, []);
  const font =
    el.type === "text"
      ? { fontFamily: fontStack(el.font), fontSize: el.size * scale, fontWeight: el.weight, textAlign: el.align, lineHeight: el.lineHeight, textTransform: el.upper ? "uppercase" : "none" }
      : el.type === "button"
        ? { fontFamily: fontStack(el.font), fontSize: el.size * scale, fontWeight: el.weight, textAlign: "center" }
        : { fontSize: Math.min(el.w, el.h) * 0.5 * scale, textAlign: "center" };
  return (
    <textarea
      ref={ref}
      defaultValue={initial}
      aria-label="Edit text"
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={(e) => onDone(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") onDone(null);
        if (e.key === "Enter" && (el.type !== "text" || e.ctrlKey)) {
          e.preventDefault();
          onDone(e.target.value);
        }
      }}
      className="absolute resize-none overflow-hidden rounded-sm border-2 border-accent-2 bg-black/70 p-1 text-white outline-none"
      style={{ ...style, ...font }}
    />
  );
}
