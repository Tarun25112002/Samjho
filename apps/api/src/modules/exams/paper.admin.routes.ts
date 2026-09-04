import {
  generatePaperSchema,
  listExamPapersQuerySchema,
  setPaperStatusSchema,
} from "@samjho/contracts";
import { Router } from "express";
import { z } from "zod";

import { authenticated, requireRole } from "../../middleware/auth.js";
import { parseBody, validate } from "../../middleware/validate.js";
import type { TokenVerifier } from "../../lib/token-verifier.js";
import { paperService } from "./paper.service.js";

/**
 * `/api/v1/admin/exam-papers` — assembling papers.
 *
 * ## Generation is a dry run unless it is told otherwise
 *
 * `POST /` with the default body reports what the bank could fill and what it
 * could not, and writes nothing. That is the same default bulk import chose, for
 * a sharper reason here: a generated paper consumes forty questions, and an
 * editor exploring "could we run a mock yet?" should not create four abandoned
 * papers finding out that the answer is no.
 *
 * The dry run is also the more useful call. Its shortfall list says which groups
 * the bank cannot fill and by how much, which is a content work order (docs/07
 * R1) rather than an error.
 *
 * ## Publishing is separate, and gated
 *
 * Generation produces a `DRAFT`. Publishing is its own call and refuses a paper
 * whose blueprint has not been checked against CBSE's official sample paper —
 * see `paper.service.ts`. Same separation as questions: "assemble it" and "let
 * students sit it" are different decisions with different consequences.
 */
export function buildExamPaperAdminRouter(verifyToken: TokenVerifier): Router {
  const router = Router();

  router.use(authenticated(verifyToken));
  router.use(requireRole("ADMIN", "CONTENT_EDITOR"));

  router.get("/", validate({ query: listExamPapersQuerySchema }), async (req, res) => {
    const query = listExamPapersQuerySchema.parse(req.query);
    res.json({ data: { papers: await paperService.listForAdmin(query) } });
  });

  router.post("/", validate({ body: generatePaperSchema }), async (req, res) => {
    const input = parseBody(req, generatePaperSchema);
    const result = await paperService.generate(input);

    // 201 only when something was created. A dry run and an unfillable plan both
    // return 200 with a plan the caller is meant to read, and calling either of
    // them "created" would be a lie the client would have to special-case.
    res.status(result.paper ? 201 : 200).json({ data: result });
  });

  router.get("/:id", validate({ params: idParams }), async (req, res) => {
    const { id } = idParams.parse(req.params);
    res.json({ data: await paperService.getForAdmin(id) });
  });

  router.post(
    "/:id/status",
    validate({ params: idParams, body: setPaperStatusSchema }),
    async (req, res) => {
      const { id } = idParams.parse(req.params);
      const { status } = parseBody(req, setPaperStatusSchema);

      res.json({ data: await paperService.setStatus(id, status) });
    },
  );

  return router;
}

const idParams = z.object({ id: z.string().min(1).max(60) });
