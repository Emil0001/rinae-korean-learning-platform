import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import {
  createCompletedCoursePlacementState,
  normalizeCoursePlacementResult,
} from "@/lib/course-placement-shared";
import { prisma } from "@/lib/prisma";

type PlacementBody = {
  recommendedLevelNumber?: number;
  recommendedLevelSlug?: string;
  preserveExisting?: boolean;
};

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { error: "Войдите, чтобы сохранить результат теста." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as PlacementBody | null;
  const result = normalizeCoursePlacementResult(body);
  if (!result) {
    return NextResponse.json(
      { error: "Некорректный результат теста." },
      { status: 400 },
    );
  }

  const completedAt = new Date();
  if (body?.preserveExisting === true) {
    await prisma.user.updateMany({
      where: {
        id: user.id,
        coursePlacementCompletedAt: null,
      },
      data: {
        coursePlacementLevelNumber: result.recommendedLevelNumber,
        coursePlacementLevelSlug: result.recommendedLevelSlug,
        coursePlacementCompletedAt: completedAt,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        coursePlacementLevelNumber: result.recommendedLevelNumber,
        coursePlacementLevelSlug: result.recommendedLevelSlug,
        coursePlacementCompletedAt: completedAt,
      },
    });
  }

  const savedUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      coursePlacementLevelNumber: true,
      coursePlacementLevelSlug: true,
      coursePlacementCompletedAt: true,
    },
  });

  const placement =
    savedUser?.coursePlacementLevelNumber &&
    savedUser.coursePlacementLevelSlug &&
    savedUser.coursePlacementCompletedAt
      ? createCompletedCoursePlacementState(
          {
            recommendedLevelNumber: savedUser.coursePlacementLevelNumber,
            recommendedLevelSlug: savedUser.coursePlacementLevelSlug,
          },
          savedUser.coursePlacementCompletedAt,
        )
      : createCompletedCoursePlacementState(result, completedAt);

  return NextResponse.json({ placement });
}
