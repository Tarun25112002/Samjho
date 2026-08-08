import { z } from "zod";

/**
 * Every API response uses one of exactly two shapes.
 *
 * Consistency here is what lets the web app have a single error handler and a
 * single response unwrapper, instead of per-endpoint special cases.
 */

export const apiErrorSchema = z.object({
  /** Stable machine-readable code — branch on this, not on `message`. */
  code: z.string(),
  /** Human-readable, safe to show a student. Never contains internals. */
  message: z.string(),
  /** Field-level detail, present on validation failures. */
  details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  /** Correlates with server logs. A student can quote this to support. */
  requestId: z.string(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const errorResponseSchema = z.object({ error: apiErrorSchema });
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/**
 * Wraps a payload schema in the success envelope.
 *
 * Generic over the inner schema so `successResponseSchema(healthSchema)` gives
 * back a fully-typed `{ data: Health }` — no casts, no `any`.
 */
export function successResponseSchema<T extends z.ZodType>(data: T) {
  return z.object({ data });
}

export type SuccessResponse<T> = { data: T };
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;
