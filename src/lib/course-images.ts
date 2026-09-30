import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { del, put } from "@vercel/blob";
import { getBlobReadWriteToken, hasBlobReadWriteToken } from "@/lib/vercel-blob";
import {
  extractLessonChoiceExercises,
  replaceLessonChoiceExercise,
} from "@/lib/lesson-choice-exercise";

const UPLOAD_DIR_RELATIVE = "/uploads/course-images";
const UPLOAD_DIR_ABSOLUTE = path.join(process.cwd(), "public", "uploads", "course-images");
const AUDIO_UPLOAD_DIR_RELATIVE = "/uploads/course-audio";
const AUDIO_UPLOAD_DIR_ABSOLUTE = path.join(process.cwd(), "public", "uploads", "course-audio");

const EXTENSION_BY_MIME = new Map<string, string>([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/jpg", ".jpg"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
  ["image/svg+xml", ".svg"],
]);

const AUDIO_EXTENSION_BY_MIME = new Map<string, string>([
  ["audio/mpeg", ".mp3"],
  ["audio/mp3", ".mp3"],
  ["audio/wav", ".wav"],
  ["audio/x-wav", ".wav"],
  ["audio/ogg", ".ogg"],
  ["audio/webm", ".webm"],
  ["audio/mp4", ".m4a"],
  ["audio/x-m4a", ".m4a"],
]);

const CONTENT_IMAGE_MARKDOWN_PATTERN = /!\[([^\]]*)\]\(([^)]+)\)(?:\{mobile=([^}]+)\})?(?:\{(mobile-hidden)\})?/g;
const CONTENT_AUDIO_MARKDOWN_PATTERN = /\[audio(?::([^\]]*))?\]\(([^)]+)\)/g;
const STEP_IMAGE_POSITION_TOKEN = /^\[\[step-image-position:(top|bottom)\]\]\s*/i;

type StepLike = { imageUrl: string | null; content: string };
type LessonLike = { imageUrl: string | null; steps: StepLike[] };
type UnitLike = { imageUrl: string | null; lessons: LessonLike[] };
type LevelLike = { units: UnitLike[] };

function isReadOnlyFsError(error: unknown) {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "EROFS" || code === "EPERM";
}

function isManagedBlobUrl(url: string) {
  try {
    return new URL(url).hostname.includes("blob.vercel-storage.com");
  } catch {
    return false;
  }
}

function parseDataUrl(value: string, extensionByMime = EXTENSION_BY_MIME) {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  const mimeType = match[1].toLowerCase();
  const extension = extensionByMime.get(mimeType);
  if (!extension) {
    return null;
  }

  return {
    mimeType,
    extension,
    buffer: Buffer.from(match[2], "base64"),
  };
}

export function isManagedCourseImagePath(url: string) {
  return url.startsWith(`${UPLOAD_DIR_RELATIVE}/`);
}

function isManagedCourseAudioPath(url: string) {
  return url.startsWith(`${AUDIO_UPLOAD_DIR_RELATIVE}/`);
}

function isManagedCourseImageUrl(url: string) {
  return isManagedCourseImagePath(url) || isManagedBlobUrl(url);
}

function isManagedCourseMediaUrl(url: string) {
  return isManagedCourseImagePath(url) || isManagedCourseAudioPath(url) || isManagedBlobUrl(url);
}

function collectManagedContentImageUrls(content: string) {
  const urls = new Set<string>();

  for (const match of content.matchAll(CONTENT_IMAGE_MARKDOWN_PATTERN)) {
    const desktopUrl = match[2]?.trim();
    const mobileUrls = (match[3] ?? "")
      .split("|")
      .map((url) => url.trim())
      .filter(Boolean);
    if (desktopUrl && isManagedCourseImageUrl(desktopUrl)) {
      urls.add(desktopUrl);
    }
    for (const mobileUrl of mobileUrls) {
      if (isManagedCourseImageUrl(mobileUrl)) {
        urls.add(mobileUrl);
      }
    }
  }

  return urls;
}

function collectManagedContentAudioUrls(content: string) {
  const urls = new Set<string>();

  for (const match of content.matchAll(CONTENT_AUDIO_MARKDOWN_PATTERN)) {
    const url = match[2]?.trim();
    if (url && isManagedCourseMediaUrl(url)) {
      urls.add(url);
    }
  }

  return urls;
}

function parsePracticeContent(content: string) {
  const body = content.replace(STEP_IMAGE_POSITION_TOKEN, "").trim();
  if (!body.startsWith("{")) {
    return null;
  }

  try {
    const parsed = JSON.parse(body) as {
      exercises?: Array<Record<string, unknown>>;
    };

    return Array.isArray(parsed.exercises) ? parsed : null;
  } catch {
    return null;
  }
}

function collectManagedPracticeMediaUrls(content: string) {
  const urls = new Set<string>();
  const parsed = parsePracticeContent(content);
  if (!parsed) {
    return urls;
  }

  for (const exercise of parsed.exercises ?? []) {
    for (const key of ["imageUrl", "mobileImageUrl", "audioUrl"] as const) {
      const value = exercise[key];
      if (typeof value === "string" && isManagedCourseMediaUrl(value)) {
        urls.add(value);
      }
    }
    if (Array.isArray(exercise.mobileImageUrls)) {
      for (const mobileImageUrl of exercise.mobileImageUrls) {
        if (typeof mobileImageUrl === "string" && isManagedCourseMediaUrl(mobileImageUrl)) {
          urls.add(mobileImageUrl);
        }
      }
    }
  }

  return urls;
}

function collectManagedLessonChoiceMediaUrls(content: string) {
  const urls = new Set<string>();

  for (const exercise of extractLessonChoiceExercises(content)) {
    for (const value of [exercise.imageUrl, exercise.mobileImageUrl, exercise.audioUrl]) {
      if (value && isManagedCourseMediaUrl(value)) {
        urls.add(value);
      }
    }
  }

  return urls;
}

export function collectManagedCourseImageUrls<TLevel extends LevelLike>(levels: TLevel[]) {
  const urls = new Set<string>();

  for (const level of levels) {
    for (const unit of level.units) {
      if (unit.imageUrl && isManagedCourseMediaUrl(unit.imageUrl)) {
        urls.add(unit.imageUrl);
      }

      for (const lesson of unit.lessons) {
        if (lesson.imageUrl && isManagedCourseMediaUrl(lesson.imageUrl)) {
          urls.add(lesson.imageUrl);
        }

        for (const step of lesson.steps) {
          if (step.imageUrl && isManagedCourseMediaUrl(step.imageUrl)) {
            urls.add(step.imageUrl);
          }

          for (const contentImageUrl of collectManagedContentImageUrls(step.content)) {
            urls.add(contentImageUrl);
          }

          for (const contentAudioUrl of collectManagedContentAudioUrls(step.content)) {
            urls.add(contentAudioUrl);
          }

          for (const practiceMediaUrl of collectManagedPracticeMediaUrls(step.content)) {
            urls.add(practiceMediaUrl);
          }

          for (const lessonChoiceMediaUrl of collectManagedLessonChoiceMediaUrls(step.content)) {
            urls.add(lessonChoiceMediaUrl);
          }
        }
      }
    }
  }

  return urls;
}

export async function removeCourseImageIfManaged(url: string | null | undefined) {
  if (!url) {
    return;
  }

  const isLocalImage = isManagedCourseImagePath(url);
  const isLocalAudio = isManagedCourseAudioPath(url);

  if (!isLocalImage && !isLocalAudio) {
    if (hasBlobReadWriteToken() && isManagedBlobUrl(url)) {
      const token = getBlobReadWriteToken();
      await del(url, token ? { token } : undefined).catch(() => undefined);
    }
    return;
  }

  const relativePublicPath = url.replace(/^\//, "");
  const absolutePath = path.resolve(process.cwd(), "public", relativePublicPath);
  const allowedBasePath = isLocalAudio
    ? path.resolve(process.cwd(), "public", "uploads", "course-audio")
    : path.resolve(process.cwd(), "public", "uploads", "course-images");

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

async function persistImage(imageRef: string | null, scope: string) {
  const trimmed = imageRef?.trim() ?? "";
  if (!trimmed) {
    return { url: null, savedUrl: null as string | null };
  }

  if (!trimmed.startsWith("data:")) {
    return { url: trimmed, savedUrl: null as string | null };
  }

  const parsed = parseDataUrl(trimmed);
  if (!parsed) {
    throw new Error("Unsupported course image format.");
  }

  const fileName = `${scope}-${Date.now()}-${randomUUID()}${parsed.extension}`;

  if (hasBlobReadWriteToken()) {
    const token = getBlobReadWriteToken();
    const blob = await put(`course-images/${fileName}`, parsed.buffer, {
      access: "public",
      contentType: parsed.mimeType,
      ...(token ? { token } : {}),
    });

    return { url: blob.url, savedUrl: blob.url };
  }

  try {
    await fs.mkdir(UPLOAD_DIR_ABSOLUTE, { recursive: true });
    const filePath = path.join(UPLOAD_DIR_ABSOLUTE, fileName);
    const fileUrl = `${UPLOAD_DIR_RELATIVE}/${fileName}`;
    await fs.writeFile(filePath, parsed.buffer);
    return { url: fileUrl, savedUrl: fileUrl };
  } catch (error) {
    if (isReadOnlyFsError(error)) {
      return { url: trimmed, savedUrl: null as string | null };
    }

    throw error;
  }
}

async function persistAudio(audioRef: string, scope: string) {
  const trimmed = audioRef.trim();
  if (!trimmed) {
    return { url: "", savedUrl: null as string | null };
  }

  if (!trimmed.startsWith("data:")) {
    return { url: trimmed, savedUrl: null as string | null };
  }

  const parsed = parseDataUrl(trimmed, AUDIO_EXTENSION_BY_MIME);
  if (!parsed) {
    throw new Error("Unsupported course audio format.");
  }

  const fileName = `${scope}-${Date.now()}-${randomUUID()}${parsed.extension}`;

  if (hasBlobReadWriteToken()) {
    const token = getBlobReadWriteToken();
    const blob = await put(`course-audio/${fileName}`, parsed.buffer, {
      access: "public",
      contentType: parsed.mimeType,
      ...(token ? { token } : {}),
    });

    return { url: blob.url, savedUrl: blob.url };
  }

  try {
    await fs.mkdir(AUDIO_UPLOAD_DIR_ABSOLUTE, { recursive: true });
    const filePath = path.join(AUDIO_UPLOAD_DIR_ABSOLUTE, fileName);
    const fileUrl = `${AUDIO_UPLOAD_DIR_RELATIVE}/${fileName}`;
    await fs.writeFile(filePath, parsed.buffer);
    return { url: fileUrl, savedUrl: fileUrl };
  } catch (error) {
    if (isReadOnlyFsError(error)) {
      return { url: trimmed, savedUrl: null as string | null };
    }

    throw error;
  }
}

async function persistContentImages(content: string, scope: string, savedUrls: string[]) {
  const matches = [...content.matchAll(CONTENT_IMAGE_MARKDOWN_PATTERN)];
  if (matches.length === 0) {
    return content;
  }

  let result = "";
  let lastIndex = 0;

  for (const [matchIndex, match] of matches.entries()) {
    const startIndex = match.index ?? 0;
    const fullMatch = match[0];
    const alt = match[1] ?? "";
    const desktopRef = match[2]?.trim() ?? "";
    const mobileHidden = match[4] === "mobile-hidden";
    const mobileRefs = (match[3] ?? "")
      .split("|")
      .map((url) => url.trim())
      .filter(Boolean);
    const persistedDesktopImage = await persistImage(
      desktopRef,
      `${scope}-content-${matchIndex + 1}-desktop`,
    );
    const persistedMobileImages = await Promise.all(
      mobileRefs.map((mobileRef, mobileIndex) =>
        persistImage(
          mobileRef,
          `${scope}-content-${matchIndex + 1}-mobile-${mobileIndex + 1}`,
        ),
      ),
    );

    if (persistedDesktopImage.savedUrl) {
      savedUrls.push(persistedDesktopImage.savedUrl);
    }
    for (const persistedMobileImage of persistedMobileImages) {
      if (persistedMobileImage.savedUrl) {
        savedUrls.push(persistedMobileImage.savedUrl);
      }
    }

    result += content.slice(lastIndex, startIndex);
    result += `![${alt}](${persistedDesktopImage.url ?? desktopRef})`;
    if (mobileRefs.length > 0) {
      result += `{mobile=${persistedMobileImages.map((image, mobileIndex) => image.url ?? mobileRefs[mobileIndex]).join("|")}}`;
    }
    if (mobileHidden) {
      result += "{mobile-hidden}";
    }
    lastIndex = startIndex + fullMatch.length;
  }

  return `${result}${content.slice(lastIndex)}`;
}

async function persistContentAudio(content: string, scope: string, savedUrls: string[]) {
  const matches = [...content.matchAll(CONTENT_AUDIO_MARKDOWN_PATTERN)];
  if (matches.length === 0) {
    return content;
  }

  let result = "";
  let lastIndex = 0;

  for (const [matchIndex, match] of matches.entries()) {
    const startIndex = match.index ?? 0;
    const fullMatch = match[0];
    const label = match[1]?.trim() ?? "";
    const audioRef = match[2]?.trim() ?? "";
    const persistedAudio = await persistAudio(audioRef, `${scope}-audio-${matchIndex + 1}`);

    if (persistedAudio.savedUrl) {
      savedUrls.push(persistedAudio.savedUrl);
    }

    result += content.slice(lastIndex, startIndex);
    result += `[audio${label ? `:${label}` : ""}](${persistedAudio.url || audioRef})`;
    lastIndex = startIndex + fullMatch.length;
  }

  return `${result}${content.slice(lastIndex)}`;
}

async function persistPracticeMedia(content: string, scope: string, savedUrls: string[]) {
  const parsed = parsePracticeContent(content);
  if (!parsed) {
    return content;
  }

  for (const [exerciseIndex, exercise] of (parsed.exercises ?? []).entries()) {
    const desktopValue = exercise.imageUrl;
    if (typeof desktopValue === "string" && desktopValue.trim()) {
      const persistedDesktopImage = await persistImage(
        desktopValue,
        `${scope}-practice-${exerciseIndex + 1}-desktop`,
      );
      exercise.imageUrl = persistedDesktopImage.url ?? "";
      if (persistedDesktopImage.savedUrl) {
        savedUrls.push(persistedDesktopImage.savedUrl);
      }
    }

    const legacyMobileValue = typeof exercise.mobileImageUrl === "string"
      ? exercise.mobileImageUrl.trim()
      : "";
    const mobileValues = Array.isArray(exercise.mobileImageUrls)
      ? exercise.mobileImageUrls.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
      : legacyMobileValue
        ? [legacyMobileValue]
        : [];
    const persistedMobileImages = await Promise.all(
      mobileValues.map((value, mobileIndex) =>
        persistImage(value, `${scope}-practice-${exerciseIndex + 1}-mobile-${mobileIndex + 1}`),
      ),
    );
    exercise.mobileImageUrls = persistedMobileImages.map((image) => image.url ?? "");
    delete exercise.mobileImageUrl;
    for (const persistedMobileImage of persistedMobileImages) {
      if (persistedMobileImage.savedUrl) {
        savedUrls.push(persistedMobileImage.savedUrl);
      }
    }

    const audioValue = exercise.audioUrl;
    if (typeof audioValue === "string" && audioValue.trim()) {
      const persistedExerciseAudio = await persistAudio(
        audioValue,
        `${scope}-practice-${exerciseIndex + 1}-audio`,
      );
      exercise.audioUrl = persistedExerciseAudio.url;
      if (persistedExerciseAudio.savedUrl) {
        savedUrls.push(persistedExerciseAudio.savedUrl);
      }
    }
  }

  const serialized = JSON.stringify(parsed, null, 2);
  return content.match(STEP_IMAGE_POSITION_TOKEN)?.[1]?.toLowerCase() === "bottom"
    ? `[[step-image-position:bottom]]\n\n${serialized}`
    : serialized;
}

async function persistLessonChoiceMedia(content: string, scope: string, savedUrls: string[]) {
  const exercises = extractLessonChoiceExercises(content);
  let nextContent = content;

  for (const [exerciseIndex, exercise] of exercises.entries()) {
    const persistedImage = await persistImage(
      exercise.imageUrl,
      `${scope}-choice-${exerciseIndex + 1}-desktop`,
    );
    const persistedMobileImage = await persistImage(
      exercise.mobileImageUrl,
      `${scope}-choice-${exerciseIndex + 1}-mobile`,
    );
    const persistedAudio = await persistAudio(
      exercise.audioUrl,
      `${scope}-choice-${exerciseIndex + 1}-audio`,
    );

    for (const savedUrl of [persistedImage.savedUrl, persistedMobileImage.savedUrl, persistedAudio.savedUrl]) {
      if (savedUrl) {
        savedUrls.push(savedUrl);
      }
    }

    nextContent = replaceLessonChoiceExercise(nextContent, exerciseIndex, {
      ...exercise,
      imageUrl: persistedImage.url ?? "",
      mobileImageUrl: persistedMobileImage.url ?? "",
      audioUrl: persistedAudio.url,
    });
  }

  return nextContent;
}

export async function persistCourseImagesForLevels<
  TLevel extends { slug: string; units: TUnit[] },
  TUnit extends { slug: string; imageUrl: string | null; lessons: TLesson[] },
  TLesson extends { slug: string; imageUrl: string | null; steps: TStep[] },
  TStep extends { imageUrl: string | null; content: string },
>(levels: TLevel[]) {
  const savedUrls: string[] = [];

  const nextLevels = await Promise.all(
    levels.map(async (level, levelIndex) => ({
      ...level,
      units: await Promise.all(
        level.units.map(async (unit, unitIndex) => {
          const persistedUnitImage = await persistImage(
            unit.imageUrl,
            `${level.slug}-unit-${unit.slug || unitIndex + 1}`,
          );

          if (persistedUnitImage.savedUrl) {
            savedUrls.push(persistedUnitImage.savedUrl);
          }

          return {
            ...unit,
            imageUrl: persistedUnitImage.url,
            lessons: await Promise.all(
              unit.lessons.map(async (lesson, lessonIndex) => {
                const persistedLessonImage = await persistImage(
                  lesson.imageUrl,
                  `${level.slug}-lesson-${lesson.slug || lessonIndex + 1}`,
                );

                if (persistedLessonImage.savedUrl) {
                  savedUrls.push(persistedLessonImage.savedUrl);
                }

                return {
                  ...lesson,
                  imageUrl: persistedLessonImage.url,
                  steps: await Promise.all(
                    lesson.steps.map(async (step, stepIndex) => {
                      const persistedStepImage = await persistImage(
                        step.imageUrl,
                        `${level.slug}-step-${levelIndex + 1}-${unitIndex + 1}-${lessonIndex + 1}-${stepIndex + 1}`,
                      );
                      const persistedStepContentImages = await persistContentImages(
                        step.content,
                        `${level.slug}-step-${levelIndex + 1}-${unitIndex + 1}-${lessonIndex + 1}-${stepIndex + 1}`,
                        savedUrls,
                      );
                      const persistedStepContentAudio = await persistContentAudio(
                        persistedStepContentImages,
                        `${level.slug}-step-${levelIndex + 1}-${unitIndex + 1}-${lessonIndex + 1}-${stepIndex + 1}`,
                        savedUrls,
                      );
                      const persistedLessonChoiceMedia = await persistLessonChoiceMedia(
                        persistedStepContentAudio,
                        `${level.slug}-step-${levelIndex + 1}-${unitIndex + 1}-${lessonIndex + 1}-${stepIndex + 1}`,
                        savedUrls,
                      );
                      const persistedStepContent = await persistPracticeMedia(
                        persistedLessonChoiceMedia,
                        `${level.slug}-step-${levelIndex + 1}-${unitIndex + 1}-${lessonIndex + 1}-${stepIndex + 1}`,
                        savedUrls,
                      );

                      if (persistedStepImage.savedUrl) {
                        savedUrls.push(persistedStepImage.savedUrl);
                      }

                      return {
                        ...step,
                        content: persistedStepContent,
                        imageUrl: persistedStepImage.url,
                      };
                    }),
                  ),
                };
              }),
            ),
          };
        }),
      ),
    })),
  );

  return {
    levels: nextLevels,
    savedUrls,
  };
}
