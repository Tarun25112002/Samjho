import type { Difficulty, PracticeFilters, PracticeMode, QuestionType } from "@samjho/contracts";

import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { STUDENT_VISIBLE_TOP_LEVEL } from "../questions/question.visibility.js";

/**
 * Choosing which questions go into a set.
 *
 * ## Why not `ORDER BY RANDOM()`
 *
 * It is one line and it does not survive contact with a real question bank:
 * Postgres has to assign a random value to *every* row matching the filter and
 * sort the lot to return ten of them. At the 100k-question volume this product
 * is aiming at, on the multi-column filters students actually use, that is the
 * query in docs/07 R4 that degrades — and it degrades on the endpoint a student
 * hits before they can do anything at all.
 *
 * So: **count, window, shuffle.** Three cheap steps.
 *
 *  1. `count` over the filter — an index-only scan, no rows materialised.
 *  2. Read a *window* of candidate ids at a random offset, ordered by id. Ids
 *     only, so it is still index-only; capped, so the memory is bounded no
 *     matter how broad the filter.
 *  3. Shuffle the window in memory and take what was asked for.
 *
 * The randomness is therefore two-level — a random window, then a random draw
 * inside it — which is not uniform over the whole table and does not need to be.
 * What a student needs is "not the same ten questions as last time", and two
 * levels of randomness deliver that at a cost that does not grow with the bank.
 *
 * ## Why the pool sizes are what they are
 *
 * The window is 400. Below about 100 the shuffle stops feeling random on a
 * repeated chapter; far above it, the id list stops being free. Profiling
 * against a seeded 100k bank belongs in Phase 9 (R4) and this is the constant it
 * will move.
 */
const CANDIDATE_WINDOW = 400;

export interface SelectionRequest {
  userId: string;
  mode: PracticeMode;
  filters: PracticeFilters;
  count: number;
}

/**
 * Build the `WHERE` for a practice draw.
 *
 * Starts from `STUDENT_VISIBLE_TOP_LEVEL` — published, licence-clear, in an
 * active chapter, and not a sub-part. Every one of those matters here as much as
 * it does in browsing, and the top-level clause matters more: drawing a sub-part
 * into a set would show a student "Calculate the current" with no circuit
 * described, because the stimulus lives on the parent.
 */
function toWhere(filters: PracticeFilters): Prisma.QuestionWhereInput {
  const where: Prisma.QuestionWhereInput = { ...STUDENT_VISIBLE_TOP_LEVEL };

  if (filters.subjectId) where.subjectId = filters.subjectId;
  if (filters.chapterId) where.chapterId = filters.chapterId;
  if (filters.marks !== undefined) where.marks = filters.marks;
  if (filters.types?.length) where.type = { in: filters.types as QuestionType[] };
  if (filters.difficulties?.length) {
    where.difficulty = { in: filters.difficulties as Difficulty[] };
  }

  // A case study's topics live on its sub-parts as often as on the container,
  // exactly as in browsing. Matching only the parent would hide most case
  // studies from a topic-filtered set.
  if (filters.topicId) {
    where.OR = [
      { topics: { some: { topicId: filters.topicId } } },
      { subParts: { some: { topics: { some: { topicId: filters.topicId } } } } },
    ];
  }

  return where;
}

export const practiceSelection = {
  /**
   * Pick the question ids for a new session.
   *
   * Returns fewer than `count` when the bank has fewer — never an error. A
   * chapter with six questions in it should give a student six, with the runner
   * saying so, rather than refusing to start. The bank is being written from
   * zero (docs/07 R1), so "not enough questions yet" is the normal case for
   * months, not an edge case.
   */
  async pick(request: SelectionRequest): Promise<string[]> {
    const pool = await candidatePool(request);
    if (pool === null) return [];

    const shuffled = shuffle(pool).slice(0, request.count);
    return orderForPractice(shuffled);
  },
};

/**
 * The ids a set may be drawn from, or null when the mode's own pool is empty.
 *
 * Null and `[]` mean different things and the caller does not need to tell them
 * apart — both produce an empty set — but the distinction is why the two
 * personal modes short-circuit rather than falling through to a query with
 * `id: { in: [] }`, which Postgres will happily plan and scan for nothing.
 */
async function candidatePool(request: SelectionRequest): Promise<Candidate[] | null> {
  const where = toWhere(request.filters);

  const personal = await personalPool(request);
  if (personal !== undefined) {
    if (personal.length === 0) return null;
    where.id = { in: personal };
  }

  if (request.mode === "PREVIOUS_YEAR") {
    // A previous-year question is a question with a source, not a separate
    // content universe (docs/01 §2) — which is why this is a clause here rather
    // than a flag on the question table.
    where.source = { sourceType: { in: ["CBSE_BOARD_PAPER", "CBSE_SAMPLE_PAPER"] } };
  }

  if (request.filters.unseenOnly) {
    where.attempts = { none: { userId: request.userId } };
  }

  const total = await prisma.question.count({ where });
  if (total === 0) return [];

  const window = Math.min(total, CANDIDATE_WINDOW);
  const skip = total > window ? randomInt(total - window + 1) : 0;

  // `marks` rides along because the final ordering needs it and fetching it
  // here is free — it is already on the row the index scan touches, and the
  // alternative is a second query over the ids that were just chosen.
  return prisma.question.findMany({
    where,
    select: { id: true, marks: true },
    orderBy: { id: "asc" },
    skip,
    take: window,
  });
}

/**
 * The two modes that draw from the student rather than from the bank.
 *
 * Returns `undefined` for every other mode, meaning "no personal restriction" —
 * distinct from `[]`, which means "this student has no mistakes / no bookmarks".
 *
 * Both map their question ids up to the top-level ancestor before use. A mistake
 * is recorded against the *graded unit*, which for a case study is a sub-part;
 * practising a sub-part on its own would present the question without its
 * stimulus. `parentId ?? id` is the whole fix, and it is the reason these two
 * modes cannot be expressed as a `where` clause on the main query.
 */
async function personalPool(request: SelectionRequest): Promise<string[] | undefined> {
  if (request.mode === "MISTAKE_REVIEW") {
    const rows = await prisma.mistakeRecord.findMany({
      where: { userId: request.userId, repairedAt: null },
      select: { question: { select: { id: true, parentId: true } } },
      orderBy: { lastMissedAt: "desc" },
      take: CANDIDATE_WINDOW,
    });

    return dedupe(rows.map((row) => row.question.parentId ?? row.question.id));
  }

  if (request.mode === "BOOKMARKS") {
    const rows = await prisma.bookmark.findMany({
      where: { userId: request.userId },
      select: { question: { select: { id: true, parentId: true } } },
      orderBy: { createdAt: "desc" },
      take: CANDIDATE_WINDOW,
    });

    return dedupe(rows.map((row) => row.question.parentId ?? row.question.id));
  }

  return undefined;
}

/**
 * Order a chosen set the way a paper is ordered: cheap questions first.
 *
 * Not a cosmetic choice. A student opening a set that starts with a five-mark
 * long answer closes it; the same set starting with two one-mark MCQs gets
 * finished. CBSE papers are built the same way for the same reason, and a
 * practice set that mirrors the paper is also rehearsal for it.
 *
 * Ties break on the id, so the order is stable rather than dependent on however
 * Postgres returned the window.
 */
function orderForPractice(candidates: Candidate[]): string[] {
  return [...candidates]
    .sort((left, right) => left.marks - right.marks || left.id.localeCompare(right.id))
    .map((candidate) => candidate.id);
}

interface Candidate {
  id: string;
  marks: number;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Fisher–Yates, with the platform's CSPRNG.
 *
 * `Math.random()` would do — nothing here is a secret — but `crypto` costs
 * nothing at this size and removes the question of whether it ought to have
 * been used, which is a question that has to be answered again every time
 * somebody reads this.
 */
function shuffle<T>(values: T[]): T[] {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index--) {
    const swap = randomInt(index + 1);
    const held = result[index];
    const other = result[swap];
    if (held === undefined || other === undefined) continue;
    result[index] = other;
    result[swap] = held;
  }

  return result;
}

/** Uniform in `[0, bound)`, rejecting the biased tail of the random range. */
function randomInt(bound: number): number {
  if (bound <= 1) return 0;

  const limit = Math.floor(0xff_ff_ff_ff / bound) * bound;
  const buffer = new Uint32Array(1);

  for (;;) {
    crypto.getRandomValues(buffer);
    const value = buffer[0] ?? 0;
    if (value < limit) return value % bound;
  }
}
