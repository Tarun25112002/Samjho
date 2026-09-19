import { z } from "zod";

import { importResultSchema } from "../question/import.schema.js";
import { difficultySchema } from "../question/question-enums.js";

/**
 * Drafting new questions with a model.
 *
 * ## What problem this actually solves
 *
 * The bank is finite and the adaptive engine is not. A student who is weak on
 * Quadratic Equations at HARD gets the same four hard questions every week, and
 * a fifth attempt at a question they now remember measures memory rather than
 * mastery. Authoring is how a bank of two hundred becomes a bank that does not
 * run out — and it is the only part of this product where a model's output
 * would otherwise become content rather than advice.
 *
 * ## Nothing here reaches a student
 *
 * The endpoint returns drafts. It writes nothing, publishes nothing, and is
 * staff-only. What comes back is a set of rows in the *import* shape, already
 * run through the ordinary import validator in dry-run mode, so an editor sees
 * exactly which of them a human-typed question would have been rejected for.
 * Accepting them is a second, deliberate call to the existing import endpoint,
 * where they land as DRAFT and go through the same review as everything else.
 *
 * That is not process for its own sake. docs/07 R3 draws the line at AI being
 * assistive rather than authoritative, and a question is the most authoritative
 * artefact this product has: a wrong answer key does not merely mislead a
 * student, it marks them down for being right.
 *
 * ## Why the source is always ORIGINAL
 *
 * A generated question is nobody's past paper. It is written fresh against the
 * syllabus, and it is recorded as `ORIGINAL` with a review note saying a model
 * drafted it. The alternative — letting a model claim a year, a paper code and
 * a question number — is fabricated provenance (docs/07 R2), and it is
 * fabricated in exactly the field a copyright argument would turn on.
 */

/** The types a model drafts well and the validator can fully check. */
export const authorableTypeSchema = z.enum([
  "MCQ",
  "ASSERTION_REASON",
  "VERY_SHORT_ANSWER",
  "SHORT_ANSWER",
  "LONG_ANSWER",
]);

export type AuthorableType = z.infer<typeof authorableTypeSchema>;

export const draftQuestionsSchema = z.object({
  subjectId: z.string().min(1).max(60),
  /** Chapter slug, as the import file spells it. */
  chapter: z.string().trim().min(1).max(120),
  /**
   * Topic slugs to write against. The first becomes the primary topic.
   *
   * Required rather than inferred from the chapter: a chapter is too broad a
   * brief, and a model given one writes four questions about its most famous
   * topic. Naming the topic is how an editor asks for what the bank is short of.
   */
  topics: z.array(z.string().trim().min(1).max(120)).min(1).max(3),
  type: authorableTypeSchema,
  difficulty: difficultySchema,
  marks: z.int().min(1).max(20),
  /**
   * Capped low on purpose.
   *
   * Every question here is read by a person before it is published, and a batch
   * of forty is a batch nobody reads. Six is about what an editor will actually
   * check line by line in one sitting, which is the real constraint rather than
   * the token budget.
   */
  count: z.int().min(1).max(6).default(3),
  /**
   * What the editor wants, in their own words — "use real-world contexts", "no
   * questions about circles", "match the phrasing of the 2025 paper".
   *
   * Fenced as untrusted in the prompt like any other free text, because it
   * reaches a model that is about to produce content.
   */
  notes: z.string().trim().max(600).nullable().default(null),
});

export type DraftQuestionsInput = z.infer<typeof draftQuestionsSchema>;

export const draftedQuestionsSchema = z.object({
  /**
   * Rows in the import shape, ready to be posted to `/admin/questions/import`.
   *
   * Deliberately the same shape a content editor would have written by hand.
   * The AI does not get a private write path; it gets the public one, and if a
   * row is malformed it fails the way a hand-written row fails.
   */
  rows: z.array(z.record(z.string(), z.unknown())),
  /**
   * What the ordinary import validator makes of those rows, dry-run.
   *
   * The most useful field in the response. A model that has produced an MCQ
   * with two correct options, or a case study's marks that do not add up, is
   * caught here — by exactly the code that catches a human doing it — before an
   * editor spends ten minutes reading the question itself.
   */
  validation: importResultSchema,
  /** False when no model answered; `rows` is then empty and nothing failed. */
  generated: z.boolean(),
  /** One sentence on what the model was unsure of. Empty when it was not. */
  caveat: z.string().max(400),
});

export type DraftedQuestions = z.infer<typeof draftedQuestionsSchema>;
