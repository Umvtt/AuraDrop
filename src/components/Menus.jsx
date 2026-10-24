import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, CornerDownLeft, Search, X } from "lucide-react";

/**
 * Right-click menu. items: { label, icon, shortcut, onClick, disabled,
 * danger, items (submenu) } or "-" for a separator.
 */
export function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [sub, setSub] = useState(null);

  useLayoutEffect(() => {
    const r = ref.current.getBoundingClientRect();
    setPos({
      left: Math.max(6, Math.min(x, window.innerWidth - r.width - 6)),
      top: Math.max(6, Math.min(y, window.innerHeight - r.height - 6)),
    });
  }, [x, y]);

  useEffect(() => {
    const down = (e) => !ref.current?.contains(e.target) && onClose();
    const key = (e) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="menu-surface pop-in fixed z-[60] w-56" style={pos} role="menu" onContextMenu={(e) => e.preventDefault()}>
      <MenuItems items={items} onClose={onClose} sub={sub} setSub={setSub} />
    </div>
  );
}

function MenuItems({ items, onClose, sub, setSub }) {
  return items.filter(Boolean).map((item, i) => {
    if (item === "-") return <div key={i} className="my-1 h-px bg-white/[0.07]" />;
    const Icon = item.icon;
    return (
      <div key={i} className="relative" onPointerEnter={() => setSub?.(item.items ? i : null)}>
        <button
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            if (item.items) return setSub?.(sub === i ? null : i);
            onClose();
            item.onClick?.();
          }}
          className={`menu-item ${item.danger ? "text-rose-200 hover:bg-rose-500/20!" : ""}`}
        >
          <span className="grid w-4 place-items-center text-muted">{Icon && <Icon size={14} />}</span>
          <span className="flex-1 truncate text-left">{item.label}</span>
          {item.shortcut && <kbd className="kbd-hint">{item.shortcut}</kbd>}
          {item.items && <ChevronRight size={13} className="text-muted" />}
        </button>
        {item.items && sub === i && (
          <div className="menu-surface pop-in absolute top-0 left-full z-10 ml-1 w-52" role="menu">
            <MenuItems items={item.items} onClose={onClose} />
          </div>
        )}
      </div>
    );
  });
}

/** Rank a command against a query: 0 = no match. */
function score(text, q) {
  const t = text.toLowerCase();
  if (!q) return 1;
  if (t.startsWith(q)) return 100 - t.length / 100;
  const i = t.indexOf(q);
  if (i >= 0) return 60 - i;
  // Every query letter in order (fuzzy).
  let at = 0;
  for (const ch of q) {
    at = t.indexOf(ch, at);
    if (at < 0) return 0;
    at++;
  }
  return 20;
}

/** Ctrl+K: search every command in the app. */
export function CommandPalette({ commands, onClose }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef(null);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return commands
      .filter((c) => !c.disabled)
      .map((c) => ({ c, s: Math.max(score(c.label, q), score(`${c.group} ${c.label}`, q) * 0.8, ...(c.keywords ?? []).map((k) => score(k, q) * 0.7)) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => (q ? b.s - a.s : 0))
      .slice(0, 60)
      .map((r) => r.c);
  }, [commands, query]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (c) => {
    onClose();
    // Let the palette unmount (and focus return) before running.
    setTimeout(() => c.run(), 0);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 pt-[12vh] backdrop-blur-[2px]" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="menu-surface pop-in flex max-h-[60vh] w-[560px] flex-col overflow-hidden p-0!" role="dialog" aria-label="Command palette">
        <label className="flex items-center gap-2.5 border-b border-white/[0.07] px-4 py-3">
          <Search size={16} className="text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(results.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter" && results[active]) {
                e.preventDefault();
                run(results[active]);
              } else if (e.key === "Escape") onClose();
              e.stopPropagation();
            }}
            placeholder="Type a command… (add, align, export, workshop…)"
            aria-label="Search commands"
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted/60"
          />
          <kbd className="kbd-hint">Esc</kbd>
        </label>
        <ul ref={listRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto p-1.5" role="listbox">
          {results.length === 0 && <li className="px-3 py-6 text-center text-[12px] text-muted">No commands match “{query}”.</li>}
          {results.map((c, i) => {
            const Icon = c.icon;
            return (
              <li key={c.id} data-index={i}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onPointerMove={() => setActive(i)}
                  onClick={() => run(c)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[12.5px] ${i === active ? "bg-accent/20 text-white" : "text-ink/85"}`}
                >
                  <span className="grid size-6 place-items-center rounded-md bg-white/[0.06] text-ink/80">{Icon && <Icon size={14} />}</span>
                  <span className="flex-1 truncate">{c.label}</span>
                  <span className="text-[10.5px] text-muted">{c.group}</span>
                  {c.shortcut && <kbd className="kbd-hint">{c.shortcut}</kbd>}
                  {i === active && <CornerDownLeft size={13} className="text-muted" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export const SHORTCUTS = [
  ["General", [
    ["Ctrl+K", "Command palette"],
    ["Ctrl+N / O / S", "New, open, save now"],
    ["Ctrl+Shift+S", "Save as a file"],
    ["Ctrl+E", "Export PNG"],
    ["F5", "Preview / edit"],
    ["F1 or ?", "This list"],
  ]],
  ["Editing", [
    ["Ctrl+Z / Ctrl+Y", "Undo / redo"],
    ["Ctrl+C / X / V", "Copy, cut, paste"],
    ["Ctrl+D", "Duplicate"],
    ["Shift+H / Shift+V", "Flip left-right / upside down"],
    ["Delete", "Delete"],
    ["Ctrl+A", "Select all"],
    ["Ctrl+G / Ctrl+Shift+G", "Group / ungroup"],
    ["Ctrl+L", "Lock / unlock"],
    ["Ctrl+H", "Hide at start"],
    ["[ and ]", "Send backward / bring forward"],
    ["Ctrl+[ and Ctrl+]", "Send to back / bring to front"],
    ["Arrows (Shift)", "Nudge 1px (10px)"],
    ["Enter", "Edit text"],
    ["Esc", "Deselect"],
  ]],
  ["Canvas", [
    ["Drag empty space", "Select with a box"],
    ["Shift / Ctrl + click", "Add to selection"],
    ["Alt + drag", "Duplicate while dragging"],
    ["Ctrl while dragging", "Don't snap"],
    ["Shift while resizing", "Free / keep proportions"],
    ["Space + drag", "Pan"],
    ["Ctrl + scroll", "Zoom at the pointer"],
    ["Shift+1 / Shift+2", "Fit / zoom to selection"],
    ["Ctrl+0", "Actual size"],
    ["Ctrl+'", "Show grid"],
    ["Drag from a ruler", "Add a guide"],
  ]],
  ["Workshop", [
    ["Ctrl+Z / Ctrl+Y", "Undo / redo"],
    ["Ctrl+D / Delete", "Duplicate / delete part"],
    ["M", "Mirror part"],
    ["1 / 2 / 3", "Normal / armour / X-ray view"],
    ["P", "Play animations"],
  ]],
];

export function ShortcutsDialog({ onClose }) {
  useEffect(() => {
    const key = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-6 backdrop-blur-[2px]" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="menu-surface pop-in scroll-thin max-h-[86vh] w-[760px] overflow-y-auto p-6!" role="dialog" aria-label="Keyboard shortcuts">
        <div className="mb-4 flex items-center">
          <h2 className="flex-1 font-display text-[17px] font-semibold">Keyboard shortcuts</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="press grid size-8 place-items-center rounded-lg text-muted hover:bg-white/10 hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          {SHORTCUTS.map(([group, list]) => (
            <section key={group}>
              <h3 className="panel-label mb-2">{group}</h3>
              <dl className="flex flex-col gap-1.5">
                {list.map(([keys, what]) => (
                  <div key={keys + what} className="flex items-center gap-3 text-[12px]">
                    <dt className="flex-1 text-ink/85">{what}</dt>
                    <dd>
                      <kbd className="kbd-hint">{keys}</kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
