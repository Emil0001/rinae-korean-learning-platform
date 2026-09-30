-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "TopikLevel" AS ENUM ('TOPIK_I', 'TOPIK_II');

-- CreateEnum
CREATE TYPE "TopikSectionType" AS ENUM ('LISTENING', 'READING');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopikTest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "level" "TopikLevel" NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopikTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopikSection" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "type" "TopikSectionType" NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopikSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopikQuestion" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "explanation" TEXT,
    "points" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopikQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopikChoice" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopikChoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopikAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "maxTotalScore" INTEGER NOT NULL DEFAULT 0,
    "readingScore" INTEGER NOT NULL DEFAULT 0,
    "maxReadingScore" INTEGER NOT NULL DEFAULT 0,
    "listeningScore" INTEGER NOT NULL DEFAULT 0,
    "maxListeningScore" INTEGER NOT NULL DEFAULT 0,
    "feedback" TEXT,

    CONSTRAINT "TopikAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopikAttemptAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "choiceId" TEXT,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopikAttemptAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "TopikSection_testId_type_idx" ON "TopikSection"("testId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "TopikSection_testId_order_key" ON "TopikSection"("testId", "order");

-- CreateIndex
CREATE INDEX "TopikQuestion_sectionId_idx" ON "TopikQuestion"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "TopikQuestion_sectionId_order_key" ON "TopikQuestion"("sectionId", "order");

-- CreateIndex
CREATE INDEX "TopikChoice_questionId_idx" ON "TopikChoice"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "TopikChoice_questionId_order_key" ON "TopikChoice"("questionId", "order");

-- CreateIndex
CREATE INDEX "TopikAttempt_userId_testId_idx" ON "TopikAttempt"("userId", "testId");

-- CreateIndex
CREATE INDEX "TopikAttempt_testId_idx" ON "TopikAttempt"("testId");

-- CreateIndex
CREATE INDEX "TopikAttemptAnswer_questionId_idx" ON "TopikAttemptAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "TopikAttemptAnswer_attemptId_questionId_key" ON "TopikAttemptAnswer"("attemptId", "questionId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopikSection" ADD CONSTRAINT "TopikSection_testId_fkey" FOREIGN KEY ("testId") REFERENCES "TopikTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopikQuestion" ADD CONSTRAINT "TopikQuestion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "TopikSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopikChoice" ADD CONSTRAINT "TopikChoice_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "TopikQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopikAttempt" ADD CONSTRAINT "TopikAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopikAttempt" ADD CONSTRAINT "TopikAttempt_testId_fkey" FOREIGN KEY ("testId") REFERENCES "TopikTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopikAttemptAnswer" ADD CONSTRAINT "TopikAttemptAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "TopikAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopikAttemptAnswer" ADD CONSTRAINT "TopikAttemptAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "TopikQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopikAttemptAnswer" ADD CONSTRAINT "TopikAttemptAnswer_choiceId_fkey" FOREIGN KEY ("choiceId") REFERENCES "TopikChoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
