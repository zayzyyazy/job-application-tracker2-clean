import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "@/lib/database-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const databaseUrl = resolveDatabaseUrl();

/** Longer busy timeout helps Tauri + SQLite when navigation and actions overlap. */
const adapter = new PrismaBetterSqlite3({
  url: databaseUrl,
  timeout: 20_000,
});

const prismaClientSingleton = () =>
  new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

globalForPrisma.prisma = prisma;
