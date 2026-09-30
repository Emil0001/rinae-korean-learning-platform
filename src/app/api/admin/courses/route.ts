import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminCourseLevelsIndex, saveAdminCourseCatalog } from "@/lib/course-service";
import type { AdminCourseLevel } from "@/types/courses";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const catalog = await getAdminCourseLevelsIndex();
    return NextResponse.json(catalog);
  } catch {
    return NextResponse.json(
      { error: "Не удалось загрузить список уровней." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as { levels?: AdminCourseLevel[] };
    if (!Array.isArray(body.levels)) {
      return NextResponse.json({ error: "Передан некорректный payload конструктора курсов." }, { status: 400 });
    }

    const result = await saveAdminCourseCatalog(body.levels);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось сохранить конструктор курсов.",
      },
      { status: 400 },
    );
  }
}
