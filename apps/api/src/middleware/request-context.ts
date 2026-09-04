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
 * An inbound `x-request-id` is honoured so a trace can span web -> api — but
 * only if it looks like an id. The header is attacker-controlled: it arrives
 * from the browser, through the BFF, to here. An unchecked value goes straight
 * into structured logs and into a response body, which is how a caller writes
 * newlines into your log file and forges entries that look like someone else's
 * request. A conservative character class and a length cap cost nothing and
 * close that off; anything failing it gets a fresh id rather than an error,
 * because a malformed trace header is not worth failing a request over.
 */
const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const inbound = req.headers["x-request-id"];
  const requestId =
    typeof inbound === "string" && SAFE_REQUEST_ID.test(inbound) ? inbound : randomUUID();

  res.setHeader("x-request-id", requestId);

  // Everything inside this callback — including async continuations — can read
  // the context via getRequestContext().
  requestContextStore.run({ requestId }, () => {
    next();
  });
}
