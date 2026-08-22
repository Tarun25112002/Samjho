import type { MistakeReason } from "@samjho/contracts";

import type { Prisma } from "../../generated/prisma/client.js";

/**
 * Keeping the progress rollups true, one attempt at a time.
 *
 * ## Why these tables exist at all
 *
 * "Which topics am I weak at" computed live means aggregating a student's entire
 * attempt history on every dashboard load — 50k rows a year each, for every
 * student, on the page they open first (docs/03 §2.5). So `TopicMastery`,
 * `SubjectProgress` and `MistakeRecord` are maintained incrementally, and the
 * dashboard becomes an indexed lookup.
 *
 * ## Why every function here takes a transaction client
 *
 * A rollup that is not written in the same transaction as the attempt is a
 * rollup that will eventually disagree with the attempts it summarises — one
 * connection drop between the two writes and a student's mastery figure is
 * permanently wrong, with nothing to indicate it. Every function in this file
 * therefore takes `tx` rather than importing `prisma`, which makes calling it
 * outside a transaction impossible rather than merely discouraged.
 *
 * ## When a rollup happens
 *
 * On *finalisation*, not on submission. An auto-graded answer is final the
 * moment it is submitted; a subjective one is not final until the student has
 * scored it against the marking scheme, which may be a minute later or never.
 * Rolling up a `PENDING` attempt would record a zero the student never earned,
 * so the pending path writes the attempt row and nothing else — and
 * `applyFinalisedAttempt` is called from both the auto path and the
 * self-evaluation path, once per attempt, ever.
 */

/** A Prisma client scoped to an open transaction. */
export type Tx = Prisma.TransactionClient;

export interface FinalisedAttempt {
  userId: string;
  /** The graded unit — a sub-part id for a case study, not the container. */
  questionId: string;
  subjectId: string;
  /** Primary topic of the graded unit, falling back to its parent's. */
  topicId: string | null;
  isCorrect: boolean;
  marksAwarded: number;
  marksPossible: number;
  mistakeReason: MistakeReason | null;
  at: Date;
}

/**
 * How fast mastery forgets.
 *
 * `TopicMastery.masteryScore` is recency-weighted accuracy, not lifetime
 * accuracy, and the schema comment says why: a student who was 20% in June and
 * 80% in August is not a 50% student, and telling them so is both wrong and
 * demoralising. This is the weight the newest attempt carries.
 *
 * 0.3 puts roughly the last ten attempts in the frame — two practice sets. Low
 * enough that one unlucky question does not move the bar visibly, high enough
 * that a fortnight of work does. It is a product judgement rather than a
 * derivation, and it is a single constant so that changing it is one line and a
 * decision rather than an archaeology exercise.
 */
const MASTERY_WEIGHT = 0.3;

/**
 * Fold one finalised attempt into every rollup it touches.
 *
 * Order matters: the mistake record is settled first, because whether it opened,
 * closed or stayed put is what the two mastery counters need in order to move
 * their `unrepairedMistakes` figure by the right amount.
 */
export async function applyFinalisedAttempt(tx: Tx, attempt: FinalisedAttempt): Promise<void> {
  const mistakeDelta = await settleMistakeRecord(tx, attempt);

  // Sequential, not `Promise.all`. A transaction holds one connection, and
  // issuing two statements into it concurrently is something `pg` currently
  // tolerates and has deprecated — the version that stops tolerating it would
  // turn this into a runtime error under load. The same reasoning kept the
  // Phase 4 editor's re-read outside its transaction.
  await updateTopicMastery(tx, attempt, mistakeDelta);
  await updateSubjectProgress(tx, attempt, mistakeDelta);
}

/**
 * Open, close or leave alone the student's mistake record for this question.
 *
 * Returns the change to their unrepaired-mistake count: +1 when a mistake
 * opened or reopened, -1 when one was repaired, 0 otherwise. Returning the delta
 * rather than having the callers re-derive it is what keeps the three tables
 * agreeing — there is exactly one place that decides a mistake was repaired.
 *
 * `repairAttempts` counts how many times the student has come back to a question
 * they once got wrong, right or wrong. It is the input a spaced-repetition
 * schedule will want later; `nextReviewAt` is deliberately left null until
 * something actually schedules.
 */
async function settleMistakeRecord(tx: Tx, attempt: FinalisedAttempt): Promise<number> {
  const existing = await tx.mistakeRecord.findUnique({
    where: { userId_questionId: { userId: attempt.userId, questionId: attempt.questionId } },
    select: { id: true, repairedAt: true },
  });

  if (attempt.isCorrect) {
    // Getting it right the first time is not a repair, and there is nothing to
    // record — the whole table is about mistakes.
    if (!existing) return 0;

    await tx.mistakeRecord.update({
      where: { id: existing.id },
      data: {
        repairAttempts: { increment: 1 },
        ...(existing.repairedAt === null ? { repairedAt: attempt.at } : {}),
      },
    });

    return existing.repairedAt === null ? -1 : 0;
  }

  if (!existing) {
    await tx.mistakeRecord.create({
      data: {
        userId: attempt.userId,
        questionId: attempt.questionId,
        firstMissedAt: attempt.at,
        lastMissedAt: attempt.at,
        lastReason: attempt.mistakeReason,
      },
    });

    return 1;
  }

  await tx.mistakeRecord.update({
    where: { id: existing.id },
    data: {
      lastMissedAt: attempt.at,
      repairAttempts: { increment: 1 },
      // Missing it again after repairing it reopens the record rather than
      // starting a second one: `firstMissedAt` is when this question first
      // became a problem, and that date does not change because it came back.
      repairedAt: null,
      ...(attempt.mistakeReason ? { lastReason: attempt.mistakeReason } : {}),
    },
  });

  return existing.repairedAt === null ? 0 : 1;
}

async function updateTopicMastery(
  tx: Tx,
  attempt: FinalisedAttempt,
  mistakeDelta: number,
): Promise<void> {
  // A question with no primary topic has nowhere to attribute mastery. That is a
  // content defect rather than a runtime error, so the attempt still counts
  // towards the subject and the topic row is simply not written.
  if (!attempt.topicId) return;

  const existing = await tx.topicMastery.findUnique({
    where: { userId_topicId: { userId: attempt.userId, topicId: attempt.topicId } },
    select: { id: true, attempted: true, masteryScore: true, unrepairedMistakes: true },
  });

  const ratio = attempt.marksPossible > 0 ? attempt.marksAwarded / attempt.marksPossible : 0;

  if (!existing) {
    await tx.topicMastery.create({
      data: {
        userId: attempt.userId,
        topicId: attempt.topicId,
        attempted: 1,
        correct: attempt.isCorrect ? 1 : 0,
        marksEarned: attempt.marksAwarded,
        marksPossible: attempt.marksPossible,
        masteryScore: ratio,
        unrepairedMistakes: Math.max(mistakeDelta, 0),
        lastAttemptedAt: attempt.at,
      },
    });
    return;
  }

  await tx.topicMastery.update({
    where: { id: existing.id },
    data: {
      attempted: { increment: 1 },
      correct: { increment: attempt.isCorrect ? 1 : 0 },
      marksEarned: { increment: attempt.marksAwarded },
      marksPossible: { increment: attempt.marksPossible },
      masteryScore: nextMasteryScore(existing.masteryScore, ratio),
      unrepairedMistakes: clampCount(existing.unrepairedMistakes + mistakeDelta),
      lastAttemptedAt: attempt.at,
    },
  });
}

async function updateSubjectProgress(
  tx: Tx,
  attempt: FinalisedAttempt,
  mistakeDelta: number,
): Promise<void> {
  const existing = await tx.subjectProgress.findUnique({
    where: { userId_subjectId: { userId: attempt.userId, subjectId: attempt.subjectId } },
    select: { id: true, masteryScore: true, unrepairedMistakes: true },
  });

  const ratio = attempt.marksPossible > 0 ? attempt.marksAwarded / attempt.marksPossible : 0;

  if (!existing) {
    await tx.subjectProgress.create({
      data: {
        userId: attempt.userId,
        subjectId: attempt.subjectId,
        attempted: 1,
        correct: attempt.isCorrect ? 1 : 0,
        marksEarned: attempt.marksAwarded,
        marksPossible: attempt.marksPossible,
        masteryScore: ratio,
        unrepairedMistakes: Math.max(mistakeDelta, 0),
        lastAttemptedAt: attempt.at,
      },
    });
    return;
  }

  await tx.subjectProgress.update({
    where: { id: existing.id },
    data: {
      attempted: { increment: 1 },
      correct: { increment: attempt.isCorrect ? 1 : 0 },
      marksEarned: { increment: attempt.marksAwarded },
      marksPossible: { increment: attempt.marksPossible },
      masteryScore: nextMasteryScore(existing.masteryScore, ratio),
      unrepairedMistakes: clampCount(existing.unrepairedMistakes + mistakeDelta),
      lastAttemptedAt: attempt.at,
    },
  });
}

/** Count one completed practice session against each subject it touched. */
export async function countCompletedSession(
  tx: Tx,
  userId: string,
  subjectIds: string[],
): Promise<void> {
  for (const subjectId of subjectIds) {
    await tx.subjectProgress.upsert({
      where: { userId_subjectId: { userId, subjectId } },
      create: { userId, subjectId, practiceSessions: 1 },
      update: { practiceSessions: { increment: 1 } },
    });
  }
}

/** Keep `SubjectProgress.questionsBookmarked` level with the bookmark table. */
export async function countBookmark(
  tx: Tx,
  userId: string,
  subjectId: string,
  delta: 1 | -1,
): Promise<void> {
  const existing = await tx.subjectProgress.findUnique({
    where: { userId_subjectId: { userId, subjectId } },
    select: { id: true, questionsBookmarked: true },
  });

  if (!existing) {
    if (delta < 0) return;
    await tx.subjectProgress.create({ data: { userId, subjectId, questionsBookmarked: 1 } });
    return;
  }

  await tx.subjectProgress.update({
    where: { id: existing.id },
    data: { questionsBookmarked: clampCount(existing.questionsBookmarked + delta) },
  });
}

/** Exponentially weighted, so the newest attempt matters most. */
function nextMasteryScore(previous: number, ratio: number): number {
  return previous + MASTERY_WEIGHT * (ratio - previous);
}

/**
 * A count of things that exist cannot be negative.
 *
 * Belt and braces: the deltas above are derived from a single decision point, so
 * this should never fire. It is here because the failure it prevents is a
 * dashboard reading "-1 mistakes", which destroys a student's confidence in
 * every other number on the page — a much worse outcome than quietly clamping.
 */
function clampCount(value: number): number {
  return Math.max(value, 0);
}
