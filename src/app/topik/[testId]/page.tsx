"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { renderTopikRichText } from "@/lib/topik-rich-text";
import type {
  TopikAttemptFeedbackStatus,
  TopikAttemptResult,
  TopikSectionType,
  TopikTestDetail,
} from "@/types/topik";

type TestResponse = {
  test?: TopikTestDetail;
  error?: string;
};

type AttemptResponse = {
  attemptId?: string;
  result?: TopikAttemptResult;
  error?: string;
};

type PageProps = {
  params: Promise<{ testId: string }> | { testId: string };
};

function levelLabel(level: TopikTestDetail["level"]) {
  return level === "TOPIK_I" ? "TOPIK I" : "TOPIK II";
}

function sectionTypeLabel(type: TopikSectionType) {
  return type === "LISTENING" ? "Аудирование" : "Чтение";
}

function sectionTypeShortLabel(type: TopikSectionType) {
  return type === "LISTENING" ? "АУ" : "ЧТ";
}

function sectionTypeDescription(type: TopikSectionType) {
  return type === "LISTENING"
    ? "Понимание речи на слух, короткие диалоги и быстрый выбор ответа."
    : "Понимание текста, грамматический контекст и скорость чтения.";
}

function formatTime(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function blockVariantClass(variant: TopikTestDetail["sections"][number]["blocks"][number]["variant"]) {
  switch (variant) {
    case "EXAMPLE":
      return "border-indigo-200 bg-indigo-50";
    case "NOTICE":
      return "border-amber-200 bg-amber-50";
    default:
      return "border-slate-200 bg-slate-50";
  }
}

function blockVariantLabel(
  variant: TopikTestDetail["sections"][number]["blocks"][number]["variant"],
) {
  switch (variant) {
    case "EXAMPLE":
      return "Пример";
    case "NOTICE":
      return "Объявление";
    default:
      return "Текст";
  }
}

function sectionTypeCardClass(type: TopikSectionType) {
  return type === "LISTENING"
    ? "border-cyan-200 bg-white hover:border-cyan-400 hover:bg-cyan-50/30"
    : "border-indigo-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/30";
}

function visibleBlockVariantLabel(
  variant: TopikTestDetail["sections"][number]["blocks"][number]["variant"],
) {
  void blockVariantLabel(variant);

  switch (variant) {
    case "EXAMPLE":
      return "Пример";
    case "NOTICE":
      return "Объявление";
    default:
      return null;
  }
}

function reviewChoiceClass(isCorrect: boolean, isSelected: boolean) {
  if (isCorrect && isSelected) {
    return "border-emerald-300 bg-emerald-50";
  }

  if (isCorrect) {
    return "border-emerald-200 bg-emerald-50/70";
  }

  if (isSelected) {
    return "border-red-300 bg-red-50";
  }

  return "border-[var(--line)] bg-white";
}

function reviewChoiceLabel(isCorrect: boolean, isSelected: boolean) {
  if (isCorrect && isSelected) {
    return "Ваш правильный ответ";
  }

  if (isCorrect) {
    return "Правильный ответ";
  }

  if (isSelected) {
    return "Ваш ответ";
  }

  return "";
}

function feedbackStatusLabel(status: TopikAttemptFeedbackStatus) {
  switch (status) {
    case "HIGH":
      return "Сильная зона";
    case "MEDIUM":
      return "Нужно закрепить";
    default:
      return "Зона роста";
  }
}

function feedbackStatusBadgeClass(status: TopikAttemptFeedbackStatus) {
  switch (status) {
    case "HIGH":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "MEDIUM":
      return "border-sky-200 bg-sky-50 text-sky-700";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function feedbackCardClass(status: TopikAttemptFeedbackStatus) {
  switch (status) {
    case "HIGH":
      return "border-emerald-200 bg-emerald-50/50";
    case "MEDIUM":
      return "border-sky-200 bg-sky-50/50";
    default:
      return "border-amber-200 bg-amber-50/50";
  }
}

const sectionModeOptions: TopikSectionType[] = ["LISTENING", "READING"];

function TopikTestPageContent({ params }: PageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  const [testId, setTestId] = useState("");
  const [test, setTest] = useState<TopikTestDetail | null>(null);
  const [selectedSectionType, setSelectedSectionType] = useState<TopikSectionType | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<TopikAttemptResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [timerStarted, setTimerStarted] = useState(false);
  const [isFeedbackSkillsOpen, setIsFeedbackSkillsOpen] = useState(false);
  const timeoutHandledRef = useRef(false);

  const requestedSectionType = useMemo(() => {
    const section = searchParams.get("section");
    return section === "LISTENING" || section === "READING" ? section : null;
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const resolved = await Promise.resolve(params);
      if (!active) {
        return;
      }

      setTestId(resolved.testId);

      try {
        const response = await fetch(`/api/topik/tests/${resolved.testId}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as TestResponse;
        if (!active) {
          return;
        }

        if (!response.ok || !data.test) {
          setError(data.error ?? "Не удалось загрузить тест.");
          setTest(null);
          return;
        }

        setTest(data.test);
      } catch {
        if (!active) {
          return;
        }
        setError("Не удалось загрузить тест.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [params]);

  const allSections = useMemo(() => test?.sections ?? [], [test]);

  const availableSectionTypes = useMemo(() => {
    const types: TopikSectionType[] = [];
    for (const section of allSections) {
      if (!types.includes(section.type)) {
        types.push(section.type);
      }
    }
    return types;
  }, [allSections]);

  useEffect(() => {
    if (!test) {
      return;
    }

    setSectionIndex(0);
    setAnswers({});
    setResult(null);
    setError("");
    setSelectedSectionType(null);
  }, [test]);

  const sections = useMemo(() => {
    if (!selectedSectionType) {
      return [];
    }

    return allSections.filter((section) => section.type === selectedSectionType);
  }, [allSections, selectedSectionType]);

  const currentSection = sections[sectionIndex] ?? null;
  const isLastSection = sectionIndex >= sections.length - 1;
  const listeningAudioUrl = test?.listeningAudioUrl ?? null;

  const questionIds = useMemo(() => {
    return sections.flatMap((section) => section.questions.map((question) => question.id));
  }, [sections]);

  const totalQuestions = questionIds.length;

  const answeredQuestions = useMemo(() => {
    return questionIds.reduce((sum, questionId) => (answers[questionId] ? sum + 1 : sum), 0);
  }, [answers, questionIds]);

  const currentAnsweredQuestions = useMemo(() => {
    if (!currentSection) {
      return 0;
    }

    return currentSection.questions.reduce((sum, question) => {
      return answers[question.id] ? sum + 1 : sum;
    }, 0);
  }, [answers, currentSection]);

  const selectedDurationMinutes = useMemo(() => {
    return sections.reduce((sum, section) => sum + section.durationMinutes, 0);
  }, [sections]);

  const activateSection = useCallback((type: TopikSectionType) => {
    setSelectedSectionType(type);
    setSectionIndex(0);
    setAnswers({});
    setResult(null);
    setError("");
    setTimerStarted(false);
    timeoutHandledRef.current = false;
  }, []);

  useEffect(() => {
    if (!requestedSectionType || !testId || authLoading || !user || selectedSectionType) {
      return;
    }

    if (!availableSectionTypes.includes(requestedSectionType)) {
      return;
    }

    activateSection(requestedSectionType);
    router.replace(`/topik/${testId}`);
  }, [
    activateSection,
    authLoading,
    availableSectionTypes,
    requestedSectionType,
    router,
    selectedSectionType,
    testId,
    user,
  ]);

  useEffect(() => {
    if (!currentSection || result || !selectedSectionType) {
      setTimerStarted(false);
      return;
    }

    timeoutHandledRef.current = false;
    setTimerStarted(false);
    setRemainingSeconds(currentSection.durationMinutes * 60);
  }, [currentSection, result, selectedSectionType]);

  useEffect(() => {
    if (remainingSeconds > 0) {
      setTimerStarted(true);
    }
  }, [remainingSeconds]);

  useEffect(() => {
    if (
      !currentSection ||
      !selectedSectionType ||
      !timerStarted ||
      loading ||
      submitting ||
      result
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [currentSection, loading, result, selectedSectionType, submitting, timerStarted]);

  const submitAttempt = useCallback(
    async (reason: "manual" | "timeout") => {
      if (!testId || !selectedSectionType || submitting) {
        return;
      }

      setSubmitting(true);
      setError("");
      if (reason === "manual") {
        setResult(null);
      }

      try {
        const response = await fetch("/api/topik/attempts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            testId,
            sectionType: selectedSectionType,
            answers: Object.entries(answers).map(([questionId, choiceId]) => ({
              questionId,
              choiceId,
            })),
          }),
        });
        const data = (await response.json()) as AttemptResponse;

        if (response.status === 401) {
          router.push(
            `/auth/login?next=${encodeURIComponent(`/topik/${testId}?section=${selectedSectionType}`)}`,
          );
          return;
        }

        if (!response.ok || !data.result) {
          setError(data.error ?? "Не удалось отправить ответы.");
          return;
        }

        setResult(data.result);
      } catch {
        setError(
          reason === "timeout"
            ? "Время вышло, но отправка не удалась. Попробуйте еще раз."
            : "Сервер недоступен. Попробуйте еще раз.",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [answers, router, selectedSectionType, submitting, testId],
  );

  useEffect(() => {
    if (
      !currentSection ||
      !timerStarted ||
      loading ||
      submitting ||
      result ||
      remainingSeconds > 0
    ) {
      return;
    }

    if (timeoutHandledRef.current) {
      return;
    }

    timeoutHandledRef.current = true;

    if (isLastSection) {
      void submitAttempt("timeout");
      return;
    }

    setSectionIndex((prev) => prev + 1);
  }, [
    currentSection,
    isLastSection,
    loading,
    remainingSeconds,
    result,
    submitAttempt,
    submitting,
    timerStarted,
  ]);

  useEffect(() => {
    if (!result) {
      setIsFeedbackSkillsOpen(false);
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [result]);

  const startSection = useCallback(
    (type: TopikSectionType) => {
      if (!availableSectionTypes.includes(type) || authLoading) {
        return;
      }

      if (!user) {
        router.push(`/auth/login?next=${encodeURIComponent(`/topik/${testId}?section=${type}`)}`);
        return;
      }

      activateSection(type);
    },
    [activateSection, authLoading, availableSectionTypes, router, testId, user],
  );

  const resetSectionSelection = useCallback(() => {
    setSelectedSectionType(null);
    setSectionIndex(0);
    setAnswers({});
    setResult(null);
    setError("");
    setTimerStarted(false);
    timeoutHandledRef.current = false;
  }, []);

  const moveToNextSection = useCallback(() => {
    if (isLastSection) {
      return;
    }
    setSectionIndex((prev) => prev + 1);
  }, [isLastSection]);

  const timerVariantClass =
    remainingSeconds <= 60
      ? "border-red-300 bg-red-50 text-red-700"
      : remainingSeconds <= 300
        ? "border-amber-300 bg-amber-50 text-amber-700"
        : "border-[var(--line)] bg-white text-[var(--accent-dark)]";

  const resultQuestionCount = useMemo(() => {
    if (!result) {
      return 0;
    }

    return result.sections.reduce((sum, section) => sum + section.questions.length, 0);
  }, [result]);

  const resultCorrectCount = useMemo(() => {
    if (!result) {
      return 0;
    }

    return result.sections.reduce((sum, section) => {
      return sum + section.questions.filter((question) => question.isCorrect).length;
    }, 0);
  }, [result]);

  const activeResultScore = useMemo(() => {
    if (!result || !selectedSectionType) {
      return 0;
    }

    return selectedSectionType === "LISTENING" ? result.listeningScore : result.readingScore;
  }, [result, selectedSectionType]);

  const activeResultMaxScore = useMemo(() => {
    if (!result || !selectedSectionType) {
      return 0;
    }

    return selectedSectionType === "LISTENING" ? result.maxListeningScore : result.maxReadingScore;
  }, [result, selectedSectionType]);

  const activeResultLabel = selectedSectionType ? sectionTypeLabel(selectedSectionType) : "";

  if (loading) {
    return (
      <section className="py-10 md:py-14">
        <div className="site-shell">
          <div className="glass-card rounded-2xl px-5 py-5 text-sm text-[var(--ink-soft)]">
            Загрузка теста...
          </div>
        </div>
      </section>
    );
  }

  if (!test) {
    return (
      <section className="py-10 md:py-14">
        <div className="site-shell">
          <div className="glass-card rounded-2xl px-5 py-5 text-sm text-red-600">
            {error || "Тест не найден."}
          </div>
        </div>
      </section>
    );
  }

  if (!selectedSectionType) {
    return (
      <section className="py-10 md:py-14">
        <div className="site-shell space-y-5">
          <div className="glass-card rounded-3xl px-6 py-7 md:px-8">
            <p className="text-sm font-semibold text-[var(--accent-dark)]">{levelLabel(test.level)}</p>
            <h1 className="mt-2 text-3xl font-bold">{test.title}</h1>
            {test.description ? (
              <p className="mt-2 text-sm text-[var(--ink-soft)]">{test.description}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-[var(--ink-soft)]">
              <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1">
                Общая длительность: {test.durationMinutes} мин
              </span>
              <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1">
                Вопросов: {allSections.reduce((sum, section) => sum + section.questions.length, 0)}
              </span>
            </div>
          </div>

          <article className="glass-card rounded-3xl px-6 py-6 md:px-7">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-dark)]">
              Выбор режима
            </p>
            <h2 className="mt-2 text-2xl font-black md:text-3xl">Выберите раздел для старта</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {sectionModeOptions.map((type) => {
                const typedSections = allSections.filter((section) => section.type === type);
                const hasMode = typedSections.length > 0;
                const questionCount = typedSections.reduce(
                  (sum, section) => sum + section.questions.length,
                  0,
                );
                const durationMinutes = typedSections.reduce(
                  (sum, section) => sum + section.durationMinutes,
                  0,
                );

                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => startSection(type)}
                    disabled={!hasMode || authLoading}
                    className={`rounded-2xl border p-5 text-left transition-colors duration-200 ${
                      hasMode
                        ? sectionTypeCardClass(type)
                        : "cursor-not-allowed border-[var(--line)] bg-slate-50 opacity-70"
                    } ${authLoading ? "cursor-wait" : ""}`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-dark)]">
                      Раздел TOPIK
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] px-2 text-xs font-black text-[var(--accent-dark)]">
                        {sectionTypeShortLabel(type)}
                      </span>
                      <h3 className="text-2xl font-black">{sectionTypeLabel(type)}</h3>
                    </div>
                    <p className="mt-3 text-sm text-slate-700">
                      {hasMode
                        ? sectionTypeDescription(type)
                        : "Раздел недоступен в этом тесте."}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-700">
                      <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1">
                        {questionCount} вопросов
                      </span>
                      <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1">
                        {durationMinutes} мин
                      </span>
                    </div>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-dark)]">
                      {!hasMode
                        ? "Нет заданий"
                        : authLoading
                          ? "Проверяем доступ..."
                          : user
                            ? "Начать раздел"
                            : "Войти и начать"}
                      <span aria-hidden>{hasMode ? ">" : "-"}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </article>
        </div>
      </section>
    );
  }

  if (!currentSection) {
    return (
      <section className="py-10 md:py-14">
        <div className="site-shell">
          <div className="glass-card rounded-2xl px-5 py-5 text-sm text-red-600">
            Для выбранного режима не найдено секций.
          </div>
          <button
            type="button"
            onClick={resetSectionSelection}
            className="secondary-btn mt-4 px-5 py-2 text-sm font-semibold"
          >
            Назад к выбору раздела
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="py-10 md:py-14">
      <div className="site-shell grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-2 space-y-5 xl:order-1">
          <div className="glass-card rounded-3xl px-6 py-7 md:px-8">
            <p className="text-sm font-semibold text-[var(--accent-dark)]">{levelLabel(test.level)}</p>
            <h1 className="mt-2 text-3xl font-bold">{test.title}</h1>
            {test.description ? (
              <p className="mt-2 text-sm text-[var(--ink-soft)]">{test.description}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-[var(--ink-soft)]">
              <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1">
                Режим: {sectionTypeLabel(selectedSectionType)}
              </span>
              <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1">
                Длительность: {selectedDurationMinutes} мин
              </span>
              <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1">
                Вопросов: {totalQuestions}
              </span>
              <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1">
                Отвечено: {answeredQuestions}
              </span>
            </div>
          </div>

          {selectedSectionType === "LISTENING" ? (
            listeningAudioUrl ? (
              <article className="rounded-2xl border border-[var(--line)] bg-white/95 px-4 py-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--accent-dark)]">
                    Аудио аудирования
                  </p>
                  <p className="text-xs text-[var(--ink-soft)]">Для всего раздела</p>
                </div>
                <TopikAudioPlayer src={listeningAudioUrl} />
              </article>
            ) : (
              <article className="rounded-2xl border border-amber-200 bg-white px-5 py-4 text-center">
                <p className="text-sm font-semibold text-amber-700">
                  Аудио для раздела пока не загружено администратором.
                </p>
              </article>
            )
          ) : null}

          {result ? (
            <div className="space-y-5">
              <article className="glass-card overflow-hidden rounded-3xl">
                <div className="px-6 py-7 md:px-8">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-3xl">
                      <p className="text-base font-semibold uppercase tracking-[0.24em] text-[var(--accent-dark)] md:text-lg">
                        Разбор {levelLabel(test.level)}
                      </p>
                      <h2 className="mt-3 text-4xl font-black leading-tight md:text-5xl">
                        {result.feedback.headline}
                      </h2>
                      <p className="mt-4 text-base leading-8 text-[var(--ink-soft)] md:text-xl">
                        {result.feedback.summary}
                      </p>
                    </div>
                    <span className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--accent-dark)] shadow-sm">
                      {activeResultLabel}
                    </span>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <div className="rounded-3xl border border-[var(--line)] bg-white px-5 py-5 shadow-sm">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                        Балл раздела
                      </p>
                      <p className="mt-3 text-5xl font-black leading-none">
                        {activeResultScore}
                        <span className="ml-2 text-2xl font-semibold text-[var(--ink-soft)]">
                          / {activeResultMaxScore}
                        </span>
                      </p>
                    </div>
                    <div className="rounded-3xl border border-[var(--line)] bg-white px-5 py-5 shadow-sm">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                        Точность
                      </p>
                      <p className="mt-3 text-5xl font-black leading-none">
                        {formatPercent(
                          resultQuestionCount > 0 ? resultCorrectCount / resultQuestionCount : 0,
                        )}
                      </p>
                      <p className="mt-2 text-base text-[var(--ink-soft)]">
                        {resultCorrectCount} из {resultQuestionCount} вопросов
                      </p>
                    </div>
                    <div className="rounded-3xl border border-[var(--line)] bg-white px-5 py-5 shadow-sm">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                        Общий итог
                      </p>
                      <p className="mt-3 text-5xl font-black leading-none">
                        {result.totalScore}
                        <span className="ml-2 text-2xl font-semibold text-[var(--ink-soft)]">
                          / {result.maxTotalScore}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-[var(--line)] px-6 py-7 md:px-8">
                  <div className="grid gap-5 xl:grid-cols-2">
                    <section className="rounded-3xl border border-amber-200 bg-amber-50/40 px-5 py-5">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
                        Зоны роста
                      </p>
                      <div className="mt-4 space-y-3">
                        {result.feedback.focusAreas.length ? (
                          result.feedback.focusAreas.map((item) => (
                            <article
                              key={`${item.rangeLabel}-${item.skillArea}`}
                              className="rounded-2xl border border-amber-200 bg-white/90 px-4 py-4"
                            >
                              <div className="flex items-center gap-2">
                                <div className="flex shrink-0 items-center justify-center">
                                  <Image
                                    src="/assets/25.svg"
                                    alt="Слабая зона"
                                    width={48}
                                    height={48}
                                    className="h-12 w-12 object-contain md:h-14 md:w-14"
                                  />
                                </div>
                                <h3 className="min-w-0 flex-1 text-xl font-black leading-tight md:text-2xl">
                                  {item.skillArea}
                                </h3>
                              </div>
                              <p className="mt-3 text-base leading-8 text-slate-700 md:text-lg">{item.detail}</p>
                            </article>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-amber-200 bg-white/90 px-4 py-4 text-base leading-8 text-slate-700 md:text-lg">
                            Явно слабых зон не видно. Дальше стоит удерживать стабильность и
                            точность на длинных сериях вопросов.
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="rounded-3xl border border-emerald-200 bg-emerald-50/40 px-5 py-5">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        Сильные стороны
                      </p>
                      <div className="mt-4 space-y-3">
                        {result.feedback.strengths.length ? (
                          result.feedback.strengths.map((item) => (
                            <article
                              key={`${item.rangeLabel}-${item.skillArea}`}
                              className="rounded-2xl border border-emerald-200 bg-white/90 px-4 py-4"
                            >
                              <div className="flex items-center gap-2">
                                <div className="flex shrink-0 items-center justify-center">
                                  <Image
                                    src="/assets/24.svg"
                                    alt="Сильная зона"
                                    width={48}
                                    height={48}
                                    className="h-12 w-12 object-contain md:h-14 md:w-14"
                                  />
                                </div>
                                <h3 className="min-w-0 flex-1 text-xl font-black leading-tight md:text-2xl">
                                  {item.skillArea}
                                </h3>
                              </div>
                              <p className="mt-3 text-base leading-8 text-slate-700 md:text-lg">{item.detail}</p>
                            </article>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-emerald-200 bg-white/90 px-4 py-4 text-base leading-8 text-slate-700 md:text-lg">
                            Сильные зоны пока не доминируют. Сначала подними несколько базовых
                            навыков до устойчивого уровня.
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              </article>

              {result.feedback.skills.length ? (
                <article className="glass-card rounded-3xl px-6 py-6 md:px-8">
                  <button
                    type="button"
                    onClick={() => setIsFeedbackSkillsOpen((prev) => !prev)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl text-left"
                  >
                    <div>
                      <h2 className="text-3xl font-black">Навыки по диапазонам вопросов</h2>
                      <p className="mt-2 text-base leading-8 text-[var(--ink-soft)] md:text-lg">
                        Детальный разбор по каждому блоку вопросов внутри выбранного раздела.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-sm text-[var(--ink-soft)]">
                        {result.feedback.skills.length} блоков
                      </span>
                      <span className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--accent-dark)] shadow-sm">
                        {isFeedbackSkillsOpen ? "Скрыть" : "Открыть"}
                      </span>
                    </div>
                  </button>

                  {isFeedbackSkillsOpen && (
                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      {result.feedback.skills.map((skill) => (
                        <article
                          key={skill.id}
                          className={`rounded-3xl border px-5 py-5 ${feedbackCardClass(skill.status)}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-sm font-semibold text-[var(--ink-soft)]">
                                  {skill.rangeLabel}
                                </span>
                                <span
                                  className={`rounded-full border px-3 py-1 text-sm font-semibold ${feedbackStatusBadgeClass(skill.status)}`}
                                >
                                  {feedbackStatusLabel(skill.status)}
                                </span>
                              </div>
                              <h3 className="mt-3 text-2xl font-black md:text-3xl">{skill.skillArea}</h3>
                            </div>
                            <div className="rounded-2xl bg-white/90 px-4 py-3 text-right shadow-sm">
                              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                                Точность
                              </p>
                              <p className="mt-1 text-3xl font-black">{formatPercent(skill.accuracyRate)}</p>
                              <p className="text-sm text-[var(--ink-soft)]">
                                {skill.correctCount} / {skill.totalQuestions}
                              </p>
                            </div>
                          </div>

                          <p className="mt-5 text-base leading-8 text-slate-800 md:text-lg">
                            {skill.feedbackRu}
                          </p>

                          <div className="mt-5 rounded-3xl border border-[var(--accent)]/20 bg-[linear-gradient(135deg,rgba(99,102,241,0.12),rgba(255,255,255,0.96))] px-5 py-5 shadow-sm">
                            <p className="text-sm font-black uppercase tracking-[0.22em] text-[var(--accent-dark)]">
                              Совет
                            </p>
                            <p className="mt-3 text-base leading-8 text-slate-800 md:text-lg">
                              {skill.tipRu}
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </article>
              ) : null}

              <article className="glass-card rounded-2xl px-6 py-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black">Разбор ответов</h2>
                    <p className="mt-1 text-sm text-[var(--ink-soft)]">
                      Здесь показаны ваши ответы и правильные варианты по всем вопросам выбранного
                      режима.
                    </p>
                  </div>
                  <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-sm text-[var(--ink-soft)]">
                    Вопросов: {resultQuestionCount}
                  </span>
                </div>

                <div className="mt-5 space-y-5">
                  {result.sections.map((section) => (
                    <section key={section.id} className="space-y-4">
                      <div className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-dark)]">
                          {sectionTypeLabel(section.type)}
                        </p>
                        <h3 className="mt-2 text-xl font-black">
                          {section.order}. {section.title}
                        </h3>
                        <p className="mt-1 text-sm text-[var(--ink-soft)]">
                          {section.questions.length} вопросов • {section.durationMinutes} мин
                        </p>
                      </div>

                      {section.questions.map((question) => (
                        <div key={question.id} className="space-y-4">
                          {section.blocks
                            .filter((block) => block.displayBeforeQuestionOrder === question.order)
                            .map((block) => (
                              <div
                                key={block.id}
                                className={`rounded-2xl border px-5 py-5 ${blockVariantClass(block.variant)}`}
                              >
                                {visibleBlockVariantLabel(block.variant) ? (
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-dark)]">
                                    {visibleBlockVariantLabel(block.variant)}
                                  </p>
                                ) : null}
                                {block.title ? (
                                  <h3 className="mt-2 text-2xl font-black">{block.title}</h3>
                                ) : null}
                                <div
                                  className="mt-3 text-base leading-relaxed text-slate-800 md:text-lg md:leading-8"
                                  dangerouslySetInnerHTML={{
                                    __html: renderTopikRichText(block.content),
                                  }}
                                />
                              </div>
                            ))}

                          <div className="rounded-2xl border border-[var(--line)] bg-white/90 px-4 py-4 md:px-5 md:py-5">
                            <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3 md:grid-cols-[3rem_minmax(0,1fr)_auto] md:items-start">
                              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-2xl font-black text-[var(--accent-dark)]">
                                {question.order}
                              </span>
                              <p className="min-w-0 self-center text-lg font-black leading-tight md:self-start md:text-2xl">
                                {question.prompt}
                              </p>
                              <span className="col-span-2 justify-self-start rounded-2xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 md:col-span-1 md:justify-self-end">
                                {question.points} балл(ов)
                              </span>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  question.isCorrect
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {question.isCorrect ? "Верно" : "Ошибка"}
                              </span>
                              {!question.selectedChoiceId ? (
                                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                                  Ответ не выбран
                                </span>
                              ) : null}
                            </div>

                            {question.contentImageUrl ? (
                              <div className="mt-4 flex min-h-[18rem] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                <img
                                  src={question.contentImageUrl}
                                  alt={`Иллюстрация к вопросу ${question.order}`}
                                  className="max-h-[28rem] w-full rounded-xl object-contain"
                                />
                              </div>
                            ) : null}

                            {question.content ? (
                              <div className="mt-4 whitespace-pre-line rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5 text-base leading-relaxed text-slate-800 md:text-lg md:leading-8">
                                {question.content}
                              </div>
                            ) : null}

                            <div className="mt-4 space-y-3">
                              {question.choices.map((choice) => {
                                const choiceLabel = reviewChoiceLabel(
                                  choice.isCorrect,
                                  choice.isSelected,
                                );

                                return (
                                  <div
                                    key={choice.id}
                                    className={`rounded-2xl border px-4 py-4 ${reviewChoiceClass(
                                      choice.isCorrect,
                                      choice.isSelected,
                                    )}`}
                                  >
                                    <div className="flex items-start gap-4">
                                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-300 text-xl font-black text-slate-700">
                                        {choice.order}
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        {choice.imageUrl ? (
                                          <div className="flex min-h-44 items-center justify-center rounded-xl border border-slate-200 bg-white p-3">
                                            <img
                                              src={choice.imageUrl}
                                              alt={`Вариант ответа ${choice.order}`}
                                              className="max-h-44 w-full rounded-lg object-contain"
                                            />
                                          </div>
                                        ) : (
                                          <p className="text-base text-slate-900">{choice.text}</p>
                                        )}
                                        {choiceLabel ? (
                                          <p className="mt-1 text-xs font-semibold text-[var(--accent-dark)]">
                                            {choiceLabel}
                                          </p>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </section>
                  ))}
                </div>
              </article>
            </div>
          ) : (
            <article className="glass-card rounded-2xl px-6 py-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--accent-dark)]">
                    Секция {sectionIndex + 1} из {sections.length}
                  </p>
                  <h2 className="mt-1 text-2xl font-black">
                    {currentSection.order}. {currentSection.title}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">
                    {currentSection.questions.length} вопросов • рекомендуемое время{" "}
                    {currentSection.durationMinutes} мин
                  </p>
                </div>
                <div className={`rounded-2xl border px-5 py-4 text-center ${timerVariantClass}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                    Осталось времени
                  </p>
                  <p className="mt-1 text-4xl font-black tabular-nums">
                    {formatTime(remainingSeconds)}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {currentSection.questions.map((question) => (
                  <div key={question.id} className="space-y-4">
                    {currentSection.blocks
                      .filter((block) => block.displayBeforeQuestionOrder === question.order)
                      .map((block) => (
                        <div
                          key={block.id}
                          className={`rounded-2xl border px-5 py-5 ${blockVariantClass(block.variant)}`}
                        >
                          {visibleBlockVariantLabel(block.variant) ? (
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-dark)]">
                              {visibleBlockVariantLabel(block.variant)}
                            </p>
                          ) : null}
                          {block.title ? <h3 className="mt-2 text-2xl font-black">{block.title}</h3> : null}
                          <div
                            className="mt-3 text-base leading-relaxed text-slate-800 md:text-lg md:leading-8"
                            dangerouslySetInnerHTML={{
                              __html: renderTopikRichText(block.content),
                            }}
                          />
                        </div>
                      ))}

                    <div className="rounded-2xl border border-[var(--line)] bg-white/90 px-4 py-4 md:px-5 md:py-5">
                      <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3 md:grid-cols-[3rem_minmax(0,1fr)_auto] md:items-start">
                        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-2xl font-black text-[var(--accent-dark)]">
                          {question.order}
                        </span>
                        <p className="min-w-0 self-center text-lg font-black leading-tight md:self-start md:text-2xl">
                          {question.prompt}
                        </p>
                        <span className="col-span-2 justify-self-start rounded-2xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 md:col-span-1 md:justify-self-end">
                          {question.points} балл(ов)
                        </span>
                      </div>

                      {question.contentImageUrl ? (
                        <div className="mt-4 flex min-h-[18rem] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <img
                            src={question.contentImageUrl}
                            alt={`Иллюстрация к вопросу ${question.order}`}
                            className="max-h-[28rem] w-full rounded-xl object-contain"
                          />
                        </div>
                      ) : null}

                      {question.content ? (
                        <div className="mt-4 whitespace-pre-line rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5 text-base leading-relaxed text-slate-800 md:text-lg md:leading-8">
                          {question.content}
                        </div>
                      ) : null}

                      <div className="mt-4 space-y-3">
                        {question.choices.map((choice) => (
                          <label
                            key={choice.id}
                            className={`flex cursor-pointer items-center gap-4 rounded-2xl border px-4 py-4 text-base transition-colors ${
                              answers[question.id] === choice.id
                                ? "border-[var(--accent)] bg-[var(--accent-soft)]/40"
                                : "border-[var(--line)] bg-white"
                            }`}
                          >
                            <input
                              type="radio"
                              name={question.id}
                              value={choice.id}
                              checked={answers[question.id] === choice.id}
                              onChange={() =>
                                setAnswers((prev) => ({ ...prev, [question.id]: choice.id }))
                              }
                            />
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 text-xl font-black text-slate-700">
                              {choice.order}
                            </span>
                            <div className="min-w-0 flex-1">
                              {choice.imageUrl ? (
                                <div className="flex min-h-40 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
                                  <img
                                    src={choice.imageUrl}
                                    alt={`Вариант ответа ${choice.order}`}
                                    className="max-h-40 w-full rounded-lg object-contain"
                                  />
                                </div>
                              ) : (
                                <span className="text-lg">{choice.text}</span>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {error ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3">
                {!isLastSection ? (
                  <button
                    type="button"
                    onClick={moveToNextSection}
                    className="primary-btn px-6 py-3 text-sm font-semibold"
                  >
                    Завершить секцию и продолжить
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void submitAttempt("manual")}
                    disabled={submitting}
                    className="primary-btn px-6 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Отправка..." : "Завершить и получить результат"}
                  </button>
                )}
              </div>
            </article>
          )}
        </div>

        <aside className="order-1 top-24 z-20 self-start xl:sticky xl:order-2">
          <div className="glass-card rounded-3xl px-5 py-5">
            <p className="text-sm font-semibold text-[var(--accent-dark)]">Панель экзамена</p>

            {result ? (
              <div className="mt-4 rounded-2xl border border-[var(--accent-dark)] bg-white px-5 py-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-dark)]">
                  Результат готов
                </p>
                <p className="mt-2 text-4xl font-black text-[var(--accent-dark)]">
                  {activeResultScore} / {activeResultMaxScore}
                </p>
                <p className="mt-2 text-sm text-[var(--ink-soft)]">
                  {activeResultLabel}: {resultCorrectCount} правильных ответов из {resultQuestionCount}
                </p>
              </div>
            ) : (
              <div className={`mt-4 rounded-2xl border px-5 py-4 text-center ${timerVariantClass}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em]">Таймер секции</p>
                <p className="mt-2 text-5xl font-black tabular-nums">{formatTime(remainingSeconds)}</p>
                <p className="mt-2 text-sm text-[var(--ink-soft)]">
                  После окончания времени секция завершится автоматически.
                </p>
              </div>
            )}

            <div className="mt-5 rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-4">
              <p className="text-sm font-semibold">Прогресс секции</p>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">
                Отвечено: {currentAnsweredQuestions} / {currentSection.questions.length}
              </p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                Общий прогресс: {answeredQuestions} / {totalQuestions}
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-dark)]">
                Текущий раздел
              </p>
              <p className="mt-2 text-base font-semibold">{sectionTypeLabel(selectedSectionType)}</p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">{currentSection.title}</p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                {currentSection.questions.length} вопросов • {currentSection.durationMinutes} мин
              </p>
            </div>

            {!result ? (
              <button
                type="button"
                onClick={resetSectionSelection}
                className="secondary-btn mt-5 w-full px-4 py-2 text-sm font-semibold"
              >
                Сменить режим раздела
              </button>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}

function TopikAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      await audio.play();
      setIsPlaying(true);
      return;
    }

    audio.pause();
    setIsPlaying(false);
  };

  const seekTo = (value: string) => {
    const audio = audioRef.current;
    if (!audio || duration <= 0) {
      return;
    }

    const nextTime = (Number(value) / 100) * duration;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  return (
    <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-[1.6rem] border border-[rgba(181,196,255,0.9)] bg-[radial-gradient(circle_at_top_right,rgba(95,211,202,0.20),transparent_14rem),radial-gradient(circle_at_bottom_left,rgba(106,77,255,0.12),transparent_13rem),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(242,246,255,0.97))] px-4 py-4 shadow-[0_18px_44px_rgba(46,59,146,0.12)] max-sm:grid-cols-1">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />
      <button
        type="button"
        onClick={() => void togglePlayback()}
        aria-label={isPlaying ? "Pause audio" : "Play audio"}
        className="inline-flex h-14 w-14 items-center justify-center rounded-full border-0 bg-[linear-gradient(135deg,#5a6cff,#6a4dff)] text-base font-black leading-none text-white shadow-[0_14px_30px_rgba(90,108,255,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(90,108,255,0.36)]"
      >
        {isPlaying ? "II" : "\u25B6"}
      </button>
      <div className="grid min-w-0 gap-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <span className="text-xs font-extrabold tabular-nums text-[var(--ink-soft)]">
            {formatTopikAudioClock(currentTime)}
          </span>
          <input
            aria-label="Audio progress"
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={progress}
            onChange={(event) => seekTo(event.target.value)}
            className="h-2.5 w-full cursor-pointer appearance-none rounded-full [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[#5a6cff] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[#5a6cff]"
            style={{
              background: `linear-gradient(90deg, #5fd3ca 0%, #5a6cff ${progress}%, rgba(90, 108, 255, 0.16) ${progress}%, rgba(90, 108, 255, 0.16) 100%)`,
            }}
          />
          <span className="text-xs font-extrabold tabular-nums text-[var(--ink-soft)]">
            {formatTopikAudioClock(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatTopikAudioClock(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function TopikTestPage(props: PageProps) {
  return (
    <Suspense
      fallback={
        <section className="py-10 md:py-14">
          <div className="site-shell">
            <div className="glass-card rounded-2xl px-5 py-5 text-sm text-[var(--ink-soft)]">
              Загрузка теста...
            </div>
          </div>
        </section>
      }
    >
      <TopikTestPageContent {...props} />
    </Suspense>
  );
}
