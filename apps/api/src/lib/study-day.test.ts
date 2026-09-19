import { describe, expect, it } from "vitest";

import { currentStreak, istDay, longestStreak, shiftDay, toDayKey } from "./study-day.js";

/**
 * Streak arithmetic, which is the sort of thing that looks obviously right and
 * is off by one at a timezone boundary.
 *
 * The cases that matter are all boundary cases, and every one of them is a real
 * student: the one practising at 11pm, the one who has not started yet this
 * morning, the one who took Sunday off.
 */

describe("istDay", () => {
  it("keeps late-evening IST work on the day the student thinks it is", () => {
    // 23:30 IST on 5 September is 18:00 UTC on 5 September. Both agree here.
    const lateEvening = new Date("2026-09-05T18:00:00.000Z");
    expect(toDayKey(istDay(lateEvening))).toBe("2026-09-05");
  });

  it("does not roll the day over at UTC midnight", () => {
    // 00:30 UTC on 6 September is 06:00 IST on 6 September — same day either
    // way. The interesting one is the other side: 18:30 UTC on the 5th is
    // midnight IST, the first moment of the 6th in India.
    expect(toDayKey(istDay(new Date("2026-09-05T18:29:59.000Z")))).toBe("2026-09-05");
    expect(toDayKey(istDay(new Date("2026-09-05T18:30:00.000Z")))).toBe("2026-09-06");
  });

  it("credits an afternoon session to the current day, not the next one", () => {
    // 16:00 UTC is 21:30 IST — still the 5th in Delhi. A naive UTC truncation
    // agrees here, but the same student at 19:00 UTC (00:30 IST) has moved to
    // the 6th and a UTC truncation would still say the 5th.
    expect(toDayKey(istDay(new Date("2026-09-05T16:00:00.000Z")))).toBe("2026-09-05");
    expect(toDayKey(istDay(new Date("2026-09-05T19:00:00.000Z")))).toBe("2026-09-06");
  });
});

describe("currentStreak", () => {
  const today = istDay(new Date("2026-09-05T12:00:00.000Z"));

  it("counts consecutive days ending today", () => {
    const days = [today, shiftDay(today, 1), shiftDay(today, 2)];
    expect(currentStreak(days, today)).toBe(3);
  });

  it("does not break a streak just because today has not started yet", () => {
    // The single most important case in this file. A student who worked
    // yesterday and opens the app at 9am has a streak of one, not zero —
    // telling them otherwise before lunch would be both wrong and the most
    // demoralising thing this feature could do.
    const days = [shiftDay(today, 1), shiftDay(today, 2)];
    expect(currentStreak(days, today)).toBe(2);
  });

  it("ends the streak when a completed day passed with nothing in it", () => {
    const days = [shiftDay(today, 2), shiftDay(today, 3)];
    expect(currentStreak(days, today)).toBe(0);
  });

  it("is zero for a student who has never studied", () => {
    expect(currentStreak([], today)).toBe(0);
  });

  it("counts a first day as a streak of one", () => {
    expect(currentStreak([today], today)).toBe(1);
  });
});

describe("longestStreak", () => {
  const anchor = istDay(new Date("2026-09-05T12:00:00.000Z"));

  it("finds the longest run, not the most recent one", () => {
    const days = [
      // A run of four, a gap, then a run of two nearer to today.
      shiftDay(anchor, 10),
      shiftDay(anchor, 9),
      shiftDay(anchor, 8),
      shiftDay(anchor, 7),
      shiftDay(anchor, 1),
      anchor,
    ];

    expect(longestStreak(days)).toBe(4);
  });

  it("does not let a duplicated day inflate a run", () => {
    const days = [anchor, anchor, shiftDay(anchor, 1)];
    expect(longestStreak(days)).toBe(2);
  });

  it("is zero with no days", () => {
    expect(longestStreak([])).toBe(0);
  });
});
