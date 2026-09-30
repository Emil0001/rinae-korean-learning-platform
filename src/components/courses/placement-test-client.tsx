"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styled, { keyframes } from "styled-components";
import { useAuth } from "@/context/auth-context";
import { saveCoursePlacementResult } from "@/lib/course-placement";

type ConfidenceOption = {
  id: string;
  label: string;
  score: number;
};

type MotivationOption = {
  id: string;
  label: string;
  shortLabel: string;
  message: string;
};

type PlacementQuestion = {
  id: string;
  prompt: string;
  description: string;
  options: string[];
  correctIndex: number;
};

type ResultBand = {
  min: number;
  max: number;
  levelNumber: number;
  badge: string;
  title: string;
  explanation: string;
  recommendation: string;
  ctaLabel: string;
  href: string;
};

type Stage =
  | "confidence"
  | "levelCheckIntro"
  | "motivation"
  | "starter"
  | "starterResult"
  | "matching"
  | "questions"
  | "result";
type MatchingTarget = "starterResult" | "result";

const LEVEL_CHECK_INTRO_MESSAGE =
  "Хорошо! Сейчас мы быстро проверим ваш текущий уровень. Это займёт всего пару минут.";

const CONFIDENCE_OPTIONS: ConfidenceOption[] = [
  { id: "never", label: "Никогда не изучал", score: 0 },
  { id: "little", label: "Немного изучал", score: 1 },
  { id: "forgot", label: "Раньше изучал, но многое забыл", score: 2 },
  { id: "sentences", label: "Могу строить простые предложения", score: 3 },
];

const MOTIVATION_OPTIONS: MotivationOption[] = [
  {
    id: "speaking",
    label: "Хочу говорить на корейском",
    shortLabel: "Разговор",
    message: "Сделаем упор на разговорную базу и живые фразы с самого старта.",
  },
  {
    id: "travel",
    label: "Для путешествий",
    shortLabel: "Путешествия",
    message: "Подберу старт, чтобы быстрее выйти на полезные фразы для поездок.",
  },
  {
    id: "topik",
    label: "Для подготовки к TOPIK",
    shortLabel: "TOPIK",
    message: "Тогда важно собрать сильный фундамент, чтобы дальше идти в сторону экзамена.",
  },
  {
    id: "culture",
    label: "Хочу понимать дорамы и k-pop",
    shortLabel: "Дорамы и k-pop",
    message: "Соберем старт так, чтобы вы быстрее начали слышать знакомые слова и конструкции.",
  },
];

const QUESTIONS: PlacementQuestion[] = [
  {
    id: "hangul-school",
    prompt: "Как читается слово 학교?",
    description: "Проверим, насколько уверенно вы читаете хангыль.",
    options: ["хаккё", "хагё", "хангё", "хакё"],
    correctIndex: 0,
  },
  {
    id: "person-word",
    prompt: "Что означает слово 사람?",
    description: "Базовая лексика для первых диалогов.",
    options: ["человек", "время", "еда", "дом"],
    correctIndex: 0,
  },
  {
    id: "water-word",
    prompt: "Что означает слово 물?",
    description: "Еще один простой словарный ориентир.",
    options: ["вода", "огонь", "еда", "книга"],
    correctIndex: 0,
  },
  {
    id: "direction-particle",
    prompt: "Выберите правильный вариант: Я иду в школу",
    description: "Здесь важна частица направления.",
    options: ["나는 학교 가요", "나는 학교에 가요", "나는 학교를 가요", "나는 학교에서 가요"],
    correctIndex: 1,
  },
  {
    id: "polite-i",
    prompt: "Что означает слово 저?",
    description: "Ключевое слово для вежливой речи.",
    options: ["я (вежливо)", "ты", "мы", "он"],
    correctIndex: 0,
  },
  {
    id: "student-sentence",
    prompt: "저는 학생입니다 означает:",
    description: "Понимание базового предложения.",
    options: ["Я студент", "Я учу студента", "Он студент", "Студент учится"],
    correctIndex: 0,
  },
  {
    id: "past-tense",
    prompt: "어제 친구를 만났어요 означает:",
    description: "Проверка на распознавание прошедшего времени.",
    options: [
      "Я встретил друга вчера",
      "Я встречаю друга сейчас",
      "Я встречу друга завтра",
      "Друг встретил меня вчера",
    ],
    correctIndex: 0,
  },
  {
    id: "weather-sentence",
    prompt: "오늘 날씨가 좋아요 означает:",
    description: "Базовое понимание повседневной фразы.",
    options: [
      "Сегодня хорошая погода",
      "Сегодня холодно",
      "Сегодня идет дождь",
      "Сегодня я занят",
    ],
    correctIndex: 0,
  },
  {
    id: "politeness-form",
    prompt: "Какая форма более вежливая? 먹어",
    description: "Проверка понимания уровня вежливости.",
    options: ["먹어요", "먹는다", "먹자", "먹니"],
    correctIndex: 0,
  },
  {
    id: "book-reading",
    prompt: "Выберите правильный перевод: Я читаю книгу",
    description: "Смотрим, как вы чувствуете частицы в предложении.",
    options: ["나는 책을 읽어요", "나는 책이 읽어요", "나는 책에 읽어요", "나는 책은 읽어요"],
    correctIndex: 0,
  },
];

const RESULT_BANDS: ResultBand[] = [
  {
    min: 0,
    max: 2,
    levelNumber: 1,
    badge: "Рекомендуем уровень 1",
    title: "Старт",
    explanation:
      "Лучше начать с самого начала: спокойно освоить хангыль, чтение слогов и первые базовые фразы.",
    recommendation: "Начните с дорожной карты уровня «Старт».",
    ctaLabel: "Открыть уровень",
    href: "/courses/starter",
  },
  {
    min: 3,
    max: 5,
    levelNumber: 1,
    badge: "Рекомендуем уровень 1",
    title: "Старт",
    explanation:
      "Первые ориентиры уже есть, но базу лучше спокойно добрать внутри первого уровня, не перепрыгивая важные шаги.",
    recommendation: "Лучше начать с дорожной карты уровня «Старт».",
    ctaLabel: "Открыть уровень",
    href: "/courses/starter",
  },
  {
    min: 6,
    max: 8,
    levelNumber: 2,
    badge: "Рекомендуем уровень 2",
    title: "Основа",
    explanation:
      "Вы понимаете базовые предложения, простую лексику и уже держите самые важные конструкции.",
    recommendation: "Можно заходить на дорожную карту уровня «Основа».",
    ctaLabel: "Открыть уровень",
    href: "/courses/foundation",
  },
  {
    min: 9,
    max: 10,
    levelNumber: 3,
    badge: "Рекомендуем уровень 3",
    title: "Средний",
    explanation:
      "Для короткого входного теста это сильный результат: база уже уверенная, поэтому можно начать сразу с третьего уровня.",
    recommendation: "Рекомендуем перейти к дорожной карте уровня «Средний».",
    ctaLabel: "Открыть уровень",
    href: "/courses/elementary",
  },
];

function getResultBand(score: number) {
  if (score <= 3) {
    return RESULT_BANDS[0];
  }

  if (score <= 7) {
    return RESULT_BANDS[2];
  }

  return RESULT_BANDS[3];
}

function getConfidenceComment(score: number, confidenceScore: number | null) {
  if (confidenceScore === null) {
    return "";
  }

  if (score >= 6 && confidenceScore <= 1) {
    return "Вы знаете больше, чем вам кажется. База уже есть.";
  }

  if (score <= 3 && confidenceScore >= 2) {
    return "Хорошо, что вы решили проверить уровень. Сейчас лучше опереться на прочный фундамент.";
  }

  return "Мини тест помогает точнее подобрать комфортный старт.";
}

function getSpeechMessage(stage: Stage, questionIndex: number, hasCurrentAnswer: boolean, resultTitle: string) {
  switch (stage) {
    case "confidence":
      return "Сначала скажите, был ли у вас опыт с корейским. Если вы совсем новичок, я сразу покажу правильный старт.";
    case "starter":
      return "Если корейский вы еще не изучали, лучше сразу открыть первый уровень и спокойно начать с базы.";
    case "questions":
      if (hasCurrentAnswer) {
        return `Ответ на вопрос ${questionIndex + 1} выбран. Можно идти дальше.`;
      }

      if (questionIndex < 4) {
        return "Сейчас проверяем чтение хангыля, простые слова и самые базовые конструкции.";
      }

      if (questionIndex < 8) {
        return "Теперь смотрим на предложения, время и частицы. Выбирайте самый естественный вариант.";
      }

      return "Финиш рядом. Осталось совсем немного.";
    case "result":
      return `Готово. По этому тесту вам лучше начать с уровня «${resultTitle}».`;
    default:
      return "";
  }
}

function getMotivationOption(optionId: string | null) {
  return MOTIVATION_OPTIONS.find((option) => option.id === optionId) ?? null;
}

function getStageSpeechMessage(
  stage: Stage,
  questionIndex: number,
  hasCurrentAnswer: boolean,
  resultTitle: string,
  selectedMotivation: MotivationOption | null,
  matchingTarget: MatchingTarget | null,
) {
  if (stage === "motivation") {
    return "Поняла. Теперь расскажите, зачем вам корейский, и я подберу более точный старт.";
  }

  if (stage === "starter") {
    return selectedMotivation?.message ?? "Если вы только начинаете, я соберу спокойный и понятный старт без лишней перегрузки.";
  }

  if (stage === "starterResult") {
    return "Маршрут готов. Начните со «Старта» и двигайтесь в комфортном темпе, но уже с понятной целью.";
  }

  if (stage === "matching") {
    return matchingTarget === "starterResult"
      ? "Сопоставляю вашу цель и собираю быстрый старт, который подойдет именно вам."
      : "Сопоставляю ваши ответы и подбираю уровень, с которого лучше начать обучение.";
  }

  return getSpeechMessage(stage, questionIndex, hasCurrentAnswer, resultTitle);
}

export function PlacementTestClient() {
  const router = useRouter();
  const { user } = useAuth();
  const [stage, setStage] = useState<Stage>("confidence");
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [motivationId, setMotivationId] = useState<string | null>(null);
  const [matchingTarget, setMatchingTarget] = useState<MatchingTarget | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [savingPlacement, setSavingPlacement] = useState(false);
  const [placementSaveError, setPlacementSaveError] = useState("");
  const [levelCheckTypedText, setLevelCheckTypedText] = useState("");

  const currentQuestion = QUESTIONS[questionIndex] ?? null;
  const answeredCount = Object.keys(answers).length;
  const selectedMotivation = getMotivationOption(motivationId);

  const result = useMemo(() => {
    const score = QUESTIONS.reduce((sum, question) => {
      return sum + (answers[question.id] === question.correctIndex ? 1 : 0);
    }, 0);

    return {
      score,
      band: getResultBand(score),
      confidenceComment: getConfidenceComment(score, confidenceScore),
    };
  }, [answers, confidenceScore]);

  const isLastQuestion = questionIndex === QUESTIONS.length - 1;
  const hasCurrentAnswer = currentQuestion ? answers[currentQuestion.id] !== undefined : false;
  const progress =
    stage === "questions"
      ? Math.round((answeredCount / QUESTIONS.length) * 100)
      : stage === "result" || (stage === "matching" && matchingTarget === "result")
        ? 100
        : 0;
  const panelKey =
    stage === "questions" ? `${stage}-${questionIndex}` : stage === "matching" ? `${stage}-${matchingTarget ?? "idle"}` : stage;
  const speechMessage = getStageSpeechMessage(
    stage,
    questionIndex,
    hasCurrentAnswer,
    result.band.title,
    selectedMotivation,
    matchingTarget,
  );

  useEffect(() => {
    if (stage !== "matching" || !matchingTarget) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setStage(matchingTarget);
      setMatchingTarget(null);
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [matchingTarget, stage]);

  useEffect(() => {
    if (stage !== "levelCheckIntro") {
      return;
    }

    setLevelCheckTypedText("");
    let characterIndex = 0;
    let typingIntervalId: number | null = null;
    const typingStartId = window.setTimeout(() => {
      typingIntervalId = window.setInterval(() => {
        characterIndex += 1;
        setLevelCheckTypedText(
          LEVEL_CHECK_INTRO_MESSAGE.slice(0, characterIndex),
        );

        if (characterIndex >= LEVEL_CHECK_INTRO_MESSAGE.length && typingIntervalId !== null) {
          window.clearInterval(typingIntervalId);
        }
      }, 34);
    }, 280);
    const continueId = window.setTimeout(() => {
      setQuestionIndex(0);
      setStage("questions");
    }, 3800);

    return () => {
      window.clearTimeout(typingStartId);
      window.clearTimeout(continueId);
      if (typingIntervalId !== null) {
        window.clearInterval(typingIntervalId);
      }
    };
  }, [stage]);

  const selectConfidence = (option: ConfidenceOption) => {
    setConfidenceScore(option.score);

    if (option.id === "never") {
      setMotivationId(null);
      setStage("motivation");
      return;
    }

    setMotivationId(null);
    setStage("levelCheckIntro");
  };

  const selectMotivation = (option: MotivationOption) => {
    setMotivationId(option.id);
    setStage("starter");
  };

  const selectAnswer = (optionIndex: number) => {
    if (!currentQuestion) {
      return;
    }

    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: optionIndex,
    }));
  };

  const goNext = () => {
    if (!currentQuestion) {
      setMatchingTarget("result");
      setStage("matching");
      return;
    }

    if (isLastQuestion) {
      setMatchingTarget("result");
      setStage("matching");
      return;
    }

    setQuestionIndex((prev) => prev + 1);
  };

  const goBack = () => {
    if (stage === "questions") {
      if (questionIndex === 0) {
        setStage("confidence");
        return;
      }

      setQuestionIndex((prev) => prev - 1);
      return;
    }

    if (stage === "motivation") {
      setStage("confidence");
      return;
    }

    if (stage === "starter") {
      setStage("motivation");
      return;
    }

    if (stage === "starterResult") {
      setStage("starter");
    }
  };

  const startStarterMatch = () => {
    setMatchingTarget("starterResult");
    setStage("matching");
  };

  const openPlacementRoadmap = async (levelNumber: number, levelSlug: string) => {
    setSavingPlacement(true);
    setPlacementSaveError("");

    if (user) {
      try {
        const response = await fetch("/api/courses/placement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recommendedLevelNumber: levelNumber,
            recommendedLevelSlug: levelSlug,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          setPlacementSaveError(
            payload?.error ?? "Не удалось сохранить результат теста.",
          );
          return;
        }
      } catch {
        setPlacementSaveError("Не удалось сохранить результат теста.");
        return;
      } finally {
        setSavingPlacement(false);
      }
    } else {
      saveCoursePlacementResult(levelNumber, levelSlug);
      setSavingPlacement(false);
    }

    router.push(`/courses?placement=1&focusLevel=${levelNumber}`);
  };

  const restart = () => {
    setStage("confidence");
    setConfidenceScore(null);
    setMotivationId(null);
    setMatchingTarget(null);
    setQuestionIndex(0);
    setAnswers({});
    setPlacementSaveError("");
  };

  return (
    <PageSection>
      <Shell>
        <Card>
          <TopAccent />
          <GlowLeft />
          <GlowRight />

          <Layout>
            <MainColumn $centered={stage === "levelCheckIntro"}>
              {(stage === "questions" || stage === "result" || (stage === "matching" && matchingTarget === "result")) && (
                <ProgressRow>
                  <ProgressTrack>
                    <ProgressFill $value={progress} />
                  </ProgressTrack>
                  <ProgressValue>{progress}%</ProgressValue>
                </ProgressRow>
              )}

              <Panel key={panelKey}>
                {stage === "levelCheckIntro" && (
                  <LevelCheckIntroCard>
                    <LevelCheckMascotStage>
                      <LevelCheckHalo aria-hidden />
                      <LevelCheckOrbit aria-hidden />
                      <Image
                        src="/assets/36.svg"
                        alt="Маскот готовит короткую проверку уровня"
                        width={280}
                        height={280}
                        priority
                      />
                    </LevelCheckMascotStage>

                    <LevelCheckMessage
                      role="status"
                      aria-live="polite"
                      aria-label={LEVEL_CHECK_INTRO_MESSAGE}
                    >
                      <LevelCheckKicker>Небольшая проверка</LevelCheckKicker>
                      <LevelCheckTypedLine aria-hidden="true">
                        {levelCheckTypedText}
                        <LevelCheckCaret />
                      </LevelCheckTypedLine>
                    </LevelCheckMessage>

                    <LevelCheckLoading>
                      <LevelCheckLoadingTrack aria-hidden>
                        <span />
                      </LevelCheckLoadingTrack>
                      <LevelCheckLoadingText>
                        Готовим 10 коротких вопросов
                        <ThinkingDots aria-hidden>
                          <ThinkingDot $delay="0s" />
                          <ThinkingDot $delay="0.14s" />
                          <ThinkingDot $delay="0.28s" />
                        </ThinkingDots>
                      </LevelCheckLoadingText>
                    </LevelCheckLoading>
                  </LevelCheckIntroCard>
                )}

                {stage === "confidence" && (
                  <MainCard>
                    <Pill>Мини Тест</Pill>
                    <Title>Давайте определим ваш уровень корейского 🇰🇷</Title>
                    <Lead>Это займет примерно 2–3 минуты</Lead>

                    <SectionBlock>
                      <Eyebrow>Шаг 1</Eyebrow>
                      <SectionTitle>Вы раньше изучали корейский язык?</SectionTitle>
                      <SectionText>
                        После этого будет 10 коротких вопросов по чтению, словам и базовой грамматике.
                      </SectionText>
                    </SectionBlock>

                    <OptionsGrid>
                      {CONFIDENCE_OPTIONS.map((option) => (
                        <OptionButton key={option.id} type="button" onClick={() => selectConfidence(option)}>
                          <OptionText>{option.label}</OptionText>
                        </OptionButton>
                      ))}
                    </OptionsGrid>

                    <ActionRow>
                      <GhostLink href="/courses">Ко всем курсам</GhostLink>
                    </ActionRow>
                  </MainCard>
                )}

                {stage === "motivation" && (
                  <MainCard>
                    <Pill>Мини Тест</Pill>
                    <SectionBlock>
                      <Eyebrow>Шаг 2</Eyebrow>
                      <SectionTitle>Зачем вы хотите учить корейский?</SectionTitle>
                      <SectionText>
                        Это поможет мне собрать для вас более точный и приятный старт без лишних шагов.
                      </SectionText>
                    </SectionBlock>

                    <OptionsGrid>
                      {MOTIVATION_OPTIONS.map((option) => (
                        <OptionButton key={option.id} type="button" onClick={() => selectMotivation(option)}>
                          <OptionText>{option.label}</OptionText>
                        </OptionButton>
                      ))}
                    </OptionsGrid>

                    <ActionRow>
                      <PlainButton type="button" onClick={goBack}>
                        Назад
                      </PlainButton>
                    </ActionRow>
                  </MainCard>
                )}

                {stage === "starter" && (
                  <MainCard>
                    <Eyebrow>Быстрый старт</Eyebrow>
                    <SectionTitle>Сразу соберём вам правильный маршрут</SectionTitle>
                    <SectionTextLarge>
                      Если вы ещё не изучали корейский, нет смысла тратить время на тест. Лучше сразу подобрать мягкий и красивый старт.
                    </SectionTextLarge>
                    {selectedMotivation ? <GoalNote>Фокус: {selectedMotivation.shortLabel}</GoalNote> : null}

                    <ActionRow>
                      <PrimaryButton type="button" onClick={startStarterMatch}>
                        Вперед!
                      </PrimaryButton>
                      <PlainButton type="button" onClick={goBack}>
                        Назад
                      </PlainButton>
                    </ActionRow>
                  </MainCard>
                )}

                {stage === "matching" && (
                  <MainCard>
                    <Eyebrow>Подбираю маршрут</Eyebrow>
                    <SectionTitle>
                      {matchingTarget === "starterResult" ? "Собираю ваш быстрый старт" : "Сопоставляю ответы и уровень"}
                    </SectionTitle>
                    <SectionTextLarge>
                      {matchingTarget === "starterResult"
                        ? "Смотрю на вашу цель и собираю дорожную карту, с которой будет приятно начать."
                        : "Проверяю ответы, сравниваю контрольные точки и подбираю уровень, с которого лучше войти в курс."}
                    </SectionTextLarge>

                    <MatchingScene>
                      <MatchingGlow />
                      <MatchingRing />
                      <MatchingDecor $top="5%" $left="18%" $size="4.8rem" $delay="0.24s" $rotate="7deg">
                        <Image src="/assets/39.svg" alt="" width={90} height={90} aria-hidden />
                      </MatchingDecor>
                      <MatchingDecor $top="6%" $right="16%" $size="5.1rem" $delay="0.12s" $rotate="-8deg">
                        <Image src="/assets/38.svg" alt="" width={74} height={74} aria-hidden />
                      </MatchingDecor>
                      <MatchingDecor $top="39%" $left="3%" $size="5.15rem" $delay="0.46s" $rotate="-12deg">
                        <Image src="/assets/40.svg" alt="" width={90} height={90} aria-hidden />
                      </MatchingDecor>
                      <MatchingDecor $bottom="7%" $right="3%" $size="5.45rem" $delay="0.84s" $rotate="9deg">
                        <Image src="/assets/34.svg" alt="" width={98} height={98} aria-hidden />
                      </MatchingDecor>
                      <MatchingCore>
                        <MatchingCoreLabel>KR</MatchingCoreLabel>
                        <ThinkingDots>
                          <ThinkingDot $delay="0s" />
                          <ThinkingDot $delay="0.18s" />
                          <ThinkingDot $delay="0.36s" />
                        </ThinkingDots>
                      </MatchingCore>
                      <OrbitBadge $top="8%" $left="8%" $delay="0s">
                        Хангыль
                      </OrbitBadge>
                      <OrbitBadge $top="18%" $right="6%" $delay="0.35s">
                        {matchingTarget === "starterResult" ? selectedMotivation?.shortLabel ?? "Цель" : "Лексика"}
                      </OrbitBadge>
                      <OrbitBadge $bottom="17%" $left="11%" $delay="0.7s">
                        Грамматика
                      </OrbitBadge>
                      <OrbitBadge $bottom="11%" $right="10%" $delay="1.05s">
                        {matchingTarget === "starterResult" ? "Маршрут" : result.band.title}
                      </OrbitBadge>
                    </MatchingScene>

                    <MatchingMeter>
                      <MatchingMeterFill />
                    </MatchingMeter>

                    <MatchingChecklist>
                      <MatchingItem $delay="0s">анализирую ответы</MatchingItem>
                      <MatchingItem $delay="0.45s">
                        {matchingTarget === "starterResult" ? "учитываю вашу цель" : "сверяю контрольные точки"}
                      </MatchingItem>
                      <MatchingItem $delay="0.9s">собираю лучший старт</MatchingItem>
                    </MatchingChecklist>
                  </MainCard>
                )}

                {stage === "starterResult" && (
                  <MainCard>
                    <Eyebrow>Маршрут готов</Eyebrow>
                    <ResultTitle>Начнём со «Старта»</ResultTitle>
                    <ResultPills>
                      <ResultBadge>Рекомендуем уровень 1</ResultBadge>
                      {selectedMotivation ? <ScoreBadge>{selectedMotivation.shortLabel}</ScoreBadge> : null}
                    </ResultPills>
                    <SectionTextLarge>
                      Вы начинаете с чистой базы, поэтому лучший вариант сейчас, это первый уровень с хангылем, первыми словами и
                      простыми диалогами.
                    </SectionTextLarge>
                    <SectionTextLarge>
                      {selectedMotivation?.message ?? "Так вы быстрее войдёте в обучение без перегруза и пропусков в основе."}
                    </SectionTextLarge>
                    {placementSaveError ? <Notice>{placementSaveError}</Notice> : null}

                    <ActionRow>
                      <PrimaryButton
                        type="button"
                        disabled={savingPlacement}
                        onClick={() => void openPlacementRoadmap(1, "starter")}
                      >
                        {savingPlacement ? "Сохраняем..." : "Начать обучение"}
                      </PrimaryButton>
                      <PlainButton type="button" onClick={goBack}>
                        Назад
                      </PlainButton>
                    </ActionRow>
                  </MainCard>
                )}

                {stage === "questions" && currentQuestion && (
                  <MainCard>
                    <QuestionHeader>
                      <QuestionMeta>
                        <Eyebrow>Вопрос {questionIndex + 1} из {QUESTIONS.length}</Eyebrow>
                        <QuestionDescription>{currentQuestion.description}</QuestionDescription>
                      </QuestionMeta>
                      <CounterPill>
                        {answeredCount}/{QUESTIONS.length}
                      </CounterPill>
                    </QuestionHeader>

                    <QuestionTitle>{currentQuestion.prompt}</QuestionTitle>

                    <OptionsGrid>
                      {currentQuestion.options.map((option, optionIndex) => {
                        const isSelected = answers[currentQuestion.id] === optionIndex;

                        return (
                          <AnswerButton
                            key={`${currentQuestion.id}-${optionIndex}`}
                            type="button"
                            onClick={() => selectAnswer(optionIndex)}
                            $selected={isSelected}
                          >
                            <AnswerLetter $selected={isSelected}>
                              {String.fromCharCode(1040 + optionIndex)}
                            </AnswerLetter>
                            <AnswerText>{option}</AnswerText>
                          </AnswerButton>
                        );
                      })}
                    </OptionsGrid>

                    <ActionRow>
                      <GhostButton type="button" onClick={goBack}>
                        Назад
                      </GhostButton>
                      <PrimaryButton type="button" onClick={goNext} disabled={!hasCurrentAnswer}>
                        {isLastQuestion ? "Показать результат" : "Продолжить"}
                      </PrimaryButton>
                    </ActionRow>
                  </MainCard>
                )}

                {stage === "result" && (
                  <MainCard>
                    <Eyebrow>Результат</Eyebrow>
                    <ResultTitle>Готово!</ResultTitle>

                    <ResultPills>
                      <ResultBadge>{result.band.badge}</ResultBadge>
                      <ScoreBadge>
                        {result.score} / {QUESTIONS.length} баллов
                      </ScoreBadge>
                    </ResultPills>

                    <SectionTitle>Ваш рекомендуемый уровень: {result.band.title}</SectionTitle>
                    <SectionTextLarge>{result.band.explanation}</SectionTextLarge>
                    <SectionTextLarge>{result.band.recommendation}</SectionTextLarge>

                    {result.confidenceComment ? <Notice>{result.confidenceComment}</Notice> : null}
                    {placementSaveError ? <Notice>{placementSaveError}</Notice> : null}

                    <ActionRow>
                      <PrimaryButton
                        type="button"
                        disabled={savingPlacement}
                        onClick={() =>
                          void openPlacementRoadmap(
                            result.band.levelNumber,
                            result.band.href.replace("/courses/", ""),
                          )
                        }
                      >
                        {savingPlacement ? "Сохраняем..." : "Начать обучение"}
                      </PrimaryButton>
                      <GhostButton type="button" onClick={restart}>
                        Пройти заново
                      </GhostButton>
                    </ActionRow>
                  </MainCard>
                )}
              </Panel>
            </MainColumn>

              {stage !== "levelCheckIntro" ? (
                <SideColumn>
                  <MascotCard>
                    <BubbleWrap key={panelKey}>
                      <BubbleFigure>
                        <BubbleSurface />
                        <BubbleTail />
                        <BubbleText>{speechMessage}</BubbleText>
                      </BubbleFigure>
                    </BubbleWrap>

                    <MascotWrap>
                      <Image
                        src={stage === "result" ? "/assets/35.svg" : "/assets/36.svg"}
                        alt={
                          stage === "result"
                            ? "Маскот поздравляет с результатом"
                            : "Маскот помогает пройти тест"
                        }
                        width={360}
                        height={360}
                        priority
                        style={{ width: "100%", height: "auto", objectFit: "contain" }}
                      />
                    </MascotWrap>
                  </MascotCard>
                </SideColumn>
              ) : null}
          </Layout>
        </Card>
      </Shell>
    </PageSection>
  );
}

const fadeUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.985);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

const slowSpin = keyframes`
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
`;

const breathe = keyframes`
  0%,
  100% {
    transform: scale(0.96);
    opacity: 0.72;
  }

  50% {
    transform: scale(1.04);
    opacity: 1;
  }
`;

const shimmerLoad = keyframes`
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(0%);
  }
`;

const hopDot = keyframes`
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.35;
  }

  40% {
    transform: translateY(-0.28rem);
    opacity: 1;
  }
`;

const floatBadge = keyframes`
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-0.45rem);
  }
`;

const levelCheckMascotFloat = keyframes`
  0%,
  100% {
    transform: translateY(0) rotate(-1deg);
  }

  50% {
    transform: translateY(-0.55rem) rotate(1deg);
  }
`;

const levelCheckOrbitSpin = keyframes`
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
`;

const levelCheckCaretBlink = keyframes`
  0%,
  45% {
    opacity: 1;
  }

  46%,
  100% {
    opacity: 0;
  }
`;

const levelCheckProgress = keyframes`
  from {
    width: 0%;
  }

  to {
    width: 100%;
  }
`;

const pulseText = keyframes`
  0%,
  100% {
    opacity: 0.45;
  }

  50% {
    opacity: 1;
  }
`;

const PageSection = styled.section`
  padding: 1rem 0 2rem;

  @media (min-width: 768px) {
    padding: 3rem 0 4rem;
  }
`;

const Shell = styled.div.attrs({ className: "site-shell" })``;

const Card = styled.article`
  position: relative;
  overflow: hidden;
  border-radius: 2.25rem;
  border: 1px solid rgba(255, 255, 255, 0.75);
  background:
    radial-gradient(circle at top left, rgba(255, 241, 196, 0.72), transparent 24%),
    radial-gradient(circle at top right, rgba(172, 213, 255, 0.52), transparent 28%),
    linear-gradient(160deg, #f7fbff, #ebf3ff 54%, #deebff);
  box-shadow: 0 30px 90px rgba(42, 73, 148, 0.16);
`;

const TopAccent = styled.div`
  position: absolute;
  inset: 0 0 auto;
  height: 0.5rem;
  background: linear-gradient(90deg, #ffcb44, #ffc136, #ffab1f);
`;

const GlowLeft = styled.div`
  position: absolute;
  left: -3rem;
  bottom: 0;
  width: 13rem;
  height: 13rem;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(92, 152, 255, 0.18), transparent 72%);
`;

const GlowRight = styled.div`
  position: absolute;
  right: -3rem;
  top: 2rem;
  width: 14rem;
  height: 14rem;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(255, 205, 103, 0.24), transparent 72%);
`;

const Layout = styled.div`
  position: relative;
  display: grid;
  gap: 1rem;
  padding: 1rem 0.9rem;

  @media (min-width: 768px) {
    padding: 2rem;
    gap: 1.5rem;
  }

  @media (min-width: 1024px) {
    grid-template-columns: minmax(0, 1.16fr) 292px;
    gap: 1.4rem;
  }
`;

const MainColumn = styled.div<{ $centered?: boolean }>`
  min-width: 0;

  @media (min-width: 1024px) {
    grid-column: ${({ $centered = false }) => ($centered ? "1 / -1" : "auto")};
    min-height: 38rem;
  }
`;

const LevelCheckIntroCard = styled.div`
  position: relative;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 1.15rem;
  min-height: 34rem;
  overflow: hidden;
  border: 1px solid rgba(209, 220, 255, 0.9);
  border-radius: 2rem;
  background:
    radial-gradient(circle at 50% 20%, rgba(255, 215, 110, 0.18), transparent 25%),
    radial-gradient(circle at 14% 82%, rgba(88, 137, 255, 0.14), transparent 30%),
    radial-gradient(circle at 88% 74%, rgba(120, 100, 255, 0.12), transparent 29%),
    rgba(255, 255, 255, 0.84);
  padding: clamp(1.3rem, 4vw, 2.5rem);
  text-align: center;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.98),
    0 24px 58px rgba(49, 75, 153, 0.1);
  animation: ${fadeUp} 300ms ease both;

  @media (max-width: 767px) {
    min-height: 31rem;
    border-radius: 1.55rem;
  }
`;

const LevelCheckMascotStage = styled.div`
  position: relative;
  display: grid;
  place-items: center;
  width: clamp(9.5rem, 20vw, 12.5rem);
  height: clamp(9.5rem, 20vw, 12.5rem);

  img {
    position: relative;
    z-index: 2;
    width: 88%;
    height: 88%;
    object-fit: contain;
    filter: drop-shadow(0 18px 24px rgba(57, 75, 151, 0.16));
    animation: ${levelCheckMascotFloat} 2.3s ease-in-out infinite;
  }
`;

const LevelCheckHalo = styled.span`
  position: absolute;
  inset: 10%;
  border-radius: 999px;
  background: radial-gradient(
    circle,
    rgba(255, 223, 137, 0.54),
    rgba(105, 144, 255, 0.14) 54%,
    transparent 72%
  );
  animation: ${breathe} 2s ease-in-out infinite;
`;

const LevelCheckOrbit = styled.span`
  position: absolute;
  inset: 1%;
  border: 2px dashed rgba(93, 115, 221, 0.26);
  border-radius: 999px;
  animation: ${levelCheckOrbitSpin} 12s linear infinite;

  &::before,
  &::after {
    content: "";
    position: absolute;
    width: 0.72rem;
    height: 0.72rem;
    border-radius: 999px;
    background: #ffca55;
    box-shadow: 0 5px 12px rgba(212, 150, 28, 0.24);
  }

  &::before {
    top: 11%;
    right: 14%;
  }

  &::after {
    bottom: 9%;
    left: 18%;
    background: #6f8cff;
    box-shadow: 0 5px 12px rgba(73, 98, 204, 0.22);
  }
`;

const LevelCheckMessage = styled.div`
  width: min(100%, 43rem);
  min-height: 8.25rem;
  border: 1px solid rgba(192, 204, 255, 0.88);
  border-radius: 1.65rem;
  background: rgba(255, 255, 255, 0.94);
  padding: clamp(1rem, 2.8vw, 1.5rem);
  box-shadow:
    0 18px 40px rgba(52, 72, 157, 0.11),
    inset 0 1px 0 #ffffff;
`;

const LevelCheckKicker = styled.p`
  color: #5263d8;
  font-size: 0.72rem;
  font-weight: 950;
  letter-spacing: 0.18em;
  text-transform: uppercase;
`;

const LevelCheckTypedLine = styled.p`
  margin-top: 0.62rem;
  color: #17264e;
  font-size: clamp(1.12rem, 2.25vw, 1.55rem);
  font-weight: 850;
  line-height: 1.48;
`;

const LevelCheckCaret = styled.span`
  display: inline-block;
  width: 0.16rem;
  height: 1.08em;
  margin-left: 0.16rem;
  border-radius: 999px;
  background: #5b6df5;
  vertical-align: -0.14em;
  animation: ${levelCheckCaretBlink} 720ms steps(1, end) infinite;
`;

const LevelCheckLoading = styled.div`
  display: grid;
  width: min(100%, 29rem);
  gap: 0.58rem;
`;

const LevelCheckLoadingTrack = styled.div`
  overflow: hidden;
  height: 0.58rem;
  border-radius: 999px;
  background: rgba(216, 224, 255, 0.88);
  box-shadow: inset 0 0 0 1px rgba(174, 188, 244, 0.28);

  span {
    display: block;
    width: 0%;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #6f8cff, #5a6cff, #8b5cf6);
    animation: ${levelCheckProgress} 3.8s linear forwards;
  }
`;

const LevelCheckLoadingText = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  color: #7180a6;
  font-size: 0.8rem;
  font-weight: 800;
`;

const SideColumn = styled.aside`
  display: none;

  @media (min-width: 1024px) {
    display: block;
    position: sticky;
    top: 2rem;
    align-self: start;
  }
`;

const ProgressRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;

  @media (min-width: 768px) {
    margin-bottom: 1.5rem;
  }
`;

const ProgressTrack = styled.div`
  flex: 1;
  height: 0.75rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: inset 0 2px 10px rgba(46, 74, 136, 0.08);
`;

const ProgressFill = styled.div<{ $value: number }>`
  height: 100%;
  width: ${({ $value }) => `${$value}%`};
  border-radius: inherit;
  background: linear-gradient(90deg, #5fd769, #3cbc5a);
  transition: width 0.3s ease;
`;

const ProgressValue = styled.span`
  font-size: 0.95rem;
  font-weight: 900;
  color: var(--ink-soft);
`;

const Panel = styled.div`
  animation: ${fadeUp} 0.32s ease;
`;

const MainCard = styled.div`
  max-width: 48rem;
  margin: 0 auto;
  padding: 1.15rem 1rem;
  border-radius: 1.65rem;
  border: 1px solid #dbe6ff;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 20px 44px rgba(44, 74, 155, 0.08);

  @media (min-width: 768px) {
    padding: 1.5rem 1.75rem;
    border-radius: 2rem;
  }

  @media (min-width: 1024px) {
    max-width: none;
    min-height: 35rem;
    padding: 1.3rem 1.35rem;
  }
`;

const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.62rem 0.9rem;
  border-radius: 999px;
  border: 1px solid #d9e5ff;
  background: rgba(255, 255, 255, 0.88);
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent-dark);

  @media (min-width: 768px) {
    padding: 0.7rem 1rem;
    font-size: 0.78rem;
    letter-spacing: 0.24em;
  }
`;

const Title = styled.h1`
  margin: 1rem 0 0;
  max-width: 42rem;
  font-family: var(--font-heading), sans-serif;
  font-size: clamp(1.95rem, 9.2vw, 3.05rem);
  line-height: 0.98;
  font-weight: 900;
  color: #162447;

  @media (min-width: 768px) {
    font-size: clamp(2.7rem, 5.3vw, 4.85rem);
    line-height: 0.92;
  }

  @media (min-width: 1024px) {
    max-width: none;
    font-size: clamp(2.6rem, 4vw, 4.15rem);
    line-height: 0.94;
  }
`;

const Lead = styled.p`
  margin: 0.8rem 0 0;
  font-size: 0.88rem;
  color: var(--ink-soft);

  @media (min-width: 768px) {
    font-size: 1rem;
  }

  @media (min-width: 1024px) {
    font-size: 0.95rem;
  }
`;

const SectionBlock = styled.div`
  margin-top: 1.25rem;

  @media (min-width: 768px) {
    margin-top: 1.6rem;
  }

  @media (min-width: 1024px) {
    margin-top: 1.35rem;
  }
`;

const Eyebrow = styled.p`
  margin: 0;
  font-size: 0.74rem;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent-dark);

  @media (min-width: 768px) {
    font-size: 0.82rem;
    letter-spacing: 0.24em;
  }
`;

const SectionTitle = styled.h2`
  margin: 0.65rem 0 0;
  font-size: clamp(1.45rem, 6.9vw, 1.95rem);
  line-height: 1.1;
  font-weight: 900;
  color: #152346;

  @media (min-width: 768px) {
    font-size: clamp(1.9rem, 3.15vw, 2.7rem);
    line-height: 1.04;
  }

  @media (min-width: 1024px) {
    font-size: clamp(1.7rem, 2.35vw, 2.3rem);
    line-height: 1.05;
  }
`;

const SectionText = styled.p`
  margin: 0.75rem 0 0;
  font-size: 0.87rem;
  line-height: 1.55;
  color: var(--ink-soft);

  @media (min-width: 768px) {
    font-size: 0.98rem;
    line-height: 1.7;
  }

  @media (min-width: 1024px) {
    margin-top: 0.65rem;
    font-size: 0.93rem;
    line-height: 1.55;
  }
`;

const SectionTextLarge = styled(SectionText)`
  font-size: 0.92rem;

  @media (min-width: 768px) {
    font-size: 1.08rem;
  }
`;

const GoalNote = styled.div`
  display: inline-flex;
  align-items: center;
  margin-top: 1rem;
  padding: 0.62rem 0.9rem;
  border-radius: 999px;
  border: 1px solid #d6e3ff;
  background: linear-gradient(180deg, #f8fbff, #eef4ff);
  font-size: 0.74rem;
  font-weight: 900;
  color: #38508d;

  @media (min-width: 768px) {
    padding: 0.7rem 1rem;
    font-size: 0.88rem;
  }
`;

const OptionsGrid = styled.div`
  display: grid;
  gap: 0.65rem;
  margin-top: 1rem;

  @media (min-width: 768px) {
    gap: 0.75rem;
    margin-top: 1.25rem;
  }

  @media (min-width: 1024px) {
    gap: 0.62rem;
    margin-top: 1rem;
  }
`;

const OptionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 1rem;
  width: 100%;
  padding: 0.88rem 1rem;
  border: 1px solid #d6e2ff;
  border-radius: 1.3rem;
  background: #f9fbff;
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;

  @media (min-width: 768px) {
    padding: 1rem 1.2rem;
    border-radius: 1.5rem;
  }

  @media (min-width: 1024px) {
    gap: 0.8rem;
    padding: 0.85rem 1rem;
    border-radius: 1.2rem;
  }

  &:hover {
    transform: translateY(-2px);
    border-color: #9eb7ff;
    background: #ffffff;
  }
`;

const OptionText = styled.span`
  font-size: 0.91rem;
  font-weight: 800;
  color: #1c2d57;

  @media (min-width: 768px) {
    font-size: 1.1rem;
  }

  @media (min-width: 1024px) {
    font-size: 0.98rem;
  }
`;

const ActionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.25rem;

  @media (min-width: 1024px) {
    margin-top: 1rem;
  }
`;

const sharedAction = `
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.95rem;
  padding: 0 1.1rem;
  border-radius: 999px;
  font-size: 0.88rem;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    opacity 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;

  @media (min-width: 768px) {
    min-height: 3.25rem;
    padding: 0 1.5rem;
    font-size: 0.95rem;
  }
`;

const GhostLink = styled(Link)`
  ${sharedAction}
  border: 1px solid #d5def4;
  background: #ffffff;
  color: #2b3c68;

  &:hover {
    transform: translateY(-2px);
  }
`;

const PrimaryButton = styled.button`
  ${sharedAction}
  border: 0;
  background: linear-gradient(135deg, #59d86b, #39b95a);
  color: #ffffff;
  box-shadow: 0 16px 30px rgba(58, 184, 89, 0.24);

  &:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

const GhostButton = styled.button`
  ${sharedAction}
  border: 1px solid #d5def4;
  background: #ffffff;
  color: #2b3c68;

  &:hover {
    transform: translateY(-2px);
  }
`;

const PlainButton = styled.button`
  ${sharedAction}
  padding: 0 0.4rem;
  border: 0;
  background: transparent;
  color: #6a7a9f;
`;

const QuestionHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const QuestionMeta = styled.div`
  min-width: 0;
`;

const QuestionDescription = styled.p`
  margin: 0.7rem 0 0;
  font-size: 0.86rem;
  color: var(--ink-soft);

  @media (min-width: 768px) {
    font-size: 1rem;
  }

  @media (min-width: 1024px) {
    font-size: 0.92rem;
  }
`;

const CounterPill = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.55rem;
  padding: 0 0.85rem;
  border-radius: 999px;
  border: 1px solid #dbe3fb;
  background: #f7faff;
  font-size: 0.8rem;
  font-weight: 900;
  color: #1d315f;

  @media (min-width: 768px) {
    min-height: 2.9rem;
    padding: 0 1rem;
    font-size: 0.95rem;
  }
`;

const QuestionTitle = styled.h2`
  margin: 1rem 0 0;
  font-size: clamp(1.4rem, 6.7vw, 1.95rem);
  line-height: 1.12;
  font-weight: 900;
  color: #152346;

  @media (min-width: 768px) {
    font-size: clamp(1.9rem, 3.3vw, 2.8rem);
    line-height: 1.06;
  }

  @media (min-width: 1024px) {
    margin-top: 0.8rem;
    font-size: clamp(1.7rem, 2.45vw, 2.35rem);
  }
`;

const AnswerButton = styled.button<{ $selected: boolean }>`
  width: 100%;
  padding: 0.88rem 1rem;
  border-radius: 1.3rem;
  border: 1px solid ${({ $selected }) => ($selected ? "#7fa3ff" : "#d6e2ff")};
  background: ${({ $selected }) => ($selected ? "#eef4ff" : "#f9fbff")};
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
  box-shadow: ${({ $selected }) => ($selected ? "0 10px 24px rgba(81,122,221,0.12)" : "none")};

  @media (min-width: 768px) {
    padding: 1rem 1.15rem;
    border-radius: 1.5rem;
  }

  @media (min-width: 1024px) {
    padding: 0.8rem 0.95rem;
    border-radius: 1.2rem;
  }

  &:hover {
    transform: translateY(-2px);
    border-color: ${({ $selected }) => ($selected ? "#7fa3ff" : "#a3bcff")};
    background: ${({ $selected }) => ($selected ? "#eef4ff" : "#ffffff")};
  }
`;

const AnswerLetter = styled.span<{ $selected: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.15rem;
  height: 2.15rem;
  flex-shrink: 0;
  margin-right: 0.8rem;
  border-radius: 999px;
  border: 1px solid ${({ $selected }) => ($selected ? "#7fa3ff" : "#d7e0f3")};
  background: #ffffff;
  color: ${({ $selected }) => ($selected ? "#23408a" : "var(--ink-soft)")};
  font-size: 0.86rem;
  font-weight: 900;

  @media (min-width: 768px) {
    width: 2.5rem;
    height: 2.5rem;
    margin-right: 1rem;
    font-size: 0.95rem;
  }

  @media (min-width: 1024px) {
    width: 2.2rem;
    height: 2.2rem;
    margin-right: 0.82rem;
    font-size: 0.88rem;
  }
`;

const AnswerText = styled.span`
  font-size: 0.91rem;
  font-weight: 800;
  color: #1c2d57;

  @media (min-width: 768px) {
    font-size: 1.08rem;
  }

  @media (min-width: 1024px) {
    font-size: 0.97rem;
  }
`;

const ResultTitle = styled.h2`
  margin: 0.8rem 0 0;
  font-size: clamp(1.8rem, 8.1vw, 2.7rem);
  line-height: 1;
  font-weight: 900;
  color: #152346;

  @media (min-width: 768px) {
    font-size: clamp(2.5rem, 4vw, 4rem);
    line-height: 0.96;
  }
`;

const ResultPills = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.2rem;
`;

const ResultBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.62rem 0.9rem;
  border-radius: 999px;
  background: #eef4ff;
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #2a448c;

  @media (min-width: 768px) {
    padding: 0.75rem 1rem;
    font-size: 0.88rem;
    letter-spacing: 0.18em;
  }
`;

const ScoreBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.62rem 0.9rem;
  border-radius: 999px;
  background: #fff4d7;
  font-size: 0.8rem;
  font-weight: 900;
  color: #7d5b10;

  @media (min-width: 768px) {
    padding: 0.75rem 1rem;
    font-size: 0.95rem;
  }
`;

const Notice = styled.p`
  margin: 0.9rem 0 0;
  padding: 0.9rem;
  border-radius: 1.1rem;
  border: 1px solid #dfe7fb;
  background: #f8fbff;
  font-size: 0.87rem;
  line-height: 1.58;
  color: #42537f;

  @media (min-width: 768px) {
    padding: 1rem;
    border-radius: 1.35rem;
    font-size: 1rem;
    line-height: 1.8;
  }
`;

const MatchingScene = styled.div`
  position: relative;
  margin-top: 1.5rem;
  height: 13.75rem;
  overflow: hidden;
  border-radius: 1.5rem;
  border: 1px solid #deebff;
  background:
    radial-gradient(circle at top, rgba(255, 228, 154, 0.35), transparent 26%),
    radial-gradient(circle at bottom right, rgba(112, 164, 255, 0.25), transparent 34%),
    linear-gradient(180deg, #fbfdff, #f0f6ff 62%, #edf5ff);

  @media (min-width: 768px) {
    height: 18.5rem;
    border-radius: 2rem;
  }
`;

const MatchingGlow = styled.div`
  position: absolute;
  inset: 50% auto auto 50%;
  width: 9rem;
  height: 9rem;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(255, 211, 98, 0.38), rgba(99, 153, 255, 0.08) 58%, transparent 72%);
  transform: translate(-50%, -50%);
  animation: ${breathe} 2.1s ease-in-out infinite;

  @media (min-width: 768px) {
    width: 12rem;
    height: 12rem;
  }
`;

const MatchingRing = styled.div`
  position: absolute;
  inset: 50% auto auto 50%;
  width: 10.6rem;
  height: 10.6rem;
  border-radius: 999px;
  border: 2px dashed rgba(79, 122, 223, 0.4);
  transform: translate(-50%, -50%);
  animation: ${slowSpin} 8s linear infinite;

  @media (min-width: 768px) {
    width: 13.5rem;
    height: 13.5rem;
  }
`;

const MatchingCore = styled.div`
  position: absolute;
  inset: 50% auto auto 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 5.25rem;
  height: 5.25rem;
  border-radius: 1.6rem;
  background: linear-gradient(145deg, #1c3268, #2f58b6);
  box-shadow:
    0 18px 36px rgba(44, 74, 155, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.24);
  transform: translate(-50%, -50%);

  @media (min-width: 768px) {
    width: 6.6rem;
    height: 6.6rem;
    border-radius: 2rem;
  }
`;

const MatchingCoreLabel = styled.span`
  font-size: 1.35rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  color: #ffffff;

  @media (min-width: 768px) {
    font-size: 1.65rem;
  }
`;

const ThinkingDots = styled.div`
  display: inline-flex;
  gap: 0.32rem;
  margin-top: 0.45rem;
`;

const ThinkingDot = styled.span<{ $delay: string }>`
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.95);
  animation: ${hopDot} 1s ease-in-out infinite;
  animation-delay: ${({ $delay }) => $delay};
`;

const OrbitBadge = styled.div<{
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.3rem;
  padding: 0.58rem 0.82rem;
  border-radius: 999px;
  border: 1px solid rgba(215, 228, 255, 0.92);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 12px 24px rgba(56, 88, 168, 0.1);
  font-size: 0.72rem;
  font-weight: 900;
  color: #28407d;
  animation: ${floatBadge} 2.3s ease-in-out infinite;
  animation-delay: ${({ $delay }) => $delay};

  @media (min-width: 768px) {
    min-height: 2.7rem;
    padding: 0.75rem 1rem;
    font-size: 0.84rem;
  }
`;

const MatchingDecor = styled.div<{
  $top?: string;
  $right?: string;
  $bottom?: string;
  $left?: string;
  $size: string;
  $delay: string;
  $rotate: string;
}>`
  position: absolute;
  top: ${({ $top }) => $top ?? "auto"};
  right: ${({ $right }) => $right ?? "auto"};
  bottom: ${({ $bottom }) => $bottom ?? "auto"};
  left: ${({ $left }) => $left ?? "auto"};
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${({ $size }) => $size};
  height: ${({ $size }) => $size};
  padding: 0.08rem;
  border-radius: 1.05rem;
  background: rgba(255, 255, 255, 0.5);
  box-shadow: 0 12px 30px rgba(55, 85, 163, 0.08);
  transform: rotate(${({ $rotate }) => $rotate});
  animation: ${floatBadge} 2.7s ease-in-out infinite;
  animation-delay: ${({ $delay }) => $delay};

  @media (min-width: 768px) {
    padding: 0.12rem;
    border-radius: 1.35rem;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    transform: scale(1.28);
    filter: drop-shadow(0 6px 12px rgba(51, 81, 159, 0.12));

    @media (min-width: 768px) {
      transform: scale(1.5);
    }
  }
`;

const MatchingMeter = styled.div`
  position: relative;
  height: 0.9rem;
  margin-top: 1.25rem;
  overflow: hidden;
  border-radius: 999px;
  background: #e7efff;
`;

const MatchingMeterFill = styled.div`
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(90deg, #ffcb53, #68d96f 48%, #4d7ef7);
  transform: translateX(-100%);
  animation: ${shimmerLoad} 2.2s ease forwards;
`;

const MatchingChecklist = styled.div`
  display: grid;
  gap: 0.5rem;
  margin-top: 1rem;
`;

const MatchingItem = styled.div<{ $delay: string }>`
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #4f6396;
  animation: ${pulseText} 1.35s ease-in-out infinite;
  animation-delay: ${({ $delay }) => $delay};

  @media (min-width: 768px) {
    font-size: 0.92rem;
  }
`;

const MascotCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 34rem;
  height: 100%;
  padding: 1rem 1rem 1.2rem;
  border-radius: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.75);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(247, 250, 255, 0.96));
  box-shadow: 0 22px 50px rgba(53, 79, 153, 0.12);

  @media (min-width: 768px) {
    padding: 1.25rem 1.25rem 1.35rem;
  }

  @media (min-width: 1024px) {
    min-height: 35rem;
    padding: 0.9rem 0.9rem 1rem;
  }
`;

const BubbleWrap = styled.div`
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 18.5rem;
  animation: ${fadeUp} 0.32s ease;

  @media (min-width: 1024px) {
    max-width: 16.5rem;
  }
`;

const BubbleFigure = styled.div`
  position: relative;
  width: 100%;
  height: 15rem;

  @media (min-width: 768px) {
    height: 16rem;
  }

  @media (min-width: 1024px) {
    height: 13.8rem;
  }
`;

const BubbleSurface = styled.div`
  position: absolute;
  inset: 0.35rem 0.35rem 2.5rem;
  border: 4px solid #101010;
  border-radius: 2rem;
  background:
    radial-gradient(circle at top, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92)),
    linear-gradient(180deg, #ffffff, #f9fcff);
  box-shadow:
    0 16px 26px rgba(44, 74, 155, 0.08),
    inset 0 2px 0 rgba(255, 255, 255, 0.8);
`;

const BubbleTail = styled.div`
  position: absolute;
  right: 2.6rem;
  bottom: 0.55rem;
  width: 4.6rem;
  height: 3.4rem;

  &::before {
    content: "";
    position: absolute;
    right: 0.95rem;
    bottom: 0.95rem;
    width: 2.55rem;
    height: 2.55rem;
    border: 4px solid #101010;
    border-radius: 999px;
    background: #ffffff;
  }

  &::after {
    content: "";
    position: absolute;
    right: 0;
    bottom: 0;
    width: 1.55rem;
    height: 1.55rem;
    border: 4px solid #101010;
    border-radius: 999px;
    background: #ffffff;
  }
`;

const BubbleText = styled.div`
  position: absolute;
  inset: 1.9rem 1.7rem 4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 1rem;
  line-height: 1.6;
  font-weight: 800;
  color: #30456f;

  @media (min-width: 768px) {
    inset: 2.1rem 1.9rem 4.15rem;
    font-size: 0.98rem;
  }

  @media (min-width: 1024px) {
    inset: 1.85rem 1.55rem 3.7rem;
    font-size: 0.9rem;
    line-height: 1.5;
  }
`;

const MascotWrap = styled.div`
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 16.25rem;
  margin-top: -2.5rem;
  animation: ${fadeUp} 0.38s ease;

  @media (min-width: 768px) {
    max-width: 17rem;
    margin-top: -3rem;
  }

  @media (min-width: 1024px) {
    max-width: 14.5rem;
    margin-top: -2.2rem;
  }
`;
