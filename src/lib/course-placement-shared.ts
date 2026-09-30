export type CoursePlacementState = {
  greetingSeen: boolean;
  completed: boolean;
  recommendedLevelNumber: number | null;
  recommendedLevelSlug: string | null;
  completedAt: string | null;
};

export type CoursePlacementResultPayload = {
  recommendedLevelNumber: number;
  recommendedLevelSlug: string;
};

const COURSE_PLACEMENT_LEVELS = new Map<number, string>([
  [1, "starter"],
  [2, "foundation"],
  [3, "elementary"],
  [4, "intermediate"],
]);

export function createEmptyCoursePlacementState(): CoursePlacementState {
  return {
    greetingSeen: false,
    completed: false,
    recommendedLevelNumber: null,
    recommendedLevelSlug: null,
    completedAt: null,
  };
}

export function normalizeCoursePlacementState(value: unknown): CoursePlacementState {
  if (!value || typeof value !== "object") {
    return createEmptyCoursePlacementState();
  }

  const candidate = value as Partial<CoursePlacementState>;
  const normalizedResult = normalizeCoursePlacementResult(candidate);
  const completedAt =
    typeof candidate.completedAt === "string" &&
    candidate.completedAt.trim().length > 0 &&
    Number.isFinite(Date.parse(candidate.completedAt))
      ? candidate.completedAt
      : null;
  const completed =
    candidate.completed === true &&
    normalizedResult !== null &&
    completedAt !== null;

  return {
    greetingSeen: candidate.greetingSeen === true || completed,
    completed,
    recommendedLevelNumber: completed
      ? normalizedResult.recommendedLevelNumber
      : null,
    recommendedLevelSlug: completed
      ? normalizedResult.recommendedLevelSlug
      : null,
    completedAt: completed ? completedAt : null,
  };
}

export function normalizeCoursePlacementResult(
  value: unknown,
): CoursePlacementResultPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<CoursePlacementResultPayload>;
  const levelNumber = candidate.recommendedLevelNumber;
  const levelSlug = candidate.recommendedLevelSlug?.trim();

  if (
    typeof levelNumber !== "number" ||
    !Number.isInteger(levelNumber) ||
    typeof levelSlug !== "string" ||
    COURSE_PLACEMENT_LEVELS.get(levelNumber) !== levelSlug
  ) {
    return null;
  }

  return {
    recommendedLevelNumber: levelNumber,
    recommendedLevelSlug: levelSlug,
  };
}

export function createCompletedCoursePlacementState(
  result: CoursePlacementResultPayload,
  completedAt = new Date(),
): CoursePlacementState {
  return {
    greetingSeen: true,
    completed: true,
    recommendedLevelNumber: result.recommendedLevelNumber,
    recommendedLevelSlug: result.recommendedLevelSlug,
    completedAt: completedAt.toISOString(),
  };
}
