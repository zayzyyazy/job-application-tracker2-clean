/**
 * User-controlled discover search. Values map to <select name="level"> and <select name="workMode">.
 */
export type DiscoverFormParams = {
  keyword: string;
  location: string;
  level: DiscoverLevel;
  workMode: DiscoverWorkMode;
};

export type DiscoverLevel =
  | "any"
  | "internship"
  | "working_student"
  | "junior"
  | "mid";

export type DiscoverWorkMode = "any" | "remote" | "hybrid" | "on_site";

const LEVEL_PHRASE: Record<DiscoverLevel, string> = {
  any: "",
  internship: "internship Praktikum",
  working_student: "Werkstudent working student",
  junior: "junior entry level graduate",
  mid: "mid level",
};

const MODE_PHRASE: Record<DiscoverWorkMode, string> = {
  any: "",
  remote: "remote",
  hybrid: "hybrid",
  on_site: "on-site office",
};

/**
 * Build several complementary queries so DuckDuckGo returns a mix of sources.
 * Phrases favor single postings (apply, vacancy, careers) over bare role keywords.
 */
export function buildDiscoverQueriesFromForm(params: DiscoverFormParams): string[] {
  const keyword = params.keyword.trim() || "software developer";
  const location = params.location.trim() || "Germany";
  const levelBit = LEVEL_PHRASE[params.level] ?? "";
  const modeBit = MODE_PHRASE[params.workMode] ?? "";

  const core = [keyword, levelBit, modeBit, location].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

  const queries = [
    `${core} apply job posting`,
    `${keyword} ${location} vacancy Bewerbung`,
    `${keyword} ${location} careers job opening`,
    `site:linkedin.com/jobs/view ${keyword} ${location}`,
  ];

  const seen = new Set<string>();
  return queries.filter((q) => {
    const k = q.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function parseDiscoverFormData(formData: FormData): DiscoverFormParams {
  const levelRaw = String(formData.get("level") ?? "any");
  const workRaw = String(formData.get("workMode") ?? "any");

  const level: DiscoverLevel = [
    "any",
    "internship",
    "working_student",
    "junior",
    "mid",
  ].includes(levelRaw)
    ? (levelRaw as DiscoverLevel)
    : "any";

  const workMode: DiscoverWorkMode = ["any", "remote", "hybrid", "on_site"].includes(
    workRaw,
  )
    ? (workRaw as DiscoverWorkMode)
    : "any";

  return {
    keyword: String(formData.get("keyword") ?? "").trim(),
    location: String(formData.get("location") ?? "").trim(),
    level,
    workMode,
  };
}
