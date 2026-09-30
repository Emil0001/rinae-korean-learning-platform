"use client";

import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import { createConfettiPieces, type ConfettiBurst, QuizConfetti } from "@/components/courses/celebration-effects";
import { PrimaryButton } from "@/components/courses/lesson-action-controls";
import type { CourseLessonResponse } from "@/types/courses";

type LessonVocabularyWord = CourseLessonResponse["lesson"]["vocabularyWords"][number];

type VocabularyTrainingStep =
  | { kind: "preview"; word: LessonVocabularyWord }
  | { kind: "choice"; word: LessonVocabularyWord; options: LessonVocabularyWord[] }
  | { kind: "type"; word: LessonVocabularyWord };

function normalizeVocabularyAnswer(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function shuffleVocabularyItems<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function normalizeVocabularyCategory(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase("ru-RU") ?? "";
}

function uniqueVocabularyDistractors(
  word: LessonVocabularyWord,
  words: LessonVocabularyWord[],
  distractorWords: LessonVocabularyWord[],
) {
  const pool = [...words, ...distractorWords].filter(
    (candidate) => candidate.id !== word.id && candidate.translation !== word.translation,
  );
  return Array.from(new Map(pool.map((candidate) => [candidate.id, candidate])).values());
}

function buildVocabularyChoiceOptions(
  word: LessonVocabularyWord,
  words: LessonVocabularyWord[],
  distractorWords: LessonVocabularyWord[],
) {
  const candidates = uniqueVocabularyDistractors(word, words, distractorWords);
  const normalizedCategory = normalizeVocabularyCategory(word.category);
  const hasCategory = Boolean(normalizedCategory);
  const sameCategory = hasCategory
    ? candidates.filter(
        (candidate) => normalizeVocabularyCategory(candidate.category) === normalizedCategory,
      )
    : [];
  const fallback = candidates.filter(
    (candidate) =>
      !hasCategory || normalizeVocabularyCategory(candidate.category) !== normalizedCategory,
  );
  const distractors = [
    ...shuffleVocabularyItems(sameCategory),
    ...shuffleVocabularyItems(fallback),
  ].slice(0, 3);

  return shuffleVocabularyItems([word, ...distractors]);
}

function buildVocabularyTrainingSteps(
  words: LessonVocabularyWord[],
  distractorWords: LessonVocabularyWord[],
): VocabularyTrainingStep[] {
  return [
    ...words.map((word) => ({ kind: "preview" as const, word })),
    ...words.map((word) => ({
      kind: "choice" as const,
      word,
      options: buildVocabularyChoiceOptions(word, words, distractorWords),
    })),
    ...words.slice(0, Math.min(4, words.length)).map((word) => ({ kind: "type" as const, word })),
  ];
}

export function VocabularyStepContent({
  words,
  distractorWords,
  focusMode,
  completed,
  onComplete,
}: {
  words: LessonVocabularyWord[];
  distractorWords: LessonVocabularyWord[];
  focusMode: boolean;
  completed: boolean;
  onComplete: () => void;
}) {
  const [trainingRound, setTrainingRound] = useState(0);
  const steps = useMemo(
    () => {
      void trainingRound;
      return buildVocabularyTrainingSteps(words, distractorWords);
    },
    [words, distractorWords, trainingRound],
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [confettiBurst, setConfettiBurst] = useState<ConfettiBurst | null>(null);
  const confettiBurstIdRef = useRef(0);
  const typeSubmitButtonRef = useRef<HTMLButtonElement | null>(null);
  const active = steps[Math.min(stepIndex, Math.max(steps.length - 1, 0))];
  const progressPercent = steps.length > 0 ? Math.round((stepIndex / steps.length) * 100) : 100;

  useEffect(() => {
    if (!confettiBurst) {
      return;
    }

    const timeout = window.setTimeout(() => setConfettiBurst(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [confettiBurst]);

  const launchConfetti = (event?: ReactMouseEvent<HTMLElement>) => {
    const bounds = event?.currentTarget.getBoundingClientRect();
    const origin = bounds
      ? {
          x: bounds.left + bounds.width / 2,
          y: bounds.top + bounds.height / 2,
        }
      : {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        };

    confettiBurstIdRef.current += 1;
    setConfettiBurst({
      id: confettiBurstIdRef.current,
      pieces: createConfettiPieces(origin, 24),
    });
  };

  const moveNext = () => {
    setSelectedWordId(null);
    setTypedAnswer("");
    setFeedback(null);

    if (stepIndex >= steps.length - 1) {
      setStepIndex(0);
      setTrainingRound((current) => current + 1);
      if (!completed) {
        onComplete();
      }
      return;
    }

    setStepIndex((current) => current + 1);
  };

  if (!active) {
    return null;
  }

  return (
    <VocabularyTrainerCard $focusMode={focusMode}>
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
      <VocabularyTrainerTop>
        <VocabularyTrainerEyebrow>Словарь урока</VocabularyTrainerEyebrow>
        <VocabularyTrainerCounter>
          {Math.min(stepIndex + 1, steps.length)} / {steps.length}
        </VocabularyTrainerCounter>
      </VocabularyTrainerTop>
      <VocabularyTrainerTrack>
        <VocabularyTrainerFill style={{ width: `${progressPercent}%` }} />
      </VocabularyTrainerTrack>

      {active.kind === "preview" ? (
        <VocabularyFlashcard>
          {active.word.category ? <VocabularyCategory>{active.word.category}</VocabularyCategory> : null}
          <VocabularyWordText>{active.word.korean}</VocabularyWordText>
          {active.word.transcription ? (
            <VocabularyTranscription>[{active.word.transcription}]</VocabularyTranscription>
          ) : null}
          <VocabularyTranslation>{active.word.translation}</VocabularyTranslation>
          <VocabularyHint>Посмотрите слово. Дальше оно вернется в упражнениях.</VocabularyHint>
          <PrimaryButton type="button" onClick={moveNext}>Дальше</PrimaryButton>
        </VocabularyFlashcard>
      ) : null}

      {active.kind === "choice" ? (
        <VocabularyExercise>
          <VocabularyPrompt>Как переводится слово?</VocabularyPrompt>
          <VocabularyWordText>{active.word.korean}</VocabularyWordText>
          <VocabularyOptionsGrid>
            {active.options.map((option) => {
              const isSelected = selectedWordId === option.id;
              const isCorrect = option.id === active.word.id;
              return (
                <VocabularyOptionButton
                  key={option.id}
                  type="button"
                  $state={
                    !isSelected || !feedback ? "idle" : isCorrect ? "correct" : "wrong"
                  }
                  disabled={Boolean(feedback)}
                  onClick={(event) => {
                    setSelectedWordId(option.id);
                    setFeedback(isCorrect ? "correct" : "wrong");

                    if (isCorrect) {
                      launchConfetti(event);
                    }
                  }}
                >
                  {option.translation}
                </VocabularyOptionButton>
              );
            })}
          </VocabularyOptionsGrid>
          {feedback ? (
            <VocabularyFeedback $correct={feedback === "correct"}>
              {feedback === "correct"
                ? "Верно. Слово закрепляется."
                : `Нужно: ${active.word.translation}`}
            </VocabularyFeedback>
          ) : null}
          <PrimaryButton
            type="button"
            onClick={moveNext}
            disabled={!feedback}
          >
            Продолжить
          </PrimaryButton>
        </VocabularyExercise>
      ) : null}

      {active.kind === "type" ? (
        <VocabularyExercise>
          <VocabularyPrompt>Напишите слово по-корейски</VocabularyPrompt>
          <VocabularyTranslation>{active.word.translation}</VocabularyTranslation>
          {active.word.transcription ? (
            <VocabularyHint>[{active.word.transcription}]</VocabularyHint>
          ) : null}
          <VocabularyTypeInput
            value={typedAnswer}
            onChange={(event) => {
              setTypedAnswer(event.target.value);
              setFeedback(null);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }

              event.preventDefault();
              typeSubmitButtonRef.current?.click();
            }}
            placeholder="Введите корейское слово"
          />
          {feedback ? (
            <VocabularyFeedback $correct={feedback === "correct"}>
              {feedback === "correct" ? "Точно." : `Правильный ответ: ${active.word.korean}`}
            </VocabularyFeedback>
          ) : null}
          <PrimaryButton
            ref={typeSubmitButtonRef}
            type="button"
            onClick={(event) => {
              if (feedback === "correct") {
                moveNext();
                return;
              }

              const isCorrect =
                normalizeVocabularyAnswer(typedAnswer) === normalizeVocabularyAnswer(active.word.korean);

              if (isCorrect) {
                setFeedback("correct");
                launchConfetti(event);
                return;
              }

              if (feedback === "wrong") {
                moveNext();
                return;
              }

              setFeedback("wrong");
            }}
            disabled={!typedAnswer.trim() && feedback !== "wrong" && feedback !== "correct"}
          >
            {feedback === "correct"
              ? "Дальше"
              : feedback === "wrong"
                ? "Запомнить и дальше"
                : "Проверить"}
          </PrimaryButton>
        </VocabularyExercise>
      ) : null}
    </VocabularyTrainerCard>
  );
}

const VocabularyTrainerCard = styled.div<{ $focusMode: boolean }>`
  display: grid;
  gap: ${({ $focusMode }) => ($focusMode ? "1.35rem" : "1.15rem")};
  border: 1px solid rgba(180, 194, 255, 0.82);
  border-radius: ${({ $focusMode }) => ($focusMode ? "1.8rem" : "1.6rem")};
  background:
    radial-gradient(circle at 15% 0%, rgba(139, 92, 246, 0.16), transparent 32%),
    radial-gradient(circle at 82% 10%, rgba(82, 99, 255, 0.14), transparent 34%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(245, 248, 255, 0.92));
  min-height: ${({ $focusMode }) => ($focusMode ? "min(68vh, 42rem)" : "auto")};
  padding: ${({ $focusMode }) =>
    $focusMode ? "clamp(1.1rem, 3.2vw, 2rem)" : "clamp(1rem, 3vw, 1.5rem)"};
  box-shadow: ${({ $focusMode }) =>
    $focusMode ? "0 28px 78px rgba(55, 74, 160, 0.16)" : "0 22px 54px rgba(55, 74, 160, 0.12)"};
`;

const VocabularyTrainerTop = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
`;

const VocabularyTrainerEyebrow = styled.p`
  color: var(--accent-dark);
  font-size: 0.72rem;
  font-weight: 950;
  letter-spacing: 0.2em;
  text-transform: uppercase;
`;

const VocabularyTrainerCounter = styled.span`
  border-radius: 999px;
  background: rgba(238, 242, 255, 0.96);
  color: #4357dd;
  padding: 0.35rem 0.7rem;
  font-size: 0.78rem;
  font-weight: 900;
`;

const VocabularyTrainerTrack = styled.div`
  height: 0.55rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(221, 226, 255, 0.86);
`;

const VocabularyTrainerFill = styled.div`
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #7c6dff, #5263ff, #8b5cf6);
  transition: width 220ms ease;
`;

const VocabularyFlashcard = styled.div`
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 0.7rem;
  text-align: center;
  border-radius: 1.45rem;
  background: rgba(255, 255, 255, 0.72);
  padding: clamp(1.2rem, 4vw, 2rem);
`;

const VocabularyCategory = styled.span`
  border-radius: 999px;
  background: rgba(238, 242, 255, 0.92);
  color: #4357dd;
  padding: 0.32rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 900;
`;

const VocabularyWordText = styled.p`
  color: #111a39;
  font-size: clamp(2.4rem, 7vw, 4.2rem);
  font-weight: 950;
  line-height: 1.05;
`;

const VocabularyTranscription = styled.p`
  color: var(--ink-soft);
  font-size: 1rem;
  font-weight: 700;
`;

const VocabularyTranslation = styled.p`
  color: #1f2d55;
  font-size: clamp(1.25rem, 3vw, 1.7rem);
  font-weight: 900;
`;

const VocabularyHint = styled.p`
  max-width: 34rem;
  color: var(--ink-soft);
  font-size: 0.92rem;
  line-height: 1.6;
`;

export const VocabularyExercise = styled.div`
  display: grid;
  gap: 1rem;
`;

const VocabularyPrompt = styled.p`
  color: #1c2b52;
  font-size: 1.1rem;
  font-weight: 900;
`;

const VocabularyOptionsGrid = styled.div`
  display: grid;
  gap: 0.75rem;

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const VocabularyOptionButton = styled.button<{ $state: "idle" | "correct" | "wrong" }>`
  position: relative;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid
    ${({ $state }) =>
      $state === "correct" ? "#22c55e" : $state === "wrong" ? "#fb7185" : "rgba(188, 201, 255, 0.9)"};
  border-radius: 1.1rem;
  background:
    ${({ $state }) =>
      $state === "correct"
        ? "linear-gradient(135deg, rgba(220, 252, 231, 0.95), rgba(240, 253, 244, 0.96))"
        : $state === "wrong"
          ? "linear-gradient(135deg, rgba(255, 228, 230, 0.95), rgba(255, 241, 242, 0.96))"
          : "rgba(255, 255, 255, 0.86)"};
  color: #152342;
  padding: 1rem;
  text-align: left;
  font-size: 0.98rem;
  font-weight: 900;
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    background 160ms ease,
    box-shadow 160ms ease;

  &:not(:disabled):hover {
    transform: translateY(-3px) scale(1.01);
    border-color: var(--accent);
    background: linear-gradient(135deg, rgba(248, 250, 255, 0.98), rgba(234, 240, 255, 0.96));
    color: #101a3a;
    box-shadow: 0 16px 32px rgba(68, 83, 180, 0.16);
  }

  &:not(:disabled):active {
    transform: translateY(-1px) scale(0.99);
  }

  &:disabled {
    cursor: default;
  }
`;

const VocabularyFeedback = styled.p<{ $correct: boolean }>`
  border-radius: 1rem;
  background: ${({ $correct }) =>
    $correct ? "rgba(220, 252, 231, 0.9)" : "rgba(255, 228, 230, 0.9)"};
  color: ${({ $correct }) => ($correct ? "#12805c" : "#be123c")};
  padding: 0.85rem 1rem;
  font-size: 0.9rem;
  font-weight: 900;
`;

export const VocabularyTypeInput = styled.input`
  width: 100%;
  border: 1px solid rgba(188, 201, 255, 0.95);
  border-radius: 1.1rem;
  background: rgba(255, 255, 255, 0.92);
  color: #111a39;
  padding: 1rem;
  font-size: 1.05rem;
  font-weight: 800;
  outline: none;

  &:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 0.22rem rgba(90, 102, 255, 0.13);
  }
`;

