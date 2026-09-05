-- The teacher workspace: a teacher identity of its own, question ownership, and
-- the paper-upload staging area the AI extraction writes into.
--
-- Two things here are not mechanical translations of the schema and are worth
-- reading before they are edited:
--
--   * `questions.ownerTeacherId` NULL means the shared, editorially reviewed
--     bank. Every student-facing query filters on it being NULL, so a teacher's
--     imported paper reaches their own classroom and nobody else's.
--
--   * The backfill at the bottom. `isOnboarded` now asks a TEACHER for a
--     `teacher_profiles` row, and teacher accounts created before this migration
--     have none — without the backfill they would be redirected to a setup
--     wizard on every request, having already been teaching.

-- CreateEnum
CREATE TYPE "PaperUploadSourceKind" AS ENUM ('PDF', 'IMAGE', 'TEXT');

-- CreateEnum
CREATE TYPE "PaperUploadStatus" AS ENUM ('UPLOADED', 'EXTRACTING', 'READY', 'FAILED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "ExtractedQuestionStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'REJECTED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "AssignmentSourcePool" AS ENUM ('SHARED', 'TEACHER_BANK');

-- AlterTable
ALTER TABLE "classroom_assignments" ADD COLUMN     "sourcePool" "AssignmentSourcePool" NOT NULL DEFAULT 'SHARED';

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "ownerTeacherId" TEXT;

-- CreateTable
CREATE TABLE "teacher_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "school" TEXT,
    "subjectsTaught" TEXT,
    "onboardedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "termsAcceptedAt" TIMESTAMP(3),
    "termsAcceptedVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_paper_uploads" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceKind" "PaperUploadSourceKind" NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "byteSize" INTEGER,
    "fileData" TEXT,
    "rawText" TEXT,
    "status" "PaperUploadStatus" NOT NULL DEFAULT 'UPLOADED',
    "error" TEXT,
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "extractionMs" INTEGER,
    "extractedCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "question_paper_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extracted_questions" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "printedNumber" TEXT,
    "payload" JSONB NOT NULL,
    "chapterId" TEXT,
    "type" "QuestionType" NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "marks" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION,
    "note" TEXT,
    "status" "ExtractedQuestionStatus" NOT NULL DEFAULT 'PROPOSED',
    "questionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extracted_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teacher_profiles_userId_key" ON "teacher_profiles"("userId");

-- CreateIndex
CREATE INDEX "question_paper_uploads_teacherId_createdAt_idx" ON "question_paper_uploads"("teacherId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "question_paper_uploads_status_idx" ON "question_paper_uploads"("status");

-- CreateIndex
CREATE UNIQUE INDEX "extracted_questions_questionId_key" ON "extracted_questions"("questionId");

-- CreateIndex
CREATE INDEX "extracted_questions_uploadId_orderIndex_idx" ON "extracted_questions"("uploadId", "orderIndex");

-- CreateIndex
CREATE INDEX "extracted_questions_uploadId_status_idx" ON "extracted_questions"("uploadId", "status");

-- CreateIndex
CREATE INDEX "extracted_questions_uploadId_difficulty_idx" ON "extracted_questions"("uploadId", "difficulty");

-- CreateIndex
CREATE INDEX "extracted_questions_chapterId_idx" ON "extracted_questions"("chapterId");

-- CreateIndex
CREATE INDEX "questions_ownerTeacherId_subjectId_status_idx" ON "questions"("ownerTeacherId", "subjectId", "status");

-- AddForeignKey
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_paper_uploads" ADD CONSTRAINT "question_paper_uploads_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_paper_uploads" ADD CONSTRAINT "question_paper_uploads_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_questions" ADD CONSTRAINT "extracted_questions_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "question_paper_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_questions" ADD CONSTRAINT "extracted_questions_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_ownerTeacherId_fkey" FOREIGN KEY ("ownerTeacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Backfill: every existing teacher already finished setting up ─────────────
--
-- `onboardedAt` is set to the account's own creation time rather than now(), so
-- "when did this teacher join" stays true after the backfill rather than
-- recording the date of a migration. Terms are left null on purpose: nobody
-- accepted anything here, and a fabricated consent timestamp is worse than an
-- absent one.
INSERT INTO "teacher_profiles" ("id", "userId", "onboardedAt", "createdAt", "updatedAt")
SELECT
    'tp_backfill_' || "users"."id",
    "users"."id",
    "users"."createdAt",
    "users"."createdAt",
    CURRENT_TIMESTAMP
FROM "users"
WHERE "users"."role" = 'TEACHER'
ON CONFLICT ("userId") DO NOTHING;
