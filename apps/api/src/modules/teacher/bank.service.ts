import type {
  TeacherBankFacets,
  TeacherBankQuery,
  TeacherBankQuestion,
  TeacherBankResponse,
  TeacherQuestionStatusInput,
} from "@samjho/contracts";

import type { Prisma } from "../../generated/prisma/client.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

/**
 * The teacher's own question bank: browsing, filtering, and publishing.
 *
 * ## The filter is the feature
 *
 * "Separate the questions by difficulty, chapter and subject" is the ask, and
 * the shape of the answer matters. Pre-built buckets — a Hard tab, a Chapter 4
 * tab — look tidier in a mock-up and break the first time a teacher wants "hard
 * numericals from Electricity worth three marks", which is the actual question
 * somebody building a worksheet has. So it is one filtered query with counts
 * beside every option.
 *
 * ## Why the facet counts exclude their own filter
 *
 * A facet counted with its own filter applied always reads "Hard (12), Easy (0),
 * Medium (0)" the moment Hard is selected, and the teacher can no longer see
 * what switching would give them — which is the entire reason to show counts.
 * So each facet is counted against every *other* active filter but not its own.
 * That costs four extra count queries per page, which is the right trade against
 * a filter panel nobody can navigate.
 *
 * ## Scoping
 *
 * Every query starts from `ownerTeacherId: <this teacher>`. Not "and then check
 * the owner" — the owner is in the `where`, so there is no version of these
 * queries that could return somebody else's bank.
 */

export const bankService = {
  async list(teacherId: string, query: TeacherBankQuery): Promise<TeacherBankResponse> {
    const where = toWhere(teacherId, query);

    const rows = await prisma.question.findMany({
      where,
      // Newest first: the bank a teacher is looking at is almost always the
      // paper they imported ten minutes ago.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        type: true,
        body: true,
        marks: true,
        difficulty: true,
        bloomLevel: true,
        status: true,
        createdAt: true,
        subject: { select: { id: true, name: true, code: true } },
        chapter: { select: { id: true, name: true } },
        topics: { select: { topic: { select: { name: true } } } },
        answer: { select: { id: true } },
        source: { select: { attributionText: true } },
        _count: { select: { subParts: true } },
      },
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: page.map(toBankQuestion),
      facets: await facetsFor(teacherId, query),
      pageInfo: { hasMore, nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null },
    };
  },

  /**
   * Publish, withdraw or archive a question this teacher owns.
   *
   * The status vocabulary is the shared one and the reach is not: a PUBLISHED
   * question with an owner is drawn for that teacher's assignments and for
   * nothing else. `STUDENT_VISIBLE_QUESTION` filters on the owner being null,
   * which is what stops this being a route into everyone's practice.
   */
  async setStatus(
    teacherId: string,
    questionId: string,
    input: TeacherQuestionStatusInput,
  ): Promise<{ status: TeacherQuestionStatusInput["status"] }> {
    const question = await prisma.question.findFirst({
      where: { id: questionId, ownerTeacherId: teacherId, parentId: null },
      select: {
        id: true,
        status: true,
        answer: { select: { solution: true } },
        _count: { select: { subParts: true } },
      },
    });
    if (!question) throw new NotFoundError("Question");

    if (input.status === "PUBLISHED") {
      // A container's answers live on its parts, so it is exempt — the same
      // rule `publicationBlockers` applies in the admin flow. Everything else
      // needs a solution, because a question a student cannot check their work
      // against is not practice, it is a quiz with no feedback.
      const isContainer = question._count.subParts > 0;
      if (!isContainer && !question.answer?.solution) {
        throw new ConflictError(
          "This question has no solution yet. Add one before setting it for a class.",
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.question.update({
        where: { id: questionId },
        data: {
          status: input.status,
          ...(input.status === "PUBLISHED" ? { publishedAt: new Date() } : {}),
        },
      });

      // Sub-parts follow their container, always. A published case study whose
      // parts stayed DRAFT would materialise into a session as a stimulus with
      // no questions under it.
      await tx.question.updateMany({
        where: { parentId: questionId },
        data: { status: input.status },
      });
    });

    return { status: input.status };
  },

  /** What the dashboard's bank tile shows without loading a page of questions. */
  async summary(teacherId: string): Promise<{
    total: number;
    published: number;
    draft: number;
    bySubject: { subjectId: string; subjectName: string; count: number }[];
  }> {
    const [total, published, draft, bySubject] = await Promise.all([
      prisma.question.count({ where: { ownerTeacherId: teacherId, parentId: null } }),
      prisma.question.count({
        where: { ownerTeacherId: teacherId, parentId: null, status: "PUBLISHED" },
      }),
      prisma.question.count({
        where: { ownerTeacherId: teacherId, parentId: null, status: "DRAFT" },
      }),
      prisma.question.groupBy({
        by: ["subjectId"],
        where: { ownerTeacherId: teacherId, parentId: null },
        _count: { _all: true },
      }),
    ]);

    const subjects = await prisma.subject.findMany({
      where: { id: { in: bySubject.map((row) => row.subjectId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(subjects.map((subject) => [subject.id, subject.name]));

    return {
      total,
      published,
      draft,
      bySubject: bySubject
        .map((row) => ({
          subjectId: row.subjectId,
          subjectName: nameById.get(row.subjectId) ?? "Unknown subject",
          count: row._count._all,
        }))
        .sort((left, right) => right.count - left.count),
    };
  },
};

/**
 * The `where` for one filter combination.
 *
 * `omit` drops one filter, which is what the facet counts need — see the note
 * at the top of the file about why a facet must not count itself.
 */
function toWhere(
  teacherId: string,
  query: TeacherBankQuery,
  omit?: "difficulty" | "type" | "chapterId" | "marks",
): Prisma.QuestionWhereInput {
  const where: Prisma.QuestionWhereInput = {
    ownerTeacherId: teacherId,
    // Sub-parts are never listed on their own: a case study is one question
    // worth four marks, not three questions, and every count a teacher sees
    // has to agree with what a paper would call it.
    parentId: null,
  };

  if (query.subjectId) where.subjectId = query.subjectId;
  if (query.chapterId && omit !== "chapterId") where.chapterId = query.chapterId;
  if (query.marks !== undefined && omit !== "marks") where.marks = query.marks;
  if (query.type?.length && omit !== "type") where.type = { in: query.type };
  if (query.difficulty?.length && omit !== "difficulty") {
    where.difficulty = { in: query.difficulty };
  }
  if (query.status?.length) where.status = { in: query.status };

  if (query.topicId) {
    // A case study's topics live on its sub-parts as often as on the container,
    // exactly as in student browsing. Matching only the parent would hide most
    // case studies from a topic filter.
    where.OR = [
      { topics: { some: { topicId: query.topicId } } },
      { subParts: { some: { topics: { some: { topicId: query.topicId } } } } },
    ];
  }

  // "Everything that came off this paper" — the filter a teacher uses straight
  // after an import. A relation traversal rather than a pre-fetched id list,
  // which is the whole reason `ExtractedQuestion.question` is a relation.
  if (query.uploadId) where.extractedFrom = { uploadId: query.uploadId };

  if (query.search) {
    // `contains` rather than full-text search. At one teacher's bank — hundreds
    // of rows, not millions — an index-free scan is imperceptible, and a
    // tsvector column would be a migration and a maintenance job to make a
    // 20ms query 18ms. Revisit when a teacher has 10,000 questions.
    where.body = { contains: query.search, mode: "insensitive" };
  }

  return where;
}

/**
 * The four facet counts, each blind to its own filter.
 *
 * Run in parallel: they are independent aggregates over the same indexed
 * predicate, and running them in sequence would make the filter panel the
 * slowest part of the page for no reason.
 */
async function facetsFor(teacherId: string, query: TeacherBankQuery): Promise<TeacherBankFacets> {
  const [total, byDifficulty, byType, byChapter, byMarks] = await Promise.all([
    prisma.question.count({ where: toWhere(teacherId, query) }),
    prisma.question.groupBy({
      by: ["difficulty"],
      where: toWhere(teacherId, query, "difficulty"),
      _count: { _all: true },
    }),
    prisma.question.groupBy({
      by: ["type"],
      where: toWhere(teacherId, query, "type"),
      _count: { _all: true },
    }),
    prisma.question.groupBy({
      by: ["chapterId"],
      where: toWhere(teacherId, query, "chapterId"),
      _count: { _all: true },
    }),
    prisma.question.groupBy({
      by: ["marks"],
      where: toWhere(teacherId, query, "marks"),
      _count: { _all: true },
    }),
  ]);

  const chapters = await prisma.chapter.findMany({
    where: { id: { in: byChapter.map((row) => row.chapterId) } },
    select: { id: true, name: true, orderIndex: true },
  });
  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));

  return {
    total,
    byDifficulty: byDifficulty
      .map((row) => ({ difficulty: row.difficulty, count: row._count._all }))
      // Fixed order, not count order: a filter row whose options reshuffle as
      // you use it is one you have to re-read every time.
      .sort(
        (left, right) => DIFFICULTY_ORDER[left.difficulty] - DIFFICULTY_ORDER[right.difficulty],
      ),
    byType: byType
      .map((row) => ({ type: row.type, count: row._count._all }))
      .sort((left, right) => right.count - left.count),
    byChapter: byChapter
      .map((row) => ({
        chapterId: row.chapterId,
        chapterName: chapterById.get(row.chapterId)?.name ?? "Unknown chapter",
        count: row._count._all,
      }))
      .sort(
        (left, right) =>
          (chapterById.get(left.chapterId)?.orderIndex ?? 0) -
          (chapterById.get(right.chapterId)?.orderIndex ?? 0),
      ),
    byMarks: byMarks
      .map((row) => ({ marks: row.marks, count: row._count._all }))
      .sort((left, right) => left.marks - right.marks),
  };
}

const DIFFICULTY_ORDER = { EASY: 0, MEDIUM: 1, HARD: 2 } as const;

type BankRow = {
  id: string;
  type: TeacherBankQuestion["type"];
  body: string;
  marks: number;
  difficulty: TeacherBankQuestion["difficulty"];
  bloomLevel: TeacherBankQuestion["bloomLevel"];
  status: TeacherBankQuestion["status"];
  createdAt: Date;
  subject: { id: string; name: string; code: string };
  chapter: { id: string; name: string };
  topics: { topic: { name: string } }[];
  answer: { id: string } | null;
  source: { attributionText: string | null } | null;
  _count: { subParts: number };
};

function toBankQuestion(row: BankRow): TeacherBankQuestion {
  return {
    id: row.id,
    type: row.type,
    body: row.body,
    marks: row.marks,
    difficulty: row.difficulty,
    bloomLevel: row.bloomLevel,
    status: row.status,
    subject: row.subject,
    chapter: row.chapter,
    topics: row.topics.map((link) => link.topic.name),
    // Whether an answer exists, not the answer itself. The list is a browsing
    // surface; shipping every marking scheme to render a table of stems would
    // be a large payload to display none of.
    hasAnswer: row.answer !== null,
    subPartCount: row._count.subParts,
    sourceTitle: row.source?.attributionText ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
