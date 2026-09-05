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
  type ChatChunk,
  type ChatRequest,
  type CompletionResponse,
  type ContentPart,
} from "./types.js";

/**
 * Google Gemini, spoken directly rather than through a gateway.
 *
 * The config comment gives the reason and it is worth repeating where the code
 * is: a fallback chain whose every hop runs through one vendor's gateway fails
 * as a unit the moment that gateway does, which is the failure a chain exists
 * to survive. So the second link talks to Google itself.
 *
 * Its wire format shares nothing with OpenAI's — `contents` not `messages`,
 * `inlineData` not `image_url`, `systemInstruction` as its own field, `model`
 * as a role — which is why this is a separate file rather than a flag on the
 * other one.
 *
 * It also has the best document story of the three: a PDF is `inlineData` with
 * a PDF mime type and the model reads it natively, pages and diagrams included.
 * That is why a scanned paper prefers it.
 */
export interface GeminiOptions {
  apiKey: string;
  baseUrl: string;
  strongModel: string;
  fastModel: string;
}

export function createGeminiProvider(options: GeminiOptions): AIProvider {
  const modelFor = (request: Pick<ChatRequest, "tier" | "model">): string =>
    request.model ?? (request.tier === "strong" ? options.strongModel : options.fastModel);

  function requestBody(request: ChatRequest): Record<string, unknown> {
    return {
      systemInstruction: { parts: [{ text: request.system }] },
      contents: request.messages.map((message) => ({
        // Gemini's two roles are "user" and "model"; there is no "assistant".
        role: message.role === "assistant" ? "model" : "user",
        parts: contentToParts(message.content).map(toWirePart),
      })),
      generationConfig: {
        maxOutputTokens: request.maxTokens,
        ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
        ...(request.jsonSchema
          ? {
              responseMimeType: "application/json",
              // Gemini calls it `responseSchema` and accepts a subset of JSON
              // Schema. The extractor writes its schema to that subset once,
              // for all three providers — see extraction.service.ts.
              responseSchema: request.jsonSchema.schema,
            }
          : {}),
      },
    };
  }

  async function post(request: ChatRequest, stream: boolean): Promise<Response> {
    const model = modelFor(request);
    const method = stream ? "streamGenerateContent?alt=sse" : "generateContent";
    const url = `${options.baseUrl}/models/${encodeURIComponent(model)}:${method}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // A header rather than a query parameter, deliberately: a key in a
          // URL ends up in access logs, proxy logs and error reports.
          "x-goog-api-key": options.apiKey,
        },
        body: JSON.stringify(requestBody(request)),
        ...(request.signal ? { signal: request.signal } : {}),
      });
    } catch (error) {
      throw toProviderError("gemini", error, request.signal);
    }

    if (!response.ok) {
      const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
      throw new ProviderError(
        "gemini",
        kindForStatus(response.status),
        await describeResponse(response),
        {
          status: response.status,
          ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
        },
      );
    }

    return response;
  }

  return {
    id: "gemini",
    capabilities: { structuredOutput: true, images: true, documents: true },

    async *streamChat(request: ChatRequest): AsyncIterable<ChatChunk> {
      const response = await post(request, true);

      if (!response.body) {
        throw new ProviderError("gemini", "malformed", "Streaming response had no body");
      }

      const model = modelFor(request);
      let promptTokens = 0;
      let completionTokens = 0;
      let stopReason = "STOP";

      for await (const event of readSSE(response.body, request.signal)) {
        const payload = parseEventData(event.data) as GeminiResponseBody | null;
        if (!payload) continue;

        if (payload.error) {
          throw new ProviderError(
            "gemini",
            "upstream",
            payload.error.message ?? "Gemini reported an error mid-stream",
          );
        }

        const candidate = payload.candidates?.[0];
        if (candidate?.finishReason) stopReason = candidate.finishReason;
        if (payload.usageMetadata?.promptTokenCount !== undefined) {
          promptTokens = payload.usageMetadata.promptTokenCount;
        }
        if (payload.usageMetadata?.candidatesTokenCount !== undefined) {
          completionTokens = payload.usageMetadata.candidatesTokenCount;
        }

        const delta = (candidate?.content?.parts ?? []).map((part) => part.text ?? "").join("");
        if (delta.length > 0) yield { type: "text", delta };
      }

      yield {
        type: "done",
        model,
        usage: { promptTokens, completionTokens },
        stopReason,
      };
    },

    async complete(request: ChatRequest): Promise<CompletionResponse> {
      const response = await post(request, false);

      let payload: GeminiResponseBody;
      try {
        payload = (await response.json()) as GeminiResponseBody;
      } catch (error) {
        throw new ProviderError("gemini", "malformed", "Response was not JSON", { cause: error });
      }

      const candidate = payload.candidates?.[0];
      const text = (candidate?.content?.parts ?? []).map((part) => part.text ?? "").join("");

      if (text.trim().length === 0) {
        // `finishReason` carries the diagnosis — SAFETY, MAX_TOKENS, RECITATION
        // — and an empty response with no reason attached is the single thing
        // that makes this failure hard to explain a week later.
        throw new ProviderError(
          "gemini",
          "malformed",
          `Empty response (finishReason: ${candidate?.finishReason ?? "unknown"})`,
        );
      }

      return {
        text,
        model: modelFor(request),
        promptTokens: payload.usageMetadata?.promptTokenCount ?? null,
        completionTokens: payload.usageMetadata?.candidatesTokenCount ?? null,
      };
    },

    countTokens(request) {
      return Promise.resolve(estimateTokens(request));
    },
  };
}

interface GeminiResponseBody {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string };
}

/**
 * Content parts, Gemini-style.
 *
 * Images and documents take the same shape and differ only by mime type, which
 * is a real simplification rather than a shortcut: to this model, a PDF page
 * and a photograph of the same page are the same kind of input.
 */
function toWirePart(part: ContentPart): unknown {
  if (part.type === "text") return { text: part.text };
  return { inlineData: { mimeType: part.mimeType, data: part.data } };
}
