import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const tests = await prisma.topikTest.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
      include: {
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

    const payload = tests.map((test) => {
      const sections = test.sections.map((section) => ({
        id: section.id,
        type: section.type,
        title: section.title,
        order: section.order,
        durationMinutes: section.durationMinutes,
        questionCount: section._count.questions,
      }));

      const totalQuestions = sections.reduce(
        (sum, section) => sum + section.questionCount,
        0,
      );

      return {
        id: test.id,
        title: test.title,
        description: test.description,
        level: test.level,
        durationMinutes: test.durationMinutes,
        totalQuestions,
        sections,
      };
    });

    return NextResponse.json({ tests: payload });
  } catch {
    return NextResponse.json(
      { error: "Не удалось загрузить список тестов." },
      { status: 500 },
    );
  }
}
