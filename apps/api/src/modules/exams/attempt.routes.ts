import {
  listExamAttemptsQuerySchema,
  saveExamAnswerSchema,
  startExamAttemptSchema,
  submitExamAttemptSchema,
} from "@medhavi/contracts";
import { Router } from "express";
import { z } from "zod";

import { authenticated, getAuthUser } from "../../middleware/auth.js";
import { parseBody, validate } from "../../middleware/validate.js";
import type { TokenVerifier } from "../../lib/token-verifier.js";
import { examAttemptService } from "./attempt.service.js";

/**
 * `/api/v1/exam-attempts` — sitting a paper.
 *
 * Every route reads `req.user.id` and passes it into the service, which puts it
 * in the `WHERE`. There is no `:userId` anywhere and no admin variant, so one
 * student reading another's live exam is unexpressible rather than merely
 * guarded — the same rule practice follows, and it matters more here.
 *
 * The answer route is nested under the attempt rather than flat, so the
 * attempt's ownership check runs before the slot is even looked at.
 */
export function buildExamAttemptRouter(verifyToken: TokenVerifier): Router {
  const router = Router();

  router.use(authenticated(verifyToken));

  router.post("/", validate({ body: startExamAttemptSchema }), async (req, res) => {
    const user = getAuthUser(req);
    const input = parseBody(req, startExamAttemptSchema);

    // 201 even when the idempotency key matched an existing attempt: from the
    // caller's side a resource they asked for now exists and is theirs, and a
    // 200 on the retry would make a double-tapped Start look like a different
    // outcome from a single one.
    res.status(201).json({ data: await examAttemptService.start(user.id, input) });
  });

  router.get("/", validate({ query: listExamAttemptsQuerySchema }), async (req, res) => {
    const user = getAuthUser(req);
    const query = listExamAttemptsQuerySchema.parse(req.query);

    res.json({ data: await examAttemptService.list(user.id, query) });
  });

  router.get("/:id", validate({ params: idParams }), async (req, res) => {
    const user = getAuthUser(req);
    const { id } = idParams.parse(req.params);

    res.json({ data: await examAttemptService.get(user.id, id) });
  });

  /**
   * Autosave one slot.
   *
   * `PUT` rather than `POST`: the same slot is written over and over as the
   * student types, and the result depends only on the last one to arrive — the
   * definition of idempotent. The `revision` in the body is what decides which
   * "last" means when two tabs disagree.
   */
  router.put(
    "/:id/answers/:slotId",
    validate({ params: slotParams, body: saveExamAnswerSchema }),
    async (req, res) => {
      const user = getAuthUser(req);
      const { id, slotId } = slotParams.parse(req.params);
      const input = parseBody(req, saveExamAnswerSchema);

      res.json({ data: await examAttemptService.saveAnswer(user.id, id, slotId, input) });
    },
  );

  router.post("/:id/heartbeat", validate({ params: idParams }), async (req, res) => {
    const user = getAuthUser(req);
    const { id } = idParams.parse(req.params);

    res.json({ data: await examAttemptService.heartbeat(user.id, id) });
  });

  router.post(
    "/:id/submit",
    validate({ params: idParams, body: submitExamAttemptSchema }),
    async (req, res) => {
      const user = getAuthUser(req);
      const { id } = idParams.parse(req.params);
      const input = parseBody(req, submitExamAttemptSchema);

      // 200, and the same body, however many times it is called. A student who
      // double-tapped Submit did submit, and telling them otherwise with a 409
      // would be describing our concurrency control rather than their exam.
      res.json({ data: await examAttemptService.submit(user.id, id, input) });
    },
  );

  router.get("/:id/result", validate({ params: idParams }), async (req, res) => {
    const user = getAuthUser(req);
    const { id } = idParams.parse(req.params);

    res.json({ data: await examAttemptService.result(user.id, id) });
  });

  return router;
}

const idParams = z.object({ id: z.string().min(1).max(60) });
const slotParams = idParams.extend({ slotId: z.string().min(1).max(60) });
