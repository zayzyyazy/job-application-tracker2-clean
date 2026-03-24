import { type Job } from "@prisma/client";
import AnalyzeJobForm from "@/app/components/analyze-job-form";
import FetchAndAnalyzeJobForm from "@/app/components/fetch-and-analyze-job-form";
import FetchJobContentForm from "@/app/components/fetch-job-content-form";
import {
  computePriorityScore,
  groupRecommendedJobs,
  isDeadlineSoon,
  isNotAppliedYet,
} from "@/lib/job-recommendations";

function formatDeadline(job: Job): string {
  if (!job.deadline) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(job.deadline);
}

function JobRow({ job, anchorBase }: { job: Job; anchorBase: string }) {
  const score = computePriorityScore(job);
  const highPriority = score >= 8 || job.aiUrgency?.toUpperCase() === "HIGH";
  const soon = isDeadlineSoon(job, 14);
  const strong = job.aiFitLabel?.toUpperCase() === "HIGH";

  return (
    <div
      className={`flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between ${
        highPriority
          ? "border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30"
          : "border-zinc-200 dark:border-zinc-700"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">
            {job.title?.trim() || "Untitled role"}
          </span>
          {isNotAppliedYet(job) ? (
            <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
              Not applied yet
            </span>
          ) : null}
          {highPriority ? <span title="High priority">🔥</span> : null}
          {soon ? <span title="Deadline soon">⏳</span> : null}
          {strong ? <span title="Strong match">🎯</span> : null}
        </div>
        <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">
          {job.company?.trim() || "Unknown company"}
        </p>
        <div className="mt-1 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
            Fit: {job.aiFitLabel ?? "—"}
          </span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
            Urgency: {job.aiUrgency ?? "—"}
          </span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
            Due: {formatDeadline(job)}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FetchJobContentForm id={job.id} />
        <AnalyzeJobForm id={job.id} />
        <FetchAndAnalyzeJobForm id={job.id} />
        <a
          href={`${anchorBase}#job-${job.id}`}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600"
        >
          Open
        </a>
      </div>
    </div>
  );
}

function GroupBlock({
  title,
  description,
  jobs,
  anchorBase,
}: {
  title: string;
  description: string;
  jobs: Job[];
  anchorBase: string;
}) {
  if (jobs.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
        {title}
      </h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
      <div className="mt-2 space-y-2">
        {jobs.map((job) => (
          <JobRow key={job.id} job={job} anchorBase={anchorBase} />
        ))}
      </div>
    </div>
  );
}

type RecommendedJobsSectionProps = {
  jobs: Job[];
  /** When set, only show up to this many jobs per group (dashboard preview). */
  limitPerGroup?: number;
  /** Base path for deep links to a job card (default: tracker). */
  anchorBase?: string;
};

export default function RecommendedJobsSection({
  jobs,
  limitPerGroup,
  anchorBase = "/tracker",
}: RecommendedJobsSectionProps) {
  const grouped = groupRecommendedJobs(jobs);
  const slice = (list: Job[]) =>
    typeof limitPerGroup === "number" ? list.slice(0, limitPerGroup) : list;

  const topMatches = slice(grouped.topMatches);
  const applySoon = slice(grouped.applySoon);
  const maybe = slice(grouped.maybe);
  const lowPriority = slice(grouped.lowPriority);

  const total =
    topMatches.length +
    applySoon.length +
    maybe.length +
    lowPriority.length;

  if (total === 0) {
    return (
      <details open className="mt-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <summary className="cursor-pointer text-lg font-semibold">
          Recommended Jobs
        </summary>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          No recommendations yet. Save jobs with status &quot;Saved&quot;, run{" "}
          <strong>Analyze</strong> (or <strong>Fetch + Analyze</strong>) to get fit
          and urgency labels — then this section fills automatically.
        </p>
      </details>
    );
  }

  return (
    <details open className="mt-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <summary className="cursor-pointer text-lg font-semibold">
        Recommended Jobs
        <span className="ml-2 text-sm font-normal text-zinc-500">
          ({total} in focus)
        </span>
      </summary>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Simple rules: priority score combines AI fit, urgency, deadlines, and
        missing skills. Each job appears in at most one group.
        {typeof limitPerGroup === "number" ? (
          <span className="ml-1 font-medium">
            Showing up to {limitPerGroup} per group on this page.
          </span>
        ) : null}
      </p>
      <div className="mt-4 space-y-6">
        <GroupBlock
          title="Top matches"
          description="High fit, not applied yet."
          jobs={topMatches}
          anchorBase={anchorBase}
        />
        <GroupBlock
          title="Apply soon"
          description="High urgency or deadline within 14 days, not applied yet."
          jobs={applySoon}
          anchorBase={anchorBase}
        />
        <GroupBlock
          title="Maybe"
          description="Medium fit, not applied yet."
          jobs={maybe}
          anchorBase={anchorBase}
        />
        <GroupBlock
          title="Low priority / Skip"
          description="Low fit or AI suggests skip, not applied yet."
          jobs={lowPriority}
          anchorBase={anchorBase}
        />
      </div>
    </details>
  );
}
