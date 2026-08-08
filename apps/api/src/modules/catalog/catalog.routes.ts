import { listSubjectsQuerySchema, type SubjectListResponse } from "@samjho/contracts";
import { Router } from "express";
import { z } from "zod";

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

  // `:idOrSlug` rather than `:id` because students arrive from readable URLs
  // (`/subjects/class-10-science`) while code holds ids. Accepting both here
  // keeps every caller from having to resolve one into the other first.
  router.get("/subjects/:idOrSlug", validate({ params: idOrSlugParams }), async (req, res) => {
    const { idOrSlug } = idOrSlugParams.parse(req.params);
    res.json({ data: await catalogService.getSubject(idOrSlug) });
  });

  router.get(
    "/subjects/:idOrSlug/chapters",
    validate({ params: idOrSlugParams }),
    async (req, res) => {
      const { idOrSlug } = idOrSlugParams.parse(req.params);
      res.json({ data: await catalogService.listChapters(idOrSlug) });
    },
  );

  router.get("/chapters/:idOrSlug", validate({ params: idOrSlugParams }), async (req, res) => {
    const { idOrSlug } = idOrSlugParams.parse(req.params);
    res.json({ data: await catalogService.getChapter(idOrSlug) });
  });

  return router;
}

/**
 * Chapter slugs are only unique within a subject, so a bare slug can in
 * principle match two chapters in different subjects. `findFirst` takes the
 * lowest-ordered match, which is why the web app links by id and this exists for
 * hand-typed URLs and future SEO paths rather than as the primary route.
 */
const idOrSlugParams = z.object({ idOrSlug: z.string().min(1).max(120) });
