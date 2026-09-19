import { z } from "zod";

import { subjectSummarySchema } from "../catalog/subject.schema.js";
import { practiceModeSchema } from "../practice/practice-enums.js";
import { REVIEW_DAILY_CAP } from "../revision/revision.schema.js";

/**
 * The student's next few useful actions, computed from live learning data.
 *
 * This is intentionally a recommendation, not another task ledger. Practice
 * sessions, classroom submissions, and the revision schedule remain the
 * systems that own execution and completion. Keeping this read model thin
 * means it never creates a second, disagreeing version of "what is done".
 *
 * The union carries only identifiers and safe presentation context. In
 * particular it never serialises frozen question ids, answers, or arbitrary
 * filters that could become an unintended session-creation API.
 */
export const dailyStudyPlanItemSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("RESUME"),
    sessionId: z.string().min(1),
    mode: practiceModeSchema,
    answered: z.int().nonnegative(),
    totalQuestions: z.int().nonnegative(),
  }),
  z.object({
    kind: z.literal("ASSIGNMENT"),
    assignmentId: z.string().min(1),
    classroomId: z.string().min(1),
    classroomName: z.string().min(1),
    subject: subjectSummarySchema,
    title: z.string().min(1),
    questionCount: z.int().positive(),
    timeLimitMinutes: z.int().positive().nullable(),
    dueAt: z.iso.datetime().nullable(),
    /** Unfinished assignments only; retained for an honest, contextual CTA. */
    progress: z.enum(["NOT_STARTED", "IN_PROGRESS"]),
  }),
  z.object({
    kind: z.literal("REVIEW"),
    dueToday: z.int().positive(),
    dueTotal: z.int().positive(),
    count: z.int().min(1).max(REVIEW_DAILY_CAP),
  }),
  z.object({
    kind: z.literal("TOPIC_PRACTICE"),
    subject: subjectSummarySchema,
    chapterId: z.string().min(1).nullable(),
    topicId: z.string().min(1).nullable(),
    title: z.string().min(1),
    reason: z.string().min(1),
    questionCount: z.int().min(1).max(10),
    unseenOnly: z.boolean(),
  }),
]);

export type DailyStudyPlanItem = z.infer<typeof dailyStudyPlanItemSchema>;

/** A maximum of three makes the plan finishable rather than another backlog. */
export const dailyStudyPlanSchema = z.object({
  /** An Indian calendar day (`YYYY-MM-DD`), never a browser-local instant. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z.array(dailyStudyPlanItemSchema).max(3),
});

export type DailyStudyPlan = z.infer<typeof dailyStudyPlanSchema>;
