"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import { getCourseLevelImage } from "@/lib/course-level-images";
import {
  type CoursePlacementState,
  markCourseGreetingSeen,
  readCoursePlacementState,
} from "@/lib/course-placement";
import type { CourseOverviewLevel, CourseOverviewResponse } from "@/types/courses";

export function CourseOverviewClientFallback() {
  return (
    <Section>
      <Shell className="site-shell">
        <LoadingStack>
          <TopSectionGrid>
            <LoadingHeroCard>
              <LoadingHeroGlowTop />
              <LoadingHeroGlowBottom />
              <LoadingHeroContent>
                <LoadingLine $width="18rem" $height="1.7rem" />
                <LoadingLine $width="min(100%, 30rem)" $height="8rem" />
                <LoadingTextGroup>
                  <LoadingLine $width="min(100%, 36rem)" $height="0.9rem" />
                  <LoadingLine $width="min(92%, 32rem)" $height="0.9rem" />
                  <LoadingLine $width="min(74%, 24rem)" $height="0.9rem" />
                </LoadingTextGroup>
                <LoadingButtonRow>
                  <LoadingPill $width="10rem" />
                  <LoadingPill $width="12rem" />
                </LoadingButtonRow>
              </LoadingHeroContent>
            </LoadingHeroCard>

            <HeroSideColumn>
              <LoadingSideCard>
                <LoadingLine $width="7rem" $height="0.8rem" />
                <LoadingLine $width="13rem" $height="2rem" />
                <LoadingLine $width="11rem" $height="0.95rem" />
                <LoadingTextGroup>
                  <LoadingLine $width="100%" $height="0.82rem" />
                  <LoadingLine $width="86%" $height="0.82rem" />
                  <LoadingLine $width="68%" $height="0.82rem" />
                </LoadingTextGroup>
                <LoadingPill $width="8.5rem" />
              </LoadingSideCard>

              <LoadingWarmCard>
                <LoadingLine $width="9rem" $height="0.8rem" />
                <LoadingLine $width="12rem" $height="2rem" />
                <LoadingTextGroup>
                  <LoadingLine $width="100%" $height="0.82rem" />
                  <LoadingLine $width="78%" $height="0.82rem" />
                </LoadingTextGroup>
                <LoadingPill $width="8rem" />
              </LoadingWarmCard>
            </HeroSideColumn>
          </TopSectionGrid>

          <LoadingLevelsGrid>
            {Array.from({ length: 4 }).map((_, index) => (
              <LoadingLevelCard key={index}>
                <LoadingAccent />
                <LoadingLevelHeader>
                  <LoadingLevelHeaderText>
                    <LoadingLine $width="6.5rem" $height="0.8rem" />
                    <LoadingLine $width="11rem" $height="2rem" />
                  </LoadingLevelHeaderText>
                  <LoadingLevelHeaderMedia>
                    <LoadingSquare />
                    <LoadingDonut />
                  </LoadingLevelHeaderMedia>
                </LoadingLevelHeader>
                <LoadingTextGroup>
                  <LoadingLine $width="100%" $height="0.9rem" />
                  <LoadingLine $width="92%" $height="0.9rem" />
                  <LoadingLine $width="70%" $height="0.9rem" />
                </LoadingTextGroup>
                <LoadingHighlights>
                  <LoadingLine $width="8rem" $height="0.75rem" />
                  {Array.from({ length: 3 }).map((_, itemIndex) => (
                    <LoadingHighlightRow key={itemIndex}>
                      <LoadingDot />
                      <LoadingLine $width={itemIndex === 1 ? "88%" : "72%"} $height="0.82rem" />
                    </LoadingHighlightRow>
                  ))}
                </LoadingHighlights>
                <LoadingStatsGrid>
                  <LoadingStat>
                    <LoadingLine $width="5.5rem" $height="0.75rem" />
                    <LoadingLine $width="3.5rem" $height="1.8rem" />
                  </LoadingStat>
                  <LoadingStat>
                    <LoadingLine $width="4.5rem" $height="0.75rem" />
                    <LoadingLine $width="4rem" $height="1.8rem" />
                  </LoadingStat>
                </LoadingStatsGrid>
                <LoadingFooter>
                  <LoadingPill $width="5.8rem" />
                  <LoadingLine $width="9rem" $height="0.86rem" />
                </LoadingFooter>
                <LoadingCardCta />
              </LoadingLevelCard>
            ))}
          </LoadingLevelsGrid>
        </LoadingStack>
      </Shell>
    </Section>
  );
}

type PlacementRevealAnimationMode = "idle" | "sweepAll" | "sweepToTarget" | "done";

const LEVEL_HIGHLIGHTS: Record<number, string[]> = {
  1: ["Хангыль и первые слоги", "Чтение и письмо базовых букв", "Мини-тесты и короткая практика"],
  2: ["Устойчивые фразы на каждый день", "Грамматика для простых диалогов", "Дом, учеба и личные планы"],
  3: ["Город, покупки и направления", "Чувства, потребности и реакции", "Более живые бытовые диалоги"],
  4: ["Причины, мнения и сравнения", "Планы, советы и аргументация", "Практические задачи в связной речи"],
};

const LEVEL_PERSONAS: Record<
  number,
  {
    icon: string;
    label: string;
    tone: string;
  }
> = {
  1: { icon: "🐣", label: "Start", tone: "#fff1b8" },
  2: { icon: "🦆", label: "Foundation", tone: "#dbeafe" },
  3: { icon: "🚀", label: "Intermediate", tone: "#ffdfb5" },
  4: { icon: "🥷", label: "Advanced", tone: "#e7d7ff" },
};

export function CourseOverviewClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<CourseOverviewResponse | null>(null);
  const [error, setError] = useState("");
  const [clientReady, setClientReady] = useState(false);
  const [placementState, setPlacementState] = useState<CoursePlacementState>({
    greetingSeen: false,
    completed: false,
    recommendedLevelNumber: null,
    recommendedLevelSlug: null,
    completedAt: null,
  });
  const [showPlacementReveal, setShowPlacementReveal] = useState(false);
  const [focusedLevelNumber, setFocusedLevelNumber] = useState<number | null>(null);
  const [revealLevelCards, setRevealLevelCards] = useState(false);
  const [isEnteringPlacement, setIsEnteringPlacement] = useState(false);
  const [placementRevealMode, setPlacementRevealMode] = useState<PlacementRevealAnimationMode>("idle");
  const [placementRevealAnimatedLevel, setPlacementRevealAnimatedLevel] = useState<number | null>(null);
  const placementRevealHandledRef = useRef(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch("/api/courses", { cache: "no-store" });
        const payload = (await response.json()) as CourseOverviewResponse & { error?: string };

        if (!active) {
          return;
        }

        if (!response.ok) {
          setError(payload.error ?? "Error response.");
          return;
        }

        const nextPlacementState = payload.viewer.isAuthenticated
          ? payload.viewer.coursePlacement
          : readCoursePlacementState();
        setData(payload);
        setPlacementState(nextPlacementState);
        setFocusedLevelNumber(nextPlacementState.recommendedLevelNumber);
      } catch {
        if (active) {
          setError('jjuki');
        }
      } finally {
        if (active) {
          setClientReady(true);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const focusLevelFromQuery = useMemo(() => {
    const raw = Number(searchParams.get("focusLevel"));
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }, [searchParams]);

  const placementRequested = searchParams.get("placement") === "1";
  const recommendedLevel = useMemo(() => {
    const levels = data?.levels ?? [];

    if (levels.length === 0) {
      return null;
    }

    return (
      levels.find((level) => level.slug === placementState.recommendedLevelSlug) ??
      levels.find((level) => level.number === placementState.recommendedLevelNumber) ??
      levels.find((level) => level.number === 1) ??
      levels[0]
    );
  }, [data?.levels, placementState.recommendedLevelNumber, placementState.recommendedLevelSlug]);
  const startRoadmapHref = recommendedLevel ? `/courses/${recommendedLevel.slug}` : "/courses/starter";
  const hasContinueLesson = data?.viewer.isAuthenticated === true && data?.continueLesson !== null;
  const primaryHeroHref =
    hasContinueLesson && data?.continueLesson
      ? getContinueLessonHref(
          data.viewer.isAuthenticated,
          data.continueLesson.levelSlug,
          data.continueLesson.unitSlug,
          data.continueLesson.lessonSlug,
        )
      : startRoadmapHref;
  const primaryHeroLabel = hasContinueLesson ? "Продолжить обучение" : "Начать обучение";
  const completedLessonsCount = data?.levels.reduce((sum, level) => sum + level.completedLessons, 0) ?? 0;
  const totalLessonsCount = data?.levels.reduce((sum, level) => sum + level.totalLessons, 0) ?? 0;
  const courseProgressPercent =
    totalLessonsCount > 0 ? Math.round((completedLessonsCount / totalLessonsCount) * 100) : 0;
  const activeLevel =
    data?.levels.find((level) => level.currentLessonTitle) ??
    recommendedLevel ??
    data?.levels.find((level) => level.isUnlocked) ??
    data?.levels[0] ??
    null;
  const greetingName = data?.viewer.name?.trim() ? data.viewer.name.trim() : null;
  const todayItems = hasContinueLesson
    ? [
        data?.continueLesson?.lessonTitle ?? "Продолжить текущий урок",
        `Следующий шаг: ${data?.continueLesson?.nextStepLabel ?? "практика"}`,
        "Закрыть короткую проверку",
      ]
    : [
        activeLevel ? `Открыть ${activeLevel.title}` : "Открыть первый уровень",
        "Пройти первый короткий урок",
        "Закрепить буквы и произношение",
      ];
  const learningStats = data?.learningStats ?? {
    streakDays: 0,
    totalXp: 0,
    completedLessons: 0,
    rankTitle: "Beginner I",
    nextRankTitle: "Beginner II",
    rankProgressPercent: 0,
    xpToNextRank: 300,
  };

  const closePlacementReveal = useCallback(() => {
    setShowPlacementReveal(false);
    setPlacementRevealMode("idle");
    setPlacementRevealAnimatedLevel(null);
    setRevealLevelCards(true);
    if (focusLevelFromQuery) {
      setFocusedLevelNumber(focusLevelFromQuery);
    }
    router.replace("/courses", { scroll: false });
  }, [focusLevelFromQuery, router]);

  useEffect(() => {
    if (!clientReady || placementRevealHandledRef.current) {
      return;
    }

    if (!placementRequested || !focusLevelFromQuery) {
      return;
    }

    placementRevealHandledRef.current = true;

    const targetLevel = Math.min(Math.max(focusLevelFromQuery, 1), PLACEMENT_REVEAL_LEVEL_COUNT);
    const revealDurationMs =
      PLACEMENT_REVEAL_SWEEP_INITIAL_DELAY_MS +
      (PLACEMENT_REVEAL_LEVEL_COUNT - 1) * PLACEMENT_REVEAL_SWEEP_STEP_MS +
      PLACEMENT_REVEAL_PHASE_GAP_MS +
      Math.max(targetLevel - 1, 0) * PLACEMENT_REVEAL_TARGET_STEP_MS +
      PLACEMENT_REVEAL_HOLD_MS;

    const frameId = window.requestAnimationFrame(() => {
      setShowPlacementReveal(true);
    });

    const timeoutId = window.setTimeout(closePlacementReveal, revealDurationMs);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [clientReady, closePlacementReveal, focusLevelFromQuery, placementRequested]);

  useEffect(() => {
    if (!showPlacementReveal || !focusLevelFromQuery) {
      return;
    }

    const targetLevel = Math.min(Math.max(focusLevelFromQuery, 1), PLACEMENT_REVEAL_LEVEL_COUNT);
    const timeoutIds: number[] = [];

    timeoutIds.push(
      window.setTimeout(() => {
        setPlacementRevealMode("sweepAll");
        setPlacementRevealAnimatedLevel(1);
      }, PLACEMENT_REVEAL_SWEEP_INITIAL_DELAY_MS),
    );

    for (let level = 2; level <= PLACEMENT_REVEAL_LEVEL_COUNT; level += 1) {
      timeoutIds.push(
        window.setTimeout(() => {
          setPlacementRevealMode("sweepAll");
          setPlacementRevealAnimatedLevel(level);
        }, PLACEMENT_REVEAL_SWEEP_INITIAL_DELAY_MS + (level - 1) * PLACEMENT_REVEAL_SWEEP_STEP_MS),
      );
    }

    const secondSweepStartMs =
      PLACEMENT_REVEAL_SWEEP_INITIAL_DELAY_MS +
      (PLACEMENT_REVEAL_LEVEL_COUNT - 1) * PLACEMENT_REVEAL_SWEEP_STEP_MS +
      PLACEMENT_REVEAL_PHASE_GAP_MS;

    for (let level = 1; level <= targetLevel; level += 1) {
      timeoutIds.push(
        window.setTimeout(() => {
          setPlacementRevealMode("sweepToTarget");
          setPlacementRevealAnimatedLevel(level);
        }, secondSweepStartMs + (level - 1) * PLACEMENT_REVEAL_TARGET_STEP_MS),
      );
    }

    timeoutIds.push(
      window.setTimeout(() => {
        setPlacementRevealMode("done");
        setPlacementRevealAnimatedLevel(targetLevel);
      }, secondSweepStartMs + targetLevel * PLACEMENT_REVEAL_TARGET_STEP_MS),
    );

    return () => {
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [focusLevelFromQuery, showPlacementReveal]);

  useEffect(() => {
    if (!focusedLevelNumber || showPlacementReveal) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-level-number="${focusedLevelNumber}"]`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [focusedLevelNumber, showPlacementReveal]);

  const handleGreetingContinue = () => {
    setIsEnteringPlacement(true);
    if (data?.viewer.isAuthenticated !== true) {
      setPlacementState(markCourseGreetingSeen());
    }
    router.push("/courses/placement-test?fromGreeting=1");
  };

  if (!clientReady) {
    return <CourseOverviewClientFallback />;
  }

  if (
    !error &&
    !placementState.completed &&
    (isEnteringPlacement || !placementState.greetingSeen || !placementState.completedAt)
  ) {
    return (
      <Section>
        <Shell className="site-shell">
          <WelcomeShell>
            <WelcomeCard>
              <WelcomeGlowTop />
              <WelcomeGlowBottom />
              <WelcomeLayout>
                <WelcomeArt>
                  <WelcomeHalo />
                  <FloatingBadge $top="10%" $left="4%" $delay="0s">
                    {"Хангыль"}
                  </FloatingBadge>
                  <FloatingBadge $top="18%" $right="3%" $delay="0.24s">
                    {"Уровни"}
                  </FloatingBadge>
                  <FloatingBadge $bottom="12%" $left="8%" $delay="0.42s">
                    TOPIK
                  </FloatingBadge>
                  <Image
                    src="/assets/36.svg"
                    alt=""
                    aria-hidden
                    width={300}
                    height={300}
                    style={{ width: "100%", height: "auto", objectFit: "contain" }}
                  />
                </WelcomeArt>
                <WelcomeContent>
                  <WelcomePill>{"Добро пожаловать"}</WelcomePill>
                  <WelcomeTitle>{"Сначала соберём для вас правильный маршрут обучения"}</WelcomeTitle>
                  <WelcomeText>
                    {"Небольшой мини-тест поможет понять, с какого уровня вам лучше начать корейский и какой темп подойдёт с самого старта."}
                  </WelcomeText>
                  <WelcomeText>
                    {"Это займёт всего пару минут, а дальше мы покажем уже более точный и персональный путь по уровням."}
                  </WelcomeText>
                  <WelcomeHighlight>
                    {"Короткие интерактивные уроки по 10–15 минут в день."}
                  </WelcomeHighlight>
                  <WelcomeActions>
                    <WelcomePrimaryButton type="button" onClick={handleGreetingContinue} disabled={isEnteringPlacement}>
                      {isEnteringPlacement ? "Открываю тест..." : "Поехали!"}
                    </WelcomePrimaryButton>
                  </WelcomeActions>
                </WelcomeContent>
              </WelcomeLayout>
            </WelcomeCard>
          </WelcomeShell>
        </Shell>
      </Section>
    );
  }

  if (error) {
    return (
      <Section>
        <Shell className="site-shell">
          <ErrorCard>{error}</ErrorCard>
        </Shell>
      </Section>
    );
  }

  if (!data) {
    return <CourseOverviewClientFallback />;
  }

  return (
    <Section>
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
      <Shell className="site-shell">
        <ContentStack>
          {showPlacementReveal ? (
            <PlacementRevealOverlay>
              <PlacementRevealCard>
                <PlacementRevealEyebrow>{"Дорожная карта готова"}</PlacementRevealEyebrow>
                <PlacementRevealTitle>{"Собираю ваш маршрут по уровням"}</PlacementRevealTitle>
                <PlacementRevealText>
                  {"Выстраиваю уровни, проверяю точку входа и подсвечиваю старт, с которого лучше начать."}
                </PlacementRevealText>
                <PlacementRevealGrid>
                  {Array.from({ length: PLACEMENT_REVEAL_LEVEL_COUNT }).map((_, index) => {
                    const levelNumber = index + 1;
                    const isActive =
                      placementRevealMode === "sweepAll"
                        ? placementRevealAnimatedLevel === levelNumber
                        : placementRevealMode === "sweepToTarget" || placementRevealMode === "done"
                          ? levelNumber <= (placementRevealAnimatedLevel ?? 0)
                          : false;

                    return (
                      <PlacementMiniCard
                        key={levelNumber}
                        $delay={index * 0.09}
                        $active={isActive}
                      >
                        <PlacementMiniCardDot $active={isActive} />
                        <PlacementMiniCardLineGroup>
                          <PlacementMiniCardLine $width="62%" $delay={index * 0.1} />
                          <PlacementMiniCardLine $width="88%" $delay={index * 0.1 + 0.12} />
                          <PlacementMiniCardLine $width="54%" $delay={index * 0.1 + 0.24} />
                        </PlacementMiniCardLineGroup>
                      </PlacementMiniCard>
                    );
                  })}
                </PlacementRevealGrid> 
              </PlacementRevealCard>
            </PlacementRevealOverlay>
          ) : null}

          <TopSectionGrid>
            <HeroCard>
              <HeroGlowTop />
              <HeroGlowBottom />
              <HeroContent>
                <HeroCopy>
                  <HeroEyebrow>
                    {greetingName ? `С возвращением, ${greetingName}` : "Добро пожаловать в курс"}
                  </HeroEyebrow>
                  <HeroTitle>
                    <span>Корейский</span>
                    <span>как</span>
                    <span>понятное</span>
                    <HeroTitleLastWord>путешествие</HeroTitleLastWord>
                  </HeroTitle>
                  <HeroDescription>
                    {"Сегодня не нужно выбирать из хаоса. Откройте следующий шаг, закройте короткую практику и двигайтесь по маршруту уровня за уровнем."}
                  </HeroDescription>

                  <HeroTodayCard>
                    <HeroTodayHeader>
                      <HeroTodayLabel>{"Сегодня вы учите"}</HeroTodayLabel>
                      <HeroTodayProgress>{completedLessonsCount}/{totalLessonsCount || "—"} уроков</HeroTodayProgress>
                    </HeroTodayHeader>
                    <HeroTodayList>
                      {todayItems.map((item) => (
                        <HeroTodayItem key={item}>
                          <span aria-hidden>✓</span>
                          <span>{item}</span>
                        </HeroTodayItem>
                      ))}
                    </HeroTodayList>
                  </HeroTodayCard>

                  <HeroButtonRow>
                    <PrimaryHeroLink href={primaryHeroHref}>{primaryHeroLabel}</PrimaryHeroLink>
                    {!placementState.completed ? (
                      <SecondaryHeroLink href="/courses/placement-test">
                        {"Пройти тест на уровень"}
                      </SecondaryHeroLink>
                    ) : null}
                  </HeroButtonRow>
                </HeroCopy>

                <HeroVisual aria-hidden>
                  <HeroVisualArtFrame>
                    <Image
                      src="/assets/42.svg"
                      alt=""
                      aria-hidden
                      fill
                      sizes="(min-width: 980px) 380px, 78vw"
                      style={{ objectFit: "contain", transform: "scale(1.45)" }}
                    />
                  </HeroVisualArtFrame>
                  <HeroHangulBubble $top="8%" $left="10%">한</HeroHangulBubble>
                  <HeroHangulBubble $top="22%" $right="12%">글</HeroHangulBubble>
                  <HeroHangulBubble $bottom="21%" $left="14%">가</HeroHangulBubble>
                  <HeroVisualPanel>
                    <HeroVisualPanelLabel>{"Текущий маршрут"}</HeroVisualPanelLabel>
                    <HeroVisualPanelTitle>{activeLevel?.title ?? "Старт"}</HeroVisualPanelTitle>
                    <HeroVisualProgressTrack>
                      <HeroVisualProgressFill style={{ width: `${courseProgressPercent}%` }} />
                    </HeroVisualProgressTrack>
                    <HeroVisualPanelMeta>{courseProgressPercent}% всего курса</HeroVisualPanelMeta>
                  </HeroVisualPanel>
                </HeroVisual>
              </HeroContent>
            </HeroCard>

            <HeroSideColumn>
              <ContinueCard>
                <CardEyebrow>{hasContinueLesson ? "Продолжить" : "Старт"}</CardEyebrow>
                {hasContinueLesson && data.continueLesson ? (
                  <>
                    <ContinueTitle>{data.continueLesson.lessonTitle}</ContinueTitle>
                    <ContinueSubtitle>
                      {data.continueLesson.levelTitle} {"·"} {data.continueLesson.unitTitle}
                    </ContinueSubtitle>

                    <ContinueProgressRow>
                      <ProgressDonut
                        percent={data.continueLesson.completionPercent}
                        accent="#ffbe3b"
                      />
                      <ContinueMeta>
                        <ContinueMetaTitle>
                          {"Следующий шаг:"} {data.continueLesson.nextStepLabel}
                        </ContinueMetaTitle>
                        <ContinueMetaText>
                          {"Вернитесь к уроку с того места, где остановились в прошлый раз."}
                        </ContinueMetaText>
                      </ContinueMeta>
                    </ContinueProgressRow>

                    <PrimaryCardLink
                      href={getContinueLessonHref(
                        data.viewer.isAuthenticated,
                        data.continueLesson.levelSlug,
                        data.continueLesson.unitSlug,
                        data.continueLesson.lessonSlug,
                      )}
                    >
                      {"Продолжить"}
                    </PrimaryCardLink>
                    <LearningStatsPanel>
                      <LearningStatItem>
                        <LearningStatIcon aria-hidden>🔥</LearningStatIcon>
                        <LearningStatCopy>
                          <LearningStatValue>{learningStats.streakDays} дн.</LearningStatValue>
                          <LearningStatLabel>Серия</LearningStatLabel>
                        </LearningStatCopy>
                      </LearningStatItem>
                      <LearningStatItem>
                        <LearningStatIcon aria-hidden>⭐</LearningStatIcon>
                        <LearningStatCopy>
                          <LearningStatValue>{learningStats.totalXp} XP</LearningStatValue>
                          <LearningStatLabel>{learningStats.rankTitle}</LearningStatLabel>
                        </LearningStatCopy>
                      </LearningStatItem>
                      <LearningRankProgress>
                        <LearningRankTop>
                          <span>До {learningStats.nextRankTitle ?? "максимума"}</span>
                          <strong>
                            {learningStats.xpToNextRank === null ? "Готово" : `${learningStats.xpToNextRank} XP`}
                          </strong>
                        </LearningRankTop>
                        <LearningRankTrack>
                          <LearningRankFill style={{ width: `${learningStats.rankProgressPercent}%` }} />
                        </LearningRankTrack>
                      </LearningRankProgress>
                    </LearningStatsPanel>
                  </>
                ) : (
                  <>
                    <ContinueTitle>{"Начать обучение"}</ContinueTitle>
                    <ContinueSubtitle>
                      {recommendedLevel
                        ? `${recommendedLevel.title} · Уровень ${recommendedLevel.number}`
                        : "Старт · Уровень 1"}
                    </ContinueSubtitle>
                    <ContinueBodyText>
                      {recommendedLevel
                        ? `Мы уже подобрали для вас оптимальный старт. Откройте дорожную карту ${recommendedLevel.title.toLowerCase()} и начните с этого уровня.`
                        : "Откройте первую дорожную карту и начните с мягкого старта по хангылю, словам и базовым фразам."}
                    </ContinueBodyText>
                    <PrimaryCardLink href={startRoadmapHref}>{"Начать обучение"}</PrimaryCardLink>
                    <LearningStatsPanel>
                      <LearningStatItem>
                        <LearningStatIcon aria-hidden>🔥</LearningStatIcon>
                        <LearningStatCopy>
                          <LearningStatValue>{learningStats.streakDays} дн.</LearningStatValue>
                          <LearningStatLabel>Серия начнется сегодня</LearningStatLabel>
                        </LearningStatCopy>
                      </LearningStatItem>
                      <LearningStatItem>
                        <LearningStatIcon aria-hidden>⭐</LearningStatIcon>
                        <LearningStatCopy>
                          <LearningStatValue>{learningStats.totalXp} XP</LearningStatValue>
                          <LearningStatLabel>{learningStats.rankTitle}</LearningStatLabel>
                        </LearningStatCopy>
                      </LearningStatItem>
                    </LearningStatsPanel>
                  </>
                )}
              </ContinueCard>

              {!placementState.completed ? (
                <TestCard>
                  <WarmEyebrow>{"Не уверены в уровне?"}</WarmEyebrow>
                  <WarmTitle>{"Пройдите тест на уровень"}</WarmTitle>
                  <WarmText>
                    {"Получите рекомендацию, с какого уровня и юнита лучше начать обучение."}
                  </WarmText>
                  <WarmLink href="/courses/placement-test">{"Тест на уровень"}</WarmLink>
                </TestCard>
              ) : null}
            </HeroSideColumn>
          </TopSectionGrid>

          <CourseStatsGrid>
            <CourseStatCard>
              <CourseStatIcon aria-hidden>🔥</CourseStatIcon>
              <CourseStatCopy>
                <CourseStatValue>{courseProgressPercent}%</CourseStatValue>
                <CourseStatLabel>{"Общий прогресс"}</CourseStatLabel>
              </CourseStatCopy>
            </CourseStatCard>
            <CourseStatCard>
              <CourseStatIcon aria-hidden>⭐</CourseStatIcon>
              <CourseStatCopy>
                <CourseStatValue>{completedLessonsCount}/{totalLessonsCount || "—"}</CourseStatValue>
                <CourseStatLabel>{"Уроков завершено"}</CourseStatLabel>
              </CourseStatCopy>
            </CourseStatCard>
            <CourseStatCard>
              <CourseStatIcon aria-hidden>🏆</CourseStatIcon>
              <CourseStatCopy>
                <CourseStatValue>{activeLevel?.number ? `Ур. ${activeLevel.number}` : "Старт"}</CourseStatValue>
                <CourseStatLabel>{"Текущая точка"}</CourseStatLabel>
              </CourseStatCopy>
            </CourseStatCard>
          </CourseStatsGrid>

          <JourneySection>
            <JourneyHeader>
              <SectionEyebrow>{"Ваш путь"}</SectionEyebrow>
              <SectionTitle>{"Путь, который хочется продолжать"}</SectionTitle>
              <SectionText>
                {"Каждый уровень показывает ближайшую цель, прогресс и следующий шаг — так проще вернуться к учебе без лишних решений."}
              </SectionText>
            </JourneyHeader>

            <JourneyList>
              {data.levels.map((level, index) => {
                const levelImage = getCourseLevelImage(level.number);
                const persona = LEVEL_PERSONAS[level.number] ?? {
                  icon: "●",
                  label: `Level ${level.number}`,
                  tone: `${level.accentColor}18`,
                };
                const previewItems = getLevelPreviewItems(level);

                return (
                  <JourneyItem key={level.id}>
                    <JourneyConnector $isLast={index === data.levels.length - 1} />
                    <JourneyNode $accent={level.accentColor} $tone={persona.tone}>
                      {levelImage ? (
                        <JourneyNodeImageFrame>
                          <Image
                            src={levelImage}
                            alt=""
                            aria-hidden
                            fill
                            sizes="84px"
                            style={{ objectFit: "contain", transform: "scale(1.85)" }}
                          />
                        </JourneyNodeImageFrame>
                      ) : (
                        <JourneyNodeIcon aria-hidden>{persona.icon}</JourneyNodeIcon>
                      )}
                      <JourneyNodeNumber>{level.number}</JourneyNodeNumber>
                    </JourneyNode>

                    <LevelCard
                      href={`/courses/${level.slug}`}
                      data-level-number={level.number}
                      $revealed={revealLevelCards}
                      $delay={(level.number - 1) * 0.1}
                      $accent={level.accentColor}
                      $tone={persona.tone}
                      $isUnlocked={level.isUnlocked}
                    >
                      <LevelHeader>
                        <LevelHeaderText>
                          <LevelPersonaLabel>{persona.label}</LevelPersonaLabel>
                          <LevelEyebrow>{"Уровень"} {level.number}</LevelEyebrow>
                          <LevelTitle>{level.title}</LevelTitle>
                        </LevelHeaderText>
                        <LevelHeaderMedia>
                          {levelImage ? (
                            <LevelArtFrame
                              style={{
                                background: `linear-gradient(160deg, ${level.accentColor}20, rgba(255, 255, 255, 0.96))`,
                                borderColor: `${level.accentColor}30`,
                              }}
                            >
                              <LevelArtGlow style={{ backgroundColor: `${level.accentColor}30` }} />
                              <Image
                                src={levelImage}
                                alt=""
                                aria-hidden
                                fill
                                sizes="(min-width: 1200px) 150px, (min-width: 768px) 128px, 88px"
                                style={{ objectFit: "contain", transform: "scale(2.08)" }}
                              />
                            </LevelArtFrame>
                          ) : (
                            <LevelEmojiArt aria-hidden>{persona.icon}</LevelEmojiArt>
                          )}
                          <ProgressDonut percent={level.progressPercent} accent={level.accentColor} />
                        </LevelHeaderMedia>
                      </LevelHeader>

                      <LevelProgressSummary>
                        <LevelProgressText>
                          <strong>{level.completedLessons}/{level.totalLessons}</strong>
                          <span>{" уроков"}</span>
                        </LevelProgressText>
                        <LevelProgressPercent>{level.progressPercent}%</LevelProgressPercent>
                      </LevelProgressSummary>
                      <LevelProgressTrack>
                        <LevelProgressFill
                          style={{
                            width: `${level.progressPercent}%`,
                            backgroundColor: level.accentColor,
                          }}
                        />
                      </LevelProgressTrack>

                      {level.vocabularyWordsCount > 0 ? (
                        <LevelVocabularySummary>
                          <LevelVocabularyCopy>
                            <span aria-hidden>🧠</span>
                            <strong>
                              {level.learnedVocabularyWordsCount}/{level.vocabularyWordsCount}
                            </strong>
                            <span>слов</span>
                          </LevelVocabularyCopy>
                          <LevelVocabularyMeta>
                            {level.learnedVocabularyWordsCount > 0
                              ? "Уже открыто в уроках"
                              : ""}
                          </LevelVocabularyMeta>
                        </LevelVocabularySummary>
                      ) : null}

                      <LevelRoadmapPreview>
                        {previewItems.map((item, itemIndex) => (
                          <LevelRoadmapItem key={`${level.id}-${item}`}>
                            <LevelRoadmapDot
                              $active={itemIndex === 0 && Boolean(level.currentLessonTitle)}
                              style={{ borderColor: level.accentColor }}
                            />
                            <span>{item}</span>
                          </LevelRoadmapItem>
                        ))}
                      </LevelRoadmapPreview>

                      <LevelFooter>
                        <StatusBadge
                          style={{
                            backgroundColor: level.isUnlocked ? `${level.accentColor}18` : "#e5e7eb",
                            color: level.isUnlocked ? level.accentColor : "#64748b",
                          }}
                        >
                          {level.isUnlocked ? "Открыт" : "Закрыт"}
                        </StatusBadge>
                        {level.currentLessonTitle ? (
                          <CurrentLessonText>{"Сейчас:"} {level.currentLessonTitle}</CurrentLessonText>
                        ) : null}
                      </LevelFooter>

                      <SecondaryCardLink>
                        {"Открыть маршрут"}
                        <span aria-hidden>→</span>
                      </SecondaryCardLink>
                    </LevelCard>
                  </JourneyItem>
                );
              })}
            </JourneyList>
          </JourneySection>
        </ContentStack>
      </Shell>
    </Section>
  );
}

function getContinueLessonHref(
  isAuthenticated: boolean,
  levelSlug: string,
  unitSlug: string,
  lessonSlug: string,
) {
  const lessonHref = `/courses/${levelSlug}/${lessonSlug}?unit=${encodeURIComponent(unitSlug)}`;
  const roadmapHref = `/courses/${levelSlug}`;
  return isAuthenticated ? lessonHref : `/auth/login?next=${encodeURIComponent(roadmapHref)}`;
}

function ProgressDonut({ percent, accent }: { percent: number; accent: string }) {
  return (
    <DonutShell style={{ background: `conic-gradient(${accent} ${percent}%, rgba(207,216,255,0.42) 0)` }}>
      <DonutInner>{percent}%</DonutInner>
    </DonutShell>
  );
}

function getLevelPreviewItems(level: CourseOverviewLevel) {
  const fallbackHighlights = LEVEL_HIGHLIGHTS[level.number] ?? [];

  return [
    level.currentLessonTitle ?? fallbackHighlights[0] ?? "Первый урок",
    fallbackHighlights[1] ?? "Практика",
    fallbackHighlights[2] ?? "Мини-тест",
  ];
}

const drift = keyframes`
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-0.5rem);
  }
`;

const fadeInSoft = keyframes`
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

const revealMiniCard = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.92);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

const shimmerSweep = keyframes`
  from {
    transform: translateX(-120%);
  }

  to {
    transform: translateX(220%);
  }
`;

const PLACEMENT_REVEAL_LEVEL_COUNT = 4;
const PLACEMENT_REVEAL_SWEEP_INITIAL_DELAY_MS = 480;
const PLACEMENT_REVEAL_SWEEP_STEP_MS = 420;
const PLACEMENT_REVEAL_TARGET_STEP_MS = 320;
const PLACEMENT_REVEAL_PHASE_GAP_MS = 720;
const PLACEMENT_REVEAL_HOLD_MS = 900;

const buildPulse = keyframes`
  0%,
  100% {
    opacity: 0.45;
    transform: scaleX(0.98);
  }

  50% {
    opacity: 1;
    transform: scaleX(1);
  }
`;

const beaconPulse = keyframes`
  0%,
  100% {
    transform: scale(0.92);
    box-shadow: 0 0 0 0 rgba(96, 125, 246, 0.26);
  }

  60% {
    transform: scale(1);
    box-shadow: 0 0 0 10px rgba(96, 125, 246, 0);
  }
`;

const cascadeCardIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(28px) scale(0.96);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
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

const Section = styled.section`
  position: relative;
  overflow: hidden;
  padding: 1rem 0;

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

const Shell = styled.div`
  position: relative;
  z-index: 1;
`;

const WelcomeShell = styled.div`
  min-height: calc(100vh - 10rem);
  display: flex;
  align-items: center;
  justify-content: center;
`;

const WelcomeCard = styled.article`
  position: relative;
  overflow: hidden;
  width: min(100%, 68rem);
  border-radius: 2.2rem;
  border: 1px solid rgba(255, 255, 255, 0.84);
  background:
    radial-gradient(circle at top left, rgba(255, 227, 141, 0.44), transparent 24rem),
    radial-gradient(circle at bottom right, rgba(117, 169, 255, 0.26), transparent 22rem),
    linear-gradient(165deg, rgba(247, 250, 255, 0.98), rgba(232, 240, 255, 0.95));
  box-shadow: 0 30px 90px rgba(52, 82, 148, 0.16);
  animation: ${fadeInSoft} 0.5s ease;
`;

const WelcomeGlowTop = styled.div`
  position: absolute;
  top: -3rem;
  right: -4rem;
  width: 15rem;
  height: 15rem;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(255, 203, 68, 0.24), transparent 72%);
`;

const WelcomeGlowBottom = styled.div`
  position: absolute;
  bottom: -4rem;
  left: -3rem;
  width: 16rem;
  height: 16rem;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(94, 149, 255, 0.22), transparent 72%);
`;

const WelcomeLayout = styled.div`
  position: relative;
  display: grid;
  gap: 1.2rem;
  padding: 1.15rem;

  @media (min-width: 900px) {
    grid-template-columns: minmax(18rem, 24rem) minmax(0, 1fr);
    align-items: center;
    gap: 1.5rem;
    padding: 2rem;
  }
`;

const WelcomeArt = styled.div`
  position: relative;
  width: min(100%, 15rem);
  margin: 0 auto;

  @media (min-width: 900px) {
    width: min(100%, 18rem);
  }
`;

const WelcomeHalo = styled.div`
  position: absolute;
  inset: 50% auto auto 50%;
  width: 11rem;
  height: 11rem;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(255, 210, 94, 0.32), rgba(96, 145, 255, 0.08) 58%, transparent 72%);
  transform: translate(-50%, -50%);

  @media (min-width: 900px) {
    width: 13rem;
    height: 13rem;
  }
`;

const FloatingBadge = styled.div<{
  $top?: string;
  $right?: string;
  $bottom?: string;
  $left?: string;
  $delay: string;
}>`
  position: absolute;
  top: ${({ $top }) => $top ?? "auto"};
  right: ${({ $right }) => $right ?? "auto"};
  bottom: ${({ $bottom }) => $bottom ?? "auto"};
  left: ${({ $left }) => $left ?? "auto"};
  z-index: 1;
  padding: 0.52rem 0.78rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(220, 232, 255, 0.84);
  box-shadow: 0 12px 26px rgba(52, 82, 148, 0.1);
  color: #35518f;
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  animation: ${drift} 2.6s ease-in-out infinite;
  animation-delay: ${({ $delay }) => $delay};

  @media (min-width: 900px) {
    padding: 0.6rem 0.9rem;
    font-size: 0.74rem;
  }
`;

const WelcomeContent = styled.div`
  position: relative;
  z-index: 1;
  display: grid;
  gap: 0.82rem;
  align-content: center;

  @media (min-width: 900px) {
    gap: 1rem;
  }
`;

const WelcomePill = styled.span`
  display: inline-flex;
  justify-self: start;
  align-items: center;
  padding: 0.54rem 0.82rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(214, 228, 255, 0.9);
  color: #4b66a3;
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;

  @media (min-width: 900px) {
    padding: 0.6rem 0.9rem;
    font-size: 0.72rem;
  }
`;

const WelcomeTitle = styled.h1`
  color: #10224f;
  font-family: var(--font-heading), sans-serif;
  font-size: clamp(1.82rem, 5.9vw, 3.9rem);
  line-height: 0.95;
  font-weight: 900;
  letter-spacing: -0.04em;
  text-wrap: balance;

  @media (min-width: 900px) {
    font-size: clamp(2.1rem, 6.4vw, 3.9rem);
    line-height: 0.98;
  }
`;

const WelcomeText = styled.p`
  max-width: 38rem;
  color: rgba(32, 48, 92, 0.82);
  font-size: 0.94rem;
  line-height: 1.62;

  @media (min-width: 900px) {
    font-size: 1rem;
    line-height: 1.8;
  }
`;

const WelcomeHighlight = styled.p`
  justify-self: start;
  max-width: 32rem;
  padding: 0.72rem 0.9rem;
  border-radius: 1.1rem;
  border: 1px solid rgba(255, 205, 96, 0.52);
  background:
    linear-gradient(180deg, rgba(255, 248, 226, 0.98), rgba(255, 255, 255, 0.94)),
    radial-gradient(circle at left center, rgba(255, 210, 94, 0.22), transparent 58%);
  box-shadow: 0 12px 26px rgba(255, 196, 70, 0.12);
  color: #8f5b00;
  font-size: 0.88rem;
  font-weight: 800;
  line-height: 1.45;

  @media (min-width: 900px) {
    padding: 0.85rem 1rem;
    font-size: 0.96rem;
    line-height: 1.55;
  }
`;

const WelcomeActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.4rem;
`;

const WelcomePrimaryButton = styled.button`
  min-height: 3.3rem;
  padding: 0 1.65rem;
  border: 0;
  border-radius: 9999px;
  background: linear-gradient(135deg, #61db6d, #38ba59);
  box-shadow: 0 18px 36px rgba(56, 186, 89, 0.24);
  color: #ffffff;
  font-size: 0.98rem;
  font-weight: 900;
  cursor: pointer;
  transition: transform 0.18s ease;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  &:disabled {
    cursor: wait;
    opacity: 0.88;
  }
`;

const ContentStack = styled.div`
  display: grid;
  gap: 1.4rem;
`;

const PlacementRevealOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  background: rgba(238, 244, 255, 0.76);
  backdrop-filter: blur(10px);
`;

const PlacementRevealCard = styled.div`
  width: min(100%, 42rem);
  border-radius: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.88);
  background:
    radial-gradient(circle at top, rgba(255, 206, 92, 0.18), transparent 32%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(241, 246, 255, 0.96));
  box-shadow: 0 26px 64px rgba(52, 82, 148, 0.16);
  padding: 1.5rem;
  animation: ${fadeInSoft} 0.32s ease;
`;

const PlacementRevealEyebrow = styled.p`
  color: #5e75af;
  font-size: 0.74rem;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
`;

const PlacementRevealTitle = styled.h2`
  margin-top: 0.7rem;
  color: #10224f;
  font-family: var(--font-heading), sans-serif;
  font-size: clamp(1.85rem, 4vw, 2.7rem);
  line-height: 1.02;
  font-weight: 900;
`;

const PlacementRevealText = styled.p`
  margin-top: 0.8rem;
  color: rgba(32, 48, 92, 0.78);
  font-size: 0.98rem;
  line-height: 1.75;
`;

const PlacementRevealGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.9rem;
  margin-top: 1.35rem;
`;

const PlacementMiniCard = styled.div<{ $delay: number; $active: boolean }>`
  position: relative;
  overflow: hidden;
  min-height: 5.4rem;
  border-radius: 1.35rem;
  border: 1px solid ${({ $active }) => ($active ? "rgba(93, 126, 249, 0.72)" : "rgba(215, 225, 247, 0.92)")};
  background:
    ${({ $active }) =>
      $active
        ? "linear-gradient(180deg, rgba(232,239,255,0.98), rgba(247,250,255,0.98))"
        : "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(246,249,255,0.94))"};
  box-shadow: ${({ $active }) => ($active ? "0 18px 36px rgba(74, 109, 230, 0.18)" : "0 12px 24px rgba(52, 82, 148, 0.08)")};
  animation: ${revealMiniCard} 0.42s ease both;
  animation-delay: ${({ $delay }) => `${$delay}s`};
  transform: ${({ $active }) => ($active ? "scale(1.04)" : "scale(1)")};

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(100deg, transparent 12%, rgba(255, 255, 255, 0.78) 48%, transparent 84%);
    opacity: 0.75;
    animation: ${shimmerSweep} 1.9s ease-in-out infinite;
    animation-delay: ${({ $delay }) => `${$delay}s`};
    pointer-events: none;
  }
`;

const PlacementMiniCardDot = styled.div<{ $active: boolean }>`
  position: absolute;
  top: 0.8rem;
  left: 0.8rem;
  width: 0.72rem;
  height: 0.72rem;
  border-radius: 9999px;
  background: ${({ $active }) => ($active ? "#6c86ff" : "#dce6fb")};
  animation: ${({ $active }) => ($active ? css`${beaconPulse} 1.2s ease-in-out infinite` : "none")};
  z-index: 1;
`;

const PlacementMiniCardLineGroup = styled.div`
  position: absolute;
  left: 0.8rem;
  right: 0.8rem;
  bottom: 0.85rem;
  display: grid;
  gap: 0.42rem;
`;

const PlacementMiniCardLine = styled.div<{ $width: string; $delay: number }>`
  width: ${({ $width }) => $width};
  height: 0.5rem;
  border-radius: 9999px;
  background: linear-gradient(90deg, rgba(206, 219, 255, 0.9), rgba(232, 238, 255, 0.98));
  animation: ${buildPulse} 1.35s ease-in-out infinite;
  animation-delay: ${({ $delay }) => `${$delay}s`};
`;

const ErrorCard = styled.div`
  border-radius: 2rem;
  padding: 2.5rem 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(14px);
  color: var(--ink-soft);
  font-size: 0.95rem;
`;

const LoadingStack = styled.div`
  display: grid;
  gap: 1rem;
`;

const LoadingBase = styled.div`
  background: linear-gradient(90deg, rgba(218, 227, 248, 0.78), rgba(245, 248, 255, 0.96), rgba(218, 227, 248, 0.78));
  background-size: 220% 100%;
  animation: pulse 1.5s ease-in-out infinite;
`;

const LoadingLevelsGrid = styled.div`
  display: grid;
  gap: 1rem;

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (min-width: 1200px) {
    gap: 1.15rem;
  }
`;

const LoadingHeroCard = styled.article`
  position: relative;
  overflow: hidden;
  min-height: 22rem;
  border-radius: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.82);
  background:
    radial-gradient(circle at top right, rgba(125, 166, 255, 0.2), transparent 20rem),
    radial-gradient(circle at bottom left, rgba(121, 208, 255, 0.16), transparent 18rem),
    linear-gradient(
      155deg,
      rgba(246, 249, 255, 0.97),
      rgba(231, 239, 255, 0.95) 54%,
      rgba(214, 229, 255, 0.92)
    );
  box-shadow: 0 26px 64px rgba(55, 87, 150, 0.14);
`;

const LoadingHeroContent = styled.div`
  position: relative;
  display: grid;
  align-content: start;
  gap: 1rem;
  padding: 1.75rem 1.5rem;

  @media (min-width: 768px) {
    padding: 2.25rem 2rem;
  }
`;

const LoadingHeroGlowTop = styled.div`
  position: absolute;
  right: -4rem;
  top: -1rem;
  height: 14rem;
  width: 14rem;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(135, 158, 241, 0.24), transparent 68%);
`;

const LoadingHeroGlowBottom = styled.div`
  position: absolute;
  bottom: -3rem;
  left: -2rem;
  height: 13rem;
  width: 13rem;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(135, 158, 241, 0.24), transparent 70%);
`;

const LoadingSideCard = styled.article`
  display: grid;
  gap: 0.85rem;
  border-radius: 1.8rem;
  border: 1px solid rgba(255, 255, 255, 0.72);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(247, 250, 255, 0.9));
  box-shadow: 0 18px 44px rgba(61, 87, 148, 0.1);
  padding: 1.25rem;
  backdrop-filter: blur(14px);

  @media (min-width: 768px) {
    padding: 1.35rem 1.4rem;
  }
`;

const LoadingWarmCard = styled.article`
  position: relative;
  overflow: hidden;
  display: grid;
  gap: 0.85rem;
  border-radius: 1.8rem;
  border: 1px solid #ffe0ac;
  background: linear-gradient(145deg, #fff4df, #ffe6b4);
  box-shadow: 0 22px 50px rgba(248, 182, 60, 0.18);
  padding: 1.25rem;

  &::after {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 42%;
    background: linear-gradient(115deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.02));
    pointer-events: none;
  }

  &::before {
    content: "";
    position: absolute;
    right: -2.5rem;
    top: -1.5rem;
    height: 8.5rem;
    width: 8.5rem;
    border-radius: 9999px;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.24), transparent 72%);
    pointer-events: none;
  }

  @media (min-width: 768px) {
    padding: 1.35rem 1.4rem;
  }
`;

const LoadingLevelCard = styled.div`
  position: relative;
  overflow: hidden;
  display: flex;
  min-height: 25.5rem;
  flex-direction: column;
  border-radius: 1.8rem;
  border: 1px solid rgba(255, 255, 255, 0.7);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(248, 251, 255, 0.92));
  padding: 1.25rem;
  box-shadow: 0 22px 52px rgba(46, 59, 146, 0.1);

  @media (min-width: 1200px) {
    padding: 1.35rem;
  }
`;

const LoadingAccent = styled(LoadingBase)`
  position: absolute;
  inset: 0 0 auto 0;
  height: 0.375rem;
  background: linear-gradient(90deg, rgba(255, 190, 59, 0.72), rgba(111, 140, 255, 0.72), rgba(70, 186, 142, 0.68));
  background-size: 220% 100%;
`;

const LoadingLine = styled(LoadingBase)<{ $width: string; $height: string }>`
  width: ${({ $width }) => $width};
  max-width: 100%;
  height: ${({ $height }) => $height};
  border-radius: 9999px;
`;

const LoadingPill = styled(LoadingBase)<{ $width: string }>`
  width: ${({ $width }) => $width};
  max-width: 100%;
  height: 2.75rem;
  border-radius: 9999px;
`;

const LoadingButtonRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.4rem;
`;

const LoadingTextGroup = styled.div`
  display: grid;
  gap: 0.55rem;
`;

const LoadingLevelHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
`;

const LoadingLevelHeaderText = styled.div`
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0.7rem;
`;

const LoadingLevelHeaderMedia = styled.div`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.7rem;
`;

const LoadingSquare = styled(LoadingBase)`
  width: clamp(3.5rem, 12vw, 4.5rem);
  aspect-ratio: 1;
  border-radius: 1rem;
`;

const LoadingDonut = styled(LoadingBase)`
  width: 5rem;
  height: 5rem;
  border-radius: 9999px;
`;

const LoadingHighlights = styled.div`
  display: grid;
  gap: 0.65rem;
  margin-top: 1rem;
  border: 1px solid rgba(205, 216, 255, 0.86);
  border-radius: 1.2rem;
  background: rgba(255, 255, 255, 0.72);
  padding: 0.85rem 0.9rem;
`;

const LoadingHighlightRow = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.5rem;
`;

const LoadingDot = styled(LoadingBase)`
  width: 0.48rem;
  height: 0.48rem;
  border-radius: 9999px;
`;

const LoadingStatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 1rem;
  border: 1px solid var(--line);
  border-radius: 1.35rem;
  background: rgba(255, 255, 255, 0.75);
  padding: 0.75rem;
`;

const LoadingStat = styled.div`
  display: grid;
  gap: 0.45rem;
`;

const LoadingFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  margin-bottom: 1.25rem;
`;

const LoadingCardCta = styled(LoadingBase)`
  width: 9.5rem;
  max-width: 100%;
  height: 2.75rem;
  border-radius: 9999px;
  margin-top: auto;
`;

const TopSectionGrid = styled.div`
  display: grid;
  gap: 1rem;

  @media (min-width: 1024px) {
    grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.55fr);
  }
`;

const HeroCard = styled.article`
  position: relative;
  overflow: hidden;
  min-height: 31rem;
  border-radius: 2.25rem;
  border: 1px solid rgba(255, 255, 255, 0.82);
  background:
    radial-gradient(circle at top right, rgba(255, 203, 68, 0.3), transparent 17rem),
    radial-gradient(circle at bottom left, rgba(121, 208, 255, 0.22), transparent 18rem),
    linear-gradient(
      145deg,
      rgba(255, 252, 241, 0.98),
      rgba(232, 241, 255, 0.96) 48%,
      rgba(218, 230, 255, 0.94)
    );
  box-shadow: 0 34px 90px rgba(55, 87, 150, 0.17);
  color: #20305c;
`;

const HeroContent = styled.div`
  position: relative;
  display: grid;
  gap: 1.5rem;
  align-items: center;
  padding: 1.75rem 1.5rem;

  @media (min-width: 768px) {
    padding: 2.25rem 2rem;
  }

  @media (min-width: 980px) {
    grid-template-columns: minmax(0, 1fr) minmax(18rem, 24rem);
    min-height: 31rem;
  }
`;

const HeroCopy = styled.div`
  position: relative;
  z-index: 2;
  max-width: 42rem;
`;

const HeroGlowTop = styled.div`
  position: absolute;
  right: -4rem;
  top: -1rem;
  height: 14rem;
  width: 14rem;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(135, 158, 241, 0.24), transparent 68%);
`;

const HeroGlowBottom = styled.div`
  position: absolute;
  bottom: -3rem;
  left: -2rem;
  height: 13rem;
  width: 13rem;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(135, 158, 241, 0.24), transparent 70%);
`;

const HeroEyebrow = styled.p`
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.62);
  padding: 0.45rem 0.85rem;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.45);
  color: #7b5a18;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.2em;
  text-transform: uppercase;
`;

const HeroTitle = styled.h1`
  margin-top: 1rem;
  display: grid;
  justify-items: start;
  max-width: 11.2ch;
  font-family: var(--font-heading), sans-serif;
  font-size: clamp(2.8rem, 5.45vw, 4.35rem);
  font-weight: 900;
  line-height: 0.92;
  letter-spacing: -0.055em;

  @media (min-width: 1280px) {
    max-width: 11.7ch;
    font-size: 4.55rem;
  }
`;

const HeroTitleLastWord = styled.span`
  font-size: 0.82em;
  line-height: 0.98;
  letter-spacing: -0.045em;
`;

const HeroDescription = styled.p`
  margin-top: 1.1rem;
  max-width: 40rem;
  color: rgba(32, 48, 92, 0.82);
  font-size: 0.98rem;
  line-height: 1.85;
`;

const HeroButtonRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.85rem;
`;

const HeroSideColumn = styled.div`
  display: grid;
  gap: 1rem;
  align-content: start;
`;

const CardBase = styled.article`
  border-radius: 1.8rem;
  border: 1px solid rgba(255, 255, 255, 0.72);
  padding: 1.25rem;

  @media (min-width: 768px) {
    padding: 1.35rem 1.4rem;
  }
`;

const ContinueCard = styled(CardBase)`
  align-self: start;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(247, 250, 255, 0.9));
  box-shadow: 0 18px 44px rgba(61, 87, 148, 0.1);
  backdrop-filter: blur(14px);
`;

const TestCard = styled(CardBase)`
  position: relative;
  overflow: hidden;
  border-color: #ffe0ac;
  background: linear-gradient(145deg, #fff4df, #ffe6b4);
  box-shadow: 0 22px 50px rgba(248, 182, 60, 0.18);

  &::after {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 42%;
    background: linear-gradient(115deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.02));
    pointer-events: none;
  }

  &::before {
    content: "";
    position: absolute;
    right: -2.5rem;
    top: -1.5rem;
    height: 8.5rem;
    width: 8.5rem;
    border-radius: 9999px;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.24), transparent 72%);
    pointer-events: none;
  }
`;

const CardEyebrow = styled.p`
  color: var(--accent-dark);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.22em;
  text-transform: uppercase;
`;

const ContinueTitle = styled.h2`
  margin-top: 0.75rem;
  color: #0f172a;
  font-size: 1.55rem;
  font-weight: 900;
  line-height: 1.15;
`;

const ContinueSubtitle = styled.p`
  margin-top: 0.55rem;
  color: var(--ink-soft);
  font-size: 0.95rem;
`;

const ContinueProgressRow = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1.25rem;
`;

const ContinueMeta = styled.div`
  min-width: 0;
`;

const ContinueMetaTitle = styled.p`
  color: #0f172a;
  font-size: 0.95rem;
  font-weight: 700;
`;

const ContinueMetaText = styled.p`
  margin-top: 0.3rem;
  color: var(--ink-soft);
  font-size: 0.92rem;
  line-height: 1.6;
`;

const ContinueBodyText = styled.p`
  margin-top: 0.65rem;
  color: var(--ink-soft);
  font-size: 0.95rem;
  line-height: 1.65;
`;

const LearningStatsPanel = styled.div`
  display: grid;
  gap: 0.75rem;
  margin-top: 1.1rem;
  border-top: 1px solid rgba(194, 204, 244, 0.72);
  padding-top: 1rem;
`;

const LearningStatItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.72rem;
  border: 1px solid rgba(201, 211, 255, 0.68);
  border-radius: 1.15rem;
  background: rgba(255, 255, 255, 0.72);
  padding: 0.78rem;
`;

const LearningStatIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.35rem;
  height: 2.35rem;
  border-radius: 0.95rem;
  background: rgba(255, 245, 225, 0.9);
  font-size: 1.15rem;
`;

const LearningStatCopy = styled.div`
  min-width: 0;
`;

const LearningStatValue = styled.p`
  color: #172348;
  font-size: 1rem;
  font-weight: 950;
  line-height: 1.1;
`;

const LearningStatLabel = styled.p`
  margin-top: 0.2rem;
  overflow: hidden;
  color: var(--ink-soft);
  font-size: 0.75rem;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const LearningRankProgress = styled.div`
  border-radius: 1.15rem;
  background: rgba(246, 248, 255, 0.82);
  padding: 0.85rem;
`;

const LearningRankTop = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  color: var(--ink-soft);
  font-size: 0.75rem;
  font-weight: 800;

  strong {
    color: #172348;
  }
`;

const LearningRankTrack = styled.div`
  height: 0.5rem;
  margin-top: 0.55rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(221, 226, 255, 0.9);
`;

const LearningRankFill = styled.div`
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #ffb72f, #5a66ff);
`;

const CourseStatsGrid = styled.div`
  display: grid;
  gap: 1rem;

  @media (min-width: 768px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

const CourseStatCard = styled.div`
  display: flex;
  align-items: center;
  gap: 0.85rem;
  border: 1px solid rgba(215, 225, 247, 0.82);
  border-radius: 1.45rem;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 16px 36px rgba(52, 82, 148, 0.08);
  padding: 0.95rem 1rem;
  backdrop-filter: blur(12px);
`;

const CourseStatIcon = styled.span`
  display: grid;
  place-items: center;
  width: 2.8rem;
  height: 2.8rem;
  border-radius: 1rem;
  background: linear-gradient(145deg, #fff4df, #e8f0ff);
  font-size: 1.35rem;
`;

const CourseStatCopy = styled.div`
  min-width: 0;
`;

const CourseStatValue = styled.p`
  color: #10224f;
  font-size: 1.25rem;
  font-weight: 950;
  line-height: 1;
`;

const CourseStatLabel = styled.p`
  margin-top: 0.28rem;
  color: #64739d;
  font-size: 0.78rem;
  font-weight: 850;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const JourneySection = styled.section`
  position: relative;
  display: grid;
  gap: 1rem;
  border-radius: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.74);
  background:
    radial-gradient(circle at 8% 6%, rgba(255, 190, 59, 0.14), transparent 18rem),
    radial-gradient(circle at 100% 20%, rgba(90, 108, 255, 0.12), transparent 20rem),
    rgba(255, 255, 255, 0.46);
  box-shadow: 0 24px 70px rgba(46, 59, 146, 0.09);
  padding: 1rem;
  backdrop-filter: blur(12px);

  @media (min-width: 768px) {
    padding: 1.4rem;
  }
`;

const JourneyHeader = styled.div`
  max-width: 42rem;
  padding: 0.35rem 0.25rem 0.65rem;
`;

const SectionEyebrow = styled.p`
  color: #5a6cff;
  font-size: 0.72rem;
  font-weight: 950;
  letter-spacing: 0.2em;
  text-transform: uppercase;
`;

const SectionTitle = styled.h2`
  margin-top: 0.55rem;
  color: #10224f;
  font-family: var(--font-heading), sans-serif;
  font-size: clamp(2rem, 4vw, 3.2rem);
  font-weight: 950;
  letter-spacing: -0.045em;
  line-height: 1;
`;

const SectionText = styled.p`
  margin-top: 0.75rem;
  color: rgba(32, 48, 92, 0.76);
  font-size: 0.98rem;
  line-height: 1.72;
`;

const JourneyList = styled.div`
  display: grid;
  gap: 1rem;
`;

const JourneyItem = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: 4.2rem minmax(0, 1fr);
  gap: 0.8rem;
  align-items: start;

  @media (min-width: 900px) {
    grid-template-columns: 5.2rem minmax(0, 1fr);
    gap: 1.1rem;
  }
`;

const JourneyConnector = styled.div<{ $isLast: boolean }>`
  position: absolute;
  top: 4.2rem;
  bottom: -1.2rem;
  left: 2.08rem;
  width: 2px;
  border-radius: 999px;
  background: ${({ $isLast }) =>
    $isLast ? "transparent" : "linear-gradient(180deg, rgba(118, 139, 205, 0.58), rgba(118, 139, 205, 0.16))"};

  @media (min-width: 900px) {
    left: 2.58rem;
  }
`;

const JourneyNode = styled.div<{ $accent: string; $tone: string }>`
  position: sticky;
  top: 5rem;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 4.2rem;
  height: 4.2rem;
  border: 3px solid ${({ $accent }) => $accent};
  border-radius: 999px;
  background:
    radial-gradient(circle at 35% 20%, rgba(255, 255, 255, 0.92), transparent 42%),
    ${({ $tone }) => $tone};
  box-shadow:
    0 0 0 0.45rem rgba(255, 255, 255, 0.72),
    0 16px 34px rgba(52, 82, 148, 0.14);

  @media (min-width: 900px) {
    width: 5.2rem;
    height: 5.2rem;
  }
`;

const JourneyNodeIcon = styled.span`
  font-size: 1.65rem;
  line-height: 1;

  @media (min-width: 900px) {
    font-size: 2rem;
  }
`;

const JourneyNodeImageFrame = styled.span`
  position: relative;
  display: block;
  width: 2.55rem;
  height: 2.55rem;

  @media (min-width: 900px) {
    width: 3.15rem;
    height: 3.15rem;
  }
`;

const JourneyNodeNumber = styled.span`
  position: absolute;
  right: -0.2rem;
  bottom: -0.15rem;
  display: grid;
  place-items: center;
  width: 1.45rem;
  height: 1.45rem;
  border-radius: 999px;
  background: #ffffff;
  color: #10224f;
  box-shadow: 0 8px 18px rgba(52, 82, 148, 0.12);
  font-size: 0.75rem;
  font-weight: 950;
`;

const HeroTodayCard = styled.div`
  margin-top: 1.35rem;
  width: min(100%, 34rem);
  border: 1px solid rgba(255, 255, 255, 0.76);
  border-radius: 1.45rem;
  background: rgba(255, 255, 255, 0.68);
  box-shadow: 0 18px 44px rgba(77, 103, 168, 0.12);
  padding: 0.95rem;
  backdrop-filter: blur(12px);
`;

const HeroTodayHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
`;

const HeroTodayLabel = styled.p`
  color: #10224f;
  font-size: 0.82rem;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
`;

const HeroTodayProgress = styled.p`
  color: #5d6f9d;
  font-size: 0.86rem;
  font-weight: 900;
`;

const HeroTodayList = styled.ul`
  display: grid;
  gap: 0.55rem;
  margin: 0.8rem 0 0;
  padding: 0;
  list-style: none;
`;

const HeroTodayItem = styled.li`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.55rem;
  color: #31436f;
  font-size: 0.94rem;
  font-weight: 750;

  span:first-child {
    display: grid;
    place-items: center;
    width: 1.35rem;
    height: 1.35rem;
    border-radius: 999px;
    background: #dcfce7;
    color: #16a34a;
    font-size: 0.78rem;
    font-weight: 900;
  }
`;

const HeroVisual = styled.div`
  position: relative;
  min-height: 22rem;

  @media (max-width: 979px) {
    min-height: 17rem;
  }
`;

const HeroVisualArtFrame = styled.div`
  position: absolute;
  inset: -2.4rem -2.4rem 2.9rem -2.1rem;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 2rem;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0.08)),
    rgba(255, 255, 255, 0.26);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.72),
    0 28px 58px rgba(52, 82, 148, 0.16);
  transform: rotate(-1.4deg);

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 1;
    background:
      linear-gradient(120deg, rgba(255, 255, 255, 0.24), transparent 34%),
      radial-gradient(circle at 12% 8%, rgba(255, 255, 255, 0.34), transparent 22%);
    pointer-events: none;
  }

  @media (max-width: 979px) {
    inset: -1.35rem -1.1rem 2.35rem;
    border-radius: 1.55rem;
  }
`;

const HeroHangulBubble = styled.span<{
  $top?: string;
  $right?: string;
  $bottom?: string;
  $left?: string;
}>`
  position: absolute;
  top: ${({ $top }) => $top ?? "auto"};
  right: ${({ $right }) => $right ?? "auto"};
  bottom: ${({ $bottom }) => $bottom ?? "auto"};
  left: ${({ $left }) => $left ?? "auto"};
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: 1.05rem;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 14px 30px rgba(73, 104, 168, 0.13);
  color: #32477f;
  font-size: 1.35rem;
  font-weight: 900;
  animation: ${drift} 3s ease-in-out infinite;

  @media (max-width: 979px) {
    width: 2.6rem;
    height: 2.6rem;
    font-size: 1.15rem;
  }
`;

const HeroVisualPanel = styled.div`
  position: absolute;
  right: 1rem;
  bottom: -1rem;
  left: 1rem;
  z-index: 2;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 1.5rem;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 22px 46px rgba(62, 91, 158, 0.16);
  padding: 1rem;
  backdrop-filter: blur(14px);

  @media (max-width: 979px) {
    bottom: -0.35rem;
  }
`;

const HeroVisualPanelLabel = styled.p`
  color: #64739d;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
`;

const HeroVisualPanelTitle = styled.p`
  margin-top: 0.35rem;
  color: #10224f;
  font-size: 1.15rem;
  font-weight: 900;
`;

const HeroVisualProgressTrack = styled.div`
  overflow: hidden;
  height: 0.55rem;
  margin-top: 0.85rem;
  border-radius: 999px;
  background: rgba(207, 216, 255, 0.5);
`;

const HeroVisualProgressFill = styled.div`
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #ffbe3b, #5a6cff);
  transition: width 320ms ease;
`;

const HeroVisualPanelMeta = styled.p`
  margin-top: 0.55rem;
  color: #5d6f9d;
  font-size: 0.82rem;
  font-weight: 800;
`;

const LevelCard = styled(Link)<{
  $revealed: boolean;
  $delay: number;
  $accent: string;
  $tone: string;
  $isUnlocked: boolean;
}>`
  position: relative;
  overflow: hidden;
  display: flex;
  min-height: 23rem;
  flex-direction: column;
  border-radius: 1.65rem;
  border: 1px solid ${({ $isUnlocked, $accent }) => ($isUnlocked ? `${$accent}42` : "rgba(214, 223, 246, 0.92)")};
  background:
    radial-gradient(circle at 92% 0%, ${({ $accent }) => `${$accent}20`}, transparent 10rem),
    radial-gradient(circle at 5% 0%, ${({ $tone }) => $tone}, transparent 11rem),
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(248, 251, 255, 0.94));
  padding: 1.25rem;
  color: inherit;
  text-decoration: none;
  box-shadow: 0 22px 52px rgba(46, 59, 146, 0.1);
  cursor: pointer;
  animation: ${({ $revealed, $delay }) => {
    if ($revealed) {
      return css`${cascadeCardIn} 0.52s cubic-bezier(0.2, 0.72, 0.2, 1) ${$delay}s both`;
    }

    return "none";
  }};
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease,
    border-color 0.22s ease;

  &:hover {
    border-color: ${({ $accent }) => $accent};
    box-shadow:
      0 30px 66px rgba(46, 59, 146, 0.16),
      0 0 0 0.26rem ${({ $accent }) => `${$accent}16`};
    transform: translateY(-5px) scale(1.008);
  }

  &:focus-visible {
    outline: 3px solid rgba(111, 140, 255, 0.42);
    outline-offset: 4px;
  }

  @media (min-width: 1200px) {
    padding: 1.35rem;
  }
`;

const LevelHeader = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;

  @media (max-width: 560px) {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.8rem;
  }
`;

const LevelHeaderText = styled.div`
  min-width: 0;
  flex: 1;

  @media (max-width: 560px) {
    padding-right: 0;
  }
`;

const LevelHeaderMedia = styled.div`
  display: flex;
  align-items: center;
  gap: 0.85rem;
  flex: 0 0 auto;

  @media (max-width: 560px) {
    justify-content: space-between;
    width: 100%;
  }
`;

const LevelArtFrame = styled.div`
  position: relative;
  overflow: hidden;
  width: clamp(5.1rem, 9vw, 7rem);
  aspect-ratio: 1;
  border-radius: 1.2rem;
  border: 1px solid rgba(255, 255, 255, 0.84);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.68),
    0 12px 24px rgba(46, 59, 146, 0.09);

  @media (max-width: 560px) {
    width: 4rem;
    border-radius: 1rem;
  }
`;

const LevelArtGlow = styled.div`
  position: absolute;
  left: -0.9rem;
  bottom: -1.2rem;
  width: 3.9rem;
  height: 3.9rem;
  border-radius: 9999px;
  filter: blur(14px);
`;

const LevelEyebrow = styled.p`
  color: var(--ink-soft);
  font-size: 0.76rem;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
`;

const LevelPersonaLabel = styled.p`
  display: inline-flex;
  width: fit-content;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  padding: 0.34rem 0.62rem;
  color: #40527d;
  font-size: 0.7rem;
  font-weight: 950;
  letter-spacing: 0.13em;
  text-transform: uppercase;
`;

const LevelTitle = styled.h2`
  margin-top: 0.5rem;
  color: #0f172a;
  font-size: clamp(1.45rem, 3vw, 2rem);
  font-weight: 900;
  line-height: 1.08;
`;

const LevelEmojiArt = styled.div`
  display: grid;
  place-items: center;
  width: clamp(4.2rem, 13vw, 5.4rem);
  aspect-ratio: 1;
  border-radius: 1.2rem;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 12px 24px rgba(46, 59, 146, 0.09);
  font-size: 2rem;

  @media (max-width: 560px) {
    width: 4rem;
    border-radius: 1rem;
  }
`;

const LevelProgressSummary = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1.1rem;
`;

const LevelProgressText = styled.p`
  color: #40527d;
  font-size: 0.95rem;
  font-weight: 750;

  strong {
    color: #10224f;
    font-size: 1.25rem;
    font-weight: 950;
  }
`;

const LevelProgressPercent = styled.p`
  color: #10224f;
  font-size: 0.95rem;
  font-weight: 950;
`;

const LevelProgressTrack = styled.div`
  position: relative;
  z-index: 1;
  overflow: hidden;
  height: 0.62rem;
  margin-top: 0.65rem;
  border-radius: 999px;
  background: rgba(207, 216, 255, 0.44);
`;

const LevelProgressFill = styled.div`
  height: 100%;
  min-width: 0.35rem;
  border-radius: inherit;
  box-shadow: 0 0 18px currentColor;
  transition: width 280ms ease;
`;

const LevelVocabularySummary = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 0.85rem;
  margin-top: 0.85rem;
  border: 1px solid rgba(205, 216, 255, 0.72);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.58);
  padding: 0.7rem 0.85rem;
`;

const LevelVocabularyCopy = styled.p`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: #40527d;
  font-size: 0.9rem;
  font-weight: 800;

  strong {
    color: #10224f;
    font-size: 1rem;
    font-weight: 950;
  }
`;

const LevelVocabularyMeta = styled.p`
  color: var(--ink-soft);
  font-size: 0.78rem;
  font-weight: 700;
`;

const LevelRoadmapPreview = styled.div`
  position: relative;
  z-index: 1;
  display: grid;
  gap: 0.58rem;
  margin-top: 1.05rem;
  border: 1px solid rgba(205, 216, 255, 0.8);
  border-radius: 1.2rem;
  background: rgba(255, 255, 255, 0.62);
  padding: 0.8rem 0.9rem;
`;

const LevelRoadmapItem = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.52rem;
  color: #40527d;
  font-size: 0.88rem;
  font-weight: 750;
`;

const LevelRoadmapDot = styled.span<{ $active: boolean }>`
  width: 0.72rem;
  height: 0.72rem;
  border: 2px solid;
  border-radius: 999px;
  background: ${({ $active }) => ($active ? "currentColor" : "#ffffff")};
  box-shadow: ${({ $active }) => ($active ? "0 0 0 0.25rem rgba(90, 108, 255, 0.12)" : "none")};
`;

const LevelFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  margin-bottom: 1.25rem;
`;

const StatusBadge = styled.span`
  border-radius: 9999px;
  padding: 0.35rem 0.75rem;
  font-size: 0.76rem;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
`;

const CurrentLessonText = styled.span`
  color: var(--ink-soft);
  font-size: 0.86rem;
  font-weight: 600;
`;

const LinkBase = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  border-radius: 9999px;
  text-decoration: none;
  transition:
    transform 160ms ease,
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease,
    box-shadow 160ms ease;

  &:hover {
    transform: translateY(-2px);
  }
`;

const PrimaryHeroLink = styled(LinkBase)`
  background: linear-gradient(135deg, var(--accent), var(--accent-dark));
  color: white;
  padding: 0.85rem 1.25rem;
  box-shadow: 0 14px 30px rgba(255, 190, 59, 0.18);
  font-size: 0.92rem;
  font-weight: 900;
`;

const SecondaryHeroLink = styled(LinkBase)`
  border: 1px solid #d2dcf3;
  background: rgba(255, 255, 255, 0.78);
  color: #273763;
  padding: 0.85rem 1.25rem;
  font-size: 0.92rem;
  font-weight: 700;

  &:hover {
    background: rgba(255, 255, 255, 0.96);
  }
`;

const PrimaryCardLink = styled(LinkBase)`
  margin-top: 1.25rem;
  background: linear-gradient(135deg, var(--accent), var(--accent-dark));
  color: white;
  padding: 0.7rem 1rem;
  box-shadow: 0 12px 26px rgba(55, 90, 184, 0.16);
  font-size: 0.9rem;
  font-weight: 700;
`;

const WarmEyebrow = styled(CardEyebrow)`
  color: #b16a00;
`;

const WarmTitle = styled.h2`
  margin-top: 0.75rem;
  color: #442700;
  font-size: 1.55rem;
  font-weight: 900;
  line-height: 1.1;
`;

const WarmText = styled.p`
  margin-top: 0.65rem;
  color: #7b5609;
  font-size: 0.95rem;
  line-height: 1.6;
`;

const WarmLink = styled(LinkBase)`
  margin-top: 1.25rem;
  background: #f6a514;
  color: white;
  padding: 0.7rem 1rem;
  box-shadow: 0 12px 28px rgba(246, 165, 20, 0.28);
  font-size: 0.9rem;
  font-weight: 900;

  &:hover {
    background: #ee9b08;
  }
`;

const SecondaryCardLink = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  width: fit-content;
  margin-top: auto;
  border-radius: 9999px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.82);
  color: #24314f;
  padding: 0.7rem 1rem;
  font-size: 0.94rem;
  font-weight: 800;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    color 160ms ease,
    transform 160ms ease;

  ${LevelCard}:hover & {
    border-color: rgba(111, 140, 255, 0.82);
    background: #ffffff;
    color: #1c2f5b;
    transform: translateY(-1px);
  }
`;

const DonutShell = styled.div`
  display: grid;
  place-items: center;
  height: 5rem;
  width: 5rem;
  flex: 0 0 auto;
  border-radius: 9999px;

  @media (max-width: 560px) {
    height: 4.3rem;
    width: 4.3rem;
  }
`;

const DonutInner = styled.div`
  display: grid;
  place-items: center;
  height: 4.2rem;
  width: 4.2rem;
  border-radius: 9999px;
  background: white;
  color: #0f172a;
  font-size: 0.9rem;
  font-weight: 900;

  @media (max-width: 560px) {
    height: 3.55rem;
    width: 3.55rem;
    font-size: 0.82rem;
  }
`;
