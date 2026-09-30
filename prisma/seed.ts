import {
  CourseLessonMode,
  CourseStepType,
  PrismaClient,
  TopikLevel,
  TopikSectionBlockVariant,
  TopikSectionType,
  UserRole,
} from "@prisma/client";
import { hash } from "bcryptjs";
import { buildInitialCourseCatalog } from "../src/lib/course-content";

const prisma = new PrismaClient();

function getRequiredSeedValue(name: "SEED_ADMIN_EMAIL" | "SEED_ADMIN_PASSWORD") {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to seed the admin account.`);
  }

  return value;
}

async function seedAdmin() {
  const email = getRequiredSeedValue("SEED_ADMIN_EMAIL").trim().toLowerCase();
  const password = getRequiredSeedValue("SEED_ADMIN_PASSWORD");
  const name = process.env.SEED_ADMIN_NAME?.trim() || "Rinae Admin";

  if (!email.includes("@")) {
    throw new Error("SEED_ADMIN_EMAIL must be a valid email address.");
  }

  if (password.length < 12) {
    throw new Error("SEED_ADMIN_PASSWORD must contain at least 12 characters.");
  }

  const passwordHash = await hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      role: UserRole.ADMIN,
    },
    create: {
      name,
      email,
      passwordHash,
      role: UserRole.ADMIN,
    },
  });
}

async function seedTopikDemo() {
  await prisma.topikAttemptAnswer.deleteMany();
  await prisma.topikAttempt.deleteMany();
  await prisma.topikChoice.deleteMany();
  await prisma.topikQuestion.deleteMany();
  await prisma.topikSection.deleteMany();
  await prisma.topikTest.deleteMany();

  await prisma.topikTest.create({
    data: {
      title: "TOPIK I - Пробный тест №1",
      description: "Демонстрационный тест для запуска платформы.",
      level: TopikLevel.TOPIK_I,
      durationMinutes: 100,
      isPublished: true,
      sections: {
        create: [
          {
            type: TopikSectionType.LISTENING,
            title: "Аудирование",
            order: 1,
            durationMinutes: 40,
            questions: {
              create: [
                {
                  order: 1,
                  prompt: "Выберите подходящий ответ для приветствия.",
                  points: 1,
                  choices: {
                    create: [
                      { order: 1, text: "안녕하세요", isCorrect: true },
                      { order: 2, text: "감사합니다", isCorrect: false },
                      { order: 3, text: "죄송합니다", isCorrect: false },
                    ],
                  },
                },
                {
                  order: 2,
                  prompt: "Какое слово означает 'вода'?",
                  points: 1,
                  choices: {
                    create: [
                      { order: 1, text: "물", isCorrect: true },
                      { order: 2, text: "밥", isCorrect: false },
                      { order: 3, text: "집", isCorrect: false },
                    ],
                  },
                },
                {
                  order: 3,
                  prompt: "Выберите корректный вариант ответа в диалоге о времени.",
                  points: 1,
                  choices: {
                    create: [
                      { order: 1, text: "네, 세 시에 만나요.", isCorrect: true },
                      { order: 2, text: "아니요, 물이 있어요.", isCorrect: false },
                      { order: 3, text: "가방이 어디예요?", isCorrect: false },
                    ],
                  },
                },
              ],
            },
          },
          {
            type: TopikSectionType.READING,
            title: "Чтение",
            order: 2,
            durationMinutes: 60,
            blocks: {
              create: [
                {
                  order: 1,
                  displayBeforeQuestionOrder: 1,
                  variant: TopikSectionBlockVariant.EXAMPLE,
                  title: "Образец",
                  content:
                    "사과가 있습니다. 그리고 배도 있습니다.\n\n1) 고향  2) 얼굴  3) 과일  4) 계절",
                },
              ],
            },
            questions: {
              create: [
                {
                  order: 1,
                  prompt: "무엇에 대한 내용입니까?",
                  content: "저는 영국 사람입니다. 친구는 중국 사람입니다.",
                  points: 1,
                  choices: {
                    create: [
                      { order: 1, text: "가족", isCorrect: false },
                      { order: 2, text: "날짜", isCorrect: false },
                      { order: 3, text: "나라", isCorrect: true },
                      { order: 4, text: "학교", isCorrect: false },
                    ],
                  },
                },
                {
                  order: 2,
                  prompt: "Выберите корректную грамматическую форму для вежливого стиля.",
                  content: "친구와 같이 식당에 갑니다.",
                  points: 1,
                  choices: {
                    create: [
                      { order: 1, text: "먹어요", isCorrect: true },
                      { order: 2, text: "먹다요", isCorrect: false },
                      { order: 3, text: "먹습니다요", isCorrect: false },
                    ],
                  },
                },
                {
                  order: 3,
                  prompt: "Прочитайте предложение и выберите верный ответ по смыслу.",
                  points: 1,
                  choices: {
                    create: [
                      { order: 1, text: "Он идет в библиотеку.", isCorrect: true },
                      { order: 2, text: "Он едет в аэропорт.", isCorrect: false },
                      { order: 3, text: "Он работает дома.", isCorrect: false },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  });
}

async function seedCourses() {
  const catalog = buildInitialCourseCatalog();

  await prisma.courseLessonProgress.deleteMany();
  await prisma.courseLessonStep.deleteMany();
  await prisma.courseLesson.deleteMany();
  await prisma.courseUnit.deleteMany();
  await prisma.courseLevel.deleteMany();

  for (const level of catalog) {
    await prisma.courseLevel.create({
      data: {
        number: level.number,
        slug: level.slug,
        title: level.title,
        description: level.description,
        accentColor: level.accentColor,
        units: {
          create: level.units.map((unit, unitIndex) => ({
            slug: unit.slug,
            order: unitIndex + 1,
            title: unit.title,
            description: unit.description,
            imageUrl: unit.imageUrl,
            isPublished: unit.isPublished,
            lessons: {
              create: unit.lessons.map((lesson, lessonIndex) => ({
                slug: lesson.slug,
                order: lessonIndex + 1,
                title: lesson.title,
                summary: lesson.summary,
                imageUrl: lesson.imageUrl,
                estimatedMinutes: lesson.estimatedMinutes,
                mode: lesson.mode as CourseLessonMode,
                isPublished: lesson.isPublished,
                steps: {
                  create: lesson.steps.map((step, stepIndex) => ({
                    order: stepIndex + 1,
                    type: step.type as CourseStepType,
                    title: step.title,
                    content: step.content,
                    imageUrl: step.imageUrl,
                  })),
                },
              })),
            },
          })),
        },
      },
    });
  }
}

async function main() {
  await seedAdmin();

  if (process.env.ALLOW_DESTRUCTIVE_DEMO_SEED === "true") {
    await seedTopikDemo();
    await seedCourses();
  } else {
    console.log(
      "Skipped destructive demo content reset. Set ALLOW_DESTRUCTIVE_DEMO_SEED=true to run it explicitly.",
    );
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed complete. Admin credentials were read from the environment.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
