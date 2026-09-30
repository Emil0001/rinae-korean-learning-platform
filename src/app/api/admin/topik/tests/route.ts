import {
  TopikLevel,
  TopikSectionBlockVariant,
  TopikSectionType,
} from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";
import {
  persistQuestionImagesForSections,
  removeQuestionImageIfManaged,
} from "@/lib/topik-question-images";

export const runtime = "nodejs";

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

type CreateTestBody = {
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

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const tests = await prisma.topikTest.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        level: true,
        isPublished: true,
        listeningAudioUrl: true,
        durationMinutes: true,
        sections: {
          orderBy: { order: "asc" },
          include: {
            _count: {
              select: { questions: true },
            },
          },
        },
      },
    });

    return NextResponse.json({
      tests: tests.map((test) => ({
        id: test.id,
        title: test.title,
        level: test.level,
        isPublished: test.isPublished,
        listeningAudioUrl: test.listeningAudioUrl,
        durationMinutes: test.durationMinutes,
        sections: test.sections.map((section) => ({
          id: section.id,
          type: section.type,
          title: section.title,
          questionCount: section._count.questions,
        })),
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Не удалось загрузить список тестов для администратора." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as CreateTestBody;

    const title = body.title?.trim() ?? "";
    const description = body.description?.trim() || null;
    const levelRaw = body.level ?? "";
    const durationMinutes = sanitizeInt(body.durationMinutes, 0);
    const isPublished = Boolean(body.isPublished);
    const sectionsRaw = Array.isArray(body.sections) ? body.sections : [];

    if (title.length < 3) {
      return NextResponse.json(
        { error: "Название теста слишком короткое." },
        { status: 400 },
      );
    }

    if (!isValidLevel(levelRaw)) {
      return NextResponse.json(
        { error: "Некорректный уровень TOPIK." },
        { status: 400 },
      );
    }

    if (durationMinutes <= 0) {
      return NextResponse.json(
        { error: "Укажите длительность теста в минутах." },
        { status: 400 },
      );
    }

    if (!sectionsRaw.length) {
      return NextResponse.json(
        { error: "Добавьте хотя бы одну секцию." },
        { status: 400 },
      );
    }

    const sections = sectionsRaw.map((section, sectionIndex) => {
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
          throw new Error(
            `Пустой текст блока #${blockIndex + 1} в секции "${sectionTitle}".`,
          );
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

    let testId = "";
    const savedImageUrls: string[] = [];

    try {
      const test = await prisma.topikTest.create({
        data: {
          title,
          description,
          level: levelRaw,
          durationMinutes,
          isPublished,
        },
        select: { id: true },
      });

      testId = test.id;

      const persisted = await persistQuestionImagesForSections(sections, test.id);
      savedImageUrls.push(...persisted.savedUrls);

      await prisma.topikTest.update({
        where: { id: test.id },
        data: {
          sections: {
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

      return NextResponse.json({ id: test.id, ok: true }, { status: 201 });
    } catch (error) {
      await Promise.allSettled(
        savedImageUrls.map((url) => removeQuestionImageIfManaged(url)),
      );

      if (testId) {
        await prisma.topikTest.delete({ where: { id: testId } }).catch(() => undefined);
      }

      throw error;
    }
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Не удалось создать тест." },
      { status: 500 },
    );
  }
}


