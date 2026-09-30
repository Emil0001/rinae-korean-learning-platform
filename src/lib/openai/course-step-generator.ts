import type { AdminCourseStep, CourseStepType } from "@/types/courses";
import { generateGeminiJson } from "@/lib/gemini/client";
import type { AIProvider, AIStepOutputMode } from "@/lib/ai/provider";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = "gpt-5-mini";

type GenerateCourseStepDraftInput = {
  levelTitle: string;
  unitTitle: string;
  lessonTitle: string;
  lessonSummary: string;
  stepType: CourseStepType;
  stepTitle: string;
  currentContent: string;
  request: string;
};

type QuizQuestionKind = "CHOICE" | "FILL_IN_BLANK" | "TRUE_FALSE";

type QuizQuestionDraft = {
  kind: QuizQuestionKind;
  prompt: string;
  sentence: string;
  options: Array<{
    text: string;
    isCorrect: boolean;
  }>;
  explanation: string;
};

type TextStepSchemaResult = {
  title: string;
  content: string;
};

type CustomUiStepSchemaResult = {
  title: string;
  html: string;
};

type QuizStepSchemaResult = {
  title: string;
  questions: QuizQuestionDraft[];
};

type PracticeExerciseDraft = {
  kind: "DESCRIPTION" | "BUILD_SENTENCE" | "FILL_GAP" | "CHOOSE_PARTICLE" | "TYPE_ANSWER" | "MATCH_PAIRS" | "HANDWRITING_TRACE" | "LISTEN_CHOOSE" | "LISTEN_TYPE";
  prompt: string;
  description: string;
  sentence: string;
  answer: string;
  words: string[];
  options: string[];
  pairs: Array<{ left: string; right: string }>;
  imageUrl: string;
  audioUrl: string;
  minStrokeLength: number;
  explanation: string;
};

type PracticeStepSchemaResult = {
  title: string;
  exercises: PracticeExerciseDraft[];
};

export async function generateCourseStepDraftWithAI(
  input: GenerateCourseStepDraftInput,
  provider: AIProvider = "openai",
  outputMode: AIStepOutputMode = "structured",
): Promise<Pick<AdminCourseStep, "title" | "content"> & { type?: CourseStepType }> {
  const customUi = outputMode === "custom_ui";
  const practiceFlow = shouldGeneratePracticeFlow(input);
  const request = customUi
    ? buildCustomUiStepRequest(input)
    : input.stepType === "QUIZ"
    ? buildQuizStepRequest(input)
    : practiceFlow
      ? buildPracticeStepRequest(input)
      : buildTextStepRequest(input);

  if (provider === "gemini") {
    const geminiRequest = request as unknown as GeminiCompatibleRequest;
    const output = await generateGeminiJson({
      systemPrompt: extractInputText(geminiRequest, 0),
      userPrompt: extractInputText(geminiRequest, 1),
      schema: geminiRequest.text.format.schema,
    });

    if (customUi) {
      return normalizeCustomUiStep(output as CustomUiStepSchemaResult, input.stepType);
    }

    if (input.stepType === "QUIZ") {
      const parsed = output as QuizStepSchemaResult;
      return {
        title: sanitizeText(parsed.title, fallbackStepTitle(input.stepType)),
        content: serializeQuizContent(parsed.questions),
      };
    }

    if (practiceFlow) {
      const parsed = output as PracticeStepSchemaResult;
      return {
        type: "PRACTICE",
        title: sanitizeText(parsed.title, fallbackStepTitle(input.stepType)),
        content: serializePracticeContent(parsed.exercises),
      };
    }

    const parsed = output as TextStepSchemaResult;
    return {
      title: sanitizeText(parsed.title, fallbackStepTitle(input.stepType)),
      content: sanitizeText(parsed.content, "Add the content for this step."),
    };
  }

  const apiKey = process.env.SVINKA_KEY?.trim();
  if (!apiKey) {
    throw new Error("SVINKA_KEY is missing. Add the OpenAI key to the server environment.");
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
    throw new Error(payload.error?.message ?? "OpenAI could not generate step content.");
  }

  const outputText = extractOutputText(payload);
  if (!outputText) {
    throw new Error("OpenAI returned an empty response.");
  }

  try {
    if (customUi) {
      return normalizeCustomUiStep(JSON.parse(outputText) as CustomUiStepSchemaResult, input.stepType);
    }

    if (input.stepType === "QUIZ") {
      const parsed = JSON.parse(outputText) as QuizStepSchemaResult;
      return {
        title: sanitizeText(parsed.title, fallbackStepTitle(input.stepType)),
        content: serializeQuizContent(parsed.questions),
      };
    }

    if (practiceFlow) {
      const parsed = JSON.parse(outputText) as PracticeStepSchemaResult;
      return {
        type: "PRACTICE",
        title: sanitizeText(parsed.title, fallbackStepTitle(input.stepType)),
        content: serializePracticeContent(parsed.exercises),
      };
    }

    const parsed = JSON.parse(outputText) as TextStepSchemaResult;
    return {
      title: sanitizeText(parsed.title, fallbackStepTitle(input.stepType)),
      content: sanitizeText(parsed.content, "Add the content for this step."),
    };
  } catch {
    throw new Error("Could not parse the AI response as JSON.");
  }
}

function normalizeCustomUiStep(parsed: CustomUiStepSchemaResult, fallbackType: CourseStepType) {
  return {
    type: "CUSTOM" as const,
    title: sanitizeText(parsed.title, fallbackStepTitle(fallbackType)),
    content: JSON.stringify(
      {
        customUi: {
          version: 1,
          html: sanitizeGeneratedLessonHtml(parsed.html),
        },
      },
      null,
      2,
    ),
  };
}

function sanitizeGeneratedLessonHtml(value: string | undefined) {
  const source = (value ?? "").slice(0, 60_000);
  const withoutDangerousTags = source
    .replace(/<!doctype[^>]*>/giu, "")
    .replace(/<\/?(?:html|head|body)[^>]*>/giu, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/giu, "")
    .replace(/<(?:iframe|frame|object|embed|link|meta|base|form)\b[^>]*>[\s\S]*?<\/(?:iframe|frame|object|embed|form)\s*>/giu, "")
    .replace(/<(?:iframe|frame|object|embed|link|meta|base|form)\b[^>]*\/?\s*>/giu, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/giu, "")
    .replace(/(?:javascript|data\s*:\s*text\/html)\s*:/giu, "")
    .replace(/@import\s+[^;]+;?/giu, "")
    .replace(/url\s*\((?!\s*['"]?data:image\/)[^)]+\)/giu, "none");

  const trimmed = withoutDangerousTags.trim();
  if (!trimmed) {
    return '<div class="lesson-ai-ui"><p>AI не вернул содержимое интерактивного шага.</p></div>';
  }

  return /class=["'][^"']*lesson-ai-ui/u.test(trimmed)
    ? trimmed
    : `<div class="lesson-ai-ui">${trimmed}</div>`;
}

function shouldGeneratePracticeFlow(input: GenerateCourseStepDraftInput) {
  if (input.stepType === "PRACTICE") return true;
  return /\b(audio|listening|exercise|practice|interactive|task)\b|аудио|аудирование|упражнен|практик|интерактив|задан/iu.test(input.request);
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

function buildCommonSystemPrompt(input: GenerateCourseStepDraftInput) {
  return [
    "You are an expert Korean language course author for a premium online school.",
    "Write only in Russian.",
    "You are generating one lesson step, not a full lesson.",
    "The output should be ready to paste into the admin panel with minimal editing.",
    "For text steps, you may use inline rich-text markers inside content:",
    "**bold**, __underline__, ==highlight==, [color=#2563eb]colored text[/color], [size=lg]large text[/size].",
    "For tables, use markdown tables with the | syntax.",
    "For mini-dialogues, use this exact block format:",
    "[dialogue]",
    "Учитель: короткая реплика",
    "Студент: короткий ответ",
    "[/dialogue]",
    "Put each dialogue message on a new line and do not format dialogue as a bullet list.",
    "Keep the formatting tasteful and helpful, not noisy.",
    `Level: ${input.levelTitle}.`,
    `Unit: ${input.unitTitle}.`,
    `Lesson: ${input.lessonTitle}.`,
    input.lessonSummary ? `Lesson summary: ${input.lessonSummary}.` : "",
    `Step type: ${input.stepType}.`,
    `Current step title: ${input.stepTitle}.`,
    input.currentContent ? `Current step content: ${input.currentContent}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildUserPrompt(input: GenerateCourseStepDraftInput) {
  return ["Admin request:", input.request.trim()].join("\n");
}

function buildCustomUiStepRequest(input: GenerateCourseStepDraftInput) {
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
              buildCommonSystemPrompt(input),
              "Create one polished, app-like interactive lesson screen as self-contained HTML and CSS.",
              "Return a fragment only. Do not include html, head, body, iframe, external links, forms, or scripts.",
              "Wrap the entire result in one <div class=\"lesson-ai-ui\"> and include one scoped <style> block.",
              "Scope every CSS selector under .lesson-ai-ui. Do not use Tailwind because the result runs in an isolated iframe.",
              "The host lesson card is already the page surface. Make .lesson-ai-ui transparent, full-width, max-width:none, margin:0, border:0, box-shadow:none, and padding:0.",
              "Do not create a centered max-width page, another full-screen background, or a large outer card around the whole result. Use the complete available width and reserve cards, borders, backgrounds, and shadows for the actual exercises inside.",
              "Use responsive cards, generous spacing, clear hierarchy, accessible contrast, hover/pressed states, and mobile breakpoints.",
              "You may create audio buttons with data-speak=\"Korean text\". A trusted runtime will pronounce that value with ko-KR speech synthesis.",
              "For answer activities, wrap each activity in data-question and use buttons with data-answer. Put data-correct=\"true\" on the correct button and include an empty element with data-feedback.",
              "For typed answers, use an input with data-answer-input, a button with data-check-input, and put data-correct-answer=\"expected text\" on their data-question container.",
              "For multi-screen flows, use data-screen on each screen and data-next/data-previous buttons. The trusted runtime controls visibility.",
              "Never add JavaScript, onclick attributes, fetch calls, localStorage, cookies, navigation, downloads, or code that accesses the parent page.",
              "Write learner-facing text in Russian and Korean. Make the result feel like a premium language-learning mini app, not a document.",
            ].join("\n"),
          },
        ],
      },
      { role: "user", content: [{ type: "input_text", text: buildUserPrompt(input) }] },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "course_step_custom_ui",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            html: { type: "string" },
          },
          required: ["title", "html"],
        },
      },
    },
  };
}

function buildTextStepRequest(input: GenerateCourseStepDraftInput) {
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
              buildCommonSystemPrompt(input),
              "Return content only for this step.",
              "If the admin asks for a table, comparison, emphasis, color, or larger text, express it directly inside content.",
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
        name: "course_step_draft",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            content: { type: "string" },
          },
          required: ["title", "content"],
        },
      },
    },
  };
}

function buildPracticeStepRequest(input: GenerateCourseStepDraftInput) {
  return {
    model: OPENAI_MODEL,
    reasoning: { effort: "medium" },
    input: [
      {
        role: "system",
        content: [{
          type: "input_text",
          text: [
            buildCommonSystemPrompt(input),
            "For PRACTICE steps, create a JSON exercise flow, not prose.",
            "Use 3 to 6 varied exercises. You may mix DESCRIPTION, BUILD_SENTENCE, FILL_GAP, CHOOSE_PARTICLE, TYPE_ANSWER, MATCH_PAIRS, HANDWRITING_TRACE, LISTEN_CHOOSE, and LISTEN_TYPE.",
            "Keep imageUrl and audioUrl empty unless the admin supplied a usable URL. Never invent remote media URLs.",
            "DESCRIPTION has no answer. Every other exercise needs a correct answer; MATCH_PAIRS needs at least two pairs.",
            "For BUILD_SENTENCE, words must be shuffled tokens that form answer. For FILL_GAP, sentence must contain ___ exactly once.",
          ].join("\n"),
        }],
      },
      { role: "user", content: [{ type: "input_text", text: buildUserPrompt(input) }] },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "course_step_practice_draft",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            exercises: {
              type: "array",
              minItems: 3,
              maxItems: 6,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  kind: {
                    type: "string",
                    enum: ["DESCRIPTION", "BUILD_SENTENCE", "FILL_GAP", "CHOOSE_PARTICLE", "TYPE_ANSWER", "MATCH_PAIRS", "HANDWRITING_TRACE", "LISTEN_CHOOSE", "LISTEN_TYPE"],
                  },
                  prompt: { type: "string" },
                  description: { type: "string" },
                  sentence: { type: "string" },
                  answer: { type: "string" },
                  words: { type: "array", items: { type: "string" } },
                  options: { type: "array", items: { type: "string" } },
                  pairs: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: { left: { type: "string" }, right: { type: "string" } },
                      required: ["left", "right"],
                    },
                  },
                  imageUrl: { type: "string" },
                  audioUrl: { type: "string" },
                  minStrokeLength: { type: "number" },
                  explanation: { type: "string" },
                },
                required: ["kind", "prompt", "description", "sentence", "answer", "words", "options", "pairs", "imageUrl", "audioUrl", "minStrokeLength", "explanation"],
              },
            },
          },
          required: ["title", "exercises"],
        },
      },
    },
  };
}

function buildQuizStepRequest(input: GenerateCourseStepDraftInput) {
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
              buildCommonSystemPrompt(input),
              "For QUIZ steps, return structured questions instead of rich-text content.",
              "Generate 3 to 5 questions with a pleasant learning flow.",
              "You may mix kinds: CHOICE, FILL_IN_BLANK, TRUE_FALSE.",
              "For FILL_IN_BLANK, the sentence must contain ___ exactly where the missing word or phrase should appear.",
              "Each question must include a short explanation shown after the learner answers.",
              "TRUE_FALSE should still include two answer options.",
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
        name: "course_step_quiz_draft",
        strict: true,
        schema: {
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
                  kind: {
                    type: "string",
                    enum: ["CHOICE", "FILL_IN_BLANK", "TRUE_FALSE"],
                  },
                  prompt: { type: "string" },
                  sentence: { type: "string" },
                  options: {
                    type: "array",
                    minItems: 2,
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
                required: ["kind", "prompt", "sentence", "options", "explanation"],
              },
            },
          },
          required: ["title", "questions"],
        },
      },
    },
  };
}

function serializeQuizContent(questions: QuizQuestionDraft[]) {
  return JSON.stringify(
    {
      questions: questions.map((question) => ({
        kind: normalizeQuizQuestionKind(question.kind),
        prompt: sanitizeText(question.prompt, "Вопрос"),
        sentence:
          normalizeQuizQuestionKind(question.kind) === "FILL_IN_BLANK"
            ? sanitizeText(question.sentence, "저는 ___ 입니다.")
            : "",
        options: normalizeQuizOptions(question.options, normalizeQuizQuestionKind(question.kind)),
        explanation: sanitizeText(
          question.explanation,
          "Проверьте правило и попробуйте еще раз.",
        ),
      })),
    },
    null,
    2,
  );
}

function serializePracticeContent(exercises: PracticeExerciseDraft[] | undefined) {
  const normalized = Array.isArray(exercises) ? exercises.slice(0, 6) : [];
  return JSON.stringify({
    exercises: normalized.map((exercise) => ({
      kind: exercise.kind,
      prompt: sanitizeText(exercise.prompt, "Выполните задание."),
      description: sanitizeText(exercise.description, ""),
      sentence: sanitizeText(exercise.sentence, ""),
      answer: sanitizeText(exercise.answer, ""),
      words: Array.isArray(exercise.words) ? exercise.words.map((word) => word.trim()).filter(Boolean) : [],
      options: Array.isArray(exercise.options) ? exercise.options.map((option) => option.trim()).filter(Boolean) : [],
      pairs: Array.isArray(exercise.pairs)
        ? exercise.pairs.map((pair) => ({ left: pair.left?.trim() ?? "", right: pair.right?.trim() ?? "" })).filter((pair) => pair.left && pair.right)
        : [],
      imageUrl: sanitizeText(exercise.imageUrl, ""),
      audioUrl: sanitizeText(exercise.audioUrl, ""),
      minStrokeLength: Number.isFinite(exercise.minStrokeLength) ? exercise.minStrokeLength : 420,
      explanation: sanitizeText(exercise.explanation, "Проверьте ответ и попробуйте ещё раз."),
    })),
  }, null, 2);
}

function normalizeQuizQuestionKind(kind: string | undefined): QuizQuestionKind {
  return kind === "FILL_IN_BLANK" || kind === "TRUE_FALSE" ? kind : "CHOICE";
}

function normalizeQuizOptions(
  options: QuizQuestionDraft["options"],
  kind: QuizQuestionKind,
) {
  const sanitized = options
    .slice(0, 4)
    .map((option) => ({
      text: sanitizeText(option.text, "Вариант"),
      isCorrect: Boolean(option.isCorrect),
    }));

  if (kind === "TRUE_FALSE") {
    const hasCorrect = sanitized.some((option) => option.isCorrect);
    return [
      {
        text: sanitized[0]?.text || "Верно",
        isCorrect: hasCorrect ? Boolean(sanitized[0]?.isCorrect) : true,
      },
      {
        text: sanitized[1]?.text || "Неверно",
        isCorrect: hasCorrect ? Boolean(sanitized[1]?.isCorrect) : false,
      },
    ];
  }

  const next = sanitized.length >= 2
    ? sanitized
    : [
        { text: "Вариант 1", isCorrect: true },
        { text: "Вариант 2", isCorrect: false },
      ];

  if (next.some((option) => option.isCorrect)) {
    return next;
  }

  return next.map((option, index) => ({
    ...option,
    isCorrect: index === 0,
  }));
}

function sanitizeText(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 8000) : fallback;
}

function fallbackStepTitle(type: CourseStepType) {
  const labels: Record<CourseStepType, string> = {
    GRAMMAR: "Разбор грамматики",
    EXAMPLES: "Примеры",
    VOCABULARY: "Словарь",
    PRACTICE: "Практика",
    QUIZ: "Мини-тест",
    CUSTOM: "Шаг урока",
  };

  return labels[type];
}
