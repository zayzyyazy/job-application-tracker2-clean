import { JobStatus, type Job } from "@prisma/client";
import AnalyzeJobForm from "@/app/components/analyze-job-form";
import DeleteJobForm from "@/app/components/delete-job-form";
import EditJobForm from "@/app/components/edit-job-form";
import FetchAndAnalyzeJobForm from "@/app/components/fetch-and-analyze-job-form";
import FetchJobContentForm from "@/app/components/fetch-job-content-form";
import JobStatusForm from "@/app/components/job-status-form";
import {
  formatDateInputValue,
  formatJobDate,
  getDeadlineMeta,
  getFetchStatusTone,
  safeJobStatusLabel,
  statusBadgeClassForStatus,
} from "@/lib/job-display";
import { JobAiInsightsBlock } from "@/app/components/job-ai-insights";
import { computePriorityScore } from "@/lib/job-recommendations";

type TrackerJobCardProps = {
  job: Job;
};

export default function TrackerJobCard({ job }: TrackerJobCardProps) {
  const priorityScore = computePriorityScore(job);
  const highlight = priorityScore >= 8;

  return (
    <article
      id={`job-${job.id}`}
      className={`scroll-mt-24 rounded-md border p-4 ${
        highlight
          ? "border-amber-300 bg-amber-50/40 ring-1 ring-amber-200/60 dark:border-amber-800 dark:bg-amber-950/20 dark:ring-amber-900/40"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">
            {job.title?.trim() || "Untitled role"}
            {job.status === JobStatus.SAVED ? (
              <span className="ml-2 align-middle text-xs font-normal text-zinc-500">
                · Not applied yet
              </span>
            ) : null}
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {job.company?.trim() || "Unknown company"}
            {" • "}
            {job.location?.trim() || "No location"}
          </p>
        </div>
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClassForStatus(job.status)}`}
        >
          {safeJobStatusLabel(job.status)}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-sm text-zinc-700 dark:text-zinc-300 md:grid-cols-2">
        <p>
          <span className="font-medium">Created:</span> {formatJobDate(job.createdAt)}
        </p>
        <p>
          <span className="font-medium">Deadline:</span>{" "}
          <span className={getDeadlineMeta(job.deadline, job.status).className}>
            {getDeadlineMeta(job.deadline, job.status).label}
          </span>
        </p>
        <p className="md:col-span-2">
          <span className="font-medium">URL:</span>{" "}
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="break-all text-blue-600 underline dark:text-blue-400"
          >
            {job.url}
          </a>
        </p>
        {job.notes ? (
          <p className="md:col-span-2">
            <span className="font-medium">Notes:</span> {String(job.notes).slice(0, 140)}
            {String(job.notes).length > 140 ? "..." : ""}
          </p>
        ) : null}
      </div>

      <section
        className="mt-4 rounded-lg border border-indigo-200/80 bg-indigo-50/30 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/20"
        aria-label="AI insights"
      >
        <h4 className="text-xs font-semibold uppercase tracking-wide text-indigo-900 dark:text-indigo-200">
          AI at a glance
        </h4>
        <div className="mt-2">
          <JobAiInsightsBlock job={job} />
        </div>
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <FetchJobContentForm id={job.id} />
        <AnalyzeJobForm id={job.id} />
        <FetchAndAnalyzeJobForm id={job.id} />
        <JobStatusForm id={job.id} status={job.status} />

        <details>
          <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Edit
          </summary>
          <EditJobForm
            job={job}
            deadlineInputValue={formatDateInputValue(job.deadline)}
          />
        </details>

        <details>
          <summary className="cursor-pointer text-sm font-medium text-red-600 dark:text-red-400">
            Delete
          </summary>
          <DeleteJobForm id={job.id} />
        </details>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Fetched Content
        </summary>
        <div className="mt-2 rounded-md border border-sky-200 bg-sky-50/40 p-3 text-sm dark:border-sky-900/50 dark:bg-sky-950/20">
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-full px-2 py-1 text-xs font-medium ${getFetchStatusTone(job.fetchStatus)}`}
            >
              Fetch status: {job.fetchStatus ?? "NOT_FETCHED"}
            </span>
            <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium dark:bg-zinc-800">
              Last fetched: {formatJobDate(job.fetchedAt)}
            </span>
          </div>
          {job.fetchError ? (
            <p className="mt-2 text-red-600 dark:text-red-400">
              <span className="font-medium">Fetch error:</span> {job.fetchError}
            </p>
          ) : null}
          <p className="mt-2">
            <span className="font-medium">Page title:</span>{" "}
            {job.fetchedTitle ?? "Not available"}
          </p>
          <p className="mt-2">
            <span className="font-medium">Content preview:</span>{" "}
            {job.fetchedContentText
              ? `${String(job.fetchedContentText).slice(0, 320)}${
                  String(job.fetchedContentText).length > 320 ? "..." : ""
                }`
              : "No fetched content yet."}
          </p>
        </div>
      </details>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-200">
          More AI detail (summary &amp; reasoning)
        </summary>
        {job.aiLastAnalyzedAt ? (
          <div className="mt-3 rounded-md border border-indigo-200 bg-indigo-50/40 p-3 text-sm dark:border-indigo-900/50 dark:bg-indigo-950/20">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium dark:bg-zinc-800">
                Role: {job.aiRoleCategory ?? "unclear"}
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium dark:bg-zinc-800">
                Seniority: {job.aiSeniority ?? "unclear"}
              </span>
            </div>

            <p className="mt-3">
              <span className="font-medium">Summary:</span>{" "}
              {job.aiRawSummary ?? "No summary yet."}
            </p>
            <p className="mt-1">
              <span className="font-medium">Reasoning:</span>{" "}
              {job.aiFitReasoning ?? "No reasoning yet."}
            </p>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Last analyzed: {formatJobDate(job.aiLastAnalyzedAt)}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            No AI analysis yet. Click Analyze to generate insights.
          </p>
        )}
      </details>
    </article>
  );
}
