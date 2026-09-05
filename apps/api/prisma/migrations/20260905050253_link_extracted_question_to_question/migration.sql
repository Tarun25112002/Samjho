-- AddForeignKey
ALTER TABLE "extracted_questions" ADD CONSTRAINT "extracted_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
