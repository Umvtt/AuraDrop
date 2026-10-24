import { useCallback, useEffect, useRef, useState } from "react";
import { ExportBar } from "./components/ExportBar.jsx";
import { Inspector } from "./components/Inspector.jsx";
import { Stage } from "./components/Stage.jsx";
import { TitleBar } from "./components/TitleBar.jsx";
import { useHistory } from "./hooks/useHistory.js";
import {
  applyStarterLook,
  createDefaultDesign,
  FILE_EXTENSION,
  parseDesignFile,
  randomDesign,
  serializeDesign,
} from "./lib/design.js";
import * as native from "./lib/native.js";
import { renderPng } from "./lib/renderPng.js";

const UNTITLED = `Untitled.${FILE_EXTENSION}`;

function readPref(key, fallback) {
  try {
    const v = localStorage.getItem(`auradrop.${key}`);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

function writePref(key, value) {
  try {
    localStorage.setItem(`auradrop.${key}`, JSON.stringify(value));
  } catch {
    // Storage can be unavailable; prefs just won't persist.
  }
}

export default function App() {
  const history = useHistory(createDefaultDesign());
  const { design, set, reset, undo, redo } = history;

  // --- file state ----------------------------------------------------------
  const [file, setFile] = useState({ path: null, name: UNTITLED });
  const savedRef = useRef(design);
  const dirty = design !== savedRef.current;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // --- toasts --------------------------------------------------------------
  const [toast, setToast] = useState(null);
  const notify = useCallback((message, tone = "info") => {
    setToast({ message, tone, key: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // --- window material & tray prefs ---------------------------------------
  const [backdrop, setBackdropPref] = useState(() => readPref("backdrop", "mica"));
  const [backdropApplied, setBackdropApplied] = useState(native.isTauri ? backdrop : "none");
  const [minimizeToTray, setMinimizeToTrayState] = useState(() => readPref("minimizeToTray", true));

  useEffect(() => {
    native.setBackdrop(backdrop).then(setBackdropApplied);
    writePref("backdrop", backdrop);
  }, [backdrop]);

  useEffect(() => {
    document.documentElement.dataset.backdrop = backdropApplied;
  }, [backdropApplied]);

  useEffect(() => {
    native.setMinimizeToTray(minimizeToTray);
    writePref("minimizeToTray", minimizeToTray);
  }, [minimizeToTray]);

  useEffect(() => {
    // The tray menu can flip this too.
    const off = native.listen("prefs-changed", (p) => setMinimizeToTrayState(p.minimizeToTray));
    return () => void off.then((f) => f());
  }, []);

  // --- file actions --------------------------------------------------------
  const confirmDiscard = useCallback(async () => {
    if (!dirtyRef.current) return true;
    return native.ask("You have unsaved changes. Throw them away?", { okLabel: "Discard", cancelLabel: "Keep editing" });
  }, []);

  const loadDesignText = useCallback(
    (text, path, name) => {
      try {
        const loaded = parseDesignFile(text);
        reset(loaded);
        savedRef.current = loaded;
        setFile({ path, name: name ?? native.baseName(path) ?? UNTITLED });
        notify(`Opened ${name ?? native.baseName(path)}`);
      } catch (err) {
        notify(err.message, "error");
      }
    },
    [reset, notify],
  );

  const newDesign = useCallback(async () => {
    if (!(await confirmDiscard())) return;
    const fresh = createDefaultDesign();
    reset(fresh);
    savedRef.current = fresh;
    setFile({ path: null, name: UNTITLED });
  }, [confirmDiscard, reset]);

  const openDesign = useCallback(async () => {
    if (!(await confirmDiscard())) return;
    try {
      const result = await native.openDesign();
      if (result) loadDesignText(result.text, result.path, result.name);
    } catch (err) {
      notify(`Couldn't open the file: ${err.message ?? err}`, "error");
    }
  }, [confirmDiscard, loadDesignText, notify]);

  const openDesignPath = useCallback(
    async (path) => {
      if (!(await confirmDiscard())) return;
      try {
        loadDesignText(await native.readDesignPath(path), path);
      } catch (err) {
        notify(`Couldn't open the file: ${err.message ?? err}`, "error");
      }
    },
    [confirmDiscard, loadDesignText, notify],
  );

  const saveDesign = useCallback(
    async ({ saveAs = false } = {}) => {
      const snapshot = design;
      const text = serializeDesign(snapshot);
      try {
        let path = file.path;
        if (path && !saveAs) {
          await native.saveDesignTo(path, text);
        } else {
          path = await native.saveDesignAs(text, file.name);
          if (!path) return;
        }
        savedRef.current = snapshot;
        // In the browser fallback there is no real path to overwrite later.
        setFile({ path: native.isTauri ? path : null, name: native.baseName(path) });
        notify(`Saved ${native.baseName(path)}`, "success");
      } catch (err) {
        notify(`Couldn't save: ${err.message ?? err}`, "error");
      }
    },
    [design, file, notify],
  );

  const [exporting, setExporting] = useState(false);
  const exportPng = useCallback(
    async (scene) => {
      setExporting(true);
      try {
        const bytes = await renderPng(design, { scene, scale: 2 });
        const base = file.name.replace(new RegExp(`\\.${FILE_EXTENSION}$`), "");
        const path = await native.savePng(bytes, `${base}.png`);
        if (path) notify(`Exported ${native.baseName(path)}`, "success");
      } catch (err) {
        notify(`Couldn't export the PNG: ${err.message ?? err}`, "error");
      } finally {
        setExporting(false);
      }
    },
    [design, file.name, notify],
  );

  const copyCode = useCallback(
    async (code, label) => {
      try {
        await native.copyText(code);
        notify(`${label} copied to your clipboard`, "success");
        return true;
      } catch (err) {
        notify(`Couldn't copy: ${err.message ?? err}`, "error");
        return false;
      }
    },
    [notify],
  );

  // --- images --------------------------------------------------------------
  const setImage = useCallback(
    (slot, dataUrl) => set((d) => ({ ...d, content: { ...d.content, [slot]: dataUrl } })),
    [set],
  );

  const pickImage = useCallback(
    async (slot) => {
      try {
        const dataUrl = await native.pickImage();
        if (dataUrl) setImage(slot, dataUrl);
      } catch (err) {
        notify(String(err.message ?? err), "error");
      }
    },
    [setImage, notify],
  );

  // --- drag & drop ---------------------------------------------------------
  const [dropTarget, setDropTarget] = useState(null);
  const targetAt = (x, y) => {
    const el = document.elementFromPoint(x, y)?.closest("[data-drop]");
    return el?.dataset.drop === "avatar" ? "avatar" : "background";
  };

  const handlersRef = useRef();
  handlersRef.current = { openDesignPath, setImage, notify };

  useEffect(() => {
    // Native OS drops (Tauri intercepts these before the webview sees them).
    const off = native.onNativeDragDrop({
      over: (x, y) => setDropTarget(targetAt(x, y)),
      leave: () => setDropTarget(null),
      drop: async (paths, x, y) => {
        setDropTarget(null);
        const { openDesignPath, setImage, notify } = handlersRef.current;
        const designPath = paths.find(native.isDesignPath);
        if (designPath) return openDesignPath(designPath);
        const imagePath = paths.find(native.isImagePath);
        if (!imagePath) return notify("Drop a picture (PNG, JPG, WebP, GIF, SVG) or an .auradrop file.", "error");
        try {
          setImage(targetAt(x, y), await native.readImagePath(imagePath));
        } catch (err) {
          notify(String(err.message ?? err), "error");
        }
      },
    });
    return () => void off.then((f) => f());
  }, []);

  useEffect(() => {
    if (native.isTauri) return;
    // Browser fallback for development.
    const over = (e) => {
      e.preventDefault();
      setDropTarget(targetAt(e.clientX, e.clientY));
    };
    const leave = (e) => !e.relatedTarget && setDropTarget(null);
    const drop = async (e) => {
      e.preventDefault();
      setDropTarget(null);
      const f = e.dataTransfer.files[0];
      if (!f) return;
      const { setImage, notify } = handlersRef.current;
      if (!f.type.startsWith("image/")) return notify("Drop a picture file.", "error");
      setImage(targetAt(e.clientX, e.clientY), await native.fileToDataUrl(f));
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, []);

  // --- launch file / second instance --------------------------------------
  useEffect(() => {
    native.takeLaunchFile().then((path) => path && handlersRef.current.openDesignPath(path));
    const off = native.listen("open-design-file", (path) => handlersRef.current.openDesignPath(path));
    return () => void off.then((f) => f());
  }, []);

  // --- keyboard shortcuts --------------------------------------------------
  useEffect(() => {
    const onKey = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const typing = e.target.closest?.("input[type=text], input:not([type]), textarea");
      const k = e.key.toLowerCase();
      const run = (fn) => {
        e.preventDefault();
        fn();
      };
      if (k === "s") run(() => saveDesign({ saveAs: e.shiftKey }));
      else if (k === "o") run(openDesign);
      else if (k === "n") run(newDesign);
      else if (typing) return; // let text fields keep their own undo
      else if (k === "z" && !e.shiftKey) run(undo);
      else if (k === "y" || (k === "z" && e.shiftKey)) run(redo);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveDesign, openDesign, newDesign, undo, redo]);

  const closeWindow = useCallback(async () => {
    if (await confirmDiscard()) native.appWindow.close();
  }, [confirmDiscard]);

  return (
    <div className="flex h-full flex-col">
      <TitleBar
        fileName={file.name}
        dirty={dirty}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={undo}
        onRedo={redo}
        onNew={newDesign}
        onOpen={openDesign}
        onSave={() => saveDesign()}
        onClose={closeWindow}
        settings={{
          backdrop,
          backdropApplied,
          onBackdrop: setBackdropPref,
          minimizeToTray,
          onMinimizeToTray: setMinimizeToTrayState,
        }}
      />

      <div className="flex min-h-0 flex-1 gap-2 px-2 pb-2">
        <main className="@container flex min-w-0 flex-1 flex-col gap-2">
          <Stage
            design={design}
            dropTarget={dropTarget}
            onStarterLook={(look) => set((d) => applyStarterLook(d, look))}
            onSurprise={() => set((d) => randomDesign(d))}
            onReset={() => set((d) => ({ ...createDefaultDesign(), content: d.content }))}
          />
          <ExportBar design={design} onCopy={copyCode} onExportPng={exportPng} exporting={exporting} />
        </main>
        <div className="glass-chrome flex min-h-0 rounded-2xl">
          <Inspector design={design} set={set} onPickImage={pickImage} />
        </div>
      </div>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center">
          <div
            key={toast.key}
            role="status"
            className={`toast-in rounded-xl border px-4 py-2 text-[12.5px] font-medium shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl ${
              toast.tone === "error"
                ? "border-rose-400/40 bg-rose-500/20 text-rose-100"
                : toast.tone === "success"
                  ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-100"
                  : "border-white/15 bg-white/10 text-ink"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
