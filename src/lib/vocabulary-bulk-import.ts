import type { VocabularyLevel } from "@/lib/vocabulary";

export type ImportedVocabularyWord = {
  korean: string;
  transcription: string | null;
  translation: string;
  category: string | null;
  level: VocabularyLevel;
  isActive: boolean;
};

const DASH_SPLIT_RE = /\s+[—-]\s+/;

function cleanPart(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function parseVocabularyBulkText(
  source: string,
  level: VocabularyLevel,
  category?: string,
): ImportedVocabularyWord[] {
  const lines = source
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("Вставьте список слов перед импортом.");
  }

  const words: ImportedVocabularyWord[] = [];
  let activeCategory = category?.trim() || null;

  for (const [index, rawLine] of lines.entries()) {
    const parts = rawLine.split(DASH_SPLIT_RE).map(cleanPart).filter(Boolean);

    if (parts.length === 1) {
      activeCategory = parts[0];
      continue;
    }

    if (parts.length < 2 || parts.length > 3) {
      throw new Error(
        `Строка ${index + 1} должна быть в формате "корейское слово — [транскрипция] — перевод" или "корейское слово — перевод".`,
      );
    }

    const [korean, second, third] = parts;
    const transcription = parts.length === 3 ? second : null;
    const translation = parts.length === 3 ? third : second;

    if (!korean || !translation) {
      throw new Error(`Строка ${index + 1} заполнена не полностью.`);
    }

    words.push({
      korean,
      transcription: transcription ? transcription.replace(/^\[|\]$/g, "").trim() : null,
      translation,
      category: activeCategory,
      level,
      isActive: true,
    });
  }

  if (words.length === 0) {
    throw new Error("Не найдено ни одной строки со словом.");
  }

  return words;
}
