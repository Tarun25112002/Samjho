-- Teacher-led classrooms and assigned practice. Assignment submissions point
-- at the existing immutable practice session; no answer text is duplicated
-- into the teacher domain.

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'TEACHER';

-- CreateTable
CREATE TABLE "classrooms" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classroom_memberships" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classroom_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classroom_assignments" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "chapterId" TEXT,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "questionCount" INTEGER NOT NULL,
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classroom_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_submissions" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "classrooms_joinCode_key" ON "classrooms"("joinCode");
CREATE INDEX "classrooms_teacherId_isArchived_idx" ON "classrooms"("teacherId", "isArchived");
CREATE INDEX "classrooms_subjectId_idx" ON "classrooms"("subjectId");
CREATE UNIQUE INDEX "classroom_memberships_classroomId_studentId_key" ON "classroom_memberships"("classroomId", "studentId");
CREATE INDEX "classroom_memberships_studentId_joinedAt_idx" ON "classroom_memberships"("studentId", "joinedAt" DESC);
CREATE INDEX "classroom_assignments_classroomId_dueAt_idx" ON "classroom_assignments"("classroomId", "dueAt");
CREATE INDEX "classroom_assignments_chapterId_idx" ON "classroom_assignments"("chapterId");
CREATE UNIQUE INDEX "assignment_submissions_sessionId_key" ON "assignment_submissions"("sessionId");
CREATE UNIQUE INDEX "assignment_submissions_assignmentId_studentId_key" ON "assignment_submissions"("assignmentId", "studentId");
CREATE INDEX "assignment_submissions_studentId_startedAt_idx" ON "assignment_submissions"("studentId", "startedAt" DESC);

-- AddForeignKey
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "classroom_memberships" ADD CONSTRAINT "classroom_memberships_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "classroom_memberships" ADD CONSTRAINT "classroom_memberships_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "classroom_assignments" ADD CONSTRAINT "classroom_assignments_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "classroom_assignments" ADD CONSTRAINT "classroom_assignments_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "classroom_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "practice_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep invalid assignment definitions out of the data layer. The API applies
-- the same bounds so feedback is immediate; this remains the final guard.
ALTER TABLE "classroom_assignments"
  ADD CONSTRAINT "classroom_assignments_question_count_bounds"
  CHECK ("questionCount" >= 3 AND "questionCount" <= 30);
