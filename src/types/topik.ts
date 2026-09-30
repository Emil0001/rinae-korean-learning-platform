export type TopikSectionType = "LISTENING" | "READING";
export type TopikLevel = "TOPIK_I" | "TOPIK_II";
export type TopikSectionBlockVariant = "EXAMPLE" | "PASSAGE" | "NOTICE";

export type TopikSectionBlock = {
  id: string;
  order: number;
  displayBeforeQuestionOrder: number;
  variant: TopikSectionBlockVariant;
  title: string | null;
  content: string;
};

export type TopikSectionSummary = {
  id: string;
  type: TopikSectionType;
  title: string;
  order: number;
  durationMinutes: number;
  questionCount: number;
};

export type TopikTestListItem = {
  id: string;
  title: string;
  description: string | null;
  level: TopikLevel;
  durationMinutes: number;
  totalQuestions: number;
  sections: TopikSectionSummary[];
};

export type TopikChoice = {
  id: string;
  order: number;
  text: string;
  imageUrl: string | null;
};

export type TopikQuestion = {
  id: string;
  order: number;
  prompt: string;
  content: string | null;
  contentImageUrl: string | null;
  points: number;
  choices: TopikChoice[];
};

export type TopikSection = {
  id: string;
  title: string;
  type: TopikSectionType;
  order: number;
  durationMinutes: number;
  blocks: TopikSectionBlock[];
  questions: TopikQuestion[];
};

export type TopikTestDetail = {
  id: string;
  title: string;
  description: string | null;
  listeningAudioUrl: string | null;
  level: TopikLevel;
  durationMinutes: number;
  sections: TopikSection[];
};

export type TopikAttemptFeedbackStatus = "LOW" | "MEDIUM" | "HIGH";

export type TopikAttemptFeedbackHighlight = {
  skillArea: string;
  rangeLabel: string;
  detail: string;
};

export type TopikAttemptFeedbackSkill = {
  id: string;
  sectionType: TopikSectionType;
  rangeLabel: string;
  skillArea: string;
  status: TopikAttemptFeedbackStatus;
  correctCount: number;
  totalQuestions: number;
  accuracyRate: number;
  feedbackKo: string;
  feedbackRu: string;
  tipRu: string;
};

export type TopikAttemptFeedback = {
  headline: string;
  summary: string;
  strengths: TopikAttemptFeedbackHighlight[];
  focusAreas: TopikAttemptFeedbackHighlight[];
  skills: TopikAttemptFeedbackSkill[];
};

export type TopikAttemptResult = {
  totalScore: number;
  maxTotalScore: number;
  readingScore: number;
  maxReadingScore: number;
  listeningScore: number;
  maxListeningScore: number;
  feedback: TopikAttemptFeedback;
  sections: TopikAttemptResultSection[];
};

export type TopikAttemptResultChoice = {
  id: string;
  order: number;
  text: string;
  imageUrl: string | null;
  isCorrect: boolean;
  isSelected: boolean;
};

export type TopikAttemptResultQuestion = {
  id: string;
  order: number;
  prompt: string;
  content: string | null;
  contentImageUrl: string | null;
  points: number;
  isCorrect: boolean;
  selectedChoiceId: string | null;
  correctChoiceId: string | null;
  choices: TopikAttemptResultChoice[];
};

export type TopikAttemptResultSection = {
  id: string;
  title: string;
  type: TopikSectionType;
  order: number;
  durationMinutes: number;
  blocks: TopikSectionBlock[];
  questions: TopikAttemptResultQuestion[];
};

export type AdminTopikStudentAttempt = {
  id: string;
  finishedAt: string;
  totalScore: number;
  maxTotalScore: number;
  percent: number;
  readingScore: number;
  maxReadingScore: number;
  listeningScore: number;
  maxListeningScore: number;
  test: {
    id: string;
    title: string;
    level: TopikLevel;
  };
};

export type AdminTopikStudentResult = {
  userId: string;
  name: string;
  email: string;
  attemptsCount: number;
  bestScore: number;
  bestPercent: number;
  averagePercent: number;
  lastFinishedAt: string;
  levels: TopikLevel[];
  attempts: AdminTopikStudentAttempt[];
};

export type AdminTopikResultsResponse = {
  totals?: {
    students: number;
    attempts: number;
  };
  students?: AdminTopikStudentResult[];
  error?: string;
};
