// Bridge to the Tauri shell. Every function has a browser fallback so the UI
// can be developed and tested with plain `npm run dev`.

import { FILE_EXTENSION } from "./design.js";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const tauri = isTauri
  ? {
      core: () => import("@tauri-apps/api/core"),
      window: () => import("@tauri-apps/api/window"),
      webview: () => import("@tauri-apps/api/webview"),
      event: () => import("@tauri-apps/api/event"),
      dialog: () => import("@tauri-apps/plugin-dialog"),
      fs: () => import("@tauri-apps/plugin-fs"),
      clipboard: () => import("@tauri-apps/plugin-clipboard-manager"),
    }
  : null;

async function invoke(cmd, args) {
  const { invoke } = await tauri.core();
  return invoke(cmd, args);
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

export const appWindow = {
  async minimize() {
    if (isTauri) (await tauri.window()).getCurrentWindow().minimize();
  },
  async toggleMaximize() {
    if (isTauri) (await tauri.window()).getCurrentWindow().toggleMaximize();
  },
  async close() {
    if (isTauri) (await tauri.window()).getCurrentWindow().close();
    else window.close();
  },
  async hideToTray() {
    if (isTauri) await invoke("hide_to_tray");
  },
  async isMaximized() {
    return isTauri ? (await tauri.window()).getCurrentWindow().isMaximized() : false;
  },
  /** Calls `cb(isMaximized)` whenever the window is resized. Returns unlisten. */
  async onResized(cb) {
    if (!isTauri) return () => {};
    const w = (await tauri.window()).getCurrentWindow();
    return w.onResized(async () => cb(await w.isMaximized()));
  },
};

/** "mica" | "acrylic" | "none" – returns the material that actually applied. */
export async function setBackdrop(kind) {
  return isTauri ? invoke("set_backdrop", { kind }) : "none";
}

export async function getPrefs() {
  return isTauri ? invoke("get_prefs") : { minimizeToTray: false };
}

export async function setMinimizeToTray(enabled) {
  if (isTauri) await invoke("set_minimize_to_tray", { enabled });
}

export async function listen(event, cb) {
  if (!isTauri) return () => {};
  const { listen } = await tauri.event();
  return listen(event, (e) => cb(e.payload));
}

export async function takeLaunchFile() {
  return isTauri ? invoke("take_launch_file") : null;
}

/** Yes/no question. Uses the native Windows dialog inside Tauri. */
export async function ask(message, { title = "AuraDrop", okLabel = "Yes", cancelLabel = "Cancel" } = {}) {
  if (isTauri) {
    const { ask } = await tauri.dialog();
    return ask(message, { title, kind: "warning", okLabel, cancelLabel });
  }
  return window.confirm(message);
}

// ---------------------------------------------------------------------------
// Clipboard
// ---------------------------------------------------------------------------

export async function copyText(text) {
  if (isTauri) {
    const { writeText } = await tauri.clipboard();
    return writeText(text);
  }
  return navigator.clipboard.writeText(text);
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

const DESIGN_FILTER = { name: "AuraDrop design", extensions: [FILE_EXTENSION] };
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "avif"];

/** Ask for a save location and write text. Returns the path (or name) or null if cancelled. */
export async function saveDesignAs(text, suggestedName) {
  if (isTauri) {
    const { save } = await tauri.dialog();
    const path = await save({ defaultPath: suggestedName, filters: [DESIGN_FILTER] });
    if (!path) return null;
    const { writeTextFile } = await tauri.fs();
    await writeTextFile(path, text);
    return path;
  }
  download(new Blob([text], { type: "application/json" }), suggestedName);
  return suggestedName;
}

/** Overwrite a file that was opened or saved earlier (path came from a dialog). */
export async function saveDesignTo(path, text) {
  const { writeTextFile } = await tauri.fs();
  await writeTextFile(path, text);
}

/** Returns { path, text } or null if cancelled. */
export async function openDesign() {
  if (isTauri) {
    const { open } = await tauri.dialog();
    const path = await open({ multiple: false, directory: false, filters: [DESIGN_FILTER] });
    if (!path) return null;
    const { readTextFile } = await tauri.fs();
    return { path, text: await readTextFile(path) };
  }
  const file = await pickFile(`.${FILE_EXTENSION},application/json`);
  return file ? { path: null, name: file.name, text: await file.text() } : null;
}

/** Read a design whose path came from the OS (file association / drop). */
export async function readDesignPath(path) {
  return invoke("read_design_file", { path });
}

/** Pick an image and return it as a data URL, or null if cancelled. */
export async function pickImage() {
  if (isTauri) {
    const { open } = await tauri.dialog();
    const path = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "Images", extensions: IMAGE_EXTENSIONS }],
    });
    return path ? readImagePath(path) : null;
  }
  const file = await pickFile("image/*");
  return file ? fileToDataUrl(file) : null;
}

export async function readImagePath(path) {
  return invoke("read_image_file", { path });
}

export function isImagePath(path) {
  const ext = path.split(".").pop()?.toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

export function isDesignPath(path) {
  return path.toLowerCase().endsWith(`.${FILE_EXTENSION}`);
}

/** Save PNG bytes. Returns the path (or name) or null if cancelled. */
export async function savePng(bytes, suggestedName) {
  if (isTauri) {
    const { save } = await tauri.dialog();
    const path = await save({
      defaultPath: suggestedName,
      filters: [{ name: "PNG image", extensions: ["png"] }],
    });
    if (!path) return null;
    const { writeFile } = await tauri.fs();
    await writeFile(path, bytes);
    return path;
  }
  download(new Blob([bytes], { type: "image/png" }), suggestedName);
  return suggestedName;
}

/**
 * Subscribe to OS file drops. `handlers.over(x, y)` fires while hovering
 * (CSS pixels), `handlers.drop(paths, x, y)` on drop, `handlers.leave()` when
 * the drag leaves. Only used inside Tauri – the browser uses HTML5 events.
 */
export async function onNativeDragDrop(handlers) {
  if (!isTauri) return () => {};
  const { getCurrentWebview } = await tauri.webview();
  return getCurrentWebview().onDragDropEvent((event) => {
    const p = event.payload;
    const dpr = window.devicePixelRatio || 1;
    const x = p.position ? p.position.x / dpr : 0;
    const y = p.position ? p.position.y / dpr : 0;
    if (p.type === "enter" || p.type === "over") handlers.over(x, y);
    else if (p.type === "drop") handlers.drop(p.paths, x, y);
    else handlers.leave();
  });
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function baseName(path) {
  return path ? path.split(/[\\/]/).pop() : null;
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}
