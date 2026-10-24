#!/usr/bin/env node
// Runs the Tauri CLI against one of the two Tauri projects in this repo.
// The repo has two (the app and its installer), so the CLI is told which
// one explicitly instead of guessing:
//   node scripts/tauri.mjs <args>             -> src-tauri (AuraDrop)
//   node scripts/tauri.mjs --setup <args>     -> installer/src-tauri (Setup)
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const setup = args[0] === "--setup";
if (setup) args.shift();
const app = join(root, setup ? "installer/src-tauri" : "src-tauri");
const cli = join(root, "node_modules/.bin", process.platform === "win32" ? "tauri.cmd" : "tauri");
const result = spawnSync(cli, args, {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, TAURI_APP_PATH: app, TAURI_FRONTEND_PATH: dirname(app) },
});
process.exit(result.status ?? 1);
