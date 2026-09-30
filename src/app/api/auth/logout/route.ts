import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, deleteSessionFromRequest } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  await deleteSessionFromRequest(request);

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
