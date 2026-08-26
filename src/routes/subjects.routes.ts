import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody, validateParams, validateQuery, getQuery, getParams } from "../middleware/validate";
import { ok, noContent, paginatedCached } from "../utils/responses";
import * as subjectService from "../services/subject.service";
import type { ListSubjectsQuery, CreateSubjectInput, UpdateSubjectInput } from "../validators/subject.schema";
import type { ListSubjectsOptions } from "../services/subject.service";
import * as validators from "../validators/subject.schema";

const router = Router();

router.get("/", requireAuth, validateQuery(validators.listSubjectsQuerySchema), async (req, res, next) => {
  try {
    const query = getQuery<ListSubjectsQuery>(req);
    const includeInactive = req.user!.role === "ENCARGADO" && query.includeInactive === "true";
    const opts: ListSubjectsOptions = {
      includeInactive,
      q: query.q,
      page: query.page,
      pageSize: query.pageSize,
    };
    const result = await subjectService.listSubjects(opts);
    // Service cachea 10min (CACHE_POLICIES.subjects): private max-age acorde.
    paginatedCached(res, result.items, result.meta, 10 * 60);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", requireAuth, validateParams(validators.idParamsSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const subject = await subjectService.getSubject(id);
    ok(res, { subject }, 200);
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAuth, requireRole("ENCARGADO"), validateBody(validators.createSubjectSchema), async (req, res, next) => {
  try {
    const body = getBody<CreateSubjectInput>(req);
    const subject = await subjectService.createSubject(body);
    ok(res, { subject }, 201);
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", requireAuth, requireRole("ENCARGADO"), validateParams(validators.idParamsSchema), validateBody(validators.updateSubjectSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const body = getBody<UpdateSubjectInput>(req);
    const subject = await subjectService.updateSubject(id, body);
    ok(res, { subject }, 200);
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, requireRole("ENCARGADO"), validateParams(validators.idParamsSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    await subjectService.deleteSubject(id);
    noContent(res);
  } catch (e) {
    next(e);
  }
});

function getBody<T>(req: import("express").Request): T {
  return req.validated?.body as T;
}

export default router;