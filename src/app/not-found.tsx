import type { Metadata } from "next";
import Link from "next/link";
import styles from "./not-found.module.css";

export const metadata: Metadata = {
  title: "Страница не найдена — Rinae Korean",
  description: "Такой страницы нет. Вернитесь на главную или продолжите обучение.",
};

function HomeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9v11h14V9" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

function CoursesIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22Z" />
      <path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22Z" />
    </svg>
  );
}

export default function NotFound() {
  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="not-found-title">
        <div className={styles.content}>
          <p className={styles.korean} lang="ko">
            앗! 길을 잃었어요!
          </p>

          <p className={styles.code} aria-hidden="true">
            404
          </p>

          <h1 id="not-found-title" className={styles.title}>
            Страница не найдена
          </h1>

          <p className={styles.description}>
            Кажется, вы немного заблудились. Ничего страшного — давайте
            вернёмся на правильный путь!
          </p>

          <div className={styles.actions}>
            <Link href="/" className={styles.primaryAction}>
              <HomeIcon />
              На главную
            </Link>
            <Link href="/courses" className={styles.secondaryAction}>
              <CoursesIcon />
              К курсам
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
