import { NextRequest, NextResponse } from "next/server";
import { TopikLevel } from "@prisma/client";
import { getUserFromRequest } from "@/lib/auth/session";
import { getCourseLearningStats } from "@/lib/course-service";
import { prisma } from "@/lib/prisma";

type AttemptWithRelations = {
  id: string;
  userId: string;
  startedAt: Date;
  finishedAt: Date | null;
  totalScore: number;
  maxTotalScore: number;
  readingScore: number;
  maxReadingScore: number;
  listeningScore: number;
  maxListeningScore: number;
  user: {
    id: string;
    name: string;
  };
  test: {
    id: string;
    title: string;
    level: TopikLevel;
  };
};

type AttemptMode = "READING" | "LISTENING" | "FULL";

type LeaderboardEntry = {
  userId: string;
  name: string;
  attemptCount: number;
  totalScore: number;
  maxTotalScore: number;
  bestScore: number;
  bestMaxScore: number;
  bestPercent: number;
  countedAttempt: {
    title: string;
    mode: AttemptMode;
  };
};

type StudentLevel = {
  title: string;
  accent: string;
  description: string;
};

function toPercent(score: number, maxScore: number) {
  if (maxScore <= 0) {
    return 0;
  }

  return Math.round((score / maxScore) * 100);
}

function buildStudentLevel(attemptCount: number, bestPercent: number): StudentLevel {
  if (attemptCount === 0) {
    return {
      title: "Starter",
      accent: "#7f8bb7",
      description: "Первый шаг к сильному корейскому. Пройди свой первый TOPIK и открой прогресс.",
    };
  }

  if (attemptCount <= 2) {
    return {
      title: "Explorer",
      accent: "#b88a3b",
      description: "Ты уже вошёл в ритм. Ещё несколько попыток и картина по навыкам станет намного точнее.",
    };
  }

  if (attemptCount <= 6) {
    return {
      title: "Challenger",
      accent: "#7382d8",
      description: "Хорошая база уже собрана. Сейчас особенно важно стабилизировать результат по обоим разделам.",
    };
  }

  if (attemptCount >= 12 && bestPercent >= 90) {
    return {
      title: "Master",
      accent: "#2d6cdf",
      description: "Сильный уровень и заметный прогресс. Сейчас ты уже задаёшь темп для других студентов.",
    };
  }

  if (attemptCount >= 9 && bestPercent >= 85) {
    return {
      title: "Scholar",
      accent: "#3a9f8f",
      description: "Ты уже выглядишь как серьёзный кандидат на высокий балл. Осталось закрепить стабильность.",
    };
  }

  return {
    title: "Challenger",
    accent: "#7382d8",
    description: "База уже есть, но сейчас прогресс зависит от регулярности. Добейся стабильного результата и выйдешь на следующий уровень.",
  };
}
function getAttemptMode(attempt: AttemptWithRelations): AttemptMode {
  const hasReading = attempt.maxReadingScore > 0;
  const hasListening = attempt.maxListeningScore > 0;

  if (hasReading && hasListening) {
    return "FULL";
  }

  return hasReading ? "READING" : "LISTENING";
}

function buildLeaderboardEntries(attempts: AttemptWithRelations[], level: TopikLevel) {
  const filtered = attempts
    .filter((attempt) => attempt.test.level === level)
    .sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime());

  const firstAttemptsByTest = new Map<string, AttemptWithRelations>();

  for (const attempt of filtered) {
    const key = `${attempt.userId}:${attempt.test.id}`;
    if (!firstAttemptsByTest.has(key)) {
      firstAttemptsByTest.set(key, attempt);
    }
  }

  const grouped = new Map<string, LeaderboardEntry>();

  for (const attempt of firstAttemptsByTest.values()) {
    const percent = toPercent(attempt.totalScore, attempt.maxTotalScore);
    const current = grouped.get(attempt.userId);
    const mode = getAttemptMode(attempt);

    if (!current) {
      grouped.set(attempt.userId, {
        userId: attempt.userId,
        name: attempt.user.name,
        attemptCount: 1,
        totalScore: attempt.totalScore,
        maxTotalScore: attempt.maxTotalScore,
        bestScore: attempt.totalScore,
        bestMaxScore: attempt.maxTotalScore,
        bestPercent: percent,
        countedAttempt: {
          title: attempt.test.title,
          mode,
        },
      });
      continue;
    }

    current.attemptCount += 1;
    current.totalScore += attempt.totalScore;
    current.maxTotalScore += attempt.maxTotalScore;

    if (
      percent > current.bestPercent ||
      (percent === current.bestPercent && attempt.totalScore > current.bestScore)
    ) {
      current.bestPercent = percent;
      current.bestScore = attempt.totalScore;
      current.bestMaxScore = attempt.maxTotalScore;
      current.countedAttempt = {
        title: attempt.test.title,
        mode,
      };
    }
  }

  return [...grouped.values()].sort((left, right) => {
    if (right.bestPercent !== left.bestPercent) {
      return right.bestPercent - left.bestPercent;
    }

    if (right.bestScore !== left.bestScore) {
      return right.bestScore - left.bestScore;
    }

    if (right.totalScore !== left.totalScore) {
      return right.totalScore - left.totalScore;
    }

    return left.name.localeCompare(right.name, "ru");
  });
}

function buildTrackStats(attempts: AttemptWithRelations[], level: TopikLevel) {
  const filtered = attempts.filter((attempt) => attempt.test.level === level);
  const totals = filtered.reduce(
    (acc, attempt) => {
      acc.score += attempt.totalScore;
      acc.maxScore += attempt.maxTotalScore;
      acc.bestPercent = Math.max(acc.bestPercent, toPercent(attempt.totalScore, attempt.maxTotalScore));
      const mode = getAttemptMode(attempt);
      acc.readingAttempts += mode === "READING" ? 1 : 0;
      acc.listeningAttempts += mode === "LISTENING" ? 1 : 0;
      acc.fullAttempts += mode === "FULL" ? 1 : 0;
      return acc;
    },
    {
      score: 0,
      maxScore: 0,
      bestPercent: 0,
      readingAttempts: 0,
      listeningAttempts: 0,
      fullAttempts: 0,
    },
  );

  return {
    attempts: filtered.length,
    readingAttempts: totals.readingAttempts,
    listeningAttempts: totals.listeningAttempts,
    fullAttempts: totals.fullAttempts,
    averagePercent: toPercent(totals.score, totals.maxScore),
    bestPercent: totals.bestPercent,
  };
}

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
  }

  try {
    const attempts = (await prisma.topikAttempt.findMany({
      where: {
        finishedAt: {
          not: null,
        },
      },
      orderBy: { startedAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
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
    })) as AttemptWithRelations[];

    const userAttempts = attempts.filter((attempt) => attempt.userId === user.id);
    const courseStats = await getCourseLearningStats(user.id);
    const topikIStats = buildTrackStats(userAttempts, TopikLevel.TOPIK_I);
    const topikIIStats = buildTrackStats(userAttempts, TopikLevel.TOPIK_II);

    const overall = userAttempts.reduce(
      (acc, attempt) => {
        acc.totalScore += attempt.totalScore;
        acc.maxTotalScore += attempt.maxTotalScore;
        acc.bestPercent = Math.max(acc.bestPercent, toPercent(attempt.totalScore, attempt.maxTotalScore));
        return acc;
      },
      { totalScore: 0, maxTotalScore: 0, bestPercent: 0 },
    );

    const leaderboards = {
      TOPIK_I: buildLeaderboardEntries(attempts, TopikLevel.TOPIK_I),
      TOPIK_II: buildLeaderboardEntries(attempts, TopikLevel.TOPIK_II),
    };

    const userRank = {
      TOPIK_I: leaderboards.TOPIK_I.findIndex((entry) => entry.userId === user.id) + 1 || null,
      TOPIK_II: leaderboards.TOPIK_II.findIndex((entry) => entry.userId === user.id) + 1 || null,
    };

    const uniqueStudentIds = new Set(attempts.map((attempt) => attempt.userId));
    const averagePercent = toPercent(overall.totalScore, overall.maxTotalScore);
    const level = buildStudentLevel(userAttempts.length, overall.bestPercent);
    const combinedLeaders = [
      leaderboards.TOPIK_I[0]
        ? {
            name: leaderboards.TOPIK_I[0].name,
            level: TopikLevel.TOPIK_I,
            percent: leaderboards.TOPIK_I[0].bestPercent,
            score: leaderboards.TOPIK_I[0].bestScore,
          }
        : null,
      leaderboards.TOPIK_II[0]
        ? {
            name: leaderboards.TOPIK_II[0].name,
            level: TopikLevel.TOPIK_II,
            percent: leaderboards.TOPIK_II[0].bestPercent,
            score: leaderboards.TOPIK_II[0].bestScore,
          }
        : null,
    ]
      .filter(Boolean)
      .sort((left, right) => {
        if (!left || !right) {
          return 0;
        }

        if (right.percent !== left.percent) {
          return right.percent - left.percent;
        }

        return right.score - left.score;
      });

    return NextResponse.json({
      profile: {
        name: user.name,
        email: user.email,
        totalAttempts: userAttempts.length,
        averagePercent,
        bestPercent: overall.bestPercent,
        level,
      },
      courseStats,
      tracks: {
        TOPIK_I: {
          ...topikIStats,
          rank: userRank.TOPIK_I,
        },
        TOPIK_II: {
          ...topikIIStats,
          rank: userRank.TOPIK_II,
        },
      },
      site: {
        totalStudents: uniqueStudentIds.size,
        totalAttempts: attempts.length,
        topLeader: combinedLeaders[0] ?? null,
      },
      recentAttempts: userAttempts.slice(0, 6).map((attempt) => ({
        id: attempt.id,
        startedAt: attempt.startedAt,
        finishedAt: attempt.finishedAt,
        totalScore: attempt.totalScore,
        maxTotalScore: attempt.maxTotalScore,
        test: attempt.test,
        percent: toPercent(attempt.totalScore, attempt.maxTotalScore),
        mode: getAttemptMode(attempt),
      })),
      leaderboards: {
        TOPIK_I: leaderboards.TOPIK_I.slice(0, 3),
        TOPIK_II: leaderboards.TOPIK_II.slice(0, 3),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Не удалось загрузить данные кабинета." },
      { status: 500 },
    );
  }
}


