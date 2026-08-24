import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody, validateParams, validateQuery, getQuery, getParams } from "../middleware/validate";
import { ok, noContent, paginatedCached } from "../utils/responses";
import * as teacherService from "../services/teacher.service";
import type { ListTeachersQuery, CreateTeacherInput, UpdateTeacherInput } from "../validators/teacher.schema";
import type { ListTeachersOptions } from "../services/teacher.service";
import * as validators from "../validators/teacher.schema";

const router = Router();

router.get("/", requireAuth, validateQuery(validators.listTeachersQuerySchema), async (req, res, next) => {
  try {
    const query = getQuery<ListTeachersQuery>(req);
    const includeInactive = req.user!.role === "ENCARGADO" && query.includeInactive === "true";
    const opts: ListTeachersOptions = {
      includeInactive,
      q: query.q,
      page: query.page,
      pageSize: query.pageSize,
    };
    const result = await teacherService.listTeachers(opts);
    // Service cachea 10min (CACHE_POLICIES.teachers): private max-age acorde.
    paginatedCached(res, result.items, result.meta, 10 * 60);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", requireAuth, validateParams(validators.idParamsSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const teacher = await teacherService.getTeacher(id);
    ok(res, { teacher }, 200);
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAuth, requireRole("ENCARGADO"), validateBody(validators.createTeacherSchema), async (req, res, next) => {
  try {
    const body = getBody<CreateTeacherInput>(req);
    const teacher = await teacherService.createTeacher(body);
    ok(res, { teacher }, 201);
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", requireAuth, requireRole("ENCARGADO"), validateParams(validators.idParamsSchema), validateBody(validators.updateTeacherSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const body = getBody<UpdateTeacherInput>(req);
    const teacher = await teacherService.updateTeacher(id, body);
    ok(res, { teacher }, 200);
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, requireRole("ENCARGADO"), validateParams(validators.idParamsSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    await teacherService.deleteTeacher(id);
    noContent(res);
  } catch (e) {
    next(e);
  }
});

function getBody<T>(req: import("express").Request): T {
  return req.validated?.body as T;
}

export default router;