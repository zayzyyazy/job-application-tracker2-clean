import { revalidatePath } from "next/cache";

import { logServerError } from "@/lib/server-log";

/** Keep dashboard, tracker, discover, and profile in sync after mutations. */
export function revalidateAppPaths(): void {
  const paths = ["/", "/tracker", "/discover", "/profile"] as const;
  for (const p of paths) {
    try {
      revalidatePath(p);
    } catch (e) {
      logServerError(`revalidatePath:${p}`, e);
    }
  }
}
