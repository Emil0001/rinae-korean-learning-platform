import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import {
  attachSessionCookie,
  createSession,
  mapToSessionUser,
} from "@/lib/auth/session";
import {
  normalizeCoursePlacementResult,
  type CoursePlacementResultPayload,
} from "@/lib/course-placement-shared";
import { prisma } from "@/lib/prisma";

type SignupBody = {
  name?: string;
  email?: string;
  password?: string;
  coursePlacement?: CoursePlacementResultPayload;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SignupBody;
    const name = body.name?.trim() ?? "";
    const email = normalizeEmail(body.email ?? "");
    const password = body.password ?? "";
    const coursePlacement = normalizeCoursePlacementResult(body.coursePlacement);

    if (name.length < 2) {
      return NextResponse.json(
        { error: "Имя должно содержать минимум 2 символа." },
        { status: 400 },
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Введите корректный email." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Пароль должен быть не короче 8 символов." },
        { status: 400 },
      );
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        coursePlacementLevelNumber:
          coursePlacement?.recommendedLevelNumber,
        coursePlacementLevelSlug:
          coursePlacement?.recommendedLevelSlug,
        coursePlacementCompletedAt: coursePlacement ? new Date() : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        courseAccessEnabled: true,
      },
    });

    const { token, expiresAt } = await createSession(user.id);
    const response = NextResponse.json({ user: mapToSessionUser(user) }, { status: 201 });
    attachSessionCookie(response, token, expiresAt);
    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Ошибка регистрации. Попробуйте снова." },
      { status: 500 },
    );
  }
}
