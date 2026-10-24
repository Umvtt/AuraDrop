#!/usr/bin/env node
// Builds AuraDrop-Setup.exe:
//   1. AuraDrop's own NSIS installer (the "payload"),
//   2. the glass setup app with that payload embedded.
// On Windows this uses the normal toolchain; elsewhere it cross-compiles
// with cargo-xwin (`cargo install cargo-xwin`, plus `makensis` on PATH).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(root, "src-tauri/tauri.conf.json"), "utf8")).version;
const onWindows = process.platform === "win32";
const target = "x86_64-pc-windows-msvc";
const cross = onWindows ? [] : ["--runner", "cargo-xwin", "--target", target];
const releaseDir = (crate) => join(root, crate, "target", ...(onWindows ? [] : [target]), "release");

function tauri(appPath, args, env = {}) {
  const cli = join(root, "node_modules/.bin", onWindows ? "tauri.cmd" : "tauri");
  console.log(`\n> tauri ${args.join(" ")}   (${appPath})`);
  execFileSync(cli, args, {
    cwd: root,
    stdio: "inherit",
    shell: onWindows,
    env: { ...process.env, TAURI_APP_PATH: join(root, appPath), TAURI_FRONTEND_PATH: dirname(join(root, appPath)), ...env },
  });
}

// 1. The payload: AuraDrop's NSIS installer.
tauri("src-tauri", ["build", "--bundles", "nsis", ...cross]);
const appRelease = releaseDir("src-tauri");
const payload = join(appRelease, "bundle/nsis", `AuraDrop_${version}_x64-setup.exe`);
if (!existsSync(payload)) throw new Error(`Payload not found: ${payload}`);
mkdirSync(join(root, "installer/src-tauri/payload"), { recursive: true });
copyFileSync(payload, join(root, "installer/src-tauri/payload/AuraDrop-payload.exe"));
const appBytes = statSync(join(appRelease, "auradrop.exe")).size;

// 2. The glass setup app with the payload embedded.
tauri("installer/src-tauri", ["build", "--no-bundle", ...cross], {
  AURADROP_REQUIRE_PAYLOAD: "1",
  AURADROP_APP_BYTES: String(appBytes),
});
const setupExe = join(releaseDir("installer/src-tauri"), "AuraDrop-Setup.exe");
const outDir = join(root, "dist-installer");
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `AuraDrop-Setup-${version}.exe`);
copyFileSync(setupExe, out);

const sha = createHash("sha256").update(readFileSync(out)).digest("hex");
console.log(`\nBuilt ${out}\n  ${(statSync(out).size / 1024 / 1024).toFixed(1)} MB  sha256 ${sha}`);
