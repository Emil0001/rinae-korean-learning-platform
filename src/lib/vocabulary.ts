export type VocabularyLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type VocabularyReviewRating = "EASY" | "HARD" | "DONT_KNOW";
export type VocabularyPlacementDirection = "KR_TO_RU" | "RU_TO_KR";
export type VocabularyPlacementBand = "STARTER" | "STARTER_PLUS" | "EARLY_INTERMEDIATE";

export function toVocabularyLabel(level: VocabularyLevel) {
  if (level === "BEGINNER") {
    return "Начальный";
  }

  if (level === "INTERMEDIATE") {
    return "Средний";
  }

  return "Продвинутый";
}

export function getVocabularyLevelDescription(level: VocabularyLevel) {
  if (level === "BEGINNER") {
    return "Базовые слова для повседневных тем, TOPIK I и уверенного старта.";
  }

  if (level === "INTERMEDIATE") {
    return "Слова для более длинных фраз, бытовых ситуаций и чтения без перегруза.";
  }

  return "Продвинутый словарь для TOPIK II, быстрых ассоциаций и уверенного понимания текста.";
}

export function toPlacementBandLabel(level: VocabularyPlacementBand) {
  if (level === "STARTER") {
    return "Starter";
  }

  if (level === "STARTER_PLUS") {
    return "Starter+";
  }

  return "Early Intermediate";
}

export function getPlacementBandDescription(level: VocabularyPlacementBand) {
  if (level === "STARTER") {
    return "Нужна опора на базовые бытовые слова, короткие темы и частое повторение.";
  }

  if (level === "STARTER_PLUS") {
    return "Базовый словарь уже есть, но его нужно укрепить через короткие тематические серии.";
  }

  return "Можно начинать с более раннего intermediate-набора и быстрее расширять словарь по темам.";
}

export function mapPlacementBandToVocabularyLevel(level: VocabularyPlacementBand): VocabularyLevel {
  if (level === "EARLY_INTERMEDIATE") {
    return "INTERMEDIATE";
  }

  return "BEGINNER";
}

export function resolvePlacementBand(correctAnswers: number): VocabularyPlacementBand {
  if (correctAnswers <= 3) {
    return "STARTER";
  }

  if (correctAnswers <= 7) {
    return "STARTER_PLUS";
  }

  return "EARLY_INTERMEDIATE";
}

export function ratingToDays(rating: VocabularyReviewRating) {
  if (rating === "EASY") {
    return 4;
  }

  if (rating === "HARD") {
    return 1;
  }

  return 0;
}

export function nextReviewDate(rating: VocabularyReviewRating, from = new Date()) {
  const next = new Date(from);
  const days = ratingToDays(rating);

  if (days === 0) {
    next.setHours(next.getHours() + 6);
    return next;
  }

  next.setDate(next.getDate() + days);
  return next;
}
