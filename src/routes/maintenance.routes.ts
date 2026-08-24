import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody, validateParams, validateQuery, getQuery, getParams } from "../middleware/validate";
import { ok, paginated, noContent } from "../utils/responses";
import * as maintenanceService from "../services/maintenance.service";
import type { ListMaintenanceQuery, CreateMaintenanceInput, UpdateMaintenanceInput } from "../validators/maintenance.schema";
import type { ListMaintenanceOptions } from "../services/maintenance.service";
import * as validators from "../validators/maintenance.schema";

const router = Router();

router.get("/", requireAuth, validateQuery(validators.listMaintenanceQuerySchema), async (req, res, next) => {
  try {
    const query = getQuery<ListMaintenanceQuery>(req);
    const opts: ListMaintenanceOptions = {
      classroomId: query.classroomId,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    };
    const result = await maintenanceService.listMaintenance(opts);
    paginated(res, result.items, result.meta);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", requireAuth, validateParams(validators.idParamsSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const maintenance = await maintenanceService.getMaintenance(id);
    ok(res, { maintenance }, 200);
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAuth, validateBody(validators.createMaintenanceSchema), async (req, res, next) => {
  try {
    const body = getBody<CreateMaintenanceInput>(req);
    const maintenance = await maintenanceService.createMaintenance(body.classroomId, body.date, body.reason, req.user!.id);
    ok(res, { maintenance }, 201);
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", requireAuth, requireRole("ENCARGADO"), validateParams(validators.idParamsSchema), validateBody(validators.updateMaintenanceSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const body = getBody<UpdateMaintenanceInput>(req);
    const maintenance = await maintenanceService.updateMaintenance(id, body.status);
    ok(res, { maintenance }, 200);
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, requireRole("ENCARGADO"), validateParams(validators.idParamsSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    await maintenanceService.deleteMaintenance(id);
    noContent(res);
  } catch (e) {
    next(e);
  }
});

function getBody<T>(req: import("express").Request): T {
  return req.validated?.body as T;
}

export default router;