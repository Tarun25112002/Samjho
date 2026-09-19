import {
  markingStepSchema,
  questionSelectionSchema,
  practiceFiltersSchema,
  WEAK_TOPIC_MARK_RATIO,
  WEAK_TOPIC_MIN_ATTEMPTS,
  type AttemptOutcome,
  type CreatePracticeSessionInput,
  type EvaluationMode,
  type ListPracticeSessionsQuery,
  type Paginated,
  type PracticeAttempt,
  type PracticeFilters,
  type PracticeItem,
  type PracticeResult,
  type PracticeSession,
  type PracticeSessionSummary,
  type PracticeTopicResult,
  type QuestionAnswer,
  type QuestionSelection,
  type SelfEvaluateInput,
  type SetMistakeReasonInput,
  type StudentAnswer,
  type StudentQuestion,
  type SubmitAttemptInput,
} from "@samjho/contracts";
import { z } from "zod";

import type { Prisma } from "../../generated/prisma/client.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { toStudentQuestion } from "../questions/question.service.js";
import { bookmarkService } from "./bookmark.service.js";
import { gradeAnswer, selfEvaluatedGrade, type GradableUnit } from "./grading.js";
import {
  practiceRepository,
  type AttemptRow,
  type GradingKeyRow,
  type GradingRow,
  type SessionRow,
} from "./practice.repository.js";
import { applyFinalisedAttempt, countCompletedSession, type Tx } from "./practice.rollups.js";
import { practiceSelection } from "./practice.selection.js";
import { correctLatestLapseSchedule } from "../revision/revision.scheduler.js";

/**
 * Practice sessions: creating them, answering them, scoring them.
 *
 * ## Totals are recomputed, never incremented
 *
 * Every write path here ends by recalculating the session's counters from its
 * attempt rows rather than nudging them. Incrementing is faster and wrong: a
 * case study becomes "correct" only once its last sub-part is scored, a
 * subjective answer changes the correct count minutes after it was submitted,
 * and a retried request must not double-count. Each of those is a separate bug
 * in the incrementing version and none of them exists in this one. A session
 * holds at most fifty items, so the recomputation is one indexed read of a
 * bounded set — the cheapest correctness this codebase buys.
 *
 * ## Answering is idempotent
 *
 * Submitting the same item twice returns the first result instead of writing a
 * second attempt. A double-tapped Submit on a phone with a slow connection is
 * the normal case, not the adversarial one, and the alternative — two attempt
 * rows, mastery counted twice, a mistake record opened against an answer the
 * student got right — is silent and permanent.
 */

export const practiceService = {
  /**
   * Build a set and start a session.
   *
   * Both options exist for callers a student cannot reach, and neither is parsed
   * by the practice router:
   *
   *  - `ownerTeacherId` draws from one teacher's own bank instead of the shared
   *    one. Supplied only by `classroomService.startAssignment`, which reads it
   *    from the classroom the assignment belongs to rather than from the request.
   *  - `questionIds` skips selection entirely and uses exactly these questions,
   *    in this order. Supplied by the revision queue, which has already ordered
   *    them by how overdue they are, and by a curated assignment, where the
   *    teacher's chosen order *is* the paper. A student cannot name a question
   *    id here for the same reason they cannot name a teacher: the route does
   *    not read one.
   *
   * The two are exclusive in practice and not enforced to be, because the one
   * caller that could set both — a curated assignment from a teacher's own bank
   * — genuinely means both, and the ids are the narrower constraint.
   */
  async create(
    userId: string,
    input: CreatePracticeSessionInput,
    options: { ownerTeacherId?: string; questionIds?: string[] } = {},
  ): Promise<PracticeSession> {
    // These modes describe sets whose membership is decided by another service,
    // not by a student's filters. Keeping them in the shared enum lets a stored
    // session say what it is, but accepting them through the ordinary creator
    // would let a caller manufacture a random set labelled "Today's revision"
    // (and inflate the review-day counter) or "Set by your teacher".
    if (
      (input.mode === "REVIEW_DUE" || input.mode === "ASSIGNED") &&
      options.questionIds === undefined
    ) {
      throw new ValidationError("Request validation failed", [
        {
          path: "body.mode",
          message: "this session type can only be started from its revision queue or assignment",
        },
      ]);
    }

    // An adaptive or diagnostic sitting has an objective and a ladder, and both
    // arrive through `/assessments`. Building one here would produce a filtered
    // random set wearing the label of a measurement.
    if (input.mode === "DIAGNOSTIC" || input.mode === "ADAPTIVE") {
      throw new ValidationError("Request validation failed", [
        {
          path: "body.mode",
          message: "this session type is started from /assessments",
        },
      ]);
    }

    if (
      options.questionIds !== undefined &&
      new Set(options.questionIds).size !== options.questionIds.length
    ) {
      // The two trusted callers both create top-level ids and must preserve one
      // id per item. A duplicate here would produce two visual slots backed by
      // one attempt row, making the later slot impossible to answer.
      throw new ValidationError("Request validation failed", [
        { path: "questionIds", message: "a practice set cannot contain the same question twice" },
      ]);
    }

    const questionIds =
      options.questionIds ??
      (await practiceSelection.pick({
        userId,
        mode: input.mode,
        filters: input.filters,
        count: input.count,
        ...(options.ownerTeacherId === undefined ? {} : { ownerTeacherId: options.ownerTeacherId }),
      }));

    if (questionIds.length === 0) {
      // A 404 would be wrong — the filters are fine, the bank is empty. The web
      // app shows this message next to a "widen your filters" prompt, so the
      // wording is a student-facing string rather than a diagnostic.
      throw new NotFoundError(
        options.ownerTeacherId === undefined
          ? "No questions match those filters yet — Samjho's bank"
          : "Your teacher has not published questions for this yet — their question bank",
      );
    }

    if (options.questionIds !== undefined) {
      // Curated assignments and revision sessions supply frozen ids rather than
      // going through the selector. Check their present visibility before
      // creating the session: without this a question withdrawn between a
      // teacher creating an assignment and a student starting it would be
      // silently dropped by hydration, leaving totals for an item the runner
      // cannot display or answer.
      const available = await practiceRepository.findSessionQuestions(questionIds);
      if (available.length !== questionIds.length) {
        throw new NotFoundError("A question in this set");
      }
    }

    const marksPossible = await sumGradableMarks(questionIds);

    // Computed once, here, from the server's clock. Everything downstream — the
    // countdown the student sees, the refusal of a late answer, the expiry sweep
    // — reads this instant rather than re-deriving it, so there is exactly one
    // answer to "when does this end" and no device is consulted for it.
    const startedAt = new Date();
    const timing =
      input.timeLimitMinutes === undefined
        ? {}
        : {
            timeLimitSeconds: input.timeLimitMinutes * 60,
            deadlineAt: new Date(startedAt.getTime() + input.timeLimitMinutes * 60_000),
          };

    const session = await practiceRepository.create({
      userId,
      mode: input.mode,
      filters: input.filters,
      questionIds,
      marksPossible,
      ...timing,
    });

    return hydrateSession(session);
  },

  async get(userId: string, sessionId: string): Promise<PracticeSession> {
    return hydrateSession(await loadSession(userId, sessionId));
  },

  async list(
    userId: string,
    query: ListPracticeSessionsQuery,
  ): Promise<Paginated<PracticeSessionSummary>> {
    const { rows, hasMore } = await practiceRepository.list(userId, query);

    const pendingBySession = await countPendingBySession(rows.map((row) => row.id));
    const focusFor = await buildFocusResolver(rows.map(readFilters));

    const items = rows.map((row) => {
      const {
        items: _items,
        filters: _filters,
        currentIndex: _index,
        serverNow: _serverNow,
        ...summary
      } = toSession(row, [], focusFor(readFilters(row)), pendingBySession.get(row.id) ?? 0);
      return summary;
    });

    return {
      items,
      pageInfo: { hasMore, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null },
    };
  },

  /**
   * Record and grade a student's answer to one item.
   *
   * A "response" is per graded unit — one for the nine simple types, one per
   * sub-part for a case study — and every unit gets an attempt row even if the
   * client omitted it, because a blank answer is an answer and a case study with
   * two of three parts filled in has still been attempted three times.
   */
  async submit(
    userId: string,
    sessionId: string,
    input: SubmitAttemptInput,
  ): Promise<AttemptOutcome> {
    const session = await loadSession(userId, sessionId);

    if (session.status !== "IN_PROGRESS") {
      // `loadSession` has already closed the session if its deadline passed, so
      // a timed-out set arrives here as COMPLETED. Saying so specifically is
      // worth the extra branch: "you have already finished this" is confusing
      // advice for a student who was mid-question when the clock stopped.
      throw new ConflictError(
        session.deadlineAt !== null && session.deadlineAt.getTime() <= Date.now()
          ? "Time is up on this set. Your answers so far have been saved and scored."
          : "This practice session has already been finished.",
      );
    }

    if (!session.questionIds.includes(input.questionId)) {
      // Indistinguishable from a question that does not exist, so the endpoint
      // cannot be used to probe what is in someone else's set.
      throw new NotFoundError("Question");
    }

    const question = await practiceRepository.findForGrading(input.questionId);
    if (!question) throw new NotFoundError("Question");

    const units = gradableUnitsOf(question);
    const unitIds = new Set(units.map((unit) => unit.id));

    const unknown = input.responses.filter((response) => !unitIds.has(response.targetId));
    if (unknown.length > 0) {
      throw new ValidationError(
        "Those answers do not belong to this question",
        unknown.map((response) => ({
          path: "body.responses",
          message: `${response.targetId} is not a part of this question`,
        })),
      );
    }

    const alreadyAnswered = await prisma.questionAttempt.findMany({
      where: { practiceSessionId: sessionId, questionId: { in: [...unitIds] } },
      select: { id: true },
    });

    if (alreadyAnswered.length > 0) {
      return this.itemOutcome(userId, sessionId, input.questionId);
    }

    const answers = new Map(
      input.responses.map((response) => [response.targetId, response.answer]),
    );
    const perUnitTime = shareTime(input.timeSpentMs, units.length);
    const at = new Date();

    await prisma.$transaction(async (tx) => {
      for (const [index, unit] of units.entries()) {
        const answer: StudentAnswer = answers.get(unit.id) ?? { optionIds: [], text: "" };
        const grade = gradeAnswer(toGradableUnit(unit), answer);

        await tx.questionAttempt.create({
          data: {
            userId,
            questionId: unit.id,
            questionVersion: unit.version,
            questionSnapshot: snapshotOf(unit),
            practiceSessionId: sessionId,
            answerJson: answer as unknown as Prisma.InputJsonValue,
            isCorrect: grade.isCorrect,
            marksAwarded: grade.marksAwarded,
            marksPossible: unit.marks,
            evaluationMode: grade.evaluationMode,
            timeSpentMs: perUnitTime[index] ?? 0,
            attemptedAt: at,
          },
        });

        // A `PENDING` attempt has no score yet, so there is nothing honest to
        // roll up. Its rollup happens when the student scores it.
        if (grade.evaluationMode === "AUTO" && grade.isCorrect !== null) {
          await applyFinalisedAttempt(tx, {
            userId,
            questionId: unit.id,
            subjectId: unit.subjectId,
            topicId: primaryTopicOf(unit, question),
            isCorrect: grade.isCorrect,
            marksAwarded: grade.marksAwarded,
            marksPossible: unit.marks,
            mistakeReason: null,
            at,
            fromReview: session.mode === "REVIEW_DUE",
            ...(session.mode === "REVIEW_DUE" ? { reviewSessionStartedAt: session.startedAt } : {}),
          });
        }
      }

      await recomputeTotals(tx, session);
    });

    return this.itemOutcome(userId, sessionId, input.questionId);
  },

  /**
   * The student's own score for a subjective answer, against the marking scheme.
   *
   * Allowed on a completed session as well as a live one: a student who ran out
   * of patience and hit Finish with three answers unscored should be able to
   * score them from the result page rather than lose them. Only `PENDING`
   * attempts accept a score, so this cannot be used to revise a grade — the
   * `ConflictError` is the difference between self-evaluation and self-marking.
   */
  async selfEvaluate(
    userId: string,
    sessionId: string,
    attemptId: string,
    input: SelfEvaluateInput,
  ): Promise<AttemptOutcome> {
    const session = await loadSession(userId, sessionId);
    const attempt = await practiceRepository.findAttemptForUpdate(attemptId, sessionId, userId);
    if (!attempt) throw new NotFoundError("Attempt");

    if (attempt.evaluationMode !== "PENDING") {
      throw new ConflictError("That answer has already been scored.");
    }

    const grade = selfEvaluatedGrade(input.marksAwarded, attempt.marksPossible);
    const attribution = await practiceRepository.findAttribution(attempt.questionId);
    const at = new Date();

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
          mistakeReason: attempt.mistakeReason,
          at,
          fromReview: session.mode === "REVIEW_DUE",
          ...(session.mode === "REVIEW_DUE" ? { reviewSessionStartedAt: session.startedAt } : {}),
        });
      }

      await recomputeTotals(tx, session);
    });

    return this.itemOutcome(userId, sessionId, await itemIdFor(attempt.questionId));
  },

  /**
   * "What went wrong?" — one tap, always skippable.
   *
   * Writes to the attempt *and* to the mistake record, because the two answer
   * different questions: the attempt says why this answer was wrong on this
   * evening, and the record says what keeps going wrong with this question. The
   * record is only touched while the mistake is open — annotating a repaired one
   * would rewrite a piece of history that is no longer true.
   */
  async setMistakeReason(
    userId: string,
    sessionId: string,
    attemptId: string,
    input: SetMistakeReasonInput,
  ): Promise<PracticeAttempt> {
    await loadSession(userId, sessionId);

    const attempt = await practiceRepository.findAttemptForUpdate(attemptId, sessionId, userId);
    if (!attempt) throw new NotFoundError("Attempt");

    if (attempt.isCorrect !== false) {
      // A reason describes a wrong, scored answer. Accepting one for a correct
      // or pending answer lets an optional annotation overwrite the reason on
      // an unrelated open mistake record for the same question.
      throw new ConflictError("A mistake reason can only be recorded for an incorrect answer.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.questionAttempt.update({
        where: { id: attempt.id },
        data: { mistakeReason: input.reason },
      });

      const record = await tx.mistakeRecord.findUnique({
        where: { userId_questionId: { userId, questionId: attempt.questionId } },
        select: {
          id: true,
          easeFactor: true,
          reviewCount: true,
          lastMissedAt: true,
          lastReviewedAt: true,
        },
      });

      // A late edit to an old attempt is still useful on that attempt, but it
      // must not rewrite the schedule created by a newer answer. The timestamp
      // check gives the current lapse one small, safe window to replace its
      // neutral schedule with the student's stated reason.
      if (
        record &&
        (record.lastReviewedAt?.getTime() === attempt.attemptedAt.getTime() ||
          record.lastMissedAt.getTime() === attempt.attemptedAt.getTime())
      ) {
        // The first miss starts a one-day schedule independent of a reason. A
        // later lapse has already received the neutral default schedule, so it
        // is the only case whose interval and ease need correcting here.
        const corrected =
          record.reviewCount > 0 && record.lastReviewedAt !== null
            ? correctLatestLapseSchedule(record.easeFactor, input.reason, attempt.attemptedAt)
            : null;

        await tx.mistakeRecord.update({
          where: { id: record.id },
          data: {
            lastReason: input.reason,
            ...(corrected === null
              ? {}
              : {
                  intervalDays: corrected.intervalDays,
                  easeFactor: corrected.easeFactor,
                  nextReviewAt: corrected.nextReviewAt,
                }),
          },
        });
      }
    });

    const keys = await practiceRepository.findKeys([attempt.questionId]);
    return toAttempt({ ...attempt, mistakeReason: input.reason }, keys);
  },

  /** Remember where the student had got to, so a reload resumes rather than restarts. */
  async setCurrentIndex(
    userId: string,
    sessionId: string,
    index: number,
  ): Promise<PracticeSession> {
    const session = await loadSession(userId, sessionId);

    // Clamped rather than rejected. The runner and the server can briefly
    // disagree about the length of a set — a question withdrawn by an editor
    // mid-session is exactly that case — and losing a student's place over it
    // would be a worse answer than putting them on the last item.
    const clamped = Math.min(Math.max(index, 0), Math.max(session.questionIds.length - 1, 0));
    if (clamped !== session.currentIndex) {
      await practiceRepository.updateCurrentIndex(session.id, clamped);
    }

    return hydrateSession({ ...session, currentIndex: clamped });
  },

  /**
   * Finish a session and return its result.
   *
   * Idempotent: finishing an already-finished session returns the same result
   * rather than erroring, because the one path that reaches it twice is a
   * student double-tapping Finish, and that is not a mistake worth a red box.
   */
  async complete(userId: string, sessionId: string): Promise<PracticeResult> {
    const session = await loadSession(userId, sessionId);

    // `loadSession` has already closed it if the clock ran out, so by here an
    // IN_PROGRESS session is one the student is choosing to finish.
    if (session.status === "IN_PROGRESS") {
      await closeSession(sessionId, userId, new Date());
    }

    return this.result(userId, sessionId);
  },

  async result(userId: string, sessionId: string): Promise<PracticeResult> {
    const session = await loadSession(userId, sessionId);
    const hydrated = await hydrateSession(session);

    const attempts = await practiceRepository.findAttempts(sessionId);
    const topics = await topicBreakdown(attempts);

    const mistakeQuestionIds = hydrated.items
      .filter((item) => item.attempts.some((attempt) => attempt.isCorrect === false))
      .map((item) => item.question.id);

    return {
      session: hydrated,
      topics,
      weakTopics: topics.filter(
        (topic) =>
          topic.attempted >= WEAK_TOPIC_MIN_ATTEMPTS &&
          topic.marksPossible > 0 &&
          topic.marksEarned / topic.marksPossible < WEAK_TOPIC_MARK_RATIO,
      ),
      mistakeQuestionIds,
    };
  },

  /** One item and the session's refreshed totals — what the runner redraws from. */
  async itemOutcome(
    userId: string,
    sessionId: string,
    questionId: string,
  ): Promise<AttemptOutcome> {
    const session = await hydrateSession(await loadSession(userId, sessionId));

    const item = session.items.find((candidate) => candidate.question.id === questionId);
    if (!item) throw new NotFoundError("Question");

    return { item, totals: session.totals };
  },
};

// ── Loading and shaping ──────────────────────────────────────────────────────

/**
 * The session, for its owner, with the clock already applied.
 *
 * ## Expiry is settled on read, not by a background job
 *
 * Every path into a session goes through here, so this is the one place that has
 * to notice the deadline has passed — and noticing it lazily, on the next touch,
 * is enough for practice in a way it would not be for an exam.
 *
 * The exam engine needs a sweeper (docs/04 §5) because an abandoned exam attempt
 * that is never touched again still has to be graded and reported, and a paper
 * left open at midnight must not be sittable at breakfast. A timed practice set
 * has neither obligation: nobody is waiting on its result, and the only way to
 * do anything with it is to come back to it, at which point this runs. Adding a
 * second sweeper for a set with no external observer would be a process to
 * maintain for no behaviour anyone could see.
 *
 * What is not lazy is the *refusal*. `submit` compares against the stored
 * deadline directly, so an answer sent thirty seconds late is rejected whether
 * or not anything has swept.
 */
export async function loadSession(userId: string, sessionId: string): Promise<SessionRow> {
  const session = await practiceRepository.findById(sessionId, userId);
  if (!session) throw new NotFoundError("Practice session");

  if (session.status !== "IN_PROGRESS") return session;
  if (session.deadlineAt === null || session.deadlineAt.getTime() > Date.now()) return session;

  // Closing recomputes nothing — the totals were already recomputed on every
  // answer — so a set that timed out with four of ten answered scores four of
  // ten rather than being abandoned unscored. The student earned those marks.
  await closeSession(session.id, session.userId, session.deadlineAt);

  // Re-read rather than patching the row in memory: the close is the
  // authoritative write and this is what it produced, whether this request made
  // it or a concurrent one did.
  const closed = await practiceRepository.findById(sessionId, userId);
  if (!closed) throw new NotFoundError("Practice session");
  return closed;
}

/**
 * Close a session, doing everything closing it means.
 *
 * Shared by the student pressing Finish and by the clock running out, and it is
 * shared rather than duplicated because the first version was not: the expiry
 * path wrote the status and stopped, so a set the student completed counted
 * towards `SubjectProgress.practiceSessions` and an identical set the clock
 * closed did not. A student who times out on three sets in a row would have
 * watched their session count sit still while their attempts went up.
 *
 * `at` is the deadline on the expiry path and now on the Finish path, which is
 * the one thing the two callers genuinely differ on — and the reason it is a
 * parameter rather than a `new Date()` in here.
 *
 * The `status` guard inside the transaction is what makes this safe to call from
 * a read path: two tabs loading an expired session at once produce one close and
 * one no-op, rather than two writes racing and the subject rollup counting the
 * session twice.
 */
async function closeSession(sessionId: string, userId: string, at: Date): Promise<void> {
  const subjectIds = await practiceRepository.findSessionSubjectIds(sessionId);

  await prisma.$transaction(async (tx) => {
    const closed = await tx.practiceSession.updateMany({
      where: { id: sessionId, status: "IN_PROGRESS" },
      data: { status: "COMPLETED", completedAt: at },
    });

    // Zero means another request got there first. Its transaction already did
    // this, and doing it again would double-count the session in the subject
    // rollup — a number nothing would ever correct.
    if (closed.count === 0) return;

    await countCompletedSession(tx, userId, subjectIds);
  });
}

/**
 * Turn a session row into everything the client needs to render it.
 *
 * The ordering step is not incidental: `findMany` with an `in` clause returns
 * rows in whatever order the plan produced, and a practice set's order is a
 * decision the selection service made deliberately. Re-imposing
 * `session.questionIds` here is what stops a page reload reshuffling the set.
 *
 * A question that has since been withdrawn simply drops out of `items` — the
 * visibility predicate is in the query, so it cannot come back as a half-visible
 * row. The set gets shorter and the totals still add up, which is a better
 * outcome than showing a student a question an editor has flagged as wrong.
 */
export async function hydrateSession(session: SessionRow): Promise<PracticeSession> {
  const [questions, attempts] = [
    await practiceRepository.findSessionQuestions(session.questionIds),
    await practiceRepository.findAttempts(session.id),
  ];

  const keys = await practiceRepository.findKeys(attempts.map((attempt) => attempt.questionId));
  const owners = await practiceRepository.findItemOwners(
    attempts.map((attempt) => attempt.questionId),
  );

  const byId = new Map<string, StudentQuestion>(
    questions.map((row) => [row.id, toStudentQuestion(row)]),
  );

  const attemptsByItem = new Map<string, AttemptRow[]>();
  for (const attempt of attempts) {
    const itemId = owners.get(attempt.questionId) ?? attempt.questionId;
    const bucket = attemptsByItem.get(itemId);
    if (bucket) bucket.push(attempt);
    else attemptsByItem.set(itemId, [attempt]);
  }

  const bookmarked = new Set(await bookmarkService.statesFor(session.userId, session.questionIds));

  const items: PracticeItem[] = [];
  for (const questionId of session.questionIds) {
    const question = byId.get(questionId);
    if (!question) continue;

    items.push({
      index: items.length,
      question,
      attempts: (attemptsByItem.get(questionId) ?? []).map((attempt) => toAttempt(attempt, keys)),
      bookmarked: bookmarked.has(questionId),
    });
  }

  const filters = readFilters(session);
  const focusFor = await buildFocusResolver([filters]);
  const pending = attempts.filter((attempt) => attempt.evaluationMode === "PENDING").length;

  return toSession(session, items, focusFor(filters), pending);
}

function toSession(
  session: SessionRow,
  items: PracticeItem[],
  focus: string | null,
  awaitingSelfEvaluation: number,
): PracticeSession {
  return {
    id: session.id,
    mode: session.mode,
    status: session.status,
    filters: readFilters(session),
    focus,
    currentIndex: session.currentIndex,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    serverNow: new Date().toISOString(),
    timeLimitSeconds: session.timeLimitSeconds,
    deadlineAt: session.deadlineAt?.toISOString() ?? null,
    // Derived rather than stored. A stored flag would be a third fact about the
    // same event — alongside the deadline and the completion time — and the one
    // most likely to be forgotten by a path that completes a session some other
    // way. Two timestamps and a comparison cannot drift.
    expired:
      session.deadlineAt !== null &&
      session.completedAt !== null &&
      session.completedAt.getTime() >= session.deadlineAt.getTime(),
    objective: session.objective,
    plannedQuestions: session.plannedQuestions,
    selections: readSelections(session),
    totals: {
      totalQuestions: session.totalQuestions,
      answered: session.answered,
      correct: session.correct,
      marksEarned: session.marksEarned,
      marksPossible: session.marksPossible,
      timeSpentMs: session.timeSpentMs,
      awaitingSelfEvaluation,
    },
    items,
  };
}

function toAttempt(attempt: AttemptRow, keys: Map<string, GradingKeyRow>): PracticeAttempt {
  return {
    id: attempt.id,
    targetId: attempt.questionId,
    answer: readAnswer(attempt.answerJson),
    isCorrect: attempt.isCorrect,
    marksAwarded: attempt.marksAwarded,
    marksPossible: attempt.marksPossible,
    evaluationMode: attempt.evaluationMode as EvaluationMode,
    mistakeReason: attempt.mistakeReason,
    timeSpentMs: attempt.timeSpentMs,
    attemptedAt: attempt.attemptedAt.toISOString(),
    key: toAnswerKey(keys.get(attempt.questionId)),
  };
}

/**
 * The answer key, as the student sees it once they have answered.
 *
 * `markingScheme` is JSONB and therefore `unknown` at the type level — it is
 * parsed rather than cast, and a malformed one degrades to null instead of
 * throwing. A step list that fails validation is a content defect, and the right
 * response to it is a solution shown without step marks, not a five-hundred on
 * the page a student is waiting for.
 */
function toAnswerKey(row: GradingKeyRow | undefined): QuestionAnswer | null {
  if (!row?.answer) return null;

  const parsedScheme = markingStepSchema.array().safeParse(row.answer.markingScheme);

  return {
    correctValue: row.answer.correctValue,
    acceptedValues: row.answer.acceptedValues,
    tolerance: row.answer.tolerance,
    unit: row.answer.unit,
    solution: row.answer.solution,
    explanation: row.answer.explanation,
    markingScheme: parsedScheme.success ? parsedScheme.data : null,
    correctOptionIds: row.options.filter((option) => option.isCorrect).map((option) => option.id),
  };
}

function readAnswer(value: Prisma.JsonValue | null): StudentAnswer {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return {
      optionIds: Array.isArray(record["optionIds"])
        ? record["optionIds"].filter((id): id is string => typeof id === "string")
        : [],
      text: typeof record["text"] === "string" ? record["text"] : "",
    };
  }

  return { optionIds: [], text: "" };
}

/** Filters come back out of JSONB, so they are parsed rather than trusted. */
function readFilters(session: Pick<SessionRow, "filtersJson">): PracticeFilters {
  const parsed = practiceFiltersSchema.safeParse(session.filtersJson);
  return parsed.success ? parsed.data : { unseenOnly: false };
}

export function readSelections(
  session: Pick<SessionRow, "selectionsJson">,
): Record<string, QuestionSelection> {
  const parsed = z.record(z.string(), questionSelectionSchema).safeParse(session.selectionsJson);
  return parsed.success ? parsed.data : {};
}

// ── Grading inputs ───────────────────────────────────────────────────────────

type GradableRow = GradingRow | GradingRow["subParts"][number];

/**
 * The units of a session item that actually get graded.
 *
 * A container has none of its own — its marks live entirely in its sub-parts,
 * exactly as the database models it (no `QuestionAnswer` row, a CHECK constraint
 * capping depth at one). This is the function that keeps "a case study is one
 * question with several graded parts" true everywhere downstream.
 */
function gradableUnitsOf(question: GradingRow): GradableRow[] {
  return question.isContainer ? question.subParts : [question];
}

function toGradableUnit(unit: GradableRow): GradableUnit {
  return {
    id: unit.id,
    type: unit.type,
    marks: unit.marks,
    options: unit.options.map((option) => ({
      id: option.id,
      label: option.label,
      isCorrect: option.isCorrect,
    })),
    answer: unit.answer
      ? {
          correctValue: unit.answer.correctValue,
          acceptedValues: unit.answer.acceptedValues,
          tolerance: unit.answer.tolerance,
          unit: unit.answer.unit,
        }
      : null,
  };
}

/**
 * What the student saw, frozen.
 *
 * Written on every attempt so that an editor correcting a published question
 * next month does not silently rewrite what happened tonight — every past
 * score, mistake and mastery figure derived from this attempt stays explainable
 * against the text that produced it (docs/03 §2.3).
 */
function snapshotOf(unit: GradableRow): Prisma.InputJsonValue {
  return {
    type: unit.type,
    body: unit.body,
    marks: unit.marks,
    version: unit.version,
    options: unit.options.map((option) => ({
      id: option.id,
      label: option.label,
      body: option.body,
      isCorrect: option.isCorrect,
    })),
    answer: unit.answer
      ? {
          correctValue: unit.answer.correctValue,
          acceptedValues: unit.answer.acceptedValues,
          tolerance: unit.answer.tolerance,
          unit: unit.answer.unit,
          solution: unit.answer.solution,
        }
      : null,
  };
}

/**
 * Which topic this unit's mastery is attributed to.
 *
 * A sub-part usually carries its own topics; when it does not, the container's
 * are the best available answer and are certainly better than dropping the
 * attempt out of mastery entirely. Only the primary topic counts — the schema
 * says so, and spreading one attempt across three tagged topics would inflate
 * every count a student sees by however thoroughly the question was tagged.
 */
function primaryTopicOf(unit: GradableRow, parent: GradingRow): string | null {
  const own = unit.topics.find((topic) => topic.isPrimary) ?? unit.topics[0];
  if (own) return own.topicId;

  const inherited = parent.topics.find((topic) => topic.isPrimary) ?? parent.topics[0];
  return inherited?.topicId ?? null;
}

/**
 * Split one reported duration across a case study's parts.
 *
 * Even, with the remainder on the first part. The client reports a single figure
 * for the whole item because that is the only thing it honestly knows — a
 * student reads the stimulus once and then moves between parts — so any
 * per-part number is an apportionment rather than a measurement. Recording the
 * whole duration against every part would triple a case study's contribution to
 * "minutes practised", which is the number this actually feeds.
 */
function shareTime(totalMs: number, parts: number): number[] {
  if (parts <= 0) return [];

  const base = Math.floor(totalMs / parts);
  const shares = Array.from({ length: parts }, () => base);
  shares[0] = (shares[0] ?? 0) + (totalMs - base * parts);
  return shares;
}

// ── Totals ───────────────────────────────────────────────────────────────────

/**
 * Recompute a session's counters from its attempts and write them back.
 *
 * Runs inside the caller's transaction so the counters and the attempts they
 * summarise can never be observed disagreeing.
 */
async function recomputeTotals(tx: Tx, session: SessionRow): Promise<void> {
  const attempts = await tx.questionAttempt.findMany({
    where: { practiceSessionId: session.id },
    select: { questionId: true, isCorrect: true, marksAwarded: true, timeSpentMs: true },
  });

  const owners = await tx.question.findMany({
    where: { id: { in: attempts.map((attempt) => attempt.questionId) } },
    select: { id: true, parentId: true },
  });

  const ownerById = new Map(owners.map((row) => [row.id, row.parentId ?? row.id]));

  const byItem = new Map<string, { correct: boolean }>();
  let marksEarned = 0;
  let timeSpentMs = 0;

  for (const attempt of attempts) {
    marksEarned += attempt.marksAwarded;
    timeSpentMs += attempt.timeSpentMs;

    const itemId = ownerById.get(attempt.questionId) ?? attempt.questionId;
    const item = byItem.get(itemId) ?? { correct: true };
    // An item is correct only if every graded part of it is. A pending part is
    // not yet correct, which is the honest reading while it waits to be scored —
    // and it flips to correct the moment the student scores it full marks.
    item.correct &&= attempt.isCorrect === true;
    byItem.set(itemId, item);
  }

  await tx.practiceSession.update({
    where: { id: session.id },
    data: {
      answered: byItem.size,
      correct: [...byItem.values()].filter((item) => item.correct).length,
      marksEarned,
      timeSpentMs,
    },
  });
}

async function countPendingBySession(sessionIds: string[]): Promise<Map<string, number>> {
  if (sessionIds.length === 0) return new Map();

  const rows = await prisma.questionAttempt.groupBy({
    by: ["practiceSessionId"],
    where: { practiceSessionId: { in: sessionIds }, evaluationMode: "PENDING" },
    _count: { _all: true },
  });

  return new Map(
    rows
      .filter((row): row is typeof row & { practiceSessionId: string } =>
        Boolean(row.practiceSessionId),
      )
      .map((row) => [row.practiceSessionId, row._count._all]),
  );
}

/** Marks the set is worth, summed over graded units rather than over items. */
export async function sumGradableMarks(questionIds: string[]): Promise<number> {
  const rows = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { marks: true, isContainer: true, subParts: { select: { marks: true } } },
  });

  return rows.reduce((total, row) => {
    if (!row.isContainer) return total + row.marks;
    return total + row.subParts.reduce((sum, part) => sum + part.marks, 0);
  }, 0);
}

// ── Result page ──────────────────────────────────────────────────────────────

/**
 * Per-topic performance within this one session.
 *
 * Deliberately computed from the session's own attempts rather than read from
 * `TopicMastery`. A result page answers "what just happened", and a lifetime
 * mastery figure on it would be actively misleading — a student who just went
 * 1-for-3 on Gauss's Law needs to see that, not a 74% built mostly out of
 * last month.
 */
async function topicBreakdown(attempts: AttemptRow[]): Promise<PracticeTopicResult[]> {
  if (attempts.length === 0) return [];

  const topics = await practiceRepository.findPrimaryTopics(
    attempts.map((attempt) => attempt.questionId),
  );

  const totals = new Map<string, PracticeTopicResult>();

  for (const attempt of attempts) {
    const topic = topics.get(attempt.questionId);
    if (!topic) continue;

    const row = totals.get(topic.id) ?? {
      topicId: topic.id,
      name: topic.name,
      chapterName: topic.chapterName,
      attempted: 0,
      correct: 0,
      marksEarned: 0,
      marksPossible: 0,
    };

    row.attempted += 1;
    row.correct += attempt.isCorrect === true ? 1 : 0;
    row.marksEarned += attempt.marksAwarded;
    row.marksPossible += attempt.marksPossible;
    totals.set(topic.id, row);
  }

  return [...totals.values()].sort(
    (left, right) =>
      left.marksEarned / Math.max(left.marksPossible, 1) -
      right.marksEarned / Math.max(right.marksPossible, 1),
  );
}

// ── The focus label ──────────────────────────────────────────────────────────

/**
 * "Electricity" / "Ohm's law" / "Science" — what a set was about, in one phrase.
 *
 * Resolved from the most specific filter present, and batched across however
 * many sessions are being labelled: the history list would otherwise issue three
 * queries per row, which is the classic N+1 that only shows up once a student
 * has a hundred sessions.
 */
async function buildFocusResolver(
  filtersList: PracticeFilters[],
): Promise<(filters: PracticeFilters) => string | null> {
  const topicIds = collect(filtersList, (filters) => filters.topicId);
  const chapterIds = collect(filtersList, (filters) => filters.chapterId);
  const subjectIds = collect(filtersList, (filters) => filters.subjectId);

  const topics = topicIds.length
    ? await prisma.topic.findMany({
        where: { id: { in: topicIds } },
        select: { id: true, name: true },
      })
    : [];
  const chapters = chapterIds.length
    ? await prisma.chapter.findMany({
        where: { id: { in: chapterIds } },
        select: { id: true, name: true },
      })
    : [];
  const subjects = subjectIds.length
    ? await prisma.subject.findMany({
        where: { id: { in: subjectIds } },
        select: { id: true, name: true },
      })
    : [];

  const names = new Map<string, string>([
    ...topics.map((row): [string, string] => [row.id, row.name]),
    ...chapters.map((row): [string, string] => [row.id, row.name]),
    ...subjects.map((row): [string, string] => [row.id, row.name]),
  ]);

  return (filters) => {
    for (const id of [filters.topicId, filters.chapterId, filters.subjectId]) {
      if (id && names.has(id)) return names.get(id) ?? null;
    }
    return null;
  };
}

function collect(
  filtersList: PracticeFilters[],
  pick: (filters: PracticeFilters) => string | undefined,
): string[] {
  return [...new Set(filtersList.map(pick).filter((id): id is string => Boolean(id)))];
}

/** The session item a graded unit belongs to — itself, or its container. */
async function itemIdFor(questionId: string): Promise<string> {
  const owners = await practiceRepository.findItemOwners([questionId]);
  return owners.get(questionId) ?? questionId;
}
