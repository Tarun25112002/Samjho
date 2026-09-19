import { z } from "zod";

export const assessmentObjectiveSchema = z.enum([
  "DIAGNOSTIC_FUNDAMENTALS",
  "DIAGNOSTIC_APPLICATION",
  "DIAGNOSTIC_CHALLENGE",
  "ADAPTIVE_PERSONALISED",
]);
export type AssessmentObjective = z.infer<typeof assessmentObjectiveSchema>;

export const DIAGNOSTIC_OBJECTIVES = [
  "DIAGNOSTIC_FUNDAMENTALS",
  "DIAGNOSTIC_APPLICATION",
  "DIAGNOSTIC_CHALLENGE",
] as const satisfies readonly AssessmentObjective[];

export const ASSESSMENT_OBJECTIVE_LABELS = {
  DIAGNOSTIC_FUNDAMENTALS: "Fundamentals",
  DIAGNOSTIC_APPLICATION: "Application",
  DIAGNOSTIC_CHALLENGE: "Challenge",
  ADAPTIVE_PERSONALISED: "Made for you",
} as const satisfies Record<AssessmentObjective, string>;

export const ASSESSMENT_OBJECTIVE_BLURBS = {
  DIAGNOSTIC_FUNDAMENTALS:
    "Straightforward questions across your subjects, to find out what is already solid.",
  DIAGNOSTIC_APPLICATION: "Questions that need a method chosen and applied, not just recalled.",
  DIAGNOSTIC_CHALLENGE: "Multi-step questions, to find where your reasoning runs out.",
  ADAPTIVE_PERSONALISED:
    "Built from what you have answered so far, and rebuilt after every question.",
} as const satisfies Record<AssessmentObjective, string>;

export const selectionReasonSchema = z.enum([
  "DIAGNOSTIC_LADDER",
  "WEAK_AREA",
  "REINFORCEMENT",
  "CURRENT_LEVEL",
  "CHALLENGE",
  "COVERAGE",
]);
export type SelectionReason = z.infer<typeof selectionReasonSchema>;

export const SELECTION_REASON_LABELS = {
  DIAGNOSTIC_LADDER: "Measuring where you are",
  WEAK_AREA: "A weak area",
  REINFORCEMENT: "Reinforcing something shaky",
  CURRENT_LEVEL: "At your current level",
  CHALLENGE: "A stretch",
  COVERAGE: "Something you have not tried yet",
} as const satisfies Record<SelectionReason, string>;

export const TARGET_LEVEL_MIN = 1;
export const TARGET_LEVEL_MAX = 5;

export const targetLevelSchema = z.int().min(TARGET_LEVEL_MIN).max(TARGET_LEVEL_MAX);

export const TARGET_LEVEL_LABELS = {
  1: "Easy",
  2: "Easy+",
  3: "Medium",
  4: "Medium+",
  5: "Hard",
} as const satisfies Record<number, string>;

export const questionSelectionSchema = z.object({
  reason: selectionReasonSchema,
  targetLevel: targetLevelSchema,
  masteryAtPick: z.number().min(0).max(1).nullable(),
  topicId: z.string().min(1).nullable(),
  topicName: z.string().min(1).nullable(),
});

export type QuestionSelection = z.infer<typeof questionSelectionSchema>;

export const ADAPTIVE_COUNT_DEFAULT = 10;
export const ADAPTIVE_COUNT_MIN = 5;
export const ADAPTIVE_COUNT_MAX = 25;

export const startAssessmentSchema = z.object({
  objective: assessmentObjectiveSchema,
  subjectId: z.string().min(1).max(60).optional(),
  count: z.int().min(ADAPTIVE_COUNT_MIN).max(ADAPTIVE_COUNT_MAX).default(ADAPTIVE_COUNT_DEFAULT),
  timeLimitMinutes: z.int().min(5).max(180).optional(),
});

export type StartAssessmentInput = z.infer<typeof startAssessmentSchema>;

export const assessmentBlendEntrySchema = z.object({
  reason: selectionReasonSchema,
  count: z.int().positive(),
});

export type AssessmentBlendEntry = z.infer<typeof assessmentBlendEntrySchema>;

export const assessmentPlanSchema = z.object({
  objective: assessmentObjectiveSchema,
  count: z.int().positive(),
  estimatedMinutes: z.int().positive(),
  blend: z.array(assessmentBlendEntrySchema),
  subjectId: z.string().min(1).nullable(),
  subjectName: z.string().min(1).nullable(),
  focusTopics: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) })),
});

export type AssessmentPlan = z.infer<typeof assessmentPlanSchema>;

export const diagnosticStageSchema = z.object({
  objective: assessmentObjectiveSchema,
  label: z.string().min(1),
  blurb: z.string().min(1),
  status: z.enum(["LOCKED", "AVAILABLE", "IN_PROGRESS", "COMPLETED"]),
  sessionId: z.string().min(1).nullable(),
  completedAt: z.iso.datetime().nullable(),
  scorePercent: z.number().min(0).max(100).nullable(),
});

export type DiagnosticStage = z.infer<typeof diagnosticStageSchema>;

export const diagnosticProgressSchema = z.object({
  stages: z.array(diagnosticStageSchema),
  completedCount: z.int().nonnegative(),
  analysisReady: z.boolean(),
  nextObjective: assessmentObjectiveSchema.nullable(),
});

export type DiagnosticProgress = z.infer<typeof diagnosticProgressSchema>;

export const hintResponseSchema = z.object({
  questionId: z.string().min(1),
  hint: z.string().min(1),
  authored: z.boolean(),
});

export type HintResponse = z.infer<typeof hintResponseSchema>;
