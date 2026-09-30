export type ParsedQuizQuestionKind = "CHOICE" | "FILL_IN_BLANK" | "TRUE_FALSE";

export type ParsedQuizQuestion = {
  kind: ParsedQuizQuestionKind;
  prompt: string;
  sentence: string;
  audioUrl: string;
  options: Array<{
    text: string;
    isCorrect: boolean;
  }>;
  explanation?: string;
};

export type ParsedQuiz = {
  questions: ParsedQuizQuestion[];
};

export function quizKindLabel(kind: ParsedQuizQuestionKind) {
  if (kind === "FILL_IN_BLANK") {
    return "Пропуск";
  }

  if (kind === "TRUE_FALSE") {
    return "Верно / неверно";
  }

  return "Выбор";
}

function normalizeQuizKind(value: string | undefined): ParsedQuizQuestionKind {
  return value === "FILL_IN_BLANK" || value === "TRUE_FALSE" ? value : "CHOICE";
}

function normalizeQuizOptions(
  options: Array<{ text?: string; isCorrect?: boolean }> | undefined,
  kind: ParsedQuizQuestionKind,
) {
  const sanitized = Array.isArray(options)
    ? options
        .map((option) => ({
          text: option.text?.trim() ?? "",
          isCorrect: Boolean(option.isCorrect),
        }))
        .filter((option) => option.text.length > 0)
    : [];

  if (kind === "TRUE_FALSE") {
    const hasCorrect = sanitized.some((option) => option.isCorrect);
    return [
      {
        text: sanitized[0]?.text || "True",
        isCorrect: hasCorrect ? Boolean(sanitized[0]?.isCorrect) : true,
      },
      {
        text: sanitized[1]?.text || "False",
        isCorrect: hasCorrect ? Boolean(sanitized[1]?.isCorrect) : false,
      },
    ];
  }

  const next =
    sanitized.length >= 2
      ? sanitized
      : [
          { text: "Option 1", isCorrect: true },
          { text: "Option 2", isCorrect: false },
        ];

  if (next.some((option) => option.isCorrect)) {
    return next;
  }

  return next.map((option, index) => ({
    ...option,
    isCorrect: index === 0,
  }));
}

export function parseQuizContent(content: string): ParsedQuiz | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      questions?: Array<{
        kind?: string;
        prompt?: string;
        question?: string;
        sentence?: string;
        audioUrl?: string;
        options?: Array<{ text?: string; isCorrect?: boolean }>;
        explanation?: string;
      }>;
    };

    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return null;
    }

    const questions = parsed.questions.reduce<ParsedQuiz["questions"]>((accumulator, question) => {
        const kind = normalizeQuizKind(question.kind);
        const options = normalizeQuizOptions(question.options, kind);
        const prompt = (question.prompt ?? question.question ?? "").trim();

        if (!prompt || options.length < 2) {
          return accumulator;
        }

        accumulator.push({
          kind,
          prompt,
          sentence:
            kind === "FILL_IN_BLANK" ? (question.sentence?.trim() || "___") : "",
          audioUrl: question.audioUrl?.trim() ?? "",
          options,
          explanation: question.explanation?.trim() ?? "",
        });

        return accumulator;
      }, []);

    return questions.length > 0 ? { questions } : null;
  } catch {
    return null;
  }
}

