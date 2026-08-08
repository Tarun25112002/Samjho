import { ERROR_CODES, type ErrorCode } from "@samjho/contracts";

/**
 * Typed application errors.
 *
 * The point of a class hierarchy here rather than ad-hoc `res.status(404).json(...)`
 * calls in handlers:
 *
 *  - A service can `throw new NotFoundError("Question")` without knowing it is
 *    being called over HTTP. Business logic stays free of transport concerns,
 *    which is what makes it unit-testable and reusable from a job or a script.
 *  - One error middleware turns any of these into the response envelope, so the
 *    shape is guaranteed consistent.
 *  - `isOperational` separates "expected failure, this is fine" from "a bug —
 *    someone should be paged".
 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: ErrorCode;

  /** True for errors we anticipated. False means an unhandled defect. */
  readonly isOperational = true;

  readonly details?: Array<{ path: string; message: string }>;

  constructor(message: string, details?: Array<{ path: string; message: string }>) {
    super(message);
    this.name = new.target.name;
    if (details) this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = ERROR_CODES.VALIDATION_FAILED;
}

export class UnauthenticatedError extends AppError {
  readonly statusCode = 401;
  readonly code = ERROR_CODES.UNAUTHENTICATED;

  constructor(message = "Authentication required") {
    super(message);
  }
}

export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly code = ERROR_CODES.FORBIDDEN;

  constructor(message = "You do not have access to this resource") {
    super(message);
  }
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = ERROR_CODES.NOT_FOUND;

  constructor(resource = "Resource") {
    super(`${resource} not found`);
  }
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = ERROR_CODES.CONFLICT;
}

export class RateLimitError extends AppError {
  readonly statusCode = 429;
  readonly code = ERROR_CODES.RATE_LIMITED;

  constructor(message = "Too many requests. Please slow down.") {
    super(message);
  }
}

export class ServiceUnavailableError extends AppError {
  readonly statusCode = 503;
  readonly code = ERROR_CODES.SERVICE_UNAVAILABLE;
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
