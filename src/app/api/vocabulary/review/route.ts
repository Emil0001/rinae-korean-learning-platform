import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { submitVocabularyReview } from "@/lib/vocabulary-service";
import type { VocabularyReviewRating } from "@/lib/vocabulary";

type ReviewBody = {
  wordId?: string;
  rating?: VocabularyReviewRating;
};

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as ReviewBody;
    const wordId = body.wordId?.trim() ?? "";
    const rating = body.rating;

    if (!wordId || !rating) {
      return NextResponse.json({ error: "Не хватает данных для оценки карточки." }, { status: 400 });
    }

    const result = await submitVocabularyReview(user.id, wordId, rating);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Не удалось сохранить ответ по карточке.",
      },
      { status: 400 },
    );
  }
}
