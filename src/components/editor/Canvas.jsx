import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { createPlayer, fontStack } from "../../player/player.js";
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
const rad = (d) => (d * Math.PI) / 180;

/**
 * The editing canvas: the real player in edit mode, with a selection box,
 * resize/rotate handles, snapping guides and inline text editing on top.
 */
export const Canvas = forwardRef(function Canvas(
  { project, pageIndex, selectedId, onSelect, onChange, onCommitText, animate, dropTarget },
  ref,
) {
  const hostRef = useRef(null);
  const areaRef = useRef(null);
  const playerRef = useRef(null);
  const [zoom, setZoom] = useState(null); // null = fit
  const [fitScale, setFitScale] = useState(1);
  const [box, setBox] = useState(null); // stage offset within the area
  const [guides, setGuides] = useState([]);
  const [editing, setEditing] = useState(null); // element id being text-edited
  const drag = useRef(null);
  const page = project.pages[pageIndex];
  const selected = page.elements.find((e) => e.id === selectedId) ?? null;
  const scale = zoom ?? fitScale;

  // --- player ---------------------------------------------------------------

  useEffect(() => {
    const player = createPlayer(hostRef.current, project, { mode: "edit", page: pageIndex, scale: 1, animate });
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
    const s = Math.max(0.05, Math.min((r.width - 64) / project.canvas.w, (r.height - 64) / project.canvas.h));
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
  }, [scale, project.canvas.w, project.canvas.h, updateBox]);

  // --- coordinates -----------------------------------------------------------

  const toCanvas = useCallback(
    (clientX, clientY) => {
      const s = playerRef.current.stage.getBoundingClientRect();
      return { x: (clientX - s.left) / scale, y: (clientY - s.top) / scale };
    },
    [scale],
  );

  useImperativeHandle(
    ref,
    () => ({
      toCanvas,
      /** Topmost element under a screen point (for drops), or null. */
      elementAt(clientX, clientY) {
        const hit = document.elementsFromPoint(clientX, clientY).find((n) => n.closest?.(".ad-el"));
        const id = hit?.closest(".ad-el")?.dataset.id;
        return page.elements.find((e) => e.id === id) ?? null;
      },
      isOverCanvas(clientX, clientY) {
        const s = playerRef.current?.stage.getBoundingClientRect();
        return !!s && clientX >= s.left && clientX <= s.right && clientY >= s.top && clientY <= s.bottom;
      },
    }),
    [toCanvas, page.elements],
  );

  // --- snapping ----------------------------------------------------------------

  function snapMove(el, nx, ny) {
    const { w: cw, h: ch } = project.canvas;
    const t = SNAP_PX / scale;
    const xs = [0, cw / 2, cw];
    const ys = [0, ch / 2, ch];
    for (const o of page.elements) {
      if (o.id === el.id || o.hidden) continue;
      xs.push(o.x, o.x + o.w / 2, o.x + o.w);
      ys.push(o.y, o.y + o.h / 2, o.y + o.h);
    }
    const found = [];
    const snapAxis = (pos, size, lines, axis) => {
      let best = null;
      for (const [k, off] of [[0, 0], [1, size / 2], [2, size]]) {
        for (const line of lines) {
          const d = line - (pos + off);
          if (Math.abs(d) <= t && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, line, k };
        }
      }
      if (best) found.push({ axis, at: best.line });
      return best ? pos + best.d : pos;
    };
    const x = snapAxis(nx, el.w, xs, "x");
    const y = snapAxis(ny, el.h, ys, "y");
    return { x, y, guides: found };
  }

  // --- pointer interactions ------------------------------------------------------

  function onPointerDown(e) {
    if (e.button !== 0 || editing) return;
    const id = e.target.closest?.(".ad-el")?.dataset.id;
    const el = page.elements.find((x) => x.id === id);
    if (!el) {
      if (e.target.closest?.("[data-handle]")) return;
      onSelect(null);
      return;
    }
    onSelect(el.id);
    if (el.locked) return;
    e.preventDefault();
    areaRef.current.setPointerCapture(e.pointerId);
    drag.current = { kind: "move", id: el.id, start: toCanvas(e.clientX, e.clientY), el: { ...el }, moved: false };
  }

  function startHandle(e, handle) {
    if (!selected || selected.locked) return;
    e.preventDefault();
    e.stopPropagation();
    areaRef.current.setPointerCapture(e.pointerId);
    drag.current = { kind: handle.id === "rot" ? "rotate" : "resize", handle, id: selected.id, start: toCanvas(e.clientX, e.clientY), el: { ...selected } };
  }

  function onPointerMove(e) {
    const d = drag.current;
    if (!d) return;
    const p = toCanvas(e.clientX, e.clientY);
    const el = d.el;
    if (d.kind === "move") {
      const dx = p.x - d.start.x;
      const dy = p.y - d.start.y;
      if (!d.moved && Math.hypot(dx, dy) * scale < 3) return;
      d.moved = true;
      let nx = el.x + dx;
      let ny = el.y + dy;
      if (!e.altKey && !el.rotation) {
        const s = snapMove(el, nx, ny);
        nx = s.x;
        ny = s.y;
        setGuides(s.guides);
      } else setGuides([]);
      onChange(d.id, { x: Math.round(nx), y: Math.round(ny) });
    } else if (d.kind === "rotate") {
      const cx = el.x + el.w / 2;
      const cy = el.y + el.h / 2;
      let angle = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
      if (e.shiftKey) angle = Math.round(angle / 15) * 15;
      else if (Math.abs(((angle % 90) + 90) % 90) < 3 || Math.abs(((angle % 90) + 90) % 90) > 87) angle = Math.round(angle / 90) * 90;
      angle = ((angle + 540) % 360) - 180;
      onChange(d.id, { rotation: Math.round(angle * 10) / 10 });
    } else {
      // Resize in the element's own (rotated) frame, keeping the opposite
      // edge or corner where it is.
      const { sx, sy } = d.handle;
      const r = rad(el.rotation);
      const wx = p.x - d.start.x;
      const wy = p.y - d.start.y;
      const lx = wx * Math.cos(r) + wy * Math.sin(r);
      const ly = -wx * Math.sin(r) + wy * Math.cos(r);
      let w = sx ? el.w + sx * lx : el.w;
      let h = sy ? el.h + sy * ly : el.h;
      const keepRatio = (sx && sy && (el.type === "image" || el.type === "sticker")) !== e.shiftKey && sx && sy;
      if (keepRatio) {
        const k = Math.max(w / el.w, h / el.h);
        w = el.w * k;
        h = el.h * k;
      }
      w = Math.max(MIN_SIZE, w);
      h = Math.max(MIN_SIZE, h);
      const shiftX = ((w - el.w) / 2) * sx;
      const shiftY = ((h - el.h) / 2) * sy;
      const cx = el.x + el.w / 2 + shiftX * Math.cos(r) - shiftY * Math.sin(r);
      const cy = el.y + el.h / 2 + shiftX * Math.sin(r) + shiftY * Math.cos(r);
      onChange(d.id, { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w: Math.round(w), h: Math.round(h) });
    }
  }

  function onPointerUp() {
    drag.current = null;
    setGuides([]);
  }

  function onDoubleClick(e) {
    // Pointer capture retargets the event to the area; hit-test instead.
    const hit = document.elementsFromPoint(e.clientX, e.clientY).find((n) => n.closest?.(".ad-el"));
    const id = hit?.closest(".ad-el")?.dataset.id;
    const el = page.elements.find((x) => x.id === id);
    if (el && !el.locked && (el.type === "text" || el.type === "button" || el.type === "sticker")) setEditing(el.id);
  }

  // Wheel: Ctrl+wheel zooms.
  function onWheel(e) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom((z) => Math.min(4, Math.max(0.05, (z ?? fitScale) * (e.deltaY > 0 ? 0.9 : 1.1))));
  }
  useEffect(() => {
    const area = areaRef.current;
    area.addEventListener("wheel", onWheel, { passive: false });
    return () => area.removeEventListener("wheel", onWheel);
  });

  // Stop editing when the selection changes.
  useEffect(() => {
    if (editing && editing !== selectedId) setEditing(null);
  }, [selectedId, editing]);

  // --- overlay geometry -----------------------------------------------------------

  const overlay =
    selected && box
      ? {
          left: box.left + selected.x * scale,
          top: box.top + selected.y * scale,
          width: selected.w * scale,
          height: selected.h * scale,
          transform: `rotate(${selected.rotation}deg)`,
        }
      : null;
  const editingEl = editing ? page.elements.find((x) => x.id === editing) : null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={areaRef}
        className="scroll-thin relative min-h-0 flex-1 overflow-auto"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        data-testid="canvas-area"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
      >
        <div
          ref={hostRef}
          className="relative shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
          style={{
            width: Math.max(project.canvas.w * scale + 64, 10),
            height: Math.max(project.canvas.h * scale + 64, 10),
            minWidth: "100%",
            minHeight: "100%",
          }}
        />

        {guides.map((g, i) =>
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
                ? {
                    left: box.left + dropTarget.el.x * scale,
                    top: box.top + dropTarget.el.y * scale,
                    width: dropTarget.el.w * scale,
                    height: dropTarget.el.h * scale,
                    transform: `rotate(${dropTarget.el.rotation}deg)`,
                  }
                : { left: box.left, top: box.top, width: project.canvas.w * scale, height: project.canvas.h * scale }
            }
          >
            <span className="rounded-lg bg-black/60 px-2.5 py-1">{dropTarget.label}</span>
          </div>
        )}

        {overlay && !editingEl && (
          <div className="pointer-events-none absolute" style={overlay} data-testid="selection">
            <div className={`absolute -inset-px rounded-[2px] border ${selected.locked ? "border-dashed border-amber-300" : "border-accent-2"}`} />
            {!selected.locked && (
              <>
                {HANDLES.map((h) => (
                  <span
                    key={h.id}
                    data-handle={h.id}
                    onPointerDown={(e) => startHandle(e, h)}
                    className="pointer-events-auto absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent-2 bg-white shadow"
                    style={{ left: `${(h.sx + 1) * 50}%`, top: `${(h.sy + 1) * 50}%`, cursor: h.cursor }}
                  />
                ))}
                <span className="absolute left-1/2 h-5 w-px -translate-x-1/2 bg-accent-2" style={{ top: -22 }} />
                <span
                  data-handle="rot"
                  title="Drag to rotate (Shift snaps)"
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

        {editingEl && overlay && (
          <InlineEditor
            el={editingEl}
            style={overlay}
            scale={scale}
            onDone={(value) => {
              setEditing(null);
              if (value !== null) onCommitText(editingEl, value);
            }}
          />
        )}
      </div>

      {/* Zoom controls */}
      <div className="absolute right-3 bottom-3 flex items-center gap-0.5 rounded-xl border border-white/10 bg-[#12131c]/95 p-0.5 text-[11.5px] shadow-lg">
        <IconButton label="Zoom out" onClick={() => setZoom(Math.max(0.05, scale / 1.25))}>
          −
        </IconButton>
        <button
          type="button"
          onClick={() => setZoom(null)}
          title="Fit to window"
          className="press focus-ring min-w-14 rounded-lg px-2 py-1.5 font-mono text-[11px] text-ink/85 hover:bg-white/10"
        >
          {zoom === null ? "Fit" : `${Math.round(scale * 100)}%`}
        </button>
        <IconButton label="Zoom in" onClick={() => setZoom(Math.min(4, scale * 1.25))}>
          +
        </IconButton>
      </div>
    </div>
  );
});

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
