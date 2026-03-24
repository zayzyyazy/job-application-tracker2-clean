/**
 * Unset CI for the child process: when CI=1, @tauri-apps/cli treats it as --ci=1
 * which is invalid (expects true/false). Cursor and many CI systems set CI=1.
 */
import { spawnSync } from "node:child_process";

const env = { ...process.env };
delete env.CI;

const r = spawnSync("npx", ["tauri", "build"], {
  stdio: "inherit",
  env,
  shell: true,
});

process.exit(r.status ?? 1);
