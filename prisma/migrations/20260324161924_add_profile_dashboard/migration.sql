-- CreateTable
CREATE TABLE "Profile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fullName" TEXT,
    "headline" TEXT,
    "university" TEXT,
    "degreeProgram" TEXT,
    "currentSemester" TEXT,
    "bio" TEXT,
    "targetRoles" JSONB,
    "preferredLocations" JSONB,
    "skills" JSONB,
    "tools" JSONB,
    "interests" JSONB,
    "workPreferences" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
