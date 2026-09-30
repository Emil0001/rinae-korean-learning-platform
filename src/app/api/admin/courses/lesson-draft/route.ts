import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { generateLessonDraftWithAI } from "@/lib/openai/course-lesson-generator";
import type { CourseLessonMode } from "@/types/courses";
import { isAIProvider } from "@/lib/ai/provider";

export const runtime = "nodejs";

type LessonDraftRequest = {
  levelTitle?: string;
  levelNumber?: number;
  unitTitle?: string;
  unitDescription?: string;
  lessonMode?: CourseLessonMode;
  request?: string;
  currentLessonTitle?: string;
  currentLessonSummary?: string;
  provider?: unknown;
};

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as LessonDraftRequest;

    if (!body.request?.trim()) {
      return NextResponse.json({ error: "Опишите, какой урок нужно создать." }, { status: 400 });
    }

    if (!body.levelTitle?.trim() || !body.unitTitle?.trim()) {
      return NextResponse.json({ error: "Для AI-генерации нужен контекст уровня и юнита." }, { status: 400 });
    }

    if (body.lessonMode !== "STANDARD" && body.lessonMode !== "FLEXIBLE") {
      return NextResponse.json({ error: "Передан неподдерживаемый режим урока." }, { status: 400 });
    }

    const provider = body.provider === undefined ? "openai" : body.provider;
    if (!isAIProvider(provider)) {
      return NextResponse.json({ error: "Неизвестный AI-провайдер." }, { status: 400 });
    }

    const lesson = await generateLessonDraftWithAI({
      levelTitle: body.levelTitle,
      levelNumber: Number(body.levelNumber ?? 0),
      unitTitle: body.unitTitle,
      unitDescription: body.unitDescription ?? "",
      lessonMode: body.lessonMode,
      request: body.request,
      currentLessonTitle: body.currentLessonTitle ?? "",
      currentLessonSummary: body.currentLessonSummary ?? "",
    }, provider);

    return NextResponse.json({ lesson });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось сгенерировать урок через AI.",
      },
      { status: 500 },
    );
  }
}
