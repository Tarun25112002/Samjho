import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import { requestContextStore } from "../lib/logger.js";

/**
 * Assigns every request an id and makes it available to all downstream code.
 *
 * The id is echoed back in the `x-request-id` response header and embedded in
 * error responses, so a student reporting "it broke" can quote a string that
 * pins the exact request in the logs.
 *
 * An inbound `x-request-id` is honoured so a trace can span web -> api.
 */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const inbound = req.headers["x-request-id"];
  const requestId = typeof inbound === "string" && inbound.length > 0 ? inbound : randomUUID();

  res.setHeader("x-request-id", requestId);

  // Everything inside this callback — including async continuations — can read
  // the context via getRequestContext().
  requestContextStore.run({ requestId }, () => {
    next();
  });
}
