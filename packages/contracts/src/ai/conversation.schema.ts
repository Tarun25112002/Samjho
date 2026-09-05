import { z } from "zod";

import {
  aiActionSchema,
  aiContextSchema,
  aiRoleSchema,
  conversationStatusSchema,
} from "./ai-enums.js";

/**
 * The AI tutor's wire contract.
 *
 * The single most important line in this file is what is *absent* from
 * `sendMessageSchema`: no question body, no options, no solution. The client
 * sends an action and at most a short follow-up; every fact the model is given
 * about the question is assembled server-side from the database (docs/05 §2).
 *
 * If the client supplied context, a student could post "the correct answer is
 * B, confirm it" and the model would helpfully agree — and the student would
 * believe it, because it came from the tutor. Grounding is only worth anything
 * if the grounded party cannot choose the grounding.
 */

export const startConversationSchema = z
  .object({
    context: aiContextSchema,
    /** Required for PRACTICE and REVIEW; forbidden — and meaningless — for CHAPTER. */
    questionId: z.string().min(1).max(60).optional(),
    /** Which attempt prompted this, when there is one. Enables WHY_WRONG. */
    questionAttemptId: z.string().min(1).max(60).optional(),
    /** Anchors a CHAPTER conversation to something concrete. */
    chapterId: z.string().min(1).max(60).optional(),
  })
  .refine((input) => (input.context === "CHAPTER" ? !!input.chapterId : !!input.questionId), {
    message: "questionId is required for PRACTICE and REVIEW; chapterId for CHAPTER",
    path: ["questionId"],
  });

export type StartConversationInput = z.infer<typeof startConversationSchema>;

export const sendMessageSchema = z.object({
  action: aiActionSchema,
  /**
   * An optional free-text follow-up ("but why is it negative?").
   *
   * Capped hard. This is the one field on the whole surface whose content
   * reaches the model unmediated, so it is the one field a prompt injection
   * would arrive in — the length cap is the cheapest of the several controls
   * on it, and the system prompt carries the rest.
   */
  text: z.string().trim().min(1).max(500).optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const aiMessageSchema = z.object({
  id: z.string().min(1),
  role: aiRoleSchema,
  action: aiActionSchema.nullable(),
  content: z.string(),
  /**
   * `"<provider>:<model>"` — e.g. `"gemini:gemini-2.5-flash"`.
   *
   * Which provider served a request is an operational fact worth keeping: with
   * a fallback chain, "the tutor got slow last Tuesday" is usually "the primary
   * was failing over all afternoon", and that is only answerable if the row
   * says who actually answered.
   */
  model: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export type AIMessage = z.infer<typeof aiMessageSchema>;

export const aiConversationSchema = z.object({
  id: z.string().min(1),
  context: aiContextSchema,
  questionId: z.string().nullable(),
  title: z.string(),
  messageCount: z.number().int().nonnegative(),
  status: conversationStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type AIConversation = z.infer<typeof aiConversationSchema>;

export const aiConversationDetailSchema = aiConversationSchema.extend({
  messages: z.array(aiMessageSchema),
  /** Which actions this conversation may currently use, and why not. */
  availableActions: z.array(aiActionSchema),
});

export type AIConversationDetail = z.infer<typeof aiConversationDetailSchema>;

/**
 * What is left of today's allowance.
 *
 * Surfaced in `/profile` deliberately: a limit a student can see coming feels
 * fair, and the same limit arriving unannounced mid-revision feels punitive
 * (docs/05 §5.1).
 */
export const aiQuotaSchema = z.object({
  messagesUsed: z.number().int().nonnegative(),
  messagesLimit: z.number().int().positive(),
  messagesRemaining: z.number().int().nonnegative(),
  /** UTC midnight at which the counters reset. */
  resetsAt: z.iso.datetime(),
});

export type AIQuota = z.infer<typeof aiQuotaSchema>;

/**
 * A completed tutor turn.
 *
 * `degraded` is the honest bit. When every provider in the chain is down, or
 * the monthly ceiling has been hit, the tutor still answers — with the
 * human-written solution already stored against the question, clearly labelled
 * as not being the AI's own reply (docs/05 §5.6). The feature degrades to
 * something useful instead of to an error toast, and this flag is how the
 * client knows to say so.
 */
export const aiReplySchema = z.object({
  conversationId: z.string().min(1),
  message: aiMessageSchema,
  degraded: z.boolean(),
  quota: aiQuotaSchema,
});

export type AIReply = z.infer<typeof aiReplySchema>;

/**
 * One frame of a streamed turn.
 *
 * Declared here rather than only in the API because both ends parse it: the
 * route serialises these as named SSE events, and the browser validates each
 * frame before rendering it. A stream is the one place where a shape mismatch
 * is invisible until it is on screen — a mistyped field in a JSON response
 * fails loudly at the parse, while a mistyped field in a delta just renders
 * `undefined` into a student's answer.
 *
 * `meta` arrives first and carries the conversation id, because a client that
 * created the conversation in the same gesture does not otherwise know it. It
 * also carries `degraded` up front, so the notice appears with the first words
 * rather than after the last.
 */
export const aiStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("meta"),
    conversationId: z.string().min(1),
    degraded: z.boolean(),
  }),
  z.object({ type: z.literal("delta"), text: z.string() }),
  z.object({
    type: z.literal("done"),
    message: aiMessageSchema,
    degraded: z.boolean(),
    quota: aiQuotaSchema,
  }),
  z.object({ type: z.literal("error"), code: z.string(), message: z.string() }),
]);

export type AIStreamEvent = z.infer<typeof aiStreamEventSchema>;

/**
 * Whether the tutor can answer at all, and what today's allowance looks like.
 *
 * `available` is false when no provider has credentials — a legitimate way to
 * run this product (a demo, a cost freeze), in which case the tutor still
 * answers from the stored solution and the client should say so rather than
 * offering a ladder of actions that will all come back degraded.
 */
export const aiStatusSchema = z.object({
  available: z.boolean(),
  quota: aiQuotaSchema,
  /**
   * Which vendors are in the chain and which are failing.
   *
   * Present only for staff. It names our suppliers and says when one of them is
   * down — operational detail rather than something a student needs, and the
   * kind of thing that is free reconnaissance if handed to everyone.
   */
  providers: z.array(z.object({ id: z.string(), healthy: z.boolean() })).optional(),
});

export type AIStatus = z.infer<typeof aiStatusSchema>;
