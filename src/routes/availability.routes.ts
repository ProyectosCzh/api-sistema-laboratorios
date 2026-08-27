import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { validateQuery, getQuery } from "../middleware/validate";
import { okCached } from "../utils/responses";
import * as availabilityService from "../services/availability.service";
import { gridQuerySchema } from "../validators/shared.schema";

const router = Router();

/// Tabla Semanal de Disponibilidad (núcleo del sistema según el documento base).
router.get("/grid", requireAuth, validateQuery(gridQuerySchema), async (req, res, next) => {
  try {
    const query = getQuery<{
      semesterId: string;
      classroomId?: string;
      includePuntual?: "true" | "false";
    }>(req);
    const grid = await availabilityService.getAvailabilityGrid({
      semesterId: query.semesterId,
      classroomId: query.classroomId,
      includePuntual: query.includePuntual !== "false",
    });
    // Service cachea 20s con SWR (CACHE_POLICIES.grid): max-age corto acorde.
    okCached(res, grid, 20);
  } catch (e) {
    next(e);
  }
});

export default router;
