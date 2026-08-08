import type { AdminContentStats } from "@samjho/contracts";
import { Router } from "express";

import { authenticated, requireRole } from "../../middleware/auth.js";
import type { TokenVerifier } from "../../lib/token-verifier.js";
import { questionStatsService } from "./question.stats.service.js";

/**
 * `/api/v1/admin/dashboard` — the content team's front page.
 *
 * A separate mount rather than `GET /admin/questions/stats`, because Express
 * matches routes in order and `stats` sitting next to `:id` is a collision
 * waiting for the day someone reorders the file. A distinct prefix cannot be
 * shadowed by a parameter at all.
 */
export function buildAdminDashboardRouter(verifyToken: TokenVerifier): Router {
  const router = Router();

  router.use(authenticated(verifyToken));
  router.use(requireRole("ADMIN", "CONTENT_EDITOR"));

  router.get("/content", async (_req, res) => {
    const stats = await questionStatsService.contentStats();
    res.json({ data: stats satisfies AdminContentStats });
  });

  return router;
}
