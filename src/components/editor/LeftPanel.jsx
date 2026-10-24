import { useState } from "react";
import { IconButton } from "../controls.jsx";

export const STICKERS = [
  "😂", "🤣", "😭", "💀", "😎", "🤯", "😱", "🥺", "😤", "🤡", "🙄", "😏", "🤔", "😳", "🥶", "🥵",
  "👀", "👍", "👎", "👉", "🙅", "🙏", "👏", "💪", "🔥", "✨", "💯", "❤️", "💔", "⭐", "⚡", "💥",
  "🎉", "🏆", "🎮", "🎵", "📸", "🍕", "🍔", "🍟", "🌮", "🍩", "🧃", "🐸", "🐐", "🦆", "🐶", "🐱",
  "🦄", "🐒", "🚀", "🌈", "☁️", "🌙", "☀️", "🍀", "💎", "🧠", "👑", "🤖", "👻", "🗿",
];

const ADD = [
  { id: "text", label: "Text", icon: "🔤" },
  { id: "meme", label: "Meme text", icon: "😂" },
  { id: "sticker", label: "Sticker", icon: "🙂" },
  { id: "image", label: "Picture", icon: "🖼️" },
  { id: "button", label: "Button", icon: "🔘" },
  { id: "sound", label: "Sound button", icon: "🔊" },
  { id: "glass", label: "Glass panel", icon: "🫧" },
  { id: "rect", label: "Box", icon: "⬛" },
  { id: "ellipse", label: "Circle", icon: "⚪" },
  { id: "star", label: "Star", icon: "⭐" },
  { id: "heart", label: "Heart", icon: "❤️" },
  { id: "bubble", label: "Speech", icon: "💬" },
  { id: "arrow", label: "Arrow", icon: "➡️" },
  { id: "triangle", label: "Triangle", icon: "🔺" },
];

const TYPE_ICON = { text: "🔤", sticker: "🙂", image: "🖼️", shape: "⬛", glass: "🫧", button: "🔘" };

export function LeftPanel({ project, page, selectedId, onAdd, onAddSticker, onSelect, onToggle, onMove, onRename }) {
  const [stickers, setStickers] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const layers = [...page.elements].reverse(); // top first

  return (
    <aside className="glass-chrome flex w-[236px] flex-none flex-col overflow-hidden rounded-2xl">
      <div className="px-3 pt-3">
        <p className="mb-2 text-[11px] font-semibold tracking-wider text-muted uppercase">Add</p>
        <div className="grid grid-cols-3 gap-1.5">
          {ADD.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => (a.id === "sticker" ? setStickers((s) => !s) : onAdd(a.id))}
              aria-expanded={a.id === "sticker" ? stickers : undefined}
              className={`press focus-ring flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[10.5px] font-medium ${
                a.id === "sticker" && stickers ? "border-accent/60 bg-accent/15 text-white" : "border-white/8 bg-white/[0.04] text-ink/85 hover:bg-white/[0.09]"
              }`}
            >
              <span className="text-[18px] leading-none">{a.icon}</span>
              {a.label}
            </button>
          ))}
        </div>
        {stickers && (
          <div className="pop-in mt-2 grid grid-cols-8 gap-0.5 rounded-xl border border-white/10 bg-black/30 p-1.5" role="listbox" aria-label="Stickers">
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

      <div className="mt-3 flex items-center justify-between px-3">
        <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">Layers</p>
        <span className="text-[10.5px] text-muted">{page.elements.length}</span>
      </div>
      <ul className="scroll-thin mt-1.5 min-h-0 flex-1 overflow-y-auto px-2 pb-2" aria-label="Layers">
        {layers.length === 0 && <li className="px-2 py-6 text-center text-[11.5px] text-muted">Nothing here yet. Add something above!</li>}
        {layers.map((el) => (
          <li key={el.id}>
            <div
              role="button"
              tabIndex={0}
              aria-pressed={el.id === selectedId}
              onClick={() => onSelect(el.id)}
              onKeyDown={(e) => e.key === "Enter" && onSelect(el.id)}
              onDoubleClick={() => setRenaming(el.id)}
              className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] ${
                el.id === selectedId ? "bg-accent/20 text-white" : "text-ink/85 hover:bg-white/[0.06]"
              } ${el.hidden ? "opacity-55" : ""}`}
            >
              <span className="w-5 flex-none text-center text-[13px]">{el.type === "sticker" ? el.emoji : TYPE_ICON[el.type]}</span>
              {renaming === el.id ? (
                <input
                  autoFocus
                  defaultValue={el.name}
                  aria-label="Layer name"
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    onRename(el.id, e.target.value.trim() || el.name);
                    setRenaming(null);
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  className="min-w-0 flex-1 rounded bg-black/40 px-1 text-[12px] outline-none"
                />
              ) : (
                <span className="min-w-0 flex-1 truncate" title={el.name}>
                  {el.name}
                  {el.actions.length > 0 && <span className="ml-1 text-[10px] text-accent-2" title="Does something when clicked">⚡</span>}
                </span>
              )}
              <span className="flex flex-none items-center opacity-60 group-hover:opacity-100">
                <LayerToggle label={el.hidden ? "Show at start" : "Hide at start"} on={!el.hidden} onClick={() => onToggle(el.id, "hidden")}>
                  {el.hidden ? "🙈" : "👁️"}
                </LayerToggle>
                <LayerToggle label={el.locked ? "Unlock" : "Lock"} on={el.locked} onClick={() => onToggle(el.id, "locked")}>
                  {el.locked ? "🔒" : "🔓"}
                </LayerToggle>
              </span>
            </div>
          </li>
        ))}
      </ul>
      {layers.length > 1 && selectedId && (
        <div className="flex items-center justify-center gap-0.5 border-t border-white/[0.06] p-1.5">
          <IconButton label="Bring to front" onClick={() => onMove(selectedId, "front")}>⤒</IconButton>
          <IconButton label="Bring forward" onClick={() => onMove(selectedId, 1)}>↑</IconButton>
          <IconButton label="Send backward" onClick={() => onMove(selectedId, -1)}>↓</IconButton>
          <IconButton label="Send to back" onClick={() => onMove(selectedId, "back")}>⤓</IconButton>
        </div>
      )}
    </aside>
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
      className="grid size-6 place-items-center rounded-md text-[11px] hover:bg-white/10"
    >
      {children}
    </button>
  );
}
