import { boardSchema, classLevelSchema, questionTypeSchema } from "@samjho/contracts";
import { z } from "zod";

/**
 * The blueprint format: a declarative description of how a paper is shaped.
 *
 * This exists so that "CBSE changed the pattern" is a data edit rather than a
 * deploy (07-roadmap-risks-questions.md R8). Everything the exam engine needs to
 * lay out a paper — section count, marks per question, where internal choice
 * appears, how case-based sub-parts split — is here, and none of it is in code.
 *
 * The shape below is deliberately permissive in one specific way: marks can be
 * declared per *section* (the common case) or per *group* (when one section
 * mixes them). Nothing in the current CBSE MVP papers needs the per-group form,
 * but the cost of supporting it is one nullable field, and the cost of *not*
 * supporting it is a schema migration the first time a paper does mix them.
 */

const slug = z
  .string()
  .min(3)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be a lowercase kebab-case slug");

/**
 * A run of structurally identical positions within a section — "seven 3-mark
 * short-answer questions, two of which offer internal choice".
 *
 * Grouping rather than listing every position individually keeps blueprints
 * readable and makes the arithmetic checkable: a 33-question paper is five
 * sections and seven groups, not 33 hand-written entries that nobody proofreads.
 */
export const blueprintGroupSchema = z
  .object({
    /** How many question positions this group contributes. */
    count: z.int().positive(),

    /**
     * Marks per question in this group. Omit to inherit the section's
     * `marksPerQuestion`; set it only when the section genuinely mixes marks.
     */
    marks: z.int().positive().optional(),

    /** Which question types may legally fill these positions. */
    types: z.array(questionTypeSchema).min(1),

    /** True when each position offers an "or attempt this instead" alternative. */
    internalChoice: z.boolean().default(false),

    /** How many of the `count` positions carry that choice. */
    choiceCount: z.int().nonnegative().default(0),

    /**
     * How a container question divides into sub-parts — and there are genuinely
     * two different rules in play, which is why this is a union rather than an
     * array of marks.
     *
     * Class 10 Maths prescribes one split: every Section E case study is 1+1+2.
     * That is FIXED, and an authored question that splits 2+2 is wrong.
     *
     * Class 10 Science prescribes a *vocabulary*: "sub-parts of the values of
     * 1/2/3 marks". Individual case studies legitimately come out as 1+1+2 or
     * 1+3 or 2+2. Encoding that as FIXED [1,1,2] would make the validator reject
     * real papers, so it is CONSTRAINED — any combination that sums correctly.
     *
     * FIXED is not a special case of CONSTRAINED worth collapsing: the two carry
     * different authoring guarantees, and flattening them loses the ability to
     * tell an admin "this question must be 1+1+2" where that is actually true.
     */
    subParts: z
      .discriminatedUnion("mode", [
        z.object({
          mode: z.literal("FIXED"),
          marks: z.array(z.int().positive()).min(2),
        }),
        z.object({
          mode: z.literal("CONSTRAINED"),
          /** Permitted mark values for any single sub-part. */
          allowedMarks: z.array(z.int().positive()).min(1),
          minParts: z.int().min(2).default(2),
        }),
      ])
      .optional(),

    /** Free-text note for admins authoring against this group. */
    note: z.string().optional(),
  })
  .check((ctx) => {
    const g = ctx.value;

    // These two fields must agree. Allowing `internalChoice: true, choiceCount: 0`
    // gives a paper that claims choice and offers none.
    if (g.internalChoice && g.choiceCount < 1) {
      ctx.issues.push({
        code: "custom",
        input: g,
        path: ["choiceCount"],
        message: "internalChoice is true, so choiceCount must be at least 1",
      });
    }
    if (!g.internalChoice && g.choiceCount > 0) {
      ctx.issues.push({
        code: "custom",
        input: g,
        path: ["internalChoice"],
        message: `choiceCount is ${String(g.choiceCount)}, so internalChoice must be true`,
      });
    }
    if (g.choiceCount > g.count) {
      ctx.issues.push({
        code: "custom",
        input: g,
        path: ["choiceCount"],
        message: `choiceCount (${String(g.choiceCount)}) cannot exceed count (${String(g.count)})`,
      });
    }
  });

export type BlueprintGroup = z.infer<typeof blueprintGroupSchema>;

export const blueprintSectionSchema = z.object({
  /** As printed on the paper: "Section A". */
  name: z.string().min(1),
  orderIndex: z.int().nonnegative(),

  /** The section-wide default; groups may omit `marks` when this is set. */
  marksPerQuestion: z.int().positive().optional(),

  instructions: z.string().optional(),
  groups: z.array(blueprintGroupSchema).min(1),
});

export type BlueprintSection = z.infer<typeof blueprintSectionSchema>;

export const examBlueprintSchema = z.object({
  id: slug,
  /** Bumped whenever the structure changes; papers record which version made them. */
  version: z.int().positive(),
  name: z.string().min(1),

  /** CBSE's own format, e.g. "2026-27". */
  academicYear: z.string().regex(/^\d{4}-\d{2}$/, 'must look like "2026-27"'),

  subject: z.object({
    board: boardSchema,
    classLevel: classLevelSchema,
    /** Matches Subject.code in the database. */
    code: z.string().min(2),
    /** Maths Basic vs Standard. */
    variant: z.string().optional(),
  }),

  /**
   * Declared totals. These are redundant with the section arithmetic *on
   * purpose* — they are the cross-check. A blueprint transcribed from a coaching
   * site with one section wrong will sum to something other than the number
   * everyone knows the paper is worth, and the validator refuses it. That check
   * is not hypothetical: the first draft of the Class 12 Physics structure in
   * docs/04 summed to 76 marks and 34 questions against a real 70 and 33.
   */
  totalMarks: z.int().positive(),
  totalQuestions: z.int().positive(),
  durationMinutes: z.int().positive(),

  generalInstructions: z.array(z.string().min(1)).min(1),
  sections: z.array(blueprintSectionSchema).min(1),

  /** Where this structure came from, so it can be re-checked. */
  sourceUrl: z.url().optional(),

  /**
   * Whether this has been checked against the official sample paper PDF on
   * cbseacademic.nic.in rather than a coaching-site summary. Secondary sources
   * are good enough to design a schema against; they are not good enough to
   * score a student's board exam against. Required, not optional, so that
   * shipping an unverified blueprint is a deliberate act.
   */
  verifiedAgainstOfficial: z.boolean(),
});

export type ExamBlueprint = z.infer<typeof examBlueprintSchema>;
/** The authoring-time shape, before `.default()` values are filled in. */
export type ExamBlueprintInput = z.input<typeof examBlueprintSchema>;
