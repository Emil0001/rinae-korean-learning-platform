-- CreateEnum
CREATE TYPE "CourseLessonMode" AS ENUM ('STANDARD', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "CourseStepType" AS ENUM ('GRAMMAR', 'EXAMPLES', 'VOCABULARY', 'PRACTICE', 'QUIZ', 'CUSTOM');

-- CreateTable
CREATE TABLE "CourseLevel" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "accentColor" TEXT NOT NULL DEFAULT '#5a6cff',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseUnit" (
    "id" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseLesson" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "imageUrl" TEXT,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 12,
    "mode" "CourseLessonMode" NOT NULL DEFAULT 'STANDARD',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseLessonStep" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "CourseStepType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseLessonStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseLessonProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "currentStepOrder" INTEGER NOT NULL DEFAULT 1,
    "completedStepOrders" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "lastOpenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseLessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseLevel_number_key" ON "CourseLevel"("number");

-- CreateIndex
CREATE UNIQUE INDEX "CourseLevel_slug_key" ON "CourseLevel"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CourseUnit_levelId_slug_key" ON "CourseUnit"("levelId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "CourseUnit_levelId_order_key" ON "CourseUnit"("levelId", "order");

-- CreateIndex
CREATE INDEX "CourseUnit_levelId_isPublished_idx" ON "CourseUnit"("levelId", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "CourseLesson_unitId_slug_key" ON "CourseLesson"("unitId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "CourseLesson_unitId_order_key" ON "CourseLesson"("unitId", "order");

-- CreateIndex
CREATE INDEX "CourseLesson_unitId_isPublished_idx" ON "CourseLesson"("unitId", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "CourseLessonStep_lessonId_order_key" ON "CourseLessonStep"("lessonId", "order");

-- CreateIndex
CREATE INDEX "CourseLessonStep_lessonId_idx" ON "CourseLessonStep"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseLessonProgress_userId_lessonId_key" ON "CourseLessonProgress"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "CourseLessonProgress_userId_lastOpenedAt_idx" ON "CourseLessonProgress"("userId", "lastOpenedAt");

-- CreateIndex
CREATE INDEX "CourseLessonProgress_lessonId_idx" ON "CourseLessonProgress"("lessonId");

-- AddForeignKey
ALTER TABLE "CourseUnit" ADD CONSTRAINT "CourseUnit_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "CourseLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseLesson" ADD CONSTRAINT "CourseLesson_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "CourseUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseLessonStep" ADD CONSTRAINT "CourseLessonStep_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "CourseLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseLessonProgress" ADD CONSTRAINT "CourseLessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseLessonProgress" ADD CONSTRAINT "CourseLessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "CourseLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
