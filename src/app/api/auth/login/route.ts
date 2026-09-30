import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import {
  attachSessionCookie,
  createSession,
  mapToSessionUser,
} from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type LoginBody = {
  email?: string;
  password?: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LoginBody;
    const email = normalizeEmail(body.email ?? "");
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json({ error: "Введите email и пароль." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        courseAccessEnabled: true,
        passwordHash: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Неверный email или пароль." }, { status: 401 });
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json({ error: "Неверный email или пароль." }, { status: 401 });
    }

    const { token, expiresAt } = await createSession(user.id);
    const response = NextResponse.json({
      user: mapToSessionUser(user),
    });
    attachSessionCookie(response, token, expiresAt);
    return response;
  } catch {
    return NextResponse.json({ error: "Ошибка входа. Попробуйте снова." }, { status: 500 });
  }
}
