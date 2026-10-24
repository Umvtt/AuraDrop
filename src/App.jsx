import { useCallback, useEffect, useRef, useState } from "react";
import { Command, Grid3x3, History, Magnet, Pause, Play, Ruler, Wrench } from "lucide-react";
import { Section, Segmented, Slider, Toggle, UiModeContext } from "./components/controls.jsx";
import { BottomBar } from "./components/editor/BottomBar.jsx";
import { Canvas } from "./components/editor/Canvas.jsx";
import { Inspector } from "./components/editor/Inspector.jsx";
import { LeftPanel } from "./components/editor/LeftPanel.jsx";
import { ExportMotion } from "./components/editor/ExportMotion.jsx";
import { HistoryPanel } from "./components/editor/HistoryPanel.jsx";
import { PictureTools } from "./components/editor/PictureTools.jsx";
import { Preview } from "./components/Preview.jsx";
import { Home } from "./components/Home.jsx";
import { TitleBar } from "./components/TitleBar.jsx";
import { UpdateGate } from "./components/UpdateGate.jsx";
import { CommandPalette, ContextMenu, ShortcutsDialog } from "./components/Menus.jsx";
import { Gallery, Workshop } from "./components/workshop/Workshop.jsx";
import { useEditor } from "./hooks/useEditor.js";
import { useHangar } from "./hooks/useHangar.js";
import { useLibrary } from "./hooks/useLibrary.js";
import { statCard, vehicleElement } from "./lib/vehicleCard.js";
import { PRESETS3D } from "./vehicles3d/presets.js";
import { createVehicle, randomVehicle, vehicleId } from "./vehicles3d/spec.js";
import { buildCommands, contextItems } from "./lib/commands.js";
import { buildWebPage } from "./lib/exportHtml.js";
import * as native from "./lib/native.js";
import {
  createElement,
  createProject,
  duplicateElement,
  FILE_EXTENSION,
  makeFromTemplate,
  parseProjectFile,
  registerVehicleTemplates,
  serializeProject,
} from "./lib/project.js";
import { renderPng, renderThumb } from "./lib/renderPng.js";

const UPDATE_CHECK_MS = 6 * 60 * 60 * 1000;

registerVehicleTemplates(statCard, [PRESETS3D.find((v) => v.preset === "tiger1"), PRESETS3D.find((v) => v.preset === "sherman")]);

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
  const { project, page, pageIndex, selected, selectedId, selection, selectedIds } = editor;
  const [mode, setMode] = useState("home"); // home | edit | preview | workshop
  const [homeTab, setHomeTab] = useState("projects");
  const hangar = useHangar();
  const library = useLibrary();
  const [workshop, setWorkshop] = useState(null); // { vehicle, context: insert | edit | browse, targetId, back }
  const [vehiclePicker, setVehiclePicker] = useState(false);
  const [menu, setMenu] = useState(null); // context menu {x, y, id}
  const [palette, setPalette] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [exportMotion, setExportMotion] = useState(false);
  const [grid, setGridState] = useState(() => readPref("grid", { show: false, snap: false, size: 40 }));
  const [rulers, setRulersState] = useState(() => readPref("rulers", true));
  const [uiMode, setUiModeState] = useState(() => readPref("uiMode", "simple"));
  const setUiMode = (m) => (writePref("uiMode", m), setUiModeState(m));
  const pro = uiMode === "pro";
  const setGrid = (g) => setGridState((cur) => (writePref("grid", typeof g === "function" ? g(cur) : g), typeof g === "function" ? g(cur) : g));
  const setRulers = (r) => setRulersState((cur) => (writePref("rulers", typeof r === "function" ? r(cur) : r), typeof r === "function" ? r(cur) : r));
  const [previewPage, setPreviewPage] = useState(0);
  const [animate, setAnimate] = useState(false);
  const canvasRef = useRef(null);
  const clipboard = useRef(null);

  // --- file state ----------------------------------------------------------
  // Every project lives in the library and autosaves there; `file.path` is
  // the .auradrop file it was opened from or saved to (Ctrl+S writes it too).
  const [file, setFile] = useState({ path: null, name: null });
  const [projectId, setProjectId] = useState(null);
  const [saveState, setSaveState] = useState("saved"); // saved | saving | error
  const savedRef = useRef(project);
  const dirty = mode !== "home" && project !== savedRef.current;
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

  // --- files & autosave -------------------------------------------------------
  const libRef = useRef();
  libRef.current = { project, projectId, path: file.path, library, mode };
  const pending = useRef(Promise.resolve());
  const thumbAt = useRef(0);

  const makeThumb = useCallback((id, p) => {
    thumbAt.current = Date.now();
    renderThumb(p)
      .then((t) => libRef.current.library.setThumb(id, t))
      .catch(() => {});
  }, []);

  /** Write the current project to the library now (queued behind any save in flight). */
  const flush = useCallback(({ thumb = false } = {}) => {
    pending.current = pending.current.then(async () => {
      const { project: p, projectId: id, path, library: lib, mode: m } = libRef.current;
      if (m === "home" || m === "workshop") return id;
      if (p === savedRef.current) {
        if (id && thumb) makeThumb(id, p);
        return id;
      }
      setSaveState("saving");
      try {
        const nid = await lib.save(id, p, { path });
        savedRef.current = p;
        libRef.current.projectId = nid;
        setProjectId(nid);
        setSaveState("saved");
        if (thumb || Date.now() - thumbAt.current > 15000) makeThumb(nid, p);
        return nid;
      } catch (err) {
        setSaveState("error");
        notify(`Autosave failed: ${err.message ?? err}`, "error");
        return id;
      }
    });
    return pending.current;
  }, [makeThumb, notify]);

  // Autosave shortly after every change.
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => flush(), 1200);
    return () => clearTimeout(t);
  }, [project, dirty, flush]);

  /** Load a project into the editor; files from disk open in Preview first. */
  const loadProject = useCallback(
    (p, { id = null, path = null, name = null, preview = true } = {}) => {
      editor.load(p);
      savedRef.current = p;
      libRef.current.projectId = id;
      setProjectId(id);
      setFile({ path, name });
      setPreviewPage(0);
      setSaveState("saved");
      setMode(preview ? "preview" : "edit");
    },
    [editor],
  );

  const goHome = useCallback(async (tab) => {
    await flush({ thumb: true });
    if (tab) setHomeTab(tab);
    setMode("home");
  }, [flush]);

  /** Open a .auradrop file: it joins the library (or refreshes its copy there). */
  const openText = useCallback(
    async (text, path, name) => {
      try {
        const p = parseProjectFile(text);
        const known = path && library.items.find((x) => x.path === path);
        const id = await library.save(known?.id ?? null, p, { path });
        loadProject(p, { id, path, name: name ?? native.baseName(path) });
        makeThumb(id, p);
      } catch (err) {
        notify(err.message, "error");
      }
    },
    [library, loadProject, makeThumb, notify],
  );

  const openDialog = useCallback(async () => {
    try {
      const r = await native.openProject();
      if (!r) return;
      await flush({ thumb: true });
      await openText(r.text, r.path, r.name);
    } catch (err) {
      notify(`Couldn't open the file: ${err.message ?? err}`, "error");
    }
  }, [flush, openText, notify]);

  const openPath = useCallback(
    async (path) => {
      try {
        await flush({ thumb: true });
        await openText(await native.readProjectPath(path), path);
      } catch (err) {
        notify(`Couldn't open the file: ${err.message ?? err}`, "error");
      }
    },
    [flush, openText, notify],
  );

  const openFromLibrary = useCallback(
    async (id) => {
      try {
        const p = await library.open(id);
        const item = library.items.find((x) => x.id === id);
        loadProject(p, { id, path: item?.path ?? null, name: item?.path ? native.baseName(item.path) : null, preview: false });
      } catch (err) {
        notify(String(err.message ?? err), "error");
      }
    },
    [library, loadProject, notify],
  );

  const newProject = useCallback(() => goHome("templates"), [goHome]);

  const createFromTemplate = useCallback(
    async (templateId, presetId) => {
      await flush({ thumb: true });
      // A fresh project joins the library on its first change.
      loadProject(makeFromTemplate(templateId, presetId), { preview: false });
    },
    [flush, loadProject],
  );

  /** Ctrl+S: save now, and write the .auradrop file too if there is one. */
  const save = useCallback(
    async ({ saveAs = false } = {}) => {
      const snapshot = project;
      try {
        let path = file.path;
        if (saveAs || (path && native.isTauri)) {
          const text = serializeProject(snapshot);
          if (path && !saveAs) await native.saveProjectTo(path, text);
          else {
            path = await native.saveProjectAs(text, fileName);
            if (!path) return;
          }
          const p = native.isTauri ? path : null;
          libRef.current.path = p;
          setFile({ path: p, name: native.baseName(path) });
          savedRef.current = null; // re-save so the library remembers the path
        }
        await flush({ thumb: true });
        notify(path ? `Saved ${native.baseName(path)}` : "Saved to your projects", "success");
      } catch (err) {
        notify(`Couldn't save: ${err.message ?? err}`, "error");
      }
    },
    [project, file.path, fileName, flush, notify],
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
        editor.pageUpdater((pg) => ({ ...pg, elements: pg.elements.map((e) => (e.id === elId ? { ...e, asset: id, original: null } : e)) }))(p),
      ),
    [editor],
  );

  /** Apply a crop / background removal: the result becomes a new picture, the first one is kept to restore. */
  const [pictureTools, setPictureTools] = useState(null); // { elId, tab }
  const applyPicture = useCallback(
    (elId, data, { aspect } = {}) =>
      editor.withAsset("image", data, "edited picture", (p, id) =>
        editor.pageUpdater((pg) => ({
          ...pg,
          elements: pg.elements.map((e) => {
            if (e.id !== elId) return e;
            const next = { ...e, asset: id, original: e.original ?? e.asset };
            if (aspect) {
              // Reshape the layer to the cropped picture, keeping its centre and longest side.
              const long = Math.max(e.w, e.h);
              next.w = Math.round(aspect >= 1 ? long : long * aspect);
              next.h = Math.round(aspect >= 1 ? long / aspect : long);
              next.x = Math.round(e.x + (e.w - next.w) / 2);
              next.y = Math.round(e.y + (e.h - next.h) / 2);
            }
            return next;
          }),
        }))(p),
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
        case "vehicle":
          setVehiclePicker(true);
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
    if (h.mode === "home") await h.createFromTemplate("blank");
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

  // --- clipboard & vehicles ---------------------------------------------------
  const copy = useCallback(
    (cut = false) => {
      if (!selection.length) return;
      const assets = {};
      for (const el of selection) {
        if (el.asset && project.assets[el.asset]) assets[el.asset] = project.assets[el.asset];
        el.actions.forEach((a) => a.asset && project.assets[a.asset] && (assets[a.asset] = project.assets[a.asset]));
      }
      clipboard.current = { els: structuredClone(selection), assets };
      if (cut) editor.removeElements(selection.map((e) => e.id));
    },
    [selection, project.assets, editor],
  );
  const paste = useCallback(() => {
    const c = clipboard.current;
    if (!c) return;
    const regroup = new Map();
    const els = c.els.map((el) => {
      const copy = duplicateElement(el, 24);
      copy.name = el.name;
      if (el.group) {
        if (!regroup.has(el.group)) regroup.set(el.group, `g${Date.now().toString(36)}${regroup.size}`);
        copy.group = regroup.get(el.group);
      }
      return copy;
    });
    editor.setProject((p) => editor.pageUpdater((pg) => ({ ...pg, elements: [...pg.elements, ...els] }))({ ...p, assets: { ...c.assets, ...p.assets } }), { step: true });
    editor.select(els.map((e) => e.id), { deep: true });
  }, [editor]);

  const openWorkshop = useCallback((vehicle, context = "browse", targetId = null) => {
    setWorkshop({ vehicle: structuredClone(vehicle ?? createVehicle("tank", { name: "My tank" })), context, targetId, back: mode === "workshop" ? "home" : mode });
    setMode("workshop");
  }, [mode]);

  const insertVehicle = useCallback(
    (vehicle, card = false) => {
      const v = { ...structuredClone(vehicle), id: vehicle.preset ? vehicleId() : vehicle.id };
      if (card) editor.insertElements(statCard(v, project.canvas));
      else editor.insertElement(vehicleElement(v, project.canvas));
    },
    [editor, project.canvas],
  );

  const finishWorkshop = useCallback(
    (vehicle) => {
      const w = workshop;
      if (w.context === "edit" && w.targetId) {
        editor.updateElement(w.targetId, (e) => ({ ...e, vehicle, name: vehicle.name }), { step: true });
        setMode("edit");
      } else if (w.context === "insert") {
        insertVehicle(vehicle);
        setMode("edit");
      } else {
        // From the start screen: a new project with a stat card.
        const p = makeFromTemplate("blank", "card");
        p.name = vehicle.name;
        p.pages[0].bg = { ...p.pages[0].bg, type: "gradient", colors: ["#1f2937", "#0b0c12"], angle: 160 };
        p.pages[0].elements = statCard(vehicle, p.canvas);
        loadProject(p, { preview: false });
        savedRef.current = null;
      }
      setWorkshop(null);
    },
    [workshop, editor, insertVehicle, loadProject],
  );

  /** A hit-camera shot or photo from the Workshop goes onto the canvas (a new project when opened from Home). */
  const addWorkshopPicture = useCallback(
    async (data, name) => {
      const w = workshop;
      if (!w) return;
      const { w: iw, h: ih } = await imageSize(data);
      const fresh = w.context === "browse";
      if (fresh) {
        await flush({ thumb: true });
        const p = makeFromTemplate("blank", "card");
        p.name = `${w.vehicle.name} – ${name}`;
        editor.load(p);
        savedRef.current = null;
        libRef.current.projectId = null;
        setProjectId(null);
        setFile({ path: null, name: null });
        setWorkshop((x) => ({ ...x, context: "insert", back: "edit" }));
      }
      editor.withAsset("image", data, name, (p, id) => {
        const c = p.canvas;
        const k = Math.min((c.w * 0.86) / iw, (c.h * 0.86) / ih, 1);
        const ew = Math.round(iw * k);
        const eh = Math.round(ih * k);
        const el = createElement("image", c, { asset: id, w: ew, h: eh, x: Math.round((c.w - ew) / 2), y: Math.round((c.h - eh) / 2), name, fit: "contain", radius: 18 });
        return editor.pageUpdater((pg) => ({ ...pg, elements: [...pg.elements, el] }))(p);
      });
      notify(fresh ? `Started a new project with it – it's there when you leave the Workshop` : `Added to your canvas`, "success");
    },
    [workshop, flush, editor, notify],
  );

  // --- keyboard -----------------------------------------------------------------
  const keyRef = useRef();
  keyRef.current = { mode, save, openDialog, newProject, editor, selection, selected, copy, paste, exportPng, canvasRef, setGrid };
  useEffect(() => {
    const onKey = (e) => {
      const k = keyRef.current;
      const typing = e.target.closest?.("input, textarea, select, [contenteditable=true]");
      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const run = (fn) => {
        e.preventDefault();
        fn();
      };
      if (k.mode === "workshop") return;
      if (e.key === "F5" && k.mode !== "home") return run(() => setMode((m) => (m === "edit" ? "preview" : "edit")));
      if (ctrl && key === "k") return run(() => setPalette((p) => !p));
      if (e.key === "F1" || (e.key === "?" && !typing)) return run(() => setShortcuts(true));
      if (ctrl) {
        if (key === "s" && k.mode !== "home") return run(() => k.save({ saveAs: e.shiftKey }));
        if (key === "o") return run(k.openDialog);
        if (key === "n") return run(k.newProject);
      }
      if (k.mode !== "edit" || typing) return;
      const ids = k.selection.map((x) => x.id);
      const ed = k.editor;
      if (ctrl) {
        if (key === "z" && !e.shiftKey) return run(ed.undo);
        if (key === "y" || (key === "z" && e.shiftKey)) return run(ed.redo);
        if (key === "a") return run(() => ed.select(ed.page.elements.map((x) => x.id), { deep: true }));
        if (key === "e") return run(k.exportPng);
        if (key === "'") return run(() => k.setGrid((g) => ({ ...g, show: !g.show })));
        if (key === "0") return run(() => k.canvasRef.current?.zoomActual());
        if (key === "=" || key === "+") return run(() => k.canvasRef.current?.zoomIn());
        if (key === "-") return run(() => k.canvasRef.current?.zoomOut());
        if (key === "v") return run(k.paste);
        if (!ids.length) return;
        if (key === "d") return run(() => ed.duplicateElements(ids));
        if (key === "c") return run(() => k.copy());
        if (key === "x") return run(() => k.copy(true));
        if (key === "g") return run(() => (e.shiftKey ? ed.ungroup(ids) : ed.group(ids)));
        if (key === "l") return run(() => ed.updateElements(ids, (x) => ({ ...x, locked: !k.selection.every((s) => s.locked) }), { step: true }));
        if (key === "h") return run(() => ed.updateElements(ids, (x) => ({ ...x, hidden: !k.selection.every((s) => s.hidden) }), { step: true }));
        if (e.key === "]") return run(() => ed.moveLayers(ids, "front"));
        if (e.key === "[") return run(() => ed.moveLayers(ids, "back"));
        return;
      }
      if (e.shiftKey && key === "h" && ids.length) return run(() => ed.mirror(ids, "x"));
      if (e.shiftKey && key === "v" && ids.length) return run(() => ed.mirror(ids, "y"));
      if (e.shiftKey && e.key === "!") return run(() => k.canvasRef.current?.zoomFit());
      if (e.shiftKey && e.key === "@") return run(() => k.canvasRef.current?.zoomToSelection());
      if (!ids.length) return;
      if (e.key === "Delete" || e.key === "Backspace") return run(() => ed.removeElements(ids));
      if (e.key === "Escape") return run(() => ed.select(null));
      if (e.key === "Enter" && k.selected && ["text", "button", "sticker"].includes(k.selected.type)) return run(() => k.canvasRef.current?.startEditing(k.selected.id));
      if (e.key === "]") return run(() => ed.moveLayers(ids, 1));
      if (e.key === "[") return run(() => ed.moveLayers(ids, -1));
      const step = e.shiftKey ? 10 : 1;
      const nudge = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (nudge) run(() => ed.updateElements(ids, (x) => (x.locked ? x : { ...x, x: x.x + nudge[0], y: x.y + nudge[1] })));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const closeWindow = useCallback(async () => {
    await flush();
    native.appWindow.close();
  }, [flush]);

  const commitText = useCallback(
    (el, value) => {
      if (el.type === "text") editor.updateElement(el.id, { text: value });
      else if (el.type === "button") editor.updateElement(el.id, { label: value });
      else if (el.type === "sticker" && value.trim()) editor.updateElement(el.id, { emoji: value.trim().slice(0, 16) });
    },
    [editor],
  );

  const app = { setExportMotion, setShowHistory, goHome, editor, project, page, selection, mode, setMode, grid, setGrid, rulers, setRulers, animate, setAnimate, canvasRef, copy, paste, save, openDialog, newProject, exportPng, exportHtml, onAdd, setShortcuts, setVehiclePicker, openWorkshop, notify };
  const commands = buildCommands(app);

  const vehiclePanel = (el, set) => (
    <VehiclePanel el={el} set={set} onOpen={() => openWorkshop(el.vehicle, "edit", el.id)} onCard={() => editor.insertElements(statCard(el.vehicle, project.canvas))} />
  );

  return (
    <div className="relative flex h-full flex-col">
      <TitleBar
        mode={mode}
        fileName={mode === "home" ? "" : mode === "workshop" ? "Vehicle Workshop" : project.name}
        saveState={mode === "edit" || mode === "preview" ? (dirty && saveState === "saved" ? "pending" : saveState) : null}
        filePath={file.path}
        onHome={mode === "home" ? null : () => (mode === "workshop" ? (setWorkshop(null), setHomeTab("workshop"), setMode("home")) : goHome())}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onNew={newProject}
        onOpen={openDialog}
        onSave={() => save()}
        onClose={closeWindow}
        onPalette={() => setPalette(true)}
        onPreview={() => {
          setPreviewPage(pageIndex);
          setMode("preview");
        }}
        onEdit={() => setMode("edit")}
        uiMode={uiMode}
        onUiMode={setUiMode}
        settings={{
          backdrop,
          backdropApplied,
          onBackdrop: setBackdropPref,
          minimizeToTray,
          onMinimizeToTray: setMinimizeToTrayState,
        }}
      />

      {mode === "home" && (
        <Home
          tab={homeTab}
          onTab={setHomeTab}
          library={library}
          hangar={hangar}
          onOpenProject={openFromLibrary}
          onCreate={createFromTemplate}
          onImport={openDialog}
          onWorkshop={(v) => openWorkshop(v, "browse")}
          onRandomTank={(e) => openWorkshop(randomVehicle(!!e?.shiftKey), "browse")}
          onConfirmDelete={(name) => native.ask(`Delete “${name}”? This can't be undone.`, { okLabel: "Delete", cancelLabel: "Keep it" })}
        />
      )}

      {mode === "workshop" && workshop && (
        <Workshop
          initial={workshop.vehicle}
          context={workshop.context}
          hangar={hangar}
          notify={notify}
          onDone={finishWorkshop}
          onAddPicture={addWorkshopPicture}
          onClose={() => {
            setMode(workshop.back === "workshop" ? "home" : workshop.back);
            setWorkshop(null);
          }}
        />
      )}

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
        <UiModeContext.Provider value={uiMode}>
        <div className="flex min-h-0 flex-1 gap-2 px-2 pb-2">
          <LeftPanel
            page={page}
            selectedIds={selectedIds}
            onAdd={onAdd}
            onAddSticker={(emoji) => editor.addElement("sticker", { emoji, name: `Sticker ${emoji}` })}
            onAddImageSticker={(url, name) => addPicture(url, name)}
            onSelect={editor.select}
            onToggle={(id, key) => editor.updateElement(id, (e) => ({ ...e, [key]: !e[key] }), { step: true })}
            onReorder={editor.reorderLayers}
            onRename={(id, name) => editor.updateElement(id, { name }, { step: true })}
            onContextMenu={(m) => setMenu({ x: m.clientX, y: m.clientY, id: m.id })}
            onUngroup={editor.ungroup}
          />
          <main className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="glass-chrome relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
              <Canvas
                ref={canvasRef}
                project={project}
                pageIndex={pageIndex}
                selectedIds={selectedIds}
                onSelect={editor.select}
                onUpdate={(ids, fn, opts) => editor.updateElements(ids, fn, opts)}
                onDuplicate={(ids) => editor.duplicateElements(ids)}
                onCommitText={commitText}
                onContextMenu={(m) => setMenu({ x: m.clientX, y: m.clientY, id: m.id })}
                onGuides={(guides) => editor.updatePage({ guides })}
                animate={animate}
                dropTarget={dropTarget}
                grid={pro ? grid : { ...grid, show: false, snap: false }}
                rulers={pro && rulers}
              />
              {showHistory && <HistoryPanel editor={editor} onClose={() => setShowHistory(false)} />}
              <CanvasToolbar showHistory={showHistory} setShowHistory={setShowHistory} pro={pro} grid={grid} setGrid={setGrid} rulers={rulers} setRulers={setRulers} animate={animate} setAnimate={setAnimate} onPalette={() => setPalette(true)} />
            </div>
            <BottomBar
              project={project}
              pageIndex={pageIndex}
              onGoTo={editor.goToPage}
              onAddPage={editor.addPage}
              onDuplicatePage={editor.duplicatePage}
              onRemovePage={editor.removePage}
              onMovePage={editor.movePage}
              onSave={() => save({ saveAs: !file.path })}
              onExportPng={exportPng}
              onExportHtml={exportHtml}
              onExportMotion={() => setExportMotion(true)}
              busy={busy}
            />
          </main>
          <Inspector
            project={project}
            page={page}
            pageIndex={pageIndex}
            selected={selected}
            selection={selection}
            update={(id, patch) => editor.updateElement(id, patch)}
            remove={editor.removeElement}
            duplicate={editor.duplicateElement}
            updateMany={editor.updateElements}
            removeMany={editor.removeElements}
            duplicateMany={editor.duplicateElements}
            align={editor.align}
            distribute={editor.distribute}
            mirror={editor.mirror}
            group={editor.group}
            ungroup={editor.ungroup}
            vehiclePanel={vehiclePanel}
            updatePage={editor.updatePage}
            setProject={editor.setProject}
            editPicture={(elId, tab) => setPictureTools({ elId, tab })}
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
        </UiModeContext.Provider>
      )}

      {menu && mode === "edit" && <ContextMenu x={menu.x} y={menu.y} items={contextItems(app, menu.id)} onClose={() => setMenu(null)} />}
      {palette && <CommandPalette commands={commands} onClose={() => setPalette(false)} />}
      {shortcuts && <ShortcutsDialog onClose={() => setShortcuts(false)} />}
      {exportMotion && <ExportMotion project={project} pageIndex={pageIndex} fileName={safeFileName(project.name)} notify={notify} onClose={() => setExportMotion(false)} />}
      {pictureTools && (() => {
        const el = page.elements.find((e) => e.id === pictureTools.elId);
        const a = el?.asset && project.assets[el.asset];
        if (!a) return null;
        return (
          <PictureTools
            key={el.asset}
            src={a.data}
            name={a.name}
            aspect={el.w / el.h}
            initialTab={pictureTools.tab}
            hasOriginal={!!el.original}
            onClose={() => setPictureTools(null)}
            onRestore={() => {
              editor.updateElement(el.id, { asset: el.original, original: null }, { step: true });
              setPictureTools(null);
            }}
            onApply={(data, extra) => {
              applyPicture(el.id, data, extra);
              setPictureTools(null);
              notify("Done – Ctrl+Z undoes it", "success");
            }}
          />
        );
      })()}
      {vehiclePicker && (
        <VehiclePicker
          hangar={hangar}
          onClose={() => setVehiclePicker(false)}
          onPick={(v, card) => {
            setVehiclePicker(false);
            insertVehicle(v, card);
          }}
          onBuild={() => {
            setVehiclePicker(false);
            openWorkshop(createVehicle("tank", { name: "My tank" }), "insert");
          }}
        />
      )}

      {update && <UpdateGate info={update} />}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex justify-center">
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

function ToolToggle({ on, onClick, label, Icon, testid }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} title={label} aria-label={label} data-testid={testid} className={`press grid size-8 place-items-center rounded-lg ${on ? "bg-accent/25 text-white" : "text-muted hover:bg-white/10 hover:text-ink"}`}>
      <Icon size={15} />
    </button>
  );
}

function CanvasToolbar({ showHistory, setShowHistory, pro, grid, setGrid, rulers, setRulers, animate, setAnimate, onPalette }) {
  return (
    <div className={`glass-float absolute ${pro ? "top-7" : "top-3"} right-3 flex items-center gap-0.5 rounded-xl p-0.5`}>
      {pro && <>
      <ToolToggle on={grid.show} onClick={() => setGrid((g) => ({ ...g, show: !g.show }))} label="Show grid (Ctrl+')" Icon={Grid3x3} testid="toggle-grid" />
      <ToolToggle on={grid.snap} onClick={() => setGrid((g) => ({ ...g, snap: !g.snap }))} label="Snap to grid" Icon={Magnet} testid="toggle-snap" />
      <ToolToggle on={rulers} onClick={() => setRulers((r) => !r)} label="Rulers & guides" Icon={Ruler} testid="toggle-rulers" />
      </>}
      <ToolToggle on={showHistory} onClick={() => setShowHistory((h) => !h)} label="History: jump back to any change" Icon={History} testid="toggle-history" />
      <ToolToggle on={animate} onClick={() => setAnimate((a) => !a)} label="Play animations while editing" Icon={animate ? Pause : Play} testid="toggle-anim" />
      <span className="mx-0.5 h-4 w-px bg-white/10" />
      <button type="button" onClick={onPalette} className="press flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-muted hover:bg-white/10 hover:text-ink">
        <Command size={13} /> <kbd className="kbd-hint">Ctrl K</kbd>
      </button>
    </div>
  );
}

function VehiclePanel({ el, set, onOpen, onCard }) {
  return (
    <Section icon="🪖" title="Vehicle" hint="A live 3D model: it moves in Preview">
      <button type="button" onClick={onOpen} className="press focus-ring flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-2 px-3 py-2 text-[12.5px] font-semibold text-[#0b0c12]">
        <Wrench size={14} /> Open in Workshop
      </button>
      <Segmented label="View" value={el.view} onChange={(view) => set({ view })} options={[{ id: "normal", label: "Normal" }, { id: "armor", label: "Armour" }, { id: "xray", label: "X-ray" }]} />
      <Slider label="Turn" value={el.yaw} min={-180} max={180} onChange={(yaw) => set({ yaw })} format={(v) => `${Math.round(v)}°`} />
      <Slider label="Camera height" value={el.pitch} min={-5} max={60} onChange={(pitch) => set({ pitch })} format={(v) => `${Math.round(v)}°`} />
      <Slider label="Zoom" value={el.zoom} min={0.5} max={2.5} step={0.05} onChange={(zoom) => set({ zoom })} format={(v) => `${v.toFixed(2)}×`} />
      <Toggle label="Animate" hint="Tracks roll, turret scans, gun fires" checked={el.animate} onChange={(animate) => set({ animate })} />
      <Toggle label="Turntable" hint="Slowly spins around" checked={el.spin} onChange={(spin) => set({ spin })} />
      <Toggle label="Ground shadow" checked={el.ground} onChange={(ground) => set({ ground })} />
      <button type="button" onClick={onCard} className="chip-btn">
        Add a stat card for it
      </button>
      <p className="text-[11px] text-muted">Tip: give a button the “Vehicle view” action to flip between normal, armour and X-ray in Preview.</p>
    </Section>
  );
}

function VehiclePicker({ hangar, onPick, onClose, onBuild }) {
  const [tab, setTab] = useState("presets");
  const [card, setCard] = useState(false);
  return (
    <>
      <Gallery kind={tab} hangar={hangar} onPick={(v) => onPick(v, card)} onClose={onClose} title={tab === "presets" ? "Add a vehicle" : "Add from your hangar"} />
      <div className="fixed top-[calc(7vh+4px)] left-1/2 z-[71] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-[#14151f] p-1.5 ring-1 ring-white/10">
        <Segmented label="Source" value={tab} onChange={setTab} options={[{ id: "presets", label: "Presets" }, { id: "hangar", label: `Hangar (${hangar.list.length})` }]} />
        <Toggle label="As a stat card" checked={card} onChange={setCard} />
        <button type="button" onClick={onBuild} className="chip-btn">
          <Wrench size={14} /> Build your own
        </button>
      </div>
    </>
  );
}
