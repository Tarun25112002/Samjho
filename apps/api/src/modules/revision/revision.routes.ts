import { startRevisionSchema } from "@medhavi/contracts";
import { Router } from "express";

import type { TokenVerifier } from "../../lib/token-verifier.js";
import { authenticated, getAuthUser, requireRole } from "../../middleware/auth.js";
import { parseBody, validate } from "../../middleware/validate.js";
import { revisionService } from "./revision.service.js";

/**
 * `/api/v1/revision` — the student's spaced-repetition queue.
 *
 * Student-only and student-owned, on the same terms as `/progress` and
 * `/practice-sessions`: the user id comes from the verified token and goes into
 * the `WHERE`, and no route here accepts one from the caller. There is no
 * teacher or admin view of a student's queue, deliberately — what a student has
 * personally failed to retain, and how often, is the most intimate data this
 * product holds, and the teacher-facing answer to the same question is the
 * class-level aggregate in `diagnostics.service.ts`.
 */
export function buildRevisionRouter(verifyToken: TokenVerifier): Router {
  const router = Router();

  router.use(authenticated(verifyToken));
  router.use(requireRole("STUDENT"));

  router.get("/", async (req, res) => {
    const user = getAuthUser(req);
    res.json({ data: await revisionService.queue(user.id) });
  });

  router.post("/sessions", validate({ body: startRevisionSchema }), async (req, res) => {
    const user = getAuthUser(req);
    const input = parseBody(req, startRevisionSchema);

    // 201, and the body is the session itself rather than an id: the client
    // navigates straight into the runner, and a second round trip to fetch what
    // was just created is a round trip on the slowest connection in the product.
    res.status(201).json({ data: await revisionService.startReview(user.id, input) });
  });

  return router;
}
