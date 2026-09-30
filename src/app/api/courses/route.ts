import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { getCourseOverview } from "@/lib/course-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    const overview = await getCourseOverview(user?.id);
    return NextResponse.json(overview);
  } catch {
    return NextResponse.json(
      { error: "Не удалось загрузить обзор курсов." },
      { status: 500 },
    );
  }
}
