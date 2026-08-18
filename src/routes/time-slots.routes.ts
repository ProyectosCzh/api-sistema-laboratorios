import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import * as timeSlotService from "../services/timeSlot.service";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const timeSlots = await timeSlotService.listTimeSlots();
    res.status(200).json({ timeSlots });
  } catch (e) {
    next(e);
  }
});

export default router;