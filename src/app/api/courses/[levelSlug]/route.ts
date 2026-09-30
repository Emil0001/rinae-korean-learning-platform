import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { getCourseRoadmap } from "@/lib/course-service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ levelSlug: string }> | { levelSlug: string };
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getUserFromRequest(request);
    const { levelSlug } = await context.params;
    const roadmap = await getCourseRoadmap(levelSlug, user?.id);

    if (!roadmap) {
      return NextResponse.json({ error: "Уровень не найден." }, { status: 404 });
    }

    return NextResponse.json(roadmap);
  } catch (error) {
    console.error("Failed to load course roadmap", error);
    return NextResponse.json(
      { error: "Не удалось загрузить карту уровня." },
      { status: 500 },
    );
  }
}
