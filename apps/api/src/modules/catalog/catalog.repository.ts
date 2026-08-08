import type { Board } from "@samjho/contracts";

import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";

/**
 * Catalog data access. Prisma lives here and nowhere else in this module.
 *
 * Only the slice Phase 2 needs — enough to validate that the subjects a student
 * picked during onboarding actually exist for their board and class. The rest of
 * the catalog (chapters, topics, question counts) lands in Phase 3.
 */

export const enrollableSubjectSelect = {
  id: true,
  code: true,
  name: true,
  slug: true,
  variant: true,
  classLevel: true,
  theoryMarks: true,
} satisfies Prisma.SubjectSelect;

export type EnrollableSubjectRow = Prisma.SubjectGetPayload<{
  select: typeof enrollableSubjectSelect;
}>;

export const catalogRepository = {
  /**
   * Subjects among `ids` that are active and belong to this board and class.
   *
   * The board/class predicate is in the `WHERE` clause rather than applied after
   * fetching, for the same reason ownership checks are (docs/02 §4): a filter
   * you have to remember to apply is a filter you will eventually forget. Here
   * forgetting it would let a Class 10 account enrol in Class 12 Physics and
   * quietly corrupt every aggregate built on top of that enrolment.
   */
  findEnrollable(params: {
    ids: string[];
    board: Board;
    classLevel: number;
  }): Promise<EnrollableSubjectRow[]> {
    return prisma.subject.findMany({
      where: {
        id: { in: params.ids },
        board: params.board,
        classLevel: params.classLevel,
        isActive: true,
      },
      select: enrollableSubjectSelect,
      orderBy: { orderIndex: "asc" },
    });
  },

  /**
   * Look subjects up by id for *display*, with no board/class/active filter.
   *
   * Separate from `findEnrollable` on purpose. That one answers "may this
   * student enrol in these?" and must be strict. This one answers "what are the
   * subjects this student is already enrolled in called?" — and a subject that
   * has since been deactivated should still render with its name rather than
   * vanish from the student's own profile page.
   */
  findByIds(ids: string[]): Promise<EnrollableSubjectRow[]> {
    return prisma.subject.findMany({
      where: { id: { in: ids } },
      select: enrollableSubjectSelect,
      orderBy: { orderIndex: "asc" },
    });
  },

  listActive(params: { board: Board; classLevel: number }): Promise<EnrollableSubjectRow[]> {
    return prisma.subject.findMany({
      where: { board: params.board, classLevel: params.classLevel, isActive: true },
      select: enrollableSubjectSelect,
      orderBy: { orderIndex: "asc" },
    });
  },
};
