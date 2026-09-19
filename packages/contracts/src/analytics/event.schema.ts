import { z } from "zod";

/**
 * Learning analytics, and the boundary around it.
 *
 * Every user of this platform is a 14-16 year-old. The DPDP Act 2023 prohibits
 * behavioural tracking directed at children and docs/06 commits to zero
 * third-party tracking SDKs, permanently. So this vocabulary is deliberately
 * small, first-party, and about the *product* rather than about the person:
 * what happened inside a question set, joined to a user by an id we own.
 *
 * The props below are an allow-list rather than a free-form bag. An untyped
 * `Record<string, unknown>` is how a table like this quietly becomes the profile
 * it promised not to be — one well-meaning `deviceInfo` at a time.
 */

export const learningEventTypeSchema = z.enum([
  "ASSESSMENT_STARTED",
  "QUESTION_VIEWED",
  "ANSWER_SUBMITTED",
  "HINT_REQUESTED",
  "QUESTION_MARKED",
  "ASSESSMENT_COMPLETED",
  "RECOMMENDATION_CLICKED",
  "SIMILAR_QUESTION_STARTED",
]);

export type LearningEventType = z.infer<typeof learningEventTypeSchema>;

/**
 * The events a browser is allowed to report.
 *
 * The rest are emitted server-side from the service that actually performs the
 * action, because an event a client can assert is an event a client can lie
 * about — and "assessment completed" deciding a streak on a student's say-so is
 * a worse bug than a missing data point.
 */
export const CLIENT_REPORTABLE_EVENTS = [
  "QUESTION_VIEWED",
  "QUESTION_MARKED",
  "RECOMMENDATION_CLICKED",
  "SIMILAR_QUESTION_STARTED",
] as const satisfies readonly LearningEventType[];

export const clientEventTypeSchema = z.enum(CLIENT_REPORTABLE_EVENTS);
export type ClientEventType = z.infer<typeof clientEventTypeSchema>;

/**
 * The only properties an event may carry.
 *
 * All optional, all numbers or short enums, none of them identifying anything
 * outside this product. There is no free-text field on purpose: free text is
 * where a student's name ends up.
 */
export const learningEventPropsSchema = z.object({
  /** Position within the set, for "where do students stop". */
  index: z.int().nonnegative().max(200).optional(),
  /** How long the set was, so an index means something. */
  total: z.int().nonnegative().max(200).optional(),
  /** Milliseconds the student had the question on screen. */
  dwellMs: z
    .int()
    .nonnegative()
    .max(6 * 60 * 60 * 1000)
    .optional(),
  /** 1-5, the difficulty the engine was aiming at. */
  targetLevel: z.int().min(1).max(5).optional(),
  /** Whether a marked question was being marked or unmarked. */
  marked: z.boolean().optional(),
  /** Which surface a recommendation was taken from. */
  surface: z.enum(["DASHBOARD", "RESULT", "ANALYSIS", "ASSESSMENT", "REVISION"]).optional(),
  correct: z.boolean().optional(),
  hintUsed: z.boolean().optional(),
});

export type LearningEventProps = z.infer<typeof learningEventPropsSchema>;

export const recordEventSchema = z.object({
  type: clientEventTypeSchema,
  /**
   * Both optional, and both checked against the caller's own rows server-side.
   * A session id from a request body is a claim, not a fact.
   */
  sessionId: z.string().min(1).max(60).optional(),
  questionId: z.string().min(1).max(60).optional(),
  props: learningEventPropsSchema.default({}),
});

export type RecordEventInput = z.infer<typeof recordEventSchema>;

/** A batch, because a runner accumulates several between navigations. */
export const recordEventsSchema = z.object({
  events: z.array(recordEventSchema).min(1).max(20),
});

export type RecordEventsInput = z.infer<typeof recordEventsSchema>;

export const recordEventsResultSchema = z.object({
  /** How many were stored. Fewer than sent means some were dropped as unowned. */
  recorded: z.int().nonnegative(),
});

export type RecordEventsResult = z.infer<typeof recordEventsResultSchema>;
