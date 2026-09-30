"use client";

import { useState, type ReactNode } from "react";
import styled from "styled-components";
import type { LessonChoiceExercise } from "@/lib/lesson-choice-exercise";

type InlineLessonChoiceExerciseProps = {
  exercise: LessonChoiceExercise;
  onImageOpen: (src: string, alt: string) => void;
  renderText: (text: string, keyPrefix: string) => ReactNode[];
};

export function InlineLessonChoiceExercise({
  exercise,
  onImageOpen,
  renderText,
}: InlineLessonChoiceExerciseProps) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const hasText = Boolean(exercise.text.trim());
  const audioUrl = exercise.audioUrl.trim();
  const mobileImageUrl = exercise.mobileImageUrl.trim();
  const displayImageUrl = exercise.imageUrl.trim() || mobileImageUrl;
  const hasImage = Boolean(displayImageUrl);
  const questionCount = exercise.questions.length;
  const hasMultipleQuestions = questionCount > 1;

  return (
    <ExerciseCard>
      <ExerciseHeader>
        <ExerciseMeta>
          <ExerciseKicker>Задание в уроке</ExerciseKicker>
          {hasMultipleQuestions ? (
            <ExerciseProgress>Вопрос {currentQuestionIndex + 1} / {questionCount}</ExerciseProgress>
          ) : null}
        </ExerciseMeta>
        {exercise.title ? (
          <ExerciseTitle>{renderText(exercise.title, "lesson-choice-title")}</ExerciseTitle>
        ) : null}
        {exercise.description ? (
          <ExerciseDescription>{renderText(exercise.description, "lesson-choice-description")}</ExerciseDescription>
        ) : null}
      </ExerciseHeader>

      {audioUrl ? (
        <ExerciseAudio>
          <ExerciseAudioIcon aria-hidden>🎧</ExerciseAudioIcon>
          <ExerciseAudioContent>
            <ExerciseAudioLabel>Прослушайте аудио</ExerciseAudioLabel>
            <audio controls preload="metadata" src={audioUrl}>
              Ваш браузер не поддерживает аудио.
            </audio>
          </ExerciseAudioContent>
        </ExerciseAudio>
      ) : null}

      {hasImage || hasText ? (
        <ExerciseStimulus>
          {hasImage ? (
            <ExerciseImageButton
              type="button"
              onClick={() => {
                const imageUrl = mobileImageUrl && typeof window !== "undefined" &&
                  window.matchMedia("(max-width: 767px)").matches
                    ? mobileImageUrl
                    : displayImageUrl;
                onImageOpen(imageUrl, exercise.title || "Материал задания");
              }}
              aria-label="Увеличить изображение задания"
            >
              <ExercisePicture>
                {mobileImageUrl ? <source media="(max-width: 767px)" srcSet={mobileImageUrl} /> : null}
                <ExerciseImage src={displayImageUrl} alt={exercise.title || "Материал задания"} />
              </ExercisePicture>
              <ZoomBadge><MagnifyingGlassIcon /></ZoomBadge>
            </ExerciseImageButton>
          ) : null}
          {hasText ? <ExercisePassage>{renderText(exercise.text, "lesson-choice-passage")}</ExercisePassage> : null}
        </ExerciseStimulus>
      ) : null}

      <QuestionList>
        {exercise.questions.map((question, questionIndex) => {
          if (hasMultipleQuestions && questionIndex !== currentQuestionIndex) return null;

          const selectedOptionIndex = answers[questionIndex];
          const answered = typeof selectedOptionIndex === "number";
          const isCorrect = answered && selectedOptionIndex === question.correctOptionIndex;
          const correctAnswer = question.options[question.correctOptionIndex] ?? "";

          return (
            <QuestionCard key={`${question.prompt}-${questionIndex}`}>
              <QuestionHeading>
                <QuestionNumber>{questionIndex + 1}</QuestionNumber>
                <span>{question.prompt || "Выберите правильный ответ."}</span>
              </QuestionHeading>
              <Options>
                {question.options.map((option, optionIndex) => {
                  const selected = selectedOptionIndex === optionIndex;
                  const correct = answered && optionIndex === question.correctOptionIndex;
                  const wrong = answered && selected && !correct;

                  return (
                    <OptionButton
                      key={`${option}-${optionIndex}`}
                      type="button"
                      disabled={answered}
                      $selected={selected}
                      $correct={correct}
                      $wrong={wrong}
                      onClick={() => setAnswers((current) => ({ ...current, [questionIndex]: optionIndex }))}
                    >
                      <OptionMarker $selected={selected} $correct={correct} $wrong={wrong}>
                        {optionIndex + 1}
                      </OptionMarker>
                      <span>{option || `Вариант ${optionIndex + 1}`}</span>
                    </OptionButton>
                  );
                })}
              </Options>
              {answered ? (
                <Result $correct={isCorrect} role="status">
                  <strong>{isCorrect ? "Верно!" : `Правильный ответ: ${correctAnswer}`}</strong>
                  {question.explanation ? <span>{question.explanation}</span> : null}
                </Result>
              ) : null}
              {hasMultipleQuestions ? (
                <QuestionNavigation>
                  {currentQuestionIndex > 0 ? (
                    <NavigationButton
                      type="button"
                      onClick={() => setCurrentQuestionIndex((current) => Math.max(0, current - 1))}
                    >
                      ← Назад
                    </NavigationButton>
                  ) : <span />}
                  {answered && currentQuestionIndex < questionCount - 1 ? (
                    <NavigationButton
                      type="button"
                      $primary
                      onClick={() => setCurrentQuestionIndex((current) => Math.min(questionCount - 1, current + 1))}
                    >
                      Следующий вопрос →
                    </NavigationButton>
                  ) : answered && currentQuestionIndex === questionCount - 1 ? (
                    <CompleteLabel>Все вопросы пройдены</CompleteLabel>
                  ) : null}
                </QuestionNavigation>
              ) : null}
            </QuestionCard>
          );
        })}
      </QuestionList>
    </ExerciseCard>
  );
}

function MagnifyingGlassIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

const ExerciseCard = styled.section`
  display: grid;
  gap: clamp(1rem, 2.5vw, 1.4rem);
  padding: clamp(0.2rem, 1vw, 0.55rem) 0;
`;

const ExerciseHeader = styled.header`
  display: grid;
  gap: 0.45rem;
`;

const ExerciseMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
`;

const ExerciseProgress = styled.span`
  flex: 0 0 auto;
  border-radius: 999px;
  background: rgba(237, 233, 254, 0.72);
  color: #6552d9;
  padding: 0.38rem 0.7rem;
  font-size: 0.72rem;
  font-weight: 800;
`;

const ExerciseKicker = styled.span`
  color: #6552d9;
  font-size: 0.7rem;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
`;

const ExerciseTitle = styled.h4`
  color: #17203d;
  font-size: clamp(1.3rem, 2.8vw, 1.8rem);
  font-weight: 850;
  line-height: 1.25;
`;

const ExerciseDescription = styled.p`
  max-width: 58rem;
  color: #65708f;
  font-size: 0.94rem;
  font-weight: 600;
  line-height: 1.65;
`;

const ExerciseAudio = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 32rem);
  align-items: center;
  gap: 0.8rem;
  width: min(100%, 38rem);
  padding-left: clamp(0.25rem, 4vw, 3rem);

  @media (max-width: 560px) {
    grid-template-columns: auto minmax(0, 1fr);
    padding-left: 0.25rem;
  }
`;

const ExerciseAudioIcon = styled.span`
  display: grid;
  width: 2.55rem;
  height: 2.55rem;
  place-items: center;
  border-radius: 999px;
  background: rgba(237, 233, 254, 0.82);
  font-size: 1.15rem;
`;

const ExerciseAudioContent = styled.div`
  display: grid;
  min-width: 0;
  gap: 0.35rem;

  audio {
    width: 100%;
    min-width: 0;
    height: 2.65rem;
  }
`;

const ExerciseAudioLabel = styled.span`
  color: #6552d9;
  font-size: 0.72rem;
  font-weight: 850;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const ExerciseStimulus = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 1rem;
  background: transparent;
  padding: 0 0 0 clamp(0.25rem, 4vw, 3rem);

  @media (max-width: 767px) {
    padding-left: 0;
  }
`;

const ExerciseImageButton = styled.button`
  position: relative;
  display: block;
  width: min(100%, 62rem);
  max-width: 100%;
  justify-self: start;
  cursor: zoom-in;
  border: 0;
  border-radius: 1rem;
  background: transparent;
  padding: 0;

  @media (max-width: 767px) {
    width: calc(100% + 1.1rem);
    max-width: calc(100% + 1.1rem);
    margin-inline: -0.55rem;
  }
`;

const ExercisePicture = styled.picture`
  display: block;
  width: 100%;
  max-width: 100%;
`;

const ExerciseImage = styled.img`
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  border-radius: 1rem;
  object-fit: contain;
  object-position: left center;
`;

const ZoomBadge = styled.span`
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
  }
`;

const ExercisePassage = styled.div`
  color: #263451;
  padding: 0.25rem 0;
  font-size: clamp(1rem, 2vw, 1.18rem);
  font-weight: 600;
  line-height: 1.8;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;

const QuestionList = styled.div`
  display: grid;
  gap: 1rem;
`;

const QuestionCard = styled.article`
  display: grid;
  gap: 0.85rem;
`;

const QuestionHeading = styled.h5`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.7rem;
  color: #1d2947;
  font-size: clamp(1rem, 2vw, 1.18rem);
  font-weight: 750;
  line-height: 1.45;
`;

const QuestionNumber = styled.span`
  display: grid;
  align-self: start;
  width: 2.25rem;
  height: 2.25rem;
  margin-top: clamp(0.25rem, 0.6vw, 0.55rem);
  place-items: center;
  border-radius: 999px;
  background: rgba(237, 233, 254, 0.96);
  color: #6552d9;
  font-size: 0.9rem;
  font-weight: 850;
`;

const Options = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.38rem;
  padding-left: clamp(0.25rem, 4vw, 3rem);
`;

const OptionButton = styled.button<{
  $selected: boolean;
  $correct: boolean;
  $wrong: boolean;
}>`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.55rem;
  width: fit-content;
  max-width: 100%;
  cursor: pointer;
  border: 0;
  background: transparent;
  color: ${({ $correct, $wrong }) => ($correct ? "#087f5b" : $wrong ? "#be123c" : "#273451")};
  padding: 0.28rem 0;
  text-align: left;
  font-size: clamp(0.98rem, 2vw, 1.08rem);
  font-weight: 550;
  line-height: 1.5;
  transition: 160ms ease;

  &:hover {
    opacity: 0.76;
  }

  &:disabled {
    cursor: default;
  }

  &:disabled:hover {
    opacity: 1;
  }

  &:focus-visible {
    outline: 2px solid rgba(109, 91, 227, 0.28);
    outline-offset: 0.25rem;
    border-radius: 0.25rem;
  }
`;

const OptionMarker = styled.span<{
  $selected: boolean;
  $correct: boolean;
  $wrong: boolean;
}>`
  display: grid;
  width: 1.45rem;
  height: 1.45rem;
  place-items: center;
  border-radius: 999px;
  border: 1.5px solid ${({ $correct, $wrong, $selected }) =>
    $correct ? "#35ad83" : $wrong ? "#e65c78" : $selected ? "#7564df" : "#9da3ad"};
  background: ${({ $correct, $wrong, $selected }) =>
    $correct ? "#35ad83" : $wrong ? "#e65c78" : $selected ? "#7564df" : "transparent"};
  color: ${({ $selected, $correct, $wrong }) =>
    $selected || $correct || $wrong ? "#ffffff" : "#727780"};
  font-size: 0.72rem;
  font-weight: 750;
  transition: 160ms ease;
`;

const QuestionNavigation = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 2.5rem;
`;

const NavigationButton = styled.button<{ $primary?: boolean }>`
  cursor: pointer;
  border: 1px solid
    ${({ $primary }) => ($primary ? "rgba(109, 91, 227, 0.32)" : "rgba(190, 197, 216, 0.72)")};
  border-radius: 999px;
  background: ${({ $primary }) => ($primary ? "rgba(237, 233, 254, 0.86)" : "transparent")};
  color: ${({ $primary }) => ($primary ? "#5946ce" : "#667085")};
  padding: 0.58rem 0.9rem;
  font-size: 0.8rem;
  font-weight: 800;

  &:hover {
    border-color: rgba(109, 91, 227, 0.5);
  }

  &:focus-visible {
    outline: 3px solid rgba(109, 91, 227, 0.16);
    outline-offset: 2px;
  }
`;

const CompleteLabel = styled.span`
  color: #178264;
  font-size: 0.8rem;
  font-weight: 800;
`;

const Result = styled.div<{ $correct: boolean }>`
  display: grid;
  gap: 0.2rem;
  color: ${({ $correct }) => ($correct ? "#087f5b" : "#be123c")};
  padding: 0.25rem 0 0.1rem clamp(0.25rem, 4vw, 3rem);
  font-size: 0.84rem;
  line-height: 1.45;

  strong {
    font-weight: 850;
  }

  span {
    color: #5f6478;
    font-weight: 600;
  }
`;
