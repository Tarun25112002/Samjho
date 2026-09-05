import {
  pastPaperLabel,
  type ListPastPapersQuery,
  type Paginated,
  type PastPaper,
  type PastPaperCoverage,
  type PastPaperYearCoverage,
  type PastPaperYearOption,
  type WritePastPaperInput,
} from "@samjho/contracts";

import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import {
  pastPaperRepository,
  type PaperCounts,
  type PastPaperRow,
} from "./past-paper.repository.js";

/**
 * The past-paper registry: what we mean to hold, and how much of it we have.
 *
 * ## Coverage is a fraction that is allowed to be unknown
 *
 * `coverage` is null whenever `printedQuestionCount` is null, and that null
 * propagates all the way to the year totals in the grid. The alternative —
 * treating an uncounted paper as a denominator of zero, or of however many
 * questions happen to be in it — produces a progress bar that reads 100% for a
 * paper nobody has opened. A grid that says "not counted" for a third of 2007 is
 * telling the truth about a content project that is years long; one that says
 * 100% is not.
 *
 * ## Incomplete is derived, never stored
 *
 * There is no `status` column on `PastPaper` and there will not be one. A paper
 * is complete when the questions we hold reach the printed count, which is two
 * numbers the database already has. A stored status is a third number that has
 * to be updated by every path that writes a question, and drifts the first time
 * one of them doesn't.
 */

function toCoverage(imported: number, printed: number | null): number | null {
  if (printed === null || printed === 0) return null;
  return Math.min(1, imported / printed);
}

function toPastPaper(row: PastPaperRow, counts: PaperCounts | undefined): PastPaper {
  const imported = counts?.imported ?? 0;

  return {
    id: row.id,
    subjectId: row.subjectId,
    subjectName: row.subject.name,
    classLevel: row.subject.classLevel,

    year: row.year,
    examSession: row.examSession,
    paperCode: row.paperCode,
    setCode: row.setCode,
    region: row.region,

    label: pastPaperLabel(row),

    printedQuestionCount: row.printedQuestionCount,
    totalMarks: row.totalMarks,
    wasHeld: row.wasHeld,
    sourceUrl: row.sourceUrl,
    licenceStatus: row.licenceStatus,
    notes: row.notes,

    importedQuestions: imported,
    publishedQuestions: counts?.published ?? 0,
    coverage: toCoverage(imported, row.printedQuestionCount),

    updatedAt: row.updatedAt.toISOString(),
  };
}

export const pastPaperService = {
  /**
   * One page of the registry.
   *
   * `incompleteOnly` is applied here rather than in the `WHERE`, because "still
   * short of its printed count" compares a stored column against a count of
   * another table — expressible in raw SQL, not in a Prisma filter, and not
   * worth dropping to raw SQL for a screen an editor opens a few times a day.
   *
   * The cost is that a filtered page can come back shorter than `limit` while
   * still reporting `hasMore`. That is the honest answer for a filter applied
   * after paging, and the cursor stays correct — the next page continues from
   * where this one stopped rather than from where it thinned out.
   */
  async list(query: ListPastPapersQuery): Promise<Paginated<PastPaper>> {
    const { rows, hasMore } = await pastPaperRepository.list(query);
    const counts = await pastPaperRepository.countsByPaper(rows.map((row) => row.id));

    let items = rows.map((row) => toPastPaper(row, counts.get(row.id)));

    if (query.incompleteOnly) {
      items = items.filter((paper) => paper.coverage === null || paper.coverage < 1);
    }

    return {
      items,
      pageInfo: {
        nextCursor: hasMore ? (rows.at(-1)?.id ?? null) : null,
        hasMore,
      },
    };
  },

  async getById(id: string): Promise<PastPaper> {
    const row = await pastPaperRepository.findById(id);
    if (!row) throw new NotFoundError("Past paper");

    const counts = await pastPaperRepository.countsByPaper([row.id]);
    return toPastPaper(row, counts.get(row.id));
  },

  /**
   * Register a paper.
   *
   * The duplicate check is a read before the write *and* a unique index behind
   * it. The read exists to produce a message naming the paper — "CBSE 2024 ·
   * March · 30/1/1 Set 1 is already registered" is actionable where a constraint
   * violation is not — and the index exists because the read cannot be trusted
   * under two editors registering the same paper at once.
   */
  async create(input: WritePastPaperInput): Promise<PastPaper> {
    const subject = await prisma.subject.findUnique({
      where: { id: input.subjectId },
      select: { id: true },
    });
    if (!subject) throw new NotFoundError("Subject");

    const existing = await pastPaperRepository.findByIdentity({
      subjectId: input.subjectId,
      year: input.year,
      examSession: input.examSession,
      paperCode: input.paperCode,
      setCode: input.setCode,
    });

    if (existing) {
      throw new ConflictError(`${pastPaperLabel(existing)} is already registered`);
    }

    const row = await pastPaperRepository.create(input);
    return toPastPaper(row, { imported: 0, published: 0 });
  },

  async update(id: string, input: WritePastPaperInput): Promise<PastPaper> {
    const current = await pastPaperRepository.findById(id);
    if (!current) throw new NotFoundError("Past paper");

    const identityChanged =
      current.year !== input.year ||
      current.examSession !== input.examSession ||
      current.paperCode !== input.paperCode ||
      current.setCode !== input.setCode;

    if (identityChanged) {
      const clash = await pastPaperRepository.findByIdentity({
        subjectId: current.subjectId,
        year: input.year,
        examSession: input.examSession,
        paperCode: input.paperCode,
        setCode: input.setCode,
      });

      if (clash && clash.id !== id) {
        throw new ConflictError(`${pastPaperLabel(clash)} is already registered`);
      }
    }

    const row = await pastPaperRepository.update(id, input);
    const counts = await pastPaperRepository.countsByPaper([row.id]);
    return toPastPaper(row, counts.get(row.id));
  },

  /**
   * The backlog for one subject, one row per year.
   *
   * Years with no registered paper at all are absent rather than present with
   * zeroes. The grid is built from what the registry says exists, and inventing
   * a row for 2003 because it falls inside the range would claim CBSE sat a
   * paper nobody has checked — which for 2021 would be false.
   */
  async coverage(subjectId: string): Promise<PastPaperCoverage> {
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      select: { id: true, name: true, classLevel: true },
    });
    if (!subject) throw new NotFoundError("Subject");

    const rows = await pastPaperRepository.listAllForSubject(subjectId);
    const counts = await pastPaperRepository.countsByPaper(rows.map((row) => row.id));

    const byYear = new Map<number, PastPaperYearCoverage>();
    let importedQuestions = 0;
    let papersWithQuestions = 0;

    for (const row of rows) {
      const imported = counts.get(row.id)?.imported ?? 0;
      importedQuestions += imported;
      if (imported > 0) papersWithQuestions += 1;

      const entry = byYear.get(row.year) ?? {
        year: row.year,
        papers: 0,
        held: 0,
        importedQuestions: 0,
        printedQuestions: 0 as number | null,
      };

      entry.papers += 1;
      if (row.wasHeld) entry.held += 1;
      entry.importedQuestions += imported;

      // One uncounted paper makes the year's denominator unknown, and it stays
      // unknown however many of its siblings have been counted. Summing only the
      // known ones would produce a year total smaller than the year's real paper
      // count, which reads as *better* coverage the less we know.
      if (row.printedQuestionCount === null) {
        entry.printedQuestions = null;
      } else if (entry.printedQuestions !== null) {
        entry.printedQuestions += row.printedQuestionCount;
      }

      byYear.set(row.year, entry);
    }

    return {
      subjectId: subject.id,
      subjectName: subject.name,
      classLevel: subject.classLevel,
      years: [...byYear.values()].sort((left, right) => right.year - left.year),
      totalPapers: rows.length,
      papersWithQuestions,
      importedQuestions,
    };
  },

  /** The year chips a student sees. Empty until the bank has board questions. */
  async yearOptions(subjectId: string): Promise<PastPaperYearOption[]> {
    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, isActive: true },
      select: { id: true },
    });
    if (!subject) throw new NotFoundError("Subject");

    return pastPaperRepository.yearOptions(subjectId);
  },
};
