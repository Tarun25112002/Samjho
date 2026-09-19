import { REVIEW_GRADUATION_STREAK, REVIEW_MIN_EASE } from "@medhavi/contracts";
import { describe, expect, it } from "vitest";

import {
  correctLatestLapseSchedule,
  scheduleAfterReview,
  scheduleFirstReview,
} from "./revision.scheduler.js";

/**
 * The scheduler is a pure function, so these are pure tests: no database, no
 * clock, no fixtures. That is the payoff for keeping the rules out of the
 * rollups — the behaviour most likely to be tuned is the behaviour cheapest to
 * pin down, and every case below runs in microseconds.
 *
 * What is asserted here is *behaviour a student would notice*, not arithmetic.
 * "A calculation slip does not send them back to square one" is a product
 * promise; `easeFactor === 2.45` is an implementation detail that happens to
 * express it, and a test written against the second one breaks every time the
 * first is retuned without ever having checked it.
 */

const AT = new Date("2026-09-05T10:00:00.000Z");
const FRESH = { intervalDays: 0, easeFactor: 2.5, reviewStreak: 0, reviewCount: 0 };

/** Whole days between two instants. The schedule works in days; so do these. */
function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

describe("scheduleFirstReview", () => {
  it("brings a newly missed question back tomorrow", () => {
    const decision = scheduleFirstReview(AT);

    expect(decision.nextReviewAt).not.toBeNull();
    expect(daysBetween(AT, decision.nextReviewAt as Date)).toBe(1);
    expect(decision.graduated).toBe(false);
    expect(decision.reviewStreak).toBe(0);
  });
});

describe("scheduleAfterReview — successes", () => {
  it("widens the gap on every success, roughly a day then three then a week", () => {
    const intervals: number[] = [];
    let state = FRESH;

    for (let review = 0; review < 3; review += 1) {
      const decision = scheduleAfterReview(state, {
        correct: true,
        mistakeReason: null,
        at: AT,
      });
      intervals.push(decision.intervalDays);
      state = {
        intervalDays: decision.intervalDays,
        easeFactor: decision.easeFactor,
        reviewStreak: decision.reviewStreak,
        reviewCount: decision.reviewCount,
      };
    }

    // Asserted as a shape, not as `[1, 3, 7]`. Each success also nudges the ease
    // factor up, so a student with a perfect run earns slightly *more* than the
    // bare ladder — the third gap comes out at eight days rather than seven.
    // Pinning the exact figures would make this test fail on a tuning change it
    // was never checking.
    expect(intervals[0]).toBe(1);
    expect(intervals[1]).toBeGreaterThanOrEqual(3);
    expect(intervals[2]).toBeGreaterThanOrEqual(7);
    expect(intervals[0]).toBeLessThan(intervals[1] as number);
    expect(intervals[1]).toBeLessThan(intervals[2] as number);
  });

  it("graduates on the fourth consecutive success and stops scheduling", () => {
    const decision = scheduleAfterReview(
      {
        intervalDays: 7,
        easeFactor: 2.6,
        reviewStreak: REVIEW_GRADUATION_STREAK - 1,
        reviewCount: 3,
      },
      { correct: true, mistakeReason: null, at: AT },
    );

    expect(decision.graduated).toBe(true);
    // The whole point of graduating: it leaves the queue. A graduated record
    // with a date on it would come back forever and the queue would never empty.
    expect(decision.nextReviewAt).toBeNull();
  });

  it("restarts the ladder after a lapse rather than resuming a long interval", () => {
    // A record that had reached a seven-day gap and then lapsed: streak back to
    // zero, interval still recording what it had climbed to. The next success
    // must relearn from the bottom rung, not jump back to where it was.
    const decision = scheduleAfterReview(
      { intervalDays: 7, easeFactor: 2.5, reviewStreak: 0, reviewCount: 6 },
      { correct: true, mistakeReason: null, at: AT },
    );

    expect(decision.intervalDays).toBe(1);
  });

  it("shortens intervals for a question this student keeps finding hard", () => {
    const easy = scheduleAfterReview(
      { intervalDays: 3, easeFactor: 2.5, reviewStreak: 2, reviewCount: 3 },
      { correct: true, mistakeReason: null, at: AT },
    );
    const hard = scheduleAfterReview(
      // Same rung of the ladder, ease driven down by repeated lapses.
      { intervalDays: 3, easeFactor: 1.3, reviewStreak: 2, reviewCount: 9 },
      { correct: true, mistakeReason: null, at: AT },
    );

    // This is what the ease factor is *for*. Before the scaling was introduced
    // it changed nothing about any interval, because graduation at four
    // successes meant the ease-driven branch could never be reached.
    expect(hard.intervalDays).toBeLessThan(easy.intervalDays);
  });

  it("never schedules a review for today, even from a backfilled zero interval", () => {
    // Every record the migration backfilled has intervalDays 0. An earlier
    // version multiplied that stored value by the ease factor, so 0 × 2.5 = 0
    // scheduled the review for now — and for now again after the next one. A
    // queue that cannot go down.
    const decision = scheduleAfterReview(
      { intervalDays: 0, easeFactor: 2.5, reviewStreak: 0, reviewCount: 0 },
      { correct: true, mistakeReason: null, at: AT },
    );

    expect(decision.intervalDays).toBeGreaterThanOrEqual(1);
    expect(decision.nextReviewAt).not.toBeNull();
    expect((decision.nextReviewAt as Date).getTime()).toBeGreaterThan(AT.getTime());
  });
});

describe("scheduleAfterReview — lapses", () => {
  it("resets the streak however gentle the reason", () => {
    const decision = scheduleAfterReview(
      { intervalDays: 7, easeFactor: 2.5, reviewStreak: 3, reviewCount: 3 },
      { correct: false, mistakeReason: "CALCULATION_ERROR", at: AT },
    );

    // The interval is treated sympathetically; the streak is not. Graduation has
    // to be re-earned from zero, because the streak is the only evidence that
    // the memory is durable.
    expect(decision.reviewStreak).toBe(0);
    expect(decision.graduated).toBe(false);
  });

  it("treats a calculation slip more gently than a blank", () => {
    const slip = scheduleAfterReview(FRESH, {
      correct: false,
      mistakeReason: "CALCULATION_ERROR",
      at: AT,
    });
    const blank = scheduleAfterReview(FRESH, {
      correct: false,
      mistakeReason: "CONCEPT_NOT_KNOWN",
      at: AT,
    });

    // The promise: a student who can do the physics and dropped a minus sign is
    // not sent back to square one alongside a student who had nothing.
    expect(slip.intervalDays).toBeGreaterThan(blank.intervalDays);
    expect(slip.easeFactor).toBeGreaterThan(blank.easeFactor);
  });

  it("applies the standard penalty when the student skipped the reason chips", () => {
    const skipped = scheduleAfterReview(FRESH, {
      correct: false,
      mistakeReason: null,
      at: AT,
    });
    const gentlest = scheduleAfterReview(FRESH, {
      correct: false,
      mistakeReason: "CALCULATION_ERROR",
      at: AT,
    });

    // Skipping is not a claim. Reading it as the gentlest case would make "say
    // nothing" the optimal move, which is the one thing a self-reported field
    // must never reward.
    expect(skipped.easeFactor).toBeLessThan(gentlest.easeFactor);
  });

  it("can replace the neutral lapse schedule when a reason is chosen after grading", () => {
    const neutral = scheduleAfterReview(FRESH, {
      correct: false,
      mistakeReason: null,
      at: AT,
    });
    const corrected = correctLatestLapseSchedule(neutral.easeFactor, "CALCULATION_ERROR", AT);
    const statedAtGrading = scheduleAfterReview(FRESH, {
      correct: false,
      mistakeReason: "CALCULATION_ERROR",
      at: AT,
    });

    // The feedback chip is deliberately after the answer. Its timing must not
    // make a calculation slip behave differently from one supplied up front.
    expect(corrected.intervalDays).toBe(statedAtGrading.intervalDays);
    expect(corrected.easeFactor).toBe(statedAtGrading.easeFactor);
    expect(corrected.nextReviewAt).toEqual(statedAtGrading.nextReviewAt);
  });

  it("applies the standard penalty to a reason it does not recognise", () => {
    // Fails safe: a new MistakeReason added upstream lands on the standard
    // penalty rather than the gentlest one.
    const unknown = scheduleAfterReview(FRESH, {
      correct: false,
      mistakeReason: "SOMETHING_ADDED_LATER",
      at: AT,
    });
    const standard = scheduleAfterReview(FRESH, {
      correct: false,
      mistakeReason: "CONCEPT_MISAPPLIED",
      at: AT,
    });

    expect(unknown.easeFactor).toBe(standard.easeFactor);
    expect(unknown.intervalDays).toBe(standard.intervalDays);
  });

  it("floors the ease factor however many times a question is missed", () => {
    let state = FRESH;

    for (let lapse = 0; lapse < 30; lapse += 1) {
      const decision = scheduleAfterReview(state, {
        correct: false,
        mistakeReason: "CONCEPT_NOT_KNOWN",
        at: AT,
      });
      state = {
        intervalDays: decision.intervalDays,
        easeFactor: decision.easeFactor,
        reviewStreak: decision.reviewStreak,
        reviewCount: decision.reviewCount,
      };
    }

    // Without a floor, a question a student keeps failing returns every few
    // hours and crowds out everything else — which is how a review queue gets
    // abandoned rather than cleared.
    expect(state.easeFactor).toBe(REVIEW_MIN_EASE);
  });

  it("caps the ease factor so a review is never scheduled past the exam", () => {
    let state = { intervalDays: 7, easeFactor: 2.5, reviewStreak: 0, reviewCount: 8 };

    for (let success = 0; success < 40; success += 1) {
      const decision = scheduleAfterReview(state, {
        correct: true,
        mistakeReason: null,
        at: AT,
      });
      state = {
        intervalDays: decision.intervalDays,
        // Graduation would end the run, so the streak is held down: this is
        // testing the ease ceiling, not the graduation path.
        easeFactor: decision.easeFactor,
        reviewStreak: 0,
        reviewCount: decision.reviewCount,
      };
    }

    expect(state.easeFactor).toBeLessThanOrEqual(3);
  });
});

describe("the schedule is driven by the stored interval, not the calendar", () => {
  it("gives the same next interval whether the review was on time or late", () => {
    const state = { intervalDays: 7, easeFactor: 2.5, reviewStreak: 0, reviewCount: 5 };

    const onTime = scheduleAfterReview(state, { correct: true, mistakeReason: null, at: AT });
    const threeWeeksLate = scheduleAfterReview(state, {
      correct: true,
      mistakeReason: null,
      at: new Date(AT.getTime() + 21 * 24 * 60 * 60 * 1000),
    });

    // A student who reviews late demonstrated a memory at least that long on a
    // question scheduled for seven days. Reading the gap off the timestamps
    // would let the calendar govern the schedule: every late review inflating
    // the next interval, every early one shrinking it.
    expect(threeWeeksLate.intervalDays).toBe(onTime.intervalDays);
  });
});
