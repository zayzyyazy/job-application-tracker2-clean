"use client";

import { useFormStatus } from "react-dom";

export default function FindJobsSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-600"
    >
      {pending ? "Searching…" : "Find Jobs"}
    </button>
  );
}
