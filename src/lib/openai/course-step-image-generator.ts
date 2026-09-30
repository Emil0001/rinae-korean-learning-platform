const OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/generations";
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1.5";

type GenerateCourseStepImageInput = {
  levelTitle: string;
  unitTitle: string;
  lessonTitle: string;
  stepTitle: string;
  stepType: string;
  stepContent: string;
  request: string;
};

export async function generateCourseStepImage(input: GenerateCourseStepImageInput) {
  const apiKey = process.env.SVINKA_KEY?.trim();
  if (!apiKey) {
    throw new Error("SVINKA_KEY не найден. Добавьте ключ OpenAI в окружение сервера.");
  }

  const prompt = [
    "Create one clean educational illustration for a language learning lesson.",
    "Avoid text overlays, UI chrome, watermarks, logos, and letters inside the image.",
    "Style: soft, modern, friendly, readable, suitable for an online Korean learning platform.",
    `Course level: ${input.levelTitle}.`,
    `Unit: ${input.unitTitle}.`,
    `Lesson: ${input.lessonTitle}.`,
    `Step type: ${input.stepType}.`,
    `Step title: ${input.stepTitle}.`,
    input.stepContent ? `Lesson context: ${input.stepContent.slice(0, 1200)}.` : "",
    `Image request: ${input.request}.`,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch(OPENAI_IMAGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_IMAGE_MODEL,
      prompt,
      size: "1024x1024",
      quality: "medium",
    }),
  });

  const payload = (await response.json()) as {
    error?: { message?: string };
    data?: Array<{ b64_json?: string }>;
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "OpenAI не смог сгенерировать изображение.");
  }

  const base64 = payload.data?.[0]?.b64_json?.trim();
  if (!base64) {
    throw new Error("OpenAI не вернул изображение.");
  }

  return {
    imageUrl: `data:image/png;base64,${base64}`,
    model: OPENAI_IMAGE_MODEL,
  };
}
