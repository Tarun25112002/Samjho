import { ERROR_CODES, type ErrorResponse } from "@samjho/contracts";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { isAppError } from "../lib/errors.js";
import { config } from "../lib/config.js";
import { getRequestContext, logger } from "../lib/logger.js";

/** 404 for any route that didn't match. Registered after all routes. */
export function notFoundHandler(req: Request, res: Response): void {
  const requestId = getRequestContext()?.requestId ?? "unknown";
  const body: ErrorResponse = {
    error: {
      code: ERROR_CODES.NOT_FOUND,
      message: `No route matches ${req.method} ${req.path}`,
      requestId,
    },
  };
  res.status(404).json(body);
}

/**
 * The single place where an error becomes an HTTP response.
 *
 * Express 5 forwards rejected promises from async handlers here automatically —
 * in Express 4 this needed a wrapper around every async route, and forgetting it
 * meant a silently hanging request. That fix alone justifies Express 5.
 *
 * The security-relevant rule: unknown errors never leak their message to the
 * client. An unhandled `PrismaClientKnownRequestError` can contain table and
 * column names, which is free reconnaissance for an attacker. Known operational
 * errors carry messages we wrote deliberately, so those are safe to send.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Headers already flushed (e.g. mid-stream failure) — hand back to Express,
  // which will destroy the connection. Anything else would throw.
  if (res.headersSent) {
    next(error);
    return;
  }

  const requestId = getRequestContext()?.requestId ?? "unknown";

  // Zod errors reaching here mean a schema ran outside the validate middleware.
  if (error instanceof ZodError) {
    logger.warn({ err: error }, "Unhandled validation error");
    res.status(400).json({
      error: {
        code: ERROR_CODES.VALIDATION_FAILED,
        message: "Request validation failed",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
        requestId,
      },
    } satisfies ErrorResponse);
    return;
  }

  if (isAppError(error)) {
    // 4xx is the client's problem and is expected traffic; 5xx is ours.
    const level = error.statusCode >= 500 ? "error" : "warn";
    logger[level]({ err: error, code: error.code }, error.message);

    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
        requestId,
      },
    } satisfies ErrorResponse);
    return;
  }

  // Anything reaching here is a defect. Log everything, reveal nothing.
  logger.error({ err: error }, "Unhandled error");

  res.status(500).json({
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: config.isProduction
        ? "Something went wrong on our side. Please try again."
        : error instanceof Error
          ? error.message
          : String(error),
      requestId,
    },
  } satisfies ErrorResponse);
}
