CREATE TYPE "VocabularyPlacementDirection" AS ENUM ('KR_TO_RU', 'RU_TO_KR');
CREATE TYPE "VocabularyPlacementBand" AS ENUM ('STARTER', 'STARTER_PLUS', 'EARLY_INTERMEDIATE');

CREATE TABLE "VocabularyPlacementSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "placementBand" "VocabularyPlacementBand",
  "detectedLevel" "VocabularyLevel",
  "score" INTEGER,
  "correctAnswers" INTEGER,
  "totalQuestions" INTEGER NOT NULL,
  "questionsJson" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VocabularyPlacementSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VocabularyPlacementAnswer" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "wordId" TEXT NOT NULL,
  "questionOrder" INTEGER NOT NULL,
  "direction" "VocabularyPlacementDirection" NOT NULL,
  "selectedAnswer" TEXT NOT NULL,
  "correctAnswer" TEXT NOT NULL,
  "isCorrect" BOOLEAN NOT NULL,
  "responseTimeMs" INTEGER,
  "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VocabularyPlacementAnswer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VocabularyPlacementSession_userId_completedAt_idx" ON "VocabularyPlacementSession"("userId", "completedAt");
CREATE INDEX "VocabularyPlacementAnswer_sessionId_questionOrder_idx" ON "VocabularyPlacementAnswer"("sessionId", "questionOrder");
CREATE INDEX "VocabularyPlacementAnswer_userId_answeredAt_idx" ON "VocabularyPlacementAnswer"("userId", "answeredAt");
CREATE INDEX "VocabularyPlacementAnswer_wordId_idx" ON "VocabularyPlacementAnswer"("wordId");

ALTER TABLE "VocabularyPlacementSession"
  ADD CONSTRAINT "VocabularyPlacementSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VocabularyPlacementAnswer"
  ADD CONSTRAINT "VocabularyPlacementAnswer_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "VocabularyPlacementSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VocabularyPlacementAnswer"
  ADD CONSTRAINT "VocabularyPlacementAnswer_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VocabularyPlacementAnswer"
  ADD CONSTRAINT "VocabularyPlacementAnswer_wordId_fkey"
  FOREIGN KEY ("wordId") REFERENCES "VocabularyWord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
