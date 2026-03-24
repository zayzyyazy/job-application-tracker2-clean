"use server";

import { JobStatus } from "@prisma/client";
import {
  discoverJobsWithParams,
  type DiscoverPipelineResult,
} from "@/lib/discover-jobs";
import { parseDiscoverFormData, type DiscoverFormParams } from "@/lib/discover-params";
import { prisma } from "@/lib/prisma";
import { revalidateAppPaths } from "@/lib/revalidate-app";
import { logServerError } from "@/lib/server-log";
import type { SuggestedJob } from "@/lib/suggested-job";

export type DiscoverOutcome = DiscoverPipelineResult["outcome"];

export type SearchSuggestedJobsResult =
  | {
      ok: true;
      jobs: SuggestedJob[];
      hint?: string;
      dropped?: number;
      rawCount?: number;
      searchSummary?: string;
      outcome: DiscoverOutcome;
      usedFallback?: boolean;
      /** Safe one-line summary for the UI (query count, merge count, outcome). */
      pipelineSummary?: string;
    }
  | { ok: false; message: string };

type SaveSuggestedJobResult = {
  ok: boolean;
  message: string;
};

function validateHttpUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function inferCompanyFromTitle(title: string): string | null {
  const t = title.trim();
  const at = /\s+at\s+(.+)$/i.exec(t);
  if (at) {
    const rest = at[1].replace(/\s*[-–—].*$/, "").trim();
    return rest.length > 0 ? rest.slice(0, 120) : null;
  }
  const parts = t.split(/\s[-–—]\s/);
  if (parts.length >= 2) {
    return parts[parts.length - 1].trim().slice(0, 120);
  }
  return null;
}

function formatSearchSummary(params: DiscoverFormParams): string {
  const parts = [
    params.keyword.trim() || "(profile default role)",
    params.location.trim() || "(profile default location)",
    params.level !== "any" ? params.level.replace("_", " ") : null,
    params.workMode !== "any" ? params.workMode.replace("_", " ") : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function buildPipelineSummary(p: DiscoverPipelineResult): string {
  const blockedQueries = p.traces.filter((t) => t.postAnomaly || t.getAnomaly).length;
  return `source=${p.primarySource} queries=${p.traces.length} merged_raw=${p.rawCount} blocked_queries≈${blockedQueries} outcome=${p.outcome} openai_err=${p.openaiError ?? "none"} fallback_filter=${p.usedFallback}`;
}

function hintsForEmptyOrPartial(
  p: DiscoverPipelineResult,
): { hint?: string; extra?: string } {
  const { outcome, rawCount, dropped, usedFallback } = p;

  if (p.jobs.length > 0) {
    const parts: string[] = [];
    if (outcome === "openai_ok") {
      parts.push(
        "Results from OpenAI web search (the model used live web search; links depend on what is publicly indexed — open and verify before applying).",
      );
    }
    if (p.primarySource === "ddg" && p.openaiError) {
      parts.push(
        `OpenAI discover did not return usable results (${p.openaiError}); these links come from the DuckDuckGo HTML fallback instead.`,
      );
    }
    if (dropped && dropped > 0) {
      parts.push(
        `${dropped} link${dropped === 1 ? "" : "s"} were ranked lower or hidden as likely search/listing pages.`,
      );
    }
    if (usedFallback) {
      parts.push(
        "Showing broader results: strict quality filters would have removed everything, so we kept the best-ranked links anyway (some may be noisy).",
      );
    }
    return { hint: parts.length > 0 ? parts.join(" ") : undefined };
  }

  switch (outcome) {
    case "ddg_blocked":
      return {
        hint: "DuckDuckGo showed a bot-check page instead of real search results (common for server/datacenter IPs).",
        extra:
          "With OPENAI_API_KEY set, the app tries OpenAI web search first — run Discover again. Otherwise try from a home/residential network or paste job URLs manually in the tracker.",
      };
    case "ddg_empty_parse":
      return {
        hint: "The app reached DuckDuckGo, but no result links could be parsed — the HTML layout may have changed, or the response was empty.",
        extra:
          "Check server logs for [discover]. Ensure OPENAI_API_KEY is set for the primary OpenAI web search path.",
      };
    case "filtered_then_fallback":
      return {
        hint: "Unexpected: fallback should yield rows. See server logs.",
      };
    default:
      if (rawCount === 0) {
        return {
          hint:
            "No job links found. If OPENAI_API_KEY is set, check server logs for [discover][openai]; otherwise DuckDuckGo fallback may be blocked or empty.",
          extra: buildPipelineSummary(p),
        };
      }
      return {
        hint: "No results to show after filtering.",
        extra: buildPipelineSummary(p),
      };
  }
}

export async function searchSuggestedJobsAction(
  params: DiscoverFormParams,
): Promise<SearchSuggestedJobsResult> {
  try {
    const profile = await prisma.profile.findUnique({ where: { id: 1 } });
    const pipeline = await discoverJobsWithParams(profile, params);

    const searchSummary = formatSearchSummary(params);
    const pipelineSummary = buildPipelineSummary(pipeline);

    console.log("[searchSuggestedJobsAction]", pipelineSummary);

    if (pipeline.jobs.length === 0) {
      const { hint, extra } = hintsForEmptyOrPartial(pipeline);
      return {
        ok: true,
        jobs: [],
        hint: [hint, extra].filter(Boolean).join(" "),
        dropped: pipeline.dropped,
        rawCount: pipeline.rawCount,
        searchSummary,
        outcome: pipeline.outcome,
        usedFallback: pipeline.usedFallback,
        pipelineSummary,
      };
    }

    const { hint: dropHint } = hintsForEmptyOrPartial(pipeline);

    return {
      ok: true,
      jobs: pipeline.jobs,
      hint: dropHint,
      dropped: pipeline.dropped,
      rawCount: pipeline.rawCount,
      searchSummary,
      outcome: pipeline.outcome,
      usedFallback: pipeline.usedFallback,
      pipelineSummary,
    };
  } catch (e) {
    console.error("[searchSuggestedJobsAction]", e);
    return {
      ok: false,
      message: `Discovery error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

export type DiscoverSearchState =
  | { status: "idle" }
  | {
      status: "success";
      jobs: SuggestedJob[];
      hint?: string;
      dropped?: number;
      rawCount?: number;
      searchSummary?: string;
      outcome?: DiscoverOutcome;
      usedFallback?: boolean;
      pipelineSummary?: string;
    }
  | { status: "error"; message: string };

/** For use with <form action={...}> + useActionState — reads keyword, location, level, workMode. */
export async function findJobsSearchAction(
  _prev: DiscoverSearchState,
  formData: FormData,
): Promise<DiscoverSearchState> {
  void _prev;
  const params = parseDiscoverFormData(formData);
  const result = await searchSuggestedJobsAction(params);
  if (result.ok) {
    return {
      status: "success",
      jobs: result.jobs,
      hint: result.hint,
      dropped: result.dropped,
      rawCount: result.rawCount,
      searchSummary: result.searchSummary,
      outcome: result.outcome,
      usedFallback: result.usedFallback,
      pipelineSummary: result.pipelineSummary,
    };
  }
  return { status: "error", message: result.message };
}

export async function saveSuggestedJobAction(
  _prevState: SaveSuggestedJobResult,
  formData: FormData,
): Promise<SaveSuggestedJobResult> {
  const rawUrl = formData.get("url");
  const rawTitle = formData.get("title");
  const rawSnippet = formData.get("snippet");

  const url = typeof rawUrl === "string" ? validateHttpUrl(rawUrl) : null;
  if (!url) {
    return { ok: false, message: "Invalid link." };
  }

  const title =
    typeof rawTitle === "string" && rawTitle.trim().length > 0
      ? rawTitle.trim().slice(0, 500)
      : null;
  const notes =
    typeof rawSnippet === "string" && rawSnippet.trim().length > 0
      ? rawSnippet.trim().slice(0, 5000)
      : null;

  try {
    await prisma.job.create({
      data: {
        url,
        title,
        company: title ? inferCompanyFromTitle(title) : null,
        notes,
        status: JobStatus.SAVED,
        source: "discover",
      },
    });
    revalidateAppPaths();
    return { ok: true, message: "Saved to your tracker." };
  } catch (e) {
    logServerError("saveSuggestedJobAction", e);
    return { ok: false, message: "Could not save. Try again." };
  }
}
