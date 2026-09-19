import { z } from "zod";

import { subjectSummarySchema } from "../catalog/subject.schema.js";

/**
 * The revision queue — spaced repetition over the student's own mistakes.
 *
 * ## What this feature is, stated precisely
 *
 * `docs/00` §1 says the product exists to close one loop: get it wrong,
 * understand why, re-practise *that*. Phases 5 through 8 built the first two
 * legs. The third leg was left half-built on purpose — `MistakeRecord` carried a
 * `nextReviewAt` column and a comment saying nothing scheduled yet — and this is
 * what schedules.
 *
 * Without it "re-practise that" means the student choosing to, which is exactly
 * the moment the loop breaks. A student who has just been shown why they were
 * wrong feels finished. They are not: they will have lost most of it inside a
 * week, and the only intervention with strong evidence behind it is meeting the
 * same material again at a widening gap. The queue is that intervention, and its
 * job is to make the decision for them so that willpower is not the input.
 *
 * ## The design constraint that shapes every field below
 *
 * **The queue must be finishable.** A student who opens it and sees "412 due"
 * does not do 412; they close it and do not come back. So:
 *
 *  - `dueToday` is capped before it reaches the student (`REVIEW_DAILY_CAP`),
 *    and `dueTotal` is reported separately and honestly rather than hidden.
 *  - A session drawn from the queue has an end, and finishing it empties
 *    something visible.
 *  - Graduated records leave permanently. A queue that only grows is a queue
 *    that gets abandoned, and "you have finally finished with this question" is
 *    the reward the whole schedule is paying out.
 */

// ── The schedule's constants ─────────────────────────────────────────────────

/**
 * The interval ladder, in days, before ease-factor scaling.
 *
 * Standard SM-2 opens 1 / 6; this opens 1 / 3 / 7 and then multiplies. The
 * compression at the start is deliberate and is about this product's calendar
 * rather than about memory research: a Class 10 student meets this material
 * inside a fixed board-exam runway, and a six-day second look spends a
 * disproportionate share of a short window on a single lapse. After the third
 * step the ladder hands over to `easeFactor` and grows the ordinary way.
 */
export const REVIEW_INTERVAL_LADDER = [1, 3, 7] as const;

/**
 * Successful reviews needed to retire a question for good.
 *
 * Four, which is roughly a month of widening gaps. Three graduates questions a
 * student has merely remembered for a fortnight; six turns the queue into
 * something that never empties, and an unfinishable queue is an unused one.
 */
export const REVIEW_GRADUATION_STREAK = 4;

/**
 * The most questions the queue will put in front of a student in one day.
 *
 * Not a limit on what is *due* — `dueTotal` reports that in full. A limit on
 * what is *shown*, because the alternative on any real backlog is a number the
 * student reads as a verdict on themselves. Twenty is roughly half an hour of
 * Class 10 work, which is the session this product's dashboard is built around.
 */
export const REVIEW_DAILY_CAP = 20;

/** Lower bound on the ease factor. See the schema comment on the column. */
export const REVIEW_MIN_EASE = 1.3;

// ── Reading the queue ────────────────────────────────────────────────────────

export const revisionSubjectDueSchema = z.object({
  subject: subjectSummarySchema,
  due: z.int().nonnegative(),
  /** Scheduled, not yet due — the week ahead, for "what is coming". */
  upcoming: z.int().nonnegative(),
});

export type RevisionSubjectDue = z.infer<typeof revisionSubjectDueSchema>;

/**
 * One day of history for the activity strip.
 *
 * `date` is a plain `YYYY-MM-DD` in IST rather than an instant. A streak is a
 * property of calendar days, and serialising a calendar day as a UTC timestamp
 * is how a student in Delhi loses a day to a timezone conversion in the browser.
 */
export const studyDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attempts: z.int().nonnegative(),
  correct: z.int().nonnegative(),
  reviews: z.int().nonnegative(),
});

export type StudyDaySummary = z.infer<typeof studyDaySchema>;

export const studyStreakSchema = z.object({
  /**
   * Consecutive days up to and including today.
   *
   * A day with no work yet does not break the streak until it ends — someone
   * opening the app at 9am has not failed, they have not started. So today is
   * counted as a continuation when it is empty, and only a fully empty
   * *yesterday* ends the run.
   */
  current: z.int().nonnegative(),
  longest: z.int().nonnegative(),
  /** Whether the student has done anything today. Drives the nudge copy. */
  studiedToday: z.boolean(),
  /** Most recent first, at most a year. */
  recent: z.array(studyDaySchema),
});

export type StudyStreak = z.infer<typeof studyStreakSchema>;

export const revisionQueueSchema = z.object({
  /**
   * How many the student will be shown today — `dueTotal` capped at
   * `REVIEW_DAILY_CAP`. This is the number the button counts.
   */
  dueToday: z.int().nonnegative(),
  /**
   * Everything the schedule says is owed, uncapped.
   *
   * Reported even when it is large and discouraging, because the alternative is
   * a queue that says "12 due" for eleven days running while the backlog grows
   * behind it. A student clearing twenty a day against a backlog of two hundred
   * deserves to see the backlog fall.
   */
  dueTotal: z.int().nonnegative(),
  /** Scheduled within the next seven days but not yet due. */
  dueThisWeek: z.int().nonnegative(),
  /** Records that have graduated — the pile that means the loop closed. */
  graduated: z.int().nonnegative(),
  /**
   * Still unrepaired and *not* scheduled, which after this feature ships should
   * only ever be zero. Surfaced rather than assumed: it is the one number that
   * would catch a scheduling path that silently stopped writing.
   */
  unscheduled: z.int().nonnegative(),
  /** When the next question falls due, if none is due now. */
  nextDueAt: z.iso.datetime().nullable(),
  bySubject: z.array(revisionSubjectDueSchema),
  streak: studyStreakSchema,
  /** Reviews cleared today, for "8 of 20 done". */
  reviewedToday: z.int().nonnegative(),
});

export type RevisionQueue = z.infer<typeof revisionQueueSchema>;

// ── Starting a review ────────────────────────────────────────────────────────

export const startRevisionSchema = z.object({
  /** Narrow to one subject. Omitted means everything due, oldest debt first. */
  subjectId: z.string().min(1).max(60).optional(),
  count: z.int().min(1).max(REVIEW_DAILY_CAP).default(REVIEW_DAILY_CAP),
  /**
   * Sit the review against a clock.
   *
   * Off by default and deliberately so. Timing a review changes what it
   * measures: retrieval under time pressure is a different skill from retrieval,
   * and a student rebuilding a shaky topic should be allowed to think. It is
   * offered because rehearsing pace is also a real goal, but it is the student's
   * choice rather than the schedule's.
   */
  timeLimitMinutes: z.int().min(5).max(180).optional(),
});

export type StartRevisionInput = z.infer<typeof startRevisionSchema>;
