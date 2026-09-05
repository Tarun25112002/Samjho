import type { ListPastPapersQuery, WritePastPaperInput } from "@samjho/contracts";
import { PREVIOUS_YEAR_SOURCE_TYPES } from "@samjho/contracts";

import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { STUDENT_VISIBLE_TOP_LEVEL } from "../questions/question.visibility.js";

/**
 * Past-paper registry data access.
 *
 * ## Counting questions is the whole job
 *
 * Every read here carries two numbers a registry row does not store: how many
 * questions we hold from the paper, and how many of those a student can be
 * shown. They are counted rather than stored because a stored counter has to be
 * maintained by every path that writes a question — the ingest service, the
 * single-question admin form, the bulk importer, a status change, a delete —
 * and the first one that forgets leaves a coverage grid that quietly lies.
 *
 * Both counts restrict to **top-level** questions, matching the counting rule
 * used everywhere else: a case study is one question worth four marks, not
 * three questions. A paper printed with 38 numbered questions is complete at 38
 * rows, and counting sub-parts would report 51 out of 38.
 *
 * ## Why Prisma's `_count` is not used for it
 *
 * `_count` on the `questionSources` relation counts *source rows*, and a case
 * study's sub-parts each carry a copy of the parent's provenance. That number is
 * right for "how many rows point at this paper" and wrong for every question a
 * human would ask. So the counts come from a query over `Question` with the
 * top-level and licence predicates applied, and the registry row itself stays a
 * plain select.
 */

export const pastPaperSelect = {
  id: true,
  subjectId: true,
  year: true,
  examSession: true,
  paperCode: true,
  setCode: true,
  region: true,
  printedQuestionCount: true,
  totalMarks: true,
  wasHeld: true,
  sourceUrl: true,
  licenceStatus: true,
  notes: true,
  updatedAt: true,
  subject: { select: { id: true, name: true, classLevel: true } },
} satisfies Prisma.PastPaperSelect;

export type PastPaperRow = Prisma.PastPaperGetPayload<{ select: typeof pastPaperSelect }>;

/** How many questions we hold from a paper, and how many are servable. */
export interface PaperCounts {
  imported: number;
  published: number;
}

/**
 * The identity a paper is matched on when an ingest file arrives.
 *
 * Deliberately the same five columns as the unique index rather than a subset:
 * an ingest matching on year and session alone would fold three regional sets of
 * 2016 into one registry row, and the coverage grid would then report a third of
 * the year's questions as all of it.
 */
export interface PaperIdentity {
  subjectId: string;
  year: number;
  examSession: string;
  paperCode: string | null;
  setCode: string | null;
}

function toWhere(query: ListPastPapersQuery): Prisma.PastPaperWhereInput {
  const where: Prisma.PastPaperWhereInput = {};

  if (query.subjectId) where.subjectId = query.subjectId;

  if (query.yearFrom !== undefined || query.yearTo !== undefined) {
    where.year = {
      ...(query.yearFrom !== undefined ? { gte: query.yearFrom } : {}),
      ...(query.yearTo !== undefined ? { lte: query.yearTo } : {}),
    };
  }

  // Cancelled sittings are hidden unless asked for. They are permanent holes in
  // the grid rather than work anybody can do, and leaving them in the default
  // list makes the backlog look longer than it is every time someone scans it.
  if (!query.includeNotHeld) where.wasHeld = true;

  return where;
}

export const pastPaperRepository = {
  /**
   * One page of registry rows, newest year first.
   *
   * Ordered by year descending then id rather than by id alone: the registry is
   * read as a backlog, and the papers anyone is actually working on are the
   * recent ones. The id tiebreak keeps the cursor stable — several papers share
   * a year, and they would otherwise page unpredictably.
   */
  async list(query: ListPastPapersQuery): Promise<{ rows: PastPaperRow[]; hasMore: boolean }> {
    const rows = await prisma.pastPaper.findMany({
      where: toWhere(query),
      select: pastPaperSelect,
      orderBy: [{ year: "desc" }, { id: "asc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > query.limit;
    return { rows: hasMore ? rows.slice(0, query.limit) : rows, hasMore };
  },

  findById(id: string): Promise<PastPaperRow | null> {
    return prisma.pastPaper.findUnique({ where: { id }, select: pastPaperSelect });
  },

  /**
   * Find a paper by the identity an ingest file declares.
   *
   * `findFirst` rather than `findUnique`, because `findUnique` on the compound
   * key cannot express "paperCode IS NULL" — Prisma rejects null inside a unique
   * `where`, which is the same NULL-distinctness problem the partial indexes in
   * the migration exist to solve. A plain equality filter handles null correctly
   * on the read side; the partial indexes handle it on the write side.
   */
  findByIdentity(identity: PaperIdentity): Promise<PastPaperRow | null> {
    return prisma.pastPaper.findFirst({
      where: {
        subjectId: identity.subjectId,
        year: identity.year,
        examSession: identity.examSession,
        paperCode: identity.paperCode,
        setCode: identity.setCode,
      },
      select: pastPaperSelect,
    });
  },

  /**
   * The unclaimed placeholder for a sitting, if there is one.
   *
   * A placeholder is a registry row naming a sitting with no paper identified —
   * which is every row the backlog seed writes. The first real paper loaded for
   * that sitting claims it rather than registering alongside it, so a seeded
   * 26-year grid resolves into real papers instead of accumulating a shadow row
   * per year that can never be completed.
   *
   * Region is not part of the match. A placeholder says nothing about region, so
   * a Delhi paper and an Outside Delhi paper are equally entitled to claim it —
   * whichever arrives first does, and the second registers itself normally.
   */
  findPlaceholder(sitting: {
    subjectId: string;
    year: number;
    examSession: string;
  }): Promise<PastPaperRow | null> {
    return prisma.pastPaper.findFirst({
      where: { ...sitting, paperCode: null, setCode: null },
      select: pastPaperSelect,
    });
  },

  create(input: WritePastPaperInput): Promise<PastPaperRow> {
    return prisma.pastPaper.create({ data: { ...input }, select: pastPaperSelect });
  },

  /**
   * Update a registry row.
   *
   * `subjectId` is in the input type but deliberately not written: moving a
   * paper between subjects would leave every question filed against it counted
   * under a subject it does not belong to. Register the paper again instead.
   */
  update(id: string, input: WritePastPaperInput): Promise<PastPaperRow> {
    const { subjectId: _subjectId, ...rest } = input;

    return prisma.pastPaper.update({
      where: { id },
      data: rest,
      select: pastPaperSelect,
    });
  },

  /**
   * Imported and published question counts for a set of papers.
   *
   * One query for the whole page rather than two per paper. Over a 26-year grid
   * with several sets a year that is the difference between a screen that loads
   * and a screen that issues 150 counts.
   *
   * The grouping happens in memory because Prisma cannot `groupBy` a column on a
   * related table, and the projection it groups over is bounded by one page of
   * papers times one paper's worth of questions — a few thousand rows at the
   * absolute worst, a few dozen in practice.
   */
  async countsByPaper(paperIds: string[]): Promise<Map<string, PaperCounts>> {
    const counts = new Map<string, PaperCounts>();
    if (paperIds.length === 0) return counts;

    for (const id of paperIds) counts.set(id, { imported: 0, published: 0 });

    const rows = await prisma.question.findMany({
      where: { parentId: null, source: { pastPaperId: { in: paperIds } } },
      select: {
        status: true,
        chapter: { select: { isActive: true, subject: { select: { isActive: true } } } },
        source: { select: { pastPaperId: true, licenceStatus: true } },
      },
    });

    for (const row of rows) {
      const paperId = row.source?.pastPaperId;
      if (!paperId) continue;

      const entry = counts.get(paperId);
      if (!entry) continue;

      entry.imported += 1;

      // The same three rules as `STUDENT_VISIBLE_QUESTION`, applied here rather
      // than in a second query. Reproduced by hand is a smell, but a coverage
      // number that counts a restricted or withdrawn question as servable tells
      // an editor the work is done when a student can see none of it.
      const visible =
        row.status === "PUBLISHED" &&
        row.source?.licenceStatus !== "RESTRICTED" &&
        row.chapter.isActive &&
        row.chapter.subject.isActive;

      if (visible) entry.published += 1;
    }

    return counts;
  },

  /**
   * Every registry row for one subject — the coverage grid.
   *
   * Unpaginated on purpose. The grid is one row per sitting over a range
   * measured in decades, so the result is bounded by the calendar rather than by
   * the content, and paging it would mean a screen that answers "how far through
   * 2001-2026 are we" in instalments.
   */
  listAllForSubject(subjectId: string): Promise<PastPaperRow[]> {
    return prisma.pastPaper.findMany({
      where: { subjectId },
      select: pastPaperSelect,
      orderBy: [{ year: "desc" }, { examSession: "asc" }, { id: "asc" }],
    });
  },

  /**
   * The years a student may filter by, for one subject.
   *
   * Counts *student-visible* questions only, and reads the year off the question
   * source rather than off the registry — a question typed in from a photocopy
   * of a paper nobody registered still has a year, and a student asking for 2013
   * should get it. The registry is the editorial backlog; this is the bank.
   */
  async yearOptions(subjectId: string): Promise<{ year: number; questionCount: number }[]> {
    const rows = await prisma.question.findMany({
      where: {
        ...STUDENT_VISIBLE_TOP_LEVEL,
        subjectId,
        source: {
          sourceType: { in: [...PREVIOUS_YEAR_SOURCE_TYPES] },
          year: { not: null },
        },
      },
      select: { source: { select: { year: true } } },
    });

    const byYear = new Map<number, number>();
    for (const row of rows) {
      const year = row.source?.year;
      if (year === null || year === undefined) continue;
      byYear.set(year, (byYear.get(year) ?? 0) + 1);
    }

    return [...byYear.entries()]
      .map(([year, questionCount]) => ({ year, questionCount }))
      .sort((left, right) => right.year - left.year);
  },
};
