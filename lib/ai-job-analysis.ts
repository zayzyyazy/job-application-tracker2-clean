import OpenAI from "openai";

type AnalysisInput = {
  job: {
    url: string;
    title: string | null;
    company: string | null;
    location: string | null;
    notes: string | null;
    status: string;
    deadline: string | null;
    fetchedTitle: string | null;
    fetchedContentText: string | null;
  };
  profile: {
    headline: string | null;
    university: string | null;
    degreeProgram: string | null;
    currentSemester: string | null;
    bio: string | null;
    targetRoles: string[];
    preferredLocations: string[];
    skills: string[];
    tools: string[];
    interests: string[];
    workPreferences: string | null;
  } | null;
};

export type ParsedAnalysis = {
  roleCategory: string;
  seniority: string;
  skillsNeeded: string[];
  missingSkills: string[];
  fitLabel: string;
  fitReasoning: string;
  actionRecommendation: string;
  urgency: string;
  shortSummary: string;
};

const responseSchema = {
  name: "job_analysis",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      roleCategory: { type: "string" },
      seniority: { type: "string" },
      skillsNeeded: {
        type: "array",
        items: { type: "string" },
      },
      missingSkills: {
        type: "array",
        items: { type: "string" },
      },
      fitLabel: { type: "string" },
      fitReasoning: { type: "string" },
      actionRecommendation: { type: "string" },
      urgency: { type: "string" },
      shortSummary: { type: "string" },
    },
    required: [
      "roleCategory",
      "seniority",
      "skillsNeeded",
      "missingSkills",
      "fitLabel",
      "fitReasoning",
      "actionRecommendation",
      "urgency",
      "shortSummary",
    ],
  },
} as const;

function sanitizeString(value: unknown, fallback = "unclear"): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function parseAnalysisJson(rawText: string): ParsedAnalysis | null {
  try {
    const parsed = JSON.parse(rawText) as Record<string, unknown>;
    return {
      roleCategory: sanitizeString(parsed.roleCategory),
      seniority: sanitizeString(parsed.seniority),
      skillsNeeded: sanitizeStringArray(parsed.skillsNeeded),
      missingSkills: sanitizeStringArray(parsed.missingSkills),
      fitLabel: sanitizeString(parsed.fitLabel).toUpperCase(),
      fitReasoning: sanitizeString(parsed.fitReasoning),
      actionRecommendation: sanitizeString(parsed.actionRecommendation).toUpperCase(),
      urgency: sanitizeString(parsed.urgency).toUpperCase(),
      shortSummary: sanitizeString(parsed.shortSummary),
    };
  } catch {
    return null;
  }
}

export async function requestJobAnalysis(input: AnalysisInput): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_MISSING");
  }

  const client = new OpenAI({ apiKey });
  const trimmedFetchedText = input.job.fetchedContentText
    ? input.job.fetchedContentText.slice(0, 6000)
    : null;

  const prompt = [
    "You are an assistant that helps a student prioritize job applications.",
    "Analyze job and profile context. Return practical advice without overconfidence.",
    "Use fetched job page content as the primary source when available.",
    "Use manual fields and URL as supporting context.",
    "If information is missing, use 'unclear' when appropriate.",
    "Keep reasoning concise and useful.",
    "",
    `Job Context: ${JSON.stringify({ ...input.job, fetchedContentText: trimmedFetchedText })}`,
    `Profile Context: ${JSON.stringify(input.profile)}`,
  ].join("\n");

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: prompt,
    text: {
      format: {
        type: "json_schema",
        name: responseSchema.name,
        schema: responseSchema.schema,
        strict: true,
      },
    },
  });

  return response.output_text ?? "";
}
