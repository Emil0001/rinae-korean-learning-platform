import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { del, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";
import { getBlobReadWriteToken, hasBlobReadWriteToken } from "@/lib/vercel-blob";

export const runtime = "nodejs";

const UPLOAD_DIR_RELATIVE = "/uploads/topik-listening";
const UPLOAD_DIR_ABSOLUTE = path.join(
  process.cwd(),
  "public",
  "uploads",
  "topik-listening",
);
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".mp3", ".wav", ".ogg", ".m4a", ".webm"]);
const EXTENSION_BY_MIME = new Map<string, string>([
  ["audio/mpeg", ".mp3"],
  ["audio/mp3", ".mp3"],
  ["audio/wav", ".wav"],
  ["audio/x-wav", ".wav"],
  ["audio/ogg", ".ogg"],
  ["audio/x-m4a", ".m4a"],
  ["audio/mp4", ".m4a"],
  ["audio/webm", ".webm"],
]);

type RouteContext = {
  params: Promise<{ testId: string }> | { testId: string };
};

type ListeningAudioUpdateBody = {
  listeningAudioUrl?: string | null;
};

function resolveExtension(fileName: string, mimeType: string) {
  const extFromName = path.extname(fileName).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(extFromName)) {
    return extFromName;
  }

  const extFromMime = EXTENSION_BY_MIME.get(mimeType.toLowerCase());
  if (extFromMime && ALLOWED_EXTENSIONS.has(extFromMime)) {
    return extFromMime;
  }

  return "";
}

function isManagedAudioPath(url: string) {
  return url.startsWith(`${UPLOAD_DIR_RELATIVE}/`);
}

function hasBlobToken() {
  return hasBlobReadWriteToken();
}

function isManagedBlobAudioUrl(url: string) {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.includes("blob.vercel-storage.com") &&
      parsed.pathname.includes("/topik-listening/")
    );
  } catch {
    return false;
  }
}

async function removeAudioFileIfManaged(url: string | null | undefined) {
  if (!url || !isManagedAudioPath(url)) {
    if (url && hasBlobToken() && isManagedBlobAudioUrl(url)) {
      const token = getBlobReadWriteToken();
      await del(url, token ? { token } : undefined).catch(() => undefined);
    }
    return;
  }

  const relativePublicPath = url.replace(/^\//, "");
  const absolutePath = path.resolve(process.cwd(), "public", relativePublicPath);
  const allowedBasePath = path.resolve(process.cwd(), "public", "uploads", "topik-listening");

  if (!absolutePath.startsWith(allowedBasePath)) {
    return;
  }

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

async function updateListeningAudioUrl(
  testId: string,
  currentListeningAudioUrl: string | null,
  nextFileUrl: string,
) {
  try {
    await prisma.topikTest.update({
      where: { id: testId },
      data: { listeningAudioUrl: nextFileUrl },
    });
  } catch (updateError) {
    await removeAudioFileIfManaged(nextFileUrl);
    throw updateError;
  }

  await removeAudioFileIfManaged(currentListeningAudioUrl);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { testId } = await context.params;

  try {
    const test = await prisma.topikTest.findUnique({
      where: { id: testId },
      select: { id: true, listeningAudioUrl: true },
    });

    if (!test) {
      return NextResponse.json({ error: "Тест не найден." }, { status: 404 });
    }

    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as ListeningAudioUpdateBody;
      const nextFileUrl = body.listeningAudioUrl?.trim() ?? "";

      if (!nextFileUrl || !isManagedBlobAudioUrl(nextFileUrl)) {
        return NextResponse.json(
          { error: "Некорректная ссылка на загруженный аудиофайл." },
          { status: 400 },
        );
      }

      await updateListeningAudioUrl(testId, test.listeningAudioUrl, nextFileUrl);

      return NextResponse.json({
        ok: true,
        listeningAudioUrl: nextFileUrl,
        message: "Аудиофайл успешно загружен.",
      });
    }

    const formData = await request.formData();
    const rawFile = formData.get("file");

    if (!(rawFile instanceof File)) {
      return NextResponse.json({ error: "Не найден аудиофайл для загрузки." }, { status: 400 });
    }

    if (rawFile.size <= 0) {
      return NextResponse.json({ error: "Файл пустой." }, { status: 400 });
    }

    if (rawFile.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Файл слишком большой. Максимальный размер: 25 МБ." },
        { status: 400 },
      );
    }

    const extension = resolveExtension(rawFile.name, rawFile.type);
    if (!extension) {
      return NextResponse.json(
        { error: "Неподдерживаемый формат аудио. Используйте MP3, WAV, OGG, M4A или WEBM." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await rawFile.arrayBuffer());
    const nextFileName = `${testId}-${Date.now()}-${randomUUID()}${extension}`;
    let nextFileUrl = `${UPLOAD_DIR_RELATIVE}/${nextFileName}`;

    if (hasBlobToken()) {
      const token = getBlobReadWriteToken();
      const blob = await put(`topik-listening/${nextFileName}`, buffer, {
        access: "public",
        contentType: rawFile.type || "application/octet-stream",
        ...(token ? { token } : {}),
      });

      nextFileUrl = blob.url;
    } else {
      await fs.mkdir(UPLOAD_DIR_ABSOLUTE, { recursive: true });
      const nextFilePath = path.join(UPLOAD_DIR_ABSOLUTE, nextFileName);
      await fs.writeFile(nextFilePath, buffer);
    }

    await updateListeningAudioUrl(testId, test.listeningAudioUrl, nextFileUrl);

    return NextResponse.json({
      ok: true,
      listeningAudioUrl: nextFileUrl,
      message: "Аудиофайл успешно загружен.",
    });
  } catch {
    return NextResponse.json(
      { error: "Не удалось загрузить аудиофайл. Попробуйте еще раз." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { testId } = await context.params;

  try {
    const test = await prisma.topikTest.findUnique({
      where: { id: testId },
      select: { id: true, listeningAudioUrl: true },
    });

    if (!test) {
      return NextResponse.json({ error: "Тест не найден." }, { status: 404 });
    }

    await prisma.topikTest.update({
      where: { id: testId },
      data: { listeningAudioUrl: null },
    });

    await removeAudioFileIfManaged(test.listeningAudioUrl);

    return NextResponse.json({ ok: true, listeningAudioUrl: null });
  } catch {
    return NextResponse.json(
      { error: "Не удалось удалить аудиофайл." },
      { status: 500 },
    );
  }
}
