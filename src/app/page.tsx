"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import styled from "styled-components";

const programs = [
  {
    title: "Групповые занятия по подготовке к TOPIK",
    description:
      "Готовься к TOPIK с поддержкой группы: разберем формат экзамена, отработаем реальные задания и закрепим тактики на демо-тестах.",
    href: "/topik",
    image: "/assets/2.svg",
  },
  {
    title: "Индивидуальные уроки с Ринае",
    description:
      "Персональная программа под твои цели: разговорный корейский, учеба, работа или переезд. Максимум внимания и быстрый прогресс.",
    href: "/courses",
    image: "/assets/4.svg",
  },
  {
    title: "Онлайн-курсы корейского языка",
    description:
      "Учи язык в удобном темпе с видеоуроками, заданиями и обратной связью. Подходит для самостоятельного и стабильного обучения.",
    href: "/courses",
    image: "/assets/3.svg",
  },
];

const highlights = [
  {
    title: "Учитель, которому важен результат",
    text: "Я лично сопровождаю каждого студента: от первых диалогов до уверенной подготовки к TOPIK.",
    image: "assets/14.svg"
  },
  {
    title: "Разные форматы обучения",
    text: "Группы, индивидуальные уроки и системная подготовка к экзамену в одном месте.",
    image: "assets/17.svg"
  },
  {
    title: "Гибкий график",
    text: "Занимайся дома, в кафе или в дороге. Подстроимся под ваш ритм и текущую нагрузку.",
    image: "/assets/9.svg",
  },
  {
    title: "Опыт и практика",
    text: "Не только теория по учебнику, а реальные сценарии, живой язык и понятные объяснения.",
    image: "/assets/7.svg",
  },
];

const reviews = [
  {
    image: "/assets/person1.jpg",
    badge: "Индивидуальные уроки",
    title: "Я начала понимать корейскую речь",
    quote:
      "Моя цель была разговорная речь. После занятий мне стало спокойно говорить и отвечать на вопросы без страха.",
    author: "Валерия",
  },
  {
    image: "/assets/person2.jpg",
    badge: "Подготовка к TOPIK II",
    title: "Я получила 4 уровень и осуществила мечту",
    quote:
      "Уроки были четко структурированы, а задания помогли закрыть пробелы. На экзамене я чувствовала уверенность.",
    author: "Мадина",
  },
  {
    image: "/assets/person3.jpg",
    badge: "Онлайн-курс",
    title: "Очень рад, что выбрал этот формат",
    quote:
      "Материалы доступные и понятные, а дополнительные задания хорошо закрепляют знания. Прогресс заметил быстро.",
    author: "Эмиль",
  },
];

const faqItems = [
  {
    question: "Я отправила заявку. Когда со мной свяжутся?",
    answer:
      "Обычно мы отвечаем в течение 2 часов. Если заявка отправлена ночью, свяжемся с вами в первой половине следующего дня.",
  },
  {
    question: "Сколько времени займет обучение?",
    answer:
      "Зависит от цели и стартового уровня. После короткой диагностики составляем реалистичный план по срокам и формату.",
  },
  {
    question: "Как понять, какой у меня уровень?",
    answer:
      "Перед началом проводим вводный тест и короткое собеседование, чтобы точно определить ваш текущий уровень.",
  },
  {
    question: "Можно ли попробовать пробный урок?",
    answer:
      "Да, можно записаться на пробный урок, чтобы понять формат, темп и то, насколько комфортно вам заниматься.",
  },
];

const hangulConsonants = [
  { letter: "ㄱ", index: 0, transcription: "Г" },
  { letter: "ㄴ", index: 2, transcription: "Н" },
  { letter: "ㄷ", index: 3, transcription: "Д" },
  { letter: "ㄹ", index: 5, transcription: "Р" },
  { letter: "ㅁ", index: 6, transcription: "М" },
  { letter: "ㅂ", index: 7, transcription: "Б" },
  { letter: "ㅅ", index: 9, transcription: "С" },
  { letter: "ㅇ", index: 11, transcription: "" },
  { letter: "ㅈ", index: 12, transcription: "ДЖ" },
  { letter: "ㅎ", index: 18, transcription: "Х" },
];

const hangulVowels = [
  { letter: "ㅏ", index: 0, transcription: "А" },
  { letter: "ㅑ", index: 2, transcription: "Я" },
  { letter: "ㅓ", index: 4, transcription: "О" },
  { letter: "ㅕ", index: 6, transcription: "Ё" },
  { letter: "ㅗ", index: 8, transcription: "О" },
  { letter: "ㅛ", index: 12, transcription: "Ё" },
  { letter: "ㅜ", index: 13, transcription: "У" },
  { letter: "ㅠ", index: 17, transcription: "Ю" },
  { letter: "ㅡ", index: 18, transcription: "Ы" },
  { letter: "ㅣ", index: 20, transcription: "И" },
];

const hangulExamples: Record<string, { word: string; meaning: string }> = {
  가: { word: "가다", meaning: "идти, уходить" },
  나: { word: "나", meaning: "я" },
  다: { word: "다리", meaning: "нога, мост" },
  마: { word: "마음", meaning: "сердце, душа" },
  바: { word: "바다", meaning: "море" },
  사: { word: "사람", meaning: "человек" },
  아: { word: "아이", meaning: "ребёнок" },
  자: { word: "자다", meaning: "спать" },
  하: { word: "하다", meaning: "делать" },
};

function buildHangulSyllable(consonantIndex: number, vowelIndex: number) {
  return String.fromCharCode(0xac00 + (consonantIndex * 21 + vowelIndex) * 28);
}

type ContactStatus = "idle" | "sending" | "success" | "error";
type AudioStatus = "idle" | "loading" | "playing" | "error";

export default function Home() {
  const [contactStatus, setContactStatus] = useState<ContactStatus>("idle");
  const [contactMessage, setContactMessage] = useState("");
  const [programsVisible, setProgramsVisible] = useState(false);
  const [highlightsVisible, setHighlightsVisible] = useState(false);
  const [reviewsVisible, setReviewsVisible] = useState(false);
  const [selectedConsonant, setSelectedConsonant] = useState(hangulConsonants[0]);
  const [selectedVowel, setSelectedVowel] = useState(hangulVowels[0]);
  const [audioStatus, setAudioStatus] = useState<AudioStatus>("idle");

  const hangulSyllable = buildHangulSyllable(selectedConsonant.index, selectedVowel.index);
  const hangulTranscription = `${selectedConsonant.transcription}${selectedVowel.transcription}`;
  const hangulExample = hangulExamples[hangulSyllable];

  const programsRef = useRef<HTMLElement | null>(null);
  const highlightsRef = useRef<HTMLElement | null>(null);
  const reviewsRef = useRef<HTMLElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopCurrentAudio = () => {
    const currentAudio = audioRef.current;
    if (!currentAudio) return;

    currentAudio.onplaying = null;
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.pause();
    currentAudio.currentTime = 0;
    audioRef.current = null;
  };

  const selectConsonant = (consonant: (typeof hangulConsonants)[number]) => {
    stopCurrentAudio();
    setAudioStatus("idle");
    setSelectedConsonant(consonant);
  };

  const selectVowel = (vowel: (typeof hangulVowels)[number]) => {
    stopCurrentAudio();
    setAudioStatus("idle");
    setSelectedVowel(vowel);
  };

  const playHangulAudio = async () => {
    stopCurrentAudio();

    const fileName = `корейский_слог_${hangulSyllable}.mp3`;
    const audio = new Audio(`/audio/${encodeURIComponent(fileName)}`);
    audio.preload = "auto";
    audioRef.current = audio;
    setAudioStatus("loading");

    audio.onplaying = () => {
      if (audioRef.current === audio) setAudioStatus("playing");
    };
    audio.onended = () => {
      if (audioRef.current !== audio) return;
      audioRef.current = null;
      setAudioStatus("idle");
    };
    audio.onerror = () => {
      if (audioRef.current !== audio) return;
      audioRef.current = null;
      setAudioStatus("error");
    };

    try {
      await audio.play();
    } catch {
      if (audioRef.current === audio) {
        audioRef.current = null;
        setAudioStatus("error");
      }
    }
  };

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const options: IntersectionObserverInit = {
      root: null,
      rootMargin: "0px 0px -10% 0px",
      threshold: 0.2,
    };

    const observeOnce = (
      node: HTMLElement | null,
      onVisible: () => void,
    ) => {
      if (!node) return;

      const observer = new IntersectionObserver((entries) => {
        if (!entries[0]?.isIntersecting) return;
        onVisible();
        observer.unobserve(node);
      }, options);

      observer.observe(node);
      observers.push(observer);
    };

    observeOnce(programsRef.current, () => setProgramsVisible(true));
    observeOnce(highlightsRef.current, () => setHighlightsVisible(true));
    observeOnce(reviewsRef.current, () => setReviewsVisible(true));

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, []);

  const handleContactSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const phoneCode = String(formData.get("phoneCode") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const preferredFormat = String(formData.get("preferredFormat") ?? "").trim();

    if (!name || !email) {
      setContactStatus("error");
      setContactMessage("Пожалуйста, заполните имя и email.");
      return;
    }

    setContactStatus("sending");
    setContactMessage("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          phone: `${phoneCode} ${phone}`.trim(),
          preferredFormat,
        }),
      });

      const result = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Не удалось отправить заявку.");
      }

      form.reset();
      setContactStatus("success");
      setContactMessage(result.message ?? "Заявка отправлена. Скоро свяжемся с вами.");
    } catch (error) {
      setContactStatus("error");
      setContactMessage(
        error instanceof Error ? error.message : "Ошибка отправки. Попробуйте еще раз.",
      );
    }
  };

  return (
    <PageSection>
      <Shell>
        <HeroShowcase>
          <HeroTop>
            <HeroCopy>
              <Pill><span aria-hidden="true">✦</span> Уроки корейского языка с Ринае</Pill>
              <HeroTitle>
                Учить корейский <HeroTitleAccent>легко, интересно</HeroTitleAccent> и эффективно!
              </HeroTitle>
              <HeroText>
                Пошаговые уроки, живая практика, тесты и игры — всё, что нужно для уверенного
                знания корейского языка.
              </HeroText>
              <ButtonRow>
                <PrimaryButton href="/auth/signup">
                  Начать обучение <span aria-hidden="true">→</span>
                </PrimaryButton>
                <SecondaryButton href="/courses">
                  Узнать больше <span aria-hidden="true">↗</span>
                </SecondaryButton>
              </ButtonRow>
              <HeroBenefits aria-label="Преимущества обучения">
                <HeroBenefit>
                  <BenefitIcon aria-hidden="true">
                    <Image src="/assets/48.svg" alt="" width={56} height={56} />
                  </BenefitIcon>
                  <span><strong>Понятные уроки</strong><small>с нуля до TOPIK</small></span>
                </HeroBenefit>
                <HeroBenefit>
                  <BenefitIcon aria-hidden="true">
                    <Image src="/assets/49.svg" alt="" width={56} height={56} />
                  </BenefitIcon>
                  <span><strong>Практика каждый день</strong><small>закрепляй знания</small></span>
                </HeroBenefit>
                <HeroBenefit>
                  <BenefitIcon aria-hidden="true">
                    <Image src="/assets/50.svg" alt="" width={56} height={56} />
                  </BenefitIcon>
                  <span><strong>Достигай целей</strong><small>и отмечай прогресс</small></span>
                </HeroBenefit>
              </HeroBenefits>
            </HeroCopy>

            <HeroVisual>
              <HeroMainImage
                src="/assets/main-hero-transparent-ru-v2.png"
                alt="Ученица занимается корейским языком вместе с виртуальным помощником"
                width={1254}
                height={1254}
                priority
              />
            </HeroVisual>
          </HeroTop>

          <HeroStats aria-label="Обучение в цифрах">
            <HeroStat>
              <StatIcon aria-hidden="true">
                <Image src="/assets/51.svg" alt="" width={112} height={112} />
              </StatIcon>
              <span><strong>120+</strong><small>уроков</small></span>
            </HeroStat>
            <HeroStat>
              <StatIcon aria-hidden="true">
                <Image src="/assets/52.svg" alt="" width={112} height={112} />
              </StatIcon>
              <span><strong>100+</strong><small>учеников</small></span>
            </HeroStat>
            <HeroStat>
              <StatIcon aria-hidden="true">
                <Image src="/assets/48.svg" alt="" width={112} height={112} />
              </StatIcon>
              <span><strong>4.9/5</strong><small>средняя оценка</small></span>
            </HeroStat>
            <HeroStat>
              <StatIcon aria-hidden="true">
                <Image src="/assets/53.svg" alt="" width={112} height={112} />
              </StatIcon>
              <span><strong>100%</strong><small>практики</small></span>
            </HeroStat>
          </HeroStats>
        </HeroShowcase>

        <HangulLab>
          <LabIntro>
            <LabPill><span aria-hidden="true">✦</span> Интерактивный тренажёр</LabPill>
            <LabTitle>Собери свой первый слог на Хангыле</LabTitle>
            <LabText>
              Корейский алфавит работает как конструктор. Выбери согласную и гласную — мы
              мгновенно соединим их в один слог.
            </LabText>
            <LabPoints>
              <li><span aria-hidden="true">✓</span> Наглядная сборка корейских слогов</li>
              <li><span aria-hidden="true">✓</span> Русская транскрипция и примеры знакомых слов</li>
            </LabPoints>
          </LabIntro>

          <ConstructorCard>
            <LetterGroup>
              <LetterLabel><strong>1.</strong> Выбери согласную букву <span>(자음)</span></LetterLabel>
              <LetterChoices>
                {hangulConsonants.map((consonant) => (
                  <LetterButton
                    key={consonant.letter}
                    type="button"
                    $active={selectedConsonant.letter === consonant.letter}
                    aria-pressed={selectedConsonant.letter === consonant.letter}
                    onClick={() => selectConsonant(consonant)}
                  >
                    {consonant.letter}
                  </LetterButton>
                ))}
              </LetterChoices>
            </LetterGroup>

            <LetterGroup>
              <LetterLabel><strong>2.</strong> Выбери гласную букву <span>(모음)</span></LetterLabel>
              <LetterChoices>
                {hangulVowels.map((vowel) => (
                  <LetterButton
                    key={vowel.letter}
                    type="button"
                    $active={selectedVowel.letter === vowel.letter}
                    $vowel
                    aria-pressed={selectedVowel.letter === vowel.letter}
                    onClick={() => selectVowel(vowel)}
                  >
                    {vowel.letter}
                  </LetterButton>
                ))}
              </LetterChoices>
            </LetterGroup>

            <SyllableResult aria-live="polite">
              <SyllableTile>{hangulSyllable}</SyllableTile>
              <SyllableInfo>
                <SyllableFormula>
                  {selectedConsonant.letter} + {selectedVowel.letter} = {hangulSyllable}
                </SyllableFormula>
                <SyllableReading>[{hangulTranscription}]</SyllableReading>
                <SyllableExample>
                  {hangulExample ? `${hangulExample.word} — ${hangulExample.meaning}` : "Твой новый корейский слог"}
                </SyllableExample>
              </SyllableInfo>
              <AudioButton
                type="button"
                disabled={audioStatus === "loading"}
                onClick={playHangulAudio}
                aria-label={`Прослушать слог ${hangulSyllable}`}
              >
                <span aria-hidden="true">♪</span>{" "}
                {audioStatus === "loading"
                  ? "Загрузка…"
                  : audioStatus === "playing"
                    ? `Звучит ${hangulSyllable}`
                    : audioStatus === "error"
                      ? "Попробовать снова"
                      : `Слушать ${hangulSyllable}`}
              </AudioButton>
            </SyllableResult>
          </ConstructorCard>
        </HangulLab>

        <CenterSection>
          <AccentBar />
          <SectionTitle>Твоя корейская история начинается здесь</SectionTitle>
          <SectionText>
            Мечтаешь учиться в корейском университете или колледже? Наши курсы помогут уверенно
            выучить язык, подготовиться к поступлению и легче адаптироваться к жизни в Корее.
          </SectionText>
        </CenterSection>

        <ProgramGrid ref={programsRef}>
          {programs.map((program, index) => (
            <ProgramCard key={program.title} $delay={index * 120} $visible={programsVisible}>
              <ProgramImageWrap>
                <Image
                  src={program.image}
                  alt={program.title}
                  width={420}
                  height={280}
                  style={{ width: "100%", height: "auto" }}
                />
              </ProgramImageWrap>
              <ProgramTitle>{program.title}</ProgramTitle>
              <ProgramText>{program.description}</ProgramText>
              {/* <ProgramLink href={program.href}>
                Подробнее
                <Arrow aria-hidden>→</Arrow>
              </ProgramLink> */}
            </ProgramCard>
          ))}
        </ProgramGrid>

        <BlockSection ref={highlightsRef}>
          <BlockTitle>Что делает наши курсы особенными</BlockTitle>
          <HighlightGrid>
            {highlights.map((item, index) => (
              <HighlightCard key={item.title} $delay={index * 120} $visible={highlightsVisible}>
                <HighlightTop>
                  <HighlightBadge>{index + 1}</HighlightBadge>
                  {item.image ? (
                    <HighlightThumb src={item.image} alt={item.title} width={96} height={96} />
                  ) : null}
                </HighlightTop>
                <HighlightTitle>{item.title}</HighlightTitle>
                <HighlightText>{item.text}</HighlightText>
              </HighlightCard>
            ))}
          </HighlightGrid>
        </BlockSection>

        <BlockSection ref={reviewsRef}>
          <CenterSection>
            <AccentBar />
            <SectionTitle>Что о нас говорят</SectionTitle>
          </CenterSection>
          <ReviewGrid>
            {reviews.map((review, index) => (
              <ReviewCard key={review.author} $delay={index * 140} $visible={reviewsVisible}>
                <ReviewAvatar src={review.image} alt={review.author} width={132} height={132} />
                <ReviewBadge>{review.badge}</ReviewBadge>
                <ReviewTitle>{review.title}</ReviewTitle>
                <ReviewQuote>«{review.quote}»</ReviewQuote>
                <ReviewAuthor>{review.author}</ReviewAuthor>
              </ReviewCard>
            ))}
          </ReviewGrid>
        </BlockSection>

        <FaqSection>
          <BlockTitle>Частые вопросы</BlockTitle>
          <FaqItems>
            {faqItems.map((item, index) => (
              <FaqItem key={item.question} open={index === 0}>
                <FaqQuestion>{item.question}</FaqQuestion>
                <FaqAnswer>{item.answer}</FaqAnswer>
              </FaqItem>
            ))}
          </FaqItems>
        </FaqSection>

        <CtaCard>
          <SectionTitle>Начни говорить на корейском уже сейчас</SectionTitle>
          <CtaText>Выбери удобный формат обучения, а с программой и планом мы поможем.</CtaText>
          <FormWrap>
            <LeadForm onSubmit={handleContactSubmit}>
              <Field name="name" type="text" placeholder="Как вас зовут?" required />
              <Field name="email" type="email" placeholder="Электронная почта" required />
              <PhoneRow>
                <Select name="phoneCode" defaultValue="+44">
                  <option value="+7">RU (+7)</option>
                  <option value="+7">KZ (+7)</option>
                  <option value="+82">KR (+82)</option>
                  <option value="+7">UZ (+998)</option>
                </Select>
                <Field name="phone" type="tel" placeholder="123 456 7890" />
              </PhoneRow>
              <TextArea name="preferredFormat" placeholder="Какой формат уроков удобен вам?" />
              <FormButtonRow>
                <SubmitButton type="submit" disabled={contactStatus === "sending"}>
                  {contactStatus === "sending" ? "Отправляем..." : "Отправить заявку"}
                </SubmitButton>
                {/* <SecondaryButton href="/courses">Смотреть курсы</SecondaryButton> */}
              </FormButtonRow>
              {contactStatus === "success" ? (
                <FormNotice $tone="success" aria-live="polite">
                  {contactMessage}
                </FormNotice>
              ) : null}
              {contactStatus === "error" ? (
                <FormNotice $tone="error" aria-live="polite">
                  {contactMessage}
                </FormNotice>
              ) : null}
            </LeadForm>
          </FormWrap>
        </CtaCard>
      </Shell>
    </PageSection>
  );
}

const PageSection = styled.section`
  padding: 0.5rem 0 6rem;
`;

const Shell = styled.div`
  width: min(1400px, calc(100% - 2rem));
  margin-inline: auto;
  display: grid;
  gap: 3rem;

  @media (min-width: 768px) {
    gap: 4rem;
  }
`;

const GlassCard = styled.article`
  border: 1px solid color-mix(in srgb, var(--line) 80%, #fff 20%);
  background: var(--surface);
  box-shadow: 0 25px 60px rgba(46, 59, 146, 0.11);
  backdrop-filter: blur(10px);
  border-radius: 1.5rem;
`;

const HeroShowcase = styled.section`
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: 2rem;
  background:
    radial-gradient(circle at 72% 12%, rgba(255, 255, 255, 0.96) 0, rgba(255, 255, 255, 0) 32%),
    radial-gradient(circle at 12% 84%, rgba(206, 217, 255, 0.58) 0, rgba(206, 217, 255, 0) 35%),
    linear-gradient(135deg, #fbfcff 0%, #f3f1ff 55%, #e8edff 100%);
  box-shadow: 0 28px 80px rgba(68, 72, 166, 0.14);

  &::before,
  &::after {
    position: absolute;
    content: "";
    border-radius: 999px;
    filter: blur(2px);
    pointer-events: none;
  }

  &::before {
    width: 18rem;
    height: 18rem;
    top: -9rem;
    left: 36%;
    background: rgba(210, 194, 255, 0.22);
  }

  &::after {
    width: 13rem;
    height: 13rem;
    right: -4rem;
    bottom: 3rem;
    background: rgba(255, 200, 226, 0.2);
  }
`;

const HeroTop = styled.div`
  position: relative;
  z-index: 1;
  display: grid;

  @media (min-width: 980px) {
    min-height: 43rem;
    grid-template-columns: minmax(0, 1.02fr) minmax(0, 0.98fr);
  }
`;

const HeroCopy = styled.div`
  position: relative;
  z-index: 3;
  padding: 2.5rem 1.35rem 1rem;

  @media (min-width: 768px) {
    padding: 3.75rem 3rem 1.5rem;
  }

  @media (min-width: 1180px) {
    padding: 5rem 0 2rem 4.5rem;
  }
`;

const Pill = styled.p`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border-radius: 9999px;
  border: 1px solid rgba(110, 91, 224, 0.11);
  background: rgba(111, 92, 225, 0.08);
  padding: 0.45rem 0.9rem;
  font-size: clamp(0.78rem, 1vw, 0.92rem);
  font-weight: 750;
  color: #6857d7;
`;

const HeroTitle = styled.h1`
  margin-top: 1.55rem;
  max-width: 42rem;
  font-size: clamp(2.45rem, 4.3vw, 4.35rem);
  line-height: 1.05;
  font-weight: 900;
  letter-spacing: -0.045em;
  color: #18214c;
`;

const HeroTitleAccent = styled.span`
  display: block;
  background: linear-gradient(110deg, #7c68ee 0%, #545bdc 64%, #7b6be9 100%);
  background-clip: text;
  color: transparent;
`;

const HeroText = styled.p`
  margin-top: 1.25rem;
  max-width: 36rem;
  font-size: clamp(1rem, 1.4vw, 1.18rem);
  line-height: 1.65;
  color: var(--ink-soft);

  @media (min-width: 980px) {
    max-width: 40rem;
  }
`;

const ButtonRow = styled.div`
  margin-top: 2rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
`;

const PrimaryButton = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  border-radius: 9999px;
  background: linear-gradient(135deg, #6f66ee 0%, #6552e8 100%);
  color: #fff;
  box-shadow: 0 14px 28px rgba(91, 79, 218, 0.26);
  transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease;
  padding: 0.88rem 1.7rem;
  font-size: clamp(0.95rem, 1vw, 1.05rem);
  font-weight: 700;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 16px 30px rgba(76, 98, 255, 0.42);
    filter: saturate(1.06);
  }
`;

const SecondaryButton = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  border-radius: 9999px;
  border: 1px solid var(--line-strong);
  background: rgba(255, 255, 255, 0.95);
  transition: border-color 160ms ease, background-color 160ms ease, transform 160ms ease;
  padding: 0.86rem 1.65rem;
  font-size: clamp(0.95rem, 1vw, 1.05rem);
  font-weight: 700;
  color: #5e59ce;

  &:hover {
    border-color: var(--accent);
    background-color: #f7f8ff;
    transform: translateY(-1px);
  }
`;

const HeroBenefits = styled.div`
  margin-top: 2.25rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem 1rem;

  @media (min-width: 720px) {
    flex-wrap: nowrap;
    gap: clamp(0.5rem, 1vw, 0.9rem);
  }

  @media (min-width: 980px) and (max-width: 1180px) {
    gap: 0.5rem;
  }
`;

const HeroBenefit = styled.div`
  display: flex;
  align-items: center;
  flex: 0 1 auto;
  gap: 0.4rem;
  min-width: 0;
  color: #29335f;

  > span:last-child {
    display: grid;
    gap: 0.16rem;
    white-space: nowrap;
  }

  strong {
    font-size: 0.9rem;
    font-weight: 800;
  }

  small {
    font-size: 0.78rem;
    color: #747c9e;
  }
`;

const BenefitIcon = styled.span`
  position: relative;
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: 0 0 2.25rem;
  place-items: center;
  overflow: hidden;
  border-radius: 0.5rem;

  img {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 4.75rem;
    height: 4.75rem;
    max-width: none;
    object-fit: contain;
    transform: translate(-50%, -50%);
  }
`;

const HeroVisual = styled.div`
  position: relative;
  overflow: hidden;
  min-height: 25rem;

  @media (min-width: 500px) and (max-width: 979px) {
    min-height: clamp(25rem, 66vw, 39rem);
    margin-top: clamp(-7rem, -11vw, -3.25rem);
  }

  @media (min-width: 980px) {
    min-height: 43rem;
    overflow: visible;
  }
`;

const HeroMainImage = styled(Image)`
  position: absolute;
  width: 125%;
  max-width: none;
  height: auto;
  top: 0;
  right: -12.5%;
  object-fit: contain;
  filter: drop-shadow(0 24px 26px rgba(66, 59, 148, 0.1));

  @media (min-width: 560px) {
    width: 115%;
    right: -10%;
  }

  @media (min-width: 500px) and (max-width: 979px) {
    width: 102%;
    top: 0;
    right: -1%;
  }

  @media (min-width: 980px) {
    width: 142%;
    top: -2.5rem;
    right: -18%;
  }
`;

const HeroStats = styled.div`
  position: relative;
  z-index: 4;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0 1rem 1rem;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: 1.85rem;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(249, 249, 255, 0.76));
  box-shadow:
    0 22px 55px rgba(74, 80, 170, 0.09),
    inset 0 1px 0 rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(22px) saturate(115%);

  @media (min-width: 760px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    margin: 0 2.5rem 1.5rem;
  }
`;

const HeroStat = styled.div`
  display: flex;
  min-height: 7.5rem;
  align-items: center;
  justify-content: center;
  gap: 0.9rem;
  padding: 1rem;

  &:nth-child(odd) {
    border-right: 1px solid rgba(126, 137, 186, 0.16);
  }

  &:nth-child(-n + 2) {
    border-bottom: 1px solid rgba(126, 137, 186, 0.16);
  }

  > span:last-child {
    display: grid;
    gap: 0.25rem;
  }

  strong {
    color: #4849bd;
    font-size: clamp(1.35rem, 2vw, 1.85rem);
    line-height: 1;
  }

  small {
    color: #667096;
    font-size: 0.82rem;
    text-transform: lowercase;
  }

  @media (min-width: 760px) {
    &:not(:last-child) {
      border-right: 1px solid rgba(126, 137, 186, 0.16);
    }

    &:nth-child(-n + 2) {
      border-bottom: 0;
    }
  }
`;

const StatIcon = styled.span`
  position: relative;
  width: 3rem;
  height: 3rem;
  flex: 0 0 3rem;
  overflow: visible;

  img {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 7rem;
    height: 7rem;
    max-width: none;
    object-fit: contain;
    transform: translate(-50%, -50%);
  }
`;

const HangulLab = styled.section`
  position: relative;
  display: grid;
  gap: 2rem;
  overflow: hidden;
  border-radius: 2rem;
  background:
    radial-gradient(circle at 4% 100%, rgba(105, 85, 235, 0.55) 0, transparent 28%),
    linear-gradient(125deg, #6330ad 0%, #413493 44%, #111a38 100%);
  box-shadow: 0 24px 55px rgba(25, 26, 69, 0.22);
  padding: 2rem 1.25rem;
  color: #fff;

  @media (min-width: 960px) {
    grid-template-columns: 0.8fr 1.2fr;
    align-items: center;
    gap: 3rem;
    padding: 2.75rem 3rem;
  }
`;

const LabIntro = styled.div`
  max-width: 34rem;
`;

const LabPill = styled.p`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.09);
  padding: 0.35rem 0.75rem;
  color: #e7ddff;
  font-size: 0.78rem;
  font-weight: 750;
`;

const LabTitle = styled.h2`
  margin-top: 1.15rem;
  max-width: 31rem;
  font-size: clamp(2rem, 3.3vw, 3.15rem);
  line-height: 1.08;
  font-weight: 900;
`;

const LabText = styled.p`
  margin-top: 1rem;
  color: rgba(239, 239, 255, 0.82);
  font-size: 1rem;
  line-height: 1.65;
`;

const LabPoints = styled.ul`
  margin-top: 1.35rem;
  display: grid;
  gap: 0.55rem;
  list-style: none;
  color: rgba(247, 246, 255, 0.88);
  font-size: 0.84rem;

  span {
    display: inline-grid;
    width: 1.15rem;
    height: 1.15rem;
    margin-right: 0.4rem;
    place-items: center;
    border: 1px solid #33e8b2;
    border-radius: 999px;
    color: #33e8b2;
    font-size: 0.68rem;
  }
`;

const ConstructorCard = styled.div`
  display: grid;
  gap: 1.15rem;
  border: 1px solid rgba(255, 255, 255, 0.17);
  border-radius: 1.45rem;
  background: rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  padding: 1.2rem;
  backdrop-filter: blur(12px);

  @media (min-width: 640px) {
    padding: 1.65rem;
  }
`;

const LetterGroup = styled.div`
  display: grid;
  gap: 0.6rem;
`;

const LetterLabel = styled.p`
  color: #f4f1ff;
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.035em;

  span {
    color: #cfc8ef;
  }
`;

const LetterChoices = styled.div`
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.48rem;

  @media (min-width: 560px) {
    grid-template-columns: repeat(10, minmax(0, 1fr));
  }
`;

const LetterButton = styled.button<{ $active: boolean; $vowel?: boolean }>`
  display: grid;
  min-width: 0;
  aspect-ratio: 1 / 0.9;
  place-items: center;
  border: 1px solid ${({ $active }) => ($active ? "rgba(255,255,255,0.65)" : "transparent")};
  border-radius: 0.8rem;
  background: ${({ $active, $vowel }) =>
    $active
      ? $vowel
        ? "linear-gradient(145deg, #6977ff, #5261ef)"
        : "linear-gradient(145deg, #c442ff, #8f27ee)"
      : "rgba(255,255,255,0.12)"};
  box-shadow: ${({ $active }) => ($active ? "0 8px 18px rgba(15, 12, 54, 0.22)" : "none")};
  color: #fff;
  font-family: var(--font-kr), sans-serif;
  font-size: clamp(1rem, 1.6vw, 1.3rem);
  font-weight: 800;
  cursor: pointer;
  transition: transform 150ms ease, background 150ms ease, border-color 150ms ease;

  &:hover {
    transform: translateY(-2px);
    background: ${({ $active, $vowel }) =>
      $active
        ? $vowel
          ? "linear-gradient(145deg, #6977ff, #5261ef)"
          : "linear-gradient(145deg, #c442ff, #8f27ee)"
        : "rgba(255,255,255,0.2)"};
  }

  &:focus-visible {
    outline: 3px solid rgba(255, 255, 255, 0.82);
    outline-offset: 2px;
  }
`;

const SyllableResult = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.8rem 1rem;
  border-radius: 1.2rem;
  background: rgba(12, 20, 48, 0.82);
  padding: 1rem;

  @media (min-width: 620px) {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }
`;

const SyllableTile = styled.div`
  display: grid;
  width: 4.4rem;
  height: 4.4rem;
  place-items: center;
  border-radius: 1rem;
  background: linear-gradient(145deg, #8f52ff, #7131f1);
  box-shadow: 0 12px 24px rgba(77, 29, 196, 0.25);
  font-family: var(--font-kr), sans-serif;
  font-size: 2.35rem;
  font-weight: 900;
`;

const SyllableInfo = styled.div`
  min-width: 0;
`;

const SyllableFormula = styled.p`
  color: #afa9d0;
  font-size: 0.75rem;
  font-weight: 700;
`;

const SyllableReading = styled.p`
  margin-top: 0.15rem;
  font-size: 1.1rem;
  font-weight: 900;
`;

const SyllableExample = styled.p`
  margin-top: 0.18rem;
  overflow: hidden;
  color: #d0cbe8;
  font-size: 0.78rem;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const AudioButton = styled.button`
  grid-column: 1 / -1;
  justify-self: stretch;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: linear-gradient(135deg, #8f37f2, #b341f4);
  box-shadow: 0 10px 24px rgba(115, 42, 212, 0.28);
  padding: 0.75rem 1.1rem;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 800;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 13px 28px rgba(115, 42, 212, 0.36);
  }

  &:disabled {
    opacity: 0.72;
    cursor: wait;
  }

  @media (min-width: 620px) {
    grid-column: auto;
    justify-self: end;
  }
`;

const CenterSection = styled.section`
  text-align: center;
`;

const AccentBar = styled.span`
  display: block;
  width: 3.5rem;
  height: 0.25rem;
  border-radius: 999px;
  background: #5ed3ca;
  margin: 0 auto;
`;

const SectionTitle = styled.h2`
  margin-top: 1rem;
  font-size: clamp(2rem, 4vw, 3.5rem);
  line-height: 1.1;
  font-weight: 900;
`;

const SectionText = styled.p`
  margin: 1rem auto 0;
  max-width: 70rem;
  color: var(--ink-soft);
  font-size: clamp(1rem, 2vw, 1.5rem);
  line-height: 1.65;
`;

const ProgramGrid = styled.section`
  display: grid;
  gap: 1rem;

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (min-width: 1200px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

const ProgramCard = styled(GlassCard)<{ $delay: number; $visible: boolean }>`
  padding: 1.5rem;
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  transform: ${({ $visible }) => ($visible ? "translateY(0)" : "translateY(30px)")};
  transition:
    opacity 680ms ease,
    transform 680ms ease;
  transition-delay: ${({ $delay }) => `${$delay}ms`};
  &:hover {
    transform: translateY(-4px);
  }

  @media (min-width: 768px) {
    padding: 1.75rem;
  }
`;

const ProgramImageWrap = styled.div`
  background: rgba(255, 255, 255, 0.7);
  border-radius: 1rem;
  padding: 0.5rem;
`;

const ProgramTitle = styled.h3`
  margin-top: 1.25rem;
  font-size: 1.8rem;
  line-height: 1.2;
  font-weight: 800;
`;

const ProgramText = styled.p`
  margin-top: 0.75rem;
  color: var(--ink-soft);
  font-size: 1.02rem;
  line-height: 1.7;
`;

const ProgramLink = styled(Link)`
  margin-top: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--accent-dark);
  font-size: 0.9rem;
  font-weight: 800;
`;

const BlockSection = styled.section`
  display: grid;
  gap: 1.5rem;
`;

const BlockTitle = styled.h2`
  font-size: clamp(2rem, 3.6vw, 3rem);
  line-height: 1.14;
  font-weight: 900;
`;

const HighlightGrid = styled.div`
  display: grid;
  gap: 1rem;

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const HighlightCard = styled.article<{ $delay: number; $visible: boolean }>`
  border-radius: 1.5rem;
  border: 1px solid #8be2df;
  background: color-mix(in srgb, var(--surface) 90%, white 10%);
  padding: 1.5rem;
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  transform: ${({ $visible }) => ($visible ? "translateX(0)" : "translateX(-32px)")};
  transition:
    opacity 700ms ease,
    transform 700ms ease;
  transition-delay: ${({ $delay }) => `${$delay}ms`};

  @media (min-width: 768px) {
    padding: 2rem;
  }
`;

const HighlightTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
`;

const HighlightBadge = styled.div`
  display: inline-flex;
  width: 2.75rem;
  height: 2.75rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.9rem;
  background: #5d68de;
  color: #fff;
  font-size: 1rem;
  font-weight: 900;
`;

const HighlightThumb = styled(Image)`
  width: 4.2rem;
  height: 4.2rem;
  object-fit: contain;
`;

const HighlightTitle = styled.h3`
  margin-top: 0.8rem;
  font-size: 1.8rem;
  line-height: 1.2;
  font-weight: 800;
`;

const HighlightText = styled.p`
  margin-top: 0.75rem;
  color: var(--ink-soft);
  font-size: 1.02rem;
  line-height: 1.7;
`;

const ReviewGrid = styled.div`
  display: grid;
  gap: 1rem;

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (min-width: 1200px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

const ReviewCard = styled(GlassCard)<{ $delay: number; $visible: boolean }>`
  padding: 1.5rem;
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  transform: ${({ $visible }) => ($visible ? "scale(1)" : "scale(0.92)")};
  transition:
    opacity 620ms ease,
    transform 620ms ease;
  transition-delay: ${({ $delay }) => `${$delay}ms`};

  @media (min-width: 768px) {
    padding: 1.75rem;
  }
`;

const ReviewAvatar = styled(Image)`
  width: 7rem;
  height: 7rem;
  object-fit: cover;
  border-radius: 1.25rem;
`;

const ReviewBadge = styled.p`
  margin-top: 1rem;
  color: var(--ink-soft);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
`;

const ReviewTitle = styled.h3`
  margin-top: 0.75rem;
  font-size: 1.8rem;
  line-height: 1.2;
  font-weight: 800;
`;

const ReviewQuote = styled.p`
  margin-top: 1rem;
  color: var(--ink-soft);
  font-size: 1.02rem;
  line-height: 1.75;
`;

const ReviewAuthor = styled.p`
  margin-top: 1.25rem;
  font-size: 0.9rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.14em;
`;

const FaqSection = styled.section`
  display: grid;
  gap: 1rem;
`;

const FaqItems = styled.div`
  display: grid;
  gap: 0.75rem;
`;

const FaqQuestion = styled.summary`
  cursor: pointer;
  list-style: none;
  font-size: clamp(1.1rem, 2.2vw, 1.5rem);
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;

  &::-webkit-details-marker {
    display: none;
  }

  &::after {
    content: "+";
    color: var(--accent-dark);
    font-size: 1.9rem;
    font-weight: 300;
    line-height: 1;
  }
`;

const FaqItem = styled.details`
  border-radius: 1rem;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.8);
  padding: 1rem 1.25rem;

  &[open] ${FaqQuestion}::after {
    content: "−";
  }
`;

const FaqAnswer = styled.p`
  margin-top: 0.75rem;
  max-width: 70rem;
  color: var(--ink-soft);
  font-size: 1.02rem;
  line-height: 1.7;
`;

const CtaCard = styled(GlassCard)`
  padding: 2rem 1.5rem;
  text-align: center;

  @media (min-width: 768px) {
    padding: 3rem 2.5rem;
  }
`;

const CtaText = styled.p`
  margin: 0.75rem auto 0;
  max-width: 42rem;
  color: var(--ink-soft);
  font-size: clamp(1rem, 2vw, 1.4rem);
`;

const FormWrap = styled.div`
  margin: 2rem auto 0;
  max-width: 44rem;
`;

const LeadForm = styled.form`
  display: grid;
  gap: 0.75rem;
  text-align: left;
`;

const Field = styled.input`
  width: 100%;
  border-radius: 0.9rem;
  border: 1px solid #c7d0fb;
  padding: 0.82rem 0.95rem;
  outline: none;
  background: #fff;

  &:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 4px var(--ring);
  }
`;

const Select = styled.select`
  width: 100%;
  border-radius: 0.9rem;
  border: 1px solid #c7d0fb;
  padding: 0.82rem 0.95rem;
  outline: none;
  background: #fff;

  &:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 4px var(--ring);
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  border-radius: 0.9rem;
  border: 1px solid #c7d0fb;
  padding: 0.82rem 0.95rem;
  outline: none;
  background: #fff;
  min-height: 8rem;
  resize: vertical;

  &:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 4px var(--ring);
  }
`;

const PhoneRow = styled.div`
  display: grid;
  gap: 0.75rem;

  @media (min-width: 640px) {
    grid-template-columns: 140px 1fr;
  }
`;

const FormButtonRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding-top: 0.25rem;
`;

const SubmitButton = styled.button`
  border-radius: 9999px;
  border: 0;
  background: linear-gradient(135deg, #4d79ff 0%, #6a4dff 100%);
  color: #fff;
  box-shadow: 0 12px 26px rgba(76, 98, 255, 0.35);
  transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease;
  padding: 0.75rem 1.75rem;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;

  &:hover:enabled {
    transform: translateY(-1px);
    box-shadow: 0 16px 30px rgba(76, 98, 255, 0.42);
    filter: saturate(1.06);
  }

  &:disabled {
    opacity: 0.72;
    cursor: not-allowed;
  }
`;

const FormNotice = styled.p<{ $tone: "success" | "error" }>`
  margin-top: 0.25rem;
  color: ${({ $tone }) => ($tone === "success" ? "#1f7a4f" : "#b31f4b")};
  font-size: 0.95rem;
  font-weight: 600;
`;

const Arrow = styled.span`
  line-height: 1;
`;
