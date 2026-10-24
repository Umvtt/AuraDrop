import { useRef, useState } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  Copy,
  Crop,
  Group,
  Lock,
  LockOpen,
  Trash2,
  Ungroup,
  Wand2,
} from "lucide-react";
import {
  ACTION_TYPES,
  ANIMATIONS,
  BLEND_MODES,
  CANVAS_LIMITS,
  CANVAS_PRESETS,
  FONTS,
  MASKS,
  SHAPES,
  TRANSITIONS,
  createAction,
  safeUrl,
} from "../../lib/project.js";
import { AngleWheel, ColorInput, IconButton, NumberInput, Pro, Section, usePro, Segmented, Select, Slider, TextField, Toggle } from "../controls.jsx";
import { Icons } from "../TitleBar.jsx";

const px = (v) => `${Math.round(v)}px`;
const pct = (v) => `${Math.round(v * 100)}%`;
const TYPE_TITLE = { text: "Text", sticker: "Sticker", image: "Picture", shape: "Shape", glass: "Glass panel", button: "Button", vehicle: "Vehicle" };
const MASK_LABEL = { none: "No mask", ellipse: "Circle", triangle: "Triangle", star: "Star", heart: "Heart", bubble: "Speech bubble" };
const MASK_ICON = {
  ellipse: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18Z",
  triangle: "M12 3 22 20H2Z",
  star: "M12 2.5l2.8 6.1 6.7.7-5 4.5 1.4 6.6L12 17l-5.9 3.4 1.4-6.6-5-4.5 6.7-.7Z",
  heart: "M12 21C6 16.5 2.5 13 2.5 8.6 2.5 5.6 4.8 3.5 7.5 3.5c2 0 3.6 1.1 4.5 2.8.9-1.7 2.5-2.8 4.5-2.8 2.7 0 5 2.1 5 5.1 0 4.4-3.5 7.9-9.5 12.4Z",
  bubble: "M5 3h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-9l-5 4v-4a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z",
};
const SHAPE_LABEL = { rect: "Box", ellipse: "Circle", triangle: "Triangle", star: "Star", heart: "Heart", bubble: "Speech", arrow: "Arrow" };

/** Settings for the selection (one or many layers), or for the page. */
export function Inspector(props) {
  const { selected, selection = [] } = props;
  return (
    <aside className="glass-chrome panel-in flex w-[324px] flex-none flex-col overflow-hidden rounded-2xl">
      <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3" data-testid="inspector">
        {selection.length > 1 ? (
          <MultiPanel {...props} />
        ) : selected ? (
          <ElementPanel key={selected.id} {...props} el={selected} />
        ) : (
          <PagePanel {...props} />
        )}
      </div>
    </aside>
  );
}

/** Align buttons. With one layer they align to the canvas. */
export function AlignBar({ ids, align, distribute, many }) {
  const btn = (label, Icon, fn) => (
    <IconButton key={label} label={label} onClick={fn}>
      <Icon size={15} />
    </IconButton>
  );
  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-xl bg-black/25 p-1" role="toolbar" aria-label="Align">
      {btn("Align left", AlignStartVertical, () => align(ids, "left"))}
      {btn("Align centre", AlignCenterVertical, () => align(ids, "hcenter"))}
      {btn("Align right", AlignEndVertical, () => align(ids, "right"))}
      <span className="mx-0.5 h-4 w-px bg-white/10" />
      {btn("Align top", AlignStartHorizontal, () => align(ids, "top"))}
      {btn("Align middle", AlignCenterHorizontal, () => align(ids, "vcenter"))}
      {btn("Align bottom", AlignEndHorizontal, () => align(ids, "bottom"))}
      {many && (
        <>
          <span className="mx-0.5 h-4 w-px bg-white/10" />
          {btn("Spread out horizontally", AlignHorizontalDistributeCenter, () => distribute(ids, "x"))}
          {btn("Spread out vertically", AlignVerticalDistributeCenter, () => distribute(ids, "y"))}
        </>
      )}
    </div>
  );
}

/** Flip in place, or drop a mirrored copy on the other side of the page. */
function MirrorRow({ ids, mirror }) {
  const pro = usePro();
  if (!mirror) return null;
  const b = (label, title, fn, testid) => (
    <button type="button" title={title} onClick={fn} data-testid={testid} className="press rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] hover:bg-white/[0.1]">
      {label}
    </button>
  );
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="panel-label mr-1">Mirror</span>
      {b("Flip ↔", "Flip left-right (Shift+H)", () => mirror(ids, "x"), "mirror-x")}
      {b("Flip ↕", "Flip upside down (Shift+V)", () => mirror(ids, "y"), "mirror-y")}
      {b("Mirror copy ↔", "Add a mirrored copy on the other side of the page", () => mirror(ids, "x", { copy: true }), "mirror-copy-x")}
      {pro && b("Mirror copy ↕", "Add a mirrored copy on the other half (top/bottom)", () => mirror(ids, "y", { copy: true }), "mirror-copy-y")}
    </div>
  );
}

function MultiPanel({ selection, align, distribute, group, ungroup, updateMany, removeMany, duplicateMany, mirror }) {
  const ids = selection.map((e) => e.id);
  const groups = new Set(selection.map((e) => e.group).filter(Boolean));
  const oneGroup = groups.size === 1 && selection.every((e) => e.group);
  const opacity = selection[0].opacity;
  const locked = selection.every((e) => e.locked);
  const counts = selection.reduce((m, e) => ({ ...m, [e.type]: (m[e.type] ?? 0) + 1 }), {});
  return (
    <>
      <div className="flex items-center gap-2 px-1">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[15px] font-semibold">{oneGroup ? "Group" : `${selection.length} layers`}</h1>
          <p className="truncate text-[11px] text-muted">
            {Object.entries(counts)
              .map(([t, n]) => `${n} ${(TYPE_TITLE[t] ?? t).toLowerCase()}${n > 1 ? "s" : ""}`)
              .join(" · ")}
          </p>
        </div>
        <IconButton label="Duplicate (Ctrl+D)" onClick={() => duplicateMany(ids)}>
          <Copy size={15} />
        </IconButton>
        <IconButton label="Delete (Del)" onClick={() => removeMany(ids)} className="hover:bg-rose-500/25!">
          <Trash2 size={15} />
        </IconButton>
      </div>
      <Section icon="📐" title="Align & spread">
        <AlignBar ids={ids} align={align} distribute={distribute} many={selection.length >= 3} />
        <MirrorRow ids={ids} mirror={mirror} />
        <p className="text-[11px] text-muted">Spreading out needs three or more things. Groups move as one.</p>
      </Section>
      <Section icon="🧩" title="Group">
        <div className="flex gap-1.5">
          {oneGroup ? (
            <button type="button" onClick={() => ungroup(ids)} className="chip-btn flex-1">
              <Ungroup size={14} /> Ungroup
            </button>
          ) : (
            <button type="button" onClick={() => group(ids)} className="chip-btn flex-1">
              <Group size={14} /> Group (Ctrl+G)
            </button>
          )}
          <button type="button" onClick={() => updateMany(ids, (e) => ({ ...e, locked: !locked }), { step: true })} className="chip-btn flex-1">
            {locked ? <LockOpen size={14} /> : <Lock size={14} />} {locked ? "Unlock all" : "Lock all"}
          </button>
        </div>
        <p className="text-[11px] text-muted">Click a group to select all of it, double-click to pick one layer inside.</p>
      </Section>
      <Pro>
      <Section icon="🎚️" title="Together">
        <Slider label="Opacity" value={opacity} min={0} max={1} step={0.01} onChange={(o) => updateMany(ids, (e) => ({ ...e, opacity: o }))} format={pct} />
        <div className="flex flex-wrap gap-1">
          {[
            ["Straighten all", (e) => ({ ...e, rotation: 0 })],
            ["Show all at start", (e) => ({ ...e, hidden: false })],
            ["Stop animations", (e) => ({ ...e, anim: { ...e.anim, type: "none" } })],
          ].map(([label, fn]) => (
            <button key={label} type="button" onClick={() => updateMany(ids, fn, { step: true })} className="press rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] hover:bg-white/[0.1]">
              {label}
            </button>
          ))}
        </div>
      </Section>
      </Pro>
    </>
  );
}

// ---------------------------------------------------------------------------
// Element
// ---------------------------------------------------------------------------

function ElementPanel({ el, project, page, update, remove, duplicate, chooseImage, chooseSound, align, distribute, vehiclePanel, editPicture, mirror }) {
  const set = (patch) => update(el.id, patch);
  return (
    <>
      <div className="flex items-center gap-2 px-1">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[15px] font-semibold">{TYPE_TITLE[el.type]}</h1>
          <p className="truncate text-[11px] text-muted">{el.name}</p>
        </div>
        <IconButton label="Duplicate (Ctrl+D)" onClick={() => duplicate(el.id)}>
          <Copy size={15} />
        </IconButton>
        <IconButton label="Delete (Del)" onClick={() => remove(el.id)} className="hover:bg-rose-500/25!">
          <Trash2 size={15} />
        </IconButton>
      </div>

      {el.type === "text" && <TextPanel el={el} set={set} />}
      {el.type === "sticker" && <StickerPanel el={el} set={set} />}
      {el.type === "image" && <ImagePanel el={el} set={set} project={project} chooseImage={chooseImage} editPicture={editPicture} />}
      {el.type === "shape" && <ShapePanel el={el} set={set} />}
      {el.type === "glass" && <GlassPanel el={el} set={set} />}
      {el.type === "button" && <ButtonPanel el={el} set={set} />}
      {el.type === "vehicle" && vehiclePanel?.(el, set)}

      <ActionsPanel el={el} set={set} project={project} page={page} chooseSound={chooseSound} />
      <AnimationPanel el={el} set={set} />
      <ArrangePanel el={el} set={set} canvas={project.canvas} align={align} distribute={distribute} mirror={mirror} />
    </>
  );
}

function TextPanel({ el, set }) {
  const font = FONTS.find((f) => f.id === el.font) ?? FONTS[0];
  return (
    <Section icon="🔤" title="Text" hint="Double-click the text on the canvas to type">
      <TextField label="Words" multiline value={el.text} maxLength={2000} onChange={(text) => set({ text })} />
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <Select
          label="Font"
          value={el.font}
          onChange={(v) => {
            const f = FONTS.find((x) => x.id === v);
            set({ font: v, weight: f.weights.includes(el.weight) ? el.weight : f.weights[f.weights.length - 1] });
          }}
          options={FONTS.map((f) => ({ value: f.id, label: f.label, style: { fontFamily: f.css } }))}
        />
        <Select label="Weight" value={String(el.weight)} onChange={(v) => set({ weight: Number(v) })} options={font.weights.map((w) => ({ value: String(w), label: { 400: "Regular", 500: "Medium", 600: "Semi", 700: "Bold", 800: "Heavy", 900: "Black" }[w] }))} />
      </div>
      <Slider label="Size" value={el.size} min={8} max={400} onChange={(size) => set({ size })} format={px} />
      <ColorInput label="Colour" value={el.color} onChange={(color) => set({ color })} />
      <Segmented label="Align" value={el.align} onChange={(align) => set({ align })} options={[{ id: "left", label: "Left" }, { id: "center", label: "Centre" }, { id: "right", label: "Right" }]} />
      <Toggle label="ALL CAPS" checked={el.upper} onChange={(upper) => set({ upper })} />
      <Pro>
      <div className="grid grid-cols-2 gap-3">
        <Slider label="Spacing" value={el.spacing} min={-10} max={40} onChange={(spacing) => set({ spacing })} format={px} />
        <Slider label="Line height" value={el.lineHeight} min={0.7} max={2.5} step={0.05} onChange={(lineHeight) => set({ lineHeight })} format={(v) => v.toFixed(2)} />
      </div>
      </Pro>
      <SubHeading>Meme outline</SubHeading>
      <Slider label="Outline" value={el.stroke.width} min={0} max={30} onChange={(width) => set({ stroke: { width } })} format={px} left="None" right="Chunky" />
      {el.stroke.width > 0 && <ColorInput label="Outline colour" value={el.stroke.color} onChange={(color) => set({ stroke: { color } })} />}
      <Toggle label="Shadow" checked={el.shadow.on} onChange={(on) => set({ shadow: { on } })} />
      {el.shadow.on && (
        <Pro>
          <ColorInput label="Shadow colour" value={el.shadow.color} onChange={(color) => set({ shadow: { color } })} />
          <div className="grid grid-cols-2 gap-3">
            <Slider label="Blur" value={el.shadow.blur} min={0} max={80} onChange={(blur) => set({ shadow: { blur } })} format={px} />
            <Slider label="Strength" value={el.shadow.opacity} min={0} max={1} step={0.01} onChange={(opacity) => set({ shadow: { opacity } })} format={pct} />
          </div>
        </Pro>
      )}
      <Toggle label="Highlight box" hint="A coloured box behind the words" checked={el.bg.on} onChange={(on) => set({ bg: { on } })} />
      {el.bg.on && (
        <>
          <ColorInput label="Box colour" value={el.bg.color} onChange={(color) => set({ bg: { color } })} />
          <div className="grid grid-cols-2 gap-3">
            <Slider label="Opacity" value={el.bg.opacity} min={0} max={1} step={0.01} onChange={(opacity) => set({ bg: { opacity } })} format={pct} />
            <Slider label="Corners" value={el.bg.radius} min={0} max={80} onChange={(radius) => set({ bg: { radius } })} format={px} />
          </div>
        </>
      )}
    </Section>
  );
}

function StickerPanel({ el, set }) {
  return (
    <Section icon="🙂" title="Sticker" hint="Any emoji works – paste one in">
      <TextField label="Emoji" value={el.emoji} maxLength={16} onChange={(emoji) => set({ emoji })} />
    </Section>
  );
}

function ImagePanel({ el, set, project, chooseImage, editPicture }) {
  const a = el.asset && project.assets[el.asset];
  const f = el.filters;
  return (
    <Section icon="🖼️" title="Picture" hint="Drag a picture or GIF from your PC onto it, too">
      <div className="flex items-center gap-2.5">
        <div className="size-12 flex-none rounded-lg border border-white/15 bg-white/5 bg-cover bg-center" style={a ? { backgroundImage: `url("${a.data}")` } : undefined} />
        <span className="min-w-0 flex-1 truncate text-[12px] text-ink/85">{a ? a.name : "No picture yet"}</span>
        <button type="button" onClick={() => chooseImage(el.id)} className="press focus-ring rounded-lg border border-white/10 bg-white/[0.07] px-2.5 py-1.5 text-[11.5px] font-medium hover:bg-white/[0.12]">
          {a ? "Change" : "Choose…"}
        </button>
      </div>
      {a && editPicture && (
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" onClick={() => editPicture(el.id, "crop")} className="chip-btn justify-center py-2" data-testid="crop-btn">
            <Crop size={14} /> Crop…
          </button>
          <button type="button" onClick={() => editPicture(el.id, "key")} className="chip-btn justify-center py-2" data-testid="key-btn">
            <Wand2 size={14} /> Remove background…
          </button>
        </div>
      )}
      {el.original && (
        <button type="button" onClick={() => set({ asset: el.original, original: null })} className="focus-ring self-start text-[11.5px] text-accent hover:underline">
          Restore the original picture
        </button>
      )}
      <div>
        <p className="panel-label mb-1.5">Shape mask</p>
        <div className="grid grid-cols-6 gap-1">
          {MASKS.map((m) => (
            <button
              key={m}
              type="button"
              title={`Mask: ${MASK_LABEL[m]}`}
              data-testid={`mask-${m}`}
              aria-pressed={el.mask === m}
              onClick={() => set({ mask: m })}
              className={`press grid h-9 place-items-center rounded-lg border ${el.mask === m ? "border-accent/60 bg-accent/20" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.09]"}`}
            >
              {m === "none" ? <span className="text-[10.5px] text-muted">None</span> : (
                <svg viewBox="0 0 24 24" width="18" height="18"><path d={MASK_ICON[m]} fill="currentColor" /></svg>
              )}
            </button>
          ))}
        </div>
      </div>
      <Segmented label="Fit" value={el.fit} onChange={(fit) => set({ fit })} options={[{ id: "cover", label: "Fill" }, { id: "contain", label: "Fit" }, { id: "fill", label: "Stretch" }]} />
      {el.mask === "none" && <Slider label="Corners" value={el.radius} min={0} max={Math.round(Math.min(el.w, el.h) / 2)} onChange={(radius) => set({ radius })} format={px} left="Square" right="Round" />}
      <div className="grid grid-cols-2 gap-2">
        <Toggle label="Flip ↔" checked={el.flipX} onChange={(flipX) => set({ flipX })} />
        <Toggle label="Flip ↕" checked={el.flipY} onChange={(flipY) => set({ flipY })} />
      </div>
      <Toggle label="Drop shadow" checked={el.shadow} onChange={(shadow) => set({ shadow })} />
      <Slider label="Border" value={el.border.width} min={0} max={40} onChange={(width) => set({ border: { width } })} format={px} />
      {el.border.width > 0 && <ColorInput label="Border colour" value={el.border.color} onChange={(color) => set({ border: { color } })} />}
      <SubHeading>Filters</SubHeading>
      <Pro>
      <div className="grid grid-cols-2 gap-3">
        <Slider label="Brightness" value={f.brightness} min={0} max={200} onChange={(brightness) => set({ filters: { brightness } })} format={(v) => `${v}%`} />
        <Slider label="Contrast" value={f.contrast} min={0} max={200} onChange={(contrast) => set({ filters: { contrast } })} format={(v) => `${v}%`} />
        <Slider label="Colour" value={f.saturate} min={0} max={300} onChange={(saturate) => set({ filters: { saturate } })} format={(v) => `${v}%`} />
        <Slider label="Hue" value={f.hue} min={-180} max={180} onChange={(hue) => set({ filters: { hue } })} format={(v) => `${v}°`} />
        <Slider label="Grey" value={f.grayscale} min={0} max={100} onChange={(grayscale) => set({ filters: { grayscale } })} format={(v) => `${v}%`} />
        <Slider label="Blur" value={f.blur} min={0} max={30} onChange={(blur) => set({ filters: { blur } })} format={px} />
      </div>
      </Pro>
      <button
        type="button"
        onClick={() => set({ filters: { brightness: 100, contrast: 100, saturate: 100, hue: 0, grayscale: 0, blur: 0 } })}
        className="focus-ring self-start text-[11.5px] text-accent hover:underline"
      >
        Reset filters
      </button>
      <div className="flex flex-wrap gap-1">
        {[
          ["Deep fry", { brightness: 120, contrast: 190, saturate: 280, hue: -10, grayscale: 0, blur: 0 }],
          ["Old photo", { brightness: 105, contrast: 90, saturate: 40, hue: 20, grayscale: 30, blur: 0 }],
          ["B&W", { brightness: 100, contrast: 120, saturate: 100, hue: 0, grayscale: 100, blur: 0 }],
          ["Dreamy", { brightness: 112, contrast: 90, saturate: 130, hue: 0, grayscale: 0, blur: 2 }],
        ].map(([label, filters]) => (
          <button key={label} type="button" onClick={() => set({ filters })} className="press rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] hover:bg-white/[0.1]">
            {label}
          </button>
        ))}
      </div>
    </Section>
  );
}

function FillControls({ fill, onChange }) {
  return (
    <>
      <Segmented label="Fill" value={fill.type} onChange={(type) => onChange({ type })} options={[{ id: "solid", label: "Solid" }, { id: "gradient", label: "Gradient" }]} />
      <ColorInput label={fill.type === "gradient" ? "From" : "Colour"} value={fill.color} onChange={(color) => onChange({ color })} />
      {fill.type === "gradient" && (
        <>
          <ColorInput label="To" value={fill.color2} onChange={(color2) => onChange({ color2 })} />
          <AngleWheel value={fill.angle} onChange={(angle) => onChange({ angle })} colors={[fill.color, fill.color2]} />
        </>
      )}
    </>
  );
}

function ShapePanel({ el, set }) {
  return (
    <Section icon="⬛" title="Shape">
      <div className="grid grid-cols-4 gap-1">
        {SHAPES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={el.shape === s}
            onClick={() => set({ shape: s })}
            className={`press rounded-lg px-1 py-1.5 text-[11px] ${el.shape === s ? "bg-white/15 text-white" : "bg-white/[0.04] text-muted hover:text-ink"}`}
          >
            {SHAPE_LABEL[s]}
          </button>
        ))}
      </div>
      <FillControls fill={el.fill} onChange={(fill) => set({ fill })} />
      {(el.shape === "rect" || el.shape === "bubble") && (
        <Slider label="Corners" value={el.radius} min={0} max={Math.round(Math.min(el.w, el.h) / 2)} onChange={(radius) => set({ radius })} format={px} />
      )}
      <Slider label="Border" value={el.border.width} min={0} max={40} onChange={(width) => set({ border: { width } })} format={px} />
      {el.border.width > 0 && <ColorInput label="Border colour" value={el.border.color} onChange={(color) => set({ border: { color } })} />}
      <Toggle label="Drop shadow" checked={el.shadow} onChange={(shadow) => set({ shadow })} />
    </Section>
  );
}

function ColorList({ colors, onChange, max = 5 }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {colors.map((c, i) => (
        <label key={i} className="relative size-8 cursor-pointer overflow-hidden rounded-full border-2 border-white/25 hover:border-white/60" style={{ background: c, boxShadow: `0 0 12px ${c}55` }} title="Click to change">
          <input type="color" value={c} aria-label={`Colour ${i + 1}`} onChange={(e) => onChange(colors.map((x, j) => (j === i ? e.target.value : x)))} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
      ))}
      {colors.length < max && (
        <IconButton label="Add colour" onClick={() => onChange([...colors, "#f59e0b"])}>
          {Icons.plus}
        </IconButton>
      )}
      {colors.length > 1 && (
        <IconButton label="Remove last colour" onClick={() => onChange(colors.slice(0, -1))}>
          {Icons.minus}
        </IconButton>
      )}
    </div>
  );
}

function GlassPanel({ el, set }) {
  return (
    <Section icon="🫧" title="Glass" hint="Frosted glass that blurs what's behind it">
      <Slider label="Frost" value={el.frost} min={0} max={60} onChange={(frost) => set({ frost })} format={px} left="Crystal clear" right="Heavy frost" />
      <Slider label="Glass thickness" value={el.fill} min={0} max={0.4} step={0.01} onChange={(fill) => set({ fill })} format={pct} left="See-through" right="Milky" />
      <Slider label="Shine" value={el.shine} min={0} max={0.8} step={0.01} onChange={(shine) => set({ shine })} format={pct} left="Matte" right="Sparkly" />
      <Slider label="Corners" value={el.radius} min={0} max={Math.round(Math.min(el.w, el.h) / 2)} onChange={(radius) => set({ radius })} format={px} left="Sharp" right="Pill" />
      <SubHeading>Aura tint</SubHeading>
      <ColorList colors={el.tint.colors} onChange={(colors) => set({ tint: { colors } })} />
      <Slider label="Tint strength" value={el.tint.strength} min={0} max={1} step={0.01} onChange={(strength) => set({ tint: { strength } })} format={pct} />
      <Select label="Blend style" value={el.tint.blend} onChange={(blend) => set({ tint: { blend } })} options={BLEND_MODES.map((b) => ({ value: b, label: { normal: "Normal", screen: "Glow", overlay: "Punchy", "soft-light": "Soft", "color-dodge": "Neon" }[b] }))} />
      <Toggle label="3D tilt in preview" hint="Leans toward the mouse" checked={el.tilt} onChange={(tilt) => set({ tilt })} />
    </Section>
  );
}

function ButtonPanel({ el, set }) {
  const font = FONTS.find((f) => f.id === el.font) ?? FONTS[0];
  return (
    <Section icon="🔘" title="Button" hint="Choose what it does under “When clicked”">
      <div className="grid grid-cols-[64px_1fr] gap-2">
        <TextField label="Icon" value={el.icon} maxLength={16} onChange={(icon) => set({ icon })} />
        <TextField label="Label" value={el.label} maxLength={120} onChange={(label) => set({ label })} />
      </div>
      <Segmented
        label="Style"
        value={el.variant}
        onChange={(variant) => set({ variant })}
        options={[{ id: "glass", label: "Glass" }, { id: "gradient", label: "Gradient" }, { id: "solid", label: "Solid" }, { id: "outline", label: "Outline" }]}
      />
      <ColorInput label={el.variant === "solid" || el.variant === "outline" ? "Colour" : "Colour 1"} value={el.color} onChange={(color) => set({ color })} />
      {(el.variant === "glass" || el.variant === "gradient") && <ColorInput label="Colour 2" value={el.color2} onChange={(color2) => set({ color2 })} />}
      {el.variant !== "outline" && <ColorInput label="Text colour" value={el.textColor} onChange={(textColor) => set({ textColor })} />}
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <Select label="Font" value={el.font} onChange={(v) => set({ font: v, weight: FONTS.find((f) => f.id === v).weights.at(-1) })} options={FONTS.map((f) => ({ value: f.id, label: f.label, style: { fontFamily: f.css } }))} />
        <Select label="Weight" value={String(el.weight)} onChange={(v) => set({ weight: Number(v) })} options={font.weights.map((w) => ({ value: String(w), label: String(w) }))} />
      </div>
      <Slider label="Text size" value={el.size} min={8} max={200} onChange={(size) => set({ size })} format={px} />
      <Slider label="Corners" value={Math.min(el.radius, Math.round(Math.min(el.w, el.h) / 2))} min={0} max={Math.round(Math.min(el.w, el.h) / 2)} onChange={(radius) => set({ radius })} format={px} left="Sharp" right="Pill" />
      <Segmented label="Hover" value={el.hover} onChange={(hover) => set({ hover })} options={[{ id: "lift", label: "Lift" }, { id: "grow", label: "Grow" }, { id: "glow", label: "Glow" }, { id: "none", label: "None" }]} />
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function ActionsPanel({ el, set, project, page, chooseSound }) {
  const [adding, setAdding] = useState("");
  const actions = el.actions;
  const setActions = (next) => set((e) => ({ ...e, actions: next }));
  const patch = (i, values) => setActions(actions.map((a, j) => (j === i ? { ...a, ...values } : a)));
  const move = (i, d) => {
    const next = [...actions];
    const [a] = next.splice(i, 1);
    next.splice(i + d, 0, a);
    setActions(next);
  };
  return (
    <Section icon="⚡" title="When clicked" hint="Works in Preview and in exported web pages">
      {actions.length === 0 && <p className="text-[11.5px] text-muted">Nothing happens yet. Add an action below.</p>}
      {actions.map((a, i) => {
        const meta = ACTION_TYPES.find((t) => t.id === a.type);
        return (
          <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-2.5" data-testid={`action-${a.type}`}>
            <div className="mb-2 flex items-center gap-1">
              <span className="text-[13px]">{meta.emoji}</span>
              <span className="flex-1 text-[12px] font-semibold">{meta.label}</span>
              {i > 0 && <IconButton label="Move up" onClick={() => move(i, -1)}>↑</IconButton>}
              {i < actions.length - 1 && <IconButton label="Move down" onClick={() => move(i, 1)}>↓</IconButton>}
              <IconButton label="Remove action" onClick={() => setActions(actions.filter((_, j) => j !== i))}>✕</IconButton>
            </div>
            <ActionFields a={a} i={i} el={el} patch={patch} project={project} page={page} chooseSound={chooseSound} />
          </div>
        );
      })}
      <Select
        label="Add an action"
        value={adding}
        onChange={(type) => {
          setAdding("");
          if (type) setActions([...actions, createAction(type, project)]);
        }}
        options={[{ value: "", label: "+ Add an action…" }, ...ACTION_TYPES.map((t) => ({ value: t.id, label: `${t.emoji}  ${t.label}` }))]}
      />
    </Section>
  );
}

function ActionFields({ a, i, el, patch, project, page, chooseSound }) {
  const audioRef = useRef(null);
  switch (a.type) {
    case "link": {
      const ok = safeUrl(a.url);
      return (
        <>
          <TextField label="Web address" value={a.url} maxLength={2000} placeholder="https://…" onChange={(url) => patch(i, { url })} />
          {!ok && <p className="mt-1 text-[11px] text-amber-300">Use a full address starting with https://</p>}
          {ok && <p className="mt-1 text-[11px] text-muted">People are asked before a link opens.</p>}
        </>
      );
    }
    case "sound": {
      const s = a.asset && project.assets[a.asset];
      return (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[12px] text-ink/85">{s ? `🎵 ${s.name}` : "No sound yet"}</span>
            {s && (
              <IconButton
                label="Play sound"
                onClick={() => {
                  audioRef.current?.pause();
                  audioRef.current = new Audio(s.data);
                  audioRef.current.volume = a.volume;
                  audioRef.current.play().catch(() => {});
                }}
              >
                ▶
              </IconButton>
            )}
            <button type="button" onClick={() => chooseSound(el.id, i)} className="press focus-ring rounded-lg border border-white/10 bg-white/[0.07] px-2.5 py-1.5 text-[11.5px] font-medium hover:bg-white/[0.12]">
              {s ? "Change" : "Choose sound…"}
            </button>
          </div>
          <Slider label="Volume" value={a.volume} min={0} max={1} step={0.01} onChange={(volume) => patch(i, { volume })} format={pct} />
          <Toggle label="Stop other sounds first" checked={a.stopOthers} onChange={(stopOthers) => patch(i, { stopOthers })} />
        </div>
      );
    }
    case "confetti":
      return <Slider label="Amount" value={a.amount} min={20} max={400} onChange={(amount) => patch(i, { amount })} />;
    case "shake":
      return <Slider label="Strength" value={a.strength} min={0.3} max={3} step={0.1} onChange={(strength) => patch(i, { strength })} format={(v) => `${v.toFixed(1)}×`} />;
    case "popup":
      return (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[64px_1fr] gap-2">
            <TextField label="Emoji" value={a.emoji} maxLength={16} onChange={(emoji) => patch(i, { emoji })} />
            <TextField label="Title" value={a.title} maxLength={120} onChange={(title) => patch(i, { title })} />
          </div>
          <TextField label="Message" multiline value={a.text} maxLength={1000} onChange={(text) => patch(i, { text })} />
          <TextField label="Button" value={a.button} maxLength={40} onChange={(button) => patch(i, { button })} />
        </div>
      );
    case "toggle": {
      const others = page.elements.filter((e) => e.id !== el.id);
      return (
        <div className="flex flex-col gap-2">
          <Select
            label="Which layer"
            value={a.target ?? ""}
            onChange={(target) => patch(i, { target: target || null })}
            options={[{ value: "", label: others.length ? "Choose a layer…" : "No other layers on this page" }, ...others.map((e) => ({ value: e.id, label: e.name }))]}
          />
          <Segmented label="Do" value={a.mode} onChange={(mode) => patch(i, { mode })} options={[{ id: "toggle", label: "Toggle" }, { id: "show", label: "Show" }, { id: "hide", label: "Hide" }]} />
          <p className="text-[11px] text-muted">Tip: hide a layer at start with 👁️ in Layers, then reveal it here.</p>
        </div>
      );
    }
    case "page":
      return (
        <Select
          label="Go to"
          value={a.target}
          onChange={(target) => patch(i, { target })}
          options={[
            { value: "next", label: "Next page" },
            { value: "prev", label: "Previous page" },
            { value: "first", label: "First page" },
            ...project.pages.map((p, n) => ({ value: p.id, label: `Page ${n + 1}: ${p.name}` })),
          ]}
        />
      );
    default:
      return null;
  }
}

function AnimationPanel({ el, set }) {
  return (
    <Section icon="🎬" title="Animation" hint="Plays in Preview (turn on ▶ in the canvas to see it here)">
      <div className="grid grid-cols-5 gap-1">
        {ANIMATIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            aria-pressed={el.anim.type === a.id}
            onClick={() => set({ anim: { type: a.id } })}
            className={`press rounded-lg px-1 py-1.5 text-[10.5px] ${el.anim.type === a.id ? "bg-gradient-to-br from-accent/40 to-accent-2/30 text-white" : "bg-white/[0.04] text-muted hover:text-ink"}`}
          >
            {a.label}
          </button>
        ))}
      </div>
      {el.anim.type !== "none" && (
        <div className="grid grid-cols-2 gap-3">
          <Slider label="Speed" value={el.anim.speed} min={0.25} max={3} step={0.05} onChange={(speed) => set({ anim: { speed } })} format={(v) => `${v.toFixed(2)}×`} />
          <Slider label="Delay" value={el.anim.delay} min={0} max={5} step={0.1} onChange={(delay) => set({ anim: { delay } })} format={(v) => `${v.toFixed(1)}s`} />
        </div>
      )}
    </Section>
  );
}

function ArrangePanel({ el, set, canvas, align, distribute, mirror }) {
  return (
    <Section icon="📐" title="Position & size">
      <Pro>{align && <AlignBar ids={[el.id]} align={align} distribute={distribute} />}</Pro>
      <MirrorRow ids={[el.id]} mirror={mirror} />
      <Pro>
      <div className="grid grid-cols-2 gap-1.5">
        <NumberInput label="X" value={el.x} onChange={(x) => set({ x })} />
        <NumberInput label="Y" value={el.y} onChange={(y) => set({ y })} />
        <NumberInput label="W" value={el.w} min={4} onChange={(w) => set({ w: Math.max(4, w) })} />
        <NumberInput label="H" value={el.h} min={4} onChange={(h) => set({ h: Math.max(4, h) })} />
        <NumberInput label="↻" value={el.rotation} suffix="°" onChange={(rotation) => set({ rotation })} />
      </div>
      </Pro>
      <Slider label="Opacity" value={el.opacity} min={0} max={1} step={0.01} onChange={(opacity) => set({ opacity })} format={pct} />
      <div className="flex flex-wrap gap-1">
        {[
          ["Centre", () => set({ x: Math.round((canvas.w - el.w) / 2), y: Math.round((canvas.h - el.h) / 2) })],
          ["Centre ↔", () => set({ x: Math.round((canvas.w - el.w) / 2) })],
          ["Fill canvas", () => set({ x: 0, y: 0, w: canvas.w, h: canvas.h, rotation: 0 })],
          ["Straighten", () => set({ rotation: 0 })],
        ].map(([label, fn]) => (
          <button key={label} type="button" onClick={fn} className="press rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] hover:bg-white/[0.1]">
            {label}
          </button>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Page / project
// ---------------------------------------------------------------------------

function PagePanel({ project, page, pageIndex, updatePage, setProject, chooseBackground }) {
  const bg = page.bg;
  const preset = CANVAS_PRESETS.find((p) => p.w === project.canvas.w && p.h === project.canvas.h);
  const setBg = (patch) => updatePage({ bg: patch });
  return (
    <>
      <div className="px-1">
        <h1 className="font-display text-[15px] font-semibold">Page {pageIndex + 1}</h1>
        <p className="text-[11px] text-muted">Click something on the canvas to edit it.</p>
      </div>
      <Section icon="📄" title="Page">
        <TextField label="Page name" value={page.name} maxLength={60} onChange={(name) => updatePage({ name })} />
        <Select label="Page transition" value={page.transition} onChange={(transition) => updatePage({ transition })} options={TRANSITIONS.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))} />
      </Section>
      <Section icon="🌈" title="Background">
        <Segmented
          label="Background"
          value={bg.type}
          onChange={(type) => setBg({ type })}
          options={[{ id: "mesh", label: "Aura" }, { id: "gradient", label: "Gradient" }, { id: "solid", label: "Solid" }, { id: "image", label: "Picture" }]}
        />
        {(bg.type === "mesh" || bg.type === "solid" || bg.type === "image") && <ColorInput label="Base colour" value={bg.color} onChange={(color) => setBg({ color })} />}
        {(bg.type === "mesh" || bg.type === "gradient") && <ColorList colors={bg.colors} onChange={(colors) => setBg({ colors })} />}
        {bg.type === "gradient" && <AngleWheel value={bg.angle} onChange={(angle) => setBg({ angle })} colors={bg.colors} />}
        {bg.type === "mesh" && (
          <>
            <Toggle label="Glowing orbs" checked={bg.orbs} onChange={(orbs) => setBg({ orbs })} />
            {bg.orbs && <Slider label="Drift speed" value={bg.drift} min={0} max={3} step={0.1} onChange={(drift) => setBg({ drift })} format={(v) => (v === 0 ? "still" : `${v.toFixed(1)}×`)} />}
          </>
        )}
        {bg.type === "image" && (
          <>
            <div className="flex items-center gap-2.5">
              <div className="size-12 flex-none rounded-lg border border-white/15 bg-white/5 bg-cover bg-center" style={bg.asset && project.assets[bg.asset] ? { backgroundImage: `url("${project.assets[bg.asset].data}")` } : undefined} />
              <span className="min-w-0 flex-1 truncate text-[12px] text-ink/85">{bg.asset && project.assets[bg.asset] ? project.assets[bg.asset].name : "No picture yet"}</span>
              <button type="button" onClick={chooseBackground} className="press focus-ring rounded-lg border border-white/10 bg-white/[0.07] px-2.5 py-1.5 text-[11.5px] font-medium hover:bg-white/[0.12]">
                Choose…
              </button>
            </div>
            <Segmented label="Fit" value={bg.fit} onChange={(fit) => setBg({ fit })} options={[{ id: "cover", label: "Fill" }, { id: "contain", label: "Fit" }]} />
            <div className="grid grid-cols-2 gap-3">
              <Slider label="Darken" value={bg.dim} min={0} max={0.9} step={0.01} onChange={(dim) => setBg({ dim })} format={pct} />
              <Slider label="Blur" value={bg.blur} min={0} max={40} onChange={(blur) => setBg({ blur })} format={px} />
            </div>
          </>
        )}
      </Section>
      <Section icon="🖼️" title="Canvas" hint="Applies to every page">
        <TextField label="Project name" value={project.name} maxLength={120} onChange={(name) => setProject((p) => ({ ...p, name }))} />
        <Select
          label="Size"
          value={preset?.id ?? "custom"}
          onChange={(id) => {
            const p = CANVAS_PRESETS.find((x) => x.id === id);
            if (p) setProject((pr) => ({ ...pr, canvas: { w: p.w, h: p.h } }));
          }}
          options={[...CANVAS_PRESETS.map((p) => ({ value: p.id, label: `${p.label} (${p.w}×${p.h})` })), { value: "custom", label: "Custom" }]}
        />
        <Pro>
        <div className="grid grid-cols-2 gap-1.5">
          <NumberInput label="W" value={project.canvas.w} min={CANVAS_LIMITS.min} max={CANVAS_LIMITS.max} onChange={(w) => setProject((p) => ({ ...p, canvas: { ...p.canvas, w: clampSize(w) } }))} />
          <NumberInput label="H" value={project.canvas.h} min={CANVAS_LIMITS.min} max={CANVAS_LIMITS.max} onChange={(h) => setProject((p) => ({ ...p, canvas: { ...p.canvas, h: clampSize(h) } }))} />
        </div>
        </Pro>
      </Section>
    </>
  );
}

const clampSize = (v) => Math.round(Math.min(CANVAS_LIMITS.max, Math.max(CANVAS_LIMITS.min, v)));

function SubHeading({ children }) {
  return <p className="-mb-1 pt-1 text-[11px] font-semibold tracking-wider text-muted uppercase">{children}</p>;
}
