import { z } from "zod";

import { subjectSummarySchema } from "../catalog/subject.schema.js";

/**
 * Learning progress is read from the rollups that are updated in the same
 * transaction as a graded attempt. These are intentionally not browser-made
 * estimates: a value here is something a student can rebuild from their work.
 */
export const subjectProgressSummarySchema = z.object({
  subject: subjectSummarySchema,
  attempted: z.int().nonnegative(),
  correct: z.int().nonnegative(),
  marksEarned: z.number().nonnegative(),
  marksPossible: z.number().nonnegative(),
  /** Recency-weighted score, expressed as a ratio from 0 to 1. */
  masteryScore: z.number().min(0).max(1),
  unrepairedMistakes: z.int().nonnegative(),
  questionsBookmarked: z.int().nonnegative(),
  practiceSessions: z.int().nonnegative(),
  lastAttemptedAt: z.iso.datetime().nullable(),
});

export type SubjectProgressSummary = z.infer<typeof subjectProgressSummarySchema>;

export const weakTopicSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  chapterId: z.string().min(1),
  chapterName: z.string().min(1),
  subject: subjectSummarySchema,
  attempted: z.int().positive(),
  masteryScore: z.number().min(0).max(1),
  unrepairedMistakes: z.int().nonnegative(),
});

export type WeakTopic = z.infer<typeof weakTopicSchema>;

export const progressOverviewSchema = z.object({
  subjects: z.array(subjectProgressSummarySchema),
  weakTopics: z.array(weakTopicSchema),
  openMistakes: z.int().nonnegative(),
  savedQuestions: z.int().nonnegative(),
});

export type ProgressOverview = z.infer<typeof progressOverviewSchema>;
