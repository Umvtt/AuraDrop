import { useCallback, useId, useRef, useState } from "react";

export function Section({ icon, title, hint, children, action }) {
  return (
    <section className="glass-panel rounded-2xl p-4">
      <header className="mb-3 flex items-center gap-2">
        <span className="text-base leading-none" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[13px] font-semibold tracking-wide text-ink">{title}</h2>
          {hint && <p className="text-[11px] leading-snug text-muted">{hint}</p>}
        </div>
        {action}
      </header>
      <div className="flex flex-col gap-3.5">{children}</div>
    </section>
  );
}

/**
 * Range slider with plain-English end labels and a springy thumb.
 * `format` turns the value into the little readout on the right.
 */
export function Slider({ label, value, min, max, step = 1, onChange, format, left, right }) {
  const id = useId();
  const p = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label htmlFor={id} className="text-[12px] font-medium text-ink/90">
          {label}
        </label>
        <span className="rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-muted tabular-nums">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        id={id}
        type="range"
        className="spring-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--p": `${p}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {(left || right) && (
        <div className="mt-0.5 flex justify-between text-[10.5px] text-muted/80">
          <span>{left}</span>
          <span>{right}</span>
        </div>
      )}
    </div>
  );
}

export function Toggle({ label, hint, checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="press focus-ring flex w-full items-center gap-3 rounded-xl px-1 py-0.5 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-medium text-ink/90">{label}</span>
        {hint && <span className="block text-[11px] text-muted">{hint}</span>}
      </span>
      <span
        className={`relative h-[22px] w-[38px] flex-none rounded-full border transition-colors duration-200 ${
          checked ? "border-transparent bg-gradient-to-r from-accent to-accent-2" : "border-white/10 bg-white/10"
        }`}
      >
        <span
          className="absolute top-[2px] left-[2px] size-4 rounded-full bg-white shadow-md transition-[translate] duration-400 ease-spring"
          style={{ translate: checked ? "16px 0" : "0 0" }}
        />
      </span>
    </button>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-xl bg-black/25 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`press focus-ring flex-1 rounded-lg px-2 py-1.5 text-[11.5px] font-medium whitespace-nowrap ${
            value === o.id ? "bg-white/15 text-white shadow-sm" : "text-muted hover:bg-white/5 hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function IconButton({ label, onClick, children, disabled, className = "", active }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`press focus-ring grid size-8 place-items-center rounded-lg text-ink/80 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-35 ${
        active ? "bg-white/10 text-white" : ""
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function TextField({ label, value, onChange, placeholder, maxLength, multiline }) {
  const id = useId();
  const Tag = multiline ? "textarea" : "input";
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[12px] font-medium text-ink/90">
        {label}
      </label>
      <Tag
        id={id}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={multiline ? 2 : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-none rounded-lg border border-white/10 bg-black/25 px-2.5 py-1.5 text-[12.5px] text-ink placeholder:text-muted/60 focus:border-accent/70 focus:outline-none"
      />
    </div>
  );
}

/** Circular dial for the gradient angle. Drag, click, scroll or use arrow keys. */
export function AngleWheel({ value, onChange, colors }) {
  const ref = useRef(null);

  const fromPointer = useCallback(
    (e) => {
      const r = ref.current.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      // 0deg = up, clockwise – same convention as CSS linear-gradient.
      let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (deg < 0) deg += 360;
      onChange(Math.round(deg) % 360);
    },
    [onChange],
  );

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    fromPointer(e);
  };
  const onPointerMove = (e) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e);
  };
  const onKeyDown = (e) => {
    const delta = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 }[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    onChange((value + delta * (e.shiftKey ? 3 : 1) + 360) % 360);
  };

  return (
    <div className="flex items-center gap-3">
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label="Gradient angle"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={value}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
        onWheel={(e) => onChange((value + (e.deltaY > 0 ? 5 : -5) + 360) % 360)}
        className="focus-ring relative size-[72px] flex-none cursor-grab touch-none rounded-full border border-white/15 active:cursor-grabbing"
        style={{
          background: `conic-gradient(from 0deg, ${[...colors, colors[0]].join(", ")})`,
          boxShadow: "inset 0 0 0 6px rgba(8,9,14,0.55), 0 6px 18px rgba(0,0,0,0.35)",
        }}
      >
        <div className="absolute inset-[10px] grid place-items-center rounded-full bg-[#0d0e15]/85">
          <span className="font-mono text-[11px] text-ink tabular-nums">{value}°</span>
        </div>
        <div
          className="pointer-events-none absolute inset-0 transition-[rotate] duration-300 ease-spring"
          style={{ rotate: `${value}deg` }}
        >
          <span className="absolute top-[1px] left-1/2 size-3 -translate-x-1/2 rounded-full border-2 border-white bg-accent shadow-[0_0_10px_rgba(255,255,255,0.6)]" />
        </div>
      </div>
      <p className="text-[11px] leading-snug text-muted">
        Spin the wheel to point the glow. Scroll or use the arrow keys for small nudges.
      </p>
    </div>
  );
}

/**
 * The mesh pad: a mini preview of the aura with a draggable dot for every
 * colour point. Click a dot to select it, drag to move it.
 */
export function MeshPad({ points, selectedId, onSelect, onMove, background }) {
  const ref = useRef(null);
  const [dragId, setDragId] = useState(null);

  const move = (e, id) => {
    const r = ref.current.getBoundingClientRect();
    const x = Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
    const y = Math.round(Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)));
    onMove(id, x, y);
  };

  return (
    <div
      ref={ref}
      className="relative h-[132px] touch-none overflow-hidden rounded-xl border border-white/10"
      style={{ background, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)" }}
      onPointerMove={(e) => dragId && move(e, dragId)}
      onPointerUp={() => setDragId(null)}
      onPointerCancel={() => setDragId(null)}
    >
      {points.map((p, i) => (
        <button
          key={p.id}
          type="button"
          aria-label={`Colour point ${i + 1}`}
          onPointerDown={(e) => {
            e.preventDefault();
            ref.current.setPointerCapture(e.pointerId);
            onSelect(p.id);
            setDragId(p.id);
          }}
          onKeyDown={(e) => {
            const d = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }[e.key];
            if (!d) return;
            e.preventDefault();
            onMove(p.id, Math.min(100, Math.max(0, p.x + d[0])), Math.min(100, Math.max(0, p.y + d[1])));
          }}
          className={`focus-ring absolute size-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 transition-[scale] duration-300 ease-spring active:cursor-grabbing ${
            p.id === selectedId ? "scale-125 border-white" : "border-white/70 hover:scale-110"
          }`}
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            background: p.color,
            boxShadow: `0 0 0 3px rgba(0,0,0,0.25), 0 0 16px ${p.color}`,
          }}
        />
      ))}
    </div>
  );
}

/** Colour swatch that opens the system picker, plus the hex value. */
export function ColorInput({ label, value, onChange }) {
  return (
    <label className="press flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-black/25 py-1 pr-2 pl-1 hover:border-white/20">
      <span className="relative size-6 flex-none overflow-hidden rounded-md border border-white/25" style={{ background: value }}>
        <input
          type="color"
          value={value}
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </span>
      <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink/85">{label}</span>
      <span className="font-mono text-[10.5px] text-muted uppercase">{value}</span>
    </label>
  );
}

export function Select({ label, value, onChange, options, hideLabel }) {
  const id = useId();
  return (
    <div>
      {!hideLabel && (
        <label htmlFor={id} className="mb-1 block text-[12px] font-medium text-ink/90">
          {label}
        </label>
      )}
      <select
        id={id}
        aria-label={hideLabel ? label : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full cursor-pointer rounded-lg border border-white/10 bg-[#161722] px-2 py-1.5 text-[12.5px] text-ink focus:border-accent/70 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} style={o.style}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Compact number box (position, size, rotation). */
export function NumberInput({ label, value, onChange, step = 1, min, max, suffix }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/25 px-2 py-1 focus-within:border-accent/70">
      <span className="text-[10.5px] font-semibold text-muted">{label}</span>
      <input
        id={id}
        type="number"
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="w-full min-w-0 bg-transparent text-right font-mono text-[11.5px] text-ink focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      {suffix && <span className="text-[10.5px] text-muted">{suffix}</span>}
    </label>
  );
}
