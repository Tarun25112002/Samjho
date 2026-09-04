import { z } from "zod";

import { classLevelSchema, questionTypeSchema } from "../question/question-enums.js";
import { paperStatusSchema, paperTypeSchema } from "./exam-enums.js";

/**
 * An exam paper: its shape, and deliberately not its questions.
 *
 * ## The rule this file exists to enforce
 *
 * **A paper's structure is public to a signed-in student; its questions are
 * not.** `GET /exam-papers/:id` returns section names, question numbers, marks
 * and where the internal choices fall — everything a student needs in order to
 * decide whether to sit it and to understand the instructions — and no question
 * bodies at all. The questions arrive when an attempt starts, and not before.
 *
 * That is the same structural trick as the answer key in Phase 3, one level up:
 * `ExamSlotStructure` has no `question` property to fill in, so a paper preview
 * cannot leak the paper. Without it, a student could read every question,
 * prepare the answers, and then start the timer — which would make the three-
 * hour simulation worthless while looking exactly like a working feature.
 *
 * ## Slots, not questions
 *
 * A slot is a *position*: "question 29, Section C, 3 marks, internal choice
 * available". Real papers offer alternatives, so a position holds one or two
 * items. Every count a student sees — 38 questions, 80 marks — counts positions.
 */

// ── Structure (safe before an attempt) ───────────────────────────────────────

export const examSlotStructureSchema = z.object({
  id: z.string().min(1),
  /** As printed on the paper; continuous across sections. */
  questionNumber: z.int().positive(),
  orderIndex: z.int().nonnegative(),
  marks: z.int().positive(),
  isOptional: z.boolean(),
  /**
   * True when the position offers an "or attempt this instead" alternative.
   *
   * A boolean rather than the alternatives themselves: knowing a choice exists
   * is part of understanding the paper, and knowing what the choice is between
   * is the paper.
   */
  hasInternalChoice: z.boolean(),
  /**
   * The question types sitting in this position, so a student can see that
   * Section A is multiple choice without seeing the questions.
   */
  types: z.array(questionTypeSchema),
});

export type ExamSlotStructure = z.infer<typeof examSlotStructureSchema>;

export const examSectionStructureSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  orderIndex: z.int().nonnegative(),
  instructions: z.string().nullable(),
  /** Null when the section mixes marks and each slot carries its own. */
  marksPerQuestion: z.int().positive().nullable(),
  slots: z.array(examSlotStructureSchema),
  /** Summed from the slots, so the front page and the sections cannot disagree. */
  marks: z.int().nonnegative(),
});

export type ExamSectionStructure = z.infer<typeof examSectionStructureSchema>;

export const examPaperSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().min(1),
  paperType: paperTypeSchema,
  status: paperStatusSchema,
  year: z.int().nullable(),
  setCode: z.string().nullable(),
  totalMarks: z.int().positive(),
  durationMinutes: z.int().positive(),
  subject: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1),
    classLevel: classLevelSchema,
  }),
  /** Positions, not questions-with-alternatives. See the header. */
  questionCount: z.int().nonnegative(),
});

export type ExamPaperSummary = z.infer<typeof examPaperSummarySchema>;

export const examPaperStructureSchema = examPaperSummarySchema.extend({
  generalInstructions: z.array(z.string()),
  sections: z.array(examSectionStructureSchema),
  /**
   * Which blueprint shaped this paper, when one did.
   *
   * Shown to the student, not just recorded: "built to the 2026-27 CBSE
   * pattern" is the claim that makes a generated mock worth three hours, and a
   * claim a student can check is a different thing from a badge.
   */
  blueprint: z
    .object({ key: z.string().min(1), name: z.string().min(1), academicYear: z.string().min(1) })
    .nullable(),
});

export type ExamPaperStructure = z.infer<typeof examPaperStructureSchema>;

export const listExamPapersQuerySchema = z.object({
  subjectId: z.string().min(1).max(60).optional(),
  paperType: paperTypeSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListExamPapersQuery = z.infer<typeof listExamPapersQuerySchema>;

// ── Generating a paper from a blueprint ──────────────────────────────────────

export const generatePaperSchema = z.object({
  /** `ExamBlueprint.key`, e.g. "cbse-10-science-2026". */
  blueprintKey: z.string().min(3).max(80),
  title: z.string().trim().min(3).max(160).optional(),
  /**
   * Check what the bank can support without writing anything.
   *
   * Defaults to **true**, the same way bulk import does and for the same
   * reason: generating a paper consumes forty questions and creates a resource
   * an editor then has to find and archive. Checking is the default; writing is
   * the opt-in.
   */
  dryRun: z.boolean().default(true),
  /**
   * Restrict the draw to particular chapters — a half-syllabus mock for a
   * mid-term. Empty means the whole subject, which is what a board paper is.
   */
  chapterIds: z.array(z.string().min(1).max(60)).max(60).default([]),
});

export type GeneratePaperInput = z.infer<typeof generatePaperSchema>;

/**
 * What the bank could not supply, per group.
 *
 * This is the most operationally useful thing the generator produces, and it is
 * a first-class result rather than an error string. The bank is being written
 * from zero and content entry is the critical path (docs/07 R1), so "Section E
 * needs three 4-mark case studies and the bank has one" is a work order for the
 * content team — the difference between a feature that blocks them and one that
 * tells them exactly what to write next.
 */
export const paperShortfallSchema = z.object({
  sectionName: z.string().min(1),
  groupIndex: z.int().nonnegative(),
  marks: z.int().positive(),
  types: z.array(questionTypeSchema),
  /** Positions plus their alternatives — what a full group actually costs. */
  needed: z.int().nonnegative(),
  available: z.int().nonnegative(),
  /** True where the group wanted containers with a particular sub-part split. */
  needsSubParts: z.boolean(),
});

export type PaperShortfall = z.infer<typeof paperShortfallSchema>;

export const paperPlanSchema = z.object({
  blueprintKey: z.string().min(1),
  blueprintName: z.string().min(1),
  /** True when every group could be filled — the only case that can be written. */
  complete: z.boolean(),
  totalMarks: z.int().nonnegative(),
  /** Marks the blueprint says the paper is worth, for comparison with the above. */
  blueprintMarks: z.int().positive(),
  questionCount: z.int().nonnegative(),
  shortfalls: z.array(paperShortfallSchema),
  /**
   * How many distinct questions the paper would consume. Worth stating: a
   * generated mock takes forty questions out of circulation for anyone who has
   * not seen them, and an editor generating five mocks should know that.
   */
  questionsUsed: z.int().nonnegative(),
});

export type PaperPlan = z.infer<typeof paperPlanSchema>;

/**
 * The result of a generate call, dry run or not.
 *
 * `paper` is null on a dry run *and* on an incomplete plan, and `plan.complete`
 * says which. Reporting both rather than throwing on the incomplete case is what
 * lets the admin UI show the shortfall table instead of a red box.
 */
export const generatePaperResultSchema = z.object({
  dryRun: z.boolean(),
  plan: paperPlanSchema,
  paper: examPaperStructureSchema.nullable(),
});

export type GeneratePaperResult = z.infer<typeof generatePaperResultSchema>;

/** Admin-side paper listing carries the status a student's list never shows. */
export const adminPaperSummarySchema = examPaperSummarySchema.extend({
  blueprintKey: z.string().nullable(),
  attemptCount: z.int().nonnegative(),
  createdAt: z.iso.datetime(),
});

export type AdminPaperSummary = z.infer<typeof adminPaperSummarySchema>;

export const setPaperStatusSchema = z.object({ status: paperStatusSchema });
export type SetPaperStatusInput = z.infer<typeof setPaperStatusSchema>;
