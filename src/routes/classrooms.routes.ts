import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody, validateParams, validateQuery, getQuery, getParams } from "../middleware/validate";
import { ok, paginated, noContent } from "../utils/responses";
import * as classroomService from "../services/classroom.service";
import type { ListClassroomsQuery, CreateClassroomInput, UpdateClassroomInput } from "../validators/classroom.schema";
import type { ListClassroomsOptions } from "../services/classroom.service";
import * as validators from "../validators/classroom.schema";

const router = Router();

router.get("/", requireAuth, validateQuery(validators.listClassroomsQuerySchema), async (req, res, next) => {
  try {
    const query = getQuery<ListClassroomsQuery>(req);
    const includeInactive = req.user!.role === "ENCARGADO" && query.includeInactive === "true";
    const opts: ListClassroomsOptions = {
      includeInactive,
      status: query.status,
      q: query.q,
      page: query.page,
      pageSize: query.pageSize,
    };
    const result = await classroomService.listClassrooms(opts);
    paginated(res, result.items, result.meta);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", requireAuth, validateParams(validators.idParamsSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const classroom = await classroomService.getClassroom(id);
    ok(res, { classroom }, 200);
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAuth, requireRole("ENCARGADO"), validateBody(validators.createClassroomSchema), async (req, res, next) => {
  try {
    const body = getBody<CreateClassroomInput>(req);
    const classroom = await classroomService.createClassroom(body);
    ok(res, { classroom }, 201);
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", requireAuth, requireRole("ENCARGADO"), validateParams(validators.idParamsSchema), validateBody(validators.updateClassroomSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const body = getBody<UpdateClassroomInput>(req);
    const classroom = await classroomService.updateClassroom(id, body);
    ok(res, { classroom }, 200);
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, requireRole("ENCARGADO"), validateParams(validators.idParamsSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    await classroomService.deleteClassroom(id);
    noContent(res);
  } catch (e) {
    next(e);
  }
});

function getBody<T>(req: import("express").Request): T {
  return req.validated?.body as T;
}

export default router;