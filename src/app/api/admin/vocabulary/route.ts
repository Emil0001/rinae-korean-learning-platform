import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createVocabularyWord, listVocabularyWords } from "@/lib/vocabulary-service";
import type { VocabularyLevel } from "@/lib/vocabulary";

type VocabularyWordBody = {
  korean?: string;
  transcription?: string | null;
  translation?: string;
  exampleKorean?: string | null;
  exampleRussian?: string | null;
  category?: string | null;
  level?: VocabularyLevel;
  isActive?: boolean;
};

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  try {
    const words = await listVocabularyWords();
    return NextResponse.json({ words });
  } catch {
    return NextResponse.json({ error: "Не удалось загрузить слова." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  try {
    const body = (await request.json()) as VocabularyWordBody;
    const word = await createVocabularyWord({
      korean: body.korean ?? "",
      transcription: body.transcription ?? null,
      translation: body.translation ?? "",
      exampleKorean: body.exampleKorean ?? null,
      exampleRussian: body.exampleRussian ?? null,
      category: body.category ?? null,
      level: body.level ?? "BEGINNER",
      isActive: body.isActive ?? true,
    });

    return NextResponse.json({ word }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось создать слово." },
      { status: 400 },
    );
  }
}
