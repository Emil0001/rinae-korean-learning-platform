import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  getPlacementBandDescription,
  getVocabularyLevelDescription,
  mapPlacementBandToVocabularyLevel,
  nextReviewDate,
  resolvePlacementBand,
  toPlacementBandLabel,
  toVocabularyLabel,
  type VocabularyLevel,
  type VocabularyPlacementBand,
  type VocabularyPlacementDirection,
  type VocabularyReviewRating,
} from "@/lib/vocabulary";

type SqlClient = Pick<typeof prisma, "$queryRaw" | "$executeRaw">;

type VocabularyProfileRow = {
  id: string;
  userId: string;
  estimatedLevel: VocabularyLevel | null;
  placementScore: number | null;
  placementCompletedAt: Date | null;
  onboardingCompletedAt: Date | null;
  dailyGoal: number;
  streakDays: number;
  lastStudiedOn: Date | null;
};

type VocabularyWordRow = {
  id: string;
  korean: string;
  transcription: string | null;
  translation: string;
  exampleKorean: string | null;
  exampleRussian: string | null;
  category: string | null;
  level: VocabularyLevel;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type VocabularyReviewRow = {
  id: string;
  userId: string;
  wordId: string;
  reviewCount: number;
  knownCount: number;
  dontKnowCount: number;
  currentStreak: number;
  intervalDays: number;
  nextReviewAt: Date;
  lastReviewedAt: Date | null;
  lastRating: VocabularyReviewRating | null;
};

type VocabularyPlacementSessionRow = {
  id: string;
  userId: string;
  placementBand: VocabularyPlacementBand | null;
  detectedLevel: VocabularyLevel | null;
  score: number | null;
  correctAnswers: number | null;
  totalQuestions: number;
  questionsJson: string;
  startedAt: Date;
  completedAt: Date | null;
};

type SessionQueueRow = VocabularyWordRow & {
  reviewCount: number | null;
  knownCount: number | null;
  dontKnowCount: number | null;
  currentStreak: number | null;
  nextReviewAt: Date | null;
  lastRating: VocabularyReviewRating | null;
};

export type VocabularyCard = {
  id: string;
  korean: string;
  transcription: string | null;
  translation: string;
  exampleKorean: string | null;
  exampleRussian: string | null;
  category: string | null;
  level: VocabularyLevel;
  stats: {
    reviewCount: number;
    knownCount: number;
    dontKnowCount: number;
    currentStreak: number;
  };
};

export type PlacementQuestionOption = {
  id: string;
  wordId: string;
  text: string;
};

export type PlacementQuestion = {
  id: string;
  wordId: string;
  prompt: string;
  direction: VocabularyPlacementDirection;
  category: string | null;
  options: PlacementQuestionOption[];
  correctOptionId: string;
};

export type VocabularyPlacementSession = {
  placementSessionId: string;
  totalQuestions: number;
  questions: PlacementQuestion[];
};

export type VocabularySession = {
  onboardingRequired: boolean;
  placementRequired: boolean;
  profile: {
    estimatedLevel: VocabularyLevel | null;
    levelLabel: string | null;
    levelDescription: string | null;
    dailyGoal: number;
    streakDays: number;
    wordsLearnedToday: number;
    dueCount: number;
    masteredCount: number;
    totalActiveWords: number;
    learnedCount: number;
    newCount: number;
    dueReviewCount: number;
  };
  sprint: VocabularySprintSummary;
  placement: VocabularyPlacementSession | null;
  queue: VocabularyCard[];
  newWords: VocabularyCard[];
  reviewWords: VocabularyCard[];
  learnedWords: VocabularyLearnedCard[];
};

export type VocabularyLearnedCard = VocabularyCard & {
  status: "LEARNING" | "REVIEW" | "MASTERED";
  nextReviewAt: Date;
  lastRating: VocabularyReviewRating | null;
};

export type VocabularySprintSummary = {
  dailyLimit: number;
  playedToday: number;
  remainingToday: number;
  xpToday: number;
  totalXp: number;
  bestAccuracyToday: number | null;
};

export type VocabularySprintResult = {
  attemptId: string;
  correctPairs: number;
  mistakeCount: number;
  durationMs: number;
  accuracy: number;
  grade: "PERFECT" | "EXCELLENT" | "GOOD" | "PRACTICE";
  gradeLabel: string;
  xpEarned: number;
  sprint: VocabularySprintSummary;
};

export type PlacementAnswerInput = {
  questionId: string;
  selectedOptionId: string;
  responseTimeMs?: number | null;
};

export type PlacementResult = {
  placementSessionId: string;
  placementResult: {
    level: "starter" | "starter_plus" | "early_intermediate";
    score: number;
    correctAnswers: number;
    totalQuestions: number;
  };
  estimatedLevel: VocabularyLevel;
  levelLabel: string;
  levelDescription: string;
  placementBandLabel: string;
  placementBandDescription: string;
};

export type VocabularyWordInput = {
  korean: string;
  transcription?: string | null;
  translation: string;
  exampleKorean?: string | null;
  exampleRussian?: string | null;
  category?: string | null;
  level: VocabularyLevel;
  isActive: boolean;
};

const VALID_LEVELS: VocabularyLevel[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const VALID_RATINGS: VocabularyReviewRating[] = ["EASY", "HARD", "DONT_KNOW"];
const PLACEMENT_CATEGORY_ORDER = ["family", "home", "food", "time", "places", "body", "nature"];
const PLACEMENT_MIN_QUESTIONS = 8;
const PLACEMENT_MAX_QUESTIONS = 10;
const FAST_RESPONSE_MS = 2500;
const SPRINT_DAILY_LIMIT = 3;
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;

function createId() {
  return randomBytes(18).toString("hex");
}

function normalizeVocabularyIdentity(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU").replace(/\s+/g, " ");
}

async function ensureVocabularyWordIsUnique(korean: string, translation: string, excludedId?: string) {
  const candidates = await prisma.$queryRaw<Array<{ id: string; korean: string; translation: string }>>`
    SELECT "id", "korean", "translation"
    FROM "VocabularyWord"
    WHERE LOWER(TRIM("korean")) = LOWER(TRIM(${korean}))
  `;
  const normalizedTranslation = normalizeVocabularyIdentity(translation);
  const duplicate = candidates.find((word) => word.id !== excludedId && normalizeVocabularyIdentity(word.translation) === normalizedTranslation);
  if (duplicate) {
    throw new Error(`Сочетание «${korean} — ${translation}» уже есть в словаре.`);
  }
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getSeoulDayRange(now = new Date()) {
  const seoulTime = new Date(now.getTime() + SEOUL_OFFSET_MS);
  const start = new Date(
    Date.UTC(seoulTime.getUTCFullYear(), seoulTime.getUTCMonth(), seoulTime.getUTCDate()) -
      SEOUL_OFFSET_MS,
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function countToNumber(value: bigint | number | null | undefined) {
  return Number(value ?? 0);
}

function validateLevel(level: string): level is VocabularyLevel {
  return VALID_LEVELS.includes(level as VocabularyLevel);
}

function validateRating(rating: string): rating is VocabularyReviewRating {
  return VALID_RATINGS.includes(rating as VocabularyReviewRating);
}

function normalizeCategory(category: string | null | undefined) {
  return (category ?? "").trim().toLowerCase();
}

function shuffleArray<T>(items: T[]) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
  }

  return copy;
}

function toCard(row: SessionQueueRow): VocabularyCard {
  return {
    id: row.id,
    korean: row.korean,
    transcription: row.transcription,
    translation: row.translation,
    exampleKorean: row.exampleKorean,
    exampleRussian: row.exampleRussian,
    category: row.category,
    level: row.level,
    stats: {
      reviewCount: row.reviewCount ?? 0,
      knownCount: row.knownCount ?? 0,
      dontKnowCount: row.dontKnowCount ?? 0,
      currentStreak: row.currentStreak ?? 0,
    },
  };
}

function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isPreviousCalendarDay(left: Date, right: Date) {
  const leftDay = new Date(left.getFullYear(), left.getMonth(), left.getDate()).getTime();
  const rightDay = new Date(right.getFullYear(), right.getMonth(), right.getDate()).getTime();
  return rightDay - leftDay === 24 * 60 * 60 * 1000;
}

function placementBandToApiLevel(level: VocabularyPlacementBand): PlacementResult["placementResult"]["level"] {
  if (level === "STARTER") {
    return "starter";
  }

  if (level === "STARTER_PLUS") {
    return "starter_plus";
  }

  return "early_intermediate";
}

function parsePlacementQuestions(questionsJson: string): PlacementQuestion[] {
  const parsed = JSON.parse(questionsJson) as PlacementQuestion[];
  return parsed;
}

function choosePlacementWords(words: VocabularyWordRow[]) {
  const targetCount = Math.min(PLACEMENT_MAX_QUESTIONS, Math.max(PLACEMENT_MIN_QUESTIONS, Math.min(words.length, PLACEMENT_MAX_QUESTIONS)));
  const selected: VocabularyWordRow[] = [];
  const usedIds = new Set<string>();
  const grouped = new Map<string, VocabularyWordRow[]>();

  for (const word of words) {
    const key = normalizeCategory(word.category);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(word);
  }

  for (const category of PLACEMENT_CATEGORY_ORDER) {
    const candidates = shuffleArray(grouped.get(category) ?? []).filter((word) => !usedIds.has(word.id));
    if (candidates[0]) {
      selected.push(candidates[0]);
      usedIds.add(candidates[0].id);
    }
  }

  const remaining = shuffleArray(words).filter((word) => !usedIds.has(word.id));
  for (const word of remaining) {
    if (selected.length >= targetCount) {
      break;
    }
    selected.push(word);
    usedIds.add(word.id);
  }

  return shuffleArray(selected).slice(0, targetCount);
}

function buildPlacementOptions(
  target: VocabularyWordRow,
  direction: VocabularyPlacementDirection,
  allWords: VocabularyWordRow[],
) {
  const correctText = direction === "KR_TO_RU" ? target.translation : target.korean;
  const sameCategoryPool = shuffleArray(allWords).filter(
    (word) => word.id !== target.id && normalizeCategory(word.category) === normalizeCategory(target.category),
  );
  const fallbackPool = shuffleArray(allWords).filter((word) => word.id !== target.id);
  const distractors: VocabularyWordRow[] = [];
  const usedOptionTexts = new Set<string>([correctText]);

  const pushCandidate = (candidate: VocabularyWordRow) => {
    const optionText = direction === "KR_TO_RU" ? candidate.translation : candidate.korean;
    if (!optionText || usedOptionTexts.has(optionText)) {
      return;
    }
    distractors.push(candidate);
    usedOptionTexts.add(optionText);
  };

  for (const candidate of sameCategoryPool) {
    if (distractors.length >= 3) {
      break;
    }
    pushCandidate(candidate);
  }

  for (const candidate of fallbackPool) {
    if (distractors.length >= 3) {
      break;
    }
    pushCandidate(candidate);
  }

  if (distractors.length < 3) {
    throw new Error("Недостаточно слов для генерации теста.");
  }

  const correctOption: PlacementQuestionOption = {
    id: createId(),
    wordId: target.id,
    text: correctText,
  };

  const options = shuffleArray([
    correctOption,
    ...distractors.slice(0, 3).map((word) => ({
      id: createId(),
      wordId: word.id,
      text: direction === "KR_TO_RU" ? word.translation : word.korean,
    })),
  ]);

  return {
    options,
    correctOptionId: correctOption.id,
  };
}

function buildPlacementQuestions(words: VocabularyWordRow[]): PlacementQuestion[] {
  const selected = choosePlacementWords(words);

  return selected.map((word) => {
    const direction: VocabularyPlacementDirection = "KR_TO_RU";
    const { options, correctOptionId } = buildPlacementOptions(word, direction, words);

    return {
      id: createId(),
      wordId: word.id,
      prompt: word.korean,
      direction,
      category: word.category,
      options,
      correctOptionId,
    };
  });
}

async function ensureVocabularyProfile(userId: string) {
  const existing = await prisma.$queryRaw<VocabularyProfileRow[]>`
    SELECT "id", "userId", "estimatedLevel", "placementScore", "placementCompletedAt", "onboardingCompletedAt", "dailyGoal", "streakDays", "lastStudiedOn"
    FROM "VocabularyProfile"
    WHERE "userId" = ${userId}
    LIMIT 1
  `;

  if (existing[0]) {
    return existing[0];
  }

  const id = createId();
  await prisma.$executeRaw`
    INSERT INTO "VocabularyProfile" ("id", "userId", "dailyGoal", "streakDays", "createdAt", "updatedAt")
    VALUES (${id}, ${userId}, 15, 0, NOW(), NOW())
  `;

  const created = await prisma.$queryRaw<VocabularyProfileRow[]>`
    SELECT "id", "userId", "estimatedLevel", "placementScore", "placementCompletedAt", "onboardingCompletedAt", "dailyGoal", "streakDays", "lastStudiedOn"
    FROM "VocabularyProfile"
    WHERE "id" = ${id}
    LIMIT 1
  `;

  return created[0];
}

async function getVocabularyReview(db: SqlClient, userId: string, wordId: string) {
  const rows = await db.$queryRaw<VocabularyReviewRow[]>`
    SELECT "id", "userId", "wordId", "reviewCount", "knownCount", "dontKnowCount", "currentStreak", "intervalDays", "nextReviewAt", "lastReviewedAt", "lastRating"
    FROM "VocabularyReview"
    WHERE "userId" = ${userId}
      AND "wordId" = ${wordId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function updateProfileStudyStreak(userId: string, profile: VocabularyProfileRow, now: Date) {
  let streakDays = profile.streakDays;

  if (!profile.lastStudiedOn) {
    streakDays = 1;
  } else if (isSameCalendarDay(profile.lastStudiedOn, now)) {
    streakDays = profile.streakDays;
  } else if (isPreviousCalendarDay(profile.lastStudiedOn, now)) {
    streakDays = profile.streakDays + 1;
  } else {
    streakDays = 1;
  }

  await prisma.$executeRaw`
    UPDATE "VocabularyProfile"
    SET "streakDays" = ${streakDays},
        "lastStudiedOn" = ${now},
        "updatedAt" = NOW()
    WHERE "userId" = ${userId}
  `;
}

async function upsertVocabularyReview(db: SqlClient, userId: string, wordId: string, rating: VocabularyReviewRating, now: Date) {
  const existing = await getVocabularyReview(db, userId, wordId);
  const nextReviewAt = nextReviewDate(rating, now);
  const reviewCount = (existing?.reviewCount ?? 0) + 1;
  const knownCount = (existing?.knownCount ?? 0) + (rating === "DONT_KNOW" ? 0 : 1);
  const dontKnowCount = (existing?.dontKnowCount ?? 0) + (rating === "DONT_KNOW" ? 1 : 0);
  const currentStreak = rating === "EASY" ? (existing?.currentStreak ?? 0) + 1 : 0;
  const intervalDays = rating === "EASY" ? 4 : rating === "HARD" ? 1 : 0;

  await db.$executeRaw`
    INSERT INTO "VocabularyReview" (
      "id", "userId", "wordId", "reviewCount", "knownCount", "dontKnowCount", "currentStreak",
      "intervalDays", "nextReviewAt", "lastReviewedAt", "lastRating", "createdAt", "updatedAt"
    )
    VALUES (
      ${createId()}, ${userId}, ${wordId}, ${reviewCount}, ${knownCount}, ${dontKnowCount}, ${currentStreak},
      ${intervalDays}, ${nextReviewAt}, ${now}, CAST(${rating} AS "VocabularyReviewRating"), NOW(), NOW()
    )
    ON CONFLICT ("userId", "wordId") DO UPDATE SET
      "reviewCount" = EXCLUDED."reviewCount",
      "knownCount" = EXCLUDED."knownCount",
      "dontKnowCount" = EXCLUDED."dontKnowCount",
      "currentStreak" = EXCLUDED."currentStreak",
      "intervalDays" = EXCLUDED."intervalDays",
      "nextReviewAt" = EXCLUDED."nextReviewAt",
      "lastReviewedAt" = EXCLUDED."lastReviewedAt",
      "lastRating" = EXCLUDED."lastRating",
      "updatedAt" = NOW()
  `;
}

async function upsertPlacementReview(
  db: SqlClient,
  userId: string,
  wordId: string,
  isCorrect: boolean,
  responseTimeMs: number | null,
  now: Date,
) {
  const existing = await getVocabularyReview(db, userId, wordId);
  const reviewCount = (existing?.reviewCount ?? 0) + 1;
  const knownCount = (existing?.knownCount ?? 0) + (isCorrect ? 1 : 0);
  const dontKnowCount = (existing?.dontKnowCount ?? 0) + (isCorrect ? 0 : 1);
  const isFastCorrect = isCorrect && responseTimeMs !== null && responseTimeMs <= FAST_RESPONSE_MS;
  const nextRating: VocabularyReviewRating = !isCorrect ? "DONT_KNOW" : isFastCorrect ? "EASY" : "HARD";
  const currentStreak = isFastCorrect ? (existing?.currentStreak ?? 0) + 1 : 0;
  const intervalDays = !isCorrect ? 0 : isFastCorrect ? 4 : 1;
  const nextReviewAt = !isCorrect || nextRating === "HARD" ? now : nextReviewDate("EASY", now);

  await db.$executeRaw`
    INSERT INTO "VocabularyReview" (
      "id", "userId", "wordId", "reviewCount", "knownCount", "dontKnowCount", "currentStreak",
      "intervalDays", "nextReviewAt", "lastReviewedAt", "lastRating", "createdAt", "updatedAt"
    )
    VALUES (
      ${createId()}, ${userId}, ${wordId}, ${reviewCount}, ${knownCount}, ${dontKnowCount}, ${currentStreak},
      ${intervalDays}, ${nextReviewAt}, ${now}, CAST(${nextRating} AS "VocabularyReviewRating"), NOW(), NOW()
    )
    ON CONFLICT ("userId", "wordId") DO UPDATE SET
      "reviewCount" = EXCLUDED."reviewCount",
      "knownCount" = EXCLUDED."knownCount",
      "dontKnowCount" = EXCLUDED."dontKnowCount",
      "currentStreak" = EXCLUDED."currentStreak",
      "intervalDays" = EXCLUDED."intervalDays",
      "nextReviewAt" = EXCLUDED."nextReviewAt",
      "lastReviewedAt" = EXCLUDED."lastReviewedAt",
      "lastRating" = EXCLUDED."lastRating",
      "updatedAt" = NOW()
  `;
}

async function getOrCreatePlacementSession(userId: string): Promise<VocabularyPlacementSession> {
  const existingRows = await prisma.$queryRaw<VocabularyPlacementSessionRow[]>`
    SELECT "id", "userId", "placementBand", "detectedLevel", "score", "correctAnswers", "totalQuestions", "questionsJson", "startedAt", "completedAt"
    FROM "VocabularyPlacementSession"
    WHERE "userId" = ${userId}
      AND "completedAt" IS NULL
    ORDER BY "startedAt" DESC
    LIMIT 1
  `;

  if (existingRows[0]) {
    const existingQuestions = parsePlacementQuestions(existingRows[0].questionsJson);
    return {
      placementSessionId: existingRows[0].id,
      totalQuestions: existingRows[0].totalQuestions,
      questions: existingQuestions,
    };
  }

  const candidateWords = await prisma.$queryRaw<VocabularyWordRow[]>`
    SELECT "id", "korean", "transcription", "translation", "exampleKorean", "exampleRussian", "category", "level", "isActive", "createdAt", "updatedAt"
    FROM "VocabularyWord"
    WHERE "isActive" = true
      AND "level" = 'BEGINNER'
    ORDER BY "createdAt" ASC
  `;

  if (candidateWords.length < PLACEMENT_MIN_QUESTIONS) {
    throw new Error("Для теста нужно минимум 8 активных слов начального уровня.");
  }

  const questions = buildPlacementQuestions(candidateWords);
  const sessionId = createId();

  await prisma.$executeRaw`
    INSERT INTO "VocabularyPlacementSession" (
      "id", "userId", "totalQuestions", "questionsJson", "startedAt", "createdAt", "updatedAt"
    )
    VALUES (
      ${sessionId}, ${userId}, ${questions.length}, ${JSON.stringify(questions)}, NOW(), NOW(), NOW()
    )
  `;

  return {
    placementSessionId: sessionId,
    totalQuestions: questions.length,
    questions,
  };
}

async function getNewWords(userId: string, estimatedLevel: VocabularyLevel | null) {
  const level = estimatedLevel ?? "BEGINNER";

  const getLevelWords = (targetLevel: VocabularyLevel, limit: number) => prisma.$queryRaw<SessionQueueRow[]>`
    SELECT
      w."id", w."korean", w."transcription", w."translation", w."exampleKorean", w."exampleRussian", w."category", w."level", w."isActive", w."createdAt", w."updatedAt",
      NULL::INTEGER AS "reviewCount", NULL::INTEGER AS "knownCount", NULL::INTEGER AS "dontKnowCount",
      NULL::INTEGER AS "currentStreak", NULL::TIMESTAMP AS "nextReviewAt",
      NULL::"VocabularyReviewRating" AS "lastRating"
    FROM "VocabularyWord" w
    LEFT JOIN "VocabularyReview" vr
      ON vr."wordId" = w."id"
     AND vr."userId" = ${userId}
    WHERE w."isActive" = true
      AND w."level" = CAST(${targetLevel} AS "VocabularyLevel")
      AND vr."id" IS NULL
    ORDER BY w."createdAt" ASC
    LIMIT ${limit}
  `;

  const levelIndex = VALID_LEVELS.indexOf(level);
  const neighbourLevels = [VALID_LEVELS[levelIndex - 1], VALID_LEVELS[levelIndex + 1]]
    .filter((item): item is VocabularyLevel => Boolean(item));
  const [primaryWords, ...neighbourPools] = await Promise.all([
    getLevelWords(level, 20),
    ...neighbourLevels.map((neighbourLevel) => getLevelWords(neighbourLevel, 6)),
  ]);
  const neighbourWords = Array.from({ length: Math.max(0, ...neighbourPools.map((pool) => pool.length)) })
    .flatMap((_, index) => neighbourPools.flatMap((pool) => pool[index] ? [pool[index]] : []));
  const mixedWords: SessionQueueRow[] = [];
  let primaryIndex = 0;
  let neighbourIndex = 0;

  while (mixedWords.length < 20 && (primaryIndex < primaryWords.length || neighbourIndex < neighbourWords.length)) {
    const useNeighbour = mixedWords.length > 0
      && (mixedWords.length + 1) % 5 === 0
      && neighbourIndex < neighbourWords.length;
    const nextWord = useNeighbour
      ? neighbourWords[neighbourIndex++]
      : primaryWords[primaryIndex++] ?? neighbourWords[neighbourIndex++];

    if (nextWord) {
      mixedWords.push(nextWord);
    }
  }

  return mixedWords;
}

async function getReviewWords(userId: string) {
  return prisma.$queryRaw<SessionQueueRow[]>`
    SELECT
      w."id", w."korean", w."transcription", w."translation", w."exampleKorean", w."exampleRussian", w."category", w."level", w."isActive", w."createdAt", w."updatedAt",
      vr."reviewCount", vr."knownCount", vr."dontKnowCount", vr."currentStreak", vr."nextReviewAt", vr."lastRating"
    FROM "VocabularyWord" w
    INNER JOIN "VocabularyReview" vr
      ON vr."wordId" = w."id"
     AND vr."userId" = ${userId}
    WHERE w."isActive" = true
      AND vr."nextReviewAt" <= NOW()
    ORDER BY vr."nextReviewAt" ASC, vr."dontKnowCount" DESC, vr."currentStreak" ASC
    LIMIT 20
  `;
}

async function getLearnedWords(userId: string) {
  const rows = await prisma.$queryRaw<SessionQueueRow[]>`
    SELECT
      w."id", w."korean", w."transcription", w."translation", w."exampleKorean", w."exampleRussian", w."category", w."level", w."isActive", w."createdAt", w."updatedAt",
      vr."reviewCount", vr."knownCount", vr."dontKnowCount", vr."currentStreak", vr."nextReviewAt", vr."lastRating"
    FROM "VocabularyReview" vr
    INNER JOIN "VocabularyWord" w ON w."id" = vr."wordId"
    WHERE vr."userId" = ${userId} AND w."isActive" = true
    ORDER BY vr."lastReviewedAt" DESC NULLS LAST, w."korean" ASC
  `;

  const now = new Date();
  return rows.map((row) => ({
    ...toCard(row),
    status: (row.knownCount ?? 0) >= 3 && (row.currentStreak ?? 0) >= 2
      ? "MASTERED" as const
      : row.nextReviewAt && row.nextReviewAt <= now
        ? "REVIEW" as const
        : "LEARNING" as const,
    nextReviewAt: row.nextReviewAt ?? now,
    lastRating: row.lastRating ?? null,
  }));
}

async function getVocabularyStats(userId: string, estimatedLevel: VocabularyLevel | null) {
  const todayStart = startOfToday();
  const [learnedTodayRow] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "VocabularyReview"
    WHERE "userId" = ${userId}
      AND "lastReviewedAt" >= ${todayStart}
  `;

  const [masteredRow] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "VocabularyReview"
    WHERE "userId" = ${userId}
      AND "knownCount" >= 3
      AND "currentStreak" >= 2
  `;

  const [learnedRow] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "VocabularyReview"
    WHERE "userId" = ${userId}
  `;

  const [dueReviewRow] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "VocabularyReview" vr
    INNER JOIN "VocabularyWord" w ON w."id" = vr."wordId"
    WHERE vr."userId" = ${userId}
      AND w."isActive" = true
      AND vr."nextReviewAt" <= NOW()
  `;

  const activeLevel = estimatedLevel ?? "BEGINNER";
  const [totalWordsRow] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "VocabularyWord"
    WHERE "isActive" = true
      AND "level" = CAST(${activeLevel} AS "VocabularyLevel")
  `;

  return {
    wordsLearnedToday: countToNumber(learnedTodayRow?.count),
    masteredCount: countToNumber(masteredRow?.count),
    learnedCount: countToNumber(learnedRow?.count),
    dueReviewCount: countToNumber(dueReviewRow?.count),
    totalActiveWords: countToNumber(totalWordsRow?.count),
  };
}

async function getVocabularySprintSummary(userId: string): Promise<VocabularySprintSummary> {
  const { start, end } = getSeoulDayRange();
  const [today] = await prisma.$queryRaw<{
    played: bigint;
    xp: bigint;
    bestAccuracy: number | null;
  }[]>`
    SELECT
      COUNT(*)::bigint AS played,
      COALESCE(SUM("xpEarned"), 0)::bigint AS xp,
      MAX("accuracy") AS "bestAccuracy"
    FROM "VocabularySprintAttempt"
    WHERE "userId" = ${userId}
      AND "completedAt" >= ${start}
      AND "completedAt" < ${end}
  `;
  const [allTime] = await prisma.$queryRaw<{ xp: bigint }[]>`
    SELECT COALESCE(SUM("xpEarned"), 0)::bigint AS xp
    FROM "VocabularySprintAttempt"
    WHERE "userId" = ${userId}
  `;
  const playedToday = countToNumber(today?.played);

  return {
    dailyLimit: SPRINT_DAILY_LIMIT,
    playedToday,
    remainingToday: Math.max(0, SPRINT_DAILY_LIMIT - playedToday),
    xpToday: countToNumber(today?.xp),
    totalXp: countToNumber(allTime?.xp),
    bestAccuracyToday: today?.bestAccuracy ?? null,
  };
}

export async function getVocabularySession(userId: string): Promise<VocabularySession> {
  const profile = await ensureVocabularyProfile(userId);
  const stats = await getVocabularyStats(userId, profile.estimatedLevel);
  const sprint = await getVocabularySprintSummary(userId);

  if (!profile.onboardingCompletedAt && stats.learnedCount === 0) {
    return {
      onboardingRequired: true,
      placementRequired: false,
      profile: {
        estimatedLevel: profile.estimatedLevel,
        levelLabel: null,
        levelDescription: null,
        dailyGoal: profile.dailyGoal,
        streakDays: profile.streakDays,
        wordsLearnedToday: stats.wordsLearnedToday,
        dueCount: 0,
        masteredCount: stats.masteredCount,
        totalActiveWords: stats.totalActiveWords,
        learnedCount: stats.learnedCount,
        newCount: 0,
        dueReviewCount: stats.dueReviewCount,
      },
      sprint,
      placement: null,
      queue: [],
      newWords: [],
      reviewWords: [],
      learnedWords: [],
    };
  }

  if (!profile.placementCompletedAt) {
    const placement = await getOrCreatePlacementSession(userId);

    return {
      onboardingRequired: false,
      placementRequired: true,
      profile: {
        estimatedLevel: profile.estimatedLevel,
        levelLabel: null,
        levelDescription: null,
        dailyGoal: profile.dailyGoal,
        streakDays: profile.streakDays,
        wordsLearnedToday: stats.wordsLearnedToday,
        dueCount: placement.totalQuestions,
        masteredCount: stats.masteredCount,
        totalActiveWords: stats.totalActiveWords,
        learnedCount: stats.learnedCount,
        newCount: 0,
        dueReviewCount: stats.dueReviewCount,
      },
      sprint,
      placement,
      queue: [],
      newWords: [],
      reviewWords: [],
      learnedWords: [],
    };
  }

  const [newRows, reviewRows, learnedWords] = await Promise.all([
    getNewWords(userId, profile.estimatedLevel),
    getReviewWords(userId),
    getLearnedWords(userId),
  ]);
  const newWords = newRows.map(toCard);
  const reviewWords = reviewRows.map(toCard);

  return {
    onboardingRequired: false,
    placementRequired: false,
    profile: {
      estimatedLevel: profile.estimatedLevel,
      levelLabel: profile.estimatedLevel ? toVocabularyLabel(profile.estimatedLevel) : null,
      levelDescription: profile.estimatedLevel ? getVocabularyLevelDescription(profile.estimatedLevel) : null,
      dailyGoal: profile.dailyGoal,
      streakDays: profile.streakDays,
      wordsLearnedToday: stats.wordsLearnedToday,
      dueCount: reviewWords.length,
      masteredCount: stats.masteredCount,
      totalActiveWords: stats.totalActiveWords,
      learnedCount: stats.learnedCount,
      newCount: newWords.length,
      dueReviewCount: stats.dueReviewCount,
    },
    sprint,
    placement: null,
    queue: newWords,
    newWords,
    reviewWords,
    learnedWords,
  };
}

export async function saveVocabularyPreferences(
  userId: string,
  input: { dailyGoal: number; level: VocabularyLevel },
) {
  const dailyGoal = Math.round(input.dailyGoal);
  if (!Number.isFinite(dailyGoal) || dailyGoal < 1 || dailyGoal > 50) {
    throw new Error("Выбери цель от 1 до 50 слов в день.");
  }
  if (!VALID_LEVELS.includes(input.level)) {
    throw new Error("Выбери доступный уровень словаря.");
  }

  await ensureVocabularyProfile(userId);
  await prisma.$executeRaw`
    UPDATE "VocabularyProfile"
    SET "dailyGoal" = ${dailyGoal},
        "estimatedLevel" = CAST(${input.level} AS "VocabularyLevel"),
        "placementScore" = NULL,
        "placementCompletedAt" = NOW(),
        "onboardingCompletedAt" = NOW(),
        "updatedAt" = NOW()
    WHERE "userId" = ${userId}
  `;

  return getVocabularySession(userId);
}

export async function submitVocabularySprintAttempt(
  userId: string,
  input: {
    wordIds: string[];
    mistakeCount: number;
    durationMs: number;
  },
): Promise<VocabularySprintResult> {
  const wordIds = [...new Set(input.wordIds.map((wordId) => wordId.trim()).filter(Boolean))];
  if (wordIds.length < 2 || wordIds.length > 6) {
    throw new Error("Для спринта нужно от 2 до 6 разных слов.");
  }

  const mistakeCount = Math.max(0, Math.min(99, Math.round(input.mistakeCount)));
  const durationMs = Math.max(1000, Math.min(10 * 60 * 1000, Math.round(input.durationMs)));
  if (!Number.isFinite(mistakeCount) || !Number.isFinite(durationMs)) {
    throw new Error("Некорректный результат спринта.");
  }

  const [{ count: activeWordCount }] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "VocabularyWord"
    WHERE "id" = ANY(${wordIds})
      AND "isActive" = true
  `;
  if (countToNumber(activeWordCount) !== wordIds.length) {
    throw new Error("Часть слов спринта больше недоступна.");
  }

  const currentSprint = await getVocabularySprintSummary(userId);
  if (currentSprint.remainingToday <= 0) {
    throw new Error("Сегодняшние три спринта уже сыграны. Возвращайтесь завтра!");
  }

  const correctPairs = wordIds.length;
  const accuracy = Math.round((correctPairs / (correctPairs + mistakeCount)) * 100);
  const grade = mistakeCount === 0
    ? "PERFECT"
    : mistakeCount === 1
      ? "EXCELLENT"
      : mistakeCount === 2
        ? "GOOD"
        : "PRACTICE";
  const gradeLabel = grade === "PERFECT"
    ? "Идеально"
    : grade === "EXCELLENT"
      ? "Отлично"
      : grade === "GOOD"
        ? "Хороший темп"
        : "Нужно закрепить";
  const accuracyBonus = grade === "PERFECT" ? 18 : grade === "EXCELLENT" ? 12 : grade === "GOOD" ? 7 : 3;
  const speedBonus = durationMs <= 30_000 ? 5 : durationMs <= 45_000 ? 3 : durationMs <= 75_000 ? 1 : 0;
  const xpEarned = correctPairs * 2 + accuracyBonus + speedBonus;
  const attemptId = createId();
  const now = new Date();
  const profile = await ensureVocabularyProfile(userId);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "VocabularySprintAttempt" (
        "id", "userId", "wordsCount", "correctPairs", "mistakeCount", "durationMs",
        "accuracy", "grade", "xpEarned", "completedAt", "createdAt", "updatedAt"
      )
      VALUES (
        ${attemptId}, ${userId}, ${wordIds.length}, ${correctPairs}, ${mistakeCount}, ${durationMs},
        ${accuracy}, ${grade}, ${xpEarned}, ${now}, NOW(), NOW()
      )
    `;
  });
  await updateProfileStudyStreak(userId, profile, now);

  return {
    attemptId,
    correctPairs,
    mistakeCount,
    durationMs,
    accuracy,
    grade,
    gradeLabel,
    xpEarned,
    sprint: await getVocabularySprintSummary(userId),
  };
}

export async function submitPlacement(userId: string, sessionId: string, answers: PlacementAnswerInput[]): Promise<PlacementResult> {
  const sessionRows = await prisma.$queryRaw<VocabularyPlacementSessionRow[]>`
    SELECT "id", "userId", "placementBand", "detectedLevel", "score", "correctAnswers", "totalQuestions", "questionsJson", "startedAt", "completedAt"
    FROM "VocabularyPlacementSession"
    WHERE "id" = ${sessionId}
      AND "userId" = ${userId}
    LIMIT 1
  `;

  const placementSession = sessionRows[0];
  if (!placementSession) {
    throw new Error("Сессия теста не найдена.");
  }

  if (placementSession.completedAt) {
    throw new Error("Сессия теста уже завершена.");
  }

  const questions = parsePlacementQuestions(placementSession.questionsJson);
  if (questions.length < PLACEMENT_MIN_QUESTIONS) {
    throw new Error("Сессия теста повреждена: слишком мало вопросов.");
  }

  if (answers.length !== questions.length) {
    throw new Error("Нужно ответить на все вопросы теста.");
  }

  const answerByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer]));
  const now = new Date();
  const profile = await ensureVocabularyProfile(userId);

  const normalizedAnswers = questions.map((question, index) => {
    const submitted = answerByQuestionId.get(question.id);
    if (!submitted) {
      throw new Error("Не найдены ответы для всех вопросов теста.");
    }

    const selectedOption = question.options.find((option) => option.id === submitted.selectedOptionId);
    const correctOption = question.options.find((option) => option.id === question.correctOptionId);

    if (!selectedOption || !correctOption) {
      throw new Error("Вопрос теста содержит некорректные варианты ответа.");
    }

    return {
      question,
      questionOrder: index,
      selectedOption,
      correctOption,
      isCorrect: selectedOption.id === correctOption.id,
      responseTimeMs:
        typeof submitted.responseTimeMs === "number" && Number.isFinite(submitted.responseTimeMs)
          ? Math.max(0, Math.round(submitted.responseTimeMs))
          : null,
    };
  });

  const correctAnswers = normalizedAnswers.filter((answer) => answer.isCorrect).length;
  const score = correctAnswers;
  const placementBand = resolvePlacementBand(correctAnswers);
  const estimatedLevel = mapPlacementBandToVocabularyLevel(placementBand);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      DELETE FROM "VocabularyPlacementAnswer"
      WHERE "sessionId" = ${sessionId}
    `;

    for (const item of normalizedAnswers) {
      await tx.$executeRaw`
        INSERT INTO "VocabularyPlacementAnswer" (
          "id", "sessionId", "userId", "wordId", "questionOrder", "direction", "selectedAnswer", "correctAnswer",
          "isCorrect", "responseTimeMs", "answeredAt", "createdAt", "updatedAt"
        )
        VALUES (
          ${createId()}, ${sessionId}, ${userId}, ${item.question.wordId}, ${item.questionOrder},
          CAST(${item.question.direction} AS "VocabularyPlacementDirection"),
          ${item.selectedOption.text}, ${item.correctOption.text}, ${item.isCorrect}, ${item.responseTimeMs}, ${now}, NOW(), NOW()
        )
      `;

      await upsertPlacementReview(tx, userId, item.question.wordId, item.isCorrect, item.responseTimeMs, now);
    }

    await tx.$executeRaw`
      UPDATE "VocabularyPlacementSession"
      SET "placementBand" = CAST(${placementBand} AS "VocabularyPlacementBand"),
          "detectedLevel" = CAST(${estimatedLevel} AS "VocabularyLevel"),
          "score" = ${score},
          "correctAnswers" = ${correctAnswers},
          "completedAt" = ${now},
          "updatedAt" = NOW()
      WHERE "id" = ${sessionId}
    `;

    await tx.$executeRaw`
      UPDATE "VocabularyProfile"
      SET "estimatedLevel" = CAST(${estimatedLevel} AS "VocabularyLevel"),
          "placementScore" = ${score},
          "placementCompletedAt" = ${now},
          "lastStudiedOn" = ${now},
          "streakDays" = ${profile.lastStudiedOn && isSameCalendarDay(profile.lastStudiedOn, now) ? profile.streakDays : 1},
          "updatedAt" = NOW()
      WHERE "userId" = ${userId}
    `;
  });

  return {
    placementSessionId: sessionId,
    placementResult: {
      level: placementBandToApiLevel(placementBand),
      score,
      correctAnswers,
      totalQuestions: questions.length,
    },
    estimatedLevel,
    levelLabel: toVocabularyLabel(estimatedLevel),
    levelDescription: getVocabularyLevelDescription(estimatedLevel),
    placementBandLabel: toPlacementBandLabel(placementBand),
    placementBandDescription: getPlacementBandDescription(placementBand),
  };
}

export async function submitVocabularyReview(userId: string, wordId: string, rating: VocabularyReviewRating) {
  if (!validateRating(rating)) {
    throw new Error("Некорректная оценка карточки.");
  }

  const wordRows = await prisma.$queryRaw<VocabularyWordRow[]>`
    SELECT "id", "korean", "transcription", "translation", "exampleKorean", "exampleRussian", "category", "level", "isActive", "createdAt", "updatedAt"
    FROM "VocabularyWord"
    WHERE "id" = ${wordId}
      AND "isActive" = true
    LIMIT 1
  `;

  if (!wordRows[0]) {
    throw new Error("Слово не найдено.");
  }

  const now = new Date();
  const profile = await ensureVocabularyProfile(userId);
  await updateProfileStudyStreak(userId, profile, now);
  await upsertVocabularyReview(prisma, userId, wordId, rating, now);

  return {
    ok: true,
    nextReviewAt: nextReviewDate(rating, now),
  };
}

export async function listVocabularyWords() {
  return prisma.$queryRaw<VocabularyWordRow[]>`
    SELECT "id", "korean", "transcription", "translation", "exampleKorean", "exampleRussian", "category", "level", "isActive", "createdAt", "updatedAt"
    FROM "VocabularyWord"
    ORDER BY "createdAt" DESC
  `;
}

export async function fillMissingVocabularyExamples(examples: Array<{ id: string; exampleKorean: string; exampleRussian: string }>) {
  let updated = 0;
  for (const example of examples) {
    const exampleKorean = example.exampleKorean.trim();
    const exampleRussian = example.exampleRussian.trim();
    if (!example.id || !exampleKorean || !exampleRussian) continue;
    const affected = await prisma.$executeRaw`
      UPDATE "VocabularyWord"
      SET "exampleKorean" = CASE WHEN "exampleKorean" IS NULL OR TRIM("exampleKorean") = '' THEN ${exampleKorean} ELSE "exampleKorean" END,
          "exampleRussian" = CASE WHEN "exampleRussian" IS NULL OR TRIM("exampleRussian") = '' THEN ${exampleRussian} ELSE "exampleRussian" END,
          "updatedAt" = NOW()
      WHERE "id" = ${example.id}
        AND ("exampleKorean" IS NULL OR TRIM("exampleKorean") = '' OR "exampleRussian" IS NULL OR TRIM("exampleRussian") = '')
    `;
    if (affected > 0) updated += 1;
  }
  return updated;
}

export async function createVocabularyWord(input: VocabularyWordInput) {
  if (!validateLevel(input.level)) {
    throw new Error("Некорректный уровень слова.");
  }

  const korean = input.korean.trim();
  const transcription = input.transcription?.trim() || null;
  const translation = input.translation.trim();
  const exampleKorean = input.exampleKorean?.trim() || null;
  const exampleRussian = input.exampleRussian?.trim() || null;
  const category = input.category?.trim() || null;

  if (!korean || !translation) {
    throw new Error("Заполните корейское слово и перевод.");
  }

  await ensureVocabularyWordIsUnique(korean, translation);

  const id = createId();
  await prisma.$executeRaw`
    INSERT INTO "VocabularyWord" ("id", "korean", "transcription", "translation", "exampleKorean", "exampleRussian", "category", "level", "isActive", "createdAt", "updatedAt")
    VALUES (${id}, ${korean}, ${transcription}, ${translation}, ${exampleKorean}, ${exampleRussian}, ${category}, CAST(${input.level} AS "VocabularyLevel"), ${input.isActive}, NOW(), NOW())
  `;

  const rows = await prisma.$queryRaw<VocabularyWordRow[]>`
    SELECT "id", "korean", "transcription", "translation", "exampleKorean", "exampleRussian", "category", "level", "isActive", "createdAt", "updatedAt"
    FROM "VocabularyWord"
    WHERE "id" = ${id}
    LIMIT 1
  `;

  return rows[0];
}

export async function updateVocabularyWord(wordId: string, input: VocabularyWordInput) {
  if (!validateLevel(input.level)) {
    throw new Error("Некорректный уровень слова.");
  }

  const korean = input.korean.trim();
  const transcription = input.transcription?.trim() || null;
  const translation = input.translation.trim();
  const exampleKorean = input.exampleKorean?.trim() || null;
  const exampleRussian = input.exampleRussian?.trim() || null;
  const category = input.category?.trim() || null;

  if (!korean || !translation) {
    throw new Error("Заполните корейское слово и перевод.");
  }

  await ensureVocabularyWordIsUnique(korean, translation, wordId);

  await prisma.$executeRaw`
    UPDATE "VocabularyWord"
    SET "korean" = ${korean},
        "transcription" = ${transcription},
        "translation" = ${translation},
        "exampleKorean" = ${exampleKorean},
        "exampleRussian" = ${exampleRussian},
        "category" = ${category},
        "level" = CAST(${input.level} AS "VocabularyLevel"),
        "isActive" = ${input.isActive},
        "updatedAt" = NOW()
    WHERE "id" = ${wordId}
  `;

  const rows = await prisma.$queryRaw<VocabularyWordRow[]>`
    SELECT "id", "korean", "transcription", "translation", "exampleKorean", "exampleRussian", "category", "level", "isActive", "createdAt", "updatedAt"
    FROM "VocabularyWord"
    WHERE "id" = ${wordId}
    LIMIT 1
  `;

  if (!rows[0]) {
    throw new Error("Слово не найдено.");
  }

  return rows[0];
}


