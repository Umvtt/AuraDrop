import { useCallback, useEffect, useRef, useState } from "react";
import { BottomBar } from "./components/editor/BottomBar.jsx";
import { Canvas } from "./components/editor/Canvas.jsx";
import { Inspector } from "./components/editor/Inspector.jsx";
import { LeftPanel } from "./components/editor/LeftPanel.jsx";
import { Preview } from "./components/Preview.jsx";
import { StartScreen } from "./components/StartScreen.jsx";
import { TitleBar } from "./components/TitleBar.jsx";
import { UpdateGate } from "./components/UpdateGate.jsx";
import { useEditor } from "./hooks/useEditor.js";
import { buildWebPage } from "./lib/exportHtml.js";
import * as native from "./lib/native.js";
import {
  createElement,
  createProject,
  duplicateElement,
  FILE_EXTENSION,
  makeFromTemplate,
  parseProjectFile,
  serializeProject,
} from "./lib/project.js";
import { renderPng } from "./lib/renderPng.js";

const UPDATE_CHECK_MS = 6 * 60 * 60 * 1000;

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

const safeFileName = (name) => (name || "Untitled").replace(/[\\/:*?"<>|]+/g, "-").trim() || "Untitled";

/** Natural size of an image data URL (falls back to a square). */
function imageSize(data) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = data;
  });
}

export default function App() {
  const editor = useEditor(createProject());
  const { project, page, pageIndex, selected, selectedId } = editor;
  const [mode, setMode] = useState("start"); // start | edit | preview
  const [previewPage, setPreviewPage] = useState(0);
  const [animate, setAnimate] = useState(false);
  const canvasRef = useRef(null);
  const clipboard = useRef(null);

  // --- file state ----------------------------------------------------------
  const [file, setFile] = useState({ path: null, name: null });
  const savedRef = useRef(project);
  const dirty = mode !== "start" && project !== savedRef.current;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const fileName = file.name ?? `${safeFileName(project.name)}.${FILE_EXTENSION}`;

  // --- toasts --------------------------------------------------------------
  const [toast, setToast] = useState(null);
  const notify = useCallback((message, tone = "info") => setToast({ message, tone, key: Date.now() }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
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
    const off = native.listen("prefs-changed", (p) => setMinimizeToTrayState(p.minimizeToTray));
    return () => void off.then((f) => f());
  }, []);

  // --- updates -------------------------------------------------------------
  const [update, setUpdate] = useState(null);
  useEffect(() => {
    let alive = true;
    const check = () => native.checkUpdate().then((u) => alive && u && setUpdate(u));
    check();
    const t = setInterval(check, UPDATE_CHECK_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // --- files -----------------------------------------------------------------
  const confirmDiscard = useCallback(async () => {
    if (!dirtyRef.current) return true;
    return native.ask("You have unsaved changes. Throw them away?", { okLabel: "Discard", cancelLabel: "Keep editing" });
  }, []);

  /** Load a project; files from disk open in Preview first. */
  const loadProject = useCallback(
    (p, { path = null, name = null, preview = true } = {}) => {
      editor.load(p);
      savedRef.current = p;
      setFile({ path, name });
      setPreviewPage(0);
      setMode(preview ? "preview" : "edit");
    },
    [editor],
  );

  const openText = useCallback(
    (text, path, name) => {
      try {
        loadProject(parseProjectFile(text), { path, name: name ?? native.baseName(path) });
      } catch (err) {
        notify(err.message, "error");
      }
    },
    [loadProject, notify],
  );

  const openDialog = useCallback(async () => {
    if (!(await confirmDiscard())) return;
    try {
      const r = await native.openProject();
      if (r) openText(r.text, r.path, r.name);
    } catch (err) {
      notify(`Couldn't open the file: ${err.message ?? err}`, "error");
    }
  }, [confirmDiscard, openText, notify]);

  const openPath = useCallback(
    async (path) => {
      if (!(await confirmDiscard())) return;
      try {
        openText(await native.readProjectPath(path), path);
      } catch (err) {
        notify(`Couldn't open the file: ${err.message ?? err}`, "error");
      }
    },
    [confirmDiscard, openText, notify],
  );

  const newProject = useCallback(async () => {
    if (!(await confirmDiscard())) return;
    setMode("start");
  }, [confirmDiscard]);

  const createFromTemplate = useCallback(
    (templateId, presetId) => {
      const p = makeFromTemplate(templateId, presetId);
      loadProject(p, { preview: false });
      setFile({ path: null, name: null });
    },
    [loadProject],
  );

  const save = useCallback(
    async ({ saveAs = false } = {}) => {
      const snapshot = project;
      const text = serializeProject(snapshot);
      try {
        let path = file.path;
        if (path && !saveAs) await native.saveProjectTo(path, text);
        else {
          path = await native.saveProjectAs(text, fileName);
          if (!path) return;
        }
        savedRef.current = snapshot;
        setFile({ path: native.isTauri ? path : null, name: native.baseName(path) });
        notify(`Saved ${native.baseName(path)}`, "success");
      } catch (err) {
        notify(`Couldn't save: ${err.message ?? err}`, "error");
      }
    },
    [project, file.path, fileName, notify],
  );

  const [busy, setBusy] = useState(null);
  const exportPng = useCallback(async () => {
    setBusy("png");
    try {
      const bytes = await renderPng(project, pageIndex);
      const suffix = project.pages.length > 1 ? `-page${pageIndex + 1}` : "";
      const path = await native.savePng(bytes, `${safeFileName(project.name)}${suffix}.png`);
      if (path) notify(`Exported ${native.baseName(path)}`, "success");
    } catch (err) {
      notify(`Couldn't export the PNG: ${err.message ?? err}`, "error");
    } finally {
      setBusy(null);
    }
  }, [project, pageIndex, notify]);

  const exportHtml = useCallback(async () => {
    setBusy("html");
    try {
      const html = await buildWebPage(project);
      const path = await native.saveWebPage(html, `${safeFileName(project.name)}.html`);
      if (path) notify(`Exported ${native.baseName(path)} – open it in any browser`, "success");
    } catch (err) {
      notify(`Couldn't export the web page: ${err.message ?? err}`, "error");
    } finally {
      setBusy(null);
    }
  }, [project, notify]);

  // --- adding things ------------------------------------------------------------

  /** Add a picture as a new layer, sized to fit and centred on `at`. */
  const addPicture = useCallback(
    async (data, name, at) => {
      const { w: iw, h: ih } = await imageSize(data);
      const c = project.canvas;
      const k = Math.min((c.w * 0.6) / iw, (c.h * 0.6) / ih, 1);
      const w = Math.max(40, Math.round(iw * k));
      const h = Math.max(40, Math.round(ih * k));
      const cx = at?.x ?? c.w / 2;
      const cy = at?.y ?? c.h / 2;
      let created;
      editor.withAsset("image", data, name, (p, id) => {
        created = createElement("image", p.canvas, { asset: id, w, h, x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), name: name || "Picture" });
        return editor.pageUpdater((pg) => ({ ...pg, elements: [...pg.elements, created] }))(p);
      });
      editor.select(created.id);
    },
    [editor, project.canvas],
  );

  const setPicture = useCallback(
    (elId, data, name) =>
      editor.withAsset("image", data, name, (p, id) =>
        editor.pageUpdater((pg) => ({ ...pg, elements: pg.elements.map((e) => (e.id === elId ? { ...e, asset: id } : e)) }))(p),
      ),
    [editor],
  );

  const attachSound = useCallback(
    (elId, actionIndex, data, name) =>
      editor.withAsset("audio", data, name, (p, id) =>
        editor.pageUpdater((pg) => ({
          ...pg,
          elements: pg.elements.map((e) => {
            if (e.id !== elId) return e;
            const actions = [...e.actions];
            if (actionIndex != null && actions[actionIndex]?.type === "sound") actions[actionIndex] = { ...actions[actionIndex], asset: id };
            else actions.push({ type: "sound", asset: id, volume: 1, stopOthers: true });
            return { ...e, actions };
          }),
        }))(p),
      ),
    [editor],
  );

  const addSoundButton = useCallback(
    (data, name, at) => {
      let created;
      editor.withAsset("audio", data, name, (p, id) => {
        const label = (name || "Sound").replace(/\.[^.]+$/, "").slice(0, 24);
        created = createElement("button", p.canvas, { label, icon: "🔊", actions: [{ type: "sound", asset: id, volume: 1, stopOthers: true }] });
        if (at) {
          created.x = Math.round(at.x - created.w / 2);
          created.y = Math.round(at.y - created.h / 2);
        }
        return editor.pageUpdater((pg) => ({ ...pg, elements: [...pg.elements, created] }))(p);
      });
      editor.select(created.id);
    },
    [editor],
  );

  const pick = useCallback(
    async (kind) => {
      try {
        return await native.pickMedia(kind);
      } catch (err) {
        notify(String(err.message ?? err), "error");
        return null;
      }
    },
    [notify],
  );

  const onAdd = useCallback(
    async (what) => {
      const c = project.canvas;
      switch (what) {
        case "text":
          editor.addElement("text");
          break;
        case "meme":
          editor.addElement("text", {
            text: "Top text",
            font: "Impact",
            weight: 400,
            upper: true,
            size: Math.round(c.w / 10),
            stroke: { width: Math.max(4, Math.round(c.w / 160)), color: "#000000" },
            shadow: { on: false },
            name: "Meme text",
          });
          break;
        case "image": {
          const m = await pick("image");
          if (m) await addPicture(m.data, m.name);
          break;
        }
        case "sound": {
          const m = await pick("audio");
          if (m) addSoundButton(m.data, m.name);
          break;
        }
        case "button":
        case "glass":
          editor.addElement(what);
          break;
        default: {
          const names = { rect: "Box", ellipse: "Circle", triangle: "Triangle", star: "Star", heart: "Heart", bubble: "Speech bubble", arrow: "Arrow" };
          editor.addElement("shape", { shape: what, name: names[what] ?? "Shape" });
        }
      }
    },
    [editor, project.canvas, pick, addPicture, addSoundButton],
  );

  // --- drag & drop ------------------------------------------------------------
  const [dropTarget, setDropTarget] = useState(null);
  const handlersRef = useRef();
  handlersRef.current = { mode, openPath, addPicture, setPicture, addSoundButton, attachSound, selectedId, notify, createFromTemplate };

  const describeDrop = (x, y, kind) => {
    const c = canvasRef.current;
    if (!c) return null;
    const el = c.elementAt(x, y);
    if (kind === "image" && el?.type === "image") return { el, label: "Drop to replace this picture" };
    if (kind === "audio" && el) return { el, label: "Drop to make this play the sound" };
    if (kind === "project") return { el: null, label: "Drop to open this project" };
    return { el: null, label: kind === "audio" ? "Drop to add a sound button" : "Drop to add the picture" };
  };

  const handleDrop = useCallback(async (item, x, y) => {
    const h = handlersRef.current;
    if (item.kind === "project") return item.path ? h.openPath(item.path) : null;
    if (h.mode === "preview") return h.notify("Switch to ✏️ Edit to add pictures and sounds.");
    if (h.mode === "start") h.createFromTemplate("blank");
    const c = canvasRef.current;
    const el = c?.elementAt(x, y) ?? null;
    const at = c?.isOverCanvas(x, y) ? c.toCanvas(x, y) : null;
    try {
      const data = await item.read();
      if (item.kind === "image") {
        if (el?.type === "image") h.setPicture(el.id, data, item.name);
        else await h.addPicture(data, item.name, at);
      } else if (item.kind === "audio") {
        if (el) h.attachSound(el.id, null, data, item.name);
        else h.addSoundButton(data, item.name, at);
      }
    } catch (err) {
      h.notify(String(err.message ?? err), "error");
    }
  }, []);

  useEffect(() => {
    const kindOf = (path) => (native.isProjectPath(path) ? "project" : native.isImagePath(path) ? "image" : native.isAudioPath(path) ? "audio" : null);
    const off = native.onNativeDragDrop({
      over: () => setDropTarget((d) => d ?? { el: null, label: "Drop it!" }),
      leave: () => setDropTarget(null),
      drop: (paths, x, y) => {
        setDropTarget(null);
        const path = paths.find(kindOf);
        if (!path) return handlersRef.current.notify("Drop a picture, a sound or an .auradrop file.", "error");
        const kind = kindOf(path);
        handleDrop({ kind, path, name: native.baseName(path), read: () => native.readMediaPath(path) }, x, y);
      },
    });
    return () => void off.then((f) => f());
  }, [handleDrop]);

  useEffect(() => {
    if (native.isTauri) return;
    // Browser fallback for development.
    const kindOfFile = (f) => (f.name.endsWith(`.${FILE_EXTENSION}`) ? "project" : f.type.startsWith("image/") ? "image" : f.type.startsWith("audio/") ? "audio" : null);
    const over = (e) => {
      e.preventDefault();
      const kind = [...(e.dataTransfer.items ?? [])].some((i) => i.type.startsWith("audio/")) ? "audio" : "image";
      setDropTarget(describeDrop(e.clientX, e.clientY, kind));
    };
    const leave = (e) => !e.relatedTarget && setDropTarget(null);
    const drop = async (e) => {
      e.preventDefault();
      setDropTarget(null);
      const f = e.dataTransfer.files[0];
      if (!f) return;
      const kind = kindOfFile(f);
      if (kind === "project") return handlersRef.current.notify("Use 📂 Open for project files in the browser.");
      if (!kind) return handlersRef.current.notify("Drop a picture or a sound.", "error");
      handleDrop({ kind, name: f.name, read: () => native.fileToDataUrl(f) }, e.clientX, e.clientY);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [handleDrop]);

  // --- launch file / second instance ----------------------------------------
  useEffect(() => {
    native.takeLaunchFile().then((path) => path && handlersRef.current.openPath(path));
    const off = native.listen("open-design-file", (path) => handlersRef.current.openPath(path));
    return () => void off.then((f) => f());
  }, []);

  // --- keyboard -----------------------------------------------------------------
  const keyRef = useRef();
  keyRef.current = { mode, save, openDialog, newProject, editor, selected, project, previewPage, pageIndex, notify };
  useEffect(() => {
    const onKey = (e) => {
      const k = keyRef.current;
      const typing = e.target.closest?.("input, textarea, select, [contenteditable=true]");
      const key = e.key.toLowerCase();
      const run = (fn) => {
        e.preventDefault();
        fn();
      };
      if (e.key === "F5" && k.mode !== "start") return run(() => setMode((m) => (m === "edit" ? "preview" : "edit")));
      if (e.ctrlKey || e.metaKey) {
        if (key === "s" && k.mode !== "start") return run(() => k.save({ saveAs: e.shiftKey }));
        if (key === "o") return run(k.openDialog);
        if (key === "n") return run(k.newProject);
      }
      if (k.mode !== "edit" || typing) return;
      const sel = k.selected;
      if (e.ctrlKey || e.metaKey) {
        if (key === "z" && !e.shiftKey) return run(k.editor.undo);
        if (key === "y" || (key === "z" && e.shiftKey)) return run(k.editor.redo);
        if (key === "d" && sel) return run(() => k.editor.duplicateElement(sel.id));
        if (key === "c" && sel) return run(() => (clipboard.current = structuredClone(sel)));
        if (key === "v" && clipboard.current) return run(() => k.editor.insertElement(duplicateElement(clipboard.current, 24)));
        return;
      }
      if (!sel) return;
      if (e.key === "Delete" || e.key === "Backspace") return run(() => k.editor.removeElement(sel.id));
      if (e.key === "Escape") return run(() => k.editor.select(null));
      if (e.key === "]") return run(() => k.editor.moveLayer(sel.id, 1));
      if (e.key === "[") return run(() => k.editor.moveLayer(sel.id, -1));
      const step = e.shiftKey ? 10 : 1;
      const nudge = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (nudge && !sel.locked) run(() => k.editor.updateElement(sel.id, { x: sel.x + nudge[0], y: sel.y + nudge[1] }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const closeWindow = useCallback(async () => {
    if (await confirmDiscard()) native.appWindow.close();
  }, [confirmDiscard]);

  const commitText = useCallback(
    (el, value) => {
      if (el.type === "text") editor.updateElement(el.id, { text: value });
      else if (el.type === "button") editor.updateElement(el.id, { label: value });
      else if (el.type === "sticker" && value.trim()) editor.updateElement(el.id, { emoji: value.trim().slice(0, 16) });
    },
    [editor],
  );

  return (
    <div className="relative flex h-full flex-col">
      <TitleBar
        mode={mode}
        fileName={mode === "start" ? "" : fileName}
        dirty={dirty}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onNew={newProject}
        onOpen={openDialog}
        onSave={() => save()}
        onClose={closeWindow}
        onPreview={() => {
          setPreviewPage(pageIndex);
          setMode("preview");
        }}
        onEdit={() => setMode("edit")}
        settings={{
          backdrop,
          backdropApplied,
          onBackdrop: setBackdropPref,
          minimizeToTray,
          onMinimizeToTray: setMinimizeToTrayState,
        }}
      />

      {mode === "start" && <StartScreen onCreate={createFromTemplate} onOpen={openDialog} onClose={dirty || project.pages[0].elements.length ? () => setMode("edit") : null} />}

      {mode === "preview" && (
        <Preview
          project={project}
          startPage={previewPage}
          onPageChange={setPreviewPage}
          onEdit={(i) => {
            editor.goToPage(i);
            setMode("edit");
          }}
        />
      )}

      {mode === "edit" && (
        <div className="flex min-h-0 flex-1 gap-2 px-2 pb-2">
          <LeftPanel
            project={project}
            page={page}
            selectedId={selectedId}
            onAdd={onAdd}
            onAddSticker={(emoji) => editor.addElement("sticker", { emoji, name: `Sticker ${emoji}` })}
            onSelect={editor.select}
            onToggle={(id, key) => editor.updateElement(id, (e) => ({ ...e, [key]: !e[key] }))}
            onMove={editor.moveLayer}
            onRename={(id, name) => editor.updateElement(id, { name })}
          />
          <main className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="glass-chrome relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
              <Canvas
                ref={canvasRef}
                project={project}
                pageIndex={pageIndex}
                selectedId={selectedId}
                onSelect={editor.select}
                onChange={(id, patch) => editor.updateElement(id, patch)}
                onCommitText={commitText}
                animate={animate}
                dropTarget={dropTarget}
              />
              <button
                type="button"
                onClick={() => setAnimate((a) => !a)}
                aria-pressed={animate}
                title="Play animations while editing"
                className={`press focus-ring absolute top-3 right-3 rounded-xl px-3 py-1.5 text-[11.5px] font-medium ${animate ? "bg-accent/25 text-white" : "glass-chrome text-muted hover:text-ink"}`}
              >
                {animate ? "⏸ Animations on" : "▶ Animations off"}
              </button>
            </div>
            <BottomBar
              project={project}
              pageIndex={pageIndex}
              onGoTo={editor.goToPage}
              onAddPage={editor.addPage}
              onDuplicatePage={editor.duplicatePage}
              onRemovePage={editor.removePage}
              onMovePage={editor.movePage}
              onSave={() => save()}
              onExportPng={exportPng}
              onExportHtml={exportHtml}
              busy={busy}
            />
          </main>
          <Inspector
            project={project}
            page={page}
            pageIndex={pageIndex}
            selected={selected}
            update={editor.updateElement}
            remove={editor.removeElement}
            duplicate={editor.duplicateElement}
            updatePage={editor.updatePage}
            setProject={editor.setProject}
            chooseImage={async (elId) => {
              const m = await pick("image");
              if (m) setPicture(elId, m.data, m.name);
            }}
            chooseSound={async (elId, i) => {
              const m = await pick("audio");
              if (m) attachSound(elId, i, m.data, m.name);
            }}
            chooseBackground={async () => {
              const m = await pick("image");
              if (m) editor.withAsset("image", m.data, m.name, (p, id) => editor.pageUpdater((pg) => ({ ...pg, bg: { ...pg.bg, type: "image", asset: id } }))(p));
            }}
          />
        </div>
      )}

      {update && <UpdateGate info={update} />}

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
