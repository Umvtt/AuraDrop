//! AuraDrop native shell.
//!
//! Owns everything the webview can't do on its own: the Windows 11 backdrop
//! material, the system tray, minimize-to-tray behaviour, single-instance
//! hand-off and reading files the user drops onto the window.

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use base64::Engine;
use serde::Serialize;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow, WindowEvent, Wry};
use tauri_plugin_fs::FsExt;

const MAIN_WINDOW: &str = "main";
const TRAY_ID: &str = "main";
const DESIGN_EXT: &str = "auradrop";
/// Passed by the "start with Windows" Run entry the installer writes.
const AUTOSTART_ARG: &str = "--autostart";
const MAX_IMAGE_BYTES: u64 = 15 * 1024 * 1024;
const MAX_DESIGN_BYTES: u64 = 50 * 1024 * 1024;

struct AppState {
    minimize_to_tray: AtomicBool,
    /// A `.auradrop` file passed on the command line (file association),
    /// waiting for the frontend to ask for it once it has mounted.
    launch_file: Mutex<Option<String>>,
    tray_toggle: Mutex<Option<CheckMenuItem<Wry>>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Prefs {
    minimize_to_tray: bool,
}

// ---------------------------------------------------------------------------
// Window helpers
// ---------------------------------------------------------------------------

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(MAIN_WINDOW)
}

fn reveal(app: &AppHandle) {
    if let Some(window) = main_window(app) {
        // Restore before showing: showing a still-minimized window emits a
        // "minimized" resize, which minimize-to-tray would hide again.
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn toggle_visibility(app: &AppHandle) {
    if let Some(window) = main_window(app) {
        let visible = window.is_visible().unwrap_or(false);
        let minimized = window.is_minimized().unwrap_or(false);
        if visible && !minimized {
            let _ = window.hide();
        } else {
            reveal(app);
        }
    }
}

fn design_path_from_args(args: &[String]) -> Option<String> {
    args.iter()
        .skip(1)
        .find(|arg| has_extension(Path::new(arg), &[DESIGN_EXT]))
        .cloned()
}

fn has_extension(path: &Path, allowed: &[&str]) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| allowed.iter().any(|a| ext.eq_ignore_ascii_case(a)))
        .unwrap_or(false)
}

/// Apply the requested backdrop material. Returns the material that actually
/// took effect so the UI can fall back to opaque surfaces when none did.
#[cfg(target_os = "windows")]
fn apply_backdrop(window: &WebviewWindow, kind: &str) -> &'static str {
    use window_vibrancy::{apply_acrylic, apply_mica, clear_acrylic, clear_mica};

    let _ = clear_mica(window);
    let _ = clear_acrylic(window);

    let try_mica = || apply_mica(window, Some(true)).is_ok();
    let try_acrylic = || apply_acrylic(window, Some((12, 13, 20, 140))).is_ok();

    match kind {
        "none" => "none",
        "acrylic" => {
            if try_acrylic() {
                "acrylic"
            } else if try_mica() {
                "mica"
            } else {
                "none"
            }
        }
        // Mica needs Windows 11; Acrylic covers Windows 10 1809+.
        _ => {
            if try_mica() {
                "mica"
            } else if try_acrylic() {
                "acrylic"
            } else {
                "none"
            }
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn apply_backdrop(_window: &WebviewWindow, _kind: &str) -> &'static str {
    "none"
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn set_backdrop(window: WebviewWindow, kind: String) -> String {
    apply_backdrop(&window, &kind).to_string()
}

#[tauri::command]
fn get_prefs(state: tauri::State<'_, AppState>) -> Prefs {
    Prefs {
        minimize_to_tray: state.minimize_to_tray.load(Ordering::Relaxed),
    }
}

#[tauri::command]
fn set_minimize_to_tray(app: AppHandle, state: tauri::State<'_, AppState>, enabled: bool) {
    state.minimize_to_tray.store(enabled, Ordering::Relaxed);
    if let Some(item) = state.tray_toggle.lock().unwrap().as_ref() {
        let _ = item.set_checked(enabled);
    }
    let _ = app.emit(
        "prefs-changed",
        Prefs {
            minimize_to_tray: enabled,
        },
    );
}

#[tauri::command]
fn hide_to_tray(window: WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

/// Read a dropped image and return it as a `data:` URL.
///
/// Dropped paths are not part of any fs-plugin scope, so this is the one
/// place the webview can read from them — and it only ever reads images.
#[tauri::command]
async fn read_image_file(path: String) -> Result<String, String> {
    let path = Path::new(&path);
    let mime = match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        Some("svg") => "image/svg+xml",
        Some("bmp") => "image/bmp",
        Some("avif") => "image/avif",
        _ => return Err("That file isn't an image AuraDrop can use.".into()),
    };

    let size = std::fs::metadata(path).map_err(|e| e.to_string())?.len();
    if size > MAX_IMAGE_BYTES {
        return Err(format!(
            "Images must be under {} MB.",
            MAX_IMAGE_BYTES / 1024 / 1024
        ));
    }

    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(format!("data:{mime};base64,{encoded}"))
}

/// Read a `.auradrop` design that arrived via the command line or a drop.
///
/// The user chose this file explicitly, so it is also added to the fs-plugin
/// scope; that lets Ctrl+S write back to it like a dialog-picked file.
#[tauri::command]
async fn read_design_file(app: AppHandle, path: String) -> Result<String, String> {
    let path = Path::new(&path);
    if !has_extension(path, &[DESIGN_EXT, "json"]) {
        return Err("That isn't an AuraDrop design file.".into());
    }
    let size = std::fs::metadata(path).map_err(|e| e.to_string())?.len();
    if size > MAX_DESIGN_BYTES {
        return Err("That design file is too large.".into());
    }
    let text = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    app.fs_scope().allow_file(path).map_err(|e| e.to_string())?;
    Ok(text)
}

#[tauri::command]
fn take_launch_file(state: tauri::State<'_, AppState>) -> Option<String> {
    state.launch_file.lock().unwrap().take()
}

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------

fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let state = app.state::<AppState>();

    let show = MenuItem::with_id(app, "show", "Show AuraDrop", true, None::<&str>)?;
    let to_tray = CheckMenuItem::with_id(
        app,
        "minimize_to_tray",
        "Minimize to tray",
        true,
        state.minimize_to_tray.load(Ordering::Relaxed),
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, "quit", "Quit AuraDrop", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &show,
            &PredefinedMenuItem::separator(app)?,
            &to_tray,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;
    *state.tray_toggle.lock().unwrap() = Some(to_tray);

    // The icon itself is declared in tauri.conf.json (`app.trayIcon`); here we
    // attach the menu and behaviour to it.
    let tray = app
        .tray_by_id(TRAY_ID)
        .expect("tray icon `main` must be declared in tauri.conf.json");
    tray.set_menu(Some(menu))?;
    tray.set_show_menu_on_left_click(false)?;

    tray.on_menu_event(|app, event| match event.id().as_ref() {
        "show" => reveal(app),
        "minimize_to_tray" => {
            // The check item flips its own mark on click; read it back rather
            // than toggling our flag so the two can never drift apart.
            let state = app.state::<AppState>();
            let enabled = state
                .tray_toggle
                .lock()
                .unwrap()
                .as_ref()
                .and_then(|item| item.is_checked().ok())
                .unwrap_or(!state.minimize_to_tray.load(Ordering::Relaxed));
            state.minimize_to_tray.store(enabled, Ordering::Relaxed);
            let _ = app.emit(
                "prefs-changed",
                Prefs {
                    minimize_to_tray: enabled,
                },
            );
        }
        "quit" => app.exit(0),
        _ => {}
    });

    tray.on_tray_icon_event(|tray, event| {
        if let TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        } = event
        {
            toggle_visibility(tray.app_handle());
        }
    });

    Ok(())
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let launch_file = design_path_from_args(&std::env::args().collect::<Vec<_>>());

    tauri::Builder::default()
        // Must be registered first so a second launch is caught before
        // anything else initialises.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            reveal(app);
            if let Some(path) = design_path_from_args(&args) {
                let _ = app.emit("open-design-file", path);
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(AppState {
            minimize_to_tray: AtomicBool::new(true),
            launch_file: Mutex::new(launch_file),
            tray_toggle: Mutex::new(None),
        })
        .setup(|app| {
            let handle = app.handle();
            if let Some(window) = main_window(handle) {
                let applied = apply_backdrop(&window, "mica");
                // Let the frontend know immediately; it also re-queries via
                // `set_backdrop` when the user changes the material.
                let _ = window.emit("backdrop-applied", applied);
                // The window starts hidden (see tauri.conf.json) so it can
                // stay in the tray when Windows launches us at sign-in.
                if !std::env::args().any(|arg| arg == AUTOSTART_ARG) {
                    let _ = window.show();
                }
            }
            setup_tray(handle)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != MAIN_WINDOW {
                return;
            }
            // Taskbar minimize, Win+Down and our own title-bar button all end
            // up here, so minimize-to-tray behaves the same for each.
            if let WindowEvent::Resized(_) = event {
                let state = window.state::<AppState>();
                if state.minimize_to_tray.load(Ordering::Relaxed)
                    && window.is_minimized().unwrap_or(false)
                {
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            set_backdrop,
            get_prefs,
            set_minimize_to_tray,
            hide_to_tray,
            read_image_file,
            read_design_file,
            take_launch_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running AuraDrop");
}
