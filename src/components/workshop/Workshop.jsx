import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Box, Camera, Crosshair, Dices, Eye, Pause, Play, Redo2, Save, Shield, Swords, Trash2, Undo2, Volume2, VolumeX, Wrench, X } from "lucide-react";
import { useHistory } from "../../hooks/useHistory.js";
import { ARMOR_STOPS } from "../../vehicles3d/decals.js";
import { PRESETS3D } from "../../vehicles3d/presets.js";
import { ADDONS, addonId, fieldsFor, getPath, NATIONS, PAINTS, randomVehicle, setPath, vehicleId } from "../../vehicles3d/spec.js";
import { computeStats } from "../../vehicles3d/stats.js";
import { ColorInput, Section, Segmented, Select, Slider, TextField, Toggle } from "../controls.jsx";
import { HangarIcon, TankIcon, XrayIcon } from "../icons.jsx";
import { isMuted, setMuted } from "../../vehicles3d/sound.js";
import { Arena } from "./Arena.jsx";
import { Viewer3D } from "./Viewer3D.jsx";
import { DuelPanel, HitLog, PartsPanel, PhotoPanel, PhotoResult, RESOLUTIONS, TestPanel } from "./WorkshopTools.jsx";

const TOOLS = [
  { id: "build", label: "Build", Icon: Wrench },
  { id: "test", label: "Shoot test", Icon: Crosshair },
  { id: "duel", label: "Duel", Icon: Swords },
  { id: "photo", label: "Photo", Icon: Camera },
];

const VIEWS = [
  { id: "normal", label: "Normal", Icon: Eye },
  { id: "armor", label: "Armour", Icon: Shield },
  { id: "xray", label: "X-ray", Icon: XrayIcon },
];

function Field({ f, value, onChange }) {
  const fmt = (v) => `${Number.isInteger(f.step) ? Math.round(v) : Number(v).toFixed(f.step < 0.1 ? 2 : 1)}${f.unit ? ` ${f.unit}` : ""}`;
  switch (f.type) {
    case "range":
    case "armor":
    case "slope":
      return <Slider label={f.label} value={value} min={f.min} max={f.max} step={f.step} onChange={onChange} format={fmt} />;
    case "select":
      return <Select label={f.label} value={value} onChange={onChange} options={f.options.map(([v, l]) => ({ value: v, label: l }))} />;
    case "toggle":
      return <Toggle label={f.label} hint={f.hint} checked={!!value} onChange={onChange} />;
    case "color":
      return <ColorInput label={f.label} value={value} onChange={onChange} />;
    default:
      return <TextField label={f.label} value={value ?? ""} maxLength={f.max} onChange={onChange} />;
  }
}

/** The 3D Workshop: shape every part of a vehicle and watch its stats change. */
export function Workshop({ initial, context, hangar, onDone, onClose, notify, onAddPicture }) {
  const { design: vehicle, set, undo, redo, canUndo, canRedo } = useHistory(initial);
  const [view, setView] = useState("normal");
  const [playing, setPlaying] = useState(() => !/[?&]still/.test(location.search));
  const [armor, setArmor] = useState(null);
  const [gallery, setGallery] = useState(null); // "presets" | "hangar" | "opponent-presets" | "opponent-hangar"
  const [tool, setTool] = useState("build");
  // Hand-placed parts.
  const [placing, setPlacing] = useState(null);
  const [selectedPart, setSelectedPart] = useState(null);
  const setParts = (fn) => set((v) => ({ ...v, preset: null, addons: fn(v.addons) }));
  const updatePart = (id, patch) => setParts((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const removePart = (id) => {
    setParts((list) => list.filter((a) => a.id !== id));
    setSelectedPart(null);
  };
  const duplicatePart = (id) => {
    const nid = addonId();
    setParts((list) => {
      const a = list.find((x) => x.id === id);
      return a ? [...list, { ...structuredClone(a), id: nid, pos: [a.pos[0] - a.size[0] * 1.1, a.pos[1], a.pos[2]] }] : list;
    });
    setSelectedPart(nid);
  };
  const parts = useMemo(
    () =>
      tool === "build"
        ? {
            placing,
            selectedId: selectedPart,
            onSelect: setSelectedPart,
            onPlace: (pl, more) => {
              const def = ADDONS.find((d) => d.id === placing);
              const id = addonId();
              setParts((list) => [...list, { id, type: def.id, on: pl.on, pos: pl.pos, rot: pl.rot, size: [...def.size], mirror: false, color: null, armor: def.armor ?? 0 }]);
              setSelectedPart(id);
              if (!more) setPlacing(null);
            },
            onMove: (id, patch) => updatePart(id, patch),
          }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tool, placing, selectedPart],
  );
  const [muted, setMutedState] = useState(isMuted);
  // Shoot test & duel.
  const [weapon, setWeapon] = useState(null);
  const [testDistance, setTestDistance] = useState(500);
  const [opponent, setOpponent] = useState(() => PRESETS3D.find((v) => v.preset === (initial.preset === "sherman" ? "tiger1" : "sherman")) ?? PRESETS3D[0]);
  const [duelDistance, setDuelDistance] = useState(600);
  const [speed, setSpeed] = useState(1);
  const [fight, setFight] = useState(0);
  const [duelStatus, setDuelStatus] = useState("idle"); // idle | running | over
  const [score, setScore] = useState(null);
  const [banner, setBanner] = useState(null);
  const [entries, setEntries] = useState([]);
  const [states, setStates] = useState({});
  const [testKey, setTestKey] = useState(0);
  // Photo mode.
  const [photo, setPhoto] = useState({ env: "field", sunAngle: 40, sunHeight: 50, fov: 32, res: "1080" });
  const [photoUrl, setPhotoUrl] = useState(null);
  const viewer = useRef(null);
  const sun = useMemo(() => ({ angle: photo.sunAngle, height: photo.sunHeight }), [photo.sunAngle, photo.sunHeight]);
  const switchTool = (t) => {
    setTool(t);
    setEntries([]);
    setStates({});
    setBanner(null);
    setDuelStatus("idle");
    if (t !== "build" && t !== "photo") setView("normal");
  };
  useEffect(() => {
    if (vehicle.kind !== "tank" && (tool === "test" || tool === "duel")) setTool("build");
  }, [vehicle.kind, tool]);
  const onShot = useCallback((e) => setEntries((list) => [e, ...list].slice(0, 60)), []);
  const onState = useCallback((st) => setStates(structuredClone(st)), []);
  const onEnd = useCallback(({ winner }) => {
    setDuelStatus("over");
    setScore((s) => {
      const n = { A: 0, B: 0, draw: 0, ...s };
      n[winner ?? "draw"]++;
      return n;
    });
    setBanner(winner === "A" ? "Victory!" : winner === "B" ? "Knocked out" : "Draw");
  }, []);
  const startFight = () => {
    setEntries([]);
    setBanner(null);
    setDuelStatus("running");
    setFight((f) => f + 1);
  };
  const takePhoto = () => {
    const r = RESOLUTIONS.find((x) => x.id === photo.res) ?? RESOLUTIONS[0];
    const url = viewer.current?.capture(r.w, r.h);
    if (url) setPhotoUrl({ url, name: `${vehicle.name} photo` });
  };
  const stats = useMemo(() => computeStats(vehicle), [vehicle]);
  const sections = useMemo(() => fieldsFor(vehicle.kind), [vehicle.kind]);
  const change = (key, value) => set((v) => ({ ...v, preset: null, spec: setPath(v.spec, key, value) }));

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea, select")) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z" && !e.shiftKey) (e.preventDefault(), undo());
      else if ((e.ctrlKey || e.metaKey) && (k === "y" || (k === "z" && e.shiftKey))) (e.preventDefault(), redo());
      else if (k === "1") setView("normal");
      else if (k === "2") setView("armor");
      else if (k === "3") setView("xray");
      else if (k === "p") setPlaying((p) => !p);
      else if (k === "m" && selectedPart) updatePart(selectedPart, { mirror: !vehicle.addons.find((a) => a.id === selectedPart)?.mirror });
      else if (k === "m") setMutedState((m) => (setMuted(!m), !m));
      else if ((k === "delete" || k === "backspace") && selectedPart) removePart(selectedPart);
      else if ((e.ctrlKey || e.metaKey) && k === "d" && selectedPart) (e.preventDefault(), duplicatePart(selectedPart));
      else if (k === "escape" && (placing || selectedPart)) (setPlacing(null), setSelectedPart(null));
      else if (k === "escape" && gallery) setGallery(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, gallery, selectedPart, placing, vehicle]);

  const onArmorHover = useCallback((info) => setArmor(info), []);
  const applyPaint = (p) =>
    set((v) => ({ ...v, spec: { ...v.spec, paint: { ...v.spec.paint, base: p.base, camo: p.camo, c1: p.colors[0], c2: p.colors[1], c3: p.colors[2], gloss: p.gloss ? 0.6 : p.metal ? 0.4 : 0.1 } } }));
  const load = (v) => {
    set({ ...structuredClone(v), id: v.preset ? vehicleId() : v.id });
    setGallery(null);
  };
  const nation = NATIONS.find((n) => n.id === vehicle.nation);

  return (
    <div className="pop-in flex min-h-0 flex-1 flex-col gap-2 px-2 pb-2" data-testid="workshop">
      {/* Top bar */}
      <div className="glass-chrome flex h-14 flex-none items-center gap-2 rounded-2xl px-2.5">
        <button type="button" onClick={onClose} className="chip-btn" title="Leave the Workshop">
          <ArrowLeft size={15} /> Back
        </button>
        <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-accent/30 to-accent-2/20 text-white">
          <TankIcon size={18} />
        </span>
        <input
          value={vehicle.name}
          onChange={(e) => set((v) => ({ ...v, name: e.target.value.slice(0, 60) }))}
          aria-label="Vehicle name"
          className="w-40 min-w-0 rounded-lg border min-[1600px]:w-56 border-transparent bg-transparent px-2 py-1 font-display text-[16px] font-semibold outline-none hover:border-white/10 focus:border-accent/60"
        />
        <select value={vehicle.nation} onChange={(e) => set((v) => ({ ...v, nation: e.target.value }))} aria-label="Nation" className="rounded-lg border border-white/10 bg-[#161722] px-2 py-1.5 text-[12px]">
          {NATIONS.map((n) => (
            <option key={n.id} value={n.id}>
              {n.flag} {n.label}
            </option>
          ))}
        </select>
        <span className="mx-1 h-6 w-px bg-white/10" />
        <div className="flex rounded-xl bg-black/25 p-1" role="radiogroup" aria-label="Tool">
          {TOOLS.filter((t) => vehicle.kind === "tank" || t.id === "build" || t.id === "photo").map(({ id, label, Icon }) => (
            <button key={id} type="button" role="radio" aria-checked={tool === id} data-testid={`tool-${id}`} onClick={() => switchTool(id)} className={`press flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium whitespace-nowrap ${tool === id ? "bg-gradient-to-r from-accent/40 to-accent-2/30 text-white" : "text-muted hover:text-ink"}`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        {tool === "build" && <>
        <span className="mx-1 h-6 w-px bg-white/10" />
        <div className="flex rounded-xl bg-black/25 p-1" role="radiogroup" aria-label="View">
          {VIEWS.map(({ id, label, Icon }) => (
            <button key={id} type="button" role="radio" aria-checked={view === id} title={`${label} view`} onClick={() => setView(id)} className={`press flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium whitespace-nowrap ${view === id ? "bg-white/15 text-white" : "text-muted hover:text-ink"}`}>
              <Icon size={14} /> <span className="hidden min-[1760px]:inline">{label}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="chip-btn" title="Play animations (P)">
          {playing ? <Pause size={14} /> : <Play size={14} />} <span className="hidden min-[1760px]:inline">{playing ? "Pause" : "Play"}</span>
        </button>
        <button type="button" onClick={undo} disabled={!canUndo} className="chip-btn" aria-label="Undo" title="Undo (Ctrl+Z)">
          <Undo2 size={14} />
        </button>
        <button type="button" onClick={redo} disabled={!canRedo} className="chip-btn" aria-label="Redo" title="Redo (Ctrl+Y)">
          <Redo2 size={14} />
        </button>
        </>}
        {tool === "photo" && (
          <button type="button" onClick={() => setPlaying((p) => !p)} className="chip-btn" title="Play animations (P)">
            {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? "Pause" : "Play"}
          </button>
        )}
        <button type="button" onClick={() => setMutedState((m) => (setMuted(!m), !m))} className="chip-btn" aria-label={muted ? "Turn sound on" : "Mute"} title={muted ? "Sound is off (M)" : "Sound is on (M)"} data-testid="mute">
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
        <span className="flex-1" />
        {tool === "build" && <>
        <button type="button" onClick={(e) => set(randomVehicle(e.shiftKey, Math.random, vehicle.kind))} className="chip-btn" title={`Random ${vehicle.kind} (Shift+click for a cursed one)`} data-testid="random-tank">
          <Dices size={14} /> <span className="hidden min-[1760px]:inline">Random</span>
        </button>
        <button type="button" onClick={() => setGallery("presets")} className="chip-btn" title="Presets">
          <Box size={14} /> <span className="hidden min-[1500px]:inline">Presets</span>
        </button>
        <button type="button" onClick={() => setGallery("hangar")} className="chip-btn" title="Your hangar">
          <HangarIcon size={14} /> <span className="hidden min-[1500px]:inline">Hangar</span> ({hangar.list.length})
        </button>
        <button
          type="button"
          onClick={() => {
            hangar.save(vehicle);
            notify(`Saved ${vehicle.name} to your hangar`, "success");
          }}
          className="chip-btn"
          title="Save to hangar"
        >
          <Save size={14} /> <span className="hidden min-[1760px]:inline">Save to hangar</span>
        </button>
        </>}
        <button type="button" onClick={() => onDone(vehicle)} className="press focus-ring rounded-xl bg-gradient-to-r from-accent to-accent-2 px-4 py-2 text-[12.5px] font-semibold whitespace-nowrap text-[#0b0c12] shadow-[0_6px_20px_rgba(167,139,250,0.35)]">
          {context === "edit" ? "Update on canvas" : context === "insert" ? "Add to canvas" : "Make a card"}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 gap-2">
        {/* Settings */}
        <aside className="glass-chrome flex w-[310px] flex-none flex-col overflow-hidden rounded-2xl">
          <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3">
            {tool === "test" && <TestPanel vehicle={vehicle} hangar={hangar} weapon={weapon} setWeapon={setWeapon} distance={testDistance} setDistance={setTestDistance} onReset={() => (setTestKey((k) => k + 1), setEntries([]))} />}
            {tool === "duel" && <DuelPanel vehicle={vehicle} opponent={opponent} onPickOpponent={() => setGallery("opponent-presets")} distance={duelDistance} setDistance={setDuelDistance} speed={speed} setSpeed={setSpeed} onFight={startFight} status={duelStatus} score={score} />}
            {tool === "photo" && <PhotoPanel photo={photo} setPhoto={setPhoto} onShoot={takePhoto} />}
            {tool === "build" && <PartsPanel vehicle={vehicle} placing={placing} setPlacing={setPlacing} selectedId={selectedPart} setSelectedId={setSelectedPart} updatePart={updatePart} removePart={removePart} duplicatePart={duplicatePart} />}
            {tool === "build" && sections.map((sec) => (
              <Section key={sec.id} icon={sec.icon} title={sec.title}>
                {sec.id === "paint" && (
                  <div className="flex flex-wrap gap-1">
                    {PAINTS.map((p) => (
                      <button key={p.id} type="button" title={p.label} aria-label={p.label} onClick={() => applyPaint(p)} className="press size-7 rounded-lg border border-white/20" style={{ background: `linear-gradient(135deg, ${p.base} 0 50%, ${p.colors[0]} 50% 75%, ${p.colors[1]} 75%)` }} />
                    ))}
                  </div>
                )}
                {sec.fields.map((f) => (
                  <Field key={f.k} f={f} value={getPath(vehicle.spec, f.k)} onChange={(val) => change(f.k, val)} />
                ))}
              </Section>
            ))}
          </div>
        </aside>

        {/* 3D view */}
        <main className="glass-chrome relative min-w-0 flex-1 overflow-hidden rounded-2xl">
          {(tool === "build" || tool === "photo") && (
            <Viewer3D ref={viewer} vehicle={vehicle} view={tool === "photo" ? "normal" : view} playing={playing} onArmorHover={onArmorHover} sound={!muted} env={tool === "photo" ? photo.env : "field"} sun={tool === "photo" ? sun : null} fov={tool === "photo" ? photo.fov : 32} parts={parts} />
          )}
          {tool === "test" && weapon && <Arena key={`test-${testKey}`} mode="test" vehicle={vehicle} weapon={weapon} distance={testDistance} sound={!muted} onShot={onShot} onState={onState} />}
          {tool === "duel" && <Arena mode="duel" vehicle={vehicle} opponent={opponent} distance={duelDistance} fight={fight} speed={speed} sound={!muted} onShot={onShot} onState={onState} onEnd={onEnd} />}
          {banner && tool === "duel" && (
            <div className="pointer-events-none absolute inset-x-0 top-[18%] text-center" data-testid="duel-banner">
              <p className={`pop-in inline-block rounded-2xl px-8 py-3 font-display text-[40px] font-black tracking-tight shadow-2xl backdrop-blur ${banner === "Victory!" ? "bg-emerald-500/30 text-emerald-100" : banner === "Draw" ? "bg-white/15 text-white" : "bg-rose-600/35 text-rose-100"}`}>{banner}</p>
            </div>
          )}
          <div className="pointer-events-none absolute top-3 left-3 rounded-xl bg-black/45 px-3 py-2 text-[11.5px] text-white/85 backdrop-blur">
            {tool === "test" ? "Click the vehicle to fire · drag to orbit · scroll to zoom" : tool === "duel" ? (duelStatus === "idle" ? "Pick an opponent and press Fight!" : "Drag to orbit · scroll to zoom") : "Drag to orbit · scroll to zoom · right-drag to pan · 1/2/3 views"}
          </div>
          {tool === "build" && view === "armor" && (
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl bg-black/55 p-2.5 text-[10.5px] text-white backdrop-blur" data-testid="armor-legend">
              <p className="mb-1 font-semibold">Armour thickness (mm)</p>
              <div className="h-2.5 w-64 rounded-full" style={{ background: `linear-gradient(90deg, ${ARMOR_STOPS.map(([, c]) => c).join(", ")})` }} />
              <div className="mt-0.5 flex w-64 justify-between font-mono">
                {[0, 50, 120, 260, 650].map((n) => (
                  <span key={n}>{n}</span>
                ))}
              </div>
              <p className="mt-1 text-white/70">Point at a plate: its effective thickness from where you look.</p>
            </div>
          )}
          {tool === "build" && view === "xray" && (
            <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-x-3 gap-y-1 rounded-xl bg-black/55 p-2.5 text-[11px] text-white backdrop-blur">
              {[["#facc15", "Commander"], ["#f87171", "Gunner"], ["#fb923c", "Loader"], ["#4ade80", "Driver"], ["#60a5fa", "Radio op."], ["#d6a640", "Ammo"], ["#f43f5e", "Engine"], ["#facc15", "Fuel"], ["#a78bfa", "Transmission"]].map(([c, l]) => (
                <span key={l} className="flex items-center gap-1">
                  <i className="inline-block size-2.5 rounded-full" style={{ background: c }} /> {l}
                </span>
              ))}
            </div>
          )}
          {armor && (
            <div className="pointer-events-none absolute z-10 rounded-lg bg-[#0b0c12]/90 px-2.5 py-1.5 text-[11.5px] text-white shadow-xl ring-1 ring-white/15" style={{ left: armor.x + 16, top: armor.y + 12 }} data-testid="armor-tip">
              <p className="font-semibold">{armor.name}</p>
              <p className="font-mono">
                {Math.round(armor.t)} mm at {Math.round(armor.angle)}° → <b className="text-accent-2">{Math.round(armor.effective)} mm</b>
              </p>
            </div>
          )}
        </main>

        {/* Stats */}
        <aside className="glass-chrome flex w-[270px] flex-none flex-col overflow-hidden rounded-2xl">
          {(tool === "test" || tool === "duel") && (
            <div className="flex min-h-0 flex-1 flex-col p-3">
              <HitLog entries={entries} states={states} names={{ you: vehicle.name, A: vehicle.name, B: opponent?.name ?? "Enemy" }} onAddPicture={onAddPicture} notify={notify} onOpen={(u) => setPhotoUrl({ url: u, name: "hit camera" })} />
            </div>
          )}
          {(tool === "build" || tool === "photo") && <div className="scroll-thin flex flex-col gap-3 overflow-y-auto p-4" data-testid="stats">
            <div className="flex items-center gap-3">
              <div className="grid size-16 flex-none place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 text-center text-[#0b0c12] shadow-lg">
                <div>
                  {/* Cars have no battle rating: show their top speed instead. */}
                  <p className="text-[9px] font-bold tracking-widest">{stats.br != null ? "BR" : "KM/H"}</p>
                  <p className="font-display text-[22px] leading-none font-black" data-testid="br">
                    {stats.br != null ? stats.br.toFixed(1) : Math.round(stats.rows.find((r) => r.key === "speed")?.value ?? 0)}
                  </p>
                </div>
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-[15px] font-semibold">{vehicle.name}</p>
                <p className="text-[11.5px] text-muted">
                  {nation?.flag} {nation?.label}
                </p>
                <p className="truncate text-[11px] text-accent-2">{stats.headline}</p>
              </div>
            </div>
            {vehicle.approx && <p className="rounded-lg bg-white/[0.05] px-2 py-1.5 text-[10.5px] text-muted">Based on the real vehicle; numbers are approximate.</p>}
            <div className="flex flex-col gap-2">
              {stats.rows.map((r) => (
                <div key={r.key}>
                  <div className="flex justify-between text-[11.5px]">
                    <span className="text-ink/80">{r.label}</span>
                    <span className="font-mono text-white">{r.text}</span>
                  </div>
                  {r.bar != null && (
                    <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-[width] duration-500" style={{ width: `${Math.round(r.bar * 100)}%` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {stats.warnings.map((w) => (
              <p key={w} className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1.5 text-[11px] text-amber-100">
                {w}
              </p>
            ))}
          </div>}
        </aside>
      </div>

      {gallery && !gallery.startsWith("opponent") && <Gallery kind={gallery} hangar={hangar} onPick={load} onClose={() => setGallery(null)} />}
      {gallery?.startsWith("opponent") && (
        <Gallery
          kind={gallery === "opponent-hangar" ? "hangar" : "presets"}
          kinds={["tank"]}
          hangar={hangar}
          title={
            <span className="flex items-center gap-2">
              Choose an opponent
              <button type="button" onClick={() => setGallery(gallery === "opponent-hangar" ? "opponent-presets" : "opponent-hangar")} className="chip-btn text-[12px] font-normal">
                {gallery === "opponent-hangar" ? "Show presets" : `Your hangar (${hangar.list.length})`}
              </button>
            </span>
          }
          onPick={(v) => {
            setOpponent(structuredClone(v));
            setGallery(null);
            setDuelStatus("idle");
            setBanner(null);
            setEntries([]);
          }}
          onClose={() => setGallery(null)}
        />
      )}
      {photoUrl && <PhotoResult url={photoUrl.url} name={photoUrl.name} onClose={() => setPhotoUrl(null)} onAddPicture={(u, n) => onAddPicture?.(u, n)} notify={notify} />}
    </div>
  );
}

// Thumbnails render one at a time (building a tank takes a moment) and are cached.
const thumbCache = new Map();
let thumbQueue = Promise.resolve();
function thumbnail(vehicle) {
  const key = JSON.stringify(vehicle);
  if (!thumbCache.has(key)) {
    thumbCache.set(
      key,
      (thumbQueue = thumbQueue.then(
        () =>
          new Promise((resolve) =>
            setTimeout(async () => {
              const s = await import("../../vehicles3d/service.js");
              resolve(s.snapshot(vehicle, { yaw: 35, pitch: 14, zoom: 1.05 }, 480, 280));
            }, 40),
          ),
      )),
    );
  }
  return thumbCache.get(key);
}

/** Thumbnail rendered by the shared 3D renderer. */
export function VehicleThumb({ vehicle, className = "" }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    thumbnail(vehicle).then((url) => alive && setSrc(url));
    return () => {
      alive = false;
    };
  }, [vehicle]);
  return src ? <img src={src} alt="" className={className} draggable={false} /> : <div className={`${className} animate-pulse bg-white/5`} />;
}

export function Gallery({ kind, hangar, onPick, onClose, title, kinds = ["tank", "plane", "car"] }) {
  const items = (kind === "presets" ? PRESETS3D : hangar.list).filter((v) => kinds.includes(v.kind));
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-6 backdrop-blur-sm" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="menu-surface pop-in flex max-h-[86vh] w-[min(1100px,94vw)] flex-col p-5!" role="dialog" aria-label={kind === "presets" ? "Presets" : "Hangar"}>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="flex-1 font-display text-[18px] font-semibold">{title ?? (kind === "presets" ? "Presets: real vehicles, approximate" : "Your hangar")}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="press grid size-8 place-items-center rounded-lg text-muted hover:bg-white/10">
            <X size={16} />
          </button>
        </div>
        {items.length === 0 && <p className="py-10 text-center text-[13px] text-muted">Nothing saved yet. Build something and press “Save to hangar”.</p>}
        <div className="scroll-thin grid min-h-0 grid-cols-3 gap-3 overflow-y-auto p-0.5">
          {items.map((v, i) => {
            const st = computeStats(v);
            const n = NATIONS.find((x) => x.id === v.nation);
            return (
              <div key={v.id} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] hover:border-accent/50" style={i > 0 && items[i - 1].kind !== v.kind ? { gridColumnStart: 1 } : undefined}>
                <button type="button" onClick={() => onPick(v)} className="block w-full text-left" data-testid="gallery-item">
                  <VehicleThumb vehicle={v} className="aspect-[12/7] w-full object-cover" />
                  <div className="flex items-center gap-2 px-3 py-2">
                    <span className="text-[16px]">{n?.flag}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{v.name}</span>
                    {st.br && <span className="rounded-md bg-amber-400/90 px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#0b0c12]">{st.br.toFixed(1)}</span>}
                  </div>
                </button>
                {kind === "hangar" && (
                  <button type="button" aria-label={`Delete ${v.name}`} onClick={() => hangar.remove(v.id)} className="absolute top-2 right-2 grid size-7 place-items-center rounded-lg bg-black/60 text-rose-200 opacity-0 group-hover:opacity-100">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
