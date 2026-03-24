-- AlterTable
ALTER TABLE "Job" ADD COLUMN "fetchError" TEXT;
ALTER TABLE "Job" ADD COLUMN "fetchStatus" TEXT;
ALTER TABLE "Job" ADD COLUMN "fetchedAt" DATETIME;
ALTER TABLE "Job" ADD COLUMN "fetchedContentSource" TEXT;
ALTER TABLE "Job" ADD COLUMN "fetchedContentText" TEXT;
ALTER TABLE "Job" ADD COLUMN "fetchedTitle" TEXT;
