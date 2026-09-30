"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { ChangeEvent, Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import {
  createEmptyLesson,
  createEmptyUnit,
  makeUniqueSlug,
} from "@/lib/course-content";
import { useAuth } from "@/context/auth-context";
import type {
  AdminCourseLevel,
  AdminCourseLessonResponse,
  AdminCourseLevelResponse,
  AdminCourseLevelsIndexResponse,
  AdminCourseLevelSummary,
} from "@/types/courses";
import { AdminLevelEditor } from "@/components/courses/admin-level-editor";

export function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }

  const next = [...items];
  const current = next[index];
  next[index] = next[nextIndex];
  next[nextIndex] = current;
  return next;
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("FILE_READ_ERROR"));
    reader.readAsDataURL(file);
  });
}

const MAX_COURSE_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;

function sanitizeCourseImageFileName(fileName: string) {
  return fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "image";
}

function getDraftUnitId(index: number) {
  return `draft-${index}`;
}

function getDraftLessonId(index: number) {
  return `draft-lesson-${index}`;
}

function getDefaultSelection(level: AdminCourseLevel | null) {
  const firstUnit = level?.units[0];
  const selectedUnitId = firstUnit ? firstUnit.id ?? getDraftUnitId(0) : "";
  const firstLesson = firstUnit?.lessons[0];
  const selectedLessonId = firstLesson ? firstLesson.id ?? getDraftLessonId(0) : "";

  return {
    selectedUnitId,
    selectedLessonId,
  };
}

export function AdminCourseBuilder() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [levelOptions, setLevelOptions] = useState<AdminCourseLevelSummary[]>([]);
  const [activeLevelId, setActiveLevelId] = useState("");
  const [activeLevel, setActiveLevel] = useState<AdminCourseLevel | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string>("all");
  const [selectedLessonId, setSelectedLessonId] = useState<string>("all");
  const [loadingIndex, setLoadingIndex] = useState(true);
  const [loadingLevel, setLoadingLevel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingLesson, setSavingLesson] = useState(false);
  const [deletingLesson, setDeletingLesson] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loadedSnapshot, setLoadedSnapshot] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/auth/login");
      return;
    }

    if (!isLoading && user && user.role !== "ADMIN") {
      router.replace("/dashboard");
    }
  }, [isLoading, router, user]);

  const loadLevelOptions = async (preferredLevelId?: string) => {
    setLoadingIndex(true);
    setError("");

    try {
      const response = await fetch("/api/admin/courses", { cache: "no-store" });
      const payload = (await response.json()) as AdminCourseLevelsIndexResponse;

      if (!response.ok || !payload.levels) {
        setError(payload.error ?? "Не удалось загрузить список уровней.");
        return;
      }

      setLevelOptions(payload.levels);

      const nextActiveId =
        preferredLevelId && payload.levels.some((level) => level.id === preferredLevelId)
          ? preferredLevelId
          : payload.levels[0]?.id ?? "";

      setActiveLevelId((current) => current || nextActiveId);
    } catch {
      setError("Не удалось загрузить список уровней.");
    } finally {
      setLoadingIndex(false);
    }
  };

  const loadLevel = async (levelId: string) => {
    if (!levelId) {
      setActiveLevel(null);
      setLoadedSnapshot("");
      return;
    }

    setLoadingLevel(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/courses/${levelId}`, { cache: "no-store" });
      const payload = (await response.json()) as AdminCourseLevelResponse;

      if (!response.ok || !payload.level) {
        setError(payload.error ?? "Не удалось загрузить уровень.");
        setActiveLevel(null);
        setLoadedSnapshot("");
        return;
      }

      setActiveLevel(payload.level);
      setLoadedSnapshot(JSON.stringify(payload.level));
      const defaults = getDefaultSelection(payload.level);
      setSelectedUnitId(defaults.selectedUnitId);
      setSelectedLessonId(defaults.selectedLessonId);
    } catch {
      setError("Не удалось загрузить уровень.");
      setActiveLevel(null);
      setLoadedSnapshot("");
    } finally {
      setLoadingLevel(false);
    }
  };

  useEffect(() => {
    if (user?.role !== "ADMIN") {
      return;
    }

    void loadLevelOptions();
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== "ADMIN" || !activeLevelId) {
      return;
    }

    void loadLevel(activeLevelId);
  }, [activeLevelId, user?.role]);

  useEffect(() => {
    if (!activeLevel) {
      setSelectedLessonId("");
      return;
    }

    if (
      !activeLevel.units.some(
        (unit, index) => (unit.id ?? getDraftUnitId(index)) === selectedUnitId,
      )
    ) {
      const defaults = getDefaultSelection(activeLevel);
      setSelectedUnitId(defaults.selectedUnitId);
      setSelectedLessonId(defaults.selectedLessonId);
    }
  }, [activeLevel, selectedUnitId]);

  useEffect(() => {
    if (!activeLevel || !selectedUnitId || !selectedLessonId) {
      return;
    }

    const activeUnit = activeLevel.units.find(
      (unit, index) => (unit.id ?? getDraftUnitId(index)) === selectedUnitId,
    );

    if (
      !activeUnit?.lessons.some(
        (lesson, index) => (lesson.id ?? getDraftLessonId(index)) === selectedLessonId,
      )
    ) {
      const firstLesson = activeUnit?.lessons[0];
      setSelectedLessonId(firstLesson ? firstLesson.id ?? getDraftLessonId(0) : "");
    }
  }, [activeLevel, selectedLessonId, selectedUnitId]);

  const onImageSelect = async (
    event: ChangeEvent<HTMLInputElement>,
    apply: (value: string) => void,
  ) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    if (file.size > MAX_COURSE_IMAGE_SIZE_BYTES) {
      setError("Изображение слишком большое. Максимальный размер — 20 МБ.");
      return;
    }

    try {
      setError("");
      const blob = await upload(
        `course-images/${Date.now()}-${crypto.randomUUID()}-${sanitizeCourseImageFileName(file.name)}`,
        file,
        {
          access: "public",
          handleUploadUrl: "/api/admin/courses/media/client-upload",
        },
      );
      apply(blob.url);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        try {
          const dataUrl = await readFileAsDataUrl(file);
          apply(dataUrl);
          return;
        } catch {
          // Continue to the upload error below.
        }
      }

      setError(
        error instanceof Error
          ? `Не удалось загрузить изображение: ${error.message}`
          : "Не удалось загрузить изображение.",
      );
    }
  };

  const onAudioSelect = async (
    event: ChangeEvent<HTMLInputElement>,
    apply: (value: string, fileName: string) => void,
  ) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      apply(dataUrl, file.name);
    } catch {
      setError("Не удалось прочитать аудиофайл.");
    }
  };

  const activeFingerprint = useMemo(
    () => (activeLevel ? JSON.stringify(activeLevel) : ""),
    [activeLevel],
  );
  const isDirty = Boolean(activeLevel && activeFingerprint !== loadedSnapshot);
  const selectedLessonContext = useMemo(() => {
    if (!activeLevel || !selectedUnitId || !selectedLessonId) {
      return null;
    }

    const unitIndex = activeLevel.units.findIndex(
      (unit, index) => (unit.id ?? getDraftUnitId(index)) === selectedUnitId,
    );
    const unit = activeLevel.units[unitIndex];
    if (!unit) {
      return null;
    }

    const lessonIndex = unit.lessons.findIndex(
      (lesson, index) => (lesson.id ?? getDraftLessonId(index)) === selectedLessonId,
    );
    const lesson = unit.lessons[lessonIndex];
    return lesson ? { unit, unitIndex, lesson, lessonIndex } : null;
  }, [activeLevel, selectedLessonId, selectedUnitId]);

  const setActiveLevelAsArray: Dispatch<SetStateAction<AdminCourseLevel[]>> = (value) => {
    setActiveLevel((current) => {
      const currentArray = current ? [current] : [];
      const nextArray = typeof value === "function" ? value(currentArray) : value;
      return nextArray[0] ?? null;
    });
  };

  const handleSelectLevel = (levelId: string) => {
    if (levelId === activeLevelId) {
      return;
    }

    if (isDirty && typeof window !== "undefined") {
      const confirmed = window.confirm(
        "У текущего уровня есть несохраненные изменения. Переключиться и потерять их?",
      );
      if (!confirmed) {
        return;
      }
    }

    setActiveLevelId(levelId);
  };

  const saveActiveLevel = async () => {
    if (!activeLevel) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/courses/${activeLevel.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ level: activeLevel }),
      });
      const payload = (await response.json()) as AdminCourseLevelResponse;

      if (!response.ok || !payload.level) {
        setError(payload.error ?? "Не удалось сохранить уровень.");
        return;
      }

      setActiveLevel(payload.level);
      setLoadedSnapshot(JSON.stringify(payload.level));
      setSuccess(`Уровень «${payload.level.title}» сохранен.`);
      await loadLevelOptions(payload.level.id);
    } catch {
      setError("Не удалось сохранить уровень.");
    } finally {
      setSaving(false);
    }
  };

  const saveSelectedLesson = async () => {
    if (!activeLevel || !selectedLessonContext) {
      setError("Выберите урок для сохранения.");
      return;
    }

    const { unit, unitIndex, lesson, lessonIndex } = selectedLessonContext;
    if (!unit.id) {
      setError("Сначала сохраните структуру уровня, чтобы создать этот юнит.");
      return;
    }

    setSavingLesson(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/courses/${activeLevel.id}/lessons`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId: unit.id, lesson }),
      });
      const payload = (await response.json()) as AdminCourseLessonResponse;

      if (!response.ok || !payload.lesson) {
        setError(payload.error ?? "Не удалось сохранить урок.");
        return;
      }

      const savedLesson = payload.lesson;
      setActiveLevel((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          units: current.units.map((entryUnit, currentUnitIndex) =>
            currentUnitIndex !== unitIndex
              ? entryUnit
              : {
                  ...entryUnit,
                  lessons: entryUnit.lessons.map((entryLesson, currentLessonIndex) =>
                    currentLessonIndex === lessonIndex ? savedLesson : entryLesson,
                  ),
                },
          ),
        };
      });
      setLoadedSnapshot((currentSnapshot) => {
        if (!currentSnapshot) {
          return currentSnapshot;
        }

        const snapshot = JSON.parse(currentSnapshot) as AdminCourseLevel;
        const snapshotUnitIndex = snapshot.units.findIndex((entryUnit) => entryUnit.id === unit.id);
        if (snapshotUnitIndex < 0) {
          return currentSnapshot;
        }

        const snapshotUnit = snapshot.units[snapshotUnitIndex];
        const snapshotLessonIndex = lesson.id
          ? snapshotUnit.lessons.findIndex((entryLesson) => entryLesson.id === lesson.id)
          : -1;
        const nextLessons = [...snapshotUnit.lessons];
        if (snapshotLessonIndex >= 0) {
          nextLessons[snapshotLessonIndex] = savedLesson;
        } else {
          nextLessons.splice(Math.min(lessonIndex, nextLessons.length), 0, savedLesson);
        }
        snapshot.units[snapshotUnitIndex] = { ...snapshotUnit, lessons: nextLessons };
        return JSON.stringify(snapshot);
      });
      setSelectedLessonId(savedLesson.id ?? selectedLessonId);
      setSuccess(`Урок «${savedLesson.title}» сохранён отдельно. Другие уроки не изменены.`);
      await loadLevelOptions(activeLevel.id);
    } catch {
      setError("Не удалось сохранить урок.");
    } finally {
      setSavingLesson(false);
    }
  };

  const deleteLesson = async (unitIndex: number, lessonIndex: number) => {
    if (!activeLevel || deletingLesson || saving || savingLesson) {
      return;
    }

    const unit = activeLevel.units[unitIndex];
    const lesson = unit?.lessons[lessonIndex];
    if (!unit || !lesson) {
      setError("Урок не найден в редакторе.");
      return;
    }

    if (
      typeof window !== "undefined" &&
      !window.confirm(`Удалить урок «${lesson.title}»? Это действие сразу удалит его из курса.`)
    ) {
      return;
    }

    const remainingLessons = unit.lessons.filter((_, index) => index !== lessonIndex);
    const nextLessonIndex = Math.min(lessonIndex, Math.max(remainingLessons.length - 1, 0));
    const nextLesson = remainingLessons[nextLessonIndex];
    const nextSelectedLessonId = nextLesson
      ? nextLesson.id ?? getDraftLessonId(nextLessonIndex)
      : "";

    const removeLessonFromActiveLevel = () => {
      setActiveLevel((current) =>
        current
          ? {
              ...current,
              units: current.units.map((entryUnit, currentUnitIndex) =>
                currentUnitIndex === unitIndex
                  ? {
                      ...entryUnit,
                      lessons: entryUnit.lessons.filter((_, currentLessonIndex) =>
                        currentLessonIndex !== lessonIndex,
                      ),
                    }
                  : entryUnit,
              ),
            }
          : current,
      );
      setSelectedLessonId(nextSelectedLessonId);
    };

    if (!lesson.id) {
      removeLessonFromActiveLevel();
      setError("");
      setSuccess(`Черновик урока «${lesson.title}» удалён.`);
      return;
    }

    if (!unit.id) {
      setError("Нельзя удалить сохранённый урок: юнит ещё не сохранён.");
      return;
    }

    setDeletingLesson(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/courses/${activeLevel.id}/lessons`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId: unit.id, lessonId: lesson.id }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Не удалось удалить урок.");
        return;
      }

      removeLessonFromActiveLevel();
      setLoadedSnapshot((currentSnapshot) => {
        if (!currentSnapshot) {
          return currentSnapshot;
        }

        const snapshot = JSON.parse(currentSnapshot) as AdminCourseLevel;
        snapshot.units = snapshot.units.map((entryUnit) =>
          entryUnit.id === unit.id
            ? {
                ...entryUnit,
                lessons: entryUnit.lessons.filter((entryLesson) => entryLesson.id !== lesson.id),
              }
            : entryUnit,
        );
        return JSON.stringify(snapshot);
      });
      setSuccess(`Урок «${lesson.title}» удалён.`);
      await loadLevelOptions(activeLevel.id);
    } catch {
      setError("Не удалось удалить урок.");
    } finally {
      setDeletingLesson(false);
    }
  };

  const addUnitToActiveLevel = () => {
    if (!activeLevel) {
      return;
    }

    const nextUnit = createEmptyUnit(activeLevel.units.length);
    const nextUnitId = getDraftUnitId(activeLevel.units.length);
    const nextLevel = {
      ...activeLevel,
      units: [
        ...activeLevel.units,
        {
          ...nextUnit,
          slug: makeUniqueSlug(
            nextUnit.slug,
            activeLevel.units.map((unit) => unit.slug),
          ),
        },
      ],
    };

    setActiveLevel(nextLevel);
    setSelectedUnitId(nextUnitId);
    setSelectedLessonId(nextUnit.lessons[0]?.id ?? getDraftLessonId(0));
    setError("");
    setSuccess("");
  };

  const addLessonToSelectedUnit = () => {
    if (!activeLevel || !selectedUnitId) {
      return;
    }

    let nextLessonId = "";
    const nextLevel = {
      ...activeLevel,
      units: activeLevel.units.map((unit, unitIndex) => {
        const unitId = unit.id ?? getDraftUnitId(unitIndex);
        if (unitId !== selectedUnitId) {
          return unit;
        }

        const nextLesson = createEmptyLesson(unit.lessons.length);
        nextLessonId = nextLesson.id ?? getDraftLessonId(unit.lessons.length);

        return {
          ...unit,
          lessons: [
            ...unit.lessons,
            {
              ...nextLesson,
              slug: makeUniqueSlug(
                nextLesson.slug,
                unit.lessons.map((lesson) => lesson.slug),
              ),
            },
          ],
        };
      }),
    };

    setActiveLevel(nextLevel);
    if (nextLessonId) {
      setSelectedLessonId(nextLessonId);
    }
    setError("");
    setSuccess("");
  };

  const resetActiveLevel = () => {
    if (!loadedSnapshot || !activeLevel) {
      return;
    }

    const parsed = JSON.parse(loadedSnapshot) as AdminCourseLevel;
    setActiveLevel(parsed);
    setError("");
    setSuccess("");

    const defaults = getDefaultSelection(parsed);
    setSelectedUnitId(defaults.selectedUnitId);
    setSelectedLessonId(defaults.selectedLessonId);
  };

  if (isLoading || loadingIndex) {
    return (
      <section className="py-10 md:py-14">
        <div className="site-shell">
          <div className="glass-card rounded-3xl px-6 py-10 text-sm text-[var(--ink-soft)]">
            Загружаем конструктор...
          </div>
        </div>
      </section>
    );
  }

  if (!user || user.role !== "ADMIN") {
    return null;
  }

  return (
    <section className="py-10 md:py-14">
      <div className="site-shell space-y-6">
        <article className="glass-card rounded-3xl px-6 py-7 md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[var(--accent-dark)]">Конструктор курсов</p>
              <h1 className="mt-2 text-3xl font-black">Редактирование по уровням</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-soft)]">
                Выберите уровень, загрузите только его структуру и сохраните только его. Это уменьшает объем
                загрузки и ускоряет работу с юнитами, уроками и шагами.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/courses" className="primary-btn px-4 py-2 text-sm font-bold">
                Курсы
              </Link>
              <Link href="/admin/tests" className="secondary-btn px-4 py-2 text-sm font-bold">
                TOPIK
              </Link>
              <Link href="/admin/tests/results" className="secondary-btn px-4 py-2 text-sm font-bold">
                Результаты TOPIK
              </Link>
              <Link href="/admin/vocabulary" className="secondary-btn px-4 py-2 text-sm font-bold">
                Словарь
              </Link>
            </div>
          </div>
        </article>

        <article className="glass-card rounded-3xl px-6 py-7 md:px-8">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void saveSelectedLesson()}
                disabled={savingLesson || saving || !selectedLessonContext}
                className="primary-btn px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingLesson ? "Сохраняем урок..." : "Сохранить выбранный урок"}
              </button>
              <button
                type="button"
                onClick={addUnitToActiveLevel}
                disabled={!activeLevel || saving}
                className="secondary-btn px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              >
                Добавить юнит
              </button>
              <button
                type="button"
                onClick={addLessonToSelectedUnit}
                disabled={!activeLevel || !selectedUnitId || saving || savingLesson}
                className="secondary-btn px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              >
                Добавить урок в юнит
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    typeof window === "undefined" ||
                    window.confirm(
                      "Структурное сохранение обновит весь уровень. Используйте его только для изменений уровня, юнитов и их порядка. Продолжить?",
                    )
                  ) {
                    void saveActiveLevel();
                  }
                }}
                disabled={saving || savingLesson || !activeLevel}
                className="secondary-btn px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Сохраняем структуру..." : "Сохранить структуру уровня"}
              </button>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-dark)]">
                Уровни
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {levelOptions.map((level) => (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() => handleSelectLevel(level.id)}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                      activeLevelId === level.id
                        ? "border-[var(--accent-dark)] bg-[var(--accent-dark)] text-white"
                        : "border-[var(--line)] bg-white text-[var(--ink)]"
                    }`}
                  >
                    {`Уровень ${level.number} · ${level.title}`}
                  </button>
                ))}
              </div>
            </div>

            {activeLevel ? (
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-dark)]">
                  Юниты
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeLevel.units.map((unit, index) => (
                    <button
                      key={unit.id ?? `${activeLevel.id}-unit-${index}`}
                      type="button"
                      onClick={() => {
                        setSelectedUnitId(unit.id ?? getDraftUnitId(index));
                        const firstLesson = unit.lessons[0];
                        setSelectedLessonId(firstLesson ? firstLesson.id ?? getDraftLessonId(0) : "");
                      }}
                      className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                        selectedUnitId === (unit.id ?? getDraftUnitId(index))
                          ? "border-[var(--accent-dark)] bg-[var(--accent-dark)] text-white"
                          : "border-[var(--line)] bg-white text-[var(--ink)]"
                      }`}
                    >
                      {unit.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {activeLevel && selectedUnitId ? (
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-dark)]">
                  Уроки
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(activeLevel.units.find(
                    (unit, index) => (unit.id ?? getDraftUnitId(index)) === selectedUnitId,
                  )?.lessons ?? []).map((lesson, index) => (
                    <button
                      key={lesson.id ?? `${selectedUnitId}-lesson-${index}`}
                      type="button"
                      onClick={() =>
                        setSelectedLessonId(lesson.id ?? getDraftLessonId(index))
                      }
                      className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                        selectedLessonId === (lesson.id ?? getDraftLessonId(index))
                          ? "border-[var(--accent-dark)] bg-[var(--accent-dark)] text-white"
                          : "border-[var(--line)] bg-white text-[var(--ink)]"
                      }`}
                    >
                      {lesson.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </article>

        {loadingLevel ? (
          <div className="glass-card rounded-3xl px-6 py-10 text-sm text-[var(--ink-soft)]">
            Загружаем уровень...
          </div>
        ) : activeLevel ? (
          <AdminLevelEditor
            level={activeLevel}
            levelIndex={0}
            setLevels={setActiveLevelAsArray}
            visibleUnitIds={selectedUnitId ? [selectedUnitId] : null}
            visibleLessonIds={selectedLessonId ? [selectedLessonId] : null}
            onImageSelect={onImageSelect}
            onAudioSelect={onAudioSelect}
            onSaveLesson={() => void saveSelectedLesson()}
            onDeleteLesson={(unitIndex, lessonIndex) => void deleteLesson(unitIndex, lessonIndex)}
            savingLesson={savingLesson || deletingLesson}
          />
        ) : (
          <div className="glass-card rounded-3xl px-6 py-10 text-sm text-[var(--ink-soft)]">
            Выберите уровень для редактирования.
          </div>
        )}

        {error ? <p className="error-text">{error}</p> : null}
        {success ? <p className="text-sm font-semibold text-emerald-700">{success}</p> : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={resetActiveLevel}
            disabled={!activeLevel || !isDirty || saving}
            className="secondary-btn px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
          >
            Отменить изменения
          </button>
          <button
            type="button"
            onClick={() => void saveSelectedLesson()}
            disabled={savingLesson || saving || !selectedLessonContext}
            className="primary-btn px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingLesson ? "Сохраняем урок..." : "Сохранить выбранный урок"}
          </button>
          <span className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--ink-soft)]">
            {isDirty ? "Есть несохраненные изменения" : "Все изменения сохранены"}
          </span>
        </div>
      </div>
    </section>
  );
}
