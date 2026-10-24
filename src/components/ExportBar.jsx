import { useEffect, useMemo, useState } from "react";
import { generateCode } from "../lib/codegen.js";
import { Icons } from "./TitleBar.jsx";

const FORMATS = [
  { id: "css", label: "CSS", hint: "Plain stylesheet with class names" },
  { id: "html", label: "HTML", hint: "Paste-anywhere snippet with styles and tilt script" },
  { id: "tailwind", label: "Tailwind", hint: "Markup with Tailwind utility classes" },
];

/** Instant Code Export Hub. */
export function ExportBar({ design, onCopy, onExportPng, exporting }) {
  const [peek, setPeek] = useState(null);
  const [copied, setCopied] = useState(null);
  const [withScene, setWithScene] = useState(true);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const peekCode = useMemo(() => (peek ? generateCode(design, peek) : ""), [design, peek]);

  const copy = async (id) => {
    if (await onCopy(generateCode(design, id), FORMATS.find((f) => f.id === id).label)) setCopied(id);
  };

  return (
    <div className="relative flex-none">
      {peek && (
        <div className="pop-in glass-chrome absolute inset-x-0 bottom-full z-30 mb-2 flex h-[300px] flex-col overflow-hidden rounded-2xl backdrop-blur-2xl" style={{ background: "rgba(12, 13, 20, 0.94)" }}>
          <div className="flex items-center gap-1 border-b border-white/[0.07] px-2 py-1.5">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setPeek(f.id)}
                className={`press focus-ring rounded-lg px-3 py-1 text-[12px] font-medium ${
                  peek === f.id ? "bg-white/12 text-white" : "text-muted hover:text-ink"
                }`}
              >
                {f.label}
              </button>
            ))}
            <span className="ml-2 text-[11px] text-muted">{FORMATS.find((f) => f.id === peek).hint}</span>
            <button
              type="button"
              onClick={() => copy(peek)}
              className="press focus-ring ml-auto flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-[12px] font-medium hover:bg-white/15"
            >
              {copied === peek ? Icons.check : Icons.copy} {copied === peek ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="code-view scroll-thin m-0 flex-1 overflow-auto p-3 text-ink/85">{peekCode}</pre>
        </div>
      )}

      <div className="glass-chrome flex h-14 items-center gap-2 rounded-2xl px-2.5">
        <span className="px-1.5 text-[11px] font-semibold tracking-wider whitespace-nowrap text-muted uppercase @max-[880px]:hidden">Copy code</span>
        {FORMATS.map((f) => (
          <button
            key={f.id}
            type="button"
            title={f.hint}
            onClick={() => copy(f.id)}
            className={`press focus-ring flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[12.5px] font-semibold whitespace-nowrap @max-[880px]:px-2.5 ${
              copied === f.id
                ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-200"
                : "border-white/10 bg-white/[0.06] text-ink hover:bg-white/[0.11]"
            }`}
          >
            {copied === f.id ? Icons.check : Icons.copy}
            {copied === f.id ? "Copied!" : f.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPeek((p) => (p ? null : "css"))}
          aria-pressed={!!peek}
          title={peek ? "Hide code" : "Peek at code"}
          className={`press focus-ring flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-medium whitespace-nowrap ${
            peek ? "bg-white/12 text-white" : "text-muted hover:bg-white/[0.06] hover:text-ink"
          }`}
        >
          {Icons.code}
          <span className="@max-[880px]:sr-only">{peek ? "Hide code" : "Peek at code"}</span>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-[12px] whitespace-nowrap text-muted hover:text-ink">
            <input
              type="checkbox"
              checked={withScene}
              onChange={(e) => setWithScene(e.target.checked)}
              className="size-3.5 accent-violet-400"
            />
            <span className="@max-[880px]:hidden">Include background</span>
            <span className="@min-[880px]:hidden">Background</span>
          </label>
          <button
            type="button"
            disabled={exporting}
            onClick={() => onExportPng(withScene)}
            className="press focus-ring flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-accent to-accent-2 px-4 py-2 whitespace-nowrap text-[12.5px] font-semibold text-[#0b0c12] shadow-[0_6px_20px_rgba(167,139,250,0.35)] hover:brightness-110 disabled:opacity-60"
          >
            {Icons.image} {exporting ? "Exporting…" : "Export PNG"}
          </button>
        </div>
      </div>
    </div>
  );
}
