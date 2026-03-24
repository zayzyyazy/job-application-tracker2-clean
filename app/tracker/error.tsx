"use client";

import { useEffect } from "react";

/** Route segment boundary: failures in /tracker subtree render here instead of blanking the shell. */
export default function TrackerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/tracker/error]", error.message, error.digest, error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-xl font-semibold text-red-600 dark:text-red-400">
        Tracker couldn&apos;t render
      </h1>
      <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Try again
      </button>
    </main>
  );
}
