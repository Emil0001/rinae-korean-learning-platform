import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { updateCourseLessonProgress } from "@/lib/course-service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ lessonId: string }> | { lessonId: string };
};

type Body = {
  action?: "open" | "complete" | "restart";
  stepOrder?: number;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Войдите, чтобы сохранять прогресс курса." }, { status: 401 });
  }

  try {
    const { lessonId } = await context.params;
    const body = (await request.json()) as Body;
    const action = body.action;
    const stepOrder = Number(body.stepOrder ?? 0);

    if (action !== "open" && action !== "complete" && action !== "restart") {
      return NextResponse.json(
        { error: "Передан некорректный payload обновления прогресса." },
        { status: 400 },
      );
    }

    if (action !== "restart" && !Number.isFinite(stepOrder)) {
      return NextResponse.json(
        { error: "Передан некорректный payload обновления прогресса." },
        { status: 400 },
      );
    }

    const progress = await updateCourseLessonProgress(
      user.id,
      lessonId,
      action === "restart" ? 1 : Math.floor(stepOrder),
      action,
    );

    return NextResponse.json(progress);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось обновить прогресс.",
      },
      { status: 400 },
    );
  }
}
