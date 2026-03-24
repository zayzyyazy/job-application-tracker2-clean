"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white px-6 py-12 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <h1 className="text-xl font-semibold text-red-600">Application error</h1>
        <p className="mt-3 whitespace-pre-wrap text-sm">{error.message || "An unexpected application error occurred."}</p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-md bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
