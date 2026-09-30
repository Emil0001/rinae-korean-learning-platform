import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { submitPlacement, type PlacementAnswerInput } from "@/lib/vocabulary-service";

type PlacementBody = {
  placementSessionId?: string;
  answers?: PlacementAnswerInput[];
};

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as PlacementBody;
    const placementSessionId = body.placementSessionId?.trim();
    const answers = (body.answers ?? []).flatMap((item) =>
      item.questionId && item.selectedOptionId
        ? [
            {
              questionId: item.questionId,
              selectedOptionId: item.selectedOptionId,
              responseTimeMs: item.responseTimeMs ?? null,
            },
          ]
        : [],
    );

    if (!placementSessionId) {
      return NextResponse.json({ error: "Не найдена сессия теста." }, { status: 400 });
    }

    const result = await submitPlacement(user.id, placementSessionId, answers);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось сохранить результаты определения уровня.",
      },
      { status: 400 },
    );
  }
}
