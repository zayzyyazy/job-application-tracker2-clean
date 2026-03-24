-- CreateTable
CREATE TABLE "Job" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "company" TEXT,
    "title" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SAVED',
    "appliedAt" DATETIME,
    "deadline" DATETIME,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "skillsNeeded" JSONB,
    "fitScore" REAL,
    "aiSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
