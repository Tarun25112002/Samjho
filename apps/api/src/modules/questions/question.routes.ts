import { listQuestionsQuerySchema } from "@samjho/contracts";
import { Router } from "express";
import { z } from "zod";

import { authenticated } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import type { TokenVerifier } from "../../lib/token-verifier.js";
import { questionService } from "./question.service.js";

/**
 * `/api/v1/questions` — read-only, student view.
 *
 * There is no answer key on either of these endpoints, in any circumstance. The
 * "reveal the answer once the student has attempted it" path belongs to the
 * practice and exam modules, because only they know whether an attempt exists —
 * and an endpoint that decided that for itself would need an `attemptId`
 * parameter that a caller could simply make up.
 *
 * Admin question management, including the answer key, is Phase 4 under
 * `/admin/questions` with its own serializer and its own role gate.
 */
export function buildQuestionRouter(verifyToken: TokenVerifier): Router {
  const router = Router();

  router.use(authenticated(verifyToken));

  router.get("/", validate({ query: listQuestionsQuerySchema }), async (req, res) => {
    const query = listQuestionsQuerySchema.parse(req.query);
    res.json({ data: await questionService.list(query) });
  });

  router.get("/:id", validate({ params: idParams }), async (req, res) => {
    const { id } = idParams.parse(req.params);
    res.json({ data: await questionService.getById(id) });
  });

  return router;
}

const idParams = z.object({ id: z.string().min(1).max(60) });
