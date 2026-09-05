import {
  bulkReviewExtractedSchema,
  importUploadInputSchema,
  teacherBankQuerySchema,
  teacherQuestionStatusSchema,
  updateExtractedQuestionSchema,
  uploadPaperInputSchema,
} from "@samjho/contracts";
import express, { Router } from "express";
import { z } from "zod";

import type { TokenVerifier } from "../../lib/token-verifier.js";
import { authenticated, getAuthUser, requireRole } from "../../middleware/auth.js";
import { parseBody, validate } from "../../middleware/validate.js";
import { bankService } from "./bank.service.js";
import { teacherDashboardService } from "./dashboard.service.js";
import { uploadService } from "./upload.service.js";

/**
 * `/api/v1/teacher` — the teacher workspace.
 *
 * ## Why a separate router from `/admin/questions`
 *
 * Both let somebody write questions, and that is where the resemblance ends.
 * An editor curates the shared bank: their writes reach every student in the
 * country and go through review, publication and licensing gates that exist
 * because of that reach. A teacher curates *their own* bank: their writes reach
 * one classroom, need no editorial sign-off, and must never leak past it.
 *
 * Two different blast radii want two different surfaces. Mounting teacher
 * uploads under `/admin` and widening `requireRole` to include TEACHER would
 * have given every teacher on the platform a token that opens the shared bank's
 * routes, with only a per-handler ownership check standing between them and it
 * — and per-handler checks are exactly the thing a new endpoint forgets.
 *
 * ## The body limit
 *
 * This router has its own JSON limit, larger than the app's 1MB default,
 * because a base64 PDF does not fit in the default and raising it globally
 * would let every other endpoint accept a 12MB body it has no use for. The
 * app-level comment anticipates precisely this: "large payloads get an
 * explicit, separately-limited route rather than raising this ceiling
 * globally."
 */

/**
 * 8MB of file becomes ~10.7MB of base64, plus the title and notes around it.
 * 12MB covers that with room to spare and still refuses a body nobody meant to
 * send. `MAX_UPLOAD_BYTES` in the contract is what actually enforces the file
 * size — this is the transport backstop.
 */
const UPLOAD_BODY_LIMIT = "12mb";

export function buildTeacherRouter(verifyToken: TokenVerifier): Router {
  const router = Router();

  router.use(authenticated(verifyToken));
  router.use(requireRole("TEACHER"));

  router.get("/dashboard", async (req, res) => {
    const user = getAuthUser(req);
    res.json({ data: await teacherDashboardService.load(user.id) });
  });

  // ── Uploads ───────────────────────────────────────────────────────────────

  router.get("/uploads", async (req, res) => {
    const user = getAuthUser(req);
    res.json({ data: await uploadService.list(user.id) });
  });

  router.post(
    "/uploads",
    express.json({ limit: UPLOAD_BODY_LIMIT }),
    validate({ body: uploadPaperInputSchema }),
    async (req, res) => {
      const user = getAuthUser(req);
      const input = parseBody(req, uploadPaperInputSchema);

      // 202, not 201. The upload exists, but the thing the caller actually
      // wants — questions — is still being produced. A 201 would say "created,
      // here it is" about a row that is empty for the next two minutes.
      res.status(202).json({ data: await uploadService.createUpload(user.id, input) });
    },
  );

  router.get("/uploads/:id", validate({ params: idParams }), async (req, res) => {
    const user = getAuthUser(req);
    const { id } = idParams.parse(req.params);
    res.json({ data: await uploadService.get(user.id, id) });
  });

  router.post("/uploads/:id/retry", validate({ params: idParams }), async (req, res) => {
    const user = getAuthUser(req);
    const { id } = idParams.parse(req.params);
    await uploadService.retry(user.id, id);
    res.status(202).json({ data: { uploadId: id } });
  });

  router.patch(
    "/uploads/:id/items/:itemId",
    validate({ params: itemParams, body: updateExtractedQuestionSchema }),
    async (req, res) => {
      const user = getAuthUser(req);
      const { id, itemId } = itemParams.parse(req.params);
      await uploadService.updateItem(
        user.id,
        id,
        itemId,
        parseBody(req, updateExtractedQuestionSchema),
      );
      res.json({ data: await uploadService.get(user.id, id) });
    },
  );

  router.post(
    "/uploads/:id/review",
    validate({ params: idParams, body: bulkReviewExtractedSchema }),
    async (req, res) => {
      const user = getAuthUser(req);
      const { id } = idParams.parse(req.params);
      res.json({
        data: await uploadService.review(user.id, id, parseBody(req, bulkReviewExtractedSchema)),
      });
    },
  );

  router.post(
    "/uploads/:id/import",
    validate({ params: idParams, body: importUploadInputSchema }),
    async (req, res) => {
      const user = getAuthUser(req);
      const { id } = idParams.parse(req.params);

      // 200 even when rows failed: the request succeeded and its body *is* the
      // report. A 400 would make a dry run look like a client error and tempt a
      // caller into discarding the very thing they asked for.
      res.json({
        data: await uploadService.importAccepted(
          user.id,
          id,
          parseBody(req, importUploadInputSchema),
        ),
      });
    },
  );

  // ── The teacher's own question bank ───────────────────────────────────────

  router.get("/questions", validate({ query: teacherBankQuerySchema }), async (req, res) => {
    const user = getAuthUser(req);
    const query = teacherBankQuerySchema.parse(req.query);
    res.json({ data: await bankService.list(user.id, query) });
  });

  router.put(
    "/questions/:id/status",
    validate({ params: idParams, body: teacherQuestionStatusSchema }),
    async (req, res) => {
      const user = getAuthUser(req);
      const { id } = idParams.parse(req.params);
      res.json({
        data: await bankService.setStatus(user.id, id, parseBody(req, teacherQuestionStatusSchema)),
      });
    },
  );

  return router;
}

const idParams = z.object({ id: z.string().min(1).max(60) });
const itemParams = idParams.extend({ itemId: z.string().min(1).max(60) });
