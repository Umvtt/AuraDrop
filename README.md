# AuraDrop

A playful glassmorphic UI builder for Windows. Design a frosted-glass card with a live 3D tilt, mesh-gradient aura and one-click animations, then copy it out as CSS, HTML or Tailwind, or export a PNG.

Built with **Tauri v2**, **Rust**, **React 19** and **Tailwind CSS v4**.

## Features (Phase 1)

- **Frameless glass window** with Windows 11 **Mica**, falling back to **Acrylic** and then a solid background. Switch it under ⚙ Settings.
- **Custom title bar** with drag region, double-click to maximize, and glass minimize/maximize/close buttons.
- **System tray**: left-click to show/hide, plus a menu with *Show*, *Minimize to tray* and *Quit*. Minimizing hides to the tray (toggleable).
- **Live stage** with spring-physics 3D tilt and a glare that follows the cursor.
- **Magic Studio** with Frostiness, Glass Shine, Squish & Shape, Color & Aura (draggable mesh points, angle wheel, blend styles, drifting orbs), Vibes, 3D Tilt and Card Content.
- **Starter looks**, **Surprise me** and undo/redo.
- **Export hub**: copy CSS / HTML / Tailwind to the clipboard, peek at the code, and export a 2× PNG with or without the background.
- **Files**: save/open `.auradrop` designs (Ctrl+S / Ctrl+Shift+S / Ctrl+O / Ctrl+N). Drop images from Explorer onto the card or avatar, and drop `.auradrop` files to open them. The installer registers the `.auradrop` file type.

The live preview is rendered with the same CSS the export hub generates, so what you copy is what you saw.

## Prerequisites (Windows)

1. [Node.js](https://nodejs.org/) 20+
2. [Rust](https://rustup.rs/) (MSVC toolchain)
3. Microsoft C++ Build Tools ("Desktop development with C++")
4. WebView2. It's preinstalled on Windows 11.

See <https://v2.tauri.app/start/prerequisites/>.

## Run

```powershell
npm install
npm run tauri dev        # desktop app with hot reload
npm run installer:build  # glass installer -> dist-installer/AuraDrop-Setup-<version>.exe
npm run installer:dev    # work on the installer UI (needs a built payload to install)
```

The repo holds two Tauri projects, the app (`src-tauri`) and its installer (`installer/src-tauri`), so `npm run tauri …` always targets the app explicitly (see `scripts/tauri.mjs`).

`npm run dev` runs the UI in a normal browser. Native features fall back to browser equivalents there: downloads instead of save dialogs, HTML5 drag-and-drop, and no window material.

```powershell
npm test               # unit tests (design files, code generation, tilt physics)
```

## Installer

`AuraDrop-Setup.exe` is a small frameless glass app, built with the same design as AuraDrop. The actual installation is done by AuraDrop's standard NSIS installer, which is embedded in it and runs silently. That installer also provides the uninstaller and the Add/Remove Programs entry.

- **Pages:** Welcome, Options, Installing (live steps), Done. It also handles Update, Reinstall, Uninstall, "AuraDrop is open" and error screens with copyable details.
- **Options:** install folder, desktop shortcut, open `.auradrop` files with AuraDrop, start with Windows (hidden in the tray), and open when finished. A Start menu shortcut is always added.
- **Per user:** installs into `%LOCALAPPDATA%\AuraDrop` with no administrator prompt.
- **Safety:**
  - The embedded installer is checked against its SHA-256 before it runs.
  - Every install is verified afterwards (the files and the registry entry), not just its exit code.
  - The window can't be closed mid-install.
  - Moving to a new folder removes the old copy first.
- **Dependencies:** the only runtime dependency is Microsoft Edge WebView2, which Windows 11 and current Windows 10 already have. The Visual C++ runtime is built into the exe. If WebView2 is missing, setup can't draw its glass window, so it opens the classic installer instead. That installer downloads WebView2 (needs internet) and then installs AuraDrop.
- **Unattended installs:**

  ```powershell
  Start-Process AuraDrop-Setup.exe -Wait -ArgumentList '--silent --no-desktop --autostart'
  AuraDrop-Setup.exe --help   # all options; exit codes 0 ok, 1 bad arguments, 2 failed
  ```

On Linux, `npm run installer:build` cross-compiles with `cargo-xwin` and `makensis`. A native Linux build of the installer drives the real Windows installer through Wine, which is how the installer was tested end to end.

## Fonts

Inter (UI and cards) and JetBrains Mono (code) are bundled with both apps, so text looks the same on every PC. The PNG export uses the same Inter, and exported CSS/HTML/Tailwind load Inter from Google Fonts so pasted code matches the preview.

## Project layout

```
src-tauri/
  tauri.conf.json         frameless transparent window, tray icon, CSP, bundle + file association
  capabilities/default.json  permissions for window, dialog, fs, clipboard
  src/lib.rs              Mica/Acrylic, tray, minimize-to-tray, single instance, file commands
src/
  App.jsx                 app shell: files, drag & drop, shortcuts, settings, toasts
  components/             TitleBar, Stage, Inspector (Magic Studio), ExportBar, controls
  hooks/useTilt.js        rAF spring loop for tilt + glare
  hooks/useHistory.js     undo/redo with gesture coalescing
  lib/design.js           design model, presets, .auradrop parsing/validation
  lib/codegen.js          CSS / HTML / Tailwind generators (also drive the live preview)
  lib/renderPng.js        canvas renderer for PNG export
  lib/native.js           Tauri bridge with browser fallbacks
src-tauri/nsis/           installer hooks (association, autostart) and artwork
installer/
  src/Setup.jsx           glass installer UI
  src-tauri/src/setup.rs  install/uninstall pipeline (shared by UI and --silent)
  src-tauri/src/system.rs registry, processes, Wine harness
scripts/build-installer.mjs  builds the payload, then the setup exe
```

## Notes

- **PNG export** repaints the card on a canvas, because DOM-capture libraries can't render `backdrop-filter`. It's a static frame (no animation, no tilt).
- **Exported code** references images as `aura-background.png` / `aura-avatar.png` instead of embedding megabytes of base64.
- **Phase 2** (not built yet): multi-element layouts, WebM/GIF capture, launch at startup.
