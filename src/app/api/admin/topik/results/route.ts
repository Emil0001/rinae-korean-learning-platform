import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";
import type { AdminTopikResultsResponse, AdminTopikStudentResult, TopikLevel } from "@/types/topik";

function toPercent(score: number, maxScore: number) {
  if (maxScore <= 0) {
    return 0;
  }

  return Math.round((score / maxScore) * 100);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const attempts = await prisma.topikAttempt.findMany({
      where: {
        finishedAt: {
          not: null,
        },
      },
      orderBy: {
        finishedAt: "desc",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        test: {
          select: {
            id: true,
            title: true,
            level: true,
          },
        },
      },
    });

    const grouped = new Map<string, AdminTopikStudentResult>();

    for (const attempt of attempts) {
      if (!attempt.finishedAt) {
        continue;
      }

      const percent = toPercent(attempt.totalScore, attempt.maxTotalScore);
      const existing = grouped.get(attempt.userId);

      const attemptItem = {
        id: attempt.id,
        finishedAt: attempt.finishedAt.toISOString(),
        totalScore: attempt.totalScore,
        maxTotalScore: attempt.maxTotalScore,
        percent,
        readingScore: attempt.readingScore,
        maxReadingScore: attempt.maxReadingScore,
        listeningScore: attempt.listeningScore,
        maxListeningScore: attempt.maxListeningScore,
        test: {
          id: attempt.test.id,
          title: attempt.test.title,
          level: attempt.test.level as TopikLevel,
        },
      };

      if (!existing) {
        grouped.set(attempt.userId, {
          userId: attempt.user.id,
          name: attempt.user.name,
          email: attempt.user.email,
          attemptsCount: 1,
          bestScore: attempt.totalScore,
          bestPercent: percent,
          averagePercent: percent,
          lastFinishedAt: attempt.finishedAt.toISOString(),
          levels: [attempt.test.level as TopikLevel],
          attempts: [attemptItem],
        });
        continue;
      }

      existing.attemptsCount += 1;
      existing.bestScore = Math.max(existing.bestScore, attempt.totalScore);
      existing.bestPercent = Math.max(existing.bestPercent, percent);
      existing.averagePercent = Math.round(
        ((existing.averagePercent * (existing.attemptsCount - 1)) + percent) / existing.attemptsCount,
      );

      if (!existing.levels.includes(attempt.test.level as TopikLevel)) {
        existing.levels.push(attempt.test.level as TopikLevel);
      }

      existing.attempts.push(attemptItem);
    }

    const students = [...grouped.values()].sort((left, right) => {
      if (right.bestPercent !== left.bestPercent) {
        return right.bestPercent - left.bestPercent;
      }

      return new Date(right.lastFinishedAt).getTime() - new Date(left.lastFinishedAt).getTime();
    });

    return NextResponse.json({
      totals: {
        students: students.length,
        attempts: attempts.length,
      },
      students,
    } satisfies AdminTopikResultsResponse);
  } catch {
    return NextResponse.json(
      { error: "?筠 ?畇逵剋棘?? 鈞逵均??鈞龜?? ?筠鈞?剋??逵?? TOPIK." } satisfies AdminTopikResultsResponse,
      { status: 500 },
    );
  }
}

