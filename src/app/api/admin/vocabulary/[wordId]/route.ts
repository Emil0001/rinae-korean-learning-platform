import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { updateVocabularyWord } from "@/lib/vocabulary-service";
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

type RouteParams = {
  params: Promise<{ wordId: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  try {
    const { wordId } = await params;
    const body = (await request.json()) as VocabularyWordBody;
    const word = await updateVocabularyWord(wordId, {
      korean: body.korean ?? "",
      transcription: body.transcription ?? null,
      translation: body.translation ?? "",
      exampleKorean: body.exampleKorean ?? null,
      exampleRussian: body.exampleRussian ?? null,
      category: body.category ?? null,
      level: body.level ?? "BEGINNER",
      isActive: body.isActive ?? true,
    });

    return NextResponse.json({ word });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось обновить слово." },
      { status: 400 },
    );
  }
}
