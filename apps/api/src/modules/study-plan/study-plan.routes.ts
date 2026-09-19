import { Router } from "express";

import type { TokenVerifier } from "../../lib/token-verifier.js";
import { authenticated, getAuthUser, requireRole } from "../../middleware/auth.js";
import { studyPlanService } from "./study-plan.service.js";
import { studyWeekService } from "./study-plan.week.service.js";

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

  /**
   * The week ahead.
   *
   * Separate from `/today` rather than a shape it can return, because they
   * answer different questions: `/today` is "what do I do now" and is one item
   * long on purpose, while a week is read to find out whether the shape of the
   * next seven days adds up.
   */
  router.get("/week", async (req, res) => {
    const user = getAuthUser(req);
    res.json({ data: await studyWeekService.week(user.id) });
  });

  return router;
}
