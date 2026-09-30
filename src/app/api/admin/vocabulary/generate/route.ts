import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { isAIProvider } from "@/lib/ai/provider";
import { generateVocabularyExampleWithAI, generateVocabularyExamplesWithAI, generateVocabularyWordsWithAI } from "@/lib/openai/vocabulary-generator";
import { fillMissingVocabularyExamples, listVocabularyWords } from "@/lib/vocabulary-service";
import type { VocabularyLevel } from "@/lib/vocabulary";

const LEVELS: VocabularyLevel[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
  try {
    const body = await request.json() as Record<string, unknown>;
    const provider = body.provider ?? "openai";
    const level = body.level ?? "BEGINNER";
    if (!isAIProvider(provider)) return NextResponse.json({ error: "Неизвестный AI-провайдер." }, { status: 400 });
    if (!LEVELS.includes(level as VocabularyLevel)) return NextResponse.json({ error: "Некорректный уровень." }, { status: 400 });

    if (body.action === "example") {
      const korean = typeof body.korean === "string" ? body.korean.trim() : "";
      const translation = typeof body.translation === "string" ? body.translation.trim() : "";
      if (!korean || !translation) return NextResponse.json({ error: "Укажите слово и перевод." }, { status: 400 });
      const example = await generateVocabularyExampleWithAI({
        provider, korean, translation,
        transcription: typeof body.transcription === "string" ? body.transcription : "",
        category: typeof body.category === "string" ? body.category : "",
        level: level as VocabularyLevel,
      });
      return NextResponse.json({ example });
    }

    if (body.action === "bulk-examples") {
      const requestedIds = Array.isArray(body.wordIds)
        ? body.wordIds.filter((id): id is string => typeof id === "string").slice(0, 10)
        : [];
      if (!requestedIds.length) return NextResponse.json({ error: "Не выбраны слова для примеров." }, { status: 400 });
      const requestedIdSet = new Set(requestedIds);
      const existingWords = (await listVocabularyWords()).filter((word) =>
        requestedIdSet.has(word.id) && (!word.exampleKorean?.trim() || !word.exampleRussian?.trim()),
      );
      if (!existingWords.length) return NextResponse.json({ updated: 0 });
      const examples = await generateVocabularyExamplesWithAI({
        provider,
        words: existingWords.map((word) => ({
          id: word.id, korean: word.korean, translation: word.translation, transcription: word.transcription,
          category: word.category, level: word.level,
        })),
      });
      const updated = await fillMissingVocabularyExamples(examples);
      return NextResponse.json({ updated, generatedIds: examples.map((example) => example.id) });
    }

    const count = Math.max(1, Math.min(20, Number(body.count) || 8));
    const existingWords = await listVocabularyWords();
    const existingCategories = [
      ...new Set(
        existingWords
          .map((word) => word.category?.trim())
          .filter((category): category is string => Boolean(category)),
      ),
    ];
    const words = await generateVocabularyWordsWithAI({
      provider, level: level as VocabularyLevel, count,
      topic: typeof body.topic === "string" ? body.topic : "",
      instructions: typeof body.instructions === "string" ? body.instructions : "",
      excludeWords: existingWords.map((word) => ({ korean: word.korean, translation: word.translation })),
      existingCategories,
    });
    return NextResponse.json({ words });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось создать содержимое через AI." }, { status: 400 });
  }
}
