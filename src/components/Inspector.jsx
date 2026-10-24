import { useState } from "react";
import { BLEND_MODES, LIMITS, meshGradient, newPointId, VIBES } from "../lib/design.js";
import { AngleWheel, IconButton, MeshPad, Section, Segmented, Slider, TextField, Toggle } from "./controls.jsx";
import { Icons } from "./TitleBar.jsx";

const px = (v) => `${v}px`;
const pct = (v) => `${Math.round(v * 100)}%`;

/** The Magic Studio: plain-English controls for every part of the card. */
export function Inspector({ design, set, onPickImage }) {
  const [selectedPoint, setSelectedPoint] = useState(design.aura.points[0].id);
  const { aura, vibes, tilt, content } = design;
  const point = aura.points.find((p) => p.id === selectedPoint) ?? aura.points[0];

  const patch = (key, value) => set((d) => ({ ...d, [key]: value }));
  const patchAura = (values) => set((d) => ({ ...d, aura: { ...d.aura, ...values } }));
  const patchContent = (values) => set((d) => ({ ...d, content: { ...d.content, ...values } }));
  const updatePoint = (id, values) =>
    patchAura({ points: aura.points.map((p) => (p.id === id ? { ...p, ...values } : p)) });

  const addPoint = () => {
    if (aura.points.length >= LIMITS.points[1]) return;
    const p = { id: newPointId(), color: "#f59e0b", x: 50, y: 50 };
    patchAura({ points: [...aura.points, p] });
    setSelectedPoint(p.id);
  };
  const removePoint = () => {
    if (aura.points.length <= LIMITS.points[0]) return;
    const rest = aura.points.filter((p) => p.id !== point.id);
    patchAura({ points: rest });
    setSelectedPoint(rest[0].id);
  };

  return (
    <aside className="scroll-thin flex w-[340px] flex-none flex-col gap-2.5 overflow-y-auto px-3 pt-1 pb-3">
      <div className="px-1 pt-1 pb-0.5">
        <h1 className="font-display text-[15px] font-semibold">Magic Studio</h1>
        <p className="text-[11.5px] text-muted">Every change shows up on the card instantly.</p>
      </div>

      <Section icon="❄️" title="Frostiness" hint="How blurry the glass is">
        <Slider
          label="Frost"
          value={design.frost}
          min={LIMITS.frost[0]}
          max={LIMITS.frost[1]}
          onChange={(v) => patch("frost", v)}
          format={px}
          left="Crystal clear"
          right="Heavy frost"
        />
        <Slider
          label="Glass thickness"
          value={design.fill}
          min={LIMITS.fill[0]}
          max={LIMITS.fill[1]}
          step={0.01}
          onChange={(v) => patch("fill", v)}
          format={pct}
          left="See-through"
          right="Milky"
        />
      </Section>

      <Section icon="✨" title="Glass Shine" hint="Edge highlights and the light that follows your cursor">
        <Slider
          label="Shine"
          value={design.shine}
          min={LIMITS.shine[0]}
          max={LIMITS.shine[1]}
          step={0.01}
          onChange={(v) => patch("shine", v)}
          format={pct}
          left="Matte"
          right="Sparkly"
        />
      </Section>

      <Section icon="🫧" title="Squish & Shape" hint="Corners and size">
        <Slider
          label="Corner roundness"
          value={design.radius}
          min={LIMITS.radius[0]}
          max={LIMITS.radius[1]}
          onChange={(v) => patch("radius", v)}
          format={px}
          left="Tech sharp"
          right="Pill squircle"
        />
        <div className="grid grid-cols-2 gap-3">
          <Slider label="Width" value={design.width} min={LIMITS.width[0]} max={LIMITS.width[1]} step={4} onChange={(v) => patch("width", v)} format={px} />
          <Slider label="Height" value={design.height} min={LIMITS.height[0]} max={LIMITS.height[1]} step={4} onChange={(v) => patch("height", v)} format={px} />
        </div>
      </Section>

      <Section
        icon="🌈"
        title="Color & Aura"
        hint="Drag the dots to move the glow around"
        action={
          <div className="flex gap-0.5">
            <IconButton label="Remove colour" onClick={removePoint} disabled={aura.points.length <= LIMITS.points[0]}>
              {Icons.minus}
            </IconButton>
            <IconButton label="Add colour" onClick={addPoint} disabled={aura.points.length >= LIMITS.points[1]}>
              {Icons.plus}
            </IconButton>
          </div>
        }
      >
        <MeshPad
          points={aura.points}
          selectedId={point.id}
          onSelect={setSelectedPoint}
          onMove={(id, x, y) => updatePoint(id, { x, y })}
          background={`${meshGradient(aura)}, #08090e`}
        />
        <div className="flex items-center gap-2">
          {aura.points.map((p, i) => (
            <label
              key={p.id}
              title={`Colour ${i + 1} – click to change`}
              onPointerDown={() => setSelectedPoint(p.id)}
              className={`press relative size-8 cursor-pointer overflow-hidden rounded-full border-2 ${
                p.id === point.id ? "border-white" : "border-white/20 hover:border-white/50"
              }`}
              style={{ background: p.color, boxShadow: `0 0 12px ${p.color}66` }}
            >
              <input
                type="color"
                value={p.color}
                onChange={(e) => updatePoint(p.id, { color: e.target.value })}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label={`Colour ${i + 1}`}
              />
            </label>
          ))}
          <span className="ml-auto font-mono text-[11px] text-muted uppercase">{point.color}</span>
        </div>

        <AngleWheel value={aura.angle} onChange={(angle) => patchAura({ angle })} colors={aura.points.map((p) => p.color)} />

        <Slider
          label="Aura strength"
          value={aura.strength}
          min={LIMITS.strength[0]}
          max={LIMITS.strength[1]}
          step={0.01}
          onChange={(strength) => patchAura({ strength })}
          format={pct}
          left="Subtle"
          right="Bold"
        />
        <div>
          <p className="mb-1 text-[12px] font-medium text-ink/90">Blend style</p>
          <Segmented
            label="Blend style"
            value={aura.blend}
            onChange={(blend) => patchAura({ blend })}
            options={BLEND_MODES}
          />
        </div>
        <Toggle
          label="Floating orbs"
          hint="Glowing blobs behind the card"
          checked={aura.orbs}
          onChange={(orbs) => patchAura({ orbs })}
        />
        {aura.orbs && (
          <Slider
            label="Orb drift speed"
            value={aura.drift}
            min={LIMITS.drift[0]}
            max={LIMITS.drift[1]}
            step={0.1}
            onChange={(drift) => patchAura({ drift })}
            format={(v) => (v === 0 ? "still" : `${v.toFixed(1)}×`)}
            left="Still"
            right="Zoomy"
          />
        )}
      </Section>

      <Section icon="🎬" title="Vibes" hint="One-click animations. Mix as many as you like!">
        <div className="grid grid-cols-2 gap-2">
          {VIBES.map((v) => {
            const on = vibes[v.id];
            return (
              <button
                key={v.id}
                type="button"
                aria-pressed={on}
                title={v.hint}
                onClick={() => set((d) => ({ ...d, vibes: { ...d.vibes, [v.id]: !on } }))}
                className={`press focus-ring flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left ${
                  on
                    ? "border-accent/60 bg-gradient-to-br from-accent/25 to-accent-2/15 text-white shadow-[0_0_18px_rgba(167,139,250,0.25)]"
                    : "border-white/8 bg-white/[0.03] text-ink/80 hover:bg-white/[0.07]"
                }`}
              >
                <span className="text-lg leading-none">{v.emoji}</span>
                <span className="text-[12px] font-semibold">{v.label}</span>
                <span className="text-[10.5px] leading-tight text-muted">{v.hint}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section icon="🧲" title="3D Tilt" hint="The card leans toward your cursor">
        <Toggle label="Tilt on hover" checked={tilt.enabled} onChange={(enabled) => patch("tilt", { ...tilt, enabled })} />
        {tilt.enabled && (
          <Slider
            label="Tilt amount"
            value={tilt.max}
            min={LIMITS.tiltMax[0]}
            max={LIMITS.tiltMax[1]}
            onChange={(max) => patch("tilt", { ...tilt, max })}
            format={(v) => `${v}°`}
            left="Gentle"
            right="Wild"
          />
        )}
      </Section>

      <Section icon="📝" title="Card Content" hint="Words and pictures on the card">
        <div className="grid grid-cols-[64px_1fr] gap-2">
          <TextField label="Emoji" value={content.emoji} maxLength={8} onChange={(emoji) => patchContent({ emoji })} />
          <TextField label="Title" value={content.title} maxLength={80} onChange={(title) => patchContent({ title })} />
        </div>
        <TextField label="Subtitle" multiline value={content.subtitle} maxLength={240} onChange={(subtitle) => patchContent({ subtitle })} />
        <TextField label="Button text" placeholder="Leave empty to hide" value={content.button} maxLength={40} onChange={(button) => patchContent({ button })} />

        <ImageRow
          label="Background picture"
          value={content.background}
          onPick={() => onPickImage("background")}
          onClear={() => patchContent({ background: null })}
        />
        {content.background && (
          <Slider
            label="Picture visibility"
            value={content.backgroundOpacity}
            min={0}
            max={1}
            step={0.01}
            onChange={(backgroundOpacity) => patchContent({ backgroundOpacity })}
            format={pct}
          />
        )}
        <ImageRow
          label="Avatar picture"
          value={content.avatar}
          round
          onPick={() => onPickImage("avatar")}
          onClear={() => patchContent({ avatar: null })}
        />
        <p className="text-[11px] text-muted">Tip: drag a picture from your desktop straight onto the card or its avatar.</p>
      </Section>
    </aside>
  );
}

function ImageRow({ label, value, onPick, onClear, round }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`size-9 flex-none border border-white/15 bg-white/5 bg-cover bg-center ${round ? "rounded-full" : "rounded-lg"}`}
        style={value ? { backgroundImage: `url("${value}")` } : undefined}
      />
      <span className="flex-1 text-[12px] font-medium text-ink/90">{label}</span>
      <button
        type="button"
        onClick={onPick}
        className="press focus-ring flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11.5px] font-medium hover:bg-white/10"
      >
        {Icons.image} {value ? "Change" : "Choose"}
      </button>
      {value && (
        <IconButton label={`Remove ${label.toLowerCase()}`} onClick={onClear}>
          {Icons.trash}
        </IconButton>
      )}
    </div>
  );
}
