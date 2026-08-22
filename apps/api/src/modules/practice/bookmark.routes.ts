import { createBookmarkSchema, cursorPaginationQuerySchema } from "@samjho/contracts";
import { Router } from "express";
import { z } from "zod";

import { authenticated, getAuthUser } from "../../middleware/auth.js";
import { parseBody, validate } from "../../middleware/validate.js";
import type { TokenVerifier } from "../../lib/token-verifier.js";
import { bookmarkService } from "./bookmark.service.js";

/**
 * `/api/v1/bookmarks` — the student's saved questions.
 *
 * Addressed by *question* id, not by bookmark id. The client always knows which
 * question it is looking at and would otherwise have to hold a bookmark id it
 * only learns from the response to the save — which makes an offline
 * save-then-unsave impossible for no gain.
 */
export function buildBookmarkRouter(verifyToken: TokenVerifier): Router {
  const router = Router();

  router.use(authenticated(verifyToken));

  router.get("/", validate({ query: cursorPaginationQuerySchema }), async (req, res) => {
    const user = getAuthUser(req);
    const query = cursorPaginationQuerySchema.parse(req.query);

    res.json({ data: await bookmarkService.list(user.id, query) });
  });

  router.put("/", validate({ body: createBookmarkSchema }), async (req, res) => {
    const user = getAuthUser(req);
    const input = parseBody(req, createBookmarkSchema);

    // PUT rather than POST: saving the same question twice is the same end
    // state, and the note is replaced rather than appended. That is the
    // definition of idempotent, and the bookmark button gets retried.
    res.json({ data: await bookmarkService.save(user.id, input) });
  });

  router.delete("/:questionId", validate({ params: questionParams }), async (req, res) => {
    const user = getAuthUser(req);
    const { questionId } = questionParams.parse(req.params);

    res.json({ data: await bookmarkService.remove(user.id, questionId) });
  });

  return router;
}

const questionParams = z.object({ questionId: z.string().min(1).max(60) });
