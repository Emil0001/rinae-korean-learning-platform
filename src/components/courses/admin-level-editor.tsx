"use client";

import { ChangeEvent, Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import {
  createEmptyFlexibleStep,
  createEmptyLesson,
  createEmptyUnit,
  makeUniqueSlug,
  createStandardStep,
  slugify,
  STANDARD_STEP_SEQUENCE,
} from "@/lib/course-content";
import {
  COURSE_LESSON_KIND_LABELS,
  COURSE_LESSON_MODE_LABELS,
  COURSE_STEP_LABELS,
  type AdminCourseLevel,
  type CourseLessonKind,
  type CourseStepType,
} from "@/types/courses";
import type { AIProvider, AIStepOutputMode } from "@/lib/ai/provider";
import {
  createEmptyLessonChoiceExercise,
  createEmptyLessonChoiceQuestion,
  extractLessonChoiceExercises,
  replaceLessonChoiceExercise,
  serializeLessonChoiceExercise,
  type LessonChoiceExercise,
} from "@/lib/lesson-choice-exercise";

type AdminVocabularyWordOption = {
  id: string;
  korean: string;
  transcription: string | null;
  translation: string;
  category: string | null;
  isActive: boolean;
};

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }

  const next = [...items];
  const current = next[index];
  next[index] = next[nextIndex];
  next[nextIndex] = current;
  return next;
}

function moveItemToIndex<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function createQuizTemplate() {
  return serializeQuizEditorContent([
    createEmptyQuizQuestion("CHOICE"),
    createEmptyQuizQuestion("FILL_IN_BLANK"),
  ]);
}

function isAssessmentLessonKind(kind: CourseLessonKind) {
  return kind === "MINI_QUIZ" || kind === "FINAL_TEST";
}

function getAssessmentLessonTitle(kind: CourseLessonKind) {
  return kind === "FINAL_TEST" ? "Финальный тест" : "Мини-квиз";
}

function createAssessmentLessonSteps(kind: CourseLessonKind) {
  return [
    {
      type: "QUIZ" as const,
      title: getAssessmentLessonTitle(kind),
      content: createQuizTemplate(),
      imageUrl: null,
    },
  ];
}

function isGeneratedSlug(slug: string, prefix: "lesson" | "unit") {
  const normalized = slug.trim();
  return !normalized || normalized === "item" || new RegExp(`^${prefix}-\\d+$`).test(normalized);
}

type StepImagePlacement = "top" | "bottom";

const STEP_IMAGE_POSITION_TOKEN = /^\[\[step-image-position:(top|bottom)\]\]\s*/i;
const CONTENT_IMAGE_MARKDOWN_PATTERN = /!\[([^\]]*)\]\(([^)]+)\)(?:\{mobile=([^}]+)\})?(?:\{(mobile-hidden)\})?/g;
const CONTENT_AUDIO_MARKDOWN_PATTERN = /\[audio(?::([^\]]*))?\]\(([^)]+)\)/g;
const INTERACTIVE_COUNTRY_MAP_TOKEN = "[[interactive-country-map]]";

function getStepImagePlacement(content: string): StepImagePlacement {
  return content.match(STEP_IMAGE_POSITION_TOKEN)?.[1]?.toLowerCase() === "bottom"
    ? "bottom"
    : "top";
}

function getStepContentBody(content: string) {
  return content.replace(STEP_IMAGE_POSITION_TOKEN, "");
}

function setStepContentBody(content: string, body: string) {
  return withStepImagePlacement(body, getStepImagePlacement(content));
}

function withStepImagePlacement(content: string, placement: StepImagePlacement) {
  const body = getStepContentBody(content);

  if (placement === "bottom") {
    return body.trim()
      ? `[[step-image-position:bottom]]\n\n${body.trimStart()}`
      : "[[step-image-position:bottom]]";
  }

  return body;
}

function appendContentImageMarkup(content: string, imageUrl: string, alt = "") {
  const trimmedUrl = imageUrl.trim();
  if (!trimmedUrl) {
    return content;
  }

  const nextBlock = `![${alt}](${trimmedUrl})`;
  const trimmedContent = content.trimEnd();
  return trimmedContent ? `${trimmedContent}\n\n${nextBlock}` : nextBlock;
}

function appendContentAudioMarkup(content: string, audioUrl: string, label = "") {
  const trimmedUrl = audioUrl.trim();
  if (!trimmedUrl) {
    return content;
  }

  const safeLabel = (label.trim() || "Аудио").replace(/[\[\]\r\n]/g, " ");
  const nextBlock = `[audio:${safeLabel}](${trimmedUrl})`;
  const trimmedContent = content.trimEnd();
  return trimmedContent ? `${trimmedContent}\n\n${nextBlock}` : nextBlock;
}

function extractContentImageItems(content: string) {
  return [...getStepContentBody(content).matchAll(CONTENT_IMAGE_MARKDOWN_PATTERN)]
    .map((match) => ({
      alt: match[1]?.trim() ?? "",
      desktopUrl: match[2]?.trim() ?? "",
      mobileUrls: (match[3] ?? "")
        .split("|")
        .map((url) => url.trim())
        .filter(Boolean),
      hiddenOnMobile: match[4] === "mobile-hidden",
    }))
    .filter((item) => item.desktopUrl.length > 0);
}

function setContentImageMobileUrls(content: string, imageIndex: number, mobileUrls: string[]) {
  const normalizedMobileUrls = mobileUrls.map((url) => url.trim()).filter(Boolean);
  let currentImageIndex = -1;
  const body = getStepContentBody(content).replace(
    CONTENT_IMAGE_MARKDOWN_PATTERN,
    (fullMatch, alt: string, desktopUrl: string, _mobileUrls: string | undefined, mobileHidden: string | undefined) => {
      currentImageIndex += 1;
      if (currentImageIndex !== imageIndex) {
        return fullMatch;
      }

      const mobileSuffix = normalizedMobileUrls.length > 0
        ? `{mobile=${normalizedMobileUrls.join("|")}}`
        : "";
      const hiddenSuffix = mobileHidden === "mobile-hidden" ? "{mobile-hidden}" : "";
      return `![${alt}](${desktopUrl})${mobileSuffix}${hiddenSuffix}`;
    },
  );

  return setStepContentBody(content, body);
}

function setContentImageHiddenOnMobile(content: string, imageIndex: number, hiddenOnMobile: boolean) {
  let currentImageIndex = -1;
  const body = getStepContentBody(content).replace(
    CONTENT_IMAGE_MARKDOWN_PATTERN,
    (fullMatch, alt: string, desktopUrl: string, mobileUrls: string | undefined) => {
      currentImageIndex += 1;
      if (currentImageIndex !== imageIndex) {
        return fullMatch;
      }

      const mobileSuffix = mobileUrls?.trim() ? `{mobile=${mobileUrls}}` : "";
      const hiddenSuffix = hiddenOnMobile ? "{mobile-hidden}" : "";
      return `![${alt}](${desktopUrl})${mobileSuffix}${hiddenSuffix}`;
    },
  );

  return setStepContentBody(content, body);
}

function extractContentAudioItems(content: string) {
  return [...getStepContentBody(content).matchAll(CONTENT_AUDIO_MARKDOWN_PATTERN)]
    .map((match) => ({
      label: match[1]?.trim() || "Аудио",
      url: match[2]?.trim() ?? "",
    }))
    .filter((item) => item.url.length > 0);
}

function buildMarkdownTable(columnCount: number, rowCount: number) {
  const columns = Math.max(2, Math.min(6, Math.floor(columnCount)));
  const rows = Math.max(1, Math.min(6, Math.floor(rowCount)));
  const headers = Array.from({ length: columns }, (_, index) => `Колонка ${index + 1}`);
  const divider = Array.from({ length: columns }, () => "---");
  const bodyRows = Array.from({ length: rows }, (_, rowIndex) =>
    `| ${Array.from({ length: columns }, (_, columnIndex) => `Ячейка ${rowIndex + 1}.${columnIndex + 1}`).join(" | ")} |`,
  );

  return [
    `| ${headers.join(" | ")} |`,
    `| ${divider.join(" | ")} |`,
    ...bodyRows,
  ].join("\n");
}

function buildDialogueBlock() {
  return [
    "[dialogue]",
    "Учитель: 안녕하세요! Сегодня потренируем короткий диалог.",
    "Студент: 안녕하세요! Я готов.",
    "[/dialogue]",
  ].join("\n");
}

function LessonChoiceExerciseEditor({
  exercise,
  exerciseIndex,
  onChange,
  onRemove,
  onImageSelect,
  onAudioSelect,
}: {
  exercise: LessonChoiceExercise;
  exerciseIndex: number;
  onChange: (exercise: LessonChoiceExercise) => void;
  onRemove: () => void;
  onImageSelect: Props["onImageSelect"];
  onAudioSelect: Props["onAudioSelect"];
}) {
  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/45 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">
            Задание с выбором {exerciseIndex + 1}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Этот блок показывается прямо между объяснениями обычного шага.
          </p>
        </div>
        <button type="button" className="secondary-btn px-3 py-2 text-xs font-bold text-rose-600" onClick={onRemove}>
          Удалить задание
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-xs font-bold text-slate-600">
          Заголовок задания
          <input
            className="input-field"
            value={exercise.title}
            onChange={(event) => onChange({ ...exercise, title: event.target.value })}
            placeholder="Например: Прочитайте и выберите правильный ответ"
          />
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-600">
          Описание / инструкция
          <textarea
            className="input-field min-h-20 resize-y"
            value={exercise.description}
            onChange={(event) => onChange({ ...exercise, description: event.target.value })}
            placeholder="Что нужно сделать ученику"
          />
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-600">
          Текст или отрывок внутри задания · необязательно
          <textarea
            className="input-field min-h-32 resize-y"
            value={exercise.text}
            onChange={(event) => onChange({ ...exercise, text: event.target.value })}
            placeholder="Добавьте текст для чтения. Можно использовать его вместе с изображением."
          />
        </label>
        <div className="grid gap-2">
          <span className="text-xs font-bold text-slate-600">Изображение внутри задания · необязательно</span>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <input
              className="input-field"
              value={exercise.imageUrl}
              onChange={(event) => onChange({ ...exercise, imageUrl: event.target.value })}
              placeholder="URL изображения"
            />
            <label className="secondary-btn cursor-pointer px-3 py-2 text-center text-xs font-bold">
              Загрузить изображение
              <input
                className="hidden"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                onChange={(event) => void onImageSelect(event, (value) => onChange({ ...exercise, imageUrl: value }))}
              />
            </label>
            {exercise.imageUrl ? (
              <button
                type="button"
                className="secondary-btn px-3 py-2 text-xs font-bold text-rose-600"
                onClick={() => onChange({ ...exercise, imageUrl: "" })}
              >
                Удалить
              </button>
            ) : null}
          </div>
          {exercise.imageUrl ? (
            <img
              className="max-h-64 w-full rounded-2xl border border-violet-100 bg-white object-contain p-2"
              src={exercise.imageUrl}
              alt="Предпросмотр изображения задания"
            />
          ) : null}
          <div className="mt-2 grid gap-2 rounded-2xl border border-violet-100 bg-white/70 p-3">
            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-violet-700">
              Для телефона · необязательно
            </span>
            <p className="text-xs leading-5 text-slate-500">
              На экранах до 767 px это изображение заменит основное.
            </p>
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
              <input
                className="input-field"
                value={exercise.mobileImageUrl}
                onChange={(event) => onChange({ ...exercise, mobileImageUrl: event.target.value })}
                placeholder="URL изображения для телефона"
              />
              <label className="secondary-btn cursor-pointer px-3 py-2 text-center text-xs font-bold">
                Загрузить для телефона
                <input
                  className="hidden"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                  onChange={(event) =>
                    void onImageSelect(event, (value) => onChange({ ...exercise, mobileImageUrl: value }))
                  }
                />
              </label>
              {exercise.mobileImageUrl ? (
                <button
                  type="button"
                  className="secondary-btn px-3 py-2 text-xs font-bold text-rose-600"
                  onClick={() => onChange({ ...exercise, mobileImageUrl: "" })}
                >
                  Удалить
                </button>
              ) : null}
            </div>
            {exercise.mobileImageUrl ? (
              <img
                className="max-h-64 w-fit max-w-full justify-self-start rounded-2xl border border-violet-100 bg-white object-contain p-2"
                src={exercise.mobileImageUrl}
                alt="Предпросмотр изображения задания для телефона"
              />
            ) : null}
          </div>
        </div>
        <div className="grid gap-2">
          <span className="text-xs font-bold text-slate-600">Аудио к заданию · необязательно</span>
          <p className="text-xs leading-5 text-slate-500">
            Плеер появится после инструкции и перед изображением или текстом задания.
          </p>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <input
              className="input-field"
              value={exercise.audioUrl}
              onChange={(event) => onChange({ ...exercise, audioUrl: event.target.value })}
              placeholder="URL аудиофайла"
            />
            <label className="secondary-btn cursor-pointer px-3 py-2 text-center text-xs font-bold">
              Загрузить аудио
              <input
                className="hidden"
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm"
                onChange={(event) =>
                  void onAudioSelect(event, (value) => onChange({ ...exercise, audioUrl: value }))
                }
              />
            </label>
            {exercise.audioUrl ? (
              <button
                type="button"
                className="secondary-btn px-3 py-2 text-xs font-bold text-rose-600"
                onClick={() => onChange({ ...exercise, audioUrl: "" })}
              >
                Удалить
              </button>
            ) : null}
          </div>
          {exercise.audioUrl ? (
            <audio className="w-full" controls preload="metadata" src={exercise.audioUrl}>
              Ваш браузер не поддерживает аудио.
            </audio>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {exercise.questions.map((question, questionIndex) => (
          <div key={`${exerciseIndex}-choice-question-${questionIndex}`} className="rounded-2xl border border-violet-100 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-violet-700">
                Вопрос {questionIndex + 1}
              </span>
              {exercise.questions.length > 1 ? (
                <button
                  type="button"
                  className="secondary-btn px-3 py-1.5 text-xs font-bold text-rose-600"
                  onClick={() =>
                    onChange({
                      ...exercise,
                      questions: exercise.questions.filter((_, index) => index !== questionIndex),
                    })
                  }
                >
                  Удалить вопрос
                </button>
              ) : null}
            </div>
            <input
              className="input-field mt-3"
              value={question.prompt}
              onChange={(event) =>
                onChange({
                  ...exercise,
                  questions: exercise.questions.map((entry, index) =>
                    index === questionIndex ? { ...entry, prompt: event.target.value } : entry,
                  ),
                })
              }
              placeholder="Текст вопроса"
            />
            <div className="mt-3 grid gap-2">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                Варианты · отметьте правильный
              </p>
              {question.options.map((option, optionIndex) => (
                <div key={`${questionIndex}-option-${optionIndex}`} className="grid items-center gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                  <label className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl bg-violet-50" title="Правильный ответ">
                    <input
                      type="radio"
                      name={`lesson-choice-${exerciseIndex}-${questionIndex}`}
                      className="h-4 w-4 accent-violet-600"
                      checked={question.correctOptionIndex === optionIndex}
                      onChange={() =>
                        onChange({
                          ...exercise,
                          questions: exercise.questions.map((entry, index) =>
                            index === questionIndex ? { ...entry, correctOptionIndex: optionIndex } : entry,
                          ),
                        })
                      }
                    />
                  </label>
                  <input
                    className="input-field"
                    value={option}
                    onChange={(event) =>
                      onChange({
                        ...exercise,
                        questions: exercise.questions.map((entry, index) =>
                          index === questionIndex
                            ? {
                                ...entry,
                                options: entry.options.map((value, entryOptionIndex) =>
                                  entryOptionIndex === optionIndex ? event.target.value : value,
                                ),
                              }
                            : entry,
                        ),
                      })
                    }
                    placeholder={`Вариант ${optionIndex + 1}`}
                  />
                  {question.options.length > 2 ? (
                    <button
                      type="button"
                      className="secondary-btn px-3 py-2 text-xs font-bold text-rose-600"
                      onClick={() => {
                        const nextOptions = question.options.filter((_, index) => index !== optionIndex);
                        const nextCorrectIndex = question.correctOptionIndex === optionIndex
                          ? 0
                          : question.correctOptionIndex > optionIndex
                            ? question.correctOptionIndex - 1
                            : question.correctOptionIndex;
                        onChange({
                          ...exercise,
                          questions: exercise.questions.map((entry, index) =>
                            index === questionIndex
                              ? { ...entry, options: nextOptions, correctOptionIndex: nextCorrectIndex }
                              : entry,
                          ),
                        });
                      }}
                    >
                      Удалить
                    </button>
                  ) : null}
                </div>
              ))}
              <button
                type="button"
                className="secondary-btn w-fit px-3 py-2 text-xs font-bold"
                onClick={() =>
                  onChange({
                    ...exercise,
                    questions: exercise.questions.map((entry, index) =>
                      index === questionIndex
                        ? { ...entry, options: [...entry.options, `Вариант ${entry.options.length + 1}`] }
                        : entry,
                    ),
                  })
                }
              >
                + Добавить вариант
              </button>
            </div>
            <input
              className="input-field mt-3"
              value={question.explanation}
              onChange={(event) =>
                onChange({
                  ...exercise,
                  questions: exercise.questions.map((entry, index) =>
                    index === questionIndex ? { ...entry, explanation: event.target.value } : entry,
                  ),
                })
              }
              placeholder="Пояснение после ответа · необязательно"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        className="secondary-btn mt-3 px-3 py-2 text-xs font-bold"
        onClick={() => onChange({ ...exercise, questions: [...exercise.questions, createEmptyLessonChoiceQuestion()] })}
      >
        + Добавить ещё вопрос
      </button>
    </div>
  );
}

type QuizQuestionKind = "CHOICE" | "FILL_IN_BLANK" | "TRUE_FALSE";

type QuizOptionDraft = {
  text: string;
  isCorrect: boolean;
};

type QuizQuestionDraft = {
  kind: QuizQuestionKind;
  prompt: string;
  sentence: string;
  audioUrl: string;
  options: QuizOptionDraft[];
  explanation: string;
};

type QuizContentDraft = {
  questions: QuizQuestionDraft[];
};

type PracticeExerciseKind =
  | "DESCRIPTION"
  | "BUILD_SENTENCE"
  | "FILL_GAP"
  | "CHOOSE_PARTICLE"
  | "INLINE_CHOICE"
  | "CONJUGATION_CHOICE"
  | "TYPE_ANSWER"
  | "DIALOGUE_FILL"
  | "MATCH_PAIRS"
  | "HANDWRITING_TRACE"
  | "LISTEN_CHOOSE"
  | "LISTEN_TYPE";

type PracticePairDraft = {
  left: string;
  right: string;
};

type InlineChoiceItemDraft = {
  // One sentence row inside a grouped exercise.
  sentence: string;
  answer: string;
  options: string[];
  explanation: string;
};

type TypeAnswerItemDraft = {
  question: string;
  sentence: string;
  answer: string;
  explanation: string;
  imageUrl: string;
};

type DialogueFillItemDraft = {
  question: string;
  sentence: string;
  answer: string;
  explanation: string;
  imageUrl: string;
  isExample: boolean;
};

type PracticeExerciseDraft = {
  kind: PracticeExerciseKind;
  prompt: string;
  description: string;
  sentence: string;
  answer: string;
  words: string[];
  options: string[];
  inlineChoices?: InlineChoiceItemDraft[];
  typeAnswers?: TypeAnswerItemDraft[];
  dialogueItems?: DialogueFillItemDraft[];
  pairs: PracticePairDraft[];
  imageUrl: string;
  mobileImageUrls: string[];
  audioUrl: string;
  baseWord?: string;
  grammarForm?: string;
  category?: string;
  minStrokeLength: number;
  explanation: string;
};

type PracticeContentDraft = {
  exercises: PracticeExerciseDraft[];
  tasksPerPage?: number;
};

const QUIZ_KIND_LABELS: Record<QuizQuestionKind, string> = {
  CHOICE: "Выбор ответа",
  FILL_IN_BLANK: "Пропуск в предложении",
  TRUE_FALSE: "Верно / неверно",
};

const PRACTICE_KIND_LABELS: Record<PracticeExerciseKind, string> = {
  DESCRIPTION: "Описание / инструкция",
  BUILD_SENTENCE: "Собрать предложение",
  FILL_GAP: "Заполнить пропуск",
  CHOOSE_PARTICLE: "Выбрать частицу",
  INLINE_CHOICE: "Выбор прямо в предложении",
  CONJUGATION_CHOICE: "Конструктор формы слова",
  TYPE_ANSWER: "Ввести ответ",
  DIALOGUE_FILL: "Диалог с вводом в пропуск",
  MATCH_PAIRS: "Соединить пары",
  HANDWRITING_TRACE: "Письмо по шаблону",
  LISTEN_CHOOSE: "Аудио → выбрать ответ",
  LISTEN_TYPE: "Аудио → ввести ответ",
};

function createEmptyQuizQuestion(kind: QuizQuestionKind = "CHOICE"): QuizQuestionDraft {
  if (kind === "FILL_IN_BLANK") {
    return {
      kind,
      prompt: "Выберите слово для пропуска.",
      sentence: "저는 ___ 입니다.",
      audioUrl: "",
      options: [
        { text: "학생", isCorrect: true },
        { text: "학교", isCorrect: false },
        { text: "감사합니다", isCorrect: false },
      ],
      explanation: "학생 подходит по смыслу: «Я студент».",
    };
  }

  if (kind === "TRUE_FALSE") {
    return {
      kind,
      prompt: "Фраза «안녕하세요» используется как вежливое приветствие.",
      sentence: "",
      audioUrl: "",
      options: [
        { text: "Верно", isCorrect: true },
        { text: "Неверно", isCorrect: false },
      ],
      explanation: "Да, это стандартное вежливое приветствие.",
    };
  }

  return {
    kind,
    prompt: "Выберите правильный вариант.",
    sentence: "",
    audioUrl: "",
    options: [
      { text: "안녕하세요", isCorrect: true },
      { text: "감사합니다", isCorrect: false },
      { text: "미안합니다", isCorrect: false },
    ],
    explanation: "안녕하세요 используется как приветствие.",
  };
}

function normalizeQuizQuestionKind(value: string | undefined): QuizQuestionKind {
  return value === "FILL_IN_BLANK" || value === "TRUE_FALSE" ? value : "CHOICE";
}

function keepValueOrFallback(value: string | undefined, fallback: string) {
  return value?.trim() ? value : fallback;
}

function normalizeQuizOptions(options: Array<{ text?: string; isCorrect?: boolean }> | undefined, kind: QuizQuestionKind) {
  const sanitized = Array.isArray(options)
    ? options
        .map((option) => ({
          text: option.text ?? "",
          isCorrect: Boolean(option.isCorrect),
        }))
        .filter((option) => option.text.trim().length > 0)
    : [];

  if (kind === "TRUE_FALSE") {
    const hasCorrect = sanitized.some((option) => option.isCorrect);
    const normalized = [
      keepValueOrFallback(sanitized[0]?.text, "Верно"),
      keepValueOrFallback(sanitized[1]?.text, "Неверно"),
    ];
    return normalized.map((text, index) => ({
      text,
      isCorrect: hasCorrect
        ? Boolean(sanitized[index]?.isCorrect)
        : index === 0,
    }));
  }

  const trimmed = sanitized.slice(0, 6);
  const fallback = kind === "FILL_IN_BLANK"
    ? [
        { text: "학생", isCorrect: true },
        { text: "학교", isCorrect: false },
      ]
    : [
        { text: "Вариант 1", isCorrect: true },
        { text: "Вариант 2", isCorrect: false },
      ];
  const next = trimmed.length >= 2 ? trimmed : fallback;

  if (next.some((option) => option.isCorrect)) {
    return next;
  }

  return next.map((option, index) => ({
    ...option,
    isCorrect: index === 0,
  }));
}

function normalizeQuizQuestionDraft(question: {
  kind?: string;
  prompt?: string;
  question?: string;
  sentence?: string;
  audioUrl?: string;
  options?: Array<{ text?: string; isCorrect?: boolean }>;
  explanation?: string;
}): QuizQuestionDraft | null {
  const kind = normalizeQuizQuestionKind(question.kind);
  const prompt = question.prompt ?? question.question ?? "";
  const sentence = question.sentence ?? "";
  const options = normalizeQuizOptions(question.options, kind);

  if (!prompt.trim()) {
    return null;
  }

  return {
    kind,
    prompt,
    sentence: kind === "FILL_IN_BLANK" ? keepValueOrFallback(sentence, "저는 ___ 입니다.") : "",
    audioUrl: question.audioUrl?.trim() ?? "",
    options,
    explanation: question.explanation ?? "",
  };
}

function parseQuizEditorContent(content: string): QuizContentDraft | null {
  const trimmed = getStepContentBody(content).trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      questions?: Array<{
        kind?: string;
        prompt?: string;
        question?: string;
        sentence?: string;
        audioUrl?: string;
        options?: Array<{ text?: string; isCorrect?: boolean }>;
        explanation?: string;
      }>;
    };

    if (!Array.isArray(parsed.questions)) {
      return null;
    }

    const questions = parsed.questions
      .map((question) => normalizeQuizQuestionDraft(question))
      .filter((question): question is QuizQuestionDraft => Boolean(question));

    return questions.length > 0 ? { questions } : null;
  } catch {
    return null;
  }
}

function serializeQuizEditorContent(questions: QuizQuestionDraft[]) {
  return JSON.stringify(
    {
      questions: questions.map((question) => ({
        kind: question.kind,
        prompt: keepValueOrFallback(question.prompt, createEmptyQuizQuestion(question.kind).prompt),
        sentence:
          question.kind === "FILL_IN_BLANK"
            ? keepValueOrFallback(question.sentence, "저는 ___ 입니다.")
            : "",
        audioUrl: question.audioUrl.trim(),
        options: normalizeQuizOptions(question.options, question.kind),
        explanation: question.explanation,
      })),
    },
    null,
    2,
  );
}

function createEmptyPracticeExercise(kind: PracticeExerciseKind = "BUILD_SENTENCE"): PracticeExerciseDraft {
  if (kind === "DESCRIPTION") {
    return {
      kind,
      prompt: "Перед началом",
      description:
        "Давайте потренируемся. Прочитайте инструкцию, затем выполните следующие задания по одному.",
      sentence: "",
      answer: "",
      words: [],
      options: [],
      pairs: [],
      imageUrl: "",
      mobileImageUrls: [],
      audioUrl: "",
      minStrokeLength: 420,
      explanation: "",
    };
  }

  if (kind === "FILL_GAP") {
    return {
      kind,
      prompt: "Выберите слово для пропуска.",
      description: "",
      sentence: "저는 ___ 입니다.",
      answer: "학생",
      words: [],
      options: ["학생", "학교", "책"],
      pairs: [],
      imageUrl: "",
      mobileImageUrls: [],
      audioUrl: "",
      minStrokeLength: 420,
      explanation: "학생 подходит по смыслу: «Я студент».",
    };
  }

  if (kind === "CHOOSE_PARTICLE") {
    return {
      kind,
      prompt: "Выберите правильную частицу.",
      description: "",
      sentence: "학교__ 갑니다.",
      answer: "에",
      words: [],
      options: ["에", "은", "를"],
      pairs: [],
      imageUrl: "",
      mobileImageUrls: [],
      audioUrl: "",
      minStrokeLength: 420,
      explanation: "에 используется для направления: идти в школу.",
    };
  }

  if (kind === "INLINE_CHOICE") {
    return {
      kind,
      prompt: "Выберите правильный вариант прямо в предложении.",
      description: "Нажмите на подходящее слово или грамматическую форму.",
      sentence: "민우___ 한국 사람이에요.",
      answer: "는",
      words: [],
      options: ["은", "는"],
      pairs: [],
      imageUrl: "",
      mobileImageUrls: [],
      audioUrl: "",
      minStrokeLength: 420,
      explanation: "После имени без 받침 используется частица 는.",
    };
  }

  if (kind === "CONJUGATION_CHOICE") {
    return {
      kind,
      prompt: "Выберите правильную форму слова.",
      description: "Соедините словарную форму с нужным окончанием.",
      sentence: "",
      answer: "들어요",
      words: [],
      options: ["들어요", "듣어요", "들워요", "들어"],
      pairs: [],
      imageUrl: "",
      mobileImageUrls: [],
      audioUrl: "",
      baseWord: "듣다",
      grammarForm: "-아요/어요",
      category: "ㄷ-불규칙",
      minStrokeLength: 420,
      explanation: "Перед гласным ㄷ меняется на ㄹ: 듣다 → 들어요.",
    };
  }

  if (kind === "TYPE_ANSWER") {
    return {
      kind,
      prompt: "Напишите фразу по-корейски.",
      description: "",
      sentence: "Я студент.",
      answer: "저는 학생입니다",
      words: [],
      options: [],
      typeAnswers: [{
        question: "",
        sentence: "Я студент.",
        answer: "저는 학생입니다",
        explanation: "저는 학생입니다 — «Я студент».",
        imageUrl: "",
      }],
      pairs: [],
      imageUrl: "",
      mobileImageUrls: [],
      audioUrl: "",
      minStrokeLength: 420,
      explanation: "저는 학생입니다 — «Я студент».",
    };
  }

  if (kind === "DIALOGUE_FILL") {
    return {
      kind,
      prompt: "Дополните ответы в диалоге.",
      description: "Введите недостающую часть ответа прямо в предложение.",
      sentence: "나: 아니요. 저는 ___",
      answer: "한국 사람이 아니에요.",
      words: [],
      options: [],
      dialogueItems: [
        {
          question: "가: 아야나 씨는 한국 사람이에요?",
          sentence: "나: 아니요. 저는 ___",
          answer: "한국 사람이 아니에요.",
          explanation: "Первый диалог показан как образец.",
          imageUrl: "",
          isExample: true,
        },
        {
          question: "가: 크리스 씨는 기자예요?",
          sentence: "나: 아니요. 저는 ___",
          answer: "회사원이에요.",
          explanation: "Введите правильную профессию.",
          imageUrl: "",
          isExample: false,
        },
      ],
      pairs: [],
      imageUrl: "",
      mobileImageUrls: [],
      audioUrl: "",
      minStrokeLength: 420,
      explanation: "",
    };
  }

  if (kind === "MATCH_PAIRS") {
    return {
      kind,
      prompt: "Соедините корейские слова с переводом.",
      description: "",
      sentence: "",
      answer: "",
      words: [],
      options: [],
      pairs: [
        { left: "학교", right: "school" },
        { left: "학생", right: "student" },
        { left: "책", right: "book" },
      ],
      imageUrl: "",
      mobileImageUrls: [],
      audioUrl: "",
      minStrokeLength: 420,
      explanation: "Все пары соединены верно.",
    };
  }

  if (kind === "HANDWRITING_TRACE") {
    return {
      kind,
      prompt: "Обведите слова по шаблону.",
      description:
        "Пишите поверх картинки мышью, пальцем или стилусом. Старайтесь соблюдать порядок и форму штрихов.",
      sentence: "",
      answer: "가수",
      words: [],
      options: [],
      pairs: [],
      imageUrl: "",
      mobileImageUrls: [],
      audioUrl: "",
      minStrokeLength: 48,
      explanation: "Хорошая попытка. Главное — тренировать направление и пропорции штрихов.",
    };
  }

  if (kind === "LISTEN_CHOOSE") {
    return {
      kind,
      prompt: "Прослушайте аудио и выберите правильный ответ.",
      description: "",
      sentence: "",
      answer: "학교",
      words: [],
      options: ["학교", "학생", "책"],
      pairs: [],
      imageUrl: "",
      mobileImageUrls: [],
      audioUrl: "",
      minStrokeLength: 420,
      explanation: "На аудио звучит 학교.",
    };
  }

  if (kind === "LISTEN_TYPE") {
    return {
      kind,
      prompt: "Прослушайте аудио и напишите услышанное.",
      description: "",
      sentence: "",
      answer: "안녕하세요",
      words: [],
      options: [],
      pairs: [],
      imageUrl: "",
      mobileImageUrls: [],
      audioUrl: "",
      minStrokeLength: 420,
      explanation: "Правильный ответ: 안녕하세요.",
    };
  }

  return {
    kind,
    prompt: "Соберите правильное предложение.",
    description: "",
    sentence: "",
    answer: "저는 학생입니다",
    words: ["학생입니다", "저는", "학교"],
    options: [],
    pairs: [],
    imageUrl: "",
    mobileImageUrls: [],
    audioUrl: "",
    minStrokeLength: 420,
    explanation: "Правильный порядок: 저는 학생입니다.",
  };
}

function createPracticeTemplate() {
  return serializePracticeEditorContent([
    createEmptyPracticeExercise("BUILD_SENTENCE"),
    createEmptyPracticeExercise("FILL_GAP"),
    createEmptyPracticeExercise("CHOOSE_PARTICLE"),
  ]);
}

function normalizePracticeKind(value: string | undefined): PracticeExerciseKind {
  return value === "DESCRIPTION" ||
    value === "FILL_GAP" ||
    value === "CHOOSE_PARTICLE" ||
    value === "INLINE_CHOICE" ||
    value === "CONJUGATION_CHOICE" ||
    value === "TYPE_ANSWER" ||
    value === "DIALOGUE_FILL" ||
    value === "MATCH_PAIRS" ||
    value === "HANDWRITING_TRACE" ||
    value === "LISTEN_CHOOSE" ||
    value === "LISTEN_TYPE"
    ? value
    : "BUILD_SENTENCE";
}

function splitDraftList(value: string[] | string | undefined) {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }

  return (value ?? "")
    .split(/[\n,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePracticeExerciseDraft(exercise: {
  kind?: string;
  prompt?: string;
  description?: string;
  sentence?: string;
  answer?: string;
  words?: string[] | string;
  options?: string[] | string;
  inlineChoices?: Array<{
    sentence?: string;
    answer?: string;
    options?: string[] | string;
    explanation?: string;
  }>;
  typeAnswers?: Array<{
    question?: string;
    sentence?: string;
    answer?: string;
    explanation?: string;
    imageUrl?: string;
  }>;
  dialogueItems?: Array<{
    question?: string;
    sentence?: string;
    answer?: string;
    explanation?: string;
    imageUrl?: string;
    isExample?: boolean;
  }>;
  pairs?: Array<{ left?: string; right?: string }>;
  imageUrl?: string;
  mobileImageUrls?: string[];
  mobileImageUrl?: string;
  audioUrl?: string;
  baseWord?: string;
  grammarForm?: string;
  category?: string;
  minStrokeLength?: number;
  explanation?: string;
}): PracticeExerciseDraft {
  const kind = normalizePracticeKind(exercise.kind);
  const fallback = createEmptyPracticeExercise(kind);
  const legacyInlineChoice: InlineChoiceItemDraft = {
    sentence: exercise.sentence ?? fallback.sentence,
    answer: exercise.answer ?? fallback.answer,
    options: splitDraftList(exercise.options).length > 0
      ? splitDraftList(exercise.options)
      : fallback.options,
    explanation: exercise.explanation ?? fallback.explanation,
  };
  const inlineChoices =
    kind === "INLINE_CHOICE" && Array.isArray(exercise.inlineChoices) && exercise.inlineChoices.length > 0
      ? exercise.inlineChoices.map((item) => ({
          sentence: item.sentence ?? "",
          answer: item.answer ?? "",
          options: splitDraftList(item.options),
          explanation: item.explanation ?? "",
        }))
      : kind === "INLINE_CHOICE"
        ? [legacyInlineChoice]
        : undefined;
  const legacyTypeAnswer: TypeAnswerItemDraft = {
    question: "",
    sentence: exercise.sentence ?? fallback.sentence,
    answer: exercise.answer ?? fallback.answer,
    explanation: exercise.explanation ?? fallback.explanation,
    imageUrl: exercise.imageUrl ?? fallback.imageUrl,
  };
  const typeAnswers =
    kind === "TYPE_ANSWER" && Array.isArray(exercise.typeAnswers) && exercise.typeAnswers.length > 0
      ? exercise.typeAnswers.map((item, itemIndex) => ({
          question: item.question ?? "",
          sentence: item.sentence ?? "",
          answer: item.answer ?? "",
          explanation: item.explanation ?? "",
          imageUrl: item.imageUrl ?? (itemIndex === 0 ? exercise.imageUrl ?? "" : ""),
        }))
      : kind === "TYPE_ANSWER"
        ? [legacyTypeAnswer]
        : undefined;
  const dialogueItems =
    kind === "DIALOGUE_FILL" && Array.isArray(exercise.dialogueItems) && exercise.dialogueItems.length > 0
      ? exercise.dialogueItems.map((item) => ({
          question: item.question ?? "",
          sentence: item.sentence ?? "",
          answer: item.answer ?? "",
          explanation: item.explanation ?? "",
          imageUrl: item.imageUrl ?? "",
          isExample: Boolean(item.isExample),
        }))
      : kind === "DIALOGUE_FILL"
        ? fallback.dialogueItems
        : undefined;

  return {
    kind,
    prompt: keepValueOrFallback(exercise.prompt, fallback.prompt),
    description: exercise.description ?? fallback.description,
    sentence: exercise.sentence ?? fallback.sentence,
    answer: exercise.answer ?? fallback.answer,
    words: splitDraftList(exercise.words).length > 0 ? splitDraftList(exercise.words) : fallback.words,
    options: splitDraftList(exercise.options).length > 0 ? splitDraftList(exercise.options) : fallback.options,
    inlineChoices,
    typeAnswers,
    dialogueItems,
    pairs:
      Array.isArray(exercise.pairs) && exercise.pairs.length > 0
        ? exercise.pairs.map((pair) => ({
            left: pair.left ?? "",
            right: pair.right ?? "",
          }))
        : fallback.pairs,
    imageUrl: exercise.imageUrl ?? fallback.imageUrl,
    mobileImageUrls: Array.isArray(exercise.mobileImageUrls)
      ? exercise.mobileImageUrls.map((url) => url.trim()).filter(Boolean)
      : exercise.mobileImageUrl?.trim()
        ? [exercise.mobileImageUrl.trim()]
        : fallback.mobileImageUrls,
    audioUrl: exercise.audioUrl ?? fallback.audioUrl,
    baseWord: exercise.baseWord ?? fallback.baseWord ?? "",
    grammarForm: exercise.grammarForm ?? fallback.grammarForm ?? "",
    category: exercise.category ?? fallback.category ?? "",
    minStrokeLength:
      typeof exercise.minStrokeLength === "number" && Number.isFinite(exercise.minStrokeLength)
        ? exercise.minStrokeLength <= 100
          ? Math.max(20, Math.min(95, exercise.minStrokeLength))
          : Math.max(80, exercise.minStrokeLength)
        : fallback.minStrokeLength,
    explanation: exercise.explanation ?? fallback.explanation,
  };
}

function parsePracticeEditorContent(content: string): PracticeContentDraft | null {
  const trimmed = getStepContentBody(content).trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      tasksPerPage?: number;
      exercises?: Array<{
        kind?: string;
        prompt?: string;
        description?: string;
        sentence?: string;
        answer?: string;
        words?: string[] | string;
        options?: string[] | string;
        inlineChoices?: Array<{
          sentence?: string;
          answer?: string;
          options?: string[] | string;
          explanation?: string;
        }>;
        typeAnswers?: Array<{
          question?: string;
          sentence?: string;
          answer?: string;
          explanation?: string;
          imageUrl?: string;
        }>;
        dialogueItems?: Array<{
          question?: string;
          sentence?: string;
          answer?: string;
          explanation?: string;
          imageUrl?: string;
          isExample?: boolean;
        }>;
        pairs?: Array<{ left?: string; right?: string }>;
        imageUrl?: string;
        mobileImageUrls?: string[];
        mobileImageUrl?: string;
        audioUrl?: string;
        baseWord?: string;
        grammarForm?: string;
        category?: string;
        minStrokeLength?: number;
        explanation?: string;
      }>;
    };

    if (!Array.isArray(parsed.exercises)) {
      return null;
    }

    return {
      exercises: parsed.exercises.map((exercise) => normalizePracticeExerciseDraft(exercise)),
      tasksPerPage:
        typeof parsed.tasksPerPage === "number" && Number.isFinite(parsed.tasksPerPage)
          ? Math.max(1, Math.min(20, Math.round(parsed.tasksPerPage)))
          : 5,
    };
  } catch {
    return null;
  }
}

function serializePracticeEditorContent(exercises: PracticeExerciseDraft[], tasksPerPage = 5) {
  return JSON.stringify(
    {
      tasksPerPage: Math.max(1, Math.min(20, Math.round(tasksPerPage))),
      exercises: exercises.map((exercise) => ({
        kind: exercise.kind,
        prompt: keepValueOrFallback(exercise.prompt, createEmptyPracticeExercise(exercise.kind).prompt),
        description: exercise.description,
        sentence: exercise.sentence,
        answer: exercise.answer,
        words: exercise.words.map((word) => word.trim()).filter(Boolean),
        options: exercise.options.map((option) => option.trim()).filter(Boolean),
        inlineChoices: exercise.inlineChoices?.map((item) => ({
          sentence: item.sentence,
          answer: item.answer,
          options: item.options.map((option) => option.trim()).filter(Boolean),
          explanation: item.explanation,
        })),
        typeAnswers: exercise.typeAnswers?.map((item) => ({
          question: item.question,
          sentence: item.sentence,
          answer: item.answer,
          explanation: item.explanation,
          imageUrl: item.imageUrl,
        })),
        dialogueItems: exercise.dialogueItems?.map((item) => ({
          question: item.question,
          sentence: item.sentence,
          answer: item.answer,
          explanation: item.explanation,
          imageUrl: item.imageUrl,
          isExample: item.isExample,
        })),
        pairs: exercise.pairs.map((pair) => ({
          left: pair.left,
          right: pair.right,
        })),
        imageUrl: exercise.imageUrl,
        mobileImageUrls: exercise.mobileImageUrls,
        audioUrl: exercise.audioUrl,
        baseWord: exercise.baseWord ?? "",
        grammarForm: exercise.grammarForm ?? "",
        category: exercise.category ?? "",
        minStrokeLength:
          exercise.kind === "HANDWRITING_TRACE"
            ? Math.max(20, Math.min(95, exercise.minStrokeLength || 48))
            : Math.max(80, exercise.minStrokeLength || 420),
        explanation: exercise.explanation,
      })),
    },
    null,
    2,
  );
}

function renumberFlexibleStepTitles<
  TStep extends AdminCourseLevel["units"][number]["lessons"][number]["steps"][number],
>(steps: TStep[]) {
  return steps.map((step, index) =>
    /^Шаг \d+$/u.test(step.title.trim())
      ? {
          ...step,
          title: `Шаг ${index + 1}`,
        }
      : step,
  );
}

type Props = {
  level: AdminCourseLevel;
  levelIndex: number;
  setLevels: Dispatch<SetStateAction<AdminCourseLevel[]>>;
  visibleUnitIds?: string[] | null;
  visibleLessonIds?: string[] | null;
  onImageSelect: (
    event: ChangeEvent<HTMLInputElement>,
    apply: (value: string) => void,
  ) => Promise<void>;
  onAudioSelect: (
    event: ChangeEvent<HTMLInputElement>,
    apply: (value: string, fileName: string) => void,
  ) => Promise<void>;
  onSaveLesson?: () => void;
  onDeleteLesson?: (unitIndex: number, lessonIndex: number) => void;
  savingLesson?: boolean;
};

export function AdminLevelEditor({
  level,
  levelIndex,
  setLevels,
  visibleUnitIds,
  visibleLessonIds,
  onImageSelect,
  onAudioSelect,
  onSaveLesson,
  onDeleteLesson,
  savingLesson = false,
}: Props) {
  const [aiPrompts, setAiPrompts] = useState<Record<string, string>>({});
  const [aiLoadingKey, setAiLoadingKey] = useState<string | null>(null);
  const [aiErrors, setAiErrors] = useState<Record<string, string>>({});
  const [aiSuccesses, setAiSuccesses] = useState<Record<string, string>>({});
  const [aiProvider, setAiProvider] = useState<AIProvider>("openai");
  const [imagePrompts, setImagePrompts] = useState<Record<string, string>>({});
  const [imageLoadingKey, setImageLoadingKey] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, string>>({});
  const [imageSuccesses, setImageSuccesses] = useState<Record<string, string>>({});
  const [stepAiProvider, setStepAiProvider] = useState<AIProvider>("openai");
  const [stepAiOutputMode, setStepAiOutputMode] = useState<AIStepOutputMode>("structured");
  const [vocabularyWords, setVocabularyWords] = useState<AdminVocabularyWordOption[]>([]);
  const [vocabularySearch, setVocabularySearch] = useState<Record<string, string>>({});
  const [practiceWordsDrafts, setPracticeWordsDrafts] = useState<Record<string, string>>({});
  const [practiceOptionsDrafts, setPracticeOptionsDrafts] = useState<Record<string, string>>({});
  const [selectedStepIndexes, setSelectedStepIndexes] = useState<Record<string, number>>({});
  const [expandedContentImageSteps, setExpandedContentImageSteps] = useState<Record<string, boolean>>({});
  const stepContentRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    let active = true;

    const loadVocabularyWords = async () => {
      try {
        const response = await fetch("/api/admin/vocabulary", { cache: "no-store" });
        const payload = (await response.json()) as {
          words?: AdminVocabularyWordOption[];
          error?: string;
        };

        if (active && response.ok) {
          setVocabularyWords((payload.words ?? []).filter((word) => word.isActive));
        }
      } catch {
        if (active) {
          setVocabularyWords([]);
        }
      }
    };

    void loadVocabularyWords();

    return () => {
      active = false;
    };
  }, []);

  const setLevelValue = (key: keyof AdminCourseLevel, value: string) => {
    setLevels((current) =>
      current.map((entry, index) => (index === levelIndex ? { ...entry, [key]: value } : entry)),
    );
  };

  const setUnitValue = (
    unitIndex: number,
    key: keyof AdminCourseLevel["units"][number],
    value: string | boolean | null,
  ) => {
    setLevels((current) =>
      current.map((entry, index) =>
        index !== levelIndex
          ? entry
          : {
              ...entry,
              units: entry.units.map((unit, innerIndex) =>
                innerIndex === unitIndex ? { ...unit, [key]: value } : unit,
              ),
            },
      ),
    );
  };

  const setLessonValue = (
    unitIndex: number,
    lessonIndex: number,
    key: keyof AdminCourseLevel["units"][number]["lessons"][number],
    value: string | boolean | number | string[] | null,
  ) => {
    setLevels((current) =>
      current.map((entry, index) =>
        index !== levelIndex
          ? entry
          : {
              ...entry,
              units: entry.units.map((unit, unitInnerIndex) =>
                unitInnerIndex !== unitIndex
                  ? unit
                  : {
                      ...unit,
                      lessons: unit.lessons.map((lesson, lessonInnerIndex) =>
                        lessonInnerIndex === lessonIndex ? { ...lesson, [key]: value } : lesson,
                      ),
                    },
              ),
            },
      ),
    );
  };

  const toggleLessonVocabularyWord = (
    unitIndex: number,
    lessonIndex: number,
    wordId: string,
  ) => {
    setLevels((current) =>
      current.map((entry, index) =>
        index !== levelIndex
          ? entry
          : {
              ...entry,
              units: entry.units.map((unit, unitInnerIndex) =>
                unitInnerIndex !== unitIndex
                  ? unit
                  : {
                      ...unit,
                      lessons: unit.lessons.map((lesson, lessonInnerIndex) => {
                        if (lessonInnerIndex !== lessonIndex) {
                          return lesson;
                        }

                        const currentIds = lesson.vocabularyWordIds ?? [];
                        const nextIds = currentIds.includes(wordId)
                          ? currentIds.filter((id) => id !== wordId)
                          : [...currentIds, wordId];

                        return { ...lesson, vocabularyWordIds: nextIds };
                      }),
                    },
              ),
            },
      ),
    );
  };

  const setStepValue = (
    unitIndex: number,
    lessonIndex: number,
    stepIndex: number,
    key: "type" | "title" | "content" | "imageUrl",
    value: string | null,
  ) => {
    setLevels((current) =>
      current.map((entry, index) =>
        index !== levelIndex
          ? entry
          : {
              ...entry,
              units: entry.units.map((unit, unitInnerIndex) =>
                unitInnerIndex !== unitIndex
                  ? unit
                  : {
                      ...unit,
                      lessons: unit.lessons.map((lesson, lessonInnerIndex) =>
                        lessonInnerIndex !== lessonIndex
                          ? lesson
                          : {
                              ...lesson,
                              steps: lesson.steps.map((step, stepInnerIndex) =>
                                stepInnerIndex === stepIndex ? { ...step, [key]: value } : step,
                              ),
                            },
                      ),
                    },
              ),
            },
      ),
    );
  };

  const setStepType = (
    unitIndex: number,
    lessonIndex: number,
    stepIndex: number,
    nextType: CourseStepType,
  ) => {
    setLevels((current) =>
      current.map((entry, index) =>
        index !== levelIndex
          ? entry
          : {
              ...entry,
              units: entry.units.map((unit, unitInnerIndex) =>
                unitInnerIndex !== unitIndex
                  ? unit
                  : {
                      ...unit,
                      lessons: unit.lessons.map((lesson, lessonInnerIndex) => {
                        if (lessonInnerIndex !== lessonIndex) {
                          return lesson;
                        }

                        return {
                          ...lesson,
                          mode:
                            lesson.mode === "STANDARD" && lesson.steps[stepIndex]?.type !== nextType
                              ? "FLEXIBLE"
                              : lesson.mode,
                          steps: lesson.steps.map((step, stepInnerIndex) => {
                            if (stepInnerIndex !== stepIndex) {
                              return step;
                            }

                            return {
                              ...step,
                              type: nextType,
                              content:
                                nextType === "QUIZ" && !parseQuizEditorContent(step.content)
                                  ? setStepContentBody(step.content, createQuizTemplate())
                                  : nextType === "PRACTICE" && !parsePracticeEditorContent(step.content)
                                    ? step.content
                                  : step.content,
                            };
                          }),
                        };
                      }),
                    },
              ),
            },
      ),
    );
  };

  const setStepContent = (
    unitIndex: number,
    lessonIndex: number,
    stepIndex: number,
    content: string,
  ) => {
    setLevels((current) =>
      current.map((entry, index) =>
        index !== levelIndex
          ? entry
          : {
              ...entry,
              units: entry.units.map((unit, unitInnerIndex) =>
                unitInnerIndex !== unitIndex
                  ? unit
                  : {
                      ...unit,
                      lessons: unit.lessons.map((lesson, lessonInnerIndex) =>
                        lessonInnerIndex !== lessonIndex
                          ? lesson
                          : {
                              ...lesson,
                              steps: lesson.steps.map((step, stepInnerIndex) =>
                                stepInnerIndex !== stepIndex
                                  ? step
                                  : {
                                      ...step,
                                      content: setStepContentBody(step.content, content),
                                    },
                              ),
                            },
                      ),
                    },
              ),
            },
      ),
    );
  };

  const setStepImagePlacement = (
    unitIndex: number,
    lessonIndex: number,
    stepIndex: number,
    placement: StepImagePlacement,
  ) => {
    setLevels((current) =>
      current.map((entry, index) =>
        index !== levelIndex
          ? entry
          : {
              ...entry,
              units: entry.units.map((unit, unitInnerIndex) =>
                unitInnerIndex !== unitIndex
                  ? unit
                  : {
                      ...unit,
                      lessons: unit.lessons.map((lesson, lessonInnerIndex) =>
                        lessonInnerIndex !== lessonIndex
                          ? lesson
                          : {
                              ...lesson,
                              steps: lesson.steps.map((step, stepInnerIndex) =>
                                stepInnerIndex !== stepIndex
                                  ? step
                                  : {
                                      ...step,
                                      content: withStepImagePlacement(step.content, placement),
                                    },
                              ),
                            },
                      ),
                    },
              ),
            },
      ),
    );
  };

  const updateQuizStepContent = (
    unitIndex: number,
    lessonIndex: number,
    stepIndex: number,
    updater: (draft: QuizContentDraft) => QuizContentDraft,
  ) => {
    setLevels((current) =>
      current.map((entry, index) =>
        index !== levelIndex
          ? entry
          : {
              ...entry,
              units: entry.units.map((unit, unitInnerIndex) =>
                unitInnerIndex !== unitIndex
                  ? unit
                  : {
                      ...unit,
                      lessons: unit.lessons.map((lesson, lessonInnerIndex) => {
                        if (lessonInnerIndex !== lessonIndex) {
                          return lesson;
                        }

                        return {
                          ...lesson,
                          steps: lesson.steps.map((step, stepInnerIndex) => {
                            if (stepInnerIndex !== stepIndex) {
                              return step;
                            }

                            const parsed =
                              parseQuizEditorContent(step.content) ?? {
                                questions: [createEmptyQuizQuestion("CHOICE")],
                              };
                            const nextDraft = updater(parsed);

                            return {
                              ...step,
                              content: setStepContentBody(
                                step.content,
                                serializeQuizEditorContent(nextDraft.questions),
                              ),
                            };
                          }),
                        };
                      }),
                    },
              ),
            },
      ),
    );
  };

  const updatePracticeStepContent = (
    unitIndex: number,
    lessonIndex: number,
    stepIndex: number,
    updater: (draft: PracticeContentDraft) => PracticeContentDraft,
  ) => {
    setLevels((current) =>
      current.map((entry, index) =>
        index !== levelIndex
          ? entry
          : {
              ...entry,
              units: entry.units.map((unit, unitInnerIndex) =>
                unitInnerIndex !== unitIndex
                  ? unit
                  : {
                      ...unit,
                      lessons: unit.lessons.map((lesson, lessonInnerIndex) => {
                        if (lessonInnerIndex !== lessonIndex) {
                          return lesson;
                        }

                        return {
                          ...lesson,
                          steps: lesson.steps.map((step, stepInnerIndex) => {
                            if (stepInnerIndex !== stepIndex) {
                              return step;
                            }

                            const parsed =
                              parsePracticeEditorContent(step.content) ?? {
                                exercises: [createEmptyPracticeExercise("BUILD_SENTENCE")],
                                tasksPerPage: 5,
                              };
                            const updatedDraft = updater(parsed);
                            const nextDraft = { ...parsed, ...updatedDraft };

                            return {
                              ...step,
                              content: setStepContentBody(
                                step.content,
                                serializePracticeEditorContent(nextDraft.exercises, nextDraft.tasksPerPage),
                              ),
                            };
                          }),
                        };
                      }),
                    },
              ),
            },
      ),
    );
  };

  const updateLessonChoiceExercise = (
    unitIndex: number,
    lessonIndex: number,
    stepIndex: number,
    exerciseIndex: number,
    updater: (exercise: LessonChoiceExercise) => LessonChoiceExercise | null,
  ) => {
    setLevels((current) =>
      current.map((entry, levelInnerIndex) =>
        levelInnerIndex !== levelIndex
          ? entry
          : {
              ...entry,
              units: entry.units.map((unit, unitInnerIndex) =>
                unitInnerIndex !== unitIndex
                  ? unit
                  : {
                      ...unit,
                      lessons: unit.lessons.map((lesson, lessonInnerIndex) =>
                        lessonInnerIndex !== lessonIndex
                          ? lesson
                          : {
                              ...lesson,
                              steps: lesson.steps.map((step, stepInnerIndex) => {
                                if (stepInnerIndex !== stepIndex) {
                                  return step;
                                }

                                const body = getStepContentBody(step.content);
                                const exercise = extractLessonChoiceExercises(body)[exerciseIndex];
                                if (!exercise) {
                                  return step;
                                }

                                return {
                                  ...step,
                                  content: setStepContentBody(
                                    step.content,
                                    replaceLessonChoiceExercise(body, exerciseIndex, updater(exercise)),
                                  ),
                                };
                              }),
                            },
                      ),
                    },
              ),
            },
      ),
    );
  };

  const appendContentImageToStep = (
    unitIndex: number,
    lessonIndex: number,
    stepIndex: number,
    imageUrl: string,
  ) => {
    setLevels((current) =>
      current.map((entry, index) =>
        index !== levelIndex
          ? entry
          : {
              ...entry,
              units: entry.units.map((unit, unitInnerIndex) =>
                unitInnerIndex !== unitIndex
                  ? unit
                  : {
                      ...unit,
                      lessons: unit.lessons.map((lesson, lessonInnerIndex) =>
                        lessonInnerIndex !== lessonIndex
                          ? lesson
                          : {
                              ...lesson,
                              steps: lesson.steps.map((step, stepInnerIndex) =>
                                stepInnerIndex !== stepIndex
                                  ? step
                                  : {
                                      ...step,
                                      content: setStepContentBody(
                                        step.content,
                                        appendContentImageMarkup(getStepContentBody(step.content), imageUrl),
                                      ),
                                    },
                              ),
                            },
                      ),
                    },
              ),
            },
      ),
    );
  };

  const setContentImageMobilesForStep = (
    unitIndex: number,
    lessonIndex: number,
    stepIndex: number,
    imageIndex: number,
    mobileUrls: string[],
  ) => {
    setLevels((current) =>
      current.map((entry, index) =>
        index !== levelIndex
          ? entry
          : {
              ...entry,
              units: entry.units.map((unit, unitInnerIndex) =>
                unitInnerIndex !== unitIndex
                  ? unit
                  : {
                      ...unit,
                      lessons: unit.lessons.map((lesson, lessonInnerIndex) =>
                        lessonInnerIndex !== lessonIndex
                          ? lesson
                          : {
                              ...lesson,
                              steps: lesson.steps.map((step, stepInnerIndex) =>
                                stepInnerIndex !== stepIndex
                                  ? step
                                  : {
                                      ...step,
                                      content: setContentImageMobileUrls(
                                        step.content,
                                        imageIndex,
                                        mobileUrls,
                                      ),
                                    },
                              ),
                            },
                      ),
                    },
              ),
            },
      ),
    );
  };

  const setContentImageVisibilityForStep = (
    unitIndex: number,
    lessonIndex: number,
    stepIndex: number,
    imageIndex: number,
    hiddenOnMobile: boolean,
  ) => {
    setLevels((current) =>
      current.map((entry, index) =>
        index !== levelIndex
          ? entry
          : {
              ...entry,
              units: entry.units.map((unit, unitInnerIndex) =>
                unitInnerIndex !== unitIndex
                  ? unit
                  : {
                      ...unit,
                      lessons: unit.lessons.map((lesson, lessonInnerIndex) =>
                        lessonInnerIndex !== lessonIndex
                          ? lesson
                          : {
                              ...lesson,
                              steps: lesson.steps.map((step, stepInnerIndex) =>
                                stepInnerIndex !== stepIndex
                                  ? step
                                  : {
                                      ...step,
                                      content: setContentImageHiddenOnMobile(
                                        step.content,
                                        imageIndex,
                                        hiddenOnMobile,
                                      ),
                                    },
                              ),
                            },
                      ),
                    },
              ),
            },
      ),
    );
  };

  const appendContentAudioToStep = (
    unitIndex: number,
    lessonIndex: number,
    stepIndex: number,
    audioUrl: string,
    label: string,
  ) => {
    setLevels((current) =>
      current.map((entry, index) =>
        index !== levelIndex
          ? entry
          : {
              ...entry,
              units: entry.units.map((unit, unitInnerIndex) =>
                unitInnerIndex !== unitIndex
                  ? unit
                  : {
                      ...unit,
                      lessons: unit.lessons.map((lesson, lessonInnerIndex) =>
                        lessonInnerIndex !== lessonIndex
                          ? lesson
                          : {
                              ...lesson,
                              steps: lesson.steps.map((step, stepInnerIndex) =>
                                stepInnerIndex !== stepIndex
                                  ? step
                                  : {
                                      ...step,
                                      content: setStepContentBody(
                                        step.content,
                                        appendContentAudioMarkup(
                                          getStepContentBody(step.content),
                                          audioUrl,
                                          label,
                                        ),
                                      ),
                                    },
                              ),
                            },
                      ),
                    },
              ),
            },
      ),
    );
  };

  const setStepContentRef = (stepKey: string, node: HTMLTextAreaElement | null) => {
    stepContentRefs.current[stepKey] = node;
  };

  const editStepContent = (
    unitIndex: number,
    lessonIndex: number,
    stepIndex: number,
    stepKey: string,
    rawContent: string,
    transform: (
      body: string,
      selectionStart: number,
      selectionEnd: number,
    ) => {
      nextBody: string;
      nextSelectionStart: number;
      nextSelectionEnd: number;
    },
  ) => {
    const textarea = stepContentRefs.current[stepKey];
    const body = getStepContentBody(rawContent);
    const selectionStart = textarea?.selectionStart ?? body.length;
    const selectionEnd = textarea?.selectionEnd ?? body.length;
    const next = transform(body, selectionStart, selectionEnd);

    setStepContent(unitIndex, lessonIndex, stepIndex, next.nextBody);

    requestAnimationFrame(() => {
      const nextTextarea = stepContentRefs.current[stepKey];
      if (!nextTextarea) {
        return;
      }

      nextTextarea.focus();
      nextTextarea.setSelectionRange(next.nextSelectionStart, next.nextSelectionEnd);
    });
  };

  const wrapSelectedStepContent = (
    unitIndex: number,
    lessonIndex: number,
    stepIndex: number,
    stepKey: string,
    rawContent: string,
    prefix: string,
    suffix: string,
    placeholder: string,
  ) => {
    editStepContent(
      unitIndex,
      lessonIndex,
      stepIndex,
      stepKey,
      rawContent,
      (body, selectionStart, selectionEnd) => {
        const selectedText = body.slice(selectionStart, selectionEnd) || placeholder;
        const replacement = `${prefix}${selectedText}${suffix}`;

        return {
          nextBody:
            body.slice(0, selectionStart) + replacement + body.slice(selectionEnd),
          nextSelectionStart: selectionStart + prefix.length,
          nextSelectionEnd: selectionStart + prefix.length + selectedText.length,
        };
      },
    );
  };

  const insertBlockIntoStepContent = (
    unitIndex: number,
    lessonIndex: number,
    stepIndex: number,
    stepKey: string,
    rawContent: string,
    block: string,
  ) => {
    editStepContent(
      unitIndex,
      lessonIndex,
      stepIndex,
      stepKey,
      rawContent,
      (body, selectionStart, selectionEnd) => {
        const prefix =
          selectionStart === 0 || body.slice(0, selectionStart).endsWith("\n\n")
            ? ""
            : "\n\n";
        const suffix =
          selectionEnd === body.length || body.slice(selectionEnd).startsWith("\n\n")
            ? ""
            : "\n\n";
        const replacement = `${prefix}${block}${suffix}`;
        const cursor = selectionStart + prefix.length + block.length;

        return {
          nextBody:
            body.slice(0, selectionStart) + replacement + body.slice(selectionEnd),
          nextSelectionStart: cursor,
          nextSelectionEnd: cursor,
        };
      },
    );
  };

  const updateLessonStructure = (
    unitIndex: number,
    lessonIndex: number,
    updateSteps: (
      steps: AdminCourseLevel["units"][number]["lessons"][number]["steps"],
    ) => AdminCourseLevel["units"][number]["lessons"][number]["steps"],
  ) => {
    setLevels((current) =>
      current.map((entry, index) =>
        index !== levelIndex
          ? entry
          : {
              ...entry,
              units: entry.units.map((unit, unitInnerIndex) =>
                unitInnerIndex !== unitIndex
                  ? unit
                  : {
                      ...unit,
                      lessons: unit.lessons.map((lesson, lessonInnerIndex) => {
                        if (lessonInnerIndex !== lessonIndex) {
                          return lesson;
                        }

                        const nextSteps = updateSteps(lesson.steps);
                        if (nextSteps === lesson.steps) {
                          return lesson;
                        }

                        return {
                          ...lesson,
                          mode: "FLEXIBLE",
                          steps: renumberFlexibleStepTitles(nextSteps),
                        };
                      }),
                    },
              ),
            },
      ),
    );
  };

  const setUnitTitle = (unitIndex: number, title: string) => {
    setLevels((current) =>
      current.map((entry, index) => {
        if (index !== levelIndex) {
          return entry;
        }

        return {
          ...entry,
          units: entry.units.map((unit, innerIndex) => {
            if (innerIndex !== unitIndex) {
              return unit;
            }

            const nextSlug = isGeneratedSlug(unit.slug, "unit")
              ? makeUniqueSlug(
                  title,
                  entry.units.flatMap((candidate, candidateIndex) =>
                    candidateIndex === unitIndex ? [] : [candidate.slug],
                  ),
                )
              : unit.slug;

            return {
              ...unit,
              title,
              slug: nextSlug,
            };
          }),
        };
      }),
    );
  };

  const setUnitSlug = (unitIndex: number, value: string) => {
    setLevels((current) =>
      current.map((entry, index) => {
        if (index !== levelIndex) {
          return entry;
        }

        return {
          ...entry,
          units: entry.units.map((unit, innerIndex) =>
            innerIndex !== unitIndex
              ? unit
              : {
                  ...unit,
                  slug: makeUniqueSlug(
                    value,
                    entry.units.flatMap((candidate, candidateIndex) =>
                      candidateIndex === unitIndex ? [] : [candidate.slug],
                    ),
                  ),
                },
          ),
        };
      }),
    );
  };

  const setLessonTitle = (unitIndex: number, lessonIndex: number, title: string) => {
    setLevels((current) =>
      current.map((entry, index) => {
        if (index !== levelIndex) {
          return entry;
        }

        return {
          ...entry,
          units: entry.units.map((unit, unitInnerIndex) => {
            if (unitInnerIndex !== unitIndex) {
              return unit;
            }

            return {
              ...unit,
              lessons: unit.lessons.map((lesson, lessonInnerIndex) => {
                if (lessonInnerIndex !== lessonIndex) {
                  return lesson;
                }

                const nextSlug = isGeneratedSlug(lesson.slug, "lesson")
                  ? makeUniqueSlug(
                      title,
                      unit.lessons.flatMap((candidate, candidateIndex) =>
                        candidateIndex === lessonIndex ? [] : [candidate.slug],
                      ),
                    )
                  : lesson.slug;

                return {
                  ...lesson,
                  title,
                  slug: nextSlug,
                };
              }),
            };
          }),
        };
      }),
    );
  };

  const setLessonSlug = (unitIndex: number, lessonIndex: number, value: string) => {
    setLevels((current) =>
      current.map((entry, index) => {
        if (index !== levelIndex) {
          return entry;
        }

        return {
          ...entry,
          units: entry.units.map((unit, unitInnerIndex) => {
            if (unitInnerIndex !== unitIndex) {
              return unit;
            }

            return {
              ...unit,
              lessons: unit.lessons.map((lesson, lessonInnerIndex) =>
                lessonInnerIndex !== lessonIndex
                  ? lesson
                  : {
                      ...lesson,
                      slug: makeUniqueSlug(
                        value,
                        unit.lessons.flatMap((candidate, candidateIndex) =>
                          candidateIndex === lessonIndex ? [] : [candidate.slug],
                        ),
                      ),
                    },
              ),
            };
          }),
        };
      }),
    );
  };

  const getLessonKey = (unitIndex: number, lessonIndex: number) =>
    `${levelIndex}:${unitIndex}:${lessonIndex}`;

  const getStepKey = (unitIndex: number, lessonIndex: number, stepIndex: number) =>
    `${levelIndex}:${unitIndex}:${lessonIndex}:${stepIndex}`;

  const applyGeneratedLesson = (
    unitIndex: number,
    lessonIndex: number,
    lessonDraft: AdminCourseLevel["units"][number]["lessons"][number],
  ) => {
    setLevels((current) =>
      current.map((entry, index) =>
        index !== levelIndex
          ? entry
          : {
              ...entry,
              units: entry.units.map((unit, unitInnerIndex) =>
                unitInnerIndex !== unitIndex
                  ? unit
                  : {
                      ...unit,
                      lessons: unit.lessons.map((lesson, lessonInnerIndex) =>
                        lessonInnerIndex !== lessonIndex
                          ? lesson
                          : {
                              ...lesson,
                              title: lessonDraft.title,
                              slug: makeUniqueSlug(
                                lessonDraft.slug || lessonDraft.title,
                                unit.lessons.flatMap((candidate, candidateIndex) =>
                                  candidateIndex === lessonIndex ? [] : [candidate.slug],
                                ),
                              ),
                              summary: lessonDraft.summary,
                              estimatedMinutes: lessonDraft.estimatedMinutes,
                              mode: lessonDraft.mode,
                              steps: lessonDraft.steps,
                            },
                      ),
                    },
              ),
            },
      ),
    );
  };

  const generateLessonWithAi = async (
    unitIndex: number,
    lessonIndex: number,
    lesson: AdminCourseLevel["units"][number]["lessons"][number],
    unit: AdminCourseLevel["units"][number],
  ) => {
    const lessonKey = getLessonKey(unitIndex, lessonIndex);
    const prompt = aiPrompts[lessonKey]?.trim();

    if (!prompt) {
      setAiErrors((current) => ({
        ...current,
        [lessonKey]: "Добавьте запрос для AI перед генерацией урока.",
      }));
      return;
    }

    setAiLoadingKey(lessonKey);
    setAiErrors((current) => ({ ...current, [lessonKey]: "" }));
    setAiSuccesses((current) => ({ ...current, [lessonKey]: "" }));

    try {
      const response = await fetch("/api/admin/courses/lesson-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          levelTitle: level.title,
          levelNumber: level.number,
          unitTitle: unit.title,
          unitDescription: unit.description,
          lessonMode: lesson.mode,
          request: prompt,
          provider: aiProvider,
          currentLessonTitle: lesson.title,
          currentLessonSummary: lesson.summary,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        lesson?: {
          slug: string;
          title: string;
          summary: string;
          estimatedMinutes: number;
          mode: AdminCourseLevel["units"][number]["lessons"][number]["mode"];
          steps: AdminCourseLevel["units"][number]["lessons"][number]["steps"];
        };
      };

      if (!response.ok || !payload.lesson) {
        throw new Error(payload.error ?? "Не удалось сгенерировать урок через AI.");
      }

      applyGeneratedLesson(unitIndex, lessonIndex, {
        ...lesson,
        title: payload.lesson.title,
        slug: payload.lesson.slug,
        summary: payload.lesson.summary,
        estimatedMinutes: payload.lesson.estimatedMinutes,
        mode: payload.lesson.mode,
        steps: payload.lesson.steps.map((step) => ({
          ...step,
          imageUrl: step.imageUrl ?? null,
        })),
      });

      setAiSuccesses((current) => ({
        ...current,
        [lessonKey]:
          "Черновик урока обновлён. Проверьте шаги и затем сохраните этот урок.",
      }));
    } catch (error) {
      setAiErrors((current) => ({
        ...current,
        [lessonKey]:
          error instanceof Error ? error.message : "Не удалось сгенерировать урок через AI.",
      }));
    } finally {
      setAiLoadingKey(null);
    }
  };

  const generateStepContentWithAi = async (
    unitIndex: number,
    lessonIndex: number,
    stepIndex: number,
    unit: AdminCourseLevel["units"][number],
    lesson: AdminCourseLevel["units"][number]["lessons"][number],
    step: AdminCourseLevel["units"][number]["lessons"][number]["steps"][number],
  ) => {
    const stepKey = getStepKey(unitIndex, lessonIndex, stepIndex);
    const prompt = imagePrompts[stepKey]?.trim();

    if (!prompt) {
      setImageErrors((current) => ({
        ...current,
        [stepKey]: "Добавьте запрос для генерации изображения.",
      }));
      return;
    }

    setImageLoadingKey(stepKey);
    setImageErrors((current) => ({ ...current, [stepKey]: "" }));
    setImageSuccesses((current) => ({ ...current, [stepKey]: "" }));

    try {
      const response = await fetch("/api/admin/courses/step-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          levelTitle: level.title,
          unitTitle: unit.title,
          lessonTitle: lesson.title,
          lessonSummary: lesson.summary,
          stepTitle: step.title,
          stepType: step.type,
          currentContent: getStepContentBody(step.content),
          request: prompt,
          provider: stepAiProvider,
          outputMode: stepAiOutputMode,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        title?: string;
        content?: string;
        type?: CourseStepType;
        imageUrl?: string | null;
      };

      if (!response.ok || typeof payload.title !== "string" || typeof payload.content !== "string") {
        throw new Error(payload.error ?? "Не удалось сгенерировать содержимое шага.");
      }

      setStepValue(unitIndex, lessonIndex, stepIndex, "title", payload.title);
      if (payload.type) {
        setStepValue(unitIndex, lessonIndex, stepIndex, "type", payload.type);
      }
      setStepContent(unitIndex, lessonIndex, stepIndex, payload.content);
      if (typeof payload.imageUrl === "string" && payload.imageUrl.trim()) {
        setStepValue(unitIndex, lessonIndex, stepIndex, "imageUrl", payload.imageUrl);
      }
      setImageSuccesses((current) => ({
        ...current,
        [stepKey]: payload.imageUrl
          ? "Содержимое шага и иллюстрация обновлены. Проверьте результат и сохраните этот урок."
          : "Содержимое шага обновлено. Проверьте результат и сохраните этот урок.",
      }));
    } catch (error) {
      setImageErrors((current) => ({
        ...current,
        [stepKey]:
          error instanceof Error ? error.message : "Не удалось сгенерировать содержимое шага.",
      }));
    } finally {
      setImageLoadingKey(null);
    }
  };

  return (
    <article className="glass-card rounded-3xl px-6 py-7 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-dark)]">
            Уровень {level.number}
          </p>
          <h2 className="mt-1 text-2xl font-black">{level.title}</h2>
        </div>
        <div className="h-5 w-20 rounded-full border border-white/70" style={{ backgroundColor: level.accentColor }} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <input className="input-field" value={level.title} onChange={(event) => setLevelValue("title", event.target.value)} placeholder="Название уровня" />
        <input className="input-field" value={level.slug} onChange={(event) => setLevelValue("slug", slugify(event.target.value))} placeholder="level-slug" />
        <input className="input-field" value={level.accentColor} onChange={(event) => setLevelValue("accentColor", event.target.value)} placeholder="#5a6cff" />
      </div>
      <textarea className="input-field mt-3 min-h-28" value={level.description} onChange={(event) => setLevelValue("description", event.target.value)} placeholder="Описание уровня" />

      <div className="mt-6 space-y-4">
        {level.units.map((unit, unitIndex) =>
          visibleUnitIds && !visibleUnitIds.includes(unit.id ?? `draft-${unitIndex}`) ? null : (
          <div key={unit.id ?? `${level.id}-unit-${unitIndex}`} className="rounded-3xl border border-[var(--line)] bg-white/80 p-4">
            <SectionTop
              title={`Юнит ${unitIndex + 1}`}
              onUp={() =>
                setLevels((current) =>
                  current.map((entry, index) =>
                    index !== levelIndex ? entry : { ...entry, units: moveItem(entry.units, unitIndex, -1) },
                  ),
                )
              }
              onDown={() =>
                setLevels((current) =>
                  current.map((entry, index) =>
                    index !== levelIndex ? entry : { ...entry, units: moveItem(entry.units, unitIndex, 1) },
                  ),
                )
              }
              onDelete={() =>
                setLevels((current) =>
                  current.map((entry, index) =>
                    index !== levelIndex ? entry : { ...entry, units: entry.units.filter((_, idx) => idx !== unitIndex) },
                  ),
                )
              }
            />

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <input className="input-field" value={unit.title} onChange={(event) => setUnitTitle(unitIndex, event.target.value)} placeholder="Название юнита" />
              <input className="input-field" value={unit.slug} onChange={(event) => setUnitSlug(unitIndex, event.target.value)} placeholder="unit-slug" />
              <label className="flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold">
                <input type="checkbox" checked={unit.isPublished} onChange={(event) => setUnitValue(unitIndex, "isPublished", event.target.checked)} />
                Опубликован
              </label>
            </div>
            <textarea className="input-field mt-3 min-h-24" value={unit.description} onChange={(event) => setUnitValue(unitIndex, "description", event.target.value)} placeholder="Описание юнита" />
            <div className="mt-5 space-y-4">
              {unit.lessons.map((lesson, lessonIndex) => {
                if (visibleLessonIds && !visibleLessonIds.includes(lesson.id ?? `draft-lesson-${lessonIndex}`)) {
                  return null;
                }

                const lessonKey = getLessonKey(unitIndex, lessonIndex);
                const selectedStepIndex = Math.min(
                  selectedStepIndexes[lessonKey] ?? 0,
                  Math.max(lesson.steps.length - 1, 0),
                );
                const lessonVocabularyWordIds = lesson.vocabularyWordIds ?? [];
                const lessonVocabularyWords = lessonVocabularyWordIds
                  .map((wordId) => vocabularyWords.find((word) => word.id === wordId))
                  .filter(Boolean) as AdminVocabularyWordOption[];
                const vocabularyQuery = (vocabularySearch[lessonKey] ?? "").trim().toLowerCase();
                const vocabularyCandidates = vocabularyWords
                  .filter((word) => !lessonVocabularyWordIds.includes(word.id))
                  .filter((word) => {
                    if (!vocabularyQuery) {
                      return true;
                    }

                    return [word.korean, word.translation, word.transcription, word.category]
                      .filter(Boolean)
                      .some((value) => value!.toLowerCase().includes(vocabularyQuery));
                  })
                  .slice(0, 12);

                return (
                <div key={lesson.id ?? `${unit.slug}-lesson-${lessonIndex}`} className="rounded-3xl border border-[var(--line)] bg-slate-50 px-4 py-4">
                  <SectionTop
                    title={`Урок ${lessonIndex + 1}`}
                    onUp={() =>
                      setLevels((current) =>
                        current.map((entry, index) =>
                          index !== levelIndex
                            ? entry
                            : {
                                ...entry,
                                units: entry.units.map((entryUnit, innerUnitIndex) =>
                                  innerUnitIndex !== unitIndex
                                    ? entryUnit
                                    : { ...entryUnit, lessons: moveItem(entryUnit.lessons, lessonIndex, -1) },
                                ),
                              },
                        ),
                      )
                    }
                    onDown={() =>
                      setLevels((current) =>
                        current.map((entry, index) =>
                          index !== levelIndex
                            ? entry
                            : {
                                ...entry,
                                units: entry.units.map((entryUnit, innerUnitIndex) =>
                                  innerUnitIndex !== unitIndex
                                    ? entryUnit
                                    : { ...entryUnit, lessons: moveItem(entryUnit.lessons, lessonIndex, 1) },
                                ),
                              },
                        ),
                      )
                    }
                    onDelete={() => {
                      if (onDeleteLesson) {
                        onDeleteLesson(unitIndex, lessonIndex);
                        return;
                      }

                      setLevels((current) =>
                        current.map((entry, index) =>
                          index !== levelIndex
                            ? entry
                            : {
                                ...entry,
                                units: entry.units.map((entryUnit, innerUnitIndex) =>
                                  innerUnitIndex !== unitIndex
                                    ? entryUnit
                                    : { ...entryUnit, lessons: entryUnit.lessons.filter((_, idx) => idx !== lessonIndex) },
                                ),
                              },
                        ),
                      );
                    }}
                  />

                  <div className="mt-4 grid gap-3 md:grid-cols-5">
                    <input className="input-field" value={lesson.title} onChange={(event) => setLessonTitle(unitIndex, lessonIndex, event.target.value)} placeholder="Название урока" />
                    <input className="input-field" value={lesson.slug} onChange={(event) => setLessonSlug(unitIndex, lessonIndex, event.target.value)} placeholder="lesson-slug" />
                    <input className="input-field" type="number" min={1} value={lesson.estimatedMinutes} onChange={(event) => setLessonValue(unitIndex, lessonIndex, "estimatedMinutes", Number(event.target.value))} placeholder="Минуты" />
                    <select
                      className="input-field"
                      value={lesson.kind ?? "LESSON"}
                      onChange={(event) => {
                        const nextKind = event.target.value as CourseLessonKind;
                        setLevels((current) =>
                          current.map((entry, index) =>
                            index !== levelIndex
                              ? entry
                              : {
                                  ...entry,
                                  units: entry.units.map((entryUnit, innerUnitIndex) =>
                                    innerUnitIndex !== unitIndex
                                      ? entryUnit
                                      : {
                                          ...entryUnit,
                                          lessons: entryUnit.lessons.map((entryLesson, innerLessonIndex) => {
                                            if (innerLessonIndex !== lessonIndex) {
                                              return entryLesson;
                                            }

                                            if (!isAssessmentLessonKind(nextKind)) {
                                              return {
                                                ...entryLesson,
                                                kind: nextKind,
                                              };
                                            }

                                            return {
                                              ...entryLesson,
                                              kind: nextKind,
                                              mode: "FLEXIBLE",
                                              estimatedMinutes:
                                                entryLesson.estimatedMinutes || (nextKind === "FINAL_TEST" ? 20 : 8),
                                              steps: isAssessmentLessonKind(entryLesson.kind ?? "LESSON")
                                                ? entryLesson.steps.map((step, stepIndex) =>
                                                    stepIndex === 0 && step.type === "QUIZ"
                                                      ? { ...step, title: getAssessmentLessonTitle(nextKind) }
                                                      : step,
                                                  )
                                                : createAssessmentLessonSteps(nextKind),
                                            };
                                          }),
                                        },
                                  ),
                                },
                          ),
                        );
                      }}
                    >
                      <option value="LESSON">{COURSE_LESSON_KIND_LABELS.LESSON}</option>
                      <option value="MINI_QUIZ">{COURSE_LESSON_KIND_LABELS.MINI_QUIZ}</option>
                      <option value="FINAL_TEST">{COURSE_LESSON_KIND_LABELS.FINAL_TEST}</option>
                    </select>
                    <select
                      className="input-field"
                      value={lesson.mode}
                      onChange={(event) => {
                        const nextMode = event.target.value as AdminCourseLevel["units"][number]["lessons"][number]["mode"];
                        setLevels((current) =>
                          current.map((entry, index) =>
                            index !== levelIndex
                              ? entry
                              : {
                                  ...entry,
                                  units: entry.units.map((entryUnit, innerUnitIndex) =>
                                    innerUnitIndex !== unitIndex
                                      ? entryUnit
                                      : {
                                          ...entryUnit,
                                          lessons: entryUnit.lessons.map((entryLesson, innerLessonIndex) =>
                                            innerLessonIndex !== lessonIndex
                                              ? entryLesson
                                              : {
                                                  ...entryLesson,
                                                  mode: nextMode,
                                                  steps:
                                                    nextMode === "STANDARD"
                                                      ? STANDARD_STEP_SEQUENCE.map((type) => createStandardStep(type))
                                                      : [createEmptyFlexibleStep(0), createEmptyFlexibleStep(1)],
                                                },
                                          ),
                                        },
                                  ),
                                },
                          ),
                        );
                      }}
                    >
                      <option value="STANDARD">{COURSE_LESSON_MODE_LABELS.STANDARD}</option>
                      <option value="FLEXIBLE">{COURSE_LESSON_MODE_LABELS.FLEXIBLE}</option>
                    </select>
                  </div>

                  <textarea className="input-field mt-3 min-h-24" value={lesson.summary} onChange={(event) => setLessonValue(unitIndex, lessonIndex, "summary", event.target.value)} placeholder="Краткое описание урока" />
                  <div className="mt-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-dark)]">
                          Словарь урока
                        </p>
                        <h4 className="mt-1 text-base font-black">Слова из общей базы</h4>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--ink-soft)]">
                          Выберите слова один раз из библиотеки. Урок покажет карточки и
                          упражнения автоматически, а после завершения слова попадут в повторение.
                        </p>
                      </div>
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-600">
                        {lessonVocabularyWords.length} слов
                      </span>
                    </div>

                    <input
                      className="input-field mt-3"
                      value={vocabularySearch[lessonKey] ?? ""}
                      onChange={(event) =>
                        setVocabularySearch((current) => ({
                          ...current,
                          [lessonKey]: event.target.value,
                        }))
                      }
                      placeholder="Найти слово: 학교, школа, greetings..."
                    />

                    {lessonVocabularyWords.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {lessonVocabularyWords.map((word) => (
                          <button
                            key={word.id}
                            type="button"
                            className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700"
                            onClick={() => toggleLessonVocabularyWord(unitIndex, lessonIndex, word.id)}
                          >
                            {word.korean} — {word.translation} ×
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-[var(--ink-soft)]">
                        Пока слова не выбраны. Если в уроке есть шаг «Словарь», он будет использовать обычный текст шага.
                      </p>
                    )}

                    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {vocabularyCandidates.map((word) => (
                        <button
                          key={word.id}
                          type="button"
                          className="rounded-2xl border border-[var(--line)] bg-white px-3 py-3 text-left text-sm transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-sm"
                          onClick={() => toggleLessonVocabularyWord(unitIndex, lessonIndex, word.id)}
                        >
                          <span className="block text-base font-black text-slate-950">{word.korean}</span>
                          <span className="mt-1 block font-semibold text-slate-700">{word.translation}</span>
                          <span className="mt-1 block text-xs text-[var(--ink-soft)]">
                            {[word.transcription ? `[${word.transcription}]` : null, word.category]
                              .filter(Boolean)
                              .join(" • ") || "Без категории"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-dark)]">
                          AI
                        </p>
                        <h4 className="mt-1 text-base font-black">Генерация урока через AI</h4>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--ink-soft)]">
                          Опишите тему, цель и формат урока. Генератор соберет готовый
                          черновик со всеми шагами для текущего режима урока. Gemini и OpenAI можно выбирать отдельно.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          className="input-field min-w-36 px-3 py-2 text-sm font-semibold"
                          value={aiProvider}
                          onChange={(event) => setAiProvider(event.target.value as AIProvider)}
                          aria-label="Провайдер генерации урока"
                        >
                          <option value="openai">OpenAI</option>
                          <option value="gemini">Gemini</option>
                        </select>
                        <button
                          type="button"
                          className="primary-btn px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={aiLoadingKey === lessonKey}
                          onClick={() => void generateLessonWithAi(unitIndex, lessonIndex, lesson, unit)}
                        >
                          {aiLoadingKey === lessonKey ? "Генерируем..." : "Сгенерировать через AI"}
                        </button>
                      </div>
                    </div>

                    <textarea
                      className="input-field mt-3 min-h-36 resize-y"
                      value={aiPrompts[lessonKey] ?? ""}
                      onChange={(event) =>
                        setAiPrompts((current) => ({
                          ...current,
                          [lessonKey]: event.target.value,
                        }))
                      }
                      placeholder="Пример: создай стандартный урок для знакомства в университете, с вежливыми окончаниями, словарем, примерами, мини-диалогом и коротким мини-тестом."
                    />

                    {aiErrors[lessonKey] ? (
                      <p className="mt-3 text-sm font-semibold text-rose-600">{aiErrors[lessonKey]}</p>
                    ) : null}
                    {aiSuccesses[lessonKey] ? (
                      <p className="mt-3 text-sm font-semibold text-emerald-700">
                        {aiSuccesses[lessonKey]}
                      </p>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold">
                      <input type="checkbox" checked={lesson.isPublished} onChange={(event) => setLessonValue(unitIndex, lessonIndex, "isPublished", event.target.checked)} />
                      Опубликован
                    </label>
                  </div>
                  <UploadRow
                    imageUrl={lesson.imageUrl}
                    onUpload={(event) => void onImageSelect(event, (value) => setLessonValue(unitIndex, lessonIndex, "imageUrl", value))}
                    onRemove={() => setLessonValue(unitIndex, lessonIndex, "imageUrl", null)}
                    label="урока"
                    alt={lesson.title}
                  />

                  <div className="sticky top-3 z-20 mt-5 rounded-2xl border border-indigo-100 bg-white/95 p-3 shadow-[0_14px_34px_rgba(62,76,160,0.12)] backdrop-blur-xl">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-indigo-600">
                          Шаги урока
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          Показывается один шаг. Переключение сохраняет все введённые данные в черновике.
                        </p>
                      </div>
                      {onSaveLesson ? (
                        <button
                          type="button"
                          className="primary-btn px-4 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={savingLesson}
                          onClick={onSaveLesson}
                        >
                          {savingLesson ? "Сохраняем урок..." : "Сохранить этот урок"}
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                      {lesson.steps.map((entryStep, entryStepIndex) => (
                        <button
                          key={entryStep.id ?? `${lessonKey}-step-tab-${entryStepIndex}`}
                          type="button"
                          onClick={() =>
                            setSelectedStepIndexes((current) => ({
                              ...current,
                              [lessonKey]: entryStepIndex,
                            }))
                          }
                          className={`min-w-fit rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                            selectedStepIndex === entryStepIndex
                              ? "border-indigo-600 bg-indigo-600 text-white shadow-[0_7px_16px_rgba(79,70,229,0.22)]"
                              : "border-indigo-100 bg-indigo-50/60 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
                          }`}
                        >
                          <span className="block text-[10px] font-black uppercase tracking-[0.12em] opacity-70">
                            Шаг {entryStepIndex + 1}
                          </span>
                          <span className="mt-0.5 block max-w-48 truncate text-xs font-black">
                            {entryStep.title || COURSE_STEP_LABELS[entryStep.type]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {lesson.steps.map((step, stepIndex) =>
                      stepIndex !== selectedStepIndex ? null : (
	                      <div key={step.id ?? `${lesson.slug}-step-${stepIndex}`} className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4">
		                        {(() => {
	                          const stepKey = getStepKey(unitIndex, lessonIndex, stepIndex);
	                            const contentImages = extractContentImageItems(step.content);
                            const contentAudioItems = extractContentAudioItems(step.content);
                            const lessonChoiceExercises = extractLessonChoiceExercises(getStepContentBody(step.content));
	                            const quizDraft =
                              step.type === "QUIZ"
                                ? parseQuizEditorContent(step.content) ?? {
                                    questions: [createEmptyQuizQuestion("CHOICE")],
                                  }
                                : null;
                            const practiceDraft =
                              step.type === "PRACTICE" ? parsePracticeEditorContent(step.content) : null;
	
	                          return (
	                            <>
                        <SectionTop
                          title={`Шаг ${stepIndex + 1}`}
                          compact
                          onUp={
                            stepIndex > 0
                              ? () => {
                                  updateLessonStructure(unitIndex, lessonIndex, (steps) =>
                                    moveItem(steps, stepIndex, -1),
                                  );
                                  setSelectedStepIndexes((current) => ({
                                    ...current,
                                    [lessonKey]: stepIndex - 1,
                                  }));
                                }
                              : undefined
                          }
                          onDown={
                            stepIndex < lesson.steps.length - 1
                              ? () => {
                                  updateLessonStructure(unitIndex, lessonIndex, (steps) =>
                                    moveItem(steps, stepIndex, 1),
                                  );
                                  setSelectedStepIndexes((current) => ({
                                    ...current,
                                    [lessonKey]: stepIndex + 1,
                                  }));
                                }
                              : undefined
                          }
                          onDelete={
                            lesson.steps.length > 1
                              ? () => {
                                  updateLessonStructure(unitIndex, lessonIndex, (steps) =>
                                    steps.filter((_, idx) => idx !== stepIndex),
                                  );
                                  setSelectedStepIndexes((current) => ({
                                    ...current,
                                    [lessonKey]: Math.min(stepIndex, lesson.steps.length - 2),
                                  }));
                                }
                              : undefined
                          }
                        />

	                        <div className="mt-3 grid gap-3 md:grid-cols-2">
	                          <select
	                            className="input-field"
                            value={step.type}
                            onChange={(event) =>
                              setStepType(
                                unitIndex,
                                lessonIndex,
                                stepIndex,
                                event.target.value as CourseStepType,
                              )
                            }
                          >
                            <option value="GRAMMAR">{COURSE_STEP_LABELS.GRAMMAR}</option>
                            <option value="EXAMPLES">{COURSE_STEP_LABELS.EXAMPLES}</option>
                            <option value="VOCABULARY">{COURSE_STEP_LABELS.VOCABULARY}</option>
                            <option value="PRACTICE">{COURSE_STEP_LABELS.PRACTICE}</option>
                            <option value="QUIZ">{COURSE_STEP_LABELS.QUIZ}</option>
                            <option value="CUSTOM">{COURSE_STEP_LABELS.CUSTOM}</option>
	                          </select>
	                          <input className="input-field" value={step.title} onChange={(event) => setStepValue(unitIndex, lessonIndex, stepIndex, "title", event.target.value)} placeholder="Название шага" />
	                        </div>

                          {step.type === "VOCABULARY" ? (
                            <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                                    Слова для этого словарного шага
                                  </p>
                                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                                    Эти слова сохраняются на уровне урока и автоматически используются
                                    во всех словарных упражнениях урока.
                                  </p>
                                </div>
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-700">
                                  {lessonVocabularyWords.length} выбрано
                                </span>
                              </div>

                              <input
                                className="input-field mt-3 bg-white"
                                value={vocabularySearch[lessonKey] ?? ""}
                                onChange={(event) =>
                                  setVocabularySearch((current) => ({
                                    ...current,
                                    [lessonKey]: event.target.value,
                                  }))
                                }
                                placeholder="Найти слово из библиотеки: 학교, школа..."
                              />

                              {lessonVocabularyWords.length > 0 ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {lessonVocabularyWords.map((word) => (
                                    <button
                                      key={word.id}
                                      type="button"
                                      className="rounded-full border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-700"
                                      onClick={() => toggleLessonVocabularyWord(unitIndex, lessonIndex, word.id)}
                                    >
                                      {word.korean} — {word.translation} ×
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">
                                  Пока слов нет. Сначала создайте слова в админке словаря, затем выберите их здесь.
                                </p>
                              )}

                              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                {vocabularyCandidates.map((word) => (
                                  <button
                                    key={word.id}
                                    type="button"
                                    className="rounded-2xl border border-emerald-100 bg-white px-3 py-3 text-left text-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm"
                                    onClick={() => toggleLessonVocabularyWord(unitIndex, lessonIndex, word.id)}
                                  >
                                    <span className="block text-base font-black text-slate-950">{word.korean}</span>
                                    <span className="mt-1 block font-semibold text-slate-700">{word.translation}</span>
                                    <span className="mt-1 block text-xs text-slate-500">
                                      {[word.transcription ? `[${word.transcription}]` : null, word.category]
                                        .filter(Boolean)
                                        .join(" • ") || "Без категории"}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {step.type === "PRACTICE" ? (
                            <div className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">
                                    Конструктор упражнений
                                  </p>
                                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                                    Интерактивная практика: инструкция, сборка предложения, пропуск,
                                    частицы, аудио-задания, письмо по шаблону и пары.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  className="secondary-btn px-3 py-2 text-xs font-bold"
                                  onClick={() =>
                                    setStepContent(
                                      unitIndex,
                                      lessonIndex,
                                      stepIndex,
                                      createPracticeTemplate(),
                                    )
                                  }
                                >
                                  {practiceDraft ? "Сбросить к шаблону" : "Создать интерактивные упражнения"}
                                </button>
                              </div>

                              {practiceDraft ? (
                                <div className="mt-4 space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-indigo-200 bg-white/80 px-4 py-3">
                                    <div>
                                      <p className="text-sm font-black text-slate-900">Заданий на одной странице</p>
                                      <p className="mt-1 text-xs leading-5 text-slate-500">
                                        Инструкции показываются отдельно и не входят в это количество.
                                      </p>
                                    </div>
                                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                      Показывать по
                                      <input
                                        className="input-field w-24 text-center"
                                        type="number"
                                        min={1}
                                        max={20}
                                        value={practiceDraft.tasksPerPage ?? 5}
                                        onChange={(event) =>
                                          updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                            ...draft,
                                            tasksPerPage: Math.max(1, Math.min(20, Number(event.target.value) || 1)),
                                          }))
                                        }
                                      />
                                    </label>
                                  </div>
                                  {practiceDraft.exercises.map((exercise, exerciseIndex) => (
                                    <div
                                      key={`${stepKey}-practice-${exerciseIndex}`}
                                      className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-3">
                                        <p className="text-sm font-black text-slate-900">
                                          {exercise.kind === "DESCRIPTION" ? "Инструкция" : "Задание"} · блок {exerciseIndex + 1}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                                            Позиция
                                            <select
                                              className="input-field min-w-20 py-2"
                                              value={exerciseIndex + 1}
                                              onChange={(event) =>
                                                updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                  ...draft,
                                                  exercises: moveItemToIndex(
                                                    draft.exercises,
                                                    exerciseIndex,
                                                    Number(event.target.value) - 1,
                                                  ),
                                                }))
                                              }
                                            >
                                              {practiceDraft.exercises.map((_, positionIndex) => (
                                                <option key={positionIndex} value={positionIndex + 1}>
                                                  {positionIndex + 1}
                                                </option>
                                              ))}
                                            </select>
                                          </label>
                                          <button
                                            type="button"
                                            className="secondary-btn px-3 py-2 text-xs font-bold"
                                            disabled={exerciseIndex === 0}
                                            onClick={() =>
                                              updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                ...draft,
                                                exercises: moveItem(draft.exercises, exerciseIndex, -1),
                                              }))
                                            }
                                            aria-label="Переместить блок выше"
                                          >
                                            ↑
                                          </button>
                                          <button
                                            type="button"
                                            className="secondary-btn px-3 py-2 text-xs font-bold"
                                            disabled={exerciseIndex === practiceDraft.exercises.length - 1}
                                            onClick={() =>
                                              updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                ...draft,
                                                exercises: moveItem(draft.exercises, exerciseIndex, 1),
                                              }))
                                            }
                                            aria-label="Переместить блок ниже"
                                          >
                                            ↓
                                          </button>
                                          <select
                                            className="input-field min-w-56"
                                            value={exercise.kind}
                                            onChange={(event) =>
                                              updatePracticeStepContent(
                                                unitIndex,
                                                lessonIndex,
                                                stepIndex,
                                                (draft) => ({
                                                  exercises: draft.exercises.map((entry, entryIndex) =>
                                                    entryIndex !== exerciseIndex
                                                      ? entry
                                                      : {
                                                          ...createEmptyPracticeExercise(
                                                            event.target.value as PracticeExerciseKind,
                                                          ),
                                                          prompt: entry.prompt,
                                                          description: entry.description,
                                                          imageUrl: entry.imageUrl,
                                                          mobileImageUrls: entry.mobileImageUrls,
                                                          audioUrl: entry.audioUrl,
                                                          explanation: entry.explanation,
                                                        },
                                                  ),
                                                }),
                                              )
                                            }
                                          >
                                            {Object.entries(PRACTICE_KIND_LABELS).map(([value, label]) => (
                                              <option key={value} value={value}>
                                                {label}
                                              </option>
                                            ))}
                                          </select>
                                          <button
                                            type="button"
                                            className="secondary-btn px-3 py-2 text-xs font-bold"
                                            onClick={() =>
                                              updatePracticeStepContent(
                                                unitIndex,
                                                lessonIndex,
                                                stepIndex,
                                                (draft) => ({
                                                  exercises:
                                                    draft.exercises.length > 1
                                                      ? draft.exercises.filter((_, entryIndex) => entryIndex !== exerciseIndex)
                                                      : draft.exercises,
                                                }),
                                              )
                                            }
                                          >
                                            Удалить
                                          </button>
                                        </div>
                                      </div>

                                      <input
                                        className="input-field mt-3"
                                        value={exercise.prompt}
                                        onChange={(event) =>
                                          updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                            exercises: draft.exercises.map((entry, entryIndex) =>
                                              entryIndex !== exerciseIndex
                                                ? entry
                                                : { ...entry, prompt: event.target.value },
                                            ),
                                          }))
                                        }
                                        placeholder="Инструкция для студента"
                                      />

                                      <textarea
                                        className="input-field mt-3 min-h-24"
                                        value={exercise.description}
                                        onChange={(event) =>
                                          updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                            exercises: draft.exercises.map((entry, entryIndex) =>
                                              entryIndex !== exerciseIndex
                                                ? entry
                                                : { ...entry, description: event.target.value },
                                            ),
                                          }))
                                        }
                                        placeholder="Описание / пояснение перед заданием (можно оставить пустым)"
                                      />

                                      {exercise.kind === "DESCRIPTION" ? (
                                        <div className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 px-3 py-3">
                                          <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">
                                            Изображение инструкции
                                          </p>
                                          <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                                            <input
                                              className="input-field"
                                              value={exercise.imageUrl}
                                              onChange={(event) =>
                                                updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                  exercises: draft.exercises.map((entry, entryIndex) =>
                                                    entryIndex !== exerciseIndex
                                                      ? entry
                                                      : { ...entry, imageUrl: event.target.value },
                                                  ),
                                                }))
                                              }
                                              placeholder="URL картинки для инструкции"
                                            />
                                            <label className="secondary-btn cursor-pointer px-3 py-2 text-center text-xs font-bold">
                                              Загрузить картинку
                                              <input
                                                className="hidden"
                                                type="file"
                                                accept="image/*"
                                                onChange={(event) =>
                                                  void onImageSelect(event, (value) =>
                                                    updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                      exercises: draft.exercises.map((entry, entryIndex) =>
                                                        entryIndex !== exerciseIndex
                                                          ? entry
                                                          : { ...entry, imageUrl: value },
                                                      ),
                                                    })),
                                                  )
                                                }
                                              />
                                            </label>
                                            {exercise.imageUrl ? (
                                              <button
                                                type="button"
                                                className="secondary-btn px-3 py-2 text-xs font-bold text-rose-700"
                                                onClick={() =>
                                                  updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                    exercises: draft.exercises.map((entry, entryIndex) =>
                                                      entryIndex !== exerciseIndex
                                                        ? entry
                                                        : { ...entry, imageUrl: "" },
                                                    ),
                                                  }))
                                                }
                                              >
                                                Удалить
                                              </button>
                                            ) : null}
                                          </div>
                                          {exercise.imageUrl ? (
                                            <img
                                              className="mt-3 max-h-64 w-full rounded-2xl border border-indigo-100 bg-white object-contain"
                                              src={exercise.imageUrl}
                                              alt=""
                                            />
                                          ) : null}
                                          <div className="mt-3 rounded-2xl border border-indigo-100 bg-white/80 p-3">
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                              <div>
                                                <p className="text-xs font-black text-slate-800">Изображения инструкции для телефона</p>
                                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                                  Необязательно. Можно заменить одну desktop-картинку несколькими мобильными частями.
                                                </p>
                                              </div>
                                              {exercise.mobileImageUrls.length > 0 ? (
                                                <button
                                                  type="button"
                                                  className="secondary-btn px-3 py-2 text-xs font-bold text-rose-600"
                                                  onClick={() =>
                                                    updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                      exercises: draft.exercises.map((entry, entryIndex) =>
                                                        entryIndex !== exerciseIndex ? entry : { ...entry, mobileImageUrls: [] },
                                                      ),
                                                    }))
                                                  }
                                                >
                                                  Удалить все
                                                </button>
                                              ) : null}
                                            </div>
                                            {exercise.mobileImageUrls.length > 0 ? (
                                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                                {exercise.mobileImageUrls.map((mobileUrl, mobileIndex) => (
                                                  <div key={`${mobileUrl.slice(0, 40)}-${mobileIndex}`} className="rounded-xl border border-violet-200 bg-violet-50/50 p-2">
                                                    <p className="mb-1 text-[11px] font-black uppercase tracking-[0.08em] text-violet-600">Часть {mobileIndex + 1}</p>
                                                    <img className="h-36 w-full rounded-lg bg-white object-contain" src={mobileUrl} alt="" />
                                                    <input
                                                      className="input-field mt-2"
                                                      value={mobileUrl}
                                                      onChange={(event) =>
                                                        updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                          exercises: draft.exercises.map((entry, entryIndex) =>
                                                            entryIndex !== exerciseIndex
                                                              ? entry
                                                              : { ...entry, mobileImageUrls: entry.mobileImageUrls.map((url, index) => index === mobileIndex ? event.target.value : url) },
                                                          ),
                                                        }))
                                                      }
                                                      placeholder="URL мобильной части"
                                                    />
                                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                                      <label className="secondary-btn cursor-pointer px-2 py-1.5 text-[11px] font-bold">
                                                        Заменить
                                                        <input
                                                          className="hidden"
                                                          type="file"
                                                          accept="image/*"
                                                          onChange={(event) =>
                                                            void onImageSelect(event, (value) =>
                                                              updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                                exercises: draft.exercises.map((entry, entryIndex) =>
                                                                  entryIndex !== exerciseIndex
                                                                    ? entry
                                                                    : { ...entry, mobileImageUrls: entry.mobileImageUrls.map((url, index) => index === mobileIndex ? value : url) },
                                                                ),
                                                              })),
                                                            )
                                                          }
                                                        />
                                                      </label>
                                                      <button type="button" className="secondary-btn px-2 py-1.5 text-xs font-bold" disabled={mobileIndex === 0} onClick={() => updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({ exercises: draft.exercises.map((entry, entryIndex) => entryIndex !== exerciseIndex ? entry : { ...entry, mobileImageUrls: moveItem(entry.mobileImageUrls, mobileIndex, -1) }) }))}>↑</button>
                                                      <button type="button" className="secondary-btn px-2 py-1.5 text-xs font-bold" disabled={mobileIndex === exercise.mobileImageUrls.length - 1} onClick={() => updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({ exercises: draft.exercises.map((entry, entryIndex) => entryIndex !== exerciseIndex ? entry : { ...entry, mobileImageUrls: moveItem(entry.mobileImageUrls, mobileIndex, 1) }) }))}>↓</button>
                                                      <button type="button" className="secondary-btn px-2 py-1.5 text-[11px] font-bold text-rose-600" onClick={() => updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({ exercises: draft.exercises.map((entry, entryIndex) => entryIndex !== exerciseIndex ? entry : { ...entry, mobileImageUrls: entry.mobileImageUrls.filter((_, index) => index !== mobileIndex) }) }))}>Удалить</button>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            ) : (
                                              <p className="mt-3 rounded-xl border border-dashed border-indigo-100 px-3 py-3 text-xs text-slate-500">
                                                На телефоне пока используется основное изображение.
                                              </p>
                                            )}
                                            <label className="secondary-btn mt-3 inline-flex cursor-pointer px-3 py-2 text-xs font-bold">
                                              {exercise.mobileImageUrls.length > 0 ? "Добавить ещё часть" : "Добавить мобильную версию"}
                                              <input
                                                className="hidden"
                                                type="file"
                                                accept="image/*"
                                                onChange={(event) =>
                                                  void onImageSelect(event, (value) =>
                                                    updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                      exercises: draft.exercises.map((entry, entryIndex) =>
                                                        entryIndex !== exerciseIndex
                                                          ? entry
                                                          : { ...entry, mobileImageUrls: [...entry.mobileImageUrls, value] },
                                                      ),
                                                    })),
                                                  )
                                                }
                                              />
                                            </label>
                                          </div>
                                        </div>
                                      ) : null}

                                      {exercise.kind !== "MATCH_PAIRS" &&
                                      exercise.kind !== "DESCRIPTION" &&
                                      exercise.kind !== "HANDWRITING_TRACE" &&
                                      exercise.kind !== "LISTEN_CHOOSE" &&
                                      exercise.kind !== "LISTEN_TYPE" &&
                                      exercise.kind !== "CONJUGATION_CHOICE" &&
                                      exercise.kind !== "INLINE_CHOICE" &&
                                      exercise.kind !== "TYPE_ANSWER" &&
                                      exercise.kind !== "DIALOGUE_FILL" ? (
                                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                                          <input
                                            className="input-field"
                                            value={exercise.sentence}
                                            onChange={(event) =>
                                              updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                exercises: draft.exercises.map((entry, entryIndex) =>
                                                  entryIndex !== exerciseIndex
                                                    ? entry
                                                    : { ...entry, sentence: event.target.value },
                                                ),
                                              }))
                                            }
                                            placeholder="Предложение / контекст, можно с ___"
                                          />
                                          <input
                                            className="input-field"
                                            value={exercise.answer}
                                            onChange={(event) =>
                                              updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                exercises: draft.exercises.map((entry, entryIndex) =>
                                                  entryIndex !== exerciseIndex
                                                    ? entry
                                                    : { ...entry, answer: event.target.value },
                                                ),
                                              }))
                                            }
                                            placeholder="Правильный ответ"
                                          />
                                        </div>
                                      ) : null}

                                      {exercise.kind === "TYPE_ANSWER" ? (() => {
                                        const typeAnswers = exercise.typeAnswers?.length
                                          ? exercise.typeAnswers
                                          : [{
                                              question: "",
                                              sentence: exercise.sentence,
                                              answer: exercise.answer,
                                              explanation: exercise.explanation,
                                              imageUrl: exercise.imageUrl,
                                            }];
                                        const saveTypeAnswers = (items: TypeAnswerItemDraft[]) =>
                                          updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                            exercises: draft.exercises.map((entry, entryIndex) =>
                                              entryIndex !== exerciseIndex
                                                ? entry
                                                : {
                                                    ...entry,
                                                    typeAnswers: items,
                                                    sentence: items[0]?.sentence ?? "",
                                                    answer: items[0]?.answer ?? "",
                                                    explanation: items[0]?.explanation ?? "",
                                                    imageUrl: items[0]?.imageUrl ?? "",
                                                  },
                                            ),
                                          }));

                                        return (
                                          <div className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                              <div>
                                                <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">
                                                  Предложения внутри задания
                                                </p>
                                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                                  Для каждого предложения укажите правильный ответ и отдельное пояснение.
                                                </p>
                                              </div>
                                              <button
                                                type="button"
                                                className="secondary-btn px-3 py-2 text-xs font-bold"
                                                onClick={() => {
                                                  const previous = typeAnswers.at(-1);
                                                  saveTypeAnswers([
                                                    ...typeAnswers,
                                                    {
                                                      question: "",
                                                      sentence: previous?.sentence ?? "",
                                                      answer: previous?.answer ?? "",
                                                      explanation: previous?.explanation ?? "",
                                                      imageUrl: "",
                                                    },
                                                  ]);
                                                }}
                                              >
                                                + Добавить предложение
                                              </button>
                                            </div>
                                            <div className="mt-3 grid gap-3">
                                              {typeAnswers.map((item, itemIndex) => (
                                                <div key={itemIndex} className="rounded-xl border border-indigo-100 bg-white p-3">
                                                  <div className="flex items-center justify-between gap-2">
                                                    <strong className="text-xs text-slate-700">Предложение {itemIndex + 1}</strong>
                                                    <div className="flex gap-1.5">
                                                      <button type="button" className="secondary-btn px-2 py-1 text-xs" disabled={itemIndex === 0} onClick={() => saveTypeAnswers(moveItem(typeAnswers, itemIndex, -1))}>↑</button>
                                                      <button type="button" className="secondary-btn px-2 py-1 text-xs" disabled={itemIndex === typeAnswers.length - 1} onClick={() => saveTypeAnswers(moveItem(typeAnswers, itemIndex, 1))}>↓</button>
                                                      <button type="button" className="secondary-btn px-2 py-1 text-xs text-rose-600" disabled={typeAnswers.length === 1} onClick={() => saveTypeAnswers(typeAnswers.filter((_, index) => index !== itemIndex))}>Удалить</button>
                                                    </div>
                                                  </div>
                                                  <input
                                                    className="input-field mt-2"
                                                    value={item.question}
                                                    onChange={(event) => saveTypeAnswers(typeAnswers.map((entry, index) => index === itemIndex ? { ...entry, question: event.target.value } : entry))}
                                                    placeholder="Вопрос над предложением · необязательно"
                                                  />
                                                  <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,2fr)_minmax(8rem,1fr)]">
                                                    <input className="input-field" value={item.sentence} onChange={(event) => saveTypeAnswers(typeAnswers.map((entry, index) => index === itemIndex ? { ...entry, sentence: event.target.value } : entry))} placeholder="Предложение / вопрос" />
                                                    <input className={`input-field ${item.answer.trim() ? "" : "border-rose-300 bg-rose-50/60"}`} value={item.answer} onChange={(event) => saveTypeAnswers(typeAnswers.map((entry, index) => index === itemIndex ? { ...entry, answer: event.target.value } : entry))} placeholder="Правильный ответ · обязательно" />
                                                  </div>
                                                  {!item.answer.trim() ? (
                                                    <p className="mt-1.5 text-xs font-bold text-rose-600">
                                                      Укажите правильный ответ — без него предложение не появится в уроке.
                                                    </p>
                                                  ) : null}
                                                  <input className="input-field mt-2" value={item.explanation} onChange={(event) => saveTypeAnswers(typeAnswers.map((entry, index) => index === itemIndex ? { ...entry, explanation: event.target.value } : entry))} placeholder="Пояснение к правильному ответу" />
                                                  <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                                                    <input
                                                      className="input-field"
                                                      value={item.imageUrl}
                                                      onChange={(event) => saveTypeAnswers(typeAnswers.map((entry, index) => index === itemIndex ? { ...entry, imageUrl: event.target.value } : entry))}
                                                      placeholder="URL изображения · необязательно"
                                                    />
                                                    <label className="secondary-btn cursor-pointer px-3 py-2 text-center text-xs font-bold">
                                                      Загрузить изображение
                                                      <input
                                                        className="hidden"
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={(event) =>
                                                          void onImageSelect(event, (value) =>
                                                            saveTypeAnswers(typeAnswers.map((entry, index) => index === itemIndex ? { ...entry, imageUrl: value } : entry)),
                                                          )
                                                        }
                                                      />
                                                    </label>
                                                  </div>
                                                  {item.imageUrl ? (
                                                    <div className="mt-2 flex flex-wrap items-start gap-3">
                                                      <img className="h-28 w-44 rounded-xl object-contain" src={item.imageUrl} alt="" />
                                                      <button
                                                        type="button"
                                                        className="secondary-btn px-3 py-2 text-xs font-bold text-rose-600"
                                                        onClick={() => saveTypeAnswers(typeAnswers.map((entry, index) => index === itemIndex ? { ...entry, imageUrl: "" } : entry))}
                                                      >
                                                        Удалить изображение
                                                      </button>
                                                    </div>
                                                  ) : null}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        );
                                      })() : null}

                                      {exercise.kind === "DIALOGUE_FILL" ? (() => {
                                        const dialogueItems = exercise.dialogueItems?.length
                                          ? exercise.dialogueItems
                                          : createEmptyPracticeExercise("DIALOGUE_FILL").dialogueItems ?? [];
                                        const saveDialogueItems = (items: DialogueFillItemDraft[]) =>
                                          updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                            exercises: draft.exercises.map((entry, entryIndex) =>
                                              entryIndex !== exerciseIndex
                                                ? entry
                                                : {
                                                    ...entry,
                                                    dialogueItems: items,
                                                    sentence: items[0]?.sentence ?? "",
                                                    answer: items[0]?.answer ?? "",
                                                    imageUrl: items[0]?.imageUrl ?? "",
                                                  },
                                            ),
                                          }));

                                        return (
                                          <div className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                              <div>
                                                <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">
                                                  Диалоги внутри задания
                                                </p>
                                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                                  В ответной реплике поставьте ___ там, где ученик должен напечатать ответ.
                                                </p>
                                              </div>
                                              <button
                                                type="button"
                                                className="secondary-btn px-3 py-2 text-xs font-bold"
                                                onClick={() => saveDialogueItems([
                                                  ...dialogueItems,
                                                  {
                                                    question: "",
                                                    sentence: "나: 아니요. 저는 ___",
                                                    answer: "",
                                                    explanation: "",
                                                    imageUrl: "",
                                                    isExample: false,
                                                  },
                                                ])}
                                              >
                                                + Добавить диалог
                                              </button>
                                            </div>

                                            <div className="mt-3 grid gap-3">
                                              {dialogueItems.map((item, itemIndex) => (
                                                <div key={itemIndex} className="rounded-xl border border-indigo-100 bg-white p-3">
                                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <strong className="text-xs text-slate-700">Диалог {itemIndex + 1}</strong>
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                      <label className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-indigo-700">
                                                        <input
                                                          type="checkbox"
                                                          checked={item.isExample}
                                                          onChange={(event) => saveDialogueItems(dialogueItems.map((entry, index) => index === itemIndex ? { ...entry, isExample: event.target.checked } : entry))}
                                                        />
                                                        Показывать как образец
                                                      </label>
                                                      <button type="button" className="secondary-btn px-2 py-1 text-xs" disabled={itemIndex === 0} onClick={() => saveDialogueItems(moveItem(dialogueItems, itemIndex, -1))}>↑</button>
                                                      <button type="button" className="secondary-btn px-2 py-1 text-xs" disabled={itemIndex === dialogueItems.length - 1} onClick={() => saveDialogueItems(moveItem(dialogueItems, itemIndex, 1))}>↓</button>
                                                      <button type="button" className="secondary-btn px-2 py-1 text-xs text-rose-600" disabled={dialogueItems.length === 1} onClick={() => saveDialogueItems(dialogueItems.filter((_, index) => index !== itemIndex))}>Удалить</button>
                                                    </div>
                                                  </div>

                                                  <input
                                                    className="input-field mt-2"
                                                    value={item.question}
                                                    onChange={(event) => saveDialogueItems(dialogueItems.map((entry, index) => index === itemIndex ? { ...entry, question: event.target.value } : entry))}
                                                    placeholder="Первая реплика / вопрос"
                                                  />
                                                  <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,2fr)_minmax(8rem,1fr)]">
                                                    <input
                                                      className="input-field"
                                                      value={item.sentence}
                                                      onChange={(event) => saveDialogueItems(dialogueItems.map((entry, index) => index === itemIndex ? { ...entry, sentence: event.target.value } : entry))}
                                                      placeholder="Ответная реплика с ___"
                                                    />
                                                    <input
                                                      className={`input-field ${item.answer.trim() ? "" : "border-rose-300 bg-rose-50/60"}`}
                                                      value={item.answer}
                                                      onChange={(event) => saveDialogueItems(dialogueItems.map((entry, index) => index === itemIndex ? { ...entry, answer: event.target.value } : entry))}
                                                      placeholder="Текст для пропуска · обязательно"
                                                    />
                                                  </div>
                                                  {!item.answer.trim() ? (
                                                    <p className="mt-1.5 text-xs font-bold text-rose-600">Укажите правильный текст для пропуска.</p>
                                                  ) : null}
                                                  <input
                                                    className="input-field mt-2"
                                                    value={item.explanation}
                                                    onChange={(event) => saveDialogueItems(dialogueItems.map((entry, index) => index === itemIndex ? { ...entry, explanation: event.target.value } : entry))}
                                                    placeholder="Пояснение · необязательно"
                                                  />

                                                  <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                                                    <input
                                                      className="input-field"
                                                      value={item.imageUrl}
                                                      onChange={(event) => saveDialogueItems(dialogueItems.map((entry, index) => index === itemIndex ? { ...entry, imageUrl: event.target.value } : entry))}
                                                      placeholder="URL небольшого изображения · необязательно"
                                                    />
                                                    <label className="secondary-btn cursor-pointer px-3 py-2 text-center text-xs font-bold">
                                                      Загрузить изображение
                                                      <input
                                                        className="hidden"
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={(event) => void onImageSelect(event, (value) => saveDialogueItems(dialogueItems.map((entry, index) => index === itemIndex ? { ...entry, imageUrl: value } : entry)))}
                                                      />
                                                    </label>
                                                  </div>
                                                  {item.imageUrl ? (
                                                    <div className="mt-2 flex flex-wrap items-start gap-3">
                                                      <img className="h-24 w-36 rounded-xl object-contain" src={item.imageUrl} alt="" />
                                                      <button type="button" className="secondary-btn px-3 py-2 text-xs font-bold text-rose-600" onClick={() => saveDialogueItems(dialogueItems.map((entry, index) => index === itemIndex ? { ...entry, imageUrl: "" } : entry))}>
                                                        Удалить изображение
                                                      </button>
                                                    </div>
                                                  ) : null}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        );
                                      })() : null}

                                      {exercise.kind === "BUILD_SENTENCE" ? (
                                        <textarea
                                          className="input-field mt-3 min-h-24"
                                          rows={Math.min(
                                            12,
                                            Math.max(
                                              3,
                                              (practiceWordsDrafts[`${stepKey}-practice-${exerciseIndex}-words`] ?? exercise.words.join("\n"))
                                                .split("\n").length,
                                            ),
                                          )}
                                          value={
                                            practiceWordsDrafts[`${stepKey}-practice-${exerciseIndex}-words`] ??
                                            exercise.words.join("\n")
                                          }
                                          onChange={(event) => {
                                            const nextValue = event.target.value;
                                            const draftKey = `${stepKey}-practice-${exerciseIndex}-words`;
                                            setPracticeWordsDrafts((current) => ({
                                              ...current,
                                              [draftKey]: nextValue,
                                            }));
                                            updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                              exercises: draft.exercises.map((entry, entryIndex) =>
                                                entryIndex !== exerciseIndex
                                                  ? entry
                                                  : { ...entry, words: splitDraftList(nextValue) },
                                              ),
                                            }));
                                          }}
                                          onBlur={() => {
                                            const draftKey = `${stepKey}-practice-${exerciseIndex}-words`;
                                            setPracticeWordsDrafts((current) => {
                                              const next = { ...current };
                                              delete next[draftKey];
                                              return next;
                                            });
                                          }}
                                          placeholder="Слова для сборки — нажмите Enter, чтобы добавить следующее"
                                        />
                                      ) : null}

                                      {exercise.kind === "FILL_GAP" ||
                                      exercise.kind === "CHOOSE_PARTICLE" ? (
                                        <textarea
                                          className="input-field mt-3 min-h-24"
                                          value={
                                            practiceOptionsDrafts[`${stepKey}-practice-${exerciseIndex}-options`] ??
                                            exercise.options.join("\n")
                                          }
                                          onChange={(event) => {
                                            const nextValue = event.target.value;
                                            const draftKey = `${stepKey}-practice-${exerciseIndex}-options`;
                                            setPracticeOptionsDrafts((current) => ({
                                              ...current,
                                              [draftKey]: nextValue,
                                            }));
                                            updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                              exercises: draft.exercises.map((entry, entryIndex) =>
                                                entryIndex !== exerciseIndex
                                                  ? entry
                                                  : { ...entry, options: splitDraftList(nextValue) },
                                              ),
                                            }));
                                          }}
                                          placeholder="Варианты ответа, каждый с новой строки"
                                        />
                                      ) : null}

                                      {exercise.kind === "BUILD_SENTENCE" ||
                                      exercise.kind === "FILL_GAP" ||
                                      exercise.kind === "CHOOSE_PARTICLE" ? (
                                        <div className="mt-3 rounded-2xl border border-cyan-100 bg-cyan-50/55 px-3 py-3">
                                          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
                                            Изображение между вопросом и ответом · необязательно
                                          </p>
                                          <p className="mt-1 text-xs leading-5 text-slate-500">
                                            Картинка появится после предложения и перед областью ответа.
                                          </p>
                                          <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                                            <input
                                              className="input-field"
                                              value={exercise.imageUrl}
                                              onChange={(event) =>
                                                updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                  exercises: draft.exercises.map((entry, entryIndex) =>
                                                    entryIndex !== exerciseIndex ? entry : { ...entry, imageUrl: event.target.value },
                                                  ),
                                                }))
                                              }
                                              placeholder="URL изображения (можно оставить пустым)"
                                            />
                                            <label className="secondary-btn cursor-pointer px-3 py-2 text-center text-xs font-bold">
                                              Загрузить изображение
                                              <input
                                                className="hidden"
                                                type="file"
                                                accept="image/*"
                                                onChange={(event) =>
                                                  void onImageSelect(event, (value) =>
                                                    updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                      exercises: draft.exercises.map((entry, entryIndex) =>
                                                        entryIndex !== exerciseIndex ? entry : { ...entry, imageUrl: value },
                                                      ),
                                                    })),
                                                  )
                                                }
                                              />
                                            </label>
                                          </div>
                                          {exercise.imageUrl ? (
                                            <div className="mt-3 flex flex-wrap items-start gap-3">
                                              <img className="h-32 w-48 rounded-xl border border-cyan-100 bg-white object-contain" src={exercise.imageUrl} alt="" />
                                              <button
                                                type="button"
                                                className="secondary-btn px-3 py-2 text-xs font-bold text-rose-600"
                                                onClick={() =>
                                                  updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                    exercises: draft.exercises.map((entry, entryIndex) =>
                                                      entryIndex !== exerciseIndex ? entry : { ...entry, imageUrl: "" },
                                                    ),
                                                  }))
                                                }
                                              >
                                                Удалить изображение
                                              </button>
                                            </div>
                                          ) : null}
                                        </div>
                                      ) : null}

                                      {exercise.kind === "INLINE_CHOICE" ? (() => {
                                        const inlineChoices = exercise.inlineChoices?.length
                                          ? exercise.inlineChoices
                                          : [{
                                              sentence: exercise.sentence,
                                              answer: exercise.answer,
                                              options: exercise.options,
                                              explanation: exercise.explanation,
                                            }];
                                        const saveInlineChoices = (items: InlineChoiceItemDraft[]) =>
                                          updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                            exercises: draft.exercises.map((entry, entryIndex) =>
                                              entryIndex !== exerciseIndex
                                                ? entry
                                                : {
                                                    ...entry,
                                                    inlineChoices: items,
                                                    sentence: items[0]?.sentence ?? "",
                                                    answer: items[0]?.answer ?? "",
                                                    options: items[0]?.options ?? [],
                                                    explanation: items[0]?.explanation ?? "",
                                                  },
                                            ),
                                          }));

                                        return <>
                                          <div className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                              <div>
                                                <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">
                                                  Предложения внутри задания
                                                </p>
                                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                                  Добавьте несколько строк. В каждой поставьте ___ на месте выбора.
                                                </p>
                                              </div>
                                              <button
                                                type="button"
                                                className="secondary-btn px-3 py-2 text-xs font-bold"
                                                onClick={() => {
                                                  const previous = inlineChoices.at(-1);
                                                  saveInlineChoices([
                                                    ...inlineChoices,
                                                    {
                                                      sentence: previous?.sentence ?? "",
                                                      answer: previous?.answer ?? "",
                                                      options: [...(previous?.options ?? [])],
                                                      explanation: previous?.explanation ?? "",
                                                    },
                                                  ]);
                                                }}
                                              >
                                                + Добавить предложение
                                              </button>
                                            </div>
                                            <div className="mt-3 grid gap-3">
                                              {inlineChoices.map((item, itemIndex) => (
                                                <div key={itemIndex} className="rounded-xl border border-indigo-100 bg-white p-3">
                                                  <div className="flex items-center justify-between gap-2">
                                                    <strong className="text-xs text-slate-700">Предложение {itemIndex + 1}</strong>
                                                    <div className="flex gap-1.5">
                                                      <button type="button" className="secondary-btn px-2 py-1 text-xs" disabled={itemIndex === 0} onClick={() => saveInlineChoices(moveItem(inlineChoices, itemIndex, -1))}>↑</button>
                                                      <button type="button" className="secondary-btn px-2 py-1 text-xs" disabled={itemIndex === inlineChoices.length - 1} onClick={() => saveInlineChoices(moveItem(inlineChoices, itemIndex, 1))}>↓</button>
                                                      <button type="button" className="secondary-btn px-2 py-1 text-xs text-rose-600" disabled={inlineChoices.length === 1} onClick={() => saveInlineChoices(inlineChoices.filter((_, index) => index !== itemIndex))}>Удалить</button>
                                                    </div>
                                                  </div>
                                                  <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,2fr)_minmax(8rem,1fr)]">
                                                    <input className="input-field" value={item.sentence} onChange={(event) => saveInlineChoices(inlineChoices.map((entry, index) => index === itemIndex ? { ...entry, sentence: event.target.value } : entry))} placeholder="Предложение с ___" />
                                                    <input className={`input-field ${item.answer.trim() ? "" : "border-rose-300 bg-rose-50/60"}`} value={item.answer} onChange={(event) => saveInlineChoices(inlineChoices.map((entry, index) => index === itemIndex ? { ...entry, answer: event.target.value } : entry))} placeholder="Правильный ответ · обязательно" />
                                                  </div>
                                                  {!item.answer.trim() ? (
                                                    <p className="mt-1.5 text-xs font-bold text-rose-600">
                                                      Укажите правильный ответ — без него предложение не появится в уроке.
                                                    </p>
                                                  ) : null}
                                                  <textarea
                                                    className="input-field mt-2 min-h-20"
                                                    value={practiceOptionsDrafts[`${stepKey}-practice-${exerciseIndex}-inline-${itemIndex}`] ?? item.options.join("\n")}
                                                    onChange={(event) => {
                                                      const nextValue = event.target.value;
                                                      const draftKey = `${stepKey}-practice-${exerciseIndex}-inline-${itemIndex}`;
                                                      setPracticeOptionsDrafts((current) => ({ ...current, [draftKey]: nextValue }));
                                                      saveInlineChoices(inlineChoices.map((entry, index) => index === itemIndex ? { ...entry, options: splitDraftList(nextValue) } : entry));
                                                    }}
                                                    placeholder="Варианты ответа, каждый с новой строки"
                                                  />
                                                  <input className="input-field mt-2" value={item.explanation} onChange={(event) => saveInlineChoices(inlineChoices.map((entry, index) => index === itemIndex ? { ...entry, explanation: event.target.value } : entry))} placeholder="Пояснение к правильному ответу" />
                                                </div>
                                              ))}
                                            </div>
                                          </div>

                                         <div className="mt-3 rounded-2xl border border-cyan-100 bg-cyan-50/55 px-3 py-3">
                                          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
                                            Изображение внутри задания · необязательно
                                          </p>
                                          <p className="mt-1 text-xs leading-5 text-slate-500">
                                            В предложении поставьте ___ там, где должны появиться варианты выбора.
                                          </p>
                                          <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                                            <input
                                              className="input-field"
                                              value={exercise.imageUrl}
                                              onChange={(event) =>
                                                updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                  exercises: draft.exercises.map((entry, entryIndex) =>
                                                    entryIndex !== exerciseIndex ? entry : { ...entry, imageUrl: event.target.value },
                                                  ),
                                                }))
                                              }
                                              placeholder="URL изображения (можно оставить пустым)"
                                            />
                                            <label className="secondary-btn cursor-pointer px-3 py-2 text-center text-xs font-bold">
                                              Загрузить изображение
                                              <input
                                                className="hidden"
                                                type="file"
                                                accept="image/*"
                                                onChange={(event) =>
                                                  void onImageSelect(event, (value) =>
                                                    updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                      exercises: draft.exercises.map((entry, entryIndex) =>
                                                        entryIndex !== exerciseIndex ? entry : { ...entry, imageUrl: value },
                                                      ),
                                                    })),
                                                  )
                                                }
                                              />
                                            </label>
                                          </div>
                                          {exercise.imageUrl ? (
                                            <div className="mt-3 flex items-start gap-3">
                                              <img className="h-24 w-32 rounded-xl border border-cyan-100 bg-white object-contain" src={exercise.imageUrl} alt="" />
                                              <button
                                                type="button"
                                                className="secondary-btn px-3 py-2 text-xs font-bold text-rose-600"
                                                onClick={() =>
                                                  updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                    exercises: draft.exercises.map((entry, entryIndex) =>
                                                      entryIndex !== exerciseIndex ? entry : { ...entry, imageUrl: "" },
                                                    ),
                                                  }))
                                                }
                                              >
                                                Удалить изображение
                                              </button>
                                            </div>
                                          ) : null}
                                        </div>
                                        </>;
                                      })() : null}

                                      {exercise.kind === "CONJUGATION_CHOICE" ? (
                                        <div className="mt-3 rounded-2xl border border-violet-100 bg-violet-50/55 px-3 py-3">
                                          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">
                                            Конструктор формы
                                          </p>
                                          <div className="mt-3 grid gap-3 md:grid-cols-3">
                                            <label className="grid gap-1 text-xs font-bold text-slate-600">
                                              Категория / правило
                                              <input className="input-field" value={exercise.category ?? ""} onChange={(event) => updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({ exercises: draft.exercises.map((entry, entryIndex) => entryIndex !== exerciseIndex ? entry : { ...entry, category: event.target.value }) }))} placeholder="Например: ㄷ-불규칙" />
                                            </label>
                                            <label className="grid gap-1 text-xs font-bold text-slate-600">
                                              Словарная форма
                                              <input className="input-field" value={exercise.baseWord ?? ""} onChange={(event) => updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({ exercises: draft.exercises.map((entry, entryIndex) => entryIndex !== exerciseIndex ? entry : { ...entry, baseWord: event.target.value }) }))} placeholder="듣다" />
                                            </label>
                                            <label className="grid gap-1 text-xs font-bold text-slate-600">
                                              Окончание / грамматика
                                              <input className="input-field" value={exercise.grammarForm ?? ""} onChange={(event) => updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({ exercises: draft.exercises.map((entry, entryIndex) => entryIndex !== exerciseIndex ? entry : { ...entry, grammarForm: event.target.value }) }))} placeholder="-아요/어요" />
                                            </label>
                                          </div>
                                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                                            <label className="grid gap-1 text-xs font-bold text-slate-600">
                                              Правильная форма
                                              <input className="input-field" value={exercise.answer} onChange={(event) => updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({ exercises: draft.exercises.map((entry, entryIndex) => entryIndex !== exerciseIndex ? entry : { ...entry, answer: event.target.value }) }))} placeholder="들어요" />
                                            </label>
                                            <label className="grid gap-1 text-xs font-bold text-slate-600">
                                              Варианты · каждый с новой строки
                                              <textarea
                                                className="input-field min-h-28"
                                                value={practiceOptionsDrafts[`${stepKey}-practice-${exerciseIndex}-options`] ?? exercise.options.join("\n")}
                                                onChange={(event) => {
                                                  const nextValue = event.target.value;
                                                  const draftKey = `${stepKey}-practice-${exerciseIndex}-options`;
                                                  setPracticeOptionsDrafts((current) => ({ ...current, [draftKey]: nextValue }));
                                                  updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({ exercises: draft.exercises.map((entry, entryIndex) => entryIndex !== exerciseIndex ? entry : { ...entry, options: splitDraftList(nextValue) }) }));
                                                }}
                                                placeholder={"들어요\n듣어요\n들워요\n들어"}
                                              />
                                            </label>
                                          </div>
                                          <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                                            <input className="input-field" value={exercise.audioUrl} onChange={(event) => updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({ exercises: draft.exercises.map((entry, entryIndex) => entryIndex !== exerciseIndex ? entry : { ...entry, audioUrl: event.target.value }) }))} placeholder="Аудио правильного ответа · необязательно" />
                                            <label className="secondary-btn cursor-pointer px-3 py-2 text-center text-xs font-bold">
                                              Загрузить аудио
                                              <input className="hidden" type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm" onChange={(event) => void onAudioSelect(event, (value) => updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({ exercises: draft.exercises.map((entry, entryIndex) => entryIndex !== exerciseIndex ? entry : { ...entry, audioUrl: value }) })))} />
                                            </label>
                                          </div>
                                          {exercise.audioUrl ? <audio className="mt-3 w-full" controls src={exercise.audioUrl} /> : null}
                                        </div>
                                      ) : null}

                                      {exercise.kind === "LISTEN_CHOOSE" || exercise.kind === "LISTEN_TYPE" ? (
                                        <div className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 px-3 py-3">
                                          <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">
                                            Аудио задания
                                          </p>
                                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                                            <div className="grid gap-1">
                                              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                                                {exercise.kind === "LISTEN_CHOOSE" ? "Правильный вариант" : "Ключ для проверки"}
                                              </span>
                                              <input
                                                className="input-field text-base"
                                                value={exercise.answer}
                                                onChange={(event) =>
                                                  updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                    exercises: draft.exercises.map((entry, entryIndex) =>
                                                      entryIndex !== exerciseIndex
                                                        ? entry
                                                        : { ...entry, answer: event.target.value },
                                                    ),
                                                  }))
                                                }
                                                placeholder={
                                                  exercise.kind === "LISTEN_CHOOSE"
                                                    ? "Например: 학교"
                                                  : "Например: 안녕하세요"
                                                }
                                              />
                                            </div>
                                            <div className="grid gap-1">
                                              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                                                Подсказка / контекст
                                              </span>
                                              <input
                                                className="input-field text-base"
                                                value={exercise.sentence}
                                                onChange={(event) =>
                                                  updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                    exercises: draft.exercises.map((entry, entryIndex) =>
                                                      entryIndex !== exerciseIndex
                                                        ? entry
                                                        : { ...entry, sentence: event.target.value },
                                                    ),
                                                  }))
                                                }
                                                placeholder="Можно оставить пустым"
                                              />
                                            </div>
                                          </div>
                                          {exercise.kind === "LISTEN_CHOOSE" ? (
                                            <div className="mt-3 grid gap-1">
                                              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                                              Варианты ответа
                                            </span>
                                            <textarea
                                              className="input-field min-h-28 text-base"
                                              value={
                                                practiceOptionsDrafts[`${stepKey}-practice-${exerciseIndex}-options`] ??
                                                exercise.options.join("\n")
                                              }
                                              onChange={(event) => {
                                                const nextValue = event.target.value;
                                                const draftKey = `${stepKey}-practice-${exerciseIndex}-options`;
                                                setPracticeOptionsDrafts((current) => ({
                                                  ...current,
                                                  [draftKey]: nextValue,
                                                }));
                                                  updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                    exercises: draft.exercises.map((entry, entryIndex) =>
                                                      entryIndex !== exerciseIndex
                                                        ? entry
                                                        : { ...entry, options: splitDraftList(nextValue) },
                                                    ),
                                                  }));
                                              }}
                                              placeholder={"학교\n학생\n책"}
                                            />
                                              <span className="normal-case tracking-normal text-slate-500">
                                                Каждый вариант с новой строки. Правильный вариант можно продублировать здесь, но если забыть — он добавится автоматически.
                                              </span>
                                            </div>
                                          ) : null}
                                          <div className="mt-3 grid gap-1">
                                            <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                                              Аудио файл
                                            </span>
                                            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                                              <input
                                                className="input-field text-base"
                                                value={exercise.audioUrl}
                                                onChange={(event) =>
                                                  updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                    exercises: draft.exercises.map((entry, entryIndex) =>
                                                      entryIndex !== exerciseIndex
                                                        ? entry
                                                        : { ...entry, audioUrl: event.target.value },
                                                    ),
                                                  }))
                                                }
                                                placeholder="URL аудио"
                                              />
                                              <label className="secondary-btn cursor-pointer px-4 py-2 text-center text-sm font-bold">
                                                Загрузить аудио
                                                <input
                                                  className="hidden"
                                                  type="file"
                                                  accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm"
                                                  onChange={(event) =>
                                                    void onAudioSelect(event, (value) =>
                                                      updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                        exercises: draft.exercises.map((entry, entryIndex) =>
                                                          entryIndex !== exerciseIndex
                                                            ? entry
                                                            : { ...entry, audioUrl: value },
                                                        ),
                                                      })),
                                                    )
                                                  }
                                                />
                                              </label>
                                            </div>
                                          </div>
                                          {exercise.audioUrl ? (
                                            <audio className="mt-3 w-full" controls src={exercise.audioUrl} />
                                          ) : null}
                                        </div>
                                      ) : null}

                                      {exercise.kind === "HANDWRITING_TRACE" ? (
                                        <div className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 px-3 py-3">
                                          <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">
                                            Шаблон письма
                                          </p>
                                          <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                                            <input
                                              className="input-field"
                                              value={exercise.imageUrl}
                                              onChange={(event) =>
                                                updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                  exercises: draft.exercises.map((entry, entryIndex) =>
                                                    entryIndex !== exerciseIndex
                                                      ? entry
                                                      : { ...entry, imageUrl: event.target.value },
                                                  ),
                                                }))
                                              }
                                              placeholder="URL картинки-шаблона"
                                            />
                                            <label className="secondary-btn cursor-pointer px-3 py-2 text-center text-xs font-bold">
                                              Загрузить картинку
                                              <input
                                                className="hidden"
                                                type="file"
                                                accept="image/*"
                                                onChange={(event) =>
                                                  void onImageSelect(event, (value) =>
                                                    updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                      exercises: draft.exercises.map((entry, entryIndex) =>
                                                        entryIndex !== exerciseIndex
                                                          ? entry
                                                          : { ...entry, imageUrl: value },
                                                      ),
                                                    })),
                                                  )
                                                }
                                              />
                                            </label>
                                          </div>
                                          <div className="mt-3 rounded-2xl bg-white/70 p-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                              <div>
                                                <p className="text-xs font-black text-slate-800">
                                                  Шаблоны для телефона
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                  Можно разделить основной шаблон на несколько частей. Они появятся вертикально в выбранном порядке.
                                                </p>
                                              </div>
                                              {exercise.mobileImageUrls.length > 0 ? (
                                                <button
                                                  type="button"
                                                  className="secondary-btn px-3 py-2 text-xs font-bold"
                                                  onClick={() =>
                                                    updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                      exercises: draft.exercises.map((entry, entryIndex) =>
                                                        entryIndex !== exerciseIndex
                                                          ? entry
                                                          : { ...entry, mobileImageUrls: [] },
                                                      ),
                                                    }))
                                                  }
                                                >
                                                  Удалить все
                                                </button>
                                              ) : null}
                                            </div>
                                            {exercise.mobileImageUrls.length > 0 ? (
                                              <div className="mt-3 grid gap-2">
                                                {exercise.mobileImageUrls.map((mobileUrl, mobileIndex) => (
                                                  <div key={`${mobileUrl.slice(0, 40)}-${mobileIndex}`} className="grid gap-2 rounded-xl border border-indigo-100 bg-white p-2 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
                                                    <span className="rounded-lg bg-indigo-50 px-2.5 py-2 text-xs font-black text-indigo-700">
                                                      Часть {mobileIndex + 1}
                                                    </span>
                                                    <input
                                                      className="input-field"
                                                      value={mobileUrl}
                                                      onChange={(event) =>
                                                        updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                          exercises: draft.exercises.map((entry, entryIndex) =>
                                                            entryIndex !== exerciseIndex
                                                              ? entry
                                                              : {
                                                                  ...entry,
                                                                  mobileImageUrls: entry.mobileImageUrls.map((url, index) => index === mobileIndex ? event.target.value : url),
                                                                },
                                                          ),
                                                        }))
                                                      }
                                                      placeholder="URL мобильной части"
                                                    />
                                                    <div className="flex flex-wrap gap-1.5">
                                                      <label className="secondary-btn cursor-pointer px-2 py-2 text-[11px] font-bold">
                                                        Заменить
                                                        <input
                                                          className="hidden"
                                                          type="file"
                                                          accept="image/*"
                                                          onChange={(event) =>
                                                            void onImageSelect(event, (value) =>
                                                              updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                                exercises: draft.exercises.map((entry, entryIndex) =>
                                                                  entryIndex !== exerciseIndex
                                                                    ? entry
                                                                    : {
                                                                        ...entry,
                                                                        mobileImageUrls: entry.mobileImageUrls.map((url, index) => index === mobileIndex ? value : url),
                                                                      },
                                                                ),
                                                              })),
                                                            )
                                                          }
                                                        />
                                                      </label>
                                                      <button type="button" className="secondary-btn px-2 py-2 text-xs font-bold" disabled={mobileIndex === 0} onClick={() => updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({ exercises: draft.exercises.map((entry, entryIndex) => entryIndex !== exerciseIndex ? entry : { ...entry, mobileImageUrls: moveItem(entry.mobileImageUrls, mobileIndex, -1) }) }))}>↑</button>
                                                      <button type="button" className="secondary-btn px-2 py-2 text-xs font-bold" disabled={mobileIndex === exercise.mobileImageUrls.length - 1} onClick={() => updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({ exercises: draft.exercises.map((entry, entryIndex) => entryIndex !== exerciseIndex ? entry : { ...entry, mobileImageUrls: moveItem(entry.mobileImageUrls, mobileIndex, 1) }) }))}>↓</button>
                                                      <button type="button" className="secondary-btn px-2 py-2 text-[11px] font-bold text-rose-600" onClick={() => updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({ exercises: draft.exercises.map((entry, entryIndex) => entryIndex !== exerciseIndex ? entry : { ...entry, mobileImageUrls: entry.mobileImageUrls.filter((_, index) => index !== mobileIndex) }) }))}>Удалить</button>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            ) : (
                                              <p className="mt-3 rounded-xl border border-dashed border-indigo-100 bg-white px-3 py-3 text-xs text-slate-500">
                                                Пока используется основной шаблон.
                                              </p>
                                            )}
                                            <label className="secondary-btn mt-3 inline-flex cursor-pointer px-3 py-2 text-center text-xs font-bold">
                                              {exercise.mobileImageUrls.length > 0 ? "Добавить ещё часть" : "Загрузить для телефона"}
                                              <input
                                                className="hidden"
                                                type="file"
                                                accept="image/*"
                                                onChange={(event) =>
                                                  void onImageSelect(event, (value) =>
                                                    updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                      exercises: draft.exercises.map((entry, entryIndex) =>
                                                        entryIndex !== exerciseIndex
                                                          ? entry
                                                          : { ...entry, mobileImageUrls: [...entry.mobileImageUrls, value] },
                                                      ),
                                                    })),
                                                  )
                                                }
                                              />
                                            </label>
                                          </div>
                                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                                            <input
                                              className="input-field"
                                              value={exercise.answer}
                                              onChange={(event) =>
                                                updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                  exercises: draft.exercises.map((entry, entryIndex) =>
                                                    entryIndex !== exerciseIndex
                                                      ? entry
                                                      : { ...entry, answer: event.target.value },
                                                  ),
                                                }))
                                              }
                                              placeholder="Что пишем / подпись, например 가수"
                                            />
                                            <input
                                              className="input-field"
                                              type="number"
                                              min={20}
                                              max={95}
                                              value={exercise.minStrokeLength}
                                              onChange={(event) =>
                                                updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                  exercises: draft.exercises.map((entry, entryIndex) =>
                                                    entryIndex !== exerciseIndex
                                                      ? entry
                                                      : {
                                                          ...entry,
                                                          minStrokeLength: Math.max(20, Math.min(95, Number(event.target.value) || 48)),
                                                        },
                                                  ),
                                                }))
                                              }
                                              placeholder="Минимальная точность, %"
                                            />
                                          </div>
                                          {exercise.imageUrl ? (
                                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                                              <div>
                                                <p className="mb-2 text-xs font-bold text-slate-500">Основной шаблон</p>
                                                <img
                                                  className="max-h-52 w-full rounded-2xl border border-indigo-100 bg-white object-contain"
                                                  src={exercise.imageUrl}
                                                  alt="Основной шаблон письма"
                                                />
                                              </div>
                                              <div>
                                                <p className="mb-2 text-xs font-bold text-slate-500">На телефоне</p>
                                                <div className="grid gap-2">
                                                  {(exercise.mobileImageUrls.length > 0 ? exercise.mobileImageUrls : [exercise.imageUrl]).map((mobileUrl, mobileIndex) => (
                                                    <div key={`${mobileUrl.slice(0, 40)}-${mobileIndex}`}>
                                                      {exercise.mobileImageUrls.length > 1 ? <p className="mb-1 text-[11px] font-black text-indigo-600">Часть {mobileIndex + 1}</p> : null}
                                                      <img
                                                        className="max-h-52 w-full rounded-2xl border border-indigo-100 bg-white object-contain"
                                                        src={mobileUrl}
                                                        alt={`Мобильный шаблон письма${exercise.mobileImageUrls.length > 1 ? `, часть ${mobileIndex + 1}` : ""}`}
                                                      />
                                                    </div>
                                                  ))}
                                                </div>
                                                {exercise.mobileImageUrls.length === 0 ? (
                                                  <p className="mt-2 text-xs text-slate-500">
                                                    Сейчас используется основной шаблон.
                                                  </p>
                                                ) : null}
                                              </div>
                                            </div>
                                          ) : null}
                                        </div>
                                      ) : null}

                                      {exercise.kind === "MATCH_PAIRS" ? (
                                        <div className="mt-3 space-y-3">
                                          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 px-4 py-3">
                                            <p className="text-sm font-black text-indigo-950">Как задаются правильные пары</p>
                                            <p className="mt-1 text-sm leading-6 text-slate-600">
                                              Каждая строка ниже — одна правильная пара. В самом упражнении правая колонка
                                              перемешивается автоматически, поэтому её позицию на экране настраивать не нужно.
                                            </p>
                                          </div>
                                          {exercise.pairs.map((pair, pairIndex) => (
                                            <div
                                              key={`${stepKey}-practice-pair-${exerciseIndex}-${pairIndex}`}
                                              className="rounded-2xl border border-indigo-100 bg-white/80 p-3"
                                            >
                                              <div className="mb-2 flex items-center justify-between gap-3">
                                                <span className="rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-indigo-700">
                                                  Правильная пара {pairIndex + 1}
                                                </span>
                                                <button
                                                  type="button"
                                                  className="secondary-btn px-3 py-2 text-xs font-bold"
                                                  onClick={() =>
                                                    updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                      exercises: draft.exercises.map((entry, entryIndex) =>
                                                        entryIndex !== exerciseIndex
                                                          ? entry
                                                          : {
                                                              ...entry,
                                                              pairs:
                                                                entry.pairs.length > 2
                                                                  ? entry.pairs.filter((_, entryPairIndex) => entryPairIndex !== pairIndex)
                                                                  : entry.pairs,
                                                            },
                                                      ),
                                                    }))
                                                  }
                                                >
                                                  Удалить
                                                </button>
                                              </div>
                                              <div className="grid items-end gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                                                <label className="block text-xs font-bold text-slate-600">
                                                  Левая карточка
                                                  <input
                                                    className="input-field mt-1"
                                                    value={pair.left}
                                                    onChange={(event) =>
                                                      updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                        exercises: draft.exercises.map((entry, entryIndex) =>
                                                          entryIndex !== exerciseIndex
                                                            ? entry
                                                            : {
                                                                ...entry,
                                                                pairs: entry.pairs.map((entryPair, entryPairIndex) =>
                                                                  entryPairIndex !== pairIndex
                                                                    ? entryPair
                                                                    : { ...entryPair, left: event.target.value },
                                                                ),
                                                              },
                                                        ),
                                                      }))
                                                    }
                                                    placeholder="학교"
                                                  />
                                                </label>
                                                <span className="hidden pb-3 text-lg font-black text-indigo-500 md:block" aria-hidden="true">
                                                  ↔
                                                </span>
                                                <label className="block text-xs font-bold text-slate-600">
                                                  Правильная карточка справа
                                                  <input
                                                    className="input-field mt-1"
                                                    value={pair.right}
                                                    onChange={(event) =>
                                                      updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                        exercises: draft.exercises.map((entry, entryIndex) =>
                                                          entryIndex !== exerciseIndex
                                                            ? entry
                                                            : {
                                                                ...entry,
                                                                pairs: entry.pairs.map((entryPair, entryPairIndex) =>
                                                                  entryPairIndex !== pairIndex
                                                                    ? entryPair
                                                                    : { ...entryPair, right: event.target.value },
                                                                ),
                                                              },
                                                        ),
                                                      }))
                                                    }
                                                    placeholder="школа"
                                                  />
                                                </label>
                                              </div>
                                            </div>
                                          ))}
                                          <button
                                            type="button"
                                            className="secondary-btn px-3 py-2 text-xs font-bold"
                                            onClick={() =>
                                              updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                                exercises: draft.exercises.map((entry, entryIndex) =>
                                                  entryIndex !== exerciseIndex
                                                    ? entry
                                                    : { ...entry, pairs: [...entry.pairs, { left: "", right: "" }] },
                                                ),
                                              }))
                                            }
                                          >
                                            Добавить пару
                                          </button>
                                        </div>
                                      ) : null}

                                      {exercise.kind !== "INLINE_CHOICE" &&
                                      exercise.kind !== "TYPE_ANSWER" &&
                                      exercise.kind !== "DIALOGUE_FILL" ? <input
                                        className="input-field mt-3"
                                        value={exercise.explanation}
                                        onChange={(event) =>
                                          updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                            exercises: draft.exercises.map((entry, entryIndex) =>
                                              entryIndex !== exerciseIndex
                                                ? entry
                                                : { ...entry, explanation: event.target.value },
                                            ),
                                          }))
                                        }
                                        placeholder="Пояснение после правильного ответа"
                                      /> : null}
                                    </div>
                                  ))}

                                  <button
                                    type="button"
                                    className="secondary-btn px-3 py-2 text-xs font-bold"
                                    onClick={() =>
                                      updatePracticeStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
                                        exercises: [...draft.exercises, createEmptyPracticeExercise("BUILD_SENTENCE")],
                                      }))
                                    }
                                  >
                                    Добавить упражнение
                                  </button>
                                </div>
                              ) : (
                                <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                                  Сейчас этот шаг остается обычным текстовым заданием. Нажмите кнопку выше,
                                  чтобы превратить его в интерактивный режим.
                                </p>
                              )}
                            </div>
                          ) : null}

	                        {step.type !== "QUIZ" && (step.type !== "PRACTICE" || !practiceDraft) ? (
	                          <textarea
	                            className="input-field mt-3 min-h-100 resize-y"
	                            ref={(node) => setStepContentRef(stepKey, node)}
	                            value={getStepContentBody(step.content)}
	                            onChange={(event) => setStepContent(unitIndex, lessonIndex, stepIndex, event.target.value)}
	                            placeholder="Контент шага"
	                          />
	                        ) : null}
	                        {step.type !== "QUIZ" && (step.type !== "PRACTICE" || !practiceDraft) ? (
	                          <div className="mt-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-3">
	                            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-dark)]">
	                              Форматирование
	                            </p>
	                            <div className="mt-3 flex flex-wrap gap-2">
	                              <button
	                                type="button"
	                                className="secondary-btn px-3 py-2 text-xs font-bold"
	                                onClick={() =>
	                                  wrapSelectedStepContent(unitIndex, lessonIndex, stepIndex, stepKey, step.content, "**", "**", "важный текст")
	                                }
	                              >
	                                Жирный
	                              </button>
	                              <button
	                                type="button"
	                                className="secondary-btn px-3 py-2 text-xs font-bold"
	                                onClick={() =>
	                                  wrapSelectedStepContent(unitIndex, lessonIndex, stepIndex, stepKey, step.content, "__", "__", "подчеркнутый текст")
	                                }
	                              >
	                                Подчеркнуть
	                              </button>
	                              <button
	                                type="button"
	                                className="secondary-btn px-3 py-2 text-xs font-bold"
	                                onClick={() =>
	                                  wrapSelectedStepContent(unitIndex, lessonIndex, stepIndex, stepKey, step.content, "==", "==", "акцент")
	                                }
	                              >
	                                Выделить
	                              </button>
	                              <button
	                                type="button"
	                                className="secondary-btn px-3 py-2 text-xs font-bold"
	                                onClick={() =>
	                                  wrapSelectedStepContent(unitIndex, lessonIndex, stepIndex, stepKey, step.content, "[color=#2563eb]", "[/color]", "цветной текст")
	                                }
	                              >
	                                Синий
	                              </button>
	                              <button
	                                type="button"
	                                className="secondary-btn px-3 py-2 text-xs font-bold"
	                                onClick={() =>
	                                  wrapSelectedStepContent(unitIndex, lessonIndex, stepIndex, stepKey, step.content, "[color=#059669]", "[/color]", "цветной текст")
	                                }
	                              >
	                                Зеленый
	                              </button>
	                              <button
	                                type="button"
	                                className="secondary-btn px-3 py-2 text-xs font-bold"
	                                onClick={() =>
	                                  wrapSelectedStepContent(unitIndex, lessonIndex, stepIndex, stepKey, step.content, "[color=#e11d48]", "[/color]", "цветной текст")
	                                }
	                              >
	                                Красный
	                              </button>
	                              <button
	                                type="button"
	                                className="secondary-btn px-3 py-2 text-xs font-bold"
	                                onClick={() =>
	                                  wrapSelectedStepContent(unitIndex, lessonIndex, stepIndex, stepKey, step.content, "[size=lg]", "[/size]", "крупный текст")
	                                }
	                              >
	                                Крупнее
	                              </button>
	                              <button
	                                type="button"
	                                className="secondary-btn px-3 py-2 text-xs font-bold"
	                                onClick={() =>
	                                  wrapSelectedStepContent(unitIndex, lessonIndex, stepIndex, stepKey, step.content, "[size=xl]", "[/size]", "акцентный текст")
	                                }
	                              >
	                                Очень крупно
	                              </button>
		                              <button
		                                type="button"
		                                className="secondary-btn px-3 py-2 text-xs font-bold"
		                                onClick={() =>
		                                  insertBlockIntoStepContent(unitIndex, lessonIndex, stepIndex, stepKey, step.content, "- Пункт 1\n- Пункт 2\n- Пункт 3")
		                                }
		                              >
		                                Список
		                              </button>
		                              <button
		                                type="button"
		                                className="secondary-btn px-3 py-2 text-xs font-bold"
		                                onClick={() =>
		                                  insertBlockIntoStepContent(unitIndex, lessonIndex, stepIndex, stepKey, step.content, buildDialogueBlock())
		                                }
		                              >
		                                Диалог
		                              </button>
	                              <button
	                                type="button"
	                                className="secondary-btn border-violet-300 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700"
	                                onClick={() =>
	                                  insertBlockIntoStepContent(
	                                    unitIndex,
	                                    lessonIndex,
	                                    stepIndex,
	                                    stepKey,
	                                    step.content,
	                                    serializeLessonChoiceExercise(createEmptyLessonChoiceExercise()),
	                                  )
	                                }
	                              >
	                                ✦ Задание с выбором
	                              </button>
		                              <button
		                                type="button"
		                                className="secondary-btn px-3 py-2 text-xs font-bold"
		                                onClick={() =>
		                                  insertBlockIntoStepContent(unitIndex, lessonIndex, stepIndex, stepKey, step.content, buildMarkdownTable(2, 2))
	                                }
	                              >
	                                Таблица 2×2
	                              </button>
	                              <button
	                                type="button"
	                                className="secondary-btn px-3 py-2 text-xs font-bold"
	                                onClick={() =>
	                                  insertBlockIntoStepContent(unitIndex, lessonIndex, stepIndex, stepKey, step.content, buildMarkdownTable(3, 3))
	                                }
	                              >
	                                Таблица 3×3
	                              </button>
	                              <button
	                                type="button"
	                                className="secondary-btn border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 disabled:cursor-not-allowed disabled:opacity-55"
	                                disabled={getStepContentBody(step.content).includes(INTERACTIVE_COUNTRY_MAP_TOKEN)}
	                                onClick={() =>
	                                  insertBlockIntoStepContent(
	                                    unitIndex,
	                                    lessonIndex,
	                                    stepIndex,
	                                    stepKey,
	                                    step.content,
	                                    INTERACTIVE_COUNTRY_MAP_TOKEN,
	                                  )
	                                }
	                              >
	                                {getStepContentBody(step.content).includes(INTERACTIVE_COUNTRY_MAP_TOKEN)
	                                  ? "🗺️ Карта уже добавлена"
	                                  : "🗺️ Интерактивная карта"}
	                              </button>
	                            </div>
	                            {getStepContentBody(step.content).includes(INTERACTIVE_COUNTRY_MAP_TOKEN) ? (
	                              <p className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-semibold leading-5 text-indigo-700">
	                                Карта добавлена в контент. Переместите строку {INTERACTIVE_COUNTRY_MAP_TOKEN} в тексте,
	                                чтобы изменить её положение внутри шага.
	                              </p>
	                            ) : null}
	                          </div>
	                        ) : null}
	                        {step.type !== "QUIZ" &&
	                        (step.type !== "PRACTICE" || !practiceDraft) &&
	                        lessonChoiceExercises.length > 0 ? (
	                          <div className="mt-3 grid gap-3">
	                            {lessonChoiceExercises.map((lessonExercise, lessonExerciseIndex) => (
	                              <LessonChoiceExerciseEditor
	                                key={`${stepKey}-lesson-choice-${lessonExerciseIndex}`}
	                                exercise={lessonExercise}
	                                exerciseIndex={lessonExerciseIndex}
	                                onImageSelect={onImageSelect}
	                                onAudioSelect={onAudioSelect}
	                                onChange={(nextExercise) =>
	                                  updateLessonChoiceExercise(
	                                    unitIndex,
	                                    lessonIndex,
	                                    stepIndex,
	                                    lessonExerciseIndex,
	                                    () => nextExercise,
	                                  )
	                                }
	                                onRemove={() =>
	                                  updateLessonChoiceExercise(
	                                    unitIndex,
	                                    lessonIndex,
	                                    stepIndex,
	                                    lessonExerciseIndex,
	                                    () => null,
	                                  )
	                                }
	                              />
	                            ))}
	                          </div>
	                        ) : null}
	                        {step.type !== "QUIZ" && (step.type !== "PRACTICE" || !practiceDraft) ? (
	                          <div className="mt-3 rounded-2xl border border-dashed border-[var(--line)] bg-slate-50 px-4 py-3">
	                            <div className="flex flex-wrap items-center gap-3">
		                              <label className="secondary-btn cursor-pointer px-3 py-2 text-xs font-bold">
		                                <input
	                                  type="file"
	                                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
	                                  className="hidden"
	                                  onChange={(event) =>
	                                    void onImageSelect(event, (value) => {
	                                      appendContentImageToStep(unitIndex, lessonIndex, stepIndex, value);
	                                      setExpandedContentImageSteps((current) => ({ ...current, [stepKey]: true }));
	                                    })
	                                  }
		                                />
		                                Добавить изображение в текст шага
		                              </label>
                              <label className="secondary-btn cursor-pointer px-3 py-2 text-xs font-bold">
                                <input
                                  type="file"
                                  accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm"
                                  className="hidden"
                                  onChange={(event) =>
                                    void onAudioSelect(event, (value, fileName) =>
                                      appendContentAudioToStep(
                                        unitIndex,
                                        lessonIndex,
                                        stepIndex,
                                        value,
                                        fileName.replace(/\.[^.]+$/, ""),
                                      ),
                                    )
                                  }
                                />
                                Добавить аудио в текст шага
                              </label>
		                              <select
	                                className="input-field w-full sm:w-auto"
	                                value={getStepImagePlacement(step.content)}
	                                onChange={(event) =>
	                                  setStepImagePlacement(
	                                    unitIndex,
	                                    lessonIndex,
	                                    stepIndex,
	                                    event.target.value as StepImagePlacement,
	                                  )
	                                }
	                              >
	                                <option value="top">Основное изображение: сверху</option>
	                                <option value="bottom">Основное изображение: снизу</option>
	                              </select>
	                                <span className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-xs font-bold text-[var(--ink-soft)]">
	                                  Изображений в тексте: {contentImages.length}
	                                </span>
                              <span className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-xs font-bold text-[var(--ink-soft)]">
                                Аудио в тексте: {contentAudioItems.length}
                              </span>
	                              {contentImages.length > 0 ? (
	                                <button
	                                  type="button"
	                                  className="secondary-btn ml-auto px-3 py-2 text-xs font-bold"
	                                  aria-expanded={Boolean(expandedContentImageSteps[stepKey])}
	                                  onClick={() =>
	                                    setExpandedContentImageSteps((current) => ({
	                                      ...current,
	                                      [stepKey]: !current[stepKey],
	                                    }))
	                                  }
	                                >
	                                  {expandedContentImageSteps[stepKey]
	                                    ? "Скрыть изображения ↑"
	                                    : `Показать изображения (${contentImages.length}) ↓`}
	                                </button>
	                              ) : null}
		                            </div>
		                            <p className="mt-2 text-xs leading-5 text-[var(--ink-soft)]">
		                              Дополнительные изображения и аудио можно загружать сколько угодно.
		                              Их положение внутри шага зависит от места строки
		                              <span className="mx-1 font-mono text-[11px]">![...](...)</span>
                              или
                              <span className="mx-1 font-mono text-[11px]">[audio:...](...)</span>
		                              в тексте контента.
		                            </p>
                                {contentImages.length > 0 && expandedContentImageSteps[stepKey] ? (
                                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                    {contentImages.map((image, imageIndex) => (
                                      <div
                                        key={`${stepKey}-content-image-${imageIndex}`}
                                        className="rounded-2xl border border-[var(--line)] bg-white p-3"
                                      >
                                        <div className="grid gap-3 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
                                          <div>
                                            <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--ink-soft)]">
                                              Основное
                                            </p>
                                            <img
                                              src={image.desktopUrl}
                                              alt={image.alt}
                                              className="h-24 w-full rounded-xl border border-[var(--line)] bg-slate-50 object-contain"
                                            />
                                          </div>
                                          <div>
                                            <div className="mb-1.5 flex items-center justify-between gap-2">
                                              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--ink-soft)]">
                                                Для телефона
                                              </p>
                                              <span className="text-[11px] font-bold text-violet-600">
                                                {image.hiddenOnMobile
                                                  ? "скрыто"
                                                  : image.mobileUrls.length > 0
                                                    ? `${image.mobileUrls.length} ч.`
                                                    : "авто"}
                                              </span>
                                            </div>
                                            {image.mobileUrls.length > 0 ? (
                                              <div className="grid gap-2 sm:grid-cols-2">
                                                {image.mobileUrls.map((mobileUrl, mobileIndex) => (
                                                  <div key={`${mobileUrl.slice(0, 40)}-${mobileIndex}`} className="rounded-xl border border-violet-200 bg-violet-50/60 p-2">
                                                    <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-[0.08em] text-violet-600">
                                                      <span>Часть {mobileIndex + 1}</span>
                                                      <span>{mobileIndex + 1}/{image.mobileUrls.length}</span>
                                                    </div>
                                                    <img
                                                      src={mobileUrl}
                                                      alt=""
                                                      className="h-32 w-full rounded-lg bg-white object-contain"
                                                    />
                                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                                      <label className="secondary-btn cursor-pointer px-2 py-1.5 text-[11px] font-bold">
                                                        <input
                                                          type="file"
                                                          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                                                          className="hidden"
                                                          onChange={(event) =>
                                                            void onImageSelect(event, (value) =>
                                                              setContentImageMobilesForStep(
                                                                unitIndex,
                                                                lessonIndex,
                                                                stepIndex,
                                                                imageIndex,
                                                                image.mobileUrls.map((url, index) => index === mobileIndex ? value : url),
                                                              ),
                                                            )
                                                          }
                                                        />
                                                        Заменить
                                                      </label>
                                                      <button
                                                        type="button"
                                                        className="secondary-btn px-2 py-1.5 text-[11px] font-bold"
                                                        disabled={mobileIndex === 0}
                                                        onClick={() =>
                                                          setContentImageMobilesForStep(
                                                            unitIndex,
                                                            lessonIndex,
                                                            stepIndex,
                                                            imageIndex,
                                                            moveItem(image.mobileUrls, mobileIndex, -1),
                                                          )
                                                        }
                                                      >
                                                        ↑
                                                      </button>
                                                      <button
                                                        type="button"
                                                        className="secondary-btn px-2 py-1.5 text-[11px] font-bold"
                                                        disabled={mobileIndex === image.mobileUrls.length - 1}
                                                        onClick={() =>
                                                          setContentImageMobilesForStep(
                                                            unitIndex,
                                                            lessonIndex,
                                                            stepIndex,
                                                            imageIndex,
                                                            moveItem(image.mobileUrls, mobileIndex, 1),
                                                          )
                                                        }
                                                      >
                                                        ↓
                                                      </button>
                                                      <button
                                                        type="button"
                                                        className="secondary-btn px-2 py-1.5 text-[11px] font-bold text-rose-600"
                                                        onClick={() =>
                                                          setContentImageMobilesForStep(
                                                            unitIndex,
                                                            lessonIndex,
                                                            stepIndex,
                                                            imageIndex,
                                                            image.mobileUrls.filter((_, index) => index !== mobileIndex),
                                                          )
                                                        }
                                                      >
                                                        Удалить
                                                      </button>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            ) : (
                                              <div className="grid h-24 place-items-center rounded-xl border border-dashed border-[var(--line)] bg-slate-50 px-2 text-center text-[11px] font-semibold leading-4 text-[var(--ink-soft)]">
                                                Используется основное изображение
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <label
                                          className={`mt-3 flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors ${
                                            image.hiddenOnMobile
                                              ? "border-rose-200 bg-rose-50 text-rose-700"
                                              : "border-indigo-100 bg-indigo-50/50 text-slate-700"
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 accent-violet-600"
                                            checked={image.hiddenOnMobile}
                                            onChange={(event) =>
                                              setContentImageVisibilityForStep(
                                                unitIndex,
                                                lessonIndex,
                                                stepIndex,
                                                imageIndex,
                                                event.target.checked,
                                              )
                                            }
                                          />
                                          <span>
                                            Не показывать это изображение на телефоне
                                            <small className="mt-0.5 block font-medium text-slate-500">
                                              Загруженные версии сохранятся и останутся доступны для компьютера.
                                            </small>
                                          </span>
                                        </label>
                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                          <label className="secondary-btn cursor-pointer px-3 py-2 text-xs font-bold">
                                            <input
                                              type="file"
                                              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                                              className="hidden"
                                              onChange={(event) =>
                                                void onImageSelect(event, (value) =>
                                                  setContentImageMobilesForStep(
                                                    unitIndex,
                                                    lessonIndex,
                                                    stepIndex,
                                                    imageIndex,
                                                    [...image.mobileUrls, value],
                                                  ),
                                                )
                                              }
                                            />
                                            {image.mobileUrls.length > 0 ? "Добавить ещё часть" : "Добавить мобильную версию"}
                                          </label>
                                          {image.mobileUrls.length > 0 ? (
                                            <button
                                              type="button"
                                              className="secondary-btn px-3 py-2 text-xs font-bold text-rose-600"
                                              onClick={() =>
                                                setContentImageMobilesForStep(
                                                  unitIndex,
                                                  lessonIndex,
                                                  stepIndex,
                                                  imageIndex,
                                                  [],
                                                )
                                              }
                                            >
                                              Удалить все мобильные
                                            </button>
                                          ) : null}
                                        </div>
                                        <p className="mt-2 text-[11px] leading-4 text-[var(--ink-soft)]">
                                          На экранах до 767 px части показываются вертикально в этом порядке и заменяют одно основное изображение.
                                        </p>
                                      </div>
                                    ))}
	                                  </div>
		                                ) : null}
                            {contentAudioItems.length > 0 ? (
                              <div className="mt-3 grid gap-2">
                                {contentAudioItems.map((audio, audioIndex) => (
                                  <div
                                    key={`${stepKey}-content-audio-${audioIndex}`}
                                    className="rounded-2xl border border-[var(--line)] bg-white px-3 py-3"
                                  >
                                    <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--accent-dark)]">
                                      {audio.label}
                                    </p>
                                    <audio className="w-full" controls src={audio.url} />
                                  </div>
                                ))}
                              </div>
                            ) : null}
		                          </div>
		                        ) : null}
	                        {step.type === "QUIZ" ? (
	                          <div className="mt-3 rounded-2xl border border-[var(--line)] bg-slate-50 px-4 py-4">
	                            <div className="flex flex-wrap items-start justify-between gap-3">
	                              <div>
	                                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-dark)]">
	                                  Конструктор теста
	                                </p>
	                                <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--ink-soft)]">
	                                  Здесь можно собрать тест вручную: выбор ответа, пропуск в предложении и формат
	                                  «верно / неверно». Ответ показывается сразу после выбора.
	                                </p>
	                              </div>
	                              <button
	                                type="button"
	                                className="secondary-btn px-3 py-2 text-xs font-bold"
	                                onClick={() =>
	                                  setStepContent(
	                                    unitIndex,
	                                    lessonIndex,
	                                    stepIndex,
	                                    createQuizTemplate(),
	                                  )
	                                }
	                              >
	                                Сбросить к шаблону
	                              </button>
	                            </div>

	                            <div className="mt-4 space-y-3">
	                              {quizDraft?.questions.map((question, questionIndex) => (
	                                <div
	                                  key={`${stepKey}-quiz-question-${questionIndex}`}
	                                  className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4"
	                                >
	                                  <div className="flex flex-wrap items-center justify-between gap-3">
	                                    <p className="text-sm font-black text-slate-900">
	                                      Вопрос {questionIndex + 1}
	                                    </p>
	                                    <div className="flex flex-wrap items-center gap-2">
	                                      <select
	                                        className="input-field min-w-52"
	                                        value={question.kind}
	                                        onChange={(event) =>
	                                          updateQuizStepContent(
	                                            unitIndex,
	                                            lessonIndex,
	                                            stepIndex,
	                                            (draft) => ({
	                                              questions: draft.questions.map((entry, entryIndex) =>
	                                                entryIndex !== questionIndex
	                                                  ? entry
	                                                  : {
	                                                      ...createEmptyQuizQuestion(
	                                                        event.target.value as QuizQuestionKind,
	                                                      ),
	                                                      prompt: entry.prompt,
	                                                      audioUrl: entry.audioUrl,
	                                                      explanation: entry.explanation,
	                                                    },
	                                              ),
	                                            }),
	                                          )
	                                        }
	                                      >
	                                        <option value="CHOICE">{QUIZ_KIND_LABELS.CHOICE}</option>
	                                        <option value="FILL_IN_BLANK">{QUIZ_KIND_LABELS.FILL_IN_BLANK}</option>
	                                        <option value="TRUE_FALSE">{QUIZ_KIND_LABELS.TRUE_FALSE}</option>
	                                      </select>
	                                      <button
	                                        type="button"
	                                        className="secondary-btn px-3 py-2 text-xs font-bold"
	                                        onClick={() =>
	                                          updateQuizStepContent(
	                                            unitIndex,
	                                            lessonIndex,
	                                            stepIndex,
	                                            (draft) => ({
	                                              questions:
	                                                draft.questions.length > 1
	                                                  ? draft.questions.filter((_, entryIndex) => entryIndex !== questionIndex)
	                                                  : draft.questions,
	                                            }),
	                                          )
	                                        }
	                                      >
	                                        Удалить
	                                      </button>
	                                    </div>
	                                  </div>

	                                  <input
	                                    className="input-field mt-3"
	                                    value={question.prompt}
	                                    onChange={(event) =>
	                                      updateQuizStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
	                                        questions: draft.questions.map((entry, entryIndex) =>
	                                          entryIndex !== questionIndex
	                                            ? entry
	                                            : { ...entry, prompt: event.target.value },
	                                        ),
	                                      }))
	                                    }
	                                    placeholder="Текст вопроса или инструкции"
	                                  />

	                                  <div className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 px-3 py-3">
	                                    <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">
	                                      Аудио вопроса
	                                    </p>
	                                    <p className="mt-1 text-xs leading-5 text-slate-500">
	                                      Необязательно. Добавьте запись, если вопрос нужно сначала прослушать.
	                                    </p>
	                                    <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
	                                      <input
	                                        className="input-field text-base"
	                                        value={question.audioUrl}
	                                        onChange={(event) =>
	                                          updateQuizStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
	                                            questions: draft.questions.map((entry, entryIndex) =>
	                                              entryIndex !== questionIndex
	                                                ? entry
	                                                : { ...entry, audioUrl: event.target.value },
	                                            ),
	                                          }))
	                                        }
	                                        placeholder="URL аудио"
	                                      />
	                                      <label className="secondary-btn cursor-pointer px-4 py-2 text-center text-sm font-bold">
	                                        Загрузить аудио
	                                        <input
	                                          className="hidden"
	                                          type="file"
	                                          accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm"
	                                          onChange={(event) =>
	                                            void onAudioSelect(event, (value) =>
	                                              updateQuizStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
	                                                questions: draft.questions.map((entry, entryIndex) =>
	                                                  entryIndex !== questionIndex
	                                                    ? entry
	                                                    : { ...entry, audioUrl: value },
	                                                ),
	                                              })),
	                                            )
	                                          }
	                                        />
	                                      </label>
	                                    </div>
	                                    {question.audioUrl ? (
	                                      <audio className="mt-3 w-full" controls src={question.audioUrl} />
	                                    ) : null}
	                                  </div>

	                                  {question.kind === "FILL_IN_BLANK" ? (
	                                    <input
	                                      className="input-field mt-3"
	                                      value={question.sentence}
	                                      onChange={(event) =>
	                                        updateQuizStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
	                                          questions: draft.questions.map((entry, entryIndex) =>
	                                            entryIndex !== questionIndex
	                                              ? entry
	                                              : { ...entry, sentence: event.target.value },
	                                          ),
	                                        }))
	                                      }
	                                      placeholder="Предложение с пропуском, например: 저는 ___ 입니다."
	                                    />
	                                  ) : null}

	                                  <div className="mt-3 space-y-2">
	                                    {question.options.map((option, optionIndex) => (
	                                      <div
	                                        key={`${stepKey}-option-${questionIndex}-${optionIndex}`}
	                                        className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]"
	                                      >
	                                        <input
	                                          className="input-field"
	                                          value={option.text}
	                                          onChange={(event) =>
	                                            updateQuizStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
	                                              questions: draft.questions.map((entry, entryIndex) =>
	                                                entryIndex !== questionIndex
	                                                  ? entry
	                                                  : {
	                                                      ...entry,
	                                                      options: entry.options.map((entryOption, entryOptionIndex) =>
	                                                        entryOptionIndex !== optionIndex
	                                                          ? entryOption
	                                                          : { ...entryOption, text: event.target.value },
	                                                      ),
	                                                    },
	                                              ),
	                                            }))
	                                          }
	                                          placeholder={`Вариант ${optionIndex + 1}`}
	                                        />
	                                        <button
	                                          type="button"
	                                          className={`secondary-btn px-3 py-2 text-xs font-bold ${option.isCorrect ? "border-emerald-400 bg-emerald-50 text-emerald-700" : ""}`}
	                                          onClick={() =>
	                                            updateQuizStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
	                                              questions: draft.questions.map((entry, entryIndex) =>
	                                                entryIndex !== questionIndex
	                                                  ? entry
	                                                  : {
	                                                      ...entry,
	                                                      options: entry.options.map((entryOption, entryOptionIndex) => ({
	                                                        ...entryOption,
	                                                        isCorrect: entryOptionIndex === optionIndex,
	                                                      })),
	                                                    },
	                                              ),
	                                            }))
	                                          }
	                                        >
	                                          Верный ответ
	                                        </button>
	                                        {question.kind !== "TRUE_FALSE" ? (
	                                          <button
	                                            type="button"
	                                            className="secondary-btn px-3 py-2 text-xs font-bold"
	                                            onClick={() =>
	                                              updateQuizStepContent(
	                                                unitIndex,
	                                                lessonIndex,
	                                                stepIndex,
	                                                (draft) => ({
	                                                  questions: draft.questions.map((entry, entryIndex) =>
	                                                    entryIndex !== questionIndex
	                                                      ? entry
	                                                      : {
	                                                          ...entry,
	                                                          options:
	                                                            entry.options.length > 2
	                                                              ? entry.options.filter((_, entryOptionIndex) => entryOptionIndex !== optionIndex)
	                                                              : entry.options,
	                                                        },
	                                                  ),
	                                                }),
	                                              )
	                                            }
	                                          >
	                                            Удалить вариант
	                                          </button>
	                                        ) : (
	                                          <span className="rounded-full border border-[var(--line)] bg-slate-50 px-3 py-2 text-xs font-bold text-[var(--ink-soft)]">
	                                            Фиксированный набор
	                                          </span>
	                                        )}
	                                      </div>
	                                    ))}
	                                  </div>

	                                  {question.kind !== "TRUE_FALSE" ? (
	                                    <button
	                                      type="button"
	                                      className="secondary-btn mt-3 px-3 py-2 text-xs font-bold"
	                                      onClick={() =>
	                                        updateQuizStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
	                                          questions: draft.questions.map((entry, entryIndex) =>
	                                            entryIndex !== questionIndex
	                                              ? entry
	                                              : {
	                                                  ...entry,
	                                                  options: [
	                                                    ...entry.options,
	                                                    {
	                                                      text: `Вариант ${entry.options.length + 1}`,
	                                                      isCorrect: false,
	                                                    },
	                                                  ].slice(0, 6),
	                                                },
	                                          ),
	                                        }))
	                                      }
	                                    >
	                                      Добавить вариант
	                                    </button>
	                                  ) : null}

	                                  <textarea
	                                    className="input-field mt-3 min-h-32 resize-y"
	                                    value={question.explanation}
	                                    onChange={(event) =>
	                                      updateQuizStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
	                                        questions: draft.questions.map((entry, entryIndex) =>
	                                          entryIndex !== questionIndex
	                                            ? entry
	                                            : { ...entry, explanation: event.target.value },
	                                        ),
	                                      }))
	                                    }
	                                    placeholder="Короткое объяснение, которое увидит ученик после ответа"
	                                  />
	                                </div>
	                              ))}
	                            </div>

	                            <div className="mt-4 flex flex-wrap gap-2">
	                              <button
	                                type="button"
	                                className="secondary-btn px-3 py-2 text-xs font-bold"
	                                onClick={() =>
	                                  updateQuizStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
	                                    questions: [...draft.questions, createEmptyQuizQuestion("CHOICE")],
	                                  }))
	                                }
	                              >
	                                Добавить вопрос с выбором
	                              </button>
	                              <button
	                                type="button"
	                                className="secondary-btn px-3 py-2 text-xs font-bold"
	                                onClick={() =>
	                                  updateQuizStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
	                                    questions: [...draft.questions, createEmptyQuizQuestion("FILL_IN_BLANK")],
	                                  }))
	                                }
	                              >
	                                Добавить пропуск
	                              </button>
	                              <button
	                                type="button"
	                                className="secondary-btn px-3 py-2 text-xs font-bold"
	                                onClick={() =>
	                                  updateQuizStepContent(unitIndex, lessonIndex, stepIndex, (draft) => ({
	                                    questions: [...draft.questions, createEmptyQuizQuestion("TRUE_FALSE")],
	                                  }))
	                                }
	                              >
	                                Добавить верно / неверно
	                              </button>
	                            </div>
	                          </div>
                        ) : null}
	                        <div className="mt-3 rounded-2xl border border-[var(--line)] bg-slate-50 px-4 py-4">
	                          <div className="flex flex-wrap items-start justify-between gap-3">
		                            <div>
		                              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-dark)]">
		                                AI Step
		                              </p>
                              <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">
                                «Конструктор» использует готовые типы упражнений. «Свободный UI» создаёт отдельный интерактивный экран с уникальными карточками, стилями, озвучкой браузера и проверкой ответов в безопасной песочнице.
		                              </p>
	                            </div>
	                            <div className="flex flex-wrap items-center gap-2">
	                              <select
	                                className="input-field min-w-32 px-3 py-2 text-sm font-semibold"
	                                value={stepAiProvider}
	                                onChange={(event) => setStepAiProvider(event.target.value as AIProvider)}
	                                aria-label="Провайдер генерации шага"
	                              >
	                                <option value="openai">OpenAI</option>
	                                <option value="gemini">Gemini</option>
	                              </select>
	                              <select
	                                className="input-field min-w-40 px-3 py-2 text-sm font-semibold"
	                                value={stepAiOutputMode}
	                                onChange={(event) => setStepAiOutputMode(event.target.value as AIStepOutputMode)}
	                                aria-label="Режим результата AI"
	                              >
	                                <option value="structured">Конструктор</option>
	                                <option value="custom_ui">Свободный UI</option>
	                              </select>
	                              <button
	                                type="button"
	                                className="secondary-btn px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60"
	                                disabled={imageLoadingKey === stepKey}
	                                onClick={() =>
	                                  void generateStepContentWithAi(
	                                    unitIndex,
	                                    lessonIndex,
	                                    stepIndex,
                                    unit,
                                    lesson,
                                    step,
                                  )
	                                }
	                              >
	                                {imageLoadingKey === stepKey ? "Генерируем..." : "Сгенерировать шаг через AI"}
	                              </button>
	                            </div>
	                          </div>
	                          <textarea
	                            className="input-field mt-3 min-h-32 resize-y"
                            value={imagePrompts[stepKey] ?? ""}
                            onChange={(event) =>
                              setImagePrompts((current) => ({
                                ...current,
	                                [stepKey]: event.target.value,
	                              }))
	                            }
		                            placeholder={
		                                stepAiOutputMode === "custom_ui"
		                                  ? "Пример: создай премиальный интерактивный экран из 5 аудио-карточек для 소리, 어디, 지도, 나라, 호주. На каждой карточке кнопка произношения, O/X, мгновенная проверка и общий прогресс."
		                                  :
		                                step.type === "QUIZ"
		                                  ? "Пример: создай мини-тест на 4 вопроса, смешай выбор ответа и пропуски, добавь короткие объяснения после каждого ответа. И сделай иллюстрацию к этому шагу."
		                                  : "Пример: перепиши этот шаг понятнее, добавь красивую таблицу сравнения, выдели ключевое правило жирным и сгенерируй иллюстрацию к шагу."
		                              }
	                          />
                          {imageErrors[stepKey] ? (
                            <p className="mt-3 text-sm font-semibold text-rose-600">{imageErrors[stepKey]}</p>
                          ) : null}
                          {imageSuccesses[stepKey] ? (
                            <p className="mt-3 text-sm font-semibold text-emerald-700">
                              {imageSuccesses[stepKey]}
                            </p>
                          ) : null}
                        </div>
                        <UploadRow
                          imageUrl={step.imageUrl}
                          onUpload={(event) => void onImageSelect(event, (value) => setStepValue(unitIndex, lessonIndex, stepIndex, "imageUrl", value))}
                          onRemove={() => setStepValue(unitIndex, lessonIndex, stepIndex, "imageUrl", null)}
                          label="шага"
                          alt={step.title}
                          compact
                        />
                            </>
                          );
                        })()}
                      </div>
                    ))}

                    {lesson.mode === "FLEXIBLE" ? (
                      <button
                        type="button"
                        className="secondary-btn px-4 py-2 text-sm font-bold"
                        onClick={() => {
                          setLevels((current) =>
                            current.map((entry, index) =>
                              index !== levelIndex
                                ? entry
                                : {
                                    ...entry,
                                    units: entry.units.map((entryUnit, innerUnitIndex) =>
                                      innerUnitIndex !== unitIndex
                                        ? entryUnit
                                        : {
                                            ...entryUnit,
                                            lessons: entryUnit.lessons.map((entryLesson, innerLessonIndex) =>
                                              innerLessonIndex !== lessonIndex
                                                ? entryLesson
                                                : { ...entryLesson, steps: [...entryLesson.steps, createEmptyFlexibleStep(entryLesson.steps.length)] },
                                            ),
                                          },
                                    ),
                                  },
                            ),
                          );
                          setSelectedStepIndexes((current) => ({
                            ...current,
                            [lessonKey]: lesson.steps.length,
                          }));
                        }}
                      >
                        Добавить шаг
                      </button>
                    ) : null}
                  </div>
                </div>
              );
              })}

              <button
                type="button"
                className="secondary-btn px-4 py-2 text-sm font-bold"
                onClick={() =>
                  setLevels((current) =>
                      current.map((entry, index) =>
                        index !== levelIndex
                          ? entry
                        : {
                            ...entry,
                            units: entry.units.map((item, innerIndex) => {
                              if (innerIndex !== unitIndex) {
                                return item;
                              }

                              const nextLesson = createEmptyLesson(item.lessons.length);
                              return {
                                ...item,
                                lessons: [
                                  ...item.lessons,
                                  {
                                    ...nextLesson,
                                    slug: makeUniqueSlug(
                                      nextLesson.slug,
                                      item.lessons.map((lesson) => lesson.slug),
                                    ),
                                  },
                                ],
                              };
                            }),
                          },
                      ),
                    )
                  }
              >
                Добавить урок
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          className="secondary-btn px-4 py-2 text-sm font-bold"
          onClick={() =>
            setLevels((current) =>
            current.map((entry, index) =>
              index !== levelIndex
                ? entry
                : (() => {
                    const nextUnit = createEmptyUnit(entry.units.length);
                    return {
                      ...entry,
                      units: [
                        ...entry.units,
                        {
                          ...nextUnit,
                          slug: makeUniqueSlug(
                            nextUnit.slug,
                            entry.units.map((unit) => unit.slug),
                          ),
                        },
                      ],
                    };
                  })(),
            ),
          )
        }
        >
          Добавить юнит
        </button>
      </div>
    </article>
  );
}

function SectionTop({
  title,
  onUp,
  onDown,
  onDelete,
  compact = false,
}: {
  title: string;
  onUp?: () => void;
  onDown?: () => void;
  onDelete?: () => void;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className={compact ? "text-base font-black" : "text-xl font-black"}>{title}</h3>
      <div className="flex flex-wrap gap-2">
        {onUp ? <button type="button" className="secondary-btn px-3 py-1 text-xs font-bold" onClick={onUp}>Вверх</button> : null}
        {onDown ? <button type="button" className="secondary-btn px-3 py-1 text-xs font-bold" onClick={onDown}>Вниз</button> : null}
        {onDelete ? <button type="button" className="secondary-btn px-3 py-1 text-xs font-bold" onClick={onDelete}>Удалить</button> : null}
      </div>
    </div>
  );
}

function UploadRow({
  imageUrl,
  onUpload,
  onRemove,
  label,
  alt,
  compact = false,
}: {
  imageUrl: string | null;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  label: string;
  alt: string;
  compact?: boolean;
}) {
  return (
    <>
      <div className={`mt-3 flex flex-wrap items-center gap-2 ${compact ? "" : ""}`}>
        <label className="secondary-btn cursor-pointer px-3 py-2 text-xs font-bold">
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
            className="hidden"
            onChange={onUpload}
          />
          Загрузить изображение {label}
        </label>
        {imageUrl ? (
          <button type="button" className="secondary-btn px-3 py-2 text-xs font-bold" onClick={onRemove}>
            Удалить изображение
          </button>
        ) : null}
      </div>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          className={`mt-3 w-full rounded-2xl object-cover ${compact ? "h-28" : "h-32"}`}
        />
      ) : null}
    </>
  );
}
