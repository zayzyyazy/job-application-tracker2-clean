import * as cheerio from "cheerio";

type FetchResult =
  | {
      ok: true;
      title: string | null;
      contentText: string;
      source: "html-extraction";
    }
  | {
      ok: false;
      error: string;
    };

const FETCH_TIMEOUT_MS = 12000;
const MAX_CONTENT_LENGTH = 12000;

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input;
  return `${input.slice(0, maxLength)}...`;
}

function isHttpUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function shortenErrorMessage(message: string): string {
  const clean = normalizeWhitespace(message);
  return clean.length > 180 ? `${clean.slice(0, 180)}...` : clean;
}

export async function fetchJobPageContent(url: string): Promise<FetchResult> {
  if (!isHttpUrl(url)) {
    return { ok: false, error: "Invalid URL. Only http/https links are supported." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 JobTrackerMVP/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return { ok: false, error: `Failed to fetch page (HTTP ${response.status}).` };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    $("script, style, noscript, svg, nav, footer, header, aside, form").remove();

    const title = normalizeWhitespace($("title").first().text()) || null;

    // Prefer semantic containers when available, fallback to body text.
    const mainText =
      normalizeWhitespace(
        $("main, article, [role='main'], .job-description, .description")
          .first()
          .text(),
      ) || normalizeWhitespace($("body").text());

    if (!mainText) {
      return { ok: false, error: "Could not extract readable content from this page." };
    }

    return {
      ok: true,
      title,
      contentText: truncate(mainText, MAX_CONTENT_LENGTH),
      source: "html-extraction",
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "Fetch timed out. Please try again." };
    }
    return {
      ok: false,
      error:
        error instanceof Error
          ? shortenErrorMessage(error.message)
          : "Unknown fetch error.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
