import type { Job } from "@prisma/client";
import {
  getBadgeTone,
  parseJsonStringArray,
} from "@/lib/job-display";

/**
 * Prominent, scannable AI block: fit / action / urgency plus skill chips.
 * Use on job cards; pair with a compact table cell variant below.
 */
export function JobAiInsightsBlock({ job }: { job: Job }) {
  if (!job.aiLastAnalyzedAt) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        No AI analysis yet. Run <strong>Analyze</strong> or{" "}
        <strong>Fetch + Analyze</strong> to see skills and fit.
      </p>
    );
  }

  const needed = parseJsonStringArray(job.aiSkillsNeeded);
  const missing = parseJsonStringArray(job.aiMissingSkills);

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-1.5">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${getBadgeTone(job.aiFitLabel)}`}
        >
          Fit: {job.aiFitLabel ?? "—"}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${getBadgeTone(job.aiActionRecommendation)}`}
        >
          Action: {job.aiActionRecommendation ?? "—"}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${getBadgeTone(job.aiUrgency)}`}
        >
          Urgency: {job.aiUrgency ?? "—"}
        </span>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-300">
          Skills needed (role)
        </p>
        {needed.length === 0 ? (
          <p className="mt-1 text-xs text-zinc-500">None listed by AI.</p>
        ) : (
          <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Skills needed">
            {needed.map((s) => (
              <li key={s}>
                <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900 dark:bg-sky-950/80 dark:text-sky-100">
                  {s}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
          You may be missing
        </p>
        {missing.length === 0 ? (
          <p className="mt-1 text-xs text-zinc-500">None flagged — or overlap with your profile.</p>
        ) : (
          <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Skills you may be missing">
            {missing.map((s) => (
              <li key={s}>
                <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-950 dark:bg-amber-950/50 dark:text-amber-100">
                  {s}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
