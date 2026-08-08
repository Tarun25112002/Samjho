import { errorResponseSchema } from "@samjho/contracts";
import type { z } from "zod";

/**
 * Browser-side calls, which go through the BFF at `/api/v1/*` rather than
 * straight to Express.
 *
 * Same-origin and relative, so there is no base URL to configure and no CORS
 * preflight — and, more importantly, no session token anywhere in this file. The
 * BFF attaches it server-side (see `app/api/v1/[...path]/route.ts`).
 *
 * Responses are parsed with the shared schema for the same reason the
 * server-side client does it: a cast would let a renamed field surface as
 * `undefined` three components away from the cause.
 */

export interface ApiFailure {
  message: string;
  /**
   * Field-level messages keyed the way a form indexes them — `parentEmail`,
   * `targetExam.session`. The API prefixes its paths with `body.`; stripping
   * that here means the form never has to know how the request was shaped.
   */
  fieldErrors: Record<string, string>;
  /** Quotable in a support conversation. */
  requestId?: string;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; failure: ApiFailure };

export async function sendJson<T extends z.ZodType>(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body: unknown,
  schema: T,
): Promise<ApiResult<z.infer<T>>> {
  let response: Response;

  try {
    response = await fetch(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // Offline, DNS failure, the tab going to sleep mid-request. Distinct from a
    // server error, and the student needs different advice for it.
    return {
      ok: false,
      failure: {
        message: "Could not reach Samjho. Check your connection and try again.",
        fieldErrors: {},
      },
    };
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    return { ok: false, failure: toFailure(payload, response.status) };
  }

  const envelope = payload as { data?: unknown } | null;
  const parsed = schema.safeParse(envelope?.data);

  if (!parsed.success) {
    return {
      ok: false,
      failure: {
        message: "Samjho replied in an unexpected format. Please try again.",
        fieldErrors: {},
      },
    };
  }

  return { ok: true, data: parsed.data };
}

function toFailure(payload: unknown, status: number): ApiFailure {
  const parsed = errorResponseSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      message: `Something went wrong (${String(status)}). Please try again.`,
      fieldErrors: {},
    };
  }

  const { message, details, requestId } = parsed.data.error;

  const fieldErrors: Record<string, string> = {};
  for (const detail of details ?? []) {
    const field = detail.path.replace(/^body\./, "");
    // First error per field wins. Zod can report several for one input and a
    // form field has room for one line.
    fieldErrors[field] ??= detail.message;
  }

  return { message, fieldErrors, requestId };
}
