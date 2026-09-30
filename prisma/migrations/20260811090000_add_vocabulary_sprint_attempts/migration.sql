CREATE TABLE "VocabularySprintAttempt" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "wordsCount" INTEGER NOT NULL,
  "correctPairs" INTEGER NOT NULL,
  "mistakeCount" INTEGER NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "accuracy" INTEGER NOT NULL,
  "grade" TEXT NOT NULL,
  "xpEarned" INTEGER NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VocabularySprintAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VocabularySprintAttempt_userId_completedAt_idx"
ON "VocabularySprintAttempt"("userId", "completedAt");

ALTER TABLE "VocabularySprintAttempt"
ADD CONSTRAINT "VocabularySprintAttempt_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
