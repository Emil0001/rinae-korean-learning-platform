import type { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";

export async function requireAdmin(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return { ok: false as const, status: 401, error: "Не авторизован." };
  }

  if (user.role !== "ADMIN") {
    return { ok: false as const, status: 403, error: "Недостаточно прав." };
  }

  return { ok: true as const, user };
}
