"use client";

import { JobStatus } from "@prisma/client";
import { useActionState, useEffect, useRef } from "react";
import { createJobAction } from "@/app/actions/jobs";
import FormSubmitButton from "@/app/components/form-submit-button";

const initialState = {
  ok: false,
  message: "",
};

export default function AddJobForm() {
  const [state, action] = useActionState(createJobAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
    }
  }, [state.ok]);

  return (
    <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <h2 className="text-lg font-semibold">Add Job</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        Paste a job link and add quick details.
      </p>

      <form ref={formRef} action={action} className="mt-4 grid gap-3">
        <label className="grid gap-1">
          <span className="text-sm font-medium">Job URL *</span>
          <input
            name="url"
            type="url"
            required
            placeholder="https://company.com/jobs/123"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-300 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Company</span>
            <input
              name="company"
              type="text"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-300 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Title</span>
            <input
              name="title"
              type="text"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-300 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Location</span>
            <input
              name="location"
              type="text"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-300 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Status</span>
            <select
              name="status"
              defaultValue={JobStatus.SAVED}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-300 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {Object.values(JobStatus).map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Deadline</span>
            <input
              name="deadline"
              type="date"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-300 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        </div>

        <label className="grid gap-1">
          <span className="text-sm font-medium">Notes</span>
          <textarea
            name="notes"
            rows={3}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-300 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        {state.message ? (
          <p
            className={`text-sm ${state.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
          >
            {state.message}
          </p>
        ) : null}

        <div>
          <FormSubmitButton idleText="Save Job" pendingText="Saving..." />
        </div>
      </form>
    </section>
  );
}
