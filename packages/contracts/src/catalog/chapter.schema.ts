import { z } from "zod";

import { difficultySchema, questionTypeSchema } from "../question/question-enums.js";
import { subjectSummarySchema } from "./subject.schema.js";

/**
 * Chapter and topic browsing.
 *
 * Counts are arrays of `{ key, count }` rather than a keyed record. A record of
 * enum → number forces a decision about whether absent keys mean zero or mean
 * unknown, and every consumer then re-derives a display order. An array carries
 * its own order and says exactly what it contains.
 */

export const questionTypeCountSchema = z.object({
  type: questionTypeSchema,
  count: z.int().nonnegative(),
});

export const difficultyCountSchema = z.object({
  difficulty: difficultySchema,
  count: z.int().nonnegative(),
});

export const questionCountsSchema = z.object({
  total: z.int().nonnegative(),
  byType: z.array(questionTypeCountSchema),
  byDifficulty: z.array(difficultyCountSchema),
});

export type QuestionCounts = z.infer<typeof questionCountsSchema>;

export const topicSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  orderIndex: z.int(),
  /** Published questions whose primary or secondary topic this is. */
  questionCount: z.int().nonnegative(),
});

export type TopicSummary = z.infer<typeof topicSummarySchema>;

export const chapterSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  orderIndex: z.int(),
  /** NCERT's own numbering, which students navigate by. Null if unmapped. */
  ncertChapterNo: z.int().nullable(),
  /**
   * "Physics" / "Chemistry" / "Biology" for Class 10 Science; null for Maths.
   * Any UI that groups by this must handle null meaning "no grouping at all",
   * not "a group called Other" — Maths has 14 chapters and no domains.
   */
  domain: z.string().nullable(),
  questionCount: z.int().nonnegative(),
  topicCount: z.int().nonnegative(),
});

export type ChapterSummary = z.infer<typeof chapterSummarySchema>;

export const chapterDetailSchema = chapterSummarySchema.extend({
  subject: subjectSummarySchema,
  topics: z.array(topicSummarySchema),
  counts: questionCountsSchema,
});

export type ChapterDetail = z.infer<typeof chapterDetailSchema>;

export const subjectDetailSchema = subjectSummarySchema.extend({
  syllabusYear: z.string().min(1),
  hasPractical: z.boolean(),
  internalMarks: z.int().nonnegative(),
  chapters: z.array(chapterSummarySchema),
  /**
   * Distinct domains present, in chapter order. Empty for subjects that do not
   * group — which is the signal to render a flat list rather than sections.
   */
  domains: z.array(z.string()),
  counts: questionCountsSchema,
});

export type SubjectDetail = z.infer<typeof subjectDetailSchema>;

export const chapterListResponseSchema = z.object({
  chapters: z.array(chapterSummarySchema),
  domains: z.array(z.string()),
});

export type ChapterListResponse = z.infer<typeof chapterListResponseSchema>;
