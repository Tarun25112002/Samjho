import {
  REVIEW_DAILY_CAP,
  type PracticeSession,
  type RevisionQueue,
  type RevisionSubjectDue,
  type StartRevisionInput,
  type StudyStreak,
} from "@medhavi/contracts";

import { NotFoundError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { currentStreak, istDay, longestStreak, shiftDay, toDayKey } from "../../lib/study-day.js";
import { practiceService } from "../practice/practice.service.js";

/**
 * The revision queue: what the schedule says a student owes today.
 *
 * ## Everything here reads one indexed predicate
 *
 * `WHERE userId = ? AND nextReviewAt <= now()`. That is the queue. The counts,
 * the per-subject split, the "what is coming this week" figure and the session
 * contents are all that predicate with different bounds, which is why this is a
 * handful of counts rather than the aggregation over attempt history that
 * computing due-ness on the fly would require. The scheduling work was all done
 * at write time, in the transaction that graded the answer.
 *
 * ## Why the queue is capped and the backlog is not hidden
 *
 * `dueToday` is `min(dueTotal, REVIEW_DAILY_CAP)` and both are returned. A
 * student who has been away for a fortnight has a real backlog, and the two
 * available lies are equally bad: show them 340 and they close the app, or show
 * them 20 with no context and they clear it every day for two weeks while the
 * number never moves and the feature appears broken.
 *
 * So the honest shape is "20 to do today, 340 in total", where the second number
 * visibly falls. That is a design decision expressed as two fields rather than
 * one, and it is the reason the contract carries both.
 */
export const revisionService = {
  /**
   * The queue, the streak, and enough context to decide whether to start.
   *
   * Every count is scoped to the student's *active enrolments*. A student who
   * switched from Maths Standard to Basic should not be shown a queue full of
   * questions from a course they left — the mistake records are still true, and
   * reviewing them is no longer the best use of the next half hour.
   */
  async queue(userId: string): Promise<RevisionQueue> {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const enrolments = await prisma.subjectEnrolment.findMany({
      where: { profile: { userId }, isActive: true },
      orderBy: { subject: { orderIndex: "asc" } },
      select: {
        subject: {
          select: {
            id: true,
            board: true,
            code: true,
            name: true,
            slug: true,
            variant: true,
            classLevel: true,
            theoryMarks: true,
          },
        },
      },
    });

    const subjectIds = enrolments.map(({ subject }) => subject.id);

    // A student who has not finished onboarding has no enrolments and therefore
    // no queue. Returning the empty shape rather than querying with an empty
    // `in` clause keeps Postgres from planning a scan that can only find nothing.
    if (subjectIds.length === 0) {
      return {
        dueToday: 0,
        dueTotal: 0,
        dueThisWeek: 0,
        graduated: 0,
        unscheduled: 0,
        nextDueAt: null,
        bySubject: [],
        streak: await this.streak(userId),
        reviewedToday: 0,
      };
    }

    const inScope = { userId, question: { subjectId: { in: subjectIds } } };

    const [dueTotal, dueThisWeek, graduated, unscheduled, nextDue, dueRows, upcomingRows, today] =
      await Promise.all([
        prisma.mistakeRecord.count({ where: { ...inScope, nextReviewAt: { lte: now } } }),
        prisma.mistakeRecord.count({
          where: { ...inScope, nextReviewAt: { gt: now, lte: weekFromNow } },
        }),
        prisma.mistakeRecord.count({ where: { ...inScope, graduatedAt: { not: null } } }),
        prisma.mistakeRecord.count({
          where: { ...inScope, repairedAt: null, nextReviewAt: null, graduatedAt: null },
        }),
        prisma.mistakeRecord.findFirst({
          where: { ...inScope, nextReviewAt: { gt: now } },
          orderBy: { nextReviewAt: "asc" },
          select: { nextReviewAt: true },
        }),
        // Grouped in the database rather than counted per subject in a loop: the
        // loop is N round trips to render one row of chips.
        prisma.mistakeRecord.groupBy({
          by: ["questionId"],
          where: { ...inScope, nextReviewAt: { lte: now } },
          _count: { _all: true },
        }),
        prisma.mistakeRecord.groupBy({
          by: ["questionId"],
          where: { ...inScope, nextReviewAt: { gt: now, lte: weekFromNow } },
          _count: { _all: true },
        }),
        prisma.studyDay.findUnique({
          where: { userId_day: { userId, day: istDay(now) } },
          select: { reviews: true },
        }),
      ]);

    const bySubject = await this.groupBySubject(
      enrolments.map(({ subject }) => subject),
      dueRows.map((row) => row.questionId),
      upcomingRows.map((row) => row.questionId),
    );

    return {
      dueToday: Math.min(dueTotal, REVIEW_DAILY_CAP),
      dueTotal,
      dueThisWeek,
      graduated,
      unscheduled,
      nextDueAt: nextDue?.nextReviewAt?.toISOString() ?? null,
      bySubject,
      streak: await this.streak(userId),
      reviewedToday: today?.reviews ?? 0,
    };
  },

  /**
   * Start a review session from the queue.
   *
   * The set is built here rather than by `practiceSelection`, and the difference
   * is that this one is *ordered by debt* rather than shuffled. The selector's
   * job is "give me something to work on"; this one's is "give me the things I
   * am most overdue on, oldest first". Randomising a review queue would mean a
   * student clearing twenty a day could go a fortnight without meeting the
   * question they have been avoiding longest.
   */
  async startReview(userId: string, input: StartRevisionInput): Promise<PracticeSession> {
    const now = new Date();

    /**
     * The same enrolment scope the queue counts against.
     *
     * It has to be the same, and a test caught it not being: the queue reported
     * one question due and the session it started handed back two, the extra one
     * from a subject the student had dropped. A count and the thing it counts
     * must be the same query, so the predicate is built once here and the
     * subject filter narrows it rather than replacing it.
     */
    const enrolled = await prisma.subjectEnrolment.findMany({
      where: {
        profile: { userId },
        isActive: true,
        ...(input.subjectId ? { subjectId: input.subjectId } : {}),
      },
      select: { subjectId: true },
    });

    const subjectIds = enrolled.map((row) => row.subjectId);

    if (subjectIds.length === 0) {
      throw new NotFoundError(
        input.subjectId
          ? "You are not enrolled in that subject — your revision queue"
          : "Nothing is due for review yet — your revision queue",
      );
    }

    const due = await prisma.mistakeRecord.findMany({
      where: {
        userId,
        nextReviewAt: { lte: now },
        question: { subjectId: { in: subjectIds } },
      },
      // Most overdue first. Ties break on the record id so a student refreshing
      // the page twice gets the same set rather than a reshuffle.
      orderBy: [{ nextReviewAt: "asc" }, { id: "asc" }],
      take: input.count * 2,
      select: { question: { select: { id: true, parentId: true } } },
    });

    // Up to the top-level ancestor, exactly as `practiceSelection` does for the
    // two personal modes and for the same reason: a mistake is recorded against
    // the graded unit, and for a case study that is a sub-part. Practising the
    // sub-part alone would present "Calculate the current" with no circuit.
    //
    // Over-fetching by 2x above is what makes this safe to dedupe afterwards —
    // three sub-parts of one case study collapse to one item, and a queue of
    // twenty that returned seven items would look broken.
    const questionIds = [
      ...new Set(due.map((row) => row.question.parentId ?? row.question.id)),
    ].slice(0, input.count);

    if (questionIds.length === 0) {
      throw new NotFoundError(
        input.subjectId
          ? "Nothing is due for review in that subject yet — your revision queue"
          : "Nothing is due for review yet — your revision queue",
      );
    }

    // One live review session is a resumable queue, not a source of parallel
    // copies. Do this after resolving today's ids: a session that was current
    // when opened but whose questions have since been reviewed normally is not
    // today's queue, and must not mask the honest "nothing due" response.
    //
    // The scheduler still defends against a truly concurrent create below — two
    // requests can both pass this read before either writes — but this is the
    // normal path and keeps a student's history tidy as well.
    const activeSession = await prisma.practiceSession.findFirst({
      where: {
        userId,
        mode: "REVIEW_DUE",
        status: "IN_PROGRESS",
        OR: [{ deadlineAt: null }, { deadlineAt: { gt: now } }],
      },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      select: { id: true, questionIds: true },
    });
    if (activeSession && sameQuestionIds(activeSession.questionIds, questionIds)) {
      return practiceService.get(userId, activeSession.id);
    }

    return practiceService.create(
      userId,
      {
        mode: "REVIEW_DUE",
        filters: { unseenOnly: false, ...(input.subjectId ? { subjectId: input.subjectId } : {}) },
        count: questionIds.length,
        ...(input.timeLimitMinutes === undefined
          ? {}
          : { timeLimitMinutes: input.timeLimitMinutes }),
      },
      { questionIds },
    );
  },

  /**
   * The study streak and the year behind it.
   *
   * One query for up to 366 narrow rows, then two passes in memory. The
   * alternative — asking Postgres for consecutive-day runs — is a window
   * function over a gaps-and-islands query, which is a great deal of SQL to
   * avoid iterating an array that cannot exceed 366 entries.
   */
  async streak(userId: string): Promise<StudyStreak> {
    const today = istDay(new Date());

    const rows = await prisma.studyDay.findMany({
      where: { userId, day: { gte: shiftDay(today, 365) } },
      orderBy: { day: "desc" },
      select: { day: true, attempts: true, correct: true, reviews: true },
    });

    const days = rows.map((row) => row.day);

    return {
      current: currentStreak(days, today),
      longest: longestStreak(days),
      studiedToday: rows.some((row) => row.day.getTime() === today.getTime()),
      recent: rows.map((row) => ({
        date: toDayKey(row.day),
        attempts: row.attempts,
        correct: row.correct,
        reviews: row.reviews,
      })),
    };
  },

  /**
   * Attribute due and upcoming question ids to their subjects.
   *
   * Takes ids rather than doing the grouping in SQL because `MistakeRecord` has
   * no `subjectId` of its own — it points at a question, and the subject is on
   * the question. A `groupBy` across that relation is not something Prisma
   * expresses, and the join in raw SQL would be the only raw SQL in this module.
   * Two `in` lookups over a bounded id list is the cheaper trade.
   */
  async groupBySubject(
    subjects: RevisionSubjectDue["subject"][],
    dueQuestionIds: string[],
    upcomingQuestionIds: string[],
  ): Promise<RevisionSubjectDue[]> {
    const ids = [...new Set([...dueQuestionIds, ...upcomingQuestionIds])];
    if (ids.length === 0) return [];

    const questions = await prisma.question.findMany({
      where: { id: { in: ids } },
      select: { id: true, subjectId: true },
    });
    const subjectOf = new Map(questions.map((question) => [question.id, question.subjectId]));

    const due = new Map<string, number>();
    const upcoming = new Map<string, number>();

    for (const id of dueQuestionIds) {
      const subjectId = subjectOf.get(id);
      if (subjectId) due.set(subjectId, (due.get(subjectId) ?? 0) + 1);
    }
    for (const id of upcomingQuestionIds) {
      const subjectId = subjectOf.get(id);
      if (subjectId) upcoming.set(subjectId, (upcoming.get(subjectId) ?? 0) + 1);
    }

    return (
      subjects
        .map((subject) => ({
          subject,
          due: due.get(subject.id) ?? 0,
          upcoming: upcoming.get(subject.id) ?? 0,
        }))
        // A subject with nothing scheduled is not a zero worth rendering — it is a
        // chip that says "you have no mistakes here", which reads as a failure of
        // the feature rather than a success of the student.
        .filter((row) => row.due > 0 || row.upcoming > 0)
    );
  },
};

/** A frozen review set can only be resumed when it is exactly today's set. */
function sameQuestionIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}
