-- AlterTable
ALTER TABLE "question_attempts" ADD COLUMN     "aiGradedAt" TIMESTAMP(3),
ADD COLUMN     "aiGradingJson" JSONB,
ADD COLUMN     "aiSuggestedMarks" DOUBLE PRECISION;

