import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { generateCourseStepImage } from "@/lib/openai/course-step-image-generator";

export const runtime = "nodejs";

type StepImageRequest = {
  levelTitle?: string;
  unitTitle?: string;
  lessonTitle?: string;
  stepTitle?: string;
  stepType?: string;
  stepContent?: string;
  request?: string;
};

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as StepImageRequest;

    if (!body.request?.trim()) {
      return NextResponse.json(
        { error: "Опишите, какое изображение нужно создать." },
        { status: 400 },
      );
    }

    if (!body.levelTitle?.trim() || !body.unitTitle?.trim() || !body.lessonTitle?.trim()) {
      return NextResponse.json(
        { error: "Для генерации изображения нужен контекст уровня, юнита и урока." },
        { status: 400 },
      );
    }

    const result = await generateCourseStepImage({
      levelTitle: body.levelTitle,
      unitTitle: body.unitTitle,
      lessonTitle: body.lessonTitle,
      stepTitle: body.stepTitle?.trim() || "Шаг урока",
      stepType: body.stepType?.trim() || "CUSTOM",
      stepContent: body.stepContent?.trim() || "",
      request: body.request,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось сгенерировать изображение.",
      },
      { status: 500 },
    );
  }
}
