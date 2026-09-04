import {
  ingestPastPaperInputSchema,
  listPastPapersQuerySchema,
  writePastPaperInputSchema,
} from "@samjho/contracts";
import { Router } from "express";
import { z } from "zod";

import { authenticated, getAuthUser, requireRole } from "../../middleware/auth.js";
import { parseBody, validate } from "../../middleware/validate.js";
import type { TokenVerifier } from "../../lib/token-verifier.js";
import { pastPaperIngestService } from "./past-paper.ingest.service.js";
import { pastPaperService } from "./past-paper.service.js";

/**
 * `/api/v1/admin/past-papers` — the registry, and loading papers into it.
 *
 * ## Ingest is a dry run unless told otherwise
 *
 * `POST /ingest` with the default body validates the whole file, reports which
 * registry row it matched and what it would write, and writes nothing. Same
 * default as bulk import, and for a sharper reason: an ingest that guesses the
 * paper wrong files thirty-eight questions under the wrong year, and the only
 * way to find out afterwards is to read them.
 *
 * The dry run is the more useful call in its own right. It answers "does this
 * file line up with the paper I think it is, and is any of it already in the
 * bank" before anything is committed.
 *
 * ## Route order
 *
 * `/coverage` and `/ingest` are registered before `/:id`, or Express matches
 * them as ids and the coverage screen 404s on a paper called "coverage". Same
 * ordering as `/admin/questions/import`, and for the same reason.
 */
export function buildPastPaperAdminRouter(verifyToken: TokenVerifier): Router {
  const router = Router();

  router.use(authenticated(verifyToken));
  router.use(requireRole("ADMIN", "CONTENT_EDITOR"));

  router.get("/", validate({ query: listPastPapersQuerySchema }), async (req, res) => {
    const query = listPastPapersQuerySchema.parse(req.query);
    res.json({ data: await pastPaperService.list(query) });
  });

  router.get("/coverage", validate({ query: coverageQuery }), async (req, res) => {
    const { subjectId } = coverageQuery.parse(req.query);
    res.json({ data: await pastPaperService.coverage(subjectId) });
  });

  router.post("/ingest", validate({ body: ingestPastPaperInputSchema }), async (req, res) => {
    const input = parseBody(req, ingestPastPaperInputSchema);
    const author = getAuthUser(req);
    const result = await pastPaperIngestService.ingest(input, author.id);

    // 201 only when questions were actually written. A dry run and a file with
    // errors both return 200 with a report the caller is meant to read, and
    // calling either "created" would be a lie the client has to special-case.
    res.status(result.written > 0 ? 201 : 200).json({ data: result });
  });

  router.post("/", validate({ body: writePastPaperInputSchema }), async (req, res) => {
    const input = parseBody(req, writePastPaperInputSchema);
    res.status(201).json({ data: await pastPaperService.create(input) });
  });

  router.get("/:id", validate({ params: idParams }), async (req, res) => {
    const { id } = idParams.parse(req.params);
    res.json({ data: await pastPaperService.getById(id) });
  });

  router.put(
    "/:id",
    validate({ params: idParams, body: writePastPaperInputSchema }),
    async (req, res) => {
      const { id } = idParams.parse(req.params);
      const input = parseBody(req, writePastPaperInputSchema);

      res.json({ data: await pastPaperService.update(id, input) });
    },
  );

  return router;
}

const idParams = z.object({ id: z.string().min(1).max(60) });
const coverageQuery = z.object({ subjectId: z.string().min(1).max(60) });
