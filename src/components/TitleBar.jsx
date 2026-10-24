import { useEffect, useRef, useState } from "react";
import { appWindow } from "../lib/native.js";
import { IconButton, Segmented, Toggle } from "./controls.jsx";

export function Logo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" aria-hidden="true">
      <defs>
        <linearGradient id="logo-drop" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#f0abfc" />
          <stop offset="0.5" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <path
        d="M512 120 C 610 270 800 440 800 620 C 800 780 672 904 512 904 C 352 904 224 780 224 620 C 224 440 414 270 512 120 Z"
        fill="url(#logo-drop)"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="28"
      />
      <path d="M390 590 C 390 490 445 410 500 345" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="56" strokeLinecap="round" />
    </svg>
  );
}

const ICON = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" };

export const Icons = {
  undo: <svg {...ICON}><path d="M5.5 4 2.5 7l3 3" /><path d="M2.5 7h7a3.5 3.5 0 0 1 0 7H8" /></svg>,
  redo: <svg {...ICON}><path d="m10.5 4 3 3-3 3" /><path d="M13.5 7h-7a3.5 3.5 0 0 0 0 7H8" /></svg>,
  file: <svg {...ICON}><path d="M4 1.5h5.5L13 5v9.5H4z" /><path d="M9.5 1.5V5H13" /></svg>,
  open: <svg {...ICON}><path d="M1.5 4V13h11l2-6h-11l-2 6" /><path d="M1.5 4V2.5h4l1.5 1.5h5V7" /></svg>,
  save: <svg {...ICON}><path d="M2.5 2.5h9l2 2v9h-11z" /><path d="M5 2.5V6h5V2.5M5 13.5V9.5h6v4" /></svg>,
  gear: <svg {...ICON}><circle cx="8" cy="8" r="2.2" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" /></svg>,
  dice: <svg {...ICON}><rect x="2" y="2" width="12" height="12" rx="3" /><circle cx="5.5" cy="5.5" r=".6" fill="currentColor" /><circle cx="10.5" cy="10.5" r=".6" fill="currentColor" /><circle cx="8" cy="8" r=".6" fill="currentColor" /><circle cx="10.5" cy="5.5" r=".6" fill="currentColor" /><circle cx="5.5" cy="10.5" r=".6" fill="currentColor" /></svg>,
  reset: <svg {...ICON}><path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9" /><path d="M2.5 2.5v3h3" /></svg>,
  image: <svg {...ICON}><rect x="1.5" y="2.5" width="13" height="11" rx="2" /><circle cx="5.5" cy="6" r="1.2" /><path d="m2 12 4-4 3 3 2-2 3.5 3.5" /></svg>,
  copy: <svg {...ICON}><rect x="5" y="5" width="9" height="9" rx="2" /><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" /></svg>,
  check: <svg {...ICON}><path d="m3 8.5 3 3 7-7" /></svg>,
  code: <svg {...ICON}><path d="m5.5 4-4 4 4 4M10.5 4l4 4-4 4" /></svg>,
  plus: <svg {...ICON}><path d="M8 3v10M3 8h10" /></svg>,
  minus: <svg {...ICON}><path d="M3 8h10" /></svg>,
  trash: <svg {...ICON}><path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4" /></svg>,
};

function WindowButton({ label, onClick, danger, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`press grid h-8 w-11 place-items-center rounded-lg text-ink/75 hover:text-white ${
        danger ? "hover:bg-[#e81123]" : "hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function SettingsMenu({ anchorRef, backdrop, backdropApplied, onBackdrop, minimizeToTray, onMinimizeToTray, onClose }) {
  useEffect(() => {
    // The anchor includes the gear button, so clicking it again toggles the
    // menu closed instead of closing and immediately reopening it.
    const onDown = (e) => !anchorRef.current?.contains(e.target) && onClose();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [anchorRef, onClose]);

  return (
    <div
      className="pop-in glass-chrome absolute top-11 right-0 z-50 w-72 rounded-2xl p-3 backdrop-blur-2xl"
      style={{ background: "rgba(18, 19, 28, 0.92)" }}
    >
      <p className="mb-2 px-1 text-[11px] font-semibold tracking-wider text-muted uppercase">Window material</p>
      <Segmented
        label="Window material"
        value={backdrop}
        onChange={onBackdrop}
        options={[
          { id: "mica", label: "Mica" },
          { id: "acrylic", label: "Acrylic" },
          { id: "none", label: "Solid" },
        ]}
      />
      {backdrop !== "none" && backdropApplied === "none" && (
        <p className="mt-2 px-1 text-[11px] text-amber-300/90">
          This version of Windows doesn&apos;t support that material, so AuraDrop is using a solid background.
        </p>
      )}
      <div className="my-3 h-px bg-white/8" />
      <Toggle
        label="Minimize to tray"
        hint="Hide in the system tray instead of the taskbar"
        checked={minimizeToTray}
        onChange={onMinimizeToTray}
      />
    </div>
  );
}

const SAVE_LABEL = { pending: "Saving soon…", saving: "Saving…", saved: "All changes saved", error: "Not saved" };

export function TitleBar({
  fileName,
  saveState,
  filePath,
  onHome,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onNew,
  onOpen,
  onSave,
  onClose,
  settings,
  mode,
  onPreview,
  onEdit,
  onPalette,
  uiMode,
  onUiMode,
}) {
  const [maximized, setMaximized] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const settingsRef = useRef(null);

  useEffect(() => {
    let unlisten = () => {};
    appWindow.isMaximized().then(setMaximized);
    appWindow.onResized(setMaximized).then((u) => (unlisten = u));
    return () => unlisten();
  }, []);

  return (
    <header
      /* Tauri's drag region also handles double-click to maximize. */
      data-tauri-drag-region
      className="relative z-40 flex h-12 flex-none items-center gap-1 pr-1 pl-3"
    >
      {onHome ? (
        <button type="button" onClick={onHome} title="Home: all your projects" data-testid="home-btn" className="press focus-ring mr-2 flex items-center gap-2 rounded-xl py-1 pr-3 pl-1 hover:bg-white/[0.06]">
          <Logo />
          <span className="text-[12.5px] font-medium text-ink/85">Home</span>
        </button>
      ) : (
        <div data-tauri-drag-region className="pointer-events-none flex items-center gap-2.5 pr-3">
          <Logo />
          <span className="font-display text-[14px] font-semibold tracking-tight">
            Aura<span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">Drop</span>
          </span>
        </div>
      )}

      <div className="flex items-center gap-0.5 rounded-xl bg-white/[0.04] p-0.5">
        <IconButton label="New project (Ctrl+N)" onClick={onNew}>{Icons.file}</IconButton>
        <IconButton label="Open project (Ctrl+O)" onClick={onOpen}>{Icons.open}</IconButton>
        {(mode === "edit" || mode === "preview") && <IconButton label="Save (Ctrl+S) · Ctrl+Shift+S saves as a file" onClick={onSave}>{Icons.save}</IconButton>}
        {mode === "edit" && (
          <>
            <span className="mx-0.5 h-4 w-px bg-white/10" />
            <IconButton label="Undo (Ctrl+Z)" onClick={onUndo} disabled={!canUndo}>{Icons.undo}</IconButton>
            <IconButton label="Redo (Ctrl+Y)" onClick={onRedo} disabled={!canRedo}>{Icons.redo}</IconButton>
          </>
        )}
      </div>

      <div data-tauri-drag-region className="flex min-w-0 flex-1 items-center justify-center gap-2 px-3">
        <span data-tauri-drag-region className="truncate text-[12px] text-muted">
          {fileName}
        </span>
        {saveState && (
          <span data-testid="save-state" title={filePath ? `Also saved to ${filePath} when you press Ctrl+S` : "Autosaved to your projects"} className={`flex flex-none items-center gap-1.5 text-[11px] ${saveState === "error" ? "text-red-300" : "text-muted/80"}`}>
            <span className={`size-1.5 rounded-full ${saveState === "saved" ? "bg-emerald-400/80" : saveState === "error" ? "bg-red-400" : "bg-accent"}`} />
            {SAVE_LABEL[saveState]}
          </span>
        )}
      </div>

      {(mode === "edit" || mode === "preview") && onPalette && (
        <button type="button" onClick={onPalette} title="Search every command (Ctrl+K)" className="press focus-ring mr-1 hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[12px] text-muted hover:bg-white/10 hover:text-ink md:flex">
          Search commands <kbd className="kbd-hint">Ctrl K</kbd>
        </button>
      )}
      {mode === "edit" && onUiMode && (
        <div className="mr-2 flex items-center rounded-xl bg-white/[0.05] p-0.5 text-[11.5px]" role="radiogroup" aria-label="Editor mode">
          {[
            ["simple", "Simple", "Just the main controls"],
            ["pro", "Pro", "Every control: rulers, grid, exact sizes, fine-tuning"],
          ].map(([id, label, tip]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={uiMode === id}
              title={tip}
              data-testid={`ui-${id}`}
              onClick={() => onUiMode(id)}
              className={`press rounded-lg px-2.5 py-1 font-medium ${uiMode === id ? "bg-white/[0.14] text-ink" : "text-muted hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {mode === "edit" && (
        <button
          type="button"
          onClick={onPreview}
          title="Try it out: buttons work in Preview (F5)"
          className="press focus-ring mr-1 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-accent to-accent-2 px-3.5 py-1.5 text-[12.5px] font-semibold text-[#0b0c12] shadow-[0_6px_18px_rgba(167,139,250,0.35)] hover:brightness-110"
        >
          ▶ Preview
        </button>
      )}
      {mode === "preview" && (
        <button
          type="button"
          onClick={onEdit}
          title="Switch to editing (F5)"
          className="press focus-ring mr-1 flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.08] px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-white/[0.14]"
        >
          ✏️ Edit
        </button>
      )}

      <div ref={settingsRef} className="relative">
        <IconButton label="Settings" onClick={() => setMenuOpen((o) => !o)} active={menuOpen}>
          {Icons.gear}
        </IconButton>
        {menuOpen && <SettingsMenu {...settings} anchorRef={settingsRef} onClose={() => setMenuOpen(false)} />}
      </div>
      <span className="mx-1 h-4 w-px bg-white/10" />
      <WindowButton label="Minimize" onClick={() => appWindow.minimize()}>
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 5h10" stroke="currentColor" /></svg>
      </WindowButton>
      <WindowButton label={maximized ? "Restore" : "Maximize"} onClick={() => appWindow.toggleMaximize()}>
        {maximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor">
            <rect x="0.5" y="2.5" width="7" height="7" rx="1" />
            <path d="M2.5 2.5V1.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor">
            <rect x="0.5" y="0.5" width="9" height="9" rx="1.5" />
          </svg>
        )}
      </WindowButton>
      <WindowButton label="Close" danger onClick={onClose}>
        <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.1">
          <path d="m0.5 0.5 9 9M9.5 0.5l-9 9" />
        </svg>
      </WindowButton>
    </header>
  );
}
