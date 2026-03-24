import path from "node:path";

/**
 * SQLite connection URL for Prisma (runtime + CLI).
 *
 * Priority:
 * 1. `DATABASE_URL` — full Prisma connection string (e.g. `file:./dev.db` or `file:/data/app.db`)
 * 2. Railway persistent volume — `RAILWAY_VOLUME_MOUNT_PATH` (or `SQLITE_DATA_DIR`) + `SQLITE_DATABASE_NAME` (default `app.db`)
 * 3. Local dev default — `file:./dev.db`
 *
 * Railway sets `RAILWAY_VOLUME_MOUNT_PATH` at runtime when a volume is attached (not during build).
 */
export function resolveDatabaseUrl(): string {
  const explicit = process.env.DATABASE_URL?.trim();
  if (explicit) {
    return explicit;
  }

  const mount =
    process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim() ||
    process.env.SQLITE_DATA_DIR?.trim();

  if (mount) {
    const fileName = process.env.SQLITE_DATABASE_NAME?.trim() || "app.db";
    const dir = path.isAbsolute(mount)
      ? mount
      : path.join(/* turbopackIgnore: true */ process.cwd(), mount);
    const fullPath = path.join(dir, fileName);
    return `file:${fullPath}`;
  }

  return "file:./dev.db";
}
