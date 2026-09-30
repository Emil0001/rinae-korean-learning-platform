"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type ResetPasswordResponse = {
  message?: string;
  error?: string;
};

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("Ссылка для сброса пароля недействительна.");
      return;
    }

    if (password.length < 8) {
      setError("Пароль должен содержать минимум 8 символов.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Пароли не совпадают.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password }),
      });

      const data = (await response.json()) as ResetPasswordResponse;

      if (!response.ok) {
        setError(data.error ?? "Не удалось обновить пароль.");
        return;
      }

      setMessage(data.message ?? "Пароль обновлён.");
      setTimeout(() => {
        router.push("/auth/login");
      }, 1200);
    } catch {
      setError("Не удалось обновить пароль. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="py-10 md:py-14">
      <div className="site-shell">
        <div className="mx-auto max-w-md rounded-3xl border border-[var(--line)] bg-white px-6 py-8 shadow-lg">
          <p className="text-sm font-semibold text-[var(--accent-dark)]">Новый пароль</p>
          <h1 className="mt-2 text-2xl font-bold">Создайте новый пароль</h1>
          <p className="mt-1 text-sm text-gray-600">
            После сохранения нового пароля можно будет войти в кабинет с обновлёнными данными.
          </p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-1 block text-sm font-semibold" htmlFor="password">
                Новый пароль
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
              <label className="mb-1 block text-sm font-semibold" htmlFor="confirmPassword">
                Повторите пароль
              </label>
              <input
                id="confirmPassword"
                className="input-field"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Повторите новый пароль"
              />
            </div>

            {error ? <p className="error-text">{error}</p> : null}
            {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

            <button
              disabled={pending || !token}
              className="primary-btn w-full px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
            >
              {pending ? "Сохраняем..." : "Сохранить новый пароль"}
            </button>
          </form>

          <p className="mt-5 text-sm text-gray-700">
            <Link className="font-semibold text-[var(--accent-dark)] underline" href="/auth/login">
              Вернуться ко входу
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
