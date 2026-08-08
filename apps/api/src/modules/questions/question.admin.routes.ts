import {
  adminListQuestionsQuerySchema,
  changeQuestionStatusInputSchema,
  importQuestionsInputSchema,
  writeQuestionInputSchema,
  type ImportResult,
  type QuestionRevision,
} from "@samjho/contracts";
import { Router } from "express";
import { z } from "zod";

import { authenticated, getAuthUser, requireRole } from "../../middleware/auth.js";
import { parseBody, validate } from "../../middleware/validate.js";
import type { TokenVerifier } from "../../lib/token-verifier.js";
import { questionAdminService } from "./question.admin.service.js";
import { questionImportService } from "./question.import.service.js";

/**
 * `/api/v1/admin/questions` — authoring.
 *
 * ## Why `PUT` and not a set of `PATCH`es
 *
 * A question is a tree: stem, options, answer key, provenance, topic links, and
 * for a case study a set of sub-parts each with their own children. Exposing
 * that as `POST /questions/:id/options`, `PUT /questions/:id/answer` and so on
 * gives you an editor that saves six times and a database that can hold an MCQ
 * with no options between two of those saves.
 *
 * The phase gate is a *median entry time under 90 seconds* (docs/07 §1, Phase
 * 4). Six sequential round trips cannot reach it, and neither can a form that
 * has to reason about which parts of itself are dirty. One document in, one
 * transaction, valid on both sides.
 *
 * ## Why status is its own endpoint
 *
 * "Save my edits" and "let students see this" are different decisions with
 * different consequences. Folding the second into the first turns every save
 * into a publish for anyone who leaves a dropdown alone — and publication is the
 * point at which the licensing decision stops being optional (docs/07 R2).
 *
 * ## Why there is still no DELETE
 *
 * Same reasoning as the taxonomy router. `ARCHIVED` withdraws a question from
 * students while leaving every attempt that referenced it intact, and it is
 * reversible. A hard delete would either fail on the foreign keys or take a
 * student's history with it.
 */
export function buildQuestionAdminRouter(verifyToken: TokenVerifier): Router {
  const router = Router();

  router.use(authenticated(verifyToken));
  router.use(requireRole("ADMIN", "CONTENT_EDITOR"));

  router.get("/", validate({ query: adminListQuestionsQuerySchema }), async (req, res) => {
    const query = adminListQuestionsQuerySchema.parse(req.query);
    res.json({ data: await questionAdminService.list(query) });
  });

  router.post("/", validate({ body: writeQuestionInputSchema }), async (req, res) => {
    const input = parseBody(req, writeQuestionInputSchema);
    const author = getAuthUser(req);

    res.status(201).json({ data: await questionAdminService.create(input, author.id) });
  });

  /**
   * Bulk import. Registered before `/:id` because Express matches in order and
   * `import` would otherwise be read as a question id — a collision that fails
   * as a confusing 404 rather than as anything obviously wrong.
   */
  router.post("/import", validate({ body: importQuestionsInputSchema }), async (req, res) => {
    const input = parseBody(req, importQuestionsInputSchema);
    const author = getAuthUser(req);
    const result = await questionImportService.importQuestions(input, author.id);

    // 200 even when rows failed: the request itself succeeded and its body *is*
    // the report. A 400 here would make a dry run look like a client error and
    // would tempt a caller into throwing away the very thing they asked for.
    res.json({ data: result satisfies ImportResult });
  });

  router.get("/:id", validate({ params: idParams }), async (req, res) => {
    const { id } = idParams.parse(req.params);
    res.json({ data: await questionAdminService.getById(id) });
  });

  router.put(
    "/:id",
    validate({ params: idParams, body: writeQuestionInputSchema }),
    async (req, res) => {
      const { id } = idParams.parse(req.params);
      const input = parseBody(req, writeQuestionInputSchema);
      const editor = getAuthUser(req);

      res.json({ data: await questionAdminService.update(id, input, editor.id) });
    },
  );

  router.put(
    "/:id/status",
    validate({ params: idParams, body: changeQuestionStatusInputSchema }),
    async (req, res) => {
      const { id } = idParams.parse(req.params);
      const input = parseBody(req, changeQuestionStatusInputSchema);
      const editor = getAuthUser(req);

      res.json({ data: await questionAdminService.changeStatus(id, input, editor.id) });
    },
  );

  router.get("/:id/revisions", validate({ params: idParams }), async (req, res) => {
    const { id } = idParams.parse(req.params);
    const revisions = await questionAdminService.listRevisions(id);

    res.json({ data: { revisions } satisfies { revisions: QuestionRevision[] } });
  });

  return router;
}

const idParams = z.object({ id: z.string().min(1).max(60) });
