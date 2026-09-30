import { slugify } from "@/lib/course-content";
import { generateGeminiJson } from "@/lib/gemini/client";
import type { AIProvider } from "@/lib/ai/provider";
import type { AdminCourseLesson, AdminCourseStep, CourseLessonMode, CourseStepType } from "@/types/courses";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = "gpt-5-mini";

type GenerateLessonDraftInput = {
  levelTitle: string;
  levelNumber: number;
  unitTitle: string;
  unitDescription: string;
  lessonMode: CourseLessonMode;
  request: string;
  currentLessonTitle?: string;
  currentLessonSummary?: string;
};

type GeneratedLessonDraft = Pick<
  AdminCourseLesson,
  "slug" | "title" | "summary" | "estimatedMinutes" | "mode" | "steps"
>;

type StandardSchemaResult = {
  title: string;
  summary: string;
  estimatedMinutes: number;
  grammar: { title: string; content: string };
  examples: { title: string; content: string };
  vocabulary: { title: string; content: string };
  practice: { title: string; content: string };
  quiz: {
    title: string;
    questions: QuizQuestionDraft[];
  };
};

type FlexibleSchemaResult = {
  title: string;
  summary: string;
  estimatedMinutes: number;
  steps: Array<{
    type: CourseStepType;
    title: string;
    content: string;
    questions?: QuizQuestionDraft[];
  }>;
};

type QuizQuestionDraft = {
  question: string;
  options: Array<{
    text: string;
    isCorrect: boolean;
  }>;
  explanation: string;
};

export async function generateLessonDraftWithAI(
  input: GenerateLessonDraftInput,
  provider: AIProvider = "openai",
): Promise<GeneratedLessonDraft> {
  const request = input.lessonMode === "STANDARD" ? buildStandardRequest(input) : buildFlexibleRequest(input);

  if (provider === "gemini") {
    const geminiRequest = request as unknown as GeminiCompatibleRequest;
    const parsed = await generateGeminiJson({
      systemPrompt: extractInputText(geminiRequest, 0),
      userPrompt: extractInputText(geminiRequest, 1),
      schema: geminiRequest.text.format.schema,
    });
    return input.lessonMode === "STANDARD"
      ? normalizeStandardDraft(parsed as StandardSchemaResult)
      : normalizeFlexibleDraft(parsed as FlexibleSchemaResult);
  }

  const apiKey = process.env.SVINKA_KEY?.trim();
  if (!apiKey) {
    throw new Error("SVINKA_KEY не найден. Добавьте ключ OpenAI в окружение сервера.");
  }

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(request),
  });

  const payload = (await response.json()) as {
    error?: { message?: string };
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "OpenAI не смог сгенерировать урок.");
  }

  const outputText = extractOutputText(payload);
  if (!outputText) {
    throw new Error("OpenAI вернул пустой ответ.");
  }

  let parsed: StandardSchemaResult | FlexibleSchemaResult;
  try {
    parsed = JSON.parse(outputText) as StandardSchemaResult | FlexibleSchemaResult;
  } catch {
    throw new Error("Не удалось распарсить AI-ответ в JSON.");
  }

  return input.lessonMode === "STANDARD"
    ? normalizeStandardDraft(parsed as StandardSchemaResult)
    : normalizeFlexibleDraft(parsed as FlexibleSchemaResult);
}

type GeminiCompatibleRequest = {
  input: Array<{ content?: Array<{ text?: string }> }>;
  text: { format: { schema: unknown } };
};

function extractInputText(request: GeminiCompatibleRequest, index: number) {
  return request.input[index]?.content?.map((part) => part.text ?? "").join("\n") ?? "";
}

function extractOutputText(payload: {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
}) {
  const direct = payload.output_text?.trim();
  if (direct) {
    return direct;
  }

  const messageText = payload.output
    ?.flatMap((item) => item.content ?? [])
    .find((entry) => entry.type === "output_text" && typeof entry.text === "string")
    ?.text;

  return messageText?.trim() ?? "";
}

function buildSystemPrompt(input: GenerateLessonDraftInput) {
  return [
    "Ты опытный методист по корейскому языку для онлайн-платформы.",
    "Пиши весь результат только на русском языке.",
    "Создавай урок практичным, понятным и пригодным для вставки в админку без ручной переработки.",
    " не добавляй пояснений вне JSON.",
    "Содержание должно быть ориентировано на изучение корейского языка.",
    "Во всех шагах пиши конкретный учебный контент, а не общие инструкции.",
    "Если уместно, добавляй короткие корейские фразы или реплики с пояснением на русском.",
    "Можешь использовать простой rich-text синтаксис внутри content: **жирный**, __подчеркнутый__, ==выделенный==.",
    "Если материал лучше объясняется в сравнении, можешь строить markdown-таблицы с символом |.",
    "Для мини-диалогов используй специальный блок:",
    "[dialogue]",
    "Учитель: короткая реплика",
    "Студент: короткий ответ",
    "[/dialogue]",
    "Каждая реплика диалога должна быть на новой строке. Не оформляй диалог обычным списком.",
    "Для шага EXAMPLES обязательно включай несколько примерных предложений и хотя бы один мини-диалог.",
    "Для шага VOCABULARY давай список слов и выражений построчно.",
    "Для шага PRACTICE давай упражнения и ролевые задания.",
    "Для шага QUIZ возвращай не обычный текст, а набор вопросов с вариантами ответов и объяснениями.",
    `Контекст: уровень ${input.levelNumber} — ${input.levelTitle}; юнит — ${input.unitTitle}.`,
    input.unitDescription ? `Описание юнита: ${input.unitDescription}.` : "",
    input.currentLessonTitle ? `Текущее название урока в черновике: ${input.currentLessonTitle}.` : "",
    input.currentLessonSummary ? `Текущее описание урока в черновике: ${input.currentLessonSummary}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildUserPrompt(input: GenerateLessonDraftInput) {
  return [
    `Нужно создать урок в режиме ${input.lessonMode === "STANDARD" ? "STANDARD" : "FLEXIBLE"}.`,
    "Запрос администратора:",
    input.request.trim(),
  ].join("\n");
}

function buildStandardRequest(input: GenerateLessonDraftInput) {
  return {
    model: OPENAI_MODEL,
    reasoning: { effort: "medium" },
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: buildSystemPrompt(input),
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildUserPrompt(input),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "standard_lesson_draft",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            summary: { type: "string" },
            estimatedMinutes: { type: "number" },
            grammar: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                content: { type: "string" },
              },
              required: ["title", "content"],
            },
            examples: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                content: { type: "string" },
              },
              required: ["title", "content"],
            },
            vocabulary: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                content: { type: "string" },
              },
              required: ["title", "content"],
            },
            practice: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                content: { type: "string" },
              },
              required: ["title", "content"],
            },
            quiz: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                questions: {
                  type: "array",
                  minItems: 3,
                  maxItems: 5,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      question: { type: "string" },
                      options: {
                        type: "array",
                        minItems: 3,
                        maxItems: 4,
                        items: {
                          type: "object",
                          additionalProperties: false,
                          properties: {
                            text: { type: "string" },
                            isCorrect: { type: "boolean" },
                          },
                          required: ["text", "isCorrect"],
                        },
                      },
                      explanation: { type: "string" },
                    },
                    required: ["question", "options", "explanation"],
                  },
                },
              },
              required: ["title", "questions"],
            },
          },
          required: [
            "title",
            "summary",
            "estimatedMinutes",
            "grammar",
            "examples",
            "vocabulary",
            "practice",
            "quiz",
          ],
        },
      },
    },
  };
}

function buildFlexibleRequest(input: GenerateLessonDraftInput) {
  return {
    model: OPENAI_MODEL,
    reasoning: { effort: "medium" },
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              buildSystemPrompt(input),
              "Для FLEXIBLE-урока собери 3-6 шагов.",
              "Шаги должны идти в логичном учебном порядке.",
              "Можно использовать типы GRAMMAR, EXAMPLES, VOCABULARY, PRACTICE, QUIZ и CUSTOM.",
            ].join("\n"),
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildUserPrompt(input),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "flexible_lesson_draft",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            summary: { type: "string" },
            estimatedMinutes: { type: "number" },
            steps: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  type: {
                    type: "string",
                    enum: ["GRAMMAR", "EXAMPLES", "VOCABULARY", "PRACTICE", "QUIZ", "CUSTOM"],
                  },
                  title: { type: "string" },
                  content: { type: "string" },
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        question: { type: "string" },
                        options: {
                          type: "array",
                          minItems: 3,
                          maxItems: 4,
                          items: {
                            type: "object",
                            additionalProperties: false,
                            properties: {
                              text: { type: "string" },
                              isCorrect: { type: "boolean" },
                            },
                            required: ["text", "isCorrect"],
                          },
                        },
                        explanation: { type: "string" },
                      },
                      required: ["question", "options", "explanation"],
                    },
                  },
                },
                required: ["type", "title", "content"],
              },
            },
          },
          required: ["title", "summary", "estimatedMinutes", "steps"],
        },
      },
    },
  };
}

function normalizeStandardDraft(parsed: StandardSchemaResult): GeneratedLessonDraft {
  return {
    slug: slugify(parsed.title || "ai-lesson"),
    title: sanitizeText(parsed.title, "Новый урок"),
    summary: sanitizeText(parsed.summary, "Сгенерированный AI-урок."),
    estimatedMinutes: clampMinutes(parsed.estimatedMinutes),
    mode: "STANDARD",
    steps: [
      createStep("GRAMMAR", parsed.grammar.title, parsed.grammar.content),
      createStep("EXAMPLES", parsed.examples.title, parsed.examples.content),
      createStep("VOCABULARY", parsed.vocabulary.title, parsed.vocabulary.content),
      createStep("PRACTICE", parsed.practice.title, parsed.practice.content),
      createStep("QUIZ", parsed.quiz.title, serializeQuizContent(parsed.quiz.questions)),
    ],
  };
}

function normalizeFlexibleDraft(parsed: FlexibleSchemaResult): GeneratedLessonDraft {
  const steps = Array.isArray(parsed.steps)
    ? parsed.steps
        .slice(0, 6)
        .map((step, index) =>
          createStep(
            normalizeStepType(step.type),
            sanitizeText(step.title, `Шаг ${index + 1}`),
            normalizeFlexibleStepContent(step),
          ),
        )
    : [];

  return {
    slug: slugify(parsed.title || "ai-lesson"),
    title: sanitizeText(parsed.title, "Новый урок"),
    summary: sanitizeText(parsed.summary, "Сгенерированный AI-урок."),
    estimatedMinutes: clampMinutes(parsed.estimatedMinutes),
    mode: "FLEXIBLE",
    steps:
      steps.length > 0
        ? steps
        : [createStep("CUSTOM", "AI-черновик", "Добавьте содержимое урока по запросу администратора.")],
  };
}

function createStep(type: CourseStepType, title: string, content: string): AdminCourseStep {
  return {
    type,
    title: sanitizeText(title, fallbackStepTitle(type)),
    content: sanitizeText(content, "Добавьте содержимое шага."),
    imageUrl: null,
  };
}

function normalizeFlexibleStepContent(step: FlexibleSchemaResult["steps"][number]) {
  if (step.type === "QUIZ" && step.questions?.length) {
    return serializeQuizContent(step.questions);
  }

  return sanitizeText(step.content, "Добавьте содержимое шага.");
}

function serializeQuizContent(questions: QuizQuestionDraft[]) {
  return JSON.stringify(
    {
      questions: questions.map((question) => ({
        question: sanitizeText(question.question, "Вопрос"),
        options: normalizeQuizOptions(question.options),
        explanation: sanitizeText(question.explanation, "Проверьте правило и попробуйте еще раз."),
      })),
    },
    null,
    2,
  );
}

function normalizeQuizOptions(options: QuizQuestionDraft["options"]) {
  const sanitized = options
    .slice(0, 4)
    .map((option) => ({
      text: sanitizeText(option.text, "Вариант"),
      isCorrect: Boolean(option.isCorrect),
    }));

  if (sanitized.some((option) => option.isCorrect)) {
    return sanitized;
  }

  return sanitized.map((option, index) => ({
    ...option,
    isCorrect: index === 0,
  }));
}

function fallbackStepTitle(type: CourseStepType) {
  const labels: Record<CourseStepType, string> = {
    GRAMMAR: "Грамматика",
    EXAMPLES: "Примеры",
    VOCABULARY: "Словарь",
    PRACTICE: "Практика",
    QUIZ: "Мини-тест",
    CUSTOM: "Свободный шаг",
  };

  return labels[type];
}

function normalizeStepType(type: string): CourseStepType {
  if (
    type === "GRAMMAR" ||
    type === "EXAMPLES" ||
    type === "VOCABULARY" ||
    type === "PRACTICE" ||
    type === "QUIZ" ||
    type === "CUSTOM"
  ) {
    return type;
  }

  return "CUSTOM";
}

function sanitizeText(value: string, fallback: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function clampMinutes(value: number) {
  if (!Number.isFinite(value)) {
    return 18;
  }

  return Math.min(90, Math.max(5, Math.round(value)));
}
