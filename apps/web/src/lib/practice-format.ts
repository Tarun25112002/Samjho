import type { PracticeFilters } from "@samjho/contracts";

/**
 * Pure presentation helpers for practice.
 *
 * Separate from `lib/practice.ts`, and the separation is load-bearing rather
 * than tidy-minded. That module reaches Clerk's `auth()` to attach a token, so
 * it is server-only — and the runner, the feedback panel and the review are all
 * Client Components that need to print marks. Importing one function from a
 * server-only module drags the whole module into the browser bundle, which
 * Next refuses to build. It refused, which is how this file came to exist.
 *
 * Everything here is a pure function of its arguments: no fetching, no session,
 * nothing that could only work on one side of the boundary.
 */

/**
 * Turn filters into the query string `/practice/new` reads back.
 *
 * The setup page is deep-linkable by design (docs/01 §3), which is what makes
 * every "Practise this chapter" button in the app a plain `<Link>` rather than a
 * handler that POSTs. One function builds those links so a chapter page and a
 * weak-topic card cannot spell the same filter two ways.
 */
export function practiceHref(filters: PracticeFilters & { mode?: string; count?: number }): string {
  const params = new URLSearchParams();

  if (filters.mode) params.set("mode", filters.mode);
  if (filters.subjectId) params.set("subjectId", filters.subjectId);
  if (filters.chapterId) params.set("chapterId", filters.chapterId);
  if (filters.topicId) params.set("topicId", filters.topicId);
  if (filters.types?.length) params.set("types", filters.types.join(","));
  if (filters.difficulties?.length) params.set("difficulties", filters.difficulties.join(","));
  if (filters.marks !== undefined) params.set("marks", String(filters.marks));
  if (filters.unseenOnly) params.set("unseenOnly", "true");
  if (filters.count !== undefined) params.set("count", String(filters.count));

  const query = params.toString();
  return query ? `/practice/new?${query}` : "/practice/new";
}

/** "18 / 24 marks · 7 of 10 right" — the one line every summary card shows. */
export function describeScore(totals: {
  correct: number;
  answered: number;
  marksEarned: number;
  marksPossible: number;
}): string {
  return `${formatMarksValue(totals.marksEarned)} / ${formatMarksValue(totals.marksPossible)} marks · ${String(totals.correct)} of ${String(totals.answered)} right`;
}

/**
 * Marks print as integers unless they genuinely are not.
 *
 * Self-evaluation could produce a fractional total once half marks exist, so
 * `2.5` has to survive; `3.0` must not appear anywhere a student reads, because
 * CBSE papers do not write it that way and it makes a whole number look like a
 * rounding artefact.
 */
export function formatMarksValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** "14 min" / "45s" — a duration a student reads, not a duration a clock shows. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${String(totalSeconds)}s`;

  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${String(minutes)} min`;

  const hours = Math.floor(minutes / 60);
  return `${String(hours)}h ${String(minutes % 60)}m`;
}

/**
 * Which options were right, keyed by target id, ready for `QuestionRenderer`.
 *
 * The renderer cannot know this on its own — a `StudentQuestion` has no answer
 * property, by design, so that a leak is a compile error rather than a forgotten
 * strip. The key travels on the attempt instead, which is an object that cannot
 * exist until the student has already answered. This function is the one place
 * that turns the second into the first.
 *
 * Returns `undefined` rather than an empty object when there is nothing to mark,
 * so a caller can spread it conditionally: under `exactOptionalPropertyTypes`,
 * passing an explicit `undefined` to an optional prop is not the same as
 * omitting it.
 */
export function markingFrom(
  attempts: { targetId: string; key: { correctOptionIds: string[] } | null }[],
): Record<string, readonly string[]> | undefined {
  const entries = attempts
    .filter((attempt) => (attempt.key?.correctOptionIds.length ?? 0) > 0)
    .map((attempt) => [attempt.targetId, attempt.key?.correctOptionIds ?? []] as const);

  return entries.length === 0 ? undefined : Object.fromEntries(entries);
}
