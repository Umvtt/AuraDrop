import { useMemo, useState } from "react";
import { Copy, Dices, FilePlus, FolderOpen, LayoutTemplate, Pencil, Search, Trash2, Wrench } from "lucide-react";
import { CANVAS_PRESETS, TEMPLATES } from "../lib/project.js";
import { NATIONS } from "../vehicles3d/spec.js";
import { computeStats } from "../vehicles3d/stats.js";
import { PRESETS3D } from "../vehicles3d/presets.js";
import { Select } from "./controls.jsx";
import { HangarIcon, TankIcon } from "./icons.jsx";
import { Logo } from "./TitleBar.jsx";
import { VehicleThumb } from "./workshop/Workshop.jsx";

const TABS = [
  { id: "projects", label: "Projects", Icon: FolderOpen },
  { id: "templates", label: "Templates", Icon: LayoutTemplate },
  { id: "workshop", label: "Vehicle Workshop", Icon: TankIcon },
  { id: "hangar", label: "Hangar", Icon: HangarIcon },
];

function ago(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(t).toLocaleDateString();
}

/** Home: your projects, templates, the Workshop and your hangar, in tabs. */
export function Home({ tab, onTab, library, hangar, onOpenProject, onCreate, onImport, onWorkshop, onRandomTank, onConfirmDelete }) {
  return (
    <div className="pop-in flex min-h-0 flex-1 gap-2 px-2 pb-2" data-testid="home">
      <nav className="glass-chrome flex w-[220px] flex-none flex-col gap-1 rounded-2xl p-3" aria-label="Home sections">
        <div className="mb-3 flex items-center gap-2 px-1">
          <Logo size={28} />
          <span className="font-display text-[16px] font-semibold">Home</span>
        </div>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTab(id)}
            aria-current={tab === id ? "page" : undefined}
            data-testid={`tab-${id}`}
            className={`press focus-ring flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium ${tab === id ? "layer-row-on" : "text-ink/80 hover:bg-white/[0.06]"}`}
          >
            <Icon size={17} /> {label}
            {id === "projects" && library.items.length > 0 && <span className="ml-auto text-[11px] text-muted">{library.items.length}</span>}
            {id === "hangar" && hangar.list.length > 0 && <span className="ml-auto text-[11px] text-muted">{hangar.list.length}</span>}
          </button>
        ))}
        <span className="flex-1" />
        <button type="button" onClick={() => onCreate("blank")} className="press focus-ring flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-2 px-3 py-2.5 text-[13px] font-semibold text-[#0b0c12]">
          <FilePlus size={16} /> New project
        </button>
        <button type="button" onClick={onImport} className="chip-btn mt-1 py-2">
          <FolderOpen size={14} /> Open a file…
        </button>
      </nav>

      <main className="glass-chrome scroll-thin min-w-0 flex-1 overflow-y-auto rounded-2xl p-6">
        {tab === "projects" && <Projects library={library} onOpen={onOpenProject} onCreate={onCreate} onTab={onTab} onConfirmDelete={onConfirmDelete} />}
        {tab === "templates" && <Templates onCreate={onCreate} />}
        {tab === "workshop" && <WorkshopTab onWorkshop={onWorkshop} onRandomTank={onRandomTank} />}
        {tab === "hangar" && <HangarTab hangar={hangar} onWorkshop={onWorkshop} onConfirmDelete={onConfirmDelete} />}
      </main>
    </div>
  );
}

function Heading({ title, hint, children }) {
  return (
    <div className="mb-5 flex items-end gap-3">
      <div className="flex-1">
        <h1 className="font-display text-[22px] font-semibold tracking-tight">{title}</h1>
        {hint && <p className="text-[13px] text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Projects({ library, onOpen, onCreate, onTab, onConfirmDelete }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("recent");
  const [renaming, setRenaming] = useState(null);
  const list = useMemo(() => {
    const f = library.items.filter((x) => x.name.toLowerCase().includes(q.trim().toLowerCase()));
    return sort === "name" ? f.sort((a, b) => a.name.localeCompare(b.name)) : f.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [library.items, q, sort]);
  return (
    <>
      <Heading title="Your projects" hint="Everything saves automatically. Open one to keep going.">
        <label className="flex w-60 items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 focus-within:border-accent/60">
          <Search size={14} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects" aria-label="Search projects" className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none" />
        </label>
        <div className="w-40">
          <Select label="Sort" hideLabel value={sort} onChange={setSort} options={[{ value: "recent", label: "Most recent" }, { value: "name", label: "Name" }]} />
        </div>
      </Heading>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
        <button type="button" onClick={() => onTab("templates")} className="press focus-ring flex aspect-[4/3.4] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 text-muted hover:border-accent/60 hover:text-ink" data-testid="new-from-template">
          <FilePlus size={28} />
          <span className="text-[13px] font-medium">New project</span>
          <span className="text-[11.5px]">Start from a template</span>
        </button>
        {list.map((p) => (
          <div key={p.id} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] hover:border-accent/50" data-testid="project-card">
            <button type="button" onClick={() => onOpen(p.id)} className="block w-full text-left">
              <div className="grid aspect-[4/2.7] place-items-center overflow-hidden bg-black/40">
                {p.thumb ? <img src={p.thumb} alt="" className="h-full w-full object-contain" draggable={false} /> : <LayoutTemplate size={34} className="text-white/20" />}
              </div>
            </button>
            <div className="px-3 py-2.5">
              {renaming === p.id ? (
                <input
                  autoFocus
                  defaultValue={p.name}
                  aria-label="Project name"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== p.name) library.rename(p.id, v);
                    setRenaming(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  className="w-full rounded bg-black/40 px-1 text-[13px] font-semibold outline-none"
                />
              ) : (
                <p className="truncate text-[13px] font-semibold" title={p.name}>
                  {p.name}
                </p>
              )}
              <p className="text-[11px] text-muted">
                {ago(p.updatedAt)} · {p.canvas?.w}×{p.canvas?.h}
                {p.pages > 1 ? ` · ${p.pages} pages` : ""}
              </p>
            </div>
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {[
                ["Rename", Pencil, () => setRenaming(p.id)],
                ["Duplicate", Copy, () => library.duplicate(p.id)],
                ["Delete", Trash2, async () => (await onConfirmDelete(p.name)) && library.remove(p.id)],
              ].map(([label, Icon, fn]) => (
                <button key={label} type="button" aria-label={`${label} ${p.name}`} title={label} onClick={fn} className={`grid size-7 place-items-center rounded-lg bg-black/65 backdrop-blur ${label === "Delete" ? "text-rose-200" : "text-white"} hover:bg-black/85`}>
                  <Icon size={13} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {library.loaded && library.items.length === 0 && (
        <p className="mt-6 text-center text-[13px] text-muted">
          No projects yet. Pick a template, or press <b>New project</b>.
        </p>
      )}
    </>
  );
}

function Templates({ onCreate }) {
  const [size, setSize] = useState("auto");
  return (
    <>
      <Heading title="Templates" hint="A starting point; you can change everything afterwards.">
        <div className="w-64">
          <Select
            label="Canvas size"
            value={size}
            onChange={setSize}
            options={[{ value: "auto", label: "Best for the template" }, ...CANVAS_PRESETS.map((p) => ({ value: p.id, label: `${p.label} (${p.w}×${p.h})` }))]}
          />
        </div>
      </Heading>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onCreate(t.id, size === "auto" ? undefined : size)}
            data-testid={`template-${t.id}`}
            className="press focus-ring group flex flex-col items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left hover:border-accent/50 hover:bg-white/[0.08]"
          >
            <span className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-accent/30 to-accent-2/20 text-[26px] transition-[scale] duration-300 ease-spring group-hover:scale-110">{t.emoji}</span>
            <span className="text-[14px] font-semibold text-white">{t.label}</span>
            <span className="text-[11.5px] leading-snug text-muted">{t.hint}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function VehicleCard({ v, onClick, onDelete }) {
  const st = computeStats(v);
  const n = NATIONS.find((x) => x.id === v.nation);
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] hover:border-accent/50">
      <button type="button" onClick={onClick} className="block w-full text-left" data-testid="vehicle-card">
        <VehicleThumb vehicle={v} className="aspect-[12/7] w-full object-cover" />
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="text-[16px]">{n?.flag}</span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{v.name}</span>
          {st.br && <span className="rounded-md bg-amber-400/90 px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#0b0c12]">{st.br.toFixed(1)}</span>}
        </div>
      </button>
      {onDelete && (
        <button type="button" aria-label={`Delete ${v.name}`} onClick={onDelete} className="absolute top-2 right-2 grid size-7 place-items-center rounded-lg bg-black/65 text-rose-200 opacity-0 group-hover:opacity-100">
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

function WorkshopTab({ onWorkshop, onRandomTank }) {
  return (
    <>
      <Heading title="Vehicle Workshop" hint="Build a tank in 3D, see its armour and X-ray, and watch the stats and battle rating change.">
        <button type="button" onClick={onRandomTank} className="chip-btn" title="Shift+click for a cursed one">
          <Dices size={14} /> Random tank
        </button>
        <button type="button" onClick={() => onWorkshop(null)} className="press focus-ring flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-2 px-4 py-2 text-[13px] font-semibold text-[#0b0c12]">
          <Wrench size={15} /> Build from scratch
        </button>
      </Heading>
      <p className="panel-label mb-2">Start from a real tank (approximate)</p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
        {PRESETS3D.map((v) => (
          <VehicleCard key={v.id} v={v} onClick={() => onWorkshop(v)} />
        ))}
      </div>
    </>
  );
}

function HangarTab({ hangar, onWorkshop, onConfirmDelete }) {
  return (
    <>
      <Heading title="Hangar" hint="Vehicles you saved from the Workshop." />
      {hangar.list.length === 0 && <p className="py-10 text-center text-[13px] text-muted">Nothing here yet. In the Workshop, press “Save to hangar”.</p>}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
        {hangar.list.map((v) => (
          <VehicleCard key={v.id} v={v} onClick={() => onWorkshop(v)} onDelete={async () => (await onConfirmDelete(v.name)) && hangar.remove(v.id)} />
        ))}
      </div>
    </>
  );
}
