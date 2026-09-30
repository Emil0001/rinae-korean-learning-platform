"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function SignupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const nextPath = useMemo(() => getSafeRedirectPath(searchParams.get("next")), [searchParams]);
  const loginHref = useMemo(() => {
    return nextPath === "/dashboard"
      ? "/auth/login"
      : `/auth/login?next=${encodeURIComponent(nextPath)}`;
  }, [nextPath]);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(nextPath);
    }
  }, [isLoading, nextPath, router, user]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (name.trim().length < 2) {
      setError("Имя должно содержать минимум 2 символа.");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Введите корректный email.");
      return;
    }

    if (password.length < 8) {
      setError("Пароль должен быть не короче 8 символов.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Пароли не совпадают.");
      return;
    }

    setPending(true);
    const result = await signUp({
      name,
      email,
      password,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error ?? "Не удалось создать аккаунт.");
      return;
    }

    router.push(nextPath);
  };

  return (
    <section className="py-10 md:py-14">
      <div className="site-shell">
        <div className="mx-auto max-w-md rounded-3xl border border-[var(--line)] bg-white px-6 py-8 shadow-lg">
          <p className="text-sm font-semibold text-[var(--accent-dark)]">
            Начните подготовку к TOPIK
          </p>
          <h1 className="mt-2 text-2xl font-bold">Создание аккаунта</h1>
          <p className="mt-1 text-sm text-gray-600">
            Сохраняйте тесты, прогресс и персональные рекомендации.
          </p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-1 block text-sm font-semibold" htmlFor="name">
                Имя
              </label>
              <input
                id="name"
                className="input-field"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Марина"
              />
            </div>

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
              <label className="mb-1 block text-sm font-semibold" htmlFor="password">
                Пароль
              </label>
              <input
                id="password"
                className="input-field"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Минимум 8 символов"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold" htmlFor="confirm-password">
                Подтвердите пароль
              </label>
              <input
                id="confirm-password"
                className="input-field"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Повторите пароль"
              />
            </div>

            {error ? <p className="error-text">{error}</p> : null}

            <button
              disabled={pending}
              className="primary-btn mt-2 w-full px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
            >
              {pending ? "Создаем аккаунт..." : "Зарегистрироваться"}
            </button>
          </form>

          <p className="mt-5 text-sm text-gray-700">
            Уже есть аккаунт?{" "}
            <Link className="font-semibold text-[var(--accent-dark)] underline" href={loginHref}>
              Войти
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

export default function SignupPage() {
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
      <SignupPageContent />
    </Suspense>
  );
}
