-- AlterTable
ALTER TABLE "question_sources" ADD COLUMN     "pastPaperId" TEXT;

-- CreateTable
CREATE TABLE "past_papers" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "examSession" TEXT NOT NULL,
    "paperCode" TEXT,
    "setCode" TEXT,
    "region" TEXT,
    "printedQuestionCount" INTEGER,
    "totalMarks" INTEGER,
    "wasHeld" BOOLEAN NOT NULL DEFAULT true,
    "sourceUrl" TEXT,
    "licenceStatus" "LicenceStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "past_papers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "past_papers_subjectId_year_idx" ON "past_papers"("subjectId", "year");

-- CreateIndex
CREATE INDEX "past_papers_year_examSession_idx" ON "past_papers"("year", "examSession");

-- CreateIndex
CREATE UNIQUE INDEX "past_papers_subjectId_year_examSession_paperCode_setCode_key" ON "past_papers"("subjectId", "year", "examSession", "paperCode", "setCode");

-- CreateIndex
CREATE INDEX "question_sources_pastPaperId_idx" ON "question_sources"("pastPaperId");

-- AddForeignKey
ALTER TABLE "question_sources" ADD CONSTRAINT "question_sources_pastPaperId_fkey" FOREIGN KEY ("pastPaperId") REFERENCES "past_papers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "past_papers" ADD CONSTRAINT "past_papers_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Close the NULL hole in the paper identity key.
--
-- `@@unique([subjectId, year, examSession, paperCode, setCode])` above compiles
-- to a plain unique index over five columns, two of which are nullable. Postgres
-- treats NULL as distinct from NULL, so that index does not constrain a row
-- where either is absent — and *both* are absent on every backlog row, which is
-- the majority of this table by design: a paper is registered before anyone has
-- the PDF that would tell them its code.
--
-- Without these, seeding the backlog twice produces two "Class 10 Maths, 2019,
-- March" rows, an ingest resolves to whichever it finds first, and a coverage
-- report shows the same paper at 12 questions and at 0.
--
-- Three partial indexes because there are three ways to be NULL here, and the
-- mixed cases are real: papers from the early years of the range carry a set
-- with no code. Postgres 15's `NULLS NOT DISTINCT` would say this in one line;
-- partial indexes are used instead for the same reason as in
-- `20260808201500_unique_subject_identity_without_variant` — they work on every
-- version and need no server-version check.
CREATE UNIQUE INDEX "past_papers_identity_no_code_no_set_key"
  ON "past_papers" ("subjectId", "year", "examSession")
  WHERE "paperCode" IS NULL AND "setCode" IS NULL;

CREATE UNIQUE INDEX "past_papers_identity_no_set_key"
  ON "past_papers" ("subjectId", "year", "examSession", "paperCode")
  WHERE "paperCode" IS NOT NULL AND "setCode" IS NULL;

CREATE UNIQUE INDEX "past_papers_identity_no_code_key"
  ON "past_papers" ("subjectId", "year", "examSession", "setCode")
  WHERE "paperCode" IS NULL AND "setCode" IS NOT NULL;
