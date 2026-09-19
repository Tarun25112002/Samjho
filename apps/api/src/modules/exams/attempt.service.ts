import {
  EMPTY_EXAM_ANSWER,
  examAnswerValueSchema,
  markingStepSchema,
  type AnswerStatus,
  type ExamAttempt,
  type ExamAttemptSummary,
  type ExamHeartbeat,
  type ExamItem,
  type ExamResult,
  type ExamResultItem,
  type ExamAnswerValue,
  type ExamScore,
  type ExamSectionResult,
  type ListExamAttemptsQuery,
  type QuestionAnswer,
  type SaveExamAnswerInput,
  type SaveExamAnswerResult,
  type StartExamAttemptInput,
  type SubmissionReason,
  type SubmitExamAttemptInput,
} from "@medhavi/contracts";

import type { Prisma } from "../../generated/prisma/client.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import { analyticsService } from "../analytics/analytics.service.js";
import { gradeAnswer, type GradableUnit } from "../practice/grading.js";
import { applyFinalisedAttempt } from "../practice/practice.rollups.js";
import { toStudentQuestion } from "../questions/question.service.js";
import { ExamExpiredError } from "./exam.errors.js";
import {
  attemptRepository,
  type AttemptRow,
  type ExamAnswerRow,
  type GradingPaperRow,
  type RunnerPaperRow,
} from "./attempt.repository.js";

/**
 * Sitting a paper, from the first tap to the score.
 *
 * ## Expiry is settled on every touch, and rejected on every write
 *
 * `load` finalises an attempt whose deadline has passed before answering, which
 * covers the student who closed the laptop and came back on Tuesday. That is
 * lazy, and lazy is not enough on its own — so `saveAnswer` compares against
 * the stored deadline directly and refuses a late write with 410 whether or not
 * anything has swept. Two independent checks, because the one that runs on read
 * cannot protect a write that arrives first (docs/04 §2).
 *
 * ## Submission is decided by the database
 *
 * Not by this file. `claimForSubmission` is a conditional `updateMany`, and
 * whichever of the double-click, the client's auto-submit and the sweeper wins
 * it does the grading; the losers return the same result rather than an error,
 * because from the student's side their exam did submit.
 *
 * ## What the runner is allowed to hold
 *
 * A live attempt is hydrated through `findRunnerPaper`, whose select cannot
 * reach an answer column. The key is added only in `result`, which is
 * unreachable until the attempt is out of `IN_PROGRESS`.
 */

const SWEEP_BATCH = 50;

export const examAttemptService = {
  /**
   * Start sitting a paper.
   *
   * Refuses a second live attempt at the same paper rather than silently
   * resuming one: a student with two timers running on one paper has lost
   * whichever they are not looking at, and the fix is to send them back to the
   * attempt they already have.
   */
  async start(userId: string, input: StartExamAttemptInput): Promise<ExamAttempt> {
    const paper = await attemptRepository.findRunnerPaper(input.paperId);
    if (!paper) throw new NotFoundError("Exam paper");

    const live = await prisma.examAttempt.findFirst({
      where: { userId, examPaperId: input.paperId, status: "IN_PROGRESS" },
      select: { id: true, idempotencyKey: true },
    });

    if (live && live.idempotencyKey !== input.idempotencyKey) {
      throw new ConflictError(
        "You already have this paper open. Finish or submit that attempt before starting another.",
      );
    }

    const startedAt = new Date();

    const attempt = await attemptRepository.createOrGet({
      userId,
      examPaperId: paper.id,
      idempotencyKey: input.idempotencyKey,
      startedAt,
      // Computed once, here, from the server's clock and the paper's duration.
      // Nothing downstream recomputes it — not on resume, not on reconnect.
      deadlineAt: new Date(startedAt.getTime() + paper.durationMinutes * 60_000),
      totalMarks: paper.totalMarks,
    });

    void analyticsService.record({
      userId,
      type: "ASSESSMENT_STARTED",
      props: { total: countSlots(paper) },
    });

    return hydrate(attempt, paper, await attemptRepository.findAnswers(attempt.id));
  },

  async get(userId: string, attemptId: string): Promise<ExamAttempt> {
    const { attempt, paper } = await load(userId, attemptId);
    return hydrate(attempt, paper, await attemptRepository.findAnswers(attempt.id));
  },

  /**
   * Persist one slot's answer.
   *
   * Returns `accepted: false` rather than throwing when a higher revision
   * already exists. The other tab's newer answer is the one to keep, and the
   * losing client should adopt the returned revision rather than retry — an
   * error here would have it retrying forever against a write that is correctly
   * being refused.
   */
  async saveAnswer(
    userId: string,
    attemptId: string,
    slotId: string,
    input: SaveExamAnswerInput,
  ): Promise<SaveExamAnswerResult> {
    const { attempt, paper } = await load(userId, attemptId);

    if (attempt.status !== "IN_PROGRESS") {
      throw new ExamExpiredError("This exam has been submitted. No further answers can be saved.");
    }

    // The independent check. `load` has already swept an expired attempt, but a
    // write that arrives in the same second as the deadline must be refused on
    // its own terms rather than on whether a read happened to run first.
    if (attempt.deadlineAt.getTime() <= Date.now()) {
      throw new ExamExpiredError("Time is up. Your answers so far have been saved.");
    }

    const slot = findSlot(paper, slotId);
    if (!slot) throw new NotFoundError("Question");

    if (input.chosenItemId !== null && !slot.items.some((item) => item.id === input.chosenItemId)) {
      throw new NotFoundError("Question");
    }

    const existing = await attemptRepository.findAnswerRevision(attemptId, slotId);

    if (existing !== null && input.revision < existing.revision) {
      return {
        slotId,
        revision: existing.revision,
        status: input.status,
        savedAt: new Date().toISOString(),
        serverTime: new Date().toISOString(),
        accepted: false,
      };
    }

    const saved = await attemptRepository.saveAnswer({
      attemptId,
      slotId,
      answer: input.answer as unknown as Prisma.InputJsonValue,
      status: input.status,
      chosenSlotItemId: input.chosenItemId,
      revision: input.revision,
      timeSpentMs: input.timeSpentMs,
    });

    return {
      slotId,
      revision: saved.revision,
      status: saved.status,
      savedAt: saved.updatedAt.toISOString(),
      serverTime: new Date().toISOString(),
      accepted: true,
    };
  },

  /**
   * Still here, and how long is left.
   *
   * `remainingMs` is computed by the server rather than left to the client to
   * subtract, so a device whose clock is wrong is told the truth rather than
   * being trusted to work it out.
   */
  async heartbeat(userId: string, attemptId: string): Promise<ExamHeartbeat> {
    const { attempt } = await load(userId, attemptId);
    const now = new Date();

    if (attempt.status === "IN_PROGRESS") {
      await attemptRepository.touchHeartbeat(attemptId, now);
    }

    return {
      serverTime: now.toISOString(),
      deadlineAt: attempt.deadlineAt.toISOString(),
      status: attempt.status,
      remainingMs: Math.max(0, attempt.deadlineAt.getTime() - now.getTime()),
    };
  },

  async submit(
    userId: string,
    attemptId: string,
    input: SubmitExamAttemptInput,
  ): Promise<ExamResult> {
    const { attempt } = await load(userId, attemptId);

    // `load` has already finalised an attempt whose clock ran out, so by here a
    // still-live attempt is one the student is choosing to end.
    if (attempt.status === "IN_PROGRESS") {
      await finalise(attempt, reasonFor(attempt, input.reason));
    }

    return this.result(userId, attemptId);
  },

  async result(userId: string, attemptId: string): Promise<ExamResult> {
    const { attempt, paper } = await load(userId, attemptId);

    if (attempt.status === "IN_PROGRESS") {
      throw new ConflictError("This exam is still in progress. Submit it to see your result.");
    }

    const [answers, gradingPaper, attempts] = await Promise.all([
      attemptRepository.findAnswers(attemptId),
      attemptRepository.findGradingPaper(attempt.examPaperId),
      prisma.questionAttempt.findMany({
        where: { examAttemptId: attemptId },
        select: {
          id: true,
          questionId: true,
          isCorrect: true,
          marksAwarded: true,
          marksPossible: true,
          evaluationMode: true,
        },
      }),
    ]);

    if (!gradingPaper) throw new NotFoundError("Exam paper");

    const answerBySlot = new Map(answers.map((row) => [row.slotId, row]));
    const attemptByQuestion = new Map(attempts.map((row) => [row.questionId, row]));

    const items: ExamResultItem[] = [];
    const sections: ExamSectionResult[] = [];

    for (const section of paper.sections) {
      let awarded = 0;
      let possible = 0;
      let attempted = 0;

      for (const slot of section.slots) {
        const saved = answerBySlot.get(slot.id);
        const chosen = chosenItemOf(slot, saved);
        if (!chosen) {
          possible += slot.marks;
          continue;
        }

        const graded = attemptByQuestion.get(chosen.question.id);
        const key = keyFor(gradingPaper, chosen.question.id);

        possible += slot.marks;
        awarded += graded?.marksAwarded ?? 0;
        if (saved && saved.status !== "UNANSWERED") attempted += 1;

        items.push({
          slotId: slot.id,
          sectionName: section.name,
          questionNumber: slot.questionNumber,
          marks: slot.marks,
          question: toStudentQuestion(chosen.question),
          answer: readAnswer(saved?.answerJson ?? null),
          isCorrect: graded?.isCorrect ?? null,
          marksAwarded: graded?.marksAwarded ?? 0,
          evaluationMode: graded?.evaluationMode ?? "PENDING",
          key,
          attemptId: graded?.evaluationMode === "PENDING" ? (graded.id ?? null) : null,
        });
      }

      sections.push({
        sectionId: section.id,
        name: section.name,
        marksAwarded: round2(awarded),
        marksPossible: possible,
        attempted,
        total: section.slots.length,
      });
    }

    return {
      attempt: toAttemptHeader(attempt, paper),
      score: scoreOf(attempts, attempt.totalMarks),
      sections,
      items,
      timeTakenMs: Math.max(
        0,
        (attempt.submittedAt ?? attempt.deadlineAt).getTime() - attempt.startedAt.getTime(),
      ),
      expired:
        attempt.submittedAt !== null &&
        attempt.submittedAt.getTime() >= attempt.deadlineAt.getTime(),
    };
  },

  async list(userId: string, query: ListExamAttemptsQuery): Promise<ExamAttemptSummary[]> {
    const rows = await attemptRepository.list(userId, query);
    if (rows.length === 0) return [];

    const papers = await attemptRepository.findPaperSummaries([
      ...new Set(rows.map((row) => row.examPaperId)),
    ]);
    const paperById = new Map(papers.map((paper) => [paper.id, paper]));

    const pending = await prisma.questionAttempt.groupBy({
      by: ["examAttemptId"],
      where: { examAttemptId: { in: rows.map((row) => row.id) }, evaluationMode: "PENDING" },
      _count: { _all: true },
    });
    const pendingByAttempt = new Map(
      pending.map((row) => [row.examAttemptId, row._count._all] as const),
    );

    return rows.flatMap((row) => {
      const paper = paperById.get(row.examPaperId);
      if (!paper) return [];

      return [
        {
          id: row.id,
          paper: {
            id: paper.id,
            title: paper.title,
            slug: paper.slug,
            paperType: paper.paperType,
            status: paper.status,
            year: paper.year,
            setCode: paper.setCode,
            totalMarks: paper.totalMarks,
            durationMinutes: paper.durationMinutes,
            subject: { ...paper.subject, classLevel: paper.subject.classLevel as 10 | 12 },
            questionCount: paper.sections.reduce((sum, section) => sum + section._count.slots, 0),
          },
          status: row.status,
          startedAt: row.startedAt.toISOString(),
          deadlineAt: row.deadlineAt.toISOString(),
          submittedAt: row.submittedAt?.toISOString() ?? null,
          totalAwarded: row.totalScore,
          totalPossible: row.totalMarks,
          awaitingSelfEvaluation: pendingByAttempt.get(row.id) ?? 0,
        },
      ];
    });
  },

  /**
   * Finalise every attempt whose clock ran out and that nobody came back to.
   *
   * The third of the three auto-submit triggers (docs/04 §2), and the only one
   * that covers a student who never returns. Without it their result sits in
   * limbo forever and every aggregate built over attempts quietly excludes
   * them.
   */
  async sweepExpired(now = new Date()): Promise<number> {
    const expired = await attemptRepository.findExpired(now, SWEEP_BATCH);
    let swept = 0;

    for (const row of expired) {
      try {
        const attempt = await attemptRepository.findById(row.id, row.userId);
        if (!attempt || attempt.status !== "IN_PROGRESS") continue;

        await finalise(attempt, "AUTO_TIMEOUT_SWEEPER");
        swept += 1;
      } catch (error) {
        // One attempt that cannot be graded must not stop the batch. It stays
        // IN_PROGRESS and is picked up on the next sweep, which is the right
        // failure mode for a job that runs every minute.
        logger.error({ err: error, attemptId: row.id }, "Could not sweep an expired exam attempt");
      }
    }

    return swept;
  },
};

/**
 * The attempt and its paper, with expiry already settled.
 *
 * Every path into an attempt goes through here, which is what makes "the
 * deadline passed" something the system notices on the next touch rather than
 * something it has to be told.
 */
async function load(
  userId: string,
  attemptId: string,
): Promise<{ attempt: AttemptRow; paper: RunnerPaperRow }> {
  const attempt = await attemptRepository.findById(attemptId, userId);
  if (!attempt) throw new NotFoundError("Exam attempt");

  const paper = await attemptRepository.findRunnerPaper(attempt.examPaperId);
  if (!paper) throw new NotFoundError("Exam paper");

  if (attempt.status !== "IN_PROGRESS" || attempt.deadlineAt.getTime() > Date.now()) {
    return { attempt, paper };
  }

  await finalise(attempt, "AUTO_TIMEOUT_SERVER");

  // Re-read rather than patching in memory: the finalisation is the
  // authoritative write, and this is what it produced — whether this request
  // made it or a concurrent one did.
  const settled = await attemptRepository.findById(attemptId, userId);
  if (!settled) throw new NotFoundError("Exam attempt");
  return { attempt: settled, paper };
}

/**
 * Submit and grade, exactly once.
 *
 * The claim is the guard. If another request, the sweeper or a second tab got
 * here first, `claimForSubmission` returns false and this does nothing —
 * grading twice would double every mark and every mastery update behind it.
 */
async function finalise(attempt: AttemptRow, reason: SubmissionReason): Promise<void> {
  const submittedAt = new Date(Math.min(Date.now(), attempt.deadlineAt.getTime()));

  const claimed = await attemptRepository.claimForSubmission(attempt.id, submittedAt, reason);
  if (!claimed) return;

  const [paper, answers] = await Promise.all([
    attemptRepository.findGradingPaper(attempt.examPaperId),
    attemptRepository.findAnswers(attempt.id),
  ]);

  if (!paper) {
    logger.error({ attemptId: attempt.id }, "Submitted an attempt whose paper has gone");
    return;
  }

  const answerBySlot = new Map(answers.map((row) => [row.slotId, row]));
  const at = new Date();

  let objective = 0;
  let selfAssessed = 0;

  await prisma.$transaction(async (tx) => {
    for (const section of paper.sections) {
      for (const slot of section.slots) {
        const saved = answerBySlot.get(slot.id);
        const chosen = chosenGradingItemOf(slot, saved);
        if (!chosen) continue;

        const units = gradableUnitsOf(chosen.question);
        const answer = readAnswer(saved?.answerJson ?? null);

        for (const unit of units) {
          // A case study's sub-parts share the slot's single answer box in this
          // version, so each is graded against the same text. That is honest
          // for the subjective parts, which are self-scored anyway, and the
          // objective sub-parts of a case study are rare enough to be worth
          // the simplification rather than a second answer model.
          const grade = gradeAnswer(unit, answer);

          await tx.questionAttempt.create({
            data: {
              userId: attempt.userId,
              questionId: unit.id,
              questionVersion: unit.version,
              questionSnapshot: { slotId: slot.id, marks: unit.marks },
              examAttemptId: attempt.id,
              answerJson: answer as unknown as Prisma.InputJsonValue,
              isCorrect: grade.isCorrect,
              marksAwarded: grade.marksAwarded,
              marksPossible: unit.marks,
              evaluationMode: grade.evaluationMode,
              attemptedAt: at,
            },
          });

          if (grade.evaluationMode === "AUTO") {
            objective += grade.marksAwarded;

            if (grade.isCorrect !== null) {
              await applyFinalisedAttempt(tx, {
                userId: attempt.userId,
                questionId: unit.id,
                subjectId: unit.subjectId,
                topicId: primaryTopicOf(unit),
                isCorrect: grade.isCorrect,
                marksAwarded: grade.marksAwarded,
                marksPossible: unit.marks,
                mistakeReason: null,
                at,
              });
            }
          } else {
            selfAssessed += grade.marksAwarded;
          }
        }
      }
    }

    await tx.examAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "COMPLETED",
        objectiveScore: round2(objective),
        selfAssessedScore: round2(selfAssessed),
        totalScore: round2(objective + selfAssessed),
      },
    });
  });

  void analyticsService.record({
    userId: attempt.userId,
    type: "ASSESSMENT_COMPLETED",
    props: { total: answers.length },
  });
}

function reasonFor(
  attempt: AttemptRow,
  requested: "STUDENT" | "AUTO_TIMEOUT_CLIENT",
): SubmissionReason {
  // A client claiming it auto-submitted at zero is believed only if the
  // server's own clock agrees the deadline is close. Otherwise it is recorded
  // as what it actually was: a student pressing submit.
  if (requested === "AUTO_TIMEOUT_CLIENT" && attempt.deadlineAt.getTime() - Date.now() < 60_000) {
    return "AUTO_TIMEOUT_CLIENT";
  }
  return "STUDENT";
}

function hydrate(
  attempt: AttemptRow,
  paper: RunnerPaperRow,
  answers: ExamAnswerRow[],
): ExamAttempt {
  const answerBySlot = new Map(answers.map((row) => [row.slotId, row]));
  const items: ExamItem[] = [];

  for (const section of paper.sections) {
    for (const slot of section.slots) {
      const saved = answerBySlot.get(slot.id);

      items.push({
        slotId: slot.id,
        sectionId: section.id,
        sectionName: section.name,
        questionNumber: slot.questionNumber,
        orderIndex: slot.orderIndex,
        marks: slot.marks,
        isOptional: slot.isOptional,
        items: slot.items.map((item) => ({
          id: item.id,
          variantLabel: item.variantLabel,
          question: toStudentQuestion(item.question),
        })),
        chosenItemId: saved?.chosenSlotItemId ?? null,
        answer: readAnswer(saved?.answerJson ?? null),
        status: (saved?.status ?? "UNANSWERED") as AnswerStatus,
        revision: saved?.revision ?? 0,
        timeSpentMs: saved?.timeSpentMs ?? 0,
        visitCount: saved?.visitCount ?? 0,
      });
    }
  }

  return {
    ...toAttemptHeader(attempt, paper),
    items,
  };
}

function toAttemptHeader(attempt: AttemptRow, paper: RunnerPaperRow): Omit<ExamAttempt, "items"> {
  return {
    id: attempt.id,
    paper: {
      id: paper.id,
      title: paper.title,
      slug: paper.slug,
      paperType: paper.paperType,
      status: paper.status,
      year: paper.year,
      setCode: paper.setCode,
      totalMarks: paper.totalMarks,
      durationMinutes: paper.durationMinutes,
      subject: { ...paper.subject, classLevel: paper.subject.classLevel as 10 | 12 },
      questionCount: countSlots(paper),
    },
    generalInstructions: paper.generalInstructions,
    status: attempt.status,
    startedAt: attempt.startedAt.toISOString(),
    deadlineAt: attempt.deadlineAt.toISOString(),
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    submissionReason: attempt.submissionReason,
    serverTime: new Date().toISOString(),
    totalMarks: attempt.totalMarks,
  };
}

function scoreOf(
  attempts: { marksAwarded: number; marksPossible: number; evaluationMode: string }[],
  totalMarks: number,
): ExamScore {
  let objectiveAwarded = 0;
  let objectivePossible = 0;
  let selfAwarded = 0;
  let selfPossible = 0;
  let awaiting = 0;

  for (const attempt of attempts) {
    if (attempt.evaluationMode === "AUTO") {
      objectiveAwarded += attempt.marksAwarded;
      objectivePossible += attempt.marksPossible;
      continue;
    }

    selfPossible += attempt.marksPossible;
    if (attempt.evaluationMode === "PENDING") awaiting += 1;
    else selfAwarded += attempt.marksAwarded;
  }

  return {
    objectiveAwarded: round2(objectiveAwarded),
    objectivePossible,
    selfAssessedAwarded: round2(selfAwarded),
    selfAssessedPossible: selfPossible,
    awaitingSelfEvaluation: awaiting,
    totalAwarded: round2(objectiveAwarded + selfAwarded),
    totalPossible: totalMarks,
  };
}

function countSlots(paper: RunnerPaperRow): number {
  return paper.sections.reduce((sum, section) => sum + section.slots.length, 0);
}

function findSlot(paper: RunnerPaperRow, slotId: string) {
  for (const section of paper.sections) {
    const slot = section.slots.find((candidate) => candidate.id === slotId);
    if (slot) return slot;
  }
  return undefined;
}

/**
 * Which of a slot's questions counts.
 *
 * The chosen one where the student picked, and the MAIN variant where they did
 * not — a slot with internal choice that was left alone still has a question in
 * it for the result page to show, and it is the one printed first.
 */
function chosenItemOf(
  slot: RunnerPaperRow["sections"][number]["slots"][number],
  saved: ExamAnswerRow | undefined,
) {
  if (saved?.chosenSlotItemId) {
    const chosen = slot.items.find((item) => item.id === saved.chosenSlotItemId);
    if (chosen) return chosen;
  }
  return slot.items.find((item) => item.variantLabel === "MAIN") ?? slot.items[0];
}

function chosenGradingItemOf(
  slot: GradingPaperRow["sections"][number]["slots"][number],
  saved: ExamAnswerRow | undefined,
) {
  if (saved?.chosenSlotItemId) {
    const chosen = slot.items.find((item) => item.id === saved.chosenSlotItemId);
    if (chosen) return chosen;
  }
  return slot.items.find((item) => item.variantLabel === "MAIN") ?? slot.items[0];
}

type GradingQuestion =
  GradingPaperRow["sections"][number]["slots"][number]["items"][number]["question"];

/**
 * A gradable unit, plus what writing an attempt row for it needs.
 *
 * `GradableUnit` is deliberately the minimum the grader reads — an id, a type,
 * marks, options and a key — so that grading can be unit-tested without a
 * question. Persisting the result needs three more facts about the same unit,
 * and they ride along here rather than being looked up again per sub-part.
 */
interface ExamGradableUnit extends GradableUnit {
  version: number;
  subjectId: string;
  topics: { topicId: string; isPrimary: boolean }[];
}

function gradableUnitsOf(question: GradingQuestion): ExamGradableUnit[] {
  if (question.isContainer) {
    return question.subParts.map((part) => ({
      id: part.id,
      type: part.type,
      marks: part.marks,
      version: part.version,
      subjectId: part.subjectId,
      options: part.options,
      answer: part.answer,
      topics: part.topics,
    }));
  }

  return [
    {
      id: question.id,
      type: question.type,
      marks: question.marks,
      version: question.version,
      subjectId: question.subjectId,
      options: question.options,
      answer: question.answer,
      topics: question.topics,
    },
  ];
}

function primaryTopicOf(unit: ExamGradableUnit): string | null {
  return unit.topics.find((topic) => topic.isPrimary)?.topicId ?? null;
}

function keyFor(paper: GradingPaperRow, questionId: string): QuestionAnswer | null {
  for (const section of paper.sections) {
    for (const slot of section.slots) {
      for (const item of slot.items) {
        if (item.question.id !== questionId) continue;
        return toKey(item.question);
      }
    }
  }
  return null;
}

function toKey(question: GradingQuestion): QuestionAnswer | null {
  if (!question.answer) return null;

  const scheme = markingStepSchema.array().safeParse(question.answer.markingScheme);

  return {
    correctValue: question.answer.correctValue,
    acceptedValues: question.answer.acceptedValues,
    tolerance: question.answer.tolerance,
    unit: question.answer.unit,
    solution: question.answer.solution,
    explanation: question.answer.explanation,
    markingScheme: scheme.success ? scheme.data : null,
    correctOptionIds: question.options
      .filter((option) => option.isCorrect)
      .map((option) => option.id),
  };
}

/** Answers come back out of JSONB, so they are parsed rather than trusted. */
function readAnswer(value: Prisma.JsonValue | null): ExamAnswerValue {
  const parsed = examAnswerValueSchema.safeParse(value);
  return parsed.success ? parsed.data : EMPTY_EXAM_ANSWER;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
