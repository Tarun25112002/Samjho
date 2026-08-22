import {
  createPracticeSessionSchema,
  listPracticeSessionsQuerySchema,
  selfEvaluateSchema,
  setMistakeReasonSchema,
  submitAttemptSchema,
  updateSessionSchema,
} from "@samjho/contracts";
import { Router } from "express";
import { z } from "zod";

import { authenticated, getAuthUser } from "../../middleware/auth.js";
import { parseBody, validate } from "../../middleware/validate.js";
import type { TokenVerifier } from "../../lib/token-verifier.js";
import { practiceService } from "./practice.service.js";

/**
 * `/api/v1/practice-sessions` — the student's own practice.
 *
 * Every route reads `req.user.id` from the authenticated session and passes it
 * into the service, which puts it in the `WHERE`. Nothing here takes a user id
 * from the request, and there is no admin variant of these endpoints: a session
 * belongs to exactly one student and the only person who can read it is that
 * student. docs/02 §4 names resource-level ownership as the check most
 * commonly missed in apps like this, and the mitigation is that a caller has no
 * way to name a user at all.
 *
 * The nesting is deliberate. An attempt is addressed as
 * `/practice-sessions/:id/attempts/:attemptId` rather than `/attempts/:id`, so
 * the session's ownership check runs before the attempt's on every path — a
 * flat attempts resource would have to remember to do it, once per route.
 */
export function buildPracticeRouter(verifyToken: TokenVerifier): Router {
  const router = Router();

  router.use(authenticated(verifyToken));

  router.post("/", validate({ body: createPracticeSessionSchema }), async (req, res) => {
    const user = getAuthUser(req);
    const input = parseBody(req, createPracticeSessionSchema);

    // 201: a session is a resource that did not exist a moment ago, and the
    // runner navigates to it by id.
    res.status(201).json({ data: await practiceService.create(user.id, input) });
  });

  router.get("/", validate({ query: listPracticeSessionsQuerySchema }), async (req, res) => {
    const user = getAuthUser(req);
    const query = listPracticeSessionsQuerySchema.parse(req.query);

    res.json({ data: await practiceService.list(user.id, query) });
  });

  router.get("/:id", validate({ params: idParams }), async (req, res) => {
    const user = getAuthUser(req);
    const { id } = idParams.parse(req.params);

    res.json({ data: await practiceService.get(user.id, id) });
  });

  router.patch(
    "/:id",
    validate({ params: idParams, body: updateSessionSchema }),
    async (req, res) => {
      const user = getAuthUser(req);
      const { id } = idParams.parse(req.params);
      const { currentIndex } = parseBody(req, updateSessionSchema);

      res.json({ data: await practiceService.setCurrentIndex(user.id, id, currentIndex) });
    },
  );

  router.post(
    "/:id/attempts",
    validate({ params: idParams, body: submitAttemptSchema }),
    async (req, res) => {
      const user = getAuthUser(req);
      const { id } = idParams.parse(req.params);
      const input = parseBody(req, submitAttemptSchema);

      // 200 rather than 201: submitting the same item twice returns the first
      // attempt rather than creating a second, so a 201 would be a lie on the
      // retry — and the retry is the common case on a phone.
      res.json({ data: await practiceService.submit(user.id, id, input) });
    },
  );

  router.post(
    "/:id/attempts/:attemptId/self-evaluation",
    validate({ params: attemptParams, body: selfEvaluateSchema }),
    async (req, res) => {
      const user = getAuthUser(req);
      const { id, attemptId } = attemptParams.parse(req.params);
      const input = parseBody(req, selfEvaluateSchema);

      res.json({ data: await practiceService.selfEvaluate(user.id, id, attemptId, input) });
    },
  );

  router.post(
    "/:id/attempts/:attemptId/mistake-reason",
    validate({ params: attemptParams, body: setMistakeReasonSchema }),
    async (req, res) => {
      const user = getAuthUser(req);
      const { id, attemptId } = attemptParams.parse(req.params);
      const input = parseBody(req, setMistakeReasonSchema);

      res.json({ data: await practiceService.setMistakeReason(user.id, id, attemptId, input) });
    },
  );

  router.post("/:id/complete", validate({ params: idParams }), async (req, res) => {
    const user = getAuthUser(req);
    const { id } = idParams.parse(req.params);

    res.json({ data: await practiceService.complete(user.id, id) });
  });

  router.get("/:id/result", validate({ params: idParams }), async (req, res) => {
    const user = getAuthUser(req);
    const { id } = idParams.parse(req.params);

    res.json({ data: await practiceService.result(user.id, id) });
  });

  return router;
}

const idParams = z.object({ id: z.string().min(1).max(60) });
const attemptParams = idParams.extend({ attemptId: z.string().min(1).max(60) });
