import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { getCourseLesson } from "@/lib/course-service";

export const runtime = "nodejs";

type RouteContext = {
  params:
    | Promise<{ levelSlug: string; lessonSlug: string }>
    | { levelSlug: string; lessonSlug: string };
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getUserFromRequest(request);
    const { levelSlug, lessonSlug } = await context.params;
    const unitSlug = request.nextUrl.searchParams.get("unit");
    const lesson = await getCourseLesson(levelSlug, lessonSlug, user?.id, unitSlug);

    if (!lesson) {
      return NextResponse.json({ error: "Урок не найден." }, { status: 404 });
    }

    return NextResponse.json(lesson);
  } catch (error) {
    console.error("Failed to load course lesson", error);
    return NextResponse.json(
      { error: "Не удалось загрузить урок." },
      { status: 500 },
    );
  }
}
