import { z } from "zod";

/**
 * AI-assisted marking of a written answer.
 *
 * ## The one rule this whole feature is built around
 *
 * The AI suggests; the student decides. docs/07 R3 commits to AI grading being
 * "assistive, not authoritative — with agreement against self-scores measured
 * before it is trusted", and every shape in this file follows from that.
 *
 * So there is no endpoint that writes a score. The grader returns a suggestion
 * per marking-scheme step, the student accepts or overrides it, and the marks
 * that land on the attempt are the ones *they* confirmed — `evaluationMode`
 * stays `SELF` even when they change nothing. What the grader said is recorded
 * alongside, so that "does it agree with students" becomes a query we can
 * answer before anyone decides to trust it.
 *
 * ## Why per step rather than per question
 *
 * Because "did I get 3 out of 5?" is guesswork and "did I state Gauss's law
 * correctly? (1 mark)" is checkable. A per-question suggestion would be a
 * number a student either believes or does not; a per-step one shows its
 * working, and the student disagreeing with one step out of four is the normal
 * case rather than a failure.
 *
 * It also means a total that agrees for the wrong reasons — two steps wrong in
 * opposite directions — is visible in the data rather than hidden by it.
 */

export const stepVerdictSchema = z.enum(["MET", "PARTIAL", "NOT_MET"]);
export type StepVerdict = z.infer<typeof stepVerdictSchema>;

export const STEP_VERDICT_LABELS = {
  MET: "Fully shown",
  PARTIAL: "Partly shown",
  NOT_MET: "Not shown",
} as const satisfies Record<StepVerdict, string>;

export const gradedStepSchema = z.object({
  /** Position in the marking scheme, so a step can be matched back to it. */
  index: z.int().nonnegative(),
  /** The scheme's own wording, echoed so the UI need not re-join two lists. */
  step: z.string().min(1),
  maxMarks: z.number().nonnegative(),
  verdict: stepVerdictSchema,
  suggestedMarks: z.number().nonnegative(),
  /**
   * Why, in one sentence, quoting the student where possible.
   *
   * The most useful part of the whole response and the reason the verdict is
   * not returned alone: a student who disagrees with "not shown" needs to know
   * what the grader was looking for, and a student who agrees learns more from
   * the reason than from the mark.
   */
  reason: z.string().min(1).max(500),
});

export type GradedStep = z.infer<typeof gradedStepSchema>;

/**
 * How much the grader trusts itself.
 *
 * Reported rather than hidden, and it changes what the UI says. A LOW-confidence
 * suggestion is presented as a starting point to argue with; a HIGH-confidence
 * one still requires the student to confirm it, because none of them is a score.
 */
export const gradingConfidenceSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type GradingConfidence = z.infer<typeof gradingConfidenceSchema>;

export const gradingSuggestionSchema = z.object({
  attemptId: z.string().min(1),
  questionId: z.string().min(1),
  maxMarks: z.number().positive(),
  suggestedMarks: z.number().nonnegative(),
  steps: z.array(gradedStepSchema),
  confidence: gradingConfidenceSchema,
  /**
   * One sentence on what the grader could not judge — illegible working, a
   * diagram it cannot see, an approach it does not recognise. Empty when there
   * is nothing to flag, and never padded to look thorough.
   */
  caveat: z.string().max(400),
  /**
   * False when no model answered and this came from a deterministic fallback.
   *
   * The fallback suggests nothing: it returns the scheme with every step
   * unjudged, so the student self-evaluates exactly as they would have before.
   * Saying so on the response is what stops the UI claiming a grader ran.
   */
  generated: z.boolean(),
});

export type GradingSuggestion = z.infer<typeof gradingSuggestionSchema>;

export const requestGradingSchema = z.object({
  /**
   * Re-grade even if a suggestion is already stored.
   *
   * Off by default: a student reopening a result page should see the same
   * suggestion they saw before, not a freshly sampled one that might disagree
   * with the marks they have already accepted — and every regrade is another
   * model call against a quota.
   */
  refresh: z.boolean().default(false),
});

export type RequestGradingInput = z.infer<typeof requestGradingSchema>;

/**
 * Accepting or overriding the suggestion.
 *
 * `marksAwarded` is what the student is awarding themselves, per step. The
 * server sums and clamps it against the question's marks — a client that sends
 * more than the step allows is corrected rather than believed.
 */
export const confirmGradingSchema = z.object({
  steps: z
    .array(
      z.object({
        index: z.int().nonnegative(),
        marksAwarded: z.number().nonnegative().max(20),
      }),
    )
    .min(1)
    .max(20),
});

export type ConfirmGradingInput = z.infer<typeof confirmGradingSchema>;

/**
 * How often the grader and the student agree.
 *
 * The number docs/07 R3 says has to exist before AI grading could ever be
 * promoted from assistive to authoritative. Exposed to staff rather than to
 * students: it is a fact about the product, not about their revision.
 */
export const gradingAgreementSchema = z.object({
  sampled: z.int().nonnegative(),
  /** Suggestions the student accepted without changing a step. */
  acceptedUnchanged: z.int().nonnegative(),
  /** Mean absolute difference in marks, over the sampled attempts. */
  meanAbsoluteError: z.number().nonnegative().nullable(),
  /** Share of attempts where the totals matched exactly. */
  exactAgreement: z.number().min(0).max(1).nullable(),
  /** Positive means the grader is more generous than students on average. */
  meanBias: z.number().nullable(),
});

export type GradingAgreement = z.infer<typeof gradingAgreementSchema>;

/**
 * What confirming returns.
 *
 * The awarded total and the verdict the server derived from it, so a caller can
 * show the outcome immediately — while still refreshing, because a scored
 * answer moves the section totals and the overall result too, and those are
 * computed server-side.
 */
export const confirmGradingResultSchema = z.object({
  marksAwarded: z.number().nonnegative(),
  maxMarks: z.number().positive(),
  isCorrect: z.boolean().nullable(),
});

export type ConfirmGradingResult = z.infer<typeof confirmGradingResultSchema>;
