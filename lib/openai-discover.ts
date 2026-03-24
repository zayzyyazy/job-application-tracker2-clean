import OpenAI from "openai";
import type { DiscoverFormParams } from "@/lib/discover-params";
import type { SuggestedJob } from "@/lib/suggested-job";
import { normalizeJobUrlForMatch } from "@/lib/url-match";

const MAX_RESULTS = 15;
const MAX_SNIPPET = 400;

/** Override with OPENAI_DISCOVER_MODEL in .env if needed. */
const DEFAULT_DISCOVER_MODEL = "gpt-4o";

const SYSTEM_INSTRUCTIONS = `You are helping a job seeker find real, currently listed job postings on the public web.

You MUST use the web_search tool at least once to search for jobs that match the user's criteria.

Quality rules:
- Prefer concrete single job postings (detail pages), company career site job pages, and reputable job boards with a specific role.
- Avoid generic "X jobs found", category hubs, pure search-result landing pages, and vague aggregator homepages unless the URL is clearly a single posting.
- Only include URLs you believe are real http(s) links to a specific opening or its official detail page.
- Prefer Europe/Germany context when the user specifies a location there.

After searching, your final reply MUST be a single JSON object (no markdown fences, no commentary) with this exact shape:
{"jobs":[{"title":"string","url":"https://...","snippet":"string","company":null,"location":null}]}

Use null for unknown company/location. Limit to at most ${MAX_RESULTS} items. Snippets should be short (one or two sentences).`;

export type OpenAiDiscoverResult = {
  jobs: SuggestedJob[];
  /** Set when the API key is missing or the request/parse failed (caller may fall back to HTML search). */
  error?: string;
};

function buildUserMessage(params: DiscoverFormParams): string {
  const level =
    params.level === "any"
      ? "any seniority"
      : params.level.replace("_", " ");
  const mode =
    params.workMode === "any"
      ? "any work mode"
      : params.workMode.replace("_", " ");

  return `Find current job postings for:
- Role / keywords: ${params.keyword}
- Location / region: ${params.location}
- Level: ${level}
- Work mode: ${mode}

Search the web, then respond with ONLY the JSON object described in your instructions.`;
}

function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function trimSnippet(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= MAX_SNIPPET) return t;
  return `${t.slice(0, MAX_SNIPPET)}…`;
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1].trim() : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("No JSON object found in model output");
  }
  return JSON.parse(body.slice(start, end + 1));
}

/**
 * Uses OpenAI Responses API with the built-in `web_search` tool (requires OPENAI_API_KEY).
 * Returns deduplicated, validated SuggestedJob rows with source "openai".
 */
export async function discoverViaOpenAIWebSearch(
  params: DiscoverFormParams,
): Promise<OpenAiDiscoverResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { jobs: [], error: "missing_openai_key" };
  }

  const model = process.env.OPENAI_DISCOVER_MODEL?.trim() || DEFAULT_DISCOVER_MODEL;
  const client = new OpenAI({ apiKey, timeout: 120_000 });

  const input = buildUserMessage(params);

  try {
    const createOnce = (toolChoice: "required" | "auto") =>
      client.responses.create({
        model,
        tools: [{ type: "web_search" }],
        tool_choice: toolChoice,
        instructions: SYSTEM_INSTRUCTIONS,
        input,
        max_output_tokens: 8192,
        include: ["web_search_call.action.sources"],
      });

    let response;
    try {
      response = await createOnce("required");
    } catch (first) {
      console.warn(
        "[discover][openai] tool_choice=required failed, retrying with auto",
        first instanceof Error ? first.message : first,
      );
      response = await createOnce("auto");
    }

    if (response.error) {
      const msg = response.error.message ?? "OpenAI response error";
      console.error("[discover][openai] response error", response.error);
      return { jobs: [], error: msg };
    }

    const text = response.output_text?.trim() ?? "";
    if (!text) {
      console.error("[discover][openai] empty output_text", {
        model: response.model,
        id: response.id,
      });
      return { jobs: [], error: "empty_model_output" };
    }

    let parsed: unknown;
    try {
      parsed = extractJsonObject(text);
    } catch (e) {
      console.error("[discover][openai] JSON parse failed", text.slice(0, 500));
      return {
        jobs: [],
        error: e instanceof Error ? e.message : "json_parse_failed",
      };
    }

    const jobsRaw = (parsed as { jobs?: unknown }).jobs;
    if (!Array.isArray(jobsRaw)) {
      return { jobs: [], error: "invalid_jobs_array" };
    }

    const seen = new Set<string>();
    const jobs: SuggestedJob[] = [];

    for (const row of jobsRaw) {
      if (jobs.length >= MAX_RESULTS) break;
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const title = typeof r.title === "string" ? r.title.trim() : "";
      const url = typeof r.url === "string" ? r.url.trim() : "";
      let snippet =
        typeof r.snippet === "string" ? trimSnippet(r.snippet) : "—";
      const company = typeof r.company === "string" ? r.company.trim() : null;
      const loc = typeof r.location === "string" ? r.location.trim() : null;

      if (!title || !isValidHttpUrl(url)) continue;

      const key = normalizeJobUrlForMatch(url);
      if (seen.has(key)) continue;
      seen.add(key);

      const extra: string[] = [];
      if (company) extra.push(`Company: ${company}`);
      if (loc) extra.push(`Location: ${loc}`);
      if (extra.length > 0) {
        snippet = `${snippet}${snippet === "—" ? "" : " "}${extra.join(" · ")}`;
      }

      jobs.push({
        title,
        url: new URL(url).toString(),
        snippet: trimSnippet(snippet),
        source: "openai",
      });
    }

    console.log("[discover][openai] ok", {
      model,
      responseId: response.id,
      count: jobs.length,
    });

    return { jobs };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[discover][openai] request failed", msg);
    return { jobs: [], error: msg };
  }
}
