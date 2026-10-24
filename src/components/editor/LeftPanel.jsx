import { useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Circle,
  Eye,
  EyeOff,
  Group,
  Heart,
  Image,
  Lock,
  LockOpen,
  MessageCircle,
  MousePointerClick,
  Search,
  Smile,
  Sparkles,
  Square,
  Star,
  Triangle,
  Type,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { TankIcon } from "../icons.jsx";

export const STICKERS = [
  "😂", "🤣", "😭", "💀", "😎", "🤯", "😱", "🥺", "😤", "🤡", "🙄", "😏", "🤔", "😳", "🥶", "🥵",
  "👀", "👍", "👎", "👉", "🙅", "🙏", "👏", "💪", "🔥", "✨", "💯", "❤️", "💔", "⭐", "⚡", "💥",
  "🎉", "🏆", "🎮", "🎵", "📸", "🍕", "🍔", "🍟", "🌮", "🍩", "🧃", "🐸", "🐐", "🦆", "🐶", "🐱",
  "🦄", "🐒", "🚀", "🌈", "☁️", "🌙", "☀️", "🍀", "💎", "🧠", "👑", "🤖", "👻", "🗿",
  "✈️", "🛩️", "🚁", "🪖", "🎖️", "🏅", "💣", "🎯", "🛡️", "⚔️", "🔫", "🧨", "🏁", "🚗", "🏎️", "🚙",
];

const ADD = [
  { id: "text", label: "Text", Icon: Type },
  { id: "meme", label: "Meme text", Icon: Smile },
  { id: "sticker", label: "Sticker", Icon: Sparkles, emoji: "🙂" },
  { id: "image", label: "Picture", Icon: Image },
  { id: "button", label: "Button", Icon: MousePointerClick },
  { id: "sound", label: "Sound", Icon: Volume2 },
  { id: "glass", label: "Glass", Icon: Square, glass: true },
  { id: "vehicle", label: "Vehicle", Icon: TankIcon, accent: true },
  { id: "rect", label: "Box", Icon: Square },
  { id: "ellipse", label: "Circle", Icon: Circle },
  { id: "star", label: "Star", Icon: Star },
  { id: "heart", label: "Heart", Icon: Heart },
  { id: "bubble", label: "Speech", Icon: MessageCircle },
  { id: "arrow", label: "Arrow", Icon: ArrowRight },
  { id: "triangle", label: "Triangle", Icon: Triangle },
];

const TYPE_ICON = { text: Type, sticker: Smile, image: Image, shape: Square, glass: Sparkles, button: MousePointerClick, vehicle: TankIcon };

/** Display rows, top layer first; groups get a header row with their members under it. */
function buildRows(elements, collapsed) {
  const rows = [];
  const seen = new Set();
  const list = [...elements].reverse();
  for (const el of list) {
    if (!el.group) {
      rows.push({ kind: "el", el, depth: 0 });
      continue;
    }
    if (seen.has(el.group)) continue;
    seen.add(el.group);
    const members = list.filter((e) => e.group === el.group);
    rows.push({ kind: "group", group: el.group, members });
    if (!collapsed.has(el.group)) members.forEach((m) => rows.push({ kind: "el", el: m, depth: 1 }));
  }
  return rows;
}

export function LeftPanel({ page, selectedIds, onAdd, onAddSticker, onSelect, onToggle, onReorder, onRename, onContextMenu, onUngroup }) {
  const [stickers, setStickers] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [dnd, setDnd] = useState(null); // {ids, y, over: {index, before}}
  const listRef = useRef(null);
  const lastClicked = useRef(null);
  const suppressClick = useRef(false);

  const q = query.trim().toLowerCase();
  const rows = q
    ? [...page.elements].reverse().filter((e) => e.name.toLowerCase().includes(q) || e.type.includes(q)).map((el) => ({ kind: "el", el, depth: 0 }))
    : buildRows(page.elements, collapsed);

  // Ids a drag would move: the selection (if the row is in it) or that layer/group.
  const dragIds = (el) => {
    if (selectedIds.includes(el.id)) return selectedIds;
    if (el.group) return page.elements.filter((e) => e.group === el.group).map((e) => e.id);
    return [el.id];
  };

  function clickRow(e, el) {
    if (suppressClick.current) return;
    if (e.shiftKey && lastClicked.current) {
      // Range select in display order.
      const order = rows.filter((r) => r.kind === "el").map((r) => r.el.id);
      const a = order.indexOf(lastClicked.current);
      const b = order.indexOf(el.id);
      if (a >= 0 && b >= 0) {
        onSelect(order.slice(Math.min(a, b), Math.max(a, b) + 1), { deep: true });
        return;
      }
    }
    lastClicked.current = el.id;
    if (e.ctrlKey || e.metaKey) onSelect(el.id, { add: true, deep: true });
    else onSelect(el.id, { deep: true });
  }

  // --- drag to reorder -------------------------------------------------------

  function onRowPointerDown(e, el) {
    if (e.button !== 0 || renaming || e.target.closest("button, input")) return;
    const startY = e.clientY;
    const ids = dragIds(el);
    let started = false;
    const move = (ev) => {
      if (!started && Math.abs(ev.clientY - startY) < 4) return;
      started = true;
      const over = dropSlot(ev.clientY, ids);
      setDnd({ ids, y: ev.clientY, x: ev.clientX, over, label: ids.length > 1 ? `${ids.length} layers` : el.name });
    };
    const up = (ev) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", cancel);
      if (started) {
        const slot = dropSlot(ev.clientY, ids);
        if (slot) onReorder(ids, slot.to);
        // The click that follows a drag shouldn't change the selection.
        suppressClick.current = true;
        setTimeout(() => (suppressClick.current = false), 0);
      }
      setDnd(null);
    };
    const cancel = (ev) => {
      if (ev.key !== "Escape") return;
      started = false;
      window.removeEventListener("pointermove", move);
      setDnd(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", cancel);
  }

  /** Where in the elements array a drop at clientY lands (rows are top-first). */
  function dropSlot(clientY, ids) {
    const nodes = [...(listRef.current?.querySelectorAll("[data-row-id]") ?? [])];
    if (!nodes.length) return null;
    for (const n of nodes) {
      const r = n.getBoundingClientRect();
      if (clientY < r.top + r.height / 2) {
        const id = n.dataset.rowId;
        const idx = page.elements.findIndex((e) => e.id === id);
        // Above this row in the list = just in front of it in the array.
        return { line: r.top, to: idx + 1, id, ok: !ids.includes(id) || ids.length > 0 };
      }
    }
    const last = nodes.at(-1).getBoundingClientRect();
    return { line: last.bottom, to: 0, id: null, ok: true };
  }

  const listTop = listRef.current?.getBoundingClientRect().top ?? 0;

  return (
    <aside className="glass-chrome panel-in flex w-[248px] flex-none flex-col overflow-hidden rounded-2xl">
      <div className="px-3 pt-3">
        <p className="panel-label mb-2">Insert</p>
        <div className="grid grid-cols-4 gap-1">
          {ADD.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => (a.id === "sticker" ? setStickers((s) => !s) : onAdd(a.id))}
              aria-expanded={a.id === "sticker" ? stickers : undefined}
              title={a.id === "vehicle" ? "Tanks, planes and cars from your hangar" : a.label}
              className={`tile press focus-ring ${a.id === "sticker" && stickers ? "tile-on" : ""} ${a.accent ? "tile-accent" : ""}`}
            >
              <span className="grid size-6 place-items-center">
                {a.id === "rect" || a.id === "ellipse" || a.id === "star" || a.id === "heart" || a.id === "triangle" ? (
                  <a.Icon size={16} fill="currentColor" fillOpacity={0.25} />
                ) : (
                  <a.Icon size={16} />
                )}
              </span>
              <span className="truncate">{a.label}</span>
            </button>
          ))}
        </div>
        {stickers && (
          <div className="pop-in scroll-thin mt-2 grid max-h-44 grid-cols-8 gap-0.5 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-1.5" role="listbox" aria-label="Stickers">
            {STICKERS.map((s) => (
              <button
                key={s}
                type="button"
                role="option"
                aria-selected={false}
                aria-label={`Add ${s}`}
                onClick={() => onAddSticker(s)}
                className="press grid aspect-square place-items-center rounded-md text-[17px] hover:bg-white/10"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 px-3">
        <p className="panel-label flex-1">Layers</p>
        <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-muted">{page.elements.length}</span>
      </div>
      {page.elements.length > 6 && (
        <label className="mx-2 mt-1.5 flex items-center gap-1.5 rounded-lg border border-white/8 bg-black/20 px-2 py-1 focus-within:border-accent/60">
          <Search size={13} className="text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a layer…" aria-label="Find a layer" className="min-w-0 flex-1 bg-transparent text-[11.5px] outline-none placeholder:text-muted/60" />
          {query && (
            <button type="button" aria-label="Clear" onClick={() => setQuery("")} className="text-muted hover:text-ink">
              <X size={12} />
            </button>
          )}
        </label>
      )}
      <ul ref={listRef} className="scroll-thin relative mt-1.5 min-h-0 flex-1 overflow-y-auto px-2 pb-2" aria-label="Layers">
        {rows.length === 0 && (
          <li className="px-3 py-8 text-center text-[11.5px] leading-relaxed text-muted">
            {q ? "No layers match." : "Nothing here yet. Add something above, or drop a picture onto the canvas."}
          </li>
        )}
        {rows.map((row) =>
          row.kind === "group" ? (
            <li key={`g-${row.group}`}>
              <div
                className={`group flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11.5px] font-semibold ${
                  row.members.every((m) => selectedIds.includes(m.id)) ? "bg-accent/15 text-white" : "text-ink/80 hover:bg-white/[0.05]"
                }`}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(row.members.map((m) => m.id), { deep: true })}
                onPointerDown={(e) => onRowPointerDown(e, row.members[0])}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onSelect(row.members.map((m) => m.id), { deep: true });
                  onContextMenu?.({ clientX: e.clientX, clientY: e.clientY, id: row.members[0].id });
                }}
                data-testid="layer-group"
              >
                <button
                  type="button"
                  aria-label={collapsed.has(row.group) ? "Expand group" : "Collapse group"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCollapsed((c) => {
                      const n = new Set(c);
                      n.has(row.group) ? n.delete(row.group) : n.add(row.group);
                      return n;
                    });
                  }}
                  className="grid size-5 place-items-center rounded text-muted hover:text-ink"
                >
                  {collapsed.has(row.group) ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                </button>
                <Group size={13} className="text-accent" />
                <span className="flex-1 truncate">Group</span>
                <span className="text-[10px] font-normal text-muted">{row.members.length}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUngroup(row.members.map((m) => m.id));
                  }}
                  className="rounded px-1 text-[10px] font-medium text-muted opacity-0 group-hover:opacity-100 hover:bg-white/10 hover:text-ink"
                >
                  Ungroup
                </button>
              </div>
            </li>
          ) : (
            <LayerRow
              key={row.el.id}
              el={row.el}
              depth={row.depth}
              selected={selectedIds.includes(row.el.id)}
              dragging={dnd?.ids.includes(row.el.id)}
              renaming={renaming === row.el.id}
              onClick={(e) => clickRow(e, row.el)}
              onPointerDown={(e) => onRowPointerDown(e, row.el)}
              onStartRename={() => setRenaming(row.el.id)}
              onRename={(name) => {
                if (name !== null) onRename(row.el.id, name.trim() || row.el.name);
                setRenaming(null);
              }}
              onToggle={(key) => onToggle(row.el.id, key)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!selectedIds.includes(row.el.id)) onSelect(row.el.id, { deep: true });
                onContextMenu?.({ clientX: e.clientX, clientY: e.clientY, id: row.el.id });
              }}
            />
          ),
        )}
        {dnd?.over && (
          <li aria-hidden="true" className="pointer-events-none absolute right-2 left-2 h-0.5 rounded-full bg-accent-2 shadow-[0_0_8px_#22d3ee]" style={{ top: dnd.over.line - listTop + (listRef.current?.scrollTop ?? 0) - 1 }} />
        )}
      </ul>
      {dnd && (
        <div className="pointer-events-none fixed z-50 rounded-lg border border-accent-2/50 bg-[#141522]/95 px-2.5 py-1 text-[11.5px] font-medium shadow-xl" style={{ left: dnd.x + 12, top: dnd.y - 12 }} data-testid="layer-drag">
          {dnd.label}
        </div>
      )}
      <p className="border-t border-white/[0.06] px-3 py-1.5 text-[10.5px] leading-snug text-muted/80">Drag layers to reorder · Shift/Ctrl for many</p>
    </aside>
  );
}

function LayerRow({ el, depth, selected, dragging, renaming, onClick, onPointerDown, onStartRename, onRename, onToggle, onContextMenu }) {
  const Icon = TYPE_ICON[el.type] ?? Square;
  return (
    <li data-row-id={el.id}>
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onKeyDown={(e) => e.key === "Enter" && onClick(e)}
        onDoubleClick={onStartRename}
        onContextMenu={onContextMenu}
        data-testid="layer-row"
        className={`layer-row group flex items-center gap-2 rounded-lg py-1.5 pr-1 text-[12px] ${selected ? "layer-row-on" : "text-ink/85 hover:bg-white/[0.06]"} ${el.hidden ? "opacity-55" : ""} ${dragging ? "opacity-40" : ""}`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <span className="grid w-5 flex-none place-items-center text-[13px] text-ink/70">{el.type === "sticker" ? el.emoji : <Icon size={14} />}</span>
        {renaming ? (
          <input
            autoFocus
            defaultValue={el.name}
            aria-label="Layer name"
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => onRename(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") onRename(null);
            }}
            className="min-w-0 flex-1 rounded bg-black/40 px-1 text-[12px] outline-none"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate" title={el.name}>
            {el.name}
            {el.actions.length > 0 && <Zap size={10} className="ml-1 inline text-accent-2" aria-label="Does something when clicked" />}
          </span>
        )}
        <span className={`flex flex-none items-center ${el.hidden || el.locked ? "" : "opacity-0 group-hover:opacity-100"}`}>
          <LayerToggle label={el.hidden ? "Show at start" : "Hide at start"} on={el.hidden} onClick={() => onToggle("hidden")}>
            {el.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
          </LayerToggle>
          <LayerToggle label={el.locked ? "Unlock" : "Lock"} on={el.locked} onClick={() => onToggle("locked")}>
            {el.locked ? <Lock size={13} className="text-amber-300" /> : <LockOpen size={13} />}
          </LayerToggle>
        </span>
      </div>
    </li>
  );
}

function LayerToggle({ label, children, onClick }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="grid size-6 place-items-center rounded-md text-ink/70 hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  );
}
