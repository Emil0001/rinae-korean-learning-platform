"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styled, { keyframes } from "styled-components";
import { useAuth } from "@/context/auth-context";
import type { CourseLearningStats } from "@/types/courses";

type DashboardLevel = {
  title: string;
  accent: string;
  description: string;
};

type DashboardTrack = {
  attempts: number;
  readingAttempts: number;
  listeningAttempts: number;
  fullAttempts: number;
  averagePercent: number;
  bestPercent: number;
  rank: number | null;
};

type LeaderboardEntry = {
  userId: string;
  name: string;
  attemptCount: number;
  totalScore: number;
  maxTotalScore: number;
  bestScore: number;
  bestMaxScore: number;
  bestPercent: number;
  countedAttempt: {
    title: string;
    mode: "READING" | "LISTENING" | "FULL";
  };
};

type DashboardSummary = {
  profile: {
    name: string;
    email: string;
    totalAttempts: number;
    averagePercent: number;
    bestPercent: number;
    level: DashboardLevel;
  };
  courseStats: CourseLearningStats;
  tracks: {
    TOPIK_I: DashboardTrack;
    TOPIK_II: DashboardTrack;
  };
  site: {
    totalStudents: number;
    totalAttempts: number;
    topLeader: {
      name: string;
      level: "TOPIK_I" | "TOPIK_II";
      percent: number;
      score: number;
    } | null;
  };
  recentAttempts: {
    id: string;
    startedAt: string;
    finishedAt: string | null;
    totalScore: number;
    maxTotalScore: number;
    percent: number;
    mode: "READING" | "LISTENING" | "FULL";
    test: {
      title: string;
      level: "TOPIK_I" | "TOPIK_II";
    };
  }[];
  leaderboards: {
    TOPIK_I: LeaderboardEntry[];
    TOPIK_II: LeaderboardEntry[];
  };
};

type DashboardResponse = {
  error?: string;
} & Partial<DashboardSummary>;

type HeroStatItem = {
  label: string;
  value: string;
  meta?: string;
};

const trackMeta = {
  TOPIK_I: {
    title: "TOPIK I",
    description: "Базовый трек для скорости, словаря и уверенного старта.",
  },
  TOPIK_II: {
    title: "TOPIK II",
    description: "Продвинутый трек для более сложных текстов и высокого балла.",
  },
} as const;

const DEFAULT_DASHBOARD_LEVEL: DashboardLevel = {
  title: "Starter",
  accent: "#7f8bb7",
  description: "Первый шаг к сильному корейскому. Пройди свой первый TOPIK и открой прогресс.",
};

const DEFAULT_COURSE_STATS: CourseLearningStats = {
  streakDays: 0,
  totalXp: 0,
  completedLessons: 0,
  rankTitle: "Beginner I",
  nextRankTitle: "Beginner II",
  rankProgressPercent: 0,
  xpToNextRank: 300,
};

function normalizeDashboardLevel(level: Partial<DashboardLevel> | undefined): DashboardLevel {
  return {
    title: typeof level?.title === "string" && level.title.trim() ? level.title : DEFAULT_DASHBOARD_LEVEL.title,
    accent: typeof level?.accent === "string" && level.accent.trim() ? level.accent : DEFAULT_DASHBOARD_LEVEL.accent,
    description:
      typeof level?.description === "string" && level.description.trim()
        ? level.description
        : DEFAULT_DASHBOARD_LEVEL.description,
  };
}

function formatPercent(value: number) {
  return `${value}%`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRank(rank: number | null) {
  return rank ? `#${rank}` : "—";
}

function formatAttemptMode(mode: "READING" | "LISTENING" | "FULL") {
  if (mode === "READING") {
    return "Чтение";
  }

  if (mode === "LISTENING") {
    return "Аудирование";
  }

  return "Полный тест";
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [activeBoard, setActiveBoard] = useState<"TOPIK_I" | "TOPIK_II">("TOPIK_I");

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/auth/login");
    }
  }, [isLoading, router, user]);

  useEffect(() => {
    if (!user) {
      setSummary(null);
      setLoadingSummary(false);
      return;
    }

    setLoadingSummary(true);
    let active = true;

    const loadSummary = async () => {
      try {
        const response = await fetch("/api/dashboard/summary", { cache: "no-store" });
        const data = (await response.json()) as DashboardResponse;

        if (!active) {
          return;
        }

        if (!response.ok || !data.profile || !data.tracks || !data.leaderboards || !data.site) {
          setSummary(null);
          return;
        }

        setSummary({
          profile: {
            ...data.profile,
            level: normalizeDashboardLevel(data.profile.level),
          },
          courseStats: data.courseStats ?? DEFAULT_COURSE_STATS,
          tracks: data.tracks,
          leaderboards: data.leaderboards,
          recentAttempts: data.recentAttempts ?? [],
          site: data.site,
        });
      } catch {
        if (!active) {
          return;
        }
        setSummary(null);
      } finally {
        if (active) {
          setLoadingSummary(false);
        }
      }
    };

    void loadSummary();

    return () => {
      active = false;
    };
  }, [user]);

  const heroStats = useMemo<HeroStatItem[]>(() => {
    if (!summary) {
      return [];
    }

    return [
      // Course XP/streak version for later switch:
      // { label: "Серия", value: `${summary.courseStats.streakDays} дн.` },
      // { label: "Всего XP", value: `${summary.courseStats.totalXp}` },
      // { label: "Уроков завершено", value: String(summary.courseStats.completedLessons) },
      { label: "Попыток решено", value: String(summary.profile.totalAttempts) },
      { label: "Средняя точность", value: formatPercent(summary.profile.averagePercent) },
      { label: "Лучший результат", value: formatPercent(summary.profile.bestPercent) },
      // {
      //   label: "Лидер платформы",
      //   value: summary.site.topLeader?.name ?? "Пока нет",
      //   meta: summary.site.topLeader
      //     ? `${summary.site.topLeader.level === "TOPIK_I" ? "TOPIK I" : "TOPIK II"} • ${formatPercent(summary.site.topLeader.percent)}`
      //     : "Ждём первый завершённый тест",
      // },
    ];
  }, [summary]);

  if (isLoading || (user && loadingSummary)) {
    return (
      <PageSection>
        <Shell>
          <DashboardSkeleton />
        </Shell>
      </PageSection>
    );
  }

  if (!user) {
    return null;
  }

  if (!summary) {
    return (
      <PageSection>
        <Shell>
          <StateCard>Не удалось загрузить данные кабинета.</StateCard>
        </Shell>
      </PageSection>
    );
  }

  const activeLeaderboard = summary.leaderboards[activeBoard];
  const profileLevel = normalizeDashboardLevel(summary.profile.level);
  // const courseStats = summary.courseStats ?? DEFAULT_COURSE_STATS;

  return (
    <PageSection>
      <Shell>
        <HeroCard>
          <HeroCopy>
            <Eyebrow>Кабинет ученика</Eyebrow>
            <HeroTitle>{summary.profile.name}</HeroTitle>
            <HeroSubTitle>{summary.profile.email}</HeroSubTitle>
            <LevelPill $accent={profileLevel.accent}>
              Уровень: {profileLevel.title}
            </LevelPill>
            <HeroText>{profileLevel.description}</HeroText>
            {/* Course XP/streak version for later switch:
            <LevelPill $accent="#5a66ff">Курс: {courseStats.rankTitle}</LevelPill>
            <HeroText>
              Серия и XP считаются по завершённым урокам курса. Следующая цель:{" "}
              {courseStats.nextRankTitle ?? "максимальный ранг"}.
            </HeroText>
            <CourseRankPanel>
              <CourseRankTop>
                <span>Прогресс ранга</span>
                <strong>
                  {courseStats.xpToNextRank === null ? "Готово" : `${courseStats.xpToNextRank} XP осталось`}
                </strong>
              </CourseRankTop>
              <CourseRankTrack>
                <CourseRankFill style={{ width: `${courseStats.rankProgressPercent}%` }} />
              </CourseRankTrack>
            </CourseRankPanel>
            */}

            <HeroStats>
              {heroStats.map((item) => (
                <HeroStat key={item.label}>
                  <HeroStatLabel>{item.label}</HeroStatLabel>
                  <HeroStatValue>{item.value}</HeroStatValue>
                  {item.meta ? <HeroStatMeta>{item.meta}</HeroStatMeta> : null}
                </HeroStat>
              ))}
            </HeroStats>
          </HeroCopy>

          <HeroVisual>
            <VisualGlow />
            <StudentImage
              src="/assets/student.svg"
              alt={`Профиль студента ${summary.profile.name}`}
              width={460}
              height={460}
              priority
            />
          </HeroVisual>
        </HeroCard>

        <TrackGrid>
          {(["TOPIK_I", "TOPIK_II"] as const).map((trackKey) => {
            const track = summary.tracks[trackKey];
            const meta = trackMeta[trackKey];

            return (
              <TrackCard key={trackKey}>
                <TrackTop>
                  <div>
                    <TrackTitle>{meta.title}</TrackTitle>
                    <TrackText>{meta.description}</TrackText>
                  </div>
                  <TrackRank>{formatRank(track.rank)}</TrackRank>
                </TrackTop>

                <TrackBars>
                  <TrackMetric>
                    <MetricLabel>Попытки по режимам</MetricLabel>
                    <MetricValue>
                      {track.readingAttempts} / {track.listeningAttempts}
                    </MetricValue>
                    <MetricMeta>
                      Чтение / Аудирование
                      {track.fullAttempts > 0 ? ` • Полный тест: ${track.fullAttempts}` : ""}
                    </MetricMeta>
                  </TrackMetric>
                  <TrackMetric>
                    <MetricLabel>Средняя точность</MetricLabel>
                    <MetricValue>{formatPercent(track.averagePercent)}</MetricValue>
                  </TrackMetric>
                  <TrackMetric>
                    <MetricLabel>Лучший результат</MetricLabel>
                    <MetricValue>{formatPercent(track.bestPercent)}</MetricValue>
                  </TrackMetric>
                </TrackBars>

                <ProgressGroup>
                  <ProgressLabel>Средняя точность</ProgressLabel>
                  <ProgressBar>
                    <ProgressFill $value={track.averagePercent} />
                  </ProgressBar>
                </ProgressGroup>

                <ProgressGroup>
                  <ProgressLabel>Пиковый результат</ProgressLabel>
                  <ProgressBar>
                    <ProgressFill $value={track.bestPercent} $secondary />
                  </ProgressBar>
                </ProgressGroup>
              </TrackCard>
            );
          })}
        </TrackGrid>

        <DashboardGrid>
          <LeaderboardCard>
            <SectionHead>
              <div>
                <SectionEyebrow>Статистика</SectionEyebrow>
                <SectionTitle>Лидерборд студентов</SectionTitle>
                <SectionText>
                  В рейтинг попадает лучший результат студента среди первых попыток по каждому тесту в дивизионе.
                </SectionText>
              </div>
              <Tabs>
                {(["TOPIK_I", "TOPIK_II"] as const).map((trackKey) => (
                  <TabButton
                    key={trackKey}
                    type="button"
                    $active={activeBoard === trackKey}
                    onClick={() => setActiveBoard(trackKey)}
                  >
                    {trackMeta[trackKey].title}
                  </TabButton>
                ))}
              </Tabs>
            </SectionHead>

            <LeaderboardList>
              {activeLeaderboard.length === 0 ? (
                <EmptyText>Пока нет завершённых попыток в этом дивизионе.</EmptyText>
              ) : (
                activeLeaderboard.map((entry, index) => (
                  <LeaderboardRow key={`${activeBoard}-${entry.userId}`} $highlight={entry.userId === user.id}>
                    <LeaderboardRank $isFirst={index === 0}>
                      {index === 0 ? (
                        <RankCrown src="/assets/26.svg" alt="" width={38} height={38} aria-hidden />
                      ) : null}
                      <RankNumber>{index + 1}</RankNumber>
                    </LeaderboardRank>
                    <LeaderboardNameWrap>
                      <LeaderboardName>
                        {entry.name}
                        {entry.userId === user.id ? <SelfBadge>это вы</SelfBadge> : null}
                      </LeaderboardName>
                      <LeaderboardMeta>
                        Учтено TOPIK: {entry.countedAttempt.title} • {formatAttemptMode(entry.countedAttempt.mode)}
                        {" • "}
                        Лучший результат: {entry.bestScore}/{entry.bestMaxScore}
                      </LeaderboardMeta>
                    </LeaderboardNameWrap>
                    <LeaderboardScore>{formatPercent(entry.bestPercent)}</LeaderboardScore>
                  </LeaderboardRow>
                ))
              )}
            </LeaderboardList>
          </LeaderboardCard>

          <SideColumn>
            <MiniCard>
              <SectionEyebrow>Темп обучения</SectionEyebrow>
              <MiniTitle>Что делать дальше</MiniTitle>
              <NextSteps>
                <NextStep>
                  Держи ритм минимум в 2-3 попытки в неделю, чтобы рейтинг начал двигаться заметно.
                </NextStep>
                <NextStep>
                  Сравни TOPIK I и TOPIK II: слабый дивизион быстрее всего покажет, где теряются баллы.
                </NextStep>
                <NextStep>
                  Лучший рост обычно приходит не от одной идеальной попытки, а от серии стабильных результатов.
                </NextStep>
              </NextSteps>
            </MiniCard>
{/* 
            <MiniCard>
              <SectionEyebrow>Словарь</SectionEyebrow>
              <MiniTitle>Карточки на каждый день</MiniTitle>
              <SectionText>
                Оценивай слова по памяти, повторяй сложные карточки и собирай собственный словарный ритм.
              </SectionText>
              <ActionLink href="/vocabulary">Открыть словарь</ActionLink>
            </MiniCard> */}
          </SideColumn>
        </DashboardGrid>

        <HistoryCard>
          <SectionHead>
            <div>
              <SectionEyebrow>Личная история</SectionEyebrow>
              <SectionTitle>Последние попытки</SectionTitle>
            </div>
          </SectionHead>

          {summary.recentAttempts.length === 0 ? (
            <EmptyText>
              У тебя пока нет завершённых попыток. Перейди в раздел TOPIK и открой первый тест.
            </EmptyText>
          ) : (
            <HistoryList>
              {summary.recentAttempts.map((attempt) => (
                <HistoryItem key={attempt.id}>
                  <HistoryTop>
                    <HistoryTitle>{attempt.test.title}</HistoryTitle>
                    <HistoryBadge>{attempt.test.level === "TOPIK_I" ? "TOPIK I" : "TOPIK II"}</HistoryBadge>
                  </HistoryTop>
                  <HistoryMeta>
                    {formatDate(attempt.startedAt)} • {formatAttemptMode(attempt.mode)} •{" "}
                    {attempt.totalScore}/{attempt.maxTotalScore}
                  </HistoryMeta>
                  <HistoryBar>
                    <HistoryBarFill $value={attempt.percent} />
                  </HistoryBar>
                  <HistoryPercent>{formatPercent(attempt.percent)}</HistoryPercent>
                </HistoryItem>
              ))}
            </HistoryList>
          )}
        </HistoryCard>
      </Shell>
    </PageSection>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <HeroCard>
        <HeroCopy>
          <SkeletonBlock $width="7rem" $height="0.9rem" />
          <SkeletonBlock $width="16rem" $height="3.6rem" />
          <SkeletonBlock $width="11rem" $height="1.2rem" />
          <SkeletonBlock $width="20rem" $height="3rem" />
          <HeroStats>
            {Array.from({ length: 3 }).map((_, index) => (
              <HeroStat key={index}>
                <SkeletonBlock $width="7rem" $height="0.8rem" />
                <SkeletonBlock $width="5rem" $height="1.8rem" />
              </HeroStat>
            ))}
          </HeroStats>
        </HeroCopy>

        <HeroVisual>
          <VisualGlow />
          <SkeletonOrb />
        </HeroVisual>
      </HeroCard>

      <TrackGrid>
        {Array.from({ length: 2 }).map((_, index) => (
          <TrackCard key={index}>
            <TrackTop>
              <div className="min-w-0 flex-1">
                <SkeletonBlock $width="7rem" $height="1.8rem" />
                <SkeletonBlock $width="18rem" $height="1rem" />
              </div>
              <SkeletonChip />
            </TrackTop>
            <TrackBars>
              {Array.from({ length: 3 }).map((__, metricIndex) => (
                <TrackMetric key={metricIndex}>
                  <SkeletonBlock $width="8rem" $height="0.85rem" />
                  <SkeletonBlock $width="4rem" $height="1.6rem" />
                </TrackMetric>
              ))}
            </TrackBars>
            <ProgressGroup>
              <SkeletonBlock $width="8rem" $height="0.8rem" />
              <SkeletonBar />
            </ProgressGroup>
            <ProgressGroup>
              <SkeletonBlock $width="8rem" $height="0.8rem" />
              <SkeletonBar />
            </ProgressGroup>
          </TrackCard>
        ))}
      </TrackGrid>

      <DashboardGrid>
        <LeaderboardCard>
          <SectionHead>
            <div>
              <SkeletonBlock $width="6rem" $height="0.85rem" />
              <SkeletonBlock $width="14rem" $height="2rem" />
            </div>
            <Tabs>
              <SkeletonPill />
              <SkeletonPill />
            </Tabs>
          </SectionHead>

          <LeaderboardList>
            {Array.from({ length: 3 }).map((_, index) => (
              <LeaderboardRow key={index} $highlight={false}>
                <LeaderboardRank $isFirst={false}>
                  <SkeletonDot />
                </LeaderboardRank>
                <LeaderboardNameWrap>
                  <SkeletonBlock $width="8rem" $height="1.1rem" />
                  <SkeletonBlock $width="13rem" $height="0.9rem" />
                </LeaderboardNameWrap>
                <SkeletonBlock $width="3.5rem" $height="1.4rem" />
              </LeaderboardRow>
            ))}
          </LeaderboardList>
        </LeaderboardCard>

        <SideColumn>
          <MiniCard>
            <SkeletonBlock $width="7rem" $height="0.85rem" />
            <SkeletonBlock $width="11rem" $height="2rem" />
            <NextSteps>
              {Array.from({ length: 3 }).map((_, index) => (
                <NextStep key={index}>
                  <SkeletonBlock $width="100%" $height="3.5rem" />
                </NextStep>
              ))}
            </NextSteps>
          </MiniCard>
        </SideColumn>
      </DashboardGrid>

      <HistoryCard>
        <SectionHead>
          <div>
            <SkeletonBlock $width="6rem" $height="0.85rem" />
            <SkeletonBlock $width="12rem" $height="2rem" />
          </div>
        </SectionHead>

        <HistoryList>
          {Array.from({ length: 3 }).map((_, index) => (
            <HistoryItem key={index}>
              <HistoryTop>
                <SkeletonBlock $width="7rem" $height="1.1rem" />
                <SkeletonChip />
              </HistoryTop>
              <SkeletonBlock $width="12rem" $height="0.95rem" />
              <SkeletonBar />
              <SkeletonBlock $width="3rem" $height="1.4rem" />
            </HistoryItem>
          ))}
        </HistoryList>
      </HistoryCard>
    </>
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
  border: 1px solid color-mix(in srgb, var(--line) 82%, #fff 18%);
  background: var(--surface);
  box-shadow: 0 22px 60px rgba(46, 59, 146, 0.11);
  backdrop-filter: blur(10px);
`;

const StateCard = styled.div`
  ${GlassBase}
  border-radius: 1.4rem;
  padding: 1.2rem 1.3rem;
  color: var(--ink-soft);
  min-height: 18rem;
`;

const shimmer = keyframes`
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
`;

const SkeletonBase = styled.div`
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    rgba(217, 225, 255, 0.62) 0%,
    rgba(245, 248, 255, 0.96) 50%,
    rgba(217, 225, 255, 0.62) 100%
  );
  background-size: 200% 100%;
  animation: ${shimmer} 1.6s linear infinite;
`;

const SkeletonBlock = styled(SkeletonBase)<{ $width: string; $height: string }>`
  width: ${({ $width }) => $width};
  max-width: 100%;
  height: ${({ $height }) => $height};
`;

const SkeletonChip = styled(SkeletonBase)`
  width: 5.25rem;
  height: 2.25rem;
`;

const SkeletonPill = styled(SkeletonBase)`
  width: 5.5rem;
  height: 2.6rem;
`;

const SkeletonBar = styled(SkeletonBase)`
  width: 100%;
  height: 0.85rem;
`;

const SkeletonDot = styled(SkeletonBase)`
  width: 1.5rem;
  height: 1.5rem;
  margin: auto;
`;

const SkeletonOrb = styled(SkeletonBase)`
  width: min(100%, 22rem);
  aspect-ratio: 1;
  border-radius: 2rem;
`;

const HeroCard = styled.section`
  ${GlassBase}
  border-radius: 1.75rem;
  overflow: hidden;
  display: grid;
  gap: 1rem;
  padding: 1.5rem;

  @media (min-width: 980px) {
    grid-template-columns: 1.1fr 0.9fr;
    padding: 2rem;
  }
`;

const HeroCopy = styled.div`
  display: grid;
  align-content: center;
`;

const Eyebrow = styled.p`
  font-size: 0.82rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--accent-dark);
`;

const HeroTitle = styled.h1`
  margin-top: 0.9rem;
  font-size: clamp(2rem, 3.7vw, 3.55rem);
  line-height: 1.05;
  font-weight: 900;
`;

const HeroSubTitle = styled.p`
  margin-top: 0.55rem;
  color: var(--ink-soft);
  font-size: 1rem;
`;

const LevelPill = styled.div<{ $accent: string }>`
  margin-top: 1rem;
  width: fit-content;
  border-radius: 9999px;
  padding: 0.45rem 1rem;
  background: ${({ $accent }) => `color-mix(in srgb, ${$accent} 16%, white 84%)`};
  border: 1px solid ${({ $accent }) => `color-mix(in srgb, ${$accent} 42%, white 58%)`};
  color: ${({ $accent }) => $accent};
  font-size: 0.92rem;
  font-weight: 800;
`;

const HeroText = styled.p`
  margin-top: 0.95rem;
  max-width: 42rem;
  color: var(--ink-soft);
  font-size: 1.05rem;
  line-height: 1.7;
`;

// Course XP/streak version styles for later switch:
// const CourseRankPanel = styled.div`
//   max-width: 38rem;
//   margin-top: 1.1rem;
//   border: 1px solid rgba(195, 205, 255, 0.76);
//   border-radius: 1.2rem;
//   background: rgba(255, 255, 255, 0.82);
//   padding: 1rem;
// `;
//
// const CourseRankTop = styled.div`
//   display: flex;
//   justify-content: space-between;
//   gap: 1rem;
//   color: var(--ink-soft);
//   font-size: 0.86rem;
//   font-weight: 800;
//
//   strong {
//     color: #172348;
//   }
// `;
//
// const CourseRankTrack = styled.div`
//   height: 0.6rem;
//   margin-top: 0.7rem;
//   overflow: hidden;
//   border-radius: 999px;
//   background: rgba(224, 229, 255, 0.92);
// `;
//
// const CourseRankFill = styled.div`
//   height: 100%;
//   border-radius: inherit;
//   background: linear-gradient(90deg, #ffb72f, #5a66ff);
// `;

const HeroStats = styled.div`
  margin-top: 1.5rem;
  display: grid;
  gap: 0.8rem;

  @media (min-width: 700px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const HeroStat = styled.article`
  border-radius: 1.15rem;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.88);
  padding: 0.95rem 1rem;
`;

const HeroStatLabel = styled.p`
  color: var(--ink-soft);
  font-size: 0.82rem;
`;

const HeroStatValue = styled.p`
  margin-top: 0.4rem;
  font-size: 1.55rem;
  font-weight: 900;
`;

const HeroStatMeta = styled.p`
  margin-top: 0.32rem;
  color: var(--ink-soft);
  font-size: 0.84rem;
  line-height: 1.45;
`;

const HeroVisual = styled.div`
  position: relative;
  min-height: 21rem;
  border-radius: 1.35rem;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 24% 24%, rgba(87, 185, 223, 0.24), transparent 38%),
    radial-gradient(circle at 76% 26%, rgba(94, 104, 222, 0.18), transparent 32%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.92), rgba(243, 247, 255, 0.92));
`;

const VisualGlow = styled.div`
  position: absolute;
  inset: auto -15% -22% auto;
  width: 18rem;
  height: 18rem;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(93, 211, 202, 0.28), transparent 70%);
`;

const StudentImage = styled(Image)`
  position: relative;
  z-index: 1;
  width: min(100%, 23rem);
  height: auto;
`;

const TrackGrid = styled.section`
  display: grid;
  gap: 1rem;

  @media (min-width: 900px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const TrackCard = styled.article`
  ${GlassBase}
  border-radius: 1.45rem;
  padding: 1.35rem;
`;

const TrackTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  height: 5.5rem;
  gap: 1rem;
`;

const TrackTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 900;
`;

const TrackText = styled.p`
  margin-top: 0.35rem;
  max-width: 28rem;
  color: var(--ink-soft);
  line-height: 1.65;
`;

const TrackRank = styled.div`
  border-radius: 9999px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.9);
  padding: 0.48rem 0.9rem;
  font-size: 0.9rem;
  font-weight: 800;
  color: var(--accent-dark);
`;

const TrackBars = styled.div`
  margin-top: 1.15rem;
  display: grid;
  gap: 0.8rem;

  @media (min-width: 720px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

const TrackMetric = styled.div`
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid var(--line);
  padding: 0.9rem 0.95rem;
`;

const MetricLabel = styled.p`
  font-size: 0.8rem;
  color: var(--ink-soft);
`;

const MetricValue = styled.p`
  margin-top: 0.4rem;
  font-size: 1.35rem;
  font-weight: 900;
`;

const MetricMeta = styled.p`
  margin-top: 0.28rem;
  color: var(--ink-soft);
  font-size: 0.8rem;
  line-height: 1.45;
`;

const ProgressGroup = styled.div`
  margin-top: 1rem;
`;

const ProgressLabel = styled.p`
  font-size: 0.9rem;
  color: var(--ink-soft);
`;

const ProgressBar = styled.div`
  margin-top: 0.45rem;
  height: 0.8rem;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(122, 136, 209, 0.16);
`;

const ProgressFill = styled.div<{ $value: number; $secondary?: boolean }>`
  width: ${({ $value }) => `${Math.max(0, Math.min(100, $value))}%`};
  height: 100%;
  border-radius: inherit;
  background: ${({ $secondary }) =>
    $secondary
      ? "linear-gradient(90deg, #57d3ca 0%, #5f9bff 100%)"
      : "linear-gradient(90deg, #5b72ff 0%, #7f5dff 100%)"};
`;

const DashboardGrid = styled.section`
  display: grid;
  gap: 1rem;

  @media (min-width: 1080px) {
    grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr);
  }
`;

const LeaderboardCard = styled.article`
  ${GlassBase}
  border-radius: 1.5rem;
  padding: 1.4rem;
`;

const SectionHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
`;

const SectionEyebrow = styled.p`
  font-size: 0.8rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--accent-dark);
`;

const SectionTitle = styled.h2`
  margin-top: 0.45rem;
  font-size: 1.7rem;
  line-height: 1.12;
  font-weight: 900;
`;

const SectionText = styled.p`
  margin-top: 0.45rem;
  color: var(--ink-soft);
  line-height: 1.65;
`;

const Tabs = styled.div`
  display: inline-flex;
  gap: 0.55rem;
  padding: 0.25rem;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.78);
`;

const TabButton = styled.button<{ $active: boolean }>`
  border: 0;
  border-radius: 999px;
  padding: 0.62rem 1rem;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 800;
  transition: background-color 160ms ease, color 160ms ease;
  background: ${({ $active }) =>
    $active ? "linear-gradient(135deg, #5779ff 0%, #6d5aff 100%)" : "transparent"};
  color: ${({ $active }) => ($active ? "#fff" : "var(--ink)")};
`;

const LeaderboardList = styled.div`
  margin-top: 1.15rem;
  display: grid;
  gap: 0.75rem;
`;

const LeaderboardRow = styled.div<{ $highlight: boolean }>`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.9rem;
  border-radius: 1.1rem;
  border: 1px solid ${({ $highlight }) => ($highlight ? "var(--line-strong)" : "var(--line)")};
  background: ${({ $highlight }) =>
    $highlight ? "rgba(92, 114, 255, 0.08)" : "rgba(255, 255, 255, 0.82)"};
  padding: 0.95rem 1rem;
`;

const LeaderboardRank = styled.div<{ $isFirst: boolean }>`
  min-width: 2.4rem;
  height: 2.4rem;
  border-radius: 0.9rem;
  padding: 0 0.6rem;
  background: ${({ $isFirst }) =>
    $isFirst
      ? "linear-gradient(135deg, rgba(242, 228, 192, 0.92) 0%, rgba(234, 182, 55, 0.96) 100%)"
      : "rgba(92, 114, 255, 0.12)"};
  color: ${({ $isFirst }) => ($isFirst ? "#7b4a00" : "var(--accent-dark)")};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.22rem;
  font-weight: 900;
  box-shadow: ${({ $isFirst }) => ($isFirst ? "0 10px 24px rgba(234, 182, 55, 0.24)" : "none")};
`;

const RankCrown = styled(Image)`
  flex: 0 0 auto;
`;

const RankNumber = styled.span`
  line-height: 1;
`;

const LeaderboardNameWrap = styled.div`
  min-width: 0;
`;

const LeaderboardName = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  font-size: 1rem;
  font-weight: 800;
`;

const SelfBadge = styled.span`
  border-radius: 999px;
  padding: 0.15rem 0.55rem;
  background: rgba(93, 211, 202, 0.18);
  color: #197a72;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

const LeaderboardMeta = styled.p`
  margin-top: 0.25rem;
  color: var(--ink-soft);
  font-size: 0.86rem;
`;

const LeaderboardScore = styled.div`
  font-size: 1.15rem;
  font-weight: 900;
  color: var(--accent-dark);
`;

const SideColumn = styled.div`
  display: grid;
  gap: 1rem;
`;

const MiniCard = styled.article`
  ${GlassBase}
  border-radius: 1.4rem;
  padding: 1.25rem;
`;

const MiniTitle = styled.h3`
  margin-top: 0.45rem;
  font-size: 1.35rem;
  font-weight: 900;
`;


const NextSteps = styled.ul`
  margin-top: 1rem;
  display: grid;
  gap: 0.75rem;
`;

const NextStep = styled.li`
  list-style: none;
  border-radius: 1rem;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.78);
  padding: 0.9rem 0.95rem;
  color: var(--ink-soft);
  line-height: 1.65;

  &::before {
    content: "•";
    margin-right: 0.45rem;
    color: var(--accent-dark);
  }
`;

const HistoryCard = styled.article`
  ${GlassBase}
  border-radius: 1.5rem;
  padding: 1.4rem;
`;

const EmptyText = styled.p`
  margin-top: 1rem;
  color: var(--ink-soft);
  line-height: 1.65;
`;

const HistoryList = styled.div`
  margin-top: 1rem;
  display: grid;
  gap: 0.8rem;

  @media (min-width: 900px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

const HistoryItem = styled.article`
  border-radius: 1.15rem;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.84);
  padding: 1rem;
`;

const HistoryTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
`;

const HistoryTitle = styled.h3`
  font-size: 1rem;
  line-height: 1.4;
  font-weight: 800;
`;

const HistoryBadge = styled.div`
  border-radius: 999px;
  border: 1px solid var(--line);
  background: #fff;
  padding: 0.22rem 0.58rem;
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--accent-dark);
`;

const HistoryMeta = styled.p`
  margin-top: 0.55rem;
  font-size: 0.86rem;
  color: var(--ink-soft);
`;

const HistoryBar = styled.div`
  margin-top: 0.85rem;
  height: 0.72rem;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(92, 114, 255, 0.15);
`;

const HistoryBarFill = styled.div<{ $value: number }>`
  width: ${({ $value }) => `${Math.max(0, Math.min(100, $value))}%`};
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #54c7bb 0%, #5779ff 100%);
`;

const HistoryPercent = styled.p`
  margin-top: 0.55rem;
  font-size: 1rem;
  font-weight: 900;
`;




