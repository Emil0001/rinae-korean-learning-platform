"use client";

import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import styled, { css, keyframes } from "styled-components";
import { createConfettiPieces, type ConfettiBurst, QuizConfetti } from "@/components/courses/celebration-effects";
import {
  appendHangulInput,
  KoreanKeyboard,
  type KoreanKeyboardAction,
  removeLastHangulInput,
} from "@/components/courses/korean-keyboard";
import { PrimaryButton } from "@/components/courses/lesson-action-controls";
import {
  PracticeListeningCard,
  PracticeListeningCopy,
  PracticeListeningHint,
  PracticeListeningIcon,
  PracticeListeningLabel,
  PracticeListeningPlayer,
} from "@/components/courses/lesson-listening-card";
import {
  normalizePracticeAnswer,
  type ParsedPractice,
  type ParsedTypeAnswerItem,
  practiceKindLabel,
  shuffleStable,
} from "@/components/courses/practice-content";
import {
  QuizBlank,
  QuizOptionButton,
  QuizOptionMarker,
  QuizOptions,
  QuizOptionState,
  QuizOptionText,
} from "@/components/courses/quiz-step-content";
import { VocabularyExercise, VocabularyTypeInput } from "@/components/courses/vocabulary-step-content";

type PracticeDragPreview =
  | {
      kind: "build";
      label: string;
      wordIndex: number;
      x: number;
      y: number;
    }
  | {
      kind: "choice";
      label: string;
      option: string;
      optionIndex: number;
      x: number;
      y: number;
    };

type HandwritingScore = {
  score: number;
  precision: number;
  coverage: number;
  hasTemplate: boolean;
};

type HandwritingTool = "pen" | "eraser";

type HandwritingHistoryEntry = {
  imageData: ImageData;
  strokeLength: number;
};

const HANDWRITING_TEMPLATE_SCALE = 1;
const HANDWRITING_HISTORY_LIMIT = 20;

function getHandwritingFeedback(score: number) {
  if (score >= 80) {
    return {
      tone: "success" as const,
      title: "✅ Отлично!",
      detail: "Очень хорошая точность. Можно двигаться дальше.",
    };
  }

  if (score >= 50) {
    return {
      tone: "warning" as const,
      title: "Неплохо",
      detail: "Форма уже похожа на шаблон, но стоит поработать над точностью.",
    };
  }

  return {
    tone: "danger" as const,
    title: "Низкая точность",
    detail: "Лучше писать ближе к серому шаблону и повторить направление штрихов.",
  };
}

export function PracticeStepContent({
  practice,
  stepTitle,
  onComplete,
}: {
  practice: ParsedPractice;
  stepTitle: string;
  onComplete: () => void | Promise<void>;
}) {
  const instructions = useMemo(
    () => practice.exercises.filter((exercise) => exercise.kind === "DESCRIPTION"),
    [practice.exercises],
  );
  const tasks = useMemo(
    () => practice.exercises.filter((exercise) => exercise.kind !== "DESCRIPTION"),
    [practice.exercises],
  );
  const requiresSequentialPresentation = useMemo(
    () =>
      tasks.some((exercise) => exercise.kind === "HANDWRITING_TRACE") ||
      stepTitle.trim().toLocaleLowerCase("ru-RU") === "аудирование",
    [stepTitle, tasks],
  );
  const [instructionsDone, setInstructionsDone] = useState(instructions.length === 0);
  const [pageIndex, setPageIndex] = useState(0);
  const [taskResults, setTaskResults] = useState<Record<number, "correct" | "wrong">>({});
  const [finishing, setFinishing] = useState(false);
  const pageTopRef = useRef<HTMLDivElement | null>(null);
  const pageSize = Math.max(1, Math.min(20, practice.tasksPerPage || 5));
  const pageCount = Math.max(1, Math.ceil(tasks.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const pageStart = safePageIndex * pageSize;
  const currentTasks = tasks.slice(pageStart, pageStart + pageSize);
  const currentPageComplete =
    currentTasks.length > 0 &&
    currentTasks.every((_, localIndex) => taskResults[pageStart + localIndex] !== undefined);
  const completedCount = Object.keys(taskResults).length;
  const correctCount = Object.values(taskResults).filter((result) => result === "correct").length;
  const wrongCount = Object.values(taskResults).filter((result) => result === "wrong").length;

  const scrollToPracticePage = () => {
    window.requestAnimationFrame(() => {
      const target = pageTopRef.current?.closest("[data-lesson-step-card]") ?? pageTopRef.current;
      target?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
  };

  const finishPractice = () => {
    setFinishing(true);
    void Promise.resolve(onComplete()).finally(() => setFinishing(false));
  };

  if (!instructionsDone && instructions.length > 0) {
    return (
      <PracticeExerciseSequence
        practice={{ exercises: instructions, tasksPerPage: 1 }}
        mode="instruction"
        onComplete={() => {
          if (tasks.length === 0) {
            finishPractice();
            return;
          }
          setInstructionsDone(true);
          scrollToPracticePage();
        }}
      />
    );
  }

  if (tasks.length === 0) {
    return (
      <PracticeEmptyState>
        <span aria-hidden="true">✦</span>
        <strong>Упражнений пока нет</strong>
        <p>Добавьте задания в конструкторе практики.</p>
      </PracticeEmptyState>
    );
  }

  if (requiresSequentialPresentation) {
    return (
      <PracticeExerciseSequence
        practice={{ exercises: tasks, tasksPerPage: 1 }}
        onComplete={finishPractice}
      />
    );
  }

  return (
    <PracticePageShell ref={pageTopRef}>
      <PracticePageHeader>
        <div>
          <PracticeTopEyebrow>Практика</PracticeTopEyebrow>
          <h3>
            Задания {pageStart + 1}–{pageStart + currentTasks.length}
          </h3>
          <p>
            Выполняйте задания в любом удобном порядке. Правильные ответы сохраняются на этой странице.
          </p>
        </div>
        <PracticePageBadge>
          Страница {safePageIndex + 1} / {pageCount}
        </PracticePageBadge>
      </PracticePageHeader>

      <PracticePageProgress>
        <div>
          <span>
            Выполнено {completedCount} / {tasks.length}
          </span>
          <strong>
            Верно {correctCount} · Ошибок {wrongCount}
          </strong>
        </div>
        <PracticeProgressTrack>
          <PracticeProgressFill style={{ width: `${Math.round((completedCount / tasks.length) * 100)}%` }} />
        </PracticeProgressTrack>
      </PracticePageProgress>

      <PracticeTaskList>
        {currentTasks.map((task, localIndex) => {
          const taskIndex = pageStart + localIndex;

          return (
            <PracticeExerciseSequence
              key={taskIndex}
              practice={{ exercises: [task], tasksPerPage: 1 }}
              mode="list"
              displayIndex={taskIndex + 1}
              totalTasks={tasks.length}
              onComplete={(correct = true) =>
                setTaskResults((current) => ({
                  ...current,
                  [taskIndex]: correct ? "correct" : "wrong",
                }))
              }
            />
          );
        })}
      </PracticeTaskList>

      <PracticePageNavigation>
        <button
          type="button"
          disabled={safePageIndex === 0}
          onClick={() => {
            setPageIndex((current) => Math.max(0, current - 1));
            scrollToPracticePage();
          }}
        >
          ← Назад
        </button>
        <PrimaryButton
          type="button"
          disabled={!currentPageComplete || finishing}
          onClick={() => {
            if (safePageIndex >= pageCount - 1) {
              finishPractice();
              return;
            }
            setPageIndex((current) => Math.min(pageCount - 1, current + 1));
            scrollToPracticePage();
          }}
        >
          {safePageIndex >= pageCount - 1
            ? finishing
              ? "Сохраняем…"
              : "Завершить практику →"
            : "Следующая страница →"}
        </PrimaryButton>
      </PracticePageNavigation>
    </PracticePageShell>
  );
}

type PracticeExerciseSequenceMode = "standalone" | "instruction" | "list";

function PracticeExerciseSequence({
  practice,
  onComplete,
  mode = "standalone",
  displayIndex,
  totalTasks,
}: {
  practice: ParsedPractice;
  onComplete: (correct?: boolean) => void | Promise<void>;
  mode?: PracticeExerciseSequenceMode;
  displayIndex?: number;
  totalTasks?: number;
}) {
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [selectedWordIndexes, setSelectedWordIndexes] = useState<number[]>([]);
  const [choice, setChoice] = useState("");
  const [inlineChoiceAnswers, setInlineChoiceAnswers] = useState<Record<number, string>>({});
  const [typedAnswers, setTypedAnswers] = useState<Record<number, string>>({});
  const [activeTypeAnswerIndex, setActiveTypeAnswerIndex] = useState(0);
  const [dialogueAnswers, setDialogueAnswers] = useState<Record<number, string>>({});
  const [activeDialogueIndex, setActiveDialogueIndex] = useState(0);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [koreanKeyboardOpen, setKoreanKeyboardOpen] = useState(false);
  const [matchedPairs, setMatchedPairs] = useState<Record<string, string>>({});
  const [selectedPairLeft, setSelectedPairLeft] = useState<string | null>(null);
  const [wrongPairAttempt, setWrongPairAttempt] = useState<{ left: string; right: string } | null>(null);
  const [practiceMatchLines, setPracticeMatchLines] = useState<Array<{
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color: string;
  }>>([]);
  const [draggedWord, setDraggedWord] = useState<string | null>(null);
  const [draggedWordIndex, setDraggedWordIndex] = useState<number | null>(null);
  const [draggedChoice, setDraggedChoice] = useState<string | null>(null);
  const [draggedChoiceIndex, setDraggedChoiceIndex] = useState<number | null>(null);
  const [practiceDragPreview, setPracticeDragPreview] = useState<PracticeDragPreview | null>(null);
  const [handwritingStrokeLength, setHandwritingStrokeLength] = useState(0);
  const [handwritingScore, setHandwritingScore] = useState<HandwritingScore>({
    score: 0,
    precision: 0,
    coverage: 0,
    hasTemplate: false,
  });
  const [handwritingCursor, setHandwritingCursor] = useState({
    x: 0,
    y: 0,
    visible: false,
  });
  const [handwritingTool, setHandwritingTool] = useState<HandwritingTool>("pen");
  const [handwritingHistoryCount, setHandwritingHistoryCount] = useState(0);
  const [handwritingAccuracyRevealed, setHandwritingAccuracyRevealed] = useState(false);
  const [feedback, setFeedback] = useState<"idle" | "correct" | "wrong">("idle");
  const [practiceCompleting, setPracticeCompleting] = useState(false);
  const [confettiBurst, setConfettiBurst] = useState<ConfettiBurst | null>(null);
  const confettiBurstIdRef = useRef(0);
  const completionReportedRef = useRef(false);
  const wrongPairTimeoutRef = useRef<number | null>(null);
  const practiceScreenRef = useRef<HTMLDivElement | null>(null);
  const previousExerciseIndexRef = useRef(exerciseIndex);
  const buildDropRef = useRef<HTMLDivElement | null>(null);
  const choiceDropRef = useRef<HTMLDivElement | null>(null);
  const choiceSentenceDropRef = useRef<HTMLDivElement | null>(null);
  const typedAnswerInputRef = useRef<HTMLInputElement | null>(null);
  const typeAnswerInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const dialogueInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const practiceMatchGridRef = useRef<HTMLDivElement | null>(null);
  const practiceMatchLeftRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const practiceMatchRightRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const handwritingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const handwritingImageRef = useRef<HTMLImageElement | null>(null);
  const handwritingMobileImageRefs = useRef<Array<HTMLImageElement | null>>([]);
  const handwritingPointerRef = useRef<{ x: number; y: number } | null>(null);
  const handwritingStrokeLengthRef = useRef(0);
  const handwritingHistoryRef = useRef<HandwritingHistoryEntry[]>([]);
  const handwritingActiveHistoryEntryRef = useRef<HandwritingHistoryEntry | null>(null);

  const exercise =
    practice.exercises[Math.min(exerciseIndex, Math.max(practice.exercises.length - 1, 0))];
  const autoCheckedInList =
    mode === "list" &&
    Boolean(
      exercise &&
        (exercise.kind === "FILL_GAP" ||
          exercise.kind === "CHOOSE_PARTICLE" ||
          exercise.kind === "INLINE_CHOICE" ||
          exercise.kind === "CONJUGATION_CHOICE" ||
          exercise.kind === "LISTEN_CHOOSE" ||
          exercise.kind === "MATCH_PAIRS"),
    );
  const progressPercent =
    practice.exercises.length > 0
      ? Math.round(((exerciseIndex + (feedback !== "idle" ? 1 : 0)) / practice.exercises.length) * 100)
      : 100;

  useLayoutEffect(() => {
    const previousExerciseIndex = previousExerciseIndexRef.current;
    previousExerciseIndexRef.current = exerciseIndex;

    if (
      previousExerciseIndex === exerciseIndex ||
      !window.matchMedia("(max-width: 767px)").matches
    ) {
      return;
    }

    let secondFrameId = 0;
    const firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => {
        const target = practiceScreenRef.current?.closest("[data-lesson-step-card]") as HTMLElement | null;

        if (!target) {
          return;
        }

        const viewportOffset = 76;
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
  }, [exerciseIndex]);

  const selectedWords =
    exercise?.kind === "BUILD_SENTENCE"
      ? selectedWordIndexes
          .map((wordIndex) => exercise.words[wordIndex])
          .filter((word): word is string => Boolean(word))
      : [];
  const answerText = selectedWords.join(" ");
  const matchComplete =
    exercise?.kind === "MATCH_PAIRS" &&
    exercise.pairs.length > 0 &&
    exercise.pairs.every((pair) => matchedPairs[pair.left] === pair.right);
  const matchedPairCount =
    exercise?.kind === "MATCH_PAIRS"
      ? exercise.pairs.filter((pair) => matchedPairs[pair.left] === pair.right).length
      : 0;
  const typeAnswersComplete =
    exercise?.kind === "TYPE_ANSWER" &&
    exercise.typeAnswers.length > 0 &&
    exercise.typeAnswers.every((_, index) => Boolean(typedAnswers[index]?.trim()));
  const dialogueAnswersComplete =
    exercise?.kind === "DIALOGUE_FILL" &&
    exercise.dialogueItems.length > 0 &&
    exercise.dialogueItems.every((item, index) => item.isExample || Boolean(dialogueAnswers[index]?.trim()));
  const canCheck = Boolean(
    exercise &&
      (exercise.kind === "DESCRIPTION"
        ? true
        : exercise.kind === "BUILD_SENTENCE"
        ? selectedWordIndexes.length > 0
        : exercise.kind === "HANDWRITING_TRACE"
          ? handwritingStrokeLength > 0 || handwritingScore.score > 0
        : exercise.kind === "MATCH_PAIRS"
          ? matchComplete
          : exercise.kind === "TYPE_ANSWER"
            ? typeAnswersComplete
            : exercise.kind === "DIALOGUE_FILL"
              ? dialogueAnswersComplete
            : exercise.kind === "LISTEN_TYPE"
            ? typedAnswer.trim()
            : choice.trim()),
  );

  useEffect(() => {
    if (!confettiBurst) {
      return;
    }

    const timeout = window.setTimeout(() => setConfettiBurst(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [confettiBurst]);

  useEffect(() => {
    if (mode !== "list" || feedback === "idle" || completionReportedRef.current) {
      return;
    }

    completionReportedRef.current = true;
    void onComplete(feedback === "correct");
  }, [feedback, mode, onComplete]);

  useEffect(
    () => () => {
      if (wrongPairTimeoutRef.current !== null) {
        window.clearTimeout(wrongPairTimeoutRef.current);
      }
    },
    [],
  );

  useLayoutEffect(() => {
    if (exercise?.kind !== "MATCH_PAIRS") {
      return;
    }

    let frameId = 0;
    const updateLines = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const grid = practiceMatchGridRef.current;
        if (!grid) {
          return;
        }

        const gridBounds = grid.getBoundingClientRect();
        if (!gridBounds.width || !gridBounds.height) {
          return;
        }

        const nextLines = exercise.pairs.flatMap((pair, pairIndex) => {
          if (matchedPairs[pair.left] !== pair.right) {
            return [];
          }

          const leftButton = practiceMatchLeftRefs.current[pair.left];
          const rightButton = practiceMatchRightRefs.current[pair.right];
          if (!leftButton || !rightButton) {
            return [];
          }

          const leftBounds = leftButton.getBoundingClientRect();
          const rightBounds = rightButton.getBoundingClientRect();
          return [{
            id: `${pair.left}-${pair.right}`,
            x1: ((leftBounds.right - gridBounds.left) / gridBounds.width) * 100,
            y1: ((leftBounds.top + leftBounds.height / 2 - gridBounds.top) / gridBounds.height) * 100,
            x2: ((rightBounds.left - gridBounds.left) / gridBounds.width) * 100,
            y2: ((rightBounds.top + rightBounds.height / 2 - gridBounds.top) / gridBounds.height) * 100,
            color: practiceMatchLineColors[pairIndex % practiceMatchLineColors.length],
          }];
        });

        setPracticeMatchLines(nextLines);
      });
    };

    updateLines();
    const resizeObserver = new ResizeObserver(updateLines);
    if (practiceMatchGridRef.current) {
      resizeObserver.observe(practiceMatchGridRef.current);
    }
    window.addEventListener("resize", updateLines);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateLines);
    };
  }, [exercise, matchedPairs]);

  const resetExerciseState = () => {
    setSelectedWordIndexes([]);
    setChoice("");
    setInlineChoiceAnswers({});
    setTypedAnswers({});
    setActiveTypeAnswerIndex(0);
    setDialogueAnswers({});
    setActiveDialogueIndex(0);
    setTypedAnswer("");
    setKoreanKeyboardOpen(false);
    setMatchedPairs({});
    setPracticeMatchLines([]);
    setSelectedPairLeft(null);
    setWrongPairAttempt(null);
    if (wrongPairTimeoutRef.current !== null) {
      window.clearTimeout(wrongPairTimeoutRef.current);
      wrongPairTimeoutRef.current = null;
    }
    setDraggedWord(null);
    setDraggedWordIndex(null);
    setDraggedChoice(null);
    setDraggedChoiceIndex(null);
    setPracticeDragPreview(null);
    setHandwritingStrokeLength(0);
    handwritingStrokeLengthRef.current = 0;
    setHandwritingScore({ score: 0, precision: 0, coverage: 0, hasTemplate: false });
    setHandwritingCursor((current) => ({ ...current, visible: false }));
    setHandwritingTool("pen");
    handwritingHistoryRef.current = [];
    handwritingActiveHistoryEntryRef.current = null;
    setHandwritingHistoryCount(0);
    setHandwritingAccuracyRevealed(false);
    clearHandwritingCanvas();
    setFeedback("idle");
    completionReportedRef.current = false;
  };

  const editTypedAnswerFromKeyboard = (action: KoreanKeyboardAction) => {
    const editingGroupedAnswer = exercise?.kind === "TYPE_ANSWER";
    const editingDialogueAnswer = exercise?.kind === "DIALOGUE_FILL";
    const firstInteractiveDialogueIndex = editingDialogueAnswer
      ? exercise.dialogueItems.findIndex((item) => !item.isExample)
      : -1;
    const activeInputIndex = editingDialogueAnswer
      ? exercise.dialogueItems[activeDialogueIndex]?.isExample && firstInteractiveDialogueIndex >= 0
        ? firstInteractiveDialogueIndex
        : activeDialogueIndex
      : activeTypeAnswerIndex;
    const input = editingDialogueAnswer
      ? dialogueInputRefs.current[activeInputIndex]
      : editingGroupedAnswer
        ? typeAnswerInputRefs.current[activeTypeAnswerIndex]
        : typedAnswerInputRef.current;
    const currentValue = input?.value ?? (
      editingDialogueAnswer
        ? dialogueAnswers[activeInputIndex] ?? ""
        : editingGroupedAnswer
          ? typedAnswers[activeTypeAnswerIndex] ?? ""
          : typedAnswer
    );
    const selectionStart = input?.selectionStart ?? currentValue.length;
    const selectionEnd = input?.selectionEnd ?? selectionStart;
    const beforeSelection = currentValue.slice(0, selectionStart);
    const afterSelection = currentValue.slice(selectionEnd);
    let nextBefore = beforeSelection;

    if (action === "backspace") {
      nextBefore =
        selectionStart !== selectionEnd
          ? beforeSelection
          : removeLastHangulInput(beforeSelection);
    } else if (action === "space") {
      nextBefore = `${beforeSelection} `;
    } else {
      nextBefore = appendHangulInput(beforeSelection, action);
    }

    const proposedValue = `${nextBefore}${afterSelection}`;
    const inlineAnswerLimitReached =
      (editingDialogueAnswer || editingGroupedAnswer) && proposedValue.length > 100;
    const nextValue = inlineAnswerLimitReached ? currentValue : proposedValue;
    const nextCaretPosition = inlineAnswerLimitReached ? selectionStart : nextBefore.length;
    if (editingDialogueAnswer) {
      setDialogueAnswers((current) => ({ ...current, [activeInputIndex]: nextValue }));
    } else if (editingGroupedAnswer) {
      setTypedAnswers((current) => ({ ...current, [activeTypeAnswerIndex]: nextValue }));
    } else {
      setTypedAnswer(nextValue);
    }
    setFeedback("idle");

    window.requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(nextCaretPosition, nextCaretPosition);
    });
  };

  const addBuildWord = (wordIndex: number) => {
    setSelectedWordIndexes((current) =>
      current.includes(wordIndex) ? current : [...current, wordIndex],
    );
    setFeedback("idle");
  };

  const removeBuildWord = (selectedIndex: number) => {
    setSelectedWordIndexes((current) =>
      current.filter((_, entryIndex) => entryIndex !== selectedIndex),
    );
    setFeedback("idle");
  };

  const clearPracticeDrag = () => {
    setDraggedWord(null);
    setDraggedWordIndex(null);
    setDraggedChoice(null);
    setDraggedChoiceIndex(null);
    setPracticeDragPreview(null);
  };

  function clearHandwritingCanvas() {
    const canvas = handwritingCanvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    context?.clearRect(0, 0, canvas.width, canvas.height);
    handwritingPointerRef.current = null;
  }

  const syncHandwritingCanvasSize = () => {
    const canvas = handwritingCanvasRef.current;
    if (!canvas) {
      return false;
    }

    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      return true;
    }

    return false;
  };

  const captureHandwritingHistoryEntry = (canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }

    try {
      return {
        imageData: context.getImageData(0, 0, canvas.width, canvas.height),
        strokeLength: handwritingStrokeLengthRef.current,
      } satisfies HandwritingHistoryEntry;
    } catch {
      return null;
    }
  };

  const pushHandwritingHistory = (entry: HandwritingHistoryEntry) => {
    handwritingHistoryRef.current = [
      ...handwritingHistoryRef.current.slice(-(HANDWRITING_HISTORY_LIMIT - 1)),
      entry,
    ];
    setHandwritingHistoryCount(handwritingHistoryRef.current.length);
  };

  const countHandwritingInkPixels = (imageData: ImageData) => {
    let count = 0;

    for (let index = 3; index < imageData.data.length; index += 4) {
      if (imageData.data[index] > 18) {
        count += 1;
      }
    }

    return count;
  };

  const getActiveHandwritingImages = () => {
    const useMobileTemplates = typeof window !== "undefined"
      && window.matchMedia("(max-width: 767px)").matches
      && exercise?.mobileImageUrls.length;
    const images = useMobileTemplates
      ? handwritingMobileImageRefs.current.filter((image): image is HTMLImageElement => Boolean(image))
      : handwritingImageRef.current
        ? [handwritingImageRef.current]
        : [];

    return images.filter((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
  };

  const drawTemplateToCanvas = (context: CanvasRenderingContext2D, width: number, height: number) => {
    const images = getActiveHandwritingImages();
    if (images.length === 0) {
      return false;
    }

    const useMobileSequence = typeof window !== "undefined"
      && window.matchMedia("(max-width: 767px)").matches
      && exercise?.mobileImageUrls.length;

    if (useMobileSequence) {
      context.clearRect(0, 0, width, height);
      let y = 0;
      for (const image of images) {
        const drawHeight = width * (image.naturalHeight / image.naturalWidth);
        context.drawImage(image, 0, y, width, drawHeight);
        y += drawHeight;
      }
      return true;
    }

    const image = images[0];

    const imageRatio = image.naturalWidth / image.naturalHeight;
    const canvasRatio = width / height;
    const baseDrawWidth = imageRatio > canvasRatio ? width : height * imageRatio;
    const baseDrawHeight = imageRatio > canvasRatio ? width / imageRatio : height;
    const drawWidth = baseDrawWidth * HANDWRITING_TEMPLATE_SCALE;
    const drawHeight = baseDrawHeight * HANDWRITING_TEMPLATE_SCALE;
    const x = (width - drawWidth) / 2;
    const y = (height - drawHeight) / 2;

    context.clearRect(0, 0, width, height);
    context.drawImage(image, x, y, drawWidth, drawHeight);
    return true;
  };

  const isTemplatePixel = (data: Uint8ClampedArray, index: number) => {
    const alpha = data[index + 3];
    if (alpha < 18) {
      return false;
    }

    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const brightness = (red + green + blue) / 3;
    const contrast = Math.max(red, green, blue) - Math.min(red, green, blue);

    return brightness < 238 && (brightness < 226 || contrast > 10);
  };

  const dilateMask = (source: Uint8Array, width: number, height: number, radius: number) => {
    const target = new Uint8Array(source.length);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const sourceIndex = y * width + x;
        if (!source[sourceIndex]) {
          continue;
        }

        for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
          const nextY = y + offsetY;
          if (nextY < 0 || nextY >= height) {
            continue;
          }

          for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
            if (offsetX * offsetX + offsetY * offsetY > radius * radius) {
              continue;
            }

            const nextX = x + offsetX;
            if (nextX < 0 || nextX >= width) {
              continue;
            }

            target[nextY * width + nextX] = 1;
          }
        }
      }
    }

    return target;
  };

  const calculateHandwritingScore = (strokeLength = handwritingStrokeLength) => {
    const canvas = handwritingCanvasRef.current;
    const images = getActiveHandwritingImages();
    if (!canvas || images.length === 0) {
      const fallbackProgress = Math.min(100, Math.round((strokeLength / Math.max(80, exercise?.minStrokeLength ?? 420)) * 100));
      const fallbackScore = {
        score: fallbackProgress,
        precision: fallbackProgress,
        coverage: fallbackProgress,
        hasTemplate: false,
      };
      setHandwritingScore(fallbackScore);
      return fallbackScore;
    }

    syncHandwritingCanvasSize();

    const sourceWidth = canvas.width;
    const sourceHeight = canvas.height;
    const scoreScale = Math.min(1, 560 / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scoreScale));
    const height = Math.max(1, Math.round(sourceHeight * scoreScale));
    const drawnCanvas = document.createElement("canvas");
    drawnCanvas.width = width;
    drawnCanvas.height = height;
    const drawContext = drawnCanvas.getContext("2d", { willReadFrequently: true });
    if (!drawContext) {
      return handwritingScore;
    }
    drawContext.drawImage(canvas, 0, 0, width, height);

    const templateCanvas = document.createElement("canvas");
    templateCanvas.width = width;
    templateCanvas.height = height;
    const templateContext = templateCanvas.getContext("2d", { willReadFrequently: true });
    if (!templateContext) {
      return handwritingScore;
    }

    try {
      if (!drawTemplateToCanvas(templateContext, width, height)) {
        return handwritingScore;
      }

      const templateData = templateContext.getImageData(0, 0, width, height).data;
      const drawnData = drawContext.getImageData(0, 0, width, height).data;
      const targetMask = new Uint8Array(width * height);
      const drawnMask = new Uint8Array(width * height);
      let targetCount = 0;
      let drawnCount = 0;

      for (let index = 0; index < targetMask.length; index += 1) {
        const pixelIndex = index * 4;
        if (isTemplatePixel(templateData, pixelIndex)) {
          targetMask[index] = 1;
          targetCount += 1;
        }

        if (drawnData[pixelIndex + 3] > 18) {
          drawnMask[index] = 1;
          drawnCount += 1;
        }
      }

      if (targetCount === 0 || drawnCount === 0) {
        const emptyScore = { score: 0, precision: 0, coverage: 0, hasTemplate: true };
        setHandwritingScore(emptyScore);
        return emptyScore;
      }

      const tolerantTargetMask = dilateMask(targetMask, width, height, 13);
      const tolerantDrawnMask = dilateMask(drawnMask, width, height, 10);
      let onTargetDrawnCount = 0;
      let coveredTargetCount = 0;

      for (let index = 0; index < targetMask.length; index += 1) {
        if (drawnMask[index] && tolerantTargetMask[index]) {
          onTargetDrawnCount += 1;
        }

        if (targetMask[index] && tolerantDrawnMask[index]) {
          coveredTargetCount += 1;
        }
      }

      const precision = onTargetDrawnCount / drawnCount;
      const coverage = coveredTargetCount / targetCount;
      const score = Math.round(
        Math.max(0, Math.min(1, precision * 0.86 + Math.min(1, coverage * 8) * 0.14)) * 100,
      );
      const nextScore = {
        score,
        precision: Math.round(precision * 100),
        coverage: Math.round(coverage * 100),
        hasTemplate: true,
      };
      setHandwritingScore(nextScore);
      return nextScore;
    } catch {
      const fallbackProgress = Math.min(100, Math.round((strokeLength / Math.max(80, exercise?.minStrokeLength ?? 420)) * 100));
      const fallbackScore = {
        score: fallbackProgress,
        precision: fallbackProgress,
        coverage: fallbackProgress,
        hasTemplate: false,
      };
      setHandwritingScore(fallbackScore);
      return fallbackScore;
    }
  };

  const getCanvasPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  };

  const startHandwritingStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) {
      return;
    }

    const resized = syncHandwritingCanvasSize();
    if (resized) {
      handwritingHistoryRef.current = [];
      setHandwritingHistoryCount(0);
      handwritingStrokeLengthRef.current = 0;
      setHandwritingStrokeLength(0);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event);
    handwritingPointerRef.current = point;
    setHandwritingCursor({ ...point, visible: true });

    const context = event.currentTarget.getContext("2d");
    if (!context) {
      return;
    }

    const historyEntry = captureHandwritingHistoryEntry(event.currentTarget);
    if (historyEntry) {
      handwritingActiveHistoryEntryRef.current = historyEntry;
      pushHandwritingHistory(historyEntry);
    }

    context.lineCap = "round";
    context.lineJoin = "round";
    context.globalCompositeOperation = handwritingTool === "eraser" ? "destination-out" : "source-over";
    context.strokeStyle = "rgba(38, 62, 174, 0.9)";
    context.lineWidth = handwritingTool === "eraser" ? 24 : 3.8;
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineTo(point.x + 0.1, point.y + 0.1);
    context.stroke();
    if (handwritingTool === "pen") {
      setHandwritingStrokeLength((current) => {
        const nextLength = current + 1;
        handwritingStrokeLengthRef.current = nextLength;
        return nextLength;
      });
    }
    setHandwritingAccuracyRevealed(false);
    setFeedback("idle");
  };

  const moveHandwritingStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(event);
    setHandwritingCursor({ ...point, visible: true });
    const previousPoint = handwritingPointerRef.current;
    if (!previousPoint) {
      return;
    }

    const context = event.currentTarget.getContext("2d");
    if (!context) {
      return;
    }

    context.lineCap = "round";
    context.lineJoin = "round";
    context.globalCompositeOperation = handwritingTool === "eraser" ? "destination-out" : "source-over";
    context.strokeStyle = "rgba(38, 62, 174, 0.9)";
    context.lineWidth = handwritingTool === "eraser" ? 24 : 3.8;
    context.beginPath();
    context.moveTo(previousPoint.x, previousPoint.y);
    context.lineTo(point.x, point.y);
    context.stroke();

    if (handwritingTool === "pen") {
      const segmentLength = Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y);
      setHandwritingStrokeLength((current) => {
        const nextLength = current + segmentLength;
        handwritingStrokeLengthRef.current = nextLength;
        return nextLength;
      });
    }
    handwritingPointerRef.current = point;
    setHandwritingAccuracyRevealed(false);
    setFeedback("idle");
  };

  const endHandwritingStroke = () => {
    handwritingPointerRef.current = null;
    const historyEntry = handwritingActiveHistoryEntryRef.current;
    if (!historyEntry) {
      return;
    }

    handwritingActiveHistoryEntryRef.current = null;
    let nextStrokeLength = handwritingStrokeLengthRef.current;

    if (handwritingTool === "eraser") {
      const canvas = handwritingCanvasRef.current;
      const context = canvas?.getContext("2d");

      try {
        if (canvas && context) {
          const previousInkPixels = countHandwritingInkPixels(historyEntry.imageData);
          const currentInkPixels = countHandwritingInkPixels(
            context.getImageData(0, 0, canvas.width, canvas.height),
          );
          nextStrokeLength =
            previousInkPixels > 0
              ? historyEntry.strokeLength * Math.min(1, currentInkPixels / previousInkPixels)
              : 0;
        }
      } catch {
        nextStrokeLength = historyEntry.strokeLength;
      }

      handwritingStrokeLengthRef.current = nextStrokeLength;
      setHandwritingStrokeLength(nextStrokeLength);
    }

    calculateHandwritingScore(nextStrokeLength);
  };

  const undoHandwritingAction = () => {
    const canvas = handwritingCanvasRef.current;
    const context = canvas?.getContext("2d");
    const historyEntry = handwritingHistoryRef.current.pop();
    if (!canvas || !context || !historyEntry) {
      return;
    }

    if (
      historyEntry.imageData.width !== canvas.width ||
      historyEntry.imageData.height !== canvas.height
    ) {
      handwritingHistoryRef.current = [];
      setHandwritingHistoryCount(0);
      return;
    }

    context.globalCompositeOperation = "source-over";
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.putImageData(historyEntry.imageData, 0, 0);
    handwritingStrokeLengthRef.current = historyEntry.strokeLength;
    setHandwritingStrokeLength(historyEntry.strokeLength);
    setHandwritingHistoryCount(handwritingHistoryRef.current.length);
    setHandwritingAccuracyRevealed(false);
    setFeedback("idle");
    calculateHandwritingScore(historyEntry.strokeLength);
  };

  const clearHandwritingDrawing = () => {
    const canvas = handwritingCanvasRef.current;
    if (canvas && handwritingStrokeLengthRef.current > 0) {
      const historyEntry = captureHandwritingHistoryEntry(canvas);
      if (historyEntry) {
        pushHandwritingHistory(historyEntry);
      }
    }

    clearHandwritingCanvas();
    handwritingStrokeLengthRef.current = 0;
    setHandwritingStrokeLength(0);
    setHandwritingScore({
      score: 0,
      precision: 0,
      coverage: 0,
      hasTemplate: getActiveHandwritingImages().length > 0,
    });
    setHandwritingAccuracyRevealed(false);
    setFeedback("idle");
  };

  const celebrateFrom = (source?: ReactMouseEvent<HTMLElement> | HTMLElement | null) => {
    const target =
      source && "currentTarget" in source
        ? source.currentTarget
        : source;
    const bounds = target?.getBoundingClientRect();
    const origin = bounds
      ? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
      : { x: window.innerWidth / 2, y: window.innerHeight * 0.42 };

    confettiBurstIdRef.current += 1;
    setConfettiBurst({
      id: confettiBurstIdRef.current,
      pieces: createConfettiPieces(origin, 30),
    });
  };

  const advancePracticeExercise = () => {
    if (exerciseIndex >= practice.exercises.length - 1) {
      setPracticeCompleting(true);
      void Promise.resolve(onComplete()).finally(() => {
        setPracticeCompleting(false);
      });
      return;
    }

    setExerciseIndex((index) => index + 1);
    resetExerciseState();
  };

  const checkExercise = (event?: ReactMouseEvent<HTMLElement>) => {
    if (!exercise) {
      return;
    }

    if (exercise.kind === "DESCRIPTION") {
      advancePracticeExercise();
      return;
    }

    if (exercise.kind === "HANDWRITING_TRACE") {
      const score = calculateHandwritingScore();
      setFeedback("correct");
      setHandwritingAccuracyRevealed(false);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setHandwritingAccuracyRevealed(true));
      });

      if (score.score >= 80) {
        celebrateFrom(event);
      }
      return;
    }

    const correct =
      exercise.kind === "BUILD_SENTENCE"
        ? normalizePracticeAnswer(answerText) === normalizePracticeAnswer(exercise.answer)
        : exercise.kind === "MATCH_PAIRS"
          ? matchComplete
          : exercise.kind === "TYPE_ANSWER"
            ? exercise.typeAnswers.every(
                (item, index) =>
                  normalizePracticeAnswer(typedAnswers[index] ?? "") ===
                  normalizePracticeAnswer(item.answer),
              )
          : exercise.kind === "DIALOGUE_FILL"
            ? exercise.dialogueItems.every(
                (item, index) =>
                  item.isExample ||
                  normalizePracticeAnswer(dialogueAnswers[index] ?? "") ===
                    normalizePracticeAnswer(item.answer),
              )
          : normalizePracticeAnswer(
              exercise.kind === "LISTEN_TYPE" ? typedAnswer : choice,
            ) ===
            normalizePracticeAnswer(exercise.answer);

    setFeedback(correct ? "correct" : "wrong");

    if (correct) {
      celebrateFrom(event);
    }
  };

  const selectChoiceOption = (
    option: string,
    source?: ReactMouseEvent<HTMLElement> | HTMLElement | null,
  ) => {
    if (!exercise) {
      return;
    }

    setChoice(option);
    const isCorrect = normalizePracticeAnswer(option) === normalizePracticeAnswer(exercise.answer);
    setFeedback(isCorrect ? "correct" : "wrong");
    setDraggedChoice(null);
    setDraggedChoiceIndex(null);
    setPracticeDragPreview(null);

    if (isCorrect) {
      celebrateFrom(source);
    }
  };

  const selectInlineChoiceOption = (
    itemIndex: number,
    option: string,
    source?: ReactMouseEvent<HTMLElement> | HTMLElement | null,
  ) => {
    if (exercise?.kind !== "INLINE_CHOICE" || inlineChoiceAnswers[itemIndex]) {
      return;
    }

    const nextAnswers = { ...inlineChoiceAnswers, [itemIndex]: option };
    setInlineChoiceAnswers(nextAnswers);

    const item = exercise.inlineChoices[itemIndex];
    const isCorrect = normalizePracticeAnswer(option) === normalizePracticeAnswer(item.answer);
    if (isCorrect) {
      celebrateFrom(source);
    }

    if (exercise.inlineChoices.every((_, index) => Boolean(nextAnswers[index]))) {
      const allCorrect = exercise.inlineChoices.every(
        (entry, index) =>
          normalizePracticeAnswer(nextAnswers[index] ?? "") === normalizePracticeAnswer(entry.answer),
      );
      setFeedback(allCorrect ? "correct" : "wrong");
    }
  };

  const selectMatchRight = (right: string, event: ReactMouseEvent<HTMLButtonElement>) => {
    if (exercise?.kind !== "MATCH_PAIRS" || !selectedPairLeft) {
      return;
    }

    const expectedRight = exercise.pairs.find((pair) => pair.left === selectedPairLeft)?.right;

    if (expectedRight !== right) {
      setWrongPairAttempt({ left: selectedPairLeft, right });
      if (wrongPairTimeoutRef.current !== null) {
        window.clearTimeout(wrongPairTimeoutRef.current);
      }
      wrongPairTimeoutRef.current = window.setTimeout(() => {
        setWrongPairAttempt(null);
        wrongPairTimeoutRef.current = null;
      }, 720);
      return;
    }

    if (wrongPairTimeoutRef.current !== null) {
      window.clearTimeout(wrongPairTimeoutRef.current);
      wrongPairTimeoutRef.current = null;
    }

    const nextMatches = { ...matchedPairs, [selectedPairLeft]: right };
    setMatchedPairs(nextMatches);
    setSelectedPairLeft(null);
    setWrongPairAttempt(null);

    const complete = exercise.pairs.every((pair) => nextMatches[pair.left] === pair.right);
    setFeedback(complete ? "correct" : "idle");
    if (complete) {
      celebrateFrom(event);
    }
  };

  const pointInsideElement = (element: HTMLElement | null, x: number, y: number) => {
    if (!element) {
      return false;
    }

    const bounds = element.getBoundingClientRect();
    return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
  };

  const startPracticeWordDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    word: string,
    wordIndex: number,
  ) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) {
        return;
      }

      const distance = Math.hypot(pointerEvent.clientX - startX, pointerEvent.clientY - startY);
      if (!moved && distance <= 4) {
        return;
      }

      moved = true;
      setDraggedWord(word);
      setDraggedWordIndex(wordIndex);
      setPracticeDragPreview({
        kind: "build",
        label: word,
        wordIndex,
        x: pointerEvent.clientX,
        y: pointerEvent.clientY,
      });
    };

    const finishDrag = (pointerEvent: PointerEvent) => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", cancelDrag);

      if (!moved || pointInsideElement(buildDropRef.current, pointerEvent.clientX, pointerEvent.clientY)) {
        addBuildWord(wordIndex);
      }

      clearPracticeDrag();
    };

    const cancelDrag = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", cancelDrag);
      clearPracticeDrag();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", cancelDrag);
  };

  const startPracticeChoiceDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    option: string,
    optionIndex: number,
  ) => {
    if (event.button !== 0 || feedback !== "idle") {
      return;
    }

    event.preventDefault();
    const sourceElement = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) {
        return;
      }

      const distance = Math.hypot(pointerEvent.clientX - startX, pointerEvent.clientY - startY);
      if (!moved && distance <= 4) {
        return;
      }

      moved = true;
      setDraggedChoice(option);
      setDraggedChoiceIndex(optionIndex);
      setPracticeDragPreview({
        kind: "choice",
        label: option,
        option,
        optionIndex,
        x: pointerEvent.clientX,
        y: pointerEvent.clientY,
      });
    };

    const finishDrag = (pointerEvent: PointerEvent) => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", cancelDrag);

      const droppedOnAnswer = pointInsideElement(choiceDropRef.current, pointerEvent.clientX, pointerEvent.clientY);
      const droppedOnSentence = pointInsideElement(
        choiceSentenceDropRef.current,
        pointerEvent.clientX,
        pointerEvent.clientY,
      );

      if (!moved || droppedOnAnswer || droppedOnSentence) {
        selectChoiceOption(
          option,
          moved
            ? droppedOnSentence
              ? choiceSentenceDropRef.current
              : choiceDropRef.current
            : sourceElement,
        );
      } else {
        clearPracticeDrag();
      }
    };

    const cancelDrag = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", cancelDrag);
      clearPracticeDrag();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", cancelDrag);
  };

  const moveNext = () => {
    if (feedback === "idle") {
      return;
    }

    if (mode === "list" && feedback === "wrong") {
      resetExerciseState();
      return;
    }

    advancePracticeExercise();
  };

  if (!exercise) {
    return (
      <VocabularyCompleteCard>
        <VocabularyCompleteIcon aria-hidden>💪</VocabularyCompleteIcon>
        <div>
          <VocabularyCompleteTitle>Упражнений пока нет</VocabularyCompleteTitle>
          <VocabularyCompleteText>Добавьте упражнения в админке, чтобы запустить интерактивный режим.</VocabularyCompleteText>
        </div>
      </VocabularyCompleteCard>
    );
  }

  if (practiceCompleting) {
    return (
      <PracticeTransitionCard>
        <PracticeTransitionOrb aria-hidden>
          <span />
          <span />
          <span />
        </PracticeTransitionOrb>
        <PracticeTransitionCopy>
          <PracticeKind>Практика завершена</PracticeKind>
          <PracticeTransitionTitle>Открываем следующий шаг</PracticeTransitionTitle>
          <PracticeTransitionText>
            Сохраняем прогресс и готовим следующую часть урока.
          </PracticeTransitionText>
        </PracticeTransitionCopy>
        <PracticeTransitionBar aria-hidden>
          <span />
        </PracticeTransitionBar>
      </PracticeTransitionCard>
    );
  }

  const handwritingVisibleScore =
    exercise.kind === "HANDWRITING_TRACE"
      ? handwritingScore.hasTemplate
        ? handwritingScore.score
        : Math.min(100, Math.round((handwritingStrokeLength / Math.max(80, exercise.minStrokeLength)) * 100))
      : 0;
  const handwritingFeedback =
    exercise.kind === "HANDWRITING_TRACE" ? getHandwritingFeedback(handwritingVisibleScore) : null;
  const showHandwritingAccuracy = exercise.kind === "HANDWRITING_TRACE" && feedback !== "idle";
  const practiceTaskImageUrl =
    exercise.kind === "TYPE_ANSWER"
      ? exercise.typeAnswers.length === 1
        ? exercise.typeAnswers[0]?.imageUrl ?? ""
        : ""
      : exercise.imageUrl;
  const renderTypeAnswerInlineSentence = (item: ParsedTypeAnswerItem, itemIndex: number) => {
    const enteredAnswer = typedAnswers[itemIndex] ?? "";
    const submitted = feedback !== "idle";
    const correct =
      submitted && normalizePracticeAnswer(enteredAnswer) === normalizePracticeAnswer(item.answer);
    const wrong = feedback === "wrong" && !correct;
    const displayedAnswer = submitted ? item.answer : enteredAnswer;
    const sentenceTemplate = /[_＿]{2,}/u.test(item.sentence) ? item.sentence : `${item.sentence} ___`;
    const [sentenceBefore, ...sentenceAfterParts] = sentenceTemplate.split(/[_＿]{2,}/u);
    const sentenceAfter = sentenceAfterParts.join("___");

    return (
      <PracticeTypeAnswerInlineLine>
        <span>{sentenceBefore}</span>
        {submitted ? (
          <PracticeDialogueInlineAnswer $state={wrong ? "wrong" : "correct"}>
            {displayedAnswer}
          </PracticeDialogueInlineAnswer>
        ) : (
          <PracticeTypeAnswerInlineInput
            ref={(input) => { typeAnswerInputRefs.current[itemIndex] = input; }}
            value={displayedAnswer}
            aria-label={`Ответ в предложении ${itemIndex + 1}`}
            $state="idle"
            $length={item.answer.length}
            maxLength={100}
            placeholder="[ Введите ответ ]"
            onFocus={() => setActiveTypeAnswerIndex(itemIndex)}
            onChange={(event) => {
              setTypedAnswers((current) => ({ ...current, [itemIndex]: event.target.value }));
              setActiveTypeAnswerIndex(itemIndex);
              setFeedback("idle");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && typeAnswersComplete) {
                event.preventDefault();
                checkExercise();
              }
            }}
          />
        )}
        <span>{sentenceAfter}</span>
      </PracticeTypeAnswerInlineLine>
    );
  };
  const practiceKindHeader = exercise.kind === "TYPE_ANSWER" ? (
    <PracticeTypeAnswerTopRow>
      <PracticeKind>{practiceKindLabel(exercise.kind)}</PracticeKind>
      <KoreanKeyboardToggle
        type="button"
        aria-expanded={koreanKeyboardOpen}
        aria-controls="practice-korean-keyboard"
        onClick={() => setKoreanKeyboardOpen((open) => !open)}
      >
        <KoreanKeyboardToggleIcon aria-hidden>한</KoreanKeyboardToggleIcon>
        <span>
          Нет корейской раскладки?
          <strong>{koreanKeyboardOpen ? "Скрыть клавиатуру" : "Открыть клавиатуру"}</strong>
        </span>
      </KoreanKeyboardToggle>
    </PracticeTypeAnswerTopRow>
  ) : (
    <PracticeKind>{practiceKindLabel(exercise.kind)}</PracticeKind>
  );

  return (
    <PracticeTrainerScreen
      ref={practiceScreenRef}
      $embedded={mode === "list"}
      $instruction={mode === "instruction"}
    >
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
      {practiceDragPreview && typeof document !== "undefined"
        ? createPortal(
            <PracticeFloatingChip
              aria-hidden="true"
              style={{
                left: practiceDragPreview.x,
                top: practiceDragPreview.y,
              }}
            >
              {practiceDragPreview.label}
            </PracticeFloatingChip>,
            document.body,
          )
        : null}
      {mode === "list" ? (
        <PracticeTaskMetaCard>
          <PracticeTaskMetaDesktop>
            <PracticeTopLine>
              <PracticeTopEyebrow>{`Задание ${displayIndex ?? 1}`}</PracticeTopEyebrow>
              <PracticeCounter>
                {`${displayIndex ?? 1} / ${totalTasks ?? practice.exercises.length}`}
              </PracticeCounter>
            </PracticeTopLine>
            {practiceKindHeader}
          </PracticeTaskMetaDesktop>
          <PracticeTaskMetaMobile>
            <PracticeTopEyebrow>{`Задание ${displayIndex ?? 1}`}</PracticeTopEyebrow>
            <PracticeKind>{practiceKindLabel(exercise.kind)}</PracticeKind>
            <PracticeCounter>
              {`${displayIndex ?? 1} / ${totalTasks ?? practice.exercises.length}`}
            </PracticeCounter>
          </PracticeTaskMetaMobile>
        </PracticeTaskMetaCard>
      ) : mode !== "instruction" ? (
        <PracticeTopLine>
          <PracticeTopEyebrow>Упражнения</PracticeTopEyebrow>
          <PracticeCounter>
            {`${Math.min(exerciseIndex + 1, practice.exercises.length)} / ${practice.exercises.length}`}
          </PracticeCounter>
        </PracticeTopLine>
      ) : null}
      {mode === "standalone" ? (
        <PracticeProgressTrack>
          <PracticeProgressFill style={{ width: `${progressPercent}%` }} />
        </PracticeProgressTrack>
      ) : null}

      <PracticeQuestion $instruction={mode === "instruction"}>
        {mode !== "list" ? practiceKindHeader : null}
        <PracticePrompt $compact={mode === "list"}>{exercise.prompt}</PracticePrompt>
        {exercise.description ? <PracticeDescription>{exercise.description}</PracticeDescription> : null}
        {exercise.kind === "DESCRIPTION" &&
        (exercise.imageUrl || exercise.mobileImageUrls.length > 0) ? (
          <PracticeInstructionImageWrap>
            {exercise.imageUrl ? (
              <PracticeInstructionDesktopImage
                $hideOnMobile={exercise.mobileImageUrls.length > 0}
                src={exercise.imageUrl}
                alt={exercise.prompt}
              />
            ) : null}
            {exercise.mobileImageUrls.length > 0 ? (
              <PracticeInstructionMobileSequence>
                {exercise.mobileImageUrls.map((src, mobileIndex) => (
                  <PracticeInstructionMobileImage
                    key={`${src}-${mobileIndex}`}
                    src={src}
                    alt={`${exercise.prompt}: часть ${mobileIndex + 1}`}
                  />
                ))}
              </PracticeInstructionMobileSequence>
            ) : null}
          </PracticeInstructionImageWrap>
        ) : null}
        {exercise.audioUrl && exercise.kind !== "CONJUGATION_CHOICE" ? (
          exercise.kind === "LISTEN_CHOOSE" || exercise.kind === "LISTEN_TYPE" ? (
            <PracticeListeningCard>
              <PracticeListeningIcon aria-hidden>🎧</PracticeListeningIcon>
              <PracticeListeningCopy>
                <PracticeListeningLabel>Прослушайте аудио</PracticeListeningLabel>
                <PracticeListeningHint>
                  {exercise.kind === "LISTEN_CHOOSE"
                    ? "Выберите то, что услышали."
                    : "Напишите услышанное слово или фразу."}
                </PracticeListeningHint>
              </PracticeListeningCopy>
              <PracticeListeningPlayer controls src={exercise.audioUrl}>
                Ваш браузер не поддерживает аудио.
              </PracticeListeningPlayer>
            </PracticeListeningCard>
          ) : (
            <PracticeAudioPanel>
              <span aria-hidden>🎧</span>
              <audio controls src={exercise.audioUrl}>
                Ваш браузер не поддерживает аудио.
              </audio>
            </PracticeAudioPanel>
          )
        ) : null}
        {exercise.kind === "TYPE_ANSWER" &&
        exercise.typeAnswers.length === 1 &&
        exercise.typeAnswers[0]?.question ? (
          <PracticeTypeAnswerQuestion>{exercise.typeAnswers[0].question}</PracticeTypeAnswerQuestion>
        ) : null}
        {exercise.kind === "TYPE_ANSWER" && exercise.typeAnswers.length === 1 ? (
          <PracticeSentence>
            {renderTypeAnswerInlineSentence(
              {
                ...exercise.typeAnswers[0],
                sentence: exercise.typeAnswers[0].sentence || exercise.sentence || "___",
              },
              0,
            )}
          </PracticeSentence>
        ) : null}
        {exercise.sentence &&
        exercise.kind !== "TYPE_ANSWER" &&
        exercise.kind !== "INLINE_CHOICE" &&
        exercise.kind !== "CONJUGATION_CHOICE" &&
        exercise.kind !== "DIALOGUE_FILL" ? (
          <PracticeSentence
            ref={
              exercise.kind === "FILL_GAP" || exercise.kind === "CHOOSE_PARTICLE"
                ? choiceSentenceDropRef
                : undefined
            }
            $dragActive={
              Boolean(draggedChoice) &&
              (exercise.kind === "FILL_GAP" || exercise.kind === "CHOOSE_PARTICLE")
            }
          >
            {renderPracticeSentence(exercise.sentence, feedback !== "idle" ? exercise.answer : undefined)}
          </PracticeSentence>
        ) : null}
      </PracticeQuestion>

      {practiceTaskImageUrl &&
      (exercise.kind === "BUILD_SENTENCE" ||
        exercise.kind === "FILL_GAP" ||
        exercise.kind === "TYPE_ANSWER" ||
        exercise.kind === "CHOOSE_PARTICLE") ? (
        <PracticeTaskImageWrap>
          <PracticeTaskImage src={practiceTaskImageUrl} alt={exercise.prompt} />
        </PracticeTaskImageWrap>
      ) : null}

      {exercise.kind === "INLINE_CHOICE" ? (
        <PracticeInlineChoiceStack>
          {exercise.inlineChoices.map((item, itemIndex) => {
            const selectedAnswer = inlineChoiceAnswers[itemIndex] ?? "";
            const answered = Boolean(selectedAnswer);
            const rowCorrect =
              answered && normalizePracticeAnswer(selectedAnswer) === normalizePracticeAnswer(item.answer);
            const sentenceTemplate = /[_＿]{2,}/.test(item.sentence)
              ? item.sentence
              : `${item.sentence} ___`;
            const sentenceParts = sentenceTemplate.split(/[_＿]{2,}/);

            return (
              <PracticeInlineChoiceCard
                key={`${item.sentence}-${itemIndex}`}
                $hasImage={Boolean(exercise.imageUrl && itemIndex === 0)}
                $tone={!answered ? "idle" : rowCorrect ? "correct" : "wrong"}
              >
                {exercise.imageUrl && itemIndex === 0 ? (
                  <PracticeInlineChoiceImage src={exercise.imageUrl} alt="" />
                ) : null}
                <PracticeInlineChoiceContent>
                  <PracticeInlineChoiceMainRow $numbered={exercise.inlineChoices.length > 1}>
                    {exercise.inlineChoices.length > 1 ? (
                      <PracticeInlineChoiceNumber>{itemIndex + 1}</PracticeInlineChoiceNumber>
                    ) : null}
                    <PracticeInlineChoiceSentence>
                      {sentenceParts.map((part, partIndex) => (
                        <span key={`${sentenceTemplate}-${partIndex}`}>
                          {part}
                          {partIndex < sentenceParts.length - 1 ? (
                            <PracticeInlineOptionGroup role="group" aria-label={`Выберите вариант в предложении ${itemIndex + 1}`}>
                              {item.options.map((option, optionIndex) => {
                                const selected = selectedAnswer === option;
                                const correct =
                                  answered && normalizePracticeAnswer(option) === normalizePracticeAnswer(item.answer);
                                const wrong = answered && selected && !correct;

                                return (
                                  <PracticeInlineOptionButton
                                    key={`${option}-${optionIndex}`}
                                    type="button"
                                    onClick={(event) => selectInlineChoiceOption(itemIndex, option, event)}
                                    disabled={answered}
                                    $selected={selected}
                                    $correct={correct}
                                    $wrong={wrong}
                                  >
                                    {option}
                                  </PracticeInlineOptionButton>
                                );
                              })}
                            </PracticeInlineOptionGroup>
                          ) : null}
                        </span>
                      ))}
                    </PracticeInlineChoiceSentence>
                  </PracticeInlineChoiceMainRow>
                  {answered && !rowCorrect ? (
                    <PracticeInlineRowFeedback $indented={exercise.inlineChoices.length > 1}>
                      <strong>Правильный ответ: {item.answer}</strong>
                      {item.explanation ? <small>{item.explanation}</small> : null}
                    </PracticeInlineRowFeedback>
                  ) : null}
                </PracticeInlineChoiceContent>
              </PracticeInlineChoiceCard>
            );
          })}
        </PracticeInlineChoiceStack>
      ) : null}

      {exercise.kind === "CONJUGATION_CHOICE" ? (
        <PracticeConjugationLab>
          {exercise.category ? (
            <PracticeConjugationCategory>Категория: {exercise.category}</PracticeConjugationCategory>
          ) : null}
          <PracticeConjugationFormula>
            <PracticeConjugationTerm>
              <small>Словарная форма</small>
              <strong>{exercise.baseWord || "—"}</strong>
            </PracticeConjugationTerm>
            <PracticeConjugationOperator aria-hidden>+</PracticeConjugationOperator>
            <PracticeConjugationTerm $accent>
              <small>Окончание</small>
              <strong>{exercise.grammarForm || "—"}</strong>
            </PracticeConjugationTerm>
            <PracticeConjugationOperator aria-hidden>=</PracticeConjugationOperator>
            <PracticeConjugationAnswer $tone={feedback}>
              <small>Ваш ответ</small>
              <strong>{choice || "?"}</strong>
            </PracticeConjugationAnswer>
          </PracticeConjugationFormula>
          <PracticeConjugationPrompt>Выберите правильный вариант:</PracticeConjugationPrompt>
          <PracticeConjugationOptions>
            {exercise.options.map((option, optionIndex) => {
              const selected = choice === option;
              const correct =
                feedback !== "idle" &&
                normalizePracticeAnswer(option) === normalizePracticeAnswer(exercise.answer);
              const wrong = feedback === "wrong" && selected && !correct;

              return (
                <PracticeConjugationOption
                  key={`${option}-${optionIndex}`}
                  type="button"
                  onClick={(event) => selectChoiceOption(option, event)}
                  disabled={feedback !== "idle"}
                  $selected={selected}
                  $correct={correct}
                  $wrong={wrong}
                >
                  {option}
                </PracticeConjugationOption>
              );
            })}
          </PracticeConjugationOptions>
          {feedback === "correct" && exercise.audioUrl ? (
            <PracticeConjugationAudio>
              <span>Прослушать правильную форму</span>
              <audio controls src={exercise.audioUrl}>
                Ваш браузер не поддерживает аудио.
              </audio>
            </PracticeConjugationAudio>
          ) : null}
        </PracticeConjugationLab>
      ) : null}

      {exercise.kind === "BUILD_SENTENCE" ? (
        <PracticeBuildArea>
          <PracticeAnswerGroup>
            <PracticeAnswerLabel>Ваш ответ</PracticeAnswerLabel>
            <PracticeAnswerSlots
              ref={buildDropRef}
              $empty={selectedWordIndexes.length === 0}
              $dragActive={Boolean(draggedWord)}
            >
              {selectedWordIndexes.length > 0
                ? selectedWordIndexes.map((wordIndex, index) => (
                    <PracticeWordChip
                      key={`${wordIndex}-${exercise.words[wordIndex]}-${index}`}
                      type="button"
                      onClick={() => removeBuildWord(index)}
                      $placed
                    >
                      {exercise.words[wordIndex]}
                    </PracticeWordChip>
                  ))
                : "Нажмите слова ниже или перетащите их сюда"}
            </PracticeAnswerSlots>
          </PracticeAnswerGroup>
          <PracticeWordBank>
            {exercise.words.map((word, index) => (
              selectedWordIndexes.includes(index) ? null : (
              <PracticeWordChip
                key={`${word}-${index}`}
                type="button"
                onPointerDown={(event) => startPracticeWordDrag(event, word, index)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    addBuildWord(index);
                  }
                }}
                $placed={false}
                $dragging={draggedWordIndex === index}
              >
                {word}
              </PracticeWordChip>
              )
            ))}
          </PracticeWordBank>
        </PracticeBuildArea>
      ) : null}

      {exercise.kind === "FILL_GAP" || exercise.kind === "CHOOSE_PARTICLE" || exercise.kind === "LISTEN_CHOOSE" ? (
        <PracticeChoiceArea>
          {!exercise.sentence && exercise.kind !== "LISTEN_CHOOSE" ? (
            <PracticeAnswerGroup>
              <PracticeAnswerLabel>Ваш ответ</PracticeAnswerLabel>
              <PracticeAnswerSlots
                ref={choiceDropRef}
                $empty={!choice}
                $dragActive={Boolean(draggedChoice)}
              >
                {choice ? (
                  <PracticeWordChip
                    type="button"
                    onClick={() => {
                      setChoice("");
                      setFeedback("idle");
                    }}
                    $placed
                  >
                    {choice}
                  </PracticeWordChip>
                ) : (
                  "Нажмите вариант ниже или перетащите его сюда"
                )}
              </PracticeAnswerSlots>
            </PracticeAnswerGroup>
          ) : null}

          <QuizOptions $practiceLayout>
            {exercise.options.map((option, index) => {
              if (
                choice === option &&
                feedback === "idle" &&
                Boolean(exercise.sentence) &&
                (exercise.kind === "FILL_GAP" || exercise.kind === "CHOOSE_PARTICLE")
              ) {
                return null;
              }

              const selected = choice === option;
              const correct =
                feedback !== "idle" &&
                normalizePracticeAnswer(option) === normalizePracticeAnswer(exercise.answer);
              const wrong = feedback === "wrong" && selected && !correct;

              return (
                <QuizOptionButton
                  key={`${option}-${index}`}
                  type="button"
                  onPointerDown={(event) => startPracticeChoiceDrag(event, option, index)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectChoiceOption(option, event.currentTarget);
                    }
                  }}
                  disabled={feedback !== "idle"}
                  $selected={selected}
                  $correct={correct}
                  $wrong={wrong}
                  $celebrate={correct && selected}
                  $dragging={draggedChoiceIndex === index}
                >
                  <QuizOptionMarker $correct={correct} $wrong={wrong} $celebrate={correct && selected}>
                    {String.fromCharCode(65 + index)}
                  </QuizOptionMarker>
                  <QuizOptionText>{option}</QuizOptionText>
                  {correct ? <QuizOptionState $tone="correct">Верно</QuizOptionState> : null}
                  {wrong ? <QuizOptionState $tone="wrong">Ваш ответ</QuizOptionState> : null}
                </QuizOptionButton>
              );
            })}
          </QuizOptions>
        </PracticeChoiceArea>
      ) : null}

      {exercise.kind === "DIALOGUE_FILL" ? (
        <PracticeDialogueFillArea>
          <PracticeDialogueKeyboardRow>
            <KoreanKeyboardToggle
              type="button"
              aria-expanded={koreanKeyboardOpen}
              aria-controls="practice-korean-keyboard"
              onClick={() => setKoreanKeyboardOpen((open) => !open)}
            >
              <KoreanKeyboardToggleIcon aria-hidden>한</KoreanKeyboardToggleIcon>
              <span>
                Нет корейской раскладки?
                <strong>{koreanKeyboardOpen ? "Скрыть клавиатуру" : "Открыть клавиатуру"}</strong>
              </span>
            </KoreanKeyboardToggle>
          </PracticeDialogueKeyboardRow>
          <PracticeDialogueList>
            {exercise.dialogueItems.map((item, itemIndex) => {
              const enteredAnswer = dialogueAnswers[itemIndex] ?? "";
              const submitted = feedback !== "idle";
              const correct = item.isExample || (
                submitted && normalizePracticeAnswer(enteredAnswer) === normalizePracticeAnswer(item.answer)
              );
              const wrong = submitted && !item.isExample && !correct;
              const displayedAnswer = item.isExample || submitted ? item.answer : enteredAnswer;
              const sentenceTemplate = /[_＿]{2,}/u.test(item.sentence)
                ? item.sentence
                : `${item.sentence} ___`;
              const [sentenceBefore, ...sentenceAfterParts] = sentenceTemplate.split(/[_＿]{2,}/u);
              const sentenceAfter = sentenceAfterParts.join("___");

              return (
                <PracticeDialogueRow key={`${item.question}-${itemIndex}`} $hasImage={Boolean(item.imageUrl)}>
                  <PracticeInlineChoiceNumber>{itemIndex + 1}</PracticeInlineChoiceNumber>
                  {item.imageUrl ? (
                    <PracticeDialogueImage src={item.imageUrl} alt={item.question || exercise.prompt} />
                  ) : null}
                  <PracticeDialogueContent>
                    {item.isExample ? <PracticeDialogueExampleBadge>Пример</PracticeDialogueExampleBadge> : null}
                    {item.question ? <PracticeDialogueQuestion>{item.question}</PracticeDialogueQuestion> : null}
                    <PracticeDialogueSentence>
                      <span>{sentenceBefore}</span>
                      {item.isExample || submitted ? (
                        <PracticeDialogueInlineAnswer
                          $state={item.isExample ? "example" : wrong ? "wrong" : correct ? "correct" : "idle"}
                        >
                          {displayedAnswer}
                        </PracticeDialogueInlineAnswer>
                      ) : (
                        <PracticeDialogueInlineInput
                          ref={(input) => { dialogueInputRefs.current[itemIndex] = input; }}
                          value={displayedAnswer}
                          aria-label={`Ответ в диалоге ${itemIndex + 1}`}
                          aria-invalid={wrong}
                          $state="idle"
                          $length={Math.max(displayedAnswer.length, item.answer.length)}
                          maxLength={100}
                          onFocus={() => setActiveDialogueIndex(itemIndex)}
                          onChange={(event) => {
                            setDialogueAnswers((current) => ({ ...current, [itemIndex]: event.target.value }));
                            setActiveDialogueIndex(itemIndex);
                            setFeedback("idle");
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && dialogueAnswersComplete) {
                              event.preventDefault();
                              checkExercise();
                            }
                          }}
                        />
                      )}
                      <span>{sentenceAfter}</span>
                    </PracticeDialogueSentence>
                    {wrong ? (
                      <PracticeDialogueWrongNote>Неверный ответ — показан правильный вариант.</PracticeDialogueWrongNote>
                    ) : null}
                    {wrong && item.explanation ? (
                      <PracticeDialogueExplanation>{item.explanation}</PracticeDialogueExplanation>
                    ) : null}
                  </PracticeDialogueContent>
                </PracticeDialogueRow>
              );
            })}
          </PracticeDialogueList>
          {koreanKeyboardOpen ? (
            <KoreanKeyboard
              id="practice-korean-keyboard"
              onInput={editTypedAnswerFromKeyboard}
              onClose={() => setKoreanKeyboardOpen(false)}
            />
          ) : null}
        </PracticeDialogueFillArea>
      ) : null}

      {exercise.kind === "LISTEN_TYPE" ||
      (exercise.kind === "TYPE_ANSWER" && (exercise.typeAnswers.length > 1 || koreanKeyboardOpen)) ? (
        <PracticeTypeAnswerCard $listening={exercise.kind === "LISTEN_TYPE"}>
          {exercise.kind === "LISTEN_TYPE" ? (
            <PracticeTypeAnswerHeader $answerLabelHidden={false}>
              <PracticeAnswerLabel>Ваш ответ</PracticeAnswerLabel>
              <KoreanKeyboardToggle
                type="button"
                aria-expanded={koreanKeyboardOpen}
                aria-controls="practice-korean-keyboard"
                onClick={() => setKoreanKeyboardOpen((open) => !open)}
              >
                <KoreanKeyboardToggleIcon aria-hidden>한</KoreanKeyboardToggleIcon>
                <span>
                  Нет корейской раскладки?
                  <strong>{koreanKeyboardOpen ? "Скрыть клавиатуру" : "Открыть клавиатуру"}</strong>
                </span>
              </KoreanKeyboardToggle>
            </PracticeTypeAnswerHeader>
          ) : null}
          {exercise.kind === "TYPE_ANSWER" && exercise.typeAnswers.length > 1 ? (
            <PracticeTypeAnswerStack>
              {exercise.typeAnswers.map((item, itemIndex) => {
                const itemValue = typedAnswers[itemIndex] ?? "";
                const itemCorrect =
                  feedback !== "idle" &&
                  normalizePracticeAnswer(itemValue) === normalizePracticeAnswer(item.answer);
                const itemWrong = feedback === "wrong" && !itemCorrect;

                return (
                  <PracticeTypeAnswerItem key={`${item.sentence}-${itemIndex}`}>
                    <PracticeTypeAnswerMainRow>
                      <PracticeInlineChoiceNumber>{itemIndex + 1}</PracticeInlineChoiceNumber>
                      <PracticeTypeAnswerItemContent>
                        {item.question ? (
                          <PracticeTypeAnswerQuestion>{item.question}</PracticeTypeAnswerQuestion>
                        ) : null}
                        <PracticeTypeAnswerSentence>
                          {renderTypeAnswerInlineSentence(
                            { ...item, sentence: item.sentence || "___" },
                            itemIndex,
                          )}
                        </PracticeTypeAnswerSentence>
                        {item.imageUrl ? (
                          <PracticeTypeAnswerImage src={item.imageUrl} alt={item.sentence || exercise.prompt} />
                        ) : null}
                        {itemWrong ? (
                          <PracticeTypeAnswerFeedback>
                            <strong>Правильный ответ: {item.answer}</strong>
                            {item.explanation ? <small>{item.explanation}</small> : null}
                          </PracticeTypeAnswerFeedback>
                        ) : null}
                      </PracticeTypeAnswerItemContent>
                    </PracticeTypeAnswerMainRow>
                  </PracticeTypeAnswerItem>
                );
              })}
            </PracticeTypeAnswerStack>
          ) : exercise.kind === "LISTEN_TYPE" ? (
            <VocabularyTypeInput
              ref={typedAnswerInputRef}
              value={typedAnswer}
              onChange={(event) => {
                setTypedAnswer(event.target.value);
                setFeedback("idle");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && typedAnswer.trim()) {
                  event.preventDefault();
                  checkExercise();
                }
              }}
              placeholder="Введите ответ"
            />
          ) : null}
          {koreanKeyboardOpen ? (
            <KoreanKeyboard
              id="practice-korean-keyboard"
              onInput={editTypedAnswerFromKeyboard}
              onClose={() => setKoreanKeyboardOpen(false)}
            />
          ) : null}
        </PracticeTypeAnswerCard>
      ) : null}

      {exercise.kind === "HANDWRITING_TRACE" ? (
        <PracticeHandwritingArea>
          <PracticeHandwritingFrame>
            {exercise.imageUrl ? (
              <>
                <PracticeHandwritingPicture $hasMobileSequence={exercise.mobileImageUrls.length > 0}>
                <PracticeHandwritingImage
                  ref={handwritingImageRef}
                  src={exercise.imageUrl}
                  alt={exercise.answer || exercise.prompt}
                  onLoad={() => calculateHandwritingScore()}
                />
                </PracticeHandwritingPicture>
                {exercise.mobileImageUrls.length > 0 ? (
                  <PracticeHandwritingMobileSequence>
                    {exercise.mobileImageUrls.map((mobileImageUrl, mobileImageIndex) => (
                      <PracticeHandwritingMobileImage
                        key={`${mobileImageUrl}-${mobileImageIndex}`}
                        ref={(image) => { handwritingMobileImageRefs.current[mobileImageIndex] = image; }}
                        src={mobileImageUrl}
                        alt={`${exercise.answer || exercise.prompt}, часть ${mobileImageIndex + 1}`}
                        onLoad={() => window.requestAnimationFrame(() => calculateHandwritingScore())}
                      />
                    ))}
                  </PracticeHandwritingMobileSequence>
                ) : null}
              </>
            ) : (
              <PracticeHandwritingPlaceholder>
                Загрузите изображение-шаблон в админке
              </PracticeHandwritingPlaceholder>
            )}
            <PracticeHandwritingCanvas
              ref={handwritingCanvasRef}
              aria-label="Поле для письма"
              onPointerDown={startHandwritingStroke}
              onPointerMove={moveHandwritingStroke}
              onPointerUp={endHandwritingStroke}
              onPointerCancel={endHandwritingStroke}
              onPointerLeave={() => {
                endHandwritingStroke();
                setHandwritingCursor((current) => ({ ...current, visible: false }));
              }}
            />
            {handwritingCursor.visible ? (
              handwritingTool === "eraser" ? (
                <PracticeEraserCursor
                  aria-hidden="true"
                  style={{
                    left: handwritingCursor.x,
                    top: handwritingCursor.y,
                  }}
                />
              ) : (
                <PracticeFeatherCursor
                  aria-hidden="true"
                  style={{
                    left: handwritingCursor.x,
                    top: handwritingCursor.y,
                  }}
                />
              )
            ) : null}
          </PracticeHandwritingFrame>
          <PracticeHandwritingMeta>
            <PracticeHandwritingTools role="group" aria-label="Инструменты для письма">
              <PracticeHandwritingToolButton
                type="button"
                onClick={undoHandwritingAction}
                disabled={handwritingHistoryCount === 0}
                aria-label="Отменить последнее действие"
                title="Отменить последнее действие"
              >
                <span aria-hidden="true">↶</span>
                Отменить
              </PracticeHandwritingToolButton>
              <PracticeHandwritingToolButton
                type="button"
                $active={handwritingTool === "pen"}
                aria-pressed={handwritingTool === "pen"}
                onClick={() => setHandwritingTool("pen")}
              >
                <span aria-hidden="true">✎</span>
                Перо
              </PracticeHandwritingToolButton>
              <PracticeHandwritingToolButton
                type="button"
                $active={handwritingTool === "eraser"}
                aria-pressed={handwritingTool === "eraser"}
                onClick={() => setHandwritingTool("eraser")}
              >
                <span aria-hidden="true">▱</span>
                Ластик
              </PracticeHandwritingToolButton>
            </PracticeHandwritingTools>
            {showHandwritingAccuracy ? (
              <PracticeAccuracyPanel>
                <PracticeAccuracyTopline>
                  <span>Точность</span>
                  <strong>{handwritingVisibleScore}%</strong>
                </PracticeAccuracyTopline>
                <PracticeAccuracyTrack>
                  <PracticeAccuracyFill
                    style={{
                      width: `${handwritingAccuracyRevealed ? handwritingVisibleScore : 0}%`,
                    }}
                  />
                </PracticeAccuracyTrack>
              </PracticeAccuracyPanel>
            ) : null}
            <button
              type="button"
              onClick={clearHandwritingDrawing}
            >
              Очистить
            </button>
          </PracticeHandwritingMeta>
        </PracticeHandwritingArea>
      ) : null}

      {exercise.kind === "MATCH_PAIRS" ? (
        <PracticeMatchBoard>
          <PracticeMatchHeader>
            <PracticeMatchMiniIcon aria-hidden="true">연</PracticeMatchMiniIcon>
            <PracticeMatchHeaderCopy>
              <strong>Соберите пары</strong>
              <span>Фраза слева должна подходить ответу справа</span>
            </PracticeMatchHeaderCopy>
            <PracticeMatchProgress>
              <strong>{matchedPairCount}</strong>
              <span aria-hidden="true">/</span>
              <strong>{exercise.pairs.length}</strong>
            </PracticeMatchProgress>
          </PracticeMatchHeader>

          <PracticeMatchGuide $wrong={Boolean(wrongPairAttempt)}>
            <span aria-hidden="true">{wrongPairAttempt ? "↻" : selectedPairLeft ? "→" : "✦"}</span>
            {wrongPairAttempt
              ? "Почти! Эта фраза подходит к другому ответу."
              : selectedPairLeft
                ? "Отлично, теперь выберите ответ справа."
                : matchedPairCount > 0
                  ? "Продолжайте — выберите следующую фразу слева."
                  : "Сначала выберите любую фразу в левой колонке."}
          </PracticeMatchGuide>

          <PracticeMatchGrid ref={practiceMatchGridRef}>
            <PracticeMatchLineLayer viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {practiceMatchLines.map((line) => {
                const middleX = (line.x1 + line.x2) / 2;
                const path = `M ${line.x1} ${line.y1} C ${middleX} ${line.y1}, ${middleX} ${line.y2}, ${line.x2} ${line.y2}`;
                return (
                  <g key={line.id}>
                    <path className="practice-match-glow" d={path} stroke={line.color} pathLength="1" vectorEffect="non-scaling-stroke" />
                    <path className="practice-match-core" d={path} stroke={line.color} pathLength="1" vectorEffect="non-scaling-stroke" />
                    <path className="practice-match-flow" d={path} stroke={line.color} pathLength="1" vectorEffect="non-scaling-stroke" />
                  </g>
                );
              })}
            </PracticeMatchLineLayer>
            <PracticeMatchColumn>
              <PracticeMatchColumnTitle>
                Корейские фразы
              </PracticeMatchColumnTitle>
              {exercise.pairs.map((pair) => {
                const isCorrect = matchedPairs[pair.left] === pair.right;
                const isWrong = wrongPairAttempt?.left === pair.left;
                const state = isCorrect
                  ? "correct"
                  : isWrong
                    ? "wrong"
                    : selectedPairLeft === pair.left
                      ? "selected"
                      : "idle";

                return (
                  <PracticeMatchButton
                    key={pair.left}
                    ref={(button) => { practiceMatchLeftRefs.current[pair.left] = button; }}
                    type="button"
                    $state={state}
                    $side="left"
                    disabled={isCorrect}
                    onClick={() => {
                      setSelectedPairLeft((current) => (current === pair.left ? null : pair.left));
                      setWrongPairAttempt(null);
                      setFeedback("idle");
                    }}
                  >
                    <span>{pair.left}</span>
                    <PracticeMatchEndpoint $state={state} aria-hidden="true" />
                  </PracticeMatchButton>
                );
              })}
            </PracticeMatchColumn>

            <PracticeMatchColumn>
              <PracticeMatchColumnTitle>
                Подходящие ответы
              </PracticeMatchColumnTitle>
              {shuffleStable(exercise.pairs.map((pair) => pair.right)).map((right) => {
                const isCorrect = Object.values(matchedPairs).includes(right);
                const isWrong = wrongPairAttempt?.right === right;
                const state = isCorrect ? "correct" : isWrong ? "wrong" : "idle";

                return (
                  <PracticeMatchButton
                    key={right}
                    ref={(button) => { practiceMatchRightRefs.current[right] = button; }}
                    type="button"
                    $state={state}
                    $side="right"
                    disabled={isCorrect || !selectedPairLeft}
                    onClick={(event) => selectMatchRight(right, event)}
                  >
                    <PracticeMatchEndpoint $state={state} aria-hidden="true" />
                    <span>{right}</span>
                  </PracticeMatchButton>
                );
              })}
            </PracticeMatchColumn>
          </PracticeMatchGrid>
        </PracticeMatchBoard>
      ) : null}

      {feedback !== "idle" &&
      !(exercise.kind === "INLINE_CHOICE" && feedback === "wrong") &&
      !(exercise.kind === "TYPE_ANSWER" && exercise.typeAnswers.length > 1 && feedback === "wrong") &&
      !(exercise.kind === "DIALOGUE_FILL" && feedback === "wrong") ? (
        <PracticeFeedback
          $tone={handwritingFeedback?.tone ?? (feedback === "correct" ? "success" : "danger")}
        >
          {handwritingFeedback?.title || feedback === "correct" ? (
            <span>{handwritingFeedback?.title ?? "✅ Отлично!"}</span>
          ) : null}
          {handwritingFeedback?.detail || feedback === "wrong" ? (
            <strong>
              {handwritingFeedback?.detail ?? `Правильный ответ: ${exercise.answer || "проверьте правило"}`}
            </strong>
          ) : null}
          {exercise.explanation &&
          !handwritingFeedback &&
          !(exercise.kind === "TYPE_ANSWER" && exercise.typeAnswers.length > 1) ? (
            <small>{exercise.explanation}</small>
          ) : null}
        </PracticeFeedback>
      ) : null}

      {!autoCheckedInList && !(mode === "list" && feedback !== "idle") ? (
        <PracticeActions>
        {feedback !== "idle" ? (
          <PrimaryButton type="button" onClick={moveNext}>
            {mode === "list" && feedback === "wrong"
              ? "Попробовать снова"
              : exerciseIndex >= practice.exercises.length - 1
              ? feedback === "correct"
                ? mode === "list"
                  ? "Готово ✓"
                  : "+30 XP 🎉 Завершить"
                : "Завершить"
              : "Дальше"}
          </PrimaryButton>
        ) : (
          <PrimaryButton type="button" onClick={checkExercise} disabled={!canCheck}>
            {exercise.kind === "DESCRIPTION"
              ? "Дальше"
              : exercise.kind === "HANDWRITING_TRACE"
                ? "Проверить письмо"
                : exercise.kind === "MATCH_PAIRS"
                  ? `Соединено ${matchedPairCount} из ${exercise.pairs.length}`
                  : "Проверить"}
          </PrimaryButton>
        )}
        </PracticeActions>
      ) : null}
    </PracticeTrainerScreen>
  );
}

function renderPracticeSentence(sentence: string, answer?: string) {
  const template = sentence.trim() || "___";
  const placeholder = answer?.trim() || "\u00a0";
  const blankPattern = /[_＿]{2,}/;
  const normalized = blankPattern.test(template) ? template : `${template} ___`;
  const parts = normalized.split(blankPattern);

  return parts.map((part, index) => (
    <span key={`${normalized}-${index}`}>
      {part}
      {index < parts.length - 1 ? <QuizBlank>{placeholder}</QuizBlank> : null}
    </span>
  ));
}

const PracticePageShell = styled.div`
  display: grid;
  gap: 1.2rem;

  @media (max-width: 767px) {
    gap: 0;
  }
`;

const PracticePageHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid rgba(177, 191, 255, 0.72);
  border-radius: 1.55rem;
  background:
    radial-gradient(circle at 92% 0%, rgba(137, 92, 246, 0.13), transparent 34%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(245, 248, 255, 0.94));
  padding: clamp(1.05rem, 2.5vw, 1.5rem);
  box-shadow: 0 16px 38px rgba(51, 67, 145, 0.09);

  > div {
    flex: 1 1 auto;
    min-width: 0;
  }

  h3 {
    margin-top: 0.35rem;
    color: #17203d;
    font-size: clamp(1.35rem, 3vw, 2rem);
    font-weight: 950;
    line-height: 1.12;
  }

  p:not(:first-child) {
    max-width: none;
    margin-top: 0.45rem;
    color: #69789d;
    font-size: clamp(0.9rem, 1.5vw, 1rem);
    font-weight: 650;
    line-height: 1.55;
  }

  @media (min-width: 900px) {
    p:not(:first-child) {
      white-space: nowrap;
    }
  }

  @media (max-width: 620px) {
    flex-direction: column;
  }

  @media (max-width: 767px) {
    border: 0;
    border-radius: 0;
    background: rgba(255, 255, 255, 0.94);
    padding: 1.15rem 0.8rem 0.75rem;
    box-shadow: none;
  }
`;

const PracticePageBadge = styled.span`
  flex: 0 0 auto;
  border: 1px solid rgba(112, 130, 255, 0.28);
  border-radius: 999px;
  background: rgba(239, 242, 255, 0.92);
  color: #5264e6;
  padding: 0.58rem 0.85rem;
  font-size: 0.78rem;
  font-weight: 900;
`;

const PracticePageProgress = styled.div`
  display: grid;
  gap: 0.55rem;
  border: 1px solid rgba(185, 198, 255, 0.68);
  border-radius: 1.25rem;
  background: rgba(255, 255, 255, 0.8);
  padding: 0.9rem 1rem;

  > div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    color: #7180a4;
    font-size: 0.82rem;
    font-weight: 800;
  }

  strong {
    color: #4257df;
    font-size: 0.92rem;
  }

  @media (max-width: 767px) {
    border: 0;
    border-radius: 0 0 1.5rem 1.5rem;
    background: rgba(255, 255, 255, 0.94);
    padding: 0.25rem 0.8rem 1.15rem;
  }
`;

const PracticeTaskList = styled.div`
  display: grid;
  gap: 0.95rem;

  @media (max-width: 767px) {
    margin-top: 0.75rem;
    padding-inline: 0.35rem;
  }
`;

const PracticePageNavigation = styled.div`
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-top: 1px solid rgba(184, 195, 245, 0.68);
  padding-top: 1.15rem;

  > button:first-child {
    min-height: 3.2rem;
    border: 1px solid rgba(155, 171, 244, 0.74);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.9);
    color: #263553;
    padding: 0.75rem 1.15rem;
    font-size: 0.9rem;
    font-weight: 900;

    &:disabled {
      cursor: not-allowed;
      opacity: 0.42;
    }
  }

  ${PrimaryButton} {
    min-width: 13.5rem;
    min-height: 3.35rem;
  }

  @media (max-width: 700px) {
    grid-template-columns: 1fr 1fr;
    justify-content: stretch;

    ${PrimaryButton} {
      min-width: 0;
    }
  }
`;

const PracticeEmptyState = styled.div`
  display: grid;
  min-height: 18rem;
  place-items: center;
  align-content: center;
  gap: 0.65rem;
  border: 1px dashed rgba(152, 169, 244, 0.72);
  border-radius: 1.6rem;
  background: rgba(248, 250, 255, 0.8);
  color: #7180a4;
  text-align: center;

  span {
    color: #6778ef;
    font-size: 2rem;
  }

  strong {
    color: #1c2949;
    font-size: 1.2rem;
  }
`;

const PracticeTrainerScreen = styled.div<{ $embedded: boolean; $instruction: boolean }>`
  display: grid;
  gap: ${({ $embedded }) => ($embedded ? "0.82rem" : "clamp(1.1rem, 2.5vw, 1.7rem)")};
  align-content: ${({ $instruction }) => ($instruction ? "center" : "start")};
  min-height: ${({ $embedded }) => ($embedded ? "auto" : "min(70vh, 44rem)")};
  border: ${({ $embedded }) => ($embedded ? "1px solid rgba(190, 199, 235, 0.7)" : "0")};
  border-radius: ${({ $embedded }) => ($embedded ? "1.55rem" : "0")};
  background: ${({ $embedded }) =>
    $embedded
      ? "rgba(255, 255, 255, 0.93)"
      : "transparent"};
  padding: ${({ $embedded }) =>
    $embedded ? "clamp(0.95rem, 2.2vw, 1.25rem)" : "clamp(0.75rem, 2vw, 1rem)"};
  box-shadow: ${({ $embedded }) => ($embedded ? "0 10px 28px rgba(51, 67, 145, 0.065)" : "none")};

  @media (max-width: 767px) {
    min-width: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    padding: 0.5rem 0;
    box-shadow: none;
  }
`;

const practiceTransitionFloat = keyframes`
  0%, 100% {
    transform: translateY(0) scale(1);
    opacity: 0.82;
  }

  50% {
    transform: translateY(-0.55rem) scale(1.06);
    opacity: 1;
  }
`;

const practiceTransitionFill = keyframes`
  from {
    transform: translateX(-100%);
  }

  to {
    transform: translateX(100%);
  }
`;

const PracticeTransitionCard = styled.div`
  display: grid;
  place-items: center;
  gap: 1.35rem;
  min-height: min(64vh, 38rem);
  padding: clamp(2rem, 5vw, 4rem);
  border: 1px solid rgba(181, 196, 255, 0.86);
  border-radius: 2rem;
  background:
    radial-gradient(circle at 22% 18%, rgba(139, 92, 246, 0.18), transparent 28%),
    radial-gradient(circle at 78% 20%, rgba(82, 99, 255, 0.16), transparent 30%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(242, 246, 255, 0.94));
  text-align: center;
  box-shadow: 0 24px 70px rgba(46, 59, 146, 0.13);
`;

const PracticeTransitionOrb = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.65rem;
  align-items: end;

  span {
    display: block;
    width: clamp(1.25rem, 3vw, 2rem);
    height: clamp(1.25rem, 3vw, 2rem);
    border-radius: 999px;
    background: linear-gradient(135deg, #5a6cff, #8b5cf6);
    box-shadow: 0 14px 28px rgba(82, 99, 255, 0.24);
    animation: ${practiceTransitionFloat} 980ms ease-in-out infinite;
  }

  span:nth-child(2) {
    animation-delay: 120ms;
  }

  span:nth-child(3) {
    animation-delay: 240ms;
  }
`;

const PracticeTransitionCopy = styled.div`
  display: grid;
  justify-items: center;
  gap: 0.8rem;
`;

const PracticeTransitionTitle = styled.h3`
  color: #17203d;
  font-size: clamp(2rem, 4.5vw, 3.35rem);
  font-weight: 950;
  line-height: 1.04;
`;

const PracticeTransitionText = styled.p`
  max-width: 30rem;
  color: #60709c;
  font-size: clamp(1rem, 1.8vw, 1.15rem);
  font-weight: 650;
  line-height: 1.65;
`;

const PracticeTransitionBar = styled.div`
  overflow: hidden;
  width: min(100%, 28rem);
  height: 0.78rem;
  border-radius: 999px;
  background: rgba(221, 226, 255, 0.92);
  box-shadow: inset 0 0 0 1px rgba(181, 196, 255, 0.38);

  span {
    display: block;
    width: 52%;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, transparent, #5a6cff, #8b5cf6, transparent);
    animation: ${practiceTransitionFill} 1.15s ease-in-out infinite;
  }
`;

const PracticeQuestion = styled.div<{ $instruction: boolean }>`
  display: grid;
  gap: 0.72rem;
  justify-items: ${({ $instruction }) => ($instruction ? "center" : "stretch")};
  text-align: ${({ $instruction }) => ($instruction ? "center" : "left")};
`;

const PracticeTypeAnswerTopRow = styled.div`
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
`;

const PracticeKind = styled.span`
  display: inline-flex;
  width: fit-content;
  min-height: 2.05rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid rgba(112, 120, 239, 0.1);
  background: rgba(241, 239, 255, 0.92);
  color: var(--accent-dark);
  padding: 0.5rem 0.85rem;
  font-size: 0.78rem;
  font-weight: 950;
  line-height: 1;
  letter-spacing: 0.14em;
  text-transform: uppercase;
`;

const PracticePrompt = styled.h3<{ $compact: boolean }>`
  color: #17203d;
  font-size: ${({ $compact }) => ($compact ? "clamp(1.38rem, 2.45vw, 1.92rem)" : "clamp(1.9rem, 4.2vw, 3.15rem)")};
  font-weight: 950;
  line-height: 1.14;
  max-width: 60rem;
`;

const PracticeDescription = styled.div`
  max-width: 58rem;
  border-left: 3px solid rgba(82, 99, 255, 0.4);
  border-radius: 0.9rem;
  background: rgba(246, 248, 255, 0.78);
  color: #4c5d84;
  padding: 0.82rem 1rem;
  font-size: clamp(1rem, 1.8vw, 1.14rem);
  font-weight: 650;
  line-height: 1.7;
  white-space: pre-wrap;
`;

const PracticeInstructionImageWrap = styled.div`
  width: 100%;
  margin-inline: auto;
  background: transparent;

  @media (max-width: 767px) {
    width: calc(100% + 1.1rem);
    margin-inline: -0.55rem;
  }
`;

const PracticeInstructionDesktopImage = styled.img<{ $hideOnMobile: boolean }>`
  display: block;
  width: 100%;
  height: auto;
  margin-inline: auto;
  background: transparent;
  object-fit: contain;
  object-position: center;

  @media (max-width: 767px) {
    display: ${({ $hideOnMobile }) => ($hideOnMobile ? "none" : "block")};
  }
`;

const PracticeInstructionMobileSequence = styled.div`
  display: none;

  @media (max-width: 767px) {
    display: grid;
    width: 100%;
    gap: 0.8rem;
  }
`;

const PracticeInstructionMobileImage = styled.img`
  display: block;
  width: 100%;
  height: auto;
  margin-inline: auto;
  background: transparent;
  object-fit: contain;
  object-position: center;
`;

const PracticeAudioPanel = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 28rem);
  align-items: center;
  gap: 0.85rem;
  width: fit-content;
  max-width: 100%;
  border: 1px solid rgba(181, 196, 255, 0.82);
  border-radius: 1.2rem;
  background: rgba(255, 255, 255, 0.82);
  padding: 0.75rem 0.85rem;
  box-shadow: 0 12px 28px rgba(46, 59, 146, 0.08);

  span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.35rem;
    height: 2.35rem;
    border-radius: 999px;
    background: rgba(90, 108, 255, 0.12);
  }

  audio {
    width: min(28rem, 70vw);
  }

  @media (max-width: 560px) {
    grid-template-columns: 1fr;

    audio {
      width: 100%;
    }
  }
`;

const PracticeSentence = styled.div<{ $dragActive?: boolean }>`
  border: 1px solid
    ${({ $dragActive = false }) =>
      $dragActive ? "rgba(82, 99, 255, 0.95)" : "rgba(181, 196, 255, 0.76)"};
  border-radius: 1.05rem;
  background: ${({ $dragActive = false }) =>
    $dragActive
      ? "linear-gradient(135deg, rgba(238, 242, 255, 0.98), rgba(245, 243, 255, 0.94))"
      : "rgba(251, 252, 255, 0.92)"};
  color: #273657;
  padding: 0.95rem 1.1rem;
  font-size: clamp(1.18rem, 2.4vw, 1.6rem);
  font-weight: 800;
  line-height: 1.8;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    box-shadow 160ms ease;
  box-shadow: ${({ $dragActive = false }) =>
    $dragActive ? "inset 0 0 0 4px rgba(82, 99, 255, 0.08)" : "none"};

  @media (max-width: 767px) {
    border: 0;
    border-radius: 0;
    background: transparent;
    padding-inline: 0;
    box-shadow: none;
  }
`;

const PracticeTaskImageWrap = styled.div`
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 1.25rem;
  padding: clamp(0.65rem, 2vw, 1rem);

  @media (max-width: 767px) {
    width: calc(100% + 1.1rem);
    margin-inline: -0.55rem;
    padding-inline: 0;
  }
`;

const PracticeTaskImage = styled.img`
  display: block;
  width: auto;
  max-width: 100%;
  max-height: min(26rem, 52vh);
  border-radius: 0.9rem;
  object-fit: contain;
`;

const PracticeInlineChoiceStack = styled.div`
  display: grid;
  gap: 0.9rem;
`;

const PracticeInlineChoiceCard = styled.div<{
  $hasImage: boolean;
  $tone: "idle" | "correct" | "wrong";
}>`
  display: grid;
  grid-template-columns: ${({ $hasImage }) => ($hasImage ? "minmax(5rem, 8rem) minmax(0, 1fr)" : "1fr")};
  align-items: center;
  gap: clamp(0.9rem, 2.5vw, 1.4rem);
  overflow: hidden;
  border: 1px solid ${({ $tone }) =>
    $tone === "correct"
      ? "rgba(16, 185, 129, 0.42)"
      : $tone === "wrong"
        ? "rgba(244, 63, 94, 0.42)"
        : "rgba(175, 190, 239, 0.72)"};
  border-radius: 1.35rem;
  background: ${({ $tone }) =>
    $tone === "correct"
      ? "rgba(240, 253, 244, 0.98)"
      : $tone === "wrong"
        ? "rgba(255, 245, 246, 0.98)"
        : "rgba(245, 247, 250, 0.98)"};
  padding: clamp(1rem, 2.6vw, 1.45rem);
  box-shadow: 0 14px 34px rgba(48, 67, 143, 0.07);

  @media (max-width: 767px) {
    border: 0;
    border-radius: 0;
    background: transparent;
    padding-inline: 0;
    box-shadow: none;
  }

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;

const PracticeInlineChoiceContent = styled.div`
  display: grid;
  gap: 0.7rem;
`;

const PracticeInlineChoiceMainRow = styled.div<{ $numbered: boolean }>`
  display: grid;
  grid-template-columns: ${({ $numbered }) => ($numbered ? "auto minmax(0, 1fr)" : "minmax(0, 1fr)")};
  align-items: start;
  gap: 0.8rem;
`;

const PracticeInlineChoiceNumber = styled.span`
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

const PracticeInlineChoiceImage = styled.img`
  display: block;
  width: 100%;
  max-height: 8rem;
  border: 1px solid rgba(188, 203, 240, 0.72);
  border-radius: 1.05rem;
  background: #ffffff;
  object-fit: contain;
  padding: 0.35rem;

  @media (max-width: 560px) {
    width: min(100%, 10rem);
    max-height: 6rem;
    justify-self: center;
  }
`;

const PracticeInlineChoiceSentence = styled.div`
  color: #202c4c;
  font-size: clamp(1.25rem, 2.5vw, 1.72rem);
  font-weight: 650;
  line-height: 2.15;
  overflow-wrap: anywhere;

  > span {
    display: inline;
  }
`;

const PracticeInlineRowFeedback = styled.div<{ $indented: boolean }>`
  display: grid;
  gap: 0.25rem;
  margin-left: ${({ $indented }) => ($indented ? "3.05rem" : "0")};
  border-top: 1px solid rgba(244, 63, 94, 0.18);
  padding-top: 0.65rem;
  color: #be123c;

  strong {
    font-size: 0.95rem;
    line-height: 1.35;
  }

  small {
    color: #6b5870;
    font-size: 0.84rem;
    font-weight: 700;
    line-height: 1.45;
  }
`;

const PracticeInlineOptionGroup = styled.span`
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.38rem;
  align-items: center;
  margin: 0 0.42rem;
  border: 1px solid rgba(125, 211, 252, 0.72);
  border-radius: 1rem;
  background: linear-gradient(145deg, rgba(240, 249, 255, 0.96), rgba(248, 250, 255, 0.98));
  padding: 0.3rem 0.42rem;
  vertical-align: middle;
  box-shadow:
    inset 0 0 0 3px rgba(224, 242, 254, 0.58),
    0 7px 18px rgba(44, 83, 145, 0.07);
`;

const PracticeInlineOptionButton = styled.button<{
  $selected: boolean;
  $correct: boolean;
  $wrong: boolean;
}>`
  position: relative;
  min-width: 2.55rem;
  min-height: 2.55rem;
  cursor: pointer;
  border: 1px solid
    ${({ $correct, $wrong, $selected }) =>
      $correct
        ? "rgba(16, 185, 129, 0.68)"
        : $wrong
          ? "rgba(244, 63, 94, 0.64)"
          : $selected
            ? "rgba(82, 99, 255, 0.72)"
            : "rgba(161, 177, 218, 0.68)"};
  border-radius: 999px;
  background: ${({ $correct, $wrong, $selected }) =>
    $correct
      ? "rgba(209, 250, 229, 0.92)"
      : $wrong
        ? "rgba(255, 228, 230, 0.92)"
        : $selected
          ? "rgba(224, 231, 255, 0.94)"
          : "transparent"};
  color: ${({ $correct, $wrong }) => ($correct ? "#087f5b" : $wrong ? "#be123c" : "#263558")};
  padding: 0.28rem 0.68rem;
  font: inherit;
  font-size: 0.94em;
  font-weight: 700;
  line-height: 1;
  box-shadow: none;
  transition:
    transform 150ms ease,
    border-color 150ms ease,
    background 150ms ease;

  &:not(:last-child) {
    margin-right: 0.55rem;
  }

  &:not(:last-child)::after {
    content: "/";
    position: absolute;
    top: 50%;
    right: -0.73rem;
    color: #93a4c9;
    font-size: 0.88em;
    font-weight: 850;
    line-height: 1;
    pointer-events: none;
    transform: translateY(-50%);
  }

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    background: rgba(224, 231, 255, 0.82);
  }

  &:focus-visible {
    outline: 3px solid rgba(82, 99, 255, 0.2);
    outline-offset: 2px;
  }

  &:disabled {
    cursor: default;
    opacity: ${({ $correct, $wrong }) => ($correct || $wrong ? 1 : 0.68)};
  }
`;

const PracticeConjugationLab = styled.div`
  display: grid;
  gap: clamp(1rem, 2.2vw, 1.35rem);
  width: min(100%, 58rem);
  justify-self: center;
  border: 1px solid rgba(198, 181, 239, 0.68);
  border-radius: 1.6rem;
  background:
    radial-gradient(circle at 50% 0%, rgba(139, 92, 246, 0.075), transparent 35%),
    rgba(255, 255, 255, 0.96);
  padding: clamp(1.1rem, 3vw, 1.8rem);
  box-shadow: 0 18px 42px rgba(67, 56, 133, 0.08);

  @media (max-width: 767px) {
    width: 100%;
    border: 0;
    border-radius: 0;
    background: transparent;
    padding-inline: 0;
    box-shadow: none;
  }
`;

const PracticeConjugationCategory = styled.span`
  display: inline-flex;
  width: fit-content;
  justify-self: center;
  border-radius: 999px;
  background: rgba(243, 232, 255, 0.9);
  color: #6d28d9;
  padding: 0.45rem 0.8rem;
  font-size: 0.8rem;
  font-weight: 950;
`;

const PracticeConjugationFormula = styled.div`
  display: grid;
  grid-template-columns: minmax(8.5rem, 1fr) auto minmax(9rem, 1.25fr) auto minmax(8rem, 1fr);
  align-items: center;
  gap: clamp(0.45rem, 1.5vw, 0.8rem);

  @media (max-width: 680px) {
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);

    > :nth-child(4) {
      display: none;
    }

    > :nth-child(5) {
      grid-column: 1 / -1;
      width: min(100%, 13rem);
      justify-self: center;
    }
  }
`;

const PracticeConjugationTerm = styled.div<{ $accent?: boolean }>`
  display: grid;
  min-height: 7rem;
  place-items: center;
  align-content: center;
  gap: 0.38rem;
  border: 1px solid ${({ $accent = false }) => ($accent ? "rgba(184, 151, 241, 0.66)" : "rgba(183, 198, 236, 0.72)")};
  border-radius: 1.15rem;
  background: ${({ $accent = false }) => ($accent ? "rgba(250, 247, 255, 0.96)" : "rgba(255, 255, 255, 0.98)")};
  padding: 0.85rem;
  text-align: center;
  box-shadow: 0 8px 20px rgba(66, 72, 129, 0.055);

  small {
    color: #8190b2;
    font-size: 0.72rem;
    font-weight: 950;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  strong {
    color: ${({ $accent = false }) => ($accent ? "#5837e8" : "#17203d")};
    font-size: clamp(1.45rem, 3vw, 2.15rem);
    font-weight: 950;
    line-height: 1.1;
    overflow-wrap: anywhere;
  }

  @media (max-width: 520px) {
    min-height: 5.8rem;
    padding: 0.65rem 0.45rem;
  }
`;

const PracticeConjugationOperator = styled.span`
  color: #c1c9dc;
  font-size: 1.55rem;
  font-weight: 950;
`;

const PracticeConjugationAnswer = styled.div<{ $tone: "idle" | "correct" | "wrong" }>`
  display: grid;
  min-height: 7rem;
  place-items: center;
  align-content: center;
  gap: 0.35rem;
  border: 2px dashed
    ${({ $tone }) =>
      $tone === "correct"
        ? "rgba(16, 185, 129, 0.82)"
        : $tone === "wrong"
          ? "rgba(244, 63, 94, 0.72)"
          : "rgba(167, 181, 215, 0.72)"};
  border-radius: 1.15rem;
  background: ${({ $tone }) =>
    $tone === "correct"
      ? "rgba(236, 253, 245, 0.96)"
      : $tone === "wrong"
        ? "rgba(255, 241, 242, 0.96)"
        : "rgba(248, 250, 252, 0.88)"};
  padding: 0.8rem;
  text-align: center;

  small {
    color: #7888aa;
    font-size: 0.72rem;
    font-weight: 950;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  strong {
    color: ${({ $tone }) => ($tone === "correct" ? "#087f5b" : $tone === "wrong" ? "#be123c" : "#8b98b4")};
    font-size: clamp(1.45rem, 3vw, 2.15rem);
    font-weight: 950;
    line-height: 1.1;
  }

  @media (max-width: 520px) {
    min-height: 5.8rem;
  }
`;

const PracticeConjugationPrompt = styled.span`
  color: #58698d;
  font-size: 0.78rem;
  font-weight: 950;
  letter-spacing: 0.07em;
  text-align: center;
  text-transform: uppercase;
`;

const PracticeConjugationOptions = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.65rem;

  @media (max-width: 680px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const PracticeConjugationOption = styled.button<{
  $selected: boolean;
  $correct: boolean;
  $wrong: boolean;
}>`
  min-height: 3.65rem;
  cursor: pointer;
  border: 1px solid
    ${({ $correct, $wrong, $selected }) =>
      $correct
        ? "rgba(16, 185, 129, 0.78)"
        : $wrong
          ? "rgba(244, 63, 94, 0.72)"
          : $selected
            ? "rgba(82, 99, 255, 0.86)"
            : "rgba(188, 199, 228, 0.78)"};
  border-radius: 1rem;
  background: ${({ $correct, $wrong, $selected }) =>
    $correct
      ? "rgba(236, 253, 245, 0.98)"
      : $wrong
        ? "rgba(255, 241, 242, 0.98)"
        : $selected
          ? "rgba(238, 242, 255, 0.98)"
          : "#ffffff"};
  color: ${({ $correct, $wrong }) => ($correct ? "#087f5b" : $wrong ? "#be123c" : "#1f2b4b")};
  padding: 0.75rem;
  font-size: clamp(1.05rem, 2vw, 1.28rem);
  font-weight: 950;
  box-shadow: 0 4px 0 rgba(107, 121, 170, 0.1);
  transition:
    transform 150ms ease,
    border-color 150ms ease,
    box-shadow 150ms ease;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    border-color: rgba(82, 99, 255, 0.92);
    box-shadow: 0 6px 0 rgba(82, 99, 255, 0.12);
  }

  &:focus-visible {
    outline: 3px solid rgba(82, 99, 255, 0.2);
    outline-offset: 2px;
  }

  &:disabled {
    cursor: default;
    opacity: ${({ $correct, $wrong }) => ($correct || $wrong ? 1 : 0.62)};
  }
`;

const PracticeConjugationAudio = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 24rem);
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  border-top: 1px solid rgba(219, 224, 239, 0.86);
  padding-top: 1rem;

  span {
    color: #4f5f82;
    font-size: 0.85rem;
    font-weight: 900;
  }

  audio {
    width: 100%;
    min-width: 0;
  }

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;

const practiceAccuracyReveal = keyframes`
  from {
    opacity: 0;
    transform: translateY(0.35rem);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const PracticeHandwritingArea = styled.div`
  display: grid;
  gap: 0.85rem;
`;

const PracticeHandwritingFrame = styled.div`
  position: relative;
  overflow: hidden;
  min-height: clamp(18rem, 44vw, 32rem);
  border: 1px solid rgba(181, 196, 255, 0.86);
  border-radius: 1.45rem;
  background:
    radial-gradient(circle at 16% 18%, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0) 28%),
    linear-gradient(135deg, rgba(248, 250, 255, 0.76), rgba(255, 255, 255, 0.52)),
    repeating-linear-gradient(
      0deg,
      rgba(103, 122, 255, 0.055) 0,
      rgba(103, 122, 255, 0.055) 1px,
      transparent 1px,
      transparent 4.4rem
    ),
    repeating-linear-gradient(
      90deg,
      rgba(148, 163, 184, 0.12) 0,
      rgba(148, 163, 184, 0.12) 1px,
      transparent 1px,
      transparent 3.2rem
    );
  box-shadow:
    inset 0 0 0 4px rgba(82, 99, 255, 0.035),
    inset 0 34px 80px rgba(82, 99, 255, 0.035);
  touch-action: none;

  &::before {
    content: "✍ Практика";
    position: absolute;
    top: 1.15rem;
    left: 1.25rem;
    z-index: 1;
    color: rgba(67, 87, 221, 0.36);
    font-size: 0.74rem;
    font-weight: 950;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    pointer-events: none;
  }

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background:
      repeating-linear-gradient(
        0deg,
        transparent 0,
        transparent 4.35rem,
        rgba(82, 99, 255, 0.055) 4.35rem,
        rgba(82, 99, 255, 0.055) 4.45rem
      ),
      repeating-linear-gradient(
        90deg,
        transparent 0,
        transparent 3.15rem,
        rgba(82, 99, 255, 0.035) 3.15rem,
        rgba(82, 99, 255, 0.035) 3.2rem
      );
    opacity: 0.72;
  }
`;

const PracticeHandwritingPicture = styled.picture<{ $hasMobileSequence: boolean }>`
  position: absolute;
  inset: 0;
  z-index: 0;

  @media (max-width: 767px) {
    display: ${({ $hasMobileSequence }) => $hasMobileSequence ? "none" : "block"};
  }
`;

const PracticeHandwritingImage = styled.img`
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  transform: scale(${HANDWRITING_TEMPLATE_SCALE});
  transform-origin: center;
  user-select: none;
  pointer-events: none;
`;

const PracticeHandwritingMobileSequence = styled.div`
  display: none;

  @media (max-width: 767px) {
    position: relative;
    z-index: 0;
    display: grid;
    width: 100%;
  }
`;

const PracticeHandwritingMobileImage = styled.img`
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
  pointer-events: none;
`;

const PracticeHandwritingPlaceholder = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  color: #68779f;
  font-weight: 850;
  text-align: center;
  padding: 2rem;
`;

const PracticeHandwritingCanvas = styled.canvas`
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
  cursor: none;
  touch-action: none;
`;

const PracticeFeatherCursor = styled.span`
  position: absolute;
  z-index: 3;
  width: 7rem;
  height: 7rem;
  pointer-events: none;
  background: url("/assets/feather.svg") center / contain no-repeat;
  filter: drop-shadow(0 8px 12px rgba(38, 62, 174, 0.2));
  transform: translate(-38%, -66%) rotate(-12deg);
  transform-origin: 38% 66%;
`;

const PracticeEraserCursor = styled.span`
  position: absolute;
  z-index: 3;
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid rgba(67, 87, 221, 0.88);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.66);
  box-shadow: 0 3px 10px rgba(38, 62, 174, 0.18);
  pointer-events: none;
  transform: translate(-50%, -50%);
`;

const PracticeHandwritingMeta = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 32rem) minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
  color: #4b5d86;
  font-size: 0.92rem;
  font-weight: 800;

  button {
    cursor: pointer;
    border: 1px solid rgba(181, 196, 255, 0.9);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.88);
    color: #29375f;
    padding: 0.62rem 0.95rem;
    font-weight: 900;
    transition:
      transform 160ms ease,
      border-color 160ms ease,
      box-shadow 160ms ease;
    grid-column: 3;
    justify-self: end;
  }

  button:hover {
    transform: translateY(-1px);
    border-color: var(--accent);
    box-shadow: 0 10px 22px rgba(46, 59, 146, 0.1);
  }

  @media (max-width: 720px) {
    grid-template-columns: 1fr;

    button {
      grid-column: auto;
      justify-self: stretch;
    }
  }
`;

const PracticeHandwritingTools = styled.div`
  display: flex;
  grid-column: 1;
  justify-self: start;
  align-items: center;
  gap: 0.45rem;

  @media (max-width: 720px) {
    grid-column: auto;
    justify-self: stretch;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

const PracticeHandwritingToolButton = styled.button<{ $active?: boolean }>`
  && {
    display: inline-flex;
    grid-column: auto;
    justify-self: auto;
    align-items: center;
    justify-content: center;
    gap: 0.38rem;
    min-height: 2.55rem;
    border-color: ${({ $active }) =>
      $active ? "rgba(82, 99, 255, 0.92)" : "rgba(181, 196, 255, 0.9)"};
    background: ${({ $active }) =>
      $active ? "linear-gradient(135deg, #5263ff, #7c5ce7)" : "rgba(255, 255, 255, 0.88)"};
    color: ${({ $active }) => ($active ? "#ffffff" : "#29375f")};
    box-shadow: ${({ $active }) => ($active ? "0 8px 18px rgba(82, 99, 255, 0.2)" : "none")};

    span {
      font-size: 1rem;
      line-height: 1;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.42;
      transform: none;
      box-shadow: none;
    }
  }
`;

const PracticeAccuracyPanel = styled.div`
  display: grid;
  gap: 0.45rem;
  grid-column: 2;
  width: 100%;
  justify-self: center;
  animation: ${practiceAccuracyReveal} 240ms ease both;

  @media (max-width: 720px) {
    grid-column: auto;
  }
`;

const PracticeAccuracyTopline = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: #29375f;

  span {
    font-size: 0.82rem;
    font-weight: 950;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  strong {
    color: #4357dd;
    font-size: 1.25rem;
    font-weight: 950;
  }
`;

const PracticeAccuracyTrack = styled.div`
  overflow: hidden;
  height: 0.72rem;
  border-radius: 999px;
  background: rgba(221, 226, 255, 0.92);
  box-shadow: inset 0 0 0 1px rgba(181, 196, 255, 0.42);
`;

const PracticeAccuracyFill = styled.div`
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #5263ff, #8b5cf6);
  transition: width 720ms cubic-bezier(0.22, 1, 0.36, 1);
`;

const PracticeBuildArea = styled.div`
  display: grid;
  gap: 1.05rem;
`;

const PracticeChoiceArea = styled.div`
  display: grid;
  gap: 1.05rem;
`;

const PracticeAnswerGroup = styled.div`
  display: grid;
  gap: 0.55rem;
`;

const PracticeAnswerLabel = styled.p`
  color: #29375f;
  font-size: 0.82rem;
  font-weight: 950;
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

const PracticeAnswerSlots = styled.div<{ $empty: boolean; $dragActive: boolean }>`
  min-height: clamp(4.8rem, 9vw, 6.25rem);
  border: 2px dashed
    ${({ $dragActive, $empty }) =>
      $dragActive ? "rgba(82, 99, 255, 0.95)" : $empty ? "rgba(144, 160, 255, 0.86)" : "rgba(90, 108, 255, 0.68)"};
  border-radius: 1.05rem;
  background: ${({ $dragActive, $empty }) =>
    $dragActive
      ? "linear-gradient(135deg, rgba(238, 242, 255, 0.98), rgba(245, 243, 255, 0.96))"
      : $empty
      ? "rgba(247, 249, 255, 0.82)"
      : "linear-gradient(135deg, rgba(239, 246, 255, 0.94), rgba(245, 243, 255, 0.9))"};
  color: ${({ $empty }) => ($empty ? "var(--ink-soft)" : "#17203d")};
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
  padding: clamp(0.85rem, 2vw, 1.15rem);
  font-weight: 800;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    box-shadow 160ms ease;
  box-shadow: ${({ $dragActive }) => ($dragActive ? "inset 0 0 0 4px rgba(82, 99, 255, 0.08)" : "none")};
`;

const PracticeWordBank = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.62rem;
`;

const practiceChipLand = keyframes`
  from {
    opacity: 0;
    transform: translateY(0.85rem) scale(0.94);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

const practiceChipReturn = keyframes`
  from {
    opacity: 0;
    transform: translateY(-0.55rem) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

const PracticeWordChip = styled.button<{ $placed?: boolean; $dragging?: boolean }>`
  cursor: pointer;
  opacity: ${({ $dragging = false }) => ($dragging ? 0 : 1)};
  visibility: ${({ $dragging = false }) => ($dragging ? "hidden" : "visible")};
  touch-action: none;
  min-height: 3rem;
  border: 1px solid rgba(157, 176, 255, 0.92);
  border-bottom-width: 3px;
  border-radius: 0.85rem;
  background: ${({ $placed }) =>
    $placed ? "linear-gradient(180deg, #eef3ff, #ffffff)" : "linear-gradient(180deg, #ffffff, #f3f6ff)"};
  color: #1e2a4a;
  padding: 0.72rem 1rem 0.65rem;
  font-size: clamp(0.98rem, 1.8vw, 1.14rem);
  font-weight: 900;
  box-shadow:
    0 7px 16px rgba(46, 59, 146, 0.08),
    inset 0 -2px 0 rgba(82, 99, 255, 0.08);
  animation: ${({ $placed }) => ($placed ? practiceChipLand : practiceChipReturn)} 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
  transition:
    opacity 120ms ease,
    transform 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;

  &:hover {
    transform: translateY(-2px);
    border-color: var(--accent);
    box-shadow: 0 14px 28px rgba(46, 59, 146, 0.13);
  }

  &:active {
    transform: translateY(1px) scale(0.97);
    box-shadow: 0 5px 12px rgba(46, 59, 146, 0.1);
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const PracticeFloatingChip = styled.div`
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  transform: translate(-50%, -50%) scale(1.03);
  border: 1.5px solid rgba(130, 151, 255, 0.98);
  border-radius: 0.85rem;
  background: linear-gradient(180deg, #ffffff, #f3f6ff);
  color: #1e2a4a;
  padding: 0.72rem 1rem;
  font-size: clamp(0.98rem, 1.8vw, 1.14rem);
  font-weight: 900;
  box-shadow:
    0 18px 36px rgba(46, 59, 146, 0.2),
    inset 0 -2px 0 rgba(82, 99, 255, 0.08);
`;

const practiceMatchWrong = keyframes`
  0%, 100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-6px) rotate(-0.4deg);
  }
  55% {
    transform: translateX(5px) rotate(0.35deg);
  }
  78% {
    transform: translateX(-2px);
  }
`;

const practiceMatchLineReveal = keyframes`
  from { stroke-dashoffset: 1; opacity: 0; }
  to { stroke-dashoffset: 0; opacity: 1; }
`;

const practiceMatchLineFlow = keyframes`
  to { stroke-dashoffset: -0.36; }
`;

const practiceMatchLineColors = ["#7c6cf2", "#43bfae", "#ffb84d", "#f076a6", "#64a9f4", "#82bd56"];

const PracticeMatchBoard = styled.section`
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid rgba(180, 191, 229, 0.66);
  border-radius: 1.5rem;
  background:
    radial-gradient(circle at 94% 92%, rgba(111, 96, 239, 0.1), transparent 34%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.99), rgba(248, 250, 255, 0.97));
  padding: clamp(1rem, 2.6vw, 1.55rem);
  box-shadow:
    0 20px 46px rgba(48, 66, 145, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.96);

  &::before {
    content: "";
    position: absolute;
    z-index: -1;
    inset: 0;
    opacity: 0.32;
    background-image: radial-gradient(rgba(86, 104, 255, 0.18) 1px, transparent 1px);
    background-size: 22px 22px;
    mask-image: linear-gradient(120deg, transparent 5%, #000 48%, transparent 92%);
  }

  @media (max-width: 620px) {
    border: 0;
    background: transparent;
    padding: 0.85rem 0.1rem 1rem;
    box-shadow: none;

    &::before {
      display: none;
    }
  }
`;

const PracticeMatchHeader = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.8rem;
  margin-bottom: 1rem;

  @media (max-width: 620px) {
    grid-template-columns: auto minmax(0, 1fr) auto;
    column-gap: 0.55rem;
    row-gap: 0.35rem;
    margin-bottom: 0.8rem;
  }
`;

const PracticeMatchHeaderCopy = styled.div`
  min-width: 0;

  strong {
    display: block;
    color: #17203d;
    font-size: clamp(1rem, 1.8vw, 1.18rem);
    font-weight: 950;
  }

  span {
    display: block;
    margin-top: 0.14rem;
    color: #7582a5;
    font-size: 0.82rem;
    font-weight: 700;
  }

  @media (max-width: 620px) {
    display: contents;

    strong {
      grid-column: 2;
      grid-row: 1;
      font-size: 0.94rem;
      line-height: 1.15;
    }

    span {
      grid-column: 1 / -1;
      grid-row: 2;
      margin-top: 0;
      font-size: 0.75rem;
      line-height: 1.35;
    }
  }
`;

const PracticeMatchMiniIcon = styled.i`
  display: grid;
  flex: 0 0 auto;
  width: 2.9rem;
  height: 2.9rem;
  place-items: center;
  border: 1px solid rgba(126, 146, 255, 0.34);
  border-radius: 1rem;
  background: linear-gradient(145deg, #ffffff, #e8edff);
  color: #5366ef;
  font-style: normal;
  font-size: 1.05rem;
  font-weight: 950;
  box-shadow: 0 8px 20px rgba(62, 79, 171, 0.12);

  @media (max-width: 620px) {
    width: 2.45rem;
    height: 2.45rem;
    border-radius: 0.85rem;
    font-size: 0.95rem;
  }
`;

const PracticeMatchProgress = styled.div`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 0.28rem;
  min-width: 4.75rem;
  white-space: nowrap;
  border: 1px solid rgba(113, 132, 255, 0.28);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.76);
  padding: 0.58rem 0.9rem;
  color: #7b88aa;
  box-shadow: 0 7px 18px rgba(46, 59, 146, 0.08);

  strong {
    color: #5366ef;
    font-size: 1rem;
    font-weight: 950;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  span {
    color: #8a94b3;
    font-size: 0.9rem;
    font-weight: 850;
    line-height: 1;
  }

  @media (max-width: 620px) {
    min-width: 4.25rem;
    padding: 0.52rem 0.68rem;

    strong {
      font-size: 0.92rem;
    }
  }
`;

const PracticeMatchGuide = styled.div<{ $wrong: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-height: 3rem;
  margin-bottom: 1.15rem;
  border: 1px solid ${({ $wrong }) => ($wrong ? "rgba(251, 113, 133, 0.34)" : "rgba(115, 132, 255, 0.24)")};
  border-radius: 1rem;
  background: ${({ $wrong }) =>
    $wrong
      ? "linear-gradient(135deg, rgba(255, 241, 244, 0.96), rgba(255, 249, 250, 0.92))"
      : "linear-gradient(135deg, rgba(237, 243, 255, 0.94), rgba(247, 244, 255, 0.92))"};
  color: ${({ $wrong }) => ($wrong ? "#c23b5a" : "#526189")};
  padding: 0.72rem 0.9rem;
  font-size: 0.9rem;
  font-weight: 800;
  transition: 180ms ease;

  span {
    display: grid;
    flex: 0 0 auto;
    width: 1.7rem;
    height: 1.7rem;
    place-items: center;
    border-radius: 999px;
    background: ${({ $wrong }) => ($wrong ? "#ffe0e7" : "#dfe6ff")};
    color: ${({ $wrong }) => ($wrong ? "#e14c6d" : "#5266ee")};
  }

  @media (max-width: 620px) {
    margin: 0 0.45rem 0.95rem;
    padding: 0.65rem 0.7rem;
    font-size: 0.8rem;
    line-height: 1.35;
  }
`;

const PracticeMatchGrid = styled.div`
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(2.4rem, 7vw, 5.5rem);

  @media (max-width: 620px) {
    gap: 0.75rem;
  }
`;

const PracticeMatchLineLayer = styled.svg`
  position: absolute;
  z-index: 1;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;

  path {
    fill: none;
    stroke-linecap: round;
  }

  .practice-match-glow {
    stroke-width: 10;
    opacity: 0.13;
    filter: blur(4px);
    stroke-dasharray: 1;
    animation: ${practiceMatchLineReveal} 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .practice-match-core {
    stroke-width: 4;
    stroke-dasharray: 1;
    filter: drop-shadow(0 3px 4px rgba(48, 143, 130, 0.18));
    animation: ${practiceMatchLineReveal} 560ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .practice-match-flow {
    stroke: rgba(255, 255, 255, 0.92);
    stroke-width: 2;
    stroke-dasharray: 0.06 0.12;
    animation: ${practiceMatchLineFlow} 1.25s linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    path { animation: none !important; }
  }
`;

const PracticeMatchColumn = styled.div`
  position: relative;
  z-index: 2;
  display: grid;
  align-content: start;
  gap: 0.68rem;
`;

const PracticeMatchColumnTitle = styled.div`
  display: flex;
  align-items: center;
  min-height: 1.75rem;
  margin-bottom: 0.05rem;
  color: #6d5be3;
  font-size: 0.75rem;
  font-weight: 950;
  letter-spacing: 0.12em;
  text-transform: uppercase;

  @media (max-width: 620px) {
    min-height: 2.2rem;
    font-size: 0.68rem;
    line-height: 1.3;
    letter-spacing: 0.09em;
  }
`;

const PracticeMatchButton = styled.button<{
  $state: "idle" | "selected" | "correct" | "wrong";
  $side: "left" | "right";
}>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: ${({ $side }) => ($side === "left" ? "space-between" : "flex-start")};
  gap: 0.72rem;
  min-width: 0;
  min-height: 4.25rem;
  cursor: ${({ $state }) => ($state === "correct" ? "default" : "pointer")};
  border: 1px solid
    ${({ $state }) =>
      $state === "correct"
        ? "rgba(67, 191, 174, 0.5)"
        : $state === "wrong"
          ? "rgba(225, 92, 118, 0.66)"
          : $state === "selected"
            ? "rgba(124, 108, 242, 0.68)"
            : "rgba(189, 198, 218, 0.72)"};
  border-bottom-width: ${({ $state }) => ($state === "selected" ? "3px" : "4px")};
  border-radius: 1.15rem;
  background:
    ${({ $state }) =>
      $state === "correct"
        ? "rgba(250, 251, 255, 0.96)"
        : $state === "wrong"
          ? "rgba(255, 240, 244, 0.96)"
          : $state === "selected"
            ? "rgba(244, 241, 255, 0.98)"
            : "rgba(250, 251, 255, 0.96)"};
  color: #1f2948;
  padding: 0.85rem 0.95rem;
  text-align: left;
  font-size: clamp(0.9rem, 1.45vw, 1.05rem);
  font-weight: 900;
  line-height: 1.35;
  box-shadow: ${({ $state }) =>
    $state === "selected" ? "0 10px 24px rgba(124, 108, 242, 0.14)" : "none"};
  transform: ${({ $state }) => ($state === "selected" ? "translateY(1px)" : "none")};
  animation: ${({ $state }) =>
    $state === "wrong"
      ? css`
          ${practiceMatchWrong} 420ms ease
        `
      : "none"};
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    background 160ms ease,
    box-shadow 160ms ease,
    color 160ms ease;

  > span {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  &:not(:disabled):hover {
    transform: translateY(-2px);
    border-color: rgba(124, 108, 242, 0.48);
    background: #fff;
    box-shadow: none;
  }

  &:not(:disabled):active {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 1;
  }

  @media (max-width: 620px) {
    width: 100%;
    height: 4rem;
    min-height: 4rem;
    gap: 0.45rem;
    border-radius: 0.95rem;
    padding: 0.62rem 0.55rem;
    font-size: 0.84rem;
    line-height: 1.25;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const PracticeMatchEndpoint = styled.i<{
  $state: "idle" | "selected" | "correct" | "wrong";
}>`
  display: block;
  flex: 0 0 auto;
  order: inherit;
  width: 0.68rem;
  height: 0.68rem;
  border: 2px solid
    ${({ $state }) =>
      $state === "correct"
        ? "#43bfae"
        : $state === "wrong"
          ? "#f06f89"
          : $state === "selected"
            ? "#6576ff"
            : "rgba(124, 108, 242, 0.38)"};
  border-radius: 50%;
  background: ${({ $state }) =>
    $state === "correct"
      ? "#43bfae"
      : $state === "wrong"
        ? "#f06f89"
        : $state === "selected"
          ? "#6576ff"
          : "#fff"};
  box-shadow: 0 0 0 4px
    ${({ $state }) =>
      $state === "correct"
        ? "rgba(67, 191, 174, 0.12)"
        : $state === "wrong"
          ? "rgba(240, 111, 137, 0.11)"
          : "rgba(124, 108, 242, 0.07)"};
  transition: 180ms ease;
`;

const PracticeActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: -0.25rem;

  ${PrimaryButton} {
    min-width: min(100%, 13rem);
    min-height: 3.35rem;
    padding: 0.9rem 1.55rem;
    font-size: 1rem;
    line-height: 1.15;
  }
`;

const practiceFeedbackTone = {
  success: {
    border: "rgba(22, 163, 74, 0.28)",
    background: "linear-gradient(135deg, rgba(220, 252, 231, 0.94), rgba(239, 246, 255, 0.9))",
    color: "#11683d",
    strong: "#15803d",
  },
  warning: {
    border: "rgba(245, 158, 11, 0.32)",
    background: "linear-gradient(135deg, rgba(254, 243, 199, 0.86), rgba(255, 251, 235, 0.92))",
    color: "#92400e",
    strong: "#b45309",
  },
  danger: {
    border: "rgba(220, 38, 38, 0.22)",
    background: "linear-gradient(135deg, rgba(255, 228, 230, 0.82), rgba(255, 247, 247, 0.9))",
    color: "#9f1239",
    strong: "#be123c",
  },
};

const PracticeFeedback = styled.div<{ $tone: "success" | "warning" | "danger" }>`
  display: grid;
  gap: 0.25rem;
  border: 1px solid ${({ $tone }) => practiceFeedbackTone[$tone].border};
  border-radius: 1.25rem;
  background: ${({ $tone }) => practiceFeedbackTone[$tone].background};
  color: ${({ $tone }) => practiceFeedbackTone[$tone].color};
  padding: 1rem 1.1rem;
  font-weight: 900;

  span {
    font-size: 1rem;
  }

  strong {
    color: ${({ $tone }) => practiceFeedbackTone[$tone].strong};
    font-size: 1.28rem;
    line-height: 1.15;
  }

  small {
    color: #4b5d86;
    font-size: 0.88rem;
    font-weight: 750;
    line-height: 1.45;
  }
`;

const PracticeTaskMetaCard = styled.div`
  display: contents;

  @media (max-width: 767px) {
    display: block;
    border: 1px solid rgba(185, 194, 229, 0.58);
    border-radius: 1rem;
    background: rgba(248, 249, 253, 0.72);
    padding: 0.58rem 0.7rem;
  }
`;

const PracticeTaskMetaDesktop = styled.div`
  display: contents;

  @media (max-width: 767px) {
    display: none;
  }
`;

const PracticeTaskMetaMobile = styled.div`
  display: none;

  @media (max-width: 767px) {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.55rem;

    > span:first-of-type {
      min-width: 0;
      min-height: 1.8rem;
      padding: 0.4rem 0.62rem;
      font-size: 0.68rem;
      letter-spacing: 0.1em;
      white-space: nowrap;
    }

    > span:last-of-type {
      padding: 0.38rem 0.58rem;
      white-space: nowrap;
    }
  }
`;

const PracticeTopLine = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
`;

const PracticeTopEyebrow = styled.p`
  color: var(--accent-dark);
  font-size: 0.72rem;
  font-weight: 950;
  letter-spacing: 0.2em;
  text-transform: uppercase;
`;

const PracticeCounter = styled.span`
  border: 1px solid rgba(122, 136, 241, 0.1);
  border-radius: 0.8rem;
  background: rgba(238, 242, 255, 0.96);
  color: #4357dd;
  padding: 0.42rem 0.75rem;
  font-size: 0.82rem;
  font-weight: 900;
`;

const PracticeProgressTrack = styled.div`
  height: 0.68rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(221, 226, 255, 0.86);
`;

const PracticeProgressFill = styled.div`
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #5263ff, #8b5cf6);
  transition: width 220ms ease;
`;

const PracticeTypeAnswerCard = styled(VocabularyExercise)<{ $listening: boolean }>`
  ${({ $listening }) =>
    $listening
      ? css`
          width: min(100%, 46rem);
          border: 1px solid rgba(181, 196, 255, 0.86);
          border-radius: 1.45rem;
          background:
            radial-gradient(circle at 12% 0%, rgba(139, 92, 246, 0.1), transparent 30%),
            rgba(255, 255, 255, 0.78);
          padding: clamp(1rem, 2.4vw, 1.35rem);
          box-shadow: 0 16px 36px rgba(46, 59, 146, 0.08);
        `
      : ""}

  @media (max-width: 767px) {
    width: 100%;
    border: 0;
    border-radius: 0;
    background: transparent;
    padding-inline: 0;
    box-shadow: none;
  }
`;

const PracticeTypeAnswerStack = styled.div`
  display: grid;
  gap: 0.9rem;
`;

const PracticeTypeAnswerItem = styled.div`
  padding: 0.25rem 0;
`;

const PracticeTypeAnswerMainRow = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 0.8rem;
`;

const PracticeTypeAnswerItemContent = styled.div`
  display: grid;
  gap: 0.75rem;
`;

const PracticeTypeAnswerQuestion = styled.p`
  color: #111a39;
  font-size: clamp(1.18rem, 2.35vw, 1.55rem);
  font-weight: 900;
  line-height: 1.4;
  overflow-wrap: anywhere;
`;

const PracticeTypeAnswerSentence = styled.p`
  color: #202c4c;
  font-size: clamp(1.08rem, 2.2vw, 1.42rem);
  font-weight: 850;
  line-height: 1.55;
  overflow-wrap: anywhere;
`;

const PracticeTypeAnswerInlineLine = styled.span`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem;
  width: 100%;
  min-width: 0;
`;

const PracticeTypeAnswerImage = styled.img`
  display: block;
  width: auto;
  max-width: 100%;
  max-height: min(20rem, 45vh);
  justify-self: center;
  border-radius: 0.9rem;
  object-fit: contain;
`;

const PracticeTypeAnswerFeedback = styled.div`
  display: grid;
  gap: 0.22rem;
  border-top: 1px solid rgba(244, 63, 94, 0.18);
  padding-top: 0.65rem;
  color: #be123c;

  strong {
    font-size: 0.95rem;
  }

  small {
    color: #6b5870;
    font-size: 0.84rem;
    font-weight: 700;
    line-height: 1.45;
  }
`;

const PracticeDialogueFillArea = styled.div`
  display: grid;
  gap: 1rem;
`;

const PracticeDialogueKeyboardRow = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const PracticeDialogueList = styled.div`
  display: grid;
  gap: clamp(1.2rem, 3vw, 2rem);
`;

const PracticeDialogueRow = styled.div<{ $hasImage: boolean }>`
  display: grid;
  grid-template-columns: ${({ $hasImage }) =>
    $hasImage ? "auto minmax(7rem, 11rem) minmax(0, 1fr)" : "auto minmax(0, 1fr)"};
  align-items: center;
  gap: clamp(0.8rem, 2.5vw, 1.35rem);
  padding: 0.2rem 0;

  @media (max-width: 640px) {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;

    > img {
      grid-column: 2;
    }

    > div:last-child {
      grid-column: 2;
    }
  }
`;

const PracticeDialogueImage = styled.img`
  display: block;
  width: 100%;
  max-width: 11rem;
  max-height: 8.5rem;
  border-radius: 0.85rem;
  object-fit: contain;
`;

const PracticeDialogueContent = styled.div`
  display: grid;
  justify-items: start;
  gap: 0.55rem;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
`;

const PracticeDialogueExampleBadge = styled.span`
  border-radius: 999px;
  background: rgba(224, 231, 255, 0.78);
  color: #4f46e5;
  padding: 0.22rem 0.55rem;
  font-size: 0.7rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const PracticeDialogueQuestion = styled.p`
  color: #17213e;
  font-size: clamp(1.05rem, 2vw, 1.3rem);
  font-weight: 650;
  line-height: 1.55;
  overflow-wrap: anywhere;
`;

const PracticeDialogueSentence = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  color: #202c4c;
  font-size: clamp(1.05rem, 2vw, 1.3rem);
  font-weight: 600;
  line-height: 1.8;

  @media (max-width: 640px) {
    overflow: hidden;
  }
`;

const PracticeDialogueInlineInput = styled.input<{
  $state: "idle" | "correct" | "wrong" | "example";
  $length: number;
}>`
  flex: 0 0 auto;
  width: ${({ $length }) => `${Math.min(36, Math.max(8, $length + 1.5))}em`};
  max-width: 100%;
  box-sizing: border-box;
  border: 0;
  border-bottom: 2px solid ${({ $state }) =>
    $state === "wrong"
      ? "#e11d48"
      : $state === "correct"
        ? "#10b981"
        : "rgba(90, 108, 255, 0.58)"};
  border-radius: 0;
  background: transparent;
  color: ${({ $state }) => ($state === "wrong" ? "#be123c" : "#24366f")};
  padding: 0.05rem 0.25rem 0.12rem;
  font: inherit;
  font-weight: 700;
  line-height: 1.45;
  text-align: left;

  &:focus-visible {
    border-bottom-color: #4f46e5;
    outline: 3px solid rgba(99, 102, 241, 0.15);
    outline-offset: 2px;
  }

  &[readonly] {
    cursor: default;
  }

  @media (max-width: 640px) {
    flex: 1 1 100%;
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }
`;

const PracticeTypeAnswerInlineInput = styled(PracticeDialogueInlineInput)`
  width: auto;
  min-width: ${({ $length }) => `${Math.min(36, Math.max(5.5, $length + 1.25))}em`};
  max-width: ${({ $length }) =>
    `min(100%, ${Math.min(46, Math.max(5.5, $length + 1.25) + 10)}em)`};
  field-sizing: content;
  border-radius: 0;
  background: transparent;
  padding: 0.05rem 0.2rem 0.12rem;
  cursor: text;
  text-align: center;
  transition:
    width 140ms ease,
    background 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;

  &::placeholder {
    color: #6d5be3;
    font-size: 0.52em;
    font-weight: 600;
    text-align: center;
    opacity: 0.82;
  }

  &:hover {
    border-bottom-color: #6d5be3;
  }

  &:focus-visible {
    background: transparent;
    outline: none;
    box-shadow: 0 3px 0 rgba(109, 91, 227, 0.12);
  }
`;

const PracticeDialogueInlineAnswer = styled.span<{
  $state: "idle" | "correct" | "wrong" | "example";
}>`
  min-width: min(8em, 100%);
  max-width: 100%;
  border-bottom: 2px solid ${({ $state }) =>
    $state === "wrong"
      ? "#e11d48"
      : $state === "correct"
        ? "#10b981"
        : "rgba(90, 108, 255, 0.58)"};
  color: ${({ $state }) =>
    $state === "wrong" ? "#be123c" : $state === "correct" ? "#087f5b" : "#4656a8"};
  padding: 0.05rem 0.25rem 0.12rem;
  font-weight: 700;
  line-height: 1.45;
  overflow-wrap: anywhere;
`;

const PracticeDialogueWrongNote = styled.small`
  color: #be123c;
  font-size: 0.78rem;
  font-weight: 850;
`;

const PracticeDialogueExplanation = styled.small`
  color: #6b5870;
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.45;
`;

const PracticeTypeAnswerHeader = styled.div<{ $answerLabelHidden: boolean }>`
  display: flex;
  align-items: center;
  justify-content: ${({ $answerLabelHidden }) => ($answerLabelHidden ? "flex-end" : "space-between")};
  gap: 1rem;
`;

const KoreanKeyboardToggle = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.62rem;
  border: 0;
  border-radius: 1rem;
  background: rgba(238, 242, 255, 0.84);
  color: #56658d;
  padding: 0.48rem 0.72rem 0.48rem 0.5rem;
  text-align: left;
  font-size: 0.76rem;
  font-weight: 750;
  line-height: 1.25;
  cursor: pointer;
  transition:
    background 160ms ease,
    color 160ms ease,
    box-shadow 160ms ease;

  > span:last-child {
    display: grid;
    gap: 0.08rem;
  }

  strong {
    color: #4355d9;
    font-size: 0.78rem;
    font-weight: 950;
  }

  &:hover {
    background: rgba(229, 234, 255, 0.98);
    color: #33446f;
    box-shadow: 0 9px 22px rgba(72, 88, 180, 0.12);
  }

  &:focus-visible {
    outline: 3px solid rgba(90, 108, 255, 0.2);
    outline-offset: 2px;
  }

  @media (max-width: 767px) {
    display: none;
  }
`;

const KoreanKeyboardToggleIcon = styled.span`
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  width: 2.15rem;
  height: 2.15rem;
  border-radius: 0.78rem;
  background: linear-gradient(145deg, #eef2ff, #ffffff);
  color: #3448c8;
  box-shadow:
    inset 0 0 0 1px rgba(159, 174, 255, 0.66),
    0 5px 12px rgba(69, 84, 168, 0.1);
  font-size: 0.98rem;
  font-weight: 950;
`;

const VocabularyCompleteCard = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  border: 1px solid rgba(45, 212, 191, 0.42);
  border-radius: 1.45rem;
  background: linear-gradient(135deg, rgba(236, 253, 245, 0.92), rgba(239, 246, 255, 0.92));
  padding: 1.2rem;
`;

const VocabularyCompleteIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 3rem;
  height: 3rem;
  border-radius: 999px;
  background: rgba(187, 247, 208, 0.82);
  font-size: 1.35rem;
`;

const VocabularyCompleteTitle = styled.p`
  color: #0f172a;
  font-size: 1.02rem;
  font-weight: 950;
`;

const VocabularyCompleteText = styled.p`
  margin-top: 0.25rem;
  color: var(--ink-soft);
  font-size: 0.9rem;
  line-height: 1.55;
`;

