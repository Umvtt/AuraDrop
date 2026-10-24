import { useEffect, useMemo, useRef, useState } from "react";
import { Crop, Eraser, Pipette, RotateCcw, Wand2, X } from "lucide-react";
import { Segmented, Slider, Toggle } from "../controls.jsx";

const MAX_SIDE = 3000; // larger pictures are scaled down when edited
const PREVIEW_SIDE = 640;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't read that picture."));
    img.src = src;
  });
}

function toCanvas(img, maxSide) {
  const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * k));
  c.height = Math.max(1, Math.round(img.naturalHeight * k));
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c;
}

const hex = ([r, g, b]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

/**
 * Make the picked colours transparent. With `connected`, only the areas
 * joined to the picked points are removed (best for photos with a plain
 * background); otherwise every matching pixel is.
 */
export function keyOut(canvas, keys, { tolerance, softness, connected }) {
  const w = canvas.width;
  const h = canvas.height;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  const data = g.getImageData(0, 0, w, h);
  const px = data.data;
  const tol = (tolerance / 100) * 441;
  const soft = Math.max(1, (softness / 100) * 441);
  const dist = (i) => {
    let best = 1e9;
    for (const k of keys) {
      const dr = px[i] - k.rgb[0];
      const dg = px[i + 1] - k.rgb[1];
      const db = px[i + 2] - k.rgb[2];
      best = Math.min(best, Math.sqrt(dr * dr + dg * dg + db * db));
    }
    return best;
  };
  const apply = (i, d) => {
    const a = d <= tol ? 0 : d < tol + soft ? (d - tol) / soft : 1;
    px[i + 3] = Math.round(px[i + 3] * a);
  };
  if (!connected) {
    for (let i = 0; i < px.length; i += 4) apply(i, dist(i));
  } else {
    const seen = new Uint8Array(w * h);
    const stack = [];
    for (const k of keys) {
      const x = Math.min(w - 1, Math.max(0, Math.round(k.x * w)));
      const y = Math.min(h - 1, Math.max(0, Math.round(k.y * h)));
      stack.push(y * w + x);
    }
    while (stack.length) {
      const p = stack.pop();
      if (seen[p]) continue;
      seen[p] = 1;
      const d = dist(p * 4);
      if (d >= tol + soft) continue;
      apply(p * 4, d);
      const x = p % w;
      if (x > 0) stack.push(p - 1);
      if (x < w - 1) stack.push(p + 1);
      if (p >= w) stack.push(p - w);
      if (p < w * (h - 1)) stack.push(p + w);
    }
  }
  g.putImageData(data, 0, 0);
  return canvas;
}

function encode(canvas, transparent, sourceType) {
  if (!transparent && /jpe?g/.test(sourceType)) return canvas.toDataURL("image/jpeg", 0.92);
  return canvas.toDataURL("image/png");
}

/** Picture tools: crop, and remove a background by colour. */
export function PictureTools({ src, name, aspect, initialTab = "crop", hasOriginal, onApply, onRestore, onClose }) {
  const [tab, setTab] = useState(initialTab);
  const [img, setImg] = useState(null);
  const [error, setError] = useState(null);
  const sourceType = useMemo(() => /^data:([^;,]+)/.exec(src)?.[1] ?? "image/png", [src]);

  useEffect(() => {
    loadImage(src).then(setImg, (e) => setError(e.message));
  }, [src]);

  useEffect(() => {
    const key = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/55 p-6 backdrop-blur-[2px]" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="menu-surface pop-in flex max-h-[92vh] w-[min(980px,94vw)] flex-col gap-4 p-5!" role="dialog" aria-label="Picture tools" data-testid="picture-tools">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-[17px] font-semibold">Picture tools</h2>
          <div className="w-[300px]">
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { id: "crop", label: "Crop" },
                { id: "key", label: "Remove background" },
              ]}
            />
          </div>
          <span className="min-w-0 flex-1 truncate text-[12px] text-muted">{name}</span>
          {hasOriginal && (
            <button type="button" onClick={onRestore} className="chip-btn" title="Undo every crop and background removal">
              <RotateCcw size={14} /> Restore original
            </button>
          )}
          <button type="button" aria-label="Close" onClick={onClose} className="press grid size-8 place-items-center rounded-lg text-muted hover:bg-white/10 hover:text-ink">
            <X size={16} />
          </button>
        </div>
        {error && <p className="text-[13px] text-red-300">{error}</p>}
        {img && tab === "crop" && <CropTab img={img} aspect={aspect} onApply={(c) => onApply(encode(c, false, sourceType), { aspect: c.width / c.height })} onCancel={onClose} />}
        {img && tab === "key" && <KeyTab img={img} onApply={(c) => onApply(encode(c, true, sourceType), {})} onCancel={onClose} />}
      </div>
    </div>
  );
}

function Footer({ onCancel, onApply, label, disabled, children }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
      <button type="button" onClick={onCancel} className="chip-btn px-4 py-2">
        Cancel
      </button>
      <button type="button" disabled={disabled} onClick={onApply} data-testid="pt-apply" className="press focus-ring rounded-xl bg-gradient-to-r from-accent to-accent-2 px-5 py-2 text-[13px] font-semibold text-[#0b0c12] disabled:opacity-40">
        {label}
      </button>
    </div>
  );
}

// --- Crop ----------------------------------------------------------------------

const RATIOS = [
  { id: "free", label: "Free", r: null },
  { id: "element", label: "Like the layer", r: "element" },
  { id: "1:1", label: "1:1", r: 1 },
  { id: "4:3", label: "4:3", r: 4 / 3 },
  { id: "16:9", label: "16:9", r: 16 / 9 },
  { id: "9:16", label: "9:16", r: 9 / 16 },
];

function CropTab({ img, aspect, onApply, onCancel }) {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const [ratio, setRatio] = useState("free");
  const [rect, setRect] = useState({ x: 0, y: 0, w: 1, h: 1 }); // fractions of the picture
  const box = useRef(null);
  const drag = useRef(null);

  const target = (() => {
    const r = RATIOS.find((x) => x.id === ratio)?.r;
    return r === "element" ? aspect : r;
  })();

  // Snap the crop to the chosen ratio (largest centred area).
  const fitRatio = (r) => {
    if (!r) return;
    const imgR = W / H;
    let w = 1;
    let h = imgR / r;
    if (h > 1) {
      w = r / imgR;
      h = 1;
    }
    setRect({ x: (1 - w) / 2, y: (1 - h) / 2, w, h });
  };

  const view = (() => {
    const maxW = Math.min(900, window.innerWidth * 0.86);
    const maxH = window.innerHeight * 0.6;
    const k = Math.min(maxW / W, maxH / H);
    return { w: Math.round(W * k), h: Math.round(H * k) };
  })();

  const onDown = (e, handle) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { handle, x: e.clientX, y: e.clientY, start: rect };
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.x) / view.w;
    const dy = (e.clientY - d.y) / view.h;
    const s = d.start;
    const min = 0.03;
    let { x, y, w, h } = s;
    if (d.handle === "move") {
      x = Math.min(1 - w, Math.max(0, s.x + dx));
      y = Math.min(1 - h, Math.max(0, s.y + dy));
    } else {
      if (d.handle.includes("w")) {
        x = Math.min(s.x + s.w - min, Math.max(0, s.x + dx));
        w = s.x + s.w - x;
      }
      if (d.handle.includes("e")) w = Math.min(1 - s.x, Math.max(min, s.w + dx));
      if (d.handle.includes("n")) {
        y = Math.min(s.y + s.h - min, Math.max(0, s.y + dy));
        h = s.y + s.h - y;
      }
      if (d.handle.includes("s")) h = Math.min(1 - s.y, Math.max(min, s.h + dy));
      if (target) {
        // Keep the ratio: height follows width (in pixels).
        const hh = (w * W) / target / H;
        if (hh <= 1) {
          if (d.handle.includes("n")) y = Math.max(0, s.y + s.h - hh);
          h = Math.min(hh, 1 - y);
          w = (h * H * target) / W;
          if (d.handle.includes("w")) x = s.x + s.w - w;
        }
      }
    }
    setRect({ x, y, w, h });
  };
  const onUp = () => (drag.current = null);

  const apply = () => {
    const c = document.createElement("canvas");
    const sx = rect.x * W;
    const sy = rect.y * H;
    const sw = rect.w * W;
    const sh = rect.h * H;
    const k = Math.min(1, MAX_SIDE / Math.max(sw, sh));
    c.width = Math.max(1, Math.round(sw * k));
    c.height = Math.max(1, Math.round(sh * k));
    c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    onApply(c);
  };

  const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  const hpos = { n: [0.5, 0], s: [0.5, 1], e: [1, 0.5], w: [0, 0.5], nw: [0, 0], ne: [1, 0], sw: [0, 1], se: [1, 1] };
  const cursor = { n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize", nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize" };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {RATIOS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => {
              setRatio(r.id);
              fitRatio(r.r === "element" ? aspect : r.r);
            }}
            className={`press rounded-full border px-3 py-1 text-[12px] ${ratio === r.id ? "border-accent/60 bg-accent/20 text-ink" : "border-white/10 bg-white/[0.05] text-ink/80 hover:bg-white/[0.1]"}`}
          >
            {r.label}
          </button>
        ))}
        <span className="flex-1" />
        <span className="text-[12px] text-muted tabular-nums">
          {Math.round(rect.w * W)} × {Math.round(rect.h * H)} px
        </span>
      </div>
      <div className="grid place-items-center overflow-hidden rounded-xl bg-black/30 p-3">
        <div ref={box} className="relative touch-none select-none" style={{ width: view.w, height: view.h }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <img src={img.src} alt="" draggable={false} className="absolute inset-0 h-full w-full" />
          {/* Darken outside the crop. */}
          <div
            className="absolute"
            style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%`, boxShadow: "0 0 0 9999px rgba(0,0,0,.55)", outline: "1.5px solid rgba(255,255,255,.9)", cursor: "move" }}
            onPointerDown={(e) => onDown(e, "move")}
            data-testid="crop-rect"
          >
            {/* Rule-of-thirds guides. */}
            <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "linear-gradient(to right, transparent 33.1%, rgba(255,255,255,.35) 33.3%, transparent 33.5%, transparent 66.5%, rgba(255,255,255,.35) 66.7%, transparent 66.9%), linear-gradient(to bottom, transparent 33.1%, rgba(255,255,255,.35) 33.3%, transparent 33.5%, transparent 66.5%, rgba(255,255,255,.35) 66.7%, transparent 66.9%)" }} />
            {handles.map((hd) => (
              <span
                key={hd}
                onPointerDown={(e) => onDown(e, hd)}
                className="absolute size-3.5 rounded-sm border border-black/40 bg-white shadow"
                style={{ left: `calc(${hpos[hd][0] * 100}% - 7px)`, top: `calc(${hpos[hd][1] * 100}% - 7px)`, cursor: cursor[hd] }}
              />
            ))}
          </div>
        </div>
      </div>
      <Footer onCancel={onCancel} onApply={apply} label="Crop" disabled={rect.w > 0.999 && rect.h > 0.999}>
        <button type="button" onClick={() => (setRatio("free"), setRect({ x: 0, y: 0, w: 1, h: 1 }))} className="chip-btn">
          <Crop size={14} /> Reset
        </button>
        <span className="text-[11.5px] text-muted">Drag the box to move it, the corners to resize.</span>
      </Footer>
    </>
  );
}

// --- Remove background -------------------------------------------------------------

function KeyTab({ img, onApply, onCancel }) {
  const small = useMemo(() => toCanvas(img, PREVIEW_SIDE), [img]);
  const [keys, setKeys] = useState([]); // { rgb, x, y } with x/y as fractions
  const [tolerance, setTolerance] = useState(14);
  const [softness, setSoftness] = useState(8);
  const [connected, setConnected] = useState(true);
  const out = useRef(null);
  const [busy, setBusy] = useState(false);

  const sample = (fx, fy) => {
    const g = small.getContext("2d", { willReadFrequently: true });
    const x = Math.min(small.width - 1, Math.max(0, Math.round(fx * small.width)));
    const y = Math.min(small.height - 1, Math.max(0, Math.round(fy * small.height)));
    // Average a 3×3 patch so a noisy pixel doesn't throw it off.
    const d = g.getImageData(Math.max(0, x - 1), Math.max(0, y - 1), 3, 3).data;
    const rgb = [0, 0, 0];
    const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) rgb[c] += d[i + c] / n;
    return { rgb: rgb.map(Math.round), x: fx, y: fy };
  };

  const auto = () => setKeys([sample(0.005, 0.005), sample(0.995, 0.005), sample(0.005, 0.995), sample(0.995, 0.995)]);

  // Start with the corners: most cut-outs have a plain background.
  useEffect(() => {
    auto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [small]);

  // Live preview.
  useEffect(() => {
    const c = out.current;
    if (!c) return;
    c.width = small.width;
    c.height = small.height;
    const g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(small, 0, 0);
    if (keys.length) keyOut(c, keys, { tolerance, softness, connected });
  }, [small, keys, tolerance, softness, connected]);

  const pick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const s = sample((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    setKeys((k) => (e.shiftKey || e.ctrlKey ? [...k, s] : [s]).slice(-8));
  };

  const apply = () => {
    setBusy(true);
    // Let the button show "Working…" before the heavy pass.
    setTimeout(() => {
      const c = toCanvas(img, MAX_SIDE);
      keyOut(c, keys, { tolerance, softness, connected });
      onApply(c);
    }, 30);
  };

  const view = (() => {
    const maxW = Math.min(620, window.innerWidth * 0.55);
    const maxH = window.innerHeight * 0.58;
    const k = Math.min(maxW / small.width, maxH / small.height);
    return { w: Math.round(small.width * k), h: Math.round(small.height * k) };
  })();

  return (
    <>
      <div className="flex min-h-0 gap-4">
        <div className="grid flex-1 place-items-center rounded-xl p-3" style={{ background: "repeating-conic-gradient(#3a3d48 0% 25%, #2a2c35 0% 50%) 50% / 22px 22px" }}>
          <canvas ref={out} onPointerDown={pick} style={{ width: view.w, height: view.h, cursor: "crosshair" }} data-testid="key-canvas" />
        </div>
        <div className="flex w-[250px] flex-none flex-col gap-3">
          <p className="flex items-start gap-2 text-[12px] text-ink/80">
            <Pipette size={15} className="mt-0.5 flex-none text-accent" /> Click the background to remove that colour. Shift+click to add more colours.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {keys.map((k, i) => (
              <button
                key={i}
                type="button"
                title="Remove this colour from the list"
                onClick={() => setKeys((ks) => ks.filter((_, j) => j !== i))}
                className="size-7 rounded-lg border border-white/25 shadow-inner"
                style={{ background: hex(k.rgb) }}
              />
            ))}
            {!keys.length && <span className="text-[12px] text-muted">No colours picked</span>}
          </div>
          <Slider label="Tolerance" value={tolerance} min={0} max={60} onChange={setTolerance} format={(v) => `${v}`} left="Exact" right="Loose" />
          <Slider label="Soft edge" value={softness} min={0} max={40} onChange={setSoftness} format={(v) => `${v}`} left="Hard" right="Soft" />
          <Toggle label="Only touching areas" hint="Keeps the same colour inside the subject" checked={connected} onChange={setConnected} />
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={auto} className="chip-btn">
              <Wand2 size={14} /> Use corners
            </button>
            <button type="button" onClick={() => setKeys([])} className="chip-btn">
              <Eraser size={14} /> Clear
            </button>
          </div>
        </div>
      </div>
      <Footer onCancel={onCancel} onApply={apply} label={busy ? "Working…" : "Remove background"} disabled={!keys.length || busy}>
        <span className="text-[11.5px] text-muted">Works best on plain or green-screen backgrounds.</span>
      </Footer>
    </>
  );
}
