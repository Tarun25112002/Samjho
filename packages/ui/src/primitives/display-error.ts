/**
 * The only way to get an error onto a student's screen.
 *
 * `docs/01` §8 says the error state is "plain language + retry + a support
 * reference id. Never a raw error string." Enforcing that with discipline fails
 * the first time someone writes `<DataState error={{ message: err.message }}>`
 * and ships `Response from /catalog/subjects did not match the expected
 * contract` to a fifteen-year-old.
 *
 * So the rule is structural instead: `DataState` takes a `DisplayError`, and the
 * one way to build a `DisplayError` from something you caught is `describeError`,
 * which decides what is safe to show.
 *
 * The decision it makes is worth understanding. A message is only shown verbatim
 * when it arrives with a `requestId` — because that means it came out of the
 * API's own error envelope, which is written by us, for humans, and is already
 * plain language. Anything else (a thrown `TypeError` from `fetch`, a Zod parse
 * failure, a bug) gets a generic sentence, and the real text goes to the console
 * where an engineer will find it. Nothing internal reaches the page by accident,
 * because nothing internal is on the trusted path.
 */

export interface DisplayError {
  /** Plain language, safe to render. */
  message: string;
  /** The API's `requestId`, when the failure came from the API. */
  requestId?: string;
  /** Whether offering "Try again" is honest. A 404 is not going to fix itself. */
  retryable: boolean;
}

const GENERIC =
  "Something went wrong at our end. It is not something you did — please try again in a moment.";

const OFFLINE = "We could not reach Samjho. Check your connection and try again.";

const NOT_FOUND = "We could not find that. It may have been moved or renamed.";

const UNAUTHENTICATED = "Your session has expired. Please sign in again.";

interface ApiShapedError {
  message: string;
  requestId: string;
  status?: number;
}

/**
 * Duck-typed rather than `instanceof`.
 *
 * `packages/ui` must not import from `apps/web` — that would invert the
 * dependency and make the shared package app-specific (docs/02 §2). Checking the
 * shape keeps the seam intact and works for anything that carries the API's
 * error contract, including whatever the admin app throws later.
 */
function asApiError(value: unknown): ApiShapedError | null {
  if (typeof value !== "object" || value === null) return null;

  const candidate = value as Record<string, unknown>;
  const { message, requestId, status } = candidate;

  if (typeof message !== "string" || message.length === 0) return null;
  if (typeof requestId !== "string" || requestId.length === 0) return null;

  return {
    message,
    requestId,
    ...(typeof status === "number" ? { status } : {}),
  };
}

/** 4xx is the caller's problem and will not change on a retry; 408 and 429 will. */
function isRetryableStatus(status: number | undefined): boolean {
  if (status === undefined) return true;
  if (status === 408 || status === 429) return true;
  return status >= 500;
}

export function describeError(error: unknown): DisplayError {
  const apiError = asApiError(error);

  if (apiError) {
    if (apiError.status === 401) {
      return { message: UNAUTHENTICATED, requestId: apiError.requestId, retryable: false };
    }
    if (apiError.status === 404) {
      return { message: NOT_FOUND, requestId: apiError.requestId, retryable: false };
    }
    return {
      message: apiError.message,
      requestId: apiError.requestId,
      retryable: isRetryableStatus(apiError.status),
    };
  }

  // `fetch` rejects with a TypeError when the request never reached the network:
  // aeroplane mode, captive portal, DNS failure. Telling a student "check your
  // connection" is both true and actionable; telling them "Failed to fetch" is
  // neither.
  if (error instanceof TypeError) {
    return { message: OFFLINE, retryable: true };
  }

  return { message: GENERIC, retryable: true };
}
