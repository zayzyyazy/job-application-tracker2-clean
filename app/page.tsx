import Link from "next/link";
import RecommendedJobsSection from "@/app/components/recommended-jobs-section";
import { ServerPageError } from "@/app/components/server-page-error";
import { formatJobDate } from "@/lib/job-display";
import {
  aggregateSkillsFromJobs,
  highPriorityApplyNext,
  jobsNeedingAnalysis,
  jobsNeedingContentFetch,
  upcomingDeadlinesWithinDays,
} from "@/lib/dashboard-insights";
import { prisma } from "@/lib/prisma";
import { formatErrorForUi, logServerError } from "@/lib/server-log";

const SKILL_PREVIEW = 12;
const LIST_MAX = 8;

export default async function DashboardPage() {
  let allJobs;
  try {
    allJobs = await prisma.job.findMany();
  } catch (e) {
    logServerError("DashboardPage", e);
    return (
      <ServerPageError
        title="Dashboard couldn’t load"
        message={formatErrorForUi(e)}
      />
    );
  }


  const analyzedJobs = allJobs.filter((j) => j.aiLastAnalyzedAt != null);
  const topNeeded = aggregateSkillsFromJobs(analyzedJobs, "needed").slice(0, SKILL_PREVIEW);
  const topMissing = aggregateSkillsFromJobs(analyzedJobs, "missing").slice(0, SKILL_PREVIEW);

  const needAnalysis = jobsNeedingAnalysis(allJobs).slice(0, LIST_MAX);
  const needFetch = jobsNeedingContentFetch(allJobs).slice(0, LIST_MAX);
  const applyNext = highPriorityApplyNext(allJobs, LIST_MAX);
  const deadlinesSoon = upcomingDeadlinesWithinDays(allJobs, 14);

  const totalJobs = allJobs.length;
  const needAnalysisCount = jobsNeedingAnalysis(allJobs).length;
  const needFetchCount = jobsNeedingContentFetch(allJobs).length;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-300">
        What to do next: skills across analyzed jobs, gaps to close, and jobs that need a fetch or
        AI pass.
      </p>

      <section className="mt-6 flex flex-wrap gap-3">
        <div className="rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Tracked</p>
          <p className="text-xl font-semibold">{totalJobs}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Need AI analysis</p>
          <p className="text-xl font-semibold">{needAnalysisCount}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Need content fetch</p>
          <p className="text-xl font-semibold">{needFetchCount}</p>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold">Top skills needed (roles)</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Aggregated from <strong>AI “skills needed”</strong> on analyzed jobs — count = how many
            postings mention each skill.
          </p>
          {topNeeded.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              No analyzed jobs yet. Run <strong>Analyze</strong> on a few saved jobs in the{" "}
              <Link href="/tracker" className="text-blue-600 underline dark:text-blue-400">
                tracker
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {topNeeded.map(({ skill, count }) => (
                <li key={skill}>
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-950 dark:bg-sky-950/60 dark:text-sky-100">
                    {skill}
                    <span className="rounded-full bg-white/80 px-1.5 text-[10px] text-sky-800 dark:bg-sky-900 dark:text-sky-200">
                      ×{count}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold">Top skills you may be missing</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            From <strong>AI missing skills</strong> — use this to prioritize learning or filter roles.
          </p>
          {topMissing.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Nothing aggregated yet — analyze jobs first.
            </p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {topMissing.map(({ skill, count }) => (
                <li key={skill}>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-950 dark:bg-amber-950/50 dark:text-amber-100">
                    {skill}
                    <span className="rounded-full bg-white/80 px-1.5 text-[10px] text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                      ×{count}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-base font-semibold">Apply next (high priority)</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Saved roles you&apos;ve analyzed that aren&apos;t marked skip — sorted by fit, urgency, and
          deadlines.
        </p>
        {applyNext.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            No candidates yet — save jobs and run analysis, or adjust filters in recommendations
            below.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {applyNext.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/tracker#job-${job.id}`}
                  className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  {job.title?.trim() || "Untitled role"}
                </Link>
                <span className="text-sm text-zinc-500">
                  {" "}
                  · {job.company?.trim() || "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-amber-200/80 bg-amber-50/30 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <h2 className="text-base font-semibold text-amber-950 dark:text-amber-100">
            Jobs needing analysis
          </h2>
          <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/90">
            No AI run yet — harder to compare fit and skills.
          </p>
          {needAnalysis.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">All jobs analyzed. ✓</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {needAnalysis.map((job) => (
                <li key={job.id} className="text-sm">
                  <Link
                    href={`/tracker#job-${job.id}`}
                    className="font-medium text-blue-700 hover:underline dark:text-blue-400"
                  >
                    {job.title?.trim() || "Untitled"}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-sky-200/80 bg-sky-50/30 p-4 dark:border-sky-900/40 dark:bg-sky-950/20">
          <h2 className="text-base font-semibold text-sky-950 dark:text-sky-100">
            Jobs needing content fetch
          </h2>
          <p className="mt-1 text-xs text-sky-900/80 dark:text-sky-200/90">
            Fetch pulls posting text so analysis is grounded in the real description.
          </p>
          {needFetch.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
              Everyone has fetched text or a successful fetch. ✓
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {needFetch.map((job) => (
                <li key={job.id} className="text-sm">
                  <Link
                    href={`/tracker#job-${job.id}`}
                    className="font-medium text-blue-700 hover:underline dark:text-blue-400"
                  >
                    {job.title?.trim() || "Untitled"}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-base font-semibold">Upcoming deadlines (14 days)</h2>
        {deadlinesSoon.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            No deadlines in the next two weeks (excluding offer/rejected).
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {deadlinesSoon.map((job) => (
              <li key={job.id} className="flex flex-wrap justify-between gap-2 text-sm">
                <Link
                  href={`/tracker#job-${job.id}`}
                  className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  {job.title?.trim() || "Untitled"}
                </Link>
                <span className="text-zinc-600 dark:text-zinc-400">
                  {job.deadline ? formatJobDate(job.deadline) : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RecommendedJobsSection jobs={allJobs} limitPerGroup={3} anchorBase="/tracker" />
    </main>
  );
}
