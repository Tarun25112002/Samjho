import { z } from "zod";

/**
 * Practice taxonomy shared by the API and the web app.
 *
 * Same rule as the other enum files: Prisma generates its own copy from
 * schema.prisma, and `enum-parity.test.ts` checks the two agree rather than
 * trusting them to.
 */

/**
 * Where a practice set's questions come from.
 *
 * The mode is not decoration — it decides which *pool* the selection service
 * draws from, and two of these draw from somewhere other than the question
 * bank. `MISTAKE_REVIEW` reads the student's unrepaired `MistakeRecord` rows and
 * `BOOKMARKS` reads their bookmarks, which is why they cannot be expressed as
 * another filter on the bank and get their own value here.
 *
 *  - `QUICK`         — the one-tap set: whatever the student is enrolled in.
 *  - `CUSTOM`        — the full filter builder.
 *  - `CHAPTER`       — "practise this chapter", from a chapter page.
 *  - `MISTAKE_REVIEW`— questions previously got wrong and not yet repaired.
 *  - `BOOKMARKS`     — questions the student saved.
 *  - `PREVIOUS_YEAR` — a filter preset over provenance, promoted to a mode
 *                      because it is a first-class entry point on the hub
 *                      (docs/01 §2) rather than a checkbox someone must find.
 */
export const practiceModeSchema = z.enum([
  "QUICK",
  "CUSTOM",
  "CHAPTER",
  "MISTAKE_REVIEW",
  "BOOKMARKS",
  "PREVIOUS_YEAR",
]);
export type PracticeMode = z.infer<typeof practiceModeSchema>;

export const PRACTICE_MODE_LABELS = {
  QUICK: "Quick practice",
  CUSTOM: "Custom set",
  CHAPTER: "Chapter practice",
  MISTAKE_REVIEW: "Your mistakes",
  BOOKMARKS: "Saved questions",
  PREVIOUS_YEAR: "Previous-year questions",
} as const satisfies Record<PracticeMode, string>;

/**
 * `ABANDONED` is set by the student walking away, never by them failing.
 * Nothing in the product marks a session abandoned automatically yet; the value
 * exists so that when a sweeper is written (Phase 6 owns the equivalent for
 * exams) it has somewhere honest to put the result.
 */
export const sessionStatusSchema = z.enum(["IN_PROGRESS", "COMPLETED", "ABANDONED"]);
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

/**
 * How an attempt's marks were decided.
 *
 * `PENDING` is the interesting one and the reason this is not a boolean. A
 * subjective answer is *submitted* long before it is *scored*: the student
 * writes it, reads the marking scheme, then awards themselves marks. Between
 * those two moments the attempt row exists, counts as answered, and has no
 * defensible score — so `marksAwarded` is 0 and `isCorrect` is null, and every
 * aggregate has to know the difference between "scored zero" and "not scored".
 *
 * `AI` is unused in the MVP. It is here because docs/07 R3 commits to AI grading
 * being a later, *validated* upgrade that is never silently trusted — which
 * means the day it lands, a stored attempt must say which grader produced its
 * score. Adding the value later would leave every historical row ambiguous.
 */
export const evaluationModeSchema = z.enum(["AUTO", "SELF", "AI", "PENDING"]);
export type EvaluationMode = z.infer<typeof evaluationModeSchema>;

/**
 * Why the student got it wrong, in their own assessment.
 *
 * One tap, always skippable. This is the field that turns "you got 12 wrong"
 * into "you keep making calculation slips in Electricity", which is the only
 * version a student can act on — and the reason mistake capture is in the MVP
 * at all rather than deferred with the rest of the analytics.
 */
export const mistakeReasonSchema = z.enum([
  "CONCEPT_NOT_KNOWN",
  "CONCEPT_MISAPPLIED",
  "CALCULATION_ERROR",
  "MISREAD_QUESTION",
  "INCOMPLETE_ANSWER",
  "RAN_OUT_OF_TIME",
  "SILLY_MISTAKE",
  "GUESSED",
]);
export type MistakeReason = z.infer<typeof mistakeReasonSchema>;

/**
 * Phrased as the student would say it, not as a taxonomy.
 *
 * "Concept not known" is a category; "I hadn't learnt this yet" is something a
 * fifteen-year-old will pick honestly at eleven at night. The labels are the
 * whole instrument here — a mis-tapped reason is worse than a skipped one,
 * because it looks like data.
 */
export const MISTAKE_REASON_LABELS = {
  CONCEPT_NOT_KNOWN: "I hadn't learnt this yet",
  CONCEPT_MISAPPLIED: "I knew it but applied it wrong",
  CALCULATION_ERROR: "Calculation slip",
  MISREAD_QUESTION: "I misread the question",
  INCOMPLETE_ANSWER: "I left it incomplete",
  RAN_OUT_OF_TIME: "Ran out of time",
  SILLY_MISTAKE: "Silly mistake",
  GUESSED: "I guessed",
} as const satisfies Record<MistakeReason, string>;
