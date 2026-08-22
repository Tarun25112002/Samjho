import { z } from "zod";

import {
  bloomLevelSchema,
  difficultySchema,
  isAutoGradable,
  licenceStatusSchema,
  questionStatusSchema,
  questionTypeSchema,
  type QuestionStatus,
  type QuestionType,
} from "./question-enums.js";
import {
  assetKindSchema,
  markingStepSchema,
  multiValue,
  sourceTypeSchema,
} from "./question.schema.js";

/**
 * Authoring a question: the write shape, and the rules that make a question
 * *valid* rather than merely well-formed.
 *
 * ## Why the rules live here and not in the form
 *
 * "An MCQ has exactly one correct option" is a fact about CBSE questions. It has
 * to hold for a question typed into the admin form, for one arriving through
 * bulk import, and for one written by a contractor's script hitting the API
 * directly. Encoding it in the React form gives you one enforcement point and
 * two holes; encoding it here gives all three paths the same answer from one
 * definition — which is also `docs/01` §15's "no business logic inside UI
 * components", applied to the case where it actually costs something.
 *
 * The payoff shows up in `QUESTION_TYPE_RULES`: the admin form reads that table
 * to decide whether to render an options editor at all, so the form and the
 * validator cannot disagree about what a `NUMERICAL` question needs.
 *
 * ## Why a draft must still be valid
 *
 * There is no half-filled draft in this design. `DRAFT` means "complete, not yet
 * published" — not "partially entered". Allowing invalid drafts sounds kind to
 * the author and is expensive everywhere else: every consumer downstream then
 * has to cope with a question that has no answer, and the draft state quietly
 * becomes the place broken content accumulates. Parking half-written work is
 * what the import file is for.
 *
 * ## Why provenance is required
 *
 * `QuestionSource` is nullable in the database because it was added for existing
 * rows; on this path it is required. Commercial intent makes copyright a
 * critical risk (docs/07 R2), and the mitigation only works if "where did this
 * come from" is impossible to skip. If you wrote it, the answer is `ORIGINAL` —
 * one click, not an exemption.
 */

// ── Field-level shapes ───────────────────────────────────────────────────────

/** Markdown with `$…$` maths, rendered by `MathText` — never as raw HTML. */
const bodySchema = z.string().trim().min(10).max(8000);

/**
 * Looser than `bodySchema` on purpose.
 *
 * A question stem under ten characters is a mistake; a *solution* under ten
 * characters is routine — the answer to "state the peak current drawn" is
 * "8 A", and the sub-parts of a case study are full of exactly that. A floor of
 * ten would make an editor pad it into a sentence to get past the form, which
 * degrades the content in order to satisfy a rule that was guessing.
 *
 * Two characters still catches the real slip, which is an empty box or a stray
 * keystroke.
 */
const solutionSchema = z.string().trim().min(2).max(8000);

/**
 * Marks per question. The ceiling is a typo guard, not a claim about CBSE: the
 * largest single question in either MVP paper is 5 marks, and the largest
 * case-based container is 4.
 */
const marksSchema = z.int().min(1).max(20);

/** "A", "B", "C", "D" as printed on the paper. */
const optionLabelSchema = z.string().trim().min(1).max(4);

export const questionOptionInputSchema = z.object({
  label: optionLabelSchema,
  body: z.string().trim().min(1).max(2000),
  isCorrect: z.boolean().default(false),
});

export type QuestionOptionInput = z.infer<typeof questionOptionInputSchema>;

export const questionAssetInputSchema = z.object({
  kind: assetKindSchema,
  url: z.string().trim().min(1).max(2000),
  /**
   * Required here exactly as it is in the database. A circuit diagram with no
   * alt text is a question a blind student cannot attempt, and the moment bulk
   * entry starts, "we'll fill it in later" means never.
   */
  altText: z.string().trim().min(1).max(500),
  caption: z.string().trim().max(500).nullable().default(null),
});

export type QuestionAssetInput = z.infer<typeof questionAssetInputSchema>;

/**
 * Provenance as the editor records it — the full internal record, including the
 * licensing decision that `questionProvenanceSchema` deliberately withholds from
 * students.
 */
export const questionSourceInputSchema = z
  .object({
    sourceType: sourceTypeSchema,
    year: z.int().min(1990).max(2100).nullable().default(null),
    /** "Feb 2026" / "May 2026" — Class 10 now has two sittings. */
    examSession: z.string().trim().max(40).nullable().default(null),
    paperCode: z.string().trim().max(40).nullable().default(null),
    setNumber: z.string().trim().max(20).nullable().default(null),
    originalQuestionNumber: z.string().trim().max(20).nullable().default(null),
    sourceUrl: z.url().max(2000).nullable().default(null),
    licenceStatus: licenceStatusSchema.default("NEEDS_REVIEW"),
    attributionText: z.string().trim().max(500).nullable().default(null),
    reviewNotes: z.string().trim().max(2000).nullable().default(null),
  })
  .check((ctx) => {
    const value = ctx.value;

    // Attribution is the entire adapted-and-attributed position (docs/07 Q6).
    // A question derived from someone else's paper with nothing to display next
    // to it is the exact case the position exists to prevent, so it cannot be
    // entered rather than being caught in a later audit of 2,000 rows.
    if (value.sourceType !== "ORIGINAL" && !value.attributionText) {
      ctx.issues.push({
        code: "custom",
        input: value.attributionText,
        path: ["attributionText"],
        message:
          "anything not written from scratch needs attribution text — for example “Adapted from CBSE 2024, Set 1, Q19”",
      });
    }

    // "Which paper, which year" is both the legal record and something students
    // actively want to see on a previous-year question.
    if (
      (value.sourceType === "CBSE_BOARD_PAPER" || value.sourceType === "CBSE_SAMPLE_PAPER") &&
      value.year === null
    ) {
      ctx.issues.push({
        code: "custom",
        input: value.year,
        path: ["year"],
        message: "a CBSE paper needs the year it was set",
      });
    }
  });

export type QuestionSourceInput = z.infer<typeof questionSourceInputSchema>;

export const questionAnswerInputSchema = z.object({
  correctValue: z.string().trim().min(1).max(2000).nullable().default(null),
  acceptedValues: z.array(z.string().trim().min(1).max(2000)).max(20).default([]),
  /** Absolute tolerance for NUMERICAL. Zero means "exact", chosen deliberately. */
  tolerance: z.number().nonnegative().nullable().default(null),
  unit: z.string().trim().max(40).nullable().default(null),
  solution: solutionSchema,
  explanation: z.string().trim().max(4000).nullable().default(null),
  markingScheme: z.array(markingStepSchema).max(20).nullable().default(null),
});

export type QuestionAnswerInput = z.infer<typeof questionAnswerInputSchema>;

// ── The per-type rule table ──────────────────────────────────────────────────

export interface QuestionTypeRule {
  options: "required" | "forbidden";
  /** Inclusive bounds, when options are required. */
  optionCount: { min: number; max: number } | null;
  correctValue: "required" | "optional" | "forbidden";
  subParts: "required" | "forbidden";
  /**
   * A shape the body must have. Only used where its absence means the author
   * has almost certainly made a mistake rather than an unusual choice — a
   * fill-in-the-blank with no blank in it is not a stylistic decision.
   */
  bodyMustMatch: { pattern: RegExp; message: string } | null;
}

/**
 * What each question type requires. Read by the validator below *and* by the
 * admin form, which is the point: a form that renders an options editor for a
 * type the validator rejects options on is a form that wastes an editor's time
 * and then blames them for it.
 *
 * Two conventions worth stating:
 *
 *  - **For option-bearing types the key is `isCorrect`, and `correctValue` is
 *    forbidden.** Storing the answer twice — once as a flag on the option, once
 *    as the letter "D" — means two things that can disagree, and the disagreement
 *    is silent. The seed writes both for historical reasons; nothing entered
 *    through this path will.
 *  - **Sub-parts are `CASE_BASED` only.** CBSE's other multi-part questions are
 *    attempted and marked as one question, so splitting them into rows would
 *    make a 5-mark long answer look like three questions in every count a
 *    student sees. If a pattern change makes that wrong (docs/07 R8), this table
 *    is the one place it changes.
 */
export const QUESTION_TYPE_RULES: Record<QuestionType, QuestionTypeRule> = {
  MCQ: {
    options: "required",
    optionCount: { min: 2, max: 6 },
    correctValue: "forbidden",
    subParts: "forbidden",
    bodyMustMatch: null,
  },
  ASSERTION_REASON: {
    options: "required",
    // CBSE's assertion-reason format is fixed at the same four stems on every
    // paper, so anything other than four options is a transcription error.
    optionCount: { min: 4, max: 4 },
    correctValue: "forbidden",
    subParts: "forbidden",
    bodyMustMatch: {
      pattern: /assertion[\s\S]*reason/i,
      message: "the body must state an Assertion (A) and a Reason (R)",
    },
  },
  TRUE_FALSE: {
    options: "forbidden",
    optionCount: null,
    correctValue: "required",
    subParts: "forbidden",
    bodyMustMatch: null,
  },
  NUMERICAL: {
    options: "forbidden",
    optionCount: null,
    correctValue: "required",
    subParts: "forbidden",
    bodyMustMatch: null,
  },
  FILL_BLANK: {
    options: "forbidden",
    optionCount: null,
    correctValue: "required",
    subParts: "forbidden",
    bodyMustMatch: {
      pattern: /_{3,}/,
      message: "mark the blank with at least three underscores, like ________",
    },
  },
  MATCH_FOLLOWING: {
    options: "forbidden",
    optionCount: null,
    correctValue: "required",
    subParts: "forbidden",
    bodyMustMatch: {
      pattern: /\|[^\n]*\|/,
      message: "write the two columns as a Markdown table so both render side by side",
    },
  },
  VERY_SHORT_ANSWER: {
    options: "forbidden",
    optionCount: null,
    correctValue: "optional",
    subParts: "forbidden",
    bodyMustMatch: null,
  },
  SHORT_ANSWER: {
    options: "forbidden",
    optionCount: null,
    correctValue: "optional",
    subParts: "forbidden",
    bodyMustMatch: null,
  },
  LONG_ANSWER: {
    options: "forbidden",
    optionCount: null,
    correctValue: "optional",
    subParts: "forbidden",
    bodyMustMatch: null,
  },
  CASE_BASED: {
    options: "forbidden",
    optionCount: null,
    correctValue: "forbidden",
    subParts: "required",
    bodyMustMatch: null,
  },
};

/**
 * Above this, a subjective question needs a step-by-step marking scheme.
 *
 * Three marks is CBSE's own threshold for awarding step marks, and it is also
 * where self-evaluation stops being possible without one: a student comparing a
 * five-mark answer against a paragraph of prose cannot say which two marks they
 * lost. Since MVP exam scores for subjective sections *are* self-assessed
 * (docs/07 R3, Q8), the marking scheme is not documentation — it is the grading
 * instrument, and a question shipped without one cannot be scored honestly.
 */
export const MARKING_SCHEME_REQUIRED_FROM_MARKS = 3;

/** Every question type a sub-part may be. Containers cannot nest — see below. */
export const SUB_PART_TYPES = Object.keys(QUESTION_TYPE_RULES).filter(
  (type) => QUESTION_TYPE_RULES[type as QuestionType].subParts === "forbidden",
) as QuestionType[];

/**
 * Default thinking time when the author does not state one: a minute a mark.
 *
 * Exported rather than inlined so the admin form can prefill the field with the
 * same number the API would have chosen — the editor sees what will be stored
 * and can override it, instead of leaving it blank and getting a surprise.
 */
export function defaultExpectedTimeSeconds(marks: number): number {
  return marks * 60;
}

// ── The shared validator ─────────────────────────────────────────────────────

interface TypedQuestionShape {
  type: QuestionType;
  body: string;
  marks: number;
  options: QuestionOptionInput[];
  answer: QuestionAnswerInput | null;
}

interface IssueSink {
  push: (issue: { code: "custom"; input: unknown; path: PropertyKey[]; message: string }) => void;
}

/**
 * The rules that cannot be expressed field by field, applied identically to a
 * top-level question and to each sub-part.
 *
 * Written as a function over an issue sink rather than duplicated into two
 * `.check()` bodies, because the failure mode of duplicating it is that
 * sub-parts quietly get the weaker half of the rules — and sub-parts are where
 * the marks in a case study actually live.
 */
function checkTypeRules(value: TypedQuestionShape, issues: IssueSink, prefix: PropertyKey[]): void {
  const rule = QUESTION_TYPE_RULES[value.type];
  const at = (...path: PropertyKey[]): PropertyKey[] => [...prefix, ...path];

  if (rule.bodyMustMatch && !rule.bodyMustMatch.pattern.test(value.body)) {
    issues.push({
      code: "custom",
      input: value.body,
      path: at("body"),
      message: rule.bodyMustMatch.message,
    });
  }

  // ── Options ──
  if (rule.options === "forbidden" && value.options.length > 0) {
    issues.push({
      code: "custom",
      input: value.options,
      path: at("options"),
      message: `a ${value.type} question does not have options to choose from`,
    });
  }

  if (rule.options === "required") {
    const bounds = rule.optionCount ?? { min: 2, max: 6 };

    if (value.options.length < bounds.min || value.options.length > bounds.max) {
      issues.push({
        code: "custom",
        input: value.options,
        path: at("options"),
        message:
          bounds.min === bounds.max
            ? `a ${value.type} question has exactly ${bounds.min} options`
            : `a ${value.type} question needs between ${bounds.min} and ${bounds.max} options`,
      });
    }

    const correct = value.options.filter((option) => option.isCorrect);
    if (correct.length !== 1) {
      issues.push({
        code: "custom",
        input: correct.length,
        path: at("options"),
        message:
          correct.length === 0
            ? "mark exactly one option as the correct answer"
            : `mark exactly one option as correct — ${correct.length} are marked`,
      });
    }

    const labels = value.options.map((option) => option.label.toUpperCase());
    if (new Set(labels).size !== labels.length) {
      issues.push({
        code: "custom",
        input: labels,
        path: at("options"),
        message: "option labels must each be different",
      });
    }
  }

  // ── The answer key ──
  if (value.answer === null) {
    // A container holds no answer of its own; everything else must have one,
    // because the solution is what the student reads after getting it wrong —
    // which is the entire product loop, not a nice-to-have.
    if (rule.subParts !== "required") {
      issues.push({
        code: "custom",
        input: value.answer,
        path: at("answer"),
        message: "every question needs a worked solution",
      });
    }
    return;
  }

  if (rule.subParts === "required") {
    issues.push({
      code: "custom",
      input: value.answer,
      path: at("answer"),
      message: "a case study carries no answer of its own — the marks live in its sub-parts",
    });
    return;
  }

  const answer = value.answer;

  if (rule.correctValue === "required" && !answer.correctValue) {
    issues.push({
      code: "custom",
      input: answer.correctValue,
      path: at("answer", "correctValue"),
      message: `a ${value.type} question needs the answer it is marked against`,
    });
  }

  if (rule.correctValue === "forbidden" && answer.correctValue) {
    issues.push({
      code: "custom",
      input: answer.correctValue,
      path: at("answer", "correctValue"),
      message:
        "the correct answer is the option marked correct, not a separate value — two copies can disagree",
    });
  }

  if (value.type === "TRUE_FALSE" && answer.correctValue) {
    if (!/^(true|false)$/i.test(answer.correctValue)) {
      issues.push({
        code: "custom",
        input: answer.correctValue,
        path: at("answer", "correctValue"),
        message: "the answer must be TRUE or FALSE",
      });
    }
  }

  if (value.type === "NUMERICAL") {
    if (answer.correctValue && Number.isNaN(Number(answer.correctValue))) {
      issues.push({
        code: "custom",
        input: answer.correctValue,
        path: at("answer", "correctValue"),
        message: "a numerical answer must be a number — put the unit in the unit field",
      });
    }

    // Without a tolerance the grader can only compare strings, so a student who
    // writes 9.80 against a key of 9.8 is marked wrong. Requiring the author to
    // choose — even to choose zero — makes that a decision instead of an
    // accident.
    if (answer.tolerance === null) {
      issues.push({
        code: "custom",
        input: answer.tolerance,
        path: at("answer", "tolerance"),
        message:
          "state a tolerance (0 for an exact match), or 9.80 will be marked wrong against 9.8",
      });
    }
  }

  // ── The marking scheme ──
  const needsScheme =
    !isAutoGradable(value.type) && value.marks >= MARKING_SCHEME_REQUIRED_FROM_MARKS;

  if (needsScheme && (answer.markingScheme === null || answer.markingScheme.length === 0)) {
    issues.push({
      code: "custom",
      input: answer.markingScheme,
      path: at("answer", "markingScheme"),
      message: `a ${value.marks}-mark written answer needs a step-by-step marking scheme — it is what the student self-evaluates against`,
    });
  }

  if (answer.markingScheme && answer.markingScheme.length > 0) {
    const total = answer.markingScheme.reduce((sum, step) => sum + step.marks, 0);

    // Compared with a tolerance because CBSE schemes use half marks and binary
    // floating point does not represent 0.1 exactly — 0.5+0.5+0.5+1.5 is not 3
    // on the nose.
    if (Math.abs(total - value.marks) > 0.001) {
      issues.push({
        code: "custom",
        input: total,
        path: at("answer", "markingScheme"),
        message:
          `the steps add up to ${total} marks but the question is worth ${value.marks}. ` +
          "For “any two of the following”, write one step worth the marks and list the alternatives in its key points",
      });
    }
  }
}

// ── The write shape ──────────────────────────────────────────────────────────

const questionCoreInput = {
  type: questionTypeSchema,
  body: bodySchema,
  /** Nullable and unused in MVP (docs/07 Q5) — the column costs nothing to fill later. */
  bodyHindi: z.string().trim().max(8000).nullable().default(null),
  marks: marksSchema,
  difficulty: difficultySchema.default("MEDIUM"),
  bloomLevel: bloomLevelSchema.default("UNDERSTAND"),
  /** Null means "a minute a mark" — see `defaultExpectedTimeSeconds`. */
  expectedTimeSeconds: z.int().min(5).max(3600).nullable().default(null),
  options: z.array(questionOptionInputSchema).max(6).default([]),
  assets: z.array(questionAssetInputSchema).max(6).default([]),
  answer: questionAnswerInputSchema.nullable().default(null),
};

/**
 * A sub-part of a case study.
 *
 * It has no `subParts` of its own — the depth cap is a CHECK constraint in the
 * database, and leaving it out here means the impossible shape is also
 * unrepresentable in the editor.
 *
 * `topicIds` is optional: a sub-part that does not declare its own topics
 * inherits the container's. Case studies that span two topics are normal, and
 * this is where that is expressed — but making it *required* would add four
 * pickers to the fastest-growing part of the form for no gain in the common case.
 */
export const subPartInputSchema = z
  .object({
    ...questionCoreInput,
    topicIds: z.array(z.string().min(1)).max(5).nullable().default(null),
  })
  .check((ctx) => {
    checkTypeRules(ctx.value, ctx.issues, []);

    if (QUESTION_TYPE_RULES[ctx.value.type].subParts === "required") {
      ctx.issues.push({
        code: "custom",
        input: ctx.value.type,
        path: ["type"],
        message: "a sub-part cannot itself be a case study",
      });
    }
  });

export type SubPartInput = z.infer<typeof subPartInputSchema>;

/**
 * The whole question, written in one request.
 *
 * Deliberately not a set of endpoints for body, options, answer and provenance.
 * A question is a tree that only makes sense complete — an MCQ with no options
 * is not a valid intermediate state, it is a broken row — and the phase gate is
 * a *median entry time under 90 seconds*, which six sequential saves cannot
 * reach. One document in, one transaction, valid on both sides of it.
 */
export const writeQuestionInputSchema = z
  .object({
    ...questionCoreInput,
    chapterId: z.string().min(1).max(60),
    /**
     * At least one, and **the first is the primary topic** that mastery is
     * attributed to.
     *
     * The database models this as an `isPrimary` flag per link, which makes
     * "no primary" and "three primaries" both representable and therefore both
     * eventually true. Position in a required non-empty list makes neither
     * expressible, and the service translates.
     */
    topicIds: z.array(z.string().min(1)).min(1).max(5),
    source: questionSourceInputSchema,
    subParts: z.array(subPartInputSchema).max(6).default([]),
  })
  .check((ctx) => {
    const value = ctx.value;
    checkTypeRules(value, ctx.issues, []);

    const rule = QUESTION_TYPE_RULES[value.type];

    if (rule.subParts === "forbidden" && value.subParts.length > 0) {
      ctx.issues.push({
        code: "custom",
        input: value.subParts,
        path: ["subParts"],
        message: `only a case study has sub-parts — a ${value.type} question is answered as one`,
      });
      return;
    }

    if (rule.subParts === "required") {
      if (value.subParts.length < 2) {
        ctx.issues.push({
          code: "custom",
          input: value.subParts,
          path: ["subParts"],
          message: "a case study needs at least two sub-parts",
        });
        return;
      }

      // The container's marks are the question's marks as a paper counts them:
      // one 4-mark case study, not three questions. If the parts do not add up,
      // every marks-based total downstream — section arithmetic, progress,
      // exam blueprints — is quietly wrong.
      const partTotal = value.subParts.reduce((sum, part) => sum + part.marks, 0);
      if (partTotal !== value.marks) {
        ctx.issues.push({
          code: "custom",
          input: partTotal,
          path: ["marks"],
          message: `the sub-parts add up to ${partTotal} marks but the case study is marked as ${value.marks}`,
        });
      }
    }

    if (value.topicIds.length !== new Set(value.topicIds).size) {
      ctx.issues.push({
        code: "custom",
        input: value.topicIds,
        path: ["topicIds"],
        message: "the same topic is listed twice",
      });
    }
  });

export type WriteQuestionInput = z.infer<typeof writeQuestionInputSchema>;

// ── Publication ──────────────────────────────────────────────────────────────

/**
 * Legal status moves, as a table rather than a chain of `if`s.
 *
 * Exported so the admin UI can render only the buttons that will work, instead
 * of offering four and letting the API reject three. The API still enforces it —
 * a UI that hides a button is a convenience, never a control.
 *
 * The one asymmetry worth noticing: **`ARCHIVED` cannot go straight back to
 * `PUBLISHED`.** Something was wrong enough with it to withdraw it from students
 * mid-session; whatever that was should be looked at again before it returns,
 * so the way back is through `DRAFT`.
 */
export const QUESTION_STATUS_TRANSITIONS: Record<QuestionStatus, readonly QuestionStatus[]> = {
  DRAFT: ["IN_REVIEW", "PUBLISHED", "ARCHIVED"],
  IN_REVIEW: ["DRAFT", "PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["DRAFT", "IN_REVIEW", "ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

export function canTransitionQuestionStatus(from: QuestionStatus, to: QuestionStatus): boolean {
  return QUESTION_STATUS_TRANSITIONS[from].includes(to);
}

/**
 * Why a question may not be published yet, in words an editor can act on.
 *
 * Publication is a higher bar than validity, and the extra rule is the licensing
 * one: `NEEDS_REVIEW` is the default a source row gets when nobody made a
 * decision, and docs/07 R2 exists precisely because "we'll audit the licensing
 * later" does not survive 2,000 questions. Making it a publication gate means
 * the audit happens one question at a time, by the person who has the paper open
 * in front of them.
 *
 * Returns an empty array when the question is publishable, so a caller reads
 * `blockers.length === 0` rather than a boolean whose false branch it then has
 * to explain.
 */
export function publicationBlockers(question: {
  licenceStatus: string;
  hasSolution: boolean;
  isContainer: boolean;
}): string[] {
  const blockers: string[] = [];

  if (question.licenceStatus === "NEEDS_REVIEW") {
    blockers.push(
      "the licensing of this question has not been reviewed — set it to cleared, fair-use or restricted first",
    );
  }

  if (question.licenceStatus === "RESTRICTED") {
    blockers.push(
      "this question is marked as restricted, so it cannot be served to students even once published",
    );
  }

  if (!question.isContainer && !question.hasSolution) {
    blockers.push("it has no worked solution");
  }

  return blockers;
}

export const changeQuestionStatusInputSchema = z.object({
  status: questionStatusSchema,
  /** Recorded on the revision. "Wrong answer key reported by a student" is worth keeping. */
  reason: z.string().trim().max(500).nullable().default(null),
});

export type ChangeQuestionStatusInput = z.infer<typeof changeQuestionStatusInputSchema>;

// ── What an editor reads back ────────────────────────────────────────────────

/**
 * The admin view of a question — the student shape plus everything deliberately
 * withheld from students: the answer key, the licensing decision, the editorial
 * status, who wrote it and when.
 *
 * A genuinely separate schema, not `studentQuestionSchema.extend(...)` with a
 * flag. `docs/02` §3's rule is two serializers rather than one function with a
 * boolean, and the same reasoning applies to the types: an admin shape derived
 * from the student one invites a serializer that fills in "just the extra bits",
 * which is one refactor away from the student endpoint returning them too.
 */

export const adminQuestionOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  body: z.string(),
  isCorrect: z.boolean(),
  orderIndex: z.int(),
});

export const adminQuestionAnswerSchema = z.object({
  correctValue: z.string().nullable(),
  acceptedValues: z.array(z.string()),
  tolerance: z.number().nullable(),
  unit: z.string().nullable(),
  solution: z.string(),
  explanation: z.string().nullable(),
  markingScheme: z.array(markingStepSchema).nullable(),
});

export const adminQuestionSourceSchema = z.object({
  sourceType: sourceTypeSchema,
  year: z.int().nullable(),
  examSession: z.string().nullable(),
  paperCode: z.string().nullable(),
  setNumber: z.string().nullable(),
  originalQuestionNumber: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  licenceStatus: licenceStatusSchema,
  attributionText: z.string().nullable(),
  reviewedAt: z.iso.datetime().nullable(),
  reviewNotes: z.string().nullable(),
});

export const adminQuestionAssetSchema = z.object({
  id: z.string().min(1),
  kind: assetKindSchema,
  url: z.string(),
  altText: z.string(),
  caption: z.string().nullable(),
  orderIndex: z.int(),
});

export const adminTopicRefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  isPrimary: z.boolean(),
});

const adminQuestionCore = {
  id: z.string().min(1),
  type: questionTypeSchema,
  body: z.string(),
  bodyHindi: z.string().nullable(),
  marks: z.int(),
  difficulty: difficultySchema,
  bloomLevel: bloomLevelSchema,
  expectedTimeSeconds: z.int(),
  status: questionStatusSchema,
  version: z.int(),
  options: z.array(adminQuestionOptionSchema),
  assets: z.array(adminQuestionAssetSchema),
  answer: adminQuestionAnswerSchema.nullable(),
  topics: z.array(adminTopicRefSchema),
};

export const adminSubPartSchema = z.object({
  ...adminQuestionCore,
  subPartIndex: z.int().nonnegative(),
});

export type AdminSubPart = z.infer<typeof adminSubPartSchema>;

export const adminQuestionSchema = z.object({
  ...adminQuestionCore,
  subjectId: z.string().min(1),
  chapter: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1),
    domain: z.string().nullable(),
  }),
  isContainer: z.boolean(),
  subParts: z.array(adminSubPartSchema),
  source: adminQuestionSourceSchema.nullable(),
  /**
   * Why this question cannot be published, empty when it can. Computed by the
   * API rather than by the form, so a script and a human get the same answer.
   */
  publicationBlockers: z.array(z.string()),
  authorName: z.string().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type AdminQuestion = z.infer<typeof adminQuestionSchema>;

/**
 * A row in the admin question list.
 *
 * Carries the full `body` rather than a server-truncated excerpt: truncating
 * Markdown-with-LaTeX at a character count cuts `$\dfrac{n}{2}` in half and the
 * row renders as garbage. Clamping is a job for CSS, which can only ever hide
 * whole lines.
 */
export const adminQuestionSummarySchema = z.object({
  id: z.string().min(1),
  type: questionTypeSchema,
  body: z.string(),
  marks: z.int(),
  difficulty: difficultySchema,
  status: questionStatusSchema,
  version: z.int(),
  isContainer: z.boolean(),
  subPartCount: z.int().nonnegative(),
  chapter: z.object({ id: z.string().min(1), name: z.string().min(1) }),
  primaryTopic: z.object({ id: z.string().min(1), name: z.string().min(1) }).nullable(),
  licenceStatus: licenceStatusSchema.nullable(),
  sourceType: sourceTypeSchema.nullable(),
  updatedAt: z.iso.datetime(),
});

export type AdminQuestionSummary = z.infer<typeof adminQuestionSummarySchema>;

/**
 * One entry in a question's audit trail.
 *
 * `from`/`to` are rendered as strings even when the underlying field is a number
 * or a list. A revision log is read by a person asking "what did someone change
 * on the day this got reported wrong"; strings answer that, and a faithful union
 * of every field's type would not answer it any better.
 */
export const questionRevisionSchema = z.object({
  id: z.string().min(1),
  version: z.int(),
  reason: z.string().nullable(),
  changes: z.array(
    z.object({
      field: z.string(),
      from: z.string().nullable(),
      to: z.string().nullable(),
    }),
  ),
  editedByName: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export type QuestionRevision = z.infer<typeof questionRevisionSchema>;

// ── Listing ──────────────────────────────────────────────────────────────────

/**
 * The admin list, which is the surface an editor spends their day on.
 *
 * `status` and `licenceStatus` are filterable here and absent from the student
 * query for the obvious reason, but the useful part is what they enable: "show
 * me everything in review", "show me everything whose licensing nobody has
 * decided" — the two work queues that keep 2,000 questions from becoming an
 * undifferentiated pile.
 */
export const adminListQuestionsQuerySchema = z.object({
  subjectId: z.string().min(1).optional(),
  chapterId: z.string().min(1).optional(),
  topicId: z.string().min(1).optional(),
  type: multiValue(questionTypeSchema).optional(),
  difficulty: multiValue(difficultySchema).optional(),
  status: multiValue(questionStatusSchema).optional(),
  licenceStatus: multiValue(licenceStatusSchema).optional(),
  marks: z.coerce.number().int().positive().optional(),
  search: z.string().trim().min(2).max(120).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type AdminListQuestionsQuery = z.infer<typeof adminListQuestionsQuerySchema>;
