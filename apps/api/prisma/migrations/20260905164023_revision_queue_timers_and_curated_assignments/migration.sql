-- AlterEnum
ALTER TYPE "AssignmentSourcePool" ADD VALUE 'CURATED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PracticeMode" ADD VALUE 'REVIEW_DUE';
ALTER TYPE "PracticeMode" ADD VALUE 'ASSIGNED';

-- AlterTable
ALTER TABLE "classroom_assignments" ADD COLUMN     "questionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "timeLimitMinutes" INTEGER;

-- AlterTable
ALTER TABLE "mistake_records" ADD COLUMN     "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
ADD COLUMN     "graduatedAt" TIMESTAMP(3),
ADD COLUMN     "intervalDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastReviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reviewStreak" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "practice_sessions" ADD COLUMN     "deadlineAt" TIMESTAMP(3),
ADD COLUMN     "timeLimitSeconds" INTEGER;

-- CreateTable
CREATE TABLE "study_days" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "marksEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marksPossible" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviews" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_days_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "study_days_userId_day_idx" ON "study_days"("userId", "day" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "study_days_userId_day_key" ON "study_days"("userId", "day");

-- CreateIndex
CREATE INDEX "practice_sessions_status_deadlineAt_idx" ON "practice_sessions"("status", "deadlineAt");

-- AddForeignKey
ALTER TABLE "study_days" ADD CONSTRAINT "study_days_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every mistake still unrepaired becomes due for review now.
--
-- Without this the queue is empty for every existing student until they miss
-- something new, which is precisely backwards — the students with the most to
-- review are the ones with the most history, and they would be the ones shown
-- nothing. `intervalDays` stays 0 so the first successful review schedules the
-- first real gap rather than inheriting an interval nobody earned.
--
-- Records already repaired are deliberately left unscheduled. They were fixed
-- under the old rules, and retroactively dragging months of settled work back
-- into a student's queue on the day this ships would make the feature's first
-- impression a wall of several hundred due questions.
UPDATE "mistake_records"
SET "nextReviewAt" = CURRENT_TIMESTAMP
WHERE "repairedAt" IS NULL AND "nextReviewAt" IS NULL;
