import type {
  AssessmentObjective,
  Difficulty,
  ListPracticeSessionsQuery,
  PracticeFilters,
  PracticeMode,
  QuestionSelection,
  QuestionType,
  SessionStatus,
} from "@medhavi/contracts";

import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import {
  studentQuestionSelect,
  type StudentQuestionRow,
} from "../questions/question.repository.js";
import { SESSION_VISIBLE_QUESTION } from "../questions/question.visibility.js";

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
  timeLimitSeconds: true,
  deadlineAt: true,
  objective: true,
  plannedQuestions: true,
  selectionsJson: true,
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
  hintUsed: true,
} satisfies Prisma.QuestionAttemptSelect;

export type AttemptRow = Prisma.QuestionAttemptGetPayload<{ select: typeof attemptSelect }>;

export interface CreateSessionData {
  userId: string;
  mode: PracticeMode;
  filters: PracticeFilters;
  questionIds: string[];
  /** Summed over graded units, so a case study contributes its sub-parts. */
  marksPossible: number;
  /** Both or neither — the service computes the deadline from the limit. */
  timeLimitSeconds?: number;
  deadlineAt?: Date;
  objective?: AssessmentObjective;
  plannedQuestions?: number;
  selections?: Record<string, QuestionSelection>;
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
        ...(data.timeLimitSeconds === undefined ? {} : { timeLimitSeconds: data.timeLimitSeconds }),
        ...(data.deadlineAt === undefined ? {} : { deadlineAt: data.deadlineAt }),
        ...(data.objective === undefined ? {} : { objective: data.objective }),
        ...(data.plannedQuestions === undefined ? {} : { plannedQuestions: data.plannedQuestions }),
        ...(data.selections === undefined
          ? {}
          : { selectionsJson: data.selections as unknown as Prisma.InputJsonValue }),
      },
      select: sessionSelect,
    });
  },

  appendQuestion(data: {
    sessionId: string;
    questionIds: string[];
    marksPossible: number;
    selections: Record<string, QuestionSelection>;
  }): Promise<SessionRow> {
    return prisma.practiceSession.update({
      where: { id: data.sessionId },
      data: {
        questionIds: data.questionIds,
        totalQuestions: data.questionIds.length,
        marksPossible: data.marksPossible,
        selectionsJson: data.selections as unknown as Prisma.InputJsonValue,
      },
      select: sessionSelect,
    });
  },

  async findTopicMasteryStates(
    userId: string,
    subjectIds: string[],
  ): Promise<TopicMasteryStateRow[]> {
    const topics = await prisma.topic.findMany({
      where: {
        isActive: true,
        chapter: {
          isActive: true,
          ...(subjectIds.length > 0 ? { subjectId: { in: subjectIds } } : {}),
          subject: { isActive: true },
        },
      },
      select: {
        id: true,
        name: true,
        chapter: { select: { subjectId: true } },
        mastery: {
          where: { userId },
          select: { masteryScore: true, attempted: true, unrepairedMistakes: true },
        },
      },
      orderBy: { id: "asc" },
    });

    return topics.map((topic) => {
      const mastery = topic.mastery[0];
      return {
        topicId: topic.id,
        topicName: topic.name,
        subjectId: topic.chapter.subjectId,
        masteryScore: mastery?.masteryScore ?? 0,
        attempted: mastery?.attempted ?? 0,
        unrepairedMistakes: mastery?.unrepairedMistakes ?? 0,
      };
    });
  },

  findEnrolledSubjectIds(userId: string): Promise<{ subjectId: string }[]> {
    return prisma.subjectEnrolment.findMany({
      where: { isActive: true, profile: { userId }, subject: { isActive: true } },
      select: { subjectId: true },
      orderBy: { subjectId: "asc" },
    });
  },

  findHint(questionId: string): Promise<HintRow | null> {
    return prisma.question.findFirst({
      where: { id: questionId },
      select: {
        id: true,
        type: true,
        difficulty: true,
        answer: { select: { hint: true } },
        topics: {
          where: { isPrimary: true },
          select: { topic: { select: { name: true } } },
          take: 1,
        },
      },
    });
  },

  markHintUsed(sessionId: string, questionId: string): Promise<unknown> {
    return prisma.questionAttempt.updateMany({
      where: { practiceSessionId: sessionId, questionId },
      data: { hintUsed: true },
    });
  },

  /**
   * The sitting this one should be measured against.
   *
   * Matched on objective when there is one and on mode otherwise, so a
   * diagnostic is compared with the same diagnostic rather than with whatever
   * the student happened to do last. Returns null when this is the first of its
   * kind, which the result page reports as such instead of against zero.
   */
  findPreviousComparable(data: {
    userId: string;
    sessionId: string;
    mode: PracticeMode;
    objective: AssessmentObjective | null;
    startedAt: Date;
  }): Promise<PreviousSittingRow | null> {
    return prisma.practiceSession.findFirst({
      where: {
        userId: data.userId,
        id: { not: data.sessionId },
        status: "COMPLETED",
        startedAt: { lt: data.startedAt },
        marksPossible: { gt: 0 },
        ...(data.objective === null
          ? { mode: data.mode, objective: null }
          : { objective: data.objective }),
      },
      select: { id: true, marksEarned: true, marksPossible: true, completedAt: true },
      orderBy: { startedAt: "desc" },
    });
  },

  /**
   * How the student did on these topics before this session started.
   *
   * Scoped by `attemptedAt`, not by session id, because "before" means before in
   * time — attempts from any earlier set count, which is what makes the
   * comparison a statement about the student rather than about two sittings.
   */
  async findTopicHistoryBefore(data: {
    userId: string;
    topicIds: string[];
    before: Date;
  }): Promise<Map<string, { earned: number; possible: number }>> {
    if (data.topicIds.length === 0) return new Map();

    const rows = await prisma.questionAttempt.findMany({
      where: {
        userId: data.userId,
        evaluationMode: { not: "PENDING" },
        attemptedAt: { lt: data.before },
        question: { topics: { some: { isPrimary: true, topicId: { in: data.topicIds } } } },
      },
      select: {
        marksAwarded: true,
        marksPossible: true,
        question: {
          select: { topics: { where: { isPrimary: true }, select: { topicId: true }, take: 1 } },
        },
      },
    });

    const totals = new Map<string, { earned: number; possible: number }>();

    for (const row of rows) {
      const topicId = row.question.topics[0]?.topicId;
      if (topicId === undefined) continue;

      const entry = totals.get(topicId) ?? { earned: 0, possible: 0 };
      entry.earned += row.marksAwarded;
      entry.possible += row.marksPossible;
      totals.set(topicId, entry);
    }

    return totals;
  },

  findDiagnosticSessions(userId: string): Promise<DiagnosticSessionRow[]> {
    return prisma.practiceSession.findMany({
      where: { userId, objective: { not: null } },
      select: {
        id: true,
        objective: true,
        status: true,
        completedAt: true,
        startedAt: true,
        marksEarned: true,
        marksPossible: true,
      },
      orderBy: { startedAt: "asc" },
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

  /**
   * The student view of a session's questions — no answer keys, by construction.
   *
   * `SESSION_VISIBLE_QUESTION` rather than `STUDENT_VISIBLE_QUESTION`: these ids
   * are already in a set built for this student, and one of the pools a set can
   * be built from is a teacher's own bank, whose questions are by definition not
   * ownerless. Filtering them out here is what used to empty a teacher-bank
   * assignment on the way to the screen. See the predicate's own comment.
   */
  async findSessionQuestions(questionIds: string[]): Promise<StudentQuestionRow[]> {
    if (questionIds.length === 0) return [];

    return prisma.question.findMany({
      where: { id: { in: questionIds }, ...SESSION_VISIBLE_QUESTION },
      select: studentQuestionSelect,
    });
  },

  /**
   * One question with everything needed to grade it.
   *
   * Same predicate as `findSessionQuestions`, and it has to be: a question the
   * runner was allowed to render must be a question the grader is allowed to
   * mark, or a student answers something that then cannot be scored. The caller
   * has already checked the id is in the session (`practice.service.ts`), which
   * is the ownership half of the check.
   */
  findForGrading(questionId: string): Promise<GradingRow | null> {
    return prisma.question.findFirst({
      where: { id: questionId, ...SESSION_VISIBLE_QUESTION },
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

export interface TopicMasteryStateRow {
  topicId: string;
  topicName: string;
  subjectId: string;
  masteryScore: number;
  attempted: number;
  unrepairedMistakes: number;
}

export interface HintRow {
  id: string;
  type: QuestionType;
  difficulty: Difficulty;
  answer: { hint: string | null } | null;
  topics: { topic: { name: string } }[];
}

export interface DiagnosticSessionRow {
  id: string;
  objective: AssessmentObjective | null;
  status: SessionStatus;
  completedAt: Date | null;
  startedAt: Date;
  marksEarned: number;
  marksPossible: number;
}

export interface PreviousSittingRow {
  id: string;
  marksEarned: number;
  marksPossible: number;
  completedAt: Date | null;
}
