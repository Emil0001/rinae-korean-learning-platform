import { TopikSectionType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { buildTopikAttemptFeedback } from "@/lib/topik-feedback";

type AttemptAnswerInput = {
  questionId?: string;
  choiceId?: string | null;
};

type AttemptRequestBody = {
  testId?: string;
  answers?: AttemptAnswerInput[];
  sectionType?: TopikSectionType;
};

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
  }

  try {
    const attempts = await prisma.topikAttempt.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: "desc" },
      take: 20,
      include: {
        test: {
          select: {
            title: true,
            level: true,
          },
        },
      },
    });

    return NextResponse.json({
      attempts: attempts.map((attempt) => ({
        id: attempt.id,
        startedAt: attempt.startedAt,
        finishedAt: attempt.finishedAt,
        totalScore: attempt.totalScore,
        maxTotalScore: attempt.maxTotalScore,
        readingScore: attempt.readingScore,
        maxReadingScore: attempt.maxReadingScore,
        listeningScore: attempt.listeningScore,
        maxListeningScore: attempt.maxListeningScore,
        test: attempt.test,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Не удалось загрузить попытки." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as AttemptRequestBody;
    const testId = body.testId?.trim();
    const answers = Array.isArray(body.answers) ? body.answers : [];
    const sectionType = body.sectionType;

    if (!testId) {
      return NextResponse.json({ error: "Укажите идентификатор теста." }, { status: 400 });
    }

    if (
      sectionType &&
      sectionType !== TopikSectionType.READING &&
      sectionType !== TopikSectionType.LISTENING
    ) {
      return NextResponse.json({ error: "Некорректный тип секции." }, { status: 400 });
    }

    const test = await prisma.topikTest.findFirst({
      where: { id: testId, isPublished: true },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: {
            blocks: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                order: true,
                displayBeforeQuestionOrder: true,
                variant: true,
                title: true,
                content: true,
              },
            },
            questions: {
              orderBy: { order: "asc" },
              include: {
                choices: true,
              },
            },
          },
        },
      },
    });

    if (!test) {
      return NextResponse.json({ error: "Тест не найден." }, { status: 404 });
    }

    const sectionsToProcess = sectionType
      ? test.sections.filter((section) => section.type === sectionType)
      : test.sections;

    if (!sectionsToProcess.length) {
      return NextResponse.json(
        { error: "Выбранная секция недоступна для этого теста." },
        { status: 400 },
      );
    }

    const validQuestionIds = new Set(
      sectionsToProcess.flatMap((section) => section.questions.map((question) => question.id)),
    );

    const answerMap = new Map<string, string | null>();
    for (const answer of answers) {
      const questionId = answer.questionId?.trim();
      if (!questionId) {
        continue;
      }
      if (!validQuestionIds.has(questionId)) {
        return NextResponse.json({ error: "Ответ содержит некорректный идентификатор вопроса." }, { status: 400 });
      }
      answerMap.set(questionId, answer.choiceId ?? null);
    }

    let totalScore = 0;
    let maxTotalScore = 0;
    let readingScore = 0;
    let maxReadingScore = 0;
    let listeningScore = 0;
    let maxListeningScore = 0;
    const resultSections: {
      id: string;
      title: string;
      type: TopikSectionType;
      order: number;
      durationMinutes: number;
      blocks: {
        id: string;
        order: number;
        displayBeforeQuestionOrder: number;
        variant: "EXAMPLE" | "PASSAGE" | "NOTICE";
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
    }[] = [];

    const answersForCreate: {
      questionId: string;
      choiceId?: string;
      isCorrect: boolean;
    }[] = [];

    for (const section of sectionsToProcess) {
      const resultQuestions: {
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
      }[] = [];

      for (const question of section.questions) {
        maxTotalScore += question.points;
        if (section.type === TopikSectionType.READING) {
          maxReadingScore += question.points;
        } else {
          maxListeningScore += question.points;
        }

        const selectedChoiceId = answerMap.get(question.id) ?? null;
        const selectedChoice = selectedChoiceId
          ? question.choices.find((choice) => choice.id === selectedChoiceId)
          : null;

        if (selectedChoiceId && !selectedChoice) {
          return NextResponse.json({ error: "Выбран некорректный вариант ответа." }, { status: 400 });
        }

        const correctChoice = question.choices.find((choice) => choice.isCorrect);
        const isCorrect = Boolean(correctChoice && selectedChoice?.id === correctChoice.id);
        if (isCorrect) {
          totalScore += question.points;
          if (section.type === TopikSectionType.READING) {
            readingScore += question.points;
          } else {
            listeningScore += question.points;
          }
        }

        answersForCreate.push({
          questionId: question.id,
          choiceId: selectedChoice?.id,
          isCorrect,
        });

        resultQuestions.push({
          id: question.id,
          order: question.order,
          prompt: question.prompt,
          content: question.content,
          contentImageUrl: question.contentImageUrl,
          points: question.points,
          isCorrect,
          selectedChoiceId: selectedChoice?.id ?? null,
          correctChoiceId: correctChoice?.id ?? null,
          choices: question.choices.map((choice) => ({
            id: choice.id,
            order: choice.order,
            text: choice.text,
            imageUrl: choice.imageUrl,
            isCorrect: choice.isCorrect,
            isSelected: choice.id === selectedChoice?.id,
          })),
        });
      }

      resultSections.push({
        id: section.id,
        title: section.title,
        type: section.type,
        order: section.order,
        durationMinutes: section.durationMinutes,
        blocks: section.blocks,
        questions: resultQuestions,
      });
    }

    const feedbackObject = buildTopikAttemptFeedback({
      level: test.level,
      sectionType: sectionType ?? sectionsToProcess[0]?.type ?? null,
      totalScore,
      maxTotalScore,
      sections: resultSections,
    });
    const feedback = JSON.stringify(feedbackObject);

    const attempt = await prisma.topikAttempt.create({
      data: {
        userId: user.id,
        testId: test.id,
        finishedAt: new Date(),
        totalScore,
        maxTotalScore,
        readingScore,
        maxReadingScore,
        listeningScore,
        maxListeningScore,
        feedback,
        answers: {
          create: answersForCreate,
        },
      },
    });

    return NextResponse.json({
      attemptId: attempt.id,
      result: {
        totalScore,
        maxTotalScore,
        readingScore,
        maxReadingScore,
        listeningScore,
        maxListeningScore,
        feedback: feedbackObject,
        sections: resultSections,
      },
    });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить попытку." }, { status: 500 });
  }
}



