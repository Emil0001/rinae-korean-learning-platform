export type ParsedPracticeExerciseKind =
  | "DESCRIPTION"
  | "BUILD_SENTENCE"
  | "FILL_GAP"
  | "CHOOSE_PARTICLE"
  | "INLINE_CHOICE"
  | "CONJUGATION_CHOICE"
  | "TYPE_ANSWER"
  | "DIALOGUE_FILL"
  | "MATCH_PAIRS"
  | "HANDWRITING_TRACE"
  | "LISTEN_CHOOSE"
  | "LISTEN_TYPE";

export type ParsedInlineChoiceItem = {
  sentence: string;
  answer: string;
  options: string[];
  explanation: string;
};

export type ParsedTypeAnswerItem = {
  question: string;
  sentence: string;
  answer: string;
  explanation: string;
  imageUrl: string;
};

export type ParsedDialogueFillItem = {
  question: string;
  sentence: string;
  answer: string;
  explanation: string;
  imageUrl: string;
  isExample: boolean;
};

export type ParsedPracticeExercise = {
  kind: ParsedPracticeExerciseKind;
  prompt: string;
  description: string;
  sentence: string;
  answer: string;
  words: string[];
  options: string[];
  inlineChoices: ParsedInlineChoiceItem[];
  typeAnswers: ParsedTypeAnswerItem[];
  dialogueItems: ParsedDialogueFillItem[];
  pairs: Array<{ left: string; right: string }>;
  imageUrl: string;
  mobileImageUrls: string[];
  audioUrl: string;
  baseWord: string;
  grammarForm: string;
  category: string;
  minStrokeLength: number;
  explanation: string;
};

export type ParsedPractice = {
  exercises: ParsedPracticeExercise[];
  tasksPerPage: number;
};

export function practiceKindLabel(kind: ParsedPracticeExerciseKind) {
  if (kind === "DESCRIPTION") {
    return "Инструкция";
  }

  if (kind === "BUILD_SENTENCE") {
    return "Соберите предложение";
  }

  if (kind === "FILL_GAP") {
    return "Заполните пропуск";
  }

  if (kind === "CHOOSE_PARTICLE") {
    return "Выберите частицу";
  }

  if (kind === "INLINE_CHOICE") {
    return "Выберите в предложении";
  }

  if (kind === "CONJUGATION_CHOICE") {
    return "Соберите форму";
  }

  if (kind === "TYPE_ANSWER") {
    return "Введите ответ";
  }

  if (kind === "DIALOGUE_FILL") {
    return "Дополните диалог";
  }

  if (kind === "HANDWRITING_TRACE") {
    return "Письмо по шаблону";
  }

  if (kind === "LISTEN_CHOOSE") {
    return "Слушайте и выберите";
  }

  if (kind === "LISTEN_TYPE") {
    return "Слушайте и напишите";
  }

  return "Соедините пары";
}

function normalizePracticeKind(value: string | undefined): ParsedPracticeExerciseKind {
  return value === "DESCRIPTION" ||
    value === "FILL_GAP" ||
    value === "CHOOSE_PARTICLE" ||
    value === "INLINE_CHOICE" ||
    value === "CONJUGATION_CHOICE" ||
    value === "TYPE_ANSWER" ||
    value === "DIALOGUE_FILL" ||
    value === "MATCH_PAIRS" ||
    value === "HANDWRITING_TRACE" ||
    value === "LISTEN_CHOOSE" ||
    value === "LISTEN_TYPE"
    ? value
    : "BUILD_SENTENCE";
}

export function normalizePracticeAnswer(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.,!?！？。]/g, "")
    .replace(/\s+/g, "");
}

function splitPracticeTokens(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }

  return (value ?? "")
    .split(/[\n,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function shuffleStable<T>(items: T[]) {
  return [...items].sort((left, right) => String(left).localeCompare(String(right)));
}

export function parsePracticeContent(content: string): ParsedPractice | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      tasksPerPage?: number;
      exercises?: Array<{
        kind?: string;
        prompt?: string;
        description?: string;
        sentence?: string;
        answer?: string;
        words?: string[] | string;
        options?: string[] | string;
        inlineChoices?: Array<{
          sentence?: string;
          answer?: string;
          options?: string[] | string;
          explanation?: string;
        }>;
        typeAnswers?: Array<{
          question?: string;
          sentence?: string;
          answer?: string;
          explanation?: string;
          imageUrl?: string;
        }>;
        dialogueItems?: Array<{
          question?: string;
          sentence?: string;
          answer?: string;
          explanation?: string;
          imageUrl?: string;
          isExample?: boolean;
        }>;
        pairs?: Array<{ left?: string; right?: string }>;
        imageUrl?: string;
        mobileImageUrls?: string[];
        mobileImageUrl?: string;
        audioUrl?: string;
        baseWord?: string;
        grammarForm?: string;
        category?: string;
        minStrokeLength?: number;
        explanation?: string;
      }>;
    };

    if (!Array.isArray(parsed.exercises) || parsed.exercises.length === 0) {
      return null;
    }

    const exercises = parsed.exercises.reduce<ParsedPracticeExercise[]>((accumulator, exercise) => {
      const kind = normalizePracticeKind(exercise.kind);
      const prompt = exercise.prompt?.trim() || defaultPracticePrompt(kind);
      const answer = exercise.answer?.trim() ?? "";
      const words = splitPracticeTokens(exercise.words);
      const options = splitPracticeTokens(exercise.options);
      const normalizedOptions =
        (kind === "LISTEN_CHOOSE" || kind === "INLINE_CHOICE" || kind === "CONJUGATION_CHOICE") &&
        answer &&
        !options.some((option) => normalizePracticeAnswer(option) === normalizePracticeAnswer(answer))
          ? [answer, ...options]
          : options;
      const inlineChoices: ParsedInlineChoiceItem[] =
        kind === "INLINE_CHOICE"
          ? (Array.isArray(exercise.inlineChoices) && exercise.inlineChoices.length > 0
              ? exercise.inlineChoices
              : [{
                  sentence: exercise.sentence,
                  answer: exercise.answer,
                  options: exercise.options,
                  explanation: exercise.explanation,
                }]
            )
              .map((item) => {
                const itemAnswer = item.answer?.trim() ?? "";
                const itemOptions = splitPracticeTokens(item.options);
                return {
                  sentence: item.sentence?.trim() ?? "",
                  answer: itemAnswer,
                  options:
                    itemAnswer && !itemOptions.some((option) => normalizePracticeAnswer(option) === normalizePracticeAnswer(itemAnswer))
                      ? [itemAnswer, ...itemOptions]
                      : itemOptions,
                  explanation: item.explanation?.trim() ?? "",
                };
              })
              .filter((item) => item.sentence && item.answer && item.options.length > 0)
          : [];
      const typeAnswers: ParsedTypeAnswerItem[] =
        kind === "TYPE_ANSWER"
          ? (Array.isArray(exercise.typeAnswers) && exercise.typeAnswers.length > 0
              ? exercise.typeAnswers
              : [{
                question: "",
                sentence: exercise.sentence,
                answer: exercise.answer,
                explanation: exercise.explanation,
                imageUrl: exercise.imageUrl,
              }]
            )
              .map((item, itemIndex) => ({
                question: item.question?.trim() ?? "",
                sentence: item.sentence?.trim() ?? "",
                answer: item.answer?.trim() ?? "",
                explanation: item.explanation?.trim() ?? "",
                imageUrl: item.imageUrl?.trim() ?? (itemIndex === 0 ? exercise.imageUrl?.trim() ?? "" : ""),
              }))
              .filter((item) => item.answer)
          : [];
      const dialogueItems: ParsedDialogueFillItem[] =
        kind === "DIALOGUE_FILL" && Array.isArray(exercise.dialogueItems)
          ? exercise.dialogueItems
              .map((item) => ({
                question: item.question?.trim() ?? "",
                sentence: item.sentence?.trim() ?? "",
                answer: item.answer?.trim() ?? "",
                explanation: item.explanation?.trim() ?? "",
                imageUrl: item.imageUrl?.trim() ?? "",
                isExample: Boolean(item.isExample),
              }))
              .filter((item) => item.sentence && item.answer)
          : [];
      const pairs = Array.isArray(exercise.pairs)
        ? exercise.pairs
            .map((pair) => ({
              left: pair.left?.trim() ?? "",
              right: pair.right?.trim() ?? "",
            }))
            .filter((pair) => pair.left && pair.right)
        : [];

      if (kind === "MATCH_PAIRS" && pairs.length < 2) {
        return accumulator;
      }

      if (
        kind !== "MATCH_PAIRS" &&
        kind !== "DESCRIPTION" &&
        kind !== "HANDWRITING_TRACE" &&
        !(kind === "INLINE_CHOICE" && inlineChoices.length > 0) &&
        !(kind === "TYPE_ANSWER" && typeAnswers.length > 0) &&
        !(kind === "DIALOGUE_FILL" && dialogueItems.length > 0) &&
        !answer
      ) {
        return accumulator;
      }

      accumulator.push({
        kind,
        prompt,
        description: exercise.description?.trim() ?? "",
        sentence: exercise.sentence?.trim() ?? "",
        answer,
        words: kind === "BUILD_SENTENCE" ? (words.length > 0 ? words : splitPracticeTokens(answer.replace(/\s+/g, "|"))) : words,
        options: normalizedOptions,
        inlineChoices,
        typeAnswers,
        dialogueItems,
        pairs,
        imageUrl: exercise.imageUrl?.trim() ?? "",
        mobileImageUrls: Array.isArray(exercise.mobileImageUrls)
          ? exercise.mobileImageUrls.map((url) => url.trim()).filter(Boolean)
          : exercise.mobileImageUrl?.trim()
            ? [exercise.mobileImageUrl.trim()]
            : [],
        audioUrl: exercise.audioUrl?.trim() ?? "",
        baseWord: exercise.baseWord?.trim() ?? "",
        grammarForm: exercise.grammarForm?.trim() ?? "",
        category: exercise.category?.trim() ?? "",
        minStrokeLength:
          typeof exercise.minStrokeLength === "number" && Number.isFinite(exercise.minStrokeLength)
            ? exercise.minStrokeLength <= 100
              ? Math.max(20, Math.min(95, exercise.minStrokeLength))
              : Math.max(80, exercise.minStrokeLength)
            : 420,
        explanation: exercise.explanation?.trim() ?? "",
      });

      return accumulator;
    }, []);

    const tasksPerPage =
      typeof parsed.tasksPerPage === "number" && Number.isFinite(parsed.tasksPerPage)
        ? Math.max(1, Math.min(20, Math.round(parsed.tasksPerPage)))
        : 5;

    return exercises.length > 0 ? { exercises, tasksPerPage } : null;
  } catch {
    return null;
  }
}

function defaultPracticePrompt(kind: ParsedPracticeExerciseKind) {
  if (kind === "DESCRIPTION") {
    return "Перед началом";
  }

  if (kind === "BUILD_SENTENCE") {
    return "Соберите правильное предложение.";
  }

  if (kind === "FILL_GAP") {
    return "Выберите слово для пропуска.";
  }

  if (kind === "CHOOSE_PARTICLE") {
    return "Выберите правильную частицу.";
  }

  if (kind === "INLINE_CHOICE") {
    return "Выберите правильный вариант прямо в предложении.";
  }

  if (kind === "CONJUGATION_CHOICE") {
    return "Выберите правильную форму слова.";
  }

  if (kind === "TYPE_ANSWER") {
    return "Введите правильный ответ.";
  }

  if (kind === "DIALOGUE_FILL") {
    return "Введите недостающую часть ответа прямо в диалоге.";
  }

  if (kind === "HANDWRITING_TRACE") {
    return "Обведите буквы по шаблону.";
  }

  if (kind === "LISTEN_CHOOSE") {
    return "Прослушайте аудио и выберите правильный ответ.";
  }

  if (kind === "LISTEN_TYPE") {
    return "Прослушайте аудио и напишите услышанное.";
  }

  return "Соедините пары.";
}

