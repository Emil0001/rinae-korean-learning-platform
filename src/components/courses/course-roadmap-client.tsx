"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import { getCourseLevelImage } from "@/lib/course-level-images";
import {
  COURSE_LESSON_KIND_LABELS,
  COURSE_LESSON_MODE_LABELS,
  COURSE_NODE_STATE_LABELS,
  type CourseNodeState,
  type CourseRoadmapLesson,
  type CourseRoadmapResponse,
} from "@/types/courses";

export function CourseRoadmapClient({ levelSlug }: { levelSlug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<CourseRoadmapResponse | null>(null);
  const [error, setError] = useState("");
  const [celebratedLessonId, setCelebratedLessonId] = useState<string | null>(null);
  const [advancedLessonId, setAdvancedLessonId] = useState<string | null>(null);
  const [measuredTrackProgress, setMeasuredTrackProgress] = useState<Record<string, number>>({});
  const [animatedTrackFill, setAnimatedTrackFill] = useState<Record<string, TrackFill>>({});
  const completedLessonSlug = searchParams.get("completedLesson");
  const completedUnitSlug = searchParams.get("completedUnit");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch(`/api/courses/${levelSlug}`, { cache: "no-store" });
        const payload = (await response.json()) as CourseRoadmapResponse & { error?: string };

        if (!active) {
          return;
        }

        if (!response.ok) {
          setError(payload.error ?? "Не удалось загрузить карту уровня.");
          return;
        }

        setData(payload);
      } catch {
        if (active) {
          setError("Не удалось загрузить карту уровня.");
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [levelSlug]);

  useEffect(() => {
    if (!data || !completedLessonSlug) {
      return;
    }

    const flattenedLessons = data.units.flatMap((unit) =>
      unit.lessons.map((lesson) => ({ unit, lesson })),
    );
    const completedLessonIndex = flattenedLessons.findIndex(
      ({ unit, lesson }) =>
        lesson.slug === completedLessonSlug &&
        (!completedUnitSlug || unit.slug === completedUnitSlug),
    );

    if (completedLessonIndex === -1) {
      router.replace(`/courses/${levelSlug}`, { scroll: false });
      return;
    }

    const completedEntry = flattenedLessons[completedLessonIndex];
    const nextLessonId = flattenedLessons[completedLessonIndex + 1]?.lesson.id ?? null;
    const completedUnit = completedEntry.unit;
    let nextLessonTimerId: number | undefined;

    const frameId = window.requestAnimationFrame(() => {
      setAdvancedLessonId(nextLessonId);

      if (completedUnit) {
        const completedAfter = completedUnit.completedLessons;
        const nextFill = measureTrackFill(completedUnit, completedAfter - 1, completedAfter);

        if (nextFill) {
          setAnimatedTrackFill({ [completedUnit.id]: nextFill });
        }
      }

      setCelebratedLessonId(completedEntry.lesson.id);

      const target = document.querySelector<HTMLElement>(
        `[data-lesson-id="${CSS.escape(completedEntry.lesson.id)}"]`,
      );
      target?.scrollIntoView({ behavior: "smooth", block: "center" });

      if (nextLessonId) {
        nextLessonTimerId = window.setTimeout(() => {
          const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

          if (reduceMotion) {
            return;
          }

          const isMobile = window.matchMedia("(max-width: 767px)").matches;
          const nextCard = isMobile
            ? document.querySelector<HTMLElement>(
                `[data-mobile-lesson-card-id="${CSS.escape(nextLessonId)}"]`,
              ) ??
              document.querySelector<HTMLElement>(
                `[data-lesson-id="${CSS.escape(nextLessonId)}"]`,
              )
            : document.querySelector<HTMLElement>(
                `[data-lesson-id="${CSS.escape(nextLessonId)}"]`,
              ) ??
              document.querySelector<HTMLElement>(
                `[data-mobile-lesson-card-id="${CSS.escape(nextLessonId)}"]`,
              );

          if (!nextCard) {
            return;
          }

          const nextCardRect = nextCard.getBoundingClientRect();
          const isComfortablyVisible =
            nextCardRect.top >= window.innerHeight * 0.16 &&
            nextCardRect.bottom <= window.innerHeight * 0.84;

          if (isComfortablyVisible) {
            return;
          }

          const viewportOffset = Math.max(72, window.innerHeight * 0.22);
          const nextCardTop = nextCard.getBoundingClientRect().top + window.scrollY;

          window.scrollTo({
            top: Math.max(0, nextCardTop - viewportOffset),
            behavior: "smooth",
          });
        }, 1750);
      }
    });

    const queryTimerId = window.setTimeout(() => {
      router.replace(`/courses/${levelSlug}`, { scroll: false });
    }, 4200);

    return () => {
      window.cancelAnimationFrame(frameId);
      if (nextLessonTimerId) {
        window.clearTimeout(nextLessonTimerId);
      }
      window.clearTimeout(queryTimerId);
    };
  }, [completedLessonSlug, completedUnitSlug, data, levelSlug, router]);

  useEffect(() => {
    if (!data) {
      return;
    }

    let frameId = 0;

    const measure = () => {
      frameId = window.requestAnimationFrame(() => {
        setMeasuredTrackProgress(
          Object.fromEntries(
            data.units.map((unit) => [
              unit.id,
              measureTrackProgress(unit, unit.completedLessons) ??
                getUnitTrackProgress(unit.completedLessons, unit.totalLessons),
            ]),
          ),
        );
      });
    };

    measure();
    window.addEventListener("resize", measure);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", measure);
    };
  }, [data]);

  if (error) {
    return (
      <PageSection>
        <RoadmapGlyphBackground />
        <Shell>
          <StateCard>{error}</StateCard>
        </Shell>
      </PageSection>
    );
  }

  if (!data) {
    return (
      <PageSection>
        <RoadmapGlyphBackground />
        <Shell>
          <Layout>
            <MainColumn>
              <SkeletonCard $minHeight="42rem" />
            </MainColumn>
            <SideColumn>
              <SkeletonCard $minHeight="24rem" />
            </SideColumn>
          </Layout>
        </Shell>
      </PageSection>
    );
  }

  const levelImage = getCourseLevelImage(data.level.number);
  const activeAnimatedTrackFill = completedLessonSlug ? animatedTrackFill : {};
  const activeAdvancedLessonId = completedLessonSlug ? advancedLessonId : null;
  const levelVocabularyProgressPercent =
    data.level.vocabularyWordsCount > 0
      ? Math.round((data.level.learnedVocabularyWordsCount / data.level.vocabularyWordsCount) * 100)
      : 0;

  return (
    <PageSection>
      <RoadmapGlyphBackground />
      <Shell>
        <Layout>
          <MainColumn>
            <HeroCard $accent={data.level.accentColor}>

              <HeroGlow $accent />
              <HeroLayout>
                <HeroBody>
                <HeroEyebrow>Уровень {data.level.number}</HeroEyebrow>
                <HeroTitle>{data.level.title}</HeroTitle>
                <HeroText>{data.level.description}</HeroText>
                <HeroActions>
                  <PrimaryLightLink href="/courses">Все уровни</PrimaryLightLink>
                </HeroActions>
                </HeroBody>

                {levelImage ? (
                  <HeroArtShell>
                    <HeroArtFrame>
                      <HeroArtGlow />
                      <Image
                        src={levelImage}
                        alt=""
                        aria-hidden
                        fill
                        sizes="(min-width: 1280px) 260px, (min-width: 768px) 220px, 180px"
                        style={{ objectFit: "contain", transform: "scale(2)" }}
                      />
                    </HeroArtFrame>
                  </HeroArtShell>
                ) : null}
              </HeroLayout>
            </HeroCard>

            {data.units.map((unit, unitIndex) => {
              const staticTrackProgress =
                measuredTrackProgress[unit.id] ??
                getUnitTrackProgress(unit.completedLessons, unit.totalLessons);
              const animatedFill = activeAnimatedTrackFill[unit.id];
              const lessonNumberOffset = data.units
                .slice(0, unitIndex)
                .reduce((total, previousUnit) => total + previousUnit.lessons.length, 0);

              return (
              <UnitCard key={unit.id}>
                <UnitHeader>
                  <UnitCopy>
                    <UnitEyebrow>Юнит {unit.order}</UnitEyebrow>
                    <UnitTitle>{unit.title}</UnitTitle>
                    <UnitDescription>{unit.description}</UnitDescription>
                  </UnitCopy>
                  <UnitMeta>
                    <UnitStatePill $locked={unit.isLocked}>
                      {unit.isLocked ? "Закрыт" : "Открыт"}
                    </UnitStatePill>
                    <UnitCount>
                      {unit.completedLessons}/{unit.totalLessons} уроков
                    </UnitCount>
                  </UnitMeta>
                </UnitHeader>

                <RoadmapTrack>
                  <TrackLine
                    data-track-line-unit-id={unit.id}
                    $accent={data.level.accentColor}
                    $progress={animatedFill?.endProgress ?? staticTrackProgress}
                    $startProgress={animatedFill?.startProgress ?? staticTrackProgress}
                    $celebrated={Boolean(animatedFill)}
                  />
                  <LessonsList>
                    {unit.lessons.map((lesson, index) => {
                      const isCelebrated = lesson.id === celebratedLessonId;
                      const lessonNumber = lessonNumberOffset + index + 1;

                      return (
                      <LessonRow key={lesson.id} data-lesson-id={lesson.id}>
                        <DesktopCardSlot
                          $align={index % 2 === 0 ? "end" : "start"}
                          $order={index % 2 === 0 ? 1 : 3}
                        >
                          <LessonCard
                            lesson={lesson}
                            lessonNumber={lessonNumber}
                            levelSlug={data.level.slug}
                            unitSlug={unit.slug}
                            accentColor={data.level.accentColor}
                            isAuthenticated={data.viewer.isAuthenticated}
                            isCelebrated={isCelebrated}
                          />
                        </DesktopCardSlot>

                        <NodeColumn>
                          <Connector
                            $side={index % 2 === 0 ? "left" : "right"}
                            $state={lesson.state}
                            $celebrated={isCelebrated}
                            $accent={data.level.accentColor}
                          />
                          <LessonNode
                            data-lesson-node-slug={lesson.slug}
                            $state={lesson.state}
                            $accent={data.level.accentColor}
                            $celebrated={isCelebrated}
                            $advanced={lesson.id === activeAdvancedLessonId}
                          >
                            <LessonNodeLabel>
                              {lesson.state === "completed" ? "✓" : lessonNumber}
                            </LessonNodeLabel>
                            {lesson.id === activeAdvancedLessonId ? (
                              <LessonNodeAdvanceRing aria-hidden="true" viewBox="0 0 72 72">
                                <circle cx="36" cy="36" r="32" />
                              </LessonNodeAdvanceRing>
                            ) : null}
                          </LessonNode>
                        </NodeColumn>

                        <MobileCardSlot data-mobile-lesson-card-id={lesson.id}>
                          <LessonCard
                            lesson={lesson}
                            lessonNumber={lessonNumber}
                            levelSlug={data.level.slug}
                            unitSlug={unit.slug}
                            accentColor={data.level.accentColor}
                            isAuthenticated={data.viewer.isAuthenticated}
                            isCelebrated={isCelebrated}
                          />
                        </MobileCardSlot>

                        <DesktopSpacer $order={index % 2 === 0 ? 3 : 1} />
                      </LessonRow>
                      );
                    })}
                  </LessonsList>
                </RoadmapTrack>
              </UnitCard>
              );
            })}
          </MainColumn>

          <SideColumn>
            <InfoCard>
              <InfoEyebrow>Прогресс</InfoEyebrow>
              <ProgressWrap>
                <ProgressRing
                  style={{
                    background: `conic-gradient(${data.level.accentColor} ${data.level.progressPercent}%, rgba(206,214,255,0.34) 0)`,
                  }}
                >
                  <ProgressInner>
                    <ProgressValue>{data.level.progressPercent}%</ProgressValue>
                  </ProgressInner>
                </ProgressRing>
              </ProgressWrap>
              <StatsGrid>
                <StatBox>
                  <StatLabel>Завершено</StatLabel>
                  <StatValue>
                    {data.level.completedLessons}/{data.level.totalLessons}
                  </StatValue>
                </StatBox>
                <StatBox>
                  <StatLabel>Юниты</StatLabel>
                  <StatValue>{data.units.length}</StatValue>
                </StatBox>
              </StatsGrid>
            </InfoCard>

            <InfoCard>
              <InfoEyebrow>Словарь</InfoEyebrow>
              <VocabularySidebarHero>
                <VocabularySidebarIcon aria-hidden>🧠</VocabularySidebarIcon>
                <div>
                  <VocabularySidebarValue>
                    {data.level.learnedVocabularyWordsCount}/{data.level.vocabularyWordsCount}
                  </VocabularySidebarValue>
                  <VocabularySidebarLabel>слов открыто в уровне</VocabularySidebarLabel>
                </div>
              </VocabularySidebarHero>
              <VocabularySidebarTrack>
                <VocabularySidebarFill
                  style={{
                    width: `${levelVocabularyProgressPercent}%`,
                    backgroundColor: data.level.accentColor,
                  }}
                />
              </VocabularySidebarTrack>
              <VocabularySidebarNote>
                Завершайте уроки со словарём — новые слова автоматически попадут в повторение.
              </VocabularySidebarNote>
            </InfoCard>

            {false ? (
            <InfoCard>
              <InfoEyebrow>Правила</InfoEyebrow>
              <RulesList>
                {[
                  "Внутри открытого юнита уроки можно начинать в любом порядке.",
                  "Следующий юнит открывается только после завершения всех уроков предыдущего.",
                  "Завершенные уроки остаются доступными, поэтому к любому пройденному шагу можно вернуться.",
                ].map((item) => (
                  <RuleItem key={item}>{item}</RuleItem>
                ))}
              </RulesList>
            </InfoCard>
            ) : null}
          </SideColumn>
        </Layout>
      </Shell>
    </PageSection>
  );
}

function RoadmapGlyphBackground() {
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

function LessonCard({
  lesson,
  lessonNumber,
  levelSlug,
  unitSlug,
  accentColor,
  isAuthenticated,
  isCelebrated,
}: {
  lesson: CourseRoadmapLesson;
  lessonNumber: number;
  levelSlug: string;
  unitSlug: string;
  accentColor: string;
  isAuthenticated: boolean;
  isCelebrated: boolean;
}) {
  const isLocked = lesson.state === "locked";
  const lessonQuery = new URLSearchParams({ unit: unitSlug });
  if (lesson.state === "completed") {
    lessonQuery.set("retry", "1");
  }
  const lessonHref = `/courses/${levelSlug}/${lesson.slug}?${lessonQuery.toString()}`;
  const roadmapHref = `/courses/${levelSlug}`;
  const actionHref = isAuthenticated ? lessonHref : `/auth/login?next=${encodeURIComponent(roadmapHref)}`;
  const progressPercent = lesson.totalSteps > 0 ? Math.round((lesson.completedSteps / lesson.totalSteps) * 100) : 0;

  return (
    <LessonCardRoot $state={lesson.state} $accent={accentColor} $celebrated={isCelebrated}>
      {isCelebrated ? (
        <>
          <LessonCardShine aria-hidden />
          <LessonCardConfetti aria-hidden>
            {Array.from({ length: 14 }).map((_, index) => (
              <LessonCardConfettiPiece key={index} $index={index} />
            ))}
          </LessonCardConfetti>
        </>
      ) : null}

      <LessonTop>
        <div>
          <LessonEyebrow>{getLessonEyebrow(lesson, lessonNumber)}</LessonEyebrow>
          <LessonTitle>
            <LessonTitleIcon aria-hidden>{getLessonKindIcon(lesson.kind)}</LessonTitleIcon>
            {lesson.title}
          </LessonTitle>
        </div>
        <NodeBadge state={lesson.state} accent={accentColor} />
      </LessonTop>

      {lesson.summary ? <LessonSummary>{lesson.summary}</LessonSummary> : null}

      <LessonMeta>
        <span>{lesson.completedSteps}/{lesson.totalSteps} шагов</span>
        <span>{lesson.estimatedMinutes} мин</span>
        <span>{getLessonFormatLabel(lesson)}</span>
      </LessonMeta>

      <LessonProgressTrack
        aria-hidden
        $state={lesson.state}
        $accent={accentColor}
        $celebrated={isCelebrated}
      >
        <LessonProgressValue
          $progress={progressPercent}
          $accent={accentColor}
          $celebrated={isCelebrated}
        />
      </LessonProgressTrack>

      {isLocked ? null : (
        <LessonLink href={actionHref} $state={lesson.state} $accent={accentColor}>
          {lesson.state === "completed"
            ? "Повторить"
            : lesson.state === "current"
              ? "Продолжить урок"
              : "Открыть урок"}
        </LessonLink>
      )}
    </LessonCardRoot>
  );
}

function getUnitTrackProgress(completedLessons: number, totalLessons: number) {
  if (totalLessons <= 1) {
    return completedLessons > 0 ? 100 : 0;
  }

  return Math.max(0, Math.min(100, Math.round((completedLessons / (totalLessons - 1)) * 100)));
}

type TrackFill = {
  startProgress: number;
  endProgress: number;
};

function measureTrackFill(
  unit: CourseRoadmapResponse["units"][number],
  startCompletedLessons: number,
  endCompletedLessons: number,
): TrackFill | null {
  const startProgress =
    measureTrackProgress(unit, startCompletedLessons) ??
    getUnitTrackProgress(startCompletedLessons, unit.totalLessons);
  const endProgress =
    measureTrackProgress(unit, endCompletedLessons) ??
    getUnitTrackProgress(endCompletedLessons, unit.totalLessons);

  return { startProgress, endProgress };
}

function measureTrackProgress(unit: CourseRoadmapResponse["units"][number], completedLessons: number) {
  if (completedLessons <= 0) {
    return 0;
  }

  if (completedLessons >= unit.totalLessons) {
    return 100;
  }

  const targetLesson = unit.lessons[completedLessons];
  const trackLine = document.querySelector<HTMLElement>(
    `[data-track-line-unit-id="${CSS.escape(unit.id)}"]`,
  );
  const targetNode = targetLesson
    ? document.querySelector<HTMLElement>(
        `[data-lesson-node-slug="${CSS.escape(targetLesson.slug)}"]`,
      )
    : null;

  if (!trackLine || !targetNode) {
    return null;
  }

  const trackRect = trackLine.getBoundingClientRect();
  const targetRect = targetNode.getBoundingClientRect();

  if (trackRect.height <= 0) {
    return null;
  }

  const targetCenter = targetRect.top + targetRect.height / 2;
  return Math.max(0, Math.min(100, ((targetCenter - trackRect.top) / trackRect.height) * 100));
}

function getLessonKindIcon(kind: CourseRoadmapLesson["kind"]) {
  if (kind === "MINI_QUIZ") {
    return "🧩";
  }

  if (kind === "FINAL_TEST") {
    return "🏆";
  }

  return "📖";
}

function getLessonEyebrow(lesson: CourseRoadmapLesson, lessonNumber: number) {
  if (lesson.kind === "LESSON") {
    return `Урок ${lessonNumber}`;
  }

  return COURSE_LESSON_KIND_LABELS[lesson.kind];
}

function getLessonFormatLabel(lesson: CourseRoadmapLesson) {
  if (lesson.kind === "LESSON") {
    return COURSE_LESSON_MODE_LABELS[lesson.mode];
  }

  return COURSE_LESSON_KIND_LABELS[lesson.kind];
}

function NodeBadge({ state, accent }: { state: CourseNodeState; accent: string }) {
  return (
    <StateBadge $state={state} $accent={accent}>
      {COURSE_NODE_STATE_LABELS[state]}
    </StateBadge>
  );
}

function getNodeColors(state: CourseNodeState, accent: string) {
  if (state === "completed") {
    return {
      border: accent,
      background: accent,
      color: "#ffffff",
    };
  }

  if (state === "current") {
    return {
      border: accent,
      background: `linear-gradient(135deg, ${accent}, #394bff)`,
      color: "#ffffff",
    };
  }

  if (state === "locked") {
    return {
      border: "#d7deeb",
      background: "#eef2f8",
      color: "#9aa6b8",
    };
  }

  return {
    border: "#bfcaf0",
    background: "#ffffff",
    color: "#334155",
  };
}

function getLessonCardStyles(state: CourseNodeState, accent: string) {
  if (state === "current") {
    return {
      border: accent,
      background: `radial-gradient(circle at 92% 10%, ${accent}24, transparent 8rem), linear-gradient(180deg, #ffffff, ${accent}14)`,
      shadow: `0 26px 58px ${accent}30, 0 12px 30px rgba(27, 42, 94, 0.12)`,
      color: "#111d36",
      opacity: 1,
    };
  }

  if (state === "completed") {
    return {
      border: `${accent}66`,
      background: `radial-gradient(circle at 92% 10%, ${accent}16, transparent 7rem), linear-gradient(180deg, ${accent}0d, rgba(255,255,255,0.98))`,
      shadow: `0 16px 34px ${accent}16, 0 8px 20px rgba(27, 42, 94, 0.05)`,
      color: "#14213d",
      opacity: 1,
    };
  }

  if (state === "locked") {
    return {
      border: "#d4dce9",
      background: "linear-gradient(180deg, #f1f4f9, #e9eef6)",
      shadow: "0 10px 22px rgba(27, 42, 94, 0.05)",
      color: "#748199",
      opacity: 0.64,
    };
  }

  return {
    border: "#d6def2",
    background: "linear-gradient(180deg, #ffffff, #f8faff)",
    shadow: "0 14px 28px rgba(27, 42, 94, 0.07)",
    color: "#14213d",
    opacity: 1,
  };
}

const confettiFall = keyframes`
  0% {
    opacity: 0;
    transform: translate3d(0, -0.75rem, 0) rotate(0deg);
  }

  18% {
    opacity: 1;
  }

  100% {
    opacity: 0;
    transform: translate3d(var(--confetti-x), 7rem, 0) rotate(220deg);
  }
`;

const cardShineSweep = keyframes`
  0% {
    transform: translateX(-120%) rotate(12deg);
  }

  100% {
    transform: translateX(140%) rotate(12deg);
  }
`;

const connectorCharge = keyframes`
  0% {
    transform: scaleX(0);
    opacity: 0;
  }

  18% {
    opacity: 1;
  }

  100% {
    transform: scaleX(1);
    opacity: 1;
  }
`;

const nodeRingBurst = keyframes`
  0% {
    opacity: 0.72;
    transform: scale(0.7);
  }

  70% {
    opacity: 0.18;
  }

  100% {
    opacity: 0;
    transform: scale(1.82);
  }
`;

const completedCardPulse = keyframes`
  0% {
    transform: translateY(0) scale(0.985);
  }

  22% {
    transform: translateY(-0.45rem) scale(1.035);
  }

  48% {
    transform: translateY(0.08rem) scale(0.998);
  }

  72% {
    transform: translateY(-0.18rem) scale(1.012);
  }

  100% {
    transform: translateY(0) scale(1);
  }
`;

const completedNodePulse = keyframes`
  0% {
    transform: scale(1);
  }

  28% {
    transform: scale(1.2);
  }

  56% {
    transform: scale(0.94);
  }

  100% {
    transform: scale(1);
  }
`;

const currentNodeGlow = keyframes`
  0%,
  100% {
    box-shadow:
      0 0 0 0.42rem var(--current-soft),
      0 0 0 0.82rem rgba(90, 108, 255, 0.08),
      0 18px 34px rgba(48, 62, 132, 0.2);
  }

  50% {
    box-shadow:
      0 0 0 0.62rem var(--current-soft),
      0 0 0 1.05rem rgba(90, 108, 255, 0.04),
      0 22px 42px rgba(48, 62, 132, 0.24);
  }
`;

const progressShimmer = keyframes`
  0% {
    transform: translateX(-110%);
  }

  100% {
    transform: translateX(115%);
  }
`;

const roadmapLineAdvance = keyframes`
  from {
    height: var(--track-start-progress);
  }

  to {
    height: var(--track-progress);
  }
`;

const nodeRingDraw = keyframes`
  from {
    stroke-dashoffset: 202;
  }

  to {
    stroke-dashoffset: 0;
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

const PageSection = styled.section`
  position: relative;
  overflow: hidden;
  padding: 2rem 0 3rem;

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
    padding: 3rem 0 4rem;
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

const Layout = styled.div`
  display: grid;
  gap: 1rem;

  @media (min-width: 1280px) {
    grid-template-columns: minmax(0, 1fr) 320px;
    align-items: start;
  }
`;

const MainColumn = styled.div`
  display: grid;
  gap: 1rem;
`;

const SideColumn = styled.aside`
  display: grid;
  gap: 1rem;
`;

const StateCard = styled.div`
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 2rem;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 22px 52px rgba(46, 59, 146, 0.08);
  padding: 2rem 1.5rem;
  color: var(--ink-soft);
  font-size: 0.95rem;
`;

const SkeletonCard = styled.div<{ $minHeight: string }>`
  min-height: ${(props) => props.$minHeight};
  border-radius: 2rem;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 22px 52px rgba(46, 59, 146, 0.08);
  animation: pulse 1.8s ease-in-out infinite;

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.8;
    }

    50% {
      opacity: 0.45;
    }
  }
`;

const HeroCard = styled.article<{ $accent: string }>`
  position: relative;
  overflow: hidden;
  border-radius: 2rem;
  padding: 1.8rem 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow: 0 24px 58px rgba(31, 54, 120, 0.16);
  background:
    linear-gradient(145deg, ${(props) => props.$accent}, rgba(167, 167, 167, 0.79)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0));

  @media (min-width: 768px) {
    padding: 2.1rem 2rem;
  }
`;

const HeroGlow = styled.div<{ $accent?: boolean }>`
  position: absolute;
  width: ${(props) => (props.$accent ? "15rem" : "18rem")};
  height: ${(props) => (props.$accent ? "15rem" : "18rem")};
  border-radius: 999px;
  background: ${(props) =>
    props.$accent
      ? "radial-gradient(circle, rgba(255,255,255,0.08), transparent 72%)"
      : "radial-gradient(circle, rgba(255,220,148,0.24), transparent 72%)"};
  left: ${(props) => (props.$accent ? "-3rem" : "auto")};
  right: ${(props) => (props.$accent ? "auto" : "-3rem")};
  top: ${(props) => (props.$accent ? "auto" : "-3rem")};
  bottom: ${(props) => (props.$accent ? "-4rem" : "auto")};
`;

const HeroLayout = styled.div`
  position: relative;
  display: grid;
  gap: 1.5rem;

  @media (min-width: 960px) {
    grid-template-columns: minmax(0, 1fr) minmax(220px, 280px);
    align-items: center;
  }
`;

const HeroBody = styled.div`
  position: relative;
  z-index: 1;
`;

const HeroArtShell = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;

  @media (min-width: 960px) {
    justify-content: flex-end;
  }
`;

const HeroArtFrame = styled.div`
  position: relative;
  overflow: hidden;
  width: min(100%, 12rem);
  aspect-ratio: 1;
  border-radius: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.28);
  background:
    linear-gradient(155deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.08)),
    rgba(255, 255, 255, 0.08);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.24),
    0 18px 42px rgba(18, 31, 72, 0.22);

  @media (min-width: 768px) {
    width: min(100%, 14rem);
  }

  @media (min-width: 1280px) {
    width: min(100%, 16rem);
  }
`;

const HeroArtGlow = styled.div`
  position: absolute;
  right: -1.8rem;
  bottom: -2rem;
  width: 8rem;
  height: 8rem;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.2), transparent 70%);
  filter: blur(20px);
`;

const HeroEyebrow = styled.p`
  margin: 0;
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.74rem;
  font-weight: 900;
  letter-spacing: 0.24em;
  text-transform: uppercase;
`;

const HeroTitle = styled.h1`
  margin: 0.8rem 0 0;
  color: #ffffff;
  font-family: var(--font-heading), sans-serif;
  font-size: clamp(2.35rem, 4vw, 3.35rem);
  line-height: 0.98;
  font-weight: 900;
  letter-spacing: -0.03em;
`;

const HeroText = styled.p`
  margin: 1rem 0 0;
  max-width: 42rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.82);
  font-size: 1.1rem;
  line-height: 1.8;
`;

const HeroActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.5rem;
`;

const ActionLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.85rem;
  border-radius: 999px;
  text-decoration: none;
  transition:
    transform 160ms ease,
    background 160ms ease,
    border-color 160ms ease;

  &:hover {
    transform: translateY(-1px);
  }
`;

const PrimaryLightLink = styled(ActionLink)`
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.96);
  color: #17213f;
  font-size: 0.94rem;
  font-weight: 900;
  box-shadow: 0 12px 24px rgba(255, 255, 255, 0.16);
`;

const UnitCard = styled.article`
  border-radius: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.72);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(248, 251, 255, 0.95)),
    rgba(255, 255, 255, 0.85);
  box-shadow: 0 18px 48px rgba(46, 59, 146, 0.08);
  padding: 1.4rem 1.25rem;

  @media (min-width: 768px) {
    padding: 1.7rem 1.5rem;
  }
`;

const UnitHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
`;

const UnitCopy = styled.div`
  min-width: 0;
`;

const UnitEyebrow = styled.p`
  margin: 0;
  color: var(--accent-dark);
  font-size: 0.74rem;
  font-weight: 900;
  letter-spacing: 0.2em;
  text-transform: uppercase;
`;

const UnitTitle = styled.h2`
  margin: 0.65rem 0 0;
  color: #14213d;
  font-size: clamp(1.55rem, 2.2vw, 2rem);
  line-height: 1.06;
  font-weight: 900;
`;

const UnitDescription = styled.p`
  margin: 0.8rem 0 0;
  max-width: 42rem;
  color: var(--ink-soft);
  font-size: 0.95rem;
  line-height: 1.75;
`;

const UnitMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
`;

const UnitStatePill = styled.span<{ $locked: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 0.45rem 0.82rem;
  background: ${(props) => (props.$locked ? "#e7ecf4" : "var(--accent-soft)")};
  color: ${(props) => (props.$locked ? "#66758b" : "var(--accent-dark)")};
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
`;

const UnitCount = styled.span`
  color: var(--ink-soft);
  font-size: 0.92rem;
  font-weight: 700;
`;

const RoadmapTrack = styled.div`
  position: relative;
  margin-top: 1.6rem;
  padding-left: 0.1rem;

  @media (min-width: 768px) {
    padding-left: 0.35rem;
  }
`;

const TrackLine = styled.div<{
  $accent: string;
  $progress: number;
  $startProgress: number;
  $celebrated: boolean;
}>`
  --track-progress: ${({ $progress }) => `${Math.max(0, Math.min(100, $progress))}%`};
  --track-start-progress: ${({ $startProgress }) => `${Math.max(0, Math.min(100, $startProgress))}%`};
  position: absolute;
  top: 1rem;
  bottom: 1rem;
  left: 2rem;
  width: 0.3rem;
  border-radius: 999px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(198, 209, 239, 0.54), rgba(198, 209, 239, 0.2));
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.72);

  &::before {
    content: "";
    position: absolute;
    inset: 0 0 auto;
    height: var(--track-progress);
    border-radius: inherit;
    background: linear-gradient(180deg, ${(props) => props.$accent}, ${(props) => props.$accent}cc);
    box-shadow: 0 0 18px ${(props) => props.$accent}55;
    animation: ${({ $celebrated }) =>
      $celebrated
        ? css`
            ${roadmapLineAdvance} 1.15s cubic-bezier(0.18, 0.84, 0.2, 1) 520ms both
          `
        : "none"};
  }

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background-image: linear-gradient(
      180deg,
      transparent 0,
      transparent 0.7rem,
      rgba(255, 255, 255, 0.58) 0.7rem,
      rgba(255, 255, 255, 0.58) 1rem
    );
    background-size: 100% 1.65rem;
    opacity: 0.45;
    pointer-events: none;
  }

  @media (min-width: 768px) {
    left: 50%;
    transform: translateX(-50%);
  }

  @media (prefers-reduced-motion: reduce) {
    &::before {
      animation: none;
    }
  }
`;

const LessonsList = styled.div`
  display: grid;
  gap: 0.95rem;
`;

const LessonRow = styled.div`
  position: relative;
  display: grid;
  gap: 0.85rem;

  @media (min-width: 768px) {
    grid-template-columns: 1fr 4.8rem 1fr;
    align-items: center;
  }
`;

const DesktopCardSlot = styled.div<{ $align: "start" | "end"; $order: number }>`
  display: none;

  @media (min-width: 768px) {
    display: block;
    order: ${(props) => props.$order};
    justify-self: ${(props) => props.$align};
  }
`;

const MobileCardSlot = styled.div`
  @media (min-width: 768px) {
    display: none;
  }
`;

const DesktopSpacer = styled.div<{ $order: number }>`
  display: none;

  @media (min-width: 768px) {
    display: block;
    order: ${(props) => props.$order};
  }
`;

const NodeColumn = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 4.8rem;

  @media (min-width: 768px) {
    order: 2;
  }
`;

const Connector = styled.div<{
  $side: "left" | "right";
  $state: CourseNodeState;
  $celebrated: boolean;
  $accent: string;
}>`
  display: none;

  @media (min-width: 768px) {
    display: block;
    position: absolute;
    top: 50%;
    height: 0;
    border-top: 2px ${(props) => (props.$state === "locked" || props.$state === "available" ? "dashed" : "solid")}
      ${(props) =>
        props.$state === "completed"
          ? `${props.$accent}b8`
          : props.$state === "current"
            ? props.$accent
            : "rgba(125, 145, 205, 0.5)"};
    opacity: ${(props) => (props.$state === "locked" ? 0.5 : 1)};
    ${(props) => (props.$side === "left" ? "left: 0; right: 50%;" : "left: 50%; right: 0;")}

    &::after {
      content: "";
      position: absolute;
      top: -2px;
      height: 2px;
      border-radius: 999px;
      background: linear-gradient(90deg, transparent, ${(props) => props.$accent}, transparent);
      box-shadow: 0 0 18px ${(props) => props.$accent}80;
      opacity: 0;
      ${(props) =>
        props.$side === "left"
          ? "left: 0; right: 0; transform-origin: left center;"
          : "left: 0; right: 0; transform-origin: right center;"}
      ${(props) =>
        props.$celebrated
          ? css`
              animation: ${connectorCharge} 720ms ease-out both;
            `
          : null}
    }
  }
`;

const LessonNode = styled.div<{
  $state: CourseNodeState;
  $accent: string;
  $celebrated: boolean;
  $advanced: boolean;
}>`
  --current-soft: ${({ $accent }) => `${$accent}24`};
  --node-accent: ${({ $accent }) => $accent};
  position: relative;
  width: ${({ $state }) => ($state === "current" ? "4.55rem" : "4.2rem")};
  height: ${({ $state }) => ($state === "current" ? "4.55rem" : "4.2rem")};
  border-radius: 999px;
  display: grid;
  place-items: center;
  border: 4px solid;
  font-size: 1.05rem;
  font-weight: 900;
  opacity: ${({ $state }) => ($state === "locked" ? 0.68 : 1)};
  box-shadow: ${({ $state, $accent }) =>
    $state === "current"
      ? `0 0 0 0.42rem ${$accent}24, 0 0 0 0.82rem rgba(90, 108, 255, 0.08), 0 18px 34px rgba(48, 62, 132, 0.2)`
      : $state === "completed"
        ? `0 14px 26px ${$accent}24`
        : "0 12px 24px rgba(48, 62, 132, 0.14)"};
  animation: ${({ $state }) =>
    $state === "current" ? css`${currentNodeGlow} 2.4s ease-in-out infinite` : "none"};
  transition:
    border-color 260ms ease,
    box-shadow 260ms ease,
    color 260ms ease;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

  ${(props) => {
    const colors = getNodeColors(props.$state, props.$accent);
    return `
      border-color: ${colors.border};
      background: ${colors.background};
      color: ${colors.color};
    `;
  }}

  ${({ $accent, $advanced, $state }) =>
    $advanced && $state !== "completed"
      ? css`
          box-shadow:
            0 0 0 0.28rem ${$accent}1f,
            0 0 0 0.62rem ${$accent}10,
            0 14px 28px rgba(48, 62, 132, 0.16);
          color: #1c2f5b;
        `
      : null}

  ${({ $accent, $celebrated }) =>
    $celebrated
      ? css`
          box-shadow:
            0 0 0 0.45rem ${$accent}26,
            0 0 0 0.9rem ${$accent}12,
            0 18px 34px rgba(48, 62, 132, 0.2);
          animation: ${completedNodePulse} 880ms cubic-bezier(0.2, 0.8, 0.2, 1) 260ms both;

          &::before,
          &::after {
            content: "";
            position: absolute;
            inset: -0.42rem;
            border: 2px solid ${$accent};
            border-radius: inherit;
            pointer-events: none;
            animation: ${nodeRingBurst} 980ms ease-out both;
          }

          &::after {
            animation-delay: 190ms;
          }
        `
      : null}
`;

const LessonNodeLabel = styled.span`
  position: relative;
  z-index: 1;
`;

const LessonNodeAdvanceRing = styled.svg`
  position: absolute;
  inset: -0.31rem;
  width: calc(100% + 0.62rem);
  height: calc(100% + 0.62rem);
  overflow: visible;
  pointer-events: none;
  transform: rotate(-90deg);

  circle {
    fill: none;
    stroke: var(--node-accent);
    stroke-width: 4;
    stroke-linecap: round;
    stroke-dasharray: 202;
    stroke-dashoffset: 202;
    animation: ${nodeRingDraw} 920ms cubic-bezier(0.18, 0.84, 0.2, 1) 660ms both;
  }

  @media (prefers-reduced-motion: reduce) {
    circle {
      animation: none;
      stroke-dashoffset: 0;
    }
  }
`;

const LessonCardRoot = styled.div<{ $state: CourseNodeState; $accent: string; $celebrated: boolean }>`
  position: relative;
  overflow: hidden;
  width: 100%;
  max-width: ${({ $state }) => ($state === "current" ? "23.4rem" : "22rem")};
  border-radius: ${({ $state }) => ($state === "current" ? "1.45rem" : "1.25rem")};
  padding: ${({ $state }) => ($state === "current" ? "1.08rem" : "0.95rem")};
  transform: ${({ $state }) => ($state === "current" ? "scale(1.025)" : "none")};
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    opacity 180ms ease;
  ${(props) => {
    const styles = getLessonCardStyles(props.$state, props.$accent);
    return `
      border: 1px solid ${styles.border};
      background: ${styles.background};
      background-color: #ffffff;
      box-shadow: ${styles.shadow};
      color: ${styles.color};
      opacity: ${styles.opacity};
    `;
  }}

  ${({ $state, $accent }) =>
    $state === "current"
      ? css`
          &::before {
            content: "";
            position: absolute;
            inset: 0.45rem;
            border: 1px solid ${$accent}38;
            border-radius: 1.1rem;
            pointer-events: none;
          }
        `
      : null}

  ${({ $state, $accent }) =>
    $state === "completed"
      ? css`
          &::after {
            content: "✦";
            position: absolute;
            right: 0.95rem;
            bottom: 0.7rem;
            color: ${$accent}52;
            font-size: 1.5rem;
            line-height: 1;
            pointer-events: none;
          }
        `
      : null}

  ${({ $accent, $celebrated }) =>
    $celebrated
      ? css`
          border-color: ${$accent};
          background:
            radial-gradient(circle at 88% 12%, ${$accent}24, transparent 7.5rem),
            radial-gradient(circle at 10% 0%, rgba(255, 190, 59, 0.2), transparent 7rem),
            linear-gradient(180deg, ${$accent}12, rgba(255, 255, 255, 0.98));
          background-color: #ffffff;
          box-shadow:
            0 0 0 0.28rem ${$accent}1f,
            0 30px 70px rgba(46, 59, 146, 0.22);
          animation: ${completedCardPulse} 940ms cubic-bezier(0.2, 0.82, 0.2, 1) 160ms both;
        `
      : null}
`;

const LessonCardShine = styled.span`
  position: absolute;
  inset: -2rem auto -2rem -35%;
  z-index: 0;
  width: 36%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.82),
    rgba(255, 255, 255, 0.18),
    transparent
  );
  filter: blur(1px);
  pointer-events: none;
  animation: ${cardShineSweep} 1.15s ease-out 180ms both;
`;

const LessonCardConfetti = styled.span`
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
`;

const LessonCardConfettiPiece = styled.span<{ $index: number }>`
  --confetti-x: ${({ $index }) => `${(($index % 7) - 3) * 1.15}rem`};
  position: absolute;
  top: ${({ $index }) => `${0.2 + ($index % 4) * 0.24}rem`};
  left: ${({ $index }) => `${7 + (($index * 19) % 84)}%`};
  width: ${({ $index }) => ($index % 3 === 0 ? "0.32rem" : "0.24rem")};
  height: ${({ $index }) => ($index % 3 === 0 ? "0.84rem" : "0.62rem")};
  border-radius: 0.16rem;
  background: ${({ $index }) =>
    ["#5a6cff", "#5fd3ca", "#ffbe3b", "#ff7a8a", "#42b883"][$index % 5]};
  animation: ${confettiFall} ${({ $index }) => `${1.05 + ($index % 5) * 0.1}s`} ease-out
    ${({ $index }) => `${($index % 6) * 0.07}s`} both;
`;

const LessonTop = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.7rem;
`;

const LessonEyebrow = styled.p`
  margin: 0;
  color: var(--ink-soft);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.17em;
  text-transform: uppercase;
`;

const LessonTitle = styled.h3`
  margin: 0.42rem 0 0;
  font-size: 1.08rem;
  line-height: 1.22;
  font-weight: 900;
  color: inherit;
`;

const LessonTitleIcon = styled.span`
  display: inline-flex;
  margin-right: 0.42rem;
  filter: drop-shadow(0 0.35rem 0.65rem rgba(46, 59, 146, 0.12));
`;

const LessonSummary = styled.p`
  position: relative;
  z-index: 1;
  display: -webkit-box;
  margin: 0.7rem 0 0;
  overflow: hidden;
  color: var(--ink-soft);
  font-size: 0.88rem;
  line-height: 1.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
`;

const LessonMeta = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem 0.7rem;
  margin-top: 0.8rem;
  color: var(--ink-soft);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
`;

const LessonProgressTrack = styled.div<{ $state: CourseNodeState; $accent: string; $celebrated: boolean }>`
  position: relative;
  z-index: 1;
  margin-top: 0.75rem;
  height: ${(props) => (props.$state === "current" ? "0.48rem" : "0.38rem")};
  overflow: hidden;
  border-radius: 999px;
  background: ${(props) =>
    props.$state === "locked"
      ? "#d5dde9"
      : props.$state === "completed"
        ? `${props.$accent}22`
        : `${props.$accent}24`};

  ${({ $accent, $celebrated }) =>
    $celebrated
      ? css`
          box-shadow: 0 0 0 0.18rem ${$accent}16;

          &::after {
            content: "";
            position: absolute;
            inset: 0;
            width: 42%;
            border-radius: inherit;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.86), transparent);
            animation: ${progressShimmer} 760ms ease-out 420ms both;
          }
        `
      : null}
`;

const LessonProgressValue = styled.div<{ $progress: number; $accent: string; $celebrated: boolean }>`
  width: ${(props) => Math.max(0, Math.min(100, props.$progress))}%;
  height: 100%;
  border-radius: inherit;
  background: ${(props) => props.$accent};
  transition: width 180ms ease;

  ${({ $celebrated }) =>
    $celebrated
      ? css`
          transition-duration: 520ms;
        `
      : null}
`;

const LessonLink = styled(Link)<{ $state: CourseNodeState; $accent: string }>`
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 0.85rem;
  min-height: ${(props) => (props.$state === "current" ? "2.55rem" : "2.35rem")};
  padding: ${(props) => (props.$state === "current" ? "0.58rem 1.05rem" : "0.5rem 0.9rem")};
  border-radius: 999px;
  border: 1px solid
    ${(props) =>
      props.$state === "completed"
        ? props.$accent
        : props.$state === "current"
          ? props.$accent
          : "rgba(150, 166, 218, 0.95)"};
  background: ${(props) =>
    props.$state === "current"
      ? `linear-gradient(135deg, ${props.$accent}, #394bff)`
      : props.$state === "completed"
        ? `linear-gradient(135deg, ${props.$accent}, #394bff)`
        : "#ffffff"};
  color: ${(props) =>
    props.$state === "current" || props.$state === "completed" ? "#ffffff" : "#1c2f5b"};
  box-shadow: ${(props) =>
    props.$state === "current" || props.$state === "completed"
      ? `0 14px 30px ${props.$accent}2e`
      : "none"};
  font-size: 0.9rem;
  font-weight: 900;
  text-decoration: none;
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    background 160ms ease;

  &:hover {
    transform: translateY(-1px);
    border-color: ${(props) =>
      props.$state === "completed"
        ? props.$accent
        : props.$state === "current"
          ? props.$accent
          : "rgba(120, 138, 214, 0.95)"};
    background: ${(props) =>
      props.$state === "current" || props.$state === "completed"
        ? `linear-gradient(135deg, ${props.$accent}, #2638ee)`
        : "#ffffff"};
  }
`;

const StateBadge = styled.span<{ $state: CourseNodeState; $accent: string }>`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 0.38rem 0.64rem;
  font-size: 0.58rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;

  ${(props) => {
    const colors = getNodeColors(props.$state, props.$accent);
    const completedStyles =
      props.$state === "completed"
        ? `border-color: ${props.$accent}55; background: ${props.$accent}18; color: ${props.$accent};`
        : "";
    return `
      border: 1px solid ${colors.border};
      background: ${colors.background};
      color: ${colors.color};
      ${completedStyles}
    `;
  }}
`;

const InfoCard = styled.article`
  border-radius: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.72);
  background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,251,255,0.96));
  box-shadow: 0 18px 48px rgba(46, 59, 146, 0.07);
  padding: 1.35rem 1.2rem;
`;

const InfoEyebrow = styled.p`
  margin: 0;
  color: var(--accent-dark);
  font-size: 0.74rem;
  font-weight: 900;
  letter-spacing: 0.2em;
  text-transform: uppercase;
`;

const ProgressWrap = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 1.25rem;
`;

const ProgressRing = styled.div`
  width: 10rem;
  height: 10rem;
  border-radius: 999px;
  display: grid;
  place-items: center;
`;

const ProgressInner = styled.div`
  width: 7rem;
  height: 7rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.97);
  display: grid;
  place-items: center;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95);
`;

const ProgressValue = styled.span`
  color: #14213d;
  font-size: 2rem;
  font-weight: 900;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
  margin-top: 1.3rem;
`;

const StatBox = styled.div`
  border-radius: 1.25rem;
  border: 1px solid rgba(219, 227, 242, 0.95);
  background: rgba(255, 255, 255, 0.88);
  padding: 0.95rem 0.9rem;
`;

const StatLabel = styled.p`
  margin: 0;
  color: var(--ink-soft);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.15em;
  text-transform: uppercase;
`;

const StatValue = styled.p`
  margin: 0.55rem 0 0;
  color: #14213d;
  font-size: 1.55rem;
  font-weight: 900;
`;

const VocabularySidebarHero = styled.div`
  display: flex;
  align-items: center;
  gap: 0.85rem;
  margin-top: 1rem;
  border: 1px solid rgba(205, 216, 255, 0.78);
  border-radius: 1.25rem;
  background:
    radial-gradient(circle at 12% 14%, rgba(45, 212, 191, 0.16), transparent 38%),
    rgba(255, 255, 255, 0.82);
  padding: 0.95rem;
`;

const VocabularySidebarIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 1rem;
  background: rgba(238, 242, 255, 0.96);
  font-size: 1.2rem;
`;

const VocabularySidebarValue = styled.p`
  color: #14213d;
  font-size: 1.45rem;
  font-weight: 950;
  line-height: 1.05;
`;

const VocabularySidebarLabel = styled.p`
  margin-top: 0.24rem;
  color: var(--ink-soft);
  font-size: 0.82rem;
  font-weight: 750;
  line-height: 1.35;
`;

const VocabularySidebarTrack = styled.div`
  overflow: hidden;
  height: 0.55rem;
  margin-top: 0.95rem;
  border-radius: 999px;
  background: rgba(221, 226, 255, 0.86);
`;

const VocabularySidebarFill = styled.div`
  height: 100%;
  min-width: 0.35rem;
  border-radius: inherit;
  box-shadow: 0 0 18px currentColor;
  transition: width 260ms ease;
`;

const VocabularySidebarNote = styled.p`
  margin-top: 0.85rem;
  color: var(--ink-soft);
  font-size: 0.88rem;
  line-height: 1.6;
`;

const RulesList = styled.div`
  display: grid;
  gap: 0.75rem;
  margin-top: 1rem;
`;

const RuleItem = styled.div`
  border-radius: 1.2rem;
  border: 1px solid rgba(219, 227, 242, 0.95);
  background: rgba(255, 255, 255, 0.86);
  padding: 0.9rem 0.95rem;
  color: var(--ink-soft);
  font-size: 0.93rem;
  line-height: 1.65;
`;
