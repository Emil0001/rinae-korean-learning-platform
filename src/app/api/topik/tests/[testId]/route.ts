import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ testId: string }> | { testId: string };
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { testId } = await context.params;

  try {
    const test = await prisma.topikTest.findFirst({
      where: {
        id: testId,
        isPublished: true,
      },
      select: {
        id: true,
        title: true,
        description: true,
        level: true,
        durationMinutes: true,
        listeningAudioUrl: true,
        sections: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            title: true,
            type: true,
            order: true,
            durationMinutes: true,
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
              select: {
                id: true,
                order: true,
                prompt: true,
                content: true,
                contentImageUrl: true,
                points: true,
                choices: {
                  orderBy: { order: "asc" },
                  select: {
                    id: true,
                    order: true,
                    text: true,
                    imageUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!test) {
      return NextResponse.json({ error: "龜筠?? 戟筠 戟逵橘畇筠戟." }, { status: 404 });
    }

    const payload = {
      id: test.id,
      title: test.title,
      description: test.description,
      level: test.level,
      durationMinutes: test.durationMinutes,
      listeningAudioUrl: test.listeningAudioUrl,
      sections: test.sections.map((section) => ({
        id: section.id,
        title: section.title,
        type: section.type,
        order: section.order,
        durationMinutes: section.durationMinutes,
        blocks: section.blocks,
        questions: section.questions.map((question) => ({
          id: question.id,
          order: question.order,
          prompt: question.prompt,
          content: question.content,
          contentImageUrl: question.contentImageUrl,
          points: question.points,
          choices: question.choices,
        })),
      })),
    };

    return NextResponse.json({ test: payload });
  } catch {
    return NextResponse.json(
      { error: "?筠 ?畇逵剋棘?? 鈞逵均??鈞龜?? ?筠??." },
      { status: 500 },
    );
  }
}


