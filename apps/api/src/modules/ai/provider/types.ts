import type { AIProviderId } from "../../../lib/config.js";

/**
 * The provider abstraction, at the capability level.
 *
 * docs/05 §1 states the rule this file follows: **abstract at the capability
 * level, not the HTTP level.** A lowest-common-denominator `send(string):
 * string` wrapper is easy to write and throws away streaming, structured
 * output, and multimodal input — which are precisely the things that differ
 * between these three vendors and precisely the things the two callers need.
 *
 * There are two callers, and they want opposite shapes:
 *
 *  - **The tutor** streams. A student watching a blank box for eight seconds
 *    has been failed regardless of what arrives next, so `streamChat` is the
 *    primary method and the fallback chain is built around its first token.
 *  - **Paper extraction** does not. It is a background job whose output is one
 *    JSON document nobody reads incrementally; streaming it would add
 *    partial-JSON parsing to buy nothing. It uses `complete`.
 *
 * `complete` is a real method rather than "drain the stream", because the two
 * differ in more than buffering: extraction asks for a JSON schema and no
 * provider streams schema-constrained output usefully.
 */

/**
 * Which of a provider's two configured models to use.
 *
 * A tier, not a model id. Ids live in config (`GEMINI_MODEL_STRONG` and
 * friends) so changing one is an environment change rather than a deploy — and
 * so a service asking for "the good one" need not know which vendor answers.
 */
export type ModelTier = "strong" | "fast";

export interface AIProviderCapabilities {
  /** Can be *made* to return JSON matching a schema, not merely asked. */
  structuredOutput: boolean;
  /** Accepts image parts. */
  images: boolean;
  /**
   * Accepts PDF parts. Notably not universal — xAI has no document input — and
   * the registry routes on this rather than discovering it at runtime as a 400.
   */
  documents: boolean;
}

/**
 * A piece of a message.
 *
 * Text-only messages are the overwhelming majority, which is why `content`
 * below accepts a bare string: making every tutor turn construct a one-element
 * array would be ceremony paid on the common path for the benefit of the rare
 * one.
 */
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; mimeType: string; data: string }
  | { type: "document"; mimeType: string; data: string; fileName: string };

export interface ChatMessage {
  role: "user" | "assistant";
  content: string | ContentPart[];
}

export interface ChatRequest {
  /** Which class of model this action earns. See ai.models.ts. */
  tier: ModelTier;
  /** Overrides the tier's configured model id. Used by tests and by replays. */
  model?: string;
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature?: number;
  /**
   * A JSON Schema the response must satisfy.
   *
   * Providers that support it enforce it; any that do not are given the schema
   * in the prompt. Either way the caller re-validates with Zod, because "the
   * model was asked to follow this" and "the output provably follows this" are
   * different claims and only the second one is safe to write to a database.
   */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  signal?: AbortSignal;
}

export type ChatChunk =
  | { type: "text"; delta: string }
  | {
      type: "done";
      /** The model that answered. The chain prefixes it with the provider id. */
      model: string;
      usage: { promptTokens: number; completionTokens: number };
      stopReason: string;
    };

export interface CompletionResponse {
  text: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
}

export interface AIProvider {
  readonly id: AIProviderId;
  readonly capabilities: AIProviderCapabilities;

  /** The tutor's path: token by token, failed over only before the first one. */
  streamChat: (request: ChatRequest) => AsyncIterable<ChatChunk>;

  /** The extractor's path: one request, one JSON document, no partial output. */
  complete: (request: ChatRequest) => Promise<CompletionResponse>;

  /**
   * Prompt size, for trimming history to a budget.
   *
   * Approximate by design, and every implementation here estimates rather than
   * calling a tokenizer endpoint: the number is compared against a round budget
   * (`HISTORY_TOKEN_BUDGET`), so a network round trip to refine it would cost
   * more than the imprecision does.
   */
  countTokens: (
    request: Pick<ChatRequest, "system" | "messages" | "tier" | "model">,
  ) => Promise<number>;
}

/**
 * Characters per token, for the estimate above.
 *
 * ~4 is the usual English figure and holds well enough for the mixture this
 * product sends — English prose, LaTeX, and the occasional Devanagari string,
 * which tokenizes worse and pushes the true count up. Erring low would let
 * history grow past the budget, so callers treat this as a floor.
 */
const CHARS_PER_TOKEN = 4;

/** The shared estimator. Every provider uses it; none has a better one to hand. */
export function estimateTokens(request: Pick<ChatRequest, "system" | "messages">): number {
  let characters = request.system.length;

  for (const message of request.messages) {
    if (typeof message.content === "string") {
      characters += message.content.length;
      continue;
    }

    for (const part of message.content) {
      if (part.type === "text") characters += part.text.length;
      // A base64 image or PDF is not text and its length says nothing useful
      // about its token cost. Counting it would inflate the estimate by orders
      // of magnitude and trim away the entire conversation to make room for a
      // number that was wrong.
    }
  }

  return Math.ceil(characters / CHARS_PER_TOKEN);
}

/** Message content as a plain string, for providers that take only that. */
export function contentToParts(content: string | ContentPart[]): ContentPart[] {
  return typeof content === "string" ? [{ type: "text", text: content }] : content;
}
