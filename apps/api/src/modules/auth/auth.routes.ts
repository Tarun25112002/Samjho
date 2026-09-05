import {
  onboardingInputSchema,
  profileUpdateInputSchema,
  teacherOnboardingInputSchema,
  teacherProfileUpdateInputSchema,
} from "@samjho/contracts";
import { Router } from "express";

import { authenticated, getAuthUser } from "../../middleware/auth.js";
import { parseBody, validate } from "../../middleware/validate.js";
import type { TokenVerifier } from "../../lib/token-verifier.js";
import { authService } from "./auth.service.js";

/**
 * `/api/v1/me` — the signed-in user's own record.
 *
 * Routes here are thin on purpose: parse, delegate, respond. Every one of them
 * fits on a screen, and none contains a decision. If a condition ever appears in
 * this file that is not about HTTP, it belongs in the service.
 *
 * There is no `:userId` parameter anywhere. The subject of every request is
 * `req.user.id`, taken from a verified token — so there is no id for a caller to
 * tamper with, and the commonest authorization bug in an app like this
 * ("GET /users/:id returns anyone") is not merely guarded against but
 * unexpressible.
 */
export function buildMeRouter(verifyToken: TokenVerifier): Router {
  const router = Router();

  router.use(authenticated(verifyToken));

  router.get("/", async (req, res) => {
    const user = getAuthUser(req);
    res.json({ data: await authService.getMe(user.id) });
  });

  /**
   * Finish onboarding. Idempotent — a double-submitted wizard, or a retry after
   * a dropped response, produces the same rows and the same 200.
   */
  router.post("/onboarding", validate({ body: onboardingInputSchema }), async (req, res) => {
    const user = getAuthUser(req);
    const data = await authService.completeOnboarding(user, parseBody(req, onboardingInputSchema));
    res.status(200).json({ data });
  });

  router.patch("/profile", validate({ body: profileUpdateInputSchema }), async (req, res) => {
    const user = getAuthUser(req);
    const data = await authService.updateProfile(user, parseBody(req, profileUpdateInputSchema));
    res.json({ data });
  });

  /**
   * Finish teacher setup — and, as a consequence, become a teacher.
   *
   * A sibling of `/onboarding` rather than a `role` field on it. Two forms that
   * ask different questions and grant different access should be two endpoints:
   * folding them together would mean one request body in which `role` is a
   * client-supplied value, which is the exact shape `User.role` exists to avoid.
   */
  router.post(
    "/teacher-onboarding",
    validate({ body: teacherOnboardingInputSchema }),
    async (req, res) => {
      const user = getAuthUser(req);
      const data = await authService.completeTeacherOnboarding(
        user,
        parseBody(req, teacherOnboardingInputSchema),
      );
      res.status(200).json({ data });
    },
  );

  router.patch(
    "/teacher-profile",
    validate({ body: teacherProfileUpdateInputSchema }),
    async (req, res) => {
      const user = getAuthUser(req);
      const data = await authService.updateTeacherProfile(
        user,
        parseBody(req, teacherProfileUpdateInputSchema),
      );
      res.json({ data });
    },
  );

  return router;
}
