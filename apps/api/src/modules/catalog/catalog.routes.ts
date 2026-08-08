import { listSubjectsQuerySchema, type SubjectListResponse } from "@samjho/contracts";
import { Router } from "express";

import { authenticated } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import type { TokenVerifier } from "../../lib/token-verifier.js";
import { catalogService } from "./catalog.service.js";

/**
 * `/api/v1/catalog` — the Phase 2 slice: the subject list the onboarding wizard
 * offers. Chapters, topics and question counts arrive in Phase 3.
 *
 * Authenticated, even though docs/02 files the catalog under "mostly public".
 * The only caller today is a signed-in student mid-wizard, and an endpoint is
 * far easier to open up later than to close down — closing one means finding
 * every consumer that started depending on it being open. Phase 3 relaxes this
 * deliberately when the public SEO subject pages need it.
 */
export function buildCatalogRouter(verifyToken: TokenVerifier): Router {
  const router = Router();

  router.use(authenticated(verifyToken));

  router.get("/subjects", validate({ query: listSubjectsQuerySchema }), async (req, res) => {
    const { board, classLevel } = listSubjectsQuerySchema.parse(req.query);
    const subjects = await catalogService.listSubjects({ board, classLevel });

    res.json({ data: { subjects } satisfies SubjectListResponse });
  });

  return router;
}
