import { z } from "zod";

/**
 * Exam taxonomy shared by the API and the web app.
 *
 * Same duplication-is-checked rule as the other enum files: Prisma generates its
 * own copy from schema.prisma and `enum-parity.test.ts` asserts the two agree.
 */

/**
 * Where a paper came from.
 *
 * `GENERATED_MOCK` is not a lesser kind of paper — it is the one the platform
 * can produce on demand from a blueprint and the question bank, and for a
 * product whose bank is being written from zero (docs/07 R1) it is the only kind
 * available until real past papers are entered. Keeping the distinction means a
 * student can always tell whether they are sitting CBSE's paper or Samjho's
 * reconstruction of its shape.
 */
export const paperTypeSchema = z.enum(["PAST_PAPER", "SAMPLE_PAPER", "GENERATED_MOCK"]);
export type PaperType = z.infer<typeof paperTypeSchema>;

export const PAPER_TYPE_LABELS = {
  PAST_PAPER: "Past board paper",
  SAMPLE_PAPER: "CBSE sample paper",
  GENERATED_MOCK: "Practice paper",
} as const satisfies Record<PaperType, string>;

/**
 * A paper's editorial lifecycle. Only `PUBLISHED` may be sat.
 *
 * The same three-state shape as `QuestionStatus`, and for the same reason: a
 * paper an editor is midway through assembling must not be startable, and
 * withdrawing one has to be possible without deleting the attempts already made
 * against it.
 */
export const paperStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export type PaperStatus = z.infer<typeof paperStatusSchema>;

/**
 * Which side of an internal choice an item sits on.
 *
 * CBSE papers say "attempt either Q29 or Q29(OR)". The slot is the position; the
 * items are the alternatives. Modelling it this way rather than as two questions
 * is what keeps scoring, review and analytics free of special cases — one
 * position is worth its marks exactly once, whichever alternative was answered.
 */
export const slotVariantSchema = z.enum(["MAIN", "OR"]);
export type SlotVariant = z.infer<typeof slotVariantSchema>;
