export type ImportedChoice = {
  mode: "TEXT" | "IMAGE";
  text: string;
  imageUrl: string | null;
};

export type ImportedQuestion = {
  contentMode: "TEXT" | "IMAGE";
  prompt: string;
  content: string;
  contentImageUrl: string | null;
  points: number;
  correctChoiceIndex: number;
  choices: ImportedChoice[];
};

export type ImportedBlock = {
  variant: "EXAMPLE" | "PASSAGE" | "NOTICE";
  title: string;
  content: string;
  displayBeforeQuestionOrder: number;
};

export type ImportedSection = {
  type: "READING" | "LISTENING";
  title: string;
  durationMinutes: number;
  blocks: ImportedBlock[];
  questions: ImportedQuestion[];
};

export type BulkImportResult = {
  section: ImportedSection;
  warnings: string[];
};

const SECTION_HEADING_RE = /^※\s*\[(\d+)\s*~\s*(\d+)\]\s*(.+)$/;
const QUESTION_RE = /^(\d{1,2})\s+(.+)$/;
const POINTS_RE = /^(\d+)\s*점$/;
const POINTS_ONLY_PROMPT_RE = /^\(?(?:각\s*)?\d+\s*점\)?$/;
const CIRCLED_OPTION_RE = /^[①-④]\s*(.+)$/;
const INLINE_OPTION_RE = /^([1-4])[.)]?\s+(.+)$/;
const SPLIT_OPTION_NUMBER_RE = /^[1-4]$/;
const CORRECT_RE = /^(?:correct|answer)\s*:\s*([1-4])$/i;
const IMAGE_PLACEHOLDER_RE = /^question\s+\d+\s+image$/i;

function normalizeLines(source: string) {
  return source
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function isQuestionStart(line: string) {
  return QUESTION_RE.test(line);
}

function isSectionHeading(line: string) {
  return SECTION_HEADING_RE.test(line);
}

function isChoiceStart(line: string) {
  return CIRCLED_OPTION_RE.test(line) || INLINE_OPTION_RE.test(line) || SPLIT_OPTION_NUMBER_RE.test(line);
}

function stripPromptPoints(text: string) {
  return text.replace(/\(\s*(?:각\s*)?\d+\s*점\s*\)/g, "").trim();
}

function fallbackSectionTitle(type: "READING" | "LISTENING") {
  return type === "READING" ? "Импортированное чтение" : "Импортированное аудирование";
}

export function parseTopikBulkText(
  source: string,
  type: "READING" | "LISTENING",
): BulkImportResult {
  const lines = normalizeLines(source);

  if (lines.length === 0) {
    throw new Error("Вставьте текст секции перед импортом.");
  }

  const warnings: string[] = [];
  const section: ImportedSection = {
    type,
    title: fallbackSectionTitle(type),
    durationMinutes: type === "READING" ? 60 : 40,
    blocks: [],
    questions: [],
  };

  let index = 0;
  let currentGroupTitle = "";

  while (index < lines.length) {
    const headingMatch = lines[index].match(SECTION_HEADING_RE);

    if (headingMatch) {
      const rangeStart = Number(headingMatch[1]);
      currentGroupTitle = headingMatch[3].trim();
      index += 1;

      const introLines: string[] = [];
      while (
        index < lines.length &&
        !isSectionHeading(lines[index]) &&
        !isQuestionStart(lines[index])
      ) {
        introLines.push(lines[index]);
        index += 1;
      }

      if (introLines.length > 0) {
        const markerIndex = introLines.findIndex((line) => line.includes("<보기>"));
        if (markerIndex >= 0) {
          const exampleContent = introLines
            .filter((line, introIndex) => introIndex !== markerIndex)
            .join("\n")
            .trim();

          if (exampleContent) {
            section.blocks.push({
              variant: "EXAMPLE",
              title: "보기",
              content: exampleContent,
              displayBeforeQuestionOrder: rangeStart,
            });
          }
        } else {
          const sharedContent = introLines.join("\n").trim();
          if (sharedContent) {
            section.blocks.push({
              variant: "PASSAGE",
              title: "",
              content: sharedContent,
              displayBeforeQuestionOrder: rangeStart,
            });
          }
        }
      }

      continue;
    }

    const questionMatch = lines[index].match(QUESTION_RE);
    if (!questionMatch) {
      index += 1;
      continue;
    }

    const questionNumber = Number(questionMatch[1]);
    let prompt = stripPromptPoints(questionMatch[2]);
    if (!prompt || POINTS_ONLY_PROMPT_RE.test(prompt)) {
      prompt = currentGroupTitle || `Вопрос ${questionNumber}`;
    }

    index += 1;

    let points = 2;
    const pointsMatch = lines[index]?.match(POINTS_RE);
    if (pointsMatch) {
      points = Number(pointsMatch[1]);
      index += 1;
    }

    const contentLines: string[] = [];
    while (
      index < lines.length &&
      !isSectionHeading(lines[index]) &&
      !isQuestionStart(lines[index]) &&
      !isChoiceStart(lines[index])
    ) {
      if (CORRECT_RE.test(lines[index])) {
        break;
      }

      contentLines.push(lines[index]);
      index += 1;
    }

    const choices: ImportedChoice[] = [];
    while (index < lines.length && choices.length < 4) {
      const line = lines[index];

      if (CIRCLED_OPTION_RE.test(line)) {
        choices.push({
          mode: "TEXT",
          text: line.replace(CIRCLED_OPTION_RE, "$1").trim(),
          imageUrl: null,
        });
        index += 1;
        continue;
      }

      const inlineOptionMatch = line.match(INLINE_OPTION_RE);
      if (inlineOptionMatch) {
        choices.push({
          mode: "TEXT",
          text: inlineOptionMatch[2].trim(),
          imageUrl: null,
        });
        index += 1;
        continue;
      }

      if (SPLIT_OPTION_NUMBER_RE.test(line)) {
        const optionText = lines[index + 1];
        if (!optionText) {
          break;
        }

        choices.push({
          mode: "TEXT",
          text: optionText,
          imageUrl: null,
        });
        index += 2;
        continue;
      }

      break;
    }

    let correctChoiceIndex = 0;
    const correctMatch = lines[index]?.match(CORRECT_RE);
    if (correctMatch) {
      correctChoiceIndex = Number(correctMatch[1]) - 1;
      index += 1;
    } else {
      warnings.push(`Вопрос ${questionNumber}: правильный ответ не указан, проверьте вручную.`);
    }

    while (choices.length < 4) {
      choices.push({ mode: "TEXT", text: "", imageUrl: null });
      warnings.push(`Вопрос ${questionNumber}: не удалось распознать все 4 варианта ответа.`);
    }

    const normalizedContent = contentLines.join("\n").trim();
    const isImagePlaceholder = IMAGE_PLACEHOLDER_RE.test(normalizedContent);

    section.questions.push({
      contentMode: isImagePlaceholder ? "IMAGE" : "TEXT",
      prompt,
      content: isImagePlaceholder ? "" : normalizedContent,
      contentImageUrl: null,
      points,
      correctChoiceIndex,
      choices,
    });
  }

  if (section.questions.length === 0) {
    throw new Error("Не удалось распознать вопросы. Проверьте формат текста.");
  }

  return { section, warnings };
}
