import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

type ContactBody = {
  name?: string;
  email?: string;
  phone?: string;
  preferredFormat?: string;
};

function normalizeValue(value?: string) {
  return value?.trim() ?? "";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ContactBody;
    const name = normalizeValue(body.name);
    const email = normalizeValue(body.email).toLowerCase();
    const phone = normalizeValue(body.phone);
    const preferredFormat = normalizeValue(body.preferredFormat);

    if (name.length < 2) {
      return NextResponse.json(
        { error: "Укажите корректное имя (минимум 2 символа)." },
        { status: 400 },
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Укажите корректный email." },
        { status: 400 },
      );
    }

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const toEmail = process.env.CONTACT_TO_EMAIL?.trim();
    const smtpHost = process.env.SMTP_HOST ?? "smtp.gmail.com";
    const smtpPort = Number(process.env.SMTP_PORT ?? "465");
    const smtpSecure =
      process.env.SMTP_SECURE !== undefined
        ? process.env.SMTP_SECURE === "true"
        : smtpPort === 465;

    if (!smtpUser || !smtpPass || !toEmail) {
      return NextResponse.json(
        { error: "Почтовый сервис временно не настроен. Попробуйте позже." },
        { status: 500 },
      );
    }

    const fromEmail = process.env.SMTP_FROM ?? smtpUser;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safePhone = escapeHtml(phone || "Не указан");
    const safePreferredFormat = escapeHtml(preferredFormat || "Не указан");

    await transporter.sendMail({
      from: fromEmail,
      to: toEmail,
      replyTo: email,
      subject: `Новая заявка с сайта: ${name}`,
      text: [
        "Новая заявка с сайта Rinae Korean",
        "",
        `Имя: ${name}`,
        `Email: ${email}`,
        `Телефон: ${phone || "Не указан"}`,
        `Формат обучения: ${preferredFormat || "Не указан"}`,
      ].join("\n"),
      html: `
        <h2>Новая заявка с сайта Rinae Korean</h2>
        <p><strong>Имя:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Телефон:</strong> ${safePhone}</p>
        <p><strong>Формат обучения:</strong> ${safePreferredFormat}</p>
      `,
    });

    return NextResponse.json({
      message: "Заявка отправлена. Скоро свяжемся с вами.",
    });
  } catch {
    return NextResponse.json(
      { error: "Ошибка отправки заявки. Попробуйте еще раз." },
      { status: 500 },
    );
  }
}
