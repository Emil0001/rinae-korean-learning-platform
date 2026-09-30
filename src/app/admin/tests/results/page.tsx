"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import type { AdminTopikResultsResponse, AdminTopikStudentResult, TopikLevel } from "@/types/topik";

function levelLabel(level: TopikLevel) {
  return level === "TOPIK_I" ? "TOPIK I" : "TOPIK II";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminTopikResultsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [students, setStudents] = useState<AdminTopikStudentResult[]>([]);
  const [totals, setTotals] = useState<{ students: number; attempts: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/auth/login");
      return;
    }

    if (!isLoading && user && user.role !== "ADMIN") {
      router.replace("/dashboard");
    }
  }, [isLoading, router, user]);

  useEffect(() => {
    if (user?.role !== "ADMIN") {
      return;
    }

    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/admin/topik/results", { cache: "no-store" });
        const payload = (await response.json()) as AdminTopikResultsResponse;

        if (!active) {
          return;
        }

        if (!response.ok || !payload.students || !payload.totals) {
          setError(payload.error ?? "Не удалось загрузить результаты TOPIK.");
          return;
        }

        setStudents(payload.students);
        setTotals(payload.totals);
      } catch {
        if (active) {
          setError("Не удалось загрузить результаты TOPIK.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [user?.role]);

  const topStudent = useMemo(() => students[0] ?? null, [students]);

  if (isLoading || loading) {
    return (
      <section className="py-10 md:py-14">
        <div className="site-shell">
          <div className="glass-card rounded-3xl px-6 py-10 text-sm text-[var(--ink-soft)]">
            Загружаем результаты TOPIK...
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
              <p className="text-sm font-semibold text-[var(--accent-dark)]">Админ-панель TOPIK</p>
              <h1 className="mt-2 text-3xl font-black">Результаты студентов</h1>
              <p className="mt-2 max-w-3xl text-sm text-[var(--ink-soft)]">
                Здесь собраны все завершённые попытки TOPIK: кто проходил, какой тест открыл,
                сколько набрал и по каким разделам.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/tests" className="secondary-btn px-4 py-2 text-sm font-bold">
                Редактор тестов
              </Link>
              <Link href="/admin/tests/results" className="primary-btn px-4 py-2 text-sm font-bold">
                Результаты
              </Link>
            </div>
          </div>
        </article>

        {error ? (
          <div className="glass-card rounded-3xl px-6 py-6 text-sm font-semibold text-rose-600">
            {error}
          </div>
        ) : null}

        {totals ? (
          <section className="grid gap-4 md:grid-cols-3">
            <article className="glass-card rounded-3xl px-6 py-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-dark)]">
                Студенты
              </p>
              <p className="mt-3 text-4xl font-black">{totals.students}</p>
            </article>
            <article className="glass-card rounded-3xl px-6 py-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-dark)]">
                Завершённые попытки
              </p>
              <p className="mt-3 text-4xl font-black">{totals.attempts}</p>
            </article>
            <article className="glass-card rounded-3xl px-6 py-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-dark)]">
                Лидер
              </p>
              <p className="mt-3 text-xl font-black">{topStudent?.name ?? "Пока нет данных"}</p>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">
                {topStudent ? `${topStudent.bestPercent}% лучший результат` : "Завершённые попытки появятся здесь."}
              </p>
            </article>
          </section>
        ) : null}

        <section className="space-y-4">
          {students.map((student) => (
            <article key={student.userId} className="glass-card rounded-3xl px-6 py-6 md:px-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">{student.name}</h2>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">{student.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {student.levels.map((level) => (
                    <span
                      key={`${student.userId}-${level}`}
                      className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--accent-dark)]"
                    >
                      {levelLabel(level)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ink-soft)]">Попыток</p>
                  <p className="mt-3 text-3xl font-black">{student.attemptsCount}</p>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ink-soft)]">Лучший процент</p>
                  <p className="mt-3 text-3xl font-black">{student.bestPercent}%</p>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ink-soft)]">Средний процент</p>
                  <p className="mt-3 text-3xl font-black">{student.averagePercent}%</p>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ink-soft)]">Последняя попытка</p>
                  <p className="mt-3 text-sm font-semibold text-[var(--ink)]">{formatDate(student.lastFinishedAt)}</p>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-xs font-black uppercase tracking-[0.16em] text-[var(--ink-soft)]">
                      <th className="px-3">Тест</th>
                      <th className="px-3">Уровень</th>
                      <th className="px-3">Общий балл</th>
                      <th className="px-3">Reading</th>
                      <th className="px-3">Listening</th>
                      <th className="px-3">Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {student.attempts.map((attempt) => (
                      <tr key={attempt.id} className="rounded-2xl border border-[var(--line)] bg-white/85 text-sm text-[var(--ink)]">
                        <td className="rounded-l-2xl px-3 py-4 font-semibold">{attempt.test.title}</td>
                        <td className="px-3 py-4">{levelLabel(attempt.test.level)}</td>
                        <td className="px-3 py-4 font-black">
                          {attempt.totalScore}/{attempt.maxTotalScore} • {attempt.percent}%
                        </td>
                        <td className="px-3 py-4">
                          {attempt.readingScore}/{attempt.maxReadingScore}
                        </td>
                        <td className="px-3 py-4">
                          {attempt.listeningScore}/{attempt.maxListeningScore}
                        </td>
                        <td className="rounded-r-2xl px-3 py-4 text-[var(--ink-soft)]">
                          {formatDate(attempt.finishedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </section>
      </div>
    </section>
  );
}
