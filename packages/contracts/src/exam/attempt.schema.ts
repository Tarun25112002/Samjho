import { z } from "zod";

import { studentQuestionSchema, questionAnswerSchema } from "../question/question.schema.js";
import { evaluationModeSchema } from "../practice/practice-enums.js";
import { examPaperSummarySchema } from "./paper.schema.js";

/**
 * Sitting a paper: the wire contract for the exam runner.
 *
 * ## The two rules this file exists to keep
 *
 * **The clock is the server's.** Every response carries `serverTime`, and the
 * runner renders `deadlineAt − (clientNow + offset)` rather than counting down
 * from a number it was handed. A phone whose clock is twenty minutes fast, a
 * laptop that slept for half an hour, and a student who set the system clock
 * back are all the same case, and all three are answered by the deadline being
 * an absolute instant the client never computes (docs/04 §2).
 *
 * **No answer key reaches a live attempt.** `ExamItem.question` is a
 * `StudentQuestion`, which structurally has no `answer` property. The key
 * appears only on `ExamResultItem`, which cannot exist before the attempt is
 * submitted. This is the same structural defence Phase 3 set up for practice,
 * and it is why an answer key cannot be sniffed out of the runner's payload.
 */

export const examAttemptStatusSchema = z.enum([
  "IN_PROGRESS",
  "SUBMITTED",
  "EVALUATING",
  "COMPLETED",
  "ABANDONED",
]);
export type ExamAttemptStatus = z.infer<typeof examAttemptStatusSchema>;

export const submissionReasonSchema = z.enum([
  "STUDENT",
  "AUTO_TIMEOUT_CLIENT",
  "AUTO_TIMEOUT_SERVER",
  "AUTO_TIMEOUT_SWEEPER",
  "ADMIN",
]);
export type SubmissionReason = z.infer<typeof submissionReasonSchema>;

/**
 * Where a slot has got to, as the palette draws it.
 *
 * Five states rather than a pair of booleans, because the palette renders one
 * glyph per slot and a state machine with a name per cell is what a screen
 * reader can announce. `ANSWERED_AND_MARKED` is a real and common state: a
 * student who answered but wants to come back.
 */
export const answerStatusSchema = z.enum([
  "UNANSWERED",
  "ANSWERED",
  "MARKED_FOR_REVIEW",
  "ANSWERED_AND_MARKED",
]);
export type AnswerStatus = z.infer<typeof answerStatusSchema>;

export const ANSWER_STATUS_LABELS = {
  UNANSWERED: "not answered",
  ANSWERED: "answered",
  MARKED_FOR_REVIEW: "marked for review",
  ANSWERED_AND_MARKED: "answered and marked for review",
} as const satisfies Record<AnswerStatus, string>;

/** What a student wrote. The same shape practice uses, for the same reasons. */
export const examAnswerValueSchema = z.object({
  optionIds: z.array(z.string().min(1)).max(10),
  text: z.string().max(20_000),
});

export type ExamAnswerValue = z.infer<typeof examAnswerValueSchema>;

export const EMPTY_EXAM_ANSWER: ExamAnswerValue = { optionIds: [], text: "" };

/**
 * One position in the paper, with whatever the student has put in it.
 *
 * `items` is plural because a slot with internal choice holds two questions —
 * "Q29" and "Q29 OR" — and the student picks one. `chosenItemId` records which,
 * and only the chosen one is scored.
 */
export const examItemSchema = z.object({
  slotId: z.string().min(1),
  sectionId: z.string().min(1),
  sectionName: z.string().min(1),
  questionNumber: z.int().positive(),
  orderIndex: z.int().nonnegative(),
  marks: z.int().positive(),
  isOptional: z.boolean(),

  items: z.array(
    z.object({
      id: z.string().min(1),
      variantLabel: z.enum(["MAIN", "OR"]),
      question: studentQuestionSchema,
    }),
  ),

  chosenItemId: z.string().min(1).nullable(),
  answer: examAnswerValueSchema,
  status: answerStatusSchema,
  /** Monotonic per slot. A lower revision never overwrites a higher one. */
  revision: z.int().nonnegative(),
  timeSpentMs: z.int().nonnegative(),
  visitCount: z.int().nonnegative(),
});

export type ExamItem = z.infer<typeof examItemSchema>;

export const examAttemptSchema = z.object({
  id: z.string().min(1),
  paper: examPaperSummarySchema,
  generalInstructions: z.array(z.string()),
  status: examAttemptStatusSchema,

  startedAt: z.iso.datetime(),
  /**
   * The absolute instant this attempt ends. Computed once at creation from the
   * paper's duration and never recomputed — not on resume, not on reconnect.
   */
  deadlineAt: z.iso.datetime(),
  submittedAt: z.iso.datetime().nullable(),
  submissionReason: submissionReasonSchema.nullable(),

  /**
   * The server's clock when it built this response.
   *
   * The runner takes the difference against its own clock once and applies that
   * offset to every subsequent render. Re-synced on each heartbeat, on tab
   * visibility change and on reconnect, so a laptop waking from sleep corrects
   * itself immediately rather than showing a countdown that is half an hour out.
   */
  serverTime: z.iso.datetime(),

  items: z.array(examItemSchema),
  totalMarks: z.int().positive(),
});

export type ExamAttempt = z.infer<typeof examAttemptSchema>;

// ── Starting one ─────────────────────────────────────────────────────────────

export const startExamAttemptSchema = z.object({
  paperId: z.string().min(1).max(60),
  /**
   * Supplied by the client, and the reason a double-tapped "Start exam" cannot
   * produce two attempts with two timers. The server stores it unique, so the
   * second request returns the first attempt rather than creating a rival.
   */
  idempotencyKey: z.string().min(8).max(64),
});

export type StartExamAttemptInput = z.infer<typeof startExamAttemptSchema>;

// ── Saving an answer ─────────────────────────────────────────────────────────

export const saveExamAnswerSchema = z.object({
  answer: examAnswerValueSchema,
  status: answerStatusSchema,
  /** Null until the student picks a side of an internal choice. */
  chosenItemId: z.string().min(1).max(60).nullable(),
  /**
   * Client-incremented, per slot. The server accepts the write only when this
   * is at least the stored revision, which settles the two-tabs and
   * retried-request races deterministically and without a lock.
   */
  revision: z.int().nonnegative(),
  timeSpentMs: z
    .int()
    .min(0)
    .max(6 * 60 * 60 * 1000),
});

export type SaveExamAnswerInput = z.infer<typeof saveExamAnswerSchema>;

export const saveExamAnswerResultSchema = z.object({
  slotId: z.string().min(1),
  revision: z.int().nonnegative(),
  status: answerStatusSchema,
  savedAt: z.iso.datetime(),
  serverTime: z.iso.datetime(),
  /**
   * False when the write was refused because a higher revision already exists.
   *
   * Not an error: the other tab's newer answer is the correct one to keep, and
   * the losing client should adopt the returned revision rather than retrying.
   */
  accepted: z.boolean(),
});

export type SaveExamAnswerResult = z.infer<typeof saveExamAnswerResultSchema>;

export const examHeartbeatSchema = z.object({
  serverTime: z.iso.datetime(),
  deadlineAt: z.iso.datetime(),
  status: examAttemptStatusSchema,
  /** Milliseconds left, computed by the server so nothing depends on the client's clock. */
  remainingMs: z.int(),
});

export type ExamHeartbeat = z.infer<typeof examHeartbeatSchema>;

export const submitExamAttemptSchema = z.object({
  /**
   * Why the client is submitting. `AUTO_TIMEOUT_CLIENT` when the countdown hit
   * zero, `STUDENT` when they pressed the button.
   *
   * Advisory: the server records it, but the server's own deadline check is
   * what decides whether the attempt was in time. Telling the three automatic
   * reasons apart matters operationally — a spike in sweeper submissions means
   * students are losing sessions somewhere upstream.
   */
  reason: z.enum(["STUDENT", "AUTO_TIMEOUT_CLIENT"]).default("STUDENT"),
});

export type SubmitExamAttemptInput = z.infer<typeof submitExamAttemptSchema>;

// ── The result ───────────────────────────────────────────────────────────────

export const examResultItemSchema = z.object({
  slotId: z.string().min(1),
  sectionName: z.string().min(1),
  questionNumber: z.int().positive(),
  marks: z.int().positive(),
  question: studentQuestionSchema,
  answer: examAnswerValueSchema,
  /** Null while a subjective answer is still awaiting self-evaluation. */
  isCorrect: z.boolean().nullable(),
  marksAwarded: z.number().nonnegative(),
  evaluationMode: evaluationModeSchema,
  /** The key, now that the attempt is over and the student has earned it. */
  key: questionAnswerSchema.nullable(),
  /** The attempt row to score, when this one is waiting on the student. */
  attemptId: z.string().min(1).nullable(),
});

export type ExamResultItem = z.infer<typeof examResultItemSchema>;

export const examSectionResultSchema = z.object({
  sectionId: z.string().min(1),
  name: z.string().min(1),
  marksAwarded: z.number().nonnegative(),
  marksPossible: z.int().nonnegative(),
  attempted: z.int().nonnegative(),
  total: z.int().nonnegative(),
});

export type ExamSectionResult = z.infer<typeof examSectionResultSchema>;

/**
 * The scoreboard, split rather than blended.
 *
 * Objective marks were computed by the server against a stored key. Subjective
 * marks were awarded by the student against the official step-marking scheme.
 * Those are different kinds of claim and the result page says so — a single
 * number presented as if it were an official score would be the one dishonest
 * thing in this product (docs/04 §5).
 */
export const examScoreSchema = z.object({
  objectiveAwarded: z.number().nonnegative(),
  objectivePossible: z.int().nonnegative(),
  selfAssessedAwarded: z.number().nonnegative(),
  selfAssessedPossible: z.int().nonnegative(),
  /** Still to be scored by the student. Until it is zero, the total is partial. */
  awaitingSelfEvaluation: z.int().nonnegative(),
  totalAwarded: z.number().nonnegative(),
  totalPossible: z.int().positive(),
});

export type ExamScore = z.infer<typeof examScoreSchema>;

export const examResultSchema = z.object({
  attempt: examAttemptSchema.omit({ items: true }),
  score: examScoreSchema,
  sections: z.array(examSectionResultSchema),
  items: z.array(examResultItemSchema),
  /** Wall-clock time actually used, from start to submission. */
  timeTakenMs: z.int().nonnegative(),
  /** True when the clock ran out rather than the student finishing. */
  expired: z.boolean(),
});

export type ExamResult = z.infer<typeof examResultSchema>;

export const listExamAttemptsQuerySchema = z.object({
  status: examAttemptStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListExamAttemptsQuery = z.infer<typeof listExamAttemptsQuerySchema>;

export const examAttemptSummarySchema = z.object({
  id: z.string().min(1),
  paper: examPaperSummarySchema,
  status: examAttemptStatusSchema,
  startedAt: z.iso.datetime(),
  deadlineAt: z.iso.datetime(),
  submittedAt: z.iso.datetime().nullable(),
  totalAwarded: z.number().nonnegative().nullable(),
  totalPossible: z.int().positive(),
  awaitingSelfEvaluation: z.int().nonnegative(),
});

export type ExamAttemptSummary = z.infer<typeof examAttemptSummarySchema>;
