import { JobStatus } from "@prisma/client";
import AddJobForm from "@/app/components/add-job-form";
import JobsTable from "@/app/components/jobs-table";
import { ServerPageError } from "@/app/components/server-page-error";
import { prisma } from "@/lib/prisma";
import { formatErrorForUi, logServerError } from "@/lib/server-log";

type TrackerProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TrackerPage({ searchParams }: TrackerProps) {
  const params = (await searchParams) ?? {};
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const statusFilter = typeof params.status === "string" ? params.status : "ALL";
  const sort = typeof params.sort === "string" ? params.sort : "created_desc";
  const validStatusFilter =
    statusFilter === "ALL" || Object.values(JobStatus).includes(statusFilter as JobStatus)
      ? statusFilter
      : "ALL";

  const where = {
    ...(validStatusFilter !== "ALL" ? { status: validStatusFilter as JobStatus } : {}),
    ...(query
      ? {
          OR: [
            { title: { contains: query } },
            { company: { contains: query } },
            { location: { contains: query } },
            { notes: { contains: query } },
            { url: { contains: query } },
          ],
        }
      : {}),
  };

  let jobsRaw;
  try {
    jobsRaw = await prisma.job.findMany({ where });
  } catch (e) {
    logServerError("TrackerPage/prisma.job.findMany", e);
    return (
      <ServerPageError
        title="Tracker couldn’t load"
        message={formatErrorForUi(e)}
      />
    );
  }

  let jobs;
  try {
    jobs = [...jobsRaw].sort((a, b) => {
      switch (sort) {
        case "created_asc":
          return a.createdAt.getTime() - b.createdAt.getTime();
        case "deadline_asc": {
          const aTime = a.deadline ? a.deadline.getTime() : Number.POSITIVE_INFINITY;
          const bTime = b.deadline ? b.deadline.getTime() : Number.POSITIVE_INFINITY;
          return aTime - bTime;
        }
        case "deadline_desc": {
          const aTime = a.deadline ? a.deadline.getTime() : Number.NEGATIVE_INFINITY;
          const bTime = b.deadline ? b.deadline.getTime() : Number.NEGATIVE_INFINITY;
          return bTime - aTime;
        }
        case "company_asc":
          return (a.company ?? "zzzz").localeCompare(b.company ?? "zzzz");
        case "title_asc":
          return (a.title ?? "zzzz").localeCompare(b.title ?? "zzzz");
        case "created_desc":
        default:
          return b.createdAt.getTime() - a.createdAt.getTime();
      }
    });
  } catch (e) {
    logServerError("TrackerPage/sort", e);
    return (
      <ServerPageError
        title="Tracker couldn’t load"
        message={formatErrorForUi(e)}
      />
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Jobs tracker</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-300">
        Add jobs, fetch posting text, run AI analysis, and update status. On desktop,
        use the table for a quick scan — full details and actions are below it.
      </p>

      <div className="mt-8">
        <AddJobForm />
      </div>

      <section className="mt-8 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Your jobs</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          {jobs.length} total job{jobs.length === 1 ? "" : "s"}.
        </p>
        <form
          method="get"
          className="mt-4 grid gap-3 rounded-md bg-zinc-50 p-3 dark:bg-zinc-900/40 md:grid-cols-4"
        >
          <label className="grid gap-1 md:col-span-2">
            <span className="text-xs font-medium">Search</span>
            <input
              name="q"
              defaultValue={query}
              placeholder="Search title, company, location, notes, URL..."
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium">Filter by Status</span>
            <select
              name="status"
              defaultValue={validStatusFilter}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="ALL">All statuses</option>
              {Object.values(JobStatus).map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium">Sort</span>
            <select
              name="sort"
              defaultValue={sort}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="created_desc">Newest created first</option>
              <option value="created_asc">Oldest created first</option>
              <option value="deadline_asc">Nearest deadline first</option>
              <option value="deadline_desc">Farthest deadline first</option>
              <option value="company_asc">Company A-Z</option>
              <option value="title_asc">Title A-Z</option>
            </select>
          </label>
          <div className="flex items-end gap-2 md:col-span-4">
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Apply
            </button>
            <a
              href="/tracker"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
            >
              Reset
            </a>
          </div>
        </form>

        {jobs.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            No jobs found for this filter/search. Try resetting filters or add a new job.
          </div>
        ) : (
          <div className="mt-6">
            <JobsTable jobs={jobs} />
          </div>
        )}
      </section>
    </main>
  );
}
