/**
 * Stable, machine-readable error codes.
 *
 * These are part of the API's public contract: the web app branches on them, so
 * renaming one is a breaking change. Human-readable messages can change freely;
 * codes cannot.
 */
export const ERROR_CODES = {
  // 400
  VALIDATION_FAILED: "VALIDATION_FAILED",
  MALFORMED_REQUEST: "MALFORMED_REQUEST",
  // 401 / 403
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  // 404
  NOT_FOUND: "NOT_FOUND",
  // 409
  CONFLICT: "CONFLICT",
  DUPLICATE_SUBMISSION: "DUPLICATE_SUBMISSION",
  // 410 — the exam engine leans on this one (see docs/04-exam-engine.md)
  EXAM_EXPIRED: "EXAM_EXPIRED",
  // 429
  RATE_LIMITED: "RATE_LIMITED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  // 500 / 503
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  /**
   * Every provider in the AI fallback chain failed *and* the question had no
   * stored solution to degrade to. Distinct from SERVICE_UNAVAILABLE because
   * what the client should do differs: this is "the tutor is out, the rest of
   * the app is fine", not "come back later".
   */
  AI_UNAVAILABLE: "AI_UNAVAILABLE",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
