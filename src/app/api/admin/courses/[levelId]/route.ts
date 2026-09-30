import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminCourseLevel, saveAdminCourseLevel } from "@/lib/course-service";
import type { AdminCourseLevel } from "@/types/courses";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ levelId: string }> | { levelId: string };
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { levelId } = await context.params;
    const level = await getAdminCourseLevel(levelId);
    return NextResponse.json(level);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось загрузить уровень." },
      { status: 400 },
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { levelId } = await context.params;
    const body = (await request.json()) as { level?: AdminCourseLevel };

    if (!body.level || body.level.id !== levelId) {
      return NextResponse.json(
        { error: "Передан некорректный payload уровня." },
        { status: 400 },
      );
    }

    const result = await saveAdminCourseLevel(body.level);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось сохранить уровень." },
      { status: 400 },
    );
  }
}
