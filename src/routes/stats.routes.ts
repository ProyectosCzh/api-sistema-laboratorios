import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { okCached } from "../utils/responses";
import * as statsService from "../services/stats.service";

const router = Router();

router.get("/overview", requireAuth, async (_req, res, next) => {
  try {
    const stats = await statsService.getOverview();
    // Service cachea 60s (CACHE_POLICIES.statsOverview): private max-age acorde.
    okCached(res, stats, 60);
  } catch (e) {
    next(e);
  }
});

export default router;