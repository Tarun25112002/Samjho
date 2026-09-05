import { describe, expect, it } from "vitest";

import type { AIProviderId } from "../../../lib/config.js";
import { AllProvidersFailedError, ProviderError } from "./errors.js";
import { FallbackChainProvider } from "./fallback.js";
import { readSSE } from "./sse.js";
import { estimateTokens, type AIProvider, type ChatChunk, type ChatRequest } from "./types.js";

/**
 * The chain, against fake providers.
 *
 * These are the tests that matter most in the whole AI module, because the
 * failover rules are the part that is impossible to check by using the product:
 * a chain that never fails over and a chain that fails over perfectly look
 * identical for as long as the primary is up.
 */

const OPTIONS = {
  requestTimeoutMs: 1_000,
  firstTokenTimeoutMs: 120,
  cooldownMs: 500,
};

const REQUEST: ChatRequest = {
  tier: "fast",
  system: "You are a tutor.",
  messages: [{ role: "user", content: "Give me a hint." }],
  maxTokens: 100,
};

interface FakeOptions {
  /** Text chunks to emit, in order. */
  chunks?: string[];
  /** Thrown before anything is emitted. */
  failBefore?: Error;
  /** Thrown after the chunks have been emitted. */
  failAfter?: Error;
  /** Delay before the first chunk, to trip the first-token deadline. */
  stallMs?: number;
}

function fake(id: AIProviderId, options: FakeOptions = {}): AIProvider & { calls: number } {
  const provider = {
    id,
    calls: 0,
    capabilities: { structuredOutput: true, images: false, documents: false },

    async *streamChat(request: ChatRequest): AsyncIterable<ChatChunk> {
      provider.calls += 1;

      if (options.failBefore) throw options.failBefore;

      if (options.stallMs) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, options.stallMs);
          request.signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }

      for (const delta of options.chunks ?? ["Consider ", "the ratio."]) {
        yield { type: "text", delta };
      }

      if (options.failAfter) throw options.failAfter;

      yield {
        type: "done",
        model: `${id}-model`,
        usage: { promptTokens: 10, completionTokens: 5 },
        stopReason: "stop",
      };
    },

    async complete() {
      return { text: "", model: `${id}-model`, promptTokens: null, completionTokens: null };
    },

    async countTokens(request: Pick<ChatRequest, "system" | "messages">) {
      return estimateTokens(request);
    },
  };

  return provider;
}

async function drain(chain: FallbackChainProvider, request = REQUEST) {
  let text = "";
  let model: string | null = null;

  for await (const chunk of chain.streamChat(request)) {
    if (chunk.type === "text") text += chunk.delta;
    else model = chunk.model;
  }

  return { text, model };
}

describe("FallbackChainProvider", () => {
  it("serves from the first healthy provider and leaves the rest alone", async () => {
    const primary = fake("openrouter");
    const secondary = fake("gemini");
    const chain = new FallbackChainProvider([primary, secondary], OPTIONS);

    const result = await drain(chain);

    expect(result.text).toBe("Consider the ratio.");
    // The provider that served is named alongside the model, which is the whole
    // reason the chain rewrites this field.
    expect(result.model).toBe("openrouter:openrouter-model");
    expect(secondary.calls).toBe(0);
  });

  it("fails over when a provider errors before its first token", async () => {
    const primary = fake("openrouter", {
      failBefore: new ProviderError("openrouter", "upstream", "503", { status: 503 }),
    });
    const secondary = fake("gemini");
    const chain = new FallbackChainProvider([primary, secondary], OPTIONS);

    const result = await drain(chain);

    expect(result.model).toBe("gemini:gemini-model");
    expect(primary.calls).toBe(1);
  });

  it("fails over when a provider stalls past the first-token deadline", async () => {
    // The deadline that actually governs failover: a provider that has not
    // started answering in 120ms is not going to save the request by finishing
    // in 900.
    const primary = fake("openrouter", { stallMs: 5_000 });
    const secondary = fake("gemini");
    const chain = new FallbackChainProvider([primary, secondary], OPTIONS);

    const result = await drain(chain);

    expect(result.model).toBe("gemini:gemini-model");
  });

  it("does NOT fail over once text has reached the caller", async () => {
    // The rule the whole class is built around. Splicing a second model's
    // continuation onto a first model's half-sentence is worse than the error.
    const primary = fake("openrouter", {
      chunks: ["Start of an answer"],
      failAfter: new ProviderError("openrouter", "network", "connection reset"),
    });
    const secondary = fake("gemini");
    const chain = new FallbackChainProvider([primary, secondary], OPTIONS);

    const seen: string[] = [];
    await expect(async () => {
      for await (const chunk of chain.streamChat(REQUEST)) {
        if (chunk.type === "text") seen.push(chunk.delta);
      }
    }).rejects.toThrow(ProviderError);

    expect(seen.join("")).toBe("Start of an answer");
    expect(secondary.calls).toBe(0);
  });

  it("treats a clean but empty response as a failure worth failing over", async () => {
    // A 200 that streams nothing is indistinguishable from a broken tutor to
    // the student, so it is never shown.
    const primary = fake("openrouter", { chunks: [] });
    const secondary = fake("gemini");
    const chain = new FallbackChainProvider([primary, secondary], OPTIONS);

    const result = await drain(chain);

    expect(result.text).toBe("Consider the ratio.");
    expect(result.model).toBe("gemini:gemini-model");
  });

  it("does not fail over when the caller aborts", async () => {
    const controller = new AbortController();
    const primary = fake("openrouter", { stallMs: 5_000 });
    const secondary = fake("gemini");
    const chain = new FallbackChainProvider([primary, secondary], OPTIONS);

    setTimeout(() => controller.abort(), 20);

    await expect(drain(chain, { ...REQUEST, signal: controller.signal })).rejects.toThrow();
    // Nobody is waiting for an answer, so a second provider would be a second
    // bill for output that is discarded.
    expect(secondary.calls).toBe(0);
  });

  it("demotes a failed provider on the next request but never drops it", async () => {
    const primary = fake("openrouter", {
      failBefore: new ProviderError("openrouter", "upstream", "503"),
    });
    const secondary = fake("gemini");
    const chain = new FallbackChainProvider([primary, secondary], OPTIONS);

    await drain(chain);
    expect(primary.calls).toBe(1);
    expect(chain.describe()).toEqual([
      { id: "openrouter", healthy: false },
      { id: "gemini", healthy: true },
    ]);

    // Second request skips straight to the healthy one rather than paying the
    // failing provider's latency again.
    await drain(chain);
    expect(primary.calls).toBe(1);
    expect(secondary.calls).toBe(2);
  });

  it("still tries a cooling provider when every provider is cooling", async () => {
    const only = fake("grok", {
      failBefore: new ProviderError("grok", "upstream", "503"),
    });
    const chain = new FallbackChainProvider([only], OPTIONS);

    await expect(drain(chain)).rejects.toThrow(AllProvidersFailedError);
    // Cooling is a demotion, not an exclusion: a chain that has excluded
    // everything must still ask someone.
    await expect(drain(chain)).rejects.toThrow(AllProvidersFailedError);
    expect(only.calls).toBe(2);
  });

  it("reports an empty chain as unavailable rather than throwing on construction", async () => {
    const chain = new FallbackChainProvider([], OPTIONS);

    expect(chain.isAvailable).toBe(false);
    await expect(drain(chain)).rejects.toThrow(AllProvidersFailedError);
  });

  it("collects every failure when the whole chain is down", async () => {
    const chain = new FallbackChainProvider(
      [
        fake("openrouter", { failBefore: new ProviderError("openrouter", "auth", "401") }),
        fake("gemini", { failBefore: new ProviderError("gemini", "rate_limit", "429") }),
        fake("grok", { failBefore: new ProviderError("grok", "network", "ECONNRESET") }),
      ],
      OPTIONS,
    );

    const error = await drain(chain).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AllProvidersFailedError);
    expect((error as AllProvidersFailedError).failures.map((one) => one.kind)).toEqual([
      "auth",
      "rate_limit",
      "network",
    ]);
  });
});

describe("readSSE", () => {
  function bodyOf(text: string): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(text));
        controller.close();
      },
    });
  }

  it("parses events and ignores keepalive comments", async () => {
    // OpenRouter sends `: OPENROUTER PROCESSING` while a slow model warms up.
    // Read as data, it would arrive in the student's answer as punctuation.
    const stream = bodyOf(
      ': OPENROUTER PROCESSING\n\ndata: {"a":1}\n\ndata: {"b":2}\n\ndata: [DONE]\n\n',
    );

    const seen: string[] = [];
    for await (const event of readSSE(stream)) seen.push(event.data);

    expect(seen).toEqual(['{"a":1}', '{"b":2}', "[DONE]"]);
  });

  it("joins multi-line data fields and survives CRLF", async () => {
    const stream = bodyOf("data: line one\r\ndata: line two\r\n\r\n");

    const seen: string[] = [];
    for await (const event of readSSE(stream)) seen.push(event.data);

    expect(seen).toEqual(["line one\nline two"]);
  });

  it("reassembles a multi-byte character split across chunks", async () => {
    // A naive `new TextDecoder().decode(chunk)` per chunk turns a Devanagari
    // character straddling a chunk boundary into two replacement characters.
    const encoder = new TextEncoder();
    const payload = encoder.encode("data: नमस्ते\n\n");
    const split = 8;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(payload.slice(0, split));
        controller.enqueue(payload.slice(split));
        controller.close();
      },
    });

    const seen: string[] = [];
    for await (const event of readSSE(stream)) seen.push(event.data);

    expect(seen).toEqual(["नमस्ते"]);
  });
});
