import {
  gradingSuggestionSchema,
  type ConfirmGradingInput,
  type GradingAgreement,
  type GradingSuggestion,
  type RequestGradingInput,
} from "@samjho/contracts";

import type { Prisma } from "../../generated/prisma/client.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { selfEvaluatedGrade } from "../practice/grading.js";
import { practiceRepository } from "../practice/practice.repository.js";
import { applyFinalisedAttempt, type Tx } from "../practice/practice.rollups.js";
import { assertNotRateLimited } from "./ai.quota.js";
import { aiGrading } from "./ai.grading.js";

/**
 * AI-assisted marking, wired to a real attempt.
 *
 * ## What this service will not do
 *
 * Write a score from a model. `confirm` takes marks the *student* sent and
 * records `evaluationMode: "SELF"` — even when those marks are byte-identical
 * to the suggestion. The suggestion is stored beside them, never in them.
 *
 * That is not caution for its own sake. docs/07 R3 says AI grading may become
 * authoritative only once its agreement with students has been measured, and a
 * system that had already been quietly writing the AI's numbers would have
 * nothing left to measure against.
 *
 * ## Why suggestions are cached
 *
 * A student reopening a result page must see the same suggestion they saw
 * before. Re-sampling would show them a grader that disagrees with the marks
 * they accepted ten minutes ago, which destroys the thing the feature is for —
 * and every regrade is another model call against a quota that exists to be a
 * ceiling.
 */

const AGREEMENT_SAMPLE = 500;

export const aiGradingService = {
  /**
   * A marking suggestion for one attempt of the caller's.
   *
   * `userId` is in the `WHERE`, so grading somebody else's answer is
   * unexpressible rather than guarded — the same rule every student-owned
   * resource in this codebase follows.
   */
  async suggest(
    userId: string,
    attemptId: string,
    input: RequestGradingInput,
  ): Promise<GradingSuggestion> {
    const attempt = await loadAttempt(userId, attemptId);

    if (attempt.evaluationMode === "AUTO") {
      throw new ConflictError("This answer was marked automatically — there is nothing to grade.");
    }

    if (!input.refresh && attempt.aiGradingJson !== null) {
      const cached = gradingSuggestionSchema.safeParse(attempt.aiGradingJson);
      if (cached.success) return cached.data;
    }

    // Only the model call is rate limited, and only on a fresh grade. A student
    // reading a cached suggestion is not spending anything, and charging them
    // for it would make reopening a result page feel like a cost.
    assertNotRateLimited(userId);

    const suggestion = await aiGrading.suggest({
      attemptId: attempt.id,
      questionId: attempt.questionId,
      questionBody: attempt.question.body,
      subjectName: attempt.question.subject.name,
      classLevel: attempt.question.subject.classLevel,
      marks: attempt.marksPossible,
      studentAnswer: readStudentAnswer(attempt.answerJson),
      officialSolution: attempt.question.answer?.solution ?? null,
      markingScheme: attempt.question.answer?.markingScheme ?? null,
    });

    // Stored even when it was not generated, so a second load does not make a
    // second failed call at the same unreachable provider.
    await prisma.questionAttempt.update({
      where: { id: attempt.id },
      data: {
        aiGradingJson: suggestion as unknown as Prisma.InputJsonValue,
        ...(suggestion.generated
          ? { aiSuggestedMarks: suggestion.suggestedMarks, aiGradedAt: new Date() }
          : {}),
      },
    });

    return suggestion;
  },

  /**
   * The student's own marks, per step.
   *
   * Clamped twice: each step against what that step is worth, and the total
   * against the question. A client sending nine marks for a five-mark question
   * is corrected rather than believed — the same rule the ordinary
   * self-evaluation path follows, and for the same reason.
   */
  async confirm(
    userId: string,
    attemptId: string,
    input: ConfirmGradingInput,
  ): Promise<{ marksAwarded: number; maxMarks: number; isCorrect: boolean | null }> {
    const attempt = await loadAttempt(userId, attemptId);

    if (attempt.evaluationMode === "AUTO") {
      throw new ConflictError("This answer was marked automatically and cannot be re-scored.");
    }

    if (attempt.evaluationMode !== "PENDING") {
      throw new ConflictError("That answer has already been scored.");
    }

    const suggestion = gradingSuggestionSchema.safeParse(attempt.aiGradingJson);
    const ceilings = suggestion.success
      ? new Map(suggestion.data.steps.map((step) => [step.index, step.maxMarks]))
      : new Map<number, number>();

    let awarded = 0;
    for (const step of input.steps) {
      const ceiling = ceilings.get(step.index) ?? attempt.marksPossible;
      awarded += Math.min(Math.max(step.marksAwarded, 0), ceiling);
    }

    const grade = selfEvaluatedGrade(
      round2(Math.min(awarded, attempt.marksPossible)),
      attempt.marksPossible,
    );
    const attribution = await practiceRepository.findAttribution(attempt.questionId);
    const at = new Date();

    // The same transaction the ordinary self-evaluation path uses, and for the
    // same reason: an attempt whose marks are written without its rollups is an
    // attempt whose mastery figure is permanently wrong with nothing to
    // indicate it. `evaluationMode` is SELF, not AI — the student awarded these.
    await prisma.$transaction(async (tx) => {
      await tx.questionAttempt.update({
        where: { id: attempt.id },
        data: {
          isCorrect: grade.isCorrect,
          marksAwarded: grade.marksAwarded,
          evaluationMode: grade.evaluationMode,
        },
      });

      if (attribution && grade.isCorrect !== null) {
        await applyFinalisedAttempt(tx, {
          userId,
          questionId: attempt.questionId,
          subjectId: attribution.subjectId,
          topicId: attribution.topicId,
          isCorrect: grade.isCorrect,
          marksAwarded: grade.marksAwarded,
          marksPossible: attempt.marksPossible,
          mistakeReason: null,
          at,
        });
      }

      // A practice session's counters are recomputed from its attempts, so one
      // that just gained a score has to be recounted. An exam attempt's score
      // is recomputed on read from the same rows, so it needs nothing here.
      if (attempt.practiceSessionId !== null) {
        await recountSession(tx, attempt.practiceSessionId);
      }
    });

    return {
      marksAwarded: grade.marksAwarded,
      maxMarks: attempt.marksPossible,
      isCorrect: grade.isCorrect,
    };
  },

  /**
   * How well the grader has been agreeing with students.
   *
   * Staff-facing. This is the evidence docs/07 R3 asks for before AI grading
   * could ever be promoted beyond assistive, and it is computed from real
   * confirmations rather than from a benchmark — the question is not whether
   * the grader is right in general but whether it is right about *these*
   * students' answers to *these* questions.
   */
  async agreement(): Promise<GradingAgreement> {
    const rows = await prisma.questionAttempt.findMany({
      where: {
        aiSuggestedMarks: { not: null },
        evaluationMode: "SELF",
      },
      select: { aiSuggestedMarks: true, marksAwarded: true },
      orderBy: { aiGradedAt: "desc" },
      take: AGREEMENT_SAMPLE,
    });

    if (rows.length === 0) {
      return {
        sampled: 0,
        acceptedUnchanged: 0,
        meanAbsoluteError: null,
        exactAgreement: null,
        meanBias: null,
      };
    }

    let absolute = 0;
    let bias = 0;
    let exact = 0;

    for (const row of rows) {
      const suggested = row.aiSuggestedMarks ?? 0;
      const difference = suggested - row.marksAwarded;

      absolute += Math.abs(difference);
      bias += difference;
      if (Math.abs(difference) < 0.01) exact += 1;
    }

    return {
      sampled: rows.length,
      acceptedUnchanged: exact,
      meanAbsoluteError: round2(absolute / rows.length),
      exactAgreement: round2(exact / rows.length),
      meanBias: round2(bias / rows.length),
    };
  },
};

async function loadAttempt(userId: string, attemptId: string) {
  const attempt = await prisma.questionAttempt.findFirst({
    where: { id: attemptId, userId },
    select: {
      id: true,
      questionId: true,
      marksPossible: true,
      evaluationMode: true,
      answerJson: true,
      aiGradingJson: true,
      practiceSessionId: true,
      examAttemptId: true,
      question: {
        select: {
          body: true,
          subject: { select: { name: true, classLevel: true } },
          answer: { select: { solution: true, markingScheme: true } },
        },
      },
    },
  });

  if (!attempt) throw new NotFoundError("Attempt");
  return attempt;
}

/**
 * What the student actually wrote, as text the grader can read.
 *
 * Option ids are useless to a marker and are dropped: a question answered by
 * selecting an option is auto-graded and never reaches here, so a stray
 * `optionIds` means a case-study part whose text is the thing being marked.
 */
function readStudentAnswer(value: Prisma.JsonValue | null): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;

  if (typeof value === "object" && !Array.isArray(value)) {
    const text = (value as Record<string, unknown>)["text"];
    if (typeof text === "string") return text;
  }

  return "";
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Recount a practice session from its attempt rows.
 *
 * The same rule the practice service follows throughout: totals are recomputed,
 * never incremented. An answer that has just moved from PENDING to SELF changes
 * the correct count and the marks earned, and nudging those two counters is one
 * more place they can drift from the rows they claim to summarise.
 */
async function recountSession(tx: Tx, sessionId: string): Promise<void> {
  const attempts = await tx.questionAttempt.findMany({
    where: { practiceSessionId: sessionId },
    select: { questionId: true, isCorrect: true, marksAwarded: true, marksPossible: true },
  });

  const marksEarned = attempts.reduce((sum, row) => sum + row.marksAwarded, 0);
  const marksPossible = attempts.reduce((sum, row) => sum + row.marksPossible, 0);

  // An item counts as correct only when every one of its graded parts is, which
  // is the strict reading the session totals already use — a case study with two
  // of three parts right is not a correct question.
  const byQuestion = new Map<string, boolean>();
  for (const row of attempts) {
    const previous = byQuestion.get(row.questionId);
    byQuestion.set(row.questionId, (previous ?? true) && row.isCorrect === true);
  }

  await tx.practiceSession.update({
    where: { id: sessionId },
    data: {
      correct: [...byQuestion.values()].filter(Boolean).length,
      marksEarned: Math.round(marksEarned * 100) / 100,
      marksPossible: Math.round(marksPossible * 100) / 100,
    },
  });
}
