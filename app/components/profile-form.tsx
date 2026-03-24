"use client";

import { type Profile } from "@prisma/client";
import { useActionState } from "react";
import { saveProfileAction } from "@/app/actions/profile";
import FormSubmitButton from "@/app/components/form-submit-button";

const initialState = {
  ok: false,
  message: "",
};

type ProfileFormProps = {
  profile: Profile | null;
  defaults: {
    targetRoles: string;
    preferredLocations: string;
    skills: string;
    tools: string;
    interests: string;
  };
};

export default function ProfileForm({ profile, defaults }: ProfileFormProps) {
  const [state, action] = useActionState(saveProfileAction, initialState);

  return (
    <section className="mt-8 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <h2 className="text-lg font-semibold">My Profile</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        Personal preferences for future job fit and AI categorization features.
      </p>

      <form action={action} className="mt-4 grid gap-3">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Full Name</span>
            <input
              name="fullName"
              defaultValue={profile?.fullName ?? ""}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Headline</span>
            <input
              name="headline"
              defaultValue={profile?.headline ?? "First-year student, second semester"}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1">
            <span className="text-sm font-medium">University</span>
            <input
              name="university"
              defaultValue={profile?.university ?? "Universitat Duisburg-Essen"}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Degree Program</span>
            <input
              name="degreeProgram"
              defaultValue={profile?.degreeProgram ?? ""}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Current Semester</span>
            <input
              name="currentSemester"
              defaultValue={profile?.currentSemester ?? "Second semester"}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        </div>

        <label className="grid gap-1">
          <span className="text-sm font-medium">Bio</span>
          <textarea
            name="bio"
            rows={3}
            defaultValue={
              profile?.bio ??
              "Basic coding knowledge, interested in AI tools, and wants to learn from real humans in a practical environment."
            }
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Target Roles (comma-separated)</span>
            <input
              name="targetRoles"
              defaultValue={defaults.targetRoles}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">
              Preferred Locations (comma-separated)
            </span>
            <input
              name="preferredLocations"
              defaultValue={defaults.preferredLocations}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Skills (comma-separated)</span>
            <input
              name="skills"
              defaultValue={defaults.skills}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Tools (comma-separated)</span>
            <input
              name="tools"
              defaultValue={defaults.tools}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        </div>

        <label className="grid gap-1">
          <span className="text-sm font-medium">Interests (comma-separated)</span>
          <input
            name="interests"
            defaultValue={defaults.interests}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">Work Preferences</span>
          <textarea
            name="workPreferences"
            rows={3}
            defaultValue={
              profile?.workPreferences ??
              "Interested in practical teams, mentorship, and hands-on AI tooling."
            }
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <div className="flex items-center gap-3">
          <FormSubmitButton idleText="Save Profile" pendingText="Saving..." />
          {state.message ? (
            <p className={`text-sm ${state.ok ? "text-emerald-600" : "text-red-600"}`}>
              {state.message}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}
