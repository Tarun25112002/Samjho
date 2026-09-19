-- CreateEnum
CREATE TYPE "AssessmentObjective" AS ENUM ('DIAGNOSTIC_FUNDAMENTALS', 'DIAGNOSTIC_APPLICATION', 'DIAGNOSTIC_CHALLENGE', 'ADAPTIVE_PERSONALISED');

-- CreateEnum
CREATE TYPE "SelectionReason" AS ENUM ('DIAGNOSTIC_LADDER', 'WEAK_AREA', 'REINFORCEMENT', 'CURRENT_LEVEL', 'CHALLENGE', 'COVERAGE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PracticeMode" ADD VALUE 'DIAGNOSTIC';
ALTER TYPE "PracticeMode" ADD VALUE 'ADAPTIVE';

-- AlterTable
ALTER TABLE "practice_sessions" ADD COLUMN     "objective" "AssessmentObjective",
ADD COLUMN     "plannedQuestions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "selectionsJson" JSONB;

-- AlterTable
ALTER TABLE "question_answers" ADD COLUMN     "hint" TEXT;

-- AlterTable
ALTER TABLE "question_attempts" ADD COLUMN     "hintUsed" BOOLEAN NOT NULL DEFAULT false;

