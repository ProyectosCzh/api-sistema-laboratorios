import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody, validateParams, validateQuery, getQuery, getParams, getBody } from "../middleware/validate";
import { ok, paginatedCached } from "../utils/responses";
import * as classroomService from "../services/classroom.service";
import * as availabilityService from "../services/availability.service";
import type { ListClassroomsQuery, CreateClassroomInput, UpdateClassroomInput } from "../validators/classroom.schema";
import type { ListClassroomsOptions } from "../services/classroom.service";
import * as validators from "../validators/classroom.schema";
import { stateQuerySchema } from "../validators/classroom.schema";

const router = Router();

router.get("/", requireAuth, validateQuery(validators.listClassroomsQuerySchema), async (req, res, next) => {
  try {
    const query = getQuery<ListClassroomsQuery>(req);
    const includeInactive = req.user!.role === "ENCARGADO" && query.includeInactive === "true";
    const opts: ListClassroomsOptions = {
      includeInactive,
      status: query.status,
      q: query.q,
      page: query.page,
      pageSize: query.pageSize,
    };
    const result = await classroomService.listClassrooms(opts);
    // Service cachea 5min (CACHE_POLICIES.classrooms): private max-age acorde.
    paginatedCached(res, result.items, result.meta, 5 * 60);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", requireAuth, validateParams(validators.idParamsSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const classroom = await classroomService.getClassroom(id);
    ok(res, { classroom }, 200);
  } catch (e) {
    next(e);
  }
});

/// Estado del aula según el documento base: LIBRE | OCUPADA | MANTENIMIENTO.
router.get("/:id/state", requireAuth, validateParams(validators.idParamsSchema), validateQuery(stateQuerySchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const query = getQuery<{ date?: Date; timeSlotId?: string }>(req);
    const state = await availabilityService.getClassroomState(id, {
      date: query.date,
      timeSlotId: query.timeSlotId,
    });
    ok(res, state, 200);
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAuth, requireRole("ENCARGADO"), validateBody(validators.createClassroomSchema), async (req, res, next) => {
  try {
    const body = getBody<CreateClassroomInput>(req);
    const classroom = await classroomService.createClassroom(body);
    ok(res, { classroom }, 201);
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", requireAuth, requireRole("ENCARGADO"), validateParams(validators.idParamsSchema), validateBody(validators.updateClassroomSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const body = getBody<UpdateClassroomInput>(req);
    const { classroom, warnings } = await classroomService.updateClassroom(id, body);
    ok(res, { classroom, warnings }, 200);
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, requireRole("ENCARGADO"), validateParams(validators.idParamsSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const { warnings } = await classroomService.deleteClassroom(id);
    ok(res, { warnings }, 200);
  } catch (e) {
    next(e);
  }
});

export default router;