"use client";

import { JobStatus, type Job } from "@prisma/client";
import { useActionState } from "react";
import { updateJobAction } from "@/app/actions/jobs";
import FormSubmitButton from "@/app/components/form-submit-button";

const initialState = {
  ok: false,
  message: "",
};

type EditJobFormProps = {
  job: Job;
  deadlineInputValue: string;
};

export default function EditJobForm({
  job,
  deadlineInputValue,
}: EditJobFormProps) {
  const [state, action] = useActionState(updateJobAction, initialState);

  return (
    <form
      action={action}
      className="mt-3 grid gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-700"
    >
      <input type="hidden" name="id" value={job.id} />
      <label className="grid gap-1">
        <span className="text-xs font-medium">URL *</span>
        <input
          name="url"
          defaultValue={job.url}
          type="url"
          required
          className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div className="grid gap-2 md:grid-cols-3">
        <label className="grid gap-1">
          <span className="text-xs font-medium">Company</span>
          <input
            name="company"
            defaultValue={job.company ?? ""}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-medium">Title</span>
          <input
            name="title"
            defaultValue={job.title ?? ""}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-medium">Location</span>
          <input
            name="location"
            defaultValue={job.location ?? ""}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-xs font-medium">Deadline</span>
          <input
            name="deadline"
            type="date"
            defaultValue={deadlineInputValue}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-medium">Status</span>
          <select
            name="status"
            defaultValue={job.status}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {Object.values(JobStatus).map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="grid gap-1">
        <span className="text-xs font-medium">Notes</span>
        <textarea
          name="notes"
          defaultValue={job.notes ?? ""}
          rows={3}
          className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <FormSubmitButton idleText="Save changes" pendingText="Saving..." />
        {state.message ? (
          <p className={`text-xs ${state.ok ? "text-emerald-600" : "text-red-600"}`}>
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
