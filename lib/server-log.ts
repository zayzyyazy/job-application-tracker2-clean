/**
 * Structured server-side logging for debugging Tauri desktop and web parity.
 */

export function logServerError(scope: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(`[server-error][${scope}]`, msg);
  if (stack) {
    console.error(stack);
  } else if (err !== null && typeof err === "object") {
    console.error(`[server-error][${scope}]`, err);
  }
}

export function formatErrorForUi(err: unknown): string {
  if (err instanceof Error) return err.message || "Unknown error";
  return String(err);
}
