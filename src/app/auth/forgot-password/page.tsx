"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type ForgotPasswordResponse = {
  message?: string;
  error?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!isValidEmail(email)) {
      setError("Введите корректный email.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = (await response.json()) as ForgotPasswordResponse;

      if (!response.ok) {
        setError(data.error ?? "Не удалось отправить письмо.");
        return;
      }

      setMessage(
        data.message ??
          "Если аккаунт с таким email существует, мы отправили инструкцию для сброса пароля.",
      );
    } catch {
      setError("Не удалось отправить письмо. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="py-10 md:py-14">
      <div className="site-shell">
        <div className="mx-auto max-w-md rounded-3xl border border-[var(--line)] bg-white px-6 py-8 shadow-lg">
          <p className="text-sm font-semibold text-[var(--accent-dark)]">Восстановление доступа</p>
          <h1 className="mt-2 text-2xl font-bold">Сброс пароля</h1>
          <p className="mt-1 text-sm text-gray-600">
            Введите email, который использовали при регистрации. Мы отправим ссылку для создания нового пароля.
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

            {error ? <p className="error-text">{error}</p> : null}
            {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

            <button
              disabled={pending}
              className="primary-btn w-full px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
            >
              {pending ? "Отправляем..." : "Отправить ссылку"}
            </button>
          </form>

          <p className="mt-5 text-sm text-gray-700">
            Вспомнили пароль?{" "}
            <Link className="font-semibold text-[var(--accent-dark)] underline" href="/auth/login">
              Вернуться ко входу
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
