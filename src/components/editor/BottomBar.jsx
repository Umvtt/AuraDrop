import { useEffect, useRef, useState } from "react";
import { IconButton } from "../controls.jsx";
import { Icons } from "../TitleBar.jsx";

/** Pages on the left; Save / Export PNG / Web page on the right. */
export function BottomBar({ project, pageIndex, onGoTo, onAddPage, onDuplicatePage, onRemovePage, onMovePage, onSave, onExportPng, onExportHtml, busy }) {
  const [menu, setMenu] = useState(null);
  const menuRef = useRef(null);
  useEffect(() => {
    if (menu === null) return;
    const close = (e) => !menuRef.current?.contains(e.target) && setMenu(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);

  return (
    <div className="glass-chrome flex h-14 flex-none items-center gap-2 rounded-2xl px-2.5">
      <div className="scroll-thin flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1" role="tablist" aria-label="Pages">
        {project.pages.map((p, i) => (
          <div key={p.id} className="relative flex-none">
            <button
              type="button"
              role="tab"
              aria-selected={i === pageIndex}
              onClick={() => onGoTo(i)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu(i);
              }}
              title={`${p.name} — right-click for options`}
              className={`press focus-ring flex max-w-36 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12px] font-medium whitespace-nowrap ${
                i === pageIndex ? "border-accent/60 bg-accent/20 text-white" : "border-white/10 bg-white/[0.05] text-ink/80 hover:bg-white/[0.1]"
              }`}
            >
              <span className="font-mono text-[10.5px] text-muted">{i + 1}</span>
              <span className="truncate">{p.name}</span>
              {i === pageIndex && (
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label="Page options"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenu(menu === i ? null : i);
                  }}
                  className="-mr-1 rounded px-0.5 text-muted hover:text-white"
                >
                  ⋯
                </span>
              )}
            </button>
            {menu === i && (
              <div ref={menuRef} className="pop-in absolute bottom-full left-0 z-30 mb-2 flex w-40 flex-col rounded-xl border border-white/10 bg-[#161722] p-1 shadow-xl" role="menu">
                {[
                  ["Duplicate page", () => onDuplicatePage(i), false],
                  ["Move left", () => onMovePage(i, -1), i === 0],
                  ["Move right", () => onMovePage(i, 1), i === project.pages.length - 1],
                  ["Delete page", () => onRemovePage(i), project.pages.length <= 1],
                ].map(([label, fn, disabled]) => (
                  <button
                    key={label}
                    type="button"
                    role="menuitem"
                    disabled={disabled}
                    onClick={() => {
                      setMenu(null);
                      fn();
                    }}
                    className={`rounded-lg px-2.5 py-1.5 text-left text-[12px] hover:bg-white/10 disabled:pointer-events-none disabled:opacity-35 ${label.startsWith("Delete") ? "text-rose-200" : ""}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <IconButton label="Add page" onClick={onAddPage}>
          {Icons.plus}
        </IconButton>
      </div>

      <div className="flex flex-none items-center gap-1.5">
        <button
          type="button"
          onClick={onSave}
          title="Save as .auradrop (Ctrl+S)"
          className="press focus-ring flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.08] px-3.5 py-2 text-[12.5px] font-semibold whitespace-nowrap text-ink hover:bg-white/[0.14]"
        >
          {Icons.save} Save .auradrop
        </button>
        <button
          type="button"
          disabled={busy === "png"}
          onClick={onExportPng}
          title="Save this page as a picture"
          className="press focus-ring flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-accent to-accent-2 px-3.5 py-2 text-[12.5px] font-semibold whitespace-nowrap text-[#0b0c12] shadow-[0_6px_20px_rgba(167,139,250,0.35)] hover:brightness-110 disabled:opacity-60"
        >
          {Icons.image} {busy === "png" ? "Exporting…" : "Export PNG"}
        </button>
        <button
          type="button"
          disabled={busy === "html"}
          onClick={onExportHtml}
          title="One .html file that works in any browser – buttons included"
          className="press focus-ring flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.08] px-3 py-2 text-[12.5px] font-semibold whitespace-nowrap text-ink hover:bg-white/[0.14] disabled:opacity-60"
        >
          🌐 {busy === "html" ? "Exporting…" : "Web page"}
        </button>
      </div>
    </div>
  );
}
