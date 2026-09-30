"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import type { TopikTestListItem } from "@/types/topik";

type TestsResponse = {
  tests?: TopikTestListItem[];
  error?: string;
};

function levelLabel(level: TopikTestListItem["level"]) {
  return level === "TOPIK_I" ? "TOPIK I" : "TOPIK II";
}

function sectionTypeLabel(type: "LISTENING" | "READING") {
  return type === "LISTENING" ? "Аудирование" : "Чтение";
}

export default function TopikPage() {
  const [tests, setTests] = useState<TopikTestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadTests = async () => {
      try {
        const response = await fetch("/api/topik/tests", { cache: "no-store" });
        const data = (await response.json()) as TestsResponse;

        if (!active) return;

        if (!response.ok) {
          setError(data.error ?? "Не удалось загрузить тесты.");
          setTests([]);
          return;
        }

        setTests(data.tests ?? []);
      } catch {
        if (!active) return;
        setError("Не удалось подключиться к API тестов.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadTests();

    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(() => {
    return tests.reduce(
      (acc, test) => {
        acc.totalTests += 1;
        acc.totalQuestions += test.totalQuestions;
        return acc;
      },
      { totalTests: 0, totalQuestions: 0 },
    );
  }, [tests]);

  const testsByLevel = useMemo(() => {
    const topikI = tests.filter((test) => test.level === "TOPIK_I");
    const topikII = tests.filter((test) => test.level === "TOPIK_II");
    return { topikI, topikII };
  }, [tests]);

  const firstTestLink = useMemo(() => {
    const first = testsByLevel.topikI[0] ?? testsByLevel.topikII[0];
    return first ? `/topik/${first.id}` : "#topik-tests";
  }, [testsByLevel.topikI, testsByLevel.topikII]);

  return (
    <PageSection>
      <Shell>
        <HeroCard>
          <HeroContent>
            <HeroPill>TOPIK Practice</HeroPill>
            <HeroTitle>Готовься к TOPIK уверенно и без перегруза</HeroTitle>
            <HeroText>
              Здесь собраны актуальные пробные тесты с понятной структурой: выбери уровень,
              открой тест и тренируйся в формате реального экзамена. Наша цель - чтобы список
              тестов был максимально удобным для ежедневной практики.
            </HeroText>
            <StatsRow>
              <StatPill>Тестов: {summary.totalTests}</StatPill>
              <StatPill>Вопросов: {summary.totalQuestions}</StatPill>
              <StatPill>Уровни: TOPIK I + TOPIK II</StatPill>
            </StatsRow>
            <HeroActions>
              <PrimaryBtn href={firstTestLink}>Начать подготовку</PrimaryBtn>
              {/* <SecondaryBtn href="#topik-tests">Смотреть все тесты</SecondaryBtn> */}
            </HeroActions>
          </HeroContent>
          <HeroVisual>
            <Image
              src="/assets/15.svg"
              alt="Подготовка к TOPIK"
              width={620}
              height={430}
              priority
              style={{ width: "100%", height: "auto" }}
            />
          </HeroVisual>
        </HeroCard>

        {loading ? (
          <StateCard>Загрузка тестов...</StateCard>
        ) : error ? (
          <StateCard $tone="error">{error}</StateCard>
        ) : tests.length === 0 ? (
          <StateCard>
            Пока нет опубликованных тестов. Добавьте их в админ-панели и список появится здесь.
          </StateCard>
        ) : (
          <LevelsGrid id="topik-tests">
            {[
              {
                key: "TOPIK_I",
                title: "TOPIK I",
                subtitle: "Базовый уровень: чтение и аудирование с понятным темпом.",
                tests: testsByLevel.topikI,
              },
              {
                key: "TOPIK_II",
                title: "TOPIK II",
                subtitle: "Продвинутый уровень: сложные тексты и экзаменационная стратегия.",
                tests: testsByLevel.topikII,
              },
            ].map((column) => (
              <LevelColumn key={column.key}>
                <ColumnTop>
                  <ColumnTitle>{column.title}</ColumnTitle>
                  <ColumnCount>{column.tests.length} тестов</ColumnCount>
                </ColumnTop>
                <ColumnSubtitle>{column.subtitle}</ColumnSubtitle>

                {column.tests.length === 0 ? (
                  <EmptyLevel>Для этого уровня пока нет опубликованных тестов.</EmptyLevel>
                ) : (
                  <TestsList>
                    {column.tests.map((test) => (
                      <TestCard key={test.id}>
                        <TestMeta>
                          <MetaBadge>{levelLabel(test.level)}</MetaBadge>
                          <MetaInfo>{test.durationMinutes} мин</MetaInfo>
                          <MetaInfo>{test.totalQuestions} вопросов</MetaInfo>
                        </TestMeta>

                        <TestTitle>{test.title}</TestTitle>
                        {test.description ? <TestDescription>{test.description}</TestDescription> : null}

                        <SectionList>
                          {test.sections.map((section) => (
                            <SectionItem key={section.id}>
                              {sectionTypeLabel(section.type)}: {section.title} ({section.questionCount})
                            </SectionItem>
                          ))}
                        </SectionList>

                        <OpenTestButton href={`/topik/${test.id}`}>Открыть тест</OpenTestButton>
                      </TestCard>
                    ))}
                  </TestsList>
                )}
              </LevelColumn>
            ))}
          </LevelsGrid>
        )}
      </Shell>
    </PageSection>
  );
}

const PageSection = styled.section`
  padding: 0.75rem 0 5.5rem;
`;

const Shell = styled.div.attrs({ className: "site-shell" })`
  display: grid;
  gap: 1.25rem;
`;

const GlassBase = `
  border: 1px solid color-mix(in srgb, var(--line) 80%, #fff 20%);
  background: var(--surface);
  box-shadow: 0 25px 60px rgba(46, 59, 146, 0.11);
  backdrop-filter: blur(10px);
`;

const HeroCard = styled.section`
  ${GlassBase}
  border-radius: 1.5rem;
  padding: 1.5rem;
  display: grid;
  gap: 1.25rem;

  @media (min-width: 980px) {
    grid-template-columns: 1.08fr 0.92fr;
    align-items: stretch;
    padding: 2rem;
  }
`;

const HeroContent = styled.div`
  display: grid;
  align-content: center;
`;

const HeroPill = styled.p`
  display: inline-flex;
  width: fit-content;
  border-radius: 9999px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.9);
  padding: 0.35rem 0.95rem;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--accent-dark);
`;

const HeroTitle = styled.h1`
  margin-top: 1rem;
  font-size: clamp(2rem, 3.5vw, 3.3rem);
  line-height: 1.08;
  font-weight: 900;
`;

const HeroText = styled.p`
  margin-top: 1rem;
  max-width: 50rem;
  color: var(--ink-soft);
  font-size: clamp(1.05rem, 1.6vw, 1.26rem);
  line-height: 1.65;
`;

const StatsRow = styled.div`
  margin-top: 1.1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
`;

const StatPill = styled.span`
  border-radius: 9999px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.9);
  padding: 0.42rem 0.9rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--ink-soft);
`;

const HeroActions = styled.div`
  margin-top: 1.35rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
`;

const PrimaryBtn = styled(Link)`
  border-radius: 9999px;
  background: linear-gradient(135deg, #4d79ff 0%, #6a4dff 100%);
  color: #fff;
  box-shadow: 0 12px 26px rgba(76, 98, 255, 0.35);
  transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease;
  padding: 0.78rem 1.3rem;
  font-size: 1rem;
  font-weight: 700;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 16px 30px rgba(76, 98, 255, 0.42);
    filter: saturate(1.06);
  }
`;

const SecondaryBtn = styled(Link)`
  border-radius: 9999px;
  border: 1px solid var(--line-strong);
  background: rgba(255, 255, 255, 0.95);
  transition: border-color 160ms ease, background-color 160ms ease;
  padding: 0.78rem 1.3rem;
  font-size: 1rem;
  font-weight: 700;

  &:hover {
    border-color: var(--accent);
    background-color: #f7f8ff;
  }
`;

const HeroVisual = styled.div`
  border-radius: 1.3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

const StateCard = styled.div<{ $tone?: "error" }>`
  ${GlassBase}
  border-radius: 1rem;
  padding: 1rem 1.15rem;
  font-size: 1.05rem;
  color: ${({ $tone }) => ($tone === "error" ? "#bd2b48" : "var(--ink-soft)")};
`;

const LevelsGrid = styled.section`
  display: grid;
  gap: 1rem;

  @media (min-width: 1080px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const LevelColumn = styled.article`
  ${GlassBase}
  border-radius: 1.35rem;
  padding: 1.15rem 1.1rem 1.2rem;

  @media (min-width: 768px) {
    padding: 1.4rem 1.3rem 1.3rem;
  }
`;

const ColumnTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
`;

const ColumnTitle = styled.h2`
  font-size: clamp(1.9rem, 3vw, 2.35rem);
  line-height: 1.1;
  font-weight: 900;
`;

const ColumnCount = styled.span`
  border-radius: 9999px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.9);
  padding: 0.42rem 0.88rem;
  font-size: 0.9rem;
  color: var(--ink-soft);
`;

const ColumnSubtitle = styled.p`
  margin-top: 0.6rem;
  color: var(--ink-soft);
  font-size: 1rem;
  line-height: 1.55;
`;

const EmptyLevel = styled.div`
  margin-top: 1rem;
  border-radius: 1rem;
  border: 1px dashed var(--line);
  background: rgba(255, 255, 255, 0.72);
  padding: 0.95rem 1rem;
  font-size: 0.98rem;
  color: var(--ink-soft);
`;

const TestsList = styled.div`
  margin-top: 0.95rem;
  display: grid;
  gap: 0.75rem;
`;

const TestCard = styled.article`
  border-radius: 1rem;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.88);
  padding: 0.95rem 1rem;
`;

const TestMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
`;

const MetaBadge = styled.span`
  border-radius: 9999px;
  border: 1px solid var(--line);
  background: #fff;
  padding: 0.25rem 0.7rem;
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--accent-dark);
  letter-spacing: 0.02em;
  text-transform: uppercase;
`;

const MetaInfo = styled.span`
  border-radius: 9999px;
  border: 1px solid var(--line);
  background: #fff;
  padding: 0.25rem 0.7rem;
  font-size: 0.82rem;
  color: var(--ink-soft);
`;

const TestTitle = styled.h3`
  margin-top: 0.65rem;
  font-size: 1.35rem;
  line-height: 1.28;
  font-weight: 800;
`;

const TestDescription = styled.p`
  margin-top: 0.45rem;
  color: var(--ink-soft);
  font-size: 1rem;
  line-height: 1.55;
`;

const SectionList = styled.ul`
  margin-top: 0.65rem;
  display: grid;
  gap: 0.24rem;
`;

const SectionItem = styled.li`
  list-style: none;
  color: var(--ink-soft);
  font-size: 0.95rem;
  line-height: 1.45;

  &::before {
    content: "• ";
    color: var(--accent-dark);
    font-weight: 700;
  }
`;

const OpenTestButton = styled(Link)`
  margin-top: 0.75rem;
  display: inline-flex;
  border-radius: 9999px;
  background: linear-gradient(135deg, #4d79ff 0%, #6a4dff 100%);
  color: #fff;
  box-shadow: 0 10px 22px rgba(76, 98, 255, 0.3);
  transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease;
  padding: 0.62rem 1.1rem;
  font-size: 0.95rem;
  font-weight: 700;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 14px 26px rgba(76, 98, 255, 0.38);
    filter: saturate(1.06);
  }
`;
