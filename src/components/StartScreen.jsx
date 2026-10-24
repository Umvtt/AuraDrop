import { useState } from "react";
import { Clock, FolderOpen, LifeBuoy, Wrench, X } from "lucide-react";
import { CANVAS_PRESETS, TEMPLATES } from "../lib/project.js";
import { Select } from "./controls.jsx";
import { TankIcon } from "./icons.jsx";
import { Logo } from "./TitleBar.jsx";

/** First screen: templates, the Vehicle Workshop, recent files and recovery. */
export function StartScreen({ onCreate, onOpen, onOpenPath, onClose, onWorkshop, onNewVehicle, recent = [], recovery, onRecover, onDismissRecovery }) {
  const [size, setSize] = useState("auto");
  return (
    <div className="pop-in flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="glass-chrome flex max-h-full w-full max-w-[1040px] flex-col rounded-3xl p-7">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <div className="flex-1">
            <h1 className="font-display text-[24px] font-semibold tracking-tight">What do you want to make?</h1>
            <p className="text-[13px] text-muted">Pick a starting point. You can change everything afterwards.</p>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} className="chip-btn">
              Back to editing
            </button>
          )}
        </div>

        {recovery && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3" data-testid="recovery">
            <LifeBuoy size={18} className="text-amber-200" />
            <p className="flex-1 text-[12.5px] text-amber-50">
              Unsaved work from {new Date(recovery.savedAt).toLocaleString()} ({recovery.name}) can be recovered.
            </p>
            <button type="button" onClick={onRecover} className="chip-btn">
              Recover
            </button>
            <button type="button" aria-label="Dismiss" onClick={onDismissRecovery} className="chip-btn">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="scroll-thin mt-5 min-h-0 overflow-y-auto p-0.5">
          <button
            type="button"
            onClick={onWorkshop}
            data-testid="open-workshop"
            className="press focus-ring group relative mb-3 flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-accent-2/30 bg-gradient-to-r from-[#1b1d2c] via-[#1a2433] to-[#2a1f12] p-5 text-left hover:border-accent-2/60"
          >
            <span className="grid size-16 flex-none place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 text-[#0b0c12] shadow-lg transition-[scale] duration-300 ease-spring group-hover:scale-110">
              <TankIcon size={34} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[18px] font-semibold text-white">Vehicle Workshop (3D)</span>
              <span className="block text-[12.5px] leading-snug text-muted">Build your own tank or tweak a Tiger, Panther, T-34, Sherman, IS-2, Abrams… See its armour and X-ray, watch the stats and battle rating change live, then put it on a card.</span>
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onNewVehicle();
              }}
              className="chip-btn"
            >
              <Wrench size={14} /> Build from scratch
            </span>
          </button>

          <div className="grid grid-cols-4 gap-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onCreate(t.id, size === "auto" ? undefined : size)}
                className="press focus-ring group flex flex-col items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left hover:border-accent/50 hover:bg-white/[0.08]"
              >
                <span className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-accent/30 to-accent-2/20 text-[26px] transition-[scale] duration-300 ease-spring group-hover:scale-110">{t.emoji}</span>
                <span className="text-[14px] font-semibold text-white">{t.label}</span>
                <span className="text-[11.5px] leading-snug text-muted">{t.hint}</span>
              </button>
            ))}
          </div>

          {recent.length > 0 && (
            <div className="mt-5">
              <p className="panel-label mb-2 flex items-center gap-1.5">
                <Clock size={12} /> Recent
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {recent.map((r) => (
                  <button key={r.path} type="button" onClick={() => onOpenPath(r.path)} title={r.path} className="press flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-left text-[12.5px] hover:bg-white/[0.08]">
                    <FolderOpen size={14} className="flex-none text-muted" />
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    <span className="flex-none text-[10.5px] text-muted">{new Date(r.at).toLocaleDateString()}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-end gap-3">
          <div className="w-64">
            <Select
              label="Canvas size"
              value={size}
              onChange={setSize}
              options={[{ value: "auto", label: "Best for the template" }, ...CANVAS_PRESETS.map((p) => ({ value: p.id, label: `${p.label} (${p.w}×${p.h})` }))]}
            />
          </div>
          <span className="flex-1" />
          <button type="button" onClick={onOpen} className="press focus-ring flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.07] px-4 py-2.5 text-[13px] font-medium hover:bg-white/[0.12]">
            <FolderOpen size={15} /> Open a project…
          </button>
        </div>
      </div>
    </div>
  );
}
