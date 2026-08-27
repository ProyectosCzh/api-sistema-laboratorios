import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { validateBody, validateParams, validateQuery, getQuery, getParams, getBody } from "../middleware/validate";
import { ok, noContent } from "../utils/responses";
import * as scheduleService from "../services/schedule.service";
import type { ListSchedulesQuery, CreateScheduleInput, UpdateScheduleInput } from "../validators/schedule.schema";
import * as validators from "../validators/schedule.schema";

const router = Router();

router.get("/", requireAuth, validateQuery(validators.listSchedulesQuerySchema), async (req, res, next) => {
  try {
    const query = getQuery<ListSchedulesQuery>(req);
    const schedules = await scheduleService.listSchedules(query.classroomId, query.semesterId);
    ok(res, schedules, 200);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", requireAuth, validateParams(validators.idParamsSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const schedule = await scheduleService.getSchedule(id);
    ok(res, { schedule }, 200);
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAuth, validateBody(validators.createScheduleSchema), async (req, res, next) => {
  try {
    const body = getBody<CreateScheduleInput>(req);
    const schedule = await scheduleService.createSchedule(body, req.user!.id);
    ok(res, { schedule }, 201);
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", requireAuth, validateParams(validators.idParamsSchema), validateBody(validators.updateScheduleSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const body = getBody<UpdateScheduleInput>(req);
    const schedule = await scheduleService.updateSchedule(id, body, req.user!.id, req.user!.role);
    ok(res, { schedule }, 200);
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, validateParams(validators.idParamsSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    await scheduleService.deleteSchedule(id, req.user!.id, req.user!.role);
    noContent(res);
  } catch (e) {
    next(e);
  }
});

export default router;