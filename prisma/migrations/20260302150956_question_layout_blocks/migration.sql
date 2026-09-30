-- CreateEnum
CREATE TYPE "TopikSectionBlockVariant" AS ENUM ('EXAMPLE', 'PASSAGE', 'NOTICE');

-- AlterTable
ALTER TABLE "TopikQuestion" ADD COLUMN     "content" TEXT;

-- CreateTable
CREATE TABLE "TopikSectionBlock" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "displayBeforeQuestionOrder" INTEGER NOT NULL,
    "variant" "TopikSectionBlockVariant" NOT NULL DEFAULT 'PASSAGE',
    "title" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopikSectionBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TopikSectionBlock_sectionId_displayBeforeQuestionOrder_idx" ON "TopikSectionBlock"("sectionId", "displayBeforeQuestionOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TopikSectionBlock_sectionId_order_key" ON "TopikSectionBlock"("sectionId", "order");

-- AddForeignKey
ALTER TABLE "TopikSectionBlock" ADD CONSTRAINT "TopikSectionBlock_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "TopikSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
