import {
  REVIEW_GRADUATION_STREAK,
  REVIEW_INTERVAL_LADDER,
  REVIEW_MIN_EASE,
} from "@samjho/contracts";

/**
 * When should this student see this question again?
 *
 * A pure function over the record's current schedule state and one outcome. It
 * touches no database, no clock beyond the instant handed to it, and no request
 * context — which is the entire point. The scheduling rules are the part of this
 * feature most likely to be argued about and tuned, and they are the part it
 * would be most painful to have to spin up Postgres to reason about. Everything
 * here is covered by `revision.scheduler.test.ts` in milliseconds.
 *
 * ## The algorithm, and where it departs from SM-2
 *
 * SuperMemo-2, with three deliberate changes, each for a product reason rather
 * than a memory-research one:
 *
 *  1. **No self-rated 0–5 quality grade.** SM-2 asks the learner to rate how
 *     well they recalled, and the rating drives everything. This product already
 *     has something better and already collects it: the answer was graded, and
 *     when it was wrong the student was asked *why* on a one-tap chip. A
 *     14-year-old rating their own recall on a six-point scale mid-practice is a
 *     tax that produces worse data than the grading we already did.
 *
 *  2. **The mistake reason substitutes for that grade.** It is genuinely more
 *     informative than a self-rating. A wrong answer the student attributes to a
 *     calculation slip is a different memory event from one they attribute to
 *     not knowing the concept — the first is nearly intact recall with a
 *     slipped step, the second is nothing there at all — and treating both as
 *     the same lapse would send a student who can do the physics back to square
 *     one over an arithmetic error. See `lapsePenalty`.
 *
 *  3. **A graduation.** SM-2 schedules forever, with intervals stretching into
 *     years. This product has a board exam in it, and a queue that never empties
 *     is a queue students stop opening. Four consecutive successes retires the
 *     question, and retiring it is the visible reward the schedule pays out.
 *
 * ## Why the interval is computed from the stored one, not from the dates
 *
 * A student who reviews four days late has not demonstrated a four-day memory —
 * they demonstrated a memory at least four days long, on a question scheduled
 * for one. Reading the gap off the timestamps would make every late review
 * inflate the next interval, and every early one shrink it, so that a student's
 * schedule was governed by when they happened to open the app. The stored
 * `intervalDays` is what was actually asked of them, and it is what the next
 * step is computed from.
 */

/** What the caller knows about the record before this attempt. */
export interface ScheduleState {
  intervalDays: number;
  easeFactor: number;
  reviewStreak: number;
  reviewCount: number;
}

/** What the caller learned from the attempt. */
export interface ReviewOutcome {
  correct: boolean;
  /**
   * The student's own account of a wrong answer, where they gave one.
   *
   * Null covers both "they got it right" and "they skipped the chips", and both
   * fall through to the default penalty — a skipped chip must never be read as a
   * claim about anything.
   */
  mistakeReason: string | null;
  at: Date;
}

export interface ScheduleDecision {
  intervalDays: number;
  easeFactor: number;
  reviewStreak: number;
  reviewCount: number;
  /** Null exactly when the record graduates. */
  nextReviewAt: Date | null;
  graduated: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How hard a lapse hits the ease factor, by the student's stated reason.
 *
 * These are judgements, not measurements, and they are written down here so that
 * they can be argued with in one place instead of being implied by a magic
 * number in the middle of a function.
 *
 *  - `CALCULATION_ERROR` / `MISREAD_QUESTION` — the recall worked and the
 *    execution did not. Barely touch the ease: sending a student who knows the
 *    method back to a one-day interval over a dropped minus sign teaches them
 *    that the queue does not understand what they did.
 *  - `RAN_OUT_OF_TIME` / `INCOMPLETE_ANSWER` — partial retrieval under pressure.
 *    Real, mild.
 *  - `CONCEPT_MISAPPLIED` — they retrieved something and it was the wrong
 *    something. The standard SM-2 lapse.
 *  - `CONCEPT_NOT_KNOWN` — nothing was there. The full penalty.
 *
 * An unrecognised or absent reason gets the standard penalty rather than the
 * gentlest one, so that a new enum value added upstream fails safe.
 */
const LAPSE_PENALTY: Record<string, number> = {
  CALCULATION_ERROR: 0.05,
  MISREAD_QUESTION: 0.05,
  RAN_OUT_OF_TIME: 0.1,
  INCOMPLETE_ANSWER: 0.12,
  CONCEPT_MISAPPLIED: 0.2,
  CONCEPT_NOT_KNOWN: 0.3,
};

const DEFAULT_LAPSE_PENALTY = 0.2;

/**
 * Interval a lapse falls back to, by reason.
 *
 * The same reasoning as the ease penalty, applied to the gap rather than the
 * growth rate. A slip keeps three days; a blank keeps one.
 */
const LAPSE_INTERVAL_DAYS: Record<string, number> = {
  CALCULATION_ERROR: 3,
  MISREAD_QUESTION: 3,
  RAN_OUT_OF_TIME: 2,
  INCOMPLETE_ANSWER: 2,
  CONCEPT_MISAPPLIED: 1,
  CONCEPT_NOT_KNOWN: 1,
};

const DEFAULT_LAPSE_INTERVAL_DAYS = 1;

function lapsePenalty(reason: string | null): number {
  return LAPSE_PENALTY[reason ?? ""] ?? DEFAULT_LAPSE_PENALTY;
}

function lapseIntervalDays(reason: string | null): number {
  return LAPSE_INTERVAL_DAYS[reason ?? ""] ?? DEFAULT_LAPSE_INTERVAL_DAYS;
}

/**
 * The schedule after one review.
 *
 * Note what this does *not* decide: whether the record is repaired, whether the
 * mistake count moves, or whether anything is written at all. Those belong to
 * the rollups, which own the transaction. This answers one question and returns.
 */
export function scheduleAfterReview(
  state: ScheduleState,
  outcome: ReviewOutcome,
): ScheduleDecision {
  const reviewCount = state.reviewCount + 1;

  if (!outcome.correct) {
    const penalty = lapsePenalty(outcome.mistakeReason);
    const intervalDays = lapseIntervalDays(outcome.mistakeReason);

    return {
      intervalDays,
      easeFactor: clampEase(state.easeFactor - penalty),
      // Zero, always. A lapse is a lapse however sympathetically its interval is
      // treated: the student must earn graduation again from the beginning,
      // because the streak is the only evidence that the memory is durable.
      reviewStreak: 0,
      reviewCount,
      nextReviewAt: addDays(outcome.at, intervalDays),
      graduated: false,
    };
  }

  const reviewStreak = state.reviewStreak + 1;

  if (reviewStreak >= REVIEW_GRADUATION_STREAK) {
    return {
      intervalDays: state.intervalDays,
      // Rewarded on the way out, so that a question re-missed months later —
      // which reopens the record — resumes from a schedule reflecting that this
      // student found it easy before.
      easeFactor: clampEase(state.easeFactor + 0.1),
      reviewStreak,
      reviewCount,
      nextReviewAt: null,
      graduated: true,
    };
  }

  // The ease factor used is the one *earned before* this success, not the one
  // this success just raised. Applying the bump first would let a single good
  // answer stretch its own next interval, which reads to a student as the queue
  // getting further away the better they do.
  const intervalDays = nextInterval(reviewStreak, state.easeFactor);

  return {
    intervalDays,
    easeFactor: clampEase(state.easeFactor + 0.1),
    reviewStreak,
    reviewCount,
    nextReviewAt: addDays(outcome.at, intervalDays),
    graduated: false,
  };
}

/**
 * Replace the default lapse schedule once the student has supplied a reason.
 *
 * A mistake reason is chosen after its answer has been graded, so the initial
 * transaction has to schedule it using the neutral penalty. The answer's
 * optional follow-up write then calls this function, but only while that answer
 * is still the record's latest review. The default penalty can be reversed
 * exactly above the ease floor; at the floor every supported penalty produces
 * the floor, so no lost precision can change the result.
 */
export function correctLatestLapseSchedule(
  easeFactorAfterDefault: number,
  mistakeReason: string | null,
  at: Date,
): Pick<ScheduleDecision, "intervalDays" | "easeFactor" | "nextReviewAt"> {
  const intervalDays = lapseIntervalDays(mistakeReason);
  const easeFactor =
    easeFactorAfterDefault <= REVIEW_MIN_EASE
      ? REVIEW_MIN_EASE
      : clampEase(easeFactorAfterDefault + DEFAULT_LAPSE_PENALTY - lapsePenalty(mistakeReason));

  return {
    intervalDays,
    easeFactor,
    nextReviewAt: addDays(at, intervalDays),
  };
}

/**
 * The schedule for a question just missed for the first time.
 *
 * Tomorrow, at the default ease. Separated from `scheduleAfterReview` because
 * the two are genuinely different events: this is a mistake being *opened*,
 * which has no prior state to reason from, and folding it in would mean
 * inventing a zero-valued state for the other function to consume.
 */
export function scheduleFirstReview(at: Date): ScheduleDecision {
  const intervalDays = REVIEW_INTERVAL_LADDER[0];

  return {
    intervalDays,
    easeFactor: 2.5,
    reviewStreak: 0,
    reviewCount: 0,
    nextReviewAt: addDays(at, intervalDays),
    graduated: false,
  };
}

/** The ease a question starts at, and the point where scaling is a no-op. */
const DEFAULT_EASE = 2.5;

/**
 * The gap after a successful review, in days.
 *
 * A rung of the ladder, scaled by how easy this student finds *this* question.
 * At the default ease the scaling is exactly 1 and the ladder is the schedule;
 * at the floor of 1.3 a seven-day rung becomes four, and a student who keeps
 * lapsing on one question meets it roughly twice as often as one who does not.
 *
 * ## Why this is a scaled ladder rather than SM-2's pure multiplication
 *
 * Two failed attempts got this wrong before it was written down, and the tests
 * caught both:
 *
 *  1. **Multiplying the stored interval was unreachable.** Graduation happens at
 *     four consecutive successes and the ladder has three rungs, so the streak
 *     is only ever 1, 2 or 3 when an interval is computed — the multiplicative
 *     branch could never run, and the ease factor was decorative.
 *  2. **It also multiplied by zero.** Every record the migration backfilled has
 *     `intervalDays` 0, and `0 × ease` is a review scheduled for today, then for
 *     today again tomorrow: a queue that cannot go down.
 *
 * Scaling the rung fixes both. The ease factor now does the job its name claims
 * — it changes how fast intervals grow — and no stored value is multiplied, so
 * there is nothing for a zero to poison.
 *
 * The `??` branch is a guard rather than a path: it is reachable only if
 * `REVIEW_GRADUATION_STREAK` is raised past the ladder's length, or if a stored
 * streak predates a change to these constants. It extends the last rung
 * geometrically, which is what SM-2 would have done from there.
 */
function nextInterval(streak: number, ease: number): number {
  const lastRung = REVIEW_INTERVAL_LADDER.at(-1) ?? 1;
  const rung =
    REVIEW_INTERVAL_LADDER[streak - 1] ??
    lastRung * Math.pow(ease, streak - REVIEW_INTERVAL_LADDER.length);

  return Math.max(1, Math.round(rung * (ease / DEFAULT_EASE)));
}

function clampEase(value: number): number {
  // The ceiling matters as much as the floor. An unbounded ease on a question a
  // student keeps getting right sends the next review past the board exam, which
  // is a correct answer to the wrong question — this schedule serves a fixed
  // deadline, not indefinite retention.
  return Math.min(3, Math.max(REVIEW_MIN_EASE, Number(value.toFixed(2))));
}

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS);
}
