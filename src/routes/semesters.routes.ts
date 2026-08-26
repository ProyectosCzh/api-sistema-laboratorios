import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody, validateParams, getParams, validateQuery, getQuery } from "../middleware/validate";
import { ok, noContent, paginatedCached } from "../utils/responses";
import * as semesterService from "../services/semester.service";
import type { ListSemestersQuery, CreateSemesterInput, UpdateSemesterInput } from "../validators/semester.schema";
import * as validators from "../validators/semester.schema";

const router = Router();

router.get("/", requireAuth, validateQuery(validators.listSemestersQuerySchema), async (req, res, next) => {
  try {
    const query = getQuery<ListSemestersQuery>(req);
    const result = await semesterService.listSemesters(query);
    // Service cachea 5min (CACHE_POLICIES.semesters): private max-age acorde.
    paginatedCached(res, result.items, result.meta, 5 * 60);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", requireAuth, validateParams(validators.idParamsSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const semester = await semesterService.getSemester(id);
    ok(res, { semester }, 200);
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAuth, requireRole("ENCARGADO"), validateBody(validators.createSemesterSchema), async (req, res, next) => {
  try {
    const body = getBody<CreateSemesterInput>(req);
    const semester = await semesterService.createSemester(body);
    ok(res, { semester }, 201);
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", requireAuth, requireRole("ENCARGADO"), validateParams(validators.idParamsSchema), validateBody(validators.updateSemesterSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const body = getBody<UpdateSemesterInput>(req);
    const semester = await semesterService.updateSemester(id, body);
    ok(res, { semester }, 200);
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, requireRole("ENCARGADO"), validateParams(validators.idParamsSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    await semesterService.deleteSemester(id);
    noContent(res);
  } catch (e) {
    next(e);
  }
});

router.post("/:id/activate", requireAuth, requireRole("ENCARGADO"), validateParams(validators.idParamsSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const semester = await semesterService.activateSemester(id);
    ok(res, { semester }, 200);
  } catch (e) {
    next(e);
  }
});

function getBody<T>(req: import("express").Request): T {
  return req.validated?.body as T;
}

export default router;