/**
 * After `next build` (standalone output), copy the Next.js server bundle and
 * static assets into src-tauri/resources for Tauri to package.
 * Also ensures a minimal `out/` exists for the Tauri bundler (webview uses the local Next server).
 *
 * Next.js (Turbopack) can emit server chunks that call `require("@prisma/client-<hash>")`.
 * That name is a bundler "external" id, not a real package. The standalone `node_modules`
 * from file tracing does not include it, so we add tiny shim packages that re-export
 * `@prisma/client` (and verify `require()` works from the bundle root).
 */
import fs from "fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const standaloneSrc = path.join(root, ".next", "standalone");
const staticSrc = path.join(root, ".next", "static");
const publicSrc = path.join(root, "public");
const prismaSrc = path.join(root, "prisma");
const dest = path.join(root, "src-tauri", "resources", "next-server");
const outDir = path.join(root, "out");

/** Turbopack-style Prisma external module id (hash length can vary). */
const PRISMA_EXTERNAL_RE = /@prisma\/client-[0-9a-f]+/g;

function* walkFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walkFiles(p);
    else yield p;
  }
}

function findPrismaExternalIds(serverDir) {
  const ids = new Set();
  for (const file of walkFiles(serverDir)) {
    if (!file.endsWith(".js")) continue;
    let content;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    let m;
    PRISMA_EXTERNAL_RE.lastIndex = 0;
    while ((m = PRISMA_EXTERNAL_RE.exec(content)) !== null) {
      ids.add(m[0]);
    }
  }
  return [...ids].sort();
}

function installPrismaExternalShims(bundleRoot, packageNames) {
  for (const name of packageNames) {
    const rel = path.join("node_modules", ...name.split("/"));
    const dir = path.join(bundleRoot, rel);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify(
        {
          name,
          version: "0.0.0",
          private: true,
          main: "index.js",
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(dir, "index.js"),
      '"use strict";\nmodule.exports = require("@prisma/client");\n',
      "utf8",
    );
  }
}

function verifyRequiresFromBundleRoot(bundleRoot, packageNames) {
  const script = packageNames
    .map((n) => `require(${JSON.stringify(n)});`)
    .join("\n");
  const result = spawnSync(process.execPath, ["-e", script], {
    cwd: bundleRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(
      "[tauri:prepare-bundle] Prisma shim verification failed:\n",
      result.stderr || result.stdout,
    );
    process.exit(1);
  }
}

if (!fs.existsSync(standaloneSrc)) {
  console.error(
    "[tauri:prepare-bundle] Missing .next/standalone. Run `npm run build` first.",
  );
  process.exit(1);
}

fs.mkdirSync(dest, { recursive: true });
fs.cpSync(standaloneSrc, dest, { recursive: true });
fs.cpSync(staticSrc, path.join(dest, ".next", "static"), { recursive: true });
if (fs.existsSync(publicSrc)) {
  fs.cpSync(publicSrc, path.join(dest, "public"), { recursive: true });
}
if (fs.existsSync(prismaSrc)) {
  fs.cpSync(prismaSrc, path.join(dest, "prisma"), { recursive: true });
}

const serverDir = path.join(dest, ".next", "server");
const prismaExternals = findPrismaExternalIds(serverDir);
if (prismaExternals.length > 0) {
  console.log(
    "[tauri:prepare-bundle] Prisma Turbopack externals (shims):",
    prismaExternals.join(", "),
  );
  installPrismaExternalShims(dest, prismaExternals);
  verifyRequiresFromBundleRoot(dest, prismaExternals);
  console.log("[tauri:prepare-bundle] Verified require() for Prisma externals.");
} else {
  console.log(
    "[tauri:prepare-bundle] No @prisma/client-<hash> externals found in .next/server (ok if unused).",
  );
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "index.html"),
  `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Job Application Tracker</title></head><body></body></html>\n`,
  "utf8",
);

console.log("[tauri:prepare-bundle] Wrote", dest, "and", outDir);
