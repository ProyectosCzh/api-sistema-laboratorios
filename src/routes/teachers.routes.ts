import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { requireAuth, requireRole } from "../middleware/auth";
import * as teacherService from "../services/teacher.service";

const router = Router();

const listTeachersSchema = z.object({
  includeInactive: z.enum(["true", "false"]).optional(),
});

router.get("/", requireAuth, validate(listTeachersSchema, "query"), async (req, res, next) => {
  try {
    const includeInactive = req.user!.role === "ENCARGADO" && req.query.includeInactive === "true";
    const teachers = await teacherService.listTeachers(includeInactive);
    res.status(200).json({ teachers });
  } catch (e) {
    next(e);
  }
});

router.get("/:id", requireAuth, validate(z.object({ id: z.string().min(1) }), "params"), async (req, res, next) => {
  try {
    const teacher = await teacherService.getTeacher(req.params.id as string);
    res.status(200).json({ teacher });
  } catch (e) {
    next(e);
  }
});

const createTeacherSchema = z.object({
  code: z.string().min(2).max(30).transform(s => s.trim().toUpperCase()),
  name: z.string().min(2).max(120).trim(),
  email: z.string().email().nullish(),
});

router.post("/", requireAuth, requireRole("ENCARGADO"), validate(createTeacherSchema), async (req, res, next) => {
  try {
    const teacher = await teacherService.createTeacher(req.body);
    res.status(201).json({ teacher });
  } catch (e) {
    next(e);
  }
});

const updateTeacherSchema = z.object({
  name: z.string().min(2).max(120).trim().optional(),
  email: z.string().email().nullish().optional(),
  active: z.boolean().optional(),
}).refine(obj => Object.keys(obj).length > 0, { message: "Al menos un campo requerido" });

router.patch("/:id", requireAuth, requireRole("ENCARGADO"), validate(updateTeacherSchema), validate(z.object({ id: z.string().min(1) }), "params"), async (req, res, next) => {
  try {
    const teacher = await teacherService.updateTeacher(req.params.id as string, req.body);
    res.status(200).json({ teacher });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, requireRole("ENCARGADO"), validate(z.object({ id: z.string().min(1) }), "params"), async (req, res, next) => {
  try {
    await teacherService.deleteTeacher(req.params.id as string);
    res.status(200).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
