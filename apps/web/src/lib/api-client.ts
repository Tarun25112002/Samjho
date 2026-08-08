import { auth } from "@clerk/nextjs/server";
import { errorResponseSchema, type ApiError } from "@samjho/contracts";
import type { z } from "zod";

// No `.js` extension here, unlike apps/api. The web app resolves modules the
// bundler way; the API uses Node's `nodenext`, which requires explicit
// extensions on relative imports. Same language, two resolution modes — worth
// knowing which app you're in.
import { serverEnv } from "./env";

/**
 * Typed client for the Express API.
 *
 * The design decision worth understanding: every response is *parsed* with the
 * shared Zod schema, not cast with `as`.
 *
 * A cast is a lie the compiler agrees to believe. `await res.json() as Health`
 * gives a `Health`-shaped type over whatever the server actually sent — so a
 * renamed field surfaces as `undefined` in a component, three layers from the
 * cause. Parsing turns that into an immediate, precise error at the boundary.
 *
 * This is the payoff for `packages/contracts`: one schema definition validates
 * on the server and again on arrival, and the type falls out of it for free.
 */

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly apiError: ApiError,
  ) {
    super(apiError.message);
    this.name = "ApiClientError";
  }

  /** The id to quote in a support conversation. */
  get requestId(): string {
    return this.apiError.requestId;
  }
}

export class ApiParseError extends Error {
  constructor(
    readonly path: string,
    readonly issues: z.ZodError,
  ) {
    super(`Response from ${path} did not match the expected contract`);
    this.name = "ApiParseError";
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Next.js fetch cache options; server-side calls only. */
  next?: { revalidate?: number; tags?: string[] };
  /**
   * Non-2xx statuses whose body should still be parsed as a success envelope.
   *
   * Needed because a few endpoints use the status code to signal something to
   * infrastructure while still returning a meaningful payload. `/ready` is the
   * example: it answers 503 so an orchestrator pulls the instance out of the
   * load balancer, but the body describes *which* dependency is down — which is
   * exactly what a human wants to read.
   */
  allowStatuses?: number[];
}

/**
 * Server-side fetch. Returns the unwrapped `data` payload.
 *
 * `schema` describes the *inner* payload — the envelope is handled here so no
 * caller has to think about it.
 */
export async function apiFetch<T extends z.ZodType>(
  path: string,
  schema: T,
  options: RequestOptions = {},
): Promise<z.infer<T>> {
  const { body, headers, next, allowStatuses, ...rest } = options;

  const response = await fetch(`${serverEnv.API_URL}${path}`, {
    ...rest,
    ...(next ? { next } : {}),
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok && !allowStatuses?.includes(response.status)) {
    const parsedError = errorResponseSchema.safeParse(payload);
    throw new ApiClientError(
      response.status,
      parsedError.success
        ? parsedError.data.error
        : {
            code: "INTERNAL_ERROR",
            message: `Request to ${path} failed with status ${response.status}`,
            requestId: response.headers.get("x-request-id") ?? "unknown",
          },
    );
  }

  const envelope = payload as { data?: unknown } | null;
  const parsed = schema.safeParse(envelope?.data);

  if (!parsed.success) {
    throw new ApiParseError(path, parsed.error);
  }

  return parsed.data;
}

/**
 * Server-side fetch carrying the signed-in user's Clerk token.
 *
 * Server Components only — `auth()` reads the request context, which does not
 * exist in the browser. Client Components reach the API through the BFF route
 * handler at `/api/v1/*` instead, so a token never has to be handled in
 * client-side JavaScript at all.
 *
 * The token is fetched per call rather than cached. Clerk session tokens live
 * about a minute and `getToken()` refreshes transparently; holding one across
 * requests would eventually forward an expired token and produce a 401 that
 * looks like a bug in the API.
 */
export async function apiFetchAuthed<T extends z.ZodType>(
  path: string,
  schema: T,
  options: RequestOptions = {},
): Promise<z.infer<T>> {
  const { getToken } = await auth();
  const token = await getToken();

  if (token === null) {
    // Reachable when a session expires between the route guard and the fetch.
    // Throwing the same shape as any other API failure keeps callers from
    // needing a special case for it.
    throw new ApiClientError(401, {
      code: "UNAUTHENTICATED",
      message: "Your session has expired. Please sign in again.",
      requestId: "client",
    });
  }

  return apiFetch(path, schema, {
    ...options,
    headers: { ...options.headers, authorization: `Bearer ${token}` },
  });
}
