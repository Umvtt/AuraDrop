//! AuraDrop Setup: a frameless glass installer for AuraDrop.
//!
//! Three ways in:
//! - normal launch: the glass UI;
//! - `--silent [options]`: unattended install/uninstall, no window;
//! - no WebView2 on the PC: the glass UI can't render, so we hand over to
//!   AuraDrop's classic NSIS installer, which installs WebView2 first.

mod setup;
mod system;

use std::sync::atomic::{AtomicBool, Ordering};

use serde::Serialize;
use setup::{InstallOptions, SetupError, Step};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow, WindowEvent};

/// Set while installing or uninstalling, so the window can't be closed
/// halfway through.
static BUSY: AtomicBool = AtomicBool::new(false);

struct BusyGuard;

impl BusyGuard {
    fn acquire() -> Result<Self, SetupError> {
        if BUSY.swap(true, Ordering::SeqCst) {
            return Err(SetupError {
                step: Step::Check,
                message: "Setup is already working on something.".into(),
                detail: "busy".into(),
            });
        }
        Ok(BusyGuard)
    }
}

impl Drop for BusyGuard {
    fn drop(&mut self) {
        BUSY.store(false, Ordering::SeqCst);
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Progress {
    step: Step,
}

fn emit_progress(app: &AppHandle) -> impl Fn(Step) + '_ {
    move |step| {
        let _ = app.emit("setup-progress", Progress { step });
    }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Info {
    #[serde(flatten)]
    info: setup::SetupInfo,
    autostart_enabled: bool,
    /// Started by AuraDrop's updater: install straight away, then reopen it.
    auto_update: bool,
}

/// Set when launched with `--update` (by AuraDrop's update screen).
static AUTO_UPDATE: AtomicBool = AtomicBool::new(false);

#[tauri::command]
async fn get_info() -> Info {
    tauri::async_runtime::spawn_blocking(|| Info {
        info: setup::info(),
        autostart_enabled: setup::autostart_enabled(),
        auto_update: AUTO_UPDATE.load(Ordering::SeqCst),
    })
    .await
    .expect("info task panicked")
}

#[tauri::command]
async fn is_app_running() -> bool {
    tauri::async_runtime::spawn_blocking(setup::is_app_running)
        .await
        .unwrap_or(false)
}

/// Turn a folder from the picker into an install folder and check it.
#[tauri::command]
async fn choose_dir(picked: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dir = setup::resolve_dir(&system::windows_path(std::path::Path::new(&picked)));
        setup::validate_dir(&dir).map(|_| dir)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn validate_dir(dir: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || setup::validate_dir(&dir))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn install(
    app: AppHandle,
    options: InstallOptions,
) -> Result<setup::InstallReport, SetupError> {
    let _busy = BusyGuard::acquire()?;
    tauri::async_runtime::spawn_blocking(move || setup::install(&options, &emit_progress(&app)))
        .await
        .map_err(|e| SetupError {
            step: Step::Install,
            message: "Setup ran into an unexpected problem.".into(),
            detail: e.to_string(),
        })?
}

#[tauri::command]
async fn uninstall(app: AppHandle) -> Result<(), SetupError> {
    let _busy = BusyGuard::acquire()?;
    tauri::async_runtime::spawn_blocking(move || setup::uninstall(&emit_progress(&app)))
        .await
        .map_err(|e| SetupError {
            step: Step::Remove,
            message: "Setup ran into an unexpected problem.".into(),
            detail: e.to_string(),
        })?
}

#[tauri::command]
fn launch_app(exe: String) -> Result<(), String> {
    setup::launch(&exe)
}

#[tauri::command]
fn quit(app: AppHandle) {
    if !BUSY.load(Ordering::SeqCst) {
        app.exit(0);
    }
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
fn apply_backdrop(window: &WebviewWindow) {
    use window_vibrancy::{apply_acrylic, apply_mica};
    if apply_mica(window, Some(true)).is_err() {
        let _ = apply_acrylic(window, Some((12, 13, 20, 160)));
    }
}

#[cfg(not(target_os = "windows"))]
fn apply_backdrop(_window: &WebviewWindow) {}

// ---------------------------------------------------------------------------
// Silent mode
// ---------------------------------------------------------------------------

const SILENT_HELP: &str = "AuraDrop Setup

  AuraDrop-Setup.exe                 open the installer
  AuraDrop-Setup.exe --silent [opts] install without any window

Options for --silent:
  --dir <folder>      install folder (default: %LOCALAPPDATA%\\AuraDrop)
  --no-desktop        don't create a desktop shortcut
  --no-assoc          don't open .auradrop files with AuraDrop
  --autostart         start AuraDrop in the tray when you sign in
  --launch            open AuraDrop when done
  --update            update in place, keeping shortcuts and options
  --uninstall         remove AuraDrop instead

Exit codes: 0 ok, 1 bad arguments, 2 failed (details on stderr).";

/// A GUI-subsystem exe has no console; borrow the caller's so `--silent`
/// can report progress and errors in cmd / PowerShell.
fn attach_parent_console() {
    #[cfg(target_os = "windows")]
    unsafe {
        windows_sys::Win32::System::Console::AttachConsole(
            windows_sys::Win32::System::Console::ATTACH_PARENT_PROCESS,
        );
    }
}

fn run_silent(args: &[String]) -> i32 {
    attach_parent_console();
    let mut opts = InstallOptions {
        dir: String::new(),
        desktop_shortcut: true,
        autostart: false,
        associate: true,
        update: false,
    };
    let (mut launch, mut remove) = (false, false);
    let mut it = args.iter();
    while let Some(arg) = it.next() {
        match arg.as_str() {
            "--silent" => {}
            "--dir" => match it.next() {
                Some(d) => opts.dir = d.clone(),
                None => {
                    eprintln!("--dir needs a folder\n\n{SILENT_HELP}");
                    return 1;
                }
            },
            "--no-desktop" => opts.desktop_shortcut = false,
            "--no-assoc" => opts.associate = false,
            "--autostart" => opts.autostart = true,
            "--launch" => launch = true,
            "--uninstall" => remove = true,
            "--update" => opts.update = true,
            "--help" | "-h" | "/?" => {
                println!("{SILENT_HELP}");
                return 0;
            }
            other => {
                eprintln!("Unknown option: {other}\n\n{SILENT_HELP}");
                return 1;
            }
        }
    }
    let log = |step: Step| eprintln!("[setup] {step:?}");

    if remove {
        return match setup::uninstall(&log) {
            Ok(()) => {
                eprintln!("[setup] AuraDrop was removed");
                0
            }
            Err(e) => {
                eprintln!("[setup] error: {e}");
                2
            }
        };
    }

    if opts.dir.is_empty() {
        opts.dir = setup::info().default_dir;
    }
    match setup::install(&opts, &log) {
        Ok(report) => {
            eprintln!(
                "[setup] AuraDrop {} installed to {}",
                report.version, report.dir
            );
            if launch {
                if let Err(e) = setup::launch(&report.exe) {
                    eprintln!("[setup] {e}");
                }
            }
            0
        }
        Err(e) => {
            eprintln!("[setup] error: {e}");
            2
        }
    }
}

/// No WebView2: run the classic installer with its own UI. It installs
/// WebView2 (downloading it if needed) and then AuraDrop.
fn run_classic_fallback() -> i32 {
    eprintln!("[setup] WebView2 isn't available; opening the classic installer");
    let payload = match setup::unpack_payload() {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[setup] error: {e}");
            return 2;
        }
    };
    match system::run_and_wait(&payload.exe, &[], "") {
        Ok(code) => code,
        Err(e) => {
            eprintln!("[setup] error: {e}");
            2
        }
    }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> i32 {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args
        .iter()
        .any(|a| a == "--silent" || a == "--help" || a == "/?")
    {
        return run_silent(&args);
    }
    AUTO_UPDATE.store(args.iter().any(|a| a == "--update"), Ordering::SeqCst);
    if cfg!(target_os = "windows") && tauri::webview_version().is_err() {
        return run_classic_fallback();
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                apply_backdrop(&window);
                let _ = window.show();
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if BUSY.load(Ordering::SeqCst) {
                    api.prevent_close();
                    let _ = window.emit("close-blocked", ());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_info,
            is_app_running,
            choose_dir,
            validate_dir,
            install,
            uninstall,
            launch_app,
            quit,
        ])
        .run(tauri::generate_context!())
        .expect("error while running AuraDrop Setup");
    0
}
