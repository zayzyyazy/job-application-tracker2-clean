import type { SuggestedJob } from "@/lib/suggested-job";

/**
 * Heuristic quality score for a single search result. Higher = more likely a real job posting.
 * We down-rank aggregate search / category / "N jobs" pages and up-rank detail-style URLs and
 * posting-like titles/snippets. This is best-effort — HTML search is noisy by nature.
 */
export function scoreDiscoverResult(job: SuggestedJob): number {
  const title = job.title.toLowerCase();
  const snippet = job.snippet.toLowerCase();
  let url = "";
  try {
    url = new URL(job.url).pathname.toLowerCase() + new URL(job.url).search.toLowerCase();
  } catch {
    url = job.url.toLowerCase();
  }

  let score = 0;

  // Strong negatives: aggregate / search / hub pages
  const badTitlePatterns: RegExp[] = [
    /\d+\s*(jobs?|stellen|positions?|offers?|roles?)\b/i,
    /\bjobs?\s+found\b/i,
    /\bsearch\s+results\b/i,
    /\bbrowse\s+(all\s+)?jobs?\b/i,
    /\bartificial intelligence jobs on\b/i,
    /\bengineering jobs in\b/i,
    /\bopen jobs\b/i,
    /\bjob listings?\b/i,
    /\bcareer opportunities\b.*\d+/i,
    /\ball\s+jobs\b/i,
    /\bjobs?\s+in\s+\w+\s*[-–]\s*\d+/i,
  ];
  for (const re of badTitlePatterns) {
    if (re.test(title)) score -= 45;
  }

  const badUrlPatterns: RegExp[] = [
    /\/jobs\?/,
    /\/job-search/,
    /\/stellen\?/,
    /\/suche/,
    /glassdoor\.[^/]+\/.*(search|browse)/i,
    /indeed\.com\/(rc)?jobs\?/i,
    /linkedin\.com\/jobs\/search/i,
    /linkedin\.com\/jobs\/collections/i,
    /stepstone\.de\/.*jobs\?/i,
    /xing\.com\/jobs\/search/i,
    /monster\.com\/jobs\/q-/i,
    /ziprecruiter\.com\/jsearch/i,
    /\/category\//i,
    /\/categories\//i,
  ];
  for (const re of badUrlPatterns) {
    if (re.test(url) || re.test(job.url.toLowerCase())) score -= 55;
  }

  // Positives: paths that often indicate a single posting or ATS detail
  const goodUrlPatterns: RegExp[] = [
    /linkedin\.com\/jobs\/view\//i,
    /\/jobs\/view\//i,
    /\/job\//i,
    /\/jobs\/\d+/i,
    /\/position\//i,
    /\/stellenangebote?\//i,
    /\/vacancies\//i,
    /\/opening\//i,
    /greenhouse\.io\//i,
    /lever\.co\//i,
    /jobs\.lever\.co/i,
    /boards\.greenhouse\.io/i,
    /myworkdayjobs\.com/i,
    /smartrecruiters\.com/i,
  ];
  for (const re of goodUrlPatterns) {
    if (re.test(job.url)) score += 40;
  }

  // Snippet looks like a posting excerpt
  const goodSnippetHints = [
    "apply",
    "requirements",
    "qualifications",
    "responsibilities",
    "bewerbung",
    "anforderungen",
    "aufgaben",
    "years of experience",
    "full-time",
    "part-time",
  ];
  for (const h of goodSnippetHints) {
    if (snippet.includes(h)) score += 8;
  }

  const badSnippetHints = ["showing", "results for", "did you mean", "see all"];
  for (const h of badSnippetHints) {
    if (snippet.includes(h)) score -= 15;
  }

  // Title looks like a concrete role line (not a hub)
  if (/\b(intern|engineer|developer|analyst|student|werkstudent|praktikum)\b/i.test(title)) {
    score += 12;
  }
  if (/\s(at|@|\||–|-)\s/.test(job.title)) {
    score += 10;
  }

  return score;
}

/**
 * Drop very low scores, sort best first, cap length.
 */
export function filterAndRankDiscoverResults(
  jobs: SuggestedJob[],
  opts?: { minScore?: number; maxResults?: number },
): { jobs: SuggestedJob[]; dropped: number; rawCount: number } {
  const minScore = opts?.minScore ?? -35;
  const maxResults = opts?.maxResults ?? 15;
  const rawCount = jobs.length;

  const scored = jobs
    .map((j) => ({ job: j, score: scoreDiscoverResult(j) }))
    .filter(({ score }) => score >= minScore)
    .sort((a, b) => b.score - a.score);

  const dropped = rawCount - scored.length;
  return {
    jobs: scored.slice(0, maxResults).map((s) => s.job),
    dropped,
    rawCount,
  };
}

/**
 * Strict filter first; if that removes **everything**, return the top-N raw results by score
 * (still sorted) so the user sees something useful with a "fallback" note in the UI.
 */
export function filterAndRankWithFallback(
  jobs: SuggestedJob[],
  opts?: { minScore?: number; maxResults?: number },
): {
  jobs: SuggestedJob[];
  dropped: number;
  rawCount: number;
  usedFallback: boolean;
} {
  const maxResults = opts?.maxResults ?? 15;
  const strict = filterAndRankDiscoverResults(jobs, opts);
  if (strict.jobs.length > 0) {
    return { ...strict, usedFallback: false };
  }
  if (jobs.length === 0) {
    return { jobs: [], dropped: 0, rawCount: 0, usedFallback: false };
  }

  const scored = jobs
    .map((j) => ({ job: j, score: scoreDiscoverResult(j) }))
    .sort((a, b) => b.score - a.score);

  return {
    jobs: scored.slice(0, maxResults).map((s) => s.job),
    dropped: Math.max(0, jobs.length - maxResults),
    rawCount: jobs.length,
    usedFallback: true,
  };
}
