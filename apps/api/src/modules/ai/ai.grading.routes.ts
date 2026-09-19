import { confirmGradingSchema, requestGradingSchema } from "@medhavi/contracts";
import { Router } from "express";
import { z } from "zod";

import { authenticated, getAuthUser, requireRole } from "../../middleware/auth.js";
import { parseBody, validate } from "../../middleware/validate.js";
import type { TokenVerifier } from "../../lib/token-verifier.js";
import { aiGradingService } from "./ai.grading.service.js";

/**
 * `/api/v1/ai/grading` — AI-assisted marking of written answers.
 *
 * Addressed by attempt id, and the attempt is always looked up with the
 * caller's own user id in the `WHERE`. There is no path here that reaches
 * somebody else's answer, and no path that writes a mark the student did not
 * send.
 *
 * `/agreement` is staff-only. It reports how often the grader and students
 * agree, which is a fact about the product rather than about anyone's revision
 * — and it is the evidence docs/07 R3 requires before AI grading could ever be
 * promoted beyond assistive.
 */
export function buildAIGradingRouter(verifyToken: TokenVerifier): Router {
  const router = Router();

  router.use(authenticated(verifyToken));

  router.get("/agreement", requireRole("ADMIN", "CONTENT_EDITOR"), async (_req, res) => {
    res.json({ data: await aiGradingService.agreement() });
  });

  router.post(
    "/:attemptId",
    validate({ params: attemptParams, body: requestGradingSchema }),
    async (req, res) => {
      const user = getAuthUser(req);
      const { attemptId } = attemptParams.parse(req.params);
      const input = parseBody(req, requestGradingSchema);

      res.json({ data: await aiGradingService.suggest(user.id, attemptId, input) });
    },
  );

  router.post(
    "/:attemptId/confirm",
    validate({ params: attemptParams, body: confirmGradingSchema }),
    async (req, res) => {
      const user = getAuthUser(req);
      const { attemptId } = attemptParams.parse(req.params);
      const input = parseBody(req, confirmGradingSchema);

      res.json({ data: await aiGradingService.confirm(user.id, attemptId, input) });
    },
  );

  return router;
}

const attemptParams = z.object({ attemptId: z.string().min(1).max(60) });
