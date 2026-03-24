import * as cheerio from "cheerio";
import type { Profile } from "@prisma/client";
import { buildDiscoverQueriesFromForm, type DiscoverFormParams } from "@/lib/discover-params";
import { filterAndRankWithFallback } from "@/lib/discover-quality";
import { discoverViaOpenAIWebSearch } from "@/lib/openai-discover";
import type { SuggestedJob } from "@/lib/suggested-job";

function parseJsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

const MAX_SNIPPET = 280;
const MAX_TOTAL_RAW = 40;
const PER_QUERY = 10;
const FETCH_TIMEOUT_MS = 18000;

/** Browser-like headers — DuckDuckGo often returns a bot challenge for non-browser clients. */
const DDG_HEADERS: Record<string, string> = {
  "Content-Type": "application/x-www-form-urlencoded",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,de;q=0.8",
  Referer: "https://html.duckduckgo.com/",
  Origin: "https://html.duckduckgo.com",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
};

/** GET must not send Content-Type / Origin like a form POST (some CDNs behave oddly). */
const DDG_GET_HEADERS: Record<string, string> = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,de;q=0.8",
  Referer: "https://html.duckduckgo.com/html/",
  "User-Agent": DDG_HEADERS["User-Agent"],
};

/**
 * @deprecated Prefer buildDiscoverQueriesFromForm with explicit user inputs.
 */
export function buildDiscoverSearchQueries(profile: Profile | null): string[] {
  const roles = profile ? parseJsonStringArray(profile.targetRoles) : [];
  const skills = profile ? parseJsonStringArray(profile.skills) : [];
  const locs = profile ? parseJsonStringArray(profile.preferredLocations) : [];

  const loc = locs[0]?.trim() || "Germany";
  const roleA = roles[0]?.trim() || "Werkstudent";
  const roleB = roles[1]?.trim() || "Internship";
  const skillA = skills[0]?.trim() || "AI";
  const skillB = skills[1]?.trim() || "software";

  const q1 = `${roleA} ${skillA} ${loc} job apply`.replace(/\s+/g, " ").trim();
  const q2 = `${roleB} ${skillB} remote Europe vacancy`.replace(/\s+/g, " ").trim();
  const q3 = `site:linkedin.com/jobs/view ${roleA} ${loc}`.replace(/\s+/g, " ").trim();

  return [q1, q2, q3];
}

function resolveDuckDuckGoRedirect(href: string): string {
  try {
    const u = new URL(href, "https://duckduckgo.com");
    const uddg = u.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
    return href;
  } catch {
    return href;
  }
}

function trimSnippet(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= MAX_SNIPPET) return t;
  return `${t.slice(0, MAX_SNIPPET)}…`;
}

function isLikelyJobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (u.hostname.includes("duckduckgo.com")) return false;
    return true;
  } catch {
    return false;
  }
}

/** DuckDuckGo returns a captcha-style page for many automated requests. */
export function isDuckDuckGoAnomalyHtml(html: string): boolean {
  const h = html.toLowerCase();
  return (
    h.includes("anomaly-modal") ||
    h.includes("unfortunately, bots use duckduckgo") ||
    h.includes("select all squares containing a duck")
  );
}

function pushResult(
  out: SuggestedJob[],
  seen: Set<string>,
  title: string,
  hrefRaw: string,
  snippetText: string,
): void {
  let href = hrefRaw.trim();
  if (!title || !href) return;
  href = resolveDuckDuckGoRedirect(href);
  if (!isLikelyJobUrl(href)) return;
  const snippet = trimSnippet(snippetText || "—");
  const key = href.split("#")[0] ?? href;
  if (seen.has(key)) return;
  seen.add(key);
  out.push({ title: title.trim(), url: href, snippet: snippet || "—", source: "search" });
}

/**
 * Parse DuckDuckGo HTML result page (multiple strategies — markup changes over time).
 */
export function parseDuckDuckGoHtml(html: string): SuggestedJob[] {
  if (isDuckDuckGoAnomalyHtml(html)) {
    return [];
  }

  const $ = cheerio.load(html);
  const out: SuggestedJob[] = [];
  const seen = new Set<string>();

  const tryBlock = ($block: ReturnType<typeof $>) => {
    const a = $block.find("a.result__a").first();
    if (!a.length) return;
    const title = a.text().trim();
    const href = a.attr("href")?.trim() ?? "";
    const snippetEl = $block.find(".result__snippet").first();
    const snippet = snippetEl.length
      ? snippetEl.text()
      : $block.find(".result__body").text();
    pushResult(out, seen, title, href, snippet);
  };

  $(".result").each((_, el) => {
    tryBlock($(el));
  });

  if (out.length === 0) {
    $(".web-result").each((_, el) => {
      tryBlock($(el));
    });
  }

  // Loose: any classic result link (same page sometimes omits .result wrapper)
  if (out.length === 0) {
    $("a.result__a").each((_, el) => {
      const a = $(el);
      const title = a.text().trim();
      const href = a.attr("href")?.trim() ?? "";
      const parent = a.closest(".result, .web-result, .links_main");
      const snippetEl = parent.find(".result__snippet").first();
      const snippet = snippetEl.length ? snippetEl.text() : parent.find(".result__body").text();
      pushResult(out, seen, title, href, snippet);
    });
  }

  // Lite / alternate layout: links in results table
  if (out.length === 0) {
    $(".links_main a, .result__title a, .result-link").each((_, el) => {
      const a = $(el);
      const title = a.text().trim();
      const href = a.attr("href")?.trim() ?? "";
      if (!href.includes("uddg") && !href.startsWith("http")) return;
      pushResult(out, seen, title, href, "");
    });
  }

  return out;
}

export type DdgFetchAttempt = "post" | "get";

export type FetchDdgResult = {
  jobs: SuggestedJob[];
  httpStatus: number;
  anomaly: boolean;
  error?: string;
  bytes: number;
  attempt: DdgFetchAttempt;
};

async function fetchDuckDuckGoOnce(
  query: string,
  limit: number,
  attempt: DdgFetchAttempt,
): Promise<FetchDdgResult> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let res: Response;

    if (attempt === "post") {
      const body = new URLSearchParams();
      body.set("q", query);
      body.set("b", "");
      res = await fetch("https://html.duckduckgo.com/html/", {
        method: "POST",
        headers: DDG_HEADERS,
        body: body.toString(),
        signal: controller.signal,
        cache: "no-store",
      });
    } else {
      const url = new URL("https://html.duckduckgo.com/html/");
      url.searchParams.set("q", query);
      res = await fetch(url.toString(), {
        method: "GET",
        headers: DDG_GET_HEADERS,
        signal: controller.signal,
        cache: "no-store",
      });
    }

    const httpStatus = res.status;
    // Fetch `ok` is true for 202 — we treat 202 as a non-standard success that DDG uses for challenges.
    const html = await res.text();
    const bytes = html.length;

    if (!res.ok && httpStatus !== 202) {
      return {
        jobs: [],
        httpStatus,
        anomaly: false,
        error: `http_${httpStatus}`,
        bytes,
        attempt,
      };
    }

    if (isDuckDuckGoAnomalyHtml(html)) {
      return {
        jobs: [],
        httpStatus,
        anomaly: true,
        bytes,
        attempt,
      };
    }

    const jobs = parseDuckDuckGoHtml(html).slice(0, limit);
    return { jobs, httpStatus, anomaly: false, bytes, attempt };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      jobs: [],
      httpStatus: 0,
      anomaly: false,
      error: msg,
      bytes: 0,
      attempt,
    };
  } finally {
    clearTimeout(t);
  }
}

/**
 * POST then GET — some networks return results on one path only.
 */
export async function fetchDuckDuckGoResults(
  query: string,
  limit: number,
): Promise<SuggestedJob[]> {
  const post = await fetchDuckDuckGoOnce(query, limit, "post");
  if (post.jobs.length > 0 && !post.anomaly) {
    return post.jobs;
  }
  const get = await fetchDuckDuckGoOnce(query, limit, "get");
  if (get.jobs.length > 0 && !get.anomaly) {
    return get.jobs;
  }
  const best = post.jobs.length >= get.jobs.length ? post : get;
  return best.jobs;
}

export function applyProfileDefaultsToDiscoverParams(
  params: DiscoverFormParams,
  profile: Profile | null,
): DiscoverFormParams {
  const roles = profile ? parseJsonStringArray(profile.targetRoles) : [];
  const locs = profile ? parseJsonStringArray(profile.preferredLocations) : [];

  return {
    ...params,
    keyword: params.keyword.trim() || roles[0]?.trim() || "software developer",
    location: params.location.trim() || locs[0]?.trim() || "Germany",
  };
}

export type DiscoverQueryTrace = {
  query: string;
  postStatus: number;
  postParsed: number;
  postAnomaly: boolean;
  postError?: string;
  getStatus: number;
  getParsed: number;
  getAnomaly: boolean;
  getError?: string;
  mergedForQuery: number;
};

export type DiscoverPipelineResult = {
  jobs: SuggestedJob[];
  dropped: number;
  rawCount: number;
  usedFallback: boolean;
  outcome:
    | "openai_ok"
    | "ok"
    | "ddg_blocked"
    | "ddg_empty_parse"
    | "filtered_then_fallback";
  traces: DiscoverQueryTrace[];
  /** Where the primary list came from before optional DDG filtering. */
  primarySource: "openai" | "ddg";
  /** If OpenAI was attempted but failed, a short reason (DDG may still have succeeded). */
  openaiError?: string;
};

function logDiscoverPipeline(label: string, payload: Record<string, unknown>): void {
  console.log(`[discover] ${label}`, JSON.stringify(payload));
}

async function runDdgQuery(
  q: string,
  limit: number,
): Promise<{ jobs: SuggestedJob[]; trace: DiscoverQueryTrace }> {
  const post = await fetchDuckDuckGoOnce(q, limit, "post");
  const get = await fetchDuckDuckGoOnce(q, limit, "get");

  let jobs: SuggestedJob[] = [];
  if (!post.anomaly && post.jobs.length > 0) {
    jobs = post.jobs;
  } else if (!get.anomaly && get.jobs.length > 0) {
    jobs = get.jobs;
  } else if (post.jobs.length > 0) {
    jobs = post.jobs;
  } else {
    jobs = get.jobs;
  }

  logDiscoverPipeline("ddg_query", {
    q,
    post: {
      status: post.httpStatus,
      parsed: post.jobs.length,
      anomaly: post.anomaly,
      err: post.error,
      bytes: post.bytes,
    },
    get: {
      status: get.httpStatus,
      parsed: get.jobs.length,
      anomaly: get.anomaly,
      err: get.error,
      bytes: get.bytes,
    },
    merged: jobs.length,
  });

  const trace: DiscoverQueryTrace = {
    query: q,
    postStatus: post.httpStatus,
    postParsed: post.jobs.length,
    postAnomaly: post.anomaly,
    postError: post.error,
    getStatus: get.httpStatus,
    getParsed: get.jobs.length,
    getAnomaly: get.anomaly,
    getError: get.error,
    mergedForQuery: jobs.length,
  };

  return { jobs, trace };
}

/**
 * Prefer OpenAI web search (OPENAI_API_KEY + Responses API), then DuckDuckGo HTML as fallback.
 */
export async function discoverJobsWithParams(
  profile: Profile | null,
  params: DiscoverFormParams,
): Promise<DiscoverPipelineResult> {
  const effective = applyProfileDefaultsToDiscoverParams(params, profile);

  logDiscoverPipeline("start", {
    effectiveKeyword: effective.keyword,
    effectiveLocation: effective.location,
    level: effective.level,
    workMode: effective.workMode,
  });

  let openaiError: string | undefined;

  if (process.env.OPENAI_API_KEY?.trim()) {
    const oa = await discoverViaOpenAIWebSearch(effective);
    if (oa.error) {
      openaiError = oa.error;
      logDiscoverPipeline("openai_failed", { error: oa.error });
    }
    if (oa.jobs.length > 0) {
      logDiscoverPipeline("openai_ok", { count: oa.jobs.length });
      return {
        jobs: oa.jobs.slice(0, 15),
        dropped: 0,
        rawCount: oa.jobs.length,
        usedFallback: false,
        outcome: "openai_ok",
        traces: [],
        primarySource: "openai",
      };
    }
  }

  const queries = buildDiscoverQueriesFromForm(effective);
  logDiscoverPipeline("ddg_fallback", { queries, openaiError });

  const merged: SuggestedJob[] = [];
  const seen = new Set<string>();
  const traces: DiscoverQueryTrace[] = [];

  let anyDdgAnomaly = false;
  let anyDdgParsed = false;

  for (const q of queries) {
    if (merged.length >= MAX_TOTAL_RAW) break;
    const { jobs: batch, trace } = await runDdgQuery(q, PER_QUERY);
    traces.push(trace);
    if (trace.postAnomaly || trace.getAnomaly) {
      anyDdgAnomaly = true;
    }
    if (trace.mergedForQuery > 0) {
      anyDdgParsed = true;
    }
    for (const job of batch) {
      if (merged.length >= MAX_TOTAL_RAW) break;
      const key = job.url.split("#")[0] ?? job.url;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(job);
    }
  }

  const mergedRawCount = merged.length;
  logDiscoverPipeline("merged_raw", { rawCount: mergedRawCount, uniqueUrls: seen.size });

  let outcome: DiscoverPipelineResult["outcome"] = "ok";

  const {
    jobs: filtered,
    dropped,
    usedFallback,
  } = filterAndRankWithFallback(merged, { minScore: -40, maxResults: 15 });

  if (usedFallback && filtered.length > 0) {
    outcome = "filtered_then_fallback";
  }

  if (mergedRawCount === 0) {
    if (anyDdgAnomaly) {
      outcome = "ddg_blocked";
    } else if (!anyDdgParsed) {
      outcome = "ddg_empty_parse";
    }
  }

  logDiscoverPipeline("filter", {
    rawCount: mergedRawCount,
    afterFilter: filtered.length,
    dropped,
    usedFallback,
    outcome,
  });

  return {
    jobs: filtered,
    dropped,
    rawCount: mergedRawCount,
    usedFallback,
    outcome,
    traces,
    primarySource: "ddg",
    openaiError,
  };
}

export async function discoverJobsFromProfile(
  profile: Profile | null,
): Promise<SuggestedJob[]> {
  const roles = profile ? parseJsonStringArray(profile.targetRoles) : [];
  const locs = profile ? parseJsonStringArray(profile.preferredLocations) : [];
  const params: DiscoverFormParams = {
    keyword: roles[0]?.trim() || "software developer",
    location: locs[0]?.trim() || "Germany",
    level: "any",
    workMode: "any",
  };
  const { jobs } = await discoverJobsWithParams(profile, params);
  return jobs;
}
