import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { generateCourseStepDraftWithAI } from "@/lib/openai/course-step-generator";
import { generateCourseStepImage } from "@/lib/openai/course-step-image-generator";
import type { CourseStepType } from "@/types/courses";
import { isAIProvider, isAIStepOutputMode } from "@/lib/ai/provider";

export const runtime = "nodejs";

type StepDraftRequest = {
  levelTitle?: string;
  unitTitle?: string;
  lessonTitle?: string;
  lessonSummary?: string;
  stepTitle?: string;
  stepType?: CourseStepType;
  currentContent?: string;
  request?: string;
  provider?: unknown;
  outputMode?: unknown;
};

function shouldGenerateStepImage(prompt: string) {
  return /\b(image|illustration|illustrate|visual|picture|diagram)\b|изображ|иллюстрац|картин|сгенерируй.*(арт|иллюстрац|изображ)/iu.test(
    prompt,
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as StepDraftRequest;

    if (!body.request?.trim()) {
      return NextResponse.json(
        { error: "Опишите, что нужно сгенерировать для этого шага." },
        { status: 400 },
      );
    }

    if (!body.levelTitle?.trim() || !body.unitTitle?.trim() || !body.lessonTitle?.trim()) {
      return NextResponse.json(
        { error: "Для генерации шага нужен контекст уровня, юнита и урока." },
        { status: 400 },
      );
    }

    if (
      !body.stepType ||
      !["GRAMMAR", "EXAMPLES", "VOCABULARY", "PRACTICE", "QUIZ", "CUSTOM"].includes(
        body.stepType,
      )
    ) {
      return NextResponse.json(
        { error: "Передан неподдерживаемый тип шага." },
        { status: 400 },
      );
    }

    const normalizedInput = {
      levelTitle: body.levelTitle,
      unitTitle: body.unitTitle,
      lessonTitle: body.lessonTitle,
      lessonSummary: body.lessonSummary?.trim() || "",
      stepTitle: body.stepTitle?.trim() || "Шаг урока",
      stepType: body.stepType,
      currentContent: body.currentContent?.trim() || "",
      request: body.request.trim(),
    };

    const provider = body.provider === undefined ? "openai" : body.provider;
    if (!isAIProvider(provider)) {
      return NextResponse.json({ error: "Неизвестный AI-провайдер." }, { status: 400 });
    }

    const outputMode = body.outputMode === undefined ? "structured" : body.outputMode;
    if (!isAIStepOutputMode(outputMode)) {
      return NextResponse.json({ error: "Неизвестный режим AI-генерации." }, { status: 400 });
    }

    const needsImage = shouldGenerateStepImage(normalizedInput.request);
    const [result, generatedImage] = await Promise.all([
      generateCourseStepDraftWithAI(normalizedInput, provider, outputMode),
      needsImage && provider === "openai"
        ? generateCourseStepImage({
            levelTitle: normalizedInput.levelTitle,
            unitTitle: normalizedInput.unitTitle,
            lessonTitle: normalizedInput.lessonTitle,
            stepTitle: normalizedInput.stepTitle,
            stepType: normalizedInput.stepType,
            stepContent: normalizedInput.currentContent,
            request: normalizedInput.request,
          })
        : Promise.resolve(null),
    ]);

    return NextResponse.json({
      ...result,
      imageUrl: generatedImage?.imageUrl ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось сгенерировать содержимое шага.",
      },
      { status: 500 },
    );
  }
}
