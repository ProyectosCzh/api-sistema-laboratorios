import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import * as scheduleService from "../services/schedule.service";

const router = Router();

const listSchedulesSchema = z.object({
  classroomId: z.string().min(1),
  semesterId: z.string().min(1),
});

router.get("/", requireAuth, validate(listSchedulesSchema, "query"), async (req, res, next) => {
  try {
    const schedules = await scheduleService.listSchedules(req.query.classroomId as string, req.query.semesterId as string);
    res.status(200).json({ schedules });
  } catch (e) {
    next(e);
  }
});

const createScheduleSchema = z.object({
  classroomId: z.string().min(1),
  semesterId: z.string().min(1),
  courseOfferingId: z.string().min(1),
  dayOfWeek: z.coerce.number().int().min(1).max(6),
  timeSlotId: z.string().min(1),
  note: z.string().max(500).trim().nullish(),
});

router.post("/", requireAuth, validate(createScheduleSchema), async (req, res, next) => {
  try {
    const schedule = await scheduleService.createSchedule(req.body, req.user!.id);
    res.status(201).json({ schedule });
  } catch (e) {
    next(e);
  }
});

const updateScheduleSchema = z.object({
  classroomId: z.string().min(1).optional(),
  semesterId: z.string().min(1).optional(),
  courseOfferingId: z.string().min(1).optional(),
  dayOfWeek: z.coerce.number().int().min(1).max(6).optional(),
  timeSlotId: z.string().min(1).optional(),
  note: z.string().max(500).trim().nullish().optional(),
}).refine(obj => Object.keys(obj).length > 0, { message: "Al menos un campo requerido" });

router.patch("/:id", requireAuth, validate(updateScheduleSchema), async (req, res, next) => {
  try {
    const schedule = await scheduleService.updateSchedule(req.params.id as string, req.body, req.user!.id, req.user!.role);
    res.status(200).json({ schedule });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, validate(z.object({ id: z.string().min(1) }), "params"), async (req, res, next) => {
  try {
    await scheduleService.deleteSchedule(req.params.id as string, req.user!.id, req.user!.role);
    res.status(200).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
