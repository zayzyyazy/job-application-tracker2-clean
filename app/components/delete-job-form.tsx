"use client";

import { useActionState } from "react";
import { deleteJobAction } from "@/app/actions/jobs";
import FormSubmitButton from "@/app/components/form-submit-button";

const initialState = {
  ok: false,
  message: "",
};

type DeleteJobFormProps = {
  id: number;
};

export default function DeleteJobForm({ id }: DeleteJobFormProps) {
  const [state, action] = useActionState(deleteJobAction, initialState);

  return (
    <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <span className="text-xs text-zinc-600 dark:text-zinc-300">Confirm delete?</span>
      <FormSubmitButton
        idleText="Yes, delete"
        pendingText="Deleting..."
        className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
      />
      {state.message ? (
        <p className={`text-xs ${state.ok ? "text-emerald-600" : "text-red-600"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
