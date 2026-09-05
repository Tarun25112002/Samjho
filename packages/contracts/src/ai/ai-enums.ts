import { z } from "zod";

/**
 * AI tutor taxonomy shared by the API and the web app.
 *
 * Same rule as the other enum files: Prisma generates its own copy from
 * schema.prisma, and `enum-parity.test.ts` checks the two agree rather than
 * trusting them to.
 */

/**
 * Where the student was when they asked.
 *
 * This is not decoration — it changes which grounding the server assembles.
 * `PRACTICE` and `REVIEW` both have a question and an attempt to anchor to;
 * `CHAPTER` has neither, so the context block is built from the chapter's
 * topics instead and the tutor is told it is answering a general question.
 */
export const aiContextSchema = z.enum(["PRACTICE", "REVIEW", "CHAPTER"]);
export type AIContext = z.infer<typeof aiContextSchema>;

export const aiRoleSchema = z.enum(["USER", "ASSISTANT", "SYSTEM"]);
export type AIRole = z.infer<typeof aiRoleSchema>;

/**
 * The six tutor actions, ordered by how much they give away (docs/05 §3).
 *
 * The action is a first-class input rather than a phrase the client puts in a
 * text box, for three reasons that all matter:
 *
 *  1. Each action gets its own prompt template. One prompt asked to behave six
 *     different ways does all six mediocrely.
 *  2. Each action gets its own model and token budget. A rephrase and a full
 *     worked solution have no business costing the same.
 *  3. `WHY_WRONG` is only legal after a wrong attempt, which is a server-side
 *     check against the attempt row — impossible to express if the request is
 *     free text.
 */
export const aiActionSchema = z.enum([
  "HINT",
  "EXPLAIN",
  "WHY_WRONG",
  "STEP_BY_STEP",
  "SIMPLER",
  "SIMILAR",
]);
export type AIAction = z.infer<typeof aiActionSchema>;

export const AI_ACTION_LABELS = {
  HINT: "Give me a hint",
  EXPLAIN: "Explain the concept",
  WHY_WRONG: "Explain my mistake",
  STEP_BY_STEP: "Solve step-by-step",
  SIMPLER: "Explain in simpler language",
  SIMILAR: "Give me a similar question",
} as const satisfies Record<AIAction, string>;

export const conversationStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);
export type ConversationStatus = z.infer<typeof conversationStatusSchema>;
