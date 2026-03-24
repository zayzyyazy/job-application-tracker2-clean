-- AlterTable
ALTER TABLE "Job" ADD COLUMN "aiActionRecommendation" TEXT;
ALTER TABLE "Job" ADD COLUMN "aiFitLabel" TEXT;
ALTER TABLE "Job" ADD COLUMN "aiFitReasoning" TEXT;
ALTER TABLE "Job" ADD COLUMN "aiLastAnalyzedAt" DATETIME;
ALTER TABLE "Job" ADD COLUMN "aiMissingSkills" JSONB;
ALTER TABLE "Job" ADD COLUMN "aiRawSummary" TEXT;
ALTER TABLE "Job" ADD COLUMN "aiRoleCategory" TEXT;
ALTER TABLE "Job" ADD COLUMN "aiSeniority" TEXT;
ALTER TABLE "Job" ADD COLUMN "aiSkillsNeeded" JSONB;
ALTER TABLE "Job" ADD COLUMN "aiUrgency" TEXT;
