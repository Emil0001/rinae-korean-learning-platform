"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import styled, { keyframes } from "styled-components";
import { appendHangulInput, KoreanKeyboard, removeLastHangulInput, type KoreanKeyboardAction } from "@/components/ui/korean-keyboard";
import { useAuth } from "@/context/auth-context";
import type { VocabularyLevel, VocabularyPlacementDirection, VocabularyReviewRating } from "@/lib/vocabulary";

type VocabularyCard = {
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

type PlacementOption = {
  id: string;
  wordId: string;
  text: string;
};

type PlacementQuestion = {
  id: string;
  wordId: string;
  prompt: string;
  direction: VocabularyPlacementDirection;
  category: string | null;
  options: PlacementOption[];
  correctOptionId: string;
};

type PlacementSession = {
  placementSessionId: string;
  totalQuestions: number;
  questions: PlacementQuestion[];
};

type VocabularySession = {
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
  sprint: {
    dailyLimit: number;
    playedToday: number;
    remainingToday: number;
    xpToday: number;
    totalXp: number;
    bestAccuracyToday: number | null;
  };
  placement: PlacementSession | null;
  queue: VocabularyCard[];
  newWords: VocabularyCard[];
  reviewWords: VocabularyCard[];
  learnedWords: Array<VocabularyCard & {
    status: "LEARNING" | "REVIEW" | "MASTERED";
    nextReviewAt: string;
    lastRating: VocabularyReviewRating | null;
  }>;
};

type VocabularySessionResponse = VocabularySession & {
  error?: string;
};

type PlacementResponse = {
  placementSessionId?: string;
  placementResult?: {
    level: "starter" | "starter_plus" | "early_intermediate";
    score: number;
    correctAnswers: number;
    totalQuestions: number;
  };
  estimatedLevel?: VocabularyLevel;
  levelLabel?: string;
  levelDescription?: string;
  placementBandLabel?: string;
  placementBandDescription?: string;
  error?: string;
};

type ReviewResponse = {
  ok?: boolean;
  error?: string;
};

type SprintResult = {
  attemptId: string;
  correctPairs: number;
  mistakeCount: number;
  durationMs: number;
  accuracy: number;
  grade: "PERFECT" | "EXCELLENT" | "GOOD" | "PRACTICE";
  gradeLabel: string;
  xpEarned: number;
  sprint: VocabularySession["sprint"];
  error?: string;
};

type PlacementAnswerDraft = {
  questionId: string;
  selectedOptionId: string;
  responseTimeMs: number;
};

type LearningStep = {
  id: string;
  kind: "preview" | "quiz" | "type";
  wordId: string;
};

type LearningOption = {
  id: string;
  text: string;
  isCorrect: boolean;
};

type RoundSummary = {
  selectedCount: number;
  masteredCount: number;
  needsReviewCount: number;
  accuracy: number;
  words: Array<{
    id: string;
    korean: string;
    translation: string;
    transcription: string | null;
    mastered: boolean;
  }>;
};

type MatchLine = {
  wordId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
};

type VocabularyConfettiStyle = CSSProperties & Record<`--confetti-${string}`, string>;
type VocabularyConfettiBurst = { id: number; pieces: VocabularyConfettiStyle[] };

const placementBandCopy: Record<NonNullable<PlacementResponse["placementResult"]>["level"], string> = {
  starter: "База ещё формируется, поэтому словарь начнётся с простых бытовых тем и частых повторов.",
  starter_plus: "Базовые слова уже знакомы, но им нужен хороший темп и плотное закрепление по темам.",
  early_intermediate: "Старт можно делать быстрее: в очереди будет больше слов для раннего intermediate-уровня.",
};

const roundPresets = [
  { size: 5, title: "Разминка", badge: "2 мин" },
  { size: 10, title: "В ритме", badge: "популярный" },
  { size: 15, title: "Погружение", badge: "7 мин" },
  { size: 20, title: "Марафон", badge: "максимум" },
] as const;
const onboardingGoals = [5, 10, 15, 20] as const;
const onboardingLevels: Array<{
  value: VocabularyLevel;
  title: string;
  eyebrow: string;
  description: string;
  sample: string;
}> = [
  {
    value: "BEGINNER",
    title: "Начальный",
    eyebrow: "Начинаю с основ",
    description: "Частые слова для быта, простых фраз и уверенного старта.",
    sample: "안녕 · 물 · 학교",
  },
  {
    value: "INTERMEDIATE",
    title: "Средний",
    eyebrow: "База уже есть",
    description: "Более живые темы, длинные фразы и словарь для TOPIK.",
    sample: "경험 · 약속 · 준비하다",
  },
  {
    value: "ADVANCED",
    title: "Продвинутый",
    eyebrow: "Хочу сложнее",
    description: "Точная лексика для текстов, экзамена и свободного понимания.",
    sample: "영향 · 관점 · 능숙하다",
  },
];
const matchLineColors = ["#7c6cf2", "#43bfae", "#ffb84d", "#f076a6", "#64a9f4", "#82bd56"];
const vocabularyConfettiColors = ["#58cc02", "#ff6f7d", "#ffc800", "#1cb0f6", "#b978ff", "#ff9f2e"];

function createVocabularyConfetti(origin: { x: number; y: number }, count = 30): VocabularyConfettiStyle[] {
  return Array.from({ length: count }, () => {
    const angle = (-165 + Math.random() * 150) * (Math.PI / 180);
    const launchDistance = 6 + Math.random() * 10;
    const middleX = Math.cos(angle) * launchDistance;
    const middleY = Math.sin(angle) * launchDistance;
    const endX = middleX + (Math.random() - 0.5) * 8;
    const endY = middleY + 12 + Math.random() * 9;
    const endSpin = (Math.random() > 0.5 ? 1 : -1) * (420 + Math.random() * 600);
    const isRound = Math.random() > 0.72;
    const isWide = !isRound && Math.random() > 0.58;
    const width = isRound ? 0.48 + Math.random() * 0.24 : isWide ? 0.65 + Math.random() * 0.34 : 0.38 + Math.random() * 0.24;
    const height = isRound ? width : isWide ? 0.3 + Math.random() * 0.2 : 0.7 + Math.random() * 0.45;

    return {
      "--confetti-mid-x": `${middleX.toFixed(2)}rem`,
      "--confetti-mid-y": `${middleY.toFixed(2)}rem`,
      "--confetti-end-x": `${endX.toFixed(2)}rem`,
      "--confetti-end-y": `${endY.toFixed(2)}rem`,
      "--confetti-mid-spin": `${(endSpin * 0.38).toFixed(0)}deg`,
      "--confetti-end-spin": `${endSpin.toFixed(0)}deg`,
      "--confetti-duration": `${Math.round(1250 + Math.random() * 550)}ms`,
      "--confetti-delay": `${Math.round(Math.random() * 120)}ms`,
      "--confetti-color": vocabularyConfettiColors[Math.floor(Math.random() * vocabularyConfettiColors.length)],
      "--confetti-left": `${(origin.x + (Math.random() - 0.5) * 12).toFixed(1)}px`,
      "--confetti-top": `${(origin.y + (Math.random() - 0.5) * 8).toFixed(1)}px`,
      "--confetti-width": `${width.toFixed(2)}rem`,
      "--confetti-height": `${height.toFixed(2)}rem`,
      "--confetti-radius": isRound ? "999px" : `${(0.08 + Math.random() * 0.18).toFixed(2)}rem`,
    };
  });
}

function shuffleArray<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function buildLearningOptions(current: VocabularyCard, roundWords: VocabularyCard[], queue: VocabularyCard[]): LearningOption[] {
  const pool = [...roundWords, ...queue].filter((word) => word.id !== current.id);
  const uniqueDistractors = Array.from(new Map(pool.map((word) => [word.id, word])).values())
    .filter((word) => word.translation !== current.translation);

  const hasCategory = Boolean(current.category);
  const sameCategory = hasCategory
    ? uniqueDistractors.filter((word) => word.category === current.category)
    : [];
  const fallback = uniqueDistractors.filter((word) => !hasCategory || word.category !== current.category);
  const distractors = [...shuffleArray(sameCategory), ...shuffleArray(fallback)].slice(0, 3);

  return shuffleArray([
    { id: `${current.id}-correct`, text: current.translation, isCorrect: true },
    ...distractors.map((word) => ({ id: `${current.id}-${word.id}`, text: word.translation, isCorrect: false })),
  ]);
}

function arrangeWordOrder(words: VocabularyCard[], previousWordId: string | null = null) {
  const remaining = shuffleArray(words);
  const ordered: VocabularyCard[] = [];
  let lastWordId = previousWordId;

  while (remaining.length) {
    let nextIndex = remaining.findIndex((word) => word.id !== lastWordId);
    if (nextIndex === -1) {
      nextIndex = 0;
    }
    const [nextWord] = remaining.splice(nextIndex, 1);
    ordered.push(nextWord);
    lastWordId = nextWord.id;
  }

  return ordered;
}

function buildRoundSteps(words: VocabularyCard[], createLearningStep: (kind: LearningStep["kind"], wordId: string) => LearningStep) {
  const previews = words.map((word) => createLearningStep("preview", word.id));
  const firstQuizWave = arrangeWordOrder(words);
  const secondQuizWave = arrangeWordOrder(words, firstQuizWave[firstQuizWave.length - 1]?.id ?? null);

  return [
    ...previews,
    ...firstQuizWave.map((word) => createLearningStep("quiz", word.id)),
    ...arrangeWordOrder(words).map((word) => createLearningStep("type", word.id)),
    ...secondQuizWave.map((word) => createLearningStep("quiz", word.id)),
  ];
}

function normalizeTypedVocabularyAnswer(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function formatSprintTime(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function appendQuizStepAvoidingRepeat(steps: LearningStep[], nextStep: LearningStep) {
  const copy = [...steps];
  if (copy.length === 0 || copy[copy.length - 1]?.wordId !== nextStep.wordId) {
    copy.push(nextStep);
    return copy;
  }

  for (let index = copy.length - 1; index >= 0; index -= 1) {
    const previous = copy[index];
    const after = copy[index + 1];
    if (previous.wordId !== nextStep.wordId && (!after || after.wordId !== nextStep.wordId)) {
      copy.splice(index + 1, 0, nextStep);
      return copy;
    }
  }

  copy.push(nextStep);
  return copy;
}

function mapRoundStatsToRating(stats: { correct: number; wrong: number }): VocabularyReviewRating {
  if (stats.wrong === 0 && stats.correct >= 2) {
    return "EASY";
  }

  if (stats.wrong <= 1 && stats.correct >= 1) {
    return "HARD";
  }

  return "DONT_KNOW";
}

export default function VocabularyPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [session, setSession] = useState<VocabularySession | null>(null);
  const [queue, setQueue] = useState<VocabularyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [onboardingGoal, setOnboardingGoal] = useState<number>(15);
  const [onboardingLevel, setOnboardingLevel] = useState<VocabularyLevel>("BEGINNER");
  const [placementResult, setPlacementResult] = useState<PlacementResponse | null>(null);
  const [mode, setMode] = useState<"idle" | "placement" | "round" | "round-result" | "match" | "my-words">("idle");
  const [placementIndex, setPlacementIndex] = useState(0);
  const [placementAnswers, setPlacementAnswers] = useState<PlacementAnswerDraft[]>([]);
  const [placementFeedback, setPlacementFeedback] = useState<{ selectedOptionId: string; correctOptionId: string } | null>(null);
  const [roundWords, setRoundWords] = useState<VocabularyCard[]>([]);
  const [roundSteps, setRoundSteps] = useState<LearningStep[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [roundFeedback, setRoundFeedback] = useState<{ selectedOptionId: string; correctOptionId: string } | null>(null);
  const [roundTypedAnswer, setRoundTypedAnswer] = useState("");
  const [roundTypeFeedback, setRoundTypeFeedback] = useState<"correct" | "wrong" | null>(null);
  const [roundStats, setRoundStats] = useState<Record<string, { correct: number; wrong: number }>>({});
  const [roundSummary, setRoundSummary] = useState<RoundSummary | null>(null);
  const [roundCardLeaving, setRoundCardLeaving] = useState(false);
  const [roundCelebration, setRoundCelebration] = useState<VocabularyConfettiBurst | null>(null);
  const [roundKeyboardOpen, setRoundKeyboardOpen] = useState(false);
  const [wordSearch, setWordSearch] = useState("");
  const [wordFilter, setWordFilter] = useState<"ALL" | "LEARNING" | "REVIEW" | "MASTERED">("ALL");
  const [selectedLibraryWordId, setSelectedLibraryWordId] = useState<string | null>(null);
  const [matchWords, setMatchWords] = useState<VocabularyCard[]>([]);
  const [matchTranslations, setMatchTranslations] = useState<VocabularyCard[]>([]);
  const [selectedMatchWordId, setSelectedMatchWordId] = useState<string | null>(null);
  const [matchedWordIds, setMatchedWordIds] = useState<string[]>([]);
  const [wrongMatchWordId, setWrongMatchWordId] = useState<string | null>(null);
  const [matchLines, setMatchLines] = useState<MatchLine[]>([]);
  const [matchPhase, setMatchPhase] = useState<"intro" | "playing" | "result">("intro");
  const [matchMistakes, setMatchMistakes] = useState(0);
  const [matchElapsedMs, setMatchElapsedMs] = useState(0);
  const [matchResult, setMatchResult] = useState<SprintResult | null>(null);
  const [matchSaving, setMatchSaving] = useState(false);
  const placementTimerRef = useRef<number | null>(null);
  const roundTimerRef = useRef<number | null>(null);
  const roundSwapTimerRef = useRef<number | null>(null);
  const matchTimerRef = useRef<number | null>(null);
  const matchClockRef = useRef<number | null>(null);
  const matchStartedAtRef = useRef<number | null>(null);
  const placementQuestionStartedAt = useRef<number>(Date.now());
  const roundStepCounterRef = useRef(0);
  const roundCelebrationIdRef = useRef(0);
  const roundTypeInputRef = useRef<HTMLInputElement | null>(null);
  const matchBoardRef = useRef<HTMLDivElement | null>(null);
  const matchWordRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const matchTranslationRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const resetRoundState = useCallback((clearSummary = true) => {
    if (roundTimerRef.current) {
      window.clearTimeout(roundTimerRef.current);
      roundTimerRef.current = null;
    }
    if (roundSwapTimerRef.current) {
      window.clearTimeout(roundSwapTimerRef.current);
      roundSwapTimerRef.current = null;
    }
    setRoundWords([]);
    setRoundSteps([]);
    setRoundIndex(0);
    setRoundFeedback(null);
    setRoundTypedAnswer("");
    setRoundTypeFeedback(null);
    setRoundStats({});
    setRoundCardLeaving(false);
    setRoundKeyboardOpen(false);
    roundStepCounterRef.current = 0;
    if (clearSummary) {
      setRoundSummary(null);
      setRoundCelebration(null);
    }
  }, []);

  const resetMatchState = useCallback(() => {
    if (matchTimerRef.current) {
      window.clearTimeout(matchTimerRef.current);
      matchTimerRef.current = null;
    }
    if (matchClockRef.current) {
      window.clearInterval(matchClockRef.current);
      matchClockRef.current = null;
    }
    matchStartedAtRef.current = null;
    setMatchWords([]);
    setMatchTranslations([]);
    setSelectedMatchWordId(null);
    setMatchedWordIds([]);
    setWrongMatchWordId(null);
    setMatchLines([]);
    setMatchPhase("intro");
    setMatchMistakes(0);
    setMatchElapsedMs(0);
    setMatchResult(null);
    setMatchSaving(false);
  }, []);

  const syncMatchLines = useCallback((wordIds: string[]) => {
    const board = matchBoardRef.current;
    if (!board) {
      return;
    }

    const boardBounds = board.getBoundingClientRect();
    const nextLines = wordIds.flatMap((wordId, index) => {
      const wordButton = matchWordRefs.current[wordId];
      const translationButton = matchTranslationRefs.current[wordId];
      if (!wordButton || !translationButton) {
        return [];
      }

      const wordBounds = wordButton.getBoundingClientRect();
      const translationBounds = translationButton.getBoundingClientRect();
      return [{
        wordId,
        x1: ((wordBounds.right - boardBounds.left) / boardBounds.width) * 100,
        y1: ((wordBounds.top + wordBounds.height / 2 - boardBounds.top) / boardBounds.height) * 100,
        x2: ((translationBounds.left - boardBounds.left) / boardBounds.width) * 100,
        y2: ((translationBounds.top + translationBounds.height / 2 - boardBounds.top) / boardBounds.height) * 100,
        color: matchLineColors[index % matchLineColors.length],
      }];
    });

    setMatchLines(nextLines);
  }, []);

  const createLearningStep = (kind: LearningStep["kind"], wordId: string): LearningStep => {
    roundStepCounterRef.current += 1;
    return {
      id: `${wordId}-${kind}-${roundStepCounterRef.current}`,
      kind,
      wordId,
    };
  };

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/auth/login");
    }
  }, [isLoading, router, user]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let active = true;

    const loadSession = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/vocabulary/session", { cache: "no-store" });
        const data = (await response.json()) as VocabularySessionResponse;

        if (!active) {
          return;
        }

        if (!response.ok || data.error) {
          setError(data.error ?? "Не удалось загрузить словарь.");
          setSession(null);
          setQueue([]);
          return;
        }

        setSession(data);
        setQueue(data.queue ?? []);
        setOnboardingGoal(onboardingGoals.includes(data.profile.dailyGoal as (typeof onboardingGoals)[number]) ? data.profile.dailyGoal : 15);
        setOnboardingLevel(data.profile.estimatedLevel ?? "BEGINNER");
        setPlacementResult(null);
        setPlacementIndex(0);
        setPlacementAnswers([]);
        setPlacementFeedback(null);
        setMode("idle");
        resetRoundState();
        resetMatchState();
        placementQuestionStartedAt.current = Date.now();
      } catch {
        if (!active) {
          return;
        }
        setError("Не удалось загрузить словарь.");
        setSession(null);
        setQueue([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadSession();

    return () => {
      active = false;
      if (placementTimerRef.current) {
        window.clearTimeout(placementTimerRef.current);
      }
      if (roundTimerRef.current) {
        window.clearTimeout(roundTimerRef.current);
      }
      if (roundSwapTimerRef.current) {
        window.clearTimeout(roundSwapTimerRef.current);
      }
      if (matchTimerRef.current) {
        window.clearTimeout(matchTimerRef.current);
      }
      if (matchClockRef.current) {
        window.clearInterval(matchClockRef.current);
      }
    };
  }, [user, isLoading, resetMatchState, resetRoundState, router]);

  useEffect(() => {
    if (mode !== "match" || matchedWordIds.length === 0) {
      return;
    }

    const updateLines = () => syncMatchLines(matchedWordIds);
    window.addEventListener("resize", updateLines);
    return () => window.removeEventListener("resize", updateLines);
  }, [matchedWordIds, mode, syncMatchLines]);

  useEffect(() => {
    if (!roundCelebration) {
      return;
    }

    const timeout = window.setTimeout(() => setRoundCelebration(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [roundCelebration]);

  useEffect(() => {
    placementQuestionStartedAt.current = Date.now();
  }, [placementIndex, session?.placement?.placementSessionId]);

  const placement = session?.placement ?? null;
  const activePlacementQuestion = placement?.questions[placementIndex] ?? null;
  const activeRoundStep = mode === "round" ? roundSteps[roundIndex] ?? null : null;
  const activeRoundWord = activeRoundStep ? roundWords.find((word) => word.id === activeRoundStep.wordId) ?? null : null;
  const matchCompleted = matchWords.length >= 2 && matchedWordIds.length === matchWords.length;
  const matchAttempts = matchedWordIds.length + matchMistakes;
  const liveMatchAccuracy = matchAttempts > 0 ? Math.round((matchedWordIds.length / matchAttempts) * 100) : 100;
  const matchProgress = matchWords.length > 0 ? Math.round((matchedWordIds.length / matchWords.length) * 100) : 0;

  useEffect(() => {
    if (mode !== "round" || activeRoundStep?.kind !== "type" || roundCardLeaving) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      roundTypeInputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeRoundStep?.id, activeRoundStep?.kind, mode, roundCardLeaving]);
  const activeRoundOptions = useMemo(() => {
    if (!activeRoundStep || activeRoundStep.kind !== "quiz" || !activeRoundWord) {
      return [] as LearningOption[];
    }
    return buildLearningOptions(activeRoundWord, roundWords, queue);
  }, [activeRoundStep, activeRoundWord, roundWords, queue]);
  const filteredLearnedWords = useMemo(() => {
    if (!session) return [];
    const search = wordSearch.trim().toLowerCase();
    return session.learnedWords.filter((word) => {
      const matchesFilter = wordFilter === "ALL" || word.status === wordFilter;
      const matchesSearch = !search || [word.korean, word.translation, word.transcription ?? "", word.category ?? ""]
        .some((value) => value.toLowerCase().includes(search));
      return matchesFilter && matchesSearch;
    });
  }, [session, wordFilter, wordSearch]);
  const selectedLibraryWord = session?.learnedWords.find((word) => word.id === selectedLibraryWordId) ?? null;

  const placementProgress = placement ? Math.round((placementAnswers.length / placement.totalQuestions) * 100) : 0;
  const dailyProgress = session?.profile.dailyGoal
    ? Math.min(100, Math.round(((session?.profile.wordsLearnedToday ?? 0) / session.profile.dailyGoal) * 100))
    : 0;
  const roundProgress = roundSteps.length ? Math.round(((roundIndex + 1) / roundSteps.length) * 100) : 0;
  const progressValue = session?.placementRequired ? placementProgress : mode === "round" ? roundProgress : dailyProgress;
  const placementCardKey = activePlacementQuestion ? `${activePlacementQuestion.id}-${placementIndex}` : "placement-empty";
  const roundCardKey = activeRoundStep ? activeRoundStep.id : "round-empty";

  const refreshSession = async ({
    keepRoundSummary = false,
    modeAfterRefresh = "idle",
  }: {
    keepRoundSummary?: boolean;
    modeAfterRefresh?: "idle" | "round-result";
  } = {}) => {
    const response = await fetch("/api/vocabulary/session", { cache: "no-store" });
    const data = (await response.json()) as VocabularySessionResponse;

    if (!response.ok || data.error) {
      throw new Error(data.error ?? "Не удалось обновить словарь.");
    }

    setSession(data);
    setQueue(data.queue ?? []);
    setPlacementIndex(0);
    setPlacementAnswers([]);
    setPlacementFeedback(null);
    setMode(modeAfterRefresh);
    resetRoundState(!keepRoundSummary);
    resetMatchState();
  };

  const handlePlacementStart = () => {
    setError("");
    setMode("placement");
  };

  const handleOnboardingComplete = async () => {
    if (pending) return;

    try {
      setPending(true);
      setError("");
      const response = await fetch("/api/vocabulary/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyGoal: onboardingGoal, level: onboardingLevel }),
      });
      const data = (await response.json()) as VocabularySessionResponse;
      if (!response.ok || data.error) {
        throw new Error(data.error ?? "Не удалось сохранить настройки словаря.");
      }

      setSession(data);
      setQueue(data.queue ?? []);
      setMode("idle");
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    } catch (onboardingError) {
      setError(onboardingError instanceof Error ? onboardingError.message : "Не удалось сохранить настройки словаря.");
    } finally {
      setPending(false);
    }
  };

  const handleRoundStart = (size: number, source: "new" | "review" = "new", overrideWords?: VocabularyCard[]) => {
    const sourceWords = overrideWords ?? (source === "review" ? session?.reviewWords ?? [] : session?.newWords ?? queue);
    if (!sourceWords.length) {
      return;
    }

    const selectedWords = sourceWords.slice(0, Math.min(size, sourceWords.length));
    const initialStats = Object.fromEntries(selectedWords.map((word) => [word.id, { correct: 0, wrong: 0 }])) as Record<string, { correct: number; wrong: number }>;

    roundStepCounterRef.current = 0;
    if (roundTimerRef.current) {
      window.clearTimeout(roundTimerRef.current);
      roundTimerRef.current = null;
    }

    setError("");
    setPlacementResult(null);
    setRoundSummary(null);
    setRoundWords(selectedWords);
    setRoundSteps(buildRoundSteps(selectedWords, createLearningStep));
    setRoundIndex(0);
    setRoundFeedback(null);
    setRoundTypedAnswer("");
    setRoundTypeFeedback(null);
    setRoundStats(initialStats);
    setMode("round");
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  };

  const handleMatchStart = () => {
    if (!session || session.sprint.remainingToday <= 0) {
      return;
    }

    const gamePool = session.learnedWords.length >= 2 ? session.learnedWords : [...session.reviewWords, ...session.newWords];
    const selectedWords = shuffleArray(gamePool).slice(0, Math.min(6, gamePool.length));
    if (selectedWords.length < 2) {
      return;
    }

    resetMatchState();
    setMatchWords(selectedWords);
    setMatchTranslations(shuffleArray(selectedWords));
    setMatchPhase("intro");
    setMode("match");
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const handleMatchRoundStart = () => {
    if (!session || matchWords.length < 2 || session.sprint.remainingToday <= 0) {
      return;
    }

    setMatchPhase("playing");
    setMatchElapsedMs(0);
    setMatchMistakes(0);
    setMatchedWordIds([]);
    setMatchLines([]);
    setSelectedMatchWordId(null);
    setMatchResult(null);
    setError("");
    matchStartedAtRef.current = Date.now();
    matchClockRef.current = window.setInterval(() => {
      if (matchStartedAtRef.current) {
        setMatchElapsedMs(Date.now() - matchStartedAtRef.current);
      }
    }, 200);
  };

  const saveMatchSprintResult = async (durationMs: number, mistakeCount: number) => {
    setMatchSaving(true);
    try {
      const response = await fetch("/api/vocabulary/sprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wordIds: matchWords.map((word) => word.id),
          mistakeCount,
          durationMs,
        }),
      });
      const data = (await response.json()) as SprintResult;
      if (!response.ok || data.error) {
        throw new Error(data.error ?? "Не удалось сохранить результат спринта.");
      }

      setMatchResult(data);
      setSession((current) => current ? { ...current, sprint: data.sprint } : current);
    } catch (sprintError) {
      setError(sprintError instanceof Error ? sprintError.message : "Не удалось сохранить результат спринта.");
    } finally {
      setMatchSaving(false);
    }
  };

  const handleMatchWordSelect = (wordId: string) => {
    if (matchedWordIds.includes(wordId)) {
      return;
    }

    setWrongMatchWordId(null);
    setSelectedMatchWordId(wordId);
  };

  const handleMatchTranslationSelect = (wordId: string) => {
    if (!selectedMatchWordId || matchedWordIds.includes(wordId) || matchTimerRef.current) {
      return;
    }

    if (selectedMatchWordId !== wordId) {
      setWrongMatchWordId(wordId);
      setMatchMistakes((current) => current + 1);
      matchTimerRef.current = window.setTimeout(() => {
        setWrongMatchWordId(null);
        setSelectedMatchWordId(null);
        matchTimerRef.current = null;
      }, 520);
      return;
    }

    const nextMatchedWordIds = [...matchedWordIds, wordId];
    setMatchedWordIds(nextMatchedWordIds);
    setSelectedMatchWordId(null);
    setWrongMatchWordId(null);
    window.requestAnimationFrame(() => syncMatchLines(nextMatchedWordIds));

    if (nextMatchedWordIds.length === matchWords.length) {
      const durationMs = Math.max(1000, Date.now() - (matchStartedAtRef.current ?? Date.now()));
      setMatchElapsedMs(durationMs);
      if (matchClockRef.current) {
        window.clearInterval(matchClockRef.current);
        matchClockRef.current = null;
      }
      matchTimerRef.current = window.setTimeout(() => {
        setMatchPhase("result");
        matchTimerRef.current = null;
        void saveMatchSprintResult(durationMs, matchMistakes);
      }, 700);
    }
  };

  const finalizeRound = async (finalStats: Record<string, { correct: number; wrong: number }>, finalWords: VocabularyCard[]) => {
    const totalCorrect = finalWords.reduce((sum, word) => sum + (finalStats[word.id]?.correct ?? 0), 0);
    const totalWrong = finalWords.reduce((sum, word) => sum + (finalStats[word.id]?.wrong ?? 0), 0);
    const summary: RoundSummary = {
      selectedCount: finalWords.length,
      masteredCount: finalWords.filter((word) => (finalStats[word.id]?.wrong ?? 0) === 0).length,
      needsReviewCount: finalWords.filter((word) => (finalStats[word.id]?.wrong ?? 0) > 0).length,
      accuracy: totalCorrect + totalWrong > 0 ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100) : 100,
      words: finalWords.map((word) => ({
        id: word.id,
        korean: word.korean,
        translation: word.translation,
        transcription: word.transcription,
        mastered: (finalStats[word.id]?.wrong ?? 0) === 0,
      })),
    };

    setRoundSummary(summary);
    setMode("round-result");
    setPending(true);
    setError("");
    roundCelebrationIdRef.current += 1;
    setRoundCelebration({
      id: roundCelebrationIdRef.current,
      pieces: createVocabularyConfetti({ x: window.innerWidth / 2, y: window.innerHeight * 0.38 }, 72),
    });
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));

    try {
      await Promise.all(
        finalWords.map(async (word) => {
          const rating = mapRoundStatsToRating(finalStats[word.id] ?? { correct: 0, wrong: 2 });
          const response = await fetch("/api/vocabulary/review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wordId: word.id, rating }),
          });
          const data = (await response.json()) as ReviewResponse;
          if (!response.ok || data.error) {
            throw new Error(data.error ?? "Не удалось сохранить прогресс по слову.");
          }
        }),
      );

      await refreshSession({ keepRoundSummary: true, modeAfterRefresh: "round-result" });
    } catch (roundError) {
      setError(roundError instanceof Error ? roundError.message : "Не удалось завершить раунд.");
    } finally {
      setPending(false);
      setRoundFeedback(null);
    }
  };

  const handlePlacementAnswer = async (optionId: string) => {
    if (!placement || !activePlacementQuestion || placementFeedback || pending) {
      return;
    }

    const nextAnswer = {
      questionId: activePlacementQuestion.id,
      selectedOptionId: optionId,
      responseTimeMs: Date.now() - placementQuestionStartedAt.current,
    };
    const nextAnswers = [...placementAnswers, nextAnswer];

    setPlacementAnswers(nextAnswers);
    setPlacementFeedback({ selectedOptionId: optionId, correctOptionId: activePlacementQuestion.correctOptionId });

    placementTimerRef.current = window.setTimeout(async () => {
      if (placementIndex + 1 < placement.totalQuestions) {
        setPlacementIndex((prev) => prev + 1);
        setPlacementFeedback(null);
        return;
      }

      setPending(true);
      setError("");

      try {
        const response = await fetch("/api/vocabulary/placement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ placementSessionId: placement.placementSessionId, answers: nextAnswers }),
        });
        const data = (await response.json()) as PlacementResponse;

        if (!response.ok || data.error || !data.placementResult) {
          throw new Error(data.error ?? "Не удалось завершить тест.");
        }

        setPlacementResult(data);
        await refreshSession();
      } catch (placementError) {
        setError(placementError instanceof Error ? placementError.message : "Не удалось завершить тест.");
      } finally {
        setPending(false);
        setPlacementFeedback(null);
      }
    }, 800);
  };

  const handleRoundPreviewContinue = () => {
    if (!activeRoundStep || activeRoundStep.kind !== "preview" || roundCardLeaving) {
      return;
    }

    setRoundCardLeaving(true);
    roundSwapTimerRef.current = window.setTimeout(() => {
      roundSwapTimerRef.current = null;
      if (roundIndex + 1 < roundSteps.length) {
        setRoundIndex((prev) => prev + 1);
        setRoundCardLeaving(false);
        return;
      }

      setRoundCardLeaving(false);
      void finalizeRound(roundStats, roundWords);
    }, 380);
  };

  const celebrateRoundAnswer = (source?: HTMLElement | null) => {
    const bounds = source?.getBoundingClientRect();
    const origin = bounds
      ? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
      : { x: window.innerWidth / 2, y: window.innerHeight * 0.52 };

    roundCelebrationIdRef.current += 1;
    setRoundCelebration({
      id: roundCelebrationIdRef.current,
      pieces: createVocabularyConfetti(origin, 30),
    });
  };

  const handleRoundAnswer = (optionId: string, event?: ReactMouseEvent<HTMLButtonElement>) => {
    if (!activeRoundStep || activeRoundStep.kind !== "quiz" || !activeRoundWord || roundFeedback || pending || roundCardLeaving) {
      return;
    }

    const correctOption = activeRoundOptions.find((option) => option.isCorrect);
    if (!correctOption) {
      return;
    }

    const isCorrect = correctOption.id === optionId;
    if (isCorrect) {
      celebrateRoundAnswer(event?.currentTarget);
    }
    const nextStats = {
      ...roundStats,
      [activeRoundWord.id]: {
        correct: (roundStats[activeRoundWord.id]?.correct ?? 0) + (isCorrect ? 1 : 0),
        wrong: (roundStats[activeRoundWord.id]?.wrong ?? 0) + (isCorrect ? 0 : 1),
      },
    };
    const nextSteps = isCorrect ? roundSteps : appendQuizStepAvoidingRepeat(roundSteps, createLearningStep("quiz", activeRoundWord.id));

    setRoundStats(nextStats);
    setRoundSteps(nextSteps);
    setRoundFeedback({ selectedOptionId: optionId, correctOptionId: correctOption.id });

    roundTimerRef.current = window.setTimeout(() => {
      setRoundCardLeaving(true);
      roundTimerRef.current = null;
      roundSwapTimerRef.current = window.setTimeout(async () => {
        roundSwapTimerRef.current = null;
        setRoundFeedback(null);
        setRoundTypedAnswer("");
        setRoundTypeFeedback(null);
        const nextIndex = roundIndex + 1;
        if (nextIndex < nextSteps.length) {
          setRoundIndex(nextIndex);
          setRoundCardLeaving(false);
          return;
        }
        setRoundCardLeaving(false);
        await finalizeRound(nextStats, roundWords);
      }, 380);
    }, 620);
  };

  const handleRoundTypeSubmit = (event?: ReactMouseEvent<HTMLButtonElement>) => {
    if (!activeRoundStep || activeRoundStep.kind !== "type" || !activeRoundWord || pending || roundCardLeaving) {
      return;
    }

    if (roundTypeFeedback === "correct") {
      return;
    }

    const isCorrect =
      normalizeTypedVocabularyAnswer(roundTypedAnswer) ===
      normalizeTypedVocabularyAnswer(activeRoundWord.korean);

    if (!isCorrect && roundTypeFeedback !== "wrong") {
      setRoundTypeFeedback("wrong");
      return;
    }

    if (isCorrect) {
      celebrateRoundAnswer(event?.currentTarget);
    }

    const nextStats = {
      ...roundStats,
      [activeRoundWord.id]: {
        correct: (roundStats[activeRoundWord.id]?.correct ?? 0) + (isCorrect ? 1 : 0),
        wrong:
          (roundStats[activeRoundWord.id]?.wrong ?? 0) +
          (!isCorrect || roundTypeFeedback === "wrong" ? 1 : 0),
      },
    };
    const nextSteps = isCorrect
      ? roundSteps
      : appendQuizStepAvoidingRepeat(roundSteps, createLearningStep("quiz", activeRoundWord.id));
    const nextIndex = roundIndex + 1;

    setRoundStats(nextStats);
    setRoundSteps(nextSteps);

    if (isCorrect) {
      setRoundTypeFeedback("correct");
      roundTimerRef.current = window.setTimeout(() => {
        setRoundCardLeaving(true);
        roundTimerRef.current = null;
        roundSwapTimerRef.current = window.setTimeout(async () => {
          roundSwapTimerRef.current = null;
          setRoundTypedAnswer("");
          setRoundTypeFeedback(null);

          if (nextIndex < nextSteps.length) {
            setRoundIndex(nextIndex);
            setRoundCardLeaving(false);
            return;
          }

          setRoundCardLeaving(false);
          await finalizeRound(nextStats, roundWords);
        }, 380);
      }, 520);
      return;
    }

    setRoundCardLeaving(true);
    roundSwapTimerRef.current = window.setTimeout(() => {
      roundSwapTimerRef.current = null;
      setRoundTypedAnswer("");
      setRoundTypeFeedback(null);

      if (nextIndex < nextSteps.length) {
        setRoundIndex(nextIndex);
        setRoundCardLeaving(false);
        return;
      }

      setRoundCardLeaving(false);
      void finalizeRound(nextStats, roundWords);
    }, 380);
  };

  const handleRoundKeyboardInput = (action: KoreanKeyboardAction) => {
    setRoundTypedAnswer((current) => {
      if (action === "backspace") return removeLastHangulInput(current);
      if (action === "space") return `${current} `;
      return appendHangulInput(current, action);
    });
    setRoundTypeFeedback(null);
  };

  if (isLoading || loading) {
    return (
      <PageSection>
        <Shell>
          <VocabularyLoader role="status" aria-live="polite" aria-label="Загружаем персональный словарь">
            <LoaderGlow aria-hidden="true" />
            <LoaderWords aria-hidden="true">
              <span>안녕</span><span>책</span><span>물</span><span>공부</span>
            </LoaderWords>
            <LoaderDeck aria-hidden="true">
              <i /><i />
              <LoaderCard>
                <LoaderCardIcon>가</LoaderCardIcon>
                <LoaderCardLines><span /><span /><span /></LoaderCardLines>
              </LoaderCard>
            </LoaderDeck>
            <LoaderCopy>
              <small>나의 단어장</small>
              <strong>Собираем твой словарь</strong>
              <span>Подбираем новые слова и план повторений</span>
            </LoaderCopy>
            <LoaderProgress aria-hidden="true"><span /></LoaderProgress>
            <LoaderDots aria-hidden="true"><i /><i /><i /></LoaderDots>
          </VocabularyLoader>
        </Shell>
      </PageSection>
    );
  }

  if (!user) {
    return null;
  }

  if (!session) {
    return <PageSection><Shell><StateCard>Не удалось загрузить словарь.</StateCard></Shell></PageSection>;
  }

  return (
    <PageSection>
      {roundCelebration && typeof document !== "undefined"
        ? createPortal(
            <VocabularyConfetti key={roundCelebration.id} aria-hidden="true">
              {roundCelebration.pieces.map((style, index) => <span key={index} style={style} />)}
            </VocabularyConfetti>,
            document.body,
          )
        : null}
      <Shell>
        {session.onboardingRequired ? (
          <OnboardingScreen>
            <OnboardingIntro>
              <OnboardingBadge><span>✦</span> Первый шаг</OnboardingBadge>
              <OnboardingTitle>Настроим словарь под твой темп</OnboardingTitle>
              <OnboardingText>
                Выбери комфортную цель и текущий уровень. Это не экзамен — настройки лишь помогают собрать твою первую очередь слов.
              </OnboardingText>
              <OnboardingMascot>
                <Image src="/assets/mascot.svg" alt="Маскот Rinae помогает настроить словарь" width={230} height={250} priority />
              </OnboardingMascot>
              <OnboardingPromise>
                <span>80%</span>
                <div><strong>твоего уровня</strong><small>и немного соседнего — для мягкого роста</small></div>
              </OnboardingPromise>
            </OnboardingIntro>

            <OnboardingForm>
              <OnboardingSection>
                <OnboardingSectionHeading>
                  <span>01</span>
                  <div><strong>Сколько слов в день?</strong><small>Цель можно выполнить за несколько коротких раундов.</small></div>
                </OnboardingSectionHeading>
                <GoalChoiceGrid>
                  {onboardingGoals.map((goal) => (
                    <GoalChoice
                      key={goal}
                      type="button"
                      $selected={onboardingGoal === goal}
                      aria-pressed={onboardingGoal === goal}
                      onClick={() => setOnboardingGoal(goal)}
                    >
                      <strong>{goal}</strong><span>слов</span><small>{goal <= 5 ? "легко начать" : goal <= 10 ? "спокойный темп" : goal <= 15 ? "рекомендуем" : "интенсивно"}</small>
                    </GoalChoice>
                  ))}
                </GoalChoiceGrid>
              </OnboardingSection>

              <OnboardingSection>
                <OnboardingSectionHeading>
                  <span>02</span>
                  <div><strong>С какого уровня начнём?</strong><small>Большинство слов будет отсюда, но иногда добавим соседний уровень.</small></div>
                </OnboardingSectionHeading>
                <LevelChoiceGrid>
                  {onboardingLevels.map((level) => (
                    <LevelChoice
                      key={level.value}
                      type="button"
                      $selected={onboardingLevel === level.value}
                      aria-pressed={onboardingLevel === level.value}
                      onClick={() => setOnboardingLevel(level.value)}
                    >
                      <LevelChoiceCheck aria-hidden="true">{onboardingLevel === level.value ? "✓" : ""}</LevelChoiceCheck>
                      <small>{level.eyebrow}</small>
                      <strong>{level.title}</strong>
                      <p>{level.description}</p>
                      <em lang="ko">{level.sample}</em>
                    </LevelChoice>
                  ))}
                </LevelChoiceGrid>
              </OnboardingSection>

              {error ? <ErrorCard>{error}</ErrorCard> : null}
              <OnboardingSubmit type="button" disabled={pending} onClick={() => void handleOnboardingComplete()}>
                <span>{pending ? "Сохраняем настройки..." : `Начать с целью ${onboardingGoal} слов`}</span><b aria-hidden="true">→</b>
              </OnboardingSubmit>
              <OnboardingFootnote>Без теста и оценки · настройки можно будет изменить позже</OnboardingFootnote>
            </OnboardingForm>
          </OnboardingScreen>
        ) : mode === "idle" ? (
          session.placementRequired ? <IntroGrid>
            <HeroCard>
              <Eyebrow>
                {session.placementRequired
                  ? "Стартовый тест"
                  : roundSummary
                    ? "Раунд завершён"
                    : placementResult?.placementResult
                      ? "Тест завершён"
                      : "Словарь"}
              </Eyebrow>
              <HeroTitle>
                {session.placementRequired
                  ? "Короткий тест быстро определит реальный словарный старт"
                  : roundSummary
                    ? "Раунд закончен. Можешь взять следующую порцию слов"
                    : placementResult?.placementResult
                      ? "Уровень определён. Теперь спокойно выбери объём слов"
                      : "Выбери свой темп и открывай новые слова"}
              </HeroTitle>
              <HeroText>
                {session.placementRequired
                  ? "Сначала определим стартовый уровень. После этого словарь откроется отдельным раундом, без резкого перехода прямо из теста в обучение."
                  : roundSummary
                    ? `В последнем раунде было ${roundSummary.selectedCount} слов. Без ошибок прошли ${roundSummary.masteredCount}, ещё ${roundSummary.needsReviewCount} вернутся позже для закрепления.`
                    : placementResult?.placementResult
                      ? "Тест уже закончен. Теперь выбери, сколько слов хочешь взять в этот заход: 5, 10, 15 или 20."
                      : "Короткие спокойные раунды помогают запоминать корейские слова без перегруза. Сначала знакомство, затем проверка и небольшое повторение."}
              </HeroText>

              {!session.placementRequired ? (
                <LearningStats>
                  <LearningStat>
                    <LearningStatIcon $tone="orange">🔥</LearningStatIcon>
                    <span><strong>{session.profile.wordsLearnedToday}</strong> сегодня</span>
                  </LearningStat>
                  <LearningStat>
                    <LearningStatIcon $tone="green">✓</LearningStatIcon>
                    <span><strong>{session.profile.masteredCount}</strong> освоено</span>
                  </LearningStat>
                  <LearningStat>
                    <LearningStatIcon $tone="purple">◆</LearningStatIcon>
                    <span><strong>{session.profile.dailyGoal}</strong> цель дня</span>
                  </LearningStat>
                </LearningStats>
              ) : null}

              {session.placementRequired ? (
                <ActionRow>
                  <PrimaryButton type="button" onClick={handlePlacementStart}>Начать тест</PrimaryButton>
                </ActionRow>
              ) : (
                <>
                  <RoundChooser>
                    <RoundChooserTitle>Выбери объём раунда</RoundChooserTitle>
                    <RoundChooserText>Возьми столько слов, сколько удобно сейчас. Если доступно меньше, мы соберём раунд из всей готовой очереди.</RoundChooserText>
                    <RoundSizeGrid>
                    {roundPresets.map(({ size, title, badge }, index) => {
                      const disabled = queue.length === 0 || pending;
                      const availableWords = Math.min(size, queue.length);
                      return (
                        <RoundSizeButton
                          key={size}
                          type="button"
                          $tone={index}
                          disabled={disabled}
                          onClick={() => handleRoundStart(size)}
                        >
                          <RoundSizeTop>
                            <RoundChoiceBadge>{badge}</RoundChoiceBadge>
                            <RoundSizeNumber>{size}</RoundSizeNumber>
                            <RoundOrbCaption>слов</RoundOrbCaption>
                          </RoundSizeTop>
                          <RoundSizeLabel>{title}</RoundSizeLabel>
                          <RoundSizeMeta>
                            {queue.length >= size ? `${size} новых слов` : `сейчас доступно ${queue.length}`}
                          </RoundSizeMeta>
                          <RoundSizeAction>
                            <span>{queue.length >= size ? "Выбрать" : `Взять ${availableWords}`}</span>
                            <RoundPlayIcon aria-hidden="true">→</RoundPlayIcon>
                          </RoundSizeAction>
                        </RoundSizeButton>
                      );
                    })}
                  </RoundSizeGrid>
                  </RoundChooser>
                </>
              )}

              {session.placementRequired ? (
                <BulletList>
                  <BulletItem>8-10 вопросов, категории смешиваются автоматически.</BulletItem>
                  <BulletItem>Только корейское слово и четыре варианта ответа.</BulletItem>
                  <BulletItem>После теста очередь слов строится по реальным ошибкам.</BulletItem>
                </BulletList>
              ) : null}
            </HeroCard>

            <SideColumn>
              {placementResult?.placementResult ? (
                <InfoCard>
                  <MiniLabel>Результат теста</MiniLabel>
                  <BigValue>{placementResult.placementBandLabel ?? placementResult.placementResult.level}</BigValue>
                  <MiniText>{placementResult.placementBandDescription ?? placementBandCopy[placementResult.placementResult.level]}</MiniText>
                  <ResultMeta>{placementResult.placementResult.correctAnswers} / {placementResult.placementResult.totalQuestions} правильных • балл {placementResult.placementResult.score}</ResultMeta>
                </InfoCard>
              ) : null}

              <InfoCard>
                <MiniLabel>{session.placementRequired ? "Стартовый режим" : "Сегодняшний объём"}</MiniLabel>
                <BigValue>{session.placementRequired ? `${placement?.totalQuestions ?? 0} вопросов` : `Готово к открытию: ${queue.length} новых слов`}</BigValue>
                <MiniText>
                  {session.placementRequired
                    ? "Тест показывает реальный старт, без самооценки и догадок."
                    : `Уровень ${session.profile.levelLabel ?? "ещё не определён"}. За сегодня уже разобрано ${session.profile.wordsLearnedToday} слов.`}
                </MiniText>
                <ProgressBar><ProgressFill $value={progressValue} /></ProgressBar>
              </InfoCard>

              {!session.placementRequired ? (
                <MatchGamePromo
                  type="button"
                  disabled={queue.length < 2 || pending || session.sprint.remainingToday <= 0}
                  onClick={handleMatchStart}
                >
                  <MatchPromoTopLine>
                    <MatchPromoIcon aria-hidden="true">🎮</MatchPromoIcon>
                    <MatchPromoBadge>
                      {session.sprint.playedToday} / {session.sprint.dailyLimit} сегодня · {session.sprint.xpToday} XP
                    </MatchPromoBadge>
                  </MatchPromoTopLine>
                  <MatchPromoTitle>Соедини корейскую пару</MatchPromoTitle>
                  <MatchPromoText>
                    Найди перевод для каждого слова. Правильные пары соединятся цветной линией.
                  </MatchPromoText>
                  <MatchPromoDemo aria-hidden="true">
                    <MatchPairRow><span>책</span><i /><span>книга</span></MatchPairRow>
                    <MatchPairRow><span>물</span><i /><span>вода</span></MatchPairRow>
                  </MatchPromoDemo>
                  <MatchPromoAction>
                    {queue.length < 2
                      ? "Нужно минимум 2 слова"
                      : session.sprint.remainingToday <= 0
                        ? "Спринты на сегодня завершены"
                        : `Играть · осталось ${session.sprint.remainingToday}`}<span>→</span>
                  </MatchPromoAction>
                </MatchGamePromo>
              ) : null}

              {session.placementRequired ? (
                <InfoCard>
                  <MiniLabel>Пример теста</MiniLabel>
                  <PreviewWord>의자</PreviewWord>
                  <MiniText>Выбери правильный перевод</MiniText>
                  <OptionPreviewGrid>
                    <OptionPreview>стол</OptionPreview>
                    <OptionPreview $correct>стул</OptionPreview>
                    <OptionPreview>окно</OptionPreview>
                    <OptionPreview>дверь</OptionPreview>
                  </OptionPreviewGrid>
                </InfoCard>
              ) : null}
            </SideColumn>
          </IntroGrid> : <VocabularyHub>
            <VocabularyHubHero>
              <VocabularyHeroCopy>
                <Eyebrow>Словарь</Eyebrow>
                <HeroTitle>Продолжай учить корейский в своём темпе</HeroTitle>
                <HeroText>Новые слова, умное повторение и твоя личная коллекция — всё для короткой ежедневной практики.</HeroText>
                <HubStats>
                  <HubStat><span>🔥</span><div><strong>{session.profile.wordsLearnedToday} / {session.profile.dailyGoal}</strong><small>сегодня</small></div></HubStat>
                  <HubStat><span>🔄</span><div><strong>{session.profile.dueReviewCount}</strong><small>на повторение</small></div></HubStat>
                  <HubStat><span>📚</span><div><strong>{session.profile.learnedCount}</strong><small>изучено</small></div></HubStat>
                </HubStats>
              </VocabularyHeroCopy>
              <TodayPanel>
                <MascotWrap><Image src="/assets/mascot.svg" alt="" width={180} height={200} /></MascotWrap>
                <TodayPanelCopy><small>Твой прогресс сегодня</small><strong>{session.profile.wordsLearnedToday} / {session.profile.dailyGoal} слов</strong><span>{dailyProgress >= 100 ? "Цель выполнена — великолепно!" : `Осталось ${Math.max(0, session.profile.dailyGoal - session.profile.wordsLearnedToday)} слов`}</span></TodayPanelCopy>
                <ProgressBar><ProgressFill $value={dailyProgress} /></ProgressBar>
              </TodayPanel>
            </VocabularyHubHero>

            <HubPrimaryGrid>
              <HubActionCard $tone="new">
                <HubActionIcon>🆕</HubActionIcon>
                <div><small>Новые слова</small><strong>{session.newWords.length} готовы к открытию</strong><p>Познакомься с новыми словами и закрепи их в коротком раунде.</p></div>
                <HubActionButton type="button" disabled={!session.newWords.length || pending} onClick={() => handleRoundStart(Math.min(10, session.newWords.length), "new")}>Учить новые <span>→</span></HubActionButton>
              </HubActionCard>
              <HubActionCard $tone="review">
                <HubActionIcon>🔄</HubActionIcon>
                <div><small>Повторение</small><strong>{session.reviewWords.length ? `${session.reviewWords.length} слов ждут тебя` : "На сегодня всё готово"}</strong><p>{session.reviewWords.length ? "Вернись к изученным словам вовремя, чтобы сохранить их в памяти." : "Ты повторил всё запланированное. Можно открыть новые слова."}</p></div>
                <ReviewLevels>
                  <span>🟢 Легко — {session.reviewWords.filter((word) => word.stats.currentStreak >= 2).length}</span>
                  <span>🟡 Повторить — {session.reviewWords.filter((word) => word.stats.currentStreak === 1).length}</span>
                  <span>🔴 Сложно — {session.reviewWords.filter((word) => word.stats.currentStreak === 0).length}</span>
                </ReviewLevels>
                <HubActionButton type="button" disabled={!session.reviewWords.length || pending} onClick={() => handleRoundStart(session.reviewWords.length, "review")}>Начать повторение <span>→</span></HubActionButton>
              </HubActionCard>
            </HubPrimaryGrid>

            <RoundChooser>
              <RoundChooserTitle>Сколько новых слов возьмём?</RoundChooserTitle>
              <RoundChooserText>Выбери комфортный объём. Ты всегда сможешь вернуться за следующей порцией.</RoundChooserText>
              <RoundSizeGrid>
                {roundPresets.map(({ size, title, badge }, index) => {
                  const availableWords = Math.min(size, session.newWords.length);
                  return <RoundSizeButton key={size} type="button" $tone={index} disabled={!session.newWords.length || pending} onClick={() => handleRoundStart(size, "new")}>
                    <RoundSizeTop><RoundChoiceBadge>{badge}</RoundChoiceBadge><RoundSizeNumber>{size}</RoundSizeNumber><RoundOrbCaption>слов</RoundOrbCaption></RoundSizeTop>
                    <RoundSizeLabel>{title}</RoundSizeLabel><RoundSizeMeta>{availableWords ? `${availableWords} доступно сейчас` : "новые слова закончились"}</RoundSizeMeta>
                    <RoundSizeAction><span>Выбрать</span><RoundPlayIcon>→</RoundPlayIcon></RoundSizeAction>
                  </RoundSizeButton>;
                })}
              </RoundSizeGrid>
            </RoundChooser>

            <HubLowerGrid>
              <GamesHubCard>
                <GamePromoArtwork aria-hidden="true">
                  <Image src="/assets/match_game.png" alt="" fill sizes="(max-width: 760px) 100vw, 34vw" />
                </GamePromoArtwork>
                <div><small>🎮 Мини-игры</small><strong>Играй и укрепляй память</strong><p>Соединяй корейские слова с переводом и получай XP за точность.</p></div>
                <MatchPromoDemo aria-hidden="true">
                  <MatchPairRow><span>책</span><i /><span>книга</span></MatchPairRow>
                  <MatchPairRow><span>물</span><i /><span>вода</span></MatchPairRow>
                </MatchPromoDemo>
                <HubActionButton type="button" disabled={session.learnedWords.length < 2 || pending || session.sprint.remainingToday <= 0} onClick={handleMatchStart}>Соедини пару · {session.sprint.remainingToday} <span>→</span></HubActionButton>
              </GamesHubCard>
              <MyWordsPromo type="button" onClick={() => setMode("my-words")}>
                <span>📚</span><div><small>Мои слова</small><strong>{session.profile.learnedCount} слов в коллекции</strong><p>Найди слово, посмотри пример и проверь его статус.</p>
                  <MyWordsPreview>
                    {session.learnedWords.slice(0, 3).map((word) => <span key={word.id}><b>{word.korean}</b><i>{word.translation}</i></span>)}
                    {!session.learnedWords.length ? <em>Здесь появятся первые изученные слова</em> : null}
                  </MyWordsPreview>
                </div><MyWordsOpen>Открыть коллекцию <i>→</i></MyWordsOpen>
              </MyWordsPromo>
            </HubLowerGrid>
          </VocabularyHub>
        ) : mode === "my-words" ? (
          <MyWordsScreen>
            <MyWordsHeader>
              <button type="button" onClick={() => { setMode("idle"); setSelectedLibraryWordId(null); }}>← Словарь</button>
              <div><Eyebrow>Личная коллекция</Eyebrow><HeroTitle>Мои слова</HeroTitle><HeroText>{session.profile.learnedCount} изученных слов всегда под рукой.</HeroText></div>
              <LibraryMascot><Image src="/assets/mascot.svg" alt="" width={140} height={140} /></LibraryMascot>
            </MyWordsHeader>
            <LibraryToolbar>
              <LibrarySearch><span>⌕</span><input value={wordSearch} onChange={(event) => setWordSearch(event.target.value)} placeholder="Найти корейское слово или перевод..." /></LibrarySearch>
              <LibraryFilters>{([['ALL','Все'],['LEARNING','Изучаю'],['REVIEW','Повторить'],['MASTERED','Освоено']] as const).map(([value,label]) => <button key={value} type="button" data-active={wordFilter === value} onClick={() => setWordFilter(value)}>{label}</button>)}</LibraryFilters>
            </LibraryToolbar>
            <LibraryGrid>
              <LibraryList>
                {filteredLearnedWords.length ? filteredLearnedWords.map((word) => <LibraryWordButton key={word.id} type="button" $status={word.status} onClick={() => setSelectedLibraryWordId(word.id)}>
                  <LibraryStatusDot /><div><strong>{word.korean}</strong><small>{word.transcription ? `[${word.transcription}] · ` : ""}{word.translation}</small></div><span>{word.status === 'MASTERED' ? 'Освоено' : word.status === 'REVIEW' ? 'Повторить' : 'Изучаю'}</span>
                </LibraryWordButton>) : <LibraryEmpty>По этому запросу слов пока нет.</LibraryEmpty>}
              </LibraryList>
              <LibraryDetail>
                {selectedLibraryWord ? <>
                  <LibraryDetailStatus $status={selectedLibraryWord.status}>{selectedLibraryWord.status === 'MASTERED' ? '✓ Освоено' : selectedLibraryWord.status === 'REVIEW' ? '↻ Пора повторить' : '◆ Изучается'}</LibraryDetailStatus>
                  <h2>{selectedLibraryWord.korean}</h2>{selectedLibraryWord.transcription ? <h3>[{selectedLibraryWord.transcription}]</h3> : null}<h4>{selectedLibraryWord.translation}</h4>
                  {selectedLibraryWord.exampleKorean ? <LibraryExample><strong>{selectedLibraryWord.exampleKorean}</strong><span>{selectedLibraryWord.exampleRussian}</span></LibraryExample> : <LibraryExample><span>Пример для этого слова пока не добавлен.</span></LibraryExample>}
                  <HubActionButton type="button" onClick={() => { handleRoundStart(1, "review", [selectedLibraryWord]); }}>Повторить слово <span>→</span></HubActionButton>
                </> : <LibraryDetailPlaceholder><span>가</span><strong>Выбери слово</strong><p>Здесь появятся перевод, пример и текущий статус.</p></LibraryDetailPlaceholder>}
              </LibraryDetail>
            </LibraryGrid>
          </MyWordsScreen>
        ) : mode === "round-result" ? (
          <RoundResultScreen>
            <RoundResultCard>
              <RoundResultDecor aria-hidden="true">
                <i>가</i><i>별</i><i>잘했어요!</i><i>꿈</i><i>✦</i>
              </RoundResultDecor>

              <RoundResultTopGrid>
                <RoundResultHero>
                  <RoundResultStatus $saving={pending}>
                    <span>{pending ? "↻" : "✓"}</span>
                    {pending ? "Сохраняем прогресс..." : "Прогресс сохранён"}
                  </RoundResultStatus>
                  <RoundResultMedal aria-hidden="true">
                    <span>★</span>
                    <i>✦</i><i>✦</i><i>✦</i>
                  </RoundResultMedal>
                  <RoundResultEyebrow>Раунд завершён</RoundResultEyebrow>
                  <RoundResultTitle>
                    {roundSummary?.masteredCount === roundSummary?.selectedCount ? "Идеально!" : "Отличная работа!"}
                  </RoundResultTitle>
                  <RoundResultLead>
                    {roundSummary
                      ? roundSummary.needsReviewCount === 0
                        ? `Все ${roundSummary.selectedCount} слов пройдены без ошибок. Вот это память!`
                        : `Ты укрепил ${roundSummary.selectedCount} слов. Сложные слова вернутся позже — так они запомнятся надолго.`
                      : "Собираем результаты раунда..."}
                  </RoundResultLead>
                  {roundSummary ? (
                    <RoundResultPraise>
                      <span aria-hidden="true">⚡</span>
                      {roundSummary.accuracy >= 90 ? "Суперточность" : roundSummary.accuracy >= 70 ? "Уверенный темп" : "Хорошая тренировка"}
                    </RoundResultPraise>
                  ) : null}
                </RoundResultHero>

                {roundSummary ? (
                  <RoundScoreBoard>
                    <RoundScoreHeading>
                      <div><small>Твой результат</small><strong>Сильный раунд</strong></div>
                      <span>+{roundSummary.masteredCount} слов</span>
                    </RoundScoreHeading>

                    <RoundScoreMain>
                      <RoundAccuracyRing $value={roundSummary.accuracy}>
                        <div><strong>{roundSummary.accuracy}%</strong><small>точность</small></div>
                      </RoundAccuracyRing>
                      <RoundResultStats>
                        <RoundResultStat $tone="green"><span>✓</span><div><strong>{roundSummary.masteredCount}</strong><small>без ошибок</small></div></RoundResultStat>
                        <RoundResultStat $tone="orange"><span>↻</span><div><strong>{roundSummary.needsReviewCount}</strong><small>на повторение</small></div></RoundResultStat>
                        <RoundResultStat $tone="blue"><span>✦</span><div><strong>{session.profile.wordsLearnedToday}</strong><small>слов сегодня</small></div></RoundResultStat>
                      </RoundResultStats>
                    </RoundScoreMain>

                    <RoundTodayProgress>
                      <div>
                        <span><strong>Цель на сегодня</strong><small>{dailyProgress >= 100 ? "Цель выполнена!" : `Ещё ${Math.max(0, session.profile.dailyGoal - session.profile.wordsLearnedToday)} слов до цели`}</small></span>
                        <b>{session.profile.wordsLearnedToday} / {session.profile.dailyGoal}</b>
                      </div>
                      <LearningProgressTrack>
                        <LearningProgressFill $value={dailyProgress} />
                      </LearningProgressTrack>
                    </RoundTodayProgress>
                  </RoundScoreBoard>
                ) : null}
              </RoundResultTopGrid>

              {roundSummary ? (
                <RoundWordsSection>
                  <RoundWordsHeading>
                    <div><small>Твоя коллекция</small><span>Слова этого раунда</span></div>
                    <b>{roundSummary.selectedCount} слов</b>
                  </RoundWordsHeading>
                  <RoundWordsGrid>
                    {roundSummary.words.map((word, index) => (
                      <RoundWordChip key={word.id} $mastered={word.mastered} style={{ "--word-delay": `${index * 55}ms` } as CSSProperties}>
                        <span>{word.mastered ? "✓" : "↻"}</span>
                        <div><strong>{word.korean}</strong><small>{word.translation}</small></div>
                        <em>{word.mastered ? "Знаю" : "Повторю"}</em>
                      </RoundWordChip>
                    ))}
                  </RoundWordsGrid>
                </RoundWordsSection>
              ) : null}

              {error ? <RoundResultError>{error}</RoundResultError> : null}
              <RoundResultActions>
                <LearningContinueButton
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    resetRoundState();
                    setMode("idle");
                    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
                  }}
                >
                  Продолжить обучение
                </LearningContinueButton>
                <span>Ты всегда можешь выбрать новый темп на странице словаря</span>
              </RoundResultActions>
            </RoundResultCard>
          </RoundResultScreen>
        ) : mode === "match" ? (
          <MatchGameScreen>
            <MatchTopBar>
              <MatchBackButton
                type="button"
                onClick={() => {
                  resetMatchState();
                  setMode("idle");
                }}
              >
                <span aria-hidden="true">←</span> Словарь
              </MatchBackButton>
              <MatchDailyStatus>
                <span>Спринты сегодня</span>
                <strong>{session.sprint.playedToday} / {session.sprint.dailyLimit}</strong>
              </MatchDailyStatus>
            </MatchTopBar>

            {matchPhase === "intro" ? (
              <MatchLaunchCard>
                <MatchLaunchDecor aria-hidden="true">
                  {matchWords.slice(0, 6).map((word) => <span key={word.id}>{word.korean}</span>)}
                </MatchLaunchDecor>
                <MatchLaunchIcon aria-hidden="true">⚡</MatchLaunchIcon>
                <Eyebrow>Спринт · {matchWords.length} пар</Eyebrow>
                <MatchGameTitle>Готовы соединить слова?</MatchGameTitle>
                <MatchGameDescription>
                  Найди перевод для каждого корейского слова. Таймер запустится только после нажатия кнопки, а за точность и скорость ты получишь XP.
                </MatchGameDescription>
                <MatchLaunchFeatures>
                  <MatchFeature><span>⏱</span><strong>Таймер</strong><small>считаем темп</small></MatchFeature>
                  <MatchFeature><span>🎯</span><strong>Точность</strong><small>следим за ошибками</small></MatchFeature>
                  <MatchFeature><span>✦</span><strong>Бонус XP</strong><small>за чистый раунд</small></MatchFeature>
                </MatchLaunchFeatures>
                <MatchAttemptRow>
                  <span>Попытки на сегодня</span>
                  <MatchAttemptDots aria-label={`${session.sprint.playedToday} из ${session.sprint.dailyLimit} попыток использовано`}>
                    {Array.from({ length: session.sprint.dailyLimit }, (_, index) => (
                      <i key={index} data-used={index < session.sprint.playedToday} />
                    ))}
                  </MatchAttemptDots>
                </MatchAttemptRow>
                <MatchStartButton type="button" onClick={handleMatchRoundStart}>
                  Начать спринт <span aria-hidden="true">→</span>
                </MatchStartButton>
              </MatchLaunchCard>
            ) : matchPhase === "playing" ? (
              <>
                <MatchGameHeader>
                  <div>
                    <Eyebrow>Спринт-игра</Eyebrow>
                    <MatchGameTitle>Соедини корейскую пару</MatchGameTitle>
                    <MatchGameDescription>Сначала выбери слово слева, затем его перевод справа.</MatchGameDescription>
                  </div>
                  <MatchHeaderActions>
                    <MatchMetric><span>⏱</span><small>Время</small><strong>{formatSprintTime(matchElapsedMs)}</strong></MatchMetric>
                    <MatchMetric><span>🎯</span><small>Точность</small><strong>{liveMatchAccuracy}%</strong></MatchMetric>
                    <MatchMetric $danger={matchMistakes > 0}><span>×</span><small>Ошибки</small><strong>{matchMistakes}</strong></MatchMetric>
                  </MatchHeaderActions>
                  <MatchProgressTrack aria-label={`${matchedWordIds.length} из ${matchWords.length} пар`}>
                    <MatchProgressFill $value={matchProgress} />
                  </MatchProgressTrack>
                </MatchGameHeader>

                <MatchBoard ref={matchBoardRef}>
                  <MatchLineLayer viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    {matchLines.map((line) => {
                      const middleX = (line.x1 + line.x2) / 2;
                      const path = `M ${line.x1} ${line.y1} C ${middleX} ${line.y1}, ${middleX} ${line.y2}, ${line.x2} ${line.y2}`;
                      return (
                        <g key={line.wordId}>
                          <path className="match-line-glow" d={path} stroke={line.color} vectorEffect="non-scaling-stroke" pathLength="1" />
                          <path className="match-line-core" d={path} stroke={line.color} vectorEffect="non-scaling-stroke" pathLength="1" />
                          <path className="match-line-flow" d={path} stroke={line.color} vectorEffect="non-scaling-stroke" pathLength="1" />
                        </g>
                      );
                    })}
                  </MatchLineLayer>

                  <MatchColumn>
                    <MatchColumnLabel>Корейские слова</MatchColumnLabel>
                    {matchWords.map((word) => {
                      const matched = matchedWordIds.includes(word.id);
                      return (
                        <MatchChoice
                          key={word.id}
                          ref={(element) => { matchWordRefs.current[word.id] = element; }}
                          type="button"
                          $selected={selectedMatchWordId === word.id}
                          $matched={matched}
                          disabled={matched || matchCompleted}
                          onClick={() => handleMatchWordSelect(word.id)}
                        >
                          <strong>{word.korean}</strong>
                          {word.transcription ? <small>[{word.transcription}]</small> : null}
                          <MatchDot $matched={matched} />
                        </MatchChoice>
                      );
                    })}
                  </MatchColumn>

                  <MatchColumn>
                    <MatchColumnLabel>Перевод на русский</MatchColumnLabel>
                    {matchTranslations.map((word) => {
                      const matched = matchedWordIds.includes(word.id);
                      return (
                        <MatchChoice
                          key={word.id}
                          ref={(element) => { matchTranslationRefs.current[word.id] = element; }}
                          type="button"
                          $matched={matched}
                          $wrong={wrongMatchWordId === word.id}
                          $translation
                          disabled={matched || matchCompleted}
                          onClick={() => handleMatchTranslationSelect(word.id)}
                        >
                          <MatchDot $matched={matched} />
                          <strong>{word.translation}</strong>
                        </MatchChoice>
                      );
                    })}
                  </MatchColumn>
                </MatchBoard>

                <MatchHint>
                  <span aria-hidden="true">💡</span>
                  {selectedMatchWordId ? "Теперь выбери перевод справа" : "Начни с любого корейского слова слева"}
                </MatchHint>
              </>
            ) : (
              <MatchResultCard $grade={matchResult?.grade ?? "PRACTICE"}>
                <MatchResultBurst aria-hidden="true">✦</MatchResultBurst>
                <Eyebrow>Спринт завершён</Eyebrow>
                <MatchResultTitle>{matchSaving ? "Сохраняем результат..." : matchResult?.gradeLabel ?? "Раунд завершён"}</MatchResultTitle>
                <MatchResultText>
                  {matchResult?.grade === "PERFECT"
                    ? "Без единой ошибки — это идеальное соединение!"
                    : matchMistakes <= 2
                      ? "Хороший темп. Ещё один спринт поможет закрепить пары."
                      : "Слова уже стали знакомее. Вернись к ним после короткой паузы."}
                </MatchResultText>
                <MatchResultGrid>
                  <MatchResultStat><span>🎯</span><strong>{matchResult?.accuracy ?? liveMatchAccuracy}%</strong><small>точность</small></MatchResultStat>
                  <MatchResultStat><span>⏱</span><strong>{formatSprintTime(matchResult?.durationMs ?? matchElapsedMs)}</strong><small>время</small></MatchResultStat>
                  <MatchResultStat><span>×</span><strong>{matchResult?.mistakeCount ?? matchMistakes}</strong><small>ошибок</small></MatchResultStat>
                  <MatchResultStat $xp><span>✦</span><strong>+{matchResult?.xpEarned ?? 0}</strong><small>XP</small></MatchResultStat>
                </MatchResultGrid>
                {error ? <MatchSaveError>{error}</MatchSaveError> : null}
                <MatchResultActions>
                  {matchResult && matchResult.sprint.remainingToday > 0 ? (
                    <PrimaryButton type="button" onClick={handleMatchStart}>Ещё один спринт</PrimaryButton>
                  ) : null}
                  <GhostButton
                    type="button"
                    onClick={() => {
                      resetMatchState();
                      setMode("idle");
                    }}
                  >
                    Вернуться в словарь
                  </GhostButton>
                </MatchResultActions>
                <MatchResultDaily>
                  Сегодня: {matchResult?.sprint.playedToday ?? session.sprint.playedToday} / {session.sprint.dailyLimit} спринтов · {matchResult?.sprint.xpToday ?? session.sprint.xpToday} XP
                </MatchResultDaily>
              </MatchResultCard>
            )}
          </MatchGameScreen>
        ) : (
          <StudyGrid>
            {session.placementRequired ? (
              <HeaderCard>
                <div>
                  <Eyebrow>Режим теста</Eyebrow>
                  <StudyTitle>Быстрый словарный тест</StudyTitle>
                  <HeroText>Выбирай один из четырёх вариантов. После ответа правильный вариант подсветится, и откроется следующий вопрос.</HeroText>
                </div>
                <HeaderActions>
                  <SmallCard>
                    <MiniLabel>Вопрос</MiniLabel>
                    <BigValue>{placement ? `${Math.min(placementIndex + 1, placement.totalQuestions)} / ${placement.totalQuestions}` : "—"}</BigValue>
                  </SmallCard>
                  <SmallCard>
                    <MiniLabel>Отвечено</MiniLabel>
                    <BigValue>{placementAnswers.length}</BigValue>
                  </SmallCard>
                  <HeaderButtons>
                    <GhostButton type="button" onClick={() => setMode("idle")}>Скрыть режим</GhostButton>
                  </HeaderButtons>
                </HeaderActions>
              </HeaderCard>
            ) : activeRoundStep ? (
              <LearningHud $kind={activeRoundStep.kind}>
                <LearningHudMain>
                  <LearningExitButton type="button" onClick={() => setMode("idle")} aria-label="Вернуться к словарю">
                    <span aria-hidden="true">×</span><b>Словарь</b>
                  </LearningExitButton>
                  <LearningActivityIcon aria-hidden="true">
                    {activeRoundStep.kind === "preview" ? "👀" : activeRoundStep.kind === "quiz" ? "🎯" : "✍"}
                  </LearningActivityIcon>
                  <LearningHudCopy>
                    <small>{activeRoundStep.kind === "preview" ? "Знакомство" : activeRoundStep.kind === "quiz" ? "Быстрая проверка" : "Письменная практика"}</small>
                    <strong>{activeRoundStep.kind === "preview" ? "Запомни новое слово" : activeRoundStep.kind === "quiz" ? "Найди верный перевод" : "Напиши слово по памяти"}</strong>
                  </LearningHudCopy>
                  <LearningHudStats>
                    <LearningHudStat><small>Шаг</small><strong>{roundIndex + 1}<span>/{roundSteps.length}</span></strong></LearningHudStat>
                    <LearningHudStat><small>В раунде</small><strong>{roundWords.length}<span> слов</span></strong></LearningHudStat>
                  </LearningHudStats>
                </LearningHudMain>
                <LearningProgressTrack aria-label={`Шаг ${roundIndex + 1} из ${roundSteps.length}`}>
                  <LearningProgressFill $value={progressValue} />
                </LearningProgressTrack>
              </LearningHud>
            ) : null}

            {error ? <ErrorCard>{error}</ErrorCard> : null}

            {session.placementRequired ? (
              activePlacementQuestion && placement ? (
                <>
                  <InfoCard>
                    <MiniLabel>Вопрос {placementIndex + 1} / {placement.totalQuestions}</MiniLabel>
                    <ProgressBar><ProgressFill $value={progressValue} /></ProgressBar>
                  </InfoCard>
                  <DeckCard key={placementCardKey}>
                    {activePlacementQuestion.category ? <PlacementCategory>{activePlacementQuestion.category}</PlacementCategory> : null}
                    <PromptText>Выбери правильный перевод слова.</PromptText>
                    <Word>{activePlacementQuestion.prompt}</Word>
                    <OptionGrid>
                      {activePlacementQuestion.options.map((option, index) => {
                        const isSelected = placementFeedback?.selectedOptionId === option.id;
                        const isCorrect = placementFeedback?.correctOptionId === option.id;
                        const state = isCorrect ? "correct" : isSelected ? "wrong" : "idle";
                        return (
                          <QuizOption key={option.id} type="button" $state={state} disabled={Boolean(placementFeedback) || pending} onClick={() => void handlePlacementAnswer(option.id)}>
                            <OptionLetter $state={state}>{String.fromCharCode(65 + index)}</OptionLetter>
                            <OptionValue>{option.text}</OptionValue>
                          </QuizOption>
                        );
                      })}
                    </OptionGrid>
                  </DeckCard>
                </>
              ) : (
                <InfoCard>
                  <StudyTitle>Тест недоступен</StudyTitle>
                  <MiniText>Для старта нужны активные слова начального уровня и готовая тест-сессия.</MiniText>
                </InfoCard>
              )
            ) : activeRoundStep && activeRoundWord ? (
              <>
                <DeckCard key={roundCardKey} $leaving={roundCardLeaving}>
                  <LearningCardDecor aria-hidden="true"><i>가</i><i>✦</i><i>✓</i></LearningCardDecor>
                  <LearningModePill $kind={activeRoundStep.kind}>
                    <span aria-hidden="true">{activeRoundStep.kind === "preview" ? "✦" : activeRoundStep.kind === "quiz" ? "✓" : "✎"}</span>
                    {activeRoundStep.kind === "preview" ? "Новое слово" : activeRoundStep.kind === "quiz" ? "Найди перевод" : "Напиши слово"}
                  </LearningModePill>
                  {activeRoundStep.kind !== "type" ? (
                    <>
                      <Word>{activeRoundWord.korean}</Word>
                      {activeRoundWord.transcription ? <WordHint>[{activeRoundWord.transcription}]</WordHint> : null}
                    </>
                  ) : null}
                  {activeRoundStep.kind === "preview" ? (
                    <>
                      <TranslationPanel>
                        <MiniLabel>Перевод</MiniLabel>
                        <AnswerText>{activeRoundWord.translation}</AnswerText>
                        {activeRoundWord.exampleKorean && activeRoundWord.exampleRussian ? (
                          <LearningExample>
                            <small>Пример</small>
                            <strong lang="ko">
                              {activeRoundWord.exampleKorean.split(activeRoundWord.korean).map((part, index) => (
                                <Fragment key={`${part}-${index}`}>
                                  {index > 0 ? <mark>{activeRoundWord.korean}</mark> : null}
                                  {part}
                                </Fragment>
                              ))}
                            </strong>
                            <span>{activeRoundWord.exampleRussian}</span>
                          </LearningExample>
                        ) : null}
                      </TranslationPanel>
                      <PromptText>Запомни слово. Позже оно вернётся как вопрос с вариантами ответа.</PromptText>
                      <ActionRowCentered>
                        <LearningContinueButton type="button" onClick={handleRoundPreviewContinue} disabled={pending || roundCardLeaving}>Дальше</LearningContinueButton>
                      </ActionRowCentered>
                    </>
                  ) : activeRoundStep.kind === "quiz" ? (
                    <>
                      <PromptText>Выбери правильный перевод слова.</PromptText>
                      <OptionGrid>
                        {activeRoundOptions.map((option, index) => {
                          const isSelected = roundFeedback?.selectedOptionId === option.id;
                          const isCorrect = roundFeedback?.correctOptionId === option.id;
                          const state = isCorrect ? "correct" : isSelected ? "wrong" : "idle";
                          return (
                            <QuizOption key={option.id} type="button" $state={state} disabled={Boolean(roundFeedback) || pending} onClick={(event) => handleRoundAnswer(option.id, event)}>
                              <OptionLetter $state={state}>{String.fromCharCode(65 + index)}</OptionLetter>
                              <OptionValue>{option.text}</OptionValue>
                            </QuizOption>
                          );
                        })}
                      </OptionGrid>
                    </>
                  ) : (
                    <>
                      <TranslationPanel>
                        <MiniLabel>Напиши по-корейски</MiniLabel>
                        <AnswerText>{activeRoundWord.translation}</AnswerText>
                      </TranslationPanel>
                      <PromptText>Введи слово без подсказок. Ошибка вернет слово в повторение.</PromptText>
                      <TypeAnswerInput
                        ref={roundTypeInputRef}
                        value={roundTypedAnswer}
                        onChange={(event) => {
                          setRoundTypedAnswer(event.target.value);
                          setRoundTypeFeedback(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") {
                            return;
                          }

                          event.preventDefault();
                          handleRoundTypeSubmit();
                        }}
                        placeholder="Например: 학교"
                        disabled={pending}
                      />
                      <KoreanKeyboardToggle
                        type="button"
                        aria-expanded={roundKeyboardOpen}
                        aria-controls="vocabulary-korean-keyboard"
                        onClick={() => setRoundKeyboardOpen((current) => !current)}
                      >
                        <span aria-hidden="true">⌨</span>
                        {roundKeyboardOpen ? "Скрыть клавиатуру" : "Корейская клавиатура"}
                      </KoreanKeyboardToggle>
                      {roundKeyboardOpen ? (
                        <KoreanKeyboard
                          id="vocabulary-korean-keyboard"
                          onInput={handleRoundKeyboardInput}
                          onClose={() => setRoundKeyboardOpen(false)}
                        />
                      ) : null}
                      {roundTypeFeedback ? (
                        <TypeFeedback $correct={roundTypeFeedback === "correct"}>
                          {roundTypeFeedback === "correct" ? "Верно." : "Правильный ответ:"}{" "}
                          <strong>{activeRoundWord.korean}</strong>
                        </TypeFeedback>
                      ) : null}
                      <ActionRowCentered>
                        <LearningContinueButton
                          type="button"
                          onClick={handleRoundTypeSubmit}
                          disabled={(!roundTypedAnswer.trim() && !roundTypeFeedback) || pending || roundCardLeaving}
                        >
                          {roundTypeFeedback === "correct"
                            ? "Дальше"
                            : roundTypeFeedback === "wrong"
                              ? "Запомнить и дальше"
                              : "Проверить"}
                        </LearningContinueButton>
                      </ActionRowCentered>
                    </>
                  )}
                </DeckCard>
              </>
            ) : (
              <InfoCard>
                <StudyTitle>Выбери объём слов</StudyTitle>
                <MiniText>Для старта раунда вернись на главный экран словаря и выбери 5, 10, 15 или 20 слов.</MiniText>
              </InfoCard>
            )}
          </StudyGrid>
        )}
      </Shell>
    </PageSection>
  );
}
const fadeRise = keyframes`
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
`;

const deckSlide = keyframes`
  from { opacity: 0; transform: perspective(1200px) translateY(38px) scale(0.94) rotateX(-4deg); }
  to { opacity: 1; transform: perspective(1200px) translateY(0) scale(1) rotateX(0); }
`;

const deckSwipeAway = keyframes`
  0% { opacity: 1; transform: perspective(1200px) translate3d(0, 0, 0) rotateZ(0) rotateY(0) scale(1); }
  35% { opacity: 1; transform: perspective(1200px) translate3d(2%, -10px, 25px) rotateZ(1.5deg) rotateY(-2deg) scale(1.015); }
  100% { opacity: 0; transform: perspective(1200px) translate3d(112%, -36px, 0) rotateZ(8deg) rotateY(-9deg) scale(0.9); }
`;

const lineReveal = keyframes`
  from { stroke-dashoffset: 1; opacity: 0; }
  to { stroke-dashoffset: 0; opacity: 0.88; }
`;

const lineFlow = keyframes`
  to { stroke-dashoffset: -0.48; }
`;

const softFloat = keyframes`
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50% { transform: translateY(-8px) rotate(2deg); }
`;

const roundResultPop = keyframes`
  0% { opacity: 0; transform: translateY(16px) scale(.78) rotate(-10deg); }
  70% { opacity: 1; transform: translateY(-3px) scale(1.06) rotate(3deg); }
  100% { opacity: 1; transform: none; }
`;

const resultHalo = keyframes`
  0%, 100% { transform: scale(.94); opacity: .55; }
  50% { transform: scale(1.07); opacity: .9; }
`;

const resultWordIn = keyframes`
  from { opacity: 0; transform: translateY(12px) scale(.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

const roundSavingSpin = keyframes`
  to { transform: rotate(360deg); }
`;

const choiceShake = keyframes`
  0%, 100% { transform: translateX(0); }
  30% { transform: translateX(-0.35rem); }
  65% { transform: translateX(0.35rem); }
`;

const loaderCardFloat = keyframes`
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50% { transform: translateY(-10px) rotate(1.5deg); }
`;

const loaderCardBackOne = keyframes`
  0%, 100% { transform: translate(-50%, -50%) rotate(-9deg); }
  50% { transform: translate(-54%, -53%) rotate(-12deg); }
`;

const loaderCardBackTwo = keyframes`
  0%, 100% { transform: translate(-50%, -50%) rotate(8deg); }
  50% { transform: translate(-46%, -54%) rotate(11deg); }
`;

const loaderWordDrift = keyframes`
  0%, 100% { opacity: 0.38; transform: translateY(0) rotate(-3deg); }
  50% { opacity: 0.82; transform: translateY(-8px) rotate(2deg); }
`;

const loaderProgressMove = keyframes`
  0% { transform: translateX(-115%); }
  55%, 100% { transform: translateX(320%); }
`;

const loaderDotPulse = keyframes`
  0%, 70%, 100% { opacity: 0.3; transform: translateY(0) scale(0.82); }
  35% { opacity: 1; transform: translateY(-4px) scale(1); }
`;

const vocabularyConfettiBurst = keyframes`
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.2) rotate(0deg);
    animation-timing-function: cubic-bezier(0.12, 0.72, 0.28, 1);
  }
  10%, 42% { opacity: 1; }
  42% {
    transform: translate(calc(-50% + var(--confetti-mid-x)), calc(-50% + var(--confetti-mid-y))) scale(1) rotate(var(--confetti-mid-spin));
    animation-timing-function: cubic-bezier(0.38, 0, 0.72, 0.42);
  }
  76% { opacity: 0.92; }
  100% {
    opacity: 0;
    transform: translate(calc(-50% + var(--confetti-end-x)), calc(-50% + var(--confetti-end-y))) scale(0.78) rotate(var(--confetti-end-spin));
  }
`;

const PageSection = styled.section`
  position: relative;
  padding: 0.75rem 0 5rem;
  background:
    radial-gradient(circle at 8% 8%, rgba(124, 108, 242, 0.08), transparent 25rem),
    radial-gradient(circle at 92% 30%, rgba(67, 191, 174, 0.08), transparent 27rem);
`;

const VocabularyConfetti = styled.span`
  position: fixed;
  z-index: 9999;
  inset: 0;
  overflow: hidden;
  pointer-events: none;

  span {
    position: absolute;
    top: var(--confetti-top);
    left: var(--confetti-left);
    width: var(--confetti-width);
    height: var(--confetti-height);
    border-radius: var(--confetti-radius);
    background: var(--confetti-color);
    box-shadow: 0 2px 5px rgba(30, 41, 59, 0.1);
    animation: ${vocabularyConfettiBurst} var(--confetti-duration) var(--confetti-delay) both;
    will-change: transform, opacity;
  }

  @media (prefers-reduced-motion: reduce) { display: none; }
`;

const Shell = styled.div`
  width: min(1400px, calc(100% - 2rem));
  margin-inline: auto;
  display: grid;
  gap: 1rem;
`;

const Glass = `
  border: 1px solid rgba(189, 198, 235, 0.62);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 18px 48px rgba(64, 76, 146, 0.09);
  backdrop-filter: blur(18px);
`;

const StateCard = styled.div`
  ${Glass}
  border-radius: 1.4rem;
  padding: 1.25rem 1.35rem;
  color: var(--ink-soft);
  min-height: 16rem;
`;

const VocabularyLoader = styled.div`
  ${Glass}
  position: relative;
  isolation: isolate;
  display: grid;
  justify-items: center;
  align-content: center;
  min-height: clamp(23rem, 48vh, 31rem);
  overflow: hidden;
  border-radius: 2rem;
  padding: 2.2rem 1.4rem;
  background:
    radial-gradient(circle at 22% 20%, rgba(77, 199, 181, 0.11), transparent 18rem),
    radial-gradient(circle at 80% 18%, rgba(113, 89, 241, 0.13), transparent 20rem),
    linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(246, 248, 255, 0.9));

  @media (max-width: 620px) {
    min-height: 28rem;
    border-radius: 1.65rem;
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; }
  }
`;

const LoaderGlow = styled.span`
  position: absolute;
  z-index: -1;
  top: 46%;
  left: 50%;
  width: min(30rem, 76vw);
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(96, 104, 242, 0.13), rgba(90, 191, 207, 0.05) 42%, transparent 70%);
  transform: translate(-50%, -50%);
  filter: blur(2px);
`;

const LoaderWords = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  span {
    position: absolute;
    display: grid;
    place-items: center;
    min-width: 3.3rem;
    height: 2.55rem;
    border: 1px solid rgba(132, 146, 213, 0.2);
    border-radius: 0.9rem;
    background: rgba(255, 255, 255, 0.68);
    padding-inline: 0.7rem;
    color: #7882ba;
    font-family: var(--font-kr), sans-serif;
    font-size: 0.9rem;
    font-weight: 900;
    box-shadow: 0 9px 24px rgba(64, 75, 139, 0.07);
    animation: ${loaderWordDrift} 3.2s ease-in-out infinite;
  }
  span:nth-child(1) { top: 20%; left: 13%; animation-delay: -0.4s; }
  span:nth-child(2) { top: 25%; right: 14%; animation-delay: -1.7s; }
  span:nth-child(3) { bottom: 20%; left: 20%; animation-delay: -2.5s; }
  span:nth-child(4) { right: 20%; bottom: 17%; animation-delay: -0.9s; }

  @media (max-width: 620px) {
    span:nth-child(1) { top: 12%; left: 7%; }
    span:nth-child(2) { top: 15%; right: 7%; }
    span:nth-child(3) { bottom: 11%; left: 7%; }
    span:nth-child(4) { right: 7%; bottom: 9%; }
  }
`;

const LoaderDeck = styled.div`
  position: relative;
  width: 8.8rem;
  height: 8.2rem;
  margin-bottom: 0.75rem;
  animation: ${loaderCardFloat} 2.8s ease-in-out infinite;
  > i {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 6.7rem;
    height: 7.6rem;
    border: 1px solid rgba(130, 140, 218, 0.3);
    border-radius: 1.3rem;
    background: rgba(255, 255, 255, 0.7);
    box-shadow: 0 15px 30px rgba(66, 75, 145, 0.09);
  }
  > i:first-child { animation: ${loaderCardBackOne} 3.4s ease-in-out infinite; }
  > i:nth-child(2) { animation: ${loaderCardBackTwo} 3.4s ease-in-out infinite; }
`;

const LoaderCard = styled.div`
  position: absolute;
  z-index: 2;
  top: 50%;
  left: 50%;
  display: grid;
  place-items: center;
  gap: 0.7rem;
  width: 7rem;
  height: 7.8rem;
  border: 1px solid rgba(111, 119, 232, 0.32);
  border-radius: 1.35rem;
  background: linear-gradient(145deg, #ffffff, #eef2ff);
  box-shadow: 0 18px 38px rgba(72, 74, 166, 0.17), inset 0 1px rgba(255, 255, 255, 0.9);
  transform: translate(-50%, -50%);
`;

const LoaderCardIcon = styled.span`
  display: grid;
  place-items: center;
  width: 3.15rem;
  height: 3.15rem;
  border-radius: 1rem;
  background: linear-gradient(145deg, #5c83ff, #7951ef);
  color: #fff;
  font-family: var(--font-kr), sans-serif;
  font-size: 1.45rem;
  font-weight: 950;
  box-shadow: 0 9px 20px rgba(92, 93, 225, 0.24);
`;

const LoaderCardLines = styled.span`
  display: grid;
  gap: 0.3rem;
  width: 3.8rem;
  span {
    height: 0.28rem;
    border-radius: 999px;
    background: #dce2f7;
  }
  span:nth-child(2) { width: 72%; }
  span:nth-child(3) { width: 46%; }
`;

const LoaderCopy = styled.div`
  display: grid;
  justify-items: center;
  gap: 0.3rem;
  text-align: center;
  small {
    color: #655ee9;
    font-family: var(--font-kr), sans-serif;
    font-size: 0.75rem;
    font-weight: 950;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  strong { color: #1d294d; font-size: clamp(1.45rem, 3vw, 2rem); font-weight: 950; letter-spacing: -0.035em; }
  > span { color: #7b85a2; font-size: clamp(0.86rem, 1.4vw, 0.98rem); font-weight: 650; }
`;

const LoaderProgress = styled.div`
  width: min(23rem, 78vw);
  height: 0.55rem;
  overflow: hidden;
  margin-top: 1.25rem;
  border-radius: 999px;
  background: #e5e9f8;
  box-shadow: inset 0 1px 2px rgba(58, 68, 130, 0.08);
  span {
    display: block;
    width: 28%;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #4fc5b0, #5d82ff, #7550f2);
    box-shadow: 0 0 16px rgba(93, 117, 244, 0.35);
    animation: ${loaderProgressMove} 1.65s cubic-bezier(0.45, 0, 0.25, 1) infinite;
  }
`;

const LoaderDots = styled.span`
  display: flex;
  gap: 0.35rem;
  margin-top: 0.85rem;
  i {
    width: 0.42rem;
    height: 0.42rem;
    border-radius: 50%;
    background: #7b73eb;
    animation: ${loaderDotPulse} 1.2s ease-in-out infinite;
  }
  i:nth-child(2) { animation-delay: 0.15s; }
  i:nth-child(3) { animation-delay: 0.3s; }
`;

const OnboardingScreen = styled.section`
  ${Glass}
  display: grid;
  overflow: hidden;
  border-radius: 2rem;
  background:
    radial-gradient(circle at 7% 7%, rgba(86, 127, 255, 0.16), transparent 24rem),
    radial-gradient(circle at 96% 94%, rgba(118, 80, 244, 0.12), transparent 28rem),
    rgba(255, 255, 255, 0.9);
  animation: ${fadeRise} 520ms ease both;

  @media (min-width: 960px) {
    grid-template-columns: minmax(19rem, 0.72fr) minmax(0, 1.28fr);
    min-height: 41rem;
  }
`;

const OnboardingIntro = styled.div`
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  min-height: 30rem;
  overflow: hidden;
  padding: clamp(1.6rem, 4vw, 3.1rem);
  color: #fff;
  background:
    radial-gradient(circle at 80% 15%, rgba(255, 255, 255, 0.22), transparent 12rem),
    linear-gradient(145deg, #527dff 0%, #6557ef 52%, #7b4de8 100%);

  &::before,
  &::after {
    content: "";
    position: absolute;
    z-index: -1;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 50%;
  }
  &::before { width: 17rem; height: 17rem; right: -7rem; top: -5rem; }
  &::after { width: 11rem; height: 11rem; left: -5rem; bottom: 4rem; }

  @media (max-width: 959px) { min-height: 25rem; }
  @media (max-width: 620px) { min-height: 23rem; padding: 1.4rem; }
`;

const OnboardingBadge = styled.div`
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  padding: 0.52rem 0.8rem;
  font-size: 0.88rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  backdrop-filter: blur(10px);
`;

const OnboardingTitle = styled.h1`
  max-width: 28rem;
  margin: 1.4rem 0 0;
  font-size: clamp(2.15rem, 4.5vw, 3.55rem);
  font-weight: 950;
  line-height: 1.02;
  letter-spacing: -0.055em;
`;

const OnboardingText = styled.p`
  max-width: 29rem;
  margin: 1rem 0 0;
  color: rgba(255, 255, 255, 0.83);
  font-size: clamp(1.08rem, 1.45vw, 1.2rem);
  font-weight: 650;
  line-height: 1.65;
`;

const OnboardingMascot = styled.div`
  position: absolute;
  right: clamp(-1.5rem, 1vw, 1rem);
  bottom: -1.3rem;
  width: clamp(10rem, 18vw, 14.5rem);
  height: clamp(11rem, 20vw, 15.5rem);
  filter: drop-shadow(0 22px 28px rgba(27, 27, 103, 0.25));
  img { width: 100%; height: 100%; object-fit: contain; object-position: bottom; }

  @media (max-width: 620px) { opacity: 0.78; right: -2.5rem; }
`;

const OnboardingPromise = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  width: fit-content;
  max-width: calc(100% - 8rem);
  margin-top: auto;
  border: 1px solid rgba(255, 255, 255, 0.23);
  border-radius: 1.15rem;
  background: rgba(25, 30, 106, 0.18);
  padding: 0.8rem 0.95rem;
  backdrop-filter: blur(12px);
  > span { font-size: 1.7rem; font-weight: 950; }
  > div { display: grid; }
  strong { font-size: 1rem; font-weight: 900; }
  small { color: rgba(255, 255, 255, 0.75); font-size: 0.8rem; line-height: 1.4; }
`;

const OnboardingForm = styled.div`
  display: grid;
  align-content: center;
  gap: 1.45rem;
  padding: clamp(1.4rem, 3.5vw, 3rem);
`;

const OnboardingSection = styled.section`
  display: grid;
  gap: 0.9rem;
`;

const OnboardingSectionHeading = styled.div`
  display: flex;
  align-items: center;
  gap: 0.78rem;
  > span {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 0.8rem;
    background: #eef2ff;
    color: #5a64e8;
    font-size: 0.8rem;
    font-weight: 950;
  }
  > div { display: grid; gap: 0.12rem; }
  strong { color: #1c274a; font-size: clamp(1.22rem, 1.85vw, 1.45rem); font-weight: 950; }
  small { color: #7c86a3; font-size: 0.94rem; line-height: 1.45; }
`;

const GoalChoiceGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.7rem;
  @media (max-width: 620px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
`;

const GoalChoice = styled.button<{ $selected: boolean }>`
  display: grid;
  justify-items: center;
  min-height: 7.25rem;
  border: 1px solid ${({ $selected }) => $selected ? "#6570f2" : "rgba(187, 198, 234, 0.72)"};
  border-bottom-width: ${({ $selected }) => $selected ? "4px" : "2px"};
  border-radius: 1.15rem;
  background: ${({ $selected }) => $selected ? "linear-gradient(145deg, #edf3ff, #f2edff)" : "rgba(255, 255, 255, 0.84)"};
  padding: 0.8rem 0.55rem 0.65rem;
  color: #273254;
  cursor: pointer;
  box-shadow: ${({ $selected }) => $selected ? "0 10px 22px rgba(92, 93, 220, 0.16)" : "0 5px 14px rgba(61, 76, 139, 0.05)"};
  transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
  strong { color: ${({ $selected }) => $selected ? "#5b59e7" : "#253153"}; font-size: 2.3rem; font-weight: 950; line-height: 1; }
  > span { margin-top: 0.18rem; font-size: 0.92rem; font-weight: 900; }
  small { align-self: end; color: ${({ $selected }) => $selected ? "#656ee0" : "#9299ae"}; font-size: 0.76rem; font-weight: 850; }
  &:hover { transform: translateY(-2px); border-color: #8490f5; box-shadow: 0 10px 22px rgba(73, 85, 157, 0.11); }
  &:active { transform: translateY(1px); }
`;

const LevelChoiceGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  @media (max-width: 720px) { grid-template-columns: 1fr; }
`;

const LevelChoice = styled.button<{ $selected: boolean }>`
  position: relative;
  display: grid;
  align-content: start;
  gap: 0.28rem;
  min-height: 11.4rem;
  border: 1px solid ${({ $selected }) => $selected ? "#6870ee" : "rgba(188, 198, 233, 0.72)"};
  border-bottom-width: ${({ $selected }) => $selected ? "4px" : "2px"};
  border-radius: 1.2rem;
  background: ${({ $selected }) => $selected ? "linear-gradient(145deg, #edf4ff, #f3efff)" : "rgba(255, 255, 255, 0.84)"};
  padding: 1rem;
  text-align: left;
  cursor: pointer;
  box-shadow: ${({ $selected }) => $selected ? "0 12px 25px rgba(87, 91, 211, 0.14)" : "0 5px 14px rgba(61, 76, 139, 0.05)"};
  transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
  > small { padding-right: 1.5rem; color: #717de5; font-size: 0.78rem; font-weight: 950; text-transform: uppercase; letter-spacing: 0.06em; }
  > strong { color: #202c50; font-size: 1.55rem; font-weight: 950; }
  > p { color: #77819d; font-size: 0.92rem; line-height: 1.48; }
  > em { align-self: end; margin-top: 0.25rem; color: #596689; font-family: var(--font-kr), sans-serif; font-size: 0.9rem; font-style: normal; font-weight: 800; }
  &:hover { transform: translateY(-2px); border-color: #8790f4; box-shadow: 0 11px 23px rgba(73, 85, 157, 0.1); }
  &:active { transform: translateY(1px); }
  @media (max-width: 720px) { min-height: 8.4rem; }
`;

const LevelChoiceCheck = styled.span`
  position: absolute;
  top: 0.8rem;
  right: 0.8rem;
  display: grid;
  place-items: center;
  width: 1.55rem;
  height: 1.55rem;
  border-radius: 50%;
  background: #6269eb;
  color: #fff;
  font-size: 0.76rem;
  font-weight: 950;
  &:empty { background: #eef1fb; box-shadow: inset 0 0 0 1px #d5dbef; }
`;

const OnboardingSubmit = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.9rem;
  min-height: 4.15rem;
  border: 0;
  border-bottom: 5px solid #4034c9;
  border-radius: 1.15rem;
  background: linear-gradient(135deg, #527bff, #734cf4);
  padding: 0.9rem 1.15rem 0.75rem;
  color: #fff;
  font-size: 1.15rem;
  font-weight: 950;
  cursor: pointer;
  box-shadow: 0 13px 26px rgba(86, 78, 220, 0.23);
  transition: transform 130ms ease, box-shadow 130ms ease;
  b { font-size: 1.25rem; }
  &:hover:enabled { transform: translateY(2px); box-shadow: 0 7px 16px rgba(86, 78, 220, 0.22); }
  &:active:enabled { transform: translateY(4px); box-shadow: 0 3px 7px rgba(86, 78, 220, 0.18); }
  &:disabled { opacity: 0.65; cursor: wait; }
`;

const OnboardingFootnote = styled.p`
  margin: -0.65rem 0 0;
  color: #8b93ab;
  font-size: 0.84rem;
  font-weight: 750;
  text-align: center;
`;

const IntroGrid = styled.section`
  display: grid;
  gap: 1rem;
  align-items: start;
  animation: ${fadeRise} 520ms ease both;
  @media (min-width: 980px) { grid-template-columns: minmax(0, 1.22fr) minmax(360px, 0.78fr); }
`;

const HeroCard = styled.article`
  ${Glass}
  position: relative;
  overflow: hidden;
  border-radius: 1.7rem;
  padding: clamp(1.35rem, 3vw, 2.35rem);
  background:
    radial-gradient(circle at 96% 6%, rgba(124, 108, 242, 0.13), transparent 19rem),
    linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(247, 248, 255, 0.82));

  &::after {
    content: "가";
    position: absolute;
    right: 1.6rem;
    bottom: -2.4rem;
    color: rgba(124, 108, 242, 0.055);
    font-family: var(--font-kr), sans-serif;
    font-size: clamp(8rem, 17vw, 14rem);
    font-weight: 900;
    line-height: 1;
    pointer-events: none;
  }

  > * {
    position: relative;
    z-index: 1;
  }
`;

const SideColumn = styled.div`
  display: grid;
  gap: 1rem;
`;

const VocabularyHub = styled.section`
  display: grid;
  gap: 1rem;
  animation: ${fadeRise} 500ms ease both;
`;

const VocabularyHubHero = styled.article`
  ${Glass}
  display: grid;
  gap: 1.2rem;
  overflow: hidden;
  border-radius: 1.8rem;
  padding: clamp(1.35rem, 3vw, 2.35rem);
  background: radial-gradient(circle at 70% 0%, rgba(119,100,240,.13), transparent 24rem), linear-gradient(145deg, rgba(255,255,255,.96), rgba(246,249,255,.9));
  @media (min-width: 880px) { grid-template-columns: minmax(0,1.18fr) minmax(20rem,.82fr); align-items: center; }
`;

const VocabularyHeroCopy = styled.div``;

const HubStats = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: .7rem;
  margin-top: 1.15rem;
`;

const HubStat = styled.div`
  display: flex;
  align-items: center;
  gap: .62rem;
  min-width: 8.6rem;
  border: 1px solid rgba(188,198,231,.6);
  border-radius: 1rem;
  background: rgba(255,255,255,.78);
  padding: .72rem .85rem;
  span { font-size: 1.25rem; }
  div { display: grid; }
  strong { color: #263153; font-size: 1.12rem; font-weight: 950; }
  small { color: #8991aa; font-size: .78rem; font-weight: 800; }
`;

const TodayPanel = styled.div`
  position: relative;
  overflow: hidden;
  min-height: 11rem;
  border: 1px solid rgba(115,95,223,.16);
  border-radius: 1.5rem;
  background: linear-gradient(135deg, #f0efff, #ecfbf7);
  padding: 1.3rem 1.3rem 1.15rem clamp(8.5rem, 13vw, 10rem);
  box-shadow: inset 0 1px rgba(255,255,255,.85);
`;

const MascotWrap = styled.div`
  position: absolute; left: .65rem; bottom: -.5rem; width: clamp(7.3rem, 12vw, 9rem); height: 10rem;
  img { width: 100%; height: 100%; object-fit: contain; object-position: bottom; }
`;

const TodayPanelCopy = styled.div`
  display: grid; gap: .28rem; min-height: 6.7rem; align-content: center;
  small { color: #7665df; font-size: .82rem; font-weight: 950; text-transform: uppercase; letter-spacing: .08em; }
  strong { color: #222d50; font-size: clamp(1.4rem,2.5vw,1.9rem); font-weight: 950; }
  span { color: #77819e; font-size: .9rem; font-weight: 750; }
`;

const HubPrimaryGrid = styled.div`
  display: grid; gap: 1rem;
  @media (min-width: 760px) { grid-template-columns: repeat(2,minmax(0,1fr)); }
`;

const HubActionCard = styled.article<{ $tone: "new" | "review" }>`
  ${Glass}
  display: grid;
  grid-template-columns: auto minmax(0,1fr);
  gap: 1rem;
  border-radius: 1.65rem;
  background: ${({$tone}) => $tone === "new" ? "linear-gradient(145deg,#f0f5ff,#f6f2ff)" : "linear-gradient(145deg,#edfcf8,#f5fbff)"};
  padding: clamp(1.15rem,2.5vw,1.65rem);
  > div:nth-child(2) { display: grid; align-content: start; gap: .32rem; }
  small { color: ${({$tone}) => $tone === "new" ? "#6555df" : "#228d77"}; font-size: .85rem; font-weight: 950; text-transform: uppercase; letter-spacing: .09em; }
  strong { color: #202b4d; font-size: clamp(1.4rem,2.2vw,1.72rem); font-weight: 950; }
  p { color: #737f9d; font-size: clamp(.94rem,1.2vw,1.04rem); line-height: 1.58; }
  > button { grid-column: 1 / -1; }
`;

const HubActionIcon = styled.span`
  width: 3rem; height: 3rem; display: grid; place-items: center; border-radius: 1rem; background: rgba(255,255,255,.85); font-size: 1.35rem; box-shadow: 0 9px 24px rgba(70,82,140,.1);
`;

const ReviewLevels = styled.div`
  grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: .45rem;
  span { border-radius: 999px; background: rgba(255,255,255,.75); padding: .48rem .7rem; color: #697493; font-size: .78rem; font-weight: 850; }
`;

const HubActionButton = styled.button`
  min-height: 3.45rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; border: 0; border-bottom: 5px solid #4738c9; border-radius: 1rem; background: linear-gradient(135deg,#587dff,#7250f4); padding: .86rem 1.08rem .72rem; color: #fff; font-size: .98rem; font-weight: 950; cursor: pointer;
  box-shadow: 0 10px 22px rgba(91,78,220,.2);
  box-sizing: border-box;
  transition: transform 130ms ease, box-shadow 130ms ease, filter 130ms ease;
  > span { flex: 0 0 auto; display: inline-block; color: currentColor; font-size: 1.15rem; line-height: 1; transition: transform 130ms ease; }
  &:hover:enabled { transform: translateY(2px); box-shadow: 0 5px 12px rgba(91,78,220,.2), inset 0 -2px 0 rgba(255,255,255,.08); filter: saturate(1.06); }
  &:hover:enabled > span { transform: translateX(2px); }
  &:active:enabled { transform: translateY(4px) scale(.992); box-shadow: 0 2px 5px rgba(91,78,220,.16), inset 0 4px 7px rgba(47,36,151,.16); }
  &:disabled { opacity: .45; cursor: not-allowed; }
`;

const HubLowerGrid = styled.div`
  display: grid; align-items: start; gap: 1rem;
  @media (min-width: 760px) { grid-template-columns: 1.15fr .85fr; }
`;

const GamesHubCard = styled.article`
  ${Glass}
  position:relative;
  isolation:isolate;
  display:grid;
  align-content:start;
  gap:.85rem;
  overflow:hidden;
  border-radius:1.65rem;
  background:linear-gradient(145deg,rgba(239,252,249,.96),rgba(242,245,255,.96));
  padding:0;
  > div:nth-child(2){position:relative;z-index:1;display:grid;gap:.28rem;padding:0 1.35rem;}
  > div:nth-child(3){position:relative;z-index:1;margin:0 1.35rem;}
  > button{position:relative;z-index:1;width:calc(100% - 2.7rem);margin:0 1.35rem 1.35rem;}
  small{color:#258f7d;font-size:.84rem;font-weight:950;text-transform:uppercase;letter-spacing:.08em;}
  strong{color:#202c4e;font-size:clamp(1.42rem,2vw,1.65rem);font-weight:950;}
  p{color:#74809c;font-size:.94rem;line-height:1.5;}
  @media(max-width:620px){> div:nth-child(2){padding-inline:1.1rem;}> div:nth-child(3){margin-inline:1.1rem;}> button{width:calc(100% - 2.2rem);margin:0 1.1rem 1.1rem;}}
`;

const GamePromoArtwork = styled.div`
  position:relative;
  min-height:clamp(7.7rem,12vw,9.4rem);
  overflow:hidden;
  background:#6651bf;
  img{object-fit:cover;object-position:center 48%;}
  &::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 52%,rgba(239,248,250,.88) 100%);pointer-events:none;}
  @media(max-width:620px){min-height:clamp(7.5rem,34vw,9.5rem);}
`;

const MyWordsPromo = styled.button`
  ${Glass} display: grid; grid-template-columns: auto minmax(0,1fr); align-content:start; gap: 1rem; border-radius: 1.65rem; background: linear-gradient(145deg,#fff,#f4f1ff); padding: clamp(1.2rem,2.5vw,1.65rem); text-align: left; cursor: pointer;
  box-shadow: 0 12px 0 rgba(104,86,211,.08), 0 18px 48px rgba(64,76,146,.09);
  transition: transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease, background 150ms ease;
  > span { width: 3rem; height: 3rem; display:grid; place-items:center; border-radius:1rem; background:#eeebff; font-size:1.35rem; transition:transform 150ms ease, background 150ms ease; }
  div { display:grid; gap:.28rem; }
  small { color:#6b59dc; font-size:.84rem; font-weight:950; text-transform:uppercase; letter-spacing:.08em; }
  strong { color:#202c4e; font-size:1.52rem; font-weight:950; }
  p { color:#78829d; font-size:.96rem; line-height:1.55; }
  &:hover { transform:translateY(3px); border-color:rgba(111,92,224,.28); background:linear-gradient(145deg,#fbfaff,#efebff); box-shadow:0 6px 0 rgba(104,86,211,.08),0 11px 28px rgba(64,76,146,.1); }
  &:hover > span { transform:scale(.96); background:#e7e1ff; }
  &:active { transform:translateY(8px) scale(.992); box-shadow:0 1px 0 rgba(104,86,211,.1),inset 0 2px 7px rgba(85,68,184,.08); }
`;

const MyWordsPreview = styled.div`
  display:grid !important; gap:.42rem !important; margin-top:.7rem;
  > span { display:grid;grid-template-columns:minmax(4rem,.7fr) minmax(0,1.3fr);gap:.7rem;border:1px solid rgba(204,199,239,.58);border-radius:.78rem;background:rgba(255,255,255,.72);padding:.52rem .65rem; }
  b { overflow:hidden;color:#293354;font-family:var(--font-kr),sans-serif;font-size:.92rem;font-weight:950;text-overflow:ellipsis;white-space:nowrap; }
  i { overflow:hidden;color:#7a849f;font-size:.8rem;font-style:normal;font-weight:750;text-overflow:ellipsis;white-space:nowrap; }
  em { border-radius:.8rem;background:rgba(255,255,255,.6);padding:.8rem;color:#9299ad;font-size:.82rem;font-style:normal;text-align:center; }
`;

const MyWordsOpen = styled.b`
  grid-column:2;display:flex;align-items:center;justify-content:space-between;gap:.8rem;color:#6554d8;font-size:.94rem;font-weight:950;
  i { display:inline-block;color:currentColor;font-size:1.08rem;font-style:normal;line-height:1; }
`;

const MyWordsScreen = styled.section`display:grid; gap:1rem; animation:${fadeRise} 420ms ease both;`;
const MyWordsHeader = styled.header`
  ${Glass} position:relative; display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:1rem; overflow:hidden; border-radius:1.7rem; padding:1.25rem clamp(1.2rem,3vw,2rem);
  > button { align-self:start; border:1px solid #cbd2f4; border-radius:999px; background:#fff; padding:.7rem .9rem; color:#293454; font-weight:900; cursor:pointer; }
  h1 { margin-top:.35rem; } p { margin-top:.4rem; }
  @media(max-width:620px){ grid-template-columns:1fr; > button{justify-self:start;} }
`;
const LibraryMascot = styled.div`width:7rem;height:7rem; img{width:100%;height:100%;object-fit:contain;} @media(max-width:620px){display:none;}`;
const LibraryToolbar = styled.div`${Glass} display:grid; gap:.8rem; border-radius:1.4rem; padding:1rem; @media(min-width:760px){grid-template-columns:1fr auto;align-items:center;}`;
const LibrarySearch = styled.label`display:flex;align-items:center;gap:.7rem;border:1px solid #cdd4f2;border-radius:1rem;background:#fff;padding:.88rem 1rem; span{color:#7a69e4;font-size:1.45rem;} input{width:100%;border:0;outline:0;background:transparent;color:#273252;font-size:1rem;}`;
const LibraryFilters = styled.div`display:flex;flex-wrap:wrap;gap:.5rem; button{border:1px solid #d5daf0;border-radius:999px;background:#fff;padding:.68rem .9rem;color:#737e9b;font-size:.86rem;font-weight:900;cursor:pointer;} button[data-active="true"]{border-color:#7160e5;background:#7160e5;color:#fff;}`;
const LibraryGrid = styled.div`display:grid;gap:1rem;align-items:start;@media(min-width:820px){grid-template-columns:minmax(0,1.1fr) minmax(19rem,.9fr);}`;
const LibraryList = styled.div`${Glass}display:grid;gap:.55rem;border-radius:1.5rem;padding:1rem;max-height:42rem;overflow:auto;`;
const LibraryWordButton = styled.button<{ $status:"LEARNING"|"REVIEW"|"MASTERED" }>`display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:.85rem;border:1px solid ${({$status})=>$status==='MASTERED'?'#b9eadb':$status==='REVIEW'?'#f0d397':'#cdd3f3'};border-radius:1rem;background:#fff;padding:1rem;text-align:left;cursor:pointer; div{display:grid;gap:.16rem;min-width:0;} strong{color:#202c4f;font-family:var(--font-kr),sans-serif;font-size:1.28rem;font-weight:950;} small{overflow:hidden;color:#7c87a3;font-size:.86rem;text-overflow:ellipsis;white-space:nowrap;} >span:last-child{color:#7a849e;font-size:.76rem;font-weight:900;} &:hover{transform:translateX(3px);box-shadow:0 8px 22px rgba(72,84,136,.08);}`;
const LibraryStatusDot = styled.i`width:.72rem;height:.72rem;border-radius:50%;background:#6d5ee5;box-shadow:0 0 0 5px rgba(109,94,229,.1);`;
const LibraryEmpty = styled.div`padding:3rem 1rem;text-align:center;color:#8991a8;`;
const LibraryDetail = styled.aside`${Glass}position:sticky;top:1rem;display:grid;justify-items:center;border-radius:1.5rem;padding:clamp(1.5rem,3vw,2.3rem);text-align:center; h2{margin-top:1rem;color:#1c2749;font-family:var(--font-kr),sans-serif;font-size:clamp(3.2rem,6vw,5rem);font-weight:950;} h3{color:#7c86a2;font-size:1rem;} h4{margin-top:.85rem;color:#273253;font-size:1.7rem;font-weight:950;} >button{width:min(100%,19rem);margin-top:1.15rem;} @media(max-width:819px){position:static;}`;
const LibraryDetailStatus = styled.span<{ $status:"LEARNING"|"REVIEW"|"MASTERED" }>`border-radius:999px;background:${({$status})=>$status==='MASTERED'?'#e6faf3':$status==='REVIEW'?'#fff4dc':'#efedff'};padding:.58rem .85rem;color:${({$status})=>$status==='MASTERED'?'#248f70':$status==='REVIEW'?'#b77a18':'#6655dc'};font-size:.84rem;font-weight:950;`;
const LibraryExample = styled.div`width:100%;display:grid;gap:.42rem;margin-top:1.35rem;border:1px solid #dce0f3;border-radius:1.1rem;background:#f8f9ff;padding:1.15rem;text-align:left;strong{color:#273254;font-family:var(--font-kr),sans-serif;font-size:1.18rem;}span{color:#7d87a2;font-size:.94rem;line-height:1.55;}`;
const LibraryDetailPlaceholder = styled.div`min-height:25rem;display:grid;place-items:center;align-content:center;gap:.55rem;color:#8991aa;span{width:4rem;height:4rem;display:grid;place-items:center;border-radius:1.3rem;background:#efedff;color:#7160df;font-family:var(--font-kr),sans-serif;font-size:1.6rem;}strong{color:#33405f;font-size:1.15rem;}p{max-width:16rem;font-size:.8rem;line-height:1.5;}`;

const MatchGamePromo = styled.button`
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(67, 191, 174, 0.34);
  border-radius: 1.55rem;
  background:
    radial-gradient(circle at 92% 12%, rgba(255, 255, 255, 0.78), transparent 9rem),
    linear-gradient(145deg, rgba(235, 253, 248, 0.96), rgba(239, 243, 255, 0.96));
  box-shadow: 0 18px 44px rgba(67, 139, 146, 0.12);
  padding: 1.35rem;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;

  &:hover:enabled {
    transform: translateY(-3px);
    border-color: rgba(67, 191, 174, 0.58);
    box-shadow: 0 24px 52px rgba(67, 139, 146, 0.17);
  }

  &:disabled {
    opacity: 0.58;
    cursor: not-allowed;
  }
`;

const MatchPromoTopLine = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
`;

const MatchPromoIcon = styled.span`
  width: 2.7rem;
  height: 2.7rem;
  display: grid;
  place-items: center;
  border-radius: 0.95rem;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 8px 22px rgba(80, 105, 146, 0.12);
  font-size: 1.25rem;
`;

const MatchPromoBadge = styled.span`
  border-radius: 999px;
  background: rgba(124, 108, 242, 0.1);
  color: #6554d8;
  padding: 0.42rem 0.68rem;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

const MatchPromoTitle = styled.h2`
  margin-top: 1rem;
  font-size: clamp(1.35rem, 2.2vw, 1.8rem);
  line-height: 1.12;
  font-weight: 950;
`;

const MatchPromoText = styled.p`
  margin-top: 0.65rem;
  color: #687493;
  font-size: 0.9rem;
  line-height: 1.6;
`;

const MatchPromoDemo = styled.div`
  display: grid;
  gap: 0.48rem;
`;

const MatchPairRow = styled.div`
  display:grid;
  grid-template-columns:minmax(3.5rem,auto) clamp(3rem,7vw,5rem) minmax(4.5rem,auto);
  align-items:center;
  justify-content:center;
  gap:.75rem;
  border:1px solid rgba(190,198,231,.58);
  border-radius:.95rem;
  background:rgba(255,255,255,.7);
  padding:.5rem .7rem;

  span {
    border-radius: 0.7rem;
    background: #fff;
    padding: 0.42rem 0.6rem;
    color: #2d3758;
    font-size: 0.82rem;
    font-weight: 850;
  }

  span:first-child{justify-self:end;background:#e2f8f3;color:#258f7d;}
  span:last-child{justify-self:start;}

  i {
    position:relative;
    width:100%;
    height:3px;
    background:repeating-linear-gradient(90deg,#32d8c5 0 7px,transparent 7px 12px);
  }

  i::before,
  i::after{
    content:"";
    position:absolute;
    top:50%;
    width:.42rem;
    height:.42rem;
    border-radius:50%;
    background:#32d8c5;
    transform:translateY(-50%);
  }

  i::before{left:-.1rem;}
  i::after{right:-.1rem;}
`;

const MatchPromoAction = styled.div`
  margin-top: 1.05rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #287f75;
  font-size: 0.92rem;
  font-weight: 950;

  span {
    font-size: 1.2rem;
  }
`;

const InfoCard = styled.article`
  ${Glass}
  border-radius: 1.55rem;
  padding: 1.35rem;
  animation: ${fadeRise} 380ms ease both;
`;

const HeaderCard = styled(InfoCard)`
  display: grid;
  gap: 1.4rem;
  overflow: hidden;
  border-radius: 2rem;
  padding: clamp(1.5rem, 3vw, 2.2rem);
  background:
    radial-gradient(circle at 92% 10%, rgba(109, 97, 239, 0.12), transparent 18rem),
    linear-gradient(145deg, rgba(255,255,255,0.95), rgba(245,248,255,0.88));
  @media (min-width: 980px) { grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr); align-items: center; }
`;

const StudyGrid = styled.section`
  display: grid;
  gap: 0.9rem;
`;

const RoundResultScreen = styled.section`
  display: grid;
  animation: ${fadeRise} 420ms ease both;
`;

const RoundResultCard = styled.article`
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid rgba(175, 190, 230, 0.58);
  border-radius: clamp(1.5rem, 3vw, 2.4rem);
  background:
    radial-gradient(circle at 4% 2%, rgba(89, 220, 178, 0.18), transparent 25rem),
    radial-gradient(circle at 95% 0%, rgba(139, 112, 248, 0.2), transparent 27rem),
    linear-gradient(145deg, rgba(255,255,255,.98), rgba(244,247,255,.94));
  padding: clamp(1rem, 2.4vw, 1.8rem);
  box-shadow: 0 30px 80px rgba(65, 80, 139, 0.14);

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -2;
    background-image: radial-gradient(rgba(102,91,226,.09) 1px, transparent 1px);
    background-size: 24px 24px;
    mask-image: linear-gradient(120deg, transparent 20%, #000 100%);
  }
`;

const RoundResultDecor = styled.div`
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;

  i {
    position: absolute;
    border: 1px solid rgba(119,110,224,.13);
    background: rgba(255,255,255,.58);
    color: rgba(94,79,206,.3);
    font-style: normal;
    font-weight: 950;
    box-shadow: 0 14px 34px rgba(61,72,121,.07);
    animation: ${softFloat} 4.8s ease-in-out infinite;
  }

  i:nth-child(1) { left: 2%; top: 9%; border-radius: 1.1rem; padding: .75rem .9rem; font-family: var(--font-kr), sans-serif; font-size: 1.35rem; }
  i:nth-child(2) { right: 2%; top: 29%; border-radius: 1rem; padding: .65rem .8rem; font-family: var(--font-kr), sans-serif; color: rgba(79,168,218,.35); animation-delay: -1.2s; }
  i:nth-child(3) { right: 4%; bottom: 7%; border-radius: 999px; padding: .65rem .9rem; font-family: var(--font-kr), sans-serif; color: rgba(49,169,132,.38); animation-delay: -3s; }
  i:nth-child(4) { left: 3%; bottom: 24%; border-radius: 50%; padding: .65rem; font-family: var(--font-kr), sans-serif; color: rgba(115,91,223,.3); animation-delay: -2.1s; }
  i:nth-child(5) { right: 47%; top: 3%; width: 2.5rem; height: 2.5rem; display: grid; place-items: center; border-radius: 50%; color: rgba(240,169,46,.48); animation-delay: -.8s; }

  @media (max-width: 760px) { opacity: .26; }
`;

const RoundResultTopGrid = styled.div`
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, .86fr) minmax(22rem, 1.14fr);
  gap: clamp(1rem, 2vw, 1.5rem);

  @media (max-width: 900px) { grid-template-columns: 1fr; }
`;

const RoundResultHero = styled.section`
  min-height: 29rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.75);
  border-radius: 1.8rem;
  background:
    radial-gradient(circle at 50% 32%, rgba(255, 218, 112, .28), transparent 12rem),
    linear-gradient(150deg, rgba(246,255,252,.92), rgba(244,240,255,.9));
  padding: clamp(1.5rem, 4vw, 3rem);
  text-align: center;
  box-shadow: inset 0 1px rgba(255,255,255,.9), 0 16px 44px rgba(77, 91, 145, .08);

  @media (max-width: 680px) { min-height: 25rem; border-radius: 1.4rem; }
`;

const RoundResultStatus = styled.div<{ $saving: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: .48rem;
  border: 1px solid ${({ $saving }) => $saving ? "rgba(102,91,226,.2)" : "rgba(73,194,157,.3)"};
  border-radius: 999px;
  background: ${({ $saving }) => $saving ? "rgba(241,239,255,.88)" : "rgba(235,255,248,.9)"};
  padding: .52rem .78rem;
  color: ${({ $saving }) => $saving ? "#6656d8" : "#299675"};
  font-size: .74rem;
  font-weight: 900;

  span {
    display: inline-grid;
    place-items: center;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    background: ${({ $saving }) => $saving ? "#7666e8" : "#50c7a3"};
    color: #fff;
    animation: ${({ $saving }) => $saving ? roundSavingSpin : "none"} 900ms linear infinite;
  }
`;

const RoundResultMedal = styled.div`
  position: relative;
  width: 7.2rem;
  height: 7.2rem;
  display: grid;
  place-items: center;
  margin-top: 1.35rem;
  animation: ${roundResultPop} 620ms cubic-bezier(.22,1,.36,1) both;

  &::before, &::after {
    content: "";
    position: absolute;
    inset: -.65rem;
    border: 1px solid rgba(245, 177, 56, .25);
    border-radius: 50%;
    animation: ${resultHalo} 2.6s ease-in-out infinite;
  }
  &::after { inset: -1.25rem; border-style: dashed; animation-delay: -1.3s; }

  > span {
    width: 6rem;
    height: 6rem;
    display: grid;
    place-items: center;
    border: 2px solid rgba(255,255,255,.78);
    border-bottom: 7px solid #df9222;
    border-radius: 50%;
    background: linear-gradient(145deg, #ffe47a, #ffae39);
    color: #fff;
    font-size: 2.7rem;
    text-shadow: 0 3px 8px rgba(148,91,13,.16);
    box-shadow: 0 20px 48px rgba(226,153,43,.28), inset 0 2px rgba(255,255,255,.58);
  }

  i { position: absolute; color: #ffbd3f; font-style: normal; font-size: .8rem; }
  i:nth-of-type(1) { left: -.25rem; top: .8rem; }
  i:nth-of-type(2) { right: -.1rem; top: -.2rem; font-size: 1.05rem; }
  i:nth-of-type(3) { right: -.45rem; bottom: .55rem; }
`;

const RoundResultEyebrow = styled.p`
  margin-top: 1.5rem;
  color: #6c5de0;
  font-size: .78rem;
  font-weight: 950;
  letter-spacing: .12em;
  text-transform: uppercase;
`;

const RoundResultTitle = styled.h1`
  margin-top: .4rem;
  color: #192447;
  font-size: clamp(2.25rem, 4.4vw, 3.6rem);
  font-weight: 950;
  line-height: 1.02;
  letter-spacing: -.045em;
`;

const RoundResultLead = styled.p`
  margin-top: .85rem;
  max-width: 41rem;
  color: #6d7897;
  font-size: clamp(.96rem, 1.5vw, 1.08rem);
  line-height: 1.65;
`;

const RoundResultPraise = styled.div`
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  margin-top: 1.15rem;
  border: 1px solid rgba(239, 179, 64, .28);
  border-radius: 999px;
  background: rgba(255, 249, 228, .9);
  padding: .58rem .85rem;
  color: #a56a12;
  font-size: .78rem;
  font-weight: 950;

  span { font-size: 1rem; }
`;

const RoundScoreBoard = styled.section`
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(183, 194, 226, .6);
  border-radius: 1.8rem;
  background: rgba(255,255,255,.83);
  padding: clamp(1.15rem, 2.8vw, 2rem);
  box-shadow: inset 0 1px rgba(255,255,255,.95), 0 18px 48px rgba(61,75,130,.09);

  @media (max-width: 680px) { border-radius: 1.4rem; }
`;

const RoundScoreHeading = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  text-align: left;

  div { display: grid; gap: .22rem; }
  small { color: #8790aa; font-size: .72rem; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
  strong { color: #202c4f; font-size: clamp(1.2rem, 2vw, 1.55rem); font-weight: 950; }
  > span { flex: 0 0 auto; border-radius: 999px; background: #eafaf4; padding: .52rem .75rem; color: #269b77; font-size: .76rem; font-weight: 950; }
`;

const RoundScoreMain = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: minmax(9rem, .8fr) minmax(0, 1.2fr);
  align-items: center;
  gap: clamp(1rem, 2.5vw, 1.6rem);
  padding: 1.35rem 0;

  @media (max-width: 480px) { grid-template-columns: 1fr; justify-items: center; }
`;

const RoundAccuracyRing = styled.div<{ $value: number }>`
  position: relative;
  width: clamp(9rem, 15vw, 11.5rem);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: conic-gradient(#6d5df0 ${({ $value }) => Math.max(4, $value)}%, #e8e9f8 0);
  box-shadow: 0 17px 38px rgba(103, 88, 224, .2);

  &::before {
    content: "";
    position: absolute;
    inset: .7rem;
    border-radius: inherit;
    background: linear-gradient(145deg, #fff, #f7f6ff);
    box-shadow: inset 0 1px 5px rgba(68,61,142,.08);
  }

  > div { position: relative; display: grid; justify-items: center; gap: .16rem; }
  strong { color: #292852; font-size: clamp(1.7rem, 3vw, 2.35rem); font-weight: 950; letter-spacing: -.04em; }
  small { color: #8189a5; font-size: .72rem; font-weight: 850; }
`;

const RoundResultStats = styled.div`
  display: grid;
  gap: .55rem;
  width: 100%;
`;

const RoundResultStat = styled.div<{ $tone: "green" | "purple" | "orange" | "blue" }>`
  --result-color: ${({ $tone }) => ({ green: "#35ad83", purple: "#7661e9", orange: "#eea337", blue: "#438fdf" })[$tone]};
  --result-soft: ${({ $tone }) => ({ green: "#ecfff8", purple: "#f2efff", orange: "#fff7e8", blue: "#edf6ff" })[$tone]};
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: .7rem;
  border: 1px solid color-mix(in srgb, var(--result-color) 20%, transparent);
  border-radius: 1rem;
  background: var(--result-soft);
  padding: .65rem .72rem;
  text-align: left;

  > span { width: 2rem; height: 2rem; display: grid; place-items: center; border-radius: .68rem; background: var(--result-color); color: #fff; font-weight: 950; box-shadow: 0 7px 16px color-mix(in srgb, var(--result-color) 22%, transparent); }
  div { display: flex; align-items: baseline; justify-content: space-between; gap: .6rem; min-width: 0; }
  strong { color: #243052; font-size: 1.25rem; font-weight: 950; }
  small { color: #737f9f; font-size: .7rem; font-weight: 850; text-align: right; }
`;

const RoundTodayProgress = styled.div`
  --learn-accent: #6a5bea;
  margin-top: auto;
  border-radius: 1.1rem;
  background: linear-gradient(135deg, #f0efff, #f6f8ff);
  padding: .85rem .9rem .9rem;

  > div:first-child { display: flex; align-items: center; justify-content: space-between; gap: 1rem; color: #65708f; }
  > div > span { display: grid; gap: .1rem; text-align: left; }
  strong { color: #283453; font-size: .82rem; }
  small { color: #8b92aa; font-size: .66rem; font-weight: 750; }
  b { color: #6759dd; font-size: .86rem; font-weight: 950; white-space: nowrap; }
`;

const RoundWordsSection = styled.section`
  position: relative;
  z-index: 1;
  margin-top: clamp(1rem, 2vw, 1.5rem);
  border: 1px solid rgba(184,195,226,.56);
  border-radius: 1.65rem;
  background: rgba(255,255,255,.76);
  padding: clamp(1rem, 2.5vw, 1.5rem);
  box-shadow: inset 0 1px rgba(255,255,255,.94);
`;

const RoundWordsHeading = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  text-align: left;

  > div { display: grid; gap: .16rem; }
  small { color: #7564e6; font-size: .66rem; font-weight: 950; letter-spacing: .1em; text-transform: uppercase; }
  span { color: #263252; font-size: 1.08rem; font-weight: 950; }
  b { border-radius: 999px; background: #efedff; padding: .42rem .65rem; color: #6655d7; font-size: .72rem; font-weight: 950; white-space: nowrap; }
`;

const RoundWordsGrid = styled.div`
  margin-top: .8rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: .55rem;

  @media (min-width: 940px) { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  @media (max-width: 520px) { grid-template-columns: 1fr; }
`;

const RoundWordChip = styled.div<{ $mastered: boolean }>`
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: .65rem;
  border: 1px solid ${({ $mastered }) => $mastered ? "rgba(86,204,169,.3)" : "rgba(238,163,55,.28)"};
  border-radius: 1rem;
  background: ${({ $mastered }) => $mastered ? "rgba(239,255,249,.88)" : "rgba(255,248,235,.88)"};
  padding: .72rem .78rem;
  text-align: left;
  box-shadow: 0 8px 18px rgba(62,76,125,.05);
  animation: ${resultWordIn} 420ms cubic-bezier(.22,1,.36,1) both;
  animation-delay: var(--word-delay, 0ms);

  > span { width: 1.65rem; height: 1.65rem; display: grid; place-items: center; border-radius: .55rem; background: ${({ $mastered }) => $mastered ? "#58cbaa" : "#f1ae4c"}; color: #fff; font-size: .72rem; font-weight: 950; }
  div { min-width: 0; display: grid; gap: .06rem; }
  strong { overflow: hidden; color: #253050; font-family: var(--font-kr), sans-serif; font-size: 1rem; font-weight: 950; text-overflow: ellipsis; white-space: nowrap; }
  small { overflow: hidden; color: #7d88a5; font-size: .7rem; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
  em { border-radius: 999px; background: ${({ $mastered }) => $mastered ? "rgba(72,190,155,.12)" : "rgba(235,160,56,.12)"}; padding: .3rem .44rem; color: ${({ $mastered }) => $mastered ? "#299373" : "#bc7721"}; font-size: .6rem; font-style: normal; font-weight: 950; }

  @media (max-width: 430px) { em { display: none; } }
`;

const RoundResultError = styled.p`
  width: min(100%, 40rem);
  margin-top: 1rem;
  border: 1px solid #ffc0cc;
  border-radius: 1rem;
  background: #fff2f5;
  padding: .75rem 1rem;
  color: #d65e78;
  font-size: .82rem;
  font-weight: 850;
`;

const RoundResultActions = styled.div`
  position: relative;
  z-index: 1;
  margin-top: 1.35rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: .65rem;

  > span { color: #8991a8; font-size: .68rem; font-weight: 750; text-align: center; }
  > button { min-width: min(100%, 21rem); }
`;

const LearningHud = styled.header<{ $kind: LearningStep["kind"] }>`
  --learn-accent: ${({ $kind }) => $kind === "preview" ? "#4d70eb" : $kind === "quiz" ? "#6a5bea" : "#3f8ee8"};
  --learn-soft: ${({ $kind }) => $kind === "preview" ? "#edf3ff" : $kind === "quiz" ? "#f0edff" : "#eaf4ff"};
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--learn-accent) 23%, #d7dcef);
  border-radius: 1.65rem;
  background:
    radial-gradient(circle at 86% -35%, color-mix(in srgb, var(--learn-accent) 18%, transparent), transparent 18rem),
    rgba(255,255,255,0.9);
  padding: clamp(0.85rem, 2vw, 1.15rem);
  box-shadow: 0 14px 38px rgba(62, 76, 134, 0.1);
`;

const LearningHudMain = styled.div`
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: center;
  gap: clamp(0.65rem, 1.5vw, 1rem);

  @media (max-width: 700px) {
    grid-template-columns: auto auto minmax(0, 1fr);
  }
`;

const LearningExitButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  border: 0;
  background: transparent;
  color: #6d7693;
  font-size: 0.84rem;
  font-weight: 900;
  cursor: pointer;

  span {
    display: inline-block;
    color: #77809d;
    font-size: 1.35rem;
    line-height: 1;
    transition: color 140ms ease;
  }

  &:hover span { color: #293454; }

  @media (max-width: 560px) { b { display: none; } }
`;

const LearningActivityIcon = styled.span`
  width: 3rem;
  height: 3rem;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--learn-accent) 22%, transparent);
  border-bottom-width: 4px;
  border-radius: 1rem;
  background: var(--learn-soft);
  font-size: 1.35rem;
`;

const LearningHudCopy = styled.div`
  min-width: 0;
  display: grid;
  gap: 0.16rem;

  small {
    color: var(--learn-accent);
    font-size: 0.68rem;
    font-weight: 950;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  strong {
    overflow: hidden;
    color: #202b4e;
    font-size: clamp(0.98rem, 1.7vw, 1.22rem);
    font-weight: 950;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const LearningHudStats = styled.div`
  display: flex;
  gap: 0.55rem;

  @media (max-width: 700px) { display: none; }
`;

const LearningHudStat = styled.div`
  min-width: 5.7rem;
  display: grid;
  gap: 0.08rem;
  border: 1px solid rgba(190, 198, 226, 0.58);
  border-radius: 1rem;
  background: rgba(255,255,255,0.75);
  padding: 0.55rem 0.75rem;

  small { color: #8a94ae; font-size: 0.63rem; font-weight: 850; text-transform: uppercase; }
  strong { color: #263252; font-size: 1.05rem; font-weight: 950; }
  strong span { color: #8a94ae; font-size: 0.72rem; }
`;

const LearningProgressTrack = styled.div`
  height: 0.72rem;
  margin-top: 0.8rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(122, 135, 181, 0.13);
  box-shadow: inset 0 2px 4px rgba(69, 79, 123, 0.08);
`;

const LearningProgressFill = styled.div<{ $value: number }>`
  position: relative;
  width: ${({ $value }) => `${Math.max(2.5, Math.min(100, $value))}%`};
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, color-mix(in srgb, var(--learn-accent) 58%, #8fc5ff), var(--learn-accent));
  box-shadow: 0 0 16px color-mix(in srgb, var(--learn-accent) 38%, transparent);
  transition: width 420ms cubic-bezier(0.22, 1, 0.36, 1);

  &::after {
    content: "";
    position: absolute;
    top: 50%;
    right: 0.15rem;
    width: 0.34rem;
    height: 0.34rem;
    border-radius: 50%;
    background: #fff;
    transform: translateY(-50%);
    box-shadow: 0 0 0 3px rgba(255,255,255,0.26);
  }
`;

const MatchGameScreen = styled.section`
  display: grid;
  gap: 1.1rem;
  animation: ${fadeRise} 420ms ease both;
`;

const MatchTopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
`;

const MatchBackButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.74);
  padding: 0.7rem 1rem 0.7rem 0.72rem;
  color: #2b3455;
  font-size: 0.94rem;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(61, 74, 123, 0.08);

  span {
    display: inline-block;
    color: #6655e9;
    font-size: 1.12rem;
    line-height: 1;
  }
`;

const MatchDailyStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 0.65rem;
  color: #77819c;
  font-size: 0.82rem;
  font-weight: 800;

  strong {
    border-radius: 999px;
    background: rgba(223, 250, 244, 0.9);
    padding: 0.48rem 0.72rem;
    color: #238a78;
    font-size: 0.9rem;
  }

  @media (max-width: 480px) {
    > span { display: none; }
  }
`;

const MatchLaunchCard = styled.section`
  ${Glass}
  position: relative;
  isolation: isolate;
  overflow: hidden;
  min-height: 35rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 2.25rem;
  padding: clamp(2rem, 6vw, 4.7rem) clamp(1.2rem, 5vw, 3rem);
  text-align: center;
  background:
    radial-gradient(circle at 14% 18%, rgba(105, 219, 196, 0.22), transparent 20rem),
    radial-gradient(circle at 88% 16%, rgba(151, 123, 247, 0.22), transparent 21rem),
    linear-gradient(145deg, rgba(255,255,255,0.96), rgba(243,246,255,0.9));
  box-shadow: 0 30px 80px rgba(79, 92, 144, 0.13);

  &::before,
  &::after {
    content: "";
    position: absolute;
    z-index: -1;
    border-radius: 50%;
    filter: blur(1px);
  }

  &::before { width: 18rem; height: 18rem; left: -8rem; bottom: -9rem; background: rgba(83, 205, 176, 0.12); }
  &::after { width: 22rem; height: 22rem; right: -9rem; bottom: -12rem; background: rgba(115, 92, 234, 0.12); }
`;

const MatchLaunchDecor = styled.div`
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;

  span {
    position: absolute;
    border: 1px solid rgba(124, 108, 242, 0.15);
    border-radius: 1.25rem;
    background: rgba(255,255,255,0.68);
    padding: 1rem 1.35rem;
    color: rgba(55, 62, 101, 0.44);
    font-family: var(--font-kr), var(--font-ui), sans-serif;
    font-weight: 950;
    box-shadow: 0 15px 40px rgba(69, 81, 132, 0.08);
    animation: ${softFloat} 4.5s ease-in-out infinite;
  }

  span:nth-child(1) { left: 6%; top: 18%; font-size: 1.7rem; }
  span:nth-child(2) { right: 7%; top: 14%; font-size: 1.25rem; animation-delay: -1.1s; }
  span:nth-child(3) { left: 11%; bottom: 18%; font-size: 1.1rem; animation-delay: -2.2s; }
  span:nth-child(4) { right: 9%; bottom: 17%; font-size: 1.55rem; animation-delay: -3.1s; }
  span:nth-child(5) { left: 25%; top: 8%; font-size: 0.95rem; animation-delay: -1.7s; }
  span:nth-child(6) { right: 24%; bottom: 8%; font-size: 1rem; animation-delay: -3.7s; }

  @media (max-width: 680px) {
    opacity: 0.32;
    span:nth-child(n+5) { display: none; }
  }
`;

const MatchLaunchIcon = styled.span`
  width: 5rem;
  height: 5rem;
  display: grid;
  place-items: center;
  margin-bottom: 1rem;
  border-radius: 1.65rem;
  background: linear-gradient(145deg, #8875f6, #5e4de3);
  color: #fff;
  font-size: 2rem;
  box-shadow: 0 18px 40px rgba(94, 77, 227, 0.28), inset 0 1px rgba(255,255,255,0.42);
  transform: rotate(-4deg);
`;

const MatchGameHeader = styled.header`
  ${Glass}
  display: grid;
  gap: 1.25rem;
  align-items: center;
  border-radius: 1.8rem;
  padding: clamp(1.35rem, 3vw, 2rem);
  background:
    radial-gradient(circle at 82% 0%, rgba(67, 191, 174, 0.13), transparent 18rem),
    rgba(255, 255, 255, 0.86);

  @media (min-width: 820px) {
    grid-template-columns: minmax(0, 1fr) auto;
  }
`;

const MatchGameTitle = styled.h1`
  margin-top: 0.45rem;
  font-size: clamp(2rem, 4.6vw, 3.25rem);
  line-height: 1.08;
  font-weight: 950;
`;

const MatchGameDescription = styled.p`
  margin: 0.75rem auto 0;
  max-width: 48rem;
  color: #687493;
  font-size: clamp(0.98rem, 1.6vw, 1.12rem);
  line-height: 1.7;
`;

const MatchLaunchFeatures = styled.div`
  width: min(100%, 42rem);
  margin-top: 2rem;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;

  @media (max-width: 560px) { grid-template-columns: 1fr; }
`;

const MatchFeature = styled.div`
  display: grid;
  justify-items: center;
  gap: 0.25rem;
  border: 1px solid rgba(197, 203, 233, 0.58);
  border-radius: 1.25rem;
  background: rgba(255,255,255,0.68);
  padding: 0.9rem;

  span { font-size: 1.4rem; }
  strong { color: #273252; font-size: 0.9rem; }
  small { color: #8a94ad; font-size: 0.75rem; }
`;

const MatchAttemptRow = styled.div`
  width: min(100%, 30rem);
  margin-top: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: #687493;
  font-size: 0.88rem;
  font-weight: 850;
`;

const MatchAttemptDots = styled.div`
  display: flex;
  gap: 0.42rem;

  i {
    width: 0.78rem;
    height: 0.78rem;
    border: 2px solid #a9b2d2;
    border-radius: 50%;
    background: #fff;
  }

  i[data-used="true"] {
    border-color: #6f5ce8;
    background: #6f5ce8;
    box-shadow: 0 0 0 4px rgba(111, 92, 232, 0.1);
  }
`;

const MatchStartButton = styled.button`
  min-width: min(100%, 20rem);
  margin-top: 1.4rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.85rem;
  border: 0;
  border-bottom: 5px solid #4937c8;
  border-radius: 1.15rem;
  background: linear-gradient(135deg, #806cf3, #5c48e5);
  padding: 1.1rem 1.45rem 0.95rem;
  color: #fff;
  font-size: 1.08rem;
  font-weight: 950;
  cursor: pointer;
  box-shadow: 0 18px 42px rgba(92, 72, 229, 0.25);
  transition: transform 160ms ease, box-shadow 160ms ease;

  span { font-size: 1.25rem; }
  &:hover { transform: translateY(-2px); box-shadow: 0 23px 50px rgba(92, 72, 229, 0.3); }
  &:active { transform: translateY(2px); border-bottom-width: 2px; }
`;

const MatchHeaderActions = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: center;
  gap: 0.7rem;
`;

const MatchMetric = styled.div<{ $danger?: boolean }>`
  min-width: 6.9rem;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  column-gap: 0.5rem;
  border: 1px solid ${({ $danger }) => $danger ? "rgba(230, 112, 137, 0.25)" : "rgba(195, 202, 230, 0.52)"};
  border-radius: 1rem;
  background: ${({ $danger }) => $danger ? "rgba(255,242,246,0.86)" : "rgba(255,255,255,0.72)"};
  padding: 0.65rem 0.75rem;

  span { grid-row: 1 / 3; font-size: 1.25rem; }
  small { color: #8a94ad; font-size: 0.65rem; font-weight: 800; }
  strong { color: ${({ $danger }) => $danger ? "#ca5576" : "#293354"}; font-size: 1rem; font-weight: 950; }
`;

const MatchProgressTrack = styled.div`
  grid-column: 1 / -1;
  height: 0.65rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(100, 116, 170, 0.12);
`;

const MatchProgressFill = styled.div<{ $value: number }>`
  width: ${({ $value }) => `${Math.max(0, Math.min(100, $value))}%`};
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #5bcdb5, #6d61ef);
  box-shadow: 0 0 18px rgba(91, 205, 181, 0.4);
  transition: width 420ms cubic-bezier(0.22, 1, 0.36, 1);
`;

const MatchBoard = styled.div`
  ${Glass}
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(2.4rem, 9vw, 9rem);
  min-height: 36rem;
  overflow: hidden;
  border-radius: 2rem;
  padding: clamp(1rem, 3.5vw, 2.25rem);
  background:
    radial-gradient(circle at 50% 50%, rgba(124, 108, 242, 0.045), transparent 25rem),
    rgba(255, 255, 255, 0.88);

  @media (max-width: 540px) {
    gap: 1rem;
    min-height: 31rem;
    padding: 0.9rem 0.7rem;
  }
`;

const MatchLineLayer = styled.svg`
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;

  path {
    fill: none;
    stroke-linecap: round;
  }

  .match-line-glow {
    stroke-width: 10;
    opacity: 0.14;
    filter: blur(4px);
    stroke-dasharray: 1;
    animation: ${lineReveal} 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .match-line-core {
    stroke-width: 4;
    stroke-dasharray: 1;
    filter: drop-shadow(0 3px 4px rgba(68, 67, 119, 0.13));
    animation: ${lineReveal} 560ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .match-line-flow {
    stroke-width: 2;
    stroke: rgba(255,255,255,0.92);
    stroke-dasharray: 0.06 0.12;
    animation: ${lineFlow} 1.25s linear infinite;
  }
`;

const MatchColumn = styled.div`
  position: relative;
  z-index: 2;
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 0.95rem;
`;

const MatchColumnLabel = styled.p`
  min-height: 1.7rem;
  color: #6d5be3;
  font-size: 0.82rem;
  font-weight: 950;
  letter-spacing: 0.08em;
  text-transform: uppercase;

  @media (max-width: 540px) {
    font-size: 0.65rem;
    letter-spacing: 0.035em;
  }
`;

const MatchChoice = styled.button<{
  $selected?: boolean;
  $matched?: boolean;
  $wrong?: boolean;
  $translation?: boolean;
}>`
  position: relative;
  min-width: 0;
  min-height: 4.95rem;
  display: flex;
  flex-direction: ${({ $translation }) => ($translation ? "row" : "row")};
  align-items: center;
  justify-content: ${({ $translation }) => ($translation ? "flex-start" : "space-between")};
  gap: 0.7rem;
  border: 1px solid ${({ $selected, $matched, $wrong }) =>
    $wrong
      ? "rgba(225, 92, 118, 0.66)"
      : $matched
        ? "rgba(67, 191, 174, 0.5)"
        : $selected
          ? "rgba(124, 108, 242, 0.68)"
          : "rgba(189, 198, 218, 0.72)"};
  border-bottom-width: ${({ $selected }) => ($selected ? "3px" : "4px")};
  border-radius: 1.25rem;
  background: ${({ $selected, $matched, $wrong }) =>
    $wrong
      ? "rgba(255, 240, 244, 0.96)"
      : $matched
        ? "rgba(235, 253, 248, 0.96)"
        : $selected
          ? "rgba(244, 241, 255, 0.98)"
          : "rgba(250, 251, 255, 0.96)"};
  padding: 0.95rem clamp(0.72rem, 2vw, 1.2rem);
  color: #1f2948;
  text-align: left;
  cursor: pointer;
  box-shadow: ${({ $selected }) => ($selected ? "0 10px 24px rgba(124, 108, 242, 0.14)" : "none")};
  transform: ${({ $selected }) => ($selected ? "translateY(1px)" : "none")};
  transition: border-color 160ms ease, background 160ms ease, transform 160ms ease, box-shadow 160ms ease;
  animation: ${({ $wrong }) => ($wrong ? choiceShake : "none")} 320ms ease both;

  strong {
    min-width: 0;
    overflow-wrap: anywhere;
    font-family: ${({ $translation }) => ($translation ? "inherit" : "var(--font-kr), var(--font-ui), sans-serif")};
    font-size: clamp(1.04rem, 2.15vw, 1.38rem);
    font-weight: 900;
    line-height: 1.35;
  }

  small {
    margin-left: auto;
    color: #8590ab;
    font-size: 0.76rem;
    font-weight: 700;
  }

  &:hover:enabled {
    transform: translateY(-2px);
    border-color: rgba(124, 108, 242, 0.48);
    background: #fff;
  }

  &:disabled {
    cursor: default;
  }

  @media (max-width: 540px) {
    min-height: 4.35rem;
    gap: 0.4rem;
    border-radius: 0.95rem;
    padding: 0.65rem;

    small {
      display: none;
    }
  }
`;

const MatchDot = styled.span<{ $matched: boolean }>`
  flex: 0 0 auto;
  width: 0.7rem;
  height: 0.7rem;
  border: 2px solid ${({ $matched }) => ($matched ? "#43bfae" : "rgba(124, 108, 242, 0.38)")};
  border-radius: 50%;
  background: ${({ $matched }) => ($matched ? "#43bfae" : "#fff")};
  box-shadow: 0 0 0 4px ${({ $matched }) => ($matched ? "rgba(67, 191, 174, 0.12)" : "rgba(124, 108, 242, 0.07)")};
`;

const MatchHint = styled.div`
  ${Glass}
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  border-radius: 1.25rem;
  padding: 0.9rem 1rem;
  color: #687493;
  font-size: 0.95rem;
  font-weight: 800;
  text-align: center;
`;

const MatchResultCard = styled.section<{ $grade: SprintResult["grade"] }>`
  ${Glass}
  position: relative;
  overflow: hidden;
  min-height: 35rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 2.25rem;
  padding: clamp(2rem, 6vw, 4.5rem) clamp(1rem, 5vw, 3rem);
  background: ${({ $grade }) => $grade === "PERFECT"
    ? "radial-gradient(circle at 50% 5%, rgba(255,205,94,.3), transparent 20rem), linear-gradient(145deg,#fffdf7,#f8fbff)"
    : "radial-gradient(circle at 50% 5%, rgba(91,205,181,.22), transparent 20rem), linear-gradient(145deg,#fff,#f5f8ff)"};
  text-align: center;
  box-shadow: 0 30px 80px rgba(79, 92, 144, 0.13);
  animation: ${fadeRise} 420ms ease both;
`;

const MatchResultBurst = styled.span`
  width: 5.3rem;
  height: 5.3rem;
  display: grid;
  place-items: center;
  margin-bottom: 1rem;
  border-radius: 50%;
  background: linear-gradient(145deg, #ffd266, #ffab45);
  color: #fff;
  font-size: 2.2rem;
  box-shadow: 0 0 0 12px rgba(255,196,85,0.12), 0 18px 42px rgba(229,155,49,0.23);
`;

const MatchResultTitle = styled.h1`
  margin-top: 0.45rem;
  color: #1d274a;
  font-size: clamp(2.2rem, 5vw, 3.7rem);
  font-weight: 950;
  line-height: 1;
`;

const MatchResultText = styled.p`
  margin-top: 0.85rem;
  max-width: 35rem;
  color: #6e7896;
  font-size: 1.02rem;
  line-height: 1.65;
`;

const MatchResultGrid = styled.div`
  width: min(100%, 46rem);
  margin-top: 1.75rem;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;

  @media (max-width: 600px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
`;

const MatchResultStat = styled.div<{ $xp?: boolean }>`
  display: grid;
  justify-items: center;
  gap: 0.2rem;
  border: 1px solid ${({ $xp }) => $xp ? "rgba(130,100,238,.28)" : "rgba(198,205,231,.62)"};
  border-radius: 1.25rem;
  background: ${({ $xp }) => $xp ? "rgba(241,237,255,.9)" : "rgba(255,255,255,.78)"};
  padding: 1rem 0.7rem;

  span { font-size: 1.25rem; }
  strong { color: ${({ $xp }) => $xp ? "#6650df" : "#273252"}; font-size: 1.35rem; font-weight: 950; }
  small { color: #8a94ad; font-size: 0.72rem; font-weight: 800; }
`;

const MatchSaveError = styled.p`
  margin-top: 1rem;
  border-radius: 0.9rem;
  background: rgba(255,235,241,.86);
  padding: 0.7rem 1rem;
  color: #bd4f70;
  font-size: 0.86rem;
  font-weight: 800;
`;

const MatchResultActions = styled.div`
  margin-top: 1.5rem;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.7rem;
`;

const MatchResultDaily = styled.p`
  margin-top: 1.1rem;
  color: #7e88a3;
  font-size: 0.82rem;
  font-weight: 800;
`;

const HeaderActions = styled.div`
  display: grid;
  gap: 0.8rem;
`;

const HeaderButtons = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
`;

const Eyebrow = styled.p`
  font-size: 0.82rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--accent-dark);
`;

const HeroTitle = styled.h1`
  margin-top: 0.8rem;
  font-size: clamp(2rem, 3.6vw, 3.2rem);
  line-height: 1.05;
  font-weight: 900;
`;

const StudyTitle = styled.h2`
  margin-top: 0.3rem;
  font-size: clamp(1.55rem, 2.8vw, 2.35rem);
  line-height: 1.08;
  font-weight: 900;
`;

const HeroText = styled.p`
  margin-top: 0.95rem;
  color: var(--ink-soft);
  line-height: 1.75;
  max-width: 49rem;
`;

const LearningStats = styled.div`
  margin-top: 1.25rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
`;

const LearningStat = styled.div`
  display: flex;
  align-items: center;
  gap: 0.55rem;
  border: 1px solid rgba(189, 198, 235, 0.58);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.75);
  padding: 0.45rem 0.75rem 0.45rem 0.5rem;
  color: #697493;
  font-size: 0.83rem;
  font-weight: 750;

  strong {
    color: #222c51;
    font-weight: 950;
  }
`;

const LearningStatIcon = styled.span<{ $tone: "orange" | "green" | "purple" }>`
  width: 1.85rem;
  height: 1.85rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: ${({ $tone }) =>
    $tone === "orange"
      ? "rgba(255, 184, 77, 0.16)"
      : $tone === "green"
        ? "rgba(67, 191, 174, 0.16)"
        : "rgba(124, 108, 242, 0.14)"};
  color: ${({ $tone }) =>
    $tone === "orange" ? "#d9850f" : $tone === "green" ? "#219988" : "#6655db"};
  font-size: 0.88rem;
  font-weight: 950;
`;

const MiniLabel = styled.p`
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--ink-soft);
`;

const MiniText = styled.p`
  margin-top: 0.55rem;
  color: var(--ink-soft);
  line-height: 1.65;
`;

const ResultMeta = styled.p`
  margin-top: 0.8rem;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--accent-dark);
`;

const BigValue = styled.p`
  margin-top: 0.45rem;
  font-size: clamp(1.55rem, 3vw, 2.2rem);
  font-weight: 900;
  line-height: 1.15;
`;

const BulletList = styled.ul`
  margin-top: 1.35rem;
  display: grid;
  gap: 0.7rem;
`;

const BulletItem = styled.li`
  list-style: none;
  border-radius: 1rem;
  border: 1px solid var(--line);
  background: rgba(255,255,255,0.82);
  padding: 0.9rem 1rem;
  color: var(--ink-soft);
  line-height: 1.6;
`;

const ActionRow = styled.div`
  margin-top: 1.2rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
`;

const ActionRowCentered = styled(ActionRow)`
  justify-content: center;
`;

const RoundSizeGrid = styled.div`
  position: relative;
  margin-top: 1.25rem;
  display: grid;
  align-items: start;
  gap: clamp(0.75rem, 1.4vw, 1.1rem);

  @media (min-width: 640px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }

  @media (min-width: 1180px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));

    &::before {
      content: "";
      position: absolute;
      top: 5.05rem;
      left: 11%;
      right: 11%;
      z-index: 0;
      height: 4px;
      border-radius: 999px;
      background: linear-gradient(90deg, #45bd94, #559cf0, #8a72e8, #353b4c);
      box-shadow: 0 0 0 6px rgba(255, 255, 255, 0.72);
      opacity: 0.5;
    }
  }
`;

const RoundChooser = styled.div`
  margin-top: 1.5rem;
  border-radius: 1.65rem;
  border: 1px solid rgba(124, 108, 242, 0.16);
  background: linear-gradient(155deg, rgba(249, 249, 255, 0.94), rgba(238, 241, 255, 0.88));
  padding: clamp(1.25rem, 2.2vw, 1.75rem);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.75);
`;

const RoundChooserTitle = styled.p`
  font-size: clamp(1.35rem, 2vw, 1.58rem);
  font-weight: 950;
  color: var(--accent-dark);
`;

const RoundChooserText = styled.p`
  margin-top: 0.55rem;
  color: var(--ink-soft);
  font-size: clamp(1.02rem, 1.3vw, 1.16rem);
  line-height: 1.65;
`;



const buttonBase = `
  border-radius: 999px;
  padding: 0.95rem 1.35rem;
  font-size: 0.95rem;
  font-weight: 800;
`;

const PrimaryButton = styled.button`
  ${buttonBase}
  border: 0;
  border-bottom: 4px solid #4437c7;
  color: #fff;
  background: linear-gradient(135deg, #4d79ff 0%, #6a4dff 100%);
  box-shadow: 0 18px 40px rgba(91, 114, 255, 0.26);
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;

  &:hover:enabled {
    transform: translateY(-2px);
    box-shadow: 0 22px 46px rgba(91, 114, 255, 0.32);
  }

  &:active:enabled {
    transform: translateY(2px);
    border-bottom-width: 2px;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const LearningContinueButton = styled(PrimaryButton)`
  min-width: min(100%, 18rem);
  min-height: 3.8rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.85rem;
  border-radius: 1.15rem;
  padding: 1rem 1.6rem 0.88rem;
  font-size: 1.08rem;
  font-weight: 950;

  &::after {
    content: "→";
    display: inline-block;
    color: currentColor;
    font-size: 1.1rem;
    line-height: 1;
    transition: transform 160ms ease;
  }

  &:hover:enabled::after {
    transform: translateX(3px);
  }
`;


const GhostButton = styled.button`
  ${buttonBase}
  border: 1px solid var(--line-strong);
  background: rgba(255,255,255,0.88);
  cursor: pointer;
`;

const RoundSizeButton = styled.button<{ $tone: number }>`
  --round-accent: ${({ $tone }) => ["#269b77", "#3378d5", "#7056d9", "#202532"][$tone % 4]};
  --round-accent-2: ${({ $tone }) => ["#4cc59c", "#63a9f5", "#9a83f2", "#4a5265"][$tone % 4]};
  --round-shadow: ${({ $tone }) => ["#559cf2", "#3378d5", "#7056d9", "#202532"][$tone % 4]};
  --round-soft: ${({ $tone }) => ["#e9faf3", "#edf5ff", "#f2efff", "#eef0f4"][$tone % 4]};
  --round-line: ${({ $tone }) => ["#9ddbc8", "#abcdf4", "#c9bef3", "#aeb4c2"][$tone % 4]};
  position: relative;
  z-index: 1;
  border: 0;
  background: transparent;
  padding: 0.5rem 0.25rem;
  display: grid;
  justify-items: center;
  align-content: start;
  gap: 0.35rem;
  min-height: 16.6rem;
  color: var(--ink);
  text-align: center;
  cursor: pointer;
  transition: transform 200ms ease, opacity 180ms ease;

  &:hover:enabled {
    transform: translateY(-5px);
  }

  &:hover:enabled > span:first-child {
    transform: rotate(-3deg) scale(1.055);
    box-shadow:
      0 24px 42px color-mix(in srgb, var(--round-shadow) 36%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.4);
  }

  &:hover:enabled > span:last-child {
    background: var(--round-accent);
    color: #fff;
    border-color: var(--round-accent);
  }

  &:active:enabled {
    transform: translateY(1px) scale(0.98);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const RoundSizeTop = styled.span`
  position: relative;
  width: clamp(7.8rem, 11vw, 9.15rem);
  height: clamp(7.8rem, 11vw, 9.15rem);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.1rem;
  border: 1px solid rgba(255, 255, 255, 0.56);
  border-radius: 2.85rem;
  background:
    radial-gradient(circle at 28% 18%, rgba(255, 255, 255, 0.34), transparent 34%),
    linear-gradient(145deg, var(--round-accent-2), var(--round-accent));
  color: #fff;
  box-shadow:
    0 17px 34px color-mix(in srgb, var(--round-shadow) 30%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.42),
    inset 0 -7px 16px rgba(28, 30, 79, 0.11);
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms ease;

  &::after {
    content: "";
    position: absolute;
    inset: 0.48rem;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 2.2rem;
    pointer-events: none;
  }
`;

const RoundSizeNumber = styled.strong`
  color: #fff;
  font-size: clamp(2.9rem, 4.5vw, 3.7rem);
  font-weight: 950;
  line-height: 1;
  text-shadow: 0 4px 16px rgba(32, 33, 87, 0.16);
`;

const RoundChoiceBadge = styled.span`
  position: absolute;
  top: -0.35rem;
  right: -0.55rem;
  z-index: 2;
  border: 3px solid rgba(255, 255, 255, 0.96);
  border-radius: 999px;
  background: #fff;
  color: var(--round-accent);
  padding: 0.43rem 0.7rem;
  font-size: 0.72rem;
  font-weight: 950;
  letter-spacing: 0.045em;
  text-transform: uppercase;
  box-shadow: 0 8px 18px rgba(55, 64, 115, 0.12);
`;

const RoundOrbCaption = styled.span`
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.8rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

const RoundSizeLabel = styled.span`
  margin-top: 0.85rem;
  color: #263150;
  font-size: clamp(1.14rem, 1.45vw, 1.28rem);
  font-weight: 950;
  line-height: 1.3;
`;

const RoundSizeMeta = styled.span`
  min-height: 1.35rem;
  color: #7a86a2;
  font-size: clamp(0.84rem, 1vw, 0.92rem);
  font-weight: 750;
  line-height: 1.3;
`;

const RoundSizeAction = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-width: 8.7rem;
  min-height: 2.75rem;
  box-sizing: border-box;
  margin-top: 0.4rem;
  border: 1px solid var(--round-line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  padding: 0.52rem 0.58rem 0.52rem 0.82rem;
  color: var(--round-accent);
  font-size: 0.9rem;
  font-weight: 950;
  box-shadow: 0 7px 16px rgba(60, 67, 121, 0.08);
  transition: color 180ms ease, background 180ms ease, border-color 180ms ease;

  > span:first-child {
    min-width: 0;
    white-space: nowrap;
  }
`;

const RoundPlayIcon = styled.span`
  flex: 0 0 auto;
  display: inline-block;
  color: var(--round-accent);
  font-size: 1rem;
  line-height: 1;
  transition: transform 180ms ease;

  ${RoundSizeButton}:hover & {
    transform: translateX(3px);
    color: #fff;
  }
`;


const ProgressBar = styled.div`
  margin-top: 1rem;
  height: 0.9rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(92, 114, 255, 0.14);
`;

const ProgressFill = styled.div<{ $value: number }>`
  width: ${({ $value }) => `${Math.max(0, Math.min(100, $value))}%`};
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #57d3ca 0%, #5b72ff 100%);
`;
const PreviewWord = styled.p`
  margin-top: 0.85rem;
  font-size: clamp(2rem, 4.2vw, 3rem);
  font-weight: 900;
`;


const OptionPreviewGrid = styled.div`
  margin-top: 1rem;
  display: grid;
  gap: 0.6rem;
`;

const TranslationPanel = styled.div`
  width: min(100%, 46rem);
  margin: 1.6rem auto 0;
  border-radius: 1.6rem;
  border: 1px solid rgba(120, 108, 238, 0.2);
  background:
    radial-gradient(circle at 10% 0%, rgba(82, 143, 255, 0.14), transparent 13rem),
    linear-gradient(145deg, rgba(255,255,255,0.97), rgba(239,242,255,0.92));
  padding: clamp(1.15rem, 3vw, 1.7rem);
  box-shadow: inset 0 1px 0 #fff, 0 14px 34px rgba(71, 83, 137, 0.08);
`;

const LearningExample = styled.div`
  width:min(100%,38rem);
  display:grid;
  justify-items:center;
  gap:.36rem;
  margin:1.15rem auto 0;
  border-top:1px solid rgba(145,155,213,.32);
  padding:1rem .25rem 0;
  small{color:#5d68d9;font-size:.72rem;font-weight:950;letter-spacing:.1em;text-transform:uppercase;}
  strong{color:#263253;font-family:var(--font-kr),sans-serif;font-size:clamp(1.08rem,1.8vw,1.3rem);font-weight:900;line-height:1.65;text-align:center;}
  mark{border-radius:.4rem;background:linear-gradient(135deg,#dbe8ff,#e4ddff);padding:.06em .22em;color:#3f55c8;box-shadow:inset 0 -2px 0 rgba(86,102,218,.16);}
  span{color:#7a85a1;font-size:clamp(.88rem,1.2vw,.98rem);line-height:1.5;text-align:center;}
`;


const OptionPreview = styled.div<{ $correct?: boolean }>`
  border-radius: 0.9rem;
  border: 1px solid ${({ $correct }) => ($correct ? "rgba(47, 143, 131, 0.38)" : "var(--line)")};
  background: ${({ $correct }) => ($correct ? "rgba(47, 143, 131, 0.12)" : "rgba(255,255,255,0.82)")};
  padding: 0.8rem 0.9rem;
  color: ${({ $correct }) => ($correct ? "#2f8f83" : "var(--ink)")};
  font-weight: 700;
`;

const SmallCard = styled.div`
  border-radius: 1.25rem;
  border: 1px solid rgba(180, 191, 232, 0.58);
  background: rgba(255,255,255,0.72);
  padding: 1rem 1.1rem;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.85);
`;

const DeckCard = styled.article<{ $leaving?: boolean }>`
  ${Glass}
  position: relative;
  isolation: isolate;
  overflow: hidden;
  min-height: clamp(27rem, 46vh, 34rem);
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-radius: 2.15rem;
  padding: clamp(1.5rem, 4vw, 3rem);
  background:
    radial-gradient(circle at 12% 15%, rgba(80, 151, 255, 0.14), transparent 18rem),
    radial-gradient(circle at 90% 8%, rgba(124, 108, 242, 0.13), transparent 21rem),
    linear-gradient(150deg, rgba(255,255,255,0.98), rgba(246,248,255,0.92));
  text-align: center;
  box-shadow:
    0 12px 0 -6px rgba(225, 230, 249, 0.9),
    0 24px 0 -13px rgba(211, 218, 244, 0.62),
    0 30px 70px rgba(64, 76, 146, 0.13);
  transform-origin: 45% 100%;
  will-change: transform, opacity;
  animation: ${({ $leaving }) => $leaving ? deckSwipeAway : deckSlide} ${({ $leaving }) => $leaving ? "380ms" : "480ms"} ${({ $leaving }) => $leaving ? "cubic-bezier(0.55, 0.05, 0.67, 0.19)" : "cubic-bezier(0.22, 1, 0.36, 1)"} both;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    background-image: radial-gradient(rgba(100, 91, 224, 0.09) 1px, transparent 1px);
    background-size: 22px 22px;
    mask-image: linear-gradient(115deg, transparent 35%, #000 100%);
    pointer-events: none;
  }

  &::after {
    content: "한";
    position: absolute;
    right: clamp(0.6rem, 4vw, 3rem);
    bottom: -2.2rem;
    z-index: -1;
    color: rgba(104, 89, 229, 0.045);
    font-family: var(--font-kr), sans-serif;
    font-size: clamp(8rem, 18vw, 15rem);
    font-weight: 950;
    line-height: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    animation-duration: 1ms;
  }
`;

const LearningModePill = styled.div<{ $kind: LearningStep["kind"] }>`
  --pill-accent: ${({ $kind }) => $kind === "preview" ? "#4d70eb" : $kind === "quiz" ? "#6858e8" : "#3688e5"};
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid color-mix(in srgb, var(--pill-accent) 28%, transparent);
  border-bottom-width: 3px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--pill-accent) 9%, #fff);
  padding: 0.58rem 0.9rem;
  color: var(--pill-accent);
  font-size: 0.8rem;
  font-weight: 950;
  letter-spacing: 0.015em;

  span {
    width: 1.35rem;
    height: 1.35rem;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--pill-accent);
    color: #fff;
    font-size: 0.68rem;
  }
`;

const LearningCardDecor = styled.div`
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;

  i {
    position: absolute;
    display: grid;
    place-items: center;
    border: 1px solid rgba(115, 104, 225, 0.12);
    background: rgba(255,255,255,0.54);
    color: rgba(91, 78, 207, 0.25);
    font-style: normal;
    font-weight: 950;
    box-shadow: 0 12px 28px rgba(66, 76, 124, 0.06);
  }

  i:nth-child(1) {
    left: 5%;
    top: 16%;
    width: 3.4rem;
    height: 3.4rem;
    border-radius: 1.15rem;
    font-family: var(--font-kr), sans-serif;
    font-size: 1.4rem;
    transform: rotate(-8deg);
  }

  i:nth-child(2) {
    right: 7%;
    top: 20%;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    color: rgba(238, 167, 54, 0.42);
    transform: rotate(9deg);
  }

  i:nth-child(3) {
    left: 8%;
    bottom: 12%;
    width: 2.35rem;
    height: 2.35rem;
    border-radius: 0.8rem;
    color: rgba(43, 172, 129, 0.38);
    transform: rotate(7deg);
  }

  @media (max-width: 700px) { opacity: 0.34; }
`;



const PlacementCategory = styled.div`
  margin-top: 1.15rem;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid rgba(91, 114, 255, 0.22);
  background: linear-gradient(180deg, rgba(236, 242, 255, 0.95), rgba(224, 234, 255, 0.92));
  padding: 0.68rem 1.05rem;
  font-size: 0.96rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: var(--accent-dark);
  box-shadow: 0 16px 32px rgba(87, 101, 186, 0.14);
`;

const PromptText = styled.p`
  margin: 1.15rem auto 0;
  max-width: 44rem;
  color: var(--ink-soft);
  font-size: clamp(0.98rem, 1.3vw, 1.08rem);
  line-height: 1.65;
`;

const TypeAnswerInput = styled.input`
  width: min(100%, 34rem);
  display: block;
  margin: 1.2rem auto 0;
  border: 1px solid var(--line);
  border-radius: 1.3rem;
  background: rgba(255, 255, 255, 0.92);
  color: var(--ink);
  padding: 1.1rem 1.2rem;
  font-size: 1.18rem;
  font-weight: 800;
  text-align: center;
  outline: none;

  &:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 0.22rem rgba(91, 114, 255, 0.13);
  }
`;

const KoreanKeyboardToggle = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  margin: 0.75rem auto 0;
  border: 1px solid rgba(125, 143, 221, 0.42);
  border-bottom-width: 3px;
  border-radius: 999px;
  background: rgba(248,250,255,0.9);
  padding: 0.62rem 0.9rem 0.52rem;
  color: #5365bb;
  font-size: 0.78rem;
  font-weight: 900;
  cursor: pointer;
  transition: transform 140ms ease, background 140ms ease, border-color 140ms ease;

  span { font-size: 1rem; }
  &:hover { transform: translateY(-1px); border-color: rgba(91,114,255,.62); background: #fff; }
  &:active { transform: translateY(1px); border-bottom-width: 1px; }

  @media (max-width: 767px) { display: none; }
`;

const TypeFeedback = styled.p<{ $correct: boolean }>`
  margin: 1rem auto 0;
  width: min(100%, 34rem);
  border-radius: 1rem;
  background: ${({ $correct }) =>
    $correct ? "#ecfff7" : "#fff2f5"};
  border: 1px solid ${({ $correct }) => ($correct ? "#8be4ca" : "#ffc0cc")};
  color: ${({ $correct }) => ($correct ? "#209777" : "#df6680")};
  padding: 0.85rem 1rem;
  font-weight: 800;
`;

const Word = styled.div`
  margin-top: 1.7rem;
  color: #182348;
  font-size: clamp(3.5rem, 8vw, 6.2rem);
  font-weight: 950;
  line-height: 1.05;
  letter-spacing: -0.04em;
  text-shadow: 0 8px 28px rgba(46, 55, 103, 0.08);
`;

const WordHint = styled.p`
  margin-top: 0.8rem;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--ink-soft);
`;

const OptionGrid = styled.div`
  width: min(100%, 58rem);
  margin: 1.65rem auto 0;
  display: grid;
  gap: 0.9rem;
  @media (min-width: 760px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
`;

const QuizOption = styled.button<{ $state: "idle" | "correct" | "wrong" }>`
  min-height: 5rem;
  border-radius: 1.3rem;
  border: 1px solid ${({ $state }) => $state === "correct" ? "#79dfc2" : $state === "wrong" ? "#ffb3c2" : "var(--line)"};
  border-bottom-width: 4px;
  background: ${({ $state }) => $state === "correct" ? "linear-gradient(145deg, #f3fff9, #e8fcf4)" : $state === "wrong" ? "linear-gradient(145deg, #fff7f9, #ffedf2)" : "rgba(255,255,255,0.88)"};
  padding: 1.15rem 1.25rem;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.9rem;
  align-items: center;
  text-align: left;
  cursor: pointer;
  box-shadow: ${({ $state }) => $state === "correct"
    ? "0 9px 0 -4px rgba(92, 211, 176, 0.34), 0 13px 28px rgba(76, 194, 159, 0.12)"
    : $state === "wrong"
      ? "0 9px 0 -4px rgba(255, 147, 168, 0.28), 0 13px 28px rgba(235, 111, 137, 0.1)"
      : "0 9px 24px rgba(67, 78, 127, 0.06)"};
  transition: transform 160ms ease, border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;

  &:hover:enabled {
    transform: translateY(-3px);
    border-color: rgba(91, 114, 255, 0.46);
    background: #fff;
    box-shadow: 0 14px 30px rgba(67, 78, 127, 0.1);
  }

  &:active:enabled {
    transform: translateY(1px);
    border-bottom-width: 2px;
  }
`;

const OptionLetter = styled.span<{ $state: "idle" | "correct" | "wrong" }>`
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 999px;
  display: inline-grid;
  place-items: center;
  background: ${({ $state }) => $state === "correct" ? "#5ed0ae" : $state === "wrong" ? "#ff91a8" : "rgba(91, 114, 255, 0.12)"};
  color: ${({ $state }) => $state === "idle" ? "var(--accent-dark)" : "#fff"};
  box-shadow: ${({ $state }) => $state === "idle" ? "none" : "0 6px 14px rgba(64, 79, 125, 0.12)"};
  font-size: 0.96rem;
  font-weight: 900;
`;

const OptionValue = styled.span`
  font-size: clamp(1.05rem, 1.5vw, 1.22rem);
  font-weight: 850;
  line-height: 1.5;
`;


const AnswerText = styled.p`
  margin-top: 0.8rem;
  color: #1c2850;
  font-size: clamp(2.15rem, 4.5vw, 3.35rem);
  font-weight: 950;
`;



const ErrorCard = styled(InfoCard)`
  color: #a6364a;
  border-color: rgba(217, 90, 111, 0.32);
  background: rgba(255, 238, 241, 0.92);
`;
