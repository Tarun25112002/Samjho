import type { AIProviderId } from "../../../lib/config.js";

/**
 * Why a provider call failed, in the only terms the fallback chain cares about.
 *
 * The kinds are not a copy of HTTP statuses. They exist to answer one question
 * — *should the chain try the next provider?* — and a status code answers that
 * badly. A 400 from one vendor because a model id was retired is a reason to
 * try the next vendor; a client that hung up is not.
 */
export type ProviderFailureKind =
  /** Key missing, wrong, or lacking entitlement for the model. */
  | "auth"
  /** 429, or a provider-signalled quota exhaustion. */
  | "rate_limit"
  /** Nothing arrived inside the budget. Includes the first-token deadline. */
  | "timeout"
  /** The provider answered, with a 5xx or a mid-stream error event. */
  | "upstream"
  /** DNS, TLS, connection reset — we never got an answer at all. */
  | "network"
  /** The provider rejected the request as invalid (unknown model, too long). */
  | "bad_request"
  /** A 200 whose body was not the shape the API documents. */
  | "malformed"
  /** The *caller* went away. Not a provider failure at all. */
  | "aborted";

export class ProviderError extends Error {
  readonly providerId: AIProviderId;
  readonly kind: ProviderFailureKind;
  readonly status?: number;
  readonly retryAfterMs?: number;

  constructor(
    providerId: AIProviderId,
    kind: ProviderFailureKind,
    message: string,
    // Each optional is explicitly `| undefined` because this project runs with
    // `exactOptionalPropertyTypes`. Without it, callers cannot pass a value they
    // computed as `number | undefined` and must each write the same
    // conditional-spread dance around it — friction on an error path, which is
    // the worst place to put friction.
    options: {
      status?: number | undefined;
      retryAfterMs?: number | undefined;
      cause?: unknown;
    } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "ProviderError";
    this.providerId = providerId;
    this.kind = kind;
    if (options.status !== undefined) this.status = options.status;
    if (options.retryAfterMs !== undefined) this.retryAfterMs = options.retryAfterMs;
    Error.captureStackTrace?.(this, ProviderError);
  }

  /**
   * Every kind fails over except `aborted`.
   *
   * That looks permissive and is deliberate. The cost of trying the next
   * provider is one more request; the cost of *not* trying it is a student
   * staring at an error while two working providers sit idle. Even the kinds
   * that look like our fault — `bad_request`, `auth` — are usually
   * provider-specific in practice: a retired model id, a key that lost access
   * to one family of models. Those are exactly the outages a chain is for.
   *
   * `aborted` is the one real exception: the client has disconnected, so there
   * is nobody left to answer.
   */
  get shouldFailover(): boolean {
    return this.kind !== "aborted";
  }
}

/**
 * Raised when the chain is exhausted.
 *
 * Carries every underlying failure rather than just the last one, because the
 * last one is rarely the interesting one — "OpenRouter 429, Gemini timeout,
 * Grok 401" is a diagnosis, while "Grok 401" on its own sends someone to
 * investigate the wrong provider.
 */
export class AllProvidersFailedError extends Error {
  readonly failures: ProviderError[];

  constructor(failures: ProviderError[]) {
    const summary =
      failures.map((failure) => `${failure.providerId}: ${failure.kind}`).join("; ") ||
      "no providers configured";
    super(`Every AI provider failed (${summary})`);
    this.name = "AllProvidersFailedError";
    this.failures = failures;
    Error.captureStackTrace?.(this, AllProvidersFailedError);
  }
}

/**
 * Map an HTTP status onto a failure kind.
 *
 * 408 and 504 are timeouts rather than upstream errors: the distinction shows
 * up in the logs as "the provider is slow" versus "the provider is broken", and
 * those get fixed by different people.
 */
export function kindForStatus(status: number): ProviderFailureKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 408 || status === 504) return "timeout";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "upstream";
  return "bad_request";
}

/** `Retry-After` in seconds or as an HTTP date, in milliseconds. */
export function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;

  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);

  const at = Date.parse(header);
  if (Number.isNaN(at)) return undefined;

  return Math.max(0, at - Date.now());
}

/**
 * Classify a thrown value from `fetch` or from stream consumption.
 *
 * The `aborted` check reads the caller's own signal rather than the error,
 * because every abort surfaces identically as an `AbortError` regardless of who
 * pulled the trigger. Only the signal knows whether this was the client hanging
 * up or our own deadline firing.
 */
export function toProviderError(
  providerId: AIProviderId,
  error: unknown,
  callerSignal?: AbortSignal,
): ProviderError {
  if (error instanceof ProviderError) return error;

  const aborted =
    error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");

  if (aborted) {
    return callerSignal?.aborted
      ? new ProviderError(providerId, "aborted", "The client disconnected", { cause: error })
      : new ProviderError(providerId, "timeout", "The provider did not respond in time", {
          cause: error,
        });
  }

  const message = error instanceof Error ? error.message : String(error);
  return new ProviderError(providerId, "network", message, { cause: error });
}

/**
 * A short, safe description of an error response, for the exception message.
 *
 * Capped, because some gateways answer a failed API call with a kilobyte of
 * HTML error page and putting that in an exception message helps nobody. Never
 * reaches a student: the service maps provider failures onto a generic reply.
 */
export async function describeResponse(response: Response): Promise<string> {
  let detail = "";
  try {
    detail = (await response.text()).slice(0, 500);
  } catch {
    // Body already consumed or the connection dropped — the status is enough.
  }
  return `HTTP ${String(response.status)} ${response.statusText}${detail ? `: ${detail}` : ""}`;
}
