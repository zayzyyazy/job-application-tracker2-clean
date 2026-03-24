"use client";

import { useActionState } from "react";
import { fetchJobContentAction } from "@/app/actions/jobs";
import FormSubmitButton from "@/app/components/form-submit-button";

const initialState = {
  ok: false,
  message: "",
};

type FetchJobContentFormProps = {
  id: number;
};

export default function FetchJobContentForm({ id }: FetchJobContentFormProps) {
  const [state, action] = useActionState(fetchJobContentAction, initialState);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <FormSubmitButton
        idleText="Fetch Content"
        pendingText="Fetching..."
        className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
      />
      {state.message ? (
        <p className={`text-xs ${state.ok ? "text-emerald-600" : "text-red-600"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
