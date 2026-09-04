import {
  createClassroomAssignmentSchema,
  createClassroomSchema,
  joinClassroomSchema,
} from "@samjho/contracts";
import { Router } from "express";
import { z } from "zod";

import type { TokenVerifier } from "../../lib/token-verifier.js";
import { authenticated, getAuthUser } from "../../middleware/auth.js";
import { parseBody, validate } from "../../middleware/validate.js";
import { assertStudent, assertTeacher, classroomService } from "./classroom.service.js";

/** `/api/v1/classrooms` — membership and assignment orchestration only. */
export function buildClassroomRouter(verifyToken: TokenVerifier): Router {
  const router = Router();
  router.use(authenticated(verifyToken));

  router.get("/", async (req, res) => {
    const user = getAuthUser(req);
    if (user.role === "TEACHER") {
      res.json({ data: await classroomService.listForTeacher(user.id) });
      return;
    }
    assertStudent(user.role);
    res.json({ data: await classroomService.listForStudent(user.id) });
  });

  router.post("/", validate({ body: createClassroomSchema }), async (req, res) => {
    const user = getAuthUser(req);
    assertTeacher(user.role);
    const input = parseBody(req, createClassroomSchema);
    res.status(201).json({ data: await classroomService.createClassroom(user.id, input) });
  });

  router.post("/join", validate({ body: joinClassroomSchema }), async (req, res) => {
    const user = getAuthUser(req);
    assertStudent(user.role);
    const input = parseBody(req, joinClassroomSchema);
    res.json({ data: await classroomService.joinClassroom(user.id, input) });
  });

  router.post(
    "/:id/assignments",
    validate({ params: idParams, body: createClassroomAssignmentSchema }),
    async (req, res) => {
      const user = getAuthUser(req);
      assertTeacher(user.role);
      const { id } = idParams.parse(req.params);
      const input = parseBody(req, createClassroomAssignmentSchema);
      res.status(201).json({ data: await classroomService.createAssignment(user.id, id, input) });
    },
  );

  router.post("/assignments/:id/start", validate({ params: idParams }), async (req, res) => {
    const user = getAuthUser(req);
    assertStudent(user.role);
    const { id } = idParams.parse(req.params);
    res.status(201).json({ data: await classroomService.startAssignment(user.id, id) });
  });

  router.get("/assignments/:id/report", validate({ params: idParams }), async (req, res) => {
    const user = getAuthUser(req);
    assertTeacher(user.role);
    const { id } = idParams.parse(req.params);
    res.json({ data: await classroomService.report(user.id, id) });
  });

  return router;
}

const idParams = z.object({ id: z.string().min(1).max(60) });
