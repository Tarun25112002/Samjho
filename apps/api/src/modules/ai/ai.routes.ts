import {
  sendMessageSchema,
  startConversationSchema,
  type AIStreamEvent,
  type ErrorResponse,
} from "@samjho/contracts";
import { Router, type Response } from "express";
import { z } from "zod";

import { isAppError } from "../../lib/errors.js";
import { getRequestContext, logger } from "../../lib/logger.js";
import type { TokenVerifier } from "../../lib/token-verifier.js";
import { authenticated, getAuthUser } from "../../middleware/auth.js";
import { parseBody, validate } from "../../middleware/validate.js";
import { aiService } from "./ai.service.js";
import { aiProvider } from "./provider/registry.js";

/**
 * `/api/v1/ai` — the tutor.
 *
 * Every route is scoped to `req.user.id`, and no route accepts a user id. Same
 * rule as `/practice-sessions`: a conversation belongs to exactly one student
 * and there is no way for a caller to name a different one.
 *
 * The one structurally unusual route is the streaming send. It exists alongside
 * the buffered one rather than replacing it because SSE is not universally
 * survivable — some corporate proxies and a few Indian mobile carriers buffer
 * `text/event-stream` until the response closes, which turns a stream into a
 * slow non-stream. A client that detects this falls back to `POST /messages`
 * and gets the identical answer, because both call the same service.
 */

const idParams = z.object({ id: z.string().min(1).max(60) });

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(60).optional(),
});

/**
 * Write one SSE frame.
 *
 * Named events rather than a single `message` frame with a `type` field inside
 * it: `EventSource.addEventListener("delta", …)` is then the client's whole
 * dispatch, and a client that only cares about text never parses the rest.
 */
function sendEvent(res: Response, event: AIStreamEvent): void {
  // A newline inside `data:` would terminate the field early, so the payload is
  // JSON — which cannot contain a raw newline — rather than the text itself.
  res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

export function buildAIRouter(verifyToken: TokenVerifier): Router {
  const router = Router();

  router.use(authenticated(verifyToken));

  /**
   * Whether the tutor can answer at all, and what today's allowance looks like.
   *
   * Two facts in one call because the client needs both to decide what to
   * render, and asking twice on every question screen would double the traffic
   * for a pair of numbers that change slowly.
   */
  router.get("/status", async (req, res) => {
    const user = getAuthUser(req);
    const chain = aiProvider();

    // Which vendors are in the chain, and which of them are currently failing,
    // is operational detail — it names our suppliers and says when one of them
    // is down, neither of which is a student's business. `available` is the
    // part they need: it decides whether the panel offers a tutor or says the
    // stored solution is what is on offer today.
    const staff = user.role === "ADMIN" || user.role === "CONTENT_EDITOR";

    res.json({
      data: {
        available: chain.isAvailable,
        quota: await aiService.quota(user.id),
        ...(staff ? { providers: chain.describe() } : {}),
      },
    });
  });

  router.get("/conversations", validate({ query: listQuery }), async (req, res) => {
    const user = getAuthUser(req);
    const query = listQuery.parse(req.query);

    res.json({ data: await aiService.list(user.id, query) });
  });

  router.post("/conversations", validate({ body: startConversationSchema }), async (req, res) => {
    const user = getAuthUser(req);
    const input = parseBody(req, startConversationSchema);

    res.status(201).json({ data: await aiService.start(user.id, input) });
  });

  router.get("/conversations/:id", validate({ params: idParams }), async (req, res) => {
    const user = getAuthUser(req);
    const { id } = idParams.parse(req.params);

    res.json({ data: await aiService.get(user.id, id) });
  });

  router.post("/conversations/:id/archive", validate({ params: idParams }), async (req, res) => {
    const user = getAuthUser(req);
    const { id } = idParams.parse(req.params);

    res.json({ data: await aiService.archive(user.id, id) });
  });

  /** The buffered turn. Same answer as the stream, all at once. */
  router.post(
    "/conversations/:id/messages",
    validate({ params: idParams, body: sendMessageSchema }),
    async (req, res) => {
      const user = getAuthUser(req);
      const { id } = idParams.parse(req.params);
      const input = parseBody(req, sendMessageSchema);

      res.json({ data: await aiService.send(user.id, id, input) });
    },
  );

  /**
   * The streamed turn.
   *
   * POST rather than GET, which rules out `EventSource` and obliges the client
   * to read the stream through `fetch`. That is the right trade: the request
   * carries a body and an `Authorization` header, and `EventSource` can send
   * neither — the alternatives are a query-string action and a token in the URL,
   * and a token in a URL ends up in access logs.
   *
   * Errors split at the headers. Nothing has been written when the guards run,
   * so a rejected action or a live exam is still an ordinary JSON 4xx from the
   * error handler. Once the first frame is out the status line is spent, and a
   * failure can only be an `error` event inside the stream.
   */
  router.post(
    "/conversations/:id/messages/stream",
    validate({ params: idParams, body: sendMessageSchema }),
    async (req, res, next) => {
      const user = getAuthUser(req);
      const { id } = idParams.parse(req.params);
      const input = parseBody(req, sendMessageSchema);

      // Aborted when the client disconnects, and threaded down to the provider
      // so a closed tab stops the upstream request rather than paying for
      // tokens nobody will read.
      const controller = new AbortController();
      res.on("close", () => controller.abort());

      const events = aiService
        .stream(user.id, id, input, controller.signal)
        [Symbol.asyncIterator]();

      // The first event is pulled *before* any header is written, so that a
      // guard failure inside `prepare` can still become a proper JSON error
      // response instead of a 200 containing an apology.
      let first;
      try {
        first = await events.next();
      } catch (error) {
        next(error);
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        // Nginx buffers proxied responses by default, which would hold the
        // whole stream until it ended. This is the documented opt-out.
        "X-Accel-Buffering": "no",
      });
      res.flushHeaders?.();

      try {
        if (!first.done) sendEvent(res, first.value);

        for (let next = await events.next(); !next.done; next = await events.next()) {
          sendEvent(res, next.value);
        }
      } catch (error) {
        // Past the headers: the only channel left is the stream itself.
        logger.error({ err: error, conversationId: id }, "AI stream aborted");

        const requestId = getRequestContext()?.requestId ?? "unknown";
        const body: ErrorResponse["error"] = isAppError(error)
          ? { code: error.code, message: error.message, requestId }
          : { code: "INTERNAL_ERROR", message: "The tutor stopped unexpectedly.", requestId };

        if (!res.writableEnded) {
          sendEvent(res, { type: "error", code: body.code, message: body.message });
        }
      } finally {
        // Tell the generator nobody is listening any more, so its `finally`
        // blocks run and the provider connection is released.
        await events.return?.(undefined);
        if (!res.writableEnded) res.end();
      }
    },
  );

  return router;
}
