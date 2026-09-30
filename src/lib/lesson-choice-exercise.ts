export const LESSON_CHOICE_EXERCISE_START = "[lesson-choice-exercise]";
export const LESSON_CHOICE_EXERCISE_END = "[/lesson-choice-exercise]";

export type LessonChoiceQuestion = {
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
};

export type LessonChoiceExercise = {
  title: string;
  description: string;
  text: string;
  imageUrl: string;
  mobileImageUrl: string;
  audioUrl: string;
  questions: LessonChoiceQuestion[];
};

const LESSON_CHOICE_EXERCISE_PATTERN =
  /\[lesson-choice-exercise\]\s*([\s\S]*?)\s*\[\/lesson-choice-exercise\]/gi;

export function createEmptyLessonChoiceQuestion(): LessonChoiceQuestion {
  return {
    prompt: "Выберите правильный ответ.",
    options: ["Вариант 1", "Вариант 2", "Вариант 3"],
    correctOptionIndex: 0,
    explanation: "",
  };
}

export function createEmptyLessonChoiceExercise(): LessonChoiceExercise {
  return {
    title: "Задание по материалу",
    description: "Изучите изображение или текст и выберите правильный ответ.",
    text: "",
    imageUrl: "",
    mobileImageUrl: "",
    audioUrl: "",
    questions: [createEmptyLessonChoiceQuestion()],
  };
}

function normalizeQuestion(value: unknown): LessonChoiceQuestion {
  const source = value && typeof value === "object"
    ? value as Partial<LessonChoiceQuestion>
    : {};
  const options = Array.isArray(source.options)
    ? source.options.map((option) => String(option ?? ""))
    : [];

  while (options.length < 2) {
    options.push(`Вариант ${options.length + 1}`);
  }

  const requestedCorrectIndex = Number(source.correctOptionIndex);
  const correctOptionIndex = Number.isFinite(requestedCorrectIndex)
    ? Math.max(0, Math.min(options.length - 1, Math.floor(requestedCorrectIndex)))
    : 0;

  return {
    prompt: typeof source.prompt === "string" ? source.prompt : "",
    options,
    correctOptionIndex,
    explanation: typeof source.explanation === "string" ? source.explanation : "",
  };
}

export function normalizeLessonChoiceExercise(value: unknown): LessonChoiceExercise {
  const source = value && typeof value === "object"
    ? value as Partial<LessonChoiceExercise>
    : {};
  const questions = Array.isArray(source.questions)
    ? source.questions.map(normalizeQuestion)
    : [];

  return {
    title: typeof source.title === "string" ? source.title : "",
    description: typeof source.description === "string" ? source.description : "",
    text: typeof source.text === "string" ? source.text : "",
    imageUrl: typeof source.imageUrl === "string" ? source.imageUrl : "",
    mobileImageUrl: typeof source.mobileImageUrl === "string" ? source.mobileImageUrl : "",
    audioUrl: typeof source.audioUrl === "string" ? source.audioUrl : "",
    questions: questions.length > 0 ? questions : [createEmptyLessonChoiceQuestion()],
  };
}

export function parseLessonChoiceExercise(serialized: string): LessonChoiceExercise | null {
  try {
    return normalizeLessonChoiceExercise(JSON.parse(serialized));
  } catch {
    return null;
  }
}

export function serializeLessonChoiceExercise(exercise: LessonChoiceExercise) {
  return [
    LESSON_CHOICE_EXERCISE_START,
    JSON.stringify(normalizeLessonChoiceExercise(exercise), null, 2),
    LESSON_CHOICE_EXERCISE_END,
  ].join("\n");
}

export function extractLessonChoiceExercises(content: string) {
  return [...content.matchAll(LESSON_CHOICE_EXERCISE_PATTERN)]
    .map((match) => parseLessonChoiceExercise(match[1] ?? ""))
    .filter((exercise): exercise is LessonChoiceExercise => Boolean(exercise));
}

export function replaceLessonChoiceExercise(
  content: string,
  exerciseIndex: number,
  nextExercise: LessonChoiceExercise | null,
) {
  let currentIndex = -1;

  return content.replace(LESSON_CHOICE_EXERCISE_PATTERN, (match) => {
    currentIndex += 1;
    if (currentIndex !== exerciseIndex) {
      return match;
    }

    return nextExercise ? serializeLessonChoiceExercise(nextExercise) : "";
  });
}
