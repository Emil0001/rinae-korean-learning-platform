import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { getVocabularySession, saveVocabularyPreferences } from "@/lib/vocabulary-service";
import type { VocabularyLevel } from "@/lib/vocabulary";

type PreferencesBody = {
  dailyGoal?: number;
  level?: VocabularyLevel;
};

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
  }

  try {
    const session = await getVocabularySession(user.id);
    return NextResponse.json(session);
  } catch {
    return NextResponse.json(
      { error: "Не удалось загрузить словарь. Попробуйте ещё раз." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as PreferencesBody;
    if (typeof body.dailyGoal !== "number" || !body.level) {
      return NextResponse.json({ error: "Выбери цель и уровень словаря." }, { status: 400 });
    }

    const session = await saveVocabularyPreferences(user.id, {
      dailyGoal: body.dailyGoal,
      level: body.level,
    });
    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось сохранить настройки словаря." },
      { status: 400 },
    );
  }
}
