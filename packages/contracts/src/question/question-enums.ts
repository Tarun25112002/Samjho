import { z } from "zod";

/**
 * Question taxonomy shared by the API, the web renderer, and exam blueprints.
 *
 * These live in contracts rather than being redeclared per package because they
 * cross the network boundary: the API serialises them, the renderer switches on
 * them, and blueprints constrain which types may fill a slot. Prisma generates
 * its own copy of these enums from schema.prisma — that duplication is checked
 * by a test in apps/api rather than trusted, because a silent drift between the
 * database enum and the wire enum is exactly the kind of bug that only shows up
 * as a runtime crash on one unlucky question.
 */

export const questionTypeSchema = z.enum([
  "MCQ",
  "ASSERTION_REASON",
  "VERY_SHORT_ANSWER",
  "SHORT_ANSWER",
  "LONG_ANSWER",
  "CASE_BASED",
  "NUMERICAL",
  "TRUE_FALSE",
  "FILL_BLANK",
  "MATCH_FOLLOWING",
]);
export type QuestionType = z.infer<typeof questionTypeSchema>;

/**
 * Types that can be auto-graded server-side with no student self-assessment.
 * Everything else needs the marking-scheme flow described in 04-exam-engine.md.
 */
export const AUTO_GRADABLE_QUESTION_TYPES = [
  "MCQ",
  "ASSERTION_REASON",
  "TRUE_FALSE",
  "FILL_BLANK",
  "NUMERICAL",
  "MATCH_FOLLOWING",
] as const satisfies readonly QuestionType[];

export function isAutoGradable(type: QuestionType): boolean {
  return (AUTO_GRADABLE_QUESTION_TYPES as readonly QuestionType[]).includes(type);
}

export const difficultySchema = z.enum(["EASY", "MEDIUM", "HARD"]);
export type Difficulty = z.infer<typeof difficultySchema>;

/** Bloom's revised taxonomy, in CBSE's own spelling of the levels. */
export const bloomLevelSchema = z.enum([
  "REMEMBER",
  "UNDERSTAND",
  "APPLY",
  "ANALYSE",
  "EVALUATE",
  "CREATE",
]);
export type BloomLevel = z.infer<typeof bloomLevelSchema>;

/**
 * The editorial lifecycle of a question.
 *
 * Only `PUBLISHED` is ever served to a student — see `question.visibility.ts`.
 * `IN_REVIEW` is not a decorative middle step: it is where an editor parks a
 * question they believe is *wrong*, and it must therefore stop being served the
 * moment it is set, which is why unpublishing is a status change rather than a
 * separate boolean.
 */
export const questionStatusSchema = z.enum(["DRAFT", "IN_REVIEW", "PUBLISHED", "ARCHIVED"]);
export type QuestionStatus = z.infer<typeof questionStatusSchema>;

/**
 * Whether a question's content is legally safe to serve (docs/07 R2).
 *
 * `NEEDS_REVIEW` is the default in the database so that content entered without
 * a deliberate licensing decision is conservative rather than silently served.
 * Admin-side, it is also the value that blocks publication: see
 * `assertPublishable` in the admin question schema.
 */
export const licenceStatusSchema = z.enum([
  "CLEARED",
  "FAIR_USE_CLAIMED",
  "NEEDS_REVIEW",
  "RESTRICTED",
]);
export type LicenceStatus = z.infer<typeof licenceStatusSchema>;

export const boardSchema = z.enum(["CBSE"]);
export type Board = z.infer<typeof boardSchema>;

/** Only 10 and 12 sit board exams; 11 exists in the syllabus but not in scope. */
export const classLevelSchema = z.union([z.literal(10), z.literal(12)]);
export type ClassLevel = z.infer<typeof classLevelSchema>;
