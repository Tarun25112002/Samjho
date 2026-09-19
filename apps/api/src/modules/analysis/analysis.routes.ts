import { Router } from "express";

import { authenticated, getAuthUser } from "../../middleware/auth.js";
import type { TokenVerifier } from "../../lib/token-verifier.js";
import { analysisService } from "./analysis.service.js";

export function buildAnalysisRouter(verifyToken: TokenVerifier): Router {
  const router = Router();

  router.use(authenticated(verifyToken));

  router.get("/", async (req, res) => {
    const user = getAuthUser(req);
    res.json({ data: await analysisService.preparation(user.id) });
  });

  router.get("/trend", async (req, res) => {
    const user = getAuthUser(req);
    res.json({ data: await analysisService.trend(user.id) });
  });

  return router;
}
