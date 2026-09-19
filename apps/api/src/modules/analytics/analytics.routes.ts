import { recordEventsSchema } from "@medhavi/contracts";
import { Router } from "express";

import { authenticated, getAuthUser } from "../../middleware/auth.js";
import { parseBody, validate } from "../../middleware/validate.js";
import type { TokenVerifier } from "../../lib/token-verifier.js";
import { analyticsService } from "./analytics.service.js";

/**
 * `/api/v1/events` — the browser's half of the learning-analytics record.
 *
 * There is no user id in the body and there is no way to put one there. The
 * subject of every event is `req.user.id`, which came from a verified token,
 * so the commonest analytics bug in a product like this — a client writing rows
 * onto somebody else's timeline — is unexpressible rather than merely guarded.
 *
 * Only four event types are reachable from here (`CLIENT_REPORTABLE_EVENTS`).
 * The rest are emitted by the services that perform the action, because an
 * event a client can assert is an event a client can invent.
 */
export function buildEventRouter(verifyToken: TokenVerifier): Router {
  const router = Router();

  router.use(authenticated(verifyToken));

  router.post("/", validate({ body: recordEventsSchema }), async (req, res) => {
    const user = getAuthUser(req);
    const input = parseBody(req, recordEventsSchema);

    const recorded = await analyticsService.recordFromClient(user.id, input);

    // 202 rather than 201: this is a report of something that already happened,
    // and some of it may have been dropped as unowned. A 201 would claim we
    // created everything that was sent.
    res.status(202).json({ data: { recorded } });
  });

  return router;
}
