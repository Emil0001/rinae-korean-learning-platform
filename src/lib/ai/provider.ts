export const AI_PROVIDERS = ["openai", "gemini"] as const;

export type AIProvider = (typeof AI_PROVIDERS)[number];

export const AI_STEP_OUTPUT_MODES = ["structured", "custom_ui"] as const;
export type AIStepOutputMode = (typeof AI_STEP_OUTPUT_MODES)[number];

export function isAIProvider(value: unknown): value is AIProvider {
  return value === "openai" || value === "gemini";
}

export function isAIStepOutputMode(value: unknown): value is AIStepOutputMode {
  return value === "structured" || value === "custom_ui";
}
