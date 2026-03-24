import ProfileForm from "@/app/components/profile-form";
import { ServerPageError } from "@/app/components/server-page-error";
import { parseJsonStringArray } from "@/lib/job-display";
import { prisma } from "@/lib/prisma";
import { formatErrorForUi, logServerError } from "@/lib/server-log";

export default async function ProfilePage() {
  let profile;
  try {
    profile = await prisma.profile.findUnique({ where: { id: 1 } });
  } catch (e) {
    logServerError("ProfilePage", e);
    return (
      <ServerPageError
        title="Profile couldn’t load"
        message={formatErrorForUi(e)}
      />
    );
  }

  const profileDefaults = {
    targetRoles:
      parseJsonStringArray(profile?.targetRoles).join(", ") ||
      "AI intern, Working student software, Automation intern",
    preferredLocations:
      parseJsonStringArray(profile?.preferredLocations).join(", ") ||
      "Duisburg, Essen, Remote",
    skills:
      parseJsonStringArray(profile?.skills).join(", ") ||
      "Basic coding, Workflow automation",
    tools: parseJsonStringArray(profile?.tools).join(", ") || "n8n, Cursor, Claude Code",
    interests:
      parseJsonStringArray(profile?.interests).join(", ") ||
      "AI tools, Practical learning, Mentorship",
  };

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">My profile</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-300">
        Your profile powers discovery search and future fit scoring.
      </p>

      <ProfileForm profile={profile} defaults={profileDefaults} />
    </main>
  );
}
