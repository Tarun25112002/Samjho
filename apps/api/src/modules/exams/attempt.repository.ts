import type { AnswerStatus, ListExamAttemptsQuery, SubmissionReason } from "@medhavi/contracts";

import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { studentQuestionSelect } from "../questions/question.repository.js";
import { gradingSelect } from "../practice/practice.repository.js";

/**
 * Exam attempt data access.
 *
 * ## Two selects again, and the same reason as practice
 *
 * `runnerPaperSelect` hydrates a paper for a *live* attempt and reaches
 * questions through `studentQuestionSelect`, which has no answer columns in it
 * at all. `gradingPaperSelect` reaches them through `gradingSelect`, which has
 * every one. They are two constants used by two methods, never one select with
 * a flag, so the payload a student holds during a three-hour exam is
 * structurally incapable of carrying the key (docs/04 §5).
 */

const runnerPaperSelect = {
  id: true,
  title: true,
  slug: true,
  paperType: true,
  status: true,
  year: true,
  setCode: true,
  totalMarks: true,
  durationMinutes: true,
  generalInstructions: true,
  subject: { select: { id: true, name: true, slug: true, classLevel: true } },
  sections: {
    select: {
      id: true,
      name: true,
      orderIndex: true,
      instructions: true,
      marksPerQuestion: true,
      slots: {
        select: {
          id: true,
          questionNumber: true,
          orderIndex: true,
          marks: true,
          isOptional: true,
          items: {
            select: {
              id: true,
              variantLabel: true,
              orderIndex: true,
              question: { select: studentQuestionSelect },
            },
            orderBy: { orderIndex: "asc" },
          },
        },
        orderBy: { orderIndex: "asc" },
      },
    },
    orderBy: { orderIndex: "asc" },
  },
} satisfies Prisma.ExamPaperSelect;

export type RunnerPaperRow = Prisma.ExamPaperGetPayload<{ select: typeof runnerPaperSelect }>;

const gradingPaperSelect = {
  id: true,
  totalMarks: true,
  sections: {
    select: {
      id: true,
      name: true,
      orderIndex: true,
      slots: {
        select: {
          id: true,
          questionNumber: true,
          orderIndex: true,
          marks: true,
          isOptional: true,
          items: {
            select: {
              id: true,
              variantLabel: true,
              orderIndex: true,
              question: { select: gradingSelect },
            },
            orderBy: { orderIndex: "asc" },
          },
        },
        orderBy: { orderIndex: "asc" },
      },
    },
    orderBy: { orderIndex: "asc" },
  },
} satisfies Prisma.ExamPaperSelect;

export type GradingPaperRow = Prisma.ExamPaperGetPayload<{ select: typeof gradingPaperSelect }>;

const attemptSelect = {
  id: true,
  userId: true,
  examPaperId: true,
  status: true,
  startedAt: true,
  deadlineAt: true,
  submittedAt: true,
  submissionReason: true,
  lastHeartbeatAt: true,
  objectiveScore: true,
  selfAssessedScore: true,
  totalScore: true,
  totalMarks: true,
} satisfies Prisma.ExamAttemptSelect;

export type AttemptRow = Prisma.ExamAttemptGetPayload<{ select: typeof attemptSelect }>;

const answerSelect = {
  id: true,
  slotId: true,
  chosenSlotItemId: true,
  answerJson: true,
  status: true,
  revision: true,
  timeSpentMs: true,
  visitCount: true,
  updatedAt: true,
} satisfies Prisma.ExamAnswerSelect;

export type ExamAnswerRow = Prisma.ExamAnswerGetPayload<{ select: typeof answerSelect }>;

/**
 * Enough of a paper to name it in a list, and the slot count to say how long it
 * is. Counted per section rather than fetched, because a history page showing
 * twenty attempts must not pull twenty papers' worth of questions to print
 * "38 questions" beside each.
 */
const paperSummarySelect = {
  id: true,
  title: true,
  slug: true,
  paperType: true,
  status: true,
  year: true,
  setCode: true,
  totalMarks: true,
  durationMinutes: true,
  subject: { select: { id: true, name: true, slug: true, classLevel: true } },
  sections: { select: { _count: { select: { slots: true } } } },
} satisfies Prisma.ExamPaperSelect;

export type PaperSummaryRow = Prisma.ExamPaperGetPayload<{ select: typeof paperSummarySelect }>;

export const attemptRepository = {
  /**
   * Create an attempt, or hand back the one this key already made.
   *
   * The idempotency key is a unique column, so the race between a double-tapped
   * Start button is settled by the database rather than by a check-then-create
   * that has a window in it. A duplicate arrives here as a unique-constraint
   * violation and is answered with the existing row — which is what the student
   * wanted both times.
   */
  async createOrGet(data: {
    userId: string;
    examPaperId: string;
    idempotencyKey: string;
    startedAt: Date;
    deadlineAt: Date;
    totalMarks: number;
  }): Promise<AttemptRow> {
    const existing = await prisma.examAttempt.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
      select: attemptSelect,
    });
    if (existing) return existing;

    try {
      return await prisma.examAttempt.create({
        data: {
          userId: data.userId,
          examPaperId: data.examPaperId,
          idempotencyKey: data.idempotencyKey,
          startedAt: data.startedAt,
          deadlineAt: data.deadlineAt,
          totalMarks: data.totalMarks,
        },
        select: attemptSelect,
      });
    } catch {
      // Lost the race. The winner's row is the answer, and it is the same
      // attempt this caller was trying to create.
      const raced = await prisma.examAttempt.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
        select: attemptSelect,
      });
      if (raced) return raced;
      throw new Error("Could not create or recover the exam attempt");
    }
  },

  findById(id: string, userId: string): Promise<AttemptRow | null> {
    return prisma.examAttempt.findFirst({ where: { id, userId }, select: attemptSelect });
  },

  findRunnerPaper(paperId: string): Promise<RunnerPaperRow | null> {
    return prisma.examPaper.findFirst({
      // Only a published paper may be sat. A draft is half-built by definition,
      // and an archived one has been withdrawn.
      where: { id: paperId, status: "PUBLISHED" },
      select: runnerPaperSelect,
    });
  },

  findGradingPaper(paperId: string): Promise<GradingPaperRow | null> {
    return prisma.examPaper.findUnique({ where: { id: paperId }, select: gradingPaperSelect });
  },

  findAnswers(attemptId: string): Promise<ExamAnswerRow[]> {
    return prisma.examAnswer.findMany({
      where: { attemptId },
      select: answerSelect,
      orderBy: { slotId: "asc" },
    });
  },

  findAnswerRevision(attemptId: string, slotId: string): Promise<{ revision: number } | null> {
    return prisma.examAnswer.findUnique({
      where: { attemptId_slotId: { attemptId, slotId } },
      select: { revision: true },
    });
  },

  /**
   * Write one slot's answer, upserting on `(attemptId, slotId)`.
   *
   * The unique index is what makes two concurrent saves for the same slot
   * collapse into one row instead of racing into two. The revision comparison
   * happens in the service, above this, because "is this write newer" is a
   * decision and this file only performs writes.
   */
  saveAnswer(data: {
    attemptId: string;
    slotId: string;
    answer: Prisma.InputJsonValue;
    status: AnswerStatus;
    chosenSlotItemId: string | null;
    revision: number;
    timeSpentMs: number;
  }): Promise<ExamAnswerRow> {
    return prisma.examAnswer.upsert({
      where: { attemptId_slotId: { attemptId: data.attemptId, slotId: data.slotId } },
      create: {
        attemptId: data.attemptId,
        slotId: data.slotId,
        answerJson: data.answer,
        status: data.status,
        chosenSlotItemId: data.chosenSlotItemId,
        revision: data.revision,
        timeSpentMs: data.timeSpentMs,
        visitCount: 1,
      },
      update: {
        answerJson: data.answer,
        status: data.status,
        chosenSlotItemId: data.chosenSlotItemId,
        revision: data.revision,
        timeSpentMs: data.timeSpentMs,
        visitCount: { increment: 1 },
      },
      select: answerSelect,
    });
  },

  touchHeartbeat(attemptId: string, at: Date): Promise<unknown> {
    return prisma.examAttempt.updateMany({
      where: { id: attemptId, status: "IN_PROGRESS" },
      data: { lastHeartbeatAt: at },
    });
  },

  /**
   * The state transition, guarded by the database.
   *
   * `updateMany` with `status: "IN_PROGRESS"` in the `where` is the whole
   * trick (docs/04 §4): a `findFirst` then `update` has a window between the
   * read and the write, and this has none. Whichever of the double-click, the
   * client's auto-submit and the sweeper arrives first gets `count: 1`; every
   * other one gets `count: 0` and becomes a no-op.
   */
  async claimForSubmission(
    attemptId: string,
    submittedAt: Date,
    reason: SubmissionReason,
  ): Promise<boolean> {
    const claimed = await prisma.examAttempt.updateMany({
      where: { id: attemptId, status: "IN_PROGRESS" },
      data: { status: "SUBMITTED", submittedAt, submissionReason: reason },
    });

    return claimed.count === 1;
  },

  finaliseScores(data: {
    attemptId: string;
    objectiveScore: number;
    selfAssessedScore: number;
    totalScore: number;
  }): Promise<unknown> {
    return prisma.examAttempt.update({
      where: { id: data.attemptId },
      data: {
        status: "COMPLETED",
        objectiveScore: data.objectiveScore,
        selfAssessedScore: data.selfAssessedScore,
        totalScore: data.totalScore,
      },
    });
  },

  async list(userId: string, query: ListExamAttemptsQuery): Promise<AttemptRow[]> {
    return prisma.examAttempt.findMany({
      where: { userId, ...(query.status ? { status: query.status } : {}) },
      select: attemptSelect,
      orderBy: { startedAt: "desc" },
      take: query.limit,
    });
  },

  /**
   * Attempts whose clock ran out while nobody was looking.
   *
   * The index on `(status, deadlineAt)` exists for exactly this query, which a
   * sweeper runs every minute forever.
   */
  findExpired(now: Date, limit: number): Promise<{ id: string; userId: string }[]> {
    return prisma.examAttempt.findMany({
      where: { status: "IN_PROGRESS", deadlineAt: { lt: now } },
      select: { id: true, userId: true },
      orderBy: { deadlineAt: "asc" },
      take: limit,
    });
  },

  findPaperSummaries(paperIds: string[]): Promise<PaperSummaryRow[]> {
    return prisma.examPaper.findMany({
      where: { id: { in: paperIds } },
      select: paperSummarySelect,
    });
  },
};
