import {
  Prisma,
  TopikLevel,
  TopikSectionBlockVariant,
  TopikSectionType,
} from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";
import { buildTopikAttemptFeedback } from "@/lib/topik-feedback";
import {
  collectManagedQuestionImageUrls,
  persistQuestionImagesForSections,
  removeQuestionImageIfManaged,
} from "@/lib/topik-question-images";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ testId: string }> | { testId: string };
};

type PatchBody = {
  isPublished?: boolean;
};

type CreateChoiceInput = {
  text?: string;
  imageUrl?: string | null;
};

type CreateBlockInput = {
  variant?: TopikSectionBlockVariant;
  title?: string;
  content?: string;
  displayBeforeQuestionOrder?: number;
};

type CreateQuestionInput = {
  prompt?: string;
  content?: string;
  contentImageUrl?: string | null;
  points?: number;
  correctChoiceIndex?: number;
  choices?: CreateChoiceInput[];
};

type CreateSectionInput = {
  type?: TopikSectionType;
  title?: string;
  durationMinutes?: number;
  blocks?: CreateBlockInput[];
  questions?: CreateQuestionInput[];
};

type UpdateTestBody = {
  title?: string;
  description?: string;
  level?: TopikLevel;
  durationMinutes?: number;
  isPublished?: boolean;
  sections?: CreateSectionInput[];
};

function sanitizeInt(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.floor(num) : fallback;
}

function isValidLevel(level: string): level is TopikLevel {
  return level === "TOPIK_I" || level === "TOPIK_II";
}

function isValidSectionType(type: string): type is TopikSectionType {
  return type === "LISTENING" || type === "READING";
}

function isValidBlockVariant(type: string): type is TopikSectionBlockVariant {
  return type === "EXAMPLE" || type === "PASSAGE" || type === "NOTICE";
}

function normalizeSections(sectionsRaw: CreateSectionInput[]) {
  if (!sectionsRaw.length) {
    throw new Error("Добавьте хотя бы одну секцию.");
  }

  return sectionsRaw.map((section, sectionIndex) => {
    const sectionTypeRaw = section.type ?? "";
    const sectionTitle = section.title?.trim() ?? "";
    const sectionDuration = sanitizeInt(section.durationMinutes, 0);
    const blocksRaw = Array.isArray(section.blocks) ? section.blocks : [];
    const questionsRaw = Array.isArray(section.questions) ? section.questions : [];

    if (!isValidSectionType(sectionTypeRaw)) {
      throw new Error(`Некорректный тип секции #${sectionIndex + 1}.`);
    }

    if (sectionTitle.length < 2) {
      throw new Error(`Название секции #${sectionIndex + 1} слишком короткое.`);
    }

    if (sectionDuration <= 0) {
      throw new Error(`Укажите длительность секции #${sectionIndex + 1}.`);
    }

    if (!questionsRaw.length) {
      throw new Error(`Добавьте хотя бы один вопрос в секцию "${sectionTitle}".`);
    }

    const questions = questionsRaw.map((question, questionIndex) => {
      const prompt = question.prompt?.trim() ?? "";
      const content = question.content?.trim() || null;
      const contentImageUrl = question.contentImageUrl?.trim() || null;
      const points = sanitizeInt(question.points, 1);
      const choicesRaw = Array.isArray(question.choices) ? question.choices : [];
      const correctChoiceIndex = sanitizeInt(question.correctChoiceIndex, -1);

      if (prompt.length < 3) {
        throw new Error(
          `Вопрос #${questionIndex + 1} в секции "${sectionTitle}" слишком короткий.`,
        );
      }

      if (points <= 0) {
        throw new Error(
          `У вопроса #${questionIndex + 1} в секции "${sectionTitle}" некорректный балл.`,
        );
      }

      if (choicesRaw.length < 2) {
        throw new Error(
          `Вопрос #${questionIndex + 1} в секции "${sectionTitle}" должен содержать минимум 2 варианта ответа.`,
        );
      }

      if (correctChoiceIndex < 0 || correctChoiceIndex >= choicesRaw.length) {
        throw new Error(
          `Выберите корректный правильный вариант для вопроса #${questionIndex + 1} в секции "${sectionTitle}".`,
        );
      }

      const choices = choicesRaw.map((choice, choiceIndex) => {
        const text = choice.text?.trim() ?? "";
        const imageUrl = choice.imageUrl?.trim() || null;

        if (!text && !imageUrl) {
          throw new Error(
            `Пустой вариант ответа в вопросе #${questionIndex + 1} секции "${sectionTitle}".`,
          );
        }

        return {
          order: choiceIndex + 1,
          text,
          imageUrl,
          isCorrect: choiceIndex === correctChoiceIndex,
        };
      });

      return {
        order: questionIndex + 1,
        prompt,
        content,
        contentImageUrl,
        points,
        choices,
      };
    });

    const blocks = blocksRaw.map((block, blockIndex) => {
      const variantRaw = block.variant ?? "";
      const title = block.title?.trim() || null;
      const content = block.content?.trim() ?? "";
      const displayBeforeQuestionOrder = sanitizeInt(block.displayBeforeQuestionOrder, 0);

      if (!isValidBlockVariant(variantRaw)) {
        throw new Error(
          `Некорректный тип блока #${blockIndex + 1} в секции "${sectionTitle}".`,
        );
      }

      if (!content) {
        throw new Error(`Пустой текст блока #${blockIndex + 1} в секции "${sectionTitle}".`);
      }

      if (
        displayBeforeQuestionOrder <= 0 ||
        displayBeforeQuestionOrder > questions.length
      ) {
        throw new Error(
          `Блок #${blockIndex + 1} в секции "${sectionTitle}" привязан к несуществующему вопросу. Укажите номер от 1 до ${questions.length}.`,
        );
      }

      return {
        order: blockIndex + 1,
        displayBeforeQuestionOrder,
        variant: variantRaw,
        title,
        content,
      };
    });

    return {
      type: sectionTypeRaw,
      title: sectionTitle,
      order: sectionIndex + 1,
      durationMinutes: sectionDuration,
      blocks,
      questions,
    };
  });
}

type NormalizedSection = ReturnType<typeof normalizeSections>[number];
type ExistingChoice = {
  id: string;
  text: string;
  imageUrl: string | null;
  isCorrect: boolean;
};
type ExistingQuestion = {
  id: string;
  prompt: string;
  content: string | null;
  contentImageUrl: string | null;
  points: number;
  choices: ExistingChoice[];
};
type ExistingBlock = {
  id: string;
  variant: TopikSectionBlockVariant;
  title: string | null;
  content: string;
  displayBeforeQuestionOrder: number;
};
type ExistingSection = {
  id: string;
  type: TopikSectionType;
  title: string;
  durationMinutes: number;
  blocks: ExistingBlock[];
  questions: ExistingQuestion[];
};

type TopikWriteClient = Pick<
  Prisma.TransactionClient,
  | "topikTest"
  | "topikSection"
  | "topikSectionBlock"
  | "topikQuestion"
  | "topikChoice"
  | "topikAttempt"
  | "topikAttemptAnswer"
>;

function assertSafeAttemptedUpdate(
  existingSections: ExistingSection[],
  incomingSections: NormalizedSection[],
) {
  if (incomingSections.length < existingSections.length) {
    throw new Error(
      "Нельзя удалять уже существующие секции у теста, по которому есть попытки. Можно обновлять текущие секции и добавлять новые в конец.",
    );
  }

  existingSections.forEach((existingSection, sectionIndex) => {
    const incomingSection = incomingSections[sectionIndex];
    if (!incomingSection) {
      throw new Error(
        `Секция #${sectionIndex + 1} должна остаться в тесте, потому что по нему уже есть попытки.`,
      );
    }

    if (incomingSection.type !== existingSection.type) {
      throw new Error(
        `Нельзя менять тип уже существующей секции #${sectionIndex + 1}. Для тестов с попытками разрешено только обновление текущей структуры и добавление новых секций.`,
      );
    }

    if (incomingSection.blocks.length < existingSection.blocks.length) {
      throw new Error(
        `Нельзя удалять блоки из существующей секции "${existingSection.title}", пока по тесту есть попытки.`,
      );
    }

    if (incomingSection.questions.length < existingSection.questions.length) {
      throw new Error(
        `Нельзя удалять вопросы из существующей секции "${existingSection.title}", пока по тесту есть попытки.`,
      );
    }

    existingSection.questions.forEach((existingQuestion, questionIndex) => {
      const incomingQuestion = incomingSection.questions[questionIndex];
      if (!incomingQuestion) {
        throw new Error(
          `Вопрос #${questionIndex + 1} в секции "${existingSection.title}" должен остаться, потому что на него уже есть ответы студентов.`,
        );
      }

      if (incomingQuestion.choices.length !== existingQuestion.choices.length) {
        throw new Error(
          `Нельзя менять количество вариантов ответа у существующего вопроса #${questionIndex + 1} в секции "${existingSection.title}", пока по тесту есть попытки.`,
        );
      }
    });
  });
}

async function syncChoicesWithAttempts(
  tx: TopikWriteClient,
  questionId: string,
  existingChoices: ExistingChoice[],
  incomingChoices: NormalizedSection["questions"][number]["choices"],
) {
  for (const [choiceIndex, choice] of incomingChoices.entries()) {
    const existingChoice = existingChoices[choiceIndex];

    if (existingChoice) {
      const nextOrder = choiceIndex + 1;
      if (
        existingChoice.text !== choice.text ||
        existingChoice.imageUrl !== choice.imageUrl ||
        existingChoice.isCorrect !== choice.isCorrect
      ) {
        await tx.topikChoice.update({
          where: { id: existingChoice.id },
          data: {
            order: nextOrder,
            text: choice.text,
            imageUrl: choice.imageUrl,
            isCorrect: choice.isCorrect,
          },
        });
      }
      continue;
    }

    await tx.topikChoice.create({
      data: {
        questionId,
        order: choiceIndex + 1,
        text: choice.text,
        imageUrl: choice.imageUrl,
        isCorrect: choice.isCorrect,
      },
    });
  }
}

async function syncQuestionsWithAttempts(
  tx: TopikWriteClient,
  sectionId: string,
  existingQuestions: ExistingQuestion[],
  incomingQuestions: NormalizedSection["questions"],
) {
  for (const [questionIndex, question] of incomingQuestions.entries()) {
    const existingQuestion = existingQuestions[questionIndex];

    if (existingQuestion) {
      const nextOrder = questionIndex + 1;
      if (
        existingQuestion.prompt !== question.prompt ||
        existingQuestion.content !== question.content ||
        existingQuestion.contentImageUrl !== question.contentImageUrl ||
        existingQuestion.points !== question.points
      ) {
        await tx.topikQuestion.update({
          where: { id: existingQuestion.id },
          data: {
            order: nextOrder,
            prompt: question.prompt,
            content: question.content,
            contentImageUrl: question.contentImageUrl,
            points: question.points,
          },
        });
      }

      await syncChoicesWithAttempts(
        tx,
        existingQuestion.id,
        existingQuestion.choices,
        question.choices,
      );
      continue;
    }

    await tx.topikQuestion.create({
      data: {
        sectionId,
        order: questionIndex + 1,
        prompt: question.prompt,
        content: question.content,
        contentImageUrl: question.contentImageUrl,
        points: question.points,
        choices: {
          create: question.choices,
        },
      },
    });
  }
}

async function syncBlocksWithAttempts(
  tx: TopikWriteClient,
  sectionId: string,
  existingBlocks: ExistingBlock[],
  incomingBlocks: NormalizedSection["blocks"],
) {
  for (const [blockIndex, block] of incomingBlocks.entries()) {
    const existingBlock = existingBlocks[blockIndex];

    if (existingBlock) {
      const nextOrder = blockIndex + 1;
      if (
        existingBlock.displayBeforeQuestionOrder !== block.displayBeforeQuestionOrder ||
        existingBlock.variant !== block.variant ||
        existingBlock.title !== block.title ||
        existingBlock.content !== block.content
      ) {
        await tx.topikSectionBlock.update({
          where: { id: existingBlock.id },
          data: {
            order: nextOrder,
            displayBeforeQuestionOrder: block.displayBeforeQuestionOrder,
            variant: block.variant,
            title: block.title,
            content: block.content,
          },
        });
      }
      continue;
    }

    await tx.topikSectionBlock.create({
      data: {
        sectionId,
        order: blockIndex + 1,
        displayBeforeQuestionOrder: block.displayBeforeQuestionOrder,
        variant: block.variant,
        title: block.title,
        content: block.content,
      },
    });
  }
}

async function syncSectionsWithAttempts(
  tx: TopikWriteClient,
  testId: string,
  existingSections: ExistingSection[],
  incomingSections: NormalizedSection[],
) {
  for (const [sectionIndex, section] of incomingSections.entries()) {
    const existingSection = existingSections[sectionIndex];

    if (existingSection) {
      const nextOrder = sectionIndex + 1;
      if (
        existingSection.type !== section.type ||
        existingSection.title !== section.title ||
        existingSection.durationMinutes !== section.durationMinutes
      ) {
        await tx.topikSection.update({
          where: { id: existingSection.id },
          data: {
            order: nextOrder,
            type: section.type,
            title: section.title,
            durationMinutes: section.durationMinutes,
          },
        });
      }

      await syncBlocksWithAttempts(
        tx,
        existingSection.id,
        existingSection.blocks,
        section.blocks,
      );
      await syncQuestionsWithAttempts(
        tx,
        existingSection.id,
        existingSection.questions,
        section.questions,
      );
      continue;
    }

    await tx.topikSection.create({
      data: {
        testId,
        type: section.type,
        title: section.title,
        order: sectionIndex + 1,
        durationMinutes: section.durationMinutes,
        blocks: {
          create: section.blocks,
        },
        questions: {
          create: section.questions.map((question) => ({
            order: question.order,
            prompt: question.prompt,
            content: question.content,
            contentImageUrl: question.contentImageUrl,
            points: question.points,
            choices: {
              create: question.choices,
            },
          })),
        },
      },
    });
  }
}

async function recalculateAttemptsForTest(
  tx: TopikWriteClient,
  testId: string,
  level: TopikLevel,
) {
  const attempts = await tx.topikAttempt.findMany({
    where: { testId },
    include: {
      answers: {
        include: {
          question: {
            include: {
              section: {
                include: {
                  blocks: {
                    orderBy: { order: "asc" },
                  },
                },
              },
              choices: {
                orderBy: { order: "asc" },
              },
            },
          },
        },
      },
    },
  });

  for (const attempt of attempts) {
    const sectionMap = new Map<
      string,
      {
        id: string;
        title: string;
        type: TopikSectionType;
        order: number;
        durationMinutes: number;
        blocks: {
          id: string;
          order: number;
          displayBeforeQuestionOrder: number;
          variant: TopikSectionBlockVariant;
          title: string | null;
          content: string;
        }[];
        questions: {
          id: string;
          order: number;
          prompt: string;
          content: string | null;
          contentImageUrl: string | null;
          points: number;
          isCorrect: boolean;
          selectedChoiceId: string | null;
          correctChoiceId: string | null;
          choices: {
            id: string;
            order: number;
            text: string;
            imageUrl: string | null;
            isCorrect: boolean;
            isSelected: boolean;
          }[];
        }[];
      }
    >();

    let totalScore = 0;
    let maxTotalScore = 0;
    let readingScore = 0;
    let maxReadingScore = 0;
    let listeningScore = 0;
    let maxListeningScore = 0;

    for (const answer of attempt.answers) {
      const question = answer.question;
      const section = question.section;
      const correctChoice = question.choices.find((choice) => choice.isCorrect) ?? null;
      const isCorrect = Boolean(correctChoice && answer.choiceId === correctChoice.id);

      if (answer.isCorrect !== isCorrect) {
        await tx.topikAttemptAnswer.update({
          where: { id: answer.id },
          data: { isCorrect },
        });
      }

      maxTotalScore += question.points;
      if (section.type === "READING") {
        maxReadingScore += question.points;
      } else {
        maxListeningScore += question.points;
      }

      if (isCorrect) {
        totalScore += question.points;
        if (section.type === "READING") {
          readingScore += question.points;
        } else {
          listeningScore += question.points;
        }
      }

      const sectionEntry =
        sectionMap.get(section.id) ??
        {
          id: section.id,
          title: section.title,
          type: section.type,
          order: section.order,
          durationMinutes: section.durationMinutes,
          blocks: section.blocks.map((block) => ({
            id: block.id,
            order: block.order,
            displayBeforeQuestionOrder: block.displayBeforeQuestionOrder,
            variant: block.variant,
            title: block.title,
            content: block.content,
          })),
          questions: [],
        };

      sectionEntry.questions.push({
        id: question.id,
        order: question.order,
        prompt: question.prompt,
        content: question.content,
        contentImageUrl: question.contentImageUrl,
        points: question.points,
        isCorrect,
        selectedChoiceId: answer.choiceId,
        correctChoiceId: correctChoice?.id ?? null,
        choices: question.choices.map((choice) => ({
          id: choice.id,
          order: choice.order,
          text: choice.text,
          imageUrl: choice.imageUrl,
          isCorrect: choice.isCorrect,
          isSelected: choice.id === answer.choiceId,
        })),
      });
      sectionMap.set(section.id, sectionEntry);
    }

    const resultSections = [...sectionMap.values()]
      .sort((left, right) => left.order - right.order)
      .map((section) => ({
        ...section,
        questions: [...section.questions].sort((left, right) => left.order - right.order),
      }));

    const sectionTypes = [...new Set(resultSections.map((section) => section.type))];
    const feedback = JSON.stringify(
      buildTopikAttemptFeedback({
        level,
        sectionType: sectionTypes.length === 1 ? sectionTypes[0] : null,
        totalScore,
        maxTotalScore,
        sections: resultSections,
      }),
    );

    await tx.topikAttempt.update({
      where: { id: attempt.id },
      data: {
        totalScore,
        maxTotalScore,
        readingScore,
        maxReadingScore,
        listeningScore,
        maxListeningScore,
        feedback,
      },
    });
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { testId } = await context.params;

  try {
    const test = await prisma.topikTest.findUnique({
      where: { id: testId },
      select: {
        id: true,
        title: true,
        description: true,
        level: true,
        durationMinutes: true,
        isPublished: true,
        listeningAudioUrl: true,
        sections: {
          orderBy: { order: "asc" },
          select: {
            type: true,
            title: true,
            durationMinutes: true,
            blocks: {
              orderBy: { order: "asc" },
              select: {
                variant: true,
                title: true,
                content: true,
                displayBeforeQuestionOrder: true,
              },
            },
            questions: {
              orderBy: { order: "asc" },
              select: {
                prompt: true,
                content: true,
                contentImageUrl: true,
                points: true,
                choices: {
                  orderBy: { order: "asc" },
                  select: {
                    text: true,
                    imageUrl: true,
                    isCorrect: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!test) {
      return NextResponse.json({ error: "Тест не найден." }, { status: 404 });
    }

    return NextResponse.json({
      test: {
        id: test.id,
        title: test.title,
        description: test.description,
        level: test.level,
        durationMinutes: test.durationMinutes,
        isPublished: test.isPublished,
        listeningAudioUrl: test.listeningAudioUrl,
        sections: test.sections.map((section) => ({
          type: section.type,
          title: section.title,
          durationMinutes: section.durationMinutes,
          blocks: section.blocks.map((block) => ({
            variant: block.variant,
            title: block.title ?? "",
            content: block.content,
            displayBeforeQuestionOrder: block.displayBeforeQuestionOrder,
          })),
          questions: section.questions.map((question) => ({
            prompt: question.prompt,
            content: question.content ?? "",
            contentImageUrl: question.contentImageUrl,
            points: question.points,
            correctChoiceIndex: Math.max(
              0,
              question.choices.findIndex((choice) => choice.isCorrect),
            ),
            choices: question.choices.map((choice) => ({
              text: choice.text,
              imageUrl: choice.imageUrl,
            })),
          })),
        })),
      },
    });
  } catch {
    return NextResponse.json({ error: "Не удалось загрузить тест." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { testId } = await context.params;

  try {
    const body = (await request.json()) as UpdateTestBody;

    const title = body.title?.trim() ?? "";
    const description = body.description?.trim() || null;
    const levelRaw = body.level ?? "";
    const durationMinutes = sanitizeInt(body.durationMinutes, 0);
    const isPublished = Boolean(body.isPublished);
    const sectionsRaw = Array.isArray(body.sections) ? body.sections : [];

    if (title.length < 3) {
      return NextResponse.json({ error: "Название теста слишком короткое." }, { status: 400 });
    }

    if (!isValidLevel(levelRaw)) {
      return NextResponse.json({ error: "Некорректный уровень TOPIK." }, { status: 400 });
    }

    if (durationMinutes <= 0) {
      return NextResponse.json({ error: "Укажите длительность теста в минутах." }, { status: 400 });
    }

    const normalizedSections = normalizeSections(sectionsRaw);

    const [hasAttempts, existingTest] = await Promise.all([
      prisma.topikAttempt.count({
        where: { testId },
      }),
      prisma.topikTest.findUnique({
        where: { id: testId },
        select: {
          id: true,
          sections: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              type: true,
              title: true,
              durationMinutes: true,
              blocks: {
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  variant: true,
                  title: true,
                  content: true,
                  displayBeforeQuestionOrder: true,
                },
              },
              questions: {
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  prompt: true,
                  content: true,
                  contentImageUrl: true,
                  points: true,
                  choices: {
                    orderBy: { order: "asc" },
                    select: {
                      id: true,
                      text: true,
                      imageUrl: true,
                      isCorrect: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    if (!existingTest) {
      return NextResponse.json({ error: "Тест не найден." }, { status: 404 });
    }

    const previousImageUrls = collectManagedQuestionImageUrls(existingTest.sections);
    const persisted = await persistQuestionImagesForSections(normalizedSections, testId);
    let structureSaved = false;

    try {
      if (hasAttempts > 0) {
        assertSafeAttemptedUpdate(existingTest.sections, persisted.sections);

        await prisma.$transaction(
          async (tx) => {
            await tx.topikTest.update({
              where: { id: testId },
              data: {
                title,
                description,
                level: levelRaw,
                durationMinutes,
                isPublished,
              },
            });

            await syncSectionsWithAttempts(
              tx,
              testId,
              existingTest.sections,
              persisted.sections,
            );
          },
          {
            maxWait: 10_000,
            timeout: 60_000,
          },
        );
        structureSaved = true;
        await recalculateAttemptsForTest(prisma, testId, levelRaw);
      } else {
        await prisma.topikTest.update({
          where: { id: testId },
          data: {
            title,
            description,
            level: levelRaw,
            durationMinutes,
            isPublished,
            sections: {
              deleteMany: {},
              create: persisted.sections.map((section) => ({
                type: section.type,
                title: section.title,
                order: section.order,
                durationMinutes: section.durationMinutes,
                blocks: {
                  create: section.blocks,
                },
                questions: {
                  create: section.questions.map((question) => ({
                    order: question.order,
                    prompt: question.prompt,
                    content: question.content,
                    contentImageUrl: question.contentImageUrl,
                    points: question.points,
                    choices: {
                      create: question.choices,
                    },
                  })),
                },
              })),
            },
          },
        });
        structureSaved = true;
      }
    } catch (error) {
      if (!structureSaved) {
        await Promise.allSettled(
          persisted.savedUrls.map((url) => removeQuestionImageIfManaged(url)),
        );
      }
      throw error;
    }

    const nextImageUrls = collectManagedQuestionImageUrls(persisted.sections);
    const staleImageUrls = [...previousImageUrls].filter((url) => !nextImageUrls.has(url));

    await Promise.allSettled(
      staleImageUrls.map((url) => removeQuestionImageIfManaged(url)),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Не удалось обновить тест." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { testId } = await context.params;

  try {
    const body = (await request.json()) as PatchBody;
    if (typeof body.isPublished !== "boolean") {
      return NextResponse.json({ error: "Передайте корректное значение isPublished." }, { status: 400 });
    }

    const updated = await prisma.topikTest.update({
      where: { id: testId },
      data: { isPublished: body.isPublished },
      select: {
        id: true,
        isPublished: true,
      },
    });

    return NextResponse.json({ test: updated });
  } catch {
    return NextResponse.json({ error: "Не удалось обновить статус теста." }, { status: 500 });
  }
}


