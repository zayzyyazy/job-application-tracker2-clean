import { JobStatus } from "@prisma/client";

/** Invalid / out-of-range DB datetimes become Invalid Date; Intl throws RangeError. */
function isValidTimeMs(d: Date | null): d is Date {
  if (!d) return false;
  return Number.isFinite(d.getTime());
}

export function formatJobDate(date: Date | null): string {
  if (!isValidTimeMs(date)) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatDateInputValue(date: Date | null): string {
  if (!isValidTimeMs(date)) return "";
  return date.toISOString().slice(0, 10);
}

export function parseJsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export const statusBadgeClassMap: Record<JobStatus, string> = {
  SAVED: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  APPLIED: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  HEARD_BACK:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  INTERVIEW:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  OFFER:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

const FALLBACK_STATUS_BADGE_CLASS =
  "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";

/** Safe when DB enum and Prisma disagree — avoids undefined badge class and replaceAll on non-string. */
export function statusBadgeClassForStatus(status: unknown): string {
  if (typeof status === "string" && status in statusBadgeClassMap) {
    return statusBadgeClassMap[status as JobStatus];
  }
  return FALLBACK_STATUS_BADGE_CLASS;
}

export function safeJobStatusLabel(status: unknown): string {
  return String(status ?? "").replaceAll("_", " ");
}

export function getBadgeTone(value: string | null): string {
  const upper = (value ?? "").toUpperCase();
  if (upper === "HIGH" || upper === "APPLY") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  }
  if (upper === "MEDIUM" || upper === "MAYBE") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  }
  if (upper === "LOW" || upper === "SKIP") {
    return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
  }
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
}

export function getFetchStatusTone(status: string | null): string {
  if (status === "SUCCESS") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  }
  if (status === "FAILED") {
    return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
  }
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
}

export function getDeadlineMeta(deadline: Date | null, status: JobStatus) {
  if (!deadline || !isValidTimeMs(deadline)) {
    return {
      label: "No deadline",
      className: "text-zinc-600 dark:text-zinc-300",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(deadline);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((target.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0 && status !== JobStatus.REJECTED && status !== JobStatus.OFFER) {
    return {
      label: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"}`,
      className: "text-red-600 dark:text-red-400",
    };
  }

  if (diffDays <= 14 && diffDays >= 0) {
    return {
      label: `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
      className: "text-amber-600 dark:text-amber-400",
    };
  }

  return {
    label: formatJobDate(deadline),
    className: "text-zinc-600 dark:text-zinc-300",
  };
}
