import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { del, put } from "@vercel/blob";
import { getBlobReadWriteToken, hasBlobReadWriteToken } from "@/lib/vercel-blob";

const UPLOAD_DIR_RELATIVE = "/uploads/topik-question-images";
const UPLOAD_DIR_ABSOLUTE = path.join(
  process.cwd(),
  "public",
  "uploads",
  "topik-question-images",
);

const ALLOWED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
]);

const EXTENSION_BY_MIME = new Map<string, string>([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/jpg", ".jpg"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
  ["image/svg+xml", ".svg"],
]);

type ImageCarrier = {
  contentImageUrl: string | null;
};

type ChoiceImageCarrier = {
  imageUrl: string | null;
};

function isReadOnlyFsError(error: unknown) {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "EROFS" || code === "EPERM";
}

function hasBlobToken() {
  return hasBlobReadWriteToken();
}

function isManagedBlobQuestionImageUrl(url: string) {
  try {
    return new URL(url).hostname.includes("blob.vercel-storage.com");
  } catch {
    return false;
  }
}

function extractDataUrlParts(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  const mimeType = match[1].toLowerCase();
  const base64Payload = match[2];
  const extension = EXTENSION_BY_MIME.get(mimeType);

  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
    return null;
  }

  return {
    mimeType,
    extension,
    buffer: Buffer.from(base64Payload, "base64"),
  };
}

export function isManagedQuestionImagePath(url: string) {
  return url.startsWith(`${UPLOAD_DIR_RELATIVE}/`);
}

export function collectManagedQuestionImageUrls<
  TSection extends { questions: TQuestion[] },
  TQuestion extends ImageCarrier & { choices?: TChoice[] },
  TChoice extends ChoiceImageCarrier,
>(sections: TSection[]) {
  const urls = new Set<string>();

  for (const section of sections) {
    for (const question of section.questions) {
      if (question.contentImageUrl && isManagedQuestionImagePath(question.contentImageUrl)) {
        urls.add(question.contentImageUrl);
      }

      for (const choice of question.choices ?? []) {
        if (choice.imageUrl && isManagedQuestionImagePath(choice.imageUrl)) {
          urls.add(choice.imageUrl);
        }
      }
    }
  }

  return urls;
}

export async function removeQuestionImageIfManaged(url: string | null | undefined) {
  if (!url || !isManagedQuestionImagePath(url)) {
    if (url && hasBlobToken() && isManagedBlobQuestionImageUrl(url)) {
      const token = getBlobReadWriteToken();
      await del(url, token ? { token } : undefined).catch(() => undefined);
    }
    return;
  }

  const relativePublicPath = url.replace(/^\//, "");
  const absolutePath = path.resolve(process.cwd(), "public", relativePublicPath);
  const allowedBasePath = path.resolve(
    process.cwd(),
    "public",
    "uploads",
    "topik-question-images",
  );

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

async function persistQuestionImageReference(imageRef: string | null, testId: string) {
  const trimmed = imageRef?.trim() ?? "";
  if (!trimmed) {
    return { url: null, savedUrl: null as string | null };
  }

  if (!trimmed.startsWith("data:")) {
    return { url: trimmed, savedUrl: null as string | null };
  }

  const parsed = extractDataUrlParts(trimmed);
  if (!parsed) {
    throw new Error("Неподдерживаемый формат изображения вопроса.");
  }

  if (hasBlobToken()) {
    const token = getBlobReadWriteToken();
    const blob = await put(
      `topik-question-images/${testId}-${Date.now()}-${randomUUID()}${parsed.extension}`,
      parsed.buffer,
      {
        access: "public",
        contentType: parsed.mimeType,
        ...(token ? { token } : {}),
      },
    );

    return { url: blob.url, savedUrl: blob.url };
  }

  try {
    await fs.mkdir(UPLOAD_DIR_ABSOLUTE, { recursive: true });

    const fileName = `${testId}-${Date.now()}-${randomUUID()}${parsed.extension}`;
    const filePath = path.join(UPLOAD_DIR_ABSOLUTE, fileName);
    const fileUrl = `${UPLOAD_DIR_RELATIVE}/${fileName}`;

    await fs.writeFile(filePath, parsed.buffer);

    return { url: fileUrl, savedUrl: fileUrl };
  } catch (error) {
    // Serverless deployments can expose a read-only app filesystem.
    // In that case we keep the image inline as a data URL in the database.
    if (isReadOnlyFsError(error)) {
      return { url: trimmed, savedUrl: null as string | null };
    }

    throw error;
  }
}

export async function persistQuestionImagesForSections<
  TSection extends { questions: TQuestion[] },
  TQuestion extends ImageCarrier & { choices: TChoice[] },
  TChoice extends ChoiceImageCarrier,
>(sections: TSection[], testId: string) {
  const savedUrls: string[] = [];

  const nextSections = await Promise.all(
    sections.map(async (section) => ({
      ...section,
      questions: await Promise.all(
        section.questions.map(async (question) => {
          const persistedQuestionImage = await persistQuestionImageReference(
            question.contentImageUrl,
            testId,
          );

          if (persistedQuestionImage.savedUrl) {
            savedUrls.push(persistedQuestionImage.savedUrl);
          }

          const nextChoices = await Promise.all(
            question.choices.map(async (choice) => {
              const persistedChoiceImage = await persistQuestionImageReference(
                choice.imageUrl,
                testId,
              );

              if (persistedChoiceImage.savedUrl) {
                savedUrls.push(persistedChoiceImage.savedUrl);
              }

              return {
                ...choice,
                imageUrl: persistedChoiceImage.url,
              };
            }),
          );

          return {
            ...question,
            contentImageUrl: persistedQuestionImage.url,
            choices: nextChoices,
          };
        }),
      ),
    })),
  );

  return {
    sections: nextSections,
    savedUrls,
  };
}
