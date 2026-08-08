-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'CONTENT_EDITOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "Board" AS ENUM ('CBSE');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('ENGLISH', 'HINDI');

-- CreateEnum
CREATE TYPE "ExamPhase" AS ENUM ('PHASE_1', 'PHASE_2');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MCQ', 'ASSERTION_REASON', 'VERY_SHORT_ANSWER', 'SHORT_ANSWER', 'LONG_ANSWER', 'CASE_BASED', 'NUMERICAL', 'TRUE_FALSE', 'FILL_BLANK', 'MATCH_FOLLOWING');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "BloomLevel" AS ENUM ('REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYSE', 'EVALUATE', 'CREATE');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('ORIGINAL', 'CBSE_BOARD_PAPER', 'CBSE_SAMPLE_PAPER', 'NCERT', 'ADAPTED', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "LicenceStatus" AS ENUM ('CLEARED', 'FAIR_USE_CLAIMED', 'NEEDS_REVIEW', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('IMAGE', 'DIAGRAM', 'GRAPH', 'TABLE');

-- CreateEnum
CREATE TYPE "PaperType" AS ENUM ('PAST_PAPER', 'SAMPLE_PAPER', 'GENERATED_MOCK');

-- CreateEnum
CREATE TYPE "PaperStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SlotVariant" AS ENUM ('MAIN', 'OR');

-- CreateEnum
CREATE TYPE "PracticeMode" AS ENUM ('QUICK', 'CUSTOM', 'CHAPTER', 'MISTAKE_REVIEW', 'BOOKMARKS', 'PREVIOUS_YEAR');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ExamAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'EVALUATING', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "SubmissionReason" AS ENUM ('STUDENT', 'AUTO_TIMEOUT_CLIENT', 'AUTO_TIMEOUT_SERVER', 'AUTO_TIMEOUT_SWEEPER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AnswerStatus" AS ENUM ('UNANSWERED', 'ANSWERED', 'MARKED_FOR_REVIEW', 'ANSWERED_AND_MARKED');

-- CreateEnum
CREATE TYPE "EvaluationMode" AS ENUM ('AUTO', 'SELF', 'AI', 'PENDING');

-- CreateEnum
CREATE TYPE "MistakeReason" AS ENUM ('CONCEPT_NOT_KNOWN', 'CONCEPT_MISAPPLIED', 'CALCULATION_ERROR', 'MISREAD_QUESTION', 'INCOMPLETE_ANSWER', 'RAN_OUT_OF_TIME', 'SILLY_MISTAKE', 'GUESSED');

-- CreateEnum
CREATE TYPE "AIContext" AS ENUM ('PRACTICE', 'REVIEW', 'CHAPTER');

-- CreateEnum
CREATE TYPE "AIRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AIAction" AS ENUM ('EXPLAIN', 'HINT', 'SIMPLER', 'WHY_WRONG', 'SIMILAR', 'STEP_BY_STEP');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "imageUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classLevel" INTEGER NOT NULL,
    "board" "Board" NOT NULL DEFAULT 'CBSE',
    "school" TEXT,
    "preferredLanguage" "Language" NOT NULL DEFAULT 'ENGLISH',
    "onboardedAt" TIMESTAMP(3),
    "parentEmail" TEXT,
    "parentConsentAt" TIMESTAMP(3),
    "parentConsentToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "target_exams" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "session" TEXT NOT NULL,
    "phase" "ExamPhase" NOT NULL,
    "examDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "target_exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject_enrolments" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_enrolments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "board" "Board" NOT NULL DEFAULT 'CBSE',
    "classLevel" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "variant" TEXT,
    "theoryMarks" INTEGER NOT NULL,
    "hasPractical" BOOLEAN NOT NULL DEFAULT false,
    "internalMarks" INTEGER NOT NULL DEFAULT 0,
    "syllabusYear" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "syllabus_versions" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "syllabus_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "ncertChapterNo" INTEGER,
    "domain" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "body" TEXT NOT NULL,
    "bodyHindi" TEXT,
    "marks" INTEGER NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "observedDifficulty" DOUBLE PRECISION,
    "bloomLevel" "BloomLevel" NOT NULL DEFAULT 'UNDERSTAND',
    "expectedTimeSeconds" INTEGER NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "contentHash" TEXT,
    "parentId" TEXT,
    "subPartIndex" INTEGER,
    "isContainer" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_answers" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "correctValue" TEXT,
    "acceptedValues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tolerance" DOUBLE PRECISION,
    "unit" TEXT,
    "solution" TEXT NOT NULL,
    "markingScheme" JSONB,
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_topics" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "question_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_sources" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "year" INTEGER,
    "examSession" TEXT,
    "paperCode" TEXT,
    "setNumber" TEXT,
    "originalQuestionNumber" TEXT,
    "sourceUrl" TEXT,
    "licenceStatus" "LicenceStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "attributionText" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_assets" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT NOT NULL,
    "caption" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_revisions" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "diff" JSONB NOT NULL,
    "reason" TEXT,
    "editedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_blueprints" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "totalMarks" INTEGER NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "structure" JSONB NOT NULL,
    "verifiedAgainstOfficial" BOOLEAN NOT NULL DEFAULT false,
    "sourceUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_blueprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_papers" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT,
    "subjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "paperType" "PaperType" NOT NULL,
    "year" INTEGER,
    "setCode" TEXT,
    "totalMarks" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "generalInstructions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "PaperStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_papers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_sections" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "instructions" TEXT,
    "marksPerQuestion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_slots" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "questionNumber" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "marks" INTEGER NOT NULL,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_slot_items" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "variantLabel" "SlotVariant" NOT NULL DEFAULT 'MAIN',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_slot_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" "PracticeMode" NOT NULL,
    "filtersJson" JSONB NOT NULL,
    "questionIds" TEXT[],
    "currentIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "SessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "answered" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "marksEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marksPossible" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timeSpentMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examPaperId" TEXT NOT NULL,
    "status" "ExamAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "submissionReason" "SubmissionReason",
    "lastHeartbeatAt" TIMESTAMP(3),
    "objectiveScore" DOUBLE PRECISION,
    "selfAssessedScore" DOUBLE PRECISION,
    "totalScore" DOUBLE PRECISION,
    "totalMarks" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_answers" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "chosenSlotItemId" TEXT,
    "answerJson" JSONB,
    "status" "AnswerStatus" NOT NULL DEFAULT 'UNANSWERED',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "timeSpentMs" INTEGER NOT NULL DEFAULT 0,
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionVersion" INTEGER NOT NULL,
    "questionSnapshot" JSONB NOT NULL,
    "practiceSessionId" TEXT,
    "examAttemptId" TEXT,
    "answerJson" JSONB,
    "isCorrect" BOOLEAN,
    "marksAwarded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marksPossible" DOUBLE PRECISION NOT NULL,
    "evaluationMode" "EvaluationMode" NOT NULL DEFAULT 'PENDING',
    "mistakeReason" "MistakeReason",
    "timeSpentMs" INTEGER NOT NULL DEFAULT 0,
    "usedAiHelp" BOOLEAN NOT NULL DEFAULT false,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mistake_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "firstMissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repairedAt" TIMESTAMP(3),
    "repairAttempts" INTEGER NOT NULL DEFAULT 0,
    "nextReviewAt" TIMESTAMP(3),
    "lastReason" "MistakeReason",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mistake_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_mastery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "attempted" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "marksEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marksPossible" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "masteryScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unrepairedMistakes" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topic_mastery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "attempted" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "marksEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marksPossible" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "masteryScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "questionsBookmarked" INTEGER NOT NULL DEFAULT 0,
    "unrepairedMistakes" INTEGER NOT NULL DEFAULT 0,
    "practiceSessions" INTEGER NOT NULL DEFAULT 0,
    "examsCompleted" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT,
    "questionAttemptId" TEXT,
    "context" "AIContext" NOT NULL,
    "title" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AIRole" NOT NULL,
    "action" "AIAction",
    "content" TEXT NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "model" TEXT,
    "providerRequestId" TEXT,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_ledger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostPaise" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usage_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerkId_key" ON "users"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_userId_key" ON "student_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_parentConsentToken_key" ON "student_profiles"("parentConsentToken");

-- CreateIndex
CREATE INDEX "student_profiles_classLevel_board_idx" ON "student_profiles"("classLevel", "board");

-- CreateIndex
CREATE UNIQUE INDEX "target_exams_profileId_session_phase_key" ON "target_exams"("profileId", "session", "phase");

-- CreateIndex
CREATE INDEX "subject_enrolments_subjectId_isActive_idx" ON "subject_enrolments"("subjectId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "subject_enrolments_profileId_subjectId_key" ON "subject_enrolments"("profileId", "subjectId");

-- CreateIndex
CREATE INDEX "subjects_board_classLevel_isActive_idx" ON "subjects"("board", "classLevel", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_board_classLevel_code_variant_key" ON "subjects"("board", "classLevel", "code", "variant");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_slug_key" ON "subjects"("slug");

-- CreateIndex
CREATE INDEX "syllabus_versions_subjectId_isCurrent_idx" ON "syllabus_versions"("subjectId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "syllabus_versions_subjectId_academicYear_key" ON "syllabus_versions"("subjectId", "academicYear");

-- CreateIndex
CREATE INDEX "chapters_subjectId_domain_orderIndex_idx" ON "chapters"("subjectId", "domain", "orderIndex");

-- CreateIndex
CREATE INDEX "chapters_subjectId_isActive_idx" ON "chapters"("subjectId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_subjectId_slug_key" ON "chapters"("subjectId", "slug");

-- CreateIndex
CREATE INDEX "topics_chapterId_orderIndex_idx" ON "topics"("chapterId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "topics_chapterId_slug_key" ON "topics"("chapterId", "slug");

-- CreateIndex
CREATE INDEX "questions_subjectId_status_difficulty_idx" ON "questions"("subjectId", "status", "difficulty");

-- CreateIndex
CREATE INDEX "questions_chapterId_status_type_idx" ON "questions"("chapterId", "status", "type");

-- CreateIndex
CREATE INDEX "questions_subjectId_chapterId_status_marks_idx" ON "questions"("subjectId", "chapterId", "status", "marks");

-- CreateIndex
CREATE INDEX "questions_parentId_idx" ON "questions"("parentId");

-- CreateIndex
CREATE INDEX "questions_status_publishedAt_idx" ON "questions"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "question_answers_questionId_key" ON "question_answers"("questionId");

-- CreateIndex
CREATE INDEX "question_options_questionId_orderIndex_idx" ON "question_options"("questionId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_questionId_label_key" ON "question_options"("questionId", "label");

-- CreateIndex
CREATE INDEX "question_topics_topicId_questionId_idx" ON "question_topics"("topicId", "questionId");

-- CreateIndex
CREATE INDEX "question_topics_questionId_idx" ON "question_topics"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "question_topics_questionId_topicId_key" ON "question_topics"("questionId", "topicId");

-- CreateIndex
CREATE UNIQUE INDEX "question_sources_questionId_key" ON "question_sources"("questionId");

-- CreateIndex
CREATE INDEX "question_sources_sourceType_year_idx" ON "question_sources"("sourceType", "year");

-- CreateIndex
CREATE INDEX "question_sources_licenceStatus_idx" ON "question_sources"("licenceStatus");

-- CreateIndex
CREATE INDEX "question_assets_questionId_orderIndex_idx" ON "question_assets"("questionId", "orderIndex");

-- CreateIndex
CREATE INDEX "question_revisions_questionId_idx" ON "question_revisions"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "question_revisions_questionId_version_key" ON "question_revisions"("questionId", "version");

-- CreateIndex
CREATE INDEX "exam_blueprints_subjectId_isActive_idx" ON "exam_blueprints"("subjectId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "exam_blueprints_key_version_key" ON "exam_blueprints"("key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "exam_papers_slug_key" ON "exam_papers"("slug");

-- CreateIndex
CREATE INDEX "exam_papers_subjectId_status_idx" ON "exam_papers"("subjectId", "status");

-- CreateIndex
CREATE INDEX "exam_papers_paperType_year_idx" ON "exam_papers"("paperType", "year");

-- CreateIndex
CREATE INDEX "exam_sections_paperId_idx" ON "exam_sections"("paperId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_sections_paperId_orderIndex_key" ON "exam_sections"("paperId", "orderIndex");

-- CreateIndex
CREATE INDEX "exam_slots_sectionId_idx" ON "exam_slots"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_slots_sectionId_orderIndex_key" ON "exam_slots"("sectionId", "orderIndex");

-- CreateIndex
CREATE INDEX "exam_slot_items_questionId_idx" ON "exam_slot_items"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_slot_items_slotId_variantLabel_key" ON "exam_slot_items"("slotId", "variantLabel");

-- CreateIndex
CREATE INDEX "practice_sessions_userId_status_idx" ON "practice_sessions"("userId", "status");

-- CreateIndex
CREATE INDEX "practice_sessions_userId_startedAt_idx" ON "practice_sessions"("userId", "startedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "exam_attempts_idempotencyKey_key" ON "exam_attempts"("idempotencyKey");

-- CreateIndex
CREATE INDEX "exam_attempts_userId_status_idx" ON "exam_attempts"("userId", "status");

-- CreateIndex
CREATE INDEX "exam_attempts_status_deadlineAt_idx" ON "exam_attempts"("status", "deadlineAt");

-- CreateIndex
CREATE INDEX "exam_attempts_examPaperId_idx" ON "exam_attempts"("examPaperId");

-- CreateIndex
CREATE INDEX "exam_answers_attemptId_idx" ON "exam_answers"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_answers_attemptId_slotId_key" ON "exam_answers"("attemptId", "slotId");

-- CreateIndex
CREATE INDEX "question_attempts_userId_attemptedAt_idx" ON "question_attempts"("userId", "attemptedAt" DESC);

-- CreateIndex
CREATE INDEX "question_attempts_userId_questionId_attemptedAt_idx" ON "question_attempts"("userId", "questionId", "attemptedAt");

-- CreateIndex
CREATE INDEX "question_attempts_userId_isCorrect_attemptedAt_idx" ON "question_attempts"("userId", "isCorrect", "attemptedAt");

-- CreateIndex
CREATE INDEX "question_attempts_examAttemptId_idx" ON "question_attempts"("examAttemptId");

-- CreateIndex
CREATE INDEX "question_attempts_practiceSessionId_idx" ON "question_attempts"("practiceSessionId");

-- CreateIndex
CREATE INDEX "question_attempts_questionId_idx" ON "question_attempts"("questionId");

-- CreateIndex
CREATE INDEX "bookmarks_userId_createdAt_idx" ON "bookmarks"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_userId_questionId_key" ON "bookmarks"("userId", "questionId");

-- CreateIndex
CREATE INDEX "mistake_records_userId_repairedAt_idx" ON "mistake_records"("userId", "repairedAt");

-- CreateIndex
CREATE INDEX "mistake_records_userId_nextReviewAt_idx" ON "mistake_records"("userId", "nextReviewAt");

-- CreateIndex
CREATE UNIQUE INDEX "mistake_records_userId_questionId_key" ON "mistake_records"("userId", "questionId");

-- CreateIndex
CREATE INDEX "topic_mastery_userId_masteryScore_idx" ON "topic_mastery"("userId", "masteryScore");

-- CreateIndex
CREATE UNIQUE INDEX "topic_mastery_userId_topicId_key" ON "topic_mastery"("userId", "topicId");

-- CreateIndex
CREATE INDEX "subject_progress_userId_masteryScore_idx" ON "subject_progress"("userId", "masteryScore");

-- CreateIndex
CREATE UNIQUE INDEX "subject_progress_userId_subjectId_key" ON "subject_progress"("userId", "subjectId");

-- CreateIndex
CREATE INDEX "ai_conversations_userId_updatedAt_idx" ON "ai_conversations"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "ai_conversations_questionId_idx" ON "ai_conversations"("questionId");

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_createdAt_idx" ON "ai_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_ledger_date_idx" ON "ai_usage_ledger"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_ledger_userId_date_key" ON "ai_usage_ledger"("userId", "date");

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target_exams" ADD CONSTRAINT "target_exams_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_enrolments" ADD CONSTRAINT "subject_enrolments_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_enrolments" ADD CONSTRAINT "subject_enrolments_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_versions" ADD CONSTRAINT "syllabus_versions_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_answers" ADD CONSTRAINT "question_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_topics" ADD CONSTRAINT "question_topics_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_topics" ADD CONSTRAINT "question_topics_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_sources" ADD CONSTRAINT "question_sources_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_assets" ADD CONSTRAINT "question_assets_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_revisions" ADD CONSTRAINT "question_revisions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_revisions" ADD CONSTRAINT "question_revisions_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_blueprints" ADD CONSTRAINT "exam_blueprints_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_papers" ADD CONSTRAINT "exam_papers_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "exam_blueprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_papers" ADD CONSTRAINT "exam_papers_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_sections" ADD CONSTRAINT "exam_sections_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "exam_papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_slots" ADD CONSTRAINT "exam_slots_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "exam_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_slot_items" ADD CONSTRAINT "exam_slot_items_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "exam_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_slot_items" ADD CONSTRAINT "exam_slot_items_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_examPaperId_fkey" FOREIGN KEY ("examPaperId") REFERENCES "exam_papers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "exam_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_chosenSlotItemId_fkey" FOREIGN KEY ("chosenSlotItemId") REFERENCES "exam_slot_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_practiceSessionId_fkey" FOREIGN KEY ("practiceSessionId") REFERENCES "practice_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_examAttemptId_fkey" FOREIGN KEY ("examAttemptId") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mistake_records" ADD CONSTRAINT "mistake_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mistake_records" ADD CONSTRAINT "mistake_records_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_mastery" ADD CONSTRAINT "topic_mastery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_mastery" ADD CONSTRAINT "topic_mastery_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_progress" ADD CONSTRAINT "subject_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_progress" ADD CONSTRAINT "subject_progress_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_ledger" ADD CONSTRAINT "ai_usage_ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
--  Hand-written integrity constraints
--
--  Prisma's schema language cannot express CHECK constraints, so these are
--  appended by hand. They are worth the manual step: both encode invariants
--  that application code can silently violate, and a database that refuses bad
--  rows is worth more than a code review that was supposed to catch them.
--
--  If a later `prisma migrate dev` regenerates this file, these must be
--  re-added. src/test/db-constraints.test.ts fails when any of them is missing
--  from the live database, so the omission cannot go unnoticed.
-- ═══════════════════════════════════════════════════════════════════════════

-- A question attempt belongs to exactly one context: a practice session or an
-- exam attempt, never both and never neither. Every analytics query assumes
-- this; without the constraint, one buggy write makes marks double-count.
ALTER TABLE "question_attempts"
  ADD CONSTRAINT "question_attempts_exactly_one_session"
  CHECK (("practiceSessionId" IS NULL) <> ("examAttemptId" IS NULL));

-- Sub-part trees are capped at depth 1: a question that is itself a sub-part
-- cannot also be a container. Deeper nesting would break marks accounting and
-- the renderer, both of which are written for exactly two levels.
ALTER TABLE "questions"
  ADD CONSTRAINT "questions_max_depth_one"
  CHECK ("parentId" IS NULL OR "isContainer" = false);

-- A container question holds the stimulus and is never attempted directly, so
-- it must have sub-parts to be worth anything; and a sub-part must declare its
-- position among its siblings, otherwise the renderer has no stable order.
ALTER TABLE "questions"
  ADD CONSTRAINT "questions_subpart_index_present"
  CHECK (("parentId" IS NULL) = ("subPartIndex" IS NULL));

-- Marks are always positive. A zero-mark question is either a data-entry error
-- or a container that forgot its total.
ALTER TABLE "questions"
  ADD CONSTRAINT "questions_marks_positive"
  CHECK ("marks" > 0);

-- An exam attempt's deadline must be after it started. This is the only thing
-- standing between a clock-skew bug and an exam that is over before it begins.
ALTER TABLE "exam_attempts"
  ADD CONSTRAINT "exam_attempts_deadline_after_start"
  CHECK ("deadlineAt" > "startedAt");
