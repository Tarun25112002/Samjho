import type { ListExamPapersQuery } from "@samjho/contracts";

import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { STUDENT_VISIBLE_TOP_LEVEL } from "../questions/question.visibility.js";
import type { CandidateQuestion, PlannedSection } from "./paper.planner.js";

/**
 * Exam paper data access.
 *
 * The select below is the structural half of the rule in `paper.schema.ts`: a
 * paper's *shape* is readable, its questions are not. `paperStructureSelect`
 * reaches into slot items only far enough to read each question's `type` — which
 * is what lets a student see that Section A is multiple choice — and asks for no
 * body, no options and no answer. The row type therefore has nowhere to put a
 * question in, exactly as `studentQuestionSelect` has nowhere to put an answer.
 *
 * The attempt path (Phase 6, next sub-step) will need a different select that
 * *does* hydrate the questions. It will be a separate constant used by separate
 * methods, never this one plus a flag.
 */

export const paperStructureSelect = {
  id: true,
  title: true,
  slug: true,
  paperType: true,
  status: true,
  year: true,
  setCode: true,
  totalMarks: true,
  durationMinutes: true,
  generalInstructions: true,

  subject: { select: { id: true, name: true, slug: true, classLevel: true } },
  blueprint: { select: { key: true, name: true, academicYear: true } },

  sections: {
    select: {
      id: true,
      name: true,
      orderIndex: true,
      instructions: true,
      marksPerQuestion: true,
      slots: {
        select: {
          id: true,
          questionNumber: true,
          orderIndex: true,
          marks: true,
          isOptional: true,
          // `type` and nothing else. Enough to describe the position, not enough
          // to answer it in advance.
          items: { select: { variantLabel: true, question: { select: { type: true } } } },
        },
        orderBy: { orderIndex: "asc" },
      },
    },
    orderBy: { orderIndex: "asc" },
  },
} satisfies Prisma.ExamPaperSelect;

export type PaperStructureRow = Prisma.ExamPaperGetPayload<{
  select: typeof paperStructureSelect;
}>;

/** Only a published paper may be listed, read or sat. */
const VISIBLE_PAPER: Prisma.ExamPaperWhereInput = {
  status: "PUBLISHED",
  subject: { isActive: true },
};

export interface WritePaperData {
  subjectId: string;
  blueprintId: string;
  title: string;
  slug: string;
  totalMarks: number;
  durationMinutes: number;
  generalInstructions: string[];
  sections: PlannedSection[];
}

export const paperRepository = {
  findBlueprintByKey(key: string) {
    return prisma.examBlueprint.findFirst({
      where: { key, isActive: true },
      select: {
        id: true,
        key: true,
        name: true,
        subjectId: true,
        structure: true,
        totalMarks: true,
        durationMinutes: true,
        verifiedAgainstOfficial: true,
      },
    });
  },

  /**
   * Every question the generator may draw from.
   *
   * Same `STUDENT_VISIBLE_TOP_LEVEL` predicate as practice, which is the point:
   * a question that is too draft-y or too licence-restricted to appear in a
   * ten-question practice set is certainly too much so to appear in a three-hour
   * exam. One definition of "servable", used by both.
   *
   * Sub-part marks come back with the row because the planner has to match them
   * against the blueprint's sub-part rule, and fetching them per candidate
   * afterwards would be a query per question.
   */
  async findCandidates(subjectId: string, chapterIds: string[]): Promise<CandidateQuestion[]> {
    const rows = await prisma.question.findMany({
      where: {
        ...STUDENT_VISIBLE_TOP_LEVEL,
        subjectId,
        ...(chapterIds.length > 0 ? { chapterId: { in: chapterIds } } : {}),
      },
      select: {
        id: true,
        type: true,
        marks: true,
        isContainer: true,
        subParts: { select: { marks: true }, orderBy: { subPartIndex: "asc" } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      marks: row.marks,
      isContainer: row.isContainer,
      subPartMarks: row.subParts.map((part) => part.marks),
    }));
  },

  /**
   * Write the whole paper, or none of it.
   *
   * One transaction covering the paper, its sections, its slots and its items.
   * A half-written paper is not a recoverable state — it would be a paper with
   * Section A and no Section B, indistinguishable on inspection from a
   * deliberately short one, and startable by a student.
   */
  create(data: WritePaperData): Promise<PaperStructureRow> {
    return prisma.$transaction(async (tx) => {
      const paper = await tx.examPaper.create({
        data: {
          subjectId: data.subjectId,
          blueprintId: data.blueprintId,
          title: data.title,
          slug: data.slug,
          paperType: "GENERATED_MOCK",
          totalMarks: data.totalMarks,
          durationMinutes: data.durationMinutes,
          generalInstructions: data.generalInstructions,
          status: "DRAFT",
        },
        select: { id: true },
      });

      for (const section of data.sections) {
        const created = await tx.examSection.create({
          data: {
            paperId: paper.id,
            name: section.name,
            orderIndex: section.orderIndex,
            instructions: section.instructions,
            marksPerQuestion: section.marksPerQuestion,
          },
          select: { id: true },
        });

        for (const slot of section.slots) {
          await tx.examSlot.create({
            data: {
              sectionId: created.id,
              questionNumber: slot.questionNumber,
              orderIndex: slot.orderIndex,
              marks: slot.marks,
              isOptional: slot.isOptional,
              items: {
                create: slot.items.map((item, index) => ({
                  questionId: item.questionId,
                  variantLabel: item.variant,
                  orderIndex: index,
                })),
              },
            },
          });
        }
      }

      // Re-read outside the writes but inside the transaction: the nested read
      // is a single query tree rather than the concurrent relation loads the
      // Phase 4 editor had to avoid.
      return tx.examPaper.findUniqueOrThrow({
        where: { id: paper.id },
        select: paperStructureSelect,
      });
    });
  },

  findById(id: string): Promise<PaperStructureRow | null> {
    return prisma.examPaper.findFirst({
      where: { id, ...VISIBLE_PAPER },
      select: paperStructureSelect,
    });
  },

  /** Admin read: any status, because an editor's job is the drafts. */
  findByIdForAdmin(id: string): Promise<PaperStructureRow | null> {
    return prisma.examPaper.findUnique({ where: { id }, select: paperStructureSelect });
  },

  async list(query: ListExamPapersQuery): Promise<{ rows: PaperStructureRow[]; hasMore: boolean }> {
    const rows = await prisma.examPaper.findMany({
      where: {
        ...VISIBLE_PAPER,
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
        ...(query.paperType ? { paperType: query.paperType } : {}),
      },
      select: paperStructureSelect,
      orderBy: [{ year: "desc" }, { id: "asc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > query.limit;
    return { rows: hasMore ? rows.slice(0, query.limit) : rows, hasMore };
  },

  async listForAdmin(query: ListExamPapersQuery) {
    return prisma.examPaper.findMany({
      where: {
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
        ...(query.paperType ? { paperType: query.paperType } : {}),
      },
      select: {
        ...paperStructureSelect,
        createdAt: true,
        blueprint: { select: { key: true, name: true, academicYear: true } },
        _count: { select: { attempts: true } },
      },
      orderBy: { createdAt: "desc" },
      take: query.limit,
    });
  },

  setStatus(id: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED"): Promise<PaperStructureRow> {
    return prisma.examPaper.update({
      where: { id },
      data: { status, publishedAt: status === "PUBLISHED" ? new Date() : null },
      select: paperStructureSelect,
    });
  },

  countPapersForBlueprint(blueprintId: string): Promise<number> {
    return prisma.examPaper.count({ where: { blueprintId } });
  },
};
