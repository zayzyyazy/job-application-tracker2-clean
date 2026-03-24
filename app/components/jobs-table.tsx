import type { Job } from "@prisma/client";
import { JobAiInsightsBlock } from "@/app/components/job-ai-insights";
import AnalyzeJobForm from "@/app/components/analyze-job-form";
import DeleteJobForm from "@/app/components/delete-job-form";
import EditJobForm from "@/app/components/edit-job-form";
import FetchAndAnalyzeJobForm from "@/app/components/fetch-and-analyze-job-form";
import FetchJobContentForm from "@/app/components/fetch-job-content-form";
import JobStatusForm from "@/app/components/job-status-form";
import TrackerJobCard from "@/app/components/tracker-job-card";
import {
  formatDateInputValue,
  formatJobDate,
  getBadgeTone,
  getDeadlineMeta,
  safeJobStatusLabel,
  statusBadgeClassForStatus,
} from "@/lib/job-display";

type JobsTableProps = {
  jobs: Job[];
};

export default function JobsTable({ jobs }: JobsTableProps) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              <th className="py-2 pr-3 font-medium">Title</th>
              <th className="py-2 pr-3 font-medium">Company</th>
              <th className="py-2 pr-3 font-medium">Location</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium">Deadline</th>
              <th className="py-2 pr-3 font-medium">Fit</th>
              <th className="py-2 pr-3 font-medium">Action</th>
              <th className="py-2 pr-3 font-medium">Urgency</th>
              <th className="py-2 pr-3 font-medium">AI skills</th>
              <th className="py-2 pr-3 font-medium">Created</th>
              <th className="py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const dm = getDeadlineMeta(job.deadline, job.status);
              return (
                <tr
                  key={job.id}
                  className="border-b border-zinc-100 align-top dark:border-zinc-800"
                >
                  <td className="max-w-[200px] py-3 pr-3 font-medium">
                    <a
                      href={`#job-${job.id}`}
                      className="text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {job.title?.trim() || "Untitled role"}
                    </a>
                  </td>
                  <td className="max-w-[140px] py-3 pr-3 text-zinc-700 dark:text-zinc-300">
                    {job.company?.trim() || "—"}
                  </td>
                  <td className="max-w-[120px] py-3 pr-3 text-zinc-700 dark:text-zinc-300">
                    {job.location?.trim() || "—"}
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClassForStatus(job.status)}`}
                    >
                      {safeJobStatusLabel(job.status)}
                    </span>
                  </td>
                  <td className="py-3 pr-3">
                    <span className="text-xs text-zinc-700 dark:text-zinc-300">
                      <span className={dm.className}>{dm.label}</span>
                    </span>
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getBadgeTone(job.aiFitLabel)}`}
                    >
                      {job.aiFitLabel ?? "—"}
                    </span>
                  </td>
                  <td className="max-w-[100px] py-3 pr-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getBadgeTone(job.aiActionRecommendation)}`}
                    >
                      {job.aiActionRecommendation ?? "—"}
                    </span>
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getBadgeTone(job.aiUrgency)}`}
                    >
                      {job.aiUrgency ?? "—"}
                    </span>
                  </td>
                  <td className="max-w-[min(240px,28vw)] py-3 pr-3 align-top">
                    <details className="group">
                      <summary className="cursor-pointer list-none text-xs font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-indigo-100 [&::-webkit-details-marker]:hidden">
                        <span className="inline-flex items-center gap-1">
                          View AI details
                          <span className="text-zinc-400 no-underline group-open:rotate-180">▼</span>
                        </span>
                      </summary>
                      <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-indigo-200 bg-indigo-50/40 p-2 text-left dark:border-indigo-900/50 dark:bg-indigo-950/30">
                        <JobAiInsightsBlock job={job} />
                      </div>
                    </details>
                  </td>
                  <td className="whitespace-nowrap py-3 pr-3 text-xs text-zinc-600 dark:text-zinc-400">
                    {formatJobDate(job.createdAt)}
                  </td>
                  <td className="py-3">
                    <div className="flex min-w-[220px] flex-col gap-2">
                      <div className="flex flex-wrap gap-1">
                        <FetchJobContentForm id={job.id} />
                        <AnalyzeJobForm id={job.id} />
                        <FetchAndAnalyzeJobForm id={job.id} />
                      </div>
                      <JobStatusForm id={job.id} status={job.status} />
                      <details>
                        <summary className="cursor-pointer text-xs font-medium text-zinc-700 dark:text-zinc-200">
                          Edit / Delete
                        </summary>
                        <div className="mt-2 space-y-2 rounded-md border border-zinc-200 p-2 dark:border-zinc-700">
                          <EditJobForm
                            job={job}
                            deadlineInputValue={formatDateInputValue(job.deadline)}
                          />
                          <DeleteJobForm id={job.id} />
                        </div>
                      </details>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="scroll-mt-24 space-y-4" aria-label="Job details and actions">
        {jobs.map((job) => (
          <TrackerJobCard key={job.id} job={job} />
        ))}
      </section>
    </>
  );
}
