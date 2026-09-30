-- CreateEnum
CREATE TYPE "VocabularyLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "VocabularyReviewRating" AS ENUM ('EASY', 'HARD', 'DONT_KNOW');

-- CreateTable
CREATE TABLE "VocabularyWord" (
    "id" TEXT NOT NULL,
    "korean" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "category" TEXT,
    "level" "VocabularyLevel" NOT NULL DEFAULT 'BEGINNER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VocabularyWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabularyProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "estimatedLevel" "VocabularyLevel",
    "placementScore" INTEGER,
    "placementCompletedAt" TIMESTAMP(3),
    "dailyGoal" INTEGER NOT NULL DEFAULT 12,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "lastStudiedOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VocabularyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabularyReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "knownCount" INTEGER NOT NULL DEFAULT 0,
    "dontKnowCount" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "nextReviewAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt" TIMESTAMP(3),
    "lastRating" "VocabularyReviewRating",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VocabularyReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VocabularyWord_level_isActive_idx" ON "VocabularyWord"("level", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "VocabularyProfile_userId_key" ON "VocabularyProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VocabularyReview_userId_wordId_key" ON "VocabularyReview"("userId", "wordId");

-- CreateIndex
CREATE INDEX "VocabularyReview_userId_nextReviewAt_idx" ON "VocabularyReview"("userId", "nextReviewAt");

-- CreateIndex
CREATE INDEX "VocabularyReview_wordId_idx" ON "VocabularyReview"("wordId");

-- AddForeignKey
ALTER TABLE "VocabularyProfile" ADD CONSTRAINT "VocabularyProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularyReview" ADD CONSTRAINT "VocabularyReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularyReview" ADD CONSTRAINT "VocabularyReview_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "VocabularyWord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
