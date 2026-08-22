import type {
  BookmarkState,
  BookmarkWithQuestion,
  CreateBookmarkInput,
  CursorPaginationQuery,
  Paginated,
} from "@samjho/contracts";

import { NotFoundError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { studentQuestionSelect } from "../questions/question.repository.js";
import { toStudentQuestion } from "../questions/question.service.js";
import { STUDENT_VISIBLE_QUESTION } from "../questions/question.visibility.js";
import { countBookmark } from "./practice.rollups.js";

/**
 * Saved questions.
 *
 * Small, and worth reading for one decision: **saving is an upsert and removing
 * is a delete-by-question, neither of which addresses the bookmark by its own
 * id.** A student's client knows which *question* it is looking at; making it
 * track a bookmark id as well would mean a save followed by a remove needs the
 * round trip in between to have completed. It does not, on a train.
 *
 * The bookmark's own id still exists and is still returned — the list view needs
 * a stable key — but nothing requires it as input.
 */
export const bookmarkService = {
  /**
   * Save a question, or update the note on one already saved.
   *
   * The subject rollup only moves on a genuine create. An upsert that re-saved
   * an existing bookmark would otherwise add one to `questionsBookmarked` every
   * time a student edited their note.
   */
  async save(userId: string, input: CreateBookmarkInput): Promise<BookmarkState> {
    const question = await prisma.question.findFirst({
      where: { id: input.questionId, ...STUDENT_VISIBLE_QUESTION },
      select: { id: true, subjectId: true },
    });

    if (!question) throw new NotFoundError("Question");

    const existing = await prisma.bookmark.findUnique({
      where: { userId_questionId: { userId, questionId: question.id } },
      select: { id: true },
    });

    await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.bookmark.update({ where: { id: existing.id }, data: { note: input.note } });
        return;
      }

      await tx.bookmark.create({
        data: { userId, questionId: question.id, note: input.note },
      });

      await countBookmark(tx, userId, question.subjectId, 1);
    });

    return { questionId: question.id, bookmarked: true, note: input.note };
  },

  /**
   * Remove a saved question.
   *
   * Removing one that is not saved succeeds rather than 404s. The client's
   * belief that it was saved is the only thing that could be wrong here, and the
   * end state it asked for — not saved — is the end state either way.
   */
  async remove(userId: string, questionId: string): Promise<BookmarkState> {
    const existing = await prisma.bookmark.findUnique({
      where: { userId_questionId: { userId, questionId } },
      select: { id: true, question: { select: { subjectId: true } } },
    });

    if (existing) {
      await prisma.$transaction(async (tx) => {
        await tx.bookmark.delete({ where: { id: existing.id } });
        await countBookmark(tx, userId, existing.question.subjectId, -1);
      });
    }

    return { questionId, bookmarked: false, note: null };
  },

  /**
   * The student's saved questions, newest first.
   *
   * Questions that have since been withdrawn drop out of the list rather than
   * rendering as a gap: the visibility predicate is on the join, so an editor
   * pulling a question also pulls it from everyone's saved list. The bookmark
   * row survives, so republishing brings it back.
   */
  async list(
    userId: string,
    query: CursorPaginationQuery,
  ): Promise<Paginated<BookmarkWithQuestion>> {
    const rows = await prisma.bookmark.findMany({
      where: { userId, question: STUDENT_VISIBLE_QUESTION },
      select: {
        id: true,
        questionId: true,
        note: true,
        createdAt: true,
        question: { select: studentQuestionSelect },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    const items = page.map((row) => ({
      id: row.id,
      questionId: row.questionId,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
      question: toStudentQuestion(row.question),
    }));

    return {
      items,
      pageInfo: { hasMore, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null },
    };
  },

  /**
   * Which of these questions the student has saved.
   *
   * One query for a page of questions rather than one per question — the
   * bookmark button appears beside every item in a practice set, and the N+1 is
   * the whole reason this exists as a batch call.
   */
  async statesFor(userId: string, questionIds: string[]): Promise<string[]> {
    if (questionIds.length === 0) return [];

    const rows = await prisma.bookmark.findMany({
      where: { userId, questionId: { in: questionIds } },
      select: { questionId: true },
    });

    return rows.map((row) => row.questionId);
  },
};
