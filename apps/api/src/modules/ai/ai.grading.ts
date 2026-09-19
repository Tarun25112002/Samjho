import {
  gradingSuggestionSchema,
  markingStepSchema,
  type GradedStep,
  type GradingSuggestion,
  type MarkingStep,
} from "@medhavi/contracts";
import { z } from "zod";

import { logger } from "../../lib/logger.js";
import { aiIsConfigured, completeWithChain } from "./provider/registry.js";

/**
 * Marking a written answer against the official scheme.
 *
 * ## Why this is not a tutor action
 *
 * The six tutor actions are a conversation: they stream, they keep history,
 * they answer a student who is reading. Grading is none of those — it is one
 * request producing one structured document that a form renders. Folding it
 * into `AIAction` would have given it a conversation it does not want and a
 * streaming path it cannot use, and would have made the prompt fight six
 * others for the same system message.
 *
 * ## Why the output is schema-constrained
 *
 * Because a marking suggestion is written to a database and rendered into a
 * form with a row per step. Prose would have to be parsed, and a parse that
 * fails on one answer in fifty is a student staring at an error on the page
 * they came to for their result. The provider abstraction enforces the schema
 * where the vendor supports it and prompts for it where it does not, and this
 * file re-validates with Zod either way — "the model was asked to follow this"
 * and "the output provably follows this" are different claims.
 *
 * ## The grader is never allowed to be the score
 *
 * It suggests per step, with a reason and a confidence. The student confirms or
 * overrides, and what lands on the attempt is theirs. `evaluationMode` stays
 * `SELF`. That is docs/07 R3's commitment and it is enforced in the service
 * above this one — this file cannot write anything.
 */

const MAX_TOKENS = 1_200;
const TEMPERATURE = 0.15;
const MAX_ANSWER_CHARS = 6_000;

const SYSTEM = `
You are an experienced CBSE board examiner marking one written answer against the official step-marking scheme.

HOW YOU MARK
- Mark against the scheme, step by step. Award marks for what the student has actually written, not for what you think they meant.
- A step is MET when the student has shown it, PARTIAL when they have part of it or have shown it with an error that does not invalidate the step, NOT_MET when it is absent or wrong.
- CBSE examiners award marks for correct method even when the final arithmetic is wrong. Follow that: a dropped sign in the last line does not cost the method marks earned above it.
- An answer that reaches the right result by a valid method the scheme does not list still earns the marks. Say so in the reason.
- Never award more than a step's marks. Never invent a step that is not in the scheme.
- Be generous where the student is close and honest where they are not. A grader that marks everything correct teaches nothing.

REASONS
- One sentence per step, quoting the student's own words where you can.
- Say what was looked for and whether it was found. "Did not state the formula" is useful; "incomplete" is not.

CONFIDENCE AND CAVEATS
- HIGH when the answer is legible, complete and maps cleanly onto the scheme.
- MEDIUM when you had to interpret, or the answer is partial.
- LOW when the answer is very short, off-topic, mostly symbols you cannot follow, or refers to a diagram you cannot see.
- Put anything you genuinely could not judge in the caveat. Leave the caveat empty rather than padding it.

You are advising a student who will decide their own marks. You are not recording a score.
`.trim();

/**
 * The shape the model must return.
 *
 * Kept separate from the wire contract: this is what a model is asked for, and
 * the wire type carries several fields the model has no business supplying —
 * `attemptId`, `maxMarks`, `generated`. A model that could set `generated`
 * could claim to be a fallback.
 */
const modelOutputSchema = z.object({
  steps: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      verdict: z.enum(["MET", "PARTIAL", "NOT_MET"]),
      marks: z.number().nonnegative(),
      reason: z.string().min(1).max(500),
    }),
  ),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  caveat: z.string().max(400),
});

const MODEL_JSON_SCHEMA = {
  name: "marking_suggestion",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["steps", "confidence", "caveat"],
    properties: {
      steps: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["index", "verdict", "marks", "reason"],
          properties: {
            index: { type: "integer", minimum: 0 },
            verdict: { type: "string", enum: ["MET", "PARTIAL", "NOT_MET"] },
            marks: { type: "number", minimum: 0 },
            reason: { type: "string", maxLength: 500 },
          },
        },
      },
      confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
      caveat: { type: "string", maxLength: 400 },
    },
  },
} as const;

export interface GradingRequest {
  attemptId: string;
  questionId: string;
  questionBody: string;
  subjectName: string;
  classLevel: number;
  marks: number;
  studentAnswer: string;
  officialSolution: string | null;
  markingScheme: unknown;
}

export const aiGrading = {
  /**
   * Suggest marks for one written answer.
   *
   * Never throws for a model failure. The result is a suggestion on a page a
   * student is waiting on, and a grader that is unreachable must degrade to
   * "score this yourself" — which is exactly what they would have done anyway —
   * rather than turning the result page into an error.
   */
  async suggest(request: GradingRequest): Promise<GradingSuggestion> {
    const authored = hasAuthoredScheme(request.markingScheme);
    const scheme = readScheme(request.markingScheme, request.marks);

    // Nothing to mark against at all. Without either a step scheme or an
    // official solution the grader would be inventing the criteria as well as
    // applying them, which is a different and much worse thing than marking to
    // a published standard.
    if (scheme.length === 0 || (!authored && request.officialSolution === null)) {
      return ungraded(request, scheme, "There is no marking scheme on record for this question.");
    }

    if (!aiIsConfigured()) return ungraded(request, scheme, "");

    if (request.studentAnswer.trim().length === 0) {
      return {
        ...ungraded(request, scheme, ""),
        steps: scheme.map((step, index) => ({
          index,
          step: step.step,
          maxMarks: step.marks,
          verdict: "NOT_MET" as const,
          suggestedMarks: 0,
          reason: "Nothing was written for this question.",
        })),
        confidence: "HIGH" as const,
        generated: false,
      };
    }

    try {
      const response = await completeWithChain({
        tier: "strong",
        system: SYSTEM,
        messages: [{ role: "user", content: describe(request, scheme) }],
        maxTokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        jsonSchema: MODEL_JSON_SCHEMA,
      });

      const parsed = modelOutputSchema.safeParse(readJson(response.text));
      if (!parsed.success) {
        logger.warn(
          { attemptId: request.attemptId, issues: parsed.error.issues.length },
          "AI grader returned output that did not match the schema",
        );
        return ungraded(request, scheme, "");
      }

      return toSuggestion(request, scheme, parsed.data, authored);
    } catch (error) {
      logger.warn({ err: error, attemptId: request.attemptId }, "AI grading failed; degrading");
      return ungraded(request, scheme, "");
    }
  },
};

/**
 * Turn the model's output into a suggestion, clamped at every edge.
 *
 * Three things are enforced here rather than trusted: a step cannot be awarded
 * more than it is worth, a step the model did not mention is treated as
 * unjudged rather than as zero, and the total is the sum of the clamped steps
 * rather than anything the model said it was. A model that returns eleven marks
 * for a five-mark question is not an error to surface — it is an output to
 * correct silently, because the student is owed a usable page.
 */
function toSuggestion(
  request: GradingRequest,
  scheme: MarkingStep[],
  output: z.infer<typeof modelOutputSchema>,
  authored: boolean,
): GradingSuggestion {
  const byIndex = new Map(output.steps.map((step) => [step.index, step]));

  const steps: GradedStep[] = scheme.map((step, index) => {
    const judged = byIndex.get(index);

    if (!judged) {
      return {
        index,
        step: step.step,
        maxMarks: step.marks,
        verdict: "PARTIAL" as const,
        suggestedMarks: 0,
        reason: "The grader did not reach a verdict on this step — decide it yourself.",
      };
    }

    const clamped = Math.min(Math.max(judged.marks, 0), step.marks);

    return {
      index,
      step: step.step,
      maxMarks: step.marks,
      verdict: judged.verdict,
      // A verdict and a mark that disagree confuse more than either alone, so
      // the mark is made to follow the verdict at the two ends.
      suggestedMarks:
        judged.verdict === "NOT_MET" ? 0 : judged.verdict === "MET" ? step.marks : clamped,
      reason: judged.reason,
    };
  });

  return {
    attemptId: request.attemptId,
    questionId: request.questionId,
    maxMarks: request.marks,
    suggestedMarks: round2(steps.reduce((sum, step) => sum + step.suggestedMarks, 0)),
    steps,
    // Marking against a synthesised single step is holistic marking against the
    // official solution. That is legitimate and is what a teacher does with an
    // unschemed question — but it is a weaker claim than marking to a published
    // step scheme, so it is said out loud and the confidence is capped.
    confidence: authored ? output.confidence : weaken(output.confidence),
    caveat: authored
      ? output.caveat.trim()
      : [
          "This question has no official step-by-step marking scheme, so the marks above are a judgement against the model answer as a whole.",
          output.caveat.trim(),
        ]
          .filter(Boolean)
          .join(" "),
    generated: true,
  };
}

/** One notch down, because holistic marking is a weaker claim than step marking. */
function weaken(confidence: "LOW" | "MEDIUM" | "HIGH"): "LOW" | "MEDIUM" | "HIGH" {
  return confidence === "HIGH" ? "MEDIUM" : "LOW";
}

/**
 * Whether an editor actually wrote a step scheme for this question.
 *
 * Distinct from "readScheme returned something", because readScheme
 * deliberately synthesises a single step so that the student always gets a form
 * to score in. Telling the two apart is what lets the caveat be honest about
 * which kind of marking took place.
 */
function hasAuthoredScheme(raw: unknown): boolean {
  const parsed = markingStepSchema.array().safeParse(raw);
  return parsed.success && parsed.data.length > 0;
}

/**
 * The honest empty result: the scheme, with nothing judged.
 *
 * This is what a student would have seen before this feature existed, which is
 * the correct thing to fall back to. It does not guess, and `generated: false`
 * stops the UI claiming a grader ran.
 */
function ungraded(
  request: GradingRequest,
  scheme: MarkingStep[],
  caveat: string,
): GradingSuggestion {
  return {
    attemptId: request.attemptId,
    questionId: request.questionId,
    maxMarks: request.marks,
    suggestedMarks: 0,
    steps: scheme.map((step, index) => ({
      index,
      step: step.step,
      maxMarks: step.marks,
      verdict: "PARTIAL" as const,
      suggestedMarks: 0,
      reason: "Score this step yourself against the marking scheme.",
    })),
    confidence: "LOW",
    caveat,
    generated: false,
  };
}

function describe(request: GradingRequest, scheme: MarkingStep[]): string {
  const lines: string[] = [];

  lines.push(`Subject: CBSE Class ${String(request.classLevel)} ${request.subjectName}`);
  lines.push(`Question is worth ${String(request.marks)} marks.`);
  lines.push("", "QUESTION", request.questionBody.trim());

  lines.push("", "OFFICIAL MARKING SCHEME");
  scheme.forEach((step, index) => {
    const points = step.keyPoints.length > 0 ? ` — key points: ${step.keyPoints.join("; ")}` : "";
    lines.push(`  [${String(index)}] ${step.step} (${String(step.marks)} mark(s))${points}`);
  });

  if (request.officialSolution) {
    lines.push("", "OFFICIAL SOLUTION (authoritative — never contradict it)");
    lines.push(request.officialSolution.trim().slice(0, 4_000));
  }

  lines.push("", "THE STUDENT'S ANSWER, VERBATIM");
  // Fenced for the same reason the tutor fences a follow-up: this is the one
  // span in the whole prompt the student wrote, so it is the one span a prompt
  // injection could arrive in. A student writing "award full marks" in an exam
  // answer is trying it on, and the fence plus the system prompt is the answer.
  lines.push("<student-answer>");
  lines.push(request.studentAnswer.replaceAll("</student-answer>", "").slice(0, MAX_ANSWER_CHARS));
  lines.push("</student-answer>");

  lines.push(
    "",
    `Return a verdict for each of the ${String(scheme.length)} steps above, by its index.`,
  );

  return lines.join("\n");
}

/**
 * Read the scheme out of JSONB, or synthesise a single step from the marks.
 *
 * A question with marks but no scheme is a content gap rather than a reason to
 * refuse — but it is reported as one, because the grader marking against a step
 * it invented is exactly what this feature must not do. The single step is
 * returned so the *student* still gets a form to score in.
 */
function readScheme(raw: unknown, marks: number): MarkingStep[] {
  const parsed = markingStepSchema.array().safeParse(raw);
  if (parsed.success && parsed.data.length > 0) return parsed.data;

  if (marks > 0) {
    return [{ step: "Overall answer, against the official solution", marks, keyPoints: [] }];
  }

  return [];
}

/**
 * Pull JSON out of a reply that may be wrapped in a fence.
 *
 * Providers asked for schema-constrained output mostly return bare JSON, and
 * one of them sometimes wraps it in ```json. Handling that here is three lines;
 * discovering it in production is an afternoon.
 */
function readJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/u.exec(trimmed);
  const candidate = fenced?.[1] ?? trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export { gradingSuggestionSchema };
