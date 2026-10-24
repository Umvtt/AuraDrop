import { useState } from "react";
import { CANVAS_PRESETS, TEMPLATES } from "../lib/project.js";
import { Select } from "./controls.jsx";
import { Logo } from "./TitleBar.jsx";

/** First screen: pick a template (or open a file). */
export function StartScreen({ onCreate, onOpen, onClose }) {
  const [size, setSize] = useState("auto");
  return (
    <div className="pop-in flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="glass-chrome flex max-h-full w-full max-w-[920px] flex-col rounded-3xl p-7">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <div className="flex-1">
            <h1 className="font-display text-[24px] font-semibold tracking-tight">What do you want to make?</h1>
            <p className="text-[13px] text-muted">Pick a starting point. You can change everything afterwards.</p>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} className="press focus-ring rounded-xl px-3 py-2 text-[12.5px] text-muted hover:bg-white/10 hover:text-ink">
              Back to editing
            </button>
          )}
        </div>

        <div className="scroll-thin mt-6 grid min-h-0 grid-cols-4 gap-3 overflow-y-auto p-0.5">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onCreate(t.id, size === "auto" ? undefined : size)}
              className="press focus-ring group flex flex-col items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left hover:border-accent/50 hover:bg-white/[0.08]"
            >
              <span className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-accent/30 to-accent-2/20 text-[26px] transition-[scale] duration-300 ease-spring group-hover:scale-110">
                {t.emoji}
              </span>
              <span className="text-[14px] font-semibold text-white">{t.label}</span>
              <span className="text-[11.5px] leading-snug text-muted">{t.hint}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-end gap-3">
          <div className="w-64">
            <Select
              label="Canvas size"
              value={size}
              onChange={setSize}
              options={[{ value: "auto", label: "Best for the template" }, ...CANVAS_PRESETS.map((p) => ({ value: p.id, label: `${p.label} (${p.w}×${p.h})` }))]}
            />
          </div>
          <span className="flex-1" />
          <button type="button" onClick={onOpen} className="press focus-ring rounded-xl border border-white/12 bg-white/[0.07] px-4 py-2.5 text-[13px] font-medium hover:bg-white/[0.12]">
            📂 Open a project…
          </button>
        </div>
      </div>
    </div>
  );
}
