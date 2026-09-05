import {
  AI_ACTION_LABELS,
  ERROR_CODES,
  type AIAction,
  type AIContext,
  type AIConversation,
  type AIConversationDetail,
  type AIMessage,
  type AIQuota,
  type AIReply,
  type AIStreamEvent,
  type Paginated,
  type SendMessageInput,
  type StartConversationInput,
} from "@samjho/contracts";

import { AppError, ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { buildChapterContext, buildQuestionContext, trimHistory } from "./ai.context.js";
import { profileFor, type ActionProfile } from "./ai.models.js";
import { buildActionInstruction, buildSystemPrompt, fenceStudentMessage } from "./ai.prompt.js";
import { aiRepository, type GroundingRow } from "./ai.repository.js";
import { assertNotRateLimited, readQuota, recordUsage, type QuotaState } from "./ai.quota.js";
import { aiProvider } from "./provider/registry.js";
import type { ChatMessage } from "./provider/types.js";

/**
 * The tutor, orchestrated.
 *
 * The shape of this file is set by one commitment from docs/05 §5.6: **the
 * tutor does not return an error to a student who asked a reasonable question.**
 * Every provider down, the daily quota spent, no API key configured at all —
 * in each case there is a human-written solution already stored against the
 * question, and serving that clearly labelled is better than an error toast.
 *
 * So the failure paths here mostly do not throw. `prepare` computes a
 * `fallbackText` alongside everything else, and both `send` and `stream` fall
 * back to it rather than propagating. What *does* throw is the small set of
 * things where answering would be wrong rather than merely degraded: an exam in
 * progress, an action the conversation has not earned, someone else's
 * conversation.
 */

/** 503 with a code the client can branch on, distinct from a generic outage. */
class AIUnavailableError extends AppError {
  readonly statusCode = 503;
  readonly code = ERROR_CODES.AI_UNAVAILABLE;
}

/** Actions that make no sense without a question in front of the student. */
const CHAPTER_ACTIONS: readonly AIAction[] = ["EXPLAIN", "SIMPLER"];

interface ConversationRow {
  id: string;
  context: AIContext;
  questionId: string | null;
  title: string;
  messageCount: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

function toConversation(row: ConversationRow): AIConversation {
  return {
    id: row.id,
    context: row.context,
    questionId: row.questionId,
    title: row.title,
    messageCount: row.messageCount,
    status: row.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

interface MessageRow {
  id: string;
  role: string;
  action: string | null;
  content: string;
  model: string | null;
  createdAt: Date;
}

function toMessage(row: MessageRow): AIMessage {
  return {
    id: row.id,
    role: row.role as AIMessage["role"],
    action: row.action as AIAction | null,
    content: row.content,
    model: row.model,
    createdAt: row.createdAt.toISOString(),
  };
}

function publicQuota(state: QuotaState): AIQuota {
  return {
    messagesUsed: state.messagesUsed,
    messagesLimit: state.messagesLimit,
    messagesRemaining: state.messagesRemaining,
    resetsAt: state.resetsAt,
  };
}

/** A conversation title, from whatever anchors it. Truncated for a list row. */
function titleFrom(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= 70 ? flat : `${flat.slice(0, 69)}…`;
}

/**
 * The stored solution, dressed as a tutor reply.
 *
 * `explanation` is preferred over `solution` where both exist: the explanation
 * field is prose written to be read by a student who is stuck, while the
 * solution is a worked answer written to be checked against. When the student
 * asked for STEP_BY_STEP, though, the worked answer is exactly what they wanted,
 * so that one inverts the preference.
 */
function fallbackFrom(question: GroundingRow, action: AIAction): string | null {
  const answer = question.answer;
  if (!answer) return null;

  const body =
    action === "STEP_BY_STEP" ? answer.solution : (answer.explanation ?? answer.solution);

  if (!body) return null;

  return [
    "*The AI tutor is unavailable right now, so here is the official solution from our question bank.*",
    "",
    body,
  ].join("\n");
}

/** A bank question, rendered as a SIMILAR reply. */
function renderSimilar(question: GroundingRow): string {
  const lines = [
    "*From our question bank — a past-paper-style question on the same topic.*",
    "",
    question.body,
  ];

  if (question.options.length > 0) {
    lines.push("");
    for (const option of question.options) lines.push(`${option.label}. ${option.body}`);
  }

  const answer = question.answer;
  if (answer) {
    lines.push("", "Answer:", answer.correctValue ?? answer.solution);
  }

  return lines.join("\n");
}

/**
 * Which actions this conversation may currently use.
 *
 * `WHY_WRONG` is the one with teeth. It is offered only when there is an
 * attempt on record that was marked wrong, because the action's whole prompt is
 * "diagnose this student's specific mistake" — with no mistake to diagnose the
 * model invents one, and telling a student who got it right what they got wrong
 * is worse than not offering the button.
 *
 * `SIMPLER` needs something to simplify, so it appears only after the tutor has
 * said something.
 */
function availableActions(input: {
  context: AIContext;
  hasWrongAttempt: boolean;
  hasAssistantTurn: boolean;
}): AIAction[] {
  const base =
    input.context === "CHAPTER"
      ? [...CHAPTER_ACTIONS]
      : (["HINT", "EXPLAIN", "WHY_WRONG", "STEP_BY_STEP", "SIMPLER", "SIMILAR"] as AIAction[]);

  return base.filter((action) => {
    if (action === "WHY_WRONG") return input.hasWrongAttempt;
    if (action === "SIMPLER") return input.hasAssistantTurn;
    return true;
  });
}

/** Everything one turn needs, resolved before any model is contacted. */
interface PreparedTurn {
  conversationId: string;
  action: AIAction;
  profile: ActionProfile;
  system: string;
  messages: ChatMessage[];
  /** What goes in the transcript as the student's turn. */
  userContent: string;
  /** The stored solution, when there is one to degrade to. */
  fallbackText: string | null;
  /** A complete reply that needs no model at all. */
  shortCircuit: string | null;
  quota: QuotaState;
}

async function prepare(
  userId: string,
  conversationId: string,
  input: SendMessageInput,
): Promise<PreparedTurn> {
  const conversation = await aiRepository.findConversation(userId, conversationId);
  if (!conversation) throw new NotFoundError("Conversation");

  if (conversation.status !== "ACTIVE") {
    throw new ValidationError("This conversation is archived and cannot be continued");
  }

  // Cheap, in-memory, and first: a client stuck in a retry loop should be told
  // to stop before it costs a round trip to Postgres, let alone to a model.
  assertNotRateLimited(userId);

  const history = await aiRepository.loadHistory(conversation.id);
  const hasAssistantTurn = history.some((row) => row.role === "ASSISTANT");

  const profile = profileFor(input.action);
  const userContent = input.text ?? AI_ACTION_LABELS[input.action];

  // Assigned in every branch below; the final `else` throws rather than
  // falling through, so there is no default to invent here.
  let contextBlock: string;
  let classLevel: number;
  let subjectName: string;
  let fallbackText: string | null = null;
  let shortCircuit: string | null = null;
  let hasWrongAttempt = false;

  if (conversation.questionId) {
    // The exam guard (docs/05 §3). Asked of the *question*, not the
    // conversation, so a practice conversation opened yesterday cannot be
    // reopened as an oracle during today's paper.
    if (await aiRepository.hasLiveExamAttempt(userId, conversation.questionId)) {
      throw new ForbiddenError("The AI tutor is unavailable while an exam is in progress");
    }

    const question = await aiRepository.loadGrounding(conversation.questionId);
    if (!question) throw new NotFoundError("Question");

    const attempt = await aiRepository.loadAttempt(
      userId,
      conversation.questionId,
      conversation.questionAttemptId ?? undefined,
    );

    hasWrongAttempt = attempt?.isCorrect === false;
    classLevel = question.subject.classLevel;
    subjectName = question.subject.name;
    contextBlock = buildQuestionContext({ action: input.action, question, attempt });
    fallbackText = fallbackFrom(question, input.action);

    // SIMILAR looks in the bank before it looks at a model. Not only to save
    // the call: a bank question has been through editorial review and carries a
    // verified answer, where a generated one is unverified by construction.
    if (input.action === "SIMILAR") {
      const similar = await aiRepository.findSimilarQuestion({
        excludeQuestionId: question.id,
        topicIds: question.topics.filter((link) => link.isPrimary).map((link) => link.topic.id),
        type: question.type,
        marks: question.marks,
      });

      if (similar) shortCircuit = renderSimilar(similar);
    }
  } else if (conversation.chapterId) {
    // A CHAPTER conversation. Re-read live rather than snapshotted at creation,
    // for the same reason the question path is: the catalogue is the source of
    // truth, and a conversation still open after a curriculum edit should
    // reflect the edit rather than a copy of what the chapter used to be.
    const chapter = await aiRepository.loadChapter(conversation.chapterId);
    if (!chapter) throw new NotFoundError("Chapter");

    classLevel = chapter.subject.classLevel;
    subjectName = chapter.subject.name;
    contextBlock = buildChapterContext(chapter);
  } else {
    // Neither anchor. Only reachable if a question was deleted out from under a
    // conversation (`onDelete: SetNull`), which is exactly when the tutor must
    // stop rather than answer from the transcript alone.
    throw new NotFoundError("Conversation grounding");
  }

  const allowed = availableActions({
    context: conversation.context,
    hasWrongAttempt,
    hasAssistantTurn,
  });

  if (!allowed.includes(input.action)) {
    // Enforced here rather than only being greyed out client-side, because the
    // reason WHY_WRONG is gated is that its prompt is unsound without a wrong
    // attempt — a rule about the model, not about the button.
    throw new ValidationError(
      `${AI_ACTION_LABELS[input.action]} is not available in this conversation right now`,
    );
  }

  // The context block rides in the system prompt rather than the last user
  // message, so that history trimming can never push the answer key out of the
  // request and leave the model guessing.
  const system = [
    buildSystemPrompt({ classLevel, subjectName }),
    contextBlock,
    buildActionInstruction(input.action),
  ].join("\n\n");

  const messages = trimHistory(history);
  messages.push({
    role: "user",
    content: input.text
      ? `${buildActionInstruction(input.action)}\n\n${fenceStudentMessage(input.text)}`
      : buildActionInstruction(input.action),
  });

  return {
    conversationId: conversation.id,
    action: input.action,
    profile,
    system,
    messages,
    userContent,
    fallbackText,
    shortCircuit,
    quota: await readQuota(userId),
  };
}

/** Persist an exchange that cost nothing, and report it as such. */
async function persistFree(
  turn: PreparedTurn,
  assistantContent: string,
  degraded: boolean,
  quota: QuotaState,
): Promise<AIReply> {
  const row = await aiRepository.appendExchange({
    conversationId: turn.conversationId,
    userContent: turn.userContent,
    action: turn.action,
    assistantContent,
    model: null,
    promptTokens: null,
    completionTokens: null,
    providerRequestId: null,
    latencyMs: 0,
  });

  return {
    conversationId: turn.conversationId,
    message: toMessage(row),
    degraded,
    quota: publicQuota(quota),
  };
}

/**
 * Can this turn reach a model at all?
 *
 * Returns the reply to serve instead when it cannot, so that both the buffered
 * and the streaming path make this decision once and identically.
 */
function blockedReason(turn: PreparedTurn): "quota" | "unconfigured" | null {
  if (turn.quota.exhausted) return "quota";
  if (!aiProvider().isAvailable) return "unconfigured";
  return null;
}

export const aiService = {
  async start(userId: string, input: StartConversationInput): Promise<AIConversationDetail> {
    if (input.context === "CHAPTER") {
      const chapter = await aiRepository.loadChapter(input.chapterId ?? "");
      if (!chapter) throw new NotFoundError("Chapter");

      const conversation = await aiRepository.createConversation({
        userId,
        context: input.context,
        title: titleFrom(chapter.name),
        chapterId: chapter.id,
      });

      return {
        ...toConversation(conversation),
        messages: [],
        availableActions: availableActions({
          context: input.context,
          hasWrongAttempt: false,
          hasAssistantTurn: false,
        }),
      };
    }

    const questionId = input.questionId ?? "";

    if (await aiRepository.hasLiveExamAttempt(userId, questionId)) {
      throw new ForbiddenError("The AI tutor is unavailable while an exam is in progress");
    }

    const question = await aiRepository.loadGrounding(questionId);
    if (!question) throw new NotFoundError("Question");

    const attempt = await aiRepository.loadAttempt(userId, questionId, input.questionAttemptId);

    const conversation = await aiRepository.createConversation({
      userId,
      context: input.context,
      title: titleFrom(question.body),
      questionId,
      questionAttemptId: input.questionAttemptId ?? attempt?.id,
    });

    return {
      ...toConversation(conversation),
      messages: [],
      availableActions: availableActions({
        context: input.context,
        hasWrongAttempt: attempt?.isCorrect === false,
        hasAssistantTurn: false,
      }),
    };
  },

  async list(
    userId: string,
    query: { limit: number; cursor?: string | undefined },
  ): Promise<Paginated<AIConversation>> {
    // One more than asked for, so "is there another page" is answered by the
    // query rather than by a second count.
    const rows = await aiRepository.listConversations(userId, query.limit, query.cursor);

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: page.map(toConversation),
      pageInfo: { nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null, hasMore },
    };
  },

  async get(userId: string, conversationId: string): Promise<AIConversationDetail> {
    const conversation = await aiRepository.findConversation(userId, conversationId);
    if (!conversation) throw new NotFoundError("Conversation");

    const history = await aiRepository.loadHistory(conversationId);

    let hasWrongAttempt = false;
    if (conversation.questionId) {
      const attempt = await aiRepository.loadAttempt(
        userId,
        conversation.questionId,
        conversation.questionAttemptId ?? undefined,
      );
      hasWrongAttempt = attempt?.isCorrect === false;
    }

    return {
      ...toConversation(conversation),
      // SYSTEM rows are server-authored grounding, not turns. They are filtered
      // out of the transcript rather than hidden by the client, so that the
      // chapter snapshot cannot be read back out of the API.
      messages: history.filter((row) => row.role !== "SYSTEM").map(toMessage),
      availableActions: availableActions({
        context: conversation.context,
        hasWrongAttempt,
        hasAssistantTurn: history.some((row) => row.role === "ASSISTANT"),
      }),
    };
  },

  async archive(userId: string, conversationId: string): Promise<AIConversation> {
    const conversation = await aiRepository.findConversation(userId, conversationId);
    if (!conversation) throw new NotFoundError("Conversation");

    return toConversation(await aiRepository.archiveConversation(conversationId));
  },

  async quota(userId: string): Promise<AIQuota> {
    return publicQuota(await readQuota(userId));
  },

  /**
   * One buffered turn.
   *
   * The non-streaming path exists for callers that cannot consume SSE — tests,
   * and any client on a network that buffers event streams into uselessness.
   * It shares `prepare` with the streaming path so the two cannot drift on the
   * guards, which is the part where drift would matter.
   */
  async send(userId: string, conversationId: string, input: SendMessageInput): Promise<AIReply> {
    const turn = await prepare(userId, conversationId, input);

    if (turn.shortCircuit) return persistFree(turn, turn.shortCircuit, false, turn.quota);

    const blocked = blockedReason(turn);
    if (blocked) {
      if (!turn.fallbackText) {
        throw new AIUnavailableError(
          blocked === "quota"
            ? "You have used today's AI tutor allowance, and this question has no stored solution to fall back on."
            : "The AI tutor is not available right now.",
        );
      }
      return persistFree(turn, turn.fallbackText, true, turn.quota);
    }

    const startedAt = Date.now();
    let text = "";
    let model: string | null = null;
    let promptTokens: number | null = null;
    let completionTokens: number | null = null;

    try {
      for await (const chunk of aiProvider().streamChat({
        tier: turn.profile.tier,
        system: turn.system,
        messages: turn.messages,
        maxTokens: turn.profile.maxTokens,
        temperature: turn.profile.temperature,
      })) {
        if (chunk.type === "text") text += chunk.delta;
        else {
          model = chunk.model;
          promptTokens = chunk.usage.promptTokens;
          completionTokens = chunk.usage.completionTokens;
        }
      }
    } catch (error) {
      logger.warn({ err: error, conversationId }, "AI turn failed; degrading to stored solution");

      if (!turn.fallbackText)
        throw new AIUnavailableError("The AI tutor is not available right now.");
      return persistFree(turn, turn.fallbackText, true, turn.quota);
    }

    const quota = await recordUsage({
      userId,
      promptTokens: promptTokens ?? 0,
      completionTokens: completionTokens ?? 0,
      model,
    });

    const row = await aiRepository.appendExchange({
      conversationId: turn.conversationId,
      userContent: turn.userContent,
      action: turn.action,
      assistantContent: text,
      model,
      promptTokens,
      completionTokens,
      providerRequestId: null,
      latencyMs: Date.now() - startedAt,
    });

    return {
      conversationId: turn.conversationId,
      message: toMessage(row),
      degraded: false,
      quota: publicQuota(quota),
    };
  },

  /**
   * One streamed turn.
   *
   * Yields events for the route to serialise as SSE. The generator owns
   * persistence rather than the route, because the interesting case is failure:
   * a stream that dies mid-answer, or a client that closes the tab, must still
   * write what was produced. A student who watched three paragraphs appear and
   * then found an empty transcript would reasonably conclude the product lost
   * their work — and it would have.
   */
  async *stream(
    userId: string,
    conversationId: string,
    input: SendMessageInput,
    signal?: AbortSignal,
  ): AsyncIterable<AIStreamEvent> {
    const turn = await prepare(userId, conversationId, input);

    const serveWhole = async function* (
      content: string,
      degraded: boolean,
    ): AsyncIterable<AIStreamEvent> {
      yield { type: "meta", conversationId: turn.conversationId, degraded };
      yield { type: "delta", text: content };
      const reply = await persistFree(turn, content, degraded, turn.quota);
      yield { type: "done", message: reply.message, degraded, quota: reply.quota };
    };

    if (turn.shortCircuit) {
      yield* serveWhole(turn.shortCircuit, false);
      return;
    }

    const blocked = blockedReason(turn);
    if (blocked) {
      if (!turn.fallbackText) {
        throw new AIUnavailableError(
          blocked === "quota"
            ? "You have used today's AI tutor allowance, and this question has no stored solution to fall back on."
            : "The AI tutor is not available right now.",
        );
      }
      yield* serveWhole(turn.fallbackText, true);
      return;
    }

    yield { type: "meta", conversationId: turn.conversationId, degraded: false };

    const startedAt = Date.now();
    let text = "";
    let model: string | null = null;
    let promptTokens: number | null = null;
    let completionTokens: number | null = null;
    let failure: unknown = null;

    try {
      for await (const chunk of aiProvider().streamChat({
        tier: turn.profile.tier,
        system: turn.system,
        messages: turn.messages,
        maxTokens: turn.profile.maxTokens,
        temperature: turn.profile.temperature,
        ...(signal ? { signal } : {}),
      })) {
        if (chunk.type === "text") {
          text += chunk.delta;
          yield { type: "delta", text: chunk.delta };
        } else {
          model = chunk.model;
          promptTokens = chunk.usage.promptTokens;
          completionTokens = chunk.usage.completionTokens;
        }
      }
    } catch (error) {
      failure = error;
    }

    // Nothing was shown, so the chain never committed and falling back to the
    // stored solution is still seamless from the student's side.
    if (failure && text.length === 0) {
      logger.warn({ err: failure, conversationId }, "AI stream failed before any output");

      if (!turn.fallbackText) {
        yield {
          type: "error",
          code: ERROR_CODES.AI_UNAVAILABLE,
          message: "The AI tutor is not available right now.",
        };
        return;
      }

      yield* serveWhole(turn.fallbackText, true);
      return;
    }

    const quota = await recordUsage({
      userId,
      promptTokens: promptTokens ?? 0,
      completionTokens: completionTokens ?? 0,
      model,
    });

    const row = await aiRepository.appendExchange({
      conversationId: turn.conversationId,
      userContent: turn.userContent,
      action: turn.action,
      assistantContent: text,
      model,
      promptTokens,
      completionTokens,
      providerRequestId: null,
      latencyMs: Date.now() - startedAt,
    });

    if (failure) {
      // Persisted, then reported. The student keeps the partial answer and is
      // told it is partial, which is strictly better than either alone.
      logger.warn({ err: failure, conversationId }, "AI stream failed after output had started");
      yield {
        type: "error",
        code: ERROR_CODES.AI_UNAVAILABLE,
        message: "The tutor's reply was cut short. Ask again to continue.",
      };
      return;
    }

    yield {
      type: "done",
      message: toMessage(row),
      degraded: false,
      quota: publicQuota(quota),
    };
  },
};
