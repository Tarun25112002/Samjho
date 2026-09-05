import type { PracticeSessionSummary, TargetExam } from "@samjho/contracts";

/**
 * The dashboard's arithmetic.
 *
 * ## Why the weekly view is derived rather than fetched
 *
 * The API exposes mastery rollups for the dedicated Progress page. This view
 * intentionally derives the last seven days from session summaries instead:
 * it answers an immediate history question, rather than reusing the
 * recency-weighted, cross-session score used for subject recommendations.
 *
 * "Sixty-two questions this week, forty-eight right" is true and checkable;
 * mastery is deliberately left to the rollup-backed surface that can speak
 * accurately about it.
 *
 * These functions are therefore a complementary view, not a temporary copy of
 * the progress endpoint.
 *
 * ## Days are Indian days
 *
 * A streak is counted in `Asia/Kolkata` rather than in the server's timezone.
 * Every student sits an Indian exam in an Indian time zone, and a server that
 * happens to run in UTC would otherwise end their day at half past five in the
 * afternoon — breaking a streak somebody kept.
 */

const TIME_ZONE = "Asia/Kolkata";

/** `2027-02-15`, in the student's own day, so keys sort and compare as strings. */
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function dayKey(date: Date): string {
  return dayKeyFormat.format(date);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export interface WeekTotals {
  sessions: number;
  answered: number;
  correct: number;
  marksEarned: number;
  marksPossible: number;
  /** Null rather than 0 when nothing has been answered — see `accuracy`. */
  accuracy: number | null;
}

/**
 * What the student has done in the last seven days.
 *
 * `accuracy` is null when nothing was answered, not zero. Zero per cent is a
 * claim about performance; a student who has not practised this week has not
 * performed badly, and a dashboard that greets them with "0% accuracy" is
 * telling them something false on the day they came back.
 */
export function weekTotals(sessions: PracticeSessionSummary[], now = new Date()): WeekTotals {
  const cutoff = addDays(now, -7).getTime();
  const recent = sessions.filter((session) => new Date(session.startedAt).getTime() >= cutoff);

  const totals = recent.reduce(
    (accumulator, session) => ({
      answered: accumulator.answered + session.totals.answered,
      correct: accumulator.correct + session.totals.correct,
      marksEarned: accumulator.marksEarned + session.totals.marksEarned,
      marksPossible: accumulator.marksPossible + session.totals.marksPossible,
    }),
    { answered: 0, correct: 0, marksEarned: 0, marksPossible: 0 },
  );

  return {
    sessions: recent.length,
    ...totals,
    accuracy: totals.answered === 0 ? null : Math.round((totals.correct / totals.answered) * 100),
  };
}

/**
 * Consecutive days ending today, or ending yesterday.
 *
 * Yesterday counts because the day is not over. A streak that resets at midnight
 * punishes a student for not having practised yet at nine in the morning, which
 * is the opposite of what the number is for.
 */
export function streakDays(sessions: PracticeSessionSummary[], now = new Date()): number {
  const active = new Set(sessions.map((session) => dayKey(new Date(session.startedAt))));
  if (active.size === 0) return 0;

  const today = dayKey(now);
  const yesterday = dayKey(addDays(now, -1));

  // Anchor on whichever of the two the student actually practised. Neither means
  // the streak is over, whatever they did the day before that.
  let cursor = active.has(today) ? now : active.has(yesterday) ? addDays(now, -1) : null;
  if (cursor === null) return 0;

  let days = 0;
  while (active.has(dayKey(cursor))) {
    days += 1;
    cursor = addDays(cursor, -1);
  }
  return days;
}

export interface ActivityDay {
  key: string;
  /** "M", "T", "W" — the initial, for the strip's own label. */
  initial: string;
  /** Full weekday plus date, for the screen-reader label and the tooltip. */
  label: string;
  /** Compact weekday/date label for the chart axis, e.g. "Fri 5". */
  shortLabel: string;
  answered: number;
  /** Correct answers on the day — shares the same scale as `answered`. */
  correct: number;
  isToday: boolean;
}

const weekdayFormat = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, weekday: "short" });
const longDayFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "short",
});
const shortDayFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "numeric",
});

/** The last seven days, oldest first, with how much was answered on each. */
export function activityStrip(sessions: PracticeSessionSummary[], now = new Date()): ActivityDay[] {
  const totalsByDay = new Map<string, { answered: number; correct: number }>();
  for (const session of sessions) {
    const key = dayKey(new Date(session.startedAt));
    const current = totalsByDay.get(key) ?? { answered: 0, correct: 0 };
    totalsByDay.set(key, {
      answered: current.answered + session.totals.answered,
      correct: current.correct + session.totals.correct,
    });
  }

  const today = dayKey(now);

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(now, index - 6);
    const key = dayKey(date);
    const totals = totalsByDay.get(key) ?? { answered: 0, correct: 0 };
    return {
      key,
      initial: weekdayFormat.format(date).slice(0, 1),
      label: longDayFormat.format(date),
      shortLabel: shortDayFormat.format(date),
      answered: totals.answered,
      correct: totals.correct,
      isToday: key === today,
    };
  });
}

export interface ExamCountdown {
  /** Null when the target has no date on it — the session is still useful. */
  daysRemaining: number | null;
  /** "February 2027". */
  when: string;
}

/**
 * How long until the paper.
 *
 * The single most emotionally live fact in this product, so it is stated plainly
 * and without decoration — no ring, no progress bar around the year. `examDate`
 * is nullable because CBSE publishes the date sheet a few months out, and until
 * they do, the honest answer is the month.
 */
export function examCountdown(target: TargetExam | null, now = new Date()): ExamCountdown | null {
  if (target === null) return null;

  const month = target.phase === "PHASE_1" ? "February" : "May";
  const when = `${month} ${target.session}`;

  if (target.examDate === null) return { daysRemaining: null, when };

  // Whole days between two `Asia/Kolkata` calendar dates, so a paper at 10:30
  // tomorrow morning reads as "1 day" rather than "0".
  const from = Date.parse(`${dayKey(now)}T00:00:00Z`);
  const to = Date.parse(`${dayKey(new Date(target.examDate))}T00:00:00Z`);
  const days = Math.round((to - from) / 86_400_000);

  return { daysRemaining: days >= 0 ? days : null, when };
}
