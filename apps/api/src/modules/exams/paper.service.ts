import { examBlueprintSchema, type ExamBlueprint } from "@samjho/exam-blueprints";
import type {
  AdminPaperSummary,
  ExamPaperStructure,
  GeneratePaperInput,
  GeneratePaperResult,
  ListExamPapersQuery,
  Paginated,
  PaperPlan,
  PaperStatus,
  QuestionType,
} from "@samjho/contracts";

import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { planPaper, type PaperPlanResult } from "./paper.planner.js";
import { paperRepository, type PaperStructureRow } from "./paper.repository.js";

/**
 * Exam papers: generating them, reading them, publishing them.
 *
 * ## The publish gate
 *
 * A paper generated from a blueprint that has **not** been checked against the
 * official CBSE PDF can be drafted and inspected, and cannot be published. The
 * blueprint schema states the rule in words — "papers must not be generated from
 * an unverified blueprint once real students are being scored" — and this is
 * where it becomes a control.
 *
 * Drafting is allowed because neither shipped blueprint is verified yet, and
 * refusing outright would make the feature undeliverable until someone reads two
 * PDFs. Publishing is refused because that is the moment a student sits three
 * hours against it and takes the score seriously. It is the same shape as
 * Phase 4's licensing gate: the work can be done, the exposure cannot be taken
 * accidentally.
 *
 * ## Why the blueprint is re-parsed on the way out of the database
 *
 * `ExamBlueprint.structure` is JSONB, so it is `unknown` at the type level, and
 * a row written by an older version of the package is a real possibility once
 * blueprints start being edited. Parsing rather than casting means a structure
 * that no longer matches the schema fails here, with a message, instead of
 * producing a paper with a section missing.
 */

export const paperService = {
  /**
   * Build a paper from a blueprint, or report what the bank cannot supply.
   *
   * Returns a 200 with an incomplete plan rather than an error when the bank
   * falls short: that plan is a work order for the content team (docs/07 R1),
   * and a 409 would hide it behind an error handler.
   */
  async generate(input: GeneratePaperInput): Promise<GeneratePaperResult> {
    const row = await paperRepository.findBlueprintByKey(input.blueprintKey);
    if (!row) throw new NotFoundError("Blueprint");

    const blueprint = parseStructure(row.structure, row.key);
    const candidates = await paperRepository.findCandidates(row.subjectId, input.chapterIds);
    const planned = planPaper(blueprint, candidates);

    const plan = toPlan(planned, blueprint, row.key);

    if (input.dryRun || !planned.complete) {
      return { dryRun: input.dryRun, plan, paper: null };
    }

    const existing = await paperRepository.countPapersForBlueprint(row.id);
    const title = input.title ?? `${blueprint.name} — practice paper ${String(existing + 1)}`;

    const paper = await paperRepository.create({
      subjectId: row.subjectId,
      blueprintId: row.id,
      title,
      slug: slugify(`${row.key}-${String(existing + 1)}`),
      totalMarks: planned.totalMarks,
      durationMinutes: blueprint.durationMinutes,
      generalInstructions: [...blueprint.generalInstructions],
      sections: planned.sections,
    });

    return { dryRun: false, plan, paper: toStructure(paper) };
  },

  async list(query: ListExamPapersQuery): Promise<Paginated<ExamPaperStructure>> {
    const { rows, hasMore } = await paperRepository.list(query);
    const items = rows.map(toStructure);

    return {
      items,
      pageInfo: { hasMore, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null },
    };
  },

  async getById(id: string): Promise<ExamPaperStructure> {
    const row = await paperRepository.findById(id);
    if (!row) throw new NotFoundError("Exam paper");
    return toStructure(row);
  },

  async getForAdmin(id: string): Promise<ExamPaperStructure> {
    const row = await paperRepository.findByIdForAdmin(id);
    if (!row) throw new NotFoundError("Exam paper");
    return toStructure(row);
  },

  async listForAdmin(query: ListExamPapersQuery): Promise<AdminPaperSummary[]> {
    const rows = await paperRepository.listForAdmin(query);

    return rows.map((row) => ({
      ...summaryOf(row),
      blueprintKey: row.blueprint?.key ?? null,
      attemptCount: row._count.attempts,
      createdAt: row.createdAt.toISOString(),
    }));
  },

  /**
   * Move a paper through its lifecycle.
   *
   * Publishing is the only transition with a condition on it, and the condition
   * is about the blueprint rather than the paper: a structure nobody has checked
   * against CBSE's own PDF is not a structure to score a board rehearsal
   * against. Withdrawing has no condition — the whole point of a status is that
   * a mistake can be pulled without deleting the attempts made against it.
   */
  async setStatus(id: string, status: PaperStatus): Promise<ExamPaperStructure> {
    const paper = await paperRepository.findByIdForAdmin(id);
    if (!paper) throw new NotFoundError("Exam paper");

    if (status === "PUBLISHED") {
      const blueprintKey = paper.blueprint?.key;
      const row = blueprintKey ? await paperRepository.findBlueprintByKey(blueprintKey) : null;

      if (row && !row.verifiedAgainstOfficial) {
        throw new ConflictError(
          `"${row.name}" has not been checked against CBSE's official sample paper, so a paper built from it cannot be published. Verify the blueprint first.`,
        );
      }

      if (paper.sections.every((section) => section.slots.length === 0)) {
        throw new ConflictError("This paper has no questions in it.");
      }
    }

    return toStructure(await paperRepository.setStatus(id, status));
  },
};

// ── Serializers ──────────────────────────────────────────────────────────────

/**
 * The structure serializer, and the only one this module has.
 *
 * It cannot produce a question body, because `PaperStructureRow` does not
 * contain one. When the attempt endpoint needs the real questions in Phase 6's
 * next sub-step it gets its own row type and its own function beside this one —
 * two serializers, never one with a flag.
 */
function toStructure(row: PaperStructureRow): ExamPaperStructure {
  return {
    ...summaryOf(row),
    generalInstructions: row.generalInstructions,
    blueprint: row.blueprint
      ? {
          key: row.blueprint.key,
          name: row.blueprint.name,
          academicYear: row.blueprint.academicYear,
        }
      : null,
    sections: row.sections.map((section) => ({
      id: section.id,
      name: section.name,
      orderIndex: section.orderIndex,
      instructions: section.instructions,
      marksPerQuestion: section.marksPerQuestion,
      marks: section.slots.reduce((sum, slot) => sum + slot.marks, 0),
      slots: section.slots.map((slot) => ({
        id: slot.id,
        questionNumber: slot.questionNumber,
        orderIndex: slot.orderIndex,
        marks: slot.marks,
        isOptional: slot.isOptional,
        hasInternalChoice: slot.items.length > 1,
        // Deduplicated: a position whose two alternatives are both short answers
        // says "short answer" once, the way the paper does.
        types: [...new Set(slot.items.map((item) => item.question.type))] as QuestionType[],
      })),
    })),
  };
}

function summaryOf(row: PaperStructureRow) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    paperType: row.paperType,
    status: row.status,
    year: row.year,
    setCode: row.setCode,
    totalMarks: row.totalMarks,
    durationMinutes: row.durationMinutes,
    subject: {
      id: row.subject.id,
      name: row.subject.name,
      slug: row.subject.slug,
      classLevel: row.subject.classLevel as 10 | 12,
    },
    questionCount: row.sections.reduce((sum, section) => sum + section.slots.length, 0),
  };
}

function toPlan(planned: PaperPlanResult, blueprint: ExamBlueprint, key: string): PaperPlan {
  return {
    blueprintKey: key,
    blueprintName: blueprint.name,
    complete: planned.complete,
    totalMarks: planned.totalMarks,
    blueprintMarks: blueprint.totalMarks,
    questionCount: planned.questionCount,
    shortfalls: planned.shortfalls,
    questionsUsed: planned.questionsUsed,
  };
}

function parseStructure(structure: unknown, key: string): ExamBlueprint {
  const parsed = examBlueprintSchema.safeParse(structure);

  if (!parsed.success) {
    throw new ValidationError(
      `The stored structure for blueprint "${key}" no longer matches the blueprint schema`,
      parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }

  return parsed.data;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
