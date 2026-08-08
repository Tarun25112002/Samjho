import type {
  Board,
  CreateChapterInput,
  CreateSubjectInput,
  CreateTopicInput,
  UpdateChapterInput,
  UpdateSubjectInput,
  UpdateTopicInput,
} from "@samjho/contracts";

import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";

/**
 * Drop keys whose value is `undefined`.
 *
 * Needed because a `.partial()` Zod schema produces `{ name?: string | undefined }`
 * while Prisma's update input means something specific by a present key — and
 * under `exactOptionalPropertyTypes` the compiler is right to refuse the two as
 * interchangeable. Passing `{ name: undefined }` through would be harmless today
 * and a silent field-clearing bug the day Prisma decides an explicit `undefined`
 * means `null`. Stripping makes "absent" and "absent" the same thing at every
 * layer.
 */
function defined<T extends object>(input: T): { [K in keyof T]: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as {
    [K in keyof T]: Exclude<T[K], undefined>;
  };
}

/**
 * Taxonomy writes. Separate file from `catalog.repository.ts` on purpose.
 *
 * The read repository is deliberately narrow — it never selects `isActive`, never
 * returns a draft, and its `where` clauses hard-code the student's view. Mixing
 * writes that must see everything into the same file makes it far too easy to
 * reuse a select that was built for one audience on a query serving the other.
 * Two files, two audiences.
 */

export const adminSubjectSelect = {
  id: true,
  board: true,
  classLevel: true,
  code: true,
  name: true,
  slug: true,
  variant: true,
  theoryMarks: true,
  hasPractical: true,
  internalMarks: true,
  syllabusYear: true,
  isActive: true,
  orderIndex: true,
} satisfies Prisma.SubjectSelect;

export type AdminSubjectRow = Prisma.SubjectGetPayload<{ select: typeof adminSubjectSelect }>;

export const adminChapterSelect = {
  id: true,
  subjectId: true,
  name: true,
  slug: true,
  orderIndex: true,
  ncertChapterNo: true,
  domain: true,
  isActive: true,
  topics: {
    select: { id: true, name: true, slug: true, orderIndex: true, isActive: true },
    orderBy: { orderIndex: "asc" },
  },
} satisfies Prisma.ChapterSelect;

export type AdminChapterRow = Prisma.ChapterGetPayload<{ select: typeof adminChapterSelect }>;

export const adminTopicSelect = {
  id: true,
  chapterId: true,
  name: true,
  slug: true,
  orderIndex: true,
  isActive: true,
} satisfies Prisma.TopicSelect;

export type AdminTopicRow = Prisma.TopicGetPayload<{ select: typeof adminTopicSelect }>;

export const catalogAdminRepository = {
  listSubjects(params: {
    board?: Board;
    classLevel?: number;
    includeInactive: boolean;
  }): Promise<AdminSubjectRow[]> {
    return prisma.subject.findMany({
      where: {
        ...(params.board === undefined ? {} : { board: params.board }),
        ...(params.classLevel === undefined ? {} : { classLevel: params.classLevel }),
        ...(params.includeInactive ? {} : { isActive: true }),
      },
      select: adminSubjectSelect,
      orderBy: [{ classLevel: "asc" }, { orderIndex: "asc" }, { code: "asc" }],
    });
  },

  findSubjectById(id: string): Promise<AdminSubjectRow | null> {
    return prisma.subject.findUnique({ where: { id }, select: adminSubjectSelect });
  },

  createSubject(input: CreateSubjectInput, orderIndex: number): Promise<AdminSubjectRow> {
    return prisma.subject.create({
      data: { ...input, orderIndex },
      select: adminSubjectSelect,
    });
  },

  updateSubject(id: string, input: UpdateSubjectInput): Promise<AdminSubjectRow> {
    return prisma.subject.update({
      where: { id },
      data: defined(input),
      select: adminSubjectSelect,
    });
  },

  /** Highest existing index, so a new row lands at the end rather than at 0. */
  async nextSubjectOrderIndex(board: Board, classLevel: number): Promise<number> {
    const last = await prisma.subject.findFirst({
      where: { board, classLevel },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });
    return (last?.orderIndex ?? -1) + 1;
  },

  listChapters(subjectId: string, includeInactive: boolean): Promise<AdminChapterRow[]> {
    return prisma.chapter.findMany({
      where: { subjectId, ...(includeInactive ? {} : { isActive: true }) },
      select: adminChapterSelect,
      orderBy: { orderIndex: "asc" },
    });
  },

  findChapterById(id: string): Promise<AdminChapterRow | null> {
    return prisma.chapter.findUnique({ where: { id }, select: adminChapterSelect });
  },

  createChapter(
    subjectId: string,
    input: CreateChapterInput,
    orderIndex: number,
  ): Promise<AdminChapterRow> {
    const { orderIndex: _ignored, ...rest } = input;
    return prisma.chapter.create({
      data: { ...rest, subjectId, orderIndex },
      select: adminChapterSelect,
    });
  },

  updateChapter(id: string, input: UpdateChapterInput): Promise<AdminChapterRow> {
    return prisma.chapter.update({
      where: { id },
      data: defined(input),
      select: adminChapterSelect,
    });
  },

  async nextChapterOrderIndex(subjectId: string): Promise<number> {
    const last = await prisma.chapter.findFirst({
      where: { subjectId },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });
    return (last?.orderIndex ?? -1) + 1;
  },

  /**
   * Rewrite a subject's chapter order in one transaction.
   *
   * All-or-nothing matters more than it looks. Applied one row at a time, a
   * failure halfway leaves the list in an order that is neither the old one nor
   * the new one, and nothing records that it happened. The uniqueness constraint
   * is on `(subjectId, slug)`, not on `orderIndex`, so duplicate indexes mid-flight
   * would not even be rejected — they would just render wrongly.
   */
  reorderChapters(subjectId: string, orderedIds: string[]): Promise<unknown> {
    return prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.chapter.update({ where: { id, subjectId }, data: { orderIndex: index } }),
      ),
    );
  },

  chapterIdsFor(subjectId: string): Promise<{ id: string }[]> {
    return prisma.chapter.findMany({ where: { subjectId }, select: { id: true } });
  },

  findTopicById(id: string): Promise<AdminTopicRow | null> {
    return prisma.topic.findUnique({ where: { id }, select: adminTopicSelect });
  },

  createTopic(
    chapterId: string,
    input: CreateTopicInput,
    orderIndex: number,
  ): Promise<AdminTopicRow> {
    const { orderIndex: _ignored, ...rest } = input;
    return prisma.topic.create({
      data: { ...rest, chapterId, orderIndex },
      select: adminTopicSelect,
    });
  },

  updateTopic(id: string, input: UpdateTopicInput): Promise<AdminTopicRow> {
    return prisma.topic.update({ where: { id }, data: defined(input), select: adminTopicSelect });
  },

  async nextTopicOrderIndex(chapterId: string): Promise<number> {
    const last = await prisma.topic.findFirst({
      where: { chapterId },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });
    return (last?.orderIndex ?? -1) + 1;
  },

  reorderTopics(chapterId: string, orderedIds: string[]): Promise<unknown> {
    return prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.topic.update({ where: { id, chapterId }, data: { orderIndex: index } }),
      ),
    );
  },

  topicIdsFor(chapterId: string): Promise<{ id: string }[]> {
    return prisma.topic.findMany({ where: { chapterId }, select: { id: true } });
  },

  /**
   * Counts for the admin view, which include drafts.
   *
   * `STUDENT_VISIBLE_*` is deliberately not used here. An editor deciding whether
   * to withdraw a chapter needs to know it holds 14 unpublished questions, and
   * that number is invisible through the student's filter.
   */
  countQuestionsBySubject(): Promise<{ subjectId: string; count: number }[]> {
    return prisma.question
      .groupBy({ by: ["subjectId"], where: { parentId: null }, _count: { _all: true } })
      .then((rows) => rows.map((row) => ({ subjectId: row.subjectId, count: row._count._all })));
  },

  countChaptersBySubject(): Promise<{ subjectId: string; count: number }[]> {
    return prisma.chapter
      .groupBy({ by: ["subjectId"], _count: { _all: true } })
      .then((rows) => rows.map((row) => ({ subjectId: row.subjectId, count: row._count._all })));
  },

  countQuestionsByChapter(
    subjectId: string,
    onlyPublished: boolean,
  ): Promise<{ chapterId: string; count: number }[]> {
    return prisma.question
      .groupBy({
        by: ["chapterId"],
        where: { subjectId, parentId: null, ...(onlyPublished ? { status: "PUBLISHED" } : {}) },
        _count: { _all: true },
      })
      .then((rows) => rows.map((row) => ({ chapterId: row.chapterId, count: row._count._all })));
  },

  countQuestionsByTopic(chapterId: string): Promise<{ topicId: string; count: number }[]> {
    return prisma.questionTopic
      .groupBy({
        by: ["topicId"],
        where: { topic: { chapterId }, question: { parentId: null } },
        _count: { _all: true },
      })
      .then((rows) => rows.map((row) => ({ topicId: row.topicId, count: row._count._all })));
  },
};
