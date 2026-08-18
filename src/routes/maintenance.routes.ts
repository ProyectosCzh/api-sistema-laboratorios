import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { requireAuth, requireRole } from "../middleware/auth";
import * as maintenanceService from "../services/maintenance.service";

const router = Router();

const listMaintenanceSchema = z.object({
  classroomId: z.string().min(1).optional(),
  status: z.enum(["REPORTADO", "EN_PROGRESO", "COMPLETADO"]).optional(),
});

router.get("/", requireAuth, validate(listMaintenanceSchema, "query"), async (req, res, next) => {
  try {
    const maintenance = await maintenanceService.listMaintenance(req.query.classroomId as string | undefined, req.query.status as "REPORTADO" | "EN_PROGRESO" | "COMPLETADO" | undefined);
    res.status(200).json({ maintenance });
  } catch (e) {
    next(e);
  }
});

const createMaintenanceSchema = z.object({
  classroomId: z.string().min(1),
  date: z.coerce.date(),
  reason: z.string().min(3).max(500).trim(),
});

router.post("/", requireAuth, validate(createMaintenanceSchema), async (req, res, next) => {
  try {
    const maintenance = await maintenanceService.createMaintenance(req.body.classroomId, new Date(req.body.date), req.body.reason, req.user!.id);
    res.status(201).json({ maintenance });
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", requireAuth, requireRole("ENCARGADO"), validate(z.object({ id: z.string().min(1) }), "params"), validate(z.object({ status: z.enum(["REPORTADO", "EN_PROGRESO", "COMPLETADO"]) })), async (req, res, next) => {
  try {
    const maintenance = await maintenanceService.updateMaintenance(req.params.id as string, req.body.status);
    res.status(200).json({ maintenance });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, requireRole("ENCARGADO"), validate(z.object({ id: z.string().min(1) }), "params"), async (req, res, next) => {
  try {
    await maintenanceService.deleteMaintenance(req.params.id as string);
    res.status(200).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;