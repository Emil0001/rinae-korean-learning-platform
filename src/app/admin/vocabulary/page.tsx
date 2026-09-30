"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { parseVocabularyBulkText } from "@/lib/vocabulary-bulk-import";
import type { VocabularyLevel } from "@/lib/vocabulary";
import type { AIProvider } from "@/lib/ai/provider";

type VocabularyWord = {
  id: string;
  korean: string;
  transcription: string | null;
  translation: string;
  exampleKorean: string | null;
  exampleRussian: string | null;
  category: string | null;
  level: VocabularyLevel;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type VocabularyResponse = {
  words?: VocabularyWord[];
  word?: VocabularyWord;
  error?: string;
};

type AIVocabularyDraft = Omit<VocabularyWord, "id" | "isActive" | "createdAt" | "updatedAt">;

const defaultForm = {
  korean: "",
  transcription: "",
  translation: "",
  exampleKorean: "",
  exampleRussian: "",
  category: "",
  level: "BEGINNER" as VocabularyLevel,
  isActive: true,
};

const normalizeIdentityPart = (value: string) => value.trim().toLocaleLowerCase("ru-RU").replace(/\s+/g, " ");
const vocabularyIdentity = (word: Pick<VocabularyWord, "korean" | "translation">) => `${normalizeIdentityPart(word.korean)}\u0000${normalizeIdentityPart(word.translation)}`;

export default function AdminVocabularyPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [loadingWords, setLoadingWords] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [importPending, setImportPending] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [bulkText, setBulkText] = useState("");
  const [aiProvider, setAiProvider] = useState<AIProvider>("openai");
  const [aiTopic, setAiTopic] = useState("Повседневная жизнь");
  const [aiCount, setAiCount] = useState(8);
  const [aiInstructions, setAiInstructions] = useState("");
  const [aiPending, setAiPending] = useState(false);
  const [aiSavePending, setAiSavePending] = useState(false);
  const [aiDraftWords, setAiDraftWords] = useState<AIVocabularyDraft[]>([]);
  const [aiExamplePendingId, setAiExamplePendingId] = useState<string | null>(null);
  const [bulkExamplePending, setBulkExamplePending] = useState(false);
  const [bulkExampleProgress, setBulkExampleProgress] = useState({ completed: 0, total: 0 });

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/auth/login");
      return;
    }

    if (!isLoading && user && user.role !== "ADMIN") {
      router.replace("/dashboard");
    }
  }, [isLoading, router, user]);

  const loadWords = async () => {
    setLoadingWords(true);
    try {
      const response = await fetch("/api/admin/vocabulary", { cache: "no-store" });
      const data = (await response.json()) as VocabularyResponse;

      if (!response.ok) {
        setError(data.error ?? "Не удалось загрузить словарь.");
        setWords([]);
        return;
      }

      setWords(data.words ?? []);
    } catch {
      setError("Не удалось загрузить словарь.");
      setWords([]);
    } finally {
      setLoadingWords(false);
    }
  };

  useEffect(() => {
    if (user?.role === "ADMIN") {
      void loadWords();
    }
  }, [user?.role]);

  const activeCount = useMemo(() => words.filter((word) => word.isActive).length, [words]);
  const wordsMissingExamples = useMemo(() => words.filter((word) => !word.exampleKorean?.trim() || !word.exampleRussian?.trim()), [words]);
  const duplicateAiDraftIndexes = useMemo(() => {
    const existing = new Set(words.map(vocabularyIdentity));
    const seen = new Set<string>();
    const duplicates = new Set<number>();
    aiDraftWords.forEach((word, index) => {
      const identity = vocabularyIdentity(word);
      if (existing.has(identity) || seen.has(identity)) duplicates.add(index);
      seen.add(identity);
    });
    return duplicates;
  }, [aiDraftWords, words]);

  const resetForm = () => {
    setEditingId(null);
    setForm(defaultForm);
  };

  const submitWord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");

    try {
      const endpoint = editingId ? `/api/admin/vocabulary/${editingId}` : "/api/admin/vocabulary";
      const method = editingId ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as VocabularyResponse;

      if (!response.ok || !data.word) {
        setError(data.error ?? "Не удалось сохранить слово.");
        return;
      }

      setSuccess(editingId ? "Слово обновлено." : "Слово добавлено.");
      resetForm();
      await loadWords();
    } catch {
      setError("Не удалось сохранить слово.");
    } finally {
      setPending(false);
    }
  };

  const submitBulkImport = async () => {
    setImportPending(true);
    setError("");
    setSuccess("");

    try {
      const importedWords = parseVocabularyBulkText(bulkText, form.level, form.category || undefined);

      for (const word of importedWords) {
        const response = await fetch("/api/admin/vocabulary", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(word),
        });
        const data = (await response.json()) as VocabularyResponse;

        if (!response.ok || !data.word) {
          throw new Error(data.error ?? `Не удалось импортировать слово ${word.korean}.`);
        }
      }

      setBulkText("");
      setSuccess(`Импортировано слов: ${importedWords.length}.`);
      await loadWords();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Не удалось импортировать слова.");
    } finally {
      setImportPending(false);
    }
  };

  const generateWithAI = async () => {
    setAiPending(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/vocabulary/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: aiProvider, topic: aiTopic, level: form.level, count: aiCount, instructions: aiInstructions }),
      });
      const data = await response.json() as { words?: AIVocabularyDraft[]; error?: string };
      if (!response.ok || !data.words?.length) throw new Error(data.error ?? "AI не создал слова.");
      setAiDraftWords(data.words);
      setSuccess(`AI подготовил ${data.words.length} слов. Проверьте карточки перед сохранением.`);
    } catch (aiError) {
      setError(aiError instanceof Error ? aiError.message : "Не удалось создать слова через AI.");
    } finally {
      setAiPending(false);
    }
  };

  const saveAiDrafts = async () => {
    if (!aiDraftWords.length) return;
    if (duplicateAiDraftIndexes.size) {
      setError("Удалите отмеченные дубликаты перед сохранением набора.");
      return;
    }
    setAiSavePending(true);
    setError("");
    setSuccess("");
    try {
      for (const word of aiDraftWords) {
        const response = await fetch("/api/admin/vocabulary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...word, isActive: true }),
        });
        const data = await response.json() as VocabularyResponse;
        if (!response.ok || !data.word) throw new Error(data.error ?? `Не удалось сохранить ${word.korean}.`);
      }
      const savedCount = aiDraftWords.length;
      setAiDraftWords([]);
      setSuccess(`Сохранено AI-слов: ${savedCount}.`);
      await loadWords();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить AI-набор.");
    } finally {
      setAiSavePending(false);
    }
  };

  const generateExampleForWord = async (word: VocabularyWord) => {
    setAiExamplePendingId(word.id);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/vocabulary/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "example", provider: aiProvider, korean: word.korean, translation: word.translation,
          transcription: word.transcription, category: word.category, level: word.level,
        }),
      });
      const data = await response.json() as { example?: { exampleKorean: string; exampleRussian: string }; error?: string };
      if (!response.ok || !data.example) throw new Error(data.error ?? "AI не создал пример.");
      setEditingId(word.id);
      setForm({
        korean: word.korean, transcription: word.transcription ?? "", translation: word.translation,
        exampleKorean: data.example.exampleKorean, exampleRussian: data.example.exampleRussian,
        category: word.category ?? "", level: word.level, isActive: word.isActive,
      });
      setSuccess("AI подготовил пример. Проверьте его и нажмите «Обновить слово».");
      window.setTimeout(() => document.getElementById("vocabulary-word-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    } catch (exampleError) {
      setError(exampleError instanceof Error ? exampleError.message : "Не удалось создать пример через AI.");
    } finally {
      setAiExamplePendingId(null);
    }
  };

  const generateAllMissingExamples = async () => {
    if (!wordsMissingExamples.length || bulkExamplePending) return;
    setBulkExamplePending(true);
    setError("");
    setSuccess("");
    setBulkExampleProgress({ completed: 0, total: wordsMissingExamples.length });
    let completed = 0;
    let updated = 0;
    const failedWords: string[] = [];
    try {
      for (let index = 0; index < wordsMissingExamples.length; index += 10) {
        const batch = wordsMissingExamples.slice(index, index + 10);
        try {
          const response = await fetch("/api/admin/vocabulary/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "bulk-examples", provider: aiProvider, level: "BEGINNER", wordIds: batch.map((word) => word.id) }),
          });
          const data = await response.json() as { updated?: number; generatedIds?: string[]; error?: string };
          if (!response.ok) throw new Error(data.error ?? "Не удалось создать пакет примеров.");
          updated += data.updated ?? 0;
          const generatedIds = new Set(data.generatedIds ?? []);
          failedWords.push(...batch.filter((word) => !generatedIds.has(word.id)).map((word) => word.korean));
        } catch {
          failedWords.push(...batch.map((word) => word.korean));
        }
        completed += batch.length;
        setBulkExampleProgress({ completed, total: wordsMissingExamples.length });
      }
      await loadWords();
      if (failedWords.length) {
        setError(`Создано примеров: ${updated}. Не удалось обработать ${failedWords.length}: ${failedWords.slice(0, 6).join(", ")}${failedWords.length > 6 ? "…" : ""}`);
      } else {
        setSuccess(`Готово! AI добавил примеры для ${updated} слов.`);
      }
    } finally {
      setBulkExamplePending(false);
    }
  };

  if (isLoading || !user) {
    return (
      <section className="py-10 md:py-14">
        <div className="site-shell">
          <div className="glass-card rounded-2xl px-5 py-5 text-sm text-[var(--ink-soft)]">Загрузка...</div>
        </div>
      </section>
    );
  }

  if (user.role !== "ADMIN") {
    return null;
  }

  return (
    <section className="py-10 md:py-14">
      <div className="site-shell space-y-6">
        <article className="glass-card rounded-3xl px-6 py-7 md:px-8">
          <p className="text-sm font-semibold text-[var(--accent-dark)]">Админ-панель словаря</p>
          <h1 className="mt-2 text-3xl font-black">Корейско-русские карточки</h1>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Здесь вы задаёте базу слов, которую потом увидят студенты в личном словаре.
          </p>
          <p className="mt-3 text-sm text-[var(--ink-soft)]">
            Всего слов: {words.length} • Активных: {activeCount}
          </p>
        </article>

        <article className="glass-card rounded-3xl px-6 py-7 md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-violet-600">AI-помощник</p>
              <h2 className="mt-2 text-2xl font-black">Создать набор слов</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-soft)]">OpenAI или Gemini подготовит корейские слова, русскую транскрипцию, перевод и короткие примеры. Результат сначала попадёт в черновик — ничего не сохраняется без вашей проверки.</p>
            </div>
            <span className="rounded-full bg-violet-100 px-4 py-2 text-xs font-black text-violet-700">✨ Черновик с проверкой</span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-1 text-sm font-semibold">Провайдер<select className="input-field" value={aiProvider} onChange={(event) => setAiProvider(event.target.value as AIProvider)}><option value="openai">OpenAI</option><option value="gemini">Gemini</option></select></label>
            <label className="grid gap-1 text-sm font-semibold">Тема<input className="input-field" value={aiTopic} onChange={(event) => setAiTopic(event.target.value)} placeholder="Еда, путешествия, TOPIK..." /></label>
            <label className="grid gap-1 text-sm font-semibold">Количество<select className="input-field" value={aiCount} onChange={(event) => setAiCount(Number(event.target.value))}>{[5,8,10,15,20].map((count) => <option key={count} value={count}>{count} слов</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold">Уровень<select className="input-field" value={form.level} onChange={(event) => setForm((prev) => ({ ...prev, level: event.target.value as VocabularyLevel }))}><option value="BEGINNER">Начальный</option><option value="INTERMEDIATE">Средний</option><option value="ADVANCED">Продвинутый</option></select></label>
          </div>
          <label className="mt-3 grid gap-1 text-sm font-semibold">Пожелания<textarea className="input-field min-h-24" value={aiInstructions} onChange={(event) => setAiInstructions(event.target.value)} placeholder="Например: только частотные слова, без заимствований..." /></label>
          <button type="button" disabled={aiPending} className="primary-btn mt-4 px-6 py-3 text-sm font-black" onClick={() => void generateWithAI()}>{aiPending ? "Создаём набор..." : `✨ Создать через ${aiProvider === "openai" ? "OpenAI" : "Gemini"}`}</button>
          {aiDraftWords.length ? <div className="mt-6 rounded-3xl border border-violet-200 bg-violet-50/70 p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-black">Черновик · {aiDraftWords.length} слов</h3><p className="mt-1 text-sm text-[var(--ink-soft)]">Удалите неподходящие карточки и отмеченные дубликаты. Сохраняется только проверенный набор.</p></div><button type="button" disabled={aiSavePending || duplicateAiDraftIndexes.size > 0} className="primary-btn px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void saveAiDrafts()}>{aiSavePending ? "Сохраняем..." : "Сохранить весь набор"}</button></div>
            {duplicateAiDraftIndexes.size ? <p className="mt-3 rounded-xl bg-amber-100 px-4 py-3 text-sm font-bold text-amber-800">Найдено дубликатов: {duplicateAiDraftIndexes.size}. Они не будут сохранены, пока вы их не удалите.</p> : null}
            <div className="mt-4 grid gap-3 lg:grid-cols-2">{aiDraftWords.map((word, index) => <article key={`${word.korean}-${index}`} className={`rounded-2xl border bg-white/90 p-4 shadow-sm ${duplicateAiDraftIndexes.has(index) ? "border-amber-400 ring-2 ring-amber-100" : "border-white"}`}>
              <div className="flex items-start justify-between gap-3"><div><strong className="text-xl font-black">{word.korean}</strong><span className="ml-2 text-sm text-[var(--ink-soft)]">[{word.transcription}]</span><p className="mt-1 font-bold">{word.translation}</p>{duplicateAiDraftIndexes.has(index) ? <span className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">Уже есть в словаре или наборе</span> : null}</div><button type="button" className="rounded-full border border-rose-200 px-3 py-1 text-xs font-bold text-rose-600" onClick={() => setAiDraftWords((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Убрать</button></div>
              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><p className="font-semibold">{word.exampleKorean}</p><p className="mt-1 text-[var(--ink-soft)]">{word.exampleRussian}</p></div><p className="mt-2 text-xs font-bold text-violet-600">{word.category} · {word.level}</p>
            </article>)}</div>
          </div> : null}
        </article>

        <article className="glass-card rounded-3xl px-6 py-7 md:px-8">
          <h2 className="text-2xl font-black">Быстрый импорт списка</h2>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Вставьте список в формате <span className="font-semibold">корейское слово — [транскрипция] — перевод</span>.
            Отдельные строки без тире будут автоматически считаться названиями категорий.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold">Уровень для импорта</label>
              <select
                className="input-field"
                value={form.level}
                onChange={(event) => setForm((prev) => ({ ...prev, level: event.target.value as VocabularyLevel }))}
              >
                <option value="BEGINNER">Начальный</option>
                <option value="INTERMEDIATE">Средний</option>
                <option value="ADVANCED">Продвинутый</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Категория по умолчанию</label>
              <input
                className="input-field"
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                placeholder="Используется, если в тексте нет заголовков"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-semibold">Список слов</label>
            <textarea
              className="input-field min-h-[16rem]"
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
              placeholder={"Home\n사람/분 — [сарам/пун] — человек\n가족 — [каджок] — семья\n\nFood\n사과 — [сагва] — яблоко"}
            />
          </div>
          <pre className="mt-3 overflow-x-auto rounded-2xl border border-[var(--line)] bg-white/75 px-4 py-3 text-xs text-[var(--ink-soft)]">
{`Home
사람/분 — [сарам/пун] — человек
가족 — [каджок] — семья

Food
사과 — [сагва] — яблоко`}
          </pre>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={importPending}
              className="primary-btn px-5 py-3 text-sm font-bold"
              onClick={() => void submitBulkImport()}
            >
              {importPending ? "Импортируем..." : "Импортировать список"}
            </button>
          </div>
        </article>

        <article id="vocabulary-word-form" className="glass-card scroll-mt-6 rounded-3xl px-6 py-7 md:px-8">
          <h2 className="text-2xl font-black">{editingId ? "Редактирование слова" : "Новое слово"}</h2>
          <form className="mt-5 space-y-4" onSubmit={submitWord}>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold">Корейское слово</label>
                <input
                  className="input-field"
                  value={form.korean}
                  onChange={(event) => setForm((prev) => ({ ...prev, korean: event.target.value }))}
                  placeholder="사과"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">Перевод</label>
                <input
                  className="input-field"
                  value={form.translation}
                  onChange={(event) => setForm((prev) => ({ ...prev, translation: event.target.value }))}
                  placeholder="яблоко"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-semibold">Транскрипция</label>
                <input
                  className="input-field"
                  value={form.transcription}
                  onChange={(event) => setForm((prev) => ({ ...prev, transcription: event.target.value }))}
                  placeholder="сагва"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">Категория</label>
                <input
                  className="input-field"
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                  placeholder="Еда / TOPIK I / Повседневное"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">Уровень</label>
                <select
                  className="input-field"
                  value={form.level}
                  onChange={(event) => setForm((prev) => ({ ...prev, level: event.target.value as VocabularyLevel }))}
                >
                  <option value="BEGINNER">Начальный</option>
                  <option value="INTERMEDIATE">Средний</option>
                  <option value="ADVANCED">Продвинутый</option>
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div><label className="mb-1 block text-sm font-semibold">Пример на корейском</label><input className="input-field" value={form.exampleKorean} onChange={(event) => setForm((prev) => ({ ...prev, exampleKorean: event.target.value }))} placeholder="학교에 가요." /></div>
              <div><label className="mb-1 block text-sm font-semibold">Перевод примера</label><input className="input-field" value={form.exampleRussian} onChange={(event) => setForm((prev) => ({ ...prev, exampleRussian: event.target.value }))} placeholder="Я иду в школу." /></div>
            </div>

            <label className="inline-flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
              />
              Показывать студентам
            </label>

            {error ? <p className="error-text">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

            <div className="flex flex-wrap gap-3">
              <button disabled={pending} className="primary-btn px-5 py-3 text-sm font-bold" type="submit">
                {pending ? "Сохраняем..." : editingId ? "Обновить слово" : "Добавить слово"}
              </button>
              {editingId ? (
                <button type="button" className="secondary-btn px-5 py-3 text-sm font-semibold" onClick={resetForm}>
                  Отменить редактирование
                </button>
              ) : null}
            </div>
          </form>
        </article>

        <article className="glass-card rounded-3xl px-6 py-7 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-2xl font-black">Слова в системе</h2><p className="mt-1 text-sm text-[var(--ink-soft)]">Без полного примера: {wordsMissingExamples.length}</p></div>
            <button type="button" disabled={!wordsMissingExamples.length || bulkExamplePending} className="primary-btn px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void generateAllMissingExamples()}>
              {bulkExamplePending ? `✨ Создаём ${bulkExampleProgress.completed} / ${bulkExampleProgress.total}` : `✨ Создать все недостающие через ${aiProvider === "openai" ? "OpenAI" : "Gemini"}`}
            </button>
          </div>
          {bulkExamplePending ? <div className="mt-4 h-2 overflow-hidden rounded-full bg-violet-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-[width] duration-300" style={{ width: `${bulkExampleProgress.total ? (bulkExampleProgress.completed / bulkExampleProgress.total) * 100 : 0}%` }} /></div> : null}
          {loadingWords ? (
            <p className="mt-3 text-sm text-[var(--ink-soft)]">Загрузка списка...</p>
          ) : words.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--ink-soft)]">Пока нет слов.</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {words.map((word) => (
                <article key={word.id} className="rounded-2xl border border-[var(--line)] bg-white/85 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xl font-black">{word.korean}</p>
                        {word.transcription ? <span className="text-sm font-medium text-[var(--ink-soft)]">[{word.transcription}]</span> : null}
                        <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-dark)]">
                          {word.level}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${word.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                          {word.isActive ? "Активно" : "Скрыто"}
                        </span>
                      </div>
                      <p className="mt-2 text-base text-slate-800">{word.translation}</p>
                      <p className="mt-1 text-sm text-[var(--ink-soft)]">
                        {word.category ? `Категория: ${word.category}` : "Без категории"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2"><button type="button" disabled={aiExamplePendingId === word.id} className="secondary-btn px-4 py-2 text-sm font-semibold disabled:opacity-60" onClick={() => void generateExampleForWord(word)}>
                      {aiExamplePendingId === word.id ? "AI создаёт..." : word.exampleKorean && word.exampleRussian ? "✨ Новый AI-пример" : "✨ Создать AI-пример"}
                    </button><button
                      type="button"
                      className="secondary-btn px-4 py-2 text-sm font-semibold"
                      onClick={() => {
                        setEditingId(word.id);
                        setForm({
                          korean: word.korean,
                          transcription: word.transcription ?? "",
                          translation: word.translation,
                          exampleKorean: word.exampleKorean ?? "",
                          exampleRussian: word.exampleRussian ?? "",
                          category: word.category ?? "",
                          level: word.level,
                          isActive: word.isActive,
                        });
                        window.setTimeout(() => document.getElementById("vocabulary-word-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
                      }}
                    >
                      Редактировать
                    </button></div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
