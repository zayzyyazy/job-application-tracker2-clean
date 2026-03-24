import Link from "next/link";

/** Shown when a server page fails to load data (avoids a blank 500 screen). */
export function ServerPageError({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <h1 className="text-xl font-semibold text-red-600 dark:text-red-400">{title}</h1>
      <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
        {message}
      </p>
      <p className="mt-4 text-xs text-zinc-500">
        If this persists, check the desktop app terminal for{" "}
        <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">[server-error]</code> /{" "}
        <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">[revalidate]</code> lines.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block text-sm font-medium text-blue-600 underline dark:text-blue-400"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
