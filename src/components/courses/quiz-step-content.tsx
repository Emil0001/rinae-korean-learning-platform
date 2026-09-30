"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled, { css, keyframes } from "styled-components";
import { createConfettiPieces, type ConfettiBurst, QuizConfetti } from "@/components/courses/celebration-effects";
import { PrimaryButton, SecondaryButton } from "@/components/courses/lesson-action-controls";
import {
  PracticeListeningCopy,
  PracticeListeningHint,
  PracticeListeningIcon,
  PracticeListeningLabel,
  PracticeListeningPlayer,
  QuizListeningCard,
} from "@/components/courses/lesson-listening-card";
import { quizKindLabel, type ParsedQuiz } from "@/components/courses/quiz-content";

export function QuizStepContent({
  stepId,
  quiz,
  session,
  onSelect,
  onRetry,
}: {
  stepId: string;
  quiz: ParsedQuiz;
  session?: { answers: Record<number, number> };
  onSelect: (questionIndex: number, optionIndex: number) => void;
  onRetry: () => void;
}) {
  const answers = session?.answers ?? {};
  const [confettiBurst, setConfettiBurst] = useState<ConfettiBurst | null>(null);
  const [mobileQuestionIndex, setMobileQuestionIndex] = useState(() => {
    const firstUnanswered = quiz.questions.findIndex(
      (_, questionIndex) => typeof answers[questionIndex] !== "number",
    );
    return firstUnanswered === -1 ? Math.max(quiz.questions.length - 1, 0) : firstUnanswered;
  });
  const confettiBurstIdRef = useRef(0);
  const answeredCount = Object.keys(answers).length;
  const score = quiz.questions.reduce((sum, question, questionIndex) => {
    const answerIndex = answers[questionIndex];
    const option = typeof answerIndex === "number" ? question.options[answerIndex] : null;
    return sum + (option?.isCorrect ? 1 : 0);
  }, 0);
  const isComplete = answeredCount >= quiz.questions.length;
  const summaryPercent = Math.round(
    ((isComplete ? score : answeredCount) / quiz.questions.length) * 100,
  );

  useEffect(() => {
    if (!confettiBurst) {
      return;
    }

    const timeout = window.setTimeout(() => setConfettiBurst(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [confettiBurst]);

  return (
    <QuizStack>
      {confettiBurst && typeof document !== "undefined"
        ? createPortal(
            <QuizConfetti key={confettiBurst.id} aria-hidden="true">
              {confettiBurst.pieces.map((style, index) => (
                <span key={index} style={style} />
              ))}
            </QuizConfetti>,
            document.body,
          )
        : null}
      {quiz.questions.map((question, questionIndex) => {
        const answerIndex = answers[questionIndex];
        const selectedOption =
          typeof answerIndex === "number" ? question.options[answerIndex] : null;
        const correctOption = question.options.find((option) => option.isCorrect) ?? null;
        const answered = typeof answerIndex === "number";

        return (
          <QuizCard
            key={`${stepId}-${questionIndex}`}
            $mobileVisible={questionIndex === mobileQuestionIndex}
          >
            <MobileQuizPosition>
              Вопрос {questionIndex + 1} из {quiz.questions.length}
            </MobileQuizPosition>
            <QuizCardTop>
              <QuizKindBadge>{quizKindLabel(question.kind)}</QuizKindBadge>
              <QuizQuestionTitle>
                {questionIndex + 1}. {question.prompt}
              </QuizQuestionTitle>
            </QuizCardTop>
            {question.audioUrl ? (
              <QuizListeningCard>
                <PracticeListeningIcon aria-hidden>🎧</PracticeListeningIcon>
                <PracticeListeningCopy>
                  <PracticeListeningLabel>Аудио к вопросу</PracticeListeningLabel>
                  <PracticeListeningHint>
                    Прослушайте запись, затем выберите ответ.
                  </PracticeListeningHint>
                </PracticeListeningCopy>
                <PracticeListeningPlayer controls preload="metadata" src={question.audioUrl}>
                  Ваш браузер не поддерживает аудио.
                </PracticeListeningPlayer>
              </QuizListeningCard>
            ) : null}
            {question.kind === "FILL_IN_BLANK" ? (
              <QuizSentence $answered={answered} $correct={Boolean(selectedOption?.isCorrect)}>
                {renderQuizSentence(question.sentence, selectedOption?.text)}
              </QuizSentence>
            ) : null}
            <QuizOptions>
              {question.options.map((option, optionIndex) => {
                const isSelected = answerIndex === optionIndex;
                const showCorrect = answered && option.isCorrect;
                const showWrong = answered && isSelected && !option.isCorrect;
                const celebrateCorrectAnswer = isSelected && option.isCorrect;

                return (
                  <QuizOptionButton
                    key={`${stepId}-${questionIndex}-${optionIndex}`}
                    type="button"
                    disabled={answered}
                    $selected={isSelected}
                    $correct={showCorrect}
                    $wrong={showWrong}
                    $celebrate={celebrateCorrectAnswer}
                    onClick={(event) => {
                      if (option.isCorrect) {
                        const answerBounds = event.currentTarget.getBoundingClientRect();
                        const origin = {
                          x: answerBounds.left + answerBounds.width / 2,
                          y: answerBounds.top + answerBounds.height / 2,
                        };

                        confettiBurstIdRef.current += 1;
                        setConfettiBurst({
                          id: confettiBurstIdRef.current,
                          pieces: createConfettiPieces(origin),
                        });
                      }
                      onSelect(questionIndex, optionIndex);
                    }}
                  >
                    <QuizOptionMarker
                      $correct={showCorrect}
                      $wrong={showWrong}
                      $celebrate={celebrateCorrectAnswer}
                    >
                      {String.fromCharCode(65 + optionIndex)}
                    </QuizOptionMarker>
                    <QuizOptionText>{option.text}</QuizOptionText>
                    {showCorrect ? <QuizOptionState $tone="correct">Верно</QuizOptionState> : null}
                    {showWrong ? <QuizOptionState $tone="wrong">Ваш ответ</QuizOptionState> : null}
                  </QuizOptionButton>
                );
              })}
            </QuizOptions>

            {answered ? (
              <QuizExplanation $correct={Boolean(selectedOption?.isCorrect)}>
                <QuizExplanationStatus>
                  {selectedOption?.isCorrect ? "Ответ верный" : "Нужно повторить"}
                </QuizExplanationStatus>
                <QuizExplanationText>
                  {selectedOption?.isCorrect ? "Верно." : "Неверно."}{" "}
                  {!selectedOption?.isCorrect && correctOption ? `Правильный ответ: ${correctOption.text}. ` : ""}
                  {question.explanation?.trim() || "Проверьте правило и попробуйте еще раз."}
                </QuizExplanationText>
              </QuizExplanation>
            ) : null}

            {answered && questionIndex < quiz.questions.length - 1 ? (
              <MobileNextQuestionButton
                type="button"
                onClick={() => {
                  setMobileQuestionIndex(questionIndex + 1);
                }}
              >
                Следующий вопрос
              </MobileNextQuestionButton>
            ) : null}
          </QuizCard>
        );
      })}

      <QuizSummary>
        <QuizSummaryContent>
          <QuizSummaryKicker>{isComplete ? "Мини-тест завершен" : "Мини-тест"}</QuizSummaryKicker>
          <QuizSummaryText>
            {isComplete
              ? `Результат: ${score} из ${quiz.questions.length}`
              : `Ответов выбрано: ${answeredCount} из ${quiz.questions.length}`}
          </QuizSummaryText>
          <QuizSummaryBar>
            <QuizSummaryFill style={{ width: `${summaryPercent}%` }} />
          </QuizSummaryBar>
        </QuizSummaryContent>
        {
          <SecondaryButton
            type="button"
            onClick={() => {
              setMobileQuestionIndex(0);
              onRetry();
            }}
          >
            Пройти тест заново
          </SecondaryButton>
        }
      </QuizSummary>
    </QuizStack>
  );
}

function renderQuizSentence(sentence: string, answer?: string) {
  const template = sentence.trim() || "___";
  const placeholder = answer?.trim() || "\u00a0";
  const normalized = template.includes("___") ? template : `${template} ___`;
  const parts = normalized.split("___");

  return parts.map((part, index) => (
    <span key={`${normalized}-${index}`}>
      {part}
      {index < parts.length - 1 ? <QuizBlank>{placeholder}</QuizBlank> : null}
    </span>
  ));
}

const QuizStack = styled.div`
  display: grid;
  gap: 1.1rem;
  max-width: 58rem;
  margin: 0 auto;
`;

const mobileQuizQuestionEnter = keyframes`
  from {
    opacity: 0;
    transform: translateY(0.65rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const QuizCard = styled.div<{ $mobileVisible: boolean }>`
  position: relative;
  display: ${({ $mobileVisible }) => ($mobileVisible ? "block" : "none")};
  overflow: hidden;
  border: 1px solid rgba(181, 196, 255, 0.8);
  border-radius: 1.55rem;
  background:
    radial-gradient(circle at top right, rgba(255, 202, 77, 0.12), transparent 15rem),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 251, 255, 0.96));
  padding: 1.05rem;
  box-shadow: 0 18px 42px rgba(46, 59, 146, 0.08);
  animation: ${({ $mobileVisible }) =>
    $mobileVisible
      ? css`
          ${mobileQuizQuestionEnter} 260ms ease-out both
        `
      : "none"};

  @media (min-width: 768px) {
    border-radius: 1.8rem;
    padding: 1.35rem;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const MobileQuizPosition = styled.p`
  display: block;
  margin-bottom: 0.7rem;
  color: var(--accent-dark);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

const QuizCardTop = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem 1rem;
`;

const QuizKindBadge = styled.span`
  width: fit-content;
  border-radius: 999px;
  padding: 0.34rem 0.72rem;
  background: linear-gradient(135deg, rgba(90, 108, 255, 0.14), rgba(95, 211, 202, 0.14));
  color: var(--accent-dark);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
`;

const QuizQuestionTitle = styled.h3`
  flex: 1 1 24rem;
  color: #1e293b;
  font-size: 1.08rem;
  font-weight: 800;
  line-height: 1.45;
`;

const QuizSentence = styled.div<{ $answered: boolean; $correct: boolean }>`
  margin-top: 0.9rem;
  border-radius: 1rem;
  border: 1px solid
    ${({ $answered, $correct }) =>
      !$answered ? "rgba(181, 196, 255, 0.72)" : $correct ? "#16a34a" : "#dc2626"};
  background:
    ${({ $answered, $correct }) =>
      !$answered
        ? "rgba(244, 247, 255, 0.95)"
        : $correct
          ? "rgba(22, 163, 74, 0.08)"
          : "rgba(220, 38, 38, 0.08)"};
  padding: 0.95rem 1rem;
  color: #24314f;
  font-size: 1.02rem;
  font-weight: 700;
  line-height: 1.8;
`;

export const QuizBlank = styled.span`
  display: inline-flex;
  min-width: 5.5rem;
  justify-content: center;
  margin: 0 0.28rem;
  border-bottom: 2px solid rgba(90, 108, 255, 0.52);
  color: var(--accent-dark);
  font-weight: 900;
`;

export const QuizOptions = styled.div<{ $practiceLayout?: boolean }>`
  display: grid;
  gap: 0.7rem;
  grid-template-columns: ${({ $practiceLayout = false }) =>
    $practiceLayout ? "repeat(2, minmax(0, 1fr))" : "1fr"};
  margin-top: 0.7rem;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const correctAnswerPop = keyframes`
  0% {
    transform: scale(1);
    box-shadow: 0 12px 28px rgba(22, 163, 74, 0.12);
  }
  38% {
    transform: scale(1.018);
    box-shadow:
      0 16px 36px rgba(22, 163, 74, 0.2),
      0 0 0 5px rgba(74, 222, 128, 0.13);
  }
  68% {
    transform: scale(0.996);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 12px 28px rgba(22, 163, 74, 0.12);
  }
`;

const correctAnswerShimmer = keyframes`
  from {
    transform: translateX(-115%) skewX(-18deg);
  }
  to {
    transform: translateX(315%) skewX(-18deg);
  }
`;

const correctMarkerBounce = keyframes`
  0% {
    transform: scale(0.72) rotate(-12deg);
  }
  52% {
    transform: scale(1.2) rotate(5deg);
  }
  76% {
    transform: scale(0.94) rotate(-2deg);
  }
  100% {
    transform: scale(1) rotate(0);
  }
`;

export const QuizOptionButton = styled.button<{
  $selected: boolean;
  $correct: boolean;
  $wrong: boolean;
  $celebrate: boolean;
  $dragging?: boolean;
}>`
  position: relative;
  isolation: isolate;
  overflow: hidden;
  opacity: ${({ $dragging = false }) => ($dragging ? 0 : 1)};
  visibility: ${({ $dragging = false }) => ($dragging ? "hidden" : "visible")};
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.8rem;
  cursor: pointer;
  border: 1px solid;
  border-bottom-width: 3px;
  border-radius: 0.95rem;
  min-height: 3.55rem;
  padding: 0.7rem 0.82rem 0.62rem;
  text-align: left;
  box-shadow: ${({ $correct, $wrong }) =>
    $correct
      ? "0 12px 28px rgba(22, 163, 74, 0.12)"
      : $wrong
        ? "0 12px 28px rgba(220, 38, 38, 0.1)"
        : "none"};
  transition:
    opacity 120ms ease,
    transform 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease,
    box-shadow 160ms ease;
  border-color: ${({ $correct, $wrong, $selected }) =>
    $correct ? "#16a34a" : $wrong ? "#dc2626" : $selected ? "var(--accent)" : "var(--line)"};
  background: ${({ $correct, $wrong, $selected }) =>
    $correct
      ? "linear-gradient(135deg, rgba(22, 163, 74, 0.1), rgba(236, 253, 245, 0.96))"
      : $wrong
        ? "linear-gradient(135deg, rgba(220, 38, 38, 0.09), rgba(255, 247, 247, 0.96))"
        : $selected
          ? "color-mix(in srgb, var(--accent-soft) 28%, white)"
          : "rgba(251,252,255,0.96)"};
  ${({ $celebrate }) =>
    $celebrate
      ? css`
          animation: ${correctAnswerPop} 680ms cubic-bezier(0.22, 1, 0.36, 1) both;

          &::after {
            position: absolute;
            z-index: -1;
            top: -55%;
            bottom: -55%;
            left: 0;
            width: 34%;
            background: linear-gradient(
              90deg,
              transparent,
              rgba(255, 255, 255, 0.72),
              transparent
            );
            content: "";
            animation: ${correctAnswerShimmer} 760ms 80ms ease-out both;
          }
        `
      : ""}

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    border-color: var(--line-strong);
    box-shadow: 0 12px 24px rgba(46, 59, 146, 0.08);
  }

  &:disabled {
    cursor: default;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;

    &::after {
      animation: none;
    }
  }

  @media (max-width: 520px) {
    grid-template-columns: auto minmax(0, 1fr);
  }
`;

export const QuizOptionMarker = styled.span<{
  $correct: boolean;
  $wrong: boolean;
  $celebrate: boolean;
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.65rem;
  background: ${({ $correct, $wrong }) =>
    $correct ? "#16a34a" : $wrong ? "#dc2626" : "rgba(90, 108, 255, 0.12)"};
  color: ${({ $correct, $wrong }) => ($correct || $wrong ? "#ffffff" : "var(--accent-dark)")};
  font-size: 0.82rem;
  font-weight: 900;
  ${({ $celebrate }) =>
    $celebrate
      ? css`
          animation: ${correctMarkerBounce} 620ms cubic-bezier(0.22, 1, 0.36, 1) both;
        `
      : ""}

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

export const QuizOptionText = styled.span`
  color: #24314f;
  font-size: 1.04rem;
  font-weight: 750;
  line-height: 1.55;
`;

export const QuizOptionState = styled.span<{ $tone: "correct" | "wrong" }>`
  display: inline-flex;
  justify-self: end;
  border-radius: 999px;
  border: 1px solid ${({ $tone }) => ($tone === "correct" ? "rgba(22, 163, 74, 0.26)" : "rgba(220, 38, 38, 0.24)")};
  background: ${({ $tone }) => ($tone === "correct" ? "rgba(22, 163, 74, 0.1)" : "rgba(220, 38, 38, 0.09)")};
  color: ${({ $tone }) => ($tone === "correct" ? "#166534" : "#991b1b")};
  padding: 0.34rem 0.7rem;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;

  @media (max-width: 520px) {
    grid-column: 2;
    justify-self: start;
  }
`;

const QuizExplanation = styled.div<{ $correct: boolean }>`
  display: grid;
  gap: 0.35rem;
  margin-top: 0.9rem;
  border: 1px solid ${({ $correct }) => ($correct ? "rgba(22, 163, 74, 0.24)" : "rgba(220, 38, 38, 0.22)")};
  border-radius: 1.05rem;
  background: ${({ $correct }) =>
    $correct
      ? "linear-gradient(135deg, rgba(22, 163, 74, 0.1), rgba(255, 255, 255, 0.88))"
      : "linear-gradient(135deg, rgba(220, 38, 38, 0.08), rgba(255, 255, 255, 0.88))"};
  padding: 0.85rem 0.95rem;
`;

const QuizExplanationStatus = styled.p`
  color: #1e293b;
  font-size: 0.82rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
`;

const QuizExplanationText = styled.p`
  color: #334155;
  font-size: 1rem;
  line-height: 1.7;
`;

const MobileNextQuestionButton = styled(PrimaryButton)`
  display: inline-flex;
  margin-top: 0.9rem;

  @media (max-width: 767px) {
    width: 100%;
  }
`;

const QuizSummary = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid rgba(181, 196, 255, 0.86);
  border-radius: 1.35rem;
  background:
    radial-gradient(circle at top left, rgba(95, 211, 202, 0.16), transparent 13rem),
    linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(243, 247, 255, 0.96));
  padding: 1rem 1.05rem;
`;

const QuizSummaryContent = styled.div`
  flex: 1 1 18rem;
  display: grid;
  gap: 0.45rem;
`;

const QuizSummaryKicker = styled.p`
  color: var(--accent-dark);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
`;

const QuizSummaryText = styled.p`
  color: #24314f;
  font-size: 1rem;
  font-weight: 800;
`;

const QuizSummaryBar = styled.div`
  height: 0.55rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(90, 108, 255, 0.14);
`;

const QuizSummaryFill = styled.div`
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #5fd3ca, #5a6cff);
  transition: width 180ms ease;
`;

