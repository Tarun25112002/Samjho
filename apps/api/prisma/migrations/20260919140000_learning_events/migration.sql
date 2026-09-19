-- CreateEnum
CREATE TYPE "LearningEventType" AS ENUM ('ASSESSMENT_STARTED', 'QUESTION_VIEWED', 'ANSWER_SUBMITTED', 'HINT_REQUESTED', 'QUESTION_MARKED', 'ASSESSMENT_COMPLETED', 'RECOMMENDATION_CLICKED', 'SIMILAR_QUESTION_STARTED');

-- CreateTable
CREATE TABLE "learning_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LearningEventType" NOT NULL,
    "sessionId" TEXT,
    "questionId" TEXT,
    "propsJson" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "learning_events_userId_occurredAt_idx" ON "learning_events"("userId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "learning_events_type_occurredAt_idx" ON "learning_events"("type", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "learning_events_sessionId_idx" ON "learning_events"("sessionId");

-- CreateIndex
CREATE INDEX "learning_events_questionId_idx" ON "learning_events"("questionId");

-- AddForeignKey
ALTER TABLE "learning_events" ADD CONSTRAINT "learning_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_events" ADD CONSTRAINT "learning_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "practice_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_events" ADD CONSTRAINT "learning_events_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

