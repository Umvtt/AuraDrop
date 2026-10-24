//! The few operating-system calls setup needs.
//!
//! On Windows registry reads use the Unicode API and process checks use
//! `tasklist.exe`. On other systems a development harness runs the same
//! Windows tools (and the real NSIS payload) under Wine, so the setup UI can
//! be exercised end to end on Linux.

use std::path::{Path, PathBuf};
use std::process::Command;

pub const UNINSTALL_KEY: &str =
    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\AuraDrop";
pub const RUN_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
pub const APP_EXE: &str = "auradrop.exe";

/// Build a command for a Windows program. On Windows it runs directly
/// without flashing a console; elsewhere it runs through Wine.
pub fn windows_command(program: &str) -> Command {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let mut cmd = Command::new(program);
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd
    }
    #[cfg(not(target_os = "windows"))]
    {
        let mut cmd = Command::new("wine");
        cmd.arg(program).env("WINEDEBUG", "-all");
        cmd
    }
}

/// Map a Windows path to one this process can open.
pub fn host_path(windows_path: &str) -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        PathBuf::from(windows_path)
    }
    #[cfg(not(target_os = "windows"))]
    {
        wine_path("-u", windows_path)
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(windows_path))
    }
}

/// Map a path from this process (e.g. a folder picker) to a Windows path.
pub fn windows_path(host: &Path) -> String {
    #[cfg(target_os = "windows")]
    {
        host.display().to_string()
    }
    #[cfg(not(target_os = "windows"))]
    {
        let s = host.display().to_string();
        if s.contains(':') {
            return s; // already a Windows path
        }
        wine_path("-w", &s).unwrap_or(s)
    }
}

#[cfg(not(target_os = "windows"))]
fn wine_path(flag: &str, path: &str) -> Option<String> {
    let out = Command::new("winepath")
        .args([flag, path])
        .env("WINEDEBUG", "-all")
        .output()
        .ok()?;
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    (out.status.success() && !s.is_empty()).then_some(s)
}

/// `%LOCALAPPDATA%` as a Windows path.
pub fn local_app_data() -> String {
    #[cfg(target_os = "windows")]
    {
        std::env::var("LOCALAPPDATA").unwrap_or_else(|_| r"C:\Users\Public\AppData\Local".into())
    }
    #[cfg(not(target_os = "windows"))]
    {
        windows_command("cmd")
            .args(["/c", "echo", "%LOCALAPPDATA%"])
            .output()
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .filter(|s| !s.is_empty() && !s.contains('%'))
            .unwrap_or_else(|| r"C:\users\Public\AppData\Local".into())
    }
}

/// Read one string value from the registry, or `None` if it isn't there.
///
/// Windows uses the Unicode registry API: `reg.exe` prints in the console
/// code page when piped, which garbles paths like `C:\Apps\Ünïcødé`.
#[cfg(target_os = "windows")]
pub fn reg_read(key: &str, value: &str) -> Option<String> {
    use windows_sys::Win32::System::Registry::{
        RegGetValueW, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, RRF_RT_REG_SZ,
    };
    let (root, sub) = match key.split_once('\\') {
        Some(("HKCU", sub)) => (HKEY_CURRENT_USER, sub),
        Some(("HKLM", sub)) => (HKEY_LOCAL_MACHINE, sub),
        _ => return None,
    };
    let wide = |s: &str| s.encode_utf16().chain(Some(0)).collect::<Vec<u16>>();
    let (sub, value) = (wide(sub), wide(value));
    // Only REG_SZ: asking for REG_EXPAND_SZ too would also require
    // RRF_NOEXPAND, or the call fails with ERROR_INVALID_PARAMETER.
    let flags = RRF_RT_REG_SZ;
    let mut bytes: u32 = 0;
    // SAFETY: valid NUL-terminated UTF-16 strings; the first call only asks
    // for the size, the second writes at most `bytes` into `buf`.
    unsafe {
        let status = RegGetValueW(
            root,
            sub.as_ptr(),
            value.as_ptr(),
            flags,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            &mut bytes,
        );
        if status != 0 {
            return None;
        }
        let mut buf = vec![0u16; (bytes as usize).div_ceil(2) + 1];
        let status = RegGetValueW(
            root,
            sub.as_ptr(),
            value.as_ptr(),
            flags,
            std::ptr::null_mut(),
            buf.as_mut_ptr().cast(),
            &mut bytes,
        );
        if status != 0 {
            return None;
        }
        let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
        Some(String::from_utf16_lossy(&buf[..len]))
    }
}

/// Wine harness: query through `reg.exe`.
#[cfg(not(target_os = "windows"))]
pub fn reg_read(key: &str, value: &str) -> Option<String> {
    let out = windows_command("reg")
        .args(["query", key, "/v", value])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    parse_reg_value(&String::from_utf8_lossy(&out.stdout), value)
}

/// Pull a value out of `reg query` output. The format is
/// `    <name>    REG_SZ    <data>`; the type names aren't localized.
#[cfg(any(not(target_os = "windows"), test))]
pub fn parse_reg_value(output: &str, value: &str) -> Option<String> {
    output.lines().find_map(|line| {
        let line = line.trim();
        let rest = line.strip_prefix(value)?;
        let rest = rest.trim_start();
        for ty in ["REG_SZ", "REG_EXPAND_SZ"] {
            if let Some(data) = rest.strip_prefix(ty) {
                return Some(data.trim().to_string());
            }
        }
        None
    })
}

/// Is a process with this image name running for any user we can see?
pub fn is_process_running(image: &str) -> bool {
    windows_command("tasklist")
        .args(["/FO", "CSV", "/NH"])
        .output()
        .map(|o| tasklist_has(&String::from_utf8_lossy(&o.stdout), image))
        .unwrap_or(false)
}

/// Check CSV `tasklist` output for an image name. Matching the quoted first
/// column avoids depending on the (localized) "no tasks" message.
pub fn tasklist_has(output: &str, image: &str) -> bool {
    let needle = format!("\"{}\"", image.to_ascii_lowercase());
    output
        .lines()
        .any(|line| line.trim_start().to_ascii_lowercase().starts_with(&needle))
}

/// Run a Windows program and wait for it. Returns its exit code.
///
/// `raw_tail` is appended to the command line exactly as given. NSIS needs
/// that for `/D=` and `_?=`: they must come last and must not be quoted,
/// even when the path has spaces – and Rust would quote them.
pub fn run_and_wait(exe: &Path, args: &[String], raw_tail: &str) -> std::io::Result<i32> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = windows_command(&exe.display().to_string());
        cmd.args(args);
        if !raw_tail.is_empty() {
            cmd.raw_arg(raw_tail);
        }
        Ok(cmd.status()?.code().unwrap_or(-1))
    }
    #[cfg(not(target_os = "windows"))]
    {
        // Wine re-quotes argv, so write the exact command line to a batch
        // file and let cmd.exe run it.
        let line = command_line(&windows_path(exe), args, raw_tail).replace('%', "%%");
        let bat = exe.with_extension("run.bat");
        std::fs::write(&bat, format!("@{line}\r\n@exit /b %ERRORLEVEL%\r\n"))?;
        let status = windows_command("cmd")
            .arg("/c")
            .arg(windows_path(&bat))
            .status()?;
        let _ = std::fs::remove_file(&bat);
        Ok(status.code().unwrap_or(-1))
    }
}

/// The command line Windows sees: quoted program, quoted args, raw tail.
/// (Windows builds pass the tail via `raw_arg`; this is for the Wine harness.)
#[cfg(any(not(target_os = "windows"), test))]
pub fn command_line(exe: &str, args: &[String], raw_tail: &str) -> String {
    let quote = |s: &str| {
        if s.is_empty() || s.contains([' ', '\t']) {
            format!("\"{s}\"")
        } else {
            s.to_string()
        }
    };
    let mut line = format!("\"{exe}\"");
    for a in args {
        line.push(' ');
        line.push_str(&quote(a));
    }
    if !raw_tail.is_empty() {
        line.push(' ');
        line.push_str(raw_tail);
    }
    line
}

/// Start a program and don't wait for it (used to open AuraDrop at the end).
pub fn spawn_detached(exe_windows_path: &str) -> std::io::Result<()> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x0000_0008;
        Command::new(exe_windows_path)
            .creation_flags(DETACHED_PROCESS)
            .spawn()
            .map(|_| ())
    }
    #[cfg(not(target_os = "windows"))]
    {
        windows_command(exe_windows_path).spawn().map(|_| ())
    }
}

/// Remove surrounding quotes from registry paths like `"C:\Apps\AuraDrop"`.
pub fn unquote(s: &str) -> &str {
    s.trim().trim_matches('"')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_reg_values() {
        let out = "\r\nHKEY_CURRENT_USER\\Software\\...\\AuraDrop\r\n    DisplayVersion    REG_SZ    0.1.0\r\n\r\n";
        assert_eq!(
            parse_reg_value(out, "DisplayVersion").as_deref(),
            Some("0.1.0")
        );
        let out = "    InstallLocation    REG_SZ    \"C:\\My Apps\\AuraDrop\"";
        assert_eq!(
            parse_reg_value(out, "InstallLocation")
                .map(|s| unquote(&s).to_string())
                .as_deref(),
            Some("C:\\My Apps\\AuraDrop")
        );
        // A value whose name starts with the one we want must not match.
        let out = "    DisplayVersionOld    REG_SZ    9.9.9";
        assert_eq!(parse_reg_value(out, "DisplayVersion"), None);
        assert_eq!(parse_reg_value("ERROR: not found", "DisplayVersion"), None);
    }

    #[test]
    fn keeps_nsis_tail_unquoted() {
        let line = command_line(
            r"C:\T\p.exe",
            &["/S".into(), "/NS".into()],
            r"/D=C:\My Apps\AuraDrop",
        );
        assert_eq!(line, r#""C:\T\p.exe" /S /NS /D=C:\My Apps\AuraDrop"#);
    }

    #[test]
    fn finds_processes_in_tasklist() {
        let out = "\"explorer.exe\",\"72\",\"Console\",\"1\",\"21,584 K\"\r\n\"AuraDrop.exe\",\"300\",\"Console\",\"1\",\"80,000 K\"";
        assert!(tasklist_has(out, "auradrop.exe"));
        assert!(!tasklist_has(out, "aura.exe"));
        assert!(!tasklist_has(
            "INFO: Es werden keine Aufgaben ausgeführt.",
            "auradrop.exe"
        ));
        // Image names that merely start with ours don't count.
        assert!(!tasklist_has("\"auradrop.exe.bak\",\"1\"", "auradrop.exe"));
    }
}
