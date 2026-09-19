import { Router } from "express";

import type { TokenVerifier } from "../../lib/token-verifier.js";
import { authenticated, getAuthUser, requireRole } from "../../middleware/auth.js";
import { studyPlanService } from "./study-plan.service.js";

/**
 * `/api/v1/study-plan` — a student's private, computed next-step view.
 *
 * This has its own student-only router rather than piggybacking on progress or
 * revision. The plan combines those read models, but it must never make a
 * teacher-facing path capable of reading a student's private schedule.
 */
export function buildStudyPlanRouter(verifyToken: TokenVerifier): Router {
  const router = Router();

  router.use(authenticated(verifyToken));
  router.use(requireRole("STUDENT"));

  router.get("/today", async (req, res) => {
    const user = getAuthUser(req);
    res.json({ data: await studyPlanService.today(user.id) });
  });

  return router;
}
