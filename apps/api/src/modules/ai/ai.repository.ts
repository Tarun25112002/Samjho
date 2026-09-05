import type { AIAction, AIContext, AIRole } from "@samjho/contracts";

import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { STUDENT_VISIBLE_QUESTION } from "../questions/question.visibility.js";

/**
 * Every database read and write the tutor makes.
 *
 * Two of these carry more weight than their size suggests, and both are here
 * rather than in the service so that the query itself is the control:
 *
 *  - `loadGrounding` is the only way question content reaches a prompt. The
 *    client never supplies it (docs/05 §2), so if this returns nothing, the
 *    tutor has nothing to say — which is the correct failure.
 *  - `hasLiveExamAttempt` is the exam guard. AI is hard-disabled during an
 *    in-progress attempt, enforced server-side rather than by hiding a button.
 */

/** The grounding for one question, straight from the bank. */
export const groundingSelect = {
  id: true,
  body: true,
  type: true,
  marks: true,
  difficulty: true,
  subject: { select: { name: true, classLevel: true } },
  chapter: { select: { name: true } },
  options: {
    select: { label: true, body: true, isCorrect: true },
    orderBy: { orderIndex: "asc" },
  },
  answer: {
    select: {
      correctValue: true,
      acceptedValues: true,
      unit: true,
      solution: true,
      markingScheme: true,
      explanation: true,
    },
  },
  topics: {
    select: { isPrimary: true, topic: { select: { id: true, name: true } } },
  },
  // A case-study sub-part is unintelligible without the stimulus its parent
  // holds. Fetching it here rather than in a second query keeps the grounded
  // path a single round trip.
  parent: { select: { body: true } },
} satisfies Prisma.QuestionSelect;

export type GroundingRow = Prisma.QuestionGetPayload<{ select: typeof groundingSelect }>;

export const aiRepository = {
  /**
   * A conversation, but only if it belongs to this user.
   *
   * Scoped by `userId` in the `where` rather than fetched and then checked.
   * The two are equivalent until someone edits the handler and drops the check,
   * at which point one of them still returns nothing and the other returns
   * another student's conversation.
   */
  async findConversation(userId: string, conversationId: string) {
    return prisma.aIConversation.findFirst({
      where: { id: conversationId, userId },
      select: {
        id: true,
        userId: true,
        questionId: true,
        questionAttemptId: true,
        chapterId: true,
        context: true,
        title: true,
        messageCount: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async listConversations(userId: string, limit: number, cursor?: string) {
    return prisma.aIConversation.findMany({
      where: { userId, status: "ACTIVE" },
      select: {
        id: true,
        context: true,
        questionId: true,
        title: true,
        messageCount: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  },

  async createConversation(input: {
    userId: string;
    context: AIContext;
    title: string;
    questionId?: string | undefined;
    questionAttemptId?: string | undefined;
    chapterId?: string | undefined;
  }) {
    return prisma.aIConversation.create({
      data: {
        userId: input.userId,
        context: input.context,
        title: input.title,
        ...(input.questionId ? { questionId: input.questionId } : {}),
        ...(input.questionAttemptId ? { questionAttemptId: input.questionAttemptId } : {}),
        ...(input.chapterId ? { chapterId: input.chapterId } : {}),
      },
      select: {
        id: true,
        context: true,
        questionId: true,
        questionAttemptId: true,
        chapterId: true,
        title: true,
        messageCount: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  /**
   * The turns so far, oldest first.
   *
   * Capped at a message count before the token budget is even considered, so a
   * pathological conversation cannot make this query itself expensive. The
   * budget then trims further — see `trimHistory` in ai.context.ts.
   */
  async loadHistory(conversationId: string, take = 40) {
    const rows = await prisma.aIMessage.findMany({
      where: { conversationId },
      select: { id: true, role: true, action: true, content: true, model: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take,
    });

    return rows.reverse();
  },

  /**
   * Persist one exchange.
   *
   * The user turn, the assistant turn and the conversation's counters go in one
   * transaction because a half-written exchange is worse than no exchange: a
   * user message with no reply reappears in the next request's history as an
   * unanswered question, and the model dutifully answers it a second time.
   */
  async appendExchange(input: {
    conversationId: string;
    userContent: string;
    action: AIAction;
    assistantContent: string;
    model: string | null;
    promptTokens: number | null;
    completionTokens: number | null;
    providerRequestId: string | null;
    latencyMs: number;
  }) {
    return prisma.$transaction(async (tx) => {
      await tx.aIMessage.create({
        data: {
          conversationId: input.conversationId,
          role: "USER" satisfies AIRole,
          action: input.action,
          content: input.userContent,
        },
      });

      const assistant = await tx.aIMessage.create({
        data: {
          conversationId: input.conversationId,
          role: "ASSISTANT" satisfies AIRole,
          action: input.action,
          content: input.assistantContent,
          ...(input.model ? { model: input.model } : {}),
          ...(input.promptTokens === null ? {} : { promptTokens: input.promptTokens }),
          ...(input.completionTokens === null ? {} : { completionTokens: input.completionTokens }),
          ...(input.providerRequestId ? { providerRequestId: input.providerRequestId } : {}),
          latencyMs: input.latencyMs,
        },
        select: {
          id: true,
          role: true,
          action: true,
          content: true,
          model: true,
          createdAt: true,
        },
      });

      await tx.aIConversation.update({
        where: { id: input.conversationId },
        data: { messageCount: { increment: 2 } },
      });

      return assistant;
    });
  },

  /**
   * Retire a conversation without deleting it.
   *
   * Archived rather than dropped because the messages are the evaluation set
   * (docs/05 §7) — "was the tutor any good last month" is only answerable if
   * last month's answers still exist. The student stops seeing it in their
   * list; nothing is destroyed.
   */
  async archiveConversation(conversationId: string) {
    return prisma.aIConversation.update({
      where: { id: conversationId },
      data: { status: "ARCHIVED" },
      select: {
        id: true,
        context: true,
        questionId: true,
        title: true,
        messageCount: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  /** Grounding for a question a student is actually allowed to see. */
  async loadGrounding(questionId: string): Promise<GroundingRow | null> {
    return prisma.question.findFirst({
      where: { id: questionId, ...STUDENT_VISIBLE_QUESTION },
      select: groundingSelect,
    });
  },

  /** The student's own attempt, which is what WHY_WRONG diagnoses. */
  async loadAttempt(userId: string, questionId: string, attemptId?: string) {
    return prisma.questionAttempt.findFirst({
      where: {
        userId,
        questionId,
        ...(attemptId ? { id: attemptId } : {}),
      },
      select: {
        id: true,
        answerJson: true,
        isCorrect: true,
        marksAwarded: true,
        marksPossible: true,
        mistakeReason: true,
        evaluationMode: true,
        attemptedAt: true,
      },
      orderBy: { attemptedAt: "desc" },
    });
  },

  /**
   * Is this question part of an exam the student is sitting right now?
   *
   * The guard from docs/05 §3. `deadlineAt` is checked as well as the status
   * because the sweeper that closes expired attempts runs on a timer — between
   * a deadline passing and the sweep landing, an attempt is `IN_PROGRESS` and
   * over, and refusing help then would be wrong.
   *
   * Note this asks whether the *question* appears in a live paper, not whether
   * the conversation was started from one. A student who opened a practice
   * conversation on Q17 yesterday must not be able to reopen it mid-exam today.
   */
  async hasLiveExamAttempt(userId: string, questionId: string): Promise<boolean> {
    const attempt = await prisma.examAttempt.findFirst({
      where: {
        userId,
        status: "IN_PROGRESS",
        deadlineAt: { gt: new Date() },
        examPaper: {
          sections: {
            some: { slots: { some: { items: { some: { questionId } } } } },
          },
        },
      },
      select: { id: true },
    });

    return attempt !== null;
  },

  /**
   * A question from the bank to answer SIMILAR with.
   *
   * Searched before any model is asked, deliberately, and not only to save a
   * call: a real question has been through editorial review and carries a
   * verified answer, while a generated one is unverified by construction. The
   * better artefact and the cheaper one are the same artefact.
   *
   * Matched on primary topic, then type, then marks — the three things that
   * make a question feel like "another one of these" to a student revising.
   */
  async findSimilarQuestion(input: {
    excludeQuestionId: string;
    topicIds: string[];
    type: GroundingRow["type"];
    marks: number;
  }): Promise<GroundingRow | null> {
    if (input.topicIds.length === 0) return null;

    return prisma.question.findFirst({
      where: {
        ...STUDENT_VISIBLE_QUESTION,
        id: { not: input.excludeQuestionId },
        parentId: null,
        type: input.type,
        marks: input.marks,
        topics: { some: { topicId: { in: input.topicIds }, isPrimary: true } },
        // No point offering one whose solution we cannot show afterwards.
        answer: { isNot: null },
      },
      select: groundingSelect,
      // Not `orderBy: random()` — Postgres would sort the whole candidate set.
      // Cheap and good enough: the newest matching question the student has not
      // been handed by this route before is a fine "another one of these".
      orderBy: { publishedAt: "desc" },
    });
  },

  /** The chapter behind a CHAPTER conversation, with its topics for context. */
  async loadChapter(chapterId: string) {
    return prisma.chapter.findFirst({
      where: { id: chapterId, isActive: true, subject: { isActive: true } },
      select: {
        id: true,
        name: true,
        subject: { select: { name: true, classLevel: true } },
        topics: {
          where: { isActive: true },
          select: { name: true },
          orderBy: { orderIndex: "asc" },
        },
      },
    });
  },
};
