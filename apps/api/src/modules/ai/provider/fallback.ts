import type { AIProviderId } from "../../../lib/config.js";
import { logger } from "../../../lib/logger.js";
import { AllProvidersFailedError, ProviderError, toProviderError } from "./errors.js";
import type { AIProvider, ChatChunk, ChatRequest } from "./types.js";

/**
 * An ordered chain of providers, tried until one answers.
 *
 * ## The rule that shapes everything else: failover ends at the first token
 *
 * Streaming and failover are in direct tension. Once a single character has
 * been written to the student's screen, switching providers is no longer
 * transparent — the alternatives are to abandon the text already shown, or to
 * splice a second model's continuation onto a first model's half-sentence.
 * Both are worse than surfacing the error.
 *
 * So the chain commits to a provider the moment that provider produces its
 * first text chunk. Before that instant, any failure moves to the next
 * candidate and the student sees nothing. After it, a failure is a failure. The
 * `committed` flag below is the whole mechanism, and every other decision here
 * follows from wanting that instant to arrive early and honestly.
 *
 * ## Which is why the first-token deadline exists
 *
 * A provider that will answer in thirty seconds has, almost always, started
 * answering within ten. Waiting out a full request timeout on each of three
 * providers turns one slow provider into a two-minute page — the chain would
 * add latency in exactly the situation it exists to remove it from. The
 * first-token deadline (`AI_FIRST_TOKEN_TIMEOUT_MS`) is therefore separate from
 * and much shorter than the overall request timeout, and it is the deadline
 * that actually governs failover.
 *
 * ## And why there is a circuit breaker
 *
 * Without one, a hard-down primary is tried — and waited on — by every single
 * request. The chain would faithfully route around the outage while still
 * paying the timeout for it each time, converting "one provider is down" into
 * "everything is twelve seconds slower". After a failure a provider is moved to
 * the back of the order for a cooling-off period that grows with consecutive
 * failures. It is never removed outright: a chain that has excluded every
 * provider must still try one, because a provider that is cooling down and a
 * provider that is broken are not the same thing, and the only way to find out
 * is to ask.
 */
export interface FallbackChainOptions {
  /** Overall ceiling for one provider attempt, streaming included. */
  requestTimeoutMs: number;
  /** How long a provider gets to produce its first token before we move on. */
  firstTokenTimeoutMs: number;
  /** Base cooling-off period after a failure. Doubles per consecutive failure. */
  cooldownMs: number;
}

interface BreakerState {
  openUntil: number;
  consecutiveFailures: number;
}

/** Growth cap on the cooldown. Eight times a minute is long enough. */
const MAX_BACKOFF_MULTIPLIER = 8;

export class FallbackChainProvider {
  private readonly breakers = new Map<AIProviderId, BreakerState>();

  constructor(
    /** In configured order. May legitimately be empty — see `isAvailable`. */
    readonly providers: readonly AIProvider[],
    private readonly options: FallbackChainOptions,
  ) {}

  /**
   * False when no provider has credentials.
   *
   * A deployment can run this way on purpose — a demo, a CI run, a cost freeze
   * — and the tutor then degrades to the stored solution for every request
   * rather than erroring. The service checks this before doing any of the work
   * that only makes sense if a model is going to be called.
   */
  get isAvailable(): boolean {
    return this.providers.length > 0;
  }

  /** For the readiness endpoint and boot logs: who is in the chain, in order. */
  describe(): Array<{ id: AIProviderId; healthy: boolean }> {
    const now = Date.now();
    return this.providers.map((provider) => ({
      id: provider.id,
      healthy: (this.breakers.get(provider.id)?.openUntil ?? 0) <= now,
    }));
  }

  /**
   * Prompt size, from whichever provider is currently first in line.
   *
   * Deliberately not the maximum across providers. This number is used to trim
   * conversation history to a budget, and the budget is approximate on both
   * sides — querying three tokenizers to pick the largest would triple the cost
   * of the estimate to refine a figure that is then compared against a
   * round number.
   */
  async countTokens(
    request: Pick<ChatRequest, "system" | "messages" | "tier" | "model">,
  ): Promise<number> {
    const [first] = this.orderCandidates();
    if (!first) return 0;
    return first.countTokens(request);
  }

  /**
   * Stream a completion, falling through the chain until one provider commits.
   *
   * The `done` chunk's `model` comes back prefixed with the provider that
   * served it — `"gemini:gemini-2.5-flash"` — because with a chain in play,
   * "which model answered" is only half the question anyone actually has.
   */
  async *streamChat(request: ChatRequest): AsyncIterable<ChatChunk> {
    if (!this.isAvailable) throw new AllProvidersFailedError([]);

    const candidates = this.orderCandidates();
    const failures: ProviderError[] = [];

    for (const [index, provider] of candidates.entries()) {
      const isLast = index === candidates.length - 1;
      const startedAt = Date.now();
      let committed = false;

      try {
        for await (const chunk of this.attempt(provider, request)) {
          if (chunk.type === "text" && !committed) {
            committed = true;
            this.recordSuccess(provider.id, Date.now() - startedAt, index);
          }

          yield chunk.type === "done"
            ? { ...chunk, model: `${provider.id}:${chunk.model}` }
            : chunk;
        }

        if (!committed) {
          // A clean 200 that streamed no text at all. Rare, and always a
          // problem: an empty tutor reply is indistinguishable from a broken
          // one to the student, so it is treated as a failure and failed over
          // rather than shown.
          throw new ProviderError(provider.id, "malformed", "Provider produced no output");
        }

        return;
      } catch (error) {
        const failure = toProviderError(provider.id, error, request.signal);

        if (committed) {
          // Past the point of no return: the student is already reading this
          // provider's answer. Log it and let the service persist the partial.
          logger.warn(
            { provider: provider.id, kind: failure.kind, err: failure },
            "AI stream failed after output had started; cannot fail over",
          );
          throw failure;
        }

        if (!failure.shouldFailover) throw failure;

        this.recordFailure(provider.id, failure);
        failures.push(failure);

        logger.warn(
          {
            provider: provider.id,
            kind: failure.kind,
            status: failure.status,
            elapsedMs: Date.now() - startedAt,
            next: isLast ? null : candidates[index + 1]?.id,
          },
          "AI provider failed; falling through the chain",
        );
      }
    }

    throw new AllProvidersFailedError(failures);
  }

  /**
   * One provider attempt, under two deadlines.
   *
   * The two timers share one AbortController, so the provider only ever sees a
   * single signal — but which timer fired has to be remembered separately,
   * because an abort looks identical from the far side whoever triggered it.
   * Without `expiry`, a first-token timeout would be reported as the client
   * having disconnected, and `shouldFailover` would then refuse to fail over on
   * precisely the failure this class exists to handle.
   */
  private async *attempt(provider: AIProvider, request: ChatRequest): AsyncIterable<ChatChunk> {
    const controller = new AbortController();
    let expiry: "first-token" | "request" | null = null;

    const abortFromCaller = () => controller.abort();
    request.signal?.addEventListener("abort", abortFromCaller, { once: true });

    const firstTokenTimer = setTimeout(() => {
      expiry = "first-token";
      controller.abort();
    }, this.options.firstTokenTimeoutMs);

    const requestTimer = setTimeout(() => {
      expiry ??= "request";
      controller.abort();
    }, this.options.requestTimeoutMs);

    try {
      for await (const chunk of provider.streamChat({ ...request, signal: controller.signal })) {
        // The first token is what the short deadline was guarding. Everything
        // after it is covered by the overall request timeout, which is right:
        // a long answer is not a stalled one.
        if (chunk.type === "text") clearTimeout(firstTokenTimer);
        yield chunk;
      }
    } catch (error) {
      if (expiry !== null) {
        const budget =
          expiry === "first-token"
            ? this.options.firstTokenTimeoutMs
            : this.options.requestTimeoutMs;
        throw new ProviderError(
          provider.id,
          "timeout",
          expiry === "first-token"
            ? `No first token within ${budget}ms`
            : `Response incomplete after ${budget}ms`,
          { cause: error },
        );
      }
      throw error;
    } finally {
      clearTimeout(firstTokenTimer);
      clearTimeout(requestTimer);
      request.signal?.removeEventListener("abort", abortFromCaller);
    }
  }

  /**
   * Configured order, with cooling-down providers demoted rather than dropped.
   *
   * Every provider stays in the list. Demotion costs a failing provider its
   * place at the front; exclusion would mean that a period where all three
   * happened to be cooling down produced a hard failure while all three were
   * quite possibly healthy again.
   */
  private orderCandidates(): AIProvider[] {
    const now = Date.now();
    const healthy: AIProvider[] = [];
    const cooling: AIProvider[] = [];

    for (const provider of this.providers) {
      const breaker = this.breakers.get(provider.id);
      if (breaker && breaker.openUntil > now) cooling.push(provider);
      else healthy.push(provider);
    }

    return [...healthy, ...cooling];
  }

  private recordSuccess(id: AIProviderId, latencyMs: number, position: number): void {
    if (this.breakers.delete(id)) {
      logger.info({ provider: id }, "AI provider recovered");
    }

    if (position > 0) {
      // Worth an info line: a request served from position 2 succeeded, but the
      // student waited for a failure first. A run of these is the signal that
      // the primary needs attention, and it is invisible in error rates.
      logger.info(
        { provider: id, position, latencyMs },
        "AI request served by a fallback provider",
      );
    }
  }

  private recordFailure(id: AIProviderId, failure: ProviderError): void {
    const previous = this.breakers.get(id);
    const consecutiveFailures = (previous?.consecutiveFailures ?? 0) + 1;

    const multiplier = Math.min(2 ** (consecutiveFailures - 1), MAX_BACKOFF_MULTIPLIER);
    // A provider that told us when to come back knows better than our backoff
    // curve does. 429s carry that, and ignoring it earns another 429.
    const cooldown = Math.max(this.options.cooldownMs * multiplier, failure.retryAfterMs ?? 0);

    this.breakers.set(id, { openUntil: Date.now() + cooldown, consecutiveFailures });
  }
}
