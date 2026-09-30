import type { AIProvider } from "@/lib/ai/provider";

const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

type GeminiJsonInput = {
  systemPrompt: string;
  userPrompt: string;
  schema: unknown;
};

type GeminiResponse = {
  error?: { message?: string };
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

export async function generateGeminiJson({ systemPrompt, userPrompt, schema }: GeminiJsonInput) {
  const apiKey = (process.env.gemini_key ?? process.env.GEMINI_API_KEY ?? process.env.GEMINI_KEY)?.trim();
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Add gemini_key (or GEMINI_API_KEY) to the server environment.");
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const response = await fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: toGeminiSchema(schema),
      },
    }),
  });

  const payload = (await response.json()) as GeminiResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Gemini could not generate content.");
  }

  const text = payload.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  try {
    return JSON.parse(stripJsonFence(text));
  } catch {
    throw new Error("Could not parse the Gemini response as JSON.");
  }
}

/** Gemini's REST schema uses uppercase type names and does not need OpenAI's extra fields. */
function toGeminiSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toGeminiSchema);
  if (!value || typeof value !== "object") return value;

  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (key === "additionalProperties" || key === "minItems" || key === "maxItems") continue;
    if (key === "type" && typeof entry === "string") {
      result[key] = entry.toUpperCase();
      continue;
    }
    result[key] = toGeminiSchema(entry);
  }
  return result;
}

function stripJsonFence(value: string) {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

export type { AIProvider };
