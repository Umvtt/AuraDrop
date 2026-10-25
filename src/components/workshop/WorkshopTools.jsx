import { useEffect, useMemo, useState } from "react";
import { Camera, Crosshair, Download, ImagePlus, RotateCcw, Swords } from "lucide-react";
import * as native from "../../lib/native.js";
import { partLabel, penAt, SHELLS } from "../../vehicles3d/ballistics.js";
import { hitCamImage } from "../../vehicles3d/hitcam.js";
import { PRESETS3D } from "../../vehicles3d/presets.js";
import { ENVIRONMENTS } from "../../vehicles3d/stage.js";
import { ADDONS, CREW_ROLES, crewOf, NATIONS, newCrewMember } from "../../vehicles3d/spec.js";
import { computeStats } from "../../vehicles3d/stats.js";
import { ColorInput, Section, Segmented, Select, Slider, Toggle } from "../controls.jsx";
import { VehicleThumb } from "./Workshop.jsx";

const dataUrlBytes = (url) => Uint8Array.from(atob(url.split(",")[1]), (c) => c.charCodeAt(0));
const safe = (s) => (s || "picture").replace(/[\\/:*?"<>|]+/g, "-").trim();

export async function savePicture(url, name, notify) {
  try {
    const path = await native.savePng(dataUrlBytes(url), `${safe(name)}.png`);
    if (path) notify?.(`Saved ${native.baseName(path)}`, "success");
  } catch (err) {
    notify?.(`Couldn't save the picture: ${err.message ?? err}`, "error");
  }
}

const gunLabel = (g) => `${g.caliber} mm L/${g.length} ${g.shell}`;

// --- Shoot test --------------------------------------------------------------------------

/** Pick the gun to test with: this vehicle's, a preset's or a hangar vehicle's, with any shell. */
export function TestPanel({ vehicle, hangar, weapon, setWeapon, distance, setDistance, onReset }) {
  const sources = useMemo(
    () => [
      { id: "self", label: `This vehicle – ${gunLabel(vehicle.spec.gun)}`, gun: vehicle.spec.gun },
      ...PRESETS3D.map((v) => ({ id: v.id, label: `${NATIONS.find((n) => n.id === v.nation)?.flag ?? ""} ${v.name} – ${gunLabel(v.spec.gun)}`, gun: v.spec.gun })),
      ...hangar.list.map((v) => ({ id: `h-${v.id}`, label: `🏠 ${v.name} – ${gunLabel(v.spec.gun)}`, gun: v.spec.gun })),
    ],
    [vehicle.spec.gun, hangar.list],
  );
  const [source, setSource] = useState("self");
  useEffect(() => {
    const s = sources.find((x) => x.id === source) ?? sources[0];
    setWeapon((w) => ({ ...s.gun, shell: w?.source === s.id ? w.shell : s.gun.shell, source: s.id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, sources]);
  if (!weapon) return null;
  return (
    <>
      <Section icon="🎯" title="Shoot test" hint="Click anywhere on the vehicle to fire at that spot, from where you're looking">
        <Select label="Gun" value={source} onChange={setSource} options={sources.map((s) => ({ value: s.id, label: s.label }))} />
        <Select label="Shell" value={weapon.shell} onChange={(shell) => setWeapon((w) => ({ ...w, shell }))} options={Object.keys(SHELLS).map((s) => ({ value: s, label: s }))} />
        <Slider label="Distance" value={distance} min={50} max={2500} step={50} onChange={setDistance} format={(v) => `${v} m`} left="Point blank" right="Far" />
        <div className="rounded-xl bg-black/25 px-3 py-2 text-[12px]">
          Penetration at {distance} m: <b className="font-mono text-accent-2">{Math.round(penAt(weapon, distance))} mm</b>
        </div>
        <button type="button" onClick={onReset} className="chip-btn self-start">
          <RotateCcw size={14} /> Repair the vehicle
        </button>
      </Section>
      <Section icon="📖" title="How it works" collapsible>
        <p className="text-[11.5px] leading-relaxed text-ink/75">
          The shell hits the real plate under your cursor. Its angle makes the armour thicker (effective armour); steep hits can ricochet. If it gets through, fragments fly inside and knock out crew and modules. An ammo rack hit can blow the vehicle up; with fewer than 2 crew left it's knocked out.
        </p>
      </Section>
    </>
  );
}

// --- Duel ---------------------------------------------------------------------------------

export function DuelPanel({ vehicle, opponent, onPickOpponent, distance, setDistance, speed, setSpeed, onFight, status, score }) {
  const mine = computeStats(vehicle);
  const theirs = opponent ? computeStats(opponent) : null;
  return (
    <>
      <Section icon="⚔️" title="Duel" hint="Face to face. They aim, fire, reload and trade shots until one is knocked out.">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <Card v={vehicle} st={mine} label="You" />
          <span className="font-display text-[15px] font-black text-muted">VS</span>
          {opponent ? <Card v={opponent} st={theirs} label="Enemy" onClick={onPickOpponent} /> : <button type="button" onClick={onPickOpponent} className="chip-btn h-full justify-center">Choose…</button>}
        </div>
        <button type="button" onClick={onPickOpponent} className="chip-btn self-start">
          Change opponent…
        </button>
        <Slider label="Distance" value={distance} min={100} max={2000} step={50} onChange={setDistance} format={(v) => `${v} m`} />
        <Segmented label="Speed" value={String(speed)} onChange={(v) => setSpeed(Number(v))} options={[{ id: "0.5", label: "Slow-mo" }, { id: "1", label: "Normal" }, { id: "2", label: "Fast" }]} />
        <button type="button" disabled={!opponent} onClick={onFight} data-testid="fight" className="press focus-ring flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-400 px-4 py-2.5 text-[14px] font-bold text-[#0b0c12] shadow-[0_6px_20px_rgba(244,63,94,0.35)] disabled:opacity-40">
          <Swords size={16} /> {status === "running" ? "Restart" : status === "over" ? "Rematch" : "Fight!"}
        </button>
        {score && (
          <p className="text-center font-mono text-[12px] text-muted">
            Score: you {score.A} – {score.B} enemy{score.draw ? ` · ${score.draw} draw${score.draw > 1 ? "s" : ""}` : ""}
          </p>
        )}
      </Section>
    </>
  );
}

function Card({ v, st, label, onClick }) {
  const n = NATIONS.find((x) => x.id === v.nation);
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] text-left">
      <VehicleThumb vehicle={v} className="aspect-[12/7] w-full object-cover" />
      <div className="px-2 py-1.5">
        <p className="text-[9.5px] font-bold tracking-widest text-muted uppercase">{label}</p>
        <p className="truncate text-[12px] font-semibold">
          {n?.flag} {v.name}
        </p>
        {st?.br && <p className="font-mono text-[10.5px] text-amber-300">BR {st.br.toFixed(1)}</p>}
      </div>
    </Tag>
  );
}

// --- Crew & modules readout --------------------------------------------------------------

export function DamageCard({ title, state }) {
  if (!state) return null;
  const crew = Object.entries(state.crew);
  const mods = Object.keys(state.modules);
  return (
    <div className="rounded-xl bg-black/25 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11.5px] font-semibold">{title}</span>
        {state.destroyed ? <span className="rounded bg-rose-500/80 px-1.5 text-[10px] font-bold">KNOCKED OUT</span> : state.fire ? <span className="rounded bg-orange-500/80 px-1.5 text-[10px] font-bold">ON FIRE</span> : null}
      </div>
      <div className="flex flex-wrap gap-1">
        {crew.map(([id, alive]) => (
          <span key={id} className={`rounded-md px-1.5 py-0.5 text-[10.5px] ${alive ? "bg-emerald-500/20 text-emerald-200" : "bg-rose-500/25 text-rose-200 line-through"}`}>
            {partLabel({ kind: "crew", ...(state.crewInfo?.[id] ?? { role: id }) })}
          </span>
        ))}
        {mods.map((m) => (
          <span key={m} className="rounded-md bg-orange-500/20 px-1.5 py-0.5 text-[10.5px] text-orange-200">
            {partLabel({ kind: m })} ✕
          </span>
        ))}
        {state.ammoRack && <span className="rounded-md bg-rose-600/40 px-1.5 py-0.5 text-[10.5px] text-rose-100">Ammo rack 💥</span>}
      </div>
    </div>
  );
}

// --- Hit log with hit camera -------------------------------------------------------------

const OUTCOME = {
  pen: ["Penetration", "text-orange-300"],
  nonpen: ["Non-penetration", "text-slate-300"],
  ricochet: ["Ricochet", "text-yellow-300"],
  miss: ["Miss", "text-slate-400"],
};

export function HitLog({ entries, states, names, onAddPicture, notify, onOpen }) {
  const [images, setImages] = useState({});
  const [open, setOpen] = useState(null);
  const latest = entries[0];
  const showId = open ?? latest?.id;
  const show = entries.find((e) => e.id === showId);

  // Render the hit camera for the shot being shown (it builds a copy of the vehicle, so lazily).
  useEffect(() => {
    if (!show || images[show.id]) return;
    const t = setTimeout(() => {
      try {
        const who = show.shooter === "you" ? "Shoot test" : `${names[show.shooter]} → ${names[show.targetId]}`;
        const url = hitCamImage(show.vehicle, show.pose, show.result, { deadCrew: show.deadCrew, title: who });
        setImages((m) => ({ ...m, [show.id]: url }));
      } catch {
        setImages((m) => ({ ...m, [show.id]: "error" }));
      }
    }, 60);
    return () => clearTimeout(t);
  }, [show, images, names]);

  const img = show && images[show.id];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        <Crosshair size={15} className="text-accent" />
        <h2 className="font-display text-[14px] font-semibold">Hit camera</h2>
      </div>
      <div className="relative aspect-[12/7] overflow-hidden rounded-xl bg-[#0a1220] ring-1 ring-white/10" data-testid="hitcam">
        {img && img !== "error" ? (
          <button type="button" onClick={() => onOpen?.(img)} title="Open it big" className="block h-full w-full cursor-zoom-in">
            <img src={img} alt="Hit camera" className="h-full w-full object-cover" />
          </button>
        ) : <p className="grid h-full place-items-center px-4 text-center text-[11.5px] text-muted">{show ? (img === "error" ? "Couldn't draw this one." : "Developing…") : "Shots will show up here."}</p>}
      </div>
      {img && img !== "error" && (
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" onClick={() => savePicture(img, "hit camera", notify)} className="chip-btn justify-center">
            <Download size={14} /> Save PNG
          </button>
          <button type="button" onClick={() => onAddPicture?.(img, "Hit camera")} className="chip-btn justify-center" data-testid="hitcam-add">
            <ImagePlus size={14} /> Add to canvas
          </button>
        </div>
      )}
      {Object.entries(states).map(([id, st]) => (
        <DamageCard key={id} title={names[id] ?? id} state={st} />
      ))}
      <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" data-testid="hitlog">
        {entries.map((e, i) => {
          const [label, color] = e.result.destroyed ? ["Knocked out!", "text-rose-300"] : OUTCOME[e.result.outcome] ?? OUTCOME.miss;
          return (
            <button key={e.id} type="button" onClick={() => setOpen(e.id)} className={`rounded-lg px-2 py-1.5 text-left text-[11.5px] ${e.id === showId ? "bg-white/[0.1]" : "hover:bg-white/[0.06]"}`}>
              <span className="mr-1.5 font-mono text-muted">#{entries.length - i}</span>
              {e.shooter !== "you" && <span className="mr-1 text-muted">{names[e.shooter]}:</span>}
              <b className={color}>{label}</b>
              <span className="block truncate text-[10.5px] text-muted">{e.result.log.slice(0, 3).join(" · ")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Photo mode ------------------------------------------------------------------------

export const RESOLUTIONS = [
  { id: "1080", label: "Full HD 1920×1080", w: 1920, h: 1080 },
  { id: "1440", label: "QHD 2560×1440", w: 2560, h: 1440 },
  { id: "2160", label: "4K 3840×2160", w: 3840, h: 2160 },
  { id: "phone", label: "Phone 1080×1920", w: 1080, h: 1920 },
  { id: "square", label: "Square 2048×2048", w: 2048, h: 2048 },
];

export function PhotoPanel({ photo, setPhoto, onShoot }) {
  const set = (patch) => setPhoto((p) => ({ ...p, ...patch }));
  return (
    <Section icon="📸" title="Photo mode" hint="Set the scene, frame your shot with the mouse, then take the photo">
      <div className="grid grid-cols-3 gap-1.5">
        {ENVIRONMENTS.map((e) => (
          <button key={e.id} type="button" onClick={() => set({ env: e.id })} data-testid={`env-${e.id}`} className={`press rounded-lg border px-2 py-1.5 text-[11.5px] ${photo.env === e.id ? "border-accent/60 bg-accent/20" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"}`}>
            {e.label}
          </button>
        ))}
      </div>
      <Slider label="Sun direction" value={photo.sunAngle} min={0} max={360} onChange={(sunAngle) => set({ sunAngle })} format={(v) => `${Math.round(v)}°`} />
      <Slider label="Sun height" value={photo.sunHeight} min={5} max={85} onChange={(sunHeight) => set({ sunHeight })} format={(v) => `${Math.round(v)}°`} left="Sunset" right="Noon" />
      <Slider label="Lens" value={photo.fov} min={14} max={70} onChange={(fov) => set({ fov })} format={(v) => `${Math.round(v)}°`} left="Zoom" right="Wide" />
      <Select label="Size" value={photo.res} onChange={(res) => set({ res })} options={RESOLUTIONS.map((r) => ({ value: r.id, label: r.label }))} />
      <button type="button" onClick={onShoot} data-testid="take-photo" className="press focus-ring flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-2 px-4 py-2.5 text-[13.5px] font-bold text-[#0b0c12]">
        <Camera size={16} /> Take photo
      </button>
      <p className="text-[11px] text-muted">Tip: pause the animations to freeze the moment, or play them to catch the gun firing.</p>
    </Section>
  );
}

export function PhotoResult({ url, onClose, onAddPicture, notify, name }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-6 backdrop-blur-sm" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="menu-surface pop-in flex max-h-[92vh] w-[min(1100px,94vw)] flex-col gap-3 p-4!" role="dialog" aria-label="Your photo" data-testid="photo-result">
        <img src={url} alt="Your photo" className="max-h-[70vh] w-full rounded-xl object-contain" />
        <div className="flex items-center gap-2">
          <span className="flex-1 text-[12px] text-muted">Looking good. Save it as a wallpaper or use it in a project.</span>
          <button type="button" onClick={onClose} className="chip-btn px-4 py-2">
            Close
          </button>
          <button type="button" onClick={() => savePicture(url, name, notify)} className="chip-btn px-4 py-2">
            <Download size={14} /> Save PNG
          </button>
          <button type="button" onClick={() => (onAddPicture(url, name), onClose())} className="press focus-ring flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-accent to-accent-2 px-4 py-2 text-[12.5px] font-semibold text-[#0b0c12]">
            <ImagePlus size={14} /> Add to canvas
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Hand-placed parts ------------------------------------------------------------------

const PART_ICONS = { Shapes: "🔷", Armour: "🛡️", Stowage: "🎒", Weapons: "🔫", Details: "🔧" };

/** Pick a part, click the vehicle to place it, then tweak or drag it. */
export function PartsPanel({ vehicle, placing, setPlacing, selectedId, setSelectedId, updatePart, removePart, duplicatePart }) {
  const cats = [...new Set(ADDONS.map((a) => a.cat))];
  const [cat, setCat] = useState(cats[0]);
  const sel = vehicle.addons.find((a) => a.id === selectedId);
  const def = sel && ADDONS.find((d) => d.id === sel.type);
  const vec = (key, i, v) => updatePart(sel.id, { [key]: sel[key].map((x, j) => (j === i ? v : x)) });
  return (
    <Section icon="🧩" title="Parts" hint="Pick a part, then click on the vehicle to stick it there. Drag placed parts to move them.">
      <div className="flex flex-wrap gap-1" role="tablist">
        {cats.map((c) => (
          <button key={c} type="button" role="tab" aria-selected={cat === c} onClick={() => setCat(c)} className={`rounded-lg px-2 py-1 text-[11px] ${cat === c ? "bg-white/[0.14] text-ink" : "text-muted hover:text-ink"}`}>
            {PART_ICONS[c]} {c}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {ADDONS.filter((a) => a.cat === cat).map((a) => (
          <button
            key={a.id}
            type="button"
            data-testid={`part-${a.id}`}
            onClick={() => setPlacing(placing === a.id ? null : a.id)}
            className={`press rounded-full border px-2.5 py-1 text-[11px] ${placing === a.id ? "border-accent/70 bg-accent/25 text-ink" : "border-white/10 bg-white/[0.05] text-ink/80 hover:bg-white/[0.1]"}`}
          >
            {a.label}
          </button>
        ))}
      </div>
      {placing && <p className="rounded-lg bg-accent/15 px-2.5 py-1.5 text-[11.5px] text-ink">Click on the vehicle to place it · Shift+click to place more · Esc to stop</p>}
      {vehicle.addons.length > 0 && (
        <div className="flex flex-col gap-0.5" data-testid="parts-list">
          <p className="panel-label mt-1">On this vehicle ({vehicle.addons.length})</p>
          {vehicle.addons.map((a) => (
            <button key={a.id} type="button" onClick={() => setSelectedId(a.id)} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-left text-[12px] ${a.id === selectedId ? "bg-accent/25" : "hover:bg-white/[0.06]"}`}>
              <span className="flex-1 truncate">{ADDONS.find((d) => d.id === a.type)?.label}</span>
              <span className="text-[10.5px] text-muted">
                {a.on}
                {a.mirror ? " · ×2" : ""}
              </span>
            </button>
          ))}
        </div>
      )}
      {sel && (
        <div className="flex flex-col gap-2 rounded-xl bg-black/25 p-2.5" data-testid="part-editor">
          <div className="flex items-center gap-1.5">
            <span className="flex-1 text-[12.5px] font-semibold">{def?.label}</span>
            <button type="button" onClick={() => duplicatePart(sel.id)} className="chip-btn" title="Duplicate (Ctrl+D)">
              Copy
            </button>
            <button type="button" onClick={() => removePart(sel.id)} className="chip-btn text-rose-200" title="Delete (Del)">
              Delete
            </button>
          </div>
          <Toggle label="Mirror to the other side" hint="M" checked={sel.mirror} onChange={(mirror) => updatePart(sel.id, { mirror })} />
          <Segmented label="Attached to" value={sel.on} onChange={(on) => updatePart(sel.id, { on })} options={[{ id: "hull", label: vehicle.kind === "tank" ? "Hull" : "Body" }, ...(vehicle.kind === "tank" ? [{ id: "turret", label: "Turret" }, { id: "gun", label: "Gun" }] : [])]} />
          {["Length", "Height", "Width"].map((label, i) => (
            <Slider key={label} label={label} value={sel.size[i]} min={0.02} max={Math.max(4, def.size[i] * 4)} step={0.01} onChange={(v) => vec("size", i, v)} format={(v) => `${v.toFixed(2)} m`} />
          ))}
          {["Tilt forward", "Turn", "Tilt sideways"].map((label, i) => (
            <Slider key={label} label={label} value={sel.rot[[2, 1, 0][i]]} min={-180} max={180} onChange={(v) => vec("rot", [2, 1, 0][i], v)} format={(v) => `${Math.round(v)}°`} />
          ))}
          {["Forward / back", "Up / down", "Left / right"].map((label, i) => (
            <Slider key={label} label={label} value={sel.pos[i]} min={-8} max={8} step={0.01} onChange={(v) => vec("pos", i, v)} format={(v) => `${v.toFixed(2)} m`} />
          ))}
          {def.armor != null || ["box", "cylinder", "wedge", "sphere"].includes(sel.type) ? <Slider label="Armour" value={sel.armor} min={0} max={300} onChange={(armor) => updatePart(sel.id, { armor })} format={(v) => `${Math.round(v)} mm`} /> : null}
          <div className="flex items-center gap-2">
            <ColorInput label="Colour" value={sel.color ?? "#4a4f2a"} onChange={(color) => updatePart(sel.id, { color })} />
            {sel.color && (
              <button type="button" onClick={() => updatePart(sel.id, { color: null })} className="chip-btn flex-none" title="Use the vehicle's paint">
                Paint
              </button>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}

// --- Moving the vehicle's own parts --------------------------------------------------------

/** Offsets for one of the vehicle's own parts (turret, cupola, a wheel, a toolbox…). */
export function UnitPanel({ info, tweak, onChange, onReset, onSelect, movedCount, onResetAll }) {
  const t = tweak ?? { pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, hidden: false };
  const vec = (key, i, v) => onChange({ ...t, [key]: t[key].map((x, j) => (j === i ? v : x)) });
  return (
    <Section icon="🛠️" title="Selected part" hint="Drag it in the view to move it (Shift: up and down). Click empty space to deselect.">
      <div className="flex items-center gap-2" data-testid="unit-panel">
        <span className="flex-1 truncate text-[13px] font-semibold">{info?.label ?? "Part"}</span>
        {tweak && (
          <button type="button" onClick={onReset} className="chip-btn" title="Put it back where it was">
            <RotateCcw size={13} /> Reset
          </button>
        )}
      </div>
      {info?.parentKey && (
        <button type="button" onClick={() => onSelect(info.parentKey)} className="chip-btn self-start" data-testid="unit-parent">
          Select the whole {info.parentLabel.toLowerCase()} ↑
        </button>
      )}
      {["Forward / back", "Up / down", "Left / right"].map((label, i) => (
        <Slider key={label} label={label} value={t.pos[i]} min={-3} max={3} step={0.01} onChange={(v) => vec("pos", i, v)} format={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)} m`} />
      ))}
      {["Tilt sideways", "Turn", "Tilt forward"].map((label, i) => (
        <Slider key={label} label={label} value={t.rot[i]} min={-180} max={180} onChange={(v) => vec("rot", i, v)} format={(v) => `${Math.round(v)}°`} />
      ))}
      <Slider label="Size" value={t.scale} min={0.2} max={3} step={0.01} onChange={(scale) => onChange({ ...t, scale })} format={(v) => `${Math.round(v * 100)}%`} />
      <Toggle label="Hide this part" checked={t.hidden} onChange={(hidden) => onChange({ ...t, hidden })} />
      {movedCount > 0 && (
        <button type="button" onClick={onResetAll} className="focus-ring self-start text-[11.5px] text-accent hover:underline">
          Reset all {movedCount} moved part{movedCount > 1 ? "s" : ""}
        </button>
      )}
    </Section>
  );
}

// --- Crew editor --------------------------------------------------------------------------

const TANK_ROLES = [
  ["commander", "Commander"],
  ["gunner", "Gunner"],
  ["loader", "Loader"],
  ["driver", "Driver"],
  ["radio", "Radio operator / MG"],
];

/** Who's inside: roles, names, heights (150–200 cm) and where they sit. */
export function CrewPanel({ vehicle, setCrew }) {
  const crew = crewOf(vehicle.spec);
  const custom = Array.isArray(vehicle.spec.crew) && vehicle.spec.crew.length > 0;
  // Editing a preset crew turns it into the vehicle's own list.
  const edit = (fn) => setCrew(fn(crew.map((m) => ({ ...m }))));
  const update = (id, patch) => edit((list) => list.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const [open, setOpen] = useState(null);
  return (
    <Section icon="👥" title="Crew" hint="Everyone inside: role, name, height and seat. Shown in the X-ray and hit by shots.">
      <div className="flex flex-col gap-1.5" data-testid="crew-panel">
        {crew.map((m, i) => (
          <div key={m.id} className="rounded-xl bg-black/25 p-2">
            <div className="flex items-center gap-1.5">
              <i className="size-2.5 flex-none rounded-full" style={{ background: CREW_ROLES.find((r) => r[0] === m.role)?.[2] }} />
              <select value={m.role} onChange={(e) => update(m.id, { role: e.target.value })} aria-label="Role" className="min-w-0 flex-1 rounded-md border border-white/10 bg-[#161722] px-1.5 py-1 text-[11.5px]">
                {TANK_ROLES.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
              <input value={m.name} placeholder="Name" maxLength={24} onChange={(e) => update(m.id, { name: e.target.value })} aria-label="Name" className="w-20 rounded-md border border-white/10 bg-[#161722] px-1.5 py-1 text-[11.5px]" />
              <button type="button" aria-label="More" onClick={() => setOpen(open === i ? null : i)} className="rounded-md px-1.5 py-1 text-[11px] text-muted hover:bg-white/10">
                {open === i ? "▲" : "▼"}
              </button>
              <button type="button" aria-label={`Remove ${m.name || m.role}`} disabled={crew.length <= 1} onClick={() => edit((list) => list.filter((_, j) => j !== i))} className="rounded-md px-1.5 py-1 text-[12px] text-rose-200 hover:bg-white/10 disabled:opacity-30">
                ✕
              </button>
            </div>
            <Slider label="Height" value={m.height} min={150} max={200} onChange={(height) => update(m.id, { height })} format={(v) => `${Math.round(v)} cm`} />
            {open === i && (
              <div className="mt-1 flex flex-col gap-2">
                <Segmented label="Seat" value={m.seat} onChange={(seat) => update(m.id, { seat })} options={[{ id: "auto", label: "By role" }, { id: "hull", label: "Hull" }, { id: "turret", label: "Turret" }]} />
                <Slider label="Seat forward / back" value={m.dx} min={-2} max={2} step={0.01} onChange={(dx) => update(m.id, { dx })} format={(v) => `${v.toFixed(2)} m`} />
                <Slider label="Seat left / right" value={m.dz} min={-1.5} max={1.5} step={0.01} onChange={(dz) => update(m.id, { dz })} format={(v) => `${v.toFixed(2)} m`} />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" disabled={crew.length >= 8} onClick={() => edit((list) => [...list, newCrewMember(list.some((m) => m.role === "loader") ? "radio" : "loader")])} className="chip-btn" data-testid="crew-add">
          + Add crew member
        </button>
        {custom && (
          <button type="button" onClick={() => setCrew(null)} className="chip-btn" title="Go back to the crew preset">
            <RotateCcw size={13} /> Preset crew
          </button>
        )}
      </div>
    </Section>
  );
}
