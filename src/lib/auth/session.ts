import { createHash, randomBytes } from "node:crypto";
import type { UserRole } from "@prisma/client";
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE_NAME = "rinae_session";
const parsedSessionDays = Number(process.env.SESSION_TTL_DAYS ?? "30");
const SESSION_TTL_DAYS =
  Number.isFinite(parsedSessionDays) && parsedSessionDays > 0
    ? parsedSessionDays
    : 30;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  courseAccessEnabled: boolean;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function mapToSessionUser(user: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  courseAccessEnabled: boolean;
}): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    courseAccessEnabled: user.courseAccessEnabled,
  };
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = addDays(new Date(), SESSION_TTL_DAYS);

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function getUserFromSessionToken(sessionToken: string | null | undefined) {
  if (!sessionToken) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: {
      tokenHash: hashToken(sessionToken),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          courseAccessEnabled: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  return mapToSessionUser(session.user);
}

export async function getUserFromRequest(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return getUserFromSessionToken(sessionToken);
}

export async function deleteSessionFromRequest(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return;
  }

  await prisma.session
    .deleteMany({
      where: {
        tokenHash: hashToken(sessionToken),
      },
    })
    .catch(() => undefined);
}

export function attachSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date,
) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}
