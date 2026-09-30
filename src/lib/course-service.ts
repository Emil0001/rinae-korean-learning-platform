import { CourseLessonMode, CourseStepType, Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  buildInitialCourseCatalog,
  COURSE_LEVEL_BLUEPRINTS,
  makeUniqueSlug,
  slugify,
  STANDARD_STEP_SEQUENCE,
} from "@/lib/course-content";
import {
  collectManagedCourseImageUrls,
  persistCourseImagesForLevels,
  removeCourseImageIfManaged,
} from "@/lib/course-images";
import {
  createCompletedCoursePlacementState,
  createEmptyCoursePlacementState,
} from "@/lib/course-placement-shared";
import { COURSE_STEP_LABELS } from "@/types/courses";
import type {
  AdminCourseCatalogResponse,
  AdminCourseLesson,
  AdminCourseLessonResponse,
  AdminCourseLevel,
  AdminCourseLevelResponse,
  AdminCourseLevelSummary,
  AdminCourseLevelsIndexResponse,
  CourseLearningStats,
  CourseLessonKind,
  CourseLessonResponse,
  CourseNodeState,
  CourseOverviewResponse,
  CourseProgressResponse,
  CourseRoadmapResponse,
  CourseStepType as CourseStepTypeView,
} from "@/types/courses";

const standardSequenceDb = STANDARD_STEP_SEQUENCE as CourseStepType[];
const defaultCourseLessonKind: CourseLessonKind = "LESSON";
const activeCourseLevelSlugs = COURSE_LEVEL_BLUEPRINTS.map((level) => level.slug);

function createCourseVocabularyLinkId() {
  return randomBytes(18).toString("hex");
}

function isActiveCourseLevelSlug(slug: string) {
  return activeCourseLevelSlugs.includes(slug as (typeof activeCourseLevelSlugs)[number]);
}

function normalizeCourseLessonKind(value: unknown): CourseLessonKind {
  return value === "MINI_QUIZ" || value === "FINAL_TEST" ? value : defaultCourseLessonKind;
}

function getCourseLessonKind(lesson: unknown): CourseLessonKind {
  return normalizeCourseLessonKind((lesson as { kind?: unknown }).kind);
}

function courseLessonKindData(kind: CourseLessonKind) {
  return { kind } as Record<string, CourseLessonKind>;
}

type ProgressMap = Map<
  string,
  {
    lessonId: string;
    currentStepOrder: number;
    completedStepOrders: number[];
    completedAt: Date | null;
    lastOpenedAt: Date;
  }
>;

type CourseVocabularyWordRow = {
  lessonId?: string;
  id: string;
  korean: string;
  transcription: string | null;
  translation: string;
  category: string | null;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
};

type CourseLessonVocabularyLinkRow = {
  lessonId: string;
  wordId: string;
  order: number;
};

const stepXpByType: Record<CourseStepTypeView, number> = {
  GRAMMAR: 20,
  EXAMPLES: 10,
  VOCABULARY: 15,
  PRACTICE: 20,
  QUIZ: 40,
  CUSTOM: 15,
};

const lessonKindBonusXp: Record<CourseLessonKind, number> = {
  LESSON: 10,
  MINI_QUIZ: 20,
  FINAL_TEST: 40,
};

const courseRanks = [
  { title: "Beginner I", minXp: 0 },
  { title: "Beginner II", minXp: 300 },
  { title: "Beginner III", minXp: 750 },
  { title: "Explorer", minXp: 1400 },
  { title: "Challenger", minXp: 2400 },
  { title: "Scholar", minXp: 3800 },
] as const;

function percent(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

function dedupeStepOrders(values: number[], maxOrder: number) {
  return [...new Set(values.filter((value) => value > 0 && value <= maxOrder))].sort(
    (left, right) => left - right,
  );
}

function getCompletedPrefix(orders: number[]) {
  let prefix = 0;

  for (const order of orders) {
    if (order !== prefix + 1) {
      break;
    }

    prefix = order;
  }

  return prefix;
}

function getNextUnlockedStepOrder(totalSteps: number, completedOrders: number[], completedAt: Date | null) {
  if (completedAt) {
    return totalSteps;
  }

  const prefix = getCompletedPrefix(completedOrders);
  return Math.min(totalSteps, prefix + 1);
}

function getStepState(
  totalSteps: number,
  stepOrder: number,
  currentStepOrder: number,
  completedOrders: number[],
  completedAt: Date | null,
): CourseNodeState {
  if (!completedAt && stepOrder === currentStepOrder) {
    return "current";
  }

  if (completedOrders.includes(stepOrder)) {
    return "completed";
  }

  if (completedAt) {
    return "available";
  }

  const unlockedOrder = getNextUnlockedStepOrder(totalSteps, completedOrders, completedAt);
  if (stepOrder > unlockedOrder) {
    return "locked";
  }

  return stepOrder === currentStepOrder ? "current" : "available";
}

function getStepLabel(type: CourseStepTypeView) {
  return COURSE_STEP_LABELS[type];
}

function normalizeVocabularyWordIds(wordIds: string[] | undefined) {
  return [...new Set((wordIds ?? []).map((wordId) => wordId.trim()).filter(Boolean))];
}

async function getCourseLessonVocabularyLinks(lessonIds: string[]) {
  if (lessonIds.length === 0) {
    return new Map<string, string[]>();
  }

  const rows = await prisma.$queryRaw<CourseLessonVocabularyLinkRow[]>`
    SELECT "lessonId", "wordId", "order"
    FROM "CourseLessonVocabularyWord"
    WHERE "lessonId" = ANY(${lessonIds})
    ORDER BY "lessonId" ASC, "order" ASC
  `;

  return rows.reduce((map, row) => {
    const current = map.get(row.lessonId) ?? [];
    current.push(row.wordId);
    map.set(row.lessonId, current);
    return map;
  }, new Map<string, string[]>());
}

function countUniqueVocabularyWordsForLessons(
  lessonIds: string[],
  vocabularyWordIdsByLessonId: Map<string, string[]>,
) {
  const wordIds = new Set<string>();

  for (const lessonId of lessonIds) {
    for (const wordId of vocabularyWordIdsByLessonId.get(lessonId) ?? []) {
      wordIds.add(wordId);
    }
  }

  return wordIds.size;
}

async function getCourseLessonVocabularyWords(lessonId: string) {
  const rows = await prisma.$queryRaw<CourseVocabularyWordRow[]>`
    SELECT
      w."id",
      w."korean",
      w."transcription",
      w."translation",
      w."category",
      w."level"
    FROM "CourseLessonVocabularyWord" link
    INNER JOIN "VocabularyWord" w ON w."id" = link."wordId"
    WHERE link."lessonId" = ${lessonId}
      AND w."isActive" = true
    ORDER BY link."order" ASC
  `;

  return rows.map((row) => ({
    id: row.id,
    korean: row.korean,
    transcription: row.transcription,
    translation: row.translation,
    category: row.category,
    level: row.level,
  }));
}

async function getCourseLessonVocabularyDistractorWords(words: CourseVocabularyWordRow[]) {
  if (words.length === 0) {
    return [];
  }

  const attachedIds = words.map((word) => word.id);
  const categories = [
    ...new Set(
      words
        .map((word) => word.category?.trim().toLocaleLowerCase("ru-RU"))
        .filter((category): category is string => Boolean(category)),
    ),
  ];
  const sameCategoryRows =
    categories.length > 0
      ? await prisma.$queryRaw<CourseVocabularyWordRow[]>`
          SELECT
            ranked."id",
            ranked."korean",
            ranked."transcription",
            ranked."translation",
            ranked."category",
            ranked."level"
          FROM (
            SELECT
              w."id",
              w."korean",
              w."transcription",
              w."translation",
              w."category",
              w."level",
              ROW_NUMBER() OVER (
                PARTITION BY LOWER(TRIM(w."category"))
                ORDER BY w."korean" ASC
              ) AS "categoryRank"
            FROM "VocabularyWord" w
            WHERE w."isActive" = true
              AND w."id" NOT IN (${Prisma.join(attachedIds)})
              AND LOWER(TRIM(w."category")) IN (${Prisma.join(categories)})
          ) ranked
          WHERE ranked."categoryRank" <= 12
          ORDER BY ranked."category" ASC, ranked."korean" ASC
        `
      : [];
  const sameCategoryIds = sameCategoryRows.map((word) => word.id);
  const excludedIds = [...attachedIds, ...sameCategoryIds];
  const fallbackRows = await prisma.$queryRaw<CourseVocabularyWordRow[]>`
    SELECT
      w."id",
      w."korean",
      w."transcription",
      w."translation",
      w."category",
      w."level"
    FROM "VocabularyWord" w
    WHERE w."isActive" = true
      AND w."id" NOT IN (${Prisma.join(excludedIds)})
    ORDER BY w."category" ASC, w."korean" ASC
    LIMIT 40
  `;

  return [...sameCategoryRows, ...fallbackRows].map((row) => ({
    id: row.id,
    korean: row.korean,
    transcription: row.transcription,
    translation: row.translation,
    category: row.category,
    level: row.level,
  }));
}

async function unlockLessonVocabularyWords(userId: string, lessonId: string) {
  const rows = await prisma.$queryRaw<{ wordId: string }[]>`
    SELECT "wordId"
    FROM "CourseLessonVocabularyWord"
    WHERE "lessonId" = ${lessonId}
    ORDER BY "order" ASC
  `;

  if (rows.length === 0) {
    return;
  }

  for (const row of rows) {
    await prisma.$executeRaw`
      INSERT INTO "VocabularyReview" (
        "id", "userId", "wordId", "reviewCount", "knownCount", "dontKnowCount", "currentStreak",
        "intervalDays", "nextReviewAt", "lastReviewedAt", "lastRating", "createdAt", "updatedAt"
      )
      VALUES (
        ${createCourseVocabularyLinkId()}, ${userId}, ${row.wordId}, 0, 0, 0, 0,
        0, NOW(), NULL, NULL, NOW(), NOW()
      )
      ON CONFLICT ("userId", "wordId") DO NOTHING
    `;
  }
}

function getStepXp(type: CourseStepTypeView) {
  return stepXpByType[type] ?? stepXpByType.CUSTOM;
}

function getLessonXp(lesson: { kind?: unknown; steps: { type: CourseStepType }[] }) {
  const stepXp = lesson.steps.reduce((sum, step) => sum + getStepXp(step.type as CourseStepTypeView), 0);
  return stepXp + lessonKindBonusXp[getCourseLessonKind(lesson)];
}

function getCourseRank(totalXp: number) {
  const currentIndex = Math.max(
    0,
    courseRanks.findIndex((rank, index) => {
      const nextRank = courseRanks[index + 1];
      return totalXp >= rank.minXp && (!nextRank || totalXp < nextRank.minXp);
    }),
  );
  const currentRank = courseRanks[currentIndex] ?? courseRanks[0];
  const nextRank = courseRanks[currentIndex + 1] ?? null;
  const previousMinXp = currentRank.minXp;
  const nextMinXp = nextRank?.minXp ?? Math.max(totalXp, previousMinXp + 1);
  const rankProgressPercent = nextRank ? percent(totalXp - previousMinXp, nextMinXp - previousMinXp) : 100;

  return {
    rankTitle: currentRank.title,
    nextRankTitle: nextRank?.title ?? null,
    rankProgressPercent,
    xpToNextRank: nextRank ? Math.max(0, nextRank.minXp - totalXp) : null,
  };
}

function countStreakDays(completedDates: Date[]) {
  if (completedDates.length === 0) {
    return 0;
  }

  const completedDayKeys = new Set(
    completedDates.map((date) => {
      const day = new Date(date);
      day.setHours(0, 0, 0, 0);
      return day.getTime();
    }),
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let cursor = completedDayKeys.has(today.getTime()) ? today : yesterday;
  let streakDays = 0;

  while (completedDayKeys.has(cursor.getTime())) {
    streakDays += 1;
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() - 1);
  }

  return streakDays;
}

export async function getCourseLearningStats(userId: string | null | undefined): Promise<CourseLearningStats> {
  if (!userId) {
    return {
      streakDays: 0,
      totalXp: 0,
      completedLessons: 0,
      rankTitle: "Beginner I",
      nextRankTitle: "Beginner II",
      rankProgressPercent: 0,
      xpToNextRank: 300,
    };
  }

  const [progressRows, sprintXpRows] = await Promise.all([
    prisma.courseLessonProgress.findMany({
      where: { userId },
      include: {
        lesson: {
          include: {
            steps: {
              select: {
                type: true,
              },
            },
          },
        },
      },
    }),
    prisma.$queryRaw<{ xp: bigint }[]>`
      SELECT COALESCE(SUM("xpEarned"), 0)::bigint AS xp
      FROM "VocabularySprintAttempt"
      WHERE "userId" = ${userId}
    `,
  ]);

  const courseXp = progressRows.reduce((sum, progress) => {
    if (progress.completedAt) {
      return sum + getLessonXp(progress.lesson);
    }

    const completedStepOrders = new Set(progress.completedStepOrders);
    const partialStepXp = progress.lesson.steps.reduce(
      (stepSum, step, index) => stepSum + (completedStepOrders.has(index + 1) ? getStepXp(step.type as CourseStepTypeView) : 0),
      0,
    );

    return sum + partialStepXp;
  }, 0);
  const totalXp = courseXp + Number(sprintXpRows[0]?.xp ?? 0);
  const completedDates = progressRows.flatMap((progress) => (progress.completedAt ? [progress.completedAt] : []));
  const rank = getCourseRank(totalXp);

  return {
    streakDays: countStreakDays(completedDates),
    totalXp,
    completedLessons: completedDates.length,
    ...rank,
  };
}

function normalizeStandardSteps(steps: { type: string }[]) {
  if (steps.length !== standardSequenceDb.length) {
    throw new Error("Стандартный урок должен содержать ровно 5 шагов.");
  }

  steps.forEach((step, index) => {
    if (step.type !== standardSequenceDb[index]) {
      throw new Error(
        "Стандартный урок должен сохранять порядок: Грамматика -> Примеры -> Словарь -> Практика -> Тест.",
      );
    }
  });
}

function getCanonicalCourseLevelTitle(levelNumber: number, fallbackTitle: string) {
  switch (levelNumber) {
    case 3:
      return "Средний";
    case 4:
      return "Выше среднего";
    default:
      return fallbackTitle;
  }
}

export async function ensureCourseCatalog() {
  const existingLevels = await prisma.courseLevel.findMany({
    where: { slug: { in: activeCourseLevelSlugs } },
    select: { id: true, slug: true },
    orderBy: { number: "asc" },
  });

  if (existingLevels.length < COURSE_LEVEL_BLUEPRINTS.length) {
    await prisma.$transaction(
      COURSE_LEVEL_BLUEPRINTS.map((level) =>
        prisma.courseLevel.upsert({
          where: { slug: level.slug },
          update: {
            number: level.number,
            accentColor: level.accentColor,
          },
          create: {
            number: level.number,
            slug: level.slug,
            title: level.title,
            description: level.description,
            accentColor: level.accentColor,
          },
        }),
      ),
    );
  }

  await prisma.$transaction(
    COURSE_LEVEL_BLUEPRINTS.map((level) =>
      prisma.courseLevel.updateMany({
        where: { slug: level.slug },
        data: {
          number: level.number,
          accentColor: level.accentColor,
        },
      }),
    ),
  );

  const existingUnitCount = await prisma.courseUnit.count({
    where: {
      level: {
        slug: { in: activeCourseLevelSlugs },
      },
    },
  });
  if (existingUnitCount > 0) {
    return;
  }

  const seededCatalog = buildInitialCourseCatalog();

  for (const level of seededCatalog) {
    const existingLevel = await prisma.courseLevel.findUnique({
      where: { slug: level.slug },
      select: { id: true },
    });

    if (!existingLevel) {
      continue;
    }

    await prisma.courseLevel.update({
      where: { id: existingLevel.id },
      data: {
        units: {
          create: level.units.map((unit, unitIndex) => ({
            slug: unit.slug,
            order: unitIndex + 1,
            title: unit.title,
            description: unit.description,
            imageUrl: unit.imageUrl,
            isPublished: unit.isPublished,
            lessons: {
              create: unit.lessons.map((lesson, lessonIndex) => ({
                slug: lesson.slug,
                order: lessonIndex + 1,
                title: lesson.title,
                summary: lesson.summary,
                imageUrl: lesson.imageUrl,
                estimatedMinutes: lesson.estimatedMinutes,
                mode: lesson.mode as CourseLessonMode,
                ...courseLessonKindData(getCourseLessonKind(lesson)),
                isPublished: lesson.isPublished,
                steps: {
                  create: lesson.steps.map((step, stepIndex) => ({
                    order: stepIndex + 1,
                    type: step.type as CourseStepType,
                    title: step.title,
                    content: step.content,
                    imageUrl: step.imageUrl,
                  })),
                },
              })),
            },
          })),
        },
      },
    });
  }
}

async function getProgressMap(userId: string | null | undefined, lessonIds: string[]) {
  if (!userId || lessonIds.length === 0) {
    return new Map() as ProgressMap;
  }

  const rows = await prisma.courseLessonProgress.findMany({
    where: {
      userId,
      lessonId: { in: lessonIds },
    },
    select: {
      lessonId: true,
      currentStepOrder: true,
      completedStepOrders: true,
      completedAt: true,
      lastOpenedAt: true,
    },
  });

  return new Map(
    rows.map((row) => [
      row.lessonId,
      {
        lessonId: row.lessonId,
        currentStepOrder: row.currentStepOrder,
        completedStepOrders: row.completedStepOrders,
        completedAt: row.completedAt,
        lastOpenedAt: row.lastOpenedAt,
      },
    ]),
  ) as ProgressMap;
}

const publicCatalogInclude = Prisma.validator<Prisma.CourseLevelInclude>()({
  units: {
    where: { isPublished: true },
    orderBy: { order: "asc" },
    include: {
      lessons: {
        where: { isPublished: true },
        orderBy: { order: "asc" },
        include: {
          steps: {
            orderBy: { order: "asc" },
          },
        },
      },
    },
  },
});

type PublicCatalogLevel = Prisma.CourseLevelGetPayload<{
  include: typeof publicCatalogInclude;
}>;

function getUnitCompletion(unit: PublicCatalogLevel["units"][number], progressMap: ProgressMap) {
  const totalLessons = unit.lessons.length;
  const completedLessons = unit.lessons.filter(
    (lesson) => progressMap.get(lesson.id)?.completedAt,
  ).length;

  return {
    totalLessons,
    completedLessons,
    isComplete: totalLessons > 0 && completedLessons === totalLessons,
  };
}

function getCurrentLessonId(level: PublicCatalogLevel, progressMap: ProgressMap) {
  const startedLessons = level.units
    .flatMap((unit) => unit.lessons)
    .map((lesson) => ({
      lessonId: lesson.id,
      progress: progressMap.get(lesson.id),
    }))
    .filter((entry) => entry.progress)
    .sort(
      (left, right) =>
        (right.progress?.lastOpenedAt.getTime() ?? 0) - (left.progress?.lastOpenedAt.getTime() ?? 0),
    );

  if (startedLessons[0]?.lessonId) {
    return startedLessons[0].lessonId;
  }

  let previousUnitsComplete = true;
  for (const unit of level.units) {
    if (!previousUnitsComplete) {
      break;
    }

    const firstIncompleteLesson = unit.lessons.find(
      (lesson) => !progressMap.get(lesson.id)?.completedAt,
    );

    if (firstIncompleteLesson) {
      return firstIncompleteLesson.id;
    }

    previousUnitsComplete = getUnitCompletion(unit, progressMap).isComplete;
  }

  return null;
}

function getUnlockedUnitIds(level: PublicCatalogLevel, progressMap: ProgressMap) {
  const unlocked = new Set<string>();
  let canUnlockNext = true;

  for (const unit of level.units) {
    if (canUnlockNext) {
      unlocked.add(unit.id);
    }

    const completion = getUnitCompletion(unit, progressMap);
    canUnlockNext = canUnlockNext && completion.isComplete;
  }

  return unlocked;
}

export async function getCourseOverview(userId: string | null | undefined): Promise<CourseOverviewResponse> {
  await ensureCourseCatalog();

  const levels = await prisma.courseLevel.findMany({
    where: { slug: { in: activeCourseLevelSlugs } },
    orderBy: { number: "asc" },
    include: publicCatalogInclude,
  });
  const lessonIds = levels.flatMap((level) => level.units.flatMap((unit) => unit.lessons.map((lesson) => lesson.id)));
  const progressMap = await getProgressMap(userId, lessonIds);
  const vocabularyWordIdsByLessonId = await getCourseLessonVocabularyLinks(lessonIds);
  const learningStats = await getCourseLearningStats(userId);
  const viewer = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          coursePlacementLevelNumber: true,
          coursePlacementLevelSlug: true,
          coursePlacementCompletedAt: true,
        },
      })
    : null;
  const continueCandidate = [...progressMap.values()].sort(
    (left, right) => right.lastOpenedAt.getTime() - left.lastOpenedAt.getTime(),
  )[0];
  const progressedLevel = continueCandidate
    ? levels.find((level) =>
        level.units.some((unit) =>
          unit.lessons.some((lesson) => lesson.id === continueCandidate.lessonId),
        ),
      )
    : null;
  const coursePlacement =
    viewer?.coursePlacementCompletedAt &&
    viewer.coursePlacementLevelNumber &&
    viewer.coursePlacementLevelSlug
      ? createCompletedCoursePlacementState(
          {
            recommendedLevelNumber: viewer.coursePlacementLevelNumber,
            recommendedLevelSlug: viewer.coursePlacementLevelSlug,
          },
          viewer.coursePlacementCompletedAt,
        )
      : viewer && continueCandidate
        ? createCompletedCoursePlacementState(
            {
              recommendedLevelNumber: progressedLevel?.number ?? 1,
              recommendedLevelSlug: progressedLevel?.slug ?? "starter",
            },
            continueCandidate.lastOpenedAt,
          )
      : createEmptyCoursePlacementState();

  const overviewLevels = levels.map((level) => {
    const levelLessonIds = level.units.flatMap((unit) => unit.lessons.map((lesson) => lesson.id));
    const completedLevelLessonIds = levelLessonIds.filter((lessonId) => progressMap.get(lessonId)?.completedAt);
    const totalLessons = level.units.reduce((sum, unit) => sum + unit.lessons.length, 0);
    const completedLessons = level.units.reduce(
      (sum, unit) => sum + unit.lessons.filter((lesson) => progressMap.get(lesson.id)?.completedAt).length,
      0,
    );
    const vocabularyWordsCount = countUniqueVocabularyWordsForLessons(levelLessonIds, vocabularyWordIdsByLessonId);
    const learnedVocabularyWordsCount = countUniqueVocabularyWordsForLessons(
      completedLevelLessonIds,
      vocabularyWordIdsByLessonId,
    );

    const currentLessonId = getCurrentLessonId(level, progressMap);
    const currentUnit = level.units.find((unit) => unit.lessons.some((lesson) => lesson.id === currentLessonId));
    const currentLesson = currentUnit?.lessons.find((lesson) => lesson.id === currentLessonId) ?? null;

    return {
      id: level.id,
      number: level.number,
      slug: level.slug,
      title: getCanonicalCourseLevelTitle(level.number, level.title),
      description: level.description,
      accentColor: level.accentColor,
      progressPercent: percent(completedLessons, totalLessons),
      completedLessons,
      totalLessons,
      vocabularyWordsCount,
      learnedVocabularyWordsCount,
      isUnlocked: true,
      currentUnitTitle: currentUnit?.title ?? level.units[0]?.title ?? null,
      currentLessonTitle: currentLesson?.title ?? level.units[0]?.lessons[0]?.title ?? null,
    };
  });

  const fallbackLesson = levels[0]?.units[0]?.lessons[0];
  const fallbackLevel = levels[0];
  const fallbackUnit = levels[0]?.units[0];
  const continueLesson = continueCandidate
    ? (() => {
        const level = levels.find((item) => item.units.some((unit) => unit.lessons.some((lesson) => lesson.id === continueCandidate.lessonId)));
        const unit = level?.units.find((item) => item.lessons.some((lesson) => lesson.id === continueCandidate.lessonId));
        const lesson = unit?.lessons.find((item) => item.id === continueCandidate.lessonId);

        if (!level || !unit || !lesson) {
          return null;
        }

        const nextStepOrder = getNextUnlockedStepOrder(
          lesson.steps.length,
          continueCandidate.completedStepOrders,
          continueCandidate.completedAt,
        );
        const nextStep = lesson.steps.find((step) => step.order === nextStepOrder) ?? lesson.steps[0];

        return {
          levelSlug: level.slug,
          unitSlug: unit.slug,
          lessonSlug: lesson.slug,
          levelTitle: getCanonicalCourseLevelTitle(level.number, level.title),
          unitTitle: unit.title,
          lessonTitle: lesson.title,
          nextStepLabel: nextStep ? getStepLabel(nextStep.type as CourseStepTypeView) : "Урок",
          completionPercent: percent(continueCandidate.completedStepOrders.length, lesson.steps.length),
        };
      })()
    : fallbackLesson && fallbackLevel && fallbackUnit
      ? {
          levelSlug: fallbackLevel.slug,
          unitSlug: fallbackUnit.slug,
          lessonSlug: fallbackLesson.slug,
          levelTitle: getCanonicalCourseLevelTitle(fallbackLevel.number, fallbackLevel.title),
          unitTitle: fallbackUnit.title,
          lessonTitle: fallbackLesson.title,
          nextStepLabel: "Грамматика",
          completionPercent: 0,
        }
      : null;

  return {
    viewer: {
      isAuthenticated: Boolean(viewer),
      canPersistProgress: Boolean(viewer),
      name: viewer?.name ?? null,
      coursePlacement,
    },
    learningStats,
    continueLesson,
    levels: overviewLevels,
  };
}

export async function getCourseRoadmap(levelSlug: string, userId: string | null | undefined) {
  await ensureCourseCatalog();

  if (!isActiveCourseLevelSlug(levelSlug)) {
    return null;
  }

  const level = await prisma.courseLevel.findUnique({
    where: { slug: levelSlug },
    include: publicCatalogInclude,
  });

  if (!level) {
    return null;
  }

  const lessonIds = level.units.flatMap((unit) => unit.lessons.map((lesson) => lesson.id));
  const progressMap = await getProgressMap(userId, lessonIds);
  const vocabularyWordIdsByLessonId = await getCourseLessonVocabularyLinks(lessonIds);
  const unlockedUnitIds = getUnlockedUnitIds(level, progressMap);
  const currentLessonId = getCurrentLessonId(level, progressMap);
  const completedLessonIds = lessonIds.filter((lessonId) => progressMap.get(lessonId)?.completedAt);
  const vocabularyWordsCount = countUniqueVocabularyWordsForLessons(lessonIds, vocabularyWordIdsByLessonId);
  const learnedVocabularyWordsCount = countUniqueVocabularyWordsForLessons(
    completedLessonIds,
    vocabularyWordIdsByLessonId,
  );

  const completedLessons = level.units.reduce(
    (sum, unit) => sum + unit.lessons.filter((lesson) => progressMap.get(lesson.id)?.completedAt).length,
    0,
  );
  const totalLessons = level.units.reduce((sum, unit) => sum + unit.lessons.length, 0);

  const units = level.units.map((unit) => {
    const unitCompletion = getUnitCompletion(unit, progressMap);
    const isLocked = !unlockedUnitIds.has(unit.id);
    const lessons = unit.lessons.map((lesson) => {
      const progress = progressMap.get(lesson.id);
      const state: CourseNodeState = isLocked
        ? "locked"
        : progress?.completedAt
          ? "completed"
          : currentLessonId === lesson.id
            ? "current"
            : "available";

      return {
        id: lesson.id,
        slug: lesson.slug,
        title: lesson.title,
        summary: lesson.summary,
        order: lesson.order,
        estimatedMinutes: lesson.estimatedMinutes,
        mode: lesson.mode,
        kind: getCourseLessonKind(lesson),
        completedSteps: progress?.completedStepOrders.length ?? 0,
        totalSteps: lesson.steps.length,
        state,
      };
    });

    return {
      id: unit.id,
      slug: unit.slug,
      title: unit.title,
      description: unit.description,
      order: unit.order,
      isLocked,
      completedLessons: unitCompletion.completedLessons,
      totalLessons: unitCompletion.totalLessons,
      lessons,
    };
  });

  return {
    viewer: {
      isAuthenticated: Boolean(userId),
      canPersistProgress: Boolean(userId),
    },
    level: {
      id: level.id,
      number: level.number,
      slug: level.slug,
      title: getCanonicalCourseLevelTitle(level.number, level.title),
      description: level.description,
      accentColor: level.accentColor,
      progressPercent: percent(completedLessons, totalLessons),
      completedLessons,
      totalLessons,
      vocabularyWordsCount,
      learnedVocabularyWordsCount,
    },
    units,
  } satisfies CourseRoadmapResponse;
}

export async function getCourseLesson(
  levelSlug: string,
  lessonSlug: string,
  userId: string | null | undefined,
  unitSlug?: string | null,
) {
  await ensureCourseCatalog();

  if (!isActiveCourseLevelSlug(levelSlug)) {
    return null;
  }

  const level = await prisma.courseLevel.findUnique({
    where: { slug: levelSlug },
    include: publicCatalogInclude,
  });

  if (!level) {
    return null;
  }

  const unit = level.units.find(
    (item) =>
      (!unitSlug || item.slug === unitSlug) &&
      item.lessons.some((lesson) => lesson.slug === lessonSlug),
  );
  const lesson = unit?.lessons.find((item) => item.slug === lessonSlug);

  if (!unit || !lesson) {
    return null;
  }

  const lessonIds = level.units.flatMap((item) => item.lessons.map((lessonItem) => lessonItem.id));
  const progressMap = await getProgressMap(userId, lessonIds);
  const unlockedUnitIds = getUnlockedUnitIds(level, progressMap);
  const isUnitLocked = !unlockedUnitIds.has(unit.id);
  const lessonProgress = progressMap.get(lesson.id);
  const completedOrders = dedupeStepOrders(
    lessonProgress?.completedStepOrders ?? [],
    lesson.steps.length,
  );
  const currentStepOrder = Math.min(
    lesson.steps.length,
    lessonProgress?.currentStepOrder ??
      getNextUnlockedStepOrder(lesson.steps.length, completedOrders, lessonProgress?.completedAt ?? null),
  );
  const currentLessonId = getCurrentLessonId(level, progressMap);
  const vocabularyWords = await getCourseLessonVocabularyWords(lesson.id);
  const vocabularyDistractorWords = await getCourseLessonVocabularyDistractorWords(vocabularyWords);

  const steps = lesson.steps.map((step) => ({
    id: step.id,
    order: step.order,
    type: step.type,
    title: step.title,
    content: step.content,
    imageUrl: step.imageUrl,
    state: isUnitLocked
      ? "locked"
      : getStepState(
          lesson.steps.length,
          step.order,
          currentStepOrder,
          completedOrders,
          lessonProgress?.completedAt ?? null,
        ),
    isCompleted: completedOrders.includes(step.order),
  }));

  const flattenedLessons = level.units.flatMap((item) => item.lessons.map((lessonItem) => ({
    unit: item,
    lesson: lessonItem,
  })));
  const currentIndex = flattenedLessons.findIndex((item) => item.lesson.id === lesson.id);
  const nextLesson = flattenedLessons.slice(currentIndex + 1).find((item) => {
    if (!unlockedUnitIds.has(item.unit.id)) {
      return false;
    }

    return true;
  });

  return {
    viewer: {
      isAuthenticated: Boolean(userId),
      canPersistProgress: Boolean(userId),
    },
    level: {
      id: level.id,
      number: level.number,
      slug: level.slug,
      title: getCanonicalCourseLevelTitle(level.number, level.title),
      accentColor: level.accentColor,
    },
    unit: {
      id: unit.id,
      slug: unit.slug,
      title: unit.title,
      order: unit.order,
    },
    lesson: {
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      summary: lesson.summary,
      imageUrl: lesson.imageUrl,
      estimatedMinutes: lesson.estimatedMinutes,
      mode: lesson.mode,
      kind: getCourseLessonKind(lesson),
      state: isUnitLocked
        ? "locked"
        : lessonProgress?.completedAt
          ? "completed"
          : currentLessonId === lesson.id
            ? "current"
            : "available",
      progressPercent: percent(completedOrders.length, lesson.steps.length),
      completedStepsCount: completedOrders.length,
      totalSteps: lesson.steps.length,
      nextLesson: nextLesson
          ? {
            levelSlug,
            unitSlug: nextLesson.unit.slug,
            lessonSlug: nextLesson.lesson.slug,
            title: nextLesson.lesson.title,
          }
        : null,
      vocabularyWords,
      vocabularyDistractorWords,
      steps,
    },
  } satisfies CourseLessonResponse;
}

export async function updateCourseLessonProgress(
  userId: string,
  lessonId: string,
  stepOrder: number,
  action: "open" | "complete" | "restart",
) {
  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    include: {
      steps: {
        orderBy: { order: "asc" },
      },
      unit: {
        include: {
          level: true,
        },
      },
    },
  });

  if (!lesson) {
    throw new Error("Урок не найден.");
  }

  if (action !== "restart" && (stepOrder <= 0 || stepOrder > lesson.steps.length)) {
    throw new Error("Передан некорректный номер шага.");
  }

  const level = await prisma.courseLevel.findUnique({
    where: { id: lesson.unit.levelId },
    include: publicCatalogInclude,
  });

  if (!level) {
    throw new Error("Уровень не найден.");
  }

  const lessonIds = level.units.flatMap((unit) => unit.lessons.map((item) => item.id));
  const progressMap = await getProgressMap(userId, lessonIds);
  const unlockedUnitIds = getUnlockedUnitIds(level, progressMap);
  if (!unlockedUnitIds.has(lesson.unitId)) {
    throw new Error("Сначала завершите предыдущий юнит.");
  }

  const existing = progressMap.get(lesson.id);

  if (action === "restart") {
    await prisma.courseLessonProgress.upsert({
      where: {
        userId_lessonId: {
          userId,
          lessonId,
        },
      },
      update: {
        currentStepOrder: 1,
        completedStepOrders: [],
        completedAt: null,
        lastOpenedAt: new Date(),
      },
      create: {
        userId,
        lessonId,
        currentStepOrder: 1,
        completedStepOrders: [],
        completedAt: null,
        lastOpenedAt: new Date(),
      },
    });

    const restartedLesson = await getCourseLesson(
      lesson.unit.level.slug,
      lesson.slug,
      userId,
      lesson.unit.slug,
    );
    if (!restartedLesson) {
      throw new Error("Не удалось перезапустить урок.");
    }

    return {
      lesson: restartedLesson.lesson,
    } satisfies CourseProgressResponse;
  }

  const completedOrders = dedupeStepOrders(existing?.completedStepOrders ?? [], lesson.steps.length);
  const completedAt = existing?.completedAt ?? null;
  const unlockedStepOrder = getNextUnlockedStepOrder(lesson.steps.length, completedOrders, completedAt);
  const isAlreadyCompleted = completedOrders.includes(stepOrder);

  if (!isAlreadyCompleted && stepOrder > unlockedStepOrder) {
    throw new Error("Сначала завершите предыдущий шаг.");
  }

  const nextCompletedOrders =
    action === "complete" && !isAlreadyCompleted
      ? dedupeStepOrders([...completedOrders, stepOrder], lesson.steps.length)
      : completedOrders;
  const nextPrefix = getCompletedPrefix(nextCompletedOrders);
  const isCompleted = nextPrefix === lesson.steps.length;
  const nextCurrentStepOrder = isCompleted ? lesson.steps.length : Math.min(lesson.steps.length, nextPrefix + 1);

  await prisma.courseLessonProgress.upsert({
    where: {
      userId_lessonId: {
        userId,
        lessonId,
      },
    },
    update: {
      currentStepOrder: action === "open" ? stepOrder : nextCurrentStepOrder,
      completedStepOrders: nextCompletedOrders,
      completedAt: isCompleted ? existing?.completedAt ?? new Date() : null,
      lastOpenedAt: new Date(),
    },
    create: {
      userId,
      lessonId,
      currentStepOrder: action === "open" ? stepOrder : nextCurrentStepOrder,
      completedStepOrders: nextCompletedOrders,
      completedAt: isCompleted ? new Date() : null,
      lastOpenedAt: new Date(),
    },
  });

  if (action === "complete" && isCompleted) {
    await unlockLessonVocabularyWords(userId, lessonId);
  }

  const nextLesson = await getCourseLesson(
    lesson.unit.level.slug,
    lesson.slug,
    userId,
    lesson.unit.slug,
  );
  if (!nextLesson) {
    throw new Error("Не удалось заново загрузить прогресс урока.");
  }

  return {
    lesson: nextLesson.lesson,
  } satisfies CourseProgressResponse;
}

const adminCatalogInclude = Prisma.validator<Prisma.CourseLevelInclude>()({
  units: {
    orderBy: { order: "asc" },
    include: {
      lessons: {
        orderBy: { order: "asc" },
        include: {
          steps: {
            orderBy: { order: "asc" },
          },
        },
      },
    },
  },
});

type AdminCatalogLevelDb = Prisma.CourseLevelGetPayload<{
  include: typeof adminCatalogInclude;
}>;

function mapAdminLevel(
  level: AdminCatalogLevelDb,
  vocabularyWordIdsByLessonId = new Map<string, string[]>(),
): AdminCourseLevel {
  return {
    id: level.id,
    number: level.number,
    slug: level.slug,
    title: getCanonicalCourseLevelTitle(level.number, level.title),
    description: level.description ?? "",
    accentColor: level.accentColor,
    units: level.units.map((unit) => ({
      id: unit.id,
      slug: unit.slug,
      title: unit.title,
      description: unit.description ?? "",
      imageUrl: unit.imageUrl,
      isPublished: unit.isPublished,
      lessons: unit.lessons.map((lesson) => ({
        id: lesson.id,
        slug: lesson.slug,
        title: lesson.title,
        summary: lesson.summary ?? "",
        imageUrl: lesson.imageUrl,
        estimatedMinutes: lesson.estimatedMinutes,
        mode: lesson.mode,
        kind: getCourseLessonKind(lesson),
        vocabularyWordIds: vocabularyWordIdsByLessonId.get(lesson.id) ?? [],
        isPublished: lesson.isPublished,
        steps: lesson.steps.map((step) => ({
          id: step.id,
          type: step.type,
          title: step.title,
          content: step.content,
          imageUrl: step.imageUrl,
        })),
      })),
    })),
  };
}

function mapAdminLevelSummary(level: AdminCatalogLevelDb): AdminCourseLevelSummary {
  return {
    id: level.id,
    number: level.number,
    slug: level.slug,
    title: getCanonicalCourseLevelTitle(level.number, level.title),
    description: level.description ?? "",
    accentColor: level.accentColor,
    unitsCount: level.units.length,
    lessonsCount: level.units.reduce((sum, unit) => sum + unit.lessons.length, 0),
  };
}

function normalizeAdminLevel(level: AdminCourseLevel) {
  const title = level.title.trim();
  if (title.length < 2) {
    throw new Error(`Название уровня ${level.number} слишком короткое.`);
  }

  const unitSlugSet = new Set<string>();

  const normalizedUnits = level.units.map((unit, unitIndex) => {
    const unitTitle = unit.title.trim();
    if (unitTitle.length < 2) {
      throw new Error(`Для юнита ${unitIndex + 1} в уровне «${title}» нужно более длинное название.`);
    }

    if (unit.lessons.length === 0) {
      throw new Error(`Юнит «${unitTitle}» должен содержать хотя бы один урок.`);
    }

    const lessonSlugSet = new Set<string>();
    const normalizedLessons = unit.lessons.map((lesson, lessonIndex) => {
      const lessonTitle = lesson.title.trim();
      if (lessonTitle.length < 2) {
        throw new Error(`Для урока ${lessonIndex + 1} в юните «${unitTitle}» нужно более длинное название.`);
      }

      if (lesson.steps.length === 0) {
        throw new Error(`Урок «${lessonTitle}» должен содержать хотя бы один шаг.`);
      }

      if (lesson.mode === "STANDARD") {
        normalizeStandardSteps(lesson.steps);
      }

      const lessonSlug = makeUniqueSlug(lesson.slug || lessonTitle, lessonSlugSet);
      lessonSlugSet.add(lessonSlug);

      return {
        id: lesson.id,
        slug: lessonSlug,
        title: lessonTitle,
        summary: lesson.summary.trim(),
        imageUrl: lesson.imageUrl?.trim() || null,
        estimatedMinutes: Math.max(1, Math.floor(lesson.estimatedMinutes || 1)),
        mode: lesson.mode,
        kind: normalizeCourseLessonKind(lesson.kind),
        vocabularyWordIds: normalizeVocabularyWordIds(lesson.vocabularyWordIds),
        isPublished: Boolean(lesson.isPublished),
        steps: lesson.steps.map((step, stepIndex) => {
          const stepTitle = step.title.trim() || `${getStepLabel(step.type)} ${stepIndex + 1}`;
          return {
            id: step.id,
            type: step.type,
            title: stepTitle,
            content: step.content.trim(),
            imageUrl: step.imageUrl?.trim() || null,
          };
        }),
      };
    });

    const unitSlug = makeUniqueSlug(unit.slug || unitTitle, unitSlugSet);
    unitSlugSet.add(unitSlug);

    return {
      id: unit.id,
      slug: unitSlug,
      title: unitTitle,
      description: unit.description.trim(),
      imageUrl: null,
      isPublished: Boolean(unit.isPublished),
      lessons: normalizedLessons,
    };
  });

  return {
    id: level.id,
    number: level.number,
    slug: slugify(level.slug || title),
    title,
    description: level.description.trim(),
    accentColor: level.accentColor.trim() || "#5a6cff",
    units: normalizedUnits,
  };
}

function normalizeAdminLevels(levels: AdminCourseLevel[]) {
  if (levels.length !== COURSE_LEVEL_BLUEPRINTS.length) {
    throw new Error("Конструктор курсов ожидает все 6 уровней.");
  }

  return levels.map((level) => normalizeAdminLevel(level));
}

export async function getAdminCourseCatalog() {
  await ensureCourseCatalog();

  const levels = await prisma.courseLevel.findMany({
    where: { slug: { in: activeCourseLevelSlugs } },
    orderBy: { number: "asc" },
    include: adminCatalogInclude,
  });
  const lessonIds = levels.flatMap((level) => level.units.flatMap((unit) => unit.lessons.map((lesson) => lesson.id)));
  const vocabularyWordIdsByLessonId = await getCourseLessonVocabularyLinks(lessonIds);

  return {
    levels: levels.map((level) => mapAdminLevel(level as AdminCatalogLevelDb, vocabularyWordIdsByLessonId)),
  } satisfies AdminCourseCatalogResponse;
}

export async function getAdminCourseLevelsIndex() {
  await ensureCourseCatalog();

  const levels = await prisma.courseLevel.findMany({
    where: { slug: { in: activeCourseLevelSlugs } },
    orderBy: { number: "asc" },
    include: adminCatalogInclude,
  });

  return {
    levels: levels.map((level) => mapAdminLevelSummary(level as AdminCatalogLevelDb)),
  } satisfies AdminCourseLevelsIndexResponse;
}

export async function getAdminCourseLevel(levelId: string) {
  await ensureCourseCatalog();

  const level = await prisma.courseLevel.findUnique({
    where: { id: levelId },
    include: adminCatalogInclude,
  });

  if (!level) {
    throw new Error("Уровень не найден.");
  }

  if (!isActiveCourseLevelSlug(level.slug)) {
    throw new Error("Уровень больше не используется.");
  }
  const lessonIds = level.units.flatMap((unit) => unit.lessons.map((lesson) => lesson.id));
  const vocabularyWordIdsByLessonId = await getCourseLessonVocabularyLinks(lessonIds);

  return {
    level: mapAdminLevel(level as AdminCatalogLevelDb, vocabularyWordIdsByLessonId),
  } satisfies AdminCourseLevelResponse;
}

async function syncSteps(
  tx: Prisma.TransactionClient,
  lessonId: string,
  steps: ReturnType<typeof normalizeAdminLevels>[number]["units"][number]["lessons"][number]["steps"],
) {
  const existingSteps = await tx.courseLessonStep.findMany({
    where: { lessonId },
    select: { id: true, order: true },
  });

  const incomingExistingIds = new Set(steps.map((step) => step.id).filter(Boolean) as string[]);
  const staleIds = existingSteps
    .filter((step) => !incomingExistingIds.has(step.id))
    .map((step) => step.id);

  if (staleIds.length > 0) {
    await tx.courseLessonStep.deleteMany({
      where: { id: { in: staleIds } },
    });
  }

  for (const [stepIndex, step] of steps.entries()) {
    if (!step.id) {
      continue;
    }

    await tx.courseLessonStep.update({
      where: { id: step.id },
      data: {
        order: 1000 + stepIndex + 1,
      },
    });
  }

  for (const [stepIndex, step] of steps.entries()) {
    if (step.id) {
      await tx.courseLessonStep.update({
        where: { id: step.id },
        data: {
          order: stepIndex + 1,
          type: step.type as CourseStepType,
          title: step.title,
          content: step.content,
          imageUrl: step.imageUrl,
        },
      });
      continue;
    }

    await tx.courseLessonStep.create({
      data: {
        lessonId,
        order: stepIndex + 1,
        type: step.type as CourseStepType,
        title: step.title,
        content: step.content,
        imageUrl: step.imageUrl,
      },
      select: { id: true },
    });
  }
}

async function syncLessonVocabularyWords(
  tx: Prisma.TransactionClient,
  lessonId: string,
  wordIds: string[],
) {
  const normalizedWordIds = normalizeVocabularyWordIds(wordIds);

  await tx.$executeRaw`
    DELETE FROM "CourseLessonVocabularyWord"
    WHERE "lessonId" = ${lessonId}
  `;

  for (const [index, wordId] of normalizedWordIds.entries()) {
    await tx.$executeRaw`
      INSERT INTO "CourseLessonVocabularyWord" ("id", "lessonId", "wordId", "order", "createdAt")
      SELECT ${createCourseVocabularyLinkId()}, ${lessonId}, w."id", ${index + 1}, NOW()
      FROM "VocabularyWord" w
      WHERE w."id" = ${wordId}
      ON CONFLICT ("lessonId", "wordId") DO NOTHING
    `;
  }
}

async function syncLessons(
  tx: Prisma.TransactionClient,
  unitId: string,
  lessons: ReturnType<typeof normalizeAdminLevels>[number]["units"][number]["lessons"],
) {
  const existingLessons = await tx.courseLesson.findMany({
    where: { unitId },
    select: { id: true, order: true },
  });

  const incomingExistingIds = new Set(lessons.map((lesson) => lesson.id).filter(Boolean) as string[]);
  const staleIds = existingLessons
    .filter((lesson) => !incomingExistingIds.has(lesson.id))
    .map((lesson) => lesson.id);

  if (staleIds.length > 0) {
    await tx.courseLesson.deleteMany({
      where: { id: { in: staleIds } },
    });
  }

  for (const [lessonIndex, lesson] of lessons.entries()) {
    if (!lesson.id) {
      continue;
    }

    await tx.courseLesson.update({
      where: { id: lesson.id },
      data: {
        slug: `__tmp__${lesson.id}`,
        order: 1000 + lessonIndex + 1,
      },
    });
  }

  for (const [lessonIndex, lesson] of lessons.entries()) {
    if (lesson.id) {
      await tx.courseLesson.update({
        where: { id: lesson.id },
        data: {
          slug: lesson.slug,
          order: lessonIndex + 1,
          title: lesson.title,
          summary: lesson.summary,
          imageUrl: lesson.imageUrl,
          estimatedMinutes: lesson.estimatedMinutes,
          mode: lesson.mode as CourseLessonMode,
          ...courseLessonKindData(lesson.kind),
          isPublished: lesson.isPublished,
        },
      });
      await syncSteps(tx, lesson.id, lesson.steps);
      await syncLessonVocabularyWords(tx, lesson.id, lesson.vocabularyWordIds);
      continue;
    }

    const created = await tx.courseLesson.create({
      data: {
        unitId,
        slug: lesson.slug,
        order: lessonIndex + 1,
        title: lesson.title,
        summary: lesson.summary,
        imageUrl: lesson.imageUrl,
        estimatedMinutes: lesson.estimatedMinutes,
        mode: lesson.mode as CourseLessonMode,
        ...courseLessonKindData(lesson.kind),
        isPublished: lesson.isPublished,
      },
      select: { id: true },
    });
    await syncSteps(tx, created.id, lesson.steps);
    await syncLessonVocabularyWords(tx, created.id, lesson.vocabularyWordIds);
  }
}

async function syncUnits(
  tx: Prisma.TransactionClient,
  levelId: string,
  units: ReturnType<typeof normalizeAdminLevels>[number]["units"],
) {
  const existingUnits = await tx.courseUnit.findMany({
    where: { levelId },
    select: { id: true, order: true },
  });

  const incomingExistingIds = new Set(units.map((unit) => unit.id).filter(Boolean) as string[]);
  const staleIds = existingUnits
    .filter((unit) => !incomingExistingIds.has(unit.id))
    .map((unit) => unit.id);

  if (staleIds.length > 0) {
    await tx.courseUnit.deleteMany({
      where: { id: { in: staleIds } },
    });
  }

  for (const [unitIndex, unit] of units.entries()) {
    if (!unit.id) {
      continue;
    }

    await tx.courseUnit.update({
      where: { id: unit.id },
      data: {
        slug: `__tmp__${unit.id}`,
        order: 1000 + unitIndex + 1,
      },
    });
  }

  for (const [unitIndex, unit] of units.entries()) {
    if (unit.id) {
      await tx.courseUnit.update({
        where: { id: unit.id },
        data: {
          slug: unit.slug,
          order: unitIndex + 1,
          title: unit.title,
          description: unit.description,
          imageUrl: unit.imageUrl,
          isPublished: unit.isPublished,
        },
      });
      await syncLessons(tx, unit.id, unit.lessons);
      continue;
    }

    const created = await tx.courseUnit.create({
      data: {
        levelId,
        slug: unit.slug,
        order: unitIndex + 1,
        title: unit.title,
        description: unit.description,
        imageUrl: unit.imageUrl,
        isPublished: unit.isPublished,
      },
      select: { id: true },
    });
    await syncLessons(tx, created.id, unit.lessons);
  }
}

export async function saveAdminCourseCatalog(levels: AdminCourseLevel[]) {
  await ensureCourseCatalog();

  const normalized = normalizeAdminLevels(levels);
  const previousLevels = await prisma.courseLevel.findMany({
    where: { slug: { in: activeCourseLevelSlugs } },
    orderBy: { number: "asc" },
    include: adminCatalogInclude,
  });
  const previousImageUrls = collectManagedCourseImageUrls(previousLevels as AdminCatalogLevelDb[]);
  const persisted = await persistCourseImagesForLevels(normalized);

  try {
    await prisma.$transaction(
      async (tx) => {
        for (const level of persisted.levels) {
          await tx.courseLevel.update({
            where: { id: level.id },
            data: {
              number: level.number,
              slug: level.slug,
              title: level.title,
              description: level.description,
              accentColor: level.accentColor,
            },
          });
          await syncUnits(tx, level.id, level.units);
        }
      },
      {
        maxWait: 10_000,
        timeout: 60_000,
      },
    );
  } catch (error) {
    await Promise.allSettled(
      persisted.savedUrls.map((url) => removeCourseImageIfManaged(url)),
    );
    throw error;
  }

  const nextImageUrls = collectManagedCourseImageUrls(persisted.levels);
  const staleUrls = [...previousImageUrls].filter((url) => !nextImageUrls.has(url));
  await Promise.allSettled(staleUrls.map((url) => removeCourseImageIfManaged(url)));

  return {
    ok: true,
  } satisfies AdminCourseCatalogResponse;
}

export async function saveAdminCourseLevel(level: AdminCourseLevel) {
  await ensureCourseCatalog();

  const normalized = normalizeAdminLevel(level);
  const previousLevel = await prisma.courseLevel.findUnique({
    where: { id: normalized.id },
    include: adminCatalogInclude,
  });

  if (!previousLevel) {
    throw new Error("Уровень не найден.");
  }

  if (!isActiveCourseLevelSlug(previousLevel.slug)) {
    throw new Error("Уровень больше не используется.");
  }

  const previousImageUrls = collectManagedCourseImageUrls([previousLevel as AdminCatalogLevelDb]);
  const persisted = await persistCourseImagesForLevels([normalized]);
  const nextLevel = persisted.levels[0];

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.courseLevel.update({
          where: { id: nextLevel.id },
          data: {
            number: nextLevel.number,
            slug: nextLevel.slug,
            title: nextLevel.title,
            description: nextLevel.description,
            accentColor: nextLevel.accentColor,
          },
        });
        await syncUnits(tx, nextLevel.id, nextLevel.units);
      },
      {
        maxWait: 10_000,
        timeout: 60_000,
      },
    );
  } catch (error) {
    await Promise.allSettled(
      persisted.savedUrls.map((url) => removeCourseImageIfManaged(url)),
    );
    throw error;
  }

  const nextImageUrls = collectManagedCourseImageUrls([nextLevel]);
  const staleUrls = [...previousImageUrls].filter((url) => !nextImageUrls.has(url));
  await Promise.allSettled(staleUrls.map((url) => removeCourseImageIfManaged(url)));

  return {
    ok: true,
    level: nextLevel,
  } satisfies AdminCourseLevelResponse;
}

function lessonMediaEnvelope<TLesson extends { imageUrl: string | null; steps: Array<{ imageUrl: string | null; content: string }> }>(
  levelSlug: string,
  unitSlug: string,
  lesson: TLesson,
) {
  return [
    {
      slug: levelSlug,
      units: [
        {
          slug: unitSlug,
          imageUrl: null,
          lessons: [lesson],
        },
      ],
    },
  ];
}

export async function saveAdminCourseLesson(
  levelId: string,
  unitId: string,
  lesson: AdminCourseLesson,
) {
  await ensureCourseCatalog();

  const level = await prisma.courseLevel.findUnique({
    where: { id: levelId },
    select: {
      id: true,
      number: true,
      slug: true,
      title: true,
      description: true,
      accentColor: true,
    },
  });
  if (!level || !isActiveCourseLevelSlug(level.slug)) {
    throw new Error("Уровень не найден или больше не используется.");
  }

  const unit = await prisma.courseUnit.findFirst({
    where: { id: unitId, levelId },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      isPublished: true,
    },
  });
  if (!unit) {
    throw new Error("Сначала сохраните структуру уровня, чтобы создать этот юнит.");
  }

  const normalizedLesson = normalizeAdminLevel({
    id: level.id,
    number: level.number,
    slug: level.slug,
    title: level.title,
    description: level.description ?? "",
    accentColor: level.accentColor,
    units: [
      {
        id: unit.id,
        slug: unit.slug,
        title: unit.title,
        description: unit.description ?? "",
        imageUrl: null,
        isPublished: unit.isPublished,
        lessons: [lesson],
      },
    ],
  }).units[0].lessons[0];

  const previousLesson = normalizedLesson.id
    ? await prisma.courseLesson.findFirst({
        where: { id: normalizedLesson.id, unitId: unit.id },
        include: { steps: { orderBy: { order: "asc" } } },
      })
    : null;
  if (normalizedLesson.id && !previousLesson) {
    throw new Error("Урок не найден в выбранном юните.");
  }

  const previousImageUrls = previousLesson
    ? collectManagedCourseImageUrls(
        lessonMediaEnvelope(level.slug, unit.slug, previousLesson),
      )
    : new Set<string>();
  const persisted = await persistCourseImagesForLevels(
    lessonMediaEnvelope(level.slug, unit.slug, normalizedLesson),
  );
  const nextLesson = persisted.levels[0].units[0].lessons[0];

  let savedLessonId = nextLesson.id ?? "";
  try {
    savedLessonId = await prisma.$transaction(
      async (tx) => {
        if (nextLesson.id) {
          await tx.courseLesson.update({
            where: { id: nextLesson.id },
            data: {
              slug: nextLesson.slug,
              title: nextLesson.title,
              summary: nextLesson.summary,
              imageUrl: nextLesson.imageUrl,
              estimatedMinutes: nextLesson.estimatedMinutes,
              mode: nextLesson.mode as CourseLessonMode,
              ...courseLessonKindData(nextLesson.kind),
              isPublished: nextLesson.isPublished,
            },
          });
          await syncSteps(tx, nextLesson.id, nextLesson.steps);
          await syncLessonVocabularyWords(tx, nextLesson.id, nextLesson.vocabularyWordIds);
          return nextLesson.id;
        }

        const lastLesson = await tx.courseLesson.findFirst({
          where: { unitId: unit.id },
          orderBy: { order: "desc" },
          select: { order: true },
        });
        const created = await tx.courseLesson.create({
          data: {
            unitId: unit.id,
            slug: nextLesson.slug,
            order: (lastLesson?.order ?? 0) + 1,
            title: nextLesson.title,
            summary: nextLesson.summary,
            imageUrl: nextLesson.imageUrl,
            estimatedMinutes: nextLesson.estimatedMinutes,
            mode: nextLesson.mode as CourseLessonMode,
            ...courseLessonKindData(nextLesson.kind),
            isPublished: nextLesson.isPublished,
          },
          select: { id: true },
        });
        await syncSteps(tx, created.id, nextLesson.steps);
        await syncLessonVocabularyWords(tx, created.id, nextLesson.vocabularyWordIds);
        return created.id;
      },
      {
        maxWait: 10_000,
        timeout: 60_000,
      },
    );
  } catch (error) {
    await Promise.allSettled(
      persisted.savedUrls.map((url) => removeCourseImageIfManaged(url)),
    );
    throw error;
  }

  const refreshed = await getAdminCourseLevel(levelId);
  const savedLesson = refreshed.level.units
    .flatMap((entryUnit) => entryUnit.lessons)
    .find((entryLesson) => entryLesson.id === savedLessonId);
  if (!savedLesson) {
    throw new Error("Урок сохранён, но не удалось обновить его в редакторе.");
  }

  const nextImageUrls = collectManagedCourseImageUrls(
    lessonMediaEnvelope(level.slug, unit.slug, savedLesson),
  );
  const staleUrls = [...previousImageUrls].filter((url) => !nextImageUrls.has(url));
  await Promise.allSettled(staleUrls.map((url) => removeCourseImageIfManaged(url)));

  return {
    ok: true,
    lesson: savedLesson,
  } satisfies AdminCourseLessonResponse;
}

export async function deleteAdminCourseLesson(
  levelId: string,
  unitId: string,
  lessonId: string,
) {
  await ensureCourseCatalog();

  const level = await prisma.courseLevel.findUnique({
    where: { id: levelId },
    select: { id: true, slug: true },
  });
  if (!level || !isActiveCourseLevelSlug(level.slug)) {
    throw new Error("Уровень не найден или больше не используется.");
  }

  const unit = await prisma.courseUnit.findFirst({
    where: { id: unitId, levelId },
    select: { id: true, slug: true },
  });
  if (!unit) {
    throw new Error("Юнит не найден в выбранном уровне.");
  }

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId, unitId },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  if (!lesson) {
    throw new Error("Урок уже удалён или не принадлежит выбранному юниту.");
  }

  const imageUrls = collectManagedCourseImageUrls(
    lessonMediaEnvelope(level.slug, unit.slug, lesson),
  );

  await prisma.$transaction(
    async (tx) => {
      await tx.courseLesson.delete({ where: { id: lesson.id } });

      const remainingLessons = await tx.courseLesson.findMany({
        where: { unitId },
        orderBy: { order: "asc" },
        select: { id: true },
      });

      for (const [index, remainingLesson] of remainingLessons.entries()) {
        await tx.courseLesson.update({
          where: { id: remainingLesson.id },
          data: { order: 1000 + index + 1 },
        });
      }

      for (const [index, remainingLesson] of remainingLessons.entries()) {
        await tx.courseLesson.update({
          where: { id: remainingLesson.id },
          data: { order: index + 1 },
        });
      }
    },
    {
      maxWait: 10_000,
      timeout: 60_000,
    },
  );

  await Promise.allSettled([...imageUrls].map((url) => removeCourseImageIfManaged(url)));

  return { ok: true, deletedLessonId: lesson.id };
}
