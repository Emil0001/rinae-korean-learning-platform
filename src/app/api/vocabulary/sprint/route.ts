import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { submitVocabularySprintAttempt } from "@/lib/vocabulary-service";

type SprintBody = {
  wordIds?: string[];
  mistakeCount?: number;
  durationMs?: number;
};

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as SprintBody;
    if (
      !Array.isArray(body.wordIds) ||
      typeof body.mistakeCount !== "number" ||
      typeof body.durationMs !== "number"
    ) {
      return NextResponse.json({ error: "Не хватает данных спринта." }, { status: 400 });
    }

    const result = await submitVocabularySprintAttempt(user.id, {
      wordIds: body.wordIds,
      mistakeCount: body.mistakeCount,
      durationMs: body.durationMs,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось сохранить спринт." },
      { status: 400 },
    );
  }
}
