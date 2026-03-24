"use client";

import { JobStatus } from "@prisma/client";
import { useActionState } from "react";
import { updateJobStatusAction } from "@/app/actions/jobs";
import FormSubmitButton from "@/app/components/form-submit-button";

const initialState = {
  ok: false,
  message: "",
};

type JobStatusFormProps = {
  id: number;
  status: JobStatus;
};

export default function JobStatusForm({ id, status }: JobStatusFormProps) {
  const [state, action] = useActionState(updateJobStatusAction, initialState);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="text-sm font-medium">Status</label>
      <select
        name="status"
        defaultValue={status}
        className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        {Object.values(JobStatus).map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      <FormSubmitButton
        idleText="Update"
        pendingText="Updating..."
        className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60 dark:bg-zinc-200 dark:text-zinc-900"
      />
      {state.message ? (
        <p className={`text-xs ${state.ok ? "text-emerald-600" : "text-red-600"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
