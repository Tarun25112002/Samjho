import { config, type AIProviderId } from "../../../lib/config.js";
import { logger } from "../../../lib/logger.js";
import { AllProvidersFailedError, toProviderError, type ProviderError } from "./errors.js";
import { FallbackChainProvider } from "./fallback.js";
import { createGeminiProvider } from "./gemini.js";
import { createOpenAICompatibleProvider } from "./openai-compatible.js";
import type { AIProvider, ChatRequest, CompletionResponse } from "./types.js";

/**
 * Which providers this process actually has, in configured order.
 *
 * ## Why a keyless provider is dropped rather than fatal
 *
 * The config file is explicit: an instance with no provider keys must still
 * boot. A demo, a CI run and a cost freeze are all legitimate deployments —
 * and unlike a missing Clerk key, which would mean answering requests we cannot
 * authorize, a missing model key means one feature declines and says so.
 *
 * It is logged at `warn`, once, at startup. A chain that is quietly one
 * provider long is something to find out about *before* the primary goes down.
 *
 * ## Why the chain is built lazily and then cached
 *
 * `config` is read at module load, but tests want to rebuild the chain after
 * changing it, and the readiness endpoint wants to describe it without
 * constructing one per request. Lazy plus a reset seam gives both.
 */

let cached: FallbackChainProvider | null = null;

function build(id: AIProviderId): AIProvider | null {
  if (id === "openrouter") {
    const settings = config.ai.openrouter;
    if (!settings.apiKey) return null;

    return createOpenAICompatibleProvider({
      id: "openrouter",
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      strongModel: settings.strongModel,
      fastModel: settings.fastModel,
      // OpenRouter proxies to models that read PDFs natively, and supplies a
      // parser plugin for those that do not.
      capabilities: { structuredOutput: true, images: true, documents: true },
      attribution: { siteUrl: config.ai.siteUrl, siteName: config.ai.siteName },
    });
  }

  if (id === "gemini") {
    const settings = config.ai.gemini;
    if (!settings.apiKey) return null;

    return createGeminiProvider({
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      strongModel: settings.strongModel,
      fastModel: settings.fastModel,
    });
  }

  const settings = config.ai.grok;
  if (!settings.apiKey) return null;

  return createOpenAICompatibleProvider({
    id: "grok",
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl,
    strongModel: settings.strongModel,
    fastModel: settings.fastModel,
    // Grok reads images but has no document input. Declared honestly so the
    // router never sends it a PDF — rather than sending one and receiving a
    // confident answer about a file it could not see.
    capabilities: { structuredOutput: true, images: true, documents: false },
  });
}

export function aiProvider(): FallbackChainProvider {
  if (cached) return cached;

  const providers: AIProvider[] = [];
  const skipped: AIProviderId[] = [];

  for (const id of config.ai.chain) {
    const provider = build(id);
    if (provider) providers.push(provider);
    else skipped.push(id);
  }

  if (skipped.length > 0) {
    logger.warn(
      { skipped, active: providers.map((provider) => provider.id) },
      "AI providers without an API key were dropped from the chain",
    );
  }

  if (providers.length === 0) {
    logger.warn(
      "No AI provider is configured. Features that need one will decline rather than fail.",
    );
  }

  cached = new FallbackChainProvider(providers, {
    requestTimeoutMs: config.ai.requestTimeoutMs,
    firstTokenTimeoutMs: config.ai.firstTokenTimeoutMs,
    cooldownMs: config.ai.providerCooldownMs,
  });

  return cached;
}

/** Whether any provider has credentials. Callers degrade rather than throw. */
export function aiIsConfigured(): boolean {
  return aiProvider().isAvailable;
}

export interface CompletionNeeds {
  /** The input includes a PDF; skip providers that cannot read one. */
  documents?: boolean;
  /** The input includes an image; skip providers that cannot read one. */
  images?: boolean;
}

/**
 * One non-streaming completion, against the chain.
 *
 * Separate from `FallbackChainProvider.streamChat` rather than layered on it,
 * because the two want different failover rules and the difference is not
 * cosmetic. Streaming commits at the first token — past that point a second
 * provider cannot take over without splicing two models' half-sentences
 * together. A single JSON document has no such instant: nothing has been shown
 * to anybody until the whole thing parses, so *every* failure here can fail
 * over, right up to the last provider in the chain.
 *
 * The capability filter is a filter and not a sort, unlike the chain's own
 * cooldown ordering. A provider that cannot read PDFs will not read this PDF in
 * thirty seconds either; that is a fact about the request, not a transient
 * state to be demoted for.
 */
export async function completeWithChain(
  request: ChatRequest,
  needs: CompletionNeeds = {},
): Promise<CompletionResponse & { provider: AIProviderId }> {
  const chain = aiProvider();

  const candidates = chain.providers.filter((provider) => {
    if (needs.documents === true && !provider.capabilities.documents) return false;
    if (needs.images === true && !provider.capabilities.images) return false;
    return true;
  });

  if (candidates.length === 0) {
    // Distinguished from "everything failed" because the fix is different: this
    // one is a configuration answer, not a retry.
    throw new AllProvidersFailedError([]);
  }

  const failures: ProviderError[] = [];

  for (const provider of candidates) {
    const startedAt = Date.now();

    try {
      const response = await provider.complete(request);
      if (failures.length > 0) {
        logger.info(
          { provider: provider.id, afterFailures: failures.length },
          "AI completion served by a fallback provider",
        );
      }
      return { ...response, provider: provider.id };
    } catch (error) {
      const failure = toProviderError(provider.id, error, request.signal);

      // The caller hung up. Nobody is waiting for an answer, so trying two more
      // providers would be two more bills for output that is discarded.
      if (!failure.shouldFailover) throw failure;

      failures.push(failure);
      logger.warn(
        {
          provider: provider.id,
          kind: failure.kind,
          status: failure.status,
          elapsedMs: Date.now() - startedAt,
        },
        "AI completion failed; falling through the chain",
      );
    }
  }

  throw new AllProvidersFailedError(failures);
}

/** Test seam: forget the built chain, including every open circuit breaker. */
export function resetAIProvider(): void {
  cached = null;
}

/**
 * Test seam: install a chain built from fakes.
 *
 * Preferred over mocking this module wholesale, because a `vi.mock` of the
 * registry also replaces `FallbackChainProvider` — and then the tests that
 * think they are exercising failover are exercising the mock. Injecting a real
 * chain over fake *providers* keeps the code under test in the test.
 */
export function setAIProvider(chain: FallbackChainProvider): void {
  cached = chain;
}
