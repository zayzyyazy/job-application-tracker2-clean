import type { Job } from "@prisma/client";

/**
 * Best-effort extraction from page <title> and body text.
 * Does not claim to be accurate — only fills blanks when the user did not type them.
 */

const MAX_FIELD = 200;

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Split "Role | Company", "Role - Company", "Role at Company", "Role — Company" */
export function inferCompanyFromTitleText(title: string): string | null {
  const t = clean(title);
  if (!t) return null;

  const pipe = t.split(/\s*\|\s*/);
  if (pipe.length >= 2) {
    const right = clean(pipe[pipe.length - 1]);
    if (right.length > 1 && right.length < MAX_FIELD) return right;
  }

  const at = /\s+at\s+([^|]+)$/i.exec(t);
  if (at) {
    const rest = clean(at[1].split(/[-–—|]/)[0] ?? "");
    if (rest.length > 1) return rest.slice(0, MAX_FIELD);
  }

  const dash = t.split(/\s[-–—]\s/);
  if (dash.length >= 2) {
    const last = clean(dash[dash.length - 1]);
    if (last.length > 1 && last.length < MAX_FIELD) return last;
  }

  return null;
}

/** Very lightweight: look for "Location:" lines or common city patterns in first 4k chars */
export function inferLocationFromContentText(content: string): string | null {
  const sample = content.slice(0, 4000);

  const labeled =
    /(?:^|\n)\s*(?:Location|Standort|Ort)\s*[:]\s*([^\n]+)/im.exec(sample);
  if (labeled) {
    const v = clean(labeled[1]).replace(/[,.]$/, "");
    if (v.length > 1 && v.length < 120) return v;
  }

  const remote = /\b(Remote|Hybrid|On-?site)\b/i.exec(sample);
  if (remote) return remote[1];

  const deCity =
    /\b(Berlin|München|Hamburg|Frankfurt|Köln|Düsseldorf|Essen|Duisburg|Stuttgart|Leipzig|Dortmund|Remote)\b/i.exec(
      sample,
    );
  if (deCity) return deCity[1];

  return null;
}

export type FetchMergeInput = {
  fetchedTitle: string | null;
  contentText: string;
};

/**
 * Returns Prisma update payload for main fields only where existing job values are empty.
 */
export function buildJobFieldsFromFetch(
  job: Pick<Job, "title" | "company" | "location">,
  fetch: FetchMergeInput,
): {
  title?: string;
  company?: string | null;
  location?: string | null;
} {
  const out: { title?: string; company?: string | null; location?: string | null } =
    {};

  const pageTitle = fetch.fetchedTitle ? clean(fetch.fetchedTitle) : "";
  // Strip common site suffixes from browser titles
  const simplifiedTitle = pageTitle
    .replace(/\s*[-|–—]\s*[^-|–—]+$/i, "")
    .trim();

  if (!job.title?.trim() && simplifiedTitle) {
    out.title = simplifiedTitle.slice(0, 500);
  }

  const sourceForCompany = out.title ?? job.title ?? simplifiedTitle;
  if (!job.company?.trim() && sourceForCompany) {
    const co = inferCompanyFromTitleText(sourceForCompany);
    if (co) out.company = co;
  }

  if (!job.location?.trim()) {
    const loc = inferLocationFromContentText(fetch.contentText);
    if (loc) out.location = loc;
  }

  return out;
}
