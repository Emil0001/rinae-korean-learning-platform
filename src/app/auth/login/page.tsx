"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const nextPath = useMemo(() => getSafeRedirectPath(searchParams.get("next")), [searchParams]);
  const signupHref = useMemo(() => {
    return nextPath === "/dashboard"
      ? "/auth/signup"
      : `/auth/signup?next=${encodeURIComponent(nextPath)}`;
  }, [nextPath]);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(nextPath);
    }
  }, [isLoading, nextPath, router, user]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!isValidEmail(email)) {
      setError("Введите корректный email.");
      return;
    }

    if (!password.trim()) {
      setError("Введите пароль.");
      return;
    }

    setPending(true);
    const result = await signIn({ email, password });
    setPending(false);

    if (!result.ok) {
      setError(result.error ?? "Не удалось выполнить вход.");
      return;
    }

    router.push(nextPath);
  };

  return (
    <section className="py-10 md:py-14">
      <div className="site-shell">
        <div className="mx-auto max-w-md rounded-3xl border border-[var(--line)] bg-white px-6 py-8 shadow-lg">
          <p className="text-sm font-semibold text-[var(--accent-dark)]">С возвращением</p>
          <h1 className="mt-2 text-2xl font-bold">Вход в личный кабинет</h1>
          <p className="mt-1 text-sm text-gray-600">
            Продолжайте подготовку к TOPIK и отслеживайте свои результаты.
          </p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-1 block text-sm font-semibold" htmlFor="email">
                Эл. почта
              </label>
              <input
                id="email"
                className="input-field"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="rinae@example.com"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-3">
                <label className="block text-sm font-semibold" htmlFor="password">
                  Пароль
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs font-semibold text-[var(--accent-dark)] underline underline-offset-4"
                >
                  Забыли пароль?
                </Link>
              </div>
              <input
                id="password"
                className="input-field"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Введите пароль"
              />
            </div>

            {error ? <p className="error-text">{error}</p> : null}

            <button
              disabled={pending}
              className="primary-btn mt-2 w-full px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
            >
              {pending ? "Входим..." : "Войти"}
            </button>
          </form>

          <p className="mt-5 text-sm text-gray-700">
            Нет аккаунта?{" "}
            <Link className="font-semibold text-[var(--accent-dark)] underline" href={signupHref}>
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <section className="py-10 md:py-14">
          <div className="site-shell">
            <div className="mx-auto max-w-md rounded-3xl border border-[var(--line)] bg-white px-6 py-8 shadow-lg">
              <p className="text-sm text-gray-600">Загрузка...</p>
            </div>
          </div>
        </section>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
