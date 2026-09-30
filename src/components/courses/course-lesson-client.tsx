"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import styled, { css, keyframes } from "styled-components";
import { InlineLessonChoiceExercise } from "@/components/courses/inline-lesson-choice-exercise";
import { InteractiveCountryMap } from "@/components/courses/interactive-country-map";
import {
  actionBase,
  PrimaryButton,
  PrimaryLink,
  SecondaryButton,
  SecondaryLink,
} from "@/components/courses/lesson-action-controls";
import { LessonImageLightbox } from "@/components/courses/lesson-image-lightbox";
import { LessonCompletionScreen } from "@/components/courses/lesson-completion-screen";
import { parsePracticeContent } from "@/components/courses/practice-content";
import { PracticeStepContent } from "@/components/courses/practice-step-content";
import { parseQuizContent } from "@/components/courses/quiz-content";
import { QuizStepContent } from "@/components/courses/quiz-step-content";
import {
  parseCustomUiContent,
  SandboxedLessonUi,
} from "@/components/courses/sandboxed-lesson-ui";
import { VocabularyStepContent } from "@/components/courses/vocabulary-step-content";
import {
  LESSON_CHOICE_EXERCISE_END,
  LESSON_CHOICE_EXERCISE_START,
  parseLessonChoiceExercise,
  type LessonChoiceExercise,
} from "@/lib/lesson-choice-exercise";
import {
  getCourseLessonHref,
  getLessonCompletionHref,
} from "@/lib/course-lesson-routes";
import type {
  CourseLessonResponse,
  CourseLessonStepView,
  CourseNodeState,
  CourseProgressResponse,
} from "@/types/courses";
import {
  COURSE_LESSON_KIND_LABELS,
  COURSE_LESSON_MODE_LABELS,
  COURSE_NODE_STATE_LABELS,
  COURSE_STEP_LABELS,
} from "@/types/courses";

type QuizSessionsState = Record<string, { answers: Record<number, number> }>;
type PracticeSessionsState = Record<string, { completed: boolean }>;

export function CourseLessonClient({
  levelSlug,
  lessonSlug,
  unitSlug,
  retry = false,
}: {
  levelSlug: string;
  lessonSlug: string;
  unitSlug?: string;
  retry?: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<CourseLessonResponse | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reviewMode, setReviewMode] = useState(retry);
  const [mobileProgressExpanded, setMobileProgressExpanded] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ src: string; alt: string } | null>(null);
  const [quizSessions, setQuizSessions] = useState<QuizSessionsState>({});
  const [vocabularySessions, setVocabularySessions] = useState<Record<string, { completed: boolean }>>({});
  const [practiceSessions, setPracticeSessions] = useState<PracticeSessionsState>({});
  const [completionLesson, setCompletionLesson] = useState<CourseLessonResponse["lesson"] | null>(null);
  const stepCardRef = useRef<HTMLElement | null>(null);
  const previousActiveStepIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!imagePreview) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setImagePreview(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [imagePreview]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const unitQuery = unitSlug ? `?unit=${encodeURIComponent(unitSlug)}` : "";
        const response = await fetch(`/api/courses/${levelSlug}/lessons/${lessonSlug}${unitQuery}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as CourseLessonResponse & { error?: string };

        if (!active) {
          return;
        }

        if (!response.ok) {
          setError(payload.error ?? "Не удалось загрузить урок.");
          return;
        }

        setData(
          retry
            ? {
                ...payload,
                lesson: enterLessonReviewMode(payload.lesson, 1),
              }
            : payload,
        );
        setCompletionLesson(null);
        setReviewMode(retry);
      } catch {
        if (active) {
          setError("Не удалось загрузить урок.");
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [levelSlug, lessonSlug, retry, unitSlug]);

  const activeStep = useMemo(() => {
    if (!data) {
      return null;
    }

    return (
      data.lesson.steps.find((step) => step.state === "current") ??
      data.lesson.steps.find((step) => step.state === "available") ??
      data.lesson.steps[data.lesson.steps.length - 1] ??
      null
    );
  }, [data]);
  const activeStepId = activeStep?.id ?? null;

  const activeStepContent = useMemo(
    () => (activeStep ? getStepContentBody(activeStep.content) : ""),
    [activeStep],
  );

  const activeStepImagePlacement = useMemo(
    () => (activeStep ? getStepImagePlacement(activeStep.content) : "top"),
    [activeStep],
  );

  const activeCustomUi = useMemo(
    () => (activeStep ? parseCustomUiContent(activeStepContent) : null),
    [activeStep, activeStepContent],
  );

  const activeQuiz = useMemo(() => {
    if (!activeStep || activeStep.type !== "QUIZ") {
      return null;
    }

    return parseQuizContent(activeStepContent);
  }, [activeStep, activeStepContent]);

  const activePractice = useMemo(() => {
    if (!activeStep) {
      return null;
    }

    return parsePracticeContent(activeStepContent);
  }, [activeStep, activeStepContent]);

  useEffect(() => {
    previousActiveStepIdRef.current = null;
  }, [levelSlug, lessonSlug, retry]);

  useLayoutEffect(() => {
    if (!activeStepId) {
      return;
    }

    const previousActiveStepId = previousActiveStepIdRef.current;
    previousActiveStepIdRef.current = activeStepId;

    if (!previousActiveStepId || previousActiveStepId === activeStepId) {
      return;
    }

    let secondFrameId = 0;
    const firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => {
        const target = stepCardRef.current;

        if (!target) {
          return;
        }

        const isMobile = window.matchMedia("(max-width: 767px)").matches;
        const viewportOffset = isMobile ? 76 : 104;
        const targetTop = target.getBoundingClientRect().top + window.scrollY - viewportOffset;
        window.scrollTo({ top: Math.max(targetTop, 0), behavior: "smooth" });
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrameId);
      window.cancelAnimationFrame(secondFrameId);
    };
  }, [activeStepId]);

  useLayoutEffect(() => {
    if (!completionLesson) {
      return;
    }

    let secondFrameId = 0;
    const firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => {
        const target = stepCardRef.current;
        if (!target) {
          return;
        }

        const isMobile = window.matchMedia("(max-width: 767px)").matches;
        const viewportOffset = isMobile ? 76 : 104;
        const targetTop = target.getBoundingClientRect().top + window.scrollY - viewportOffset;
        const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth";
        window.scrollTo({ top: Math.max(targetTop, 0), behavior });
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrameId);
      window.cancelAnimationFrame(secondFrameId);
    };
  }, [completionLesson]);

  if (error) {
    return (
      <Section>
        <LessonGlyphBackground />
        <Shell>
          <ErrorCard>{error}</ErrorCard>
        </Shell>
      </Section>
    );
  }

  if (!data || !activeStep) {
    return (
      <Section>
        <LessonGlyphBackground />
        <Shell>
          <LoadingLayout>
            <LoadingMain />
            <LoadingAside />
          </LoadingLayout>
        </Shell>
      </Section>
    );
  }

  const activeIndex = data.lesson.steps.findIndex((step) => step.id === activeStep.id);
  const previousStep = activeIndex > 0 ? data.lesson.steps[activeIndex - 1] : null;
  const nextStep =
    activeIndex < data.lesson.steps.length - 1 ? data.lesson.steps[activeIndex + 1] : null;
  const isFinalStep = !nextStep;
  const lessonCompleted = data.lesson.state === "completed";
  const lessonXp = getLessonClientXp(data.lesson.steps, data.lesson.kind);
  const earnedLessonXp = getEarnedLessonClientXp(data.lesson.steps, data.lesson.kind, lessonCompleted);
  const activeStepXp = getStepClientXp(activeStep.type);
  const lessonActivityItems = getLessonActivityItems(data.lesson.steps);
  const lessonDifficulty = getLessonDifficultyLabel(data.level.number);

  const openStep = async (stepOrder: number) => {
    const targetStep = data.lesson.steps.find((step) => step.order === stepOrder);
    if (!targetStep || targetStep.state === "locked" || saving) {
      return;
    }

    setCompletionLesson(null);

    if (reviewMode || !data.viewer.canPersistProgress) {
      setData((current) =>
        current
          ? {
              ...current,
              lesson: reviewMode
                ? enterLessonReviewMode(current.lesson, stepOrder)
                : updateLessonLocally(current.lesson, "open", stepOrder),
            }
          : current,
      );
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/courses/lessons/${data.lesson.id}/progress`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "open",
          stepOrder,
        }),
      });
      const payload = (await response.json()) as CourseProgressResponse & { error?: string };

      if (!response.ok || !payload.lesson) {
        throw new Error(payload.error ?? "Не удалось открыть шаг.");
      }

      setData((current) => (current ? { ...current, lesson: payload.lesson } : current));
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Не удалось открыть шаг.");
    } finally {
      setSaving(false);
    }
  };

  const completeStep = async ({ forceReady = false } = {}) => {
    if (saving || activeStep.state === "locked" || (!forceReady && !quizReady)) {
      return;
    }

    if (!data.viewer.canPersistProgress) {
      const nextLesson = updateLessonLocally(data.lesson, "complete", activeStep.order);
      setData((current) => (current ? { ...current, lesson: nextLesson } : current));

      if (isFinalStep) {
        setCompletionLesson(nextLesson);
      }

      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/courses/lessons/${data.lesson.id}/progress`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "complete",
          stepOrder: activeStep.order,
        }),
      });
      const payload = (await response.json()) as CourseProgressResponse & { error?: string };

      if (!response.ok || !payload.lesson) {
        throw new Error(payload.error ?? "Не удалось завершить шаг.");
      }

      setData((current) => (current ? { ...current, lesson: payload.lesson } : current));

      if (isFinalStep) {
        setCompletionLesson(payload.lesson);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось завершить шаг.");
    } finally {
      setSaving(false);
    }
  };

  const restartLesson = async (source = data) => {
    if (!source || saving) {
      return;
    }

    if (!source.viewer.canPersistProgress) {
      setQuizSessions({});
      setCompletionLesson(null);
      setData((current) =>
        current ? { ...current, lesson: resetLessonLocally(current.lesson) } : current,
      );
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/courses/lessons/${source.lesson.id}/progress`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "restart",
        }),
      });
      const payload = (await response.json()) as CourseProgressResponse & { error?: string };

      if (!response.ok || !payload.lesson) {
        throw new Error(payload.error ?? "Не удалось начать урок заново.");
      }

      setData((current) => (current ? { ...current, lesson: payload.lesson } : current));
      setQuizSessions({});
      setVocabularySessions({});
      setPracticeSessions({});
      setCompletionLesson(null);
    } catch (restartError) {
      setError(
        restartError instanceof Error ? restartError.message : "Не удалось начать урок заново.",
      );
    } finally {
      setSaving(false);
    }
  };

  const quizSession = activeStep ? quizSessions[activeStep.id] : undefined;
  const activeVocabularyWords =
    activeStep?.type === "VOCABULARY" ? data.lesson.vocabularyWords : [];
  const activeVocabularyDistractorWords =
    activeStep?.type === "VOCABULARY" ? data.lesson.vocabularyDistractorWords ?? [] : [];
  const activeVocabularySession = activeStep ? vocabularySessions[activeStep.id] : undefined;
  const activePracticeSession = activeStep ? practiceSessions[activeStep.id] : undefined;
  const vocabularyReady =
    activeStep?.type !== "VOCABULARY" ||
    activeVocabularyWords.length === 0 ||
    Boolean(activeVocabularySession?.completed) ||
    activeStep.isCompleted;
  const practiceReady =
    !activePractice ||
    activePractice.exercises.length === 0 ||
    Boolean(activePracticeSession?.completed) ||
    activeStep.isCompleted;
  const quizReady =
    vocabularyReady &&
    practiceReady &&
    (!activeQuiz ||
      Object.keys(quizSession?.answers ?? {}).length >= activeQuiz.questions.length);
  const lessonVocabularyWordsCount = data.lesson.vocabularyWords.length;
  const hasVocabularyStep = data.lesson.steps.some((step) => step.type === "VOCABULARY");
  const lessonVocabularyCompleted =
    data.lesson.state === "completed" ||
    data.lesson.steps.some(
      (step) =>
        step.type === "VOCABULARY" &&
        (step.isCompleted || Boolean(vocabularySessions[step.id]?.completed)),
    );
  const learnedLessonVocabularyWordsCount = lessonVocabularyCompleted
    ? lessonVocabularyWordsCount
    : 0;
  const lessonVocabularyProgressPercent =
    lessonVocabularyWordsCount > 0
      ? Math.round((learnedLessonVocabularyWordsCount / lessonVocabularyWordsCount) * 100)
      : 0;
  const lessonQuizAccuracy = getLessonQuizAccuracy(data.lesson, quizSessions);
  const hideStepFooter = Boolean(activePractice);
  const focusMode = Boolean(completionLesson);
  const focusTitle = completionLesson
    ? "Урок завершён"
    : activeStep.type === "VOCABULARY"
      ? "Словарь"
      : activePractice
        ? "Упражнения"
        : stepHeroTag(activeStep.type, data.lesson.kind);
  const focusStepTitle = completionLesson ? data.lesson.title : activeStep.title;
  const focusProgressLabel = completionLesson
    ? "100%"
    : `${activeStep.order} / ${data.lesson.totalSteps}`;

  return (
    <Section>
      <LessonGlyphBackground />
      {imagePreview && typeof document !== "undefined"
        ? createPortal(
            <LessonImageLightbox
              key={imagePreview.src}
              src={imagePreview.src}
              alt={imagePreview.alt}
              onClose={() => setImagePreview(null)}
            />,
            document.body,
          )
        : null}
      <Shell>
        <LessonLayout $focusMode={focusMode}>
          <IntroCard $focusMode={focusMode} $mobileProgressExpanded={mobileProgressExpanded}>
            <IntroAccent style={{ backgroundColor: data.level.accentColor }} />
            <LessonEyebrow>
              Уровень {data.level.number} • {data.unit.title}
            </LessonEyebrow>
            <LessonTitle>{data.lesson.title}</LessonTitle>
            <LessonSummary>{data.lesson.summary}</LessonSummary>

            <ProgressPanel>
              <ProgressHeader>
                <ProgressTitle>Прогресс урока</ProgressTitle>
                <ProgressHeaderActions>
                  <ProgressValue>{data.lesson.progressPercent}%</ProgressValue>
                  <ProgressToggleButton
                    type="button"
                    aria-expanded={mobileProgressExpanded}
                    aria-label={
                      mobileProgressExpanded
                        ? "Свернуть список шагов"
                        : "Показать все шаги урока"
                    }
                    onClick={() => setMobileProgressExpanded((expanded) => !expanded)}
                    $expanded={mobileProgressExpanded}
                  >
                    <span aria-hidden="true" />
                  </ProgressToggleButton>
                </ProgressHeaderActions>
              </ProgressHeader>
              <ProgressBarTrack>
                <ProgressBarFill style={{ width: `${data.lesson.progressPercent}%` }} />
              </ProgressBarTrack>
              <StepTabsGrid $mobileExpanded={mobileProgressExpanded}>
                {data.lesson.steps.map((step) => (
                  <StepTabButton
                    key={step.id}
                    type="button"
                    disabled={step.state === "locked" || saving}
                    onClick={() => void openStep(step.order)}
                    $active={step.id === activeStep.id}
                    $state={step.state}
                    $mobileHidden={!mobileProgressExpanded && step.id !== activeStep.id}
                  >
                    <StepTabOrder>Шаг {step.order}</StepTabOrder>
                    <StepTabTitle>{step.title}</StepTabTitle>
                    <StepTabState>{COURSE_NODE_STATE_LABELS[step.state]}</StepTabState>
                  </StepTabButton>
                ))}
              </StepTabsGrid>
            </ProgressPanel>
          </IntroCard>

          <Sidebar $focusMode={focusMode}>
            <SidebarCard>
              <SidebarHeader>
                <SidebarEyebrow>Урок</SidebarEyebrow>
                <SidebarBackLink href={`/courses/${data.level.slug}`}>
                  ← Назад к уровню
                </SidebarBackLink>
              </SidebarHeader>
              <LessonInfoGrid>
                <LessonInfoItem>
                  <LessonInfoIcon aria-hidden>⏱</LessonInfoIcon>
                  <LessonInfoCopy>
                    <LessonInfoValue>{data.lesson.estimatedMinutes} мин</LessonInfoValue>
                    <LessonInfoLabel>Время</LessonInfoLabel>
                  </LessonInfoCopy>
                </LessonInfoItem>
                <LessonInfoItem>
                  <LessonInfoIcon aria-hidden>📖</LessonInfoIcon>
                  <LessonInfoCopy>
                    <LessonInfoValue>{data.lesson.totalSteps} секций</LessonInfoValue>
                    <LessonInfoLabel>{lessonFormatLabel(data.lesson)}</LessonInfoLabel>
                  </LessonInfoCopy>
                </LessonInfoItem>
                <LessonInfoItem>
                  <LessonInfoIcon aria-hidden>⭐</LessonInfoIcon>
                  <LessonInfoCopy>
                    <LessonInfoValue>{lessonDifficulty}</LessonInfoValue>
                    <LessonInfoLabel>Сложность</LessonInfoLabel>
                  </LessonInfoCopy>
                </LessonInfoItem>
                <LessonInfoItem>
                  <LessonInfoIcon aria-hidden>🔥</LessonInfoIcon>
                  <LessonInfoCopy>
                    <LessonInfoValue>{earnedLessonXp}/{lessonXp} XP</LessonInfoValue>
                    <LessonInfoLabel>Награда урока</LessonInfoLabel>
                  </LessonInfoCopy>
                </LessonInfoItem>
              </LessonInfoGrid>

              <LessonActivityList>
                {lessonActivityItems.map((item) => (
                  <LessonActivityItem key={item.label}>
                    <span aria-hidden>{item.icon}</span>
                    {item.label}
                  </LessonActivityItem>
                ))}
              </LessonActivityList>

              {hasVocabularyStep && lessonVocabularyWordsCount > 0 ? (
                <LessonVocabularyCard>
                  <LessonVocabularyTop>
                    <LessonVocabularyIcon aria-hidden>🧠</LessonVocabularyIcon>
                    <div>
                      <LessonVocabularyTitle>Словарь урока</LessonVocabularyTitle>
                      <LessonVocabularyText>
                        {learnedLessonVocabularyWordsCount}/{lessonVocabularyWordsCount} слов закреплено
                      </LessonVocabularyText>
                    </div>
                  </LessonVocabularyTop>
                  <LessonVocabularyTrack>
                    <LessonVocabularyFill
                      style={{
                        width: `${lessonVocabularyProgressPercent}%`,
                      }}
                    />
                  </LessonVocabularyTrack>
                </LessonVocabularyCard>
              ) : null}

              <LessonSaveNote>
                {data.viewer.canPersistProgress
                  ? "Прогресс и XP сохраняются в аккаунте."
                  : "Войдите, чтобы сохранять прогресс и XP."}
              </LessonSaveNote>
            </SidebarCard>
          </Sidebar>

	          <StepCard
              ref={stepCardRef}
              data-lesson-step-card
              $focusMode={focusMode}
              $flatPracticeOnMobile={Boolean(activePractice)}
            >
              {focusMode ? (
                <FocusHeader>
                  <FocusBackButton
                    type="button"
                    onClick={() =>
                      completionLesson
                        ? router.push(
                            getLessonCompletionHref(
                              completionLesson,
                              data.level.slug,
                              data.unit.slug,
                            ),
                          )
                        : previousStep
                        ? void openStep(previousStep.order)
                        : router.push(`/courses/${data.level.slug}`)
                    }
                    disabled={saving}
                  >
                    ← {completionLesson ? "Маршрут" : "Урок"}
                  </FocusBackButton>
                  <FocusHeaderTitle>
                    <span>{focusTitle}</span>
                    <strong>{focusStepTitle}</strong>
                  </FocusHeaderTitle>
                  <FocusHeaderProgress>{focusProgressLabel}</FocusHeaderProgress>
                </FocusHeader>
              ) : (
                <StepHero style={{ background: stepBackground(activeStep.type, data.level.accentColor) }}>
                  <StepHeroTag>{stepHeroTag(activeStep.type, data.lesson.kind)}</StepHeroTag>
                  <StepHeroTitle>{activeStep.title}</StepHeroTitle>
                </StepHero>
              )}
	
	            <StepBody $focusMode={focusMode} $flatPracticeOnMobile={Boolean(activePractice)}>
                {completionLesson ? (
                  <LessonCompletionScreen
                    lesson={completionLesson}
                    levelSlug={data.level.slug}
                    unitSlug={data.unit.slug}
                    lessonXp={lessonXp}
                    vocabularyWordsCount={lessonVocabularyWordsCount}
                    showVocabularyResult={hasVocabularyStep && lessonVocabularyWordsCount > 0}
                    quizAccuracy={lessonQuizAccuracy}
                  />
                ) : (
                  <>
	              {activeStep.imageUrl && activeStepImagePlacement === "top" ? (
	                <StepImageFrame>
                    <LessonImageButton
                      type="button"
                      onClick={() =>
                        setImagePreview({ src: activeStep.imageUrl!, alt: activeStep.title })
                      }
                      aria-label={`Увеличить изображение: ${activeStep.title}`}
                    >
	                     <StepImage src={activeStep.imageUrl} alt={activeStep.title} />
                      <ImageZoomBadge>
                        <MagnifyingGlassIcon />
                      </ImageZoomBadge>
                    </LessonImageButton>
	                </StepImageFrame>
	              ) : null}

              {activeCustomUi ? (
                <SandboxedLessonUi
                  key={activeStep.id}
                  title={activeStep.title}
                  html={activeCustomUi.html}
                  frameId={activeStep.id}
                />
              ) : activeVocabularyWords.length > 0 && activeStep.type === "VOCABULARY" ? (
                <VocabularyStepContent
                  key={activeStep.id}
                  words={activeVocabularyWords}
                  distractorWords={activeVocabularyDistractorWords}
                  focusMode={focusMode}
                  completed={Boolean(activeVocabularySession?.completed) || activeStep.isCompleted}
                  onComplete={() =>
                    setVocabularySessions((current) => ({
                      ...current,
                      [activeStep.id]: { completed: true },
                    }))
                  }
                />
              ) : activeQuiz ? (
                <QuizStepContent
                  key={activeStep.id}
                  stepId={activeStep.id}
                  quiz={activeQuiz}
                  session={quizSession}
                  onSelect={(questionIndex, optionIndex) =>
                    setQuizSessions((current) => ({
                      ...current,
                      [activeStep.id]: {
                        answers: {
                          ...(current[activeStep.id]?.answers ?? {}),
                          [questionIndex]: optionIndex,
                        },
                      },
                    }))
                  }
                  onRetry={() =>
                    setQuizSessions((current) => ({
                      ...current,
                      [activeStep.id]: {
                        answers: {},
                      },
                    }))
	                  }
	                />
	              ) : activePractice ? (
                <PracticeStepContent
                  key={activeStep.id}
                  practice={activePractice}
                  stepTitle={activeStep.title}
                  onComplete={() => {
                    setPracticeSessions((current) => ({
                      ...current,
                      [activeStep.id]: { completed: true },
                    }));
                    if (activeStep.isCompleted) {
                      if (nextStep && nextStep.state !== "locked") {
                        return openStep(nextStep.order);
                      }
                      return;
                    }
                    return completeStep({ forceReady: true });
                  }}
                />
	              ) : (
	                <StepContent
                    step={activeStep}
                    content={activeStepContent}
                    onImageOpen={(src, alt) => setImagePreview({ src, alt })}
                  />
	              )}

	              {activeStep.imageUrl && activeStepImagePlacement === "bottom" ? (
	                <StepImageFrame>
                    <LessonImageButton
                      type="button"
                      onClick={() =>
                        setImagePreview({ src: activeStep.imageUrl!, alt: activeStep.title })
                      }
                      aria-label={`Увеличить изображение: ${activeStep.title}`}
                    >
	                     <StepImage src={activeStep.imageUrl} alt={activeStep.title} />
                      <ImageZoomBadge>
                        <MagnifyingGlassIcon />
                      </ImageZoomBadge>
                    </LessonImageButton>
	                </StepImageFrame>
	              ) : null}

              {activeStep.isCompleted && activeStep.type !== "PRACTICE" ? (
                <StepRewardCard>
                  <StepRewardIcon aria-hidden>✅</StepRewardIcon>
                  <StepRewardCopy>
                    <StepRewardTitle>{activeStep.title} завершен</StepRewardTitle>
                    <StepRewardText>+{activeStepXp} XP за этот шаг</StepRewardText>
                  </StepRewardCopy>
                </StepRewardCard>
              ) : null}
	
              {!hideStepFooter ? (
	              <StepFooter $focusMode={focusMode}>
                <FooterActions>
                  {reviewMode ? (
                    <SecondaryLink href={`/courses/${data.level.slug}`}>Назад к маршруту</SecondaryLink>
                  ) : null}
                  {previousStep ? (
                    <SecondaryButton type="button" onClick={() => void openStep(previousStep.order)}>
                      Предыдущий шаг
                    </SecondaryButton>
                  ) : null}
                  {!reviewMode && nextStep && nextStep.state !== "locked" ? (
                    <SecondaryButton type="button" onClick={() => void openStep(nextStep.order)}>
                      Следующий шаг
                    </SecondaryButton>
                  ) : null}
                </FooterActions>

                {lessonCompleted ? (
                  <CompletedActions>
                    <SecondaryButton type="button" onClick={() => void restartLesson()}>
                      Начать заново
                    </SecondaryButton>
                    {data.lesson.nextLesson ? (
                      <PrimaryLink
                        href={getCourseLessonHref(
                          data.lesson.nextLesson.levelSlug,
                          data.lesson.nextLesson.unitSlug,
                          data.lesson.nextLesson.lessonSlug,
                        )}
                      >
                        Открыть «{data.lesson.nextLesson.title}»
                      </PrimaryLink>
                    ) : (
                      <PrimaryLink href={`/courses/${data.level.slug}`}>Назад к курсу</PrimaryLink>
                    )}
                  </CompletedActions>
                ) : reviewMode ? (
                  nextStep && nextStep.state !== "locked" ? (
                    <PrimaryButton type="button" onClick={() => void openStep(nextStep.order)}>
                      Следующий шаг
                    </PrimaryButton>
                  ) : data.lesson.nextLesson ? (
                    <PrimaryLink
                      href={getCourseLessonHref(
                        data.lesson.nextLesson.levelSlug,
                        data.lesson.nextLesson.unitSlug,
                        data.lesson.nextLesson.lessonSlug,
                      )}
                    >
                      Следующий урок →
                    </PrimaryLink>
                  ) : (
                    <PrimaryLink href={`/courses/${data.level.slug}`}>Завершить повторение</PrimaryLink>
                  )
                ) : (
                  <PrimaryButton type="button" onClick={() => void completeStep()} disabled={saving || !quizReady}>
                    {saving
                      ? "Сохраняем..."
                      : activeStep.type === "VOCABULARY" && !vocabularyReady
                        ? "Завершите словарь"
                      : activePractice && !practiceReady
                        ? "Завершите упражнения"
                      : activeQuiz && !quizReady
                        ? incompleteQuizLabel(data.lesson.kind)
                        : activeStep.isCompleted
                          ? "Завершено"
                          : isFinalStep
                            ? finalStepButtonLabel(data.lesson.kind)
                            : "Завершить шаг"}
                  </PrimaryButton>
                )}
              </StepFooter>
              ) : null}
                  </>
                )}
            </StepBody>
          </StepCard>
        </LessonLayout>
      </Shell>
    </Section>
  );
}

function LessonGlyphBackground() {
  return (
    <>
      <PageGlyphCloud $side="left" aria-hidden>
        <PageGlyph $top="4%" $left="8%" $size="7.4rem" $rotate="-12deg" $delay="0s">
          한
        </PageGlyph>
        <PageGlyph $top="19%" $left="48%" $size="5.6rem" $rotate="7deg" $delay="-4s">
          글
        </PageGlyph>
        <PageGlyph $top="38%" $left="14%" $size="4.8rem" $rotate="-4deg" $delay="-8s">
          ㄱ
        </PageGlyph>
        <PageGlyph $top="56%" $left="58%" $size="6.2rem" $rotate="11deg" $delay="-2s">
          ㅏ
        </PageGlyph>
        <PageGlyph $top="76%" $left="28%" $size="5.1rem" $rotate="-9deg" $delay="-6s">
          ㄴ
        </PageGlyph>
      </PageGlyphCloud>
      <PageGlyphCloud $side="right" aria-hidden>
        <PageGlyph $top="9%" $left="42%" $size="5.8rem" $rotate="10deg" $delay="-3s" $muted>
          ㅁ
        </PageGlyph>
        <PageGlyph $top="28%" $left="4%" $size="7rem" $rotate="-8deg" $delay="-9s" $muted>
          사
        </PageGlyph>
        <PageGlyph $top="49%" $left="54%" $size="4.7rem" $rotate="14deg" $delay="-1s" $muted>
          ㅗ
        </PageGlyph>
        <PageGlyph $top="70%" $left="18%" $size="5.5rem" $rotate="-13deg" $delay="-6s" $muted>
          라
        </PageGlyph>
      </PageGlyphCloud>
    </>
  );
}

const stepClientXp: Record<CourseLessonStepView["type"], number> = {
  GRAMMAR: 20,
  EXAMPLES: 10,
  VOCABULARY: 15,
  PRACTICE: 20,
  QUIZ: 40,
  CUSTOM: 15,
};

const lessonKindClientBonusXp: Record<CourseLessonResponse["lesson"]["kind"], number> = {
  LESSON: 10,
  MINI_QUIZ: 20,
  FINAL_TEST: 40,
};

function getStepClientXp(type: CourseLessonStepView["type"]) {
  return stepClientXp[type] ?? stepClientXp.CUSTOM;
}

function getLessonClientXp(
  steps: CourseLessonStepView[],
  kind: CourseLessonResponse["lesson"]["kind"],
) {
  return steps.reduce((sum, step) => sum + getStepClientXp(step.type), 0) + lessonKindClientBonusXp[kind];
}

function getEarnedLessonClientXp(
  steps: CourseLessonStepView[],
  kind: CourseLessonResponse["lesson"]["kind"],
  lessonCompleted: boolean,
) {
  const stepXp = steps.reduce(
    (sum, step) => sum + (step.isCompleted ? getStepClientXp(step.type) : 0),
    0,
  );

  return stepXp + (lessonCompleted ? lessonKindClientBonusXp[kind] : 0);
}

function getLessonActivityItems(steps: CourseLessonStepView[]) {
  const types = new Set(steps.map((step) => step.type));
  const items = [
    types.has("GRAMMAR") ? { icon: "📘", label: "Грамматика" } : null,
    types.has("VOCABULARY") ? { icon: "🧠", label: "Словарь" } : null,
    types.has("EXAMPLES") ? { icon: "💬", label: "Примеры" } : null,
    types.has("PRACTICE") ? { icon: "📝", label: "Практика" } : null,
    types.has("QUIZ") ? { icon: "🧩", label: "Квиз" } : null,
  ].filter(Boolean) as { icon: string; label: string }[];

  return items.length > 0 ? items : [{ icon: "📖", label: "Материал урока" }];
}

function getLessonDifficultyLabel(levelNumber: number) {
  if (levelNumber <= 1) {
    return "Beginner";
  }

  if (levelNumber === 2) {
    return "Foundation";
  }

  if (levelNumber === 3) {
    return "Intermediate";
  }

  return "Advanced";
}

type StepImagePlacement = "top" | "bottom";

const STEP_IMAGE_POSITION_TOKEN = /^\[\[step-image-position:(top|bottom)\]\]\s*/i;
const INTERACTIVE_COUNTRY_MAP_TOKEN = "[[interactive-country-map]]";

function MagnifyingGlassIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="5.75" />
      <path d="m15 15 4.25 4.25" />
    </svg>
  );
}

function getStepImagePlacement(content: string): StepImagePlacement {
  return content.match(STEP_IMAGE_POSITION_TOKEN)?.[1]?.toLowerCase() === "bottom"
    ? "bottom"
    : "top";
}

function getStepContentBody(content: string) {
  return content.replace(STEP_IMAGE_POSITION_TOKEN, "");
}

function StepContent({
  step,
  content,
  onImageOpen,
}: {
  step: CourseLessonStepView;
  content: string;
  onImageOpen: (src: string, alt: string) => void;
}) {
  const blocks = parseRichBlocks(content);

  return (
    <RichTextStack>
      {blocks.map((block, blockIndex) => {
        if (block.type === "countryMap") {
          return <InteractiveCountryMap key={`${step.id}-country-map-${blockIndex}`} />;
        }

        if (block.type === "image") {
          const imageAlt = block.alt || step.title;

          return (
            <InlineImageFigure
              key={`${step.id}-image-${blockIndex}`}
              $hiddenOnMobile={block.hiddenOnMobile}
            >
              {block.mobileSrcs.length > 0 ? (
                <>
                  <DesktopInlineImageButton
                    type="button"
                    onClick={() => onImageOpen(block.src, imageAlt)}
                    aria-label={`Увеличить изображение: ${imageAlt}`}
                  >
                    <InlineImage src={block.src} alt={imageAlt} />
                    <ImageZoomBadge><MagnifyingGlassIcon /></ImageZoomBadge>
                  </DesktopInlineImageButton>
                  <MobileInlineImageSequence>
                    {block.mobileSrcs.map((mobileSrc, mobileIndex) => {
                      const mobileAlt = block.mobileSrcs.length > 1
                        ? `${imageAlt} — часть ${mobileIndex + 1}`
                        : imageAlt;
                      return (
                        <LessonImageButton
                          key={`${mobileSrc}-${mobileIndex}`}
                          type="button"
                          onClick={() => onImageOpen(mobileSrc, mobileAlt)}
                          aria-label={`Увеличить изображение: ${mobileAlt}`}
                        >
                          <InlineImage src={mobileSrc} alt={mobileAlt} />
                          <ImageZoomBadge><MagnifyingGlassIcon /></ImageZoomBadge>
                        </LessonImageButton>
                      );
                    })}
                  </MobileInlineImageSequence>
                </>
              ) : (
                <LessonImageButton
                  type="button"
                  onClick={() => onImageOpen(block.src, imageAlt)}
                  aria-label={`Увеличить изображение: ${imageAlt}`}
                >
                  <InlineImage src={block.src} alt={imageAlt} />
                  <ImageZoomBadge><MagnifyingGlassIcon /></ImageZoomBadge>
                </LessonImageButton>
              )}
              {block.alt ? (
                <InlineImageCaption>
                  {renderInlineText(block.alt, `${step.id}-caption-${blockIndex}`)}
                </InlineImageCaption>
              ) : null}
            </InlineImageFigure>
          );
        }

        if (block.type === "audio") {
          return (
            <InlineAudioPlayer
              key={`${step.id}-audio-${blockIndex}`}
              src={block.src}
              label={block.label}
            />
          );
        }

        if (block.type === "lessonChoiceExercise") {
          return (
            <InlineLessonChoiceExercise
              key={`${step.id}-lesson-choice-${blockIndex}`}
              exercise={block.exercise}
              onImageOpen={onImageOpen}
              renderText={renderInlineText}
            />
          );
        }

        if (block.type === "dialogue") {
          return (
            <DialogueBlock key={`${step.id}-dialogue-${blockIndex}`}>
              <DialogueVisual>
                <DialogueImage src="/assets/41.svg" alt="" aria-hidden="true" />
              </DialogueVisual>
              <DialogueContent>
                <DialogueKicker>Мини-диалог</DialogueKicker>
                <DialogueMessages>
                  {block.messages.map((message, messageIndex) => (
                    <DialogueRow
                      key={`${step.id}-dialogue-${blockIndex}-${messageIndex}`}
                      $side={message.side}
                    >
                      <DialogueBubble $side={message.side}>
                        {message.speaker ? (
                          <DialogueSpeaker>{message.speaker}</DialogueSpeaker>
                        ) : null}
                        <DialogueText>
                          {renderInlineText(
                            message.text,
                            `${step.id}-dialogue-text-${blockIndex}-${messageIndex}`,
                          )}
                        </DialogueText>
                      </DialogueBubble>
                    </DialogueRow>
                  ))}
                </DialogueMessages>
              </DialogueContent>
            </DialogueBlock>
          );
        }

        if (block.type === "table") {
          return (
            <RichTableWrap key={`${step.id}-table-${blockIndex}`}>
              <RichTable>
                <thead>
                  <tr>
                    {block.headers.map((header, headerIndex) => (
                      <RichTableHeader key={`${step.id}-head-${blockIndex}-${headerIndex}`}>
                        {renderInlineText(header, `${step.id}-head-${blockIndex}-${headerIndex}`)}
                      </RichTableHeader>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={`${step.id}-row-${blockIndex}-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <RichTableCell key={`${step.id}-cell-${blockIndex}-${rowIndex}-${cellIndex}`}>
                          {renderInlineText(
                            cell,
                            `${step.id}-cell-${blockIndex}-${rowIndex}-${cellIndex}`,
                          )}
                        </RichTableCell>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </RichTable>
            </RichTableWrap>
          );
        }

        if (block.type === "list") {
          return (
            <RichList key={`${step.id}-list-${blockIndex}`}>
              {block.items.map((item, itemIndex) => (
                <RichListItem key={`${step.id}-item-${blockIndex}-${itemIndex}`}>
                  {renderInlineText(item, `${step.id}-item-${blockIndex}-${itemIndex}`)}
                </RichListItem>
              ))}
            </RichList>
          );
        }

        return (
          <RichParagraph key={`${step.id}-paragraph-${blockIndex}`}>
            {renderInlineText(block.text, `${step.id}-paragraph-${blockIndex}`)}
          </RichParagraph>
        );
      })}
    </RichTextStack>
  );
}

type RichBlock =
  | { type: "countryMap" }
  | { type: "image"; src: string; mobileSrcs: string[]; alt: string; hiddenOnMobile: boolean }
  | { type: "audio"; src: string; label: string }
  | { type: "lessonChoiceExercise"; exercise: LessonChoiceExercise }
  | { type: "dialogue"; messages: DialogueMessage[] }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };

type DialogueMessage = {
  speaker: string;
  text: string;
  side: "left" | "right";
};

function parseRichBlocks(content: string): RichBlock[] {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line, index, source) =>
      (line.length > 0 || source[index - 1]?.length > 0) && !/^[-*_]{2,}$/.test(line),
    );

  const blocks: RichBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line) {
      index += 1;
      continue;
    }

    if (line.toLowerCase() === INTERACTIVE_COUNTRY_MAP_TOKEN) {
      blocks.push({ type: "countryMap" });
      index += 1;
      continue;
    }

    if (line.toLowerCase() === LESSON_CHOICE_EXERCISE_START) {
      const serializedLines: string[] = [];
      index += 1;

      while (index < lines.length && lines[index].toLowerCase() !== LESSON_CHOICE_EXERCISE_END) {
        serializedLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length && lines[index].toLowerCase() === LESSON_CHOICE_EXERCISE_END) {
        index += 1;
      }

      const exercise = parseLessonChoiceExercise(serializedLines.join("\n"));
      if (exercise) {
        blocks.push({ type: "lessonChoiceExercise", exercise });
      }
      continue;
    }

    const image = parseMarkdownImage(line);
    if (image) {
      blocks.push({ type: "image", ...image });
      index += 1;
      continue;
    }

    const audio = parseMarkdownAudio(line);
    if (audio) {
      blocks.push({ type: "audio", ...audio });
      index += 1;
      continue;
    }

    if (isDialogueStart(line)) {
      const messages: DialogueMessage[] = [];
      index += 1;

      while (index < lines.length && !isDialogueEnd(lines[index])) {
        const message = parseDialogueMessage(lines[index], messages.length);
        if (message) {
          messages.push(message);
        }
        index += 1;
      }

      if (index < lines.length && isDialogueEnd(lines[index])) {
        index += 1;
      }

      if (messages.length > 0) {
        blocks.push({ type: "dialogue", messages });
        continue;
      }
    }

    if (isMarkdownTableHeader(lines, index)) {
      const headers = splitTableRow(line);
      const rows: string[][] = [];
      index += 2;

      while (index < lines.length && lines[index].includes("|")) {
        const cells = splitTableRow(lines[index]);
        if (cells.length > 0) {
          rows.push(cells);
        }
        index += 1;
      }

      if (headers.length > 0 && rows.length > 0) {
        blocks.push({ type: "table", headers, rows });
        continue;
      }
    }

    if (isRichListLine(line)) {
      const items: string[] = [];

      while (index < lines.length && isRichListLine(lines[index])) {
        items.push(lines[index].replace(/^[-*+]\s*/, ""));
        index += 1;
      }

      if (items.length > 0) {
        blocks.push({ type: "list", items });
        continue;
      }
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && lines[index] && !isRichListLine(lines[index])) {
      if (
        isMarkdownTableHeader(lines, index) ||
        lines[index].toLowerCase() === INTERACTIVE_COUNTRY_MAP_TOKEN ||
        lines[index].toLowerCase() === LESSON_CHOICE_EXERCISE_START ||
        parseMarkdownImage(lines[index]) ||
        parseMarkdownAudio(lines[index]) ||
        isDialogueStart(lines[index])
      ) {
        break;
      }

      paragraphLines.push(lines[index]);
      index += 1;
    }

    if (paragraphLines.length > 0) {
      blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
    }
  }

  return blocks.length > 0 ? blocks : [{ type: "paragraph", text: content.trim() }];
}

function isRichListLine(line: string) {
  return /^[-*+]\s+/.test(line);
}

function parseMarkdownImage(line: string) {
  const match = line.match(/^!\[(.*?)\]\((.+?)\)(?:\{mobile=([^}]+)\})?(?:\{(mobile-hidden)\})?$/);
  if (!match) {
    return null;
  }

  const src = match[2]?.trim();
  if (!src) {
    return null;
  }

  return {
    alt: match[1]?.trim() ?? "",
    src,
    mobileSrcs: (match[3] ?? "")
      .split("|")
      .map((url) => url.trim())
      .filter(Boolean),
    hiddenOnMobile: match[4] === "mobile-hidden",
  };
}

function parseMarkdownAudio(line: string) {
  const match = line.match(/^\[audio(?::([^\]]*))?\]\((.+?)\)$/);
  if (!match) {
    return null;
  }

  const src = match[2]?.trim();
  if (!src) {
    return null;
  }

  return {
    label: match[1]?.trim() || "Аудио к уроку",
    src,
  };
}

function isDialogueStart(line: string) {
  return line.trim().toLowerCase() === "[dialogue]";
}

function isDialogueEnd(line: string) {
  return line.trim().toLowerCase() === "[/dialogue]";
}

function parseDialogueMessage(line: string, index: number): DialogueMessage | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const separatorIndex = trimmed.indexOf(":");
  const hasSpeaker = separatorIndex > 0;
  const speaker = hasSpeaker ? trimmed.slice(0, separatorIndex).trim() : "";
  const text = hasSpeaker ? trimmed.slice(separatorIndex + 1).trim() : trimmed;

  if (!text) {
    return null;
  }

  return {
    speaker,
    text,
    side: index % 2 === 0 ? "left" : "right",
  };
}

function InlineAudioPlayer({ src, label }: { src: string; label: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const isCompact = duration > 0 && duration <= 75;

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
    <InlineAudioPanel $compact={isCompact}>
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
      <InlineAudioPlayButton type="button" onClick={() => void togglePlayback()} aria-label={isPlaying ? "Пауза" : "Воспроизвести"}>
        {isPlaying ? "II" : "▶"}
      </InlineAudioPlayButton>
      <InlineAudioBody>
        <InlineAudioMeta>
          <InlineAudioKicker>Аудио</InlineAudioKicker>
          <InlineAudioTitle>{label}</InlineAudioTitle>
        </InlineAudioMeta>
        <InlineAudioTimeline>
          <InlineAudioTime>{formatAudioTime(currentTime)}</InlineAudioTime>
          <InlineAudioRange
            aria-label="Позиция аудио"
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={progress}
            $progress={progress}
            onChange={(event) => seekTo(event.target.value)}
          />
          <InlineAudioTime>{formatAudioTime(duration)}</InlineAudioTime>
        </InlineAudioTimeline>
      </InlineAudioBody>
    </InlineAudioPanel>
  );
}

function formatAudioTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function isMarkdownTableHeader(lines: string[], index: number) {
  if (!lines[index]?.includes("|")) {
    return false;
  }

  const divider = lines[index + 1];
  return Boolean(divider && /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(divider));
}

function splitTableRow(row: string) {
  return row
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);
}

function renderInlineText(text: string, keyPrefix: string): ReactNode[] {
  const normalizedText = text.replace(/^#{1,6}\s+/, "");
  const nodes: ReactNode[] = [];
  const pattern =
    /(\*\*(.+?)\*\*|__(.+?)__|==(.+?)==|\[color=(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)\](.+?)\[\/color\]|\[size=(sm|md|lg|xl)\](.+?)\[\/size\])/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = pattern.exec(normalizedText);
  let partIndex = 0;

  while (match) {
    if (match.index > lastIndex) {
      nodes.push(stripUnrenderedMarkup(normalizedText.slice(lastIndex, match.index)));
    }

    if (match[2]) {
      nodes.push(
        <StrongText key={`${keyPrefix}-strong-${partIndex}`}>
          {renderInlineText(match[2], `${keyPrefix}-strong-${partIndex}`)}
        </StrongText>,
      );
    } else if (match[3]) {
      nodes.push(
        <UnderlinedText key={`${keyPrefix}-underline-${partIndex}`}>
          {renderInlineText(match[3], `${keyPrefix}-underline-${partIndex}`)}
        </UnderlinedText>,
      );
    } else if (match[4]) {
      nodes.push(
        <MarkedText key={`${keyPrefix}-mark-${partIndex}`}>
          {renderInlineText(match[4], `${keyPrefix}-mark-${partIndex}`)}
        </MarkedText>,
      );
    } else if (match[5] && match[6]) {
      nodes.push(
        <ColoredText key={`${keyPrefix}-color-${partIndex}`} $color={match[5]}>
          {renderInlineText(match[6], `${keyPrefix}-color-${partIndex}`)}
        </ColoredText>,
      );
    } else if (match[7] && match[8]) {
      nodes.push(
        <SizedText key={`${keyPrefix}-size-${partIndex}`} $size={match[7] as "sm" | "md" | "lg" | "xl"}>
          {renderInlineText(match[8], `${keyPrefix}-size-${partIndex}`)}
        </SizedText>,
      );
    }

    lastIndex = pattern.lastIndex;
    partIndex += 1;
    match = pattern.exec(normalizedText);
  }

  if (lastIndex < normalizedText.length) {
    nodes.push(stripUnrenderedMarkup(normalizedText.slice(lastIndex)));
  }

  return nodes;
}

function stripUnrenderedMarkup(value: string) {
  return value.replace(/(?:\*\*|__|==)/g, "");
}

function getLessonQuizAccuracy(lesson: CourseLessonResponse["lesson"], quizSessions: QuizSessionsState) {
  let answeredCount = 0;
  let correctCount = 0;

  for (const step of lesson.steps) {
    if (step.type !== "QUIZ") {
      continue;
    }

    const quiz = parseQuizContent(getStepContentBody(step.content));
    const answers = quizSessions[step.id]?.answers;

    if (!quiz || !answers) {
      continue;
    }

    quiz.questions.forEach((question, questionIndex) => {
      const answerIndex = answers[questionIndex];
      const selectedOption = typeof answerIndex === "number" ? question.options[answerIndex] : null;

      if (!selectedOption) {
        return;
      }

      answeredCount += 1;
      if (selectedOption.isCorrect) {
        correctCount += 1;
      }
    });
  }

  return answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : null;
}

function stepBackground(type: CourseLessonStepView["type"], accent: string) {
  if (type === "GRAMMAR") {
    return `linear-gradient(135deg, ${accent}, #1f3e92)`;
  }

  if (type === "QUIZ") {
    return "linear-gradient(135deg, #6a4dff, #8b5cf6 52%, #5a6cff)";
  }

  if (type === "VOCABULARY") {
    return "linear-gradient(135deg, #5263ff, #7c6dff 52%, #8b5cf6)";
  }

  if (type === "PRACTICE") {
    return "linear-gradient(135deg, #566dff, #9f6fff)";
  }

  return "linear-gradient(135deg, #3b82f6, #54c6ff)";
}

function stepTag(type: CourseLessonStepView["type"]) {
  return COURSE_STEP_LABELS[type];
}

function lessonFormatLabel(lesson: CourseLessonResponse["lesson"]) {
  if (lesson.kind === "LESSON") {
    return COURSE_LESSON_MODE_LABELS[lesson.mode];
  }

  return COURSE_LESSON_KIND_LABELS[lesson.kind];
}

function stepHeroTag(type: CourseLessonStepView["type"], lessonKind: CourseLessonResponse["lesson"]["kind"]) {
  if (lessonKind !== "LESSON") {
    return COURSE_LESSON_KIND_LABELS[lessonKind];
  }

  return stepTag(type);
}

function incompleteQuizLabel(lessonKind: CourseLessonResponse["lesson"]["kind"]) {
  if (lessonKind === "FINAL_TEST") {
    return "Сначала завершите финальный тест";
  }

  return "Сначала завершите мини-тест";
}

function finalStepButtonLabel(lessonKind: CourseLessonResponse["lesson"]["kind"]) {
  if (lessonKind === "FINAL_TEST") {
    return "Завершить тест";
  }

  if (lessonKind === "MINI_QUIZ") {
    return "Завершить мини-квиз";
  }

  return "Завершить урок";
}

function updateLessonLocally(
  lesson: CourseLessonResponse["lesson"],
  action: "open" | "complete",
  stepOrder: number,
): CourseLessonResponse["lesson"] {
  const completedOrders = lesson.steps.filter((step) => step.isCompleted).map((step) => step.order);
  const uniqueCompleted = [...new Set(completedOrders)];
  const nextCompleted =
    action === "complete" && !uniqueCompleted.includes(stepOrder)
      ? [...uniqueCompleted, stepOrder].sort((left, right) => left - right)
      : uniqueCompleted;

  let prefix = 0;
  while (nextCompleted.includes(prefix + 1)) {
    prefix += 1;
  }

  const isCompleted = prefix === lesson.steps.length;
  const nextCurrent = action === "open" ? stepOrder : isCompleted ? lesson.steps.length : prefix + 1;

  const steps = lesson.steps.map((step) => {
    let state: CourseNodeState = "locked";

    if (action === "open" && step.order === stepOrder) {
      state = "current";
    } else if (nextCompleted.includes(step.order)) {
      state = "completed";
    } else if (step.order <= prefix + 1 || isCompleted) {
      state = step.order === nextCurrent && !isCompleted ? "current" : "available";
    }

    return {
      ...step,
      isCompleted: nextCompleted.includes(step.order),
      state,
    };
  });

  const lessonState: CourseNodeState = isCompleted ? "completed" : "current";

  return {
    ...lesson,
    state: lessonState,
    progressPercent: Math.round((nextCompleted.length / lesson.steps.length) * 100),
    completedStepsCount: nextCompleted.length,
    steps,
  };
}

function resetLessonLocally(lesson: CourseLessonResponse["lesson"]): CourseLessonResponse["lesson"] {
  return {
    ...lesson,
    state: "current",
    progressPercent: 0,
    completedStepsCount: 0,
    steps: lesson.steps.map((step, index) => ({
      ...step,
      isCompleted: false,
      state: index === 0 ? "current" : "locked",
    })),
  };
}

function enterLessonReviewMode(
  lesson: CourseLessonResponse["lesson"],
  activeStepOrder: number,
): CourseLessonResponse["lesson"] {
  const safeActiveOrder = Math.max(1, Math.min(lesson.steps.length, activeStepOrder));

  return {
    ...lesson,
    state: "current",
    steps: lesson.steps.map((step) => ({
      ...step,
      state: step.order === safeActiveOrder ? "current" : "available",
    })),
  };
}

const pulse = keyframes`
  0%, 100% {
    opacity: 0.65;
  }

  50% {
    opacity: 1;
  }
`;

const glyphFloat = keyframes`
  0%,
  100% {
    transform: translate3d(0, 0, 0) rotate(var(--glyph-rotate));
  }

  50% {
    transform: translate3d(0, -1.2rem, 0) rotate(calc(var(--glyph-rotate) + 2deg));
  }
`;

const baseCard = css`
  border-radius: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.72);
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.92), rgba(245, 248, 255, 0.94));
  box-shadow: 0 24px 64px rgba(46, 59, 146, 0.12);
`;

const Section = styled.section`
  position: relative;
  overflow: hidden;
  padding: 2rem 0;

  &::before {
    content: "한 글 ㄱ ㄴ ㄷ ㅏ ㅓ ㅗ";
    position: absolute;
    top: 3.5rem;
    right: -2rem;
    z-index: 0;
    max-width: 22rem;
    color: rgba(83, 104, 168, 0.045);
    font-size: clamp(4rem, 12vw, 9rem);
    font-weight: 900;
    line-height: 0.9;
    letter-spacing: 0.04em;
    pointer-events: none;
  }

  @media (min-width: 768px) {
    padding: 3rem 0;
  }
`;

const PageGlyphCloud = styled.div<{ $side: "left" | "right" }>`
  position: absolute;
  top: ${({ $side }) => ($side === "left" ? "18rem" : "24rem")};
  bottom: 5rem;
  left: ${({ $side }) => ($side === "left" ? "0" : "auto")};
  right: ${({ $side }) => ($side === "right" ? "0" : "auto")};
  z-index: 0;
  width: ${({ $side }) => ($side === "left" ? "min(24vw, 18rem)" : "min(22vw, 16rem)")};
  min-width: 11rem;
  opacity: ${({ $side }) => ($side === "left" ? 1 : 0.82)};
  pointer-events: none;
  user-select: none;

  @media (max-width: 767px) {
    top: 30rem;
    width: 8.5rem;
    opacity: ${({ $side }) => ($side === "left" ? 0.62 : 0)};
  }
`;

const PageGlyph = styled.span<{
  $top: string;
  $left: string;
  $size: string;
  $rotate: string;
  $delay: string;
  $muted?: boolean;
}>`
  --glyph-rotate: ${({ $rotate }) => $rotate};
  position: absolute;
  top: ${({ $top }) => $top};
  left: ${({ $left }) => $left};
  color: ${({ $muted }) => ($muted ? "rgba(83, 104, 168, 0.038)" : "rgba(83, 104, 168, 0.05)")};
  font-size: ${({ $size }) => $size};
  font-weight: 950;
  line-height: 1;
  transform: rotate(var(--glyph-rotate));
  animation: ${glyphFloat} 17s ease-in-out infinite;
  animation-delay: ${({ $delay }) => $delay};

  @media (max-width: 767px) {
    font-size: min(${({ $size }) => $size}, 4.6rem);
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Shell = styled.div.attrs({ className: "site-shell" })`
  position: relative;
  z-index: 1;
`;

const ErrorCard = styled.div`
  ${baseCard};
  padding: 2.5rem 1.5rem;
  color: var(--ink-soft);
  font-size: 0.95rem;
`;

const LoadingLayout = styled.div`
  display: grid;
  gap: 1rem;

  @media (min-width: 1280px) {
    grid-template-columns: minmax(0, 1fr) 320px;
  }
`;

const LoadingBlock = styled.div`
  border-radius: 2rem;
  background: rgba(255, 255, 255, 0.7);
  animation: ${pulse} 1.6s ease-in-out infinite;
`;

const LoadingMain = styled(LoadingBlock)`
  min-height: 44rem;
`;

const LoadingAside = styled(LoadingBlock)`
  min-height: 22rem;
`;

const LessonLayout = styled.div<{ $focusMode: boolean }>`
  display: grid;
  gap: ${({ $focusMode }) => ($focusMode ? "0" : "1rem")};
  transition: gap 260ms ease;

  @media (min-width: 1280px) {
    grid-template-columns: ${({ $focusMode }) =>
      $focusMode ? "minmax(0, 1fr)" : "minmax(0, 1fr) 360px"};
    align-items: start;
  }
`;

const Sidebar = styled.aside<{ $focusMode: boolean }>`
  display: grid;
  gap: 1rem;
  align-content: start;
  overflow: ${({ $focusMode }) => ($focusMode ? "hidden" : "visible")};
  max-height: ${({ $focusMode }) => ($focusMode ? "0" : "60rem")};
  opacity: ${({ $focusMode }) => ($focusMode ? 0 : 1)};
  pointer-events: ${({ $focusMode }) => ($focusMode ? "none" : "auto")};
  transform: ${({ $focusMode }) => ($focusMode ? "translateY(-0.75rem)" : "translateY(0)")};
  transition:
    max-height 320ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 200ms ease,
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1);

  @media (min-width: 1280px) {
    grid-column: 2;
    grid-row: 1;
    display: ${({ $focusMode }) => ($focusMode ? "none" : "grid")};
  }
`;

const IntroCard = styled.article<{ $focusMode: boolean; $mobileProgressExpanded: boolean }>`
  ${baseCard};
  position: relative;
  overflow: hidden;
  max-height: ${({ $focusMode }) => ($focusMode ? "0" : "50rem")};
  opacity: ${({ $focusMode }) => ($focusMode ? 0 : 1)};
  pointer-events: ${({ $focusMode }) => ($focusMode ? "none" : "auto")};
  transform: ${({ $focusMode }) => ($focusMode ? "translateY(-1rem) scale(0.985)" : "translateY(0) scale(1)")};
  padding: ${({ $focusMode }) => ($focusMode ? "0 1.35rem" : "1.35rem 1.35rem 1.25rem")};
  transition:
    max-height 340ms cubic-bezier(0.22, 1, 0.36, 1),
    padding 300ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 200ms ease,
    transform 340ms cubic-bezier(0.22, 1, 0.36, 1);

  @media (max-width: 767px) {
    max-height: ${({ $focusMode, $mobileProgressExpanded }) =>
      $focusMode ? "0" : $mobileProgressExpanded ? "none" : "50rem"};
  }

  @media (min-width: 768px) {
    padding: ${({ $focusMode }) => ($focusMode ? "0 1.75rem" : "1.55rem 1.75rem 1.45rem")};
  }

  @media (min-width: 1280px) {
    grid-column: 1;
    grid-row: 1;
    display: ${({ $focusMode }) => ($focusMode ? "none" : "block")};
  }
`;

const IntroAccent = styled.div`
  position: absolute;
  inset: 0 0 auto 0;
  height: 0.375rem;
`;

const LessonEyebrow = styled.p`
  color: var(--accent-dark);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.2em;
  text-transform: uppercase;
`;

const LessonTitle = styled.h1`
  margin-top: 0.65rem;
  max-width: 58rem;
  font-family: var(--font-heading), sans-serif;
  color: #0f172a;
  font-size: clamp(2.2rem, 4vw, 3.75rem);
  font-weight: 900;
  line-height: 0.94;
`;

const LessonSummary = styled.p`
  margin-top: 0.9rem;
  max-width: 58rem;
  color: #52638c;
  font-size: clamp(1.04rem, 1.45vw, 1.18rem);
  font-weight: 650;
  line-height: 1.72;
`;

const ProgressPanel = styled.div`
  margin-top: 1.1rem;
  border: 1px solid var(--line);
  border-radius: 1.5rem;
  background: rgba(255, 255, 255, 0.85);
  padding: 0.9rem;
`;

const ProgressHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
`;

const ProgressTitle = styled.p`
  color: #0f172a;
  font-size: 0.95rem;
  font-weight: 700;
`;

const ProgressValue = styled.span`
  color: var(--accent-dark);
  font-size: 0.95rem;
  font-weight: 900;
`;

const ProgressHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.65rem;
`;

const ProgressToggleButton = styled.button<{ $expanded: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(90, 108, 255, 0.08);
  color: var(--accent-dark);

  span {
    width: 0.58rem;
    height: 0.58rem;
    border-right: 2px solid currentColor;
    border-bottom: 2px solid currentColor;
    transform: ${({ $expanded }) =>
      $expanded ? "translateY(0.12rem) rotate(225deg)" : "translateY(-0.12rem) rotate(45deg)"};
    transition: transform 180ms ease;
  }

  @media (min-width: 768px) {
    display: none;
  }

  @media (prefers-reduced-motion: reduce) {
    span {
      transition: none;
    }
  }
`;

const ProgressBarTrack = styled.div`
  height: 0.625rem;
  margin-top: 0.7rem;
  overflow: hidden;
  border-radius: 9999px;
  background: rgba(90, 108, 255, 0.16);
`;

const ProgressBarFill = styled.div`
  height: 100%;
  border-radius: 9999px;
  background: linear-gradient(90deg, #6F8CFF, #3B2B8F);
`;

const StepTabsGrid = styled.div<{ $mobileExpanded: boolean }>`
  display: grid;
  gap: 0.65rem;
  margin-top: 0.85rem;

  @media (max-width: 767px) {
    row-gap: ${({ $mobileExpanded }) => ($mobileExpanded ? "0.65rem" : "0")};
    transition: row-gap 280ms ease;
  }

  @media (min-width: 768px) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

type StepButtonProps = {
  $active: boolean;
  $state: CourseNodeState;
  $mobileHidden?: boolean;
};

const stepButtonStyles = ({ $active, $state }: StepButtonProps) => {
  if ($state === "locked") {
    return css`
      cursor: not-allowed;
      border-color: #e2e8f0;
      background: #f1f5f9;
      color: #64748b;
    `;
  }

  if ($active) {
    return css`
      cursor: pointer;
      border-color: var(--accent);
      background: color-mix(in srgb, var(--accent-soft) 30%, white);
      box-shadow: 0 12px 24px rgba(90, 108, 255, 0.12);
    `;
  }

  return css`
    cursor: pointer;
    border-color: var(--line);
    background: rgba(255, 255, 255, 0.9);

    &:hover {
      border-color: var(--line-strong);
      transform: translateY(-2px);
    }
  `;
};

const StepTabButton = styled.button<StepButtonProps>`
  box-sizing: border-box;
  border-radius: 1.2rem;
  border: 1px solid transparent;
  padding: 0.78rem 0.8rem;
  text-align: left;
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease,
    box-shadow 160ms ease;

  ${stepButtonStyles}

  @media (max-width: 767px) {
    overflow: hidden;
    max-height: ${({ $mobileHidden }) => ($mobileHidden ? "0" : "10rem")};
    padding-top: ${({ $mobileHidden }) => ($mobileHidden ? "0" : "0.78rem")};
    padding-bottom: ${({ $mobileHidden }) => ($mobileHidden ? "0" : "0.78rem")};
    border-width: ${({ $mobileHidden }) => ($mobileHidden ? "0" : "1px")};
    opacity: ${({ $mobileHidden }) => ($mobileHidden ? "0" : "1")};
    visibility: ${({ $mobileHidden }) => ($mobileHidden ? "hidden" : "visible")};
    pointer-events: ${({ $mobileHidden }) => ($mobileHidden ? "none" : "auto")};
    transform: ${({ $mobileHidden }) =>
      $mobileHidden ? "translateY(-0.45rem) scale(0.985)" : "translateY(0) scale(1)"};
    transition:
      max-height 300ms cubic-bezier(0.22, 1, 0.36, 1),
      padding 300ms cubic-bezier(0.22, 1, 0.36, 1),
      border-width 220ms ease,
      opacity 190ms ease,
      transform 300ms cubic-bezier(0.22, 1, 0.36, 1),
      visibility 300ms;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const StepTabOrder = styled.p`
  color: var(--ink-soft);
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
`;

const StepTabTitle = styled.p`
  margin-top: 0.45rem;
  color: inherit;
  font-size: 0.88rem;
  font-weight: 900;
  line-height: 1.2;
`;

const StepTabState = styled.p`
  margin-top: 0.45rem;
  color: var(--ink-soft);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
`;

const StepCard = styled.article<{ $focusMode: boolean; $flatPracticeOnMobile: boolean }>`
  ${baseCard};
  overflow: hidden;
  width: 100%;
  margin-inline: 0;
  box-shadow: ${({ $focusMode }) =>
    $focusMode
      ? "0 28px 90px rgba(46, 59, 146, 0.18)"
      : "0 24px 64px rgba(46, 59, 146, 0.12)"};
  transition:
    width 320ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 260ms ease,
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1);

  @media (min-width: 1280px) {
    grid-column: 1 / -1;
  }

  @media (max-width: 767px) {
    ${({ $flatPracticeOnMobile }) =>
      $flatPracticeOnMobile
        ? css`
            border: 0;
            background: transparent;
            box-shadow: none;
          `
        : ""}
  }
`;

const FocusHeader = styled.div`
  position: sticky;
  top: 0;
  z-index: 4;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.85rem;
  border-bottom: 1px solid rgba(188, 201, 255, 0.72);
  background:
    radial-gradient(circle at 12% 0%, rgba(139, 92, 246, 0.18), transparent 32%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(244, 247, 255, 0.94));
  padding: 0.85rem clamp(1rem, 3vw, 1.45rem);
  backdrop-filter: blur(18px);

  @media (max-width: 560px) {
    grid-template-columns: auto 1fr;
  }
`;

const FocusBackButton = styled.button`
  ${actionBase};
  border-color: rgba(188, 201, 255, 0.9);
  background: rgba(255, 255, 255, 0.82);
  color: #24314f;
  padding: 0.55rem 0.82rem;
  font-size: 0.82rem;
  font-weight: 900;
`;

const FocusHeaderTitle = styled.div`
  min-width: 0;
  text-align: center;

  span {
    display: block;
    color: var(--accent-dark);
    font-size: 0.68rem;
    font-weight: 950;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  strong {
    display: block;
    overflow: hidden;
    margin-top: 0.16rem;
    color: #111a39;
    font-size: clamp(0.95rem, 2.4vw, 1.18rem);
    font-weight: 950;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 560px) {
    text-align: left;
  }
`;

const FocusHeaderProgress = styled.span`
  border-radius: 999px;
  background: rgba(238, 242, 255, 0.96);
  color: #4357dd;
  padding: 0.42rem 0.72rem;
  font-size: 0.78rem;
  font-weight: 950;

  @media (max-width: 560px) {
    grid-column: 1 / -1;
    width: fit-content;
    justify-self: center;
  }
`;

const StepHero = styled.div`
  padding: 1rem 1.5rem;
  color: white;
`;

const StepHeroTag = styled.p`
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.22em;
  text-transform: uppercase;
`;

const StepHeroTitle = styled.h2`
  margin-top: 0.45rem;
  font-size: 2rem;
  font-weight: 900;
`;

const StepBody = styled.div<{ $focusMode: boolean; $flatPracticeOnMobile: boolean }>`
  padding: ${({ $focusMode }) => ($focusMode ? "1rem 1.2rem 1.35rem" : "1.5rem")};

  @media (max-width: 767px) {
    padding: ${({ $flatPracticeOnMobile }) =>
      $flatPracticeOnMobile ? "0 0 1.35rem" : undefined};
  }

  @media (min-width: 768px) {
    padding: ${({ $focusMode }) => ($focusMode ? "1.65rem 2rem 2rem" : "1.5rem 2rem")};
  }

  @media (min-width: 1024px) {
    padding: ${({ $focusMode }) => ($focusMode ? "2rem 2.4rem 2.35rem" : "1.5rem 2rem")};
  }
`;

const StepImageFrame = styled.div`
  margin-bottom: 1.5rem;
  border: 0;
  border-radius: 0;
  background: transparent;
  padding: 0;

  @media (max-width: 767px) {
    margin-inline: -0.55rem;
  }
`;

const StepImage = styled.img`
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
  object-position: center;
  border-radius: 0;
  background: transparent;

  @media (max-width: 767px) {
    max-height: min(76vh, 38rem);
  }
`;

const LessonImageButton = styled.button`
  position: relative;
  display: block;
  width: 100%;
  border: 0;
  border-radius: 1rem;
  background: transparent;
  padding: 0;
  text-align: left;
  cursor: zoom-in;

  &:focus-visible {
    outline: 3px solid rgba(90, 108, 255, 0.48);
    outline-offset: 3px;
  }
`;

const ImageZoomBadge = styled.span`
  position: absolute;
  right: 0.65rem;
  bottom: 0.65rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.78);
  color: #ffffff;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.2);
  pointer-events: none;

  svg {
    width: 1.15rem;
    height: 1.15rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }

  @media (min-width: 768px) {
    opacity: 0;
    transform: translateY(0.25rem);
    transition:
      opacity 160ms ease,
      transform 160ms ease;

    ${LessonImageButton}:hover &,
    ${LessonImageButton}:focus-visible & {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const StepFooter = styled.div<{ $focusMode: boolean }>`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: ${({ $focusMode }) => ($focusMode ? "1.35rem" : "2rem")};
  padding-top: 1.25rem;
  border-top: 1px solid var(--line);
`;

const FooterActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
`;

const CompletedActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: flex-end;
`;

const SidebarCard = styled.article`
  ${baseCard};
  padding: 1.25rem;
`;

const SidebarHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
`;

const SidebarEyebrow = styled.p`
  color: var(--accent-dark);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.22em;
  text-transform: uppercase;
`;

const SidebarBackLink = styled(Link)`
  display: inline-flex;
  min-height: 2rem;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(181, 196, 255, 0.78);
  border-radius: 999px;
  background: rgba(248, 250, 255, 0.9);
  color: #4c5fd5;
  padding: 0.38rem 0.7rem;
  font-size: 0.72rem;
  font-weight: 850;
  line-height: 1;
  text-decoration: none;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    color 160ms ease,
    transform 160ms ease;

  &:hover {
    border-color: rgba(90, 108, 255, 0.65);
    background: rgba(238, 242, 255, 0.98);
    color: var(--accent-dark);
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 3px solid rgba(90, 108, 255, 0.2);
    outline-offset: 2px;
  }
`;

const LessonInfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 1rem;
`;

const LessonInfoItem = styled.div`
  display: flex;
  gap: 0.55rem;
  align-items: center;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 1.15rem;
  background: rgba(255, 255, 255, 0.82);
  padding: 0.82rem 0.78rem;
`;

const LessonInfoIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 0.85rem;
  background: rgba(238, 242, 255, 0.95);
  font-size: 1rem;
`;

const LessonInfoCopy = styled.div`
  min-width: 0;
`;

const LessonInfoValue = styled.p`
  overflow: hidden;
  color: #0f172a;
  font-size: 0.9rem;
  font-weight: 900;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const LessonInfoLabel = styled.p`
  margin-top: 0.18rem;
  overflow: hidden;
  color: var(--ink-soft);
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const LessonActivityList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
`;

const LessonActivityItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid rgba(190, 202, 255, 0.74);
  border-radius: 999px;
  background: rgba(246, 248, 255, 0.9);
  color: #26375f;
  padding: 0.42rem 0.62rem;
  font-size: 0.78rem;
  font-weight: 800;
`;

const LessonVocabularyCard = styled.div`
  margin-top: 1rem;
  border: 1px solid rgba(190, 202, 255, 0.78);
  border-radius: 1.2rem;
  background:
    radial-gradient(circle at 12% 12%, rgba(45, 212, 191, 0.16), transparent 36%),
    rgba(255, 255, 255, 0.78);
  padding: 0.9rem;
`;

const LessonVocabularyTop = styled.div`
  display: flex;
  align-items: center;
  gap: 0.7rem;
`;

const LessonVocabularyIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 0.9rem;
  background: rgba(238, 242, 255, 0.96);
  font-size: 1.05rem;
`;

const LessonVocabularyTitle = styled.p`
  color: #14213d;
  font-size: 0.88rem;
  font-weight: 950;
`;

const LessonVocabularyText = styled.p`
  margin-top: 0.16rem;
  color: var(--ink-soft);
  font-size: 0.78rem;
  font-weight: 750;
`;

const LessonVocabularyTrack = styled.div`
  overflow: hidden;
  height: 0.48rem;
  margin-top: 0.85rem;
  border-radius: 999px;
  background: rgba(221, 226, 255, 0.86);
`;

const LessonVocabularyFill = styled.div`
  height: 100%;
  min-width: 0.3rem;
  border-radius: inherit;
  background: linear-gradient(90deg, #55b8ff, var(--accent));
  transition: width 240ms ease;
`;

const LessonSaveNote = styled.p`
  margin-top: 1rem;
  border-radius: 1rem;
  background: linear-gradient(135deg, rgba(226, 241, 255, 0.9), rgba(240, 237, 255, 0.88));
  color: #52618b;
  padding: 0.85rem;
  font-size: 0.84rem;
  line-height: 1.55;
`;

const StepRewardCard = styled.div`
  display: flex;
  align-items: center;
  gap: 0.85rem;
  margin-top: 1.4rem;
  border: 1px solid rgba(142, 190, 255, 0.66);
  border-radius: 1.35rem;
  background: linear-gradient(135deg, rgba(231, 243, 255, 0.94), rgba(244, 242, 255, 0.94));
  padding: 1rem;
  box-shadow: 0 16px 36px rgba(66, 126, 230, 0.12);
`;

const StepRewardIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 999px;
  background: rgba(209, 231, 255, 0.9);
  font-size: 1.25rem;
`;

const StepRewardCopy = styled.div`
  min-width: 0;
`;

const StepRewardTitle = styled.p`
  color: #0f172a;
  font-size: 0.98rem;
  font-weight: 900;
`;

const StepRewardText = styled.p`
  margin-top: 0.22rem;
  color: #356bd6;
  font-size: 0.86rem;
  font-weight: 800;
`;

const RichTextStack = styled.div`
  display: grid;
  gap: 1rem;
`;

const InlineImageFigure = styled.figure<{ $hiddenOnMobile: boolean }>`
  margin: 0;
  width: 100%;

  @media (max-width: 767px) {
    display: ${({ $hiddenOnMobile }) => ($hiddenOnMobile ? "none" : "block")};
    width: calc(100% + 1.1rem);
    margin-inline: -0.55rem;
  }
`;

const InlineImage = styled.img`
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
  object-position: center;
  background: transparent;

`;

const DesktopInlineImageButton = styled(LessonImageButton)`
  @media (max-width: 767px) { display: none; }
`;

const MobileInlineImageSequence = styled.div`
  display: none;

  @media (max-width: 767px) {
    display: grid;
    gap: 0.8rem;
    width: 100%;
  }
`;

const InlineImageCaption = styled.figcaption`
  margin-top: 0.55rem;
  color: var(--ink-soft);
  font-size: 0.9rem;
  line-height: 1.6;
`;

const InlineAudioPanel = styled.div<{ $compact: boolean }>`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 1rem;
  width: ${({ $compact }) => ($compact ? "min(100%, 40rem)" : "100%")};
  margin-inline: auto;
  border: 1px solid rgba(181, 196, 255, 0.9);
  border-radius: 1.6rem;
  background:
    radial-gradient(circle at top right, rgba(95, 211, 202, 0.2), transparent 14rem),
    radial-gradient(circle at bottom left, rgba(106, 77, 255, 0.12), transparent 13rem),
    linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(242, 246, 255, 0.97));
  padding: 1rem;
  box-shadow: 0 18px 44px rgba(46, 59, 146, 0.12);

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;

const InlineAudioPlayButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #5a6cff, #6a4dff);
  color: #ffffff;
  box-shadow: 0 14px 30px rgba(90, 108, 255, 0.3);
  font-size: 1.05rem;
  font-weight: 900;
  line-height: 1;
  cursor: pointer;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    filter 160ms ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 18px 34px rgba(90, 108, 255, 0.36);
    filter: saturate(1.08);
  }
`;

const InlineAudioBody = styled.div`
  display: grid;
  min-width: 0;
  gap: 0.75rem;
`;

const InlineAudioMeta = styled.div`
  display: grid;
  gap: 0.28rem;
`;

const InlineAudioKicker = styled.p`
  color: var(--accent-dark);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
`;

const InlineAudioTitle = styled.p`
  color: #18233f;
  font-size: 1.02rem;
  font-weight: 900;
  line-height: 1.35;
  overflow-wrap: anywhere;
`;

const InlineAudioTimeline = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.7rem;
`;

const InlineAudioTime = styled.span`
  color: var(--ink-soft);
  font-size: 0.78rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
`;

const InlineAudioRange = styled.input<{ $progress: number }>`
  width: 100%;
  height: 0.62rem;
  border-radius: 999px;
  appearance: none;
  background: ${({ $progress }) =>
    `linear-gradient(90deg, #5fd3ca 0%, #5a6cff ${$progress}%, rgba(90, 108, 255, 0.16) ${$progress}%, rgba(90, 108, 255, 0.16) 100%)`};
  cursor: pointer;

  &::-webkit-slider-thumb {
    appearance: none;
    width: 1.1rem;
    height: 1.1rem;
    border: 3px solid #ffffff;
    border-radius: 999px;
    background: #5a6cff;
    box-shadow: 0 8px 18px rgba(46, 59, 146, 0.22);
  }

  &::-moz-range-thumb {
    width: 1.1rem;
    height: 1.1rem;
    border: 3px solid #ffffff;
    border-radius: 999px;
    background: #5a6cff;
    box-shadow: 0 8px 18px rgba(46, 59, 146, 0.22);
  }
`;

const DialogueBlock = styled.section`
  display: grid;
  grid-template-columns: minmax(11rem, 0.7fr) minmax(0, 1fr);
  gap: 1.15rem;
  overflow: hidden;
  border: 1px solid rgba(181, 196, 255, 0.86);
  border-radius: 1.7rem;
  background:
    radial-gradient(circle at 8% 12%, rgba(95, 211, 202, 0.22), transparent 14rem),
    radial-gradient(circle at 100% 0%, rgba(106, 77, 255, 0.16), transparent 16rem),
    linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(243, 247, 255, 0.96));
  padding: 1rem;
  box-shadow: 0 22px 52px rgba(46, 59, 146, 0.12);

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const DialogueVisual = styled.div`
  position: relative;
  display: grid;
  place-items: center;
  min-height: 16rem;
  overflow: hidden;
  border-radius: 1.25rem;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(231, 238, 255, 0.78)),
    radial-gradient(circle at center, rgba(90, 108, 255, 0.12), transparent 70%);

  @media (max-width: 760px) {
    min-height: 12rem;
  }
`;

const DialogueImage = styled.img`
  position: absolute;
  top: 50%;
  left: 50%;
  display: block;
  width: auto;
  height: 82%;
  max-width: 92%;
  max-height: 34rem;
  object-fit: contain;
  object-position: center;
  transform: translate(-50%, -50%);
`;

const DialogueContent = styled.div`
  display: grid;
  align-content: center;
  gap: 0.75rem;
  min-width: 0;
  padding: 0.35rem 0.2rem;
`;

const DialogueKicker = styled.p`
  color: var(--accent-dark);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
`;

const DialogueMessages = styled.div`
  display: grid;
  gap: 0.72rem;
`;

const DialogueRow = styled.div<{ $side: "left" | "right" }>`
  display: flex;
  justify-content: ${({ $side }) => ($side === "right" ? "flex-end" : "flex-start")};
`;

const DialogueBubble = styled.div<{ $side: "left" | "right" }>`
  position: relative;
  max-width: min(100%, 36rem);
  border: 1px solid
    ${({ $side }) => ($side === "right" ? "rgba(95, 211, 202, 0.72)" : "rgba(181, 196, 255, 0.82)")};
  border-radius: ${({ $side }) =>
    $side === "right" ? "1.25rem 1.25rem 0.35rem 1.25rem" : "1.25rem 1.25rem 1.25rem 0.35rem"};
  background: ${({ $side }) =>
    $side === "right"
      ? "linear-gradient(135deg, rgba(235, 255, 252, 0.98), rgba(255, 255, 255, 0.98))"
      : "linear-gradient(135deg, rgba(245, 247, 255, 0.98), rgba(255, 255, 255, 0.98))"};
  padding: 0.85rem 1rem;
  box-shadow: 0 12px 28px rgba(46, 59, 146, 0.08);
`;

const DialogueSpeaker = styled.p`
  margin-bottom: 0.28rem;
  color: #4f5fd3;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

const DialogueText = styled.p`
  color: #1e293b;
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.65;
  overflow-wrap: anywhere;
`;

const RichParagraph = styled.p`
  color: #1e293b;
  font-size: 1.1rem;
  line-height: 1.95;
`;

const RichList = styled.ul`
  display: grid;
  gap: 0.6rem;
  margin: 0;
  padding: 0;
`;

const RichListItem = styled.li`
  list-style: none;
  padding-left: 1.2rem;
  position: relative;
  color: #334155;
  font-size: 1.06rem;
  line-height: 1.8;

  &::before {
    content: "";
    position: absolute;
    left: 0.1rem;
    top: 0.78rem;
    width: 0.42rem;
    height: 0.42rem;
    border-radius: 999px;
    background: rgba(64, 92, 214, 0.72);
  }
`;

const RichTableWrap = styled.div`
  overflow-x: auto;
  border: 1px solid rgba(181, 196, 255, 0.72);
  border-radius: 1.4rem;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(245, 248, 255, 0.96));
  box-shadow: 0 16px 32px rgba(63, 84, 186, 0.08);

  @media (max-width: 767px) {
    overflow-x: hidden;
  }
`;

const RichTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  min-width: 32rem;

  @media (max-width: 767px) {
    min-width: 0;
    table-layout: fixed;
  }
`;

const RichTableHeader = styled.th`
  padding: 0.9rem 1rem;
  border-bottom: 1px solid rgba(181, 196, 255, 0.72);
  background: linear-gradient(180deg, rgba(233, 239, 255, 0.96), rgba(225, 234, 255, 0.92));
  color: #24314f;
  font-size: 0.98rem;
  font-weight: 800;
  text-align: left;

  @media (max-width: 767px) {
    padding: 0.7rem 0.45rem;
    font-size: clamp(0.72rem, 3.4vw, 0.86rem);
    line-height: 1.35;
    overflow-wrap: anywhere;
    vertical-align: top;
  }
`;

const RichTableCell = styled.td`
  padding: 0.9rem 1rem;
  border-top: 1px solid rgba(181, 196, 255, 0.4);
  color: #334155;
  font-size: 1.02rem;
  line-height: 1.8;
  background: rgba(255, 255, 255, 0.9);

  tr:first-child & {
    border-top: none;
  }

  tbody tr:nth-child(even) & {
    background: rgba(244, 247, 255, 0.95);
  }

  @media (max-width: 767px) {
    padding: 0.7rem 0.45rem;
    font-size: clamp(0.74rem, 3.5vw, 0.9rem);
    line-height: 1.5;
    overflow-wrap: anywhere;
    vertical-align: top;
  }
`;

const StrongText = styled.strong`
  font-weight: 800;
  color: #18233f;
`;

const UnderlinedText = styled.span`
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-decoration-color: rgba(64, 92, 214, 0.55);
  text-underline-offset: 0.16em;
`;

const MarkedText = styled.mark`
  padding: 0.02rem 0.28rem;
  border-radius: 0.35rem;
  background: rgba(255, 231, 153, 0.8);
  color: #18233f;
`;

const ColoredText = styled.span<{ $color: string }>`
  color: ${({ $color }) => $color};
  font-weight: 700;
`;

const SizedText = styled.span<{ $size: "sm" | "md" | "lg" | "xl" }>`
  font-size: ${({ $size }) =>
    $size === "sm"
      ? "0.92em"
      : $size === "lg"
        ? "1.16em"
        : $size === "xl"
          ? "1.32em"
          : "1em"};
  line-height: 1.7;
`;
