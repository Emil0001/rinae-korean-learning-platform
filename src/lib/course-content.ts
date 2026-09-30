import type {
  AdminCourseLesson,
  AdminCourseLevel,
  AdminCourseStep,
  CourseStepType,
} from "@/types/courses";

export const STANDARD_STEP_SEQUENCE: CourseStepType[] = [
  "GRAMMAR",
  "EXAMPLES",
  "VOCABULARY",
  "PRACTICE",
  "QUIZ",
];

type DemoLessonSeed = {
  slug: string;
  title: string;
  summary: string;
  theme: string;
  mode?: "STANDARD" | "FLEXIBLE";
};

type DemoUnitSeed = {
  slug: string;
  title: string;
  description: string;
  lessons: DemoLessonSeed[];
};

type DemoLevelSeed = {
  number: number;
  slug: string;
  title: string;
  description: string;
  accentColor: string;
  units: DemoUnitSeed[];
};

const assetPool = [
  "/assets/3.svg",
  "/assets/4.svg",
  "/assets/5.svg",
  "/assets/6.svg",
  "/assets/7.svg",
  "/assets/8.svg",
  "/assets/9.svg",
  "/assets/10.svg",
  "/assets/11.svg",
  "/assets/12.svg",
  "/assets/13.svg",
  "/assets/14.svg",
];

export const COURSE_LEVEL_BLUEPRINTS = [
  {
    number: 1,
    slug: "starter",
    title: "Старт",
    description: "Мягкий вход в хангыль, первые фразы и базовый корейский для повседневных ситуаций.",
    accentColor: "#8FB8FF",
  },
  {
    number: 2,
    slug: "foundation",
    title: "Основа",
    description: "Устойчивые модели предложений для режима дня, дома, учебы и простого общения.",
    accentColor: "#6F8CFF",
  },
  {
    number: 3,
    slug: "elementary",
    title: "Средний",
    description: "Передвижение по городу, чувства, покупки и более живые бытовые диалоги.",
    accentColor: "#5967E8",
  },
  {
    number: 4,
    slug: "intermediate",
    title: "Выше среднего",
    description: "Связная речь, объяснение причин, предпочтений и уверенное решение практических задач.",
    accentColor: "#3B2B8F",
  },
] as const;

const demoCatalog: DemoLevelSeed[] = [
  {
    number: 1,
    slug: "starter",
    title: "Старт",
    description: "Мягкий вход в хангыль, первые фразы и базовый корейский для повседневных ситуаций.",
    accentColor: "#8FB8FF",
    units: [
      {
        slug: "hangul-bootcamp",
        title: "Хангыль с нуля",
        description: "Буквы, слоги и первые конструкции, которые можно сразу читать вслух.",
        lessons: [
          { slug: "alphabet-lab", title: "Алфавит и слоги", summary: "Познакомьтесь с гласными, согласными и блоками слогов.", theme: "чтение блоков хангыля" },
          { slug: "hello-korean", title: "Приветствие и знакомство", summary: "Соберите первые фразы для приветствия и знакомства.", theme: "вежливые приветствия и представление себя" },
          { slug: "numbers-first", title: "Первые числа", summary: "Научитесь использовать корейские и китайско-корейские числительные.", theme: "счет, возраст и простые числа" },
          { slug: "mini-survival-pack", title: "Мини-набор для выживания", summary: "Полезные фразы для класса, кафе и дороги.", theme: "базовые фразы для повседневных ситуаций", mode: "FLEXIBLE" },
        ],
      },
      {
        slug: "first-conversations",
        title: "Первые разговоры",
        description: "Короткие диалоги для дома, занятий и первого общения.",
        lessons: [
          { slug: "my-name-is", title: "Как вас зовут?", summary: "Расскажите, кто вы и откуда.", theme: "простые предложения о себе" },
          { slug: "this-and-that", title: "Это и то", summary: "Указывайте на предметы и задавайте простые вопросы.", theme: "указательные слова и названия предметов" },
          { slug: "where-are-you", title: "Где вы?", summary: "Используйте слова места и направления.", theme: "место, направление и частицы" },
          { slug: "starter-checkpoint", title: "Проверка уровня «Старт»", summary: "Смешанный повтор перед следующим этапом.", theme: "повтор стартового материала", mode: "FLEXIBLE" },
        ],
      },
    ],
  },
  {
    number: 2,
    slug: "foundation",
    title: "Основа",
    description: "Устойчивые модели предложений для режима дня, дома, учебы и простого общения.",
    accentColor: "#6F8CFF",
    units: [
      {
        slug: "daily-rhythm",
        title: "Режим дня",
        description: "Опишите свою неделю, привычки и простые планы.",
        lessons: [
          { slug: "my-day", title: "Мой день", summary: "Расскажите о распорядке дня и привычках.", theme: "повседневный распорядок" },
          { slug: "week-plan", title: "План на неделю", summary: "Используйте выражения времени и планы.", theme: "дни недели и планирование" },
          { slug: "can-and-cant", title: "Могу и не могу", summary: "Выражайте возможность и небольшие ограничения.", theme: "возможность, умение и запрет" },
          { slug: "focus-session", title: "Практика по теме", summary: "Гибкие задания на речь и письмо по режиму дня.", theme: "свободное использование лексики о распорядке", mode: "FLEXIBLE" },
        ],
      },
      {
        slug: "home-and-study",
        title: "Дом и учеба",
        description: "Комната, вещи, принадлежность и простые просьбы.",
        lessons: [
          { slug: "my-room", title: "Моя комната", summary: "Опишите мебель, предметы и их расположение.", theme: "предметы дома и расположение" },
          { slug: "who-has-it", title: "Чье это?", summary: "Говорите о принадлежности и владении.", theme: "принадлежность и обладание" },
          { slug: "please-help", title: "Пожалуйста, помогите", summary: "Формулируйте простые вежливые просьбы.", theme: "просьбы и вежливые ответы" },
          { slug: "foundation-checkpoint", title: "Проверка уровня «Основа»", summary: "Повтор структуры уроков с более свободным форматом.", theme: "повтор темы блока", mode: "FLEXIBLE" },
        ],
      },
    ],
  },
  {
    number: 3,
    slug: "elementary",
    title: "Средний",
    description: "Передвижение по городу, чувства, покупки и более живые бытовые диалоги.",
    accentColor: "#5967E8",
    units: [
      {
        slug: "moving-around",
        title: "Город и дорога",
        description: "Маршруты, транспорт и навигация в реальных ситуациях.",
        lessons: [
          { slug: "go-straight", title: "Идите прямо", summary: "Спрашивайте дорогу и понимайте ответ.", theme: "направления и глаголы движения" },
          { slug: "by-bus-or-subway", title: "На автобусе или метро", summary: "Говорите о маршрутах и пересадках.", theme: "общественный транспорт" },
          { slug: "at-the-store", title: "В магазине", summary: "Спрашивайте цену, размер и наличие.", theme: "язык покупок" },
          { slug: "town-challenge", title: "Городской челлендж", summary: "Гибкие задания по маршрутам и городским ситуациям.", theme: "практика по городским ситуациям", mode: "FLEXIBLE" },
        ],
      },
      {
        slug: "feelings-and-needs",
        title: "Чувства и потребности",
        description: "Эмоции, желания и бытовые личные потребности.",
        lessons: [
          { slug: "i-like-it", title: "Мне это нравится", summary: "Выражайте предпочтения и реакцию на предложения.", theme: "нравится, не нравится, предпочтения" },
          { slug: "im-tired", title: "Я устал", summary: "Опишите чувства и состояние.", theme: "эмоции и физическое состояние" },
          { slug: "i-need-this", title: "Мне это нужно", summary: "Говорите о необходимости и желании.", theme: "нужно, хочу, необходимо" },
          { slug: "elementary-checkpoint", title: "Проверка начального уровня", summary: "Практический повтор перед средним этапом.", theme: "повтор бытового общения", mode: "FLEXIBLE" },
        ],
      },
    ],
  },
  {
    number: 4,
    slug: "intermediate",
    title: "Выше среднего",
    description: "Связная речь, объяснение причин, предпочтений и уверенное решение практических задач.",
    accentColor: "#3B2B8F",
    units: [
      {
        slug: "opinions-and-plans",
        title: "Мнения и планы",
        description: "Причины, намерения, предложения и сравнение.",
        lessons: [
          { slug: "because-so", title: "Потому что / поэтому", summary: "Связывайте причину и результат естественнее.", theme: "причина и следствие" },
          { slug: "what-should-we-do", title: "Что нам делать?", summary: "Давайте советы и предлагайте решения.", theme: "советы, предложения и планы" },
          { slug: "better-than", title: "Лучше, чем", summary: "Сравнивайте варианты и привычки.", theme: "сравнение и выбор" },
          { slug: "intermediate-lab", title: "Лаборатория среднего уровня", summary: "Гибкие задания на аргументацию.", theme: "обоснование выбора", mode: "FLEXIBLE" },
        ],
      },
      {
        slug: "work-and-services",
        title: "Работа и сервис",
        description: "Сервисные ситуации, рабочее общение и практические просьбы.",
        lessons: [
          { slug: "customer-service", title: "Обслуживание и заказ", summary: "Решайте вопросы с доставкой, бронью и заказами.", theme: "общение в сервисных ситуациях" },
          { slug: "office-routine", title: "Рабочий день", summary: "Обсуждайте задачи, график и обновления.", theme: "рабочее общение" },
          { slug: "appointments", title: "Встречи и записи", summary: "Назначайте и переносите встречи.", theme: "бронь, запись и перенос" },
          { slug: "intermediate-checkpoint", title: "Проверка среднего уровня", summary: "Гибкий повтор практического языка.", theme: "повтор сервисных тем", mode: "FLEXIBLE" },
        ],
      },
    ],
  },
];

const stepLabels: Record<CourseStepType, string> = {
  GRAMMAR: "Грамматика",
  EXAMPLES: "Примеры",
  VOCABULARY: "Словарь",
  PRACTICE: "Практика",
  QUIZ: "Тест",
  CUSTOM: "Свободный шаг",
};

function createStandardSteps(theme: string): AdminCourseStep[] {
  return [
    {
      type: "GRAMMAR",
      title: "Разбор грамматики",
      content: `Целевая тема: ${theme}.\n\n- Разберите структуру предложения по частям.\n- Обратите внимание на вежливое окончание.\n- Повторите модель в новом контексте.`,
      imageUrl: null,
    },
    {
      type: "EXAMPLES",
      title: "Примеры предложений",
      content: `Используйте тему «${theme}» в трех коротких бытовых предложениях.\nЗамените одну деталь и повторите.\nПопробуйте перенести модель в новую ситуацию.`,
      imageUrl: null,
    },
    {
      type: "VOCABULARY",
      title: "Словарь перед уроком",
      content: `${theme}: ключевое слово 1\n${theme}: ключевое слово 2\n${theme}: ключевое слово 3\n${theme}: ключевое слово 4`,
      imageUrl: null,
    },
    {
      type: "PRACTICE",
      title: "Практика",
      content: `- Прочитайте каждое предложение вслух.\n- Замените одно слово.\n- Напишите одно предложение о себе.\n- Повторите без подсказки.`,
      imageUrl: null,
    },
    {
      type: "QUIZ",
      title: "Мини-тест",
      content: `1. Выберите правильную форму.\n2. Соотнесите фразу с контекстом.\n3. Составьте короткий ответ по теме «${theme}».`,
      imageUrl: null,
    },
  ];
}

function createFlexibleSteps(theme: string): AdminCourseStep[] {
  return [
    {
      type: "CUSTOM",
      title: "Свободный формат",
      content: `Поработайте с темой «${theme}» в более свободной форме.\nКратко перескажите идею.\nДайте один ответ.\nАдаптируйте материал под свою ситуацию.`,
      imageUrl: null,
    },
    {
      type: "VOCABULARY",
      title: "Опорные слова",
      content: `${theme}: выражение 1\n${theme}: выражение 2\n${theme}: выражение 3`,
      imageUrl: null,
    },
    {
      type: "PRACTICE",
      title: "Практическое задание",
      content: `- Ответьте в двух строках.\n- Скажите ту же мысль более вежливо.\n- Добавьте один пример из жизни.`,
      imageUrl: null,
    },
  ];
}

function createLesson(seed: DemoLessonSeed, imageUrl: string): AdminCourseLesson {
  return {
    slug: seed.slug,
    title: seed.title,
    summary: seed.summary,
    imageUrl,
    estimatedMinutes: seed.mode === "FLEXIBLE" ? 14 : 18,
    mode: seed.mode ?? "STANDARD",
    kind: "LESSON",
    vocabularyWordIds: [],
    isPublished: true,
    steps:
      seed.mode === "FLEXIBLE"
        ? createFlexibleSteps(seed.theme)
        : createStandardSteps(seed.theme),
  };
}

export function buildInitialCourseCatalog(): Omit<AdminCourseLevel, "id">[] {
  return demoCatalog.map((level, levelIndex) => ({
    number: level.number,
    slug: level.slug,
    title: level.title,
    description: level.description,
    accentColor: level.accentColor,
    units: level.units.map((unit, unitIndex) => ({
      slug: unit.slug,
      title: unit.title,
      description: unit.description,
      imageUrl: assetPool[(levelIndex + unitIndex) % assetPool.length] ?? null,
      isPublished: true,
      lessons: unit.lessons.map((lesson, lessonIndex) =>
        createLesson(
          lesson,
          assetPool[(levelIndex + unitIndex + lessonIndex + 1) % assetPool.length] ?? "",
        ),
      ),
    })),
  }));
}

export function slugify(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "item";
}

export function makeUniqueSlug(value: string, existing: Iterable<string>) {
  const base = slugify(value);
  const used = new Set(
    [...existing]
      .map((item) => item.trim())
      .filter(Boolean),
  );

  if (!used.has(base)) {
    return base;
  }

  let suffix = 2;
  let candidate = `${base}-${suffix}`;

  while (used.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
}

export function createStandardStep(type: CourseStepType): AdminCourseStep {
  return {
    type,
    title: `${stepLabels[type]}: шаг`,
    content: "",
    imageUrl: null,
  };
}

export function createEmptyFlexibleStep(index: number): AdminCourseStep {
  return {
    type: index === 0 ? "CUSTOM" : "PRACTICE",
    title: `Шаг ${index + 1}`,
    content: "",
    imageUrl: null,
  };
}

export function createEmptyLesson(index: number): AdminCourseLesson {
  return {
    slug: `lesson-${index + 1}`,
    title: `Урок ${index + 1}`,
    summary: "",
    imageUrl: null,
    estimatedMinutes: 15,
    mode: "STANDARD",
    kind: "LESSON",
    vocabularyWordIds: [],
    isPublished: true,
    steps: STANDARD_STEP_SEQUENCE.map((type) => createStandardStep(type)),
  };
}

export function createEmptyUnit(index: number) {
  return {
    slug: `unit-${index + 1}`,
    title: `Юнит ${index + 1}`,
    description: "",
    imageUrl: null,
    isPublished: true,
    lessons: [createEmptyLesson(0)],
  };
}
