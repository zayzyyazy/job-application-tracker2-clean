"use client";

import { useActionState } from "react";
import { analyzeJobAction } from "@/app/actions/jobs";
import FormSubmitButton from "@/app/components/form-submit-button";

const initialState = {
  ok: false,
  message: "",
};

type AnalyzeJobFormProps = {
  id: number;
};

export default function AnalyzeJobForm({ id }: AnalyzeJobFormProps) {
  const [state, action] = useActionState(analyzeJobAction, initialState);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <FormSubmitButton
        idleText="Analyze"
        pendingText="Analyzing..."
        className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
      />
      {state.message ? (
        <p className={`text-xs ${state.ok ? "text-emerald-600" : "text-red-600"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
