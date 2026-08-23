import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { ok } from "../utils/responses";
import * as statsService from "../services/stats.service";

const router = Router();

router.get("/overview", requireAuth, async (_req, res, next) => {
  try {
    const stats = await statsService.getOverview();
    ok(res, stats, 200);
  } catch (e) {
    next(e);
  }
});

export default router;