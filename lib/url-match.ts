/** Normalize URLs for comparing saved tracker rows with discover results. */
export function normalizeJobUrlForMatch(raw: string): string {
  try {
    const url = new URL(raw.trim());
    url.hash = "";
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.origin}${path}`.toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}
