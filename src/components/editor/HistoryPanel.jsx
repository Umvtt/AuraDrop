import { useEffect, useMemo } from "react";
import { History, X } from "lucide-react";
import { describeChange } from "../../lib/describe.js";

/** Every change so far, newest first; click one to go back (or forward) to it. */
export function HistoryPanel({ editor, onClose }) {
  const { states, index } = editor.timeline();
  const items = useMemo(() => states.map((s, i) => ({ i, label: describeChange(states[i - 1], s) })).reverse(), [states]);
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="glass-float pop-in absolute top-16 right-3 z-30 flex max-h-[70%] w-64 flex-col rounded-2xl p-2" data-testid="history-panel">
      <div className="flex items-center gap-2 px-2 py-1">
        <History size={14} className="text-accent" />
        <span className="flex-1 text-[12.5px] font-semibold">History</span>
        <button type="button" aria-label="Close history" onClick={onClose} className="press grid size-6 place-items-center rounded-md text-muted hover:bg-white/10">
          <X size={13} />
        </button>
      </div>
      <div className="scroll-thin flex min-h-0 flex-col gap-0.5 overflow-y-auto">
        {items.map(({ i, label }) => (
          <button
            key={i}
            type="button"
            onClick={() => editor.jumpTo(i)}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] ${i === index ? "bg-accent/25 text-ink" : i > index ? "text-muted/60 hover:bg-white/[0.06]" : "text-ink/85 hover:bg-white/[0.06]"}`}
          >
            <span className={`size-1.5 flex-none rounded-full ${i === index ? "bg-accent" : i > index ? "bg-white/20" : "bg-white/50"}`} />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>
      <p className="px-2 pt-1.5 text-[10.5px] text-muted">Greyed steps were undone; doing something new drops them.</p>
    </div>
  );
}
