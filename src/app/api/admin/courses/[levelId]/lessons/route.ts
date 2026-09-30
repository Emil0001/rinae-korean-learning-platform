import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { deleteAdminCourseLesson, saveAdminCourseLesson } from "@/lib/course-service";
import type { AdminCourseLesson } from "@/types/courses";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ levelId: string }> | { levelId: string };
};

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { levelId } = await context.params;
    const body = (await request.json()) as {
      unitId?: string;
      lesson?: AdminCourseLesson;
    };

    if (!body.unitId || !body.lesson) {
      return NextResponse.json(
        { error: "Не переданы юнит или данные урока." },
        { status: 400 },
      );
    }

    const result = await saveAdminCourseLesson(levelId, body.unitId, body.lesson);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось сохранить урок.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { levelId } = await context.params;
    const body = (await request.json()) as {
      unitId?: string;
      lessonId?: string;
    };

    if (!body.unitId || !body.lessonId) {
      return NextResponse.json(
        { error: "Не передан юнит или урок для удаления." },
        { status: 400 },
      );
    }

    const result = await deleteAdminCourseLesson(levelId, body.unitId, body.lessonId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось удалить урок.",
      },
      { status: 400 },
    );
  }
}
