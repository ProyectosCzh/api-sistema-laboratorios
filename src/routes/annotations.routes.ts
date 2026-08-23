import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { validateBody, validateParams, validateQuery, getQuery, getParams } from "../middleware/validate";
import { ok, paginated, noContent } from "../utils/responses";
import * as annotationService from "../services/annotation.service";
import type { ListAnnotationsQuery, CreateAnnotationInput, UpdateAnnotationInput } from "../validators/annotation.schema";
import * as validators from "../validators/annotation.schema";

const router = Router();

router.get("/", requireAuth, validateQuery(validators.listAnnotationsQuerySchema), async (req, res, next) => {
  try {
    const query = getQuery<ListAnnotationsQuery>(req);
    const opts = {
      classroomId: query.classroomId,
      from: query.from,
      to: query.to,
      page: query.page,
      pageSize: query.pageSize,
    };
    const result = await annotationService.listAnnotations(opts);
    paginated(res, result.items, result.meta);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", requireAuth, validateParams(validators.idParamsSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const annotation = await annotationService.getAnnotation(id);
    ok(res, { annotation }, 200);
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAuth, validateBody(validators.createAnnotationSchema), async (req, res, next) => {
  try {
    const body = getBody<CreateAnnotationInput>(req);
    const annotation = await annotationService.createAnnotation(body.classroomId, body.content, req.user!.id);
    ok(res, { annotation }, 201);
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", requireAuth, validateParams(validators.idParamsSchema), validateBody(validators.updateAnnotationSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const body = getBody<UpdateAnnotationInput>(req);
    const annotation = await annotationService.updateAnnotation(id, body, req.user!.id, req.user!.role);
    ok(res, { annotation }, 200);
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, validateParams(validators.idParamsSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    await annotationService.deleteAnnotation(id, req.user!.id, req.user!.role);
    noContent(res);
  } catch (e) {
    next(e);
  }
});

function getBody<T>(req: import("express").Request): T {
  return req.validated?.body as T;
}

export default router;