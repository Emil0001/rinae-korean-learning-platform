import type { AIProvider } from "@/lib/ai/provider";
import { generateGeminiJson } from "@/lib/gemini/client";
import type { VocabularyLevel } from "@/lib/vocabulary";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = "gpt-5-mini";

export type GeneratedVocabularyWord = {
  korean: string;
  transcription: string;
  translation: string;
  exampleKorean: string;
  exampleRussian: string;
  category: string;
  level: VocabularyLevel;
};

const vocabularySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    words: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          korean: { type: "string" }, transcription: { type: "string" }, translation: { type: "string" },
          exampleKorean: { type: "string" }, exampleRussian: { type: "string" }, category: { type: "string" },
          level: { type: "string", enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED"] },
        },
        required: ["korean", "transcription", "translation", "exampleKorean", "exampleRussian", "category", "level"],
      },
    },
  },
  required: ["words"],
} as const;

function normalizeCategory(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU").replace(/\s+/g, " ");
}

function isRussianCategory(value: string) {
  return /[\u0400-\u04ff]/u.test(value) && !/[a-z]/iu.test(value);
}

function russianCategoryKey(value: string) {
  return normalizeCategory(value)
    .split(/\s+/)
    .map((part) =>
      part.replace(
        /(иями|ями|ами|ией|иям|иях|ого|ему|ому|ов|ев|ей|ия|ии|ая|яя|ое|ее|ые|ие|а|я|ы|и)$/u,
        "",
      ),
    )
    .join(" ");
}

function canonicalizeCategory(
  proposedCategory: string,
  existingCategories: string[],
  topic: string,
) {
  const russianCategories = existingCategories.filter(isRussianCategory);
  const normalizedProposed = normalizeCategory(proposedCategory);
  const exactMatch = russianCategories.find(
    (category) => normalizeCategory(category) === normalizedProposed,
  );
  if (exactMatch) return exactMatch;

  const proposedKey = russianCategoryKey(proposedCategory);
  const grammaticalMatch = proposedKey.length >= 4
    ? russianCategories.find((category) => russianCategoryKey(category) === proposedKey)
    : undefined;
  if (grammaticalMatch) return grammaticalMatch;

  if (isRussianCategory(proposedCategory)) return proposedCategory.trim();
  if (isRussianCategory(topic)) return topic.trim();
  return "Другое";
}

export async function generateVocabularyWordsWithAI(input: {
  provider: AIProvider; topic: string; level: VocabularyLevel; count: number; instructions?: string;
  excludeWords?: Array<{ korean: string; translation: string }>;
  existingCategories?: string[];
}): Promise<GeneratedVocabularyWord[]> {
  const existingCategories = [
    ...new Set(
      (input.existingCategories ?? [])
        .map((category) => category.trim())
        .filter((category) => category && isRussianCategory(category)),
    ),
  ];
  const systemPrompt = [
    "Поле category всегда заполняй только на русском языке.",
    "Если подходящая категория уже есть в переданном списке, используй её точное написание. Не создавай синоним, вариант в единственном числе или новую формулировку.",
    "Создавай новую короткую категорию на русском языке только тогда, когда ни одна существующая категория не подходит.",
    "Ты методист корейского языка для русскоязычных учеников.",
    "Создавай только естественные, современные и частотные корейские слова.",
    "Перевод и транскрипция должны быть на русском языке. Транскрипцию пиши без квадратных скобок.",
    "Для каждого слова создавай короткий естественный пример на корейском и точный русский перевод примера.",
    "Не повторяй слова внутри набора и не добавляй пояснений вне JSON.",
  ].join("\n");
  const exclusions = (input.excludeWords ?? []).slice(0, 500);
  const userPrompt = [
    `Тема: ${input.topic.trim() || "повседневная лексика"}.`, `Уровень: ${input.level}.`,
    `Количество: ровно ${input.count}.`,
    input.instructions?.trim() ? `Дополнительные пожелания: ${input.instructions.trim()}` : "",
    existingCategories.length
      ? `Существующие категории (при совпадении используй значение дословно):\n${existingCategories.map((category) => `- ${category}`).join("\n")}`
      : "",
    exclusions.length ? `Не создавай следующие уже существующие сочетания корейского слова и значения:\n${exclusions.map((word) => `- ${word.korean} — ${word.translation}`).join("\n")}` : "",
  ].filter(Boolean).join("\n");

  let parsed: { words?: GeneratedVocabularyWord[] };
  if (input.provider === "gemini") {
    parsed = await generateGeminiJson({ systemPrompt, userPrompt, schema: vocabularySchema }) as { words?: GeneratedVocabularyWord[] };
  } else {
    const apiKey = process.env.SVINKA_KEY?.trim();
    if (!apiKey) throw new Error("Ключ OpenAI не найден. Добавьте SVINKA_KEY в окружение сервера.");
    const response = await fetch(OPENAI_URL, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: OPENAI_MODEL, reasoning: { effort: "medium" },
        input: [
          { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
          { role: "user", content: [{ type: "input_text", text: userPrompt }] },
        ],
        text: { format: { type: "json_schema", name: "vocabulary_words", strict: true, schema: vocabularySchema } },
      }),
    });
    const payload = await response.json() as { error?: { message?: string }; output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
    if (!response.ok) throw new Error(payload.error?.message ?? "OpenAI не смог создать слова.");
    const outputText = payload.output_text?.trim() || payload.output?.flatMap((item) => item.content ?? []).map((part) => part.text ?? "").join("").trim();
    if (!outputText) throw new Error("OpenAI вернул пустой ответ.");
    parsed = JSON.parse(outputText) as { words?: GeneratedVocabularyWord[] };
  }

  const words = parsed.words ?? [];
  if (!words.length) throw new Error("AI не создал ни одного слова.");
  return words.slice(0, input.count).map((word) => ({
    korean: word.korean.trim(), transcription: word.transcription.trim().replace(/^\[|\]$/g, ""),
    translation: word.translation.trim(), exampleKorean: word.exampleKorean.trim(),
    exampleRussian: word.exampleRussian.trim(),
    category: canonicalizeCategory(
      word.category.trim() || input.topic.trim(),
      existingCategories,
      input.topic,
    ),
    level: input.level,
  }));
}

export async function generateVocabularyExampleWithAI(input: {
  provider: AIProvider; korean: string; translation: string; transcription?: string; category?: string; level: VocabularyLevel;
}) {
  const [word] = await generateVocabularyWordsWithAI({
    provider: input.provider, topic: input.category || "повседневная лексика", level: input.level, count: 1,
    instructions: [
      `Создай карточку строго для слова «${input.korean}» со значением «${input.translation}».`,
      input.transcription ? `Используй транскрипцию «${input.transcription}».` : "",
      "Не заменяй слово и его значение. Нужны прежде всего естественный пример и его перевод.",
    ].filter(Boolean).join(" "),
  });
  return { exampleKorean: word.exampleKorean, exampleRussian: word.exampleRussian };
}

export async function generateVocabularyExamplesWithAI(input: {
  provider: AIProvider;
  words: Array<{
    id: string;
    korean: string;
    translation: string;
    transcription?: string | null;
    category?: string | null;
    level: VocabularyLevel;
  }>;
}) {
  if (!input.words.length) return [];
  const systemPrompt = [
    "Ты методист корейского языка для русскоязычных учеников.",
    "Для каждого переданного слова создай один короткий естественный пример на корейском и точный русский перевод.",
    "Сохрани переданный id без изменений. Не заменяй слова и их значения.",
    "Не добавляй пояснений вне JSON.",
  ].join("\n");
  const schema = {
    type: "object", additionalProperties: false,
    properties: {
      examples: {
        type: "array",
        items: {
          type: "object", additionalProperties: false,
          properties: { id: { type: "string" }, exampleKorean: { type: "string" }, exampleRussian: { type: "string" } },
          required: ["id", "exampleKorean", "exampleRussian"],
        },
      },
    },
    required: ["examples"],
  } as const;
  const userPrompt = input.words.map((word) => [
    `id=${word.id}`, `слово=${word.korean}`, `значение=${word.translation}`,
    word.transcription ? `транскрипция=${word.transcription}` : "",
    word.category ? `категория=${word.category}` : "", `уровень=${word.level}`,
  ].filter(Boolean).join("; ")).join("\n");

  let parsed: { examples?: Array<{ id: string; exampleKorean: string; exampleRussian: string }> };
  if (input.provider === "gemini") {
    parsed = await generateGeminiJson({ systemPrompt, userPrompt, schema }) as typeof parsed;
  } else {
    const apiKey = process.env.SVINKA_KEY?.trim();
    if (!apiKey) throw new Error("Ключ OpenAI не найден. Добавьте SVINKA_KEY в окружение сервера.");
    const response = await fetch(OPENAI_URL, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: OPENAI_MODEL, reasoning: { effort: "medium" },
        input: [
          { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
          { role: "user", content: [{ type: "input_text", text: userPrompt }] },
        ],
        text: { format: { type: "json_schema", name: "vocabulary_examples", strict: true, schema } },
      }),
    });
    const payload = await response.json() as { error?: { message?: string }; output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
    if (!response.ok) throw new Error(payload.error?.message ?? "OpenAI не смог создать примеры.");
    const outputText = payload.output_text?.trim() || payload.output?.flatMap((item) => item.content ?? []).map((part) => part.text ?? "").join("").trim();
    if (!outputText) throw new Error("OpenAI вернул пустой ответ.");
    parsed = JSON.parse(outputText) as typeof parsed;
  }

  const allowedIds = new Set(input.words.map((word) => word.id));
  return (parsed.examples ?? []).filter((example) => allowedIds.has(example.id)).map((example) => ({
    id: example.id, exampleKorean: example.exampleKorean.trim(), exampleRussian: example.exampleRussian.trim(),
  })).filter((example) => example.exampleKorean && example.exampleRussian);
}
