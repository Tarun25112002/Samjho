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

/**
 * The week ahead.
 *
 * ## Why this is not the daily plan with seven of them
 *
 * `DailyStudyPlan` answers "what do I do right now" and is deliberately one
 * item long — a plan that offers four choices to a student who opened the app
 * to be told what to do has failed at the only thing it was for.
 *
 * A week answers a different question: *am I going to be ready*. It is read on
 * a Sunday evening, not at the start of a session, and what makes it useful is
 * the shape — that Thursday is a mock, that two of the seven days are revision
 * rather than new work, that the weak topic has three separate days on it
 * because one sitting does not fix a topic.
 *
 * ## What the model is and is not allowed to decide
 *
 * The slots are computed. Which topics, how many questions, which days are
 * revision and which are new work — all of that comes from mastery rollups, the
 * revision schedule and the exam date, before any model is asked anything.
 *
 * The model writes the prose: one opening line and one sentence per day saying
 * *why* this is today's work. That split is the whole safety argument. A model
 * that chose the topics could choose a topic the student has never studied, or
 * invent a question count; a model that only explains a slot it was handed can
 * be wrong about the reason, which a student can see and dismiss, rather than
 * wrong about the plan, which they would follow.
 */

export const weeklyFocusKindSchema = z.enum([
  /** Clear what the spaced-repetition schedule says is owed. */
  "REVISION",
  /** New practice on a named topic. */
  "TOPIC",
  /** A full paper, to time. */
  "MOCK",
  /** Nothing scheduled, on purpose. */
  "REST",
]);

export type WeeklyFocusKind = z.infer<typeof weeklyFocusKindSchema>;

export const weeklyFocusSchema = z.object({
  kind: weeklyFocusKindSchema,
  subjectId: z.string().nullable(),
  subjectName: z.string().nullable(),
  topicId: z.string().nullable(),
  topicName: z.string().nullable(),
  /** Zero for REST. Computed from the data, never from the model. */
  questionCount: z.int().nonnegative(),
  /** Rough, and honest about being rough. Drives the day's total. */
  minutes: z.int().nonnegative(),
});

export type WeeklyFocus = z.infer<typeof weeklyFocusSchema>;

export const weeklyPlanDaySchema = z.object({
  /** `YYYY-MM-DD` in IST, like every other study day in this product. */
  date: z.string().min(8).max(10),
  /** "Monday". Rendered rather than derived client-side, so the week reads the same everywhere. */
  label: z.string().min(1).max(12),
  focus: z.array(weeklyFocusSchema).max(3),
  minutes: z.int().nonnegative(),
  /**
   * One sentence on why this is today's work.
   *
   * Written by a model where one answered, and by a deterministic sentence
   * where none did. Either way it describes a slot that was already decided.
   */
  note: z.string().max(240),
});

export type WeeklyPlanDay = z.infer<typeof weeklyPlanDaySchema>;

export const weeklyStudyPlanSchema = z.object({
  weekStart: z.string().min(8).max(10),
  days: z.array(weeklyPlanDaySchema).length(7),
  /** Two sentences at most, addressed to the student. */
  opening: z.string().max(400),
  /**
   * Days until the target exam, when the student has set one.
   *
   * The single most load-bearing number on the page. A week that is one of
   * thirty reads differently from a week that is one of three, and a plan that
   * does not know which it is will pace a student wrongly in one direction or
   * the other.
   */
  daysToExam: z.int().nullable(),
  /** False when no model wrote the prose. The plan itself is unaffected. */
  generated: z.boolean(),
});

export type WeeklyStudyPlan = z.infer<typeof weeklyStudyPlanSchema>;
