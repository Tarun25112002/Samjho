import type { Board } from "@samjho/contracts";

import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { STUDENT_VISIBLE_TOP_LEVEL } from "../questions/question.visibility.js";

/**
 * Catalog data access. Prisma lives here and nowhere else in this module.
 *
 * Only the slice Phase 2 needs — enough to validate that the subjects a student
 * picked during onboarding actually exist for their board and class. The rest of
 * the catalog (chapters, topics, question counts) lands in Phase 3.
 */

export const enrollableSubjectSelect = {
  id: true,
  board: true,
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

  /** By id or slug — students arrive from readable URLs, code arrives with ids. */
  findSubject(idOrSlug: string): Promise<SubjectRow | null> {
    return prisma.subject.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], isActive: true },
      select: subjectSelect,
    });
  },

  listChapters(subjectId: string): Promise<ChapterRow[]> {
    return prisma.chapter.findMany({
      where: { subjectId, isActive: true },
      select: chapterSelect,
      // Domain first so Science's Physics/Chemistry/Biology sections come out
      // contiguous; nulls sort last in Postgres ascending, which is harmless
      // because a subject either has domains on every chapter or on none.
      orderBy: [{ domain: "asc" }, { orderIndex: "asc" }],
    });
  },

  findChapter(idOrSlug: string): Promise<ChapterDetailRow | null> {
    return prisma.chapter.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], isActive: true },
      select: {
        ...chapterSelect,
        subject: { select: enrollableSubjectSelect },
        topics: {
          where: { isActive: true },
          select: { id: true, name: true, slug: true, orderIndex: true },
          orderBy: { orderIndex: "asc" },
        },
      },
    });
  },

  /**
   * Student-visible question counts, grouped.
   *
   * One `groupBy` per dimension rather than fetching rows and tallying in
   * JavaScript. On a table heading for six figures of rows, the difference is
   * an index-only aggregate versus shipping every matching row over the wire to
   * count them — and the second one works fine right up until it does not.
   */
  countByChapter(subjectId: string): Promise<{ chapterId: string; count: number }[]> {
    return prisma.question
      .groupBy({
        by: ["chapterId"],
        where: { subjectId, ...STUDENT_VISIBLE_TOP_LEVEL },
        _count: { _all: true },
      })
      .then((rows) => rows.map((row) => ({ chapterId: row.chapterId, count: row._count._all })));
  },

  countTopicsByChapter(subjectId: string): Promise<{ chapterId: string; count: number }[]> {
    return prisma.topic
      .groupBy({
        by: ["chapterId"],
        where: { isActive: true, chapter: { subjectId } },
        _count: { _all: true },
      })
      .then((rows) => rows.map((row) => ({ chapterId: row.chapterId, count: row._count._all })));
  },

  countByType(where: Prisma.QuestionWhereInput): Promise<{ type: string; count: number }[]> {
    return prisma.question
      .groupBy({
        by: ["type"],
        where: { ...where, ...STUDENT_VISIBLE_TOP_LEVEL },
        _count: { _all: true },
      })
      .then((rows) => rows.map((row) => ({ type: row.type, count: row._count._all })));
  },

  countByDifficulty(
    where: Prisma.QuestionWhereInput,
  ): Promise<{ difficulty: string; count: number }[]> {
    return prisma.question
      .groupBy({
        by: ["difficulty"],
        where: { ...where, ...STUDENT_VISIBLE_TOP_LEVEL },
        _count: { _all: true },
      })
      .then((rows) => rows.map((row) => ({ difficulty: row.difficulty, count: row._count._all })));
  },

  /**
   * Per-topic counts for one chapter.
   *
   * Counted through `QuestionTopic`, so a question tagged with three topics
   * contributes to all three — which is what a student expects when they filter
   * by topic. It also means the topic counts sum to more than the chapter count,
   * and the UI must not present them as a partition.
   */
  countByTopic(chapterId: string): Promise<{ topicId: string; count: number }[]> {
    return prisma.questionTopic
      .groupBy({
        by: ["topicId"],
        where: { topic: { chapterId }, question: STUDENT_VISIBLE_TOP_LEVEL },
        _count: { _all: true },
      })
      .then((rows) => rows.map((row) => ({ topicId: row.topicId, count: row._count._all })));
  },
};

const subjectSelect = {
  ...enrollableSubjectSelect,
  syllabusYear: true,
  hasPractical: true,
  internalMarks: true,
} satisfies Prisma.SubjectSelect;

export type SubjectRow = Prisma.SubjectGetPayload<{ select: typeof subjectSelect }>;

const chapterSelect = {
  id: true,
  name: true,
  slug: true,
  orderIndex: true,
  ncertChapterNo: true,
  domain: true,
} satisfies Prisma.ChapterSelect;

export type ChapterRow = Prisma.ChapterGetPayload<{ select: typeof chapterSelect }>;

export type ChapterDetailRow = Prisma.ChapterGetPayload<{
  select: typeof chapterSelect & {
    subject: { select: typeof enrollableSubjectSelect };
    topics: { select: { id: true; name: true; slug: true; orderIndex: true } };
  };
}>;
