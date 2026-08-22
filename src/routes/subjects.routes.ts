import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { requireAuth, requireRole } from "../middleware/auth";
import * as subjectService from "../services/subject.service";

const router = Router();

const listSubjectsSchema = z.object({
  includeInactive: z.enum(["true", "false"]).optional(),
});

router.get("/", requireAuth, validate(listSubjectsSchema, "query"), async (req, res, next) => {
  try {
    const includeInactive = req.user!.role === "ENCARGADO" && req.query.includeInactive === "true";
    const subjects = await subjectService.listSubjects(includeInactive);
    res.status(200).json({ subjects });
  } catch (e) {
    next(e);
  }
});

router.get("/:id", requireAuth, validate(z.object({ id: z.string().min(1) }), "params"), async (req, res, next) => {
  try {
    const subject = await subjectService.getSubject(req.params.id as string);
    res.status(200).json({ subject });
  } catch (e) {
    next(e);
  }
});

const createSubjectSchema = z.object({
  code: z.string().min(2).max(20).transform(s => s.trim().toUpperCase()),
  name: z.string().min(2).max(120).trim(),
});

router.post("/", requireAuth, requireRole("ENCARGADO"), validate(createSubjectSchema), async (req, res, next) => {
  try {
    const subject = await subjectService.createSubject(req.body);
    res.status(201).json({ subject });
  } catch (e) {
    next(e);
  }
});

const updateSubjectSchema = z.object({
  name: z.string().min(2).max(120).trim().optional(),
  active: z.boolean().optional(),
}).refine(obj => Object.keys(obj).length > 0, { message: "Al menos un campo requerido" });

router.patch("/:id", requireAuth, requireRole("ENCARGADO"), validate(updateSubjectSchema), validate(z.object({ id: z.string().min(1) }), "params"), async (req, res, next) => {
  try {
    const subject = await subjectService.updateSubject(req.params.id as string, req.body);
    res.status(200).json({ subject });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, requireRole("ENCARGADO"), validate(z.object({ id: z.string().min(1) }), "params"), async (req, res, next) => {
  try {
    await subjectService.deleteSubject(req.params.id as string);
    res.status(200).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
