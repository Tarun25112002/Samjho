import { z } from "zod";

import { subjectSummarySchema } from "../catalog/subject.schema.js";

export const MASTERY_BAND_STRONG = 0.75;
export const MASTERY_BAND_WEAK = 0.5;

export const ANALYSIS_MIN_TOPIC_ATTEMPTS = 2;

export const masteryBandSchema = z.enum(["STRONG", "NEEDS_PRACTICE", "WEAK"]);
export type MasteryBand = z.infer<typeof masteryBandSchema>;

export const MASTERY_BAND_LABELS = {
  STRONG: "Strong",
  NEEDS_PRACTICE: "Needs practice",
  WEAK: "Weak",
} as const satisfies Record<MasteryBand, string>;

export function bandFor(masteryScore: number): MasteryBand {
  if (masteryScore >= MASTERY_BAND_STRONG) return "STRONG";
  if (masteryScore >= MASTERY_BAND_WEAK) return "NEEDS_PRACTICE";
  return "WEAK";
}

export const learningMetricSchema = z.object({
  key: z.enum([
    "OVERALL_MASTERY",
    "ACCURACY",
    "CONSISTENCY",
    "PROBLEM_SOLVING",
    "CONCEPTUAL_UNDERSTANDING",
  ]),
  label: z.string().min(1),
  value: z.number().min(0).max(1).nullable(),
  basis: z.string().min(1),
});

export type LearningMetric = z.infer<typeof learningMetricSchema>;

export const analysisTopicSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  chapterName: z.string().min(1),
  subjectName: z.string().min(1),
  masteryScore: z.number().min(0).max(1),
  band: masteryBandSchema,
  attempted: z.int().nonnegative(),
  unrepairedMistakes: z.int().nonnegative(),
});

export type AnalysisTopic = z.infer<typeof analysisTopicSchema>;

export const analysisSubjectSchema = z.object({
  subject: subjectSummarySchema,
  masteryScore: z.number().min(0).max(1),
  accuracy: z.number().min(0).max(1).nullable(),
  attempted: z.int().nonnegative(),
});

export type AnalysisSubject = z.infer<typeof analysisSubjectSchema>;

export const analysisInsightSchema = z.object({
  text: z.string().min(1),
  generated: z.boolean(),
});

export type AnalysisInsight = z.infer<typeof analysisInsightSchema>;

export const preparationAnalysisSchema = z.object({
  overallMastery: z.number().min(0).max(1).nullable(),
  questionsAttempted: z.int().nonnegative(),
  metrics: z.array(learningMetricSchema),
  averageResponseSeconds: z.number().nonnegative().nullable(),
  paceRatio: z.number().positive().nullable(),
  subjects: z.array(analysisSubjectSchema),
  strong: z.array(analysisTopicSchema),
  needsPractice: z.array(analysisTopicSchema),
  weak: z.array(analysisTopicSchema),
  insight: analysisInsightSchema.nullable(),
  diagnosticsCompleted: z.int().nonnegative(),
  diagnosticsComplete: z.boolean(),
  generatedAt: z.iso.datetime(),
});

export type PreparationAnalysis = z.infer<typeof preparationAnalysisSchema>;

export const masteryPointSchema = z.object({
  day: z.string().min(1),
  masteryScore: z.number().min(0).max(1),
  attempted: z.int().nonnegative(),
});

export type MasteryPoint = z.infer<typeof masteryPointSchema>;

export const topicMovementSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  chapterName: z.string().min(1),
  subjectName: z.string().min(1),
  current: z.number().min(0).max(1),
  previous: z.number().min(0).max(1).nullable(),
});

export type TopicMovement = z.infer<typeof topicMovementSchema>;

export const progressTrendSchema = z.object({
  points: z.array(masteryPointSchema),
  topics: z.array(topicMovementSchema),
  currentStreakDays: z.int().nonnegative(),
});

export type ProgressTrend = z.infer<typeof progressTrendSchema>;
