import { Router } from "express";

import { authenticated, getAuthUser, requireRole } from "../../middleware/auth.js";
import type { TokenVerifier } from "../../lib/token-verifier.js";
import { progressService } from "./progress.service.js";

/** Student-owned read model: no user id is ever accepted from the caller. */
export function buildProgressRouter(verifyToken: TokenVerifier): Router {
  const router = Router();

  router.use(authenticated(verifyToken));
  router.use(requireRole("STUDENT"));

  router.get("/overview", async (req, res) => {
    const user = getAuthUser(req);
    res.json({ data: await progressService.overview(user.id) });
  });

  return router;
}
