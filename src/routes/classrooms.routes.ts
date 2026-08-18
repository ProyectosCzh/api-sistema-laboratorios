import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { requireAuth, requireRole } from "../middleware/auth";
import * as classroomService from "../services/classroom.service";

const router = Router();

const includeInactiveSchema = z.object({
  includeInactive: z.enum(["true", "false"]).optional(),
});

router.get("/", requireAuth, validate(includeInactiveSchema, "query"), async (req, res, next) => {
  try {
    const includeInactive = req.user!.role === "ENCARGADO" && req.query.includeInactive === "true";
    const classrooms = await classroomService.listClassrooms(includeInactive);
    res.status(200).json({ classrooms });
  } catch (e) {
    next(e);
  }
});

const createClassroomSchema = z.object({
  code: z.string().min(2).max(20).transform(s => s.trim().toUpperCase()),
  name: z.string().min(2).max(100).trim(),
  type: z.enum(["LAB_COMPUTACION", "LAB_GENERAL", "AULA"]),
  capacity: z.coerce.number().int().min(1).max(500).optional(),
  location: z.string().max(200).trim().nullish(),
});

router.post("/", requireAuth, requireRole("ENCARGADO"), validate(createClassroomSchema), async (req, res, next) => {
  try {
    const classroom = await classroomService.createClassroom(req.body);
    res.status(201).json({ classroom });
  } catch (e) {
    next(e);
  }
});

const updateClassroomSchema = z.object({
  code: z.string().min(2).max(20).transform(s => s.trim().toUpperCase()).optional(),
  name: z.string().min(2).max(100).trim().optional(),
  type: z.enum(["LAB_COMPUTACION", "LAB_GENERAL", "AULA"]).optional(),
  capacity: z.coerce.number().int().min(1).max(500).optional(),
  location: z.string().max(200).trim().nullish().optional(),
}).refine(obj => Object.keys(obj).length > 0, { message: "Al menos un campo requerido" });

router.patch("/:id", requireAuth, requireRole("ENCARGADO"), validate(updateClassroomSchema), async (req, res, next) => {
  try {
    const classroom = await classroomService.updateClassroom(req.params.id as string, req.body);
    res.status(200).json({ classroom });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, requireRole("ENCARGADO"), validate(z.object({ id: z.string().min(1) }), "params"), async (req, res, next) => {
  try {
    const classroom = await classroomService.deleteClassroom(req.params.id as string);
    res.status(200).json({ classroom });
  } catch (e) {
    next(e);
  }
});

export default router;