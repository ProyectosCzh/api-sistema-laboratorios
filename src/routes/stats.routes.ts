import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import * as statsService from "../services/stats.service";

const router = Router();

router.get("/overview", requireAuth, async (req, res, next) => {
  try {
    const stats = await statsService.getOverview();
    res.status(200).json(stats);
  } catch (e) {
    next(e);
  }
});

export default router;