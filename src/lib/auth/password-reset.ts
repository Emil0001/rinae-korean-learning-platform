import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

type PasswordResetRow = {
  id: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
};

type PasswordResetUser = {
  id: string;
  name: string;
  email: string;
};

const parsedResetMinutes = Number(process.env.PASSWORD_RESET_TTL_MINUTES ?? "60");
const PASSWORD_RESET_TTL_MINUTES =
  Number.isFinite(parsedResetMinutes) && parsedResetMinutes > 0 ? parsedResetMinutes : 60;

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getResetExpiryDate() {
  return new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);
}

function cryptoRandomId() {
  return randomBytes(18).toString("hex");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function createPasswordResetToken(userId: string) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  const expiresAt = getResetExpiryDate();

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "PasswordResetToken"
      SET "usedAt" = NOW()
      WHERE "userId" = ${userId}
        AND "usedAt" IS NULL
    `;

    await tx.$executeRaw`
      INSERT INTO "PasswordResetToken" ("id", "tokenHash", "userId", "expiresAt", "createdAt")
      VALUES (${cryptoRandomId()}, ${tokenHash}, ${userId}, ${expiresAt}, NOW())
    `;
  });

  return { token, expiresAt };
}

export async function getUserForPasswordReset(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
}

export async function resetPasswordWithToken(token: string, nextPassword: string) {
  const tokenHash = hashResetToken(token);

  const resetToken = await prisma.$queryRaw<PasswordResetRow[]>`
    SELECT "id", "userId", "expiresAt", "usedAt"
    FROM "PasswordResetToken"
    WHERE "tokenHash" = ${tokenHash}
    LIMIT 1
  `;

  const record = resetToken[0];

  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    return { ok: false as const, reason: "invalid" as const };
  }

  const passwordHash = await hashPassword(nextPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    });

    await tx.session.deleteMany({
      where: { userId: record.userId },
    });

    await tx.$executeRaw`
      UPDATE "PasswordResetToken"
      SET "usedAt" = NOW()
      WHERE "id" = ${record.id}
    `;
  });

  return { ok: true as const };
}

export async function markExpiredPasswordResetTokensAsUsed() {
  await prisma.$executeRaw`
    UPDATE "PasswordResetToken"
    SET "usedAt" = NOW()
    WHERE "usedAt" IS NULL
      AND "expiresAt" <= NOW()
  `;
}

export function buildPasswordResetUrl(token: string) {
  const appUrl =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  return `${appUrl.replace(/\/+$/, "")}/auth/reset-password?token=${encodeURIComponent(token)}`;
}

export async function sendPasswordResetEmail(user: PasswordResetUser, token: string) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpHost = process.env.SMTP_HOST ?? "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT ?? "465");
  const smtpSecure =
    process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === "true"
      : smtpPort === 465;

  if (!smtpUser || !smtpPass) {
    throw new Error("SMTP_NOT_CONFIGURED");
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const resetUrl = buildPasswordResetUrl(token);
  const fromEmail = process.env.SMTP_FROM ?? smtpUser;

  await transporter.sendMail({
    from: fromEmail,
    to: user.email,
    subject: "Сброс пароля Rinae Korean",
    text: [
      `Здравствуйте, ${user.name}!`,
      "",
      "Мы получили запрос на сброс пароля.",
      "Чтобы задать новый пароль, откройте ссылку ниже:",
      resetUrl,
      "",
      `Ссылка действует ${PASSWORD_RESET_TTL_MINUTES} минут.`,
      "Если это были не вы, просто проигнорируйте это письмо.",
    ].join("\n"),
    html: `
      <p>Здравствуйте, <strong>${escapeHtml(user.name)}</strong>!</p>
      <p>Мы получили запрос на сброс пароля.</p>
      <p><a href="${escapeHtml(resetUrl)}">Открыть страницу сброса пароля</a></p>
      <p>Ссылка действует ${PASSWORD_RESET_TTL_MINUTES} минут.</p>
      <p>Если это были не вы, просто проигнорируйте это письмо.</p>
    `,
  });
}
