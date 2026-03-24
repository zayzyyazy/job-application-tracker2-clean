"use client";

import { useActionState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  findJobsSearchAction,
  saveSuggestedJobAction,
  type DiscoverOutcome,
  type DiscoverSearchState,
} from "@/app/actions/discover";
import FindJobsSubmitButton from "@/app/components/find-jobs-submit-button";
import FormSubmitButton from "@/app/components/form-submit-button";
import { normalizeJobUrlForMatch } from "@/lib/url-match";
import type { SuggestedJob } from "@/lib/suggested-job";

const saveInitial = { ok: false, message: "" };

const initialDiscover: DiscoverSearchState = { status: "idle" };

const OUTCOME_LABELS: Record<DiscoverOutcome, string> = {
  openai_ok: "OpenAI web search (primary)",
  ok: "OK (DuckDuckGo fallback links parsed)",
  ddg_blocked: "DuckDuckGo showed a bot check instead of results",
  ddg_empty_parse: "No result links parsed from HTML",
  filtered_then_fallback: "Showing fallback ranking (strict filters removed all)",
};

function DiscoverOutcomeLabel({ outcome }: { outcome: DiscoverOutcome }) {
  return <span>{OUTCOME_LABELS[outcome] ?? outcome}</span>;
}

type SuggestedJobsSectionProps = {
  defaultKeyword?: string;
  defaultLocation?: string;
  savedUrls: string[];
};

export default function SuggestedJobsSection({
  defaultKeyword = "",
  defaultLocation = "",
  savedUrls,
}: SuggestedJobsSectionProps) {
  const [state, formAction] = useActionState(findJobsSearchAction, initialDiscover);

  return (
    <section className="mt-8 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <h2 className="text-lg font-semibold">Search</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        Set role, place, and filters — the app uses <strong>OpenAI web search</strong> first (needs{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">OPENAI_API_KEY</code>), then
        DuckDuckGo HTML as a fallback. Nothing is saved until you click <strong>Save</strong>.
      </p>

      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs font-medium">Keyword / role</span>
            <input
              name="keyword"
              defaultValue={defaultKeyword}
              placeholder="e.g. ML intern, React developer"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium">Location</span>
            <input
              name="location"
              defaultValue={defaultLocation}
              placeholder="e.g. Berlin, Remote EU"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium">Level</span>
            <select
              name="level"
              defaultValue="any"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="any">Any</option>
              <option value="internship">Internship</option>
              <option value="working_student">Working student</option>
              <option value="junior">Junior</option>
              <option value="mid">Mid-level</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium">Work mode</span>
            <select
              name="workMode"
              defaultValue="any"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="any">Any</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="on_site">On-site</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <FindJobsSubmitButton />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Searching… (OpenAI + optional DDG fallback). Results depend on public web data.
          </span>
        </div>
      </form>

      {state.status === "idle" ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          Fill the fields above (defaults come from your profile when empty) and click{" "}
          <strong>Find Jobs</strong>.
        </p>
      ) : null}

      {state.status === "error" ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {state.message}
        </p>
      ) : null}

      {state.status === "success" ? (
        <div className="mt-4 space-y-2">
          {state.searchSummary ? (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              <span className="font-medium">Searched:</span> {state.searchSummary}
            </p>
          ) : null}
          {state.outcome ? (
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Status: <DiscoverOutcomeLabel outcome={state.outcome} />
            </p>
          ) : null}
          {state.hint ? (
            <p
              className={`rounded-md border px-3 py-2 text-sm ${
                state.outcome === "openai_ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                  : state.outcome === "ddg_blocked"
                    ? "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
                    : state.outcome === "ddg_empty_parse"
                      ? "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100"
                      : state.outcome === "filtered_then_fallback" || state.usedFallback
                        ? "border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100"
                        : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
              }`}
            >
              {state.hint}
            </p>
          ) : null}
          {state.pipelineSummary ? (
            <details className="text-xs text-zinc-500 dark:text-zinc-400">
              <summary className="cursor-pointer font-medium text-zinc-600 dark:text-zinc-300">
                Technical summary (for debugging)
              </summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-zinc-100 p-2 font-mono dark:bg-zinc-900">
                {state.pipelineSummary}
              </pre>
            </details>
          ) : null}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Real postings can still slip through, and good postings can be filtered if the title looks
            like a hub — try a more specific title or employer name if results look off.
          </p>
        </div>
      ) : null}

      {state.status === "success" && state.jobs.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {state.jobs.map((job, index) => (
            <SuggestedJobRow
              key={`${job.url}-${index}`}
              job={job}
              savedUrls={savedUrls}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function SuggestedJobRow({
  job,
  savedUrls,
}: {
  job: SuggestedJob;
  savedUrls: string[];
}) {
  const [saveState, saveAction] = useActionState(saveSuggestedJobAction, saveInitial);
  const router = useRouter();

  const savedSet = useMemo(
    () => new Set(savedUrls.map((u) => normalizeJobUrlForMatch(u))),
    [savedUrls],
  );
  const alreadyInTracker = savedSet.has(normalizeJobUrlForMatch(job.url));

  useEffect(() => {
    if (saveState.ok) {
      router.refresh();
    }
  }, [saveState.ok, router]);

  const saved = alreadyInTracker || saveState.ok;

  return (
    <li
      className={`rounded-md border p-3 dark:border-zinc-700 ${
        saved
          ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
          : "border-zinc-200"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">{job.title}</p>
        {saved ? (
          <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
            In tracker
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{job.snippet}</p>
      <p className="mt-1 text-xs text-zinc-500">
        Source: {job.source} ·{" "}
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline dark:text-blue-400"
        >
          Open link
        </a>
      </p>
      <form action={saveAction} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="url" value={job.url} />
        <input type="hidden" name="title" value={job.title} />
        <input type="hidden" name="snippet" value={job.snippet} />
        <FormSubmitButton
          idleText={saved ? "Saved" : "Save to tracker"}
          pendingText="Saving…"
          disabled={saved}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        />
        {saveState.message ? (
          <span
            className={`text-xs ${saveState.ok ? "text-emerald-600" : "text-red-600"}`}
          >
            {saveState.message}
          </span>
        ) : null}
      </form>
    </li>
  );
}
