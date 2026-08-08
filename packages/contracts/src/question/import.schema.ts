import { z } from "zod";

import { licenceStatusSchema, questionStatusSchema } from "./question-enums.js";

/**
 * Bulk import, and the admin dashboard that tells an editor what to do next.
 *
 * ## Why the rows are loose objects
 *
 * A row here is `{ ref, chapter, topics, ...the question }` where the question
 * half is deliberately *not* described. It is parsed a second time, per row,
 * against `writeQuestionInputSchema` once the chapter and topic slugs have been
 * resolved to ids.
 *
 * Two reasons, and the first is the important one:
 *
 *  1. **One validator.** Describing the question shape again here would be a
 *     second copy of every per-type rule, and the copy that drifts is always the
 *     one nobody looks at. An imported question is validated by exactly the code
 *     that validates a typed one, so an MCQ with two correct options is rejected
 *     identically whichever door it came through.
 *  2. **Row-level errors.** A single top-level parse would report
 *     `rows.7.answer.solution` and abort the request with a 400. What a content
 *     editor needs from a 200-row file is *every* bad row with its own line
 *     number and its own reference — which means catching failures per row and
 *     collecting them, not letting the middleware reject the whole payload.
 *
 * `z.looseObject` rather than `z.object` is what makes this work: a strict object
 * strips the unknown keys, and the question would arrive at the second parse as
 * `{ ref, chapter, topics }` — valid-looking and empty.
 *
 * ## Why slugs, not ids
 *
 * Whoever writes this file has a syllabus in front of them, not a list of cuids.
 * The seed loader made the same choice for the same reason, and it earns it the
 * same way: a wrong slug fails with the slug in the message, which is the error
 * you want at 40 questions and desperately want at 4,000.
 */

export const importQuestionRowSchema = z.looseObject({
  /**
   * The author's own identifier for this row — a spreadsheet line, a paper
   * question number, anything. Echoed back in every error so a report can be
   * matched to a source file that has since been re-sorted.
   */
  ref: z.string().trim().max(80).nullable().default(null),
  /** Chapter slug within the target subject. */
  chapter: z.string().trim().min(1).max(120),
  /** Topic slugs. The first is the primary one mastery is attributed to. */
  topics: z.array(z.string().trim().min(1).max(120)).min(1).max(5),
});

export type ImportQuestionRow = z.infer<typeof importQuestionRowSchema>;

export const importQuestionsInputSchema = z.object({
  subjectId: z.string().min(1).max(60),
  /**
   * Defaults to **true**: checking is the default and writing is the opt-in.
   *
   * A default of `false` means the one time someone forgets the flag, 200
   * questions land in the database — and import is precisely the operation
   * people run half-attentively at the end of a long day.
   */
  dryRun: z.boolean().default(true),
  /**
   * Capped so a single request cannot hold a transaction open across a file of
   * ten thousand rows. Splitting a large file is a loop in a script; a lock held
   * for four minutes is an outage.
   */
  rows: z.array(importQuestionRowSchema).min(1).max(200),
  /**
   * Status the imported questions land in. Draft by default — a bulk file is
   * exactly the input least likely to have been read line by line, so publishing
   * it in one step is a decision that should have to be typed out.
   */
  status: questionStatusSchema.default("DRAFT"),
});

export type ImportQuestionsInput = z.infer<typeof importQuestionsInputSchema>;

export const importRowErrorSchema = z.object({
  /** Zero-based index into `rows`, so it lines up with the file. */
  row: z.int().nonnegative(),
  ref: z.string().nullable(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })),
});

export type ImportRowError = z.infer<typeof importRowErrorSchema>;

/**
 * The outcome of an import.
 *
 * **Nothing is written unless every row is valid.** A partial import leaves an
 * editor holding a file and no idea which 140 of its 200 rows landed, and the
 * only way to find out is to compare by hand — so the failure mode of the
 * all-or-nothing rule (fix the file and re-run) is strictly better than the
 * failure mode of the alternative.
 *
 * `written` is therefore either `rows.length` or zero, and it is reported
 * separately from `valid` so a dry run reads honestly: "200 valid, 0 written".
 */
export const importResultSchema = z.object({
  dryRun: z.boolean(),
  total: z.int().nonnegative(),
  valid: z.int().nonnegative(),
  written: z.int().nonnegative(),
  errors: z.array(importRowErrorSchema),
});

export type ImportResult = z.infer<typeof importResultSchema>;

// ── Admin dashboard ──────────────────────────────────────────────────────────

/**
 * What the content dashboard shows.
 *
 * Not a vanity board. `needsLicenceReview` and `missingSolution` are work
 * queues — the two things that stop a question reaching a student — and
 * `byStatus` answers "how far from a usable bank are we", which is the number
 * this whole phase exists to move (docs/07 R1).
 */
export const adminSubjectStatsSchema = z.object({
  subjectId: z.string().min(1),
  name: z.string().min(1),
  classLevel: z.int(),
  /** Top-level questions only — a case study is one question, not four. */
  total: z.int().nonnegative(),
  byStatus: z.record(questionStatusSchema, z.int().nonnegative()),
  chaptersWithNoQuestions: z.int().nonnegative(),
  needsLicenceReview: z.int().nonnegative(),
});

export type AdminSubjectStats = z.infer<typeof adminSubjectStatsSchema>;

export const adminContentStatsSchema = z.object({
  subjects: z.array(adminSubjectStatsSchema),
  byLicenceStatus: z.record(licenceStatusSchema, z.int().nonnegative()),
  /** Questions edited in the last 7 days, as a sign of life on the bank. */
  editedThisWeek: z.int().nonnegative(),
});

export type AdminContentStats = z.infer<typeof adminContentStatsSchema>;
