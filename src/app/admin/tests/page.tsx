"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { parseTopikBulkText } from "@/lib/topik-bulk-import";
import { renderTopikRichText } from "@/lib/topik-rich-text";

type AdminTestItem = {
  id: string;
  title: string;
  level: "TOPIK_I" | "TOPIK_II";
  isPublished: boolean;
  listeningAudioUrl: string | null;
  durationMinutes: number;
  sections: {
    id: string;
    type: "LISTENING" | "READING";
    title: string;
    questionCount: number;
  }[];
};

type AdminTestsResponse = {
  tests?: AdminTestItem[];
  error?: string;
};

type AdminTestDetail = {
  id: string;
  title: string;
  description: string | null;
  level: "TOPIK_I" | "TOPIK_II";
  durationMinutes: number;
  isPublished: boolean;
  listeningAudioUrl: string | null;
  sections: SectionForm[];
};

type AdminTestDetailResponse = {
  test?: AdminTestDetail;
  error?: string;
};

type AudioUploadResponse = {
  ok?: boolean;
  listeningAudioUrl?: string | null;
  message?: string;
  error?: string;
};

type SaveTestResponse = {
  id?: string;
  error?: string;
};

type ChoiceForm = {
  mode: "TEXT" | "IMAGE";
  text: string;
  imageUrl: string | null;
};
type BlockForm = {
  variant: "EXAMPLE" | "PASSAGE" | "NOTICE";
  title: string;
  content: string;
  displayBeforeQuestionOrder: number;
};
type QuestionForm = {
  contentMode: "TEXT" | "IMAGE";
  prompt: string;
  content: string;
  contentImageUrl: string | null;
  points: number;
  correctChoiceIndex: number;
  choices: ChoiceForm[];
};
type SectionForm = {
  type: "LISTENING" | "READING";
  title: string;
  durationMinutes: number;
  blocks: BlockForm[];
  questions: QuestionForm[];
};

type SectionType = SectionForm["type"];
type SectionDraftMap = Record<SectionType, SectionForm[]>;

const defaultBlock = (): BlockForm => ({
  variant: "EXAMPLE",
  title: "",
  content: "",
  displayBeforeQuestionOrder: 1,
});

const defaultQuestion = (): QuestionForm => ({
  contentMode: "TEXT",
  prompt: "",
  content: "",
  contentImageUrl: null,
  points: 1,
  correctChoiceIndex: 0,
  choices: [
    { mode: "TEXT", text: "", imageUrl: null },
    { mode: "TEXT", text: "", imageUrl: null },
    { mode: "TEXT", text: "", imageUrl: null },
    { mode: "TEXT", text: "", imageUrl: null },
  ],
});

const defaultSection = (type: SectionType): SectionForm => ({
  type,
  title: "",
  durationMinutes: 30,
  blocks: [],
  questions: [defaultQuestion()],
});

function normalizeDraftSections(type: SectionType, sections: SectionForm[]) {
  return sections.map((section) => ({
    ...section,
    type,
  }));
}

function buildEmptyDrafts(activeType: SectionType = "READING"): SectionDraftMap {
  return {
    READING: activeType === "READING" ? [defaultSection("READING")] : [],
    LISTENING: activeType === "LISTENING" ? [defaultSection("LISTENING")] : [],
  };
}

function splitSectionsByType(sections: SectionForm[]) {
  const drafts: SectionDraftMap = {
    READING: [],
    LISTENING: [],
  };

  const layout = sections.map((section) => section.type);

  sections.forEach((section) => {
    drafts[section.type].push(section);
  });

  return {
    drafts,
    layout,
  };
}

function buildMergedSections(
  drafts: SectionDraftMap,
  layout: SectionType[],
) {
  const cursors: Record<SectionType, number> = {
    READING: 0,
    LISTENING: 0,
  };

  const merged: SectionForm[] = [];

  layout.forEach((type) => {
    const nextSection = drafts[type][cursors[type]];
    if (!nextSection) {
      return;
    }

    merged.push(nextSection);
    cursors[type] += 1;
  });

  (["READING", "LISTENING"] as const).forEach((type) => {
    while (cursors[type] < drafts[type].length) {
      merged.push(drafts[type][cursors[type]]);
      cursors[type] += 1;
    }
  });

  return merged;
}

function isSectionEmpty(section: SectionForm) {
  return (
    section.title.trim() === "" &&
    section.blocks.length === 0 &&
    section.questions.length === 1 &&
    section.questions[0].prompt.trim() === "" &&
    section.questions[0].content.trim() === "" &&
    section.questions[0].contentImageUrl === null &&
    section.questions[0].choices.every(
      (choice) => choice.text.trim() === "" && choice.imageUrl === null,
    )
  );
}

function levelLabel(level: "TOPIK_I" | "TOPIK_II") {
  return level === "TOPIK_I" ? "TOPIK I" : "TOPIK II";
}

function sectionTypeLabel(type: "LISTENING" | "READING") {
  return type === "LISTENING" ? "Аудирование" : "Чтение";
}

function normalizeQuestionForForm(question: QuestionForm): QuestionForm {
  return {
    ...question,
    contentMode: question.contentImageUrl ? "IMAGE" : "TEXT",
    choices: question.choices.map((choice) => ({
      ...choice,
      mode: choice.imageUrl ? "IMAGE" : "TEXT",
    })),
  };
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("FILE_READ_ERROR"));
    reader.readAsDataURL(file);
  });
}

function sanitizeAudioFileName(fileName: string) {
  const cleaned = fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned || "listening-audio";
}

const DIRECT_BLOB_UPLOAD_THRESHOLD_BYTES = 4.5 * 1024 * 1024;

function AdminPageSkeleton() {
  return (
    <section className="py-10 md:py-14">
      <div className="site-shell space-y-6">
        <article className="glass-card min-h-[12rem] rounded-3xl px-6 py-7 md:px-8">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-28 rounded-full bg-[var(--accent-soft)]" />
            <div className="h-10 w-80 max-w-full rounded-2xl bg-slate-200/80" />
            <div className="h-4 w-[34rem] max-w-full rounded-full bg-slate-200/80" />
          </div>
        </article>

        <article className="glass-card min-h-[42rem] rounded-3xl px-6 py-7 md:px-8">
          <div className="animate-pulse space-y-5">
            <div className="h-8 w-56 rounded-2xl bg-slate-200/80" />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="h-14 rounded-2xl bg-slate-200/75" />
              <div className="h-14 rounded-2xl bg-slate-200/75" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="h-14 rounded-2xl bg-slate-200/75" />
              <div className="h-14 rounded-2xl bg-slate-200/75" />
            </div>
            <div className="h-28 rounded-3xl bg-slate-200/70" />
            <div className="h-72 rounded-3xl bg-slate-200/70" />
          </div>
        </article>

        <article className="glass-card min-h-[18rem] rounded-3xl px-6 py-7 md:px-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-52 rounded-2xl bg-slate-200/80" />
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-24 rounded-2xl bg-slate-200/70" />
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function TestListSkeleton() {
  return (
    <ul className="mt-4 space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <li key={index} className="animate-pulse rounded-xl border border-[var(--line)] bg-white/85 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <div className="h-5 w-56 max-w-full rounded-full bg-slate-200/80" />
              <div className="h-4 w-40 rounded-full bg-slate-200/70" />
              <div className="h-4 w-48 rounded-full bg-slate-200/70" />
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-20 rounded-full bg-slate-200/80" />
              <div className="h-9 w-28 rounded-full bg-slate-200/80" />
              <div className="h-9 w-24 rounded-full bg-slate-200/80" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AdminTestsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [tests, setTests] = useState<AdminTestItem[]>([]);
  const [testsLoading, setTestsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [loadingTestId, setLoadingTestId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<"TOPIK_I" | "TOPIK_II">("TOPIK_I");
  const [durationMinutes, setDurationMinutes] = useState(100);
  const [isPublished, setIsPublished] = useState(false);
  const [listeningAudioUrl, setListeningAudioUrl] = useState<string | null>(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [audioBusyTestId, setAudioBusyTestId] = useState<string | null>(null);
  const [draftListeningAudioFile, setDraftListeningAudioFile] = useState<File | null>(null);
  const [editorSectionType, setEditorSectionType] = useState<SectionType>("READING");
  const [sectionDrafts, setSectionDrafts] = useState<SectionDraftMap>(buildEmptyDrafts("READING"));
  const [sectionLayout, setSectionLayout] = useState<SectionType[]>([]);
  const [bulkImportType, setBulkImportType] = useState<SectionType>("READING");
  const [bulkImportText, setBulkImportText] = useState("");

  const sections = sectionDrafts[editorSectionType];

  const setSections = (
    value: SectionForm[] | ((prev: SectionForm[]) => SectionForm[]),
  ) => {
    setSectionDrafts((prev) => {
      const nextSections =
        typeof value === "function" ? value(prev[editorSectionType]) : value;

      return {
        ...prev,
        [editorSectionType]: normalizeDraftSections(editorSectionType, nextSections),
      };
    });
  };

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/auth/login");
      return;
    }

    if (!isLoading && user && user.role !== "ADMIN") {
      router.replace("/dashboard");
    }
  }, [isLoading, router, user]);

  const loadTests = async () => {
    setTestsLoading(true);
    try {
      const response = await fetch("/api/admin/topik/tests", { cache: "no-store" });
      const data = (await response.json()) as AdminTestsResponse;

      if (!response.ok) {
        setError(data.error ?? "Не удалось загрузить список тестов.");
        setTests([]);
        return;
      }

      setTests(data.tests ?? []);
    } catch {
      setError("Не удалось загрузить тесты.");
      setTests([]);
    } finally {
      setTestsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "ADMIN") {
      void loadTests();
    }
  }, [user?.role]);

  const switchEditorSectionType = (nextType: SectionType) => {
    setEditorSectionType(nextType);
    setBulkImportType(nextType);
    setSectionDrafts((prev) =>
      prev[nextType].length > 0
        ? prev
        : {
            ...prev,
            [nextType]: [defaultSection(nextType)],
          },
    );
  };

  const totals = useMemo(() => {
    return sections.reduce(
      (acc, section) => {
        acc.sections += 1;
        acc.blocks += section.blocks.length;
        acc.questions += section.questions.length;
        return acc;
      },
      { sections: 0, blocks: 0, questions: 0 },
    );
  }, [sections]);

  const addSection = () => {
    setSections((prev) => [...prev, defaultSection(editorSectionType)]);
  };

  const removeSection = (sectionIndex: number) => {
    setSections((prev) => prev.filter((_, idx) => idx !== sectionIndex));
  };

  const updateSection = <K extends keyof SectionForm>(
    sectionIndex: number,
    key: K,
    value: SectionForm[K],
  ) => {
    setSections((prev) =>
      prev.map((section, idx) =>
        idx === sectionIndex ? { ...section, [key]: value } : section,
      ),
    );
  };

  const addQuestion = (sectionIndex: number) => {
    setSections((prev) =>
      prev.map((section, idx) =>
        idx === sectionIndex
          ? {
              ...section,
              questions: [...section.questions, defaultQuestion()],
            }
          : section,
      ),
    );
  };

  const removeQuestion = (sectionIndex: number, questionIndex: number) => {
    setSections((prev) =>
      prev.map((section, idx) =>
        idx === sectionIndex
          ? {
              ...section,
              questions: section.questions.filter((_, qIdx) => qIdx !== questionIndex),
              blocks: section.blocks.map((block) => ({
                ...block,
                displayBeforeQuestionOrder: Math.min(
                  block.displayBeforeQuestionOrder,
                  Math.max(1, section.questions.length - 1),
                ),
              })),
            }
          : section,
      ),
    );
  };

  const addBlock = (sectionIndex: number) => {
    setSections((prev) =>
      prev.map((section, idx) =>
        idx === sectionIndex
          ? {
              ...section,
              blocks: [
                ...section.blocks,
                {
                  ...defaultBlock(),
                  displayBeforeQuestionOrder: Math.min(section.questions.length, 1),
                },
              ],
            }
          : section,
      ),
    );
  };

  const removeBlock = (sectionIndex: number, blockIndex: number) => {
    setSections((prev) =>
      prev.map((section, idx) =>
        idx === sectionIndex
          ? {
              ...section,
              blocks: section.blocks.filter((_, bIdx) => bIdx !== blockIndex),
            }
          : section,
      ),
    );
  };

  const updateBlock = <K extends keyof BlockForm>(
    sectionIndex: number,
    blockIndex: number,
    key: K,
    value: BlockForm[K],
  ) => {
    setSections((prev) =>
      prev.map((section, sIdx) => {
        if (sIdx !== sectionIndex) {
          return section;
        }

        return {
          ...section,
          blocks: section.blocks.map((block, bIdx) =>
            bIdx === blockIndex ? { ...block, [key]: value } : block,
          ),
        };
      }),
    );
  };

  const updateQuestion = <K extends keyof QuestionForm>(
    sectionIndex: number,
    questionIndex: number,
    key: K,
    value: QuestionForm[K],
  ) => {
    setSections((prev) =>
      prev.map((section, sIdx) => {
        if (sIdx !== sectionIndex) {
          return section;
        }

        return {
          ...section,
          questions: section.questions.map((question, qIdx) =>
            qIdx === questionIndex ? { ...question, [key]: value } : question,
          ),
        };
      }),
    );
  };

  const updateChoice = <K extends keyof ChoiceForm>(
    sectionIndex: number,
    questionIndex: number,
    choiceIndex: number,
    key: K,
    value: ChoiceForm[K],
  ) => {
    setSections((prev) =>
      prev.map((section, sIdx) => {
        if (sIdx !== sectionIndex) {
          return section;
        }

        return {
          ...section,
          questions: section.questions.map((question, qIdx) => {
            if (qIdx !== questionIndex) {
              return question;
            }

            return {
              ...question,
              choices: question.choices.map((choice, cIdx) =>
                cIdx === choiceIndex ? { ...choice, [key]: value } : choice,
              ),
            };
          }),
        };
      }),
    );
  };

  const setChoiceMode = (
    sectionIndex: number,
    questionIndex: number,
    choiceIndex: number,
    mode: "TEXT" | "IMAGE",
  ) => {
    setSections((prev) =>
      prev.map((section, sIdx) => {
        if (sIdx !== sectionIndex) {
          return section;
        }

        return {
          ...section,
          questions: section.questions.map((question, qIdx) => {
            if (qIdx !== questionIndex) {
              return question;
            }

            return {
              ...question,
              choices: question.choices.map((choice, cIdx) =>
                cIdx === choiceIndex
                  ? {
                      ...choice,
                      mode,
                      text: mode === "IMAGE" ? "" : choice.text,
                      imageUrl: mode === "TEXT" ? null : choice.imageUrl,
                    }
                  : choice,
              ),
            };
          }),
        };
      }),
    );
  };

  const setQuestionContentMode = (
    sectionIndex: number,
    questionIndex: number,
    mode: "TEXT" | "IMAGE",
  ) => {
    setSections((prev) =>
      prev.map((section, sIdx) => {
        if (sIdx !== sectionIndex) {
          return section;
        }

        return {
          ...section,
          questions: section.questions.map((question, qIdx) => {
            if (qIdx !== questionIndex) {
              return question;
            }

            return {
              ...question,
              contentMode: mode,
              content: mode === "IMAGE" ? "" : question.content,
              contentImageUrl: mode === "TEXT" ? null : question.contentImageUrl,
            };
          }),
        };
      }),
    );
  };

  const setQuestionImage = async (
    sectionIndex: number,
    questionIndex: number,
    file: File,
  ) => {
    const dataUrl = await readFileAsDataUrl(file);

    setSections((prev) =>
      prev.map((section, sIdx) => {
        if (sIdx !== sectionIndex) {
          return section;
        }

        return {
          ...section,
          questions: section.questions.map((question, qIdx) =>
            qIdx === questionIndex
              ? {
                  ...question,
                  contentMode: "IMAGE",
                  content: "",
                  contentImageUrl: dataUrl,
                }
              : question,
          ),
        };
      }),
    );
  };

  const clearQuestionImage = (sectionIndex: number, questionIndex: number) => {
    setSections((prev) =>
      prev.map((section, sIdx) => {
        if (sIdx !== sectionIndex) {
          return section;
        }

        return {
          ...section,
          questions: section.questions.map((question, qIdx) =>
            qIdx === questionIndex
              ? {
                  ...question,
                  contentMode: "TEXT",
                  contentImageUrl: null,
                }
              : question,
          ),
        };
      }),
    );
  };

  const setChoiceImage = async (
    sectionIndex: number,
    questionIndex: number,
    choiceIndex: number,
    file: File,
  ) => {
    const dataUrl = await readFileAsDataUrl(file);

    setSections((prev) =>
      prev.map((section, sIdx) => {
        if (sIdx !== sectionIndex) {
          return section;
        }

        return {
          ...section,
          questions: section.questions.map((question, qIdx) => {
            if (qIdx !== questionIndex) {
              return question;
            }

            return {
              ...question,
              choices: question.choices.map((choice, cIdx) =>
                cIdx === choiceIndex
                  ? {
                      ...choice,
                      mode: "IMAGE",
                      text: "",
                      imageUrl: dataUrl,
                    }
                  : choice,
              ),
            };
          }),
        };
      }),
    );
  };

  const clearChoiceImage = (
    sectionIndex: number,
    questionIndex: number,
    choiceIndex: number,
  ) => {
    setSections((prev) =>
      prev.map((section, sIdx) => {
        if (sIdx !== sectionIndex) {
          return section;
        }

        return {
          ...section,
          questions: section.questions.map((question, qIdx) => {
            if (qIdx !== questionIndex) {
              return question;
            }

            return {
              ...question,
              choices: question.choices.map((choice, cIdx) =>
                cIdx === choiceIndex
                  ? {
                      ...choice,
                      mode: "TEXT",
                      imageUrl: null,
                    }
                  : choice,
              ),
            };
          }),
        };
      }),
    );
  };

  const resetForm = () => {
    setEditingTestId(null);
    setTitle("");
    setDescription("");
    setLevel("TOPIK_I");
    setDurationMinutes(100);
    setIsPublished(false);
    setListeningAudioUrl(null);
    setDraftListeningAudioFile(null);
    setEditorSectionType("READING");
    setSectionDrafts(buildEmptyDrafts("READING"));
    setSectionLayout([]);
    setBulkImportType("READING");
    setBulkImportText("");
  };

  const importSectionFromText = () => {
    setError("");
    setSuccess("");

    try {
      const result = parseTopikBulkText(bulkImportText, bulkImportType);
      setSections((prev) =>
        prev.length === 1 && isSectionEmpty(prev[0]) ? [result.section] : [...prev, result.section],
      );
      setSuccess(
        result.warnings.length > 0
          ? `Секция импортирована в черновик. Вопросов: ${result.section.questions.length}. Проверьте правильные ответы вручную.`
          : `Секция импортирована в черновик. Вопросов: ${result.section.questions.length}.`,
      );
      setBulkImportText("");
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Не удалось импортировать секцию.");
    }
  };

  const createTest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const isEditing = Boolean(editingTestId);
      const mergedSections = buildMergedSections(sectionDrafts, sectionLayout);
      const endpoint = isEditing
        ? `/api/admin/topik/tests/${editingTestId}`
        : "/api/admin/topik/tests";

      const response = await fetch(endpoint, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          level,
          durationMinutes,
          isPublished,
          sections: mergedSections,
        }),
      });
      const data = (await response.json()) as SaveTestResponse;

      if (!response.ok) {
        setError(data.error ?? "Не удалось сохранить тест.");
        return;
      }

      if (isEditing) {
        setSuccess("Тест успешно обновлен.");
        await loadTests();
      } else {
        if (draftListeningAudioFile && data.id) {
          const uploaded = await uploadListeningAudio(draftListeningAudioFile, data.id);
          if (uploaded) {
            setSuccess("Тест успешно создан, аудио загружено.");
          } else {
            setSuccess("Тест создан. Аудио можно загрузить или заменить в списке тестов ниже.");
          }
        } else if (draftListeningAudioFile && !data.id) {
          setSuccess("Тест создан. Аудио можно загрузить в списке тестов ниже.");
        } else {
          setSuccess("Тест успешно создан.");
        }
        resetForm();
        await loadTests();
      }
    } catch {
      setError("Ошибка сети. Повторите попытку.");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = async (testId: string) => {
    setError("");
    setSuccess("");
    setLoadingTestId(testId);

    try {
      const response = await fetch(`/api/admin/topik/tests/${testId}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as AdminTestDetailResponse;

      if (!response.ok || !data.test) {
        setError(data.error ?? "Не удалось загрузить тест для редактирования.");
        return;
      }

      setEditingTestId(data.test.id);
      setTitle(data.test.title);
      setDescription(data.test.description ?? "");
      setLevel(data.test.level);
      setDurationMinutes(data.test.durationMinutes);
      setIsPublished(data.test.isPublished);
      setListeningAudioUrl(data.test.listeningAudioUrl);
      setDraftListeningAudioFile(null);
      const normalizedSections = data.test.sections.map((section) => ({
        ...section,
        questions: section.questions.map(normalizeQuestionForForm),
      }));
      const split = splitSectionsByType(normalizedSections);
      const initialType =
        split.drafts.READING.length > 0
          ? "READING"
          : split.drafts.LISTENING.length > 0
            ? "LISTENING"
            : "READING";

      setEditorSectionType(initialType);
      setBulkImportType(initialType);
      setSectionDrafts({
        READING:
          split.drafts.READING.length > 0 || initialType !== "READING"
            ? split.drafts.READING
            : [defaultSection("READING")],
        LISTENING:
          split.drafts.LISTENING.length > 0 || initialType !== "LISTENING"
            ? split.drafts.LISTENING
            : [defaultSection("LISTENING")],
      });
      setSectionLayout(split.layout);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Ошибка загрузки теста.");
    } finally {
      setLoadingTestId(null);
    }
  };

  const togglePublish = async (testId: string, value: boolean) => {
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/topik/tests/${testId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: value }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Не удалось изменить статус публикации.");
        return;
      }

      setTests((prev) =>
        prev.map((test) =>
          test.id === testId ? { ...test, isPublished: value } : test,
        ),
      );
    } catch {
      setError("Ошибка сети при смене статуса.");
    }
  };

  const uploadListeningAudio = async (
    file: File,
    targetTestId?: string,
  ): Promise<boolean> => {
    const testId = targetTestId ?? editingTestId;
    if (!testId) {
      setError("Сначала сохраните тест, затем загрузите аудио.");
      return false;
    }

    setUploadingAudio(true);
    setAudioBusyTestId(testId);
    setError("");
    setSuccess("");

    try {
      if (file.size > DIRECT_BLOB_UPLOAD_THRESHOLD_BYTES) {
        const blob = await upload(
          `topik-listening/${testId}-${Date.now()}-${sanitizeAudioFileName(file.name)}`,
          file,
          {
            access: "public",
            handleUploadUrl: `/api/admin/topik/tests/${testId}/listening-audio/client-upload`,
          },
        );

        const bindResponse = await fetch(
          `/api/admin/topik/tests/${testId}/listening-audio`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ listeningAudioUrl: blob.url }),
          },
        );
        const bindData = (await bindResponse.json()) as AudioUploadResponse;

        if (!bindResponse.ok) {
          setError(bindData.error ?? "Не удалось привязать загруженное аудио к тесту.");
          return false;
        }

        if (editingTestId === testId) {
          setListeningAudioUrl(bindData.listeningAudioUrl ?? blob.url);
        }
        setSuccess(bindData.message ?? "Аудиофайл успешно загружен.");
        await loadTests();
        return true;
      }

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `/api/admin/topik/tests/${testId}/listening-audio`,
        {
          method: "POST",
          body: formData,
        },
      );
      const data = (await response.json()) as AudioUploadResponse;

      if (!response.ok) {
        setError(data.error ?? "Не удалось загрузить аудио.");
        return false;
      }

      if (editingTestId === testId) {
        setListeningAudioUrl(data.listeningAudioUrl ?? null);
      }
      setSuccess(data.message ?? "Аудиофайл успешно загружен.");
      await loadTests();
      return true;
    } catch {
      setError("Ошибка сети при загрузке аудио.");
      return false;
    } finally {
      setUploadingAudio(false);
      setAudioBusyTestId(null);
    }
  };

  const removeListeningAudio = async (targetTestId?: string) => {
    const testId = targetTestId ?? editingTestId;
    if (!testId) {
      return;
    }

    setUploadingAudio(true);
    setAudioBusyTestId(testId);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/admin/topik/tests/${testId}/listening-audio`,
        {
          method: "DELETE",
        },
      );
      const data = (await response.json()) as AudioUploadResponse;

      if (!response.ok) {
        setError(data.error ?? "Не удалось удалить аудио.");
        return;
      }

      if (editingTestId === testId) {
        setListeningAudioUrl(null);
      }
      setSuccess("Аудиофайл удален.");
      await loadTests();
    } catch {
      setError("Ошибка сети при удалении аудио.");
    } finally {
      setUploadingAudio(false);
      setAudioBusyTestId(null);
    }
  };

  if (isLoading || !user) {
    return <AdminPageSkeleton />;
  }

  if (user.role !== "ADMIN") {
    return (
      <section className="py-10 md:py-14">
        <div className="site-shell">
          <div className="glass-card rounded-2xl px-5 py-5 text-sm text-red-600">
            Доступ запрещен.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-10 md:py-14">
      <div className="site-shell space-y-6">
        <article className="glass-card rounded-3xl px-6 py-7 md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[var(--accent-dark)]">Админ-панель TOPIK</p>
              <h1 className="mt-2 text-3xl font-black">Создание и публикация тестов</h1>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">
                Здесь можно создавать новые тесты с секциями, вопросами и правильными ответами.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/tests" className="primary-btn px-4 py-2 text-sm font-bold">
                Редактор тестов
              </Link>
              <Link href="/admin/tests/results" className="secondary-btn px-4 py-2 text-sm font-bold">
                Результаты студентов
              </Link>
            </div>
          </div>
        </article>

        <article className="glass-card rounded-3xl px-6 py-7 md:px-8">
          <h2 className="text-2xl font-black">
            {editingTestId ? "Редактирование теста" : "Новый тест"}
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Раздел: {sectionTypeLabel(editorSectionType)} • Секций: {totals.sections} • Вставных блоков: {totals.blocks} • Вопросов: {totals.questions}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["READING", "LISTENING"] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={`secondary-btn px-4 py-2 text-sm font-semibold ${
                  editorSectionType === type
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-dark)]"
                    : ""
                }`}
                onClick={() => switchEditorSectionType(type)}
              >
                {sectionTypeLabel(type)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--ink-soft)]">
            Сохраняется один TOPIK-тест. Сейчас вы редактируете только раздел {sectionTypeLabel(editorSectionType).toLowerCase()}, а секции другого типа сохраняются отдельно и не перезаписываются.
          </p>

	          <form className="mt-5 space-y-5" onSubmit={createTest}>
	            <div className="rounded-2xl border border-[var(--line)] bg-white/80 p-4">
	              <div className="flex flex-wrap items-center justify-between gap-3">
	                <div>
	                  <p className="text-sm font-black text-[var(--accent-dark)]">
	                    Импорт секции из текста
	                  </p>
	                  <p className="mt-1 text-xs text-[var(--ink-soft)]">
	                    Вставьте текст TOPIK, и система добавит новую секцию в текущий черновик. Уже сохранённые тесты не изменятся, пока вы не нажмёте кнопку сохранения.
	                  </p>
	                </div>
		                <select
		                  className="input-field w-full md:w-48"
		                  value={bulkImportType}
		                  onChange={(event) =>
                        switchEditorSectionType(event.target.value as SectionType)
                      }
		                >
	                  <option value="READING">Чтение</option>
	                  <option value="LISTENING">Аудирование</option>
	                </select>
	              </div>
	              <textarea
	                className="input-field mt-4 min-h-64"
	                value={bulkImportText}
	                onChange={(event) => setBulkImportText(event.target.value)}
	                placeholder="※ [1~3] ...&#10;1 질문...&#10;2점&#10;1&#10;답안..."
	              />
	              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
	                <p className="text-xs text-[var(--ink-soft)]">
	                  Сейчас импорт поддерживает текстовый формат TOPIK. Если в тексте нет ключей ответов, варианты будут добавлены, а правильные ответы нужно отметить вручную.
	                </p>
	                <button
	                  type="button"
	                  className="primary-btn px-5 py-2 text-sm"
	                  onClick={importSectionFromText}
	                >
	                  Добавить секцию из текста
	                </button>
	              </div>
	            </div>

	            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold">Название теста</label>
                <input
                  className="input-field"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="TOPIK I - Пробный тест №2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">Уровень</label>
                <select
                  className="input-field"
                  value={level}
                  onChange={(event) => setLevel(event.target.value as "TOPIK_I" | "TOPIK_II")}
                >
                  <option value="TOPIK_I">TOPIK I</option>
                  <option value="TOPIK_II">TOPIK II</option>
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold">Длительность (мин)</label>
                <input
                  className="input-field"
                  type="number"
                  min={1}
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(Number(event.target.value))}
                />
              </div>
              <label className="mt-7 inline-flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(event) => setIsPublished(event.target.checked)}
                />
                Опубликовать сразу
              </label>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold">Описание (опционально)</label>
              <textarea
                className="input-field min-h-24"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Описание теста для студентов"
              />
            </div>

            <div className="rounded-2xl border border-[var(--line)] bg-white/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-[var(--accent-dark)]">
                    Аудио для раздела аудирования
                  </p>
                  <p className="mt-1 text-xs text-[var(--ink-soft)]">
                    Один аудиофайл на весь раздел аудирования в этом тесте (TOPIK I/II).
                  </p>
                </div>
                {editingTestId ? (
                  <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs text-[var(--ink-soft)]">
                    ID теста: {editingTestId}
                  </span>
                ) : null}
              </div>

              {!editingTestId ? (
                <div className="mt-4 space-y-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--accent-dark)] transition-colors hover:border-[var(--line-strong)]">
                    <input
                      type="file"
                      accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm"
                      className="hidden"
                      disabled={uploadingAudio}
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setDraftListeningAudioFile(file);
                        event.currentTarget.value = "";
                      }}
                    />
                    Выбрать аудио для нового теста
                  </label>
                  {draftListeningAudioFile ? (
                    <div className="rounded-xl border border-[var(--line)] bg-white px-3 py-3">
                      <p className="text-sm text-slate-700">
                        Выбран файл: <strong>{draftListeningAudioFile.name}</strong>
                      </p>
                      <p className="mt-1 text-xs text-[var(--ink-soft)]">
                        Файл загрузится автоматически после нажатия «Создать тест».
                      </p>
                      <button
                        type="button"
                        className="secondary-btn mt-3 px-3 py-1 text-sm"
                        onClick={() => setDraftListeningAudioFile(null)}
                        disabled={uploadingAudio}
                      >
                        Убрать файл
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--ink-soft)]">
                      Можно выбрать аудио уже сейчас, оно прикрепится после создания теста.
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--accent-dark)] transition-colors hover:border-[var(--line-strong)]">
                    <input
                      type="file"
                      accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm"
                      className="hidden"
                      disabled={uploadingAudio}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          void uploadListeningAudio(file);
                        }
                        event.currentTarget.value = "";
                      }}
                    />
                    {uploadingAudio ? "Загрузка..." : "Загрузить / заменить аудио"}
                  </label>

                  {listeningAudioUrl ? (
                    <div className="rounded-xl border border-[var(--line)] bg-white p-3">
                      <audio controls preload="metadata" className="w-full">
                        <source src={listeningAudioUrl} />
                        Ваш браузер не поддерживает воспроизведение аудио.
                      </audio>
                      <button
                        type="button"
                        className="secondary-btn mt-3 px-3 py-1 text-sm"
                        onClick={() => void removeListeningAudio()}
                        disabled={uploadingAudio}
                      >
                        Удалить аудио
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--ink-soft)]">
                      Аудио еще не загружено.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {sections.map((section, sectionIndex) => (
                <article
                  key={`section-${sectionIndex}`}
                  className="rounded-2xl border border-[var(--line)] bg-white/80 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-black">Секция {sectionIndex + 1}</h3>
                    {sections.length > 1 ? (
                      <button
                        type="button"
                        className="secondary-btn px-3 py-1 text-sm"
                        onClick={() => removeSection(sectionIndex)}
                      >
                        Удалить секцию
                      </button>
                    ) : null}
                  </div>

	                  <div className="mt-3 grid gap-3 md:grid-cols-3">
	                    <div>
	                      <label className="mb-1 block text-sm font-semibold">Тип</label>
	                      <div className="input-field flex items-center bg-slate-50 text-[var(--ink-soft)]">
                          {sectionTypeLabel(section.type)}
                        </div>
	                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold">Название секции</label>
                      <input
                        className="input-field"
                        value={section.title}
                        onChange={(event) =>
                          updateSection(sectionIndex, "title", event.target.value)
                        }
                        placeholder="Аудирование"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold">Длительность</label>
                      <input
                        className="input-field"
                        type="number"
                        min={1}
                        value={section.durationMinutes}
                        onChange={(event) =>
                          updateSection(
                            sectionIndex,
                            "durationMinutes",
                            Number(event.target.value),
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] bg-white/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-black">Вставные блоки перед вопросами</p>
                      <button
                        type="button"
                        className="secondary-btn px-3 py-1 text-sm"
                        onClick={() => addBlock(sectionIndex)}
                      >
                        Добавить блок
                      </button>
                    </div>

                    {section.blocks.length === 0 ? (
                      <p className="mt-2 text-sm text-[var(--ink-soft)]">
                        Нет вставных блоков. Используй их для примеров, текста-подсказки или общего задания.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {section.blocks.map((block, blockIndex) => (
                          <div
                            key={`section-${sectionIndex}-block-${blockIndex}`}
                            className="rounded-xl border border-[var(--line)] bg-white p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-black">Блок {blockIndex + 1}</p>
                              <button
                                type="button"
                                className="secondary-btn px-3 py-1 text-xs"
                                onClick={() => removeBlock(sectionIndex, blockIndex)}
                              >
                                Удалить блок
                              </button>
                            </div>

                            <div className="mt-3 grid gap-3 md:grid-cols-3">
                              <div>
                                <label className="mb-1 block text-sm font-semibold">Тип блока</label>
                                <select
                                  className="input-field"
                                  value={block.variant}
                                  onChange={(event) =>
                                    updateBlock(
                                      sectionIndex,
                                      blockIndex,
                                      "variant",
                                      event.target.value as "EXAMPLE" | "PASSAGE" | "NOTICE",
                                    )
                                  }
                                >
                                  <option value="EXAMPLE">Пример</option>
                                  <option value="PASSAGE">Текст</option>
                                  <option value="NOTICE">Объявление</option>
                                </select>
                              </div>
                              <div>
                                <label className="mb-1 block text-sm font-semibold">Заголовок</label>
                                <input
                                  className="input-field"
                                  value={block.title}
                                  onChange={(event) =>
                                    updateBlock(sectionIndex, blockIndex, "title", event.target.value)
                                  }
                                  placeholder="보기 / Пример / Текст"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-sm font-semibold">
                                  Показывать перед вопросом
                                </label>
                                <input
                                  className="input-field"
                                  type="number"
                                  min={1}
                                  max={Math.max(1, section.questions.length)}
                                  value={block.displayBeforeQuestionOrder}
                                  onChange={(event) =>
                                    updateBlock(
                                      sectionIndex,
                                      blockIndex,
                                      "displayBeforeQuestionOrder",
                                      Number(event.target.value),
                                    )
                                  }
                                />
                              </div>
                            </div>

                            <div className="mt-3">
                              <label className="mb-1 block text-sm font-semibold">Содержимое блока</label>
                              <textarea
                                className="input-field min-h-28"
                                value={block.content}
                                onChange={(event) =>
                                  updateBlock(sectionIndex, blockIndex, "content", event.target.value)
                                }
                                placeholder="Текст образца, общий контекст или инструкция для нескольких вопросов"
                              />
                              <p className="mt-2 text-xs text-[var(--ink-soft)]">
                                Можно использовать <code>&lt;b&gt;...&lt;/b&gt;</code> для жирного
                                текста. Переносы строк сохраняются автоматически.
                              </p>
                              {block.content.trim() ? (
                                <div className="mt-3 rounded-xl border border-[var(--line)] bg-slate-50 px-4 py-3">
                                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent-dark)]">
                                    Предпросмотр
                                  </p>
                                  <div
                                    className="mt-2 text-sm leading-relaxed text-slate-800"
                                    dangerouslySetInnerHTML={{
                                      __html: renderTopikRichText(block.content),
                                    }}
                                  />
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 space-y-3">
                    {section.questions.map((question, questionIndex) => (
                      <div
                        key={`section-${sectionIndex}-question-${questionIndex}`}
                        className="rounded-xl border border-[var(--line)] bg-white p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-black">Вопрос {questionIndex + 1}</p>
                          {section.questions.length > 1 ? (
                            <button
                              type="button"
                              className="secondary-btn px-3 py-1 text-xs"
                              onClick={() => removeQuestion(sectionIndex, questionIndex)}
                            >
                              Удалить вопрос
                            </button>
                          ) : null}
                        </div>

                        <div className="mt-2 grid gap-3 md:grid-cols-[1fr_130px]">
                          <input
                            className="input-field"
                            value={question.prompt}
                            onChange={(event) =>
                              updateQuestion(
                                sectionIndex,
                                questionIndex,
                                "prompt",
                                event.target.value,
                              )
                            }
                            placeholder="Текст вопроса"
                          />
                          <input
                            className="input-field"
                            type="number"
                            min={1}
                            value={question.points}
                            onChange={(event) =>
                              updateQuestion(
                                sectionIndex,
                                questionIndex,
                                "points",
                                Number(event.target.value),
                              )
                            }
                            placeholder="Баллы"
                          />
                        </div>

                        <div className="mt-3 space-y-3">
                          <label className="mb-1 block text-sm font-semibold">
                            Текст задания / пассаж / содержимое вопроса
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className={`secondary-btn px-3 py-1 text-xs font-semibold ${
                                question.contentMode === "TEXT"
                                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-dark)]"
                                  : ""
                              }`}
                              onClick={() =>
                                setQuestionContentMode(sectionIndex, questionIndex, "TEXT")
                              }
                            >
                              Текст
                            </button>
                            <button
                              type="button"
                              className={`secondary-btn px-3 py-1 text-xs font-semibold ${
                                question.contentMode === "IMAGE"
                                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-dark)]"
                                  : ""
                              }`}
                              onClick={() =>
                                setQuestionContentMode(sectionIndex, questionIndex, "IMAGE")
                              }
                            >
                              Изображение
                            </button>
                          </div>

                          {question.contentMode === "TEXT" ? (
                            <textarea
                              className="input-field min-h-24"
                              value={question.content}
                              onChange={(event) =>
                                updateQuestion(
                                  sectionIndex,
                                  questionIndex,
                                  "content",
                                  event.target.value,
                                )
                              }
                              placeholder="Текст, который показывается внутри вопроса перед вариантами ответа"
                            />
                          ) : (
                            <div className="rounded-xl border border-[var(--line)] bg-slate-50 p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="secondary-btn cursor-pointer px-3 py-1 text-xs font-semibold">
                                  <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                                    className="hidden"
                                    onChange={(event) => {
                                      const file = event.target.files?.[0];
                                      if (!file) {
                                        return;
                                      }

                                      void setQuestionImage(sectionIndex, questionIndex, file).catch(
                                        () => {
                                          setError("Ошибка чтения изображения.");
                                        },
                                      );
                                      event.currentTarget.value = "";
                                    }}
                                  />
                                  Загрузить изображение
                                </label>
                                {question.contentImageUrl ? (
                                  <button
                                    type="button"
                                    className="secondary-btn px-3 py-1 text-xs font-semibold"
                                    onClick={() => clearQuestionImage(sectionIndex, questionIndex)}
                                  >
                                    Удалить изображение
                                  </button>
                                ) : null}
                              </div>

                              {question.contentImageUrl ? (
                                <div className="mt-3 flex min-h-72 items-center justify-center rounded-xl border border-[var(--line)] bg-white p-3">
                                  <img
                                    src={question.contentImageUrl}
                                    alt={`Preview question ${questionIndex + 1}`}
                                    className="max-h-72 w-full rounded-xl object-contain"
                                  />
                                </div>
                              ) : (
                                <p className="mt-3 text-sm text-[var(--ink-soft)]">
                                  Форматы: PNG, JPG, WEBP, GIF или SVG. Изображение будет показано вместо текста внутри вопроса.
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="mt-3 space-y-3">
                          {question.choices.map((choice, choiceIndex) => (
                            <div
                              key={`choice-${choiceIndex}`}
                              className={`cursor-pointer rounded-xl border p-3 transition-colors ${
                                question.correctChoiceIndex === choiceIndex
                                  ? "border-[var(--accent)] bg-[var(--accent-soft)]/40"
                                  : "border-[var(--line)] bg-slate-50 hover:border-[var(--line-strong)]"
                              }`}
                              onClick={() =>
                                updateQuestion(
                                  sectionIndex,
                                  questionIndex,
                                  "correctChoiceIndex",
                                  choiceIndex,
                                )
                              }
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <label className="flex items-center gap-2 text-sm font-semibold">
                                  <input
                                    type="radio"
                                    name={`correct-${sectionIndex}-${questionIndex}`}
                                    checked={question.correctChoiceIndex === choiceIndex}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={() =>
                                      updateQuestion(
                                        sectionIndex,
                                        questionIndex,
                                        "correctChoiceIndex",
                                        choiceIndex,
                                      )
                                    }
                                  />
                                </label>

                                {section.type === "LISTENING" ? (
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      className={`secondary-btn px-3 py-1 text-xs font-semibold ${
                                        choice.mode === "TEXT"
                                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-dark)]"
                                          : ""
                                      }`}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setChoiceMode(
                                          sectionIndex,
                                          questionIndex,
                                          choiceIndex,
                                          "TEXT",
                                        );
                                      }}
                                    >
                                      Текст
                                    </button>
                                    <button
                                      type="button"
                                      className={`secondary-btn px-3 py-1 text-xs font-semibold ${
                                        choice.mode === "IMAGE"
                                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-dark)]"
                                          : ""
                                      }`}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setChoiceMode(
                                          sectionIndex,
                                          questionIndex,
                                          choiceIndex,
                                          "IMAGE",
                                        );
                                      }}
                                    >
                                      Изображение
                                    </button>
                                  </div>
                                ) : null}
                              </div>

                              {section.type === "LISTENING" && choice.mode === "IMAGE" ? (
                                <div className="mt-3 rounded-xl border border-[var(--line)] bg-white p-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <label className="secondary-btn cursor-pointer px-3 py-1 text-xs font-semibold">
                                      <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                                        className="hidden"
                                        onClick={(event) => event.stopPropagation()}
                                        onChange={(event) => {
                                          const file = event.target.files?.[0];
                                          if (!file) {
                                            return;
                                          }

                                          void setChoiceImage(
                                            sectionIndex,
                                            questionIndex,
                                            choiceIndex,
                                            file,
                                          ).catch(() => {
                                            setError("Ошибка чтения изображения ответа.");
                                          });
                                          event.currentTarget.value = "";
                                        }}
                                      />
                                      Загрузить изображение
                                    </label>
                                    {choice.imageUrl ? (
                                      <button
                                        type="button"
                                        className="secondary-btn px-3 py-1 text-xs font-semibold"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          clearChoiceImage(
                                            sectionIndex,
                                            questionIndex,
                                            choiceIndex,
                                          );
                                        }}
                                      >
                                        Удалить изображение
                                      </button>
                                    ) : null}
                                  </div>

                                  {choice.imageUrl ? (
                                    <div className="mt-3 flex min-h-56 items-center justify-center rounded-xl border border-[var(--line)] bg-white p-3">
                                      <img
                                        src={choice.imageUrl}
                                        alt={`Preview answer ${choiceIndex + 1}`}
                                        className="max-h-56 w-full rounded-xl object-contain"
                                      />
                                    </div>
                                  ) : (
                                    <p className="mt-3 text-sm text-[var(--ink-soft)]">
                                      Для ответа с картинкой текст не требуется.
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <input
                                  className="input-field mt-3"
                                  value={choice.text}
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={(event) =>
                                    updateChoice(
                                      sectionIndex,
                                      questionIndex,
                                      choiceIndex,
                                      "text",
                                      event.target.value,
                                    )
                                  }
                                  placeholder={`Вариант ${choiceIndex + 1}`}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="secondary-btn mt-4 px-4 py-2 text-sm font-semibold"
                    onClick={() => addQuestion(sectionIndex)}
                  >
                    Добавить вопрос
                  </button>
                </article>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
	              <button
	                type="button"
	                className="secondary-btn px-4 py-2 text-sm font-semibold"
	                onClick={addSection}
	              >
	                Добавить секцию {sectionTypeLabel(editorSectionType).toLowerCase()}
	              </button>
              <button
                type="submit"
                disabled={submitting}
                className="primary-btn px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? "Сохраняем..."
                  : editingTestId
                    ? "Сохранить изменения"
                    : "Создать тест"}
              </button>
              {editingTestId ? (
                <button
                  type="button"
                  className="secondary-btn px-4 py-2 text-sm font-semibold"
                  onClick={resetForm}
                >
                  Отменить редактирование
                </button>
              ) : null}
            </div>
          </form>
        </article>

        {error ? <div className="error-text">{error}</div> : null}
        {success ? <div className="text-sm font-semibold text-green-700">{success}</div> : null}

        <article className="glass-card rounded-3xl px-6 py-7 md:px-8">
          <h2 className="text-2xl font-black">Существующие тесты</h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Кнопка «Аудио» позволяет быстро загрузить или заменить файл без редактирования структуры теста.
          </p>
          {testsLoading ? (
            <TestListSkeleton />
          ) : tests.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--ink-soft)]">Пока нет тестов.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {tests.map((test) => (
                <li
                  key={test.id}
                  className="rounded-xl border border-[var(--line)] bg-white/85 px-4 py-3 transition-colors hover:border-[var(--line-strong)]"
                  onClick={() => void startEdit(test.id)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-bold">
                        {test.title} ({levelLabel(test.level)})
                      </p>
                      <p className="text-sm text-[var(--ink-soft)]">
                        {test.durationMinutes} мин • Секций: {test.sections.length}
                      </p>
                      <p className="text-xs text-[var(--ink-soft)]">
                        Аудио аудирования: {test.listeningAudioUrl ? "загружено" : "не загружено"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="secondary-btn cursor-pointer px-3 py-1 text-xs font-semibold">
                        <input
                          type="file"
                          accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm"
                          className="hidden"
                          disabled={uploadingAudio}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => {
                            event.stopPropagation();
                            const file = event.target.files?.[0];
                            if (file) {
                              void uploadListeningAudio(file, test.id);
                            }
                            event.currentTarget.value = "";
                          }}
                        />
                        {audioBusyTestId === test.id ? "Загрузка аудио..." : "Аудио"}
                      </label>
                      {test.listeningAudioUrl ? (
                        <button
                          type="button"
                          className="secondary-btn px-3 py-1 text-xs font-semibold"
                          onClick={(event) => {
                            event.stopPropagation();
                            void removeListeningAudio(test.id);
                          }}
                          disabled={uploadingAudio}
                        >
                          Удалить аудио
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="secondary-btn px-3 py-1 text-xs font-semibold"
                        onClick={(event) => {
                          event.stopPropagation();
                          void startEdit(test.id);
                        }}
                        disabled={loadingTestId === test.id}
                      >
                        {loadingTestId === test.id ? "Загрузка..." : "Редактировать"}
                      </button>
                      <button
                      type="button"
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        test.isPublished
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void togglePublish(test.id, !test.isPublished);
                      }}
                    >
                      {test.isPublished ? "Опубликован" : "Черновик"}
                    </button>
                  </div>
                  </div>
                  <ul className="mt-2 text-sm text-[var(--ink-soft)]">
                    {test.sections.map((section) => (
                      <li key={section.id}>
                        • {section.title} ({sectionTypeLabel(section.type)}) - {section.questionCount} вопросов
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
