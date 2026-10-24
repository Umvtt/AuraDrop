# AuraDrop

A meme maker and interactive canvas for Windows, with a glassy look. Put pictures, meme captions, stickers, shapes, glass panels and buttons on a canvas. Make the buttons *do* things (open links, play sounds, confetti, popups, jump between pages), then share it as a `.auradrop` file, a PNG or a web page that works in any browser.

Built with **Tauri v2**, **Rust**, **React 19** and **Tailwind CSS v4**.

## Features

- **Templates:** classic meme, two-panel, reaction, soundboard, link hub, quiz, glass card or a blank canvas, in sizes from square posts to phone stories.
- **Layers:**
  - Text and meme captions, with 11 bundled fonts, outlines, shadows and highlight boxes.
  - Pictures and GIFs, with fit, corners, borders, flips and filters (incl. "deep fry").
  - Emoji stickers.
  - Shapes: box, circle, triangle, star, heart, speech bubble and arrow, with solid or gradient fill.
  - Frosted glass panels with an aura tint and 3D tilt.
  - Buttons in glass, gradient, solid or outline style.
- **Editing:** drag, resize and rotate on the canvas, with snap guides. Double-click text to type, plus zoom, undo/redo, copy/paste, layer order, lock, and "hide at start".
- **Button actions (any layer can have them):** open a link (people are asked first), play a sound, confetti, shake the screen, show a popup, show or hide another layer, and go to a page.
- **Pages:** build quizzes and stories. Each page has its own background (aura orbs, gradient, solid or picture) and a transition.
- **Animations:** float, pulse, bounce, wiggle, shake, spin, swing, pop-in and slide-in, each with its own speed and delay.
- **Preview:** shows the project with working buttons. Opening a `.auradrop` file starts in Preview; ✏️ **Edit** switches to the editor (F5 toggles).
- **Save & export:** **Save .auradrop**, **Export PNG** (the current page, including real glass blur) and **Web page** (one self-contained `.html` file with images, sounds and fonts, buttons included).
- **Drag-and-drop:**
  - Drop pictures onto the canvas, or onto an image layer to replace it.
  - Drop sounds to make a sound button, or onto a layer to make it play the sound.
  - Drop a `.auradrop` file to open it.
- **Updates:** AuraDrop checks GitHub Releases and shows a required-update screen with one-click update. If it can't check (offline), it never locks you out.
- **Windows integration:** Mica/Acrylic window, system tray, start with Windows (hidden in the tray), and `.auradrop` file association.
- **Old files:** `.auradrop` files from 0.1 (single glass cards) open automatically.

## Releasing an update

1. Bump `version` in `src-tauri/tauri.conf.json` (and `package.json`), and describe the changes in `RELEASE_NOTES.md`. The update screen shows these notes.
2. Push to GitHub, then open **Actions → Release → Run workflow** and tick **publish**.

The workflow builds the installer on Windows and runs the tests. It installs, updates and uninstalls on a real Windows machine, then publishes the release. Every installed AuraDrop 0.2+ then shows the required update.

## Develop

```powershell
npm install
npm run tauri dev        # app with hot reload
npm run installer:build  # glass installer -> dist-installer/AuraDrop-Setup-<version>.exe
npm run installer:dev    # work on the installer UI
npm test                 # unit tests
```

Prerequisites: Node.js 20+, Rust (MSVC) and the "Desktop development with C++" build tools. See <https://v2.tauri.app/start/prerequisites/>. `npm run dev` runs the UI in a browser, using browser fallbacks for native features.

The repo holds two Tauri projects, the app (`src-tauri`) and its installer (`installer/src-tauri`), so `scripts/tauri.mjs` always tells the Tauri CLI which one to use.

## Installer

`AuraDrop-Setup.exe` is a small frameless glass app. The actual installation is done by AuraDrop's standard NSIS installer, which is embedded in it and runs silently. That installer also provides the uninstaller and the Add/Remove Programs entry.

- **Pages:** Welcome, Options, Installing (live steps), Done. It also handles Update, Reinstall, Uninstall, "AuraDrop is open" and error screens.
- **Options:** install folder, desktop shortcut, `.auradrop` association, start with Windows, open when finished. A Start menu shortcut is always added.
- **Per user:** installs into `%LOCALAPPDATA%\AuraDrop`, with no administrator prompt.
- **Safety:**
  - The embedded installer is checked against its SHA-256.
  - Every install is verified afterwards (files plus registry entry).
  - The window can't be closed mid-install.
  - Moving folders removes the old copy.
- **Update mode** (`--update`, used by the app's updater): installs in place and keeps the user's shortcut, association and startup choices, then reopens AuraDrop.
- **No WebView2:** setup falls back to the classic installer, which downloads WebView2 first.
- **Unattended installs:**

  ```powershell
  Start-Process AuraDrop-Setup.exe -Wait -ArgumentList '--silent --no-desktop --autostart'
  AuraDrop-Setup.exe --help   # all options; exit codes 0 ok, 1 bad arguments, 2 failed
  ```

## Project layout

```
src/
  App.jsx                     start screen / editor / preview, files, drag & drop, shortcuts
  player/player.js            renders projects and runs button actions (no imports: it is
                              inlined into exported web pages)
  lib/project.js              project model, templates, validation, 0.1 migration
  lib/renderPng.js            PNG export (canvas renderer)
  lib/exportHtml.js           self-contained web page export
  lib/fonts.js                bundled fonts
  lib/native.js               Tauri bridge (files, links, updates) with browser fallbacks
  hooks/useEditor.js          editing operations on top of undo/redo history
  components/editor/          Canvas, LeftPanel (add + layers), Inspector, BottomBar
  components/                 TitleBar, StartScreen, Preview, UpdateGate, controls
src-tauri/
  src/lib.rs                  window material, tray, files, opener, single instance
  src/update.rs               GitHub release check, verified download, hand-off to setup
  nsis/hooks.nsh              association / autostart options, update mode
installer/                    the glass setup app (UI in src/, pipeline in src-tauri/src/)
.github/workflows/release.yml build, test on Windows and publish a release
```

## Notes

- Projects keep pictures and sounds inside the `.auradrop` file, so one file is all you need to share.
- Links from a project open only after you confirm, and only `http(s)` and `mailto` links are allowed.
- Code export (CSS/HTML/Tailwind for a single card) from 0.1 has been replaced by the web page export.
