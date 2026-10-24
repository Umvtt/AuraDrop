// Bridge to the Tauri shell. Every function has a browser fallback so the UI
// can be developed and tested with plain `npm run dev`.

import { FILE_EXTENSION } from "./project.js";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const tauri = isTauri
  ? {
      core: () => import("@tauri-apps/api/core"),
      app: () => import("@tauri-apps/api/app"),
      window: () => import("@tauri-apps/api/window"),
      webview: () => import("@tauri-apps/api/webview"),
      event: () => import("@tauri-apps/api/event"),
      dialog: () => import("@tauri-apps/plugin-dialog"),
      fs: () => import("@tauri-apps/plugin-fs"),
      clipboard: () => import("@tauri-apps/plugin-clipboard-manager"),
      opener: () => import("@tauri-apps/plugin-opener"),
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

export async function appVersion() {
  return isTauri ? (await tauri.app()).getVersion() : "dev";
}

/** Yes/no question. Uses the native Windows dialog inside Tauri. */
export async function ask(message, { title = "AuraDrop", okLabel = "Yes", cancelLabel = "Cancel" } = {}) {
  if (isTauri) {
    const { ask } = await tauri.dialog();
    return ask(message, { title, kind: "warning", okLabel, cancelLabel });
  }
  return window.confirm(message);
}

/** Open a web/mail link in the user's browser. */
export async function openUrl(url) {
  if (isTauri) return (await tauri.opener()).openUrl(url);
  window.open(url, "_blank", "noopener");
}

// ---------------------------------------------------------------------------
// Updates
// ---------------------------------------------------------------------------

/** Newer release info, or null when up to date / offline. */
export async function checkUpdate() {
  if (!isTauri) {
    const v = new URLSearchParams(location.search).get("mockUpdate");
    return v
      ? { version: v, current: "0.3.0", notes: "• New stickers\n• Faster export", pageUrl: "https://github.com/Umvtt/AuraDrop/releases", downloadUrl: "", size: 6_000_000, sha256: null }
      : null;
  }
  try {
    return await invoke("check_update");
  } catch {
    return null;
  }
}

export async function installUpdate(info) {
  if (!isTauri) {
    // Browser mock: fake a download so the screen can be tested.
    for (let i = 1; i <= 10; i++) {
      await new Promise((r) => setTimeout(r, 80));
      window.dispatchEvent(new CustomEvent("mock-update-progress", { detail: { downloaded: (info.size * i) / 10, total: info.size } }));
    }
    if (new URLSearchParams(location.search).get("mockUpdateFail")) throw "The download was interrupted: connection reset";
    return;
  }
  return invoke("install_update", { info });
}

export async function onUpdateProgress(cb) {
  if (!isTauri) {
    const h = (e) => cb(e.detail);
    window.addEventListener("mock-update-progress", h);
    return () => window.removeEventListener("mock-update-progress", h);
  }
  return listen("update-progress", cb);
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

const PROJECT_FILTER = { name: "AuraDrop project", extensions: [FILE_EXTENSION] };
export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "avif"];
export const AUDIO_EXTENSIONS = ["mp3", "wav", "ogg", "oga", "m4a", "aac", "flac", "weba"];

const extOf = (path) => path.split(".").pop()?.toLowerCase() ?? "";
export const isImagePath = (path) => IMAGE_EXTENSIONS.includes(extOf(path));
export const isAudioPath = (path) => AUDIO_EXTENSIONS.includes(extOf(path));
export const isProjectPath = (path) => extOf(path) === FILE_EXTENSION;

/** Save text/bytes through a Save dialog. Returns the path (or name), or null if cancelled. */
async function saveWithDialog(data, suggestedName, filter, mime) {
  if (isTauri) {
    const { save } = await tauri.dialog();
    const path = await save({ defaultPath: suggestedName, filters: [filter] });
    if (!path) return null;
    const fs = await tauri.fs();
    if (typeof data === "string") await fs.writeTextFile(path, data);
    else await fs.writeFile(path, data);
    return path;
  }
  download(new Blob([data], { type: mime }), suggestedName);
  return suggestedName;
}

export const saveProjectAs = (text, name) => saveWithDialog(text, name, PROJECT_FILTER, "application/json");
export const savePng = (bytes, name) => saveWithDialog(bytes, name, { name: "PNG image", extensions: ["png"] }, "image/png");
export const saveWebPage = (html, name) => saveWithDialog(html, name, { name: "Web page", extensions: ["html"] }, "text/html");

/** Overwrite a file that was opened or saved earlier. */
export async function saveProjectTo(path, text) {
  const { writeTextFile } = await tauri.fs();
  await writeTextFile(path, text);
}

/** Returns { path, name, text } or null if cancelled. */
export async function openProject() {
  if (isTauri) {
    const { open } = await tauri.dialog();
    const path = await open({ multiple: false, directory: false, filters: [PROJECT_FILTER] });
    if (!path) return null;
    const { readTextFile } = await tauri.fs();
    return { path, name: baseName(path), text: await readTextFile(path) };
  }
  const file = await pickFile(`.${FILE_EXTENSION},application/json`);
  return file ? { path: null, name: file.name, text: await file.text() } : null;
}

/** Read a project whose path came from the OS (file association / drop). */
export async function readProjectPath(path) {
  return invoke("read_design_file", { path });
}

/** Pick a picture or sound; returns { data, name } or null if cancelled. */
export async function pickMedia(kind) {
  const exts = kind === "audio" ? AUDIO_EXTENSIONS : IMAGE_EXTENSIONS;
  if (isTauri) {
    const { open } = await tauri.dialog();
    const path = await open({
      multiple: false,
      directory: false,
      filters: [{ name: kind === "audio" ? "Sounds" : "Pictures", extensions: exts }],
    });
    return path ? { data: await readMediaPath(path), name: baseName(path) } : null;
  }
  const file = await pickFile(kind === "audio" ? "audio/*" : "image/*");
  return file ? { data: await fileToDataUrl(file), name: file.name } : null;
}

export async function readMediaPath(path) {
  return invoke("read_media_file", { path });
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

// --- app storage: autosave recovery, hangar, recent files -------------------

/** Read a stored JSON value ("recovery" | "hangar" | "recent"), or null. */
export async function storeRead(key) {
  try {
    const text = isTauri ? await invoke("store_read", { key }) : localStorage.getItem(`auradrop.store.${key}`);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export async function storeWrite(key, value) {
  const text = JSON.stringify(value);
  if (isTauri) return invoke("store_write", { key, text });
  localStorage.setItem(`auradrop.store.${key}`, text);
}

export async function storeRemove(key) {
  try {
    if (isTauri) await invoke("store_remove", { key });
    else localStorage.removeItem(`auradrop.store.${key}`);
  } catch {
    // Nothing to remove.
  }
}
