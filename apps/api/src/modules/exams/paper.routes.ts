import { listExamPapersQuerySchema } from "@samjho/contracts";
import { Router } from "express";
import { z } from "zod";

import { authenticated } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import type { TokenVerifier } from "../../lib/token-verifier.js";
import { paperService } from "./paper.service.js";

/**
 * `/api/v1/exam-papers` — read-only, and structure only.
 *
 * Neither endpoint here can return a question. That is enforced by the row type
 * rather than by care: `paperStructureSelect` does not ask for a body, so there
 * is nothing for a serializer to leak. The questions arrive from the attempt
 * endpoint once a student has started the timer, which is the whole point of a
 * three-hour simulation — a paper you can read the day before is a revision
 * sheet, not a rehearsal.
 *
 * Published papers only. A draft an editor is assembling is not startable and
 * not visible, and the predicate lives in the repository's `WHERE` so an
 * unpublished paper is indistinguishable from one that does not exist.
 */
export function buildExamPaperRouter(verifyToken: TokenVerifier): Router {
  const router = Router();

  router.use(authenticated(verifyToken));

  router.get("/", validate({ query: listExamPapersQuerySchema }), async (req, res) => {
    const query = listExamPapersQuerySchema.parse(req.query);
    res.json({ data: await paperService.list(query) });
  });

  router.get("/:id", validate({ params: idParams }), async (req, res) => {
    const { id } = idParams.parse(req.params);
    res.json({ data: await paperService.getById(id) });
  });

  return router;
}

const idParams = z.object({ id: z.string().min(1).max(60) });
