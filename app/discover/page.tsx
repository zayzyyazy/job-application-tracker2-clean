import SuggestedJobsSection from "@/app/components/suggested-jobs-section";
import { ServerPageError } from "@/app/components/server-page-error";
import { parseJsonStringArray } from "@/lib/job-display";
import { prisma } from "@/lib/prisma";
import { formatErrorForUi, logServerError } from "@/lib/server-log";

export default async function DiscoverPage() {
  let profile;
  let existingJobs;
  try {
    [profile, existingJobs] = await Promise.all([
      prisma.profile.findUnique({ where: { id: 1 } }),
      prisma.job.findMany({ select: { url: true } }),
    ]);
  } catch (e) {
    logServerError("DiscoverPage", e);
    return (
      <ServerPageError
        title="Discover couldn’t load"
        message={formatErrorForUi(e)}
      />
    );
  }

  const defaultKeyword = parseJsonStringArray(profile?.targetRoles)[0] ?? "";
  const defaultLocation = parseJsonStringArray(profile?.preferredLocations)[0] ?? "";
  const savedUrls = existingJobs.map((j) => j.url);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Discover jobs</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-300">
        Search the web with explicit filters. We try to hide generic listing pages — save links you
        like to your tracker.
      </p>

      <SuggestedJobsSection
        defaultKeyword={defaultKeyword}
        defaultLocation={defaultLocation}
        savedUrls={savedUrls}
      />
    </main>
  );
}
