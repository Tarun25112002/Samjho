import { Router } from "express";
import { z } from "zod";

import { authenticated } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import type { TokenVerifier } from "../../lib/token-verifier.js";
import { pastPaperService } from "./past-paper.service.js";

/**
 * `/api/v1/past-papers` — the student half of the registry, which is one call.
 *
 * A student never browses the registry. The registry is an editorial backlog and
 * most of it is rows describing papers we hold nothing from; a screen listing
 * those would advertise absence. What a student needs is the set of years that
 * actually have questions behind them, which is what feeds the year chips on the
 * practice setup screen.
 *
 * That is also why the count comes back with each year. A chip reading
 * "2019 · 34" sets an expectation the set can meet; a bare chip that produces
 * four questions reads as a broken feature rather than a thin year.
 */
export function buildPastPaperRouter(verifyToken: TokenVerifier): Router {
  const router = Router();

  router.use(authenticated(verifyToken));

  router.get("/years", validate({ query: yearsQuery }), async (req, res) => {
    const { subjectId } = yearsQuery.parse(req.query);
    res.json({ data: { years: await pastPaperService.yearOptions(subjectId) } });
  });

  return router;
}

const yearsQuery = z.object({ subjectId: z.string().min(1).max(60) });
