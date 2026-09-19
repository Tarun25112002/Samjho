import { startAssessmentSchema } from "@medhavi/contracts";
import { Router } from "express";
import { z } from "zod";

import { authenticated, getAuthUser } from "../../middleware/auth.js";
import { parseBody, validate } from "../../middleware/validate.js";
import type { TokenVerifier } from "../../lib/token-verifier.js";
import { assessmentService } from "./assessment.service.js";

export function buildAssessmentRouter(verifyToken: TokenVerifier): Router {
  const router = Router();

  router.use(authenticated(verifyToken));

  router.get("/diagnostics", async (req, res) => {
    const user = getAuthUser(req);
    res.json({ data: await assessmentService.diagnostics(user.id) });
  });

  router.post("/plan", validate({ body: startAssessmentSchema }), async (req, res) => {
    const user = getAuthUser(req);
    const input = parseBody(req, startAssessmentSchema);

    res.json({ data: await assessmentService.plan(user.id, input) });
  });

  router.post("/", validate({ body: startAssessmentSchema }), async (req, res) => {
    const user = getAuthUser(req);
    const input = parseBody(req, startAssessmentSchema);

    res.status(201).json({ data: await assessmentService.start(user.id, input) });
  });

  router.post("/:id/next-question", validate({ params: idParams }), async (req, res) => {
    const user = getAuthUser(req);
    const { id } = idParams.parse(req.params);

    res.json({ data: await assessmentService.next(user.id, id) });
  });

  router.post("/:id/hint", validate({ params: idParams, body: hintBody }), async (req, res) => {
    const user = getAuthUser(req);
    const { id } = idParams.parse(req.params);
    const { questionId } = parseBody(req, hintBody);

    res.json({ data: await assessmentService.hint(user.id, id, questionId) });
  });

  return router;
}

const idParams = z.object({ id: z.string().min(1).max(60) });
const hintBody = z.object({ questionId: z.string().min(1).max(60) });
