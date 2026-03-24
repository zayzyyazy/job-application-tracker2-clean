/**
 * Runtime-only suggestion from web search (not persisted until user clicks Save).
 */
export type SuggestedJob = {
  title: string;
  url: string;
  snippet: string;
  /** `openai` = OpenAI web search; `search` = DuckDuckGo HTML; `brave` = legacy Brave API (unused by default). */
  source: "openai" | "search" | "brave";
};
