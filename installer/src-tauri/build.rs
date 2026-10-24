//! Embeds the AuraDrop NSIS installer ("the payload") into the setup exe.
//!
//! `npm run installer:build` builds the payload and copies it to
//! `payload/AuraDrop-payload.exe` before building this crate. Without it a
//! development build still compiles, but installing reports that the payload
//! is missing; set AURADROP_REQUIRE_PAYLOAD=1 to make that a build error.

use sha2::{Digest, Sha256};
use std::path::Path;

fn main() {
    let payload = Path::new("payload/AuraDrop-payload.exe");
    println!("cargo:rerun-if-changed=payload/AuraDrop-payload.exe");
    println!("cargo:rerun-if-changed=../../src-tauri/tauri.conf.json");
    println!("cargo:rerun-if-env-changed=AURADROP_REQUIRE_PAYLOAD");
    println!("cargo:rerun-if-env-changed=AURADROP_APP_BYTES");

    let out_dir = std::env::var("OUT_DIR").unwrap();
    let embedded = Path::new(&out_dir).join("payload.bin");
    let bytes = std::fs::read(payload).unwrap_or_default();
    if bytes.is_empty() && std::env::var("AURADROP_REQUIRE_PAYLOAD").as_deref() == Ok("1") {
        panic!("payload/AuraDrop-payload.exe is missing. Run `npm run installer:build`.");
    }
    std::fs::write(&embedded, &bytes).unwrap();
    println!(
        "cargo:rustc-env=AURADROP_PAYLOAD_PATH={}",
        embedded.display()
    );
    println!(
        "cargo:rustc-env=AURADROP_PAYLOAD_SHA256={:x}",
        Sha256::digest(&bytes)
    );

    // The version being installed comes from the app's own config.
    let conf: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string("../../src-tauri/tauri.conf.json").unwrap())
            .unwrap();
    println!(
        "cargo:rustc-env=AURADROP_VERSION={}",
        conf["version"].as_str().unwrap()
    );
    // Installed size shown on the welcome page (the build script passes the
    // real exe size; fall back to an estimate from the compressed payload).
    let app_bytes = std::env::var("AURADROP_APP_BYTES")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(bytes.len() as u64 * 5 / 2);
    println!("cargo:rustc-env=AURADROP_APP_BYTES={app_bytes}");

    // Declare asInvoker explicitly so Windows never treats "…Setup.exe" as a
    // legacy installer and elevates it: AuraDrop installs per user, and an
    // elevated setup could install into the administrator's profile instead.
    let manifest = r#"<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <dependency>
    <dependentAssembly>
      <assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0"
        processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*" />
    </dependentAssembly>
  </dependency>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="asInvoker" uiAccess="false" />
      </requestedPrivileges>
    </security>
  </trustInfo>
</assembly>"#;
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .windows_attributes(tauri_build::WindowsAttributes::new().app_manifest(manifest)),
    )
    .expect("failed to run tauri-build");
}
