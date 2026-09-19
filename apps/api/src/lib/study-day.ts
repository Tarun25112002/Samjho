/**
 * Calendar days, in the only timezone this product has.
 *
 * ## Why this file exists rather than `toISOString().slice(0, 10)`
 *
 * A study streak is a claim about days, and a day is a local idea. Every user of
 * this platform is a CBSE student in India sitting an Indian board exam, so the
 * calendar that governs their streak is IST — and IST is UTC+5:30, which puts
 * UTC midnight at half past five in the *afternoon* local time.
 *
 * Truncating a UTC timestamp would therefore roll the day over during the school
 * run. A student who practised at 6pm and again at 9pm on the same evening would
 * be credited with two days; one who practised at 4pm Monday and 4pm Tuesday
 * would be credited with one. Both are wrong, the first flatters and the second
 * punishes, and the second is the one that breaks a streak someone earned.
 *
 * The offset is a constant rather than a lookup because India has a single
 * timezone and observes no daylight saving. If this product ever serves a second
 * country, the constant becomes a column on the profile and this file becomes
 * the one place that has to change — which is the other reason it is a file.
 */

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The IST calendar day containing `instant`, as a UTC-midnight `Date`.
 *
 * Postgres `DATE` columns carry no timezone, and Prisma reads and writes them as
 * UTC midnight. Returning that shape means the value round-trips through the
 * database unchanged — anything else and a day written as the 5th comes back as
 * the 4th on one side of the offset.
 */
export function istDay(instant: Date): Date {
  const shifted = instant.getTime() + IST_OFFSET_MS;
  return new Date(Math.floor(shifted / DAY_MS) * DAY_MS);
}

/** `YYYY-MM-DD` for the wire, from a day produced by `istDay`. */
export function toDayKey(day: Date): string {
  return day.toISOString().slice(0, 10);
}

/** The IST day `days` before `day`. Negative values move forward. */
export function shiftDay(day: Date, days: number): Date {
  return new Date(day.getTime() - days * DAY_MS);
}

/**
 * Consecutive days of activity ending today, given the days that had any.
 *
 * `days` may arrive in any order and may contain days in the future; both are
 * handled by working from a set rather than by trusting the sequence.
 *
 * **Today counts as a continuation when it is empty.** Someone opening the app
 * at 9am has not broken a streak, they have not started yet, and showing them
 * "streak: 0" before lunch would be both wrong and the single most demoralising
 * thing this feature could do. So the walk begins at today if today has
 * activity, and at yesterday if it does not — and a streak only actually ends
 * when a *completed* day passed with nothing in it.
 */
export function currentStreak(days: Iterable<Date>, today: Date): number {
  const present = new Set<number>();
  for (const day of days) present.add(day.getTime());

  let cursor = present.has(today.getTime()) ? today : shiftDay(today, 1);
  let streak = 0;

  while (present.has(cursor.getTime())) {
    streak += 1;
    cursor = shiftDay(cursor, 1);
  }

  return streak;
}

/** The longest run of consecutive days in the set. */
export function longestStreak(days: Iterable<Date>): number {
  const sorted = [...days].map((day) => day.getTime()).sort((left, right) => left - right);

  let longest = 0;
  let run = 0;
  let previous: number | null = null;

  for (const time of sorted) {
    // Duplicates would otherwise each extend the run. They should not occur —
    // `(userId, day)` is unique — but this function is also handed sets built in
    // memory, and a defensive equality check is cheaper than the bug.
    if (previous !== null && time === previous) continue;
    run = previous !== null && time - previous === DAY_MS ? run + 1 : 1;
    previous = time;
    if (run > longest) longest = run;
  }

  return longest;
}
