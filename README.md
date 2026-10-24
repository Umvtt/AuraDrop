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
npm run tauri dev      # desktop app with hot reload
npm run tauri build    # NSIS + MSI installers in src-tauri/target/release/bundle
```

`npm run dev` runs the UI in a normal browser. Native features fall back to browser equivalents there: downloads instead of save dialogs, HTML5 drag-and-drop, and no window material.

```powershell
npm test               # unit tests (design files, code generation, tilt physics)
```

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
```

## Notes

- **PNG export** repaints the card on a canvas, because DOM-capture libraries can't render `backdrop-filter`. It's a static frame (no animation, no tilt).
- **Exported code** references images as `aura-background.png` / `aura-avatar.png` instead of embedding megabytes of base64.
- **Phase 2** (not built yet): multi-element layouts, WebM/GIF capture, launch at startup.
