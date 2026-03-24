"use server";

import { JobStatus } from "@prisma/client";
import { parseAnalysisJson, requestJobAnalysis } from "@/lib/ai-job-analysis";
import { fetchJobPageContent } from "@/lib/job-content-fetcher";
import { buildJobFieldsFromFetch } from "@/lib/job-field-heuristics";
import { revalidateAppPaths } from "@/lib/revalidate-app";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-log";

type ActionResult = {
  ok: boolean;
  message: string;
};

const VALID_STATUSES = new Set(Object.values(JobStatus));

function parseOptionalText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalDate(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseStatus(value: FormDataEntryValue | null): JobStatus | null {
  if (typeof value !== "string") return null;
  return VALID_STATUSES.has(value as JobStatus) ? (value as JobStatus) : null;
}

function parseId(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseJsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function validateUrl(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function createJobAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const url = validateUrl(formData.get("url"));
    if (!url) {
      return { ok: false, message: "Please enter a valid URL (http/https)." };
    }

    const status = parseStatus(formData.get("status")) ?? JobStatus.SAVED;

    const created = await prisma.job.create({
      data: {
        url,
        company: parseOptionalText(formData.get("company")),
        title: parseOptionalText(formData.get("title")),
        location: parseOptionalText(formData.get("location")),
        deadline: parseOptionalDate(formData.get("deadline")),
        notes: parseOptionalText(formData.get("notes")),
        status,
      },
    });

    // Best-effort: fill empty title/company/location from the job page (paste-URL flow).
    try {
      const fetchResult = await fetchJobPageContent(created.url);
      await persistFetchResult(created.id, fetchResult);
    } catch (e) {
      console.error("[createJob] post-create fetch", e);
    }

    revalidateAppPaths();
    return { ok: true, message: "Job added." };
  } catch (e) {
    logServerError("createJobAction", e);
    return { ok: false, message: "Could not save job. Please try again." };
  }
}

export async function updateJobStatusAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = parseId(formData.get("id"));
  const status = parseStatus(formData.get("status"));
  if (!id || !status) return { ok: false, message: "Invalid status update." };

  try {
    const existing = await prisma.job.findUnique({
      where: { id },
      select: { appliedAt: true },
    });
    if (!existing) return { ok: false, message: "Job not found." };

    await prisma.job.update({
      where: { id },
      data: {
        status,
        appliedAt:
          status === JobStatus.APPLIED && !existing.appliedAt ? new Date() : undefined,
      },
    });

    revalidateAppPaths();
    return { ok: true, message: "Status updated." };
  } catch (e) {
    logServerError("updateJobStatusAction", e);
    return { ok: false, message: "Could not update status." };
  }
}

export async function updateJobAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = parseId(formData.get("id"));
  const status = parseStatus(formData.get("status"));
  const url = validateUrl(formData.get("url"));
  if (!id || !status || !url) {
    return { ok: false, message: "Please enter valid job details." };
  }

  try {
    const existing = await prisma.job.findUnique({
      where: { id },
      select: { appliedAt: true },
    });
    if (!existing) return { ok: false, message: "Job not found." };

    await prisma.job.update({
      where: { id },
      data: {
        url,
        company: parseOptionalText(formData.get("company")),
        title: parseOptionalText(formData.get("title")),
        location: parseOptionalText(formData.get("location")),
        deadline: parseOptionalDate(formData.get("deadline")),
        notes: parseOptionalText(formData.get("notes")),
        status,
        appliedAt:
          status === JobStatus.APPLIED && !existing.appliedAt ? new Date() : undefined,
      },
    });

    revalidateAppPaths();
    return { ok: true, message: "Job updated." };
  } catch (e) {
    logServerError("updateJobAction", e);
    return { ok: false, message: "Could not update job." };
  }
}

export async function deleteJobAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = parseId(formData.get("id"));
  if (!id) return { ok: false, message: "Invalid job id." };

  try {
    await prisma.job.delete({
      where: { id },
    });

    revalidateAppPaths();
    return { ok: true, message: "Job deleted." };
  } catch (e) {
    logServerError("deleteJobAction", e);
    return { ok: false, message: "Could not delete job." };
  }
}

async function persistFetchResult(
  id: number,
  result: Awaited<ReturnType<typeof fetchJobPageContent>>,
): Promise<void> {
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return;

  if (!result.ok) {
    await prisma.job.update({
      where: { id },
      data: {
        fetchStatus: "FAILED",
        fetchError: result.error,
        fetchedAt: new Date(),
      },
    });
    return;
  }

  const merge = buildJobFieldsFromFetch(job, {
    fetchedTitle: result.title,
    contentText: result.contentText,
  });

  await prisma.job.update({
    where: { id },
    data: {
      fetchedTitle: result.title,
      fetchedContentText: result.contentText,
      fetchedContentSource: result.source,
      fetchedAt: new Date(),
      fetchStatus: "SUCCESS",
      fetchError: null,
      ...merge,
    },
  });
}

function shortenUserMessage(msg: string, max = 120): string {
  const t = msg.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

/** Runs OpenAI analysis and saves AI fields. Caller must load fresh job + profile. */
async function runJobAnalysisCore(
  id: number,
  job: NonNullable<Awaited<ReturnType<typeof prisma.job.findUnique>>>,
  profile: Awaited<ReturnType<typeof prisma.profile.findUnique>>,
): Promise<ActionResult> {
  let rawText: string;
  try {
    rawText = await requestJobAnalysis({
      job: {
        url: job.url,
        title: job.title,
        company: job.company,
        location: job.location,
        notes: job.notes,
        status: job.status,
        deadline: job.deadline ? job.deadline.toISOString() : null,
        fetchedTitle: job.fetchedTitle,
        fetchedContentText: job.fetchedContentText,
      },
      profile: profile
        ? {
            headline: profile.headline,
            university: profile.university,
            degreeProgram: profile.degreeProgram,
            currentSemester: profile.currentSemester,
            bio: profile.bio,
            targetRoles: parseJsonStringArray(profile.targetRoles),
            preferredLocations: parseJsonStringArray(profile.preferredLocations),
            skills: parseJsonStringArray(profile.skills),
            tools: parseJsonStringArray(profile.tools),
            interests: parseJsonStringArray(profile.interests),
            workPreferences: profile.workPreferences,
          }
        : null,
    });
  } catch (error) {
    console.error("[analyze] OpenAI request failed", error);
    if (error instanceof Error && error.message === "OPENAI_API_KEY_MISSING") {
      return {
        ok: false,
        message: "OpenAI API key missing. Add OPENAI_API_KEY to your .env file.",
      };
    }
    const msg =
      error instanceof Error ? error.message : "Unknown OpenAI error.";
    return {
      ok: false,
      message: `OpenAI request failed: ${shortenUserMessage(msg)}`,
    };
  }

  if (!rawText?.trim()) {
    console.error("[analyze] Empty model output");
    return {
      ok: false,
      message: "AI returned empty output. Check your API quota and try again.",
    };
  }

  const parsed = parseAnalysisJson(rawText);
  if (!parsed) {
    console.error("[analyze] JSON parse failed", rawText.slice(0, 500));
    return {
      ok: false,
      message:
        "Could not parse AI response (invalid JSON). Try again or check the model output in server logs.",
    };
  }

  await prisma.job.update({
    where: { id },
    data: {
      aiRoleCategory: parsed.roleCategory,
      aiSeniority: parsed.seniority,
      aiSkillsNeeded: parsed.skillsNeeded,
      aiMissingSkills: parsed.missingSkills,
      aiFitLabel: parsed.fitLabel,
      aiFitReasoning: parsed.fitReasoning,
      aiActionRecommendation: parsed.actionRecommendation,
      aiUrgency: parsed.urgency,
      aiRawSummary: parsed.shortSummary,
      aiLastAnalyzedAt: new Date(),
    },
  });

  revalidateAppPaths();

  const vague =
    parsed.fitLabel === "UNCLEAR" &&
    parsed.urgency === "UNCLEAR" &&
    parsed.shortSummary.toLowerCase().includes("unclear");

  let note = "Analysis saved.";
  if (vague) {
    note +=
      " Labels look uncertain — try Fetch Content first or add title/notes for clearer input.";
  }
  if (!profile) {
    note += " Add profile details for better quality insights.";
  }

  return { ok: true, message: note };
}

export async function analyzeJobAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = parseId(formData.get("id"));
  if (!id) return { ok: false, message: "Invalid job id." };

  try {
    let job = await prisma.job.findUnique({ where: { id } });
    const profile = await prisma.profile.findUnique({ where: { id: 1 } });

    if (!job) return { ok: false, message: "Job not found." };

    // If no fetched text yet, try a one-time fetch to improve analysis (best-effort).
    const hasContent =
      !!job.fetchedContentText?.trim() && job.fetchStatus === "SUCCESS";
    if (!hasContent) {
      const fetchResult = await fetchJobPageContent(job.url);
      await persistFetchResult(id, fetchResult);
      job = await prisma.job.findUnique({ where: { id } });
      if (!job) return { ok: false, message: "Job not found." };
    }

    return await runJobAnalysisCore(id, job, profile);
  } catch (error) {
    console.error("[analyzeJobAction]", error);
    if (error instanceof Error && error.message === "OPENAI_API_KEY_MISSING") {
      return {
        ok: false,
        message: "OpenAI API key missing. Add OPENAI_API_KEY to your .env file.",
      };
    }
    return {
      ok: false,
      message: `Analysis failed: ${error instanceof Error ? shortenUserMessage(error.message) : "unexpected error"}`,
    };
  }
}

/**
 * Fetches page content when needed, then runs AI analysis.
 * Skips re-fetch when we already have successful extracted text (use "Fetch Content" to refresh).
 */
export async function fetchAndAnalyzeJobAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = parseId(formData.get("id"));
  if (!id) return { ok: false, message: "Invalid job id." };

  try {
    let job = await prisma.job.findUnique({ where: { id } });
    const profile = await prisma.profile.findUnique({ where: { id: 1 } });

    if (!job) return { ok: false, message: "Job not found." };

    const hasFreshContent =
      job.fetchStatus === "SUCCESS" && !!job.fetchedContentText?.trim();

    if (!hasFreshContent) {
      const fetchResult = await fetchJobPageContent(job.url);
      await persistFetchResult(id, fetchResult);
      job = await prisma.job.findUnique({ where: { id } });
      if (!job) return { ok: false, message: "Job not found." };
    }

    return await runJobAnalysisCore(id, job, profile);
  } catch (error) {
    console.error("[fetchAndAnalyzeJobAction]", error);
    if (error instanceof Error && error.message === "OPENAI_API_KEY_MISSING") {
      return {
        ok: false,
        message: "OpenAI API key missing. Add OPENAI_API_KEY to your .env file.",
      };
    }
    return {
      ok: false,
      message: `Fetch + Analyze failed: ${error instanceof Error ? shortenUserMessage(error.message) : "unexpected error"}`,
    };
  }
}

export async function fetchJobContentAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = parseId(formData.get("id"));
  if (!id) return { ok: false, message: "Invalid job id." };

  try {
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return { ok: false, message: "Job not found." };

    const result = await fetchJobPageContent(job.url);
    await persistFetchResult(id, result);
    revalidateAppPaths();

    if (!result.ok) {
      return { ok: false, message: result.error };
    }
    return { ok: true, message: "Content fetched and applied to empty fields where possible." };
  } catch (e) {
    logServerError("fetchJobContentAction", e);
    await prisma.job.update({
      where: { id },
      data: {
        fetchStatus: "FAILED",
        fetchError: "Unexpected fetch error.",
        fetchedAt: new Date(),
      },
    });
    revalidateAppPaths();
    return { ok: false, message: "Could not fetch page content." };
  }
}
