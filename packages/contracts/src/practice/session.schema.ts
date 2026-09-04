import { z } from "zod";

import { difficultySchema, questionTypeSchema } from "../question/question-enums.js";
import {
  booleanFlag,
  multiValue,
  pastPaperYearSchema,
  questionAnswerSchema,
  studentQuestionSchema,
  yearsQuerySchema,
} from "../question/question.schema.js";
import { studentAnswerSchema } from "./answer.schema.js";
import {
  evaluationModeSchema,
  mistakeReasonSchema,
  practiceModeSchema,
  sessionStatusSchema,
} from "./practice-enums.js";

/**
 * A practice session, from "build me a set" to "here is what you got wrong".
 *
 * ## The counting rule
 *
 * A case study is **one** question that contains several graded parts. Every
 * count a student sees follows the rule already set in Phase 3 for chapter
 * totals — a paper calls a four-mark case study one question, so this does too.
 *
 * That gives two different units, and both are needed:
 *
 *  - **Items** — what the runner steps through. "Question 3 of 10".
 *  - **Attempts** — what gets graded and what mastery is computed from. A case
 *    study with three sub-parts is one item and three attempts.
 *
 * `totalQuestions` and `answered` count items. `marksEarned` / `marksPossible`
 * sum over attempts, because marks are the honest measure and they add up
 * correctly either way. `correct` counts *items* every part of which was right,
 * which is the strict reading and the only one that does not flatter a student
 * who got one sub-part out of three.
 *
 * ## Where the answer key lives
 *
 * Inside `PracticeAttempt`, and nowhere else. The Phase 3 rule was "two
 * serializers, never one function with a boolean" and it is kept here
 * structurally: `PracticeItem.question` is a `StudentQuestion`, which has no
 * `answer` property to fill in, and the key hangs off the attempt record — an
 * object that cannot exist unless the student has already answered. There is no
 * code path that produces a key without an attempt to attach it to.
 */

// ── Building a set ───────────────────────────────────────────────────────────

/**
 * The filter set, shared by the setup form and the create endpoint.
 *
 * Deliberately the same field names as `listQuestionsQuerySchema` where they
 * overlap, so a "Practise this" link is the browse URL's query string with a
 * different path — which is what makes every such button in the app a plain
 * link rather than a bespoke handler (docs/01 §3).
 */
export const practiceFiltersSchema = z.object({
  subjectId: z.string().min(1).max(60).optional(),
  chapterId: z.string().min(1).max(60).optional(),
  topicId: z.string().min(1).max(60).optional(),
  types: z.array(questionTypeSchema).max(10).optional(),
  difficulties: z.array(difficultySchema).max(3).optional(),
  marks: z.int().min(1).max(20).optional(),
  /**
   * Draw only from these exam years.
   *
   * Independent of `mode`, and that is the point. `PREVIOUS_YEAR` already
   * restricts the pool to board and sample papers; this narrows *which* papers,
   * so "board questions, 2019 to 2024" is one set rather than a mode the
   * enum would have to grow a value for. Applied on its own — in a `CHAPTER`
   * set, say — it means "questions that happen to have come from these years",
   * which is a coherent request and not the same one.
   *
   * Capped at 30 because the range this product covers is 2001 onwards and a
   * student selecting every year of it is asking for no filter at all.
   */
  years: z.array(pastPaperYearSchema).max(30).optional(),
  /**
   * One registered paper, by id — "give me all of 2024 Set 1".
   *
   * The link out of the coverage grid and out of a paper's own page. Exact where
   * `years` is approximate: a year plus a session can still span three regional
   * sets, and rehearsing *a paper* means rehearsing one of them.
   */
  pastPaperId: z.string().min(1).max(60).optional(),
  /**
   * Skip questions this student has already attempted.
   *
   * Off by default, and that is the pedagogically correct default rather than
   * the lazy one: re-meeting a question you got wrong three weeks ago is the
   * product's entire premise. It is on for the one-tap `QUICK` set, where the
   * student asked for something new rather than for something specific.
   */
  unseenOnly: z.boolean().default(false),
});

export type PracticeFilters = z.infer<typeof practiceFiltersSchema>;

/**
 * The same filters arriving as URL query parameters.
 *
 * A separate schema rather than `.coerce` sprinkled over the one above, because
 * query strings and JSON bodies genuinely differ: `types=MCQ,TRUE_FALSE` is one
 * string that has to be split, and `unseenOnly=true` is the four characters
 * `true`. Keeping the coercion here means the JSON body schema stays strict —
 * an API client sending the string `"true"` for a boolean is a bug worth
 * failing on, whereas a browser doing it is just how URLs work.
 */
export const practiceFiltersQuerySchema = z.object({
  subjectId: z.string().min(1).max(60).optional(),
  chapterId: z.string().min(1).max(60).optional(),
  topicId: z.string().min(1).max(60).optional(),
  types: multiValue(questionTypeSchema).optional(),
  difficulties: multiValue(difficultySchema).optional(),
  marks: z.coerce.number().int().min(1).max(20).optional(),
  years: yearsQuerySchema.optional(),
  pastPaperId: z.string().min(1).max(60).optional(),
  unseenOnly: booleanFlag().optional(),
});

/**
 * Set size.
 *
 * Ten is the default because it is roughly fifteen minutes of Class 10 practice
 * — one sitting, on a phone, between other things. Fifty is the ceiling: past
 * that a student is doing a paper, and a paper is the exam engine's job with a
 * timer and a palette, not an endless practice scroll.
 */
export const PRACTICE_COUNT_DEFAULT = 10;
export const PRACTICE_COUNT_MAX = 50;

export const createPracticeSessionSchema = z.object({
  mode: practiceModeSchema,
  filters: practiceFiltersSchema.default({ unseenOnly: false }),
  count: z.int().min(1).max(PRACTICE_COUNT_MAX).default(PRACTICE_COUNT_DEFAULT),
});

export type CreatePracticeSessionInput = z.infer<typeof createPracticeSessionSchema>;

// ── Answering ────────────────────────────────────────────────────────────────

/**
 * One graded unit's answer within a submission.
 *
 * `targetId` is the question a student actually wrote against: the item itself
 * for the nine simple types, and a sub-part id for a case study. Naming it
 * `targetId` rather than `questionId` is a small thing that prevents a large
 * confusion — the submission already has a `questionId`, and they are the same
 * value in nine cases out of ten and different in the case that matters.
 */
export const attemptResponseSchema = z.object({
  targetId: z.string().min(1).max(60),
  answer: studentAnswerSchema,
});

export type AttemptResponse = z.infer<typeof attemptResponseSchema>;

export const submitAttemptSchema = z.object({
  /** The session item being answered — always a top-level question. */
  questionId: z.string().min(1).max(60),
  /** One entry for a simple question; one per sub-part for a case study. */
  responses: z.array(attemptResponseSchema).min(1).max(20),
  /**
   * Client-reported, and treated as a hint rather than a fact: it is used for
   * "you spent 14 minutes" and nothing that scores anything. The exam engine
   * cannot afford that trust and does not take it (docs/04); practice can,
   * because the worst case is a wrong number on a summary card.
   */
  timeSpentMs: z
    .int()
    .min(0)
    .max(6 * 60 * 60 * 1000),
});

export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;

/**
 * Where the student has got to.
 *
 * Its own tiny endpoint rather than a field on the answer submission, because
 * the two happen at different moments: a student answers, reads the feedback,
 * and *then* presses Next — and a set can be navigated without answering at all.
 */
export const updateSessionSchema = z.object({
  currentIndex: z.int().min(0).max(PRACTICE_COUNT_MAX),
});

export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;

export const selfEvaluateSchema = z.object({
  /**
   * What the student awards themselves against the marking scheme. Bounded by
   * the question's marks server-side — the ceiling cannot live here because the
   * schema does not know which question this is.
   */
  marksAwarded: z.number().min(0).max(20),
});

export type SelfEvaluateInput = z.infer<typeof selfEvaluateSchema>;

export const setMistakeReasonSchema = z.object({
  /** Null clears it. Skipping is a first-class outcome, not an omission. */
  reason: mistakeReasonSchema.nullable(),
});

export type SetMistakeReasonInput = z.infer<typeof setMistakeReasonSchema>;

// ── Reading a session back ───────────────────────────────────────────────────

/**
 * A graded attempt, with the key the student has now earned the right to see.
 *
 * `isCorrect` is nullable and that nullability is load-bearing: while a
 * subjective answer waits for self-evaluation it is answered, unscored, and
 * neither right nor wrong. Collapsing that to `false` would count every
 * unscored answer as a mistake and put it in the student's mistake list.
 */
export const practiceAttemptSchema = z.object({
  id: z.string().min(1),
  targetId: z.string().min(1),
  answer: studentAnswerSchema,
  isCorrect: z.boolean().nullable(),
  marksAwarded: z.number(),
  marksPossible: z.number(),
  evaluationMode: evaluationModeSchema,
  mistakeReason: mistakeReasonSchema.nullable(),
  timeSpentMs: z.int(),
  attemptedAt: z.iso.datetime(),
  /**
   * The answer key. Nullable only because a question authored before the
   * Phase 4 validator may have none — not because it is ever withheld from
   * someone who has answered.
   */
  key: questionAnswerSchema.nullable(),
});

export type PracticeAttempt = z.infer<typeof practiceAttemptSchema>;

export const practiceItemSchema = z.object({
  index: z.int().nonnegative(),
  question: studentQuestionSchema,
  /** Empty until answered; one entry per graded unit afterwards. */
  attempts: z.array(practiceAttemptSchema),
  /**
   * Whether this question is in the student's saved list.
   *
   * On the item rather than fetched separately, because the bookmark button sits
   * beside every question in the runner and a per-question lookup is the classic
   * N+1 — one batched query when the session loads, no request when the student
   * moves between questions.
   */
  bookmarked: z.boolean(),
});

export type PracticeItem = z.infer<typeof practiceItemSchema>;

export const practiceTotalsSchema = z.object({
  /** Items, not graded units. A case study counts once. */
  totalQuestions: z.int().nonnegative(),
  answered: z.int().nonnegative(),
  /** Items where every graded part was right. */
  correct: z.int().nonnegative(),
  marksEarned: z.number(),
  marksPossible: z.number(),
  timeSpentMs: z.int().nonnegative(),
  /** Attempts still waiting for the student to score themselves. */
  awaitingSelfEvaluation: z.int().nonnegative(),
});

export type PracticeTotals = z.infer<typeof practiceTotalsSchema>;

export const practiceSessionSchema = z.object({
  id: z.string().min(1),
  mode: practiceModeSchema,
  status: sessionStatusSchema,
  filters: practiceFiltersSchema,
  /** "Electricity" / "Science" — what this set was about, in one phrase. */
  focus: z.string().nullable(),
  currentIndex: z.int().nonnegative(),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  totals: practiceTotalsSchema,
  items: z.array(practiceItemSchema),
});

export type PracticeSession = z.infer<typeof practiceSessionSchema>;

/** The history row. Everything a list needs, none of the question payload. */
export const practiceSessionSummarySchema = practiceSessionSchema.omit({
  items: true,
  filters: true,
  currentIndex: true,
});

export type PracticeSessionSummary = z.infer<typeof practiceSessionSummarySchema>;

/**
 * What answering one item returns.
 *
 * The refreshed totals ride along so the runner's progress bar does not need a
 * second round trip, and so it can never drift from the server's own count.
 */
export const attemptOutcomeSchema = z.object({
  item: practiceItemSchema,
  totals: practiceTotalsSchema,
});

export type AttemptOutcome = z.infer<typeof attemptOutcomeSchema>;

// ── The result page ──────────────────────────────────────────────────────────

export const practiceTopicResultSchema = z.object({
  topicId: z.string().min(1),
  name: z.string().min(1),
  chapterName: z.string().min(1),
  attempted: z.int().positive(),
  correct: z.int().nonnegative(),
  marksEarned: z.number(),
  marksPossible: z.number(),
});

export type PracticeTopicResult = z.infer<typeof practiceTopicResultSchema>;

export const practiceResultSchema = z.object({
  session: practiceSessionSchema,
  /**
   * Per-topic performance *within this session*, not lifetime mastery. A
   * student reading a result page wants to know what just happened; lifetime
   * figures live on the dashboard and would be actively confusing here.
   */
  topics: z.array(practiceTopicResultSchema),
  /**
   * Weak topics, by the same rule the dashboard will use in Phase 8: fewer than
   * half the marks, on at least two attempts. Two is the floor at which "you
   * are weak at this" stops being noise from a single unlucky question.
   */
  weakTopics: z.array(practiceTopicResultSchema),
  /** Items with at least one wrong part — the "practise your N mistakes" CTA. */
  mistakeQuestionIds: z.array(z.string().min(1)),
});

export type PracticeResult = z.infer<typeof practiceResultSchema>;

/** Fewer than half the marks, over enough attempts to mean something. */
export const WEAK_TOPIC_MARK_RATIO = 0.5;
export const WEAK_TOPIC_MIN_ATTEMPTS = 2;

export const listPracticeSessionsQuerySchema = z.object({
  status: sessionStatusSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListPracticeSessionsQuery = z.infer<typeof listPracticeSessionsQuerySchema>;
