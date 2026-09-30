CREATE TABLE "CourseLessonVocabularyWord" (
  "id" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "wordId" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CourseLessonVocabularyWord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseLessonVocabularyWord_lessonId_wordId_key"
  ON "CourseLessonVocabularyWord"("lessonId", "wordId");

CREATE UNIQUE INDEX "CourseLessonVocabularyWord_lessonId_order_key"
  ON "CourseLessonVocabularyWord"("lessonId", "order");

CREATE INDEX "CourseLessonVocabularyWord_wordId_idx"
  ON "CourseLessonVocabularyWord"("wordId");

ALTER TABLE "CourseLessonVocabularyWord"
  ADD CONSTRAINT "CourseLessonVocabularyWord_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "CourseLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseLessonVocabularyWord"
  ADD CONSTRAINT "CourseLessonVocabularyWord_wordId_fkey"
  FOREIGN KEY ("wordId") REFERENCES "VocabularyWord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
