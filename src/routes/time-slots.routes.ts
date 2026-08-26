import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody, validateParams, getBody, getParams } from "../middleware/validate";
import { ok, noContent, okCached } from "../utils/responses";
import * as timeSlotService from "../services/timeSlot.service";
import type { CreateTimeSlotInput, UpdateTimeSlotInput } from "../validators/timeSlot.schema";
import * as validators from "../validators/timeSlot.schema";

const router = Router();

router.get("/", requireAuth, async (_req, res, next) => {
  try {
    const timeSlots = await timeSlotService.listTimeSlots();
    // Service cachea 10min (CACHE_POLICIES.timeSlots): private max-age acorde.
    okCached(res, timeSlots, 10 * 60);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", requireAuth, validateParams(validators.idParamsSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const timeSlot = await timeSlotService.getTimeSlot(id);
    ok(res, { timeSlot }, 200);
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAuth, requireRole("ENCARGADO"), validateBody(validators.createTimeSlotSchema), async (req, res, next) => {
  try {
    const body = getBody<CreateTimeSlotInput>(req);
    const timeSlot = await timeSlotService.createTimeSlot(body);
    ok(res, { timeSlot }, 201);
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", requireAuth, requireRole("ENCARGADO"), validateParams(validators.idParamsSchema), validateBody(validators.updateTimeSlotSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const body = getBody<UpdateTimeSlotInput>(req);
    const timeSlot = await timeSlotService.updateTimeSlot(id, body);
    ok(res, { timeSlot }, 200);
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, requireRole("ENCARGADO"), validateParams(validators.idParamsSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    await timeSlotService.deleteTimeSlot(id);
    noContent(res);
  } catch (e) {
    next(e);
  }
});

export default router;