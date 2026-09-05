import { PREVIOUS_YEAR_SOURCE_TYPES } from "@samjho/contracts";
import type { Difficulty, ListQuestionsQuery, QuestionType } from "@samjho/contracts";

import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { STUDENT_VISIBLE_QUESTION, STUDENT_VISIBLE_TOP_LEVEL } from "./question.visibility.js";

/**
 * Question data access.
 *
 * The select below is the enforcement point for the answer-key rule. It does not
 * ask for `answer`, and it does not ask for `options.isCorrect` — so the rows
 * this repository returns cannot contain an answer key even if a serializer
 * downstream were written carelessly. Prisma's generated types then make the
 * absence load-bearing: `row.answer` is a compile error, not `undefined`.
 *
 * A separate `adminQuestionSelect` will be added in Phase 4. It will be a
 * different constant used by different methods — never this one plus a flag.
 */
export const studentQuestionSelect = {
  id: true,
  type: true,
  body: true,
  marks: true,
  difficulty: true,
  bloomLevel: true,
  expectedTimeSeconds: true,
  version: true,
  isContainer: true,
  subPartIndex: true,

  chapter: { select: { id: true, name: true, slug: true, domain: true } },

  options: {
    // No `isCorrect`. This is the field the whole rule is about.
    select: { id: true, label: true, body: true, orderIndex: true },
    orderBy: { orderIndex: "asc" },
  },

  assets: {
    select: { id: true, kind: true, url: true, altText: true, caption: true, orderIndex: true },
    orderBy: { orderIndex: "asc" },
  },

  topics: {
    select: {
      isPrimary: true,
      topic: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { isPrimary: "desc" },
  },

  source: {
    select: {
      sourceType: true,
      year: true,
      examSession: true,
      setNumber: true,
      attributionText: true,
    },
  },

  subParts: {
    select: {
      id: true,
      type: true,
      body: true,
      marks: true,
      difficulty: true,
      bloomLevel: true,
      expectedTimeSeconds: true,
      version: true,
      subPartIndex: true,
      options: {
        select: { id: true, label: true, body: true, orderIndex: true },
        orderBy: { orderIndex: "asc" },
      },
      assets: {
        select: { id: true, kind: true, url: true, altText: true, caption: true, orderIndex: true },
        orderBy: { orderIndex: "asc" },
      },
    },
    orderBy: { subPartIndex: "asc" },
  },
} satisfies Prisma.QuestionSelect;

export type StudentQuestionRow = Prisma.QuestionGetPayload<{
  select: typeof studentQuestionSelect;
}>;

function toFilters(query: ListQuestionsQuery): Prisma.QuestionWhereInput {
  const where: Prisma.QuestionWhereInput = { ...STUDENT_VISIBLE_TOP_LEVEL };

  if (query.subjectId) where.subjectId = query.subjectId;
  if (query.chapterId) where.chapterId = query.chapterId;
  if (query.marks !== undefined) where.marks = query.marks;
  if (query.type) where.type = { in: query.type as QuestionType[] };
  if (query.difficulty) where.difficulty = { in: query.difficulty as Difficulty[] };

  // A topic lives on sub-parts as often as on the container, so a case study
  // whose parts are tagged "Arithmetic Progressions" must match a filter for
  // that topic. Matching only the parent's own tags would silently hide most
  // case studies from topic-filtered browsing.
  if (query.topicId) {
    where.OR = [
      { topics: { some: { topicId: query.topicId } } },
      { subParts: { some: { topics: { some: { topicId: query.topicId } } } } },
    ];
  }

  if (query.search) {
    where.body = { contains: query.search, mode: "insensitive" };
  }

  // Provenance filters are assembled into one clause rather than assigned one
  // at a time. `where.source` is a single relation filter, so a second
  // assignment silently replaces the first — "board questions from 2024" would
  // quietly become "anything from 2024". Building the object first makes that
  // shape impossible rather than a rule to remember.
  //
  // Note also that a non-null `source` filter *requires* the relation to exist,
  // which is correct here: a question with no recorded provenance did not come
  // from a paper, so it cannot match a paper filter.
  const source: Prisma.QuestionSourceWhereInput = {};

  if (query.previousYearOnly) source.sourceType = { in: [...PREVIOUS_YEAR_SOURCE_TYPES] };
  if (query.years?.length) source.year = { in: query.years };
  if (query.pastPaperId) source.pastPaperId = query.pastPaperId;

  if (Object.keys(source).length > 0) where.source = source;

  return where;
}

export const questionRepository = {
  /**
   * One page of questions.
   *
   * Fetches `limit + 1` and discards the extra: that is how "is there a next
   * page" is answered without a second `count(*)` over a filtered scan of what
   * will become the largest table in the database.
   *
   * Ordered by id — stable and indexed, but arbitrary in meaning. That is
   * deliberate for browsing; the practice-selection service in Phase 5 does its
   * own ordering, and giving this endpoint an opinion about pedagogical order
   * would be an opinion in the wrong place.
   */
  async list(query: ListQuestionsQuery): Promise<{ rows: StudentQuestionRow[]; hasMore: boolean }> {
    const rows = await prisma.question.findMany({
      where: toFilters(query),
      select: studentQuestionSelect,
      orderBy: { id: "asc" },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > query.limit;
    return { rows: hasMore ? rows.slice(0, query.limit) : rows, hasMore };
  },

  /**
   * A single question by id.
   *
   * The visibility predicate is in the `WHERE`, not checked after fetching. The
   * difference matters: this way an unpublished or restricted question is
   * indistinguishable from one that does not exist, so the endpoint cannot be
   * used to enumerate what is in the draft pipeline.
   */
  findById(id: string): Promise<StudentQuestionRow | null> {
    return prisma.question.findFirst({
      where: { id, ...STUDENT_VISIBLE_QUESTION },
      select: studentQuestionSelect,
    });
  },
};
