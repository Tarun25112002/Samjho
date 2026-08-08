import { errorResponseSchema, type ApiError } from "@samjho/contracts";
import type { z } from "zod";

import { serverEnv } from "./env.js";

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
  const { body, headers, next, ...rest } = options;

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

  if (!response.ok) {
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
