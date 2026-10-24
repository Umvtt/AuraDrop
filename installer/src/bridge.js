// Bridge to the setup backend. Outside Tauri (browser dev and UI tests) it
// uses a scripted mock chosen with `?mock=<scenario>`.

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function tauriInvoke(cmd, args) {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke(cmd, args);
}

export async function onProgress(cb) {
  if (!isTauri) return mock.onProgress(cb);
  const { listen } = await import("@tauri-apps/api/event");
  return listen("setup-progress", (e) => cb(e.payload.step));
}

export async function onCloseBlocked(cb) {
  if (!isTauri) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  return listen("close-blocked", () => cb());
}

export const api = {
  getInfo: () => (isTauri ? tauriInvoke("get_info") : mock.getInfo()),
  isAppRunning: () => (isTauri ? tauriInvoke("is_app_running") : mock.isAppRunning()),
  chooseDir: (picked) => (isTauri ? tauriInvoke("choose_dir", { picked }) : mock.chooseDir(picked)),
  validateDir: (dir) => (isTauri ? tauriInvoke("validate_dir", { dir }) : Promise.resolve()),
  install: (options) => (isTauri ? tauriInvoke("install", { options }) : mock.install(options)),
  uninstall: () => (isTauri ? tauriInvoke("uninstall") : mock.uninstall()),
  launchApp: (exe) => (isTauri ? tauriInvoke("launch_app", { exe }) : mock.launch(exe)),
  quit: () => (isTauri ? tauriInvoke("quit") : mock.quit()),
  async pickFolder(defaultPath) {
    if (!isTauri) return mock.pickFolder();
    const { open } = await import("@tauri-apps/plugin-dialog");
    return open({ directory: true, multiple: false, defaultPath, title: "Choose where to install AuraDrop" });
  },
  async minimize() {
    if (!isTauri) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    getCurrentWindow().minimize();
  },
};

// ---------------------------------------------------------------------------
// Mock backend
// ---------------------------------------------------------------------------

const scenario = typeof location !== "undefined" ? new URLSearchParams(location.search).get("mock") || "fresh" : "fresh";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const listeners = new Set();
let running = scenario === "running";

const mock = {
  log: [],
  onProgress(cb) {
    listeners.add(cb);
    return Promise.resolve(() => listeners.delete(cb));
  },
  emit(step) {
    listeners.forEach((cb) => cb(step));
  },
  async getInfo() {
    await wait(150);
    const installed =
      scenario === "installed" ? { version: "0.1.0", location: "C:\\Users\\Kid\\AppData\\Local\\AuraDrop" }
      : scenario === "update" ? { version: "0.0.9", location: "D:\\Apps\\AuraDrop" }
      : scenario === "downgrade" ? { version: "0.2.0", location: "C:\\Users\\Kid\\AppData\\Local\\AuraDrop" }
      : null;
    const mode = { installed: "reinstall", update: "update", downgrade: "downgrade" }[scenario] ?? "fresh";
    return {
      version: "0.1.0",
      installed,
      mode,
      defaultDir: installed?.location ?? "C:\\Users\\Kid\\AppData\\Local\\AuraDrop",
      sizeBytes: 4_181_504,
      appRunning: running,
      hasPayload: scenario !== "nopayload",
      autostartEnabled: scenario === "update",
    };
  },
  async isAppRunning() {
    await wait(100);
    return running;
  },
  async pickFolder() {
    return scenario === "badfolder" ? "C:\\Program Files" : "D:\\Games";
  },
  async chooseDir(picked) {
    await wait(100);
    if (picked.startsWith("C:\\Program Files")) {
      throw "AuraDrop can't install into C:\\Program Files\\AuraDrop without administrator rights. Pick a folder in your own user profile.";
    }
    return `${picked}\\AuraDrop`;
  },
  async install(options) {
    mock.log.push(["install", options]);
    running = false;
    for (const step of ["check", "unpack", "install", "verify"]) {
      mock.emit(step);
      await wait(step === "install" ? 900 : 300);
      if (scenario === "fail-install" && step === "install") {
        throw {
          step: "install",
          message: "The installer stopped early. Make sure AuraDrop is closed and try again.",
          detail: 'installer exit code 2; args ["/S", "/D=C:\\\\x"]',
        };
      }
    }
    return { dir: options.dir, exe: `${options.dir}\\auradrop.exe`, version: "0.1.0" };
  },
  async uninstall() {
    mock.log.push(["uninstall"]);
    running = false;
    for (const step of ["check", "remove", "verify"]) {
      mock.emit(step);
      await wait(300);
    }
  },
  async launch(exe) {
    mock.log.push(["launch", exe]);
  },
  async quit() {
    mock.log.push(["quit"]);
    document.body.dataset.quit = "1";
  },
  stopApp() {
    running = false;
  },
};

if (!isTauri && typeof window !== "undefined") window.__setupMock = mock;
