import {
  adminListSubjectsQuerySchema,
  booleanFlagSchema,
  createChapterInputSchema,
  createSubjectInputSchema,
  createTopicInputSchema,
  reorderInputSchema,
  updateChapterInputSchema,
  updateSubjectInputSchema,
  updateTopicInputSchema,
  type AdminChapterListResponse,
  type AdminSubjectListResponse,
} from "@samjho/contracts";
import { Router } from "express";
import { z } from "zod";

import { authenticated, requireRole } from "../../middleware/auth.js";
import { parseBody, validate } from "../../middleware/validate.js";
import type { TokenVerifier } from "../../lib/token-verifier.js";
import { catalogAdminService } from "./catalog.admin.service.js";

/**
 * `/api/v1/admin/catalog` — taxonomy editing for content staff.
 *
 * ## Why this is a separate router rather than extra verbs on the catalog router
 *
 * The student catalog is read-only, unfiltered by `isActive` in the caller's
 * favour, and will be opened up to anonymous traffic in Phase 9 for the SEO
 * subject pages. Hanging `POST`/`PATCH` off the same router means the day someone
 * removes `router.use(authenticated(...))` from it to make the public pages work,
 * they also open the writes. Separate mount, separate guard, separate blast
 * radius.
 *
 * `requireRole` is applied once at the router level rather than per route. A
 * per-route guard is a guard someone can forget to add to route eleven; a
 * router-level one is a guard you have to actively remove.
 *
 * **CONTENT_EDITOR is allowed here alongside ADMIN.** Taxonomy is the shape of
 * the syllabus, which is precisely a content editor's job. What they must not be
 * able to touch — users, roles, licence status — lives behind `requireRole("ADMIN")`
 * elsewhere.
 */
export function buildCatalogAdminRouter(verifyToken: TokenVerifier): Router {
  const router = Router();

  router.use(authenticated(verifyToken));
  router.use(requireRole("ADMIN", "CONTENT_EDITOR"));

  // ── Subjects ──────────────────────────────────────────────────────────────

  router.get("/subjects", validate({ query: adminListSubjectsQuerySchema }), async (req, res) => {
    const query = adminListSubjectsQuerySchema.parse(req.query);
    const subjects = await catalogAdminService.listSubjects(query);

    res.json({ data: { subjects } satisfies AdminSubjectListResponse });
  });

  router.post("/subjects", validate({ body: createSubjectInputSchema }), async (req, res) => {
    const input = parseBody(req, createSubjectInputSchema);
    res.status(201).json({ data: await catalogAdminService.createSubject(input) });
  });

  router.patch(
    "/subjects/:id",
    validate({ params: idParams, body: updateSubjectInputSchema }),
    async (req, res) => {
      const { id } = idParams.parse(req.params);
      const input = parseBody(req, updateSubjectInputSchema);
      res.json({ data: await catalogAdminService.updateSubject(id, input) });
    },
  );

  /*
   * There is no `DELETE`.
   *
   * `Chapter.subjectId` and `Question.subjectId` are `onDelete: Restrict`, so a
   * subject anyone has used cannot be removed — a DELETE route would exist only
   * to return a foreign-key error. Withdrawal is `PATCH { isActive: false }`,
   * which hides the subject *and* its questions (see `question.visibility.ts`)
   * and can be undone. An editor who withdraws the wrong subject at 11pm has a
   * way back; one who deleted it would not.
   */

  // ── Chapters ──────────────────────────────────────────────────────────────

  router.get(
    "/subjects/:id/chapters",
    validate({ params: idParams, query: includeInactiveQuery }),
    async (req, res) => {
      const { id } = idParams.parse(req.params);
      const { includeInactive } = includeInactiveQuery.parse(req.query);
      const chapters = await catalogAdminService.listChapters(id, includeInactive);

      res.json({ data: { chapters } satisfies AdminChapterListResponse });
    },
  );

  router.post(
    "/subjects/:id/chapters",
    validate({ params: idParams, body: createChapterInputSchema }),
    async (req, res) => {
      const { id } = idParams.parse(req.params);
      const input = parseBody(req, createChapterInputSchema);
      res.status(201).json({ data: await catalogAdminService.createChapter(id, input) });
    },
  );

  router.put(
    "/subjects/:id/chapters/order",
    validate({ params: idParams, body: reorderInputSchema }),
    async (req, res) => {
      const { id } = idParams.parse(req.params);
      const { orderedIds } = parseBody(req, reorderInputSchema);
      const chapters = await catalogAdminService.reorderChapters(id, orderedIds);

      res.json({ data: { chapters } satisfies AdminChapterListResponse });
    },
  );

  router.get("/chapters/:id", validate({ params: idParams }), async (req, res) => {
    const { id } = idParams.parse(req.params);
    res.json({ data: await catalogAdminService.getChapter(id) });
  });

  router.patch(
    "/chapters/:id",
    validate({ params: idParams, body: updateChapterInputSchema }),
    async (req, res) => {
      const { id } = idParams.parse(req.params);
      const input = parseBody(req, updateChapterInputSchema);
      res.json({ data: await catalogAdminService.updateChapter(id, input) });
    },
  );

  // ── Topics ────────────────────────────────────────────────────────────────

  router.post(
    "/chapters/:id/topics",
    validate({ params: idParams, body: createTopicInputSchema }),
    async (req, res) => {
      const { id } = idParams.parse(req.params);
      const input = parseBody(req, createTopicInputSchema);
      res.status(201).json({ data: await catalogAdminService.createTopic(id, input) });
    },
  );

  router.put(
    "/chapters/:id/topics/order",
    validate({ params: idParams, body: reorderInputSchema }),
    async (req, res) => {
      const { id } = idParams.parse(req.params);
      const { orderedIds } = parseBody(req, reorderInputSchema);
      res.json({ data: await catalogAdminService.reorderTopics(id, orderedIds) });
    },
  );

  router.patch(
    "/topics/:id",
    validate({ params: idParams, body: updateTopicInputSchema }),
    async (req, res) => {
      const { id } = idParams.parse(req.params);
      const input = parseBody(req, updateTopicInputSchema);
      res.json({ data: await catalogAdminService.updateTopic(id, input) });
    },
  );

  return router;
}

/** Ids only, never slugs. An admin tool holds ids; a slug here is a typo. */
const idParams = z.object({ id: z.string().min(1).max(60) });

const includeInactiveQuery = z.object({ includeInactive: booleanFlagSchema });
