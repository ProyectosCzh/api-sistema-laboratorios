import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody, validateParams, validateQuery, getQuery, getParams, getBody } from "../middleware/validate";
import { ok, paginated, noContent } from "../utils/responses";
import * as reservationService from "../services/reservation.service";
import type {
  ListReservationsQuery,
  CreateReservationInput,
  UpdateReservationInput,
  UpdateReservationStatusInput,
} from "../validators/reservation.schema";
import * as validators from "../validators/reservation.schema";

const router = Router();

router.get("/", requireAuth, validateQuery(validators.listReservationsQuerySchema), async (req, res, next) => {
  try {
    const query = getQuery<ListReservationsQuery>(req);
    const result = await reservationService.listReservations(
      {
        status: query.status,
        classroomId: query.classroomId,
        semesterId: query.semesterId,
        type: query.type,
        page: query.page,
        pageSize: query.pageSize,
      },
      { role: req.user!.role, id: req.user!.id }
    );
    paginated(res, result.items, result.meta);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", requireAuth, validateParams(validators.idParamsSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const reservation = await reservationService.getReservation(id, { role: req.user!.role, id: req.user!.id });
    ok(res, { reservation }, 200);
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAuth, validateBody(validators.createReservationSchema), async (req, res, next) => {
  try {
    const data = getBody<CreateReservationInput>(req);
    const reservation = await reservationService.createReservation(data, req.user!.id);
    ok(res, { reservation }, 201);
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", requireAuth, validateParams(validators.idParamsSchema), validateBody(validators.updateReservationSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const data = getBody<UpdateReservationInput>(req);
    const reservation = await reservationService.updateReservation(id, data, { role: req.user!.role, id: req.user!.id });
    ok(res, { reservation }, 200);
  } catch (e) {
    next(e);
  }
});

/// Confirmación / cancelación. El Encargado gestiona cualquier reserva;
/// un Ayudante solo puede cancelar la propia mientras esté pendiente.
router.patch("/:id/status", requireAuth, validateParams(validators.idParamsSchema), validateBody(validators.updateReservationStatusSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const { status } = getBody<UpdateReservationStatusInput>(req);
    const reservation = await reservationService.updateReservationStatus(id, status, { role: req.user!.role, id: req.user!.id });
    ok(res, { reservation }, 200);
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, requireRole("ENCARGADO"), validateParams(validators.idParamsSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    await reservationService.deleteReservation(id);
    noContent(res);
  } catch (e) {
    next(e);
  }
});

export default router;
