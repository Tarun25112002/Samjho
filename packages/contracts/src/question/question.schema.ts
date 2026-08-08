import { z } from "zod";

import { bloomLevelSchema, difficultySchema, questionTypeSchema } from "./question-enums.js";

/**
 * The question wire format.
 *
 * ## The one decision that matters here
 *
 * A student must never receive the answer key for a question they have not
 * answered. `docs/02` §3 phrases the rule as "two serializers, never one
 * function with a boolean flag" — because flags get passed wrong, and the bug is
 * silent: the response still looks fine, it just contains an extra field nobody
 * noticed.
 *
 * This file goes one step further and puts the rule in the *type system*.
 * `StudentQuestion` has no `answer` property at all, and `QuestionOption` has no
 * `isCorrect`. Not "null when hidden" — absent. So leaking an answer key is not
 * a matter of remembering to strip it; it is a field that does not exist on the
 * object being built, and inventing it is a compile error.
 *
 * `GradedQuestion` extends the student shape with the key. It is only ever
 * constructed on a path where the student has already answered.
 *
 * ## Bodies are Markdown with LaTeX
 *
 * `body`, `solution` and option text are Markdown — bold, italics, GFM tables
 * (match-the-following is a two-column table), with maths in `$…$`. They are
 * rendered by `MathText`, never with `dangerouslySetInnerHTML`: this content is
 * author-supplied, and one day it will be supplied by a contractor rather than
 * by us.
 */

export const questionOptionSchema = z.object({
  id: z.string().min(1),
  /** "A", "B", "C", "D" as printed. */
  label: z.string().min(1),
  body: z.string(),
  orderIndex: z.int(),
});

export type QuestionOption = z.infer<typeof questionOptionSchema>;

export const assetKindSchema = z.enum(["IMAGE", "DIAGRAM", "GRAPH", "TABLE"]);
export type AssetKind = z.infer<typeof assetKindSchema>;

export const questionAssetSchema = z.object({
  id: z.string().min(1),
  kind: assetKindSchema,
  url: z.string().min(1),
  /**
   * Never nullable, all the way from the database to the renderer. A circuit
   * diagram with no alt text is a question a blind student cannot attempt, and
   * "we'll fill it in later" never survives contact with bulk content entry.
   */
  altText: z.string().min(1),
  caption: z.string().nullable(),
  orderIndex: z.int(),
});

export type QuestionAsset = z.infer<typeof questionAssetSchema>;

export const questionTopicRefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  /** Exactly one per question. Mastery attribution uses it; browsing uses all. */
  isPrimary: z.boolean(),
});

export const chapterRefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  /** "Physics" / "Chemistry" / "Biology" for Science; null for Maths. */
  domain: z.string().nullable(),
});

export const sourceTypeSchema = z.enum([
  "ORIGINAL",
  "CBSE_BOARD_PAPER",
  "CBSE_SAMPLE_PAPER",
  "NCERT",
  "ADAPTED",
  "THIRD_PARTY",
]);
export type SourceType = z.infer<typeof sourceTypeSchema>;

/**
 * Where a question came from, as shown to a student.
 *
 * `licenceStatus` and the review notes are deliberately **not** here. Those are
 * an internal editorial decision; what a student is owed is the attribution
 * itself ("CBSE 2024, Set 1"), which is also what makes the adapted-and-
 * attributed sourcing position (docs/07 Q6, R2) visible rather than theoretical.
 */
export const questionProvenanceSchema = z.object({
  sourceType: sourceTypeSchema,
  year: z.int().nullable(),
  /** "Feb 2026" / "May 2026" — Class 10 now has two sittings. */
  examSession: z.string().nullable(),
  setNumber: z.string().nullable(),
  attributionText: z.string().nullable(),
});

export type QuestionProvenance = z.infer<typeof questionProvenanceSchema>;

/** Fields every question carries, container or sub-part alike. */
const questionCoreShape = {
  id: z.string().min(1),
  type: questionTypeSchema,
  body: z.string().min(1),
  marks: z.int().positive(),
  difficulty: difficultySchema,
  bloomLevel: bloomLevelSchema,
  expectedTimeSeconds: z.int().positive(),
  /** Attempts record the version they saw, so an edit cannot rewrite history. */
  version: z.int().positive(),
  options: z.array(questionOptionSchema),
  assets: z.array(questionAssetSchema),
};

/**
 * A sub-part of a case study. Has no `subParts` of its own — the depth cap is a
 * CHECK constraint in the database, and mirroring it here means the impossible
 * shape is also unrepresentable.
 */
export const studentSubPartSchema = z.object({
  ...questionCoreShape,
  subPartIndex: z.int().nonnegative(),
});

export type StudentSubPart = z.infer<typeof studentSubPartSchema>;

export const studentQuestionSchema = z.object({
  ...questionCoreShape,
  chapter: chapterRefSchema,
  topics: z.array(questionTopicRefSchema),
  /** True for the stimulus-holding parent of a case study. Never attempted. */
  isContainer: z.boolean(),
  subParts: z.array(studentSubPartSchema),
  provenance: questionProvenanceSchema.nullable(),
});

export type StudentQuestion = z.infer<typeof studentQuestionSchema>;

/**
 * One row of a CBSE-style marking scheme.
 *
 * Load-bearing rather than decorative: for subjective questions this is what a
 * student self-evaluates against (docs/04, R3), so the marks have to add up to
 * the question's total and each step has to be checkable on its own.
 */
export const markingStepSchema = z.object({
  step: z.string().min(1),
  marks: z.number().nonnegative(),
  keyPoints: z.array(z.string()).default([]),
});

export type MarkingStep = z.infer<typeof markingStepSchema>;

export const questionAnswerSchema = z.object({
  /** The canonical answer for auto-graded types. Null for subjective ones. */
  correctValue: z.string().nullable(),
  /** Other forms accepted as correct, normalised before comparison. */
  acceptedValues: z.array(z.string()),
  /** Absolute tolerance for NUMERICAL. */
  tolerance: z.number().nullable(),
  unit: z.string().nullable(),
  solution: z.string().min(1),
  explanation: z.string().nullable(),
  markingScheme: z.array(markingStepSchema).nullable(),
  /** Empty for types without options. */
  correctOptionIds: z.array(z.string()),
});

export type QuestionAnswer = z.infer<typeof questionAnswerSchema>;

export const gradedSubPartSchema = studentSubPartSchema.extend({
  answer: questionAnswerSchema.nullable(),
});

export type GradedSubPart = z.infer<typeof gradedSubPartSchema>;

/**
 * A question *with* its answer key. Returned only once the student has answered.
 *
 * `answer` is nullable because a container case study holds no answer of its own
 * — the marks live entirely in its sub-parts.
 */
export const gradedQuestionSchema = studentQuestionSchema.extend({
  answer: questionAnswerSchema.nullable(),
  subParts: z.array(gradedSubPartSchema),
});

export type GradedQuestion = z.infer<typeof gradedQuestionSchema>;

// ── List filters ─────────────────────────────────────────────────────────────

/**
 * Accept `type=MCQ&type=TRUE_FALSE` *and* `type=MCQ,TRUE_FALSE`.
 *
 * Express gives a bare string for one value and an array for several, and every
 * HTTP client spells repeated parameters differently. Normalising at the edge
 * means no handler ever writes `Array.isArray(req.query.type)`.
 */
export function multiValue<T extends z.ZodType<unknown, string>>(item: T) {
  return z
    .union([z.string(), z.array(z.string())])
    .transform((value) =>
      (Array.isArray(value) ? value : value.split(","))
        .map((entry) => entry.trim())
        .filter(Boolean),
    )
    .pipe(z.array(item).min(1));
}

export const listQuestionsQuerySchema = z.object({
  subjectId: z.string().min(1).optional(),
  chapterId: z.string().min(1).optional(),
  topicId: z.string().min(1).optional(),
  type: multiValue(questionTypeSchema).optional(),
  difficulty: multiValue(difficultySchema).optional(),
  marks: z.coerce.number().int().positive().optional(),

  /**
   * Case-insensitive substring match on the body. Deliberately not full-text
   * search: that wants a tsvector column and an index, and adding one before
   * anyone has asked to search is a migration spent on a guess.
   */
  search: z.string().trim().min(2).max(120).optional(),

  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListQuestionsQuery = z.infer<typeof listQuestionsQuerySchema>;
