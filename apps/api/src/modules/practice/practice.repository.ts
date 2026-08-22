import type { ListPracticeSessionsQuery, PracticeFilters, PracticeMode } from "@samjho/contracts";

import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import {
  studentQuestionSelect,
  type StudentQuestionRow,
} from "../questions/question.repository.js";
import { STUDENT_VISIBLE_QUESTION } from "../questions/question.visibility.js";

/**
 * Practice data access.
 *
 * ## Two selects, and the difference between them is the whole security model
 *
 * `studentQuestionSelect` (Phase 3) cannot return an answer key — the columns are
 * not in it, so the row type has no `answer` and inventing one is a compile
 * error. `gradingSelect`, below, exists precisely to fetch what that one
 * refuses to: the correct option flags, the accepted values, the solution.
 *
 * They are two constants used by two methods, never one select with a flag. The
 * service then decides which to hand where, and the type system holds it to
 * that: an endpoint that returns `StudentQuestionRow` is structurally incapable
 * of leaking a key, and the only thing that ever carries a `GradingRow` to the
 * client is an attempt the student has already made.
 */

/**
 * Everything grading needs, plus everything a snapshot needs.
 *
 * The snapshot is the reason this fetches option bodies it does not strictly
 * need to compare against: `QuestionAttempt.questionSnapshot` records *what the
 * student saw*, so that correcting a published question next month does not
 * silently rewrite what happened today (docs/03 §2.3). A snapshot of option ids
 * without their text would be a record of a decision with the choices missing.
 */
export const gradingSelect = {
  id: true,
  type: true,
  body: true,
  marks: true,
  version: true,
  isContainer: true,
  parentId: true,
  subjectId: true,
  chapterId: true,

  options: {
    select: { id: true, label: true, body: true, isCorrect: true },
    orderBy: { orderIndex: "asc" },
  },

  answer: {
    select: {
      correctValue: true,
      acceptedValues: true,
      tolerance: true,
      unit: true,
      solution: true,
      explanation: true,
      markingScheme: true,
    },
  },

  topics: {
    select: { topicId: true, isPrimary: true },
    orderBy: { isPrimary: "desc" },
  },

  subParts: {
    select: {
      id: true,
      type: true,
      body: true,
      marks: true,
      version: true,
      subPartIndex: true,
      subjectId: true,
      chapterId: true,
      options: {
        select: { id: true, label: true, body: true, isCorrect: true },
        orderBy: { orderIndex: "asc" },
      },
      answer: {
        select: {
          correctValue: true,
          acceptedValues: true,
          tolerance: true,
          unit: true,
          solution: true,
          explanation: true,
          markingScheme: true,
        },
      },
      topics: {
        select: { topicId: true, isPrimary: true },
        orderBy: { isPrimary: "desc" },
      },
    },
    orderBy: { subPartIndex: "asc" },
  },
} satisfies Prisma.QuestionSelect;

export type GradingRow = Prisma.QuestionGetPayload<{ select: typeof gradingSelect }>;
export type GradingSubPartRow = GradingRow["subParts"][number];

const sessionSelect = {
  id: true,
  userId: true,
  mode: true,
  filtersJson: true,
  questionIds: true,
  currentIndex: true,
  status: true,
  startedAt: true,
  completedAt: true,
  totalQuestions: true,
  answered: true,
  correct: true,
  marksEarned: true,
  marksPossible: true,
  timeSpentMs: true,
} satisfies Prisma.PracticeSessionSelect;

export type SessionRow = Prisma.PracticeSessionGetPayload<{ select: typeof sessionSelect }>;

const attemptSelect = {
  id: true,
  questionId: true,
  answerJson: true,
  isCorrect: true,
  marksAwarded: true,
  marksPossible: true,
  evaluationMode: true,
  mistakeReason: true,
  timeSpentMs: true,
  attemptedAt: true,
} satisfies Prisma.QuestionAttemptSelect;

export type AttemptRow = Prisma.QuestionAttemptGetPayload<{ select: typeof attemptSelect }>;

export interface CreateSessionData {
  userId: string;
  mode: PracticeMode;
  filters: PracticeFilters;
  questionIds: string[];
  /** Summed over graded units, so a case study contributes its sub-parts. */
  marksPossible: number;
}

export const practiceRepository = {
  create(data: CreateSessionData): Promise<SessionRow> {
    return prisma.practiceSession.create({
      data: {
        userId: data.userId,
        mode: data.mode,
        // Stored as given so the set can be rebuilt later ("practise this
        // again"), including the fields that were left unset.
        filtersJson: data.filters as unknown as Prisma.InputJsonValue,
        questionIds: data.questionIds,
        totalQuestions: data.questionIds.length,
        marksPossible: data.marksPossible,
      },
      select: sessionSelect,
    });
  },

  /**
   * One session, by id, for its owner.
   *
   * `userId` is in the `WHERE` rather than compared after fetching. docs/02 §4
   * calls this out as the single most commonly missed check in apps like this,
   * and the reason for the phrasing is that the predicate cannot be silently
   * forgotten the way an `if` after the query can — nor can it be short-circuited
   * by an early return added later.
   */
  findById(id: string, userId: string): Promise<SessionRow | null> {
    return prisma.practiceSession.findFirst({ where: { id, userId }, select: sessionSelect });
  },

  async list(
    userId: string,
    query: ListPracticeSessionsQuery,
  ): Promise<{ rows: SessionRow[]; hasMore: boolean }> {
    const rows = await prisma.practiceSession.findMany({
      where: { userId, ...(query.status ? { status: query.status } : {}) },
      select: sessionSelect,
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > query.limit;
    return { rows: hasMore ? rows.slice(0, query.limit) : rows, hasMore };
  },

  /** The student view of a session's questions — no answer keys, by construction. */
  async findSessionQuestions(questionIds: string[]): Promise<StudentQuestionRow[]> {
    if (questionIds.length === 0) return [];

    return prisma.question.findMany({
      where: { id: { in: questionIds }, ...STUDENT_VISIBLE_QUESTION },
      select: studentQuestionSelect,
    });
  },

  /** One question with everything needed to grade it. Visibility still applies. */
  findForGrading(questionId: string): Promise<GradingRow | null> {
    return prisma.question.findFirst({
      where: { id: questionId, ...STUDENT_VISIBLE_QUESTION },
      select: gradingSelect,
    });
  },

  /**
   * The answer keys for units the student has already attempted.
   *
   * Takes ids that came from *attempt rows*, which is what makes this safe: the
   * only way to get an id into this call is to have answered that question.
   */
  async findKeys(questionIds: string[]): Promise<Map<string, GradingKeyRow>> {
    if (questionIds.length === 0) return new Map();

    const rows = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: {
        id: true,
        options: { select: { id: true, isCorrect: true } },
        answer: {
          select: {
            correctValue: true,
            acceptedValues: true,
            tolerance: true,
            unit: true,
            solution: true,
            explanation: true,
            markingScheme: true,
          },
        },
      },
    });

    return new Map(rows.map((row) => [row.id, row]));
  },

  findAttempts(sessionId: string): Promise<AttemptRow[]> {
    return prisma.questionAttempt.findMany({
      where: { practiceSessionId: sessionId },
      select: attemptSelect,
      orderBy: { attemptedAt: "asc" },
    });
  },

  /**
   * Which session item each attempted question belongs to.
   *
   * An attempt records the *graded unit*, which for a case study is a sub-part
   * and is therefore not one of the session's item ids. Session totals count
   * items, so they need this mapping — and deriving it from the database rather
   * than from the request means it stays right for an attempt written months
   * ago by a version of the runner that no longer exists.
   */
  async findItemOwners(questionIds: string[]): Promise<Map<string, string>> {
    if (questionIds.length === 0) return new Map();

    const rows = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, parentId: true },
    });

    return new Map(rows.map((row) => [row.id, row.parentId ?? row.id]));
  },

  /**
   * One attempt, for its owner, within the session it was made in.
   *
   * All three predicates are in the `WHERE`. `userId` alone would be enough for
   * ownership; `practiceSessionId` is there so that an attempt id from one
   * session cannot be scored through another session's URL, which would produce
   * a valid write with the totals recomputed on the wrong session.
   */
  findAttemptForUpdate(
    attemptId: string,
    sessionId: string,
    userId: string,
  ): Promise<AttemptRow | null> {
    return prisma.questionAttempt.findFirst({
      where: { id: attemptId, practiceSessionId: sessionId, userId },
      select: attemptSelect,
    });
  },

  /**
   * Where a graded unit's mastery belongs: its subject, and its primary topic.
   *
   * The parent's topics come along so a sub-part with none of its own can
   * inherit them rather than dropping out of mastery entirely.
   */
  async findAttribution(questionId: string): Promise<Attribution | null> {
    const row = await prisma.question.findUnique({
      where: { id: questionId },
      select: {
        subjectId: true,
        topics: { select: { topicId: true, isPrimary: true }, orderBy: { isPrimary: "desc" } },
        parent: {
          select: {
            topics: { select: { topicId: true, isPrimary: true }, orderBy: { isPrimary: "desc" } },
          },
        },
      },
    });

    if (!row) return null;

    const own = row.topics.find((topic) => topic.isPrimary) ?? row.topics[0];
    const inherited = row.parent?.topics.find((topic) => topic.isPrimary) ?? row.parent?.topics[0];

    return { subjectId: row.subjectId, topicId: own?.topicId ?? inherited?.topicId ?? null };
  },

  /** Primary topic per graded unit, with the chapter it sits in, for the result page. */
  async findPrimaryTopics(questionIds: string[]): Promise<Map<string, TopicRef>> {
    if (questionIds.length === 0) return new Map();

    const rows = await prisma.questionTopic.findMany({
      where: { questionId: { in: questionIds }, isPrimary: true },
      select: {
        questionId: true,
        topic: { select: { id: true, name: true, chapter: { select: { name: true } } } },
      },
    });

    return new Map(
      rows.map((row) => [
        row.questionId,
        { id: row.topic.id, name: row.topic.name, chapterName: row.topic.chapter.name },
      ]),
    );
  },

  updateCurrentIndex(id: string, currentIndex: number): Promise<unknown> {
    return prisma.practiceSession.update({ where: { id }, data: { currentIndex } });
  },

  /** Subjects touched by a session's attempts, for the completion rollup. */
  async findSessionSubjectIds(sessionId: string): Promise<string[]> {
    const rows = await prisma.questionAttempt.findMany({
      where: { practiceSessionId: sessionId },
      select: { question: { select: { subjectId: true } } },
      distinct: ["questionId"],
    });

    return [...new Set(rows.map((row) => row.question.subjectId))];
  },
};

export type GradingKeyRow = {
  id: string;
  options: { id: string; isCorrect: boolean }[];
  answer: GradingRow["answer"];
};

export interface Attribution {
  subjectId: string;
  topicId: string | null;
}

export interface TopicRef {
  id: string;
  name: string;
  chapterName: string;
}
