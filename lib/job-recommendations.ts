import { JobStatus, type Job } from "@prisma/client";

/** Parsed AI labels — adjust rules in computePriorityScore below. */
export function parseJsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function daysUntilDeadline(deadline: Date | null): number | null {
  if (!deadline) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(deadline);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - today.getTime()) / 86400000);
}

/**
 * Simple priority score for sorting and badges (not stored in DB).
 * Tune the numbers here as you learn what works.
 */
export function computePriorityScore(job: Job): number {
  let score = 0;

  const fit = job.aiFitLabel?.toUpperCase() ?? "";
  if (fit === "HIGH") score += 3;
  else if (fit === "MEDIUM") score += 2;
  else if (fit === "LOW") score += 1;

  const urg = job.aiUrgency?.toUpperCase() ?? "";
  if (urg === "HIGH") score += 2;
  else if (urg === "MEDIUM") score += 1;

  const days = daysUntilDeadline(job.deadline);
  if (days !== null && days >= 0 && days <= 7) score += 2;
  else if (days !== null && days >= 0 && days <= 14) score += 1;

  const pastPipeline =
    job.status === JobStatus.APPLIED ||
    job.status === JobStatus.HEARD_BACK ||
    job.status === JobStatus.INTERVIEW ||
    job.status === JobStatus.REJECTED ||
    job.status === JobStatus.OFFER;
  if (pastPipeline) score -= 2;

  const missingCount = parseJsonStringArray(job.aiMissingSkills).length;
  if (missingCount >= 4) score -= 2;
  else if (missingCount >= 2) score -= 1;

  return score;
}

export function isNotAppliedYet(job: Job): boolean {
  return job.status === JobStatus.SAVED;
}

export function isDeadlineSoon(job: Job, withinDays = 14): boolean {
  const days = daysUntilDeadline(job.deadline);
  return days !== null && days >= 0 && days <= withinDays;
}

export type RecommendationGroup = "topMatches" | "applySoon" | "maybe" | "lowPriority";

export type GroupedRecommendations = {
  topMatches: Job[];
  applySoon: Job[];
  maybe: Job[];
  lowPriority: Job[];
};

/**
 * Assign each job to at most one group. Order: Top Matches → Apply Soon → Maybe → Low Priority.
 */
export function groupRecommendedJobs(jobs: Job[]): GroupedRecommendations {
  const used = new Set<number>();

  const topMatches: Job[] = [];
  const applySoon: Job[] = [];
  const maybe: Job[] = [];
  const lowPriority: Job[] = [];

  const sortByScore = (a: Job, b: Job) =>
    computePriorityScore(b) - computePriorityScore(a);

  for (const job of jobs) {
    if (!isNotAppliedYet(job)) continue;
    if (job.aiFitLabel?.toUpperCase() === "HIGH") {
      topMatches.push(job);
      used.add(job.id);
    }
  }
  topMatches.sort(sortByScore);

  for (const job of jobs) {
    if (used.has(job.id)) continue;
    if (!isNotAppliedYet(job)) continue;
    const urgent = job.aiUrgency?.toUpperCase() === "HIGH";
    const soon = isDeadlineSoon(job, 14);
    if (urgent || soon) {
      applySoon.push(job);
      used.add(job.id);
    }
  }
  applySoon.sort(sortByScore);

  for (const job of jobs) {
    if (used.has(job.id)) continue;
    if (!isNotAppliedYet(job)) continue;
    if (job.aiActionRecommendation?.toUpperCase() === "SKIP") continue;
    if (job.aiFitLabel?.toUpperCase() === "MEDIUM") {
      maybe.push(job);
      used.add(job.id);
    }
  }
  maybe.sort(sortByScore);

  for (const job of jobs) {
    if (used.has(job.id)) continue;
    if (!isNotAppliedYet(job)) continue;
    const lowFit = job.aiFitLabel?.toUpperCase() === "LOW";
    const skip = job.aiActionRecommendation?.toUpperCase() === "SKIP";
    if (lowFit || skip) {
      lowPriority.push(job);
      used.add(job.id);
    }
  }
  lowPriority.sort(sortByScore);

  return { topMatches, applySoon, maybe, lowPriority };
}
