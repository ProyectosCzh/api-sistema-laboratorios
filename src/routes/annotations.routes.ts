import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import * as annotationService from "../services/annotation.service";

const router = Router();

const listAnnotationsSchema = z.object({
  classroomId: z.string().min(1),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

router.get("/", requireAuth, validate(listAnnotationsSchema, "query"), async (req, res, next) => {
  try {
    const annotations = await annotationService.listAnnotations(
      req.query.classroomId as string,
      req.query.from ? new Date(req.query.from as string) : undefined,
      req.query.to ? new Date(req.query.to as string) : undefined
    );
    res.status(200).json({ annotations });
  } catch (e) {
    next(e);
  }
});

const createAnnotationSchema = z.object({
  classroomId: z.string().min(1),
  content: z.string().min(1).max(1000).trim(),
});

router.post("/", requireAuth, validate(createAnnotationSchema), async (req, res, next) => {
  try {
    const annotation = await annotationService.createAnnotation(req.body.classroomId, req.body.content, req.user!.id);
    res.status(201).json({ annotation });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, validate(z.object({ id: z.string().min(1) }), "params"), async (req, res, next) => {
  try {
    await annotationService.deleteAnnotation(req.params.id as string, req.user!.id, req.user!.role);
    res.status(200).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;