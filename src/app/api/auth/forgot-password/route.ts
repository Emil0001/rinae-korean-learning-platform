import { NextRequest, NextResponse } from "next/server";
import {
  createPasswordResetToken,
  getUserForPasswordReset,
  markExpiredPasswordResetTokensAsUsed,
  sendPasswordResetEmail,
} from "@/lib/auth/password-reset";

type ForgotPasswordBody = {
  email?: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildGenericSuccessResponse() {
  return NextResponse.json({
    message:
      "Если аккаунт с таким email существует, мы отправили инструкцию для сброса пароля.",
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ForgotPasswordBody;
    const email = normalizeEmail(body.email ?? "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Введите корректный email." }, { status: 400 });
    }

    await markExpiredPasswordResetTokensAsUsed();

    const user = await getUserForPasswordReset(email);
    if (!user) {
      return buildGenericSuccessResponse();
    }

    const { token } = await createPasswordResetToken(user.id);
    await sendPasswordResetEmail(user, token);

    return buildGenericSuccessResponse();
  } catch (error) {
    console.error("Forgot password error", error);

    if (error instanceof Error && error.message === "SMTP_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "Сервис отправки писем временно недоступен. Попробуйте позже." },
        { status: 500 },
      );
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
    ) {
      const code = (error as { code: string }).code;

      if (code === "EAUTH") {
        return NextResponse.json(
          { error: "SMTP авторизация не прошла. Проверьте SMTP_USER, SMTP_PASS и SMTP_FROM в Vercel." },
          { status: 500 },
        );
      }

      if (code === "EENVELOPE") {
        return NextResponse.json(
          { error: "Почтовый сервер отклонил адрес отправителя или получателя." },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      { error: "Не удалось отправить письмо для сброса пароля." },
      { status: 500 },
    );
  }
}
