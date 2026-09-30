import { NextRequest, NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/auth/password-reset";

type ResetPasswordBody = {
  token?: string;
  password?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ResetPasswordBody;
    const token = body.token?.trim() ?? "";
    const password = body.password ?? "";

    if (!token) {
      return NextResponse.json({ error: "Ссылка для сброса пароля недействительна." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Пароль должен содержать минимум 8 символов." },
        { status: 400 },
      );
    }

    const result = await resetPasswordWithToken(token, password);
    if (!result.ok) {
      return NextResponse.json(
        { error: "Ссылка для сброса пароля недействительна или уже истекла." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      message: "Пароль обновлён. Теперь можно войти с новым паролем.",
    });
  } catch {
    return NextResponse.json(
      { error: "Не удалось обновить пароль. Попробуйте ещё раз." },
      { status: 500 },
    );
  }
}
