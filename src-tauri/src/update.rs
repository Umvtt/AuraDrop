//! Update check against GitHub Releases.
//!
//! On launch the app asks GitHub for the latest release. If it's newer, the
//! UI shows a required-update screen; "Update" downloads the release's
//! AuraDrop-Setup exe, checks its SHA-256 against the digest GitHub reports,
//! and hands over to setup in `--update` mode, which installs in place
//! (keeping the user's options) and reopens AuraDrop.
//!
//! Any failure to *check* (offline, rate-limited, GitHub down) reports "no
//! update", so a required update can never lock someone out of the app.

use std::io::Write;
use std::path::PathBuf;
use std::time::Duration;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};

const LATEST_RELEASE: &str = "https://api.github.com/repos/Umvtt/AuraDrop/releases/latest";
const MAX_SETUP_BYTES: u64 = 200 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub current: String,
    pub notes: String,
    pub page_url: String,
    pub download_url: String,
    pub size: u64,
    /// Hex SHA-256 from GitHub's asset digest, when it provides one.
    pub sha256: Option<String>,
}

#[derive(Deserialize)]
struct Release {
    tag_name: String,
    #[serde(default)]
    body: Option<String>,
    html_url: String,
    #[serde(default)]
    draft: bool,
    #[serde(default)]
    prerelease: bool,
    assets: Vec<Asset>,
}

#[derive(Deserialize)]
struct Asset {
    name: String,
    browser_download_url: String,
    size: u64,
    #[serde(default)]
    digest: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Progress {
    downloaded: u64,
    total: u64,
}

fn client(current: &str) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(format!("AuraDrop/{current}"))
        .connect_timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())
}

/// Where to look for releases. Debug builds may point at a test server.
fn release_url() -> String {
    if cfg!(debug_assertions) {
        if let Ok(url) = std::env::var("AURADROP_UPDATE_URL") {
            return url;
        }
    }
    LATEST_RELEASE.to_string()
}

/// Compare dotted versions numerically ("0.10.0" > "0.9.3").
pub fn is_newer(candidate: &str, current: &str) -> bool {
    let parse = |v: &str| -> Vec<u64> {
        v.trim_start_matches(['v', 'V'])
            .split(['.', '-', '+'])
            .take(3)
            .map(|p| p.parse().unwrap_or(0))
            .collect()
    };
    parse(candidate) > parse(current)
}

fn pick_update(release: Release, current: &str) -> Option<UpdateInfo> {
    if release.draft || release.prerelease {
        return None;
    }
    let version = release.tag_name.trim_start_matches(['v', 'V']).to_string();
    if !is_newer(&version, current) {
        return None;
    }
    let asset = release.assets.into_iter().find(|a| {
        let n = a.name.to_ascii_lowercase();
        n.starts_with("auradrop-setup") && n.ends_with(".exe")
    })?;
    let sha256 = asset
        .digest
        .as_deref()
        .and_then(|d| d.strip_prefix("sha256:"))
        .filter(|h| h.len() == 64 && h.chars().all(|c| c.is_ascii_hexdigit()))
        .map(|h| h.to_ascii_lowercase());
    let mut notes = release.body.unwrap_or_default();
    if notes.len() > 4000 {
        let mut cut = 4000;
        while !notes.is_char_boundary(cut) {
            cut -= 1;
        }
        notes.truncate(cut);
    }
    Some(UpdateInfo {
        version,
        current: current.to_string(),
        notes,
        page_url: release.html_url,
        download_url: asset.browser_download_url,
        size: asset.size,
        sha256,
    })
}

/// `Ok(None)` when up to date *or* when the check couldn't be made.
pub async fn check(current: &str) -> Option<UpdateInfo> {
    let res = client(current)
        .ok()?
        .get(release_url())
        .header("Accept", "application/vnd.github+json")
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .ok()?;
    if !res.status().is_success() {
        return None;
    }
    let release: Release = res.json().await.ok()?;
    pick_update(release, current)
}

/// Download the new setup, verify it and return its path.
pub async fn download(app: &AppHandle, info: &UpdateInfo) -> Result<PathBuf, String> {
    if !info.download_url.starts_with("https://") && !cfg!(debug_assertions) {
        return Err("Refusing to download an update over plain HTTP.".into());
    }
    if info.size > MAX_SETUP_BYTES {
        return Err("The update is unexpectedly large.".into());
    }
    let res = client(&info.current)?
        .get(&info.download_url)
        .timeout(Duration::from_secs(600))
        .send()
        .await
        .map_err(|e| format!("Couldn't download the update: {e}"))?;
    if !res.status().is_success() {
        return Err(format!(
            "Couldn't download the update (HTTP {}).",
            res.status()
        ));
    }

    let dir = std::env::temp_dir().join(format!("AuraDrop-Update-{}", std::process::id()));
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(format!("AuraDrop-Setup-{}.exe", info.version));
    let mut file = std::fs::File::create(&path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut downloaded: u64 = 0;
    let mut last_emit = 0u64;
    let mut stream = res.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("The download was interrupted: {e}"))?;
        downloaded += chunk.len() as u64;
        if downloaded > MAX_SETUP_BYTES {
            return Err("The update is unexpectedly large.".into());
        }
        hasher.update(&chunk);
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        if downloaded - last_emit > 64 * 1024 || downloaded == info.size {
            last_emit = downloaded;
            let _ = app.emit(
                "update-progress",
                Progress {
                    downloaded,
                    total: info.size,
                },
            );
        }
    }
    file.flush().map_err(|e| e.to_string())?;
    drop(file);

    if info.size > 0 && downloaded != info.size {
        let _ = std::fs::remove_file(&path);
        return Err("The download was incomplete. Please try again.".into());
    }
    if let Some(expected) = &info.sha256 {
        let actual = format!("{:x}", hasher.finalize());
        if &actual != expected {
            let _ = std::fs::remove_file(&path);
            return Err(
                "The downloaded update didn't pass its safety check. Please try again.".into(),
            );
        }
    }
    Ok(path)
}

/// Start setup in update mode. The caller exits the app right after.
pub fn launch_setup(setup: &std::path::Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x0000_0008;
        std::process::Command::new(setup)
            .arg("--update")
            .creation_flags(DETACHED_PROCESS)
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("Couldn't start the installer: {e}"))
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = setup;
        Err("Updates can only be installed on Windows.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn release(tag: &str, assets: Vec<Asset>) -> Release {
        Release {
            tag_name: tag.into(),
            body: Some("notes".into()),
            html_url: "https://github.com/x".into(),
            draft: false,
            prerelease: false,
            assets,
        }
    }

    fn setup_asset(digest: Option<&str>) -> Asset {
        Asset {
            name: "AuraDrop-Setup-0.3.0.exe".into(),
            browser_download_url: "https://github.com/x/AuraDrop-Setup-0.3.0.exe".into(),
            size: 10,
            digest: digest.map(Into::into),
        }
    }

    #[test]
    fn compares_versions() {
        assert!(is_newer("v0.10.0", "0.9.9"));
        assert!(is_newer("1.0.0", "0.99.0"));
        assert!(!is_newer("0.2.0", "0.2.0"));
        assert!(!is_newer("v0.1.9", "0.2.0"));
    }

    #[test]
    fn picks_newer_release_with_setup() {
        let sha = "a".repeat(64);
        let info = pick_update(
            release("v0.3.0", vec![setup_asset(Some(&format!("sha256:{sha}")))]),
            "0.2.0",
        )
        .unwrap();
        assert_eq!(info.version, "0.3.0");
        assert_eq!(info.sha256.as_deref(), Some(sha.as_str()));
        assert!(pick_update(release("v0.2.0", vec![setup_asset(None)]), "0.2.0").is_none());
        // No installer attached: nothing to update to.
        assert!(pick_update(release("v0.3.0", vec![]), "0.2.0").is_none());
        // Garbage digests are ignored rather than trusted.
        let info = pick_update(
            release("v0.3.0", vec![setup_asset(Some("sha256:xyz"))]),
            "0.2.0",
        )
        .unwrap();
        assert!(info.sha256.is_none());
        let mut pre = release("v0.3.0", vec![setup_asset(None)]);
        pre.prerelease = true;
        assert!(pick_update(pre, "0.2.0").is_none());
    }
}
