//! The install / uninstall pipeline, shared by the glass UI and `--silent`.
//!
//! The actual installation is done by AuraDrop's own NSIS installer (the
//! embedded payload) running silently. That installer also provides the
//! uninstaller and the Add/Remove Programs entry; setup adds the friendly
//! UI, pre-flight checks and a verification step on top.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::system::{self, APP_EXE, RUN_KEY, UNINSTALL_KEY};

pub const VERSION: &str = env!("AURADROP_VERSION");
const PAYLOAD: &[u8] = include_bytes!(env!("AURADROP_PAYLOAD_PATH"));
const PAYLOAD_SHA256: &str = env!("AURADROP_PAYLOAD_SHA256");
const APP_BYTES: &str = env!("AURADROP_APP_BYTES");
const PRODUCT: &str = "AuraDrop";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Installed {
    pub version: String,
    pub location: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupInfo {
    pub version: String,
    pub installed: Option<Installed>,
    /// "fresh" | "reinstall" | "update" | "downgrade"
    pub mode: &'static str,
    pub default_dir: String,
    pub size_bytes: u64,
    pub app_running: bool,
    pub has_payload: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallOptions {
    pub dir: String,
    pub desktop_shortcut: bool,
    pub autostart: bool,
    pub associate: bool,
    /// Update in place: keep the shortcuts, association and startup entry
    /// the user already has (the other options are ignored).
    #[serde(default)]
    pub update: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallReport {
    pub dir: String,
    pub exe: String,
    pub version: String,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Step {
    Check,
    Unpack,
    Install,
    Verify,
    Remove,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupError {
    pub step: Step,
    /// Plain-English explanation for the UI.
    pub message: String,
    /// Technical detail for "Copy details".
    pub detail: String,
}

impl SetupError {
    fn new(step: Step, message: impl Into<String>, detail: impl Into<String>) -> Self {
        Self {
            step,
            message: message.into(),
            detail: detail.into(),
        }
    }
}

impl std::fmt::Display for SetupError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} ({})", self.message, self.detail)
    }
}

// ---------------------------------------------------------------------------
// Inspection
// ---------------------------------------------------------------------------

pub fn installed() -> Option<Installed> {
    let version = system::reg_read(UNINSTALL_KEY, "DisplayVersion")?;
    let location = system::reg_read(UNINSTALL_KEY, "InstallLocation")
        .map(|s| system::unquote(&s).to_string())
        .filter(|s| !s.is_empty())?;
    Some(Installed { version, location })
}

pub fn info() -> SetupInfo {
    let installed = installed();
    let mode = match &installed {
        None => "fresh",
        Some(i) => match compare_versions(VERSION, &i.version) {
            std::cmp::Ordering::Greater => "update",
            std::cmp::Ordering::Equal => "reinstall",
            std::cmp::Ordering::Less => "downgrade",
        },
    };
    let default_dir = installed
        .as_ref()
        .map(|i| i.location.clone())
        .unwrap_or_else(|| join_windows(&system::local_app_data(), PRODUCT));
    SetupInfo {
        version: VERSION.to_string(),
        installed,
        mode,
        default_dir,
        size_bytes: APP_BYTES.parse().unwrap_or(0),
        app_running: system::is_process_running(APP_EXE),
        has_payload: !PAYLOAD.is_empty(),
    }
}

/// Compare dotted versions numerically ("0.10.0" > "0.9.3").
pub fn compare_versions(a: &str, b: &str) -> std::cmp::Ordering {
    let parse = |v: &str| -> Vec<u64> {
        v.split(['.', '-', '+'])
            .take(3)
            .map(|p| p.parse().unwrap_or(0))
            .collect()
    };
    parse(a).cmp(&parse(b))
}

fn join_windows(dir: &str, name: &str) -> String {
    format!("{}\\{}", dir.trim_end_matches(['\\', '/']), name)
}

/// Turn a folder the user picked into the install folder. Picking a general
/// folder (say `D:\Apps`) installs into `D:\Apps\AuraDrop`, like most
/// installers; picking the existing install folder keeps it.
pub fn resolve_dir(picked: &str) -> String {
    let picked = picked.trim().trim_end_matches(['\\', '/']);
    let last = picked.rsplit(['\\', '/']).next().unwrap_or("");
    if last.eq_ignore_ascii_case(PRODUCT) {
        picked.to_string()
    } else {
        join_windows(picked, PRODUCT)
    }
}

/// Check that we can install into `dir` without administrator rights.
pub fn validate_dir(dir: &str) -> Result<(), String> {
    let dir = dir.trim();
    let bytes = dir.as_bytes();
    let absolute = bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && (bytes[2] == b'\\' || bytes[2] == b'/');
    if !absolute && !dir.starts_with(r"\\") {
        return Err(
            "Choose a full folder path, like C:\\Users\\you\\AppData\\Local\\AuraDrop.".into(),
        );
    }
    if dir.len() > 200 {
        return Err("That folder path is too long. Pick a shorter one.".into());
    }
    if dir
        .chars()
        .any(|c| matches!(c, '<' | '>' | '"' | '|' | '?' | '*'))
    {
        return Err("That folder name has characters Windows doesn't allow.".into());
    }
    // Probe write access: per-user installs can't write to Program Files etc.
    let host = system::host_path(dir);
    let existed = host.exists();
    if let Err(e) = std::fs::create_dir_all(&host) {
        return Err(no_access(dir, &e));
    }
    let probe = host.join(".auradrop-setup-probe");
    let result = std::fs::write(&probe, b"ok").map_err(|e| no_access(dir, &e));
    let _ = std::fs::remove_file(&probe);
    if !existed {
        let _ = std::fs::remove_dir(&host);
    }
    result
}

fn no_access(dir: &str, e: &std::io::Error) -> String {
    if e.kind() == std::io::ErrorKind::PermissionDenied {
        format!("AuraDrop can't install into {dir} without administrator rights. Pick a folder in your own user profile.")
    } else {
        format!("AuraDrop can't use {dir}: {e}")
    }
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

/// Arguments for the NSIS payload, plus the `/D=` tail that must come last
/// and stay unquoted even with spaces (see `system::run_and_wait`).
pub fn installer_args(opts: &InstallOptions) -> (Vec<String>, String) {
    let mut args = vec!["/S".to_string()];
    if opts.update {
        args.push("/UPDATE".into());
        return (args, format!("/D={}", opts.dir.trim()));
    }
    if !opts.desktop_shortcut {
        args.push("/NS".into());
    }
    if !opts.associate {
        args.push("/NOASSOC".into());
    }
    if opts.autostart {
        args.push("/AUTOSTART".into());
    }
    (args, format!("/D={}", opts.dir.trim()))
}

pub struct TempPayload {
    dir: PathBuf,
    pub exe: PathBuf,
}

impl Drop for TempPayload {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}

/// Write the embedded installer to a private temp folder and verify it.
pub fn unpack_payload() -> Result<TempPayload, SetupError> {
    if PAYLOAD.is_empty() {
        return Err(SetupError::new(
            Step::Unpack,
            "This copy of setup doesn't contain AuraDrop. Download setup again.",
            "payload is empty (development build)",
        ));
    }
    let unique = format!(
        "AuraDrop-Setup-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    );
    let dir = std::env::temp_dir().join(unique);
    let fail = |e: std::io::Error| {
        SetupError::new(
            Step::Unpack,
            "Setup couldn't unpack AuraDrop. Check that your disk isn't full.",
            format!("{}: {e}", dir.display()),
        )
    };
    std::fs::create_dir_all(&dir).map_err(fail)?;
    let exe = dir.join("AuraDrop-payload.exe");
    std::fs::write(&exe, PAYLOAD).map_err(fail)?;

    // Re-read from disk so antivirus quarantine or a short write is caught
    // here, not as a confusing failure inside the installer.
    let written = std::fs::read(&exe).map_err(fail)?;
    let hash = format!("{:x}", Sha256::digest(&written));
    if hash != PAYLOAD_SHA256 {
        return Err(SetupError::new(
            Step::Unpack,
            "The unpacked installer is damaged. Your antivirus may have changed it – try again or download setup again.",
            format!("sha256 {hash} != {PAYLOAD_SHA256}"),
        ));
    }
    Ok(TempPayload { dir, exe })
}

pub fn install(
    opts: &InstallOptions,
    progress: &dyn Fn(Step),
) -> Result<InstallReport, SetupError> {
    progress(Step::Check);
    if opts.update {
        // AuraDrop starts us and then quits; give it a moment to close so
        // the installer doesn't have to force it.
        for _ in 0..40 {
            if !is_app_running() {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(200));
        }
    }
    let dir = opts.dir.trim().to_string();
    validate_dir(&dir).map_err(|m| SetupError::new(Step::Check, m, format!("dir={dir}")))?;

    progress(Step::Unpack);
    let payload = unpack_payload()?;

    // Moving to a different folder: remove the old copy first so it doesn't
    // linger (and its uninstaller doesn't later delete our new shortcuts).
    if let Some(old) = installed() {
        if !same_dir(&old.location, &dir) {
            progress(Step::Install);
            remove_installed(&old)?;
        }
    }

    progress(Step::Install);
    let (args, dir_arg) = installer_args(opts);
    let code = system::run_and_wait(&payload.exe, &args, &dir_arg).map_err(|e| {
        SetupError::new(
            Step::Install,
            "Windows wouldn't start the AuraDrop installer.",
            e.to_string(),
        )
    })?;
    if code != 0 {
        let message = match code {
            // The payload installs WebView2 first when it's missing; that
            // needs the internet and is the usual reason for an abort.
            _ if !webview2_installed() => {
                "AuraDrop needs Microsoft Edge WebView2, and setup couldn't install it. Connect to the internet and try again."
            }
            // NSIS: 1 = cancelled, 2 = aborted by the script (e.g. AuraDrop
            // couldn't be closed).
            2 => "The installer stopped early. Make sure AuraDrop is closed and try again.",
            _ => "The AuraDrop installer didn't finish.",
        };
        return Err(SetupError::new(
            Step::Install,
            message,
            format!("installer exit code {code}; args {args:?} {dir_arg}"),
        ));
    }

    progress(Step::Verify);
    verify_installed(&dir)
}

/// Don't trust the exit code alone: check the files and registry entry.
pub fn verify_installed(dir: &str) -> Result<InstallReport, SetupError> {
    let exe = join_windows(dir, APP_EXE);
    if !system::host_path(&exe).is_file() {
        return Err(SetupError::new(
            Step::Verify,
            "Setup finished, but AuraDrop isn't where it should be.",
            format!("missing {exe}"),
        ));
    }
    match installed() {
        Some(i) if i.version == VERSION => Ok(InstallReport {
            dir: dir.to_string(),
            exe,
            version: VERSION.to_string(),
        }),
        other => Err(SetupError::new(
            Step::Verify,
            "AuraDrop was copied, but Windows doesn't list it as installed.",
            format!("registry entry: {other:?}"),
        )),
    }
}

// ---------------------------------------------------------------------------
// Uninstall
// ---------------------------------------------------------------------------

pub fn uninstall(progress: &dyn Fn(Step)) -> Result<(), SetupError> {
    progress(Step::Check);
    let Some(found) = installed() else {
        return Err(SetupError::new(
            Step::Check,
            "AuraDrop isn't installed.",
            "no uninstall registry entry",
        ));
    };
    progress(Step::Remove);
    remove_installed(&found)?;

    progress(Step::Verify);
    if installed().is_some() {
        return Err(SetupError::new(
            Step::Verify,
            "The uninstaller ran, but AuraDrop is still listed as installed.",
            "uninstall registry entry still present",
        ));
    }
    Ok(())
}

/// Run an installation's own uninstaller silently and wait for it.
fn remove_installed(found: &Installed) -> Result<(), SetupError> {
    let uninstaller = join_windows(&found.location, "uninstall.exe");
    let host_uninstaller = system::host_path(&uninstaller);
    if !host_uninstaller.is_file() {
        return Err(SetupError::new(
            Step::Remove,
            "AuraDrop's uninstaller is missing. Reinstall AuraDrop into the same folder first, then remove it.",
            format!("missing {uninstaller}"),
        ));
    }
    // `_?=` runs the uninstaller in place instead of from a temp copy, so we
    // can wait for it to actually finish.
    let in_place = format!("_?={}", found.location);
    let code =
        system::run_and_wait(&host_uninstaller, &["/S".to_string()], &in_place).map_err(|e| {
            SetupError::new(
                Step::Remove,
                "Windows wouldn't start AuraDrop's uninstaller.",
                e.to_string(),
            )
        })?;
    if code != 0 {
        return Err(SetupError::new(
            Step::Remove,
            "AuraDrop couldn't be removed. Make sure it's closed and try again.",
            format!("uninstaller exit code {code}"),
        ));
    }
    // In-place mode leaves the uninstaller itself behind.
    let _ = std::fs::remove_file(&host_uninstaller);
    let _ = std::fs::remove_dir(system::host_path(&found.location));
    Ok(())
}

fn same_dir(a: &str, b: &str) -> bool {
    let norm = |p: &str| {
        p.trim()
            .trim_end_matches(['\\', '/'])
            .replace('/', "\\")
            .to_lowercase()
    };
    norm(a) == norm(b)
}

/// Is the WebView2 runtime installed? Same registry checks as the NSIS
/// template; "0.0.0.0" means it was removed.
pub fn webview2_installed() -> bool {
    const CLIENT: &str = r"Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
    [
        format!(r"HKLM\SOFTWARE\WOW6432Node\{CLIENT}"),
        format!(r"HKLM\SOFTWARE\{CLIENT}"),
        format!(r"HKCU\SOFTWARE\{CLIENT}"),
    ]
    .iter()
    .filter_map(|key| system::reg_read(key, "pv"))
    .any(|pv| !pv.is_empty() && pv != "0.0.0.0")
}

/// Is AuraDrop set to start with Windows? (Used to pre-tick the option.)
pub fn autostart_enabled() -> bool {
    system::reg_read(RUN_KEY, PRODUCT).is_some()
}

pub fn launch(exe: &str) -> Result<(), String> {
    system::spawn_detached(exe).map_err(|e| format!("Couldn't open AuraDrop: {e}"))
}

pub fn is_app_running() -> bool {
    system::is_process_running(APP_EXE)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cmp::Ordering::*;

    fn opts(desktop: bool, assoc: bool, auto: bool, dir: &str) -> InstallOptions {
        InstallOptions {
            dir: dir.into(),
            desktop_shortcut: desktop,
            associate: assoc,
            autostart: auto,
            update: false,
        }
    }

    #[test]
    fn builds_installer_arguments() {
        let (args, tail) = installer_args(&opts(true, true, false, r"C:\A"));
        assert_eq!(args, ["/S"]);
        assert_eq!(tail, r"/D=C:\A");
        let (args, tail) = installer_args(&opts(false, false, true, r"D:\My Apps\AuraDrop "));
        assert_eq!(args, ["/S", "/NS", "/NOASSOC", "/AUTOSTART"]);
        // Updates keep the user's choices: only /UPDATE is passed.
        let mut o = opts(false, false, true, r"C:\A");
        o.update = true;
        assert_eq!(installer_args(&o).0, ["/S", "/UPDATE"]);
        assert_eq!(tail, r"/D=D:\My Apps\AuraDrop");
    }

    #[test]
    fn resolves_picked_folders() {
        assert_eq!(resolve_dir(r"D:\Apps"), r"D:\Apps\AuraDrop");
        assert_eq!(resolve_dir(r"D:\Apps\"), r"D:\Apps\AuraDrop");
        assert_eq!(resolve_dir(r"D:\Apps\auradrop"), r"D:\Apps\auradrop");
        assert_eq!(resolve_dir(r"E:\"), r"E:\AuraDrop");
    }

    #[test]
    fn rejects_bad_folders() {
        assert!(validate_dir("relative\\path").is_err());
        assert!(validate_dir(r"C:\bad|name").is_err());
        assert!(validate_dir(&format!(r"C:\{}", "x".repeat(250))).is_err());
    }

    #[test]
    fn compares_dirs() {
        assert!(same_dir(
            r"C:\Users\A\AppData\Local\AuraDrop",
            r"c:\users\a\appdata\local\auradrop\"
        ));
        assert!(same_dir("C:/Apps/AuraDrop", r"C:\Apps\AuraDrop"));
        assert!(!same_dir(r"C:\Apps\AuraDrop", r"D:\Apps\AuraDrop"));
    }

    #[test]
    fn compares_versions() {
        assert_eq!(compare_versions("0.10.0", "0.9.3"), Greater);
        assert_eq!(compare_versions("0.1.0", "0.1.0"), Equal);
        assert_eq!(compare_versions("0.1.0", "1.0.0"), Less);
        assert_eq!(compare_versions("1.2.3-beta", "1.2.3"), Equal);
    }
}
