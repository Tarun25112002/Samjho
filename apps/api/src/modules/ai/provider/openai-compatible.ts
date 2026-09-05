import type { AIProviderId } from "../../../lib/config.js";
import {
  ProviderError,
  describeResponse,
  kindForStatus,
  parseRetryAfter,
  toProviderError,
} from "./errors.js";
import { parseEventData, readSSE } from "./sse.js";
import {
  contentToParts,
  estimateTokens,
  type AIProvider,
  type AIProviderCapabilities,
  type ChatChunk,
  type ChatRequest,
  type CompletionResponse,
  type ContentPart,
} from "./types.js";

/**
 * OpenRouter and xAI Grok, which speak the same wire format.
 *
 * One transport for both, differing only in base URL, key, model ids and
 * capabilities. The alternative — two near-identical files — is two places for
 * a bug in the error mapping to live, and only one of them ever gets fixed.
 *
 * Both stream OpenAI-style `chat.completion.chunk` events terminated by a
 * literal `data: [DONE]`, which is not JSON and must be recognised before the
 * parse rather than after it fails.
 */

export interface OpenAICompatibleOptions {
  id: AIProviderId;
  apiKey: string;
  baseUrl: string;
  strongModel: string;
  fastModel: string;
  capabilities: AIProviderCapabilities;
  /** OpenRouter reads attribution headers; xAI ignores them. */
  attribution?: { siteUrl: string; siteName: string };
}

export function createOpenAICompatibleProvider(options: OpenAICompatibleOptions): AIProvider {
  const modelFor = (request: Pick<ChatRequest, "tier" | "model">): string =>
    request.model ?? (request.tier === "strong" ? options.strongModel : options.fastModel);

  const headers = (): Record<string, string> => ({
    "content-type": "application/json",
    authorization: `Bearer ${options.apiKey}`,
    ...(options.attribution
      ? { "HTTP-Referer": options.attribution.siteUrl, "X-Title": options.attribution.siteName }
      : {}),
  });

  function requestBody(request: ChatRequest, stream: boolean): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: modelFor(request),
      messages: [
        { role: "system", content: request.system },
        ...request.messages.map((message) => ({
          role: message.role,
          content: contentToParts(message.content).map((part) => toWirePart(part, options)),
        })),
      ],
      max_tokens: request.maxTokens,
      stream,
      ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      // Asked for on the stream so the `done` chunk can report real numbers
      // rather than an estimate. Providers that ignore it simply omit `usage`.
      ...(stream ? { stream_options: { include_usage: true } } : {}),
    };

    if (request.jsonSchema && options.capabilities.structuredOutput) {
      body["response_format"] = {
        type: "json_schema",
        json_schema: {
          name: request.jsonSchema.name,
          // Without `strict`, the schema is a suggestion. With it the model
          // cannot return a structurally wrong shape — which is the class of
          // failure that is expensive to debug, because the output looks
          // plausible right up to the parse.
          strict: true,
          schema: request.jsonSchema.schema,
        },
      };
    }

    return body;
  }

  async function post(request: ChatRequest, stream: boolean): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(`${options.baseUrl}/chat/completions`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(requestBody(request, stream)),
        ...(request.signal ? { signal: request.signal } : {}),
      });
    } catch (error) {
      throw toProviderError(options.id, error, request.signal);
    }

    if (!response.ok) {
      throw new ProviderError(
        options.id,
        kindForStatus(response.status),
        await describeResponse(response),
        {
          status: response.status,
          // A provider that told us when to come back knows better than any
          // backoff curve we would invent. 429s carry this.
          ...(parseRetryAfter(response.headers.get("retry-after")) === undefined
            ? {}
            : { retryAfterMs: parseRetryAfter(response.headers.get("retry-after")) }),
        },
      );
    }

    return response;
  }

  return {
    id: options.id,
    capabilities: options.capabilities,

    async *streamChat(request: ChatRequest): AsyncIterable<ChatChunk> {
      const response = await post(request, true);

      if (!response.body) {
        throw new ProviderError(options.id, "malformed", "Streaming response had no body");
      }

      const model = modelFor(request);
      let promptTokens = 0;
      let completionTokens = 0;
      let stopReason = "stop";
      let reportedModel = model;

      for await (const event of readSSE(response.body, request.signal)) {
        // Not JSON, and the only terminator OpenAI-compatible providers send.
        if (event.data === "[DONE]") break;

        const payload = parseEventData(event.data) as {
          model?: string;
          choices?: { delta?: { content?: string }; finish_reason?: string | null }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
          error?: { message?: string; code?: unknown };
        } | null;

        if (!payload) continue;

        if (payload.error) {
          // A mid-stream error arrives as a 200 with an error event in it. The
          // chain can still fail over from here as long as no text has been
          // yielded yet, which is exactly why this throws rather than breaking.
          throw new ProviderError(
            options.id,
            "upstream",
            payload.error.message ?? "The provider reported an error mid-stream",
          );
        }

        if (payload.model) reportedModel = payload.model;
        if (payload.usage?.prompt_tokens !== undefined) promptTokens = payload.usage.prompt_tokens;
        if (payload.usage?.completion_tokens !== undefined) {
          completionTokens = payload.usage.completion_tokens;
        }

        const choice = payload.choices?.[0];
        if (choice?.finish_reason) stopReason = choice.finish_reason;

        const delta = choice?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) {
          yield { type: "text", delta };
        }
      }

      yield {
        type: "done",
        model: reportedModel,
        usage: { promptTokens, completionTokens },
        stopReason,
      };
    },

    async complete(request: ChatRequest): Promise<CompletionResponse> {
      const response = await post(request, false);

      let payload: unknown;
      try {
        payload = await response.json();
      } catch (error) {
        throw new ProviderError(options.id, "malformed", "Response was not JSON", { cause: error });
      }

      const root = payload as {
        model?: string;
        choices?: { message?: { content?: unknown } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const content = root.choices?.[0]?.message?.content;
      const text = typeof content === "string" ? content : joinTextParts(content);

      if (text.trim().length === 0) {
        // An empty completion is a failure that looks like a success, and it is
        // routinely how a content filter or a truncation arrives. Classified as
        // upstream so the chain moves on rather than handing back "".
        throw new ProviderError(options.id, "malformed", "The model returned an empty response");
      }

      return {
        text,
        model: root.model ?? modelFor(request),
        promptTokens: root.usage?.prompt_tokens ?? null,
        completionTokens: root.usage?.completion_tokens ?? null,
      };
    },

    countTokens(request) {
      return Promise.resolve(estimateTokens(request));
    },
  };
}

/**
 * Content parts, in this dialect.
 *
 * Images go as data URLs, which every OpenAI-compatible vendor accepts.
 * Documents go as OpenRouter's `file` part — which is *not* part of the OpenAI
 * format, and is why a provider declaring `documents: false` must never be sent
 * one. The registry enforces that before we get here; this throw is the
 * backstop for a caller that went around it.
 */
function toWirePart(part: ContentPart, options: OpenAICompatibleOptions): unknown {
  if (part.type === "text") return { type: "text", text: part.text };

  if (part.type === "image") {
    return { type: "image_url", image_url: { url: `data:${part.mimeType};base64,${part.data}` } };
  }

  if (!options.capabilities.documents) {
    throw new ProviderError(
      options.id,
      "bad_request",
      `${options.id} cannot read document attachments`,
    );
  }

  return {
    type: "file",
    file: { filename: part.fileName, file_data: `data:${part.mimeType};base64,${part.data}` },
  };
}

/** Some gateways return content as parts even when the request sent a string. */
function joinTextParts(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((part) =>
      typeof part === "object" && part !== null && "text" in part
        ? String((part as { text: unknown }).text)
        : "",
    )
    .join("");
}
