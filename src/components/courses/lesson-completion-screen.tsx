"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styled, { keyframes } from "styled-components";
import {
  CompletionFireworks,
  type ConfettiBurst,
  type ConfettiOrigin,
  createConfettiPieces,
  type FireworkBurst,
  type FireworkOrigin,
  createFireworkRing,
  createFireworkSparks,
  QuizConfetti,
} from "@/components/courses/celebration-effects";
import { PrimaryLink, SecondaryLink } from "@/components/courses/lesson-action-controls";
import { getCourseLessonHref, getLessonCompletionHref } from "@/lib/course-lesson-routes";
import type { CourseLessonResponse } from "@/types/courses";

function createCompletionConfettiBursts() {
  if (typeof window === "undefined") {
    return [];
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const origins: ConfettiOrigin[] = [
    { x: width * 0.16, y: height * 0.18 },
    { x: width * 0.5, y: height * 0.12 },
    { x: width * 0.84, y: height * 0.18 },
    { x: width * 0.24, y: height * 0.48 },
    { x: width * 0.76, y: height * 0.48 },
    { x: width * 0.5, y: height * 0.38 },
  ];
  const burstId = Date.now();

  return origins.map((origin, index) => ({
    id: burstId + index,
    pieces: createConfettiPieces(origin, index === origins.length - 1 ? 42 : 34),
  }));
}

function createCompletionFireworkBursts() {
  if (typeof window === "undefined") {
    return [];
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const origins: FireworkOrigin[] = [
    { x: width * 0.18, y: height * 0.2, delay: 80 },
    { x: width * 0.82, y: height * 0.2, delay: 180 },
    { x: width * 0.5, y: height * 0.16, delay: 280 },
    { x: width * 0.28, y: height * 0.48, delay: 520 },
    { x: width * 0.72, y: height * 0.48, delay: 650 },
    { x: width * 0.5, y: height * 0.34, delay: 780 },
  ];
  const burstId = Date.now() + 5000;

  return origins.map((origin, index) => ({
    id: burstId + index,
    ring: createFireworkRing(origin, index),
    sparks: createFireworkSparks(origin, index === origins.length - 1 ? 34 : 26),
  }));
}

export function LessonCompletionScreen({
  lesson,
  levelSlug,
  unitSlug,
  lessonXp,
  vocabularyWordsCount,
  showVocabularyResult,
  quizAccuracy,
}: {
  lesson: CourseLessonResponse["lesson"];
  levelSlug: string;
  unitSlug: string;
  lessonXp: number;
  vocabularyWordsCount: number;
  showVocabularyResult: boolean;
  quizAccuracy: number | null;
}) {
  const roadmapHref = getLessonCompletionHref(lesson, levelSlug, unitSlug);
  const [confettiBursts, setConfettiBursts] = useState<ConfettiBurst[]>(
    createCompletionConfettiBursts,
  );
  const [fireworkBursts, setFireworkBursts] = useState<FireworkBurst[]>(
    createCompletionFireworkBursts,
  );

  useEffect(() => {
    if (confettiBursts.length === 0 && fireworkBursts.length === 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setConfettiBursts([]);
      setFireworkBursts([]);
    }, 3200);
    return () => window.clearTimeout(timeout);
  }, [confettiBursts.length, fireworkBursts.length]);

  return (
    <>
      {(confettiBursts.length > 0 || fireworkBursts.length > 0) && typeof document !== "undefined"
        ? createPortal(
            <>
              {confettiBursts.length > 0 ? (
                <QuizConfetti aria-hidden="true">
                  {confettiBursts.flatMap((burst) =>
                    burst.pieces.map((style, index) => (
                      <span key={`${burst.id}-${index}`} style={style} />
                    )),
                  )}
                </QuizConfetti>
              ) : null}
              {fireworkBursts.length > 0 ? (
                <CompletionFireworks aria-hidden="true">
                  {fireworkBursts.map((burst) => (
                    <span key={`ring-${burst.id}`} className="firework-ring" style={burst.ring} />
                  ))}
                  {fireworkBursts.flatMap((burst) =>
                    burst.sparks.map((style, index) => (
                      <span key={`spark-${burst.id}-${index}`} className="firework-spark" style={style} />
                    )),
                  )}
                </CompletionFireworks>
              ) : null}
            </>,
            document.body,
          )
        : null}
      <CompletionCard>
        <CompletionDecorations aria-hidden>
          <span>한</span>
          <span>별</span>
          <span>✓</span>
          <span>가</span>
        </CompletionDecorations>
        <CompletionHeroMark aria-hidden>
          <CompletionHeroGlow />
          <CompletionBadge>🏆</CompletionBadge>
          <CompletionOrbitDot $position="left">★</CompletionOrbitDot>
          <CompletionOrbitDot $position="right">✦</CompletionOrbitDot>
        </CompletionHeroMark>
        <CompletionEyebrow>✨ Урок завершён</CompletionEyebrow>
        <CompletionTitle>{lesson.title}</CompletionTitle>
        <CompletionText>
          {showVocabularyResult
            ? "Отличная работа! Прогресс сохранён, а новые слова добавлены в повторение."
            : "Отличная работа! Все задания выполнены, прогресс сохранён, а следующий урок уже готов."}
        </CompletionText>

        <CompletionProgressCelebration>
          <div>
            <strong>100%</strong>
            <span>Все шаги урока пройдены</span>
          </div>
          <CompletionProgressTrack aria-hidden>
            <span />
          </CompletionProgressTrack>
        </CompletionProgressCelebration>

        <CompletionStats $columns={showVocabularyResult ? 3 : 2}>
          <CompletionStat $tone="xp">
            <CompletionStatIcon aria-hidden>🔥</CompletionStatIcon>
            <CompletionStatValue>+{lessonXp}</CompletionStatValue>
            <CompletionStatLabel>XP за урок</CompletionStatLabel>
          </CompletionStat>
          {showVocabularyResult ? (
            <CompletionStat $tone="words">
              <CompletionStatIcon aria-hidden>🧠</CompletionStatIcon>
              <CompletionStatValue>{vocabularyWordsCount}</CompletionStatValue>
              <CompletionStatLabel>слов закреплено</CompletionStatLabel>
            </CompletionStat>
          ) : null}
          <CompletionStat $tone="accuracy">
            <CompletionStatIcon aria-hidden>🎯</CompletionStatIcon>
            <CompletionStatValue>{quizAccuracy ?? 100}%</CompletionStatValue>
            <CompletionStatLabel>{quizAccuracy === null ? "прогресс" : "точность"}</CompletionStatLabel>
          </CompletionStat>
        </CompletionStats>

        <CompletionActions>
          <SecondaryLink href={roadmapHref}>Назад к маршруту</SecondaryLink>
          {lesson.nextLesson ? (
            <PrimaryLink
              href={getCourseLessonHref(
                lesson.nextLesson.levelSlug,
                lesson.nextLesson.unitSlug,
                lesson.nextLesson.lessonSlug,
              )}
            >
              Следующий урок →
            </PrimaryLink>
          ) : (
            <PrimaryLink href={roadmapHref}>Завершить уровень</PrimaryLink>
          )}
        </CompletionActions>
      </CompletionCard>
    </>
  );
}

const completionCardRise = keyframes`
  from { opacity: 0; transform: translateY(1.25rem) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

const completionTrophyPop = keyframes`
  0% { opacity: 0; transform: translateY(1rem) scale(0.45) rotate(-12deg); }
  65% { opacity: 1; transform: translateY(-0.2rem) scale(1.12) rotate(5deg); }
  100% { opacity: 1; transform: translateY(0) scale(1) rotate(0); }
`;

const completionFloat = keyframes`
  0%, 100% { transform: translateY(0) rotate(-3deg); }
  50% { transform: translateY(-0.45rem) rotate(3deg); }
`;

const completionProgressReveal = keyframes`
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
`;

const CompletionCard = styled.div`
  position: relative;
  isolation: isolate;
  overflow: hidden;
  display: grid;
  justify-items: center;
  gap: 1.05rem;
  min-height: min(68vh, 42rem);
  border: 1px solid rgba(180, 194, 255, 0.82);
  border-radius: 2.25rem;
  background:
    radial-gradient(circle at 15% 10%, rgba(82, 176, 255, 0.19), transparent 28%),
    radial-gradient(circle at 84% 7%, rgba(139, 92, 246, 0.21), transparent 30%),
    radial-gradient(circle at 50% 108%, rgba(82, 99, 255, 0.13), transparent 39%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(244, 247, 255, 0.96));
  padding: clamp(1.6rem, 4vw, 3rem);
  text-align: center;
  box-shadow:
    0 30px 85px rgba(55, 74, 160, 0.17),
    inset 0 1px 0 rgba(255, 255, 255, 0.88);
  animation: ${completionCardRise} 520ms cubic-bezier(0.22, 1, 0.36, 1) both;

  &::after {
    content: "";
    position: absolute;
    z-index: -1;
    right: -5rem;
    bottom: -7rem;
    width: 18rem;
    height: 18rem;
    border: 2rem solid rgba(109, 91, 255, 0.045);
    border-radius: 50%;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const CompletionDecorations = styled.div`
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;

  span {
    position: absolute;
    display: grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    border: 1px solid rgba(190, 202, 255, 0.56);
    border-radius: 1rem;
    background: rgba(255, 255, 255, 0.56);
    color: rgba(82, 99, 255, 0.2);
    font-size: 1.25rem;
    font-weight: 950;
    box-shadow: 0 14px 30px rgba(66, 80, 167, 0.07);
    animation: ${completionFloat} 4.2s ease-in-out infinite;
  }

  span:nth-child(1) { top: 12%; left: 7%; }
  span:nth-child(2) { top: 42%; right: 6%; animation-delay: -1.4s; }
  span:nth-child(3) { bottom: 12%; left: 9%; animation-delay: -2.6s; }
  span:nth-child(4) { bottom: 9%; right: 13%; animation-delay: -0.7s; }

  @media (max-width: 560px) {
    span { width: 2.35rem; height: 2.35rem; border-radius: 0.8rem; font-size: 1rem; }
    span:nth-child(2), span:nth-child(3) { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    span { animation: none; }
  }
`;

const CompletionHeroMark = styled.div`
  position: relative;
  display: grid;
  place-items: center;
  width: 7.4rem;
  height: 6.4rem;
`;

const CompletionHeroGlow = styled.span`
  position: absolute;
  width: 5.4rem;
  height: 5.4rem;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(255, 221, 91, 0.3), rgba(139, 92, 246, 0.2));
  filter: blur(0.2rem);
  box-shadow: 0 0 0 0.75rem rgba(255, 255, 255, 0.56);
`;

const CompletionBadge = styled.span`
  position: relative;
  display: grid;
  place-items: center;
  width: 4.9rem;
  height: 4.9rem;
  border: 1px solid rgba(255, 255, 255, 0.88);
  border-radius: 1.7rem;
  background: linear-gradient(145deg, #ffffff, #f1f4ff);
  box-shadow: 0 20px 45px rgba(82, 99, 255, 0.2);
  font-size: 2.45rem;
  animation: ${completionTrophyPop} 680ms 120ms cubic-bezier(0.22, 1, 0.36, 1) both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const CompletionOrbitDot = styled.span<{ $position: "left" | "right" }>`
  position: absolute;
  top: ${({ $position }) => ($position === "left" ? "0.35rem" : "3.9rem")};
  ${({ $position }) => ($position === "left" ? "left: 0;" : "right: 0;")}
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: ${({ $position }) => ($position === "left" ? "#fff4c7" : "#e8e5ff")};
  color: ${({ $position }) => ($position === "left" ? "#e9a719" : "#725cf6")};
  box-shadow: 0 10px 24px rgba(58, 69, 150, 0.13);
  animation: ${completionFloat} 3s ease-in-out infinite;
  animation-delay: ${({ $position }) => ($position === "left" ? "-0.8s" : "-2s")};

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const CompletionEyebrow = styled.p`
  border: 1px solid rgba(108, 92, 246, 0.2);
  border-radius: 999px;
  background: rgba(241, 239, 255, 0.78);
  color: #5d51df;
  padding: 0.5rem 0.85rem;
  font-size: 0.7rem;
  font-weight: 950;
  letter-spacing: 0.16em;
  text-transform: uppercase;
`;

const CompletionTitle = styled.h2`
  max-width: 42rem;
  color: #111a39;
  font-family: var(--font-heading), sans-serif;
  font-size: clamp(2rem, 6vw, 4rem);
  font-weight: 950;
  line-height: 0.95;
`;

const CompletionText = styled.p`
  max-width: 39rem;
  color: var(--ink-soft);
  font-size: clamp(0.98rem, 1.8vw, 1.08rem);
  font-weight: 600;
  line-height: 1.65;
`;

const CompletionProgressCelebration = styled.div`
  width: min(100%, 42rem);
  border: 1px solid rgba(185, 197, 255, 0.72);
  border-radius: 1.25rem;
  background: rgba(255, 255, 255, 0.7);
  padding: 0.9rem 1rem;
  text-align: left;
  box-shadow: 0 14px 34px rgba(54, 70, 153, 0.08);

  > div:first-child {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
  }

  strong { color: #5263ff; font-size: 1.15rem; font-weight: 950; }
  > div:first-child span { color: #5d6b91; font-size: 0.82rem; font-weight: 800; }
`;

const CompletionProgressTrack = styled.div`
  overflow: hidden;
  height: 0.65rem;
  margin-top: 0.65rem;
  border-radius: 999px;
  background: rgba(220, 226, 255, 0.84);

  span {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #55b8ff, #5263ff 58%, #8b5cf6);
    transform-origin: left;
    animation: ${completionProgressReveal} 850ms 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }
`;

const completionStatTone = {
  xp: { accent: "#f5a524", soft: "rgba(255, 247, 218, 0.84)" },
  words: { accent: "#348cf1", soft: "rgba(226, 240, 255, 0.88)" },
  accuracy: { accent: "#6c5cf6", soft: "rgba(239, 236, 255, 0.88)" },
};

const CompletionStats = styled.div<{ $columns: number }>`
  display: grid;
  width: min(100%, 42rem);
  gap: 0.75rem;
  margin-top: 0.35rem;

  @media (min-width: 700px) {
    grid-template-columns: repeat(${({ $columns }) => $columns}, minmax(0, 1fr));
  }
`;

const CompletionStat = styled.div<{ $tone: keyof typeof completionStatTone }>`
  position: relative;
  overflow: hidden;
  border: 1px solid ${({ $tone }) => completionStatTone[$tone].accent}33;
  border-radius: 1.35rem;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.94), ${({ $tone }) => completionStatTone[$tone].soft});
  padding: 1rem;
  box-shadow: 0 13px 28px rgba(55, 67, 143, 0.08);

  &::before {
    content: "";
    position: absolute;
    inset: 0 0 auto;
    height: 0.27rem;
    background: ${({ $tone }) => completionStatTone[$tone].accent};
  }
`;

const CompletionStatIcon = styled.span`
  display: inline-grid;
  place-items: center;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 0.9rem;
  background: rgba(238, 242, 255, 0.95);
  font-size: 1.1rem;
`;

const CompletionStatValue = styled.p`
  margin-top: 0.55rem;
  color: #111a39;
  font-size: 1.65rem;
  font-weight: 950;
  line-height: 1;
`;

const CompletionStatLabel = styled.p`
  margin-top: 0.28rem;
  color: var(--ink-soft);
  font-size: 0.78rem;
  font-weight: 800;
`;

const CompletionActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 0.75rem;

  ${PrimaryLink}, ${SecondaryLink} {
    min-height: 3.35rem;
    padding-inline: 1.35rem;
    font-size: 0.92rem;
  }
`;

