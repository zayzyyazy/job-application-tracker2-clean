import { JobStatus, type Job } from "@prisma/client";
import { parseJsonStringArray } from "@/lib/job-display";
import { computePriorityScore } from "@/lib/job-recommendations";

export type SkillCount = {
  skill: string;
  count: number;
};

function normalizeSkillKey(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Aggregate skills from `aiSkillsNeeded` / `aiMissingSkills` JSON arrays across jobs.
 * Counts how many analyzed jobs mention each skill (case-insensitive merge, display label = first seen casing).
 */
export function aggregateSkillsFromJobs(
  jobs: Job[],
  field: "needed" | "missing",
): SkillCount[] {
  const map = new Map<string, { label: string; count: number }>();

  for (const job of jobs) {
    const raw =
      field === "needed" ? job.aiSkillsNeeded : job.aiMissingSkills;
    const list = parseJsonStringArray(raw);
    const seenInJob = new Set<string>();
    for (const s of list) {
      const trimmed = s.trim();
      if (!trimmed) continue;
      const key = normalizeSkillKey(trimmed);
      if (seenInJob.has(key)) continue;
      seenInJob.add(key);
      const cur = map.get(key);
      if (cur) {
        cur.count += 1;
      } else {
        map.set(key, { label: trimmed, count: 1 });
      }
    }
  }

  return [...map.values()]
    .map(({ label, count }) => ({ skill: label, count }))
    .sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill));
}

export function jobsNeedingAnalysis(jobs: Job[]): Job[] {
  return jobs.filter((j) => !j.aiLastAnalyzedAt);
}

export function jobsNeedingContentFetch(jobs: Job[]): Job[] {
  return jobs.filter((j) => {
    const ok = j.fetchStatus === "SUCCESS";
    const hasText =
      typeof j.fetchedContentText === "string" && j.fetchedContentText.trim().length > 0;
    return !ok || !hasText;
  });
}

export function upcomingDeadlinesWithinDays(
  jobs: Job[],
  withinDays: number,
): Job[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + withinDays);

  return jobs.filter((job) => {
    if (!job.deadline) return false;
    if (job.status === JobStatus.REJECTED || job.status === JobStatus.OFFER) {
      return false;
    }
    const d = new Date(job.deadline);
    d.setHours(0, 0, 0, 0);
    return d >= today && d <= end;
  });
}

/**
 * Saved jobs that look worth applying to next: analyzed, not yet past pipeline, sorted by priority score.
 */
export function highPriorityApplyNext(jobs: Job[], limit = 8): Job[] {
  const candidates = jobs.filter(
    (j) =>
      j.status === JobStatus.SAVED &&
      j.aiLastAnalyzedAt != null &&
      j.aiActionRecommendation?.toUpperCase() !== "SKIP",
  );
  return [...candidates]
    .sort((a, b) => computePriorityScore(b) - computePriorityScore(a))
    .slice(0, limit);
}
