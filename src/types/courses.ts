export const COURSE_STEP_TYPES = [
  "GRAMMAR",
  "EXAMPLES",
  "VOCABULARY",
  "PRACTICE",
  "QUIZ",
  "CUSTOM",
] as const;

export type CourseStepType = (typeof COURSE_STEP_TYPES)[number];

export const COURSE_LESSON_MODES = ["STANDARD", "FLEXIBLE"] as const;

export type CourseLessonMode = (typeof COURSE_LESSON_MODES)[number];

export const COURSE_LESSON_KINDS = ["LESSON", "MINI_QUIZ", "FINAL_TEST"] as const;

export type CourseLessonKind = (typeof COURSE_LESSON_KINDS)[number];

export const COURSE_STEP_LABELS: Record<CourseStepType, string> = {
  GRAMMAR: "Грамматика",
  EXAMPLES: "Примеры",
  VOCABULARY: "Словарь",
  PRACTICE: "Практика",
  QUIZ: "Тест",
  CUSTOM: "Свободный шаг",
};

export const COURSE_LESSON_MODE_LABELS: Record<CourseLessonMode, string> = {
  STANDARD: "Стандартный урок",
  FLEXIBLE: "Гибкий урок",
};

export const COURSE_LESSON_KIND_LABELS: Record<CourseLessonKind, string> = {
  LESSON: "Урок",
  MINI_QUIZ: "Мини-квиз",
  FINAL_TEST: "Финальный тест",
};

export type CourseNodeState = "locked" | "available" | "current" | "completed";

export const COURSE_NODE_STATE_LABELS: Record<CourseNodeState, string> = {
  locked: "Закрыт",
  available: "Доступен",
  current: "Текущий",
  completed: "Завершен",
};

export type CourseLearningStats = {
  streakDays: number;
  totalXp: number;
  completedLessons: number;
  rankTitle: string;
  nextRankTitle: string | null;
  rankProgressPercent: number;
  xpToNextRank: number | null;
};

export type CourseVocabularyWord = {
  id: string;
  korean: string;
  transcription: string | null;
  translation: string;
  category: string | null;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
};

export type CourseOverviewLevel = {
  id: string;
  number: number;
  slug: string;
  title: string;
  description: string | null;
  accentColor: string;
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
  vocabularyWordsCount: number;
  learnedVocabularyWordsCount: number;
  isUnlocked: boolean;
  currentUnitTitle: string | null;
  currentLessonTitle: string | null;
};

export type CourseOverviewResponse = {
  viewer: {
    isAuthenticated: boolean;
    canPersistProgress: boolean;
    name: string | null;
    coursePlacement: import("@/lib/course-placement-shared").CoursePlacementState;
  };
  learningStats: CourseLearningStats;
  continueLesson: {
    levelSlug: string;
    unitSlug: string;
    lessonSlug: string;
    levelTitle: string;
    unitTitle: string;
    lessonTitle: string;
    nextStepLabel: string;
    completionPercent: number;
  } | null;
  levels: CourseOverviewLevel[];
};

export type CourseRoadmapLesson = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  order: number;
  estimatedMinutes: number;
  mode: CourseLessonMode;
  kind: CourseLessonKind;
  completedSteps: number;
  totalSteps: number;
  state: CourseNodeState;
};

export type CourseRoadmapUnit = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  order: number;
  isLocked: boolean;
  completedLessons: number;
  totalLessons: number;
  lessons: CourseRoadmapLesson[];
};

export type CourseRoadmapResponse = {
  viewer: {
    isAuthenticated: boolean;
    canPersistProgress: boolean;
  };
  level: {
    id: string;
    number: number;
    slug: string;
    title: string;
    description: string | null;
    accentColor: string;
    progressPercent: number;
    completedLessons: number;
    totalLessons: number;
    vocabularyWordsCount: number;
    learnedVocabularyWordsCount: number;
  };
  units: CourseRoadmapUnit[];
};

export type CourseLessonStepView = {
  id: string;
  order: number;
  type: CourseStepType;
  title: string;
  content: string;
  imageUrl: string | null;
  state: CourseNodeState;
  isCompleted: boolean;
};

export type CourseLessonResponse = {
  viewer: {
    isAuthenticated: boolean;
    canPersistProgress: boolean;
  };
  level: {
    id: string;
    number: number;
    slug: string;
    title: string;
    accentColor: string;
  };
  unit: {
    id: string;
    slug: string;
    title: string;
    order: number;
  };
  lesson: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    imageUrl: string | null;
    estimatedMinutes: number;
    mode: CourseLessonMode;
    kind: CourseLessonKind;
    state: CourseNodeState;
    progressPercent: number;
    completedStepsCount: number;
    totalSteps: number;
    nextLesson: {
      levelSlug: string;
      unitSlug: string;
      lessonSlug: string;
      title: string;
    } | null;
    vocabularyWords: CourseVocabularyWord[];
    vocabularyDistractorWords: CourseVocabularyWord[];
    steps: CourseLessonStepView[];
  };
};

export type CourseProgressResponse = {
  lesson: CourseLessonResponse["lesson"];
};

export type AdminCourseStep = {
  id?: string;
  type: CourseStepType;
  title: string;
  content: string;
  imageUrl: string | null;
};

export type AdminCourseLesson = {
  id?: string;
  slug: string;
  title: string;
  summary: string;
  imageUrl: string | null;
  estimatedMinutes: number;
  mode: CourseLessonMode;
  kind: CourseLessonKind;
  vocabularyWordIds: string[];
  isPublished: boolean;
  steps: AdminCourseStep[];
};

export type AdminCourseUnit = {
  id?: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string | null;
  isPublished: boolean;
  lessons: AdminCourseLesson[];
};

export type AdminCourseLevel = {
  id: string;
  number: number;
  slug: string;
  title: string;
  description: string;
  accentColor: string;
  units: AdminCourseUnit[];
};

export type AdminCourseLevelSummary = {
  id: string;
  number: number;
  slug: string;
  title: string;
  description: string;
  accentColor: string;
  unitsCount: number;
  lessonsCount: number;
};

export type AdminCourseCatalogResponse = {
  levels?: AdminCourseLevel[];
  error?: string;
  ok?: boolean;
};

export type AdminCourseLevelResponse = {
  level?: AdminCourseLevel;
  error?: string;
  ok?: boolean;
};

export type AdminCourseLessonResponse = {
  lesson?: AdminCourseLesson;
  error?: string;
  ok?: boolean;
};

export type AdminCourseLevelsIndexResponse = {
  levels?: AdminCourseLevelSummary[];
  error?: string;
  ok?: boolean;
};
