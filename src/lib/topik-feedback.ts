import type {
  TopikAttemptFeedback,
  TopikAttemptFeedbackSkill,
  TopikAttemptResultSection,
  TopikLevel,
  TopikSectionType,
} from "@/types/topik";

type FeedbackCopy = {
  ko: string;
  ru: string;
  tipRu: string;
};

type FeedbackBandConfig = {
  id: string;
  sectionType: TopikSectionType;
  rangeStart: number;
  rangeEnd: number;
  rangeLabel: string;
  skillArea: string;
  low: FeedbackCopy;
  high: FeedbackCopy;
};

const TOPIK_I_FEEDBACK_BANDS: FeedbackBandConfig[] = [
  {
    id: "listening-grammar-response",
    sectionType: "LISTENING",
    rangeStart: 1,
    rangeEnd: 4,
    rangeLabel: "Q1-4",
    skillArea: "Грамматика и ответы",
    low: {
      ko: "기초 문법 패턴이 아직 약합니다. 네/아니요 대답과 의문사 질문(언제, 어디서, 누가)에 맞는 응답 형식을 집중적으로 복습해 보세요.",
      ru: "Базовые грамматические шаблоны пока проседают. Повтори ответы типа да/нет и формы ответа на вопросы с 의문사: 언제, 어디서, 누가.",
      tipRu: "Совет: каждый день пиши 5 коротких пар вопрос-ответ с 네/아니요 и вопросительными словами.",
    },
    high: {
      ko: "기본 응답 문법을 잘 알고 있어요. 더 복잡한 문장 구조와 격식/비격식 표현 차이를 익혀 보세요.",
      ru: "Базовую грамматику ответов ты уже держишь уверенно. Следующий шаг - различать более сложные конструкции и формальный/неформальный стиль.",
      tipRu: "Совет: тренируй одну и ту же ситуацию в 합쇼체 и 해요체.",
    },
  },
  {
    id: "listening-set-expressions",
    sectionType: "LISTENING",
    rangeStart: 5,
    rangeEnd: 6,
    rangeLabel: "Q5-6",
    skillArea: "Устойчивые выражения",
    low: {
      ko: "인사말, 사교적 표현이 부족합니다. '맛있게 드세요 → 잘 먹겠습니다'처럼 상황에 맞는 고정 표현을 암기해 보세요.",
      ru: "Нужно добрать приветствия и социальные формулы. Заучи устойчивые ответы по ситуации, например 맛있게 드세요 → 잘 먹겠습니다.",
      tipRu: "Совет: составь список из 30 인사말 и повторяй его каждую неделю.",
    },
    high: {
      ko: "사교적 표현을 잘 알고 있어요. 이제 좀 더 자연스럽고 다양한 일상 대화 표현을 넓혀 보세요.",
      ru: "Бытовые и вежливые формулы уже даются хорошо. Теперь расширяй набор более естественных разговорных выражений.",
      tipRu: "Совет: смотри корейские развлекательные шоу и выписывай разговорные fillers и ответы.",
    },
  },
  {
    id: "listening-place-vocabulary",
    sectionType: "LISTENING",
    rangeStart: 7,
    rangeEnd: 10,
    rangeLabel: "Q7-10",
    skillArea: "Лексика по местам",
    low: {
      ko: "장소 관련 어휘가 부족합니다. 은행, 우체국, 약국, 도서관 등 생활 공간 어휘와 그 장소에서 쓰는 표현을 함께 외워 보세요.",
      ru: "Словарь по местам пока слабый. Учись связывать слова типа 은행, 우체국, 약국, 도서관 с типичными действиями и фразами для этих мест.",
      tipRu: "Совет: к каждому месту подбери 3 типичных действия, например 약국 → 약을 사다, 처방전을 내다.",
    },
    high: {
      ko: "장소 어휘를 잘 알고 있어요. 이제 장소 묘사와 위치 표현(왼쪽에, 맞은편에)까지 확장해 보세요.",
      ru: "Лексика по местам уже сильная. Можно расширяться в сторону описания пространства и выражений местоположения вроде 왼쪽에, 맞은편에.",
      tipRu: "Совет: тренируй объяснение дороги на корейском с 오른쪽, 직진, 건너편.",
    },
  },
  {
    id: "listening-core-topic-vocabulary",
    sectionType: "LISTENING",
    rangeStart: 11,
    rangeEnd: 14,
    rangeLabel: "Q11-14",
    skillArea: "Базовая тематическая лексика",
    low: {
      ko: "핵심 주제 어휘가 부족합니다. 시간, 날씨, 직업, 취미, 교통 등 TOPIK I 핵심 주제별 단어를 카테고리로 묶어 학습해 보세요.",
      ru: "Не хватает опорной лексики по темам TOPIK I: время, погода, профессии, хобби, транспорт. Учить лучше по тематическим блокам, а не по одному слову.",
      tipRu: "Совет: сделай тематические списки, например 날씨 → 맑다, 흐리다, 비가 오다, 눈이 오다, и проверяй себя ежедневно.",
    },
    high: {
      ko: "주제 어휘 실력이 탄탄해요. 이제 각 주제에서 자주 쓰는 관용 표현과 연어(collocation)까지 공부해 보세요.",
      ru: "Тематическая лексика уже собрана крепко. Теперь полезно добирать частые сочетания слов и устойчивые коллокации внутри каждой темы.",
      tipRu: "Совет: к каждому ключевому слову добавляй 2 типичных глагола или прилагательных.",
    },
  },
  {
    id: "listening-picture-match",
    sectionType: "LISTENING",
    rangeStart: 15,
    rangeEnd: 16,
    rangeLabel: "Q15-16",
    skillArea: "Аудирование и выбор картинки",
    low: {
      ko: "들은 내용을 그림으로 연결하는 것이 어렵습니다. 동작과 상태를 묘사하는 동사와 형용사를 집중적으로 공부해 보세요.",
      ru: "Связывать услышанное с картинкой пока трудно. Здесь помогает словарь действий и описаний состояния: глаголы и прилагательные для сцен и поз.",
      tipRu: "Совет: вслух описывай картинки по-корейски, например 남자가 책을 읽고 있어요.",
    },
    high: {
      ko: "듣기 + 그림 매칭을 잘 해요. 더 복잡한 상황 묘사(여러 사람이 등장하는 장면)도 연습해 보세요.",
      ru: "Связка аудио и картинки уже работает хорошо. Следующий уровень - более сложные сцены, где участвуют несколько человек и больше деталей.",
      tipRu: "Совет: бери тренировочные изображения TOPIK и описывай сцену до проверки ответа.",
    },
  },
  {
    id: "listening-detail-comprehension",
    sectionType: "LISTENING",
    rangeStart: 17,
    rangeEnd: 21,
    rangeLabel: "Q17-21",
    skillArea: "Понимание деталей",
    low: {
      ko: "대화의 세부 내용(누가, 언제, 무엇을)을 정확히 파악하기 어렵습니다. 듣기 전에 보기 문장을 먼저 읽고 핵심 키워드를 메모하는 습관을 들여 보세요.",
      ru: "Трудно ловить точные детали диалога: кто, когда, что именно. Перед прослушиванием сначала прочитывай варианты и отмечай ключевые слова.",
      tipRu: "Совет: после прослушивания запиши по памяти 3 факта, а уже потом сверяйся со скриптом.",
    },
    high: {
      ko: "세부 내용 파악 능력이 좋아요. 틀린 보기들이 왜 오답인지 분석하면 실수를 더 줄일 수 있어요.",
      ru: "Детали ты уже считываешь хорошо. Чтобы убрать оставшиеся ошибки, полезно разбирать, почему каждый неверный вариант именно неверный.",
      tipRu: "Совет: помечай каждую ошибку ярлыком вроде wrong person, wrong time, opposite meaning.",
    },
  },
  {
    id: "listening-main-idea",
    sectionType: "LISTENING",
    rangeStart: 22,
    rangeEnd: 24,
    rangeLabel: "Q22-24",
    skillArea: "Главная мысль и вывод",
    low: {
      ko: "화자의 중심 생각을 파악하기 어렵습니다. 세부 사항보다 '왜 이 말을 하는가'에 집중하며 들어 보세요. 마지막 문장에 핵심이 있는 경우가 많아요.",
      ru: "Пока трудно улавливать главную мысль говорящего. Слушай не только факты, а цель высказывания: зачем это говорится. Часто ключ сидит в последней фразе.",
      tipRu: "Совет: после аудио сформулируй одну короткую корейскую фразу с главным смыслом до просмотра вариантов.",
    },
    high: {
      ko: "중심 생각을 잘 파악해요. 이 능력이 TOPIK II 추론 문제와 쓰기의 핵심이에요. 다음 단계를 준비할 수 있어요.",
      ru: "Главную мысль ты уже ловишь уверенно. Это как раз ключевой навык для TOPIK II: выводы, аргументация и задания на смысл.",
      tipRu: "Совет: можно начинать читать короткие 칼럼 и тексты с мнением автора для перехода к TOPIK II.",
    },
  },
  {
    id: "listening-extended-listening",
    sectionType: "LISTENING",
    rangeStart: 25,
    rangeEnd: 30,
    rangeLabel: "Q25-30",
    skillArea: "Длинные аудио",
    low: {
      ko: "긴 듣기 지문이 어렵습니다. 먼저 두 문항의 질문을 읽고 어떤 정보를 들어야 하는지 파악한 후 듣기를 시작하세요.",
      ru: "Длинные аудио пока даются тяжело. Перед началом сначала прочитывай оба вопроса, чтобы понимать, какую информацию искать в потоке речи.",
      tipRu: "Совет: каждый день слушай 3-5 минут корейской речи без паузы, чтобы набирать выносливость.",
    },
    high: {
      ko: "장문 듣기를 잘 소화해요. 이제 뉴스나 인터뷰 형식의 자연스러운 속도 한국어에 도전해 보세요.",
      ru: "С длинными аудио ты уже справляешься хорошо. Можно переходить к более естественной скорости: новости, интервью и спонтанная речь.",
      tipRu: "Совет: попробуй KBS 한국어 뉴스 или отрывки из 유퀴즈온더블록 без субтитров.",
    },
  },
  {
    id: "reading-topic-vocabulary",
    sectionType: "READING",
    rangeStart: 1,
    rangeEnd: 3,
    rangeLabel: "Q1-3",
    skillArea: "Тематическая лексика",
    low: {
      ko: "짧은 글에서 주제를 파악하기 어렵습니다. 핵심 명사(날씨, 운동, 음식, 교통 등)와 그 주제에 어울리는 동사·형용사를 함께 공부해 보세요.",
      ru: "Пока трудно быстро узнавать тему короткого текста. Учить нужно не только существительные, но и типичные глаголы и прилагательные рядом с темой.",
      tipRu: "Совет: делай тематические кластеры, например 날씨 → 맑다, 흐리다, 비, 바람, 덥다, 춥다.",
    },
    high: {
      ko: "짧은 글의 주제를 잘 파악해요. 이제 더 추상적인 주제(감정, 관계, 사회 현상)도 다뤄 보세요.",
      ru: "Темы коротких текстов ты определяешь уверенно. Дальше можно брать более абстрактные темы: эмоции, отношения, социальные явления.",
      tipRu: "Совет: попробуй простые детские журнальные статьи на корейском, где уже встречаются абстрактные темы.",
    },
  },
  {
    id: "reading-grammar-particles",
    sectionType: "READING",
    rangeStart: 4,
    rangeEnd: 9,
    rangeLabel: "Q4-9",
    skillArea: "Грамматика и частицы",
    low: {
      ko: "조사(은/는/이/가/을/를/에서)와 문법 표현이 아직 불안정합니다. 조사 하나하나가 문장의 의미를 바꾸므로 문장 단위로 꼼꼼히 복습해 보세요.",
      ru: "Частицы и грамматические формы еще нестабильны. Здесь важно разбирать их в целых предложениях, потому что даже одна 조사 сильно меняет смысл.",
      tipRu: "Совет: запиши одно и то же предложение 5 раз, меняя только частицу, и сравни, как меняется смысл.",
    },
    high: {
      ko: "문법과 조사 실력이 좋아요. 이제 접속 표현(그래서, 그러나, 반면에)과 문어체(written style) 문법까지 확장해 보세요.",
      ru: "Грамматика и частицы уже сильные. Теперь можно расширяться в связки вроде 그래서, 그러나, 반면에 и в более письменный стиль.",
      tipRu: "Совет: отдельно сравни разговорные формы и 문어체, чтобы легче читать письменные тексты.",
    },
  },
  {
    id: "reading-practical-texts",
    sectionType: "READING",
    rangeStart: 10,
    rangeEnd: 12,
    rangeLabel: "Q10-12",
    skillArea: "Практические тексты",
    low: {
      ko: "공지문, 안내문, 메뉴판 등 실생활 글읽기가 약합니다. 핵심 정보(날짜, 장소, 가격, 조건)를 빠르게 찾는 연습이 필요해요.",
      ru: "Нужно прокачать чтение практических текстов: объявлений, меню, уведомлений, расписаний. Слабое место здесь - быстро вынимать дату, место, цену и условия.",
      tipRu: "Совет: каждый день читай корейские меню, push-уведомления и постеры мероприятий - это почти один в один формат TOPIK.",
    },
    high: {
      ko: "실용문을 잘 읽어요. 이 능력은 실생활 한국어에서 바로 쓰이는 실전 기술이에요.",
      ru: "Практические тексты ты читаешь уверенно. Это один из самых прикладных навыков для реальной жизни на корейском.",
      tipRu: "Совет: попробуй более длинные корейские объявления и официальные notices, чтобы увеличить сложность.",
    },
  },
  {
    id: "reading-detail-comprehension",
    sectionType: "READING",
    rangeStart: 13,
    rangeEnd: 15,
    rangeLabel: "Q13-15",
    skillArea: "Понимание деталей",
    low: {
      ko: "글의 세부 내용을 정확히 파악하기 어렵습니다. 읽기 전에 보기 문장을 먼저 읽고 어떤 정보를 찾아야 하는지 확인한 후 읽어 보세요.",
      ru: "Детали в тексте пока теряются. Перед чтением сначала смотри варианты ответа, чтобы заранее знать, какую информацию надо искать.",
      tipRu: "Совет: подчеркивай ключевые слова в каждом варианте и потом ищи их в тексте прицельно.",
    },
    high: {
      ko: "세부 내용 파악 능력이 뛰어나요. 틀린 보기가 왜 틀렸는지 분석하면 정확도가 더 높아질 거예요.",
      ru: "Детали ты считываешь очень хорошо. Следующий шаг - разбирать неверные варианты, чтобы еще сильнее поднять точность.",
      tipRu: "Совет: к каждому неверному варианту добавляй короткую причину: wrong number, not mentioned, opposite.",
    },
  },
  {
    id: "reading-main-idea",
    sectionType: "READING",
    rangeStart: 16,
    rangeEnd: 18,
    rangeLabel: "Q16-18",
    skillArea: "Главная мысль",
    low: {
      ko: "글의 중심 내용과 목적을 파악하기 어렵습니다. 첫 문장과 마지막 문장에 주목하세요 - 대부분 거기에 핵심이 있어요.",
      ru: "Пока трудно выхватывать основную идею и цель текста. Сначала смотри на первое и последнее предложение - в них часто лежит главный смысл.",
      tipRu: "Совет: после чтения напиши одно короткое резюме текста по-корейски до просмотра вариантов.",
    },
    high: {
      ko: "중심 내용을 잘 파악해요. 이 능력을 활용해 TOPIK II 쓰기(200자, 700자 쓰기)를 준비하기 좋은 단계예요.",
      ru: "Главную мысль текста ты уже определяешь уверенно. Это хорошая база, чтобы позже заходить в TOPIK II 쓰기.",
      tipRu: "Совет: попробуй пересказывать корейские новости в 2-3 предложениях и сверять с преподавателем или партнером.",
    },
  },
  {
    id: "reading-passage-comprehension",
    sectionType: "READING",
    rangeStart: 19,
    rangeEnd: 26,
    rangeLabel: "Q19-26",
    skillArea: "Понимание текстов",
    low: {
      ko: "중간 길이 지문에서 주제와 세부 내용을 동시에 파악하기 어렵습니다. 단락별로 한 문장으로 요약하는 연습을 해 보세요.",
      ru: "В текстах средней длины пока сложно одновременно держать тему и детали. Полезно учиться кратко подводить итог каждому абзацу одной фразой.",
      tipRu: "Совет: перед чтением посмотри первый вопрос на тему и последний вопрос на деталь - это сразу задаст фокус.",
    },
    high: {
      ko: "지문 읽기 능력이 탄탄해요. 이제 더 긴 글과 논설문(주장이 있는 글)에 도전해 보세요.",
      ru: "Чтение связных текстов уже крепкое. Можно переходить к более длинным материалам и текстам с аргументацией.",
      tipRu: "Совет: начни читать корейские 사설 и более длинные статьи - это уже мост к TOPIK II reading.",
    },
  },
  {
    id: "reading-sentence-ordering",
    sectionType: "READING",
    rangeStart: 27,
    rangeEnd: 28,
    rangeLabel: "Q27-28",
    skillArea: "Порядок предложений",
    low: {
      ko: "문장의 논리적 순서를 배열하기 어렵습니다. 접속사(그래서, 그런데, 그러나, 따라서, 또한)가 어떤 관계를 만드는지 집중적으로 공부해 보세요.",
      ru: "Пока трудно выстраивать логический порядок предложений. Здесь решают связки: 그래서, 그런데, 그러나, 따라서, 또한 и понимание их функции.",
      tipRu: "Совет: сделай мини-шпаргалку по связкам: result, contrast, conclusion, addition.",
    },
    high: {
      ko: "문장 순서 배열을 잘 해요. 이 담화 구조 능력이 TOPIK II 쓰기에서 논리적인 단락 구성에 직접 도움이 돼요.",
      ru: "С порядком предложений ты работаешь хорошо. Это напрямую помогает будущему TOPIK II 쓰기 и построению логичных абзацев.",
      tipRu: "Совет: пиши короткие абзацы с 2-3 связками и проверяй, насколько естественно течет логика.",
    },
  },
  {
    id: "reading-long-passage-comprehension",
    sectionType: "READING",
    rangeStart: 29,
    rangeEnd: 40,
    rangeLabel: "Q29-40",
    skillArea: "Длинные тексты",
    low: {
      ko: "긴 지문 읽기가 어렵습니다. 어휘력 확장과 빠른 독해 속도가 핵심이에요. 매일 짧은 한국어 기사나 글을 읽는 습관을 들여 보세요.",
      ru: "Длинные тексты пока тяжелые. Тут ключевые вещи - рост словаря и скорость чтения. Нужна ежедневная привычка читать по-корейски хоть понемногу.",
      tipRu: "Совет: читай одну короткую статью в день, например из детского раздела 네이버 뉴스, и замеряй время.",
    },
    high: {
      ko: "긴 지문도 잘 읽어요! TOPIK I 읽기의 가장 어려운 구간을 통과한 거예요. TOPIK II 읽기를 준비할 실력이 됐어요.",
      ru: "С длинными текстами ты уже справляешься хорошо. Это самый сложный кусок чтения в TOPIK I, и он у тебя уже под контролем.",
      tipRu: "Совет: можно понемногу заходить в прошлые TOPIK II reading papers, особенно в 설명문 и 논설문.",
    },
  },
];

function sortSections(sections: TopikAttemptResultSection[]) {
  return [...sections].sort((left, right) => left.order - right.order);
}

function getBandStatus(accuracyRate: number): TopikAttemptFeedbackSkill["status"] {
  if (accuracyRate >= 0.8) {
    return "HIGH";
  }

  if (accuracyRate < 0.5) {
    return "LOW";
  }

  return "MEDIUM";
}

function buildMediumCopy(skillArea: string): FeedbackCopy {
  return {
    ko: `${skillArea} 기본은 잡혀 있지만 정답률의 기복이 있습니다. 자주 흔들리는 포인트를 다시 묶어 짧게 반복해 보세요.`,
    ru: `База по зоне "${skillArea}" уже есть, но точность пока плавает. Лучше выделить этот тип заданий и несколько раз пройти его короткими сериями.`,
    tipRu: "Совет: пересобери 3-5 похожих заданий из этой зоны, проговори логику ответа и затем реши новый мини-набор без подсказок.",
  };
}

function buildGenericFeedback(
  sectionType: TopikSectionType | null,
  totalScore: number,
  maxTotalScore: number,
): TopikAttemptFeedback {
  const accuracyRate = maxTotalScore > 0 ? totalScore / maxTotalScore : 0;
  const sectionLabel = sectionType === "LISTENING" ? "аудированию" : sectionType === "READING" ? "чтению" : "разделу";

  if (accuracyRate >= 0.8) {
    return {
      headline: `Сильный результат по ${sectionLabel}`,
      summary: "База уже уверенная. Можно поднимать сложность: длиннее материалы, выше скорость и больше заданий следующего уровня.",
      strengths: [],
      focusAreas: [],
      skills: [],
    };
  }

  if (accuracyRate < 0.5) {
    return {
      headline: `Нужно укрепить базу по ${sectionLabel}`,
      summary: "Сейчас важнее всего сузить фокус до фундаментальных паттернов и коротких целевых тренировок по самым слабым типам заданий.",
      strengths: [],
      focusAreas: [],
      skills: [],
    };
  }

  return {
    headline: `По ${sectionLabel} уже есть рабочая база`,
    summary: "Результат неслучайный, но стабильности пока не хватает. Если дожать 1-2 слабых типа заданий, балл начнет расти быстрее.",
    strengths: [],
    focusAreas: [],
    skills: [],
  };
}

export function buildTopikAttemptFeedback(input: {
  level: TopikLevel;
  sectionType: TopikSectionType | null;
  totalScore: number;
  maxTotalScore: number;
  sections: TopikAttemptResultSection[];
}): TopikAttemptFeedback {
  const { level, sectionType, totalScore, maxTotalScore, sections } = input;
  const effectiveSectionType = sectionType ?? sections[0]?.type ?? null;

  if (level !== "TOPIK_I" || !effectiveSectionType) {
    return buildGenericFeedback(effectiveSectionType, totalScore, maxTotalScore);
  }

  const sectionConfigs = TOPIK_I_FEEDBACK_BANDS.filter(
    (entry) => entry.sectionType === effectiveSectionType,
  );

  if (!sectionConfigs.length) {
    return buildGenericFeedback(effectiveSectionType, totalScore, maxTotalScore);
  }

  const orderedQuestions = sortSections(sections).flatMap((section) =>
    [...section.questions].sort((left, right) => left.order - right.order),
  );

  const skills: TopikAttemptFeedbackSkill[] = sectionConfigs
    .map((config) => {
      const questions = orderedQuestions.slice(config.rangeStart - 1, config.rangeEnd);
      const totalQuestions = questions.length;

      if (!totalQuestions) {
        return null;
      }

      const correctCount = questions.filter((question) => question.isCorrect).length;
      const accuracyRate = correctCount / totalQuestions;
      const status = getBandStatus(accuracyRate);
      const copy =
        status === "LOW" ? config.low : status === "HIGH" ? config.high : buildMediumCopy(config.skillArea);

      return {
        id: config.id,
        sectionType: config.sectionType,
        rangeLabel: config.rangeLabel,
        skillArea: config.skillArea,
        status,
        correctCount,
        totalQuestions,
        accuracyRate,
        feedbackKo: copy.ko,
        feedbackRu: copy.ru,
        tipRu: copy.tipRu,
      };
    })
    .filter((skill): skill is TopikAttemptFeedbackSkill => Boolean(skill));

  if (!skills.length) {
    return buildGenericFeedback(effectiveSectionType, totalScore, maxTotalScore);
  }

  const sortedByAccuracyAsc = [...skills].sort((left, right) => left.accuracyRate - right.accuracyRate);
  const sortedByAccuracyDesc = [...skills].sort((left, right) => right.accuracyRate - left.accuracyRate);

  const focusAreas = sortedByAccuracyAsc
    .filter((skill) => skill.status !== "HIGH")
    .slice(0, 2)
    .map((skill) => ({
      skillArea: skill.skillArea,
      rangeLabel: skill.rangeLabel,
      detail: skill.feedbackRu,
    }));

  const strengths = sortedByAccuracyDesc
    .filter((skill) => skill.status !== "LOW")
    .slice(0, 2)
    .map((skill) => ({
      skillArea: skill.skillArea,
      rangeLabel: skill.rangeLabel,
      detail: skill.feedbackRu,
    }));

  const overallAccuracy = maxTotalScore > 0 ? totalScore / maxTotalScore : 0;
  const sectionLabel = effectiveSectionType === "LISTENING" ? "Аудирование TOPIK I" : "Чтение TOPIK I";

  if (overallAccuracy >= 0.8) {
    return {
      headline: `${sectionLabel}: сильный контроль формата`,
      summary: "Основные паттерны уже держатся уверенно. Можно усложнять материалы, ускорять темп и понемногу заходить в задачи уровня TOPIK II.",
      strengths,
      focusAreas,
      skills,
    };
  }

  if (overallAccuracy < 0.5) {
    return {
      headline: `${sectionLabel}: сначала укрепляем фундамент`,
      summary: "Сейчас важнее стабилизировать базовые шаблоны, ядро лексики и логику выбора ответа. Начни с 1-2 самых слабых зон ниже и тренируй их короткими сериями.",
      strengths,
      focusAreas,
      skills,
    };
  }

  return {
    headline: `${sectionLabel}: база уже есть, нужна стабильность`,
    summary: "У тебя уже есть рабочие сильные зоны. Если точечно добрать плавающие типы заданий, общий балл поднимется заметно быстрее.",
    strengths,
    focusAreas,
    skills,
  };
}
