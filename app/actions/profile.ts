"use server";

import { prisma } from "@/lib/prisma";
import { revalidateAppPaths } from "@/lib/revalidate-app";
import { logServerError } from "@/lib/server-log";

type ActionResult = {
  ok: boolean;
  message: string;
};

const PROFILE_ID = 1;

function parseOptionalText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseCommaSeparatedList(
  value: FormDataEntryValue | null,
): string[] | undefined {
  if (typeof value !== "string") return undefined;
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return items.length > 0 ? items : undefined;
}

export async function saveProfileAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await prisma.profile.upsert({
      where: { id: PROFILE_ID },
      create: {
        id: PROFILE_ID,
        fullName: parseOptionalText(formData.get("fullName")),
        headline: parseOptionalText(formData.get("headline")),
        university: parseOptionalText(formData.get("university")),
        degreeProgram: parseOptionalText(formData.get("degreeProgram")),
        currentSemester: parseOptionalText(formData.get("currentSemester")),
        bio: parseOptionalText(formData.get("bio")),
        targetRoles: parseCommaSeparatedList(formData.get("targetRoles")),
        preferredLocations: parseCommaSeparatedList(formData.get("preferredLocations")),
        skills: parseCommaSeparatedList(formData.get("skills")),
        tools: parseCommaSeparatedList(formData.get("tools")),
        interests: parseCommaSeparatedList(formData.get("interests")),
        workPreferences: parseOptionalText(formData.get("workPreferences")),
      },
      update: {
        fullName: parseOptionalText(formData.get("fullName")),
        headline: parseOptionalText(formData.get("headline")),
        university: parseOptionalText(formData.get("university")),
        degreeProgram: parseOptionalText(formData.get("degreeProgram")),
        currentSemester: parseOptionalText(formData.get("currentSemester")),
        bio: parseOptionalText(formData.get("bio")),
        targetRoles: parseCommaSeparatedList(formData.get("targetRoles")),
        preferredLocations: parseCommaSeparatedList(formData.get("preferredLocations")),
        skills: parseCommaSeparatedList(formData.get("skills")),
        tools: parseCommaSeparatedList(formData.get("tools")),
        interests: parseCommaSeparatedList(formData.get("interests")),
        workPreferences: parseOptionalText(formData.get("workPreferences")),
      },
    });

    revalidateAppPaths();
    return { ok: true, message: "Profile saved." };
  } catch (e) {
    logServerError("saveProfileAction", e);
    return { ok: false, message: "Could not save profile. Please try again." };
  }
}
