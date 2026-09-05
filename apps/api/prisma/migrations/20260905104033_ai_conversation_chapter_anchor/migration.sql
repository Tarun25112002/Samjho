-- AlterTable
ALTER TABLE "ai_conversations" ADD COLUMN     "chapterId" TEXT;

-- CreateIndex
CREATE INDEX "ai_conversations_chapterId_idx" ON "ai_conversations"("chapterId");

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
