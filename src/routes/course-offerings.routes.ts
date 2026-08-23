import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody, validateParams, validateQuery, getQuery, getParams } from "../middleware/validate";
import { ok, paginated, noContent } from "../utils/responses";
import * as offeringService from "../services/courseOffering.service";
import type { ListOfferingsQuery, CreateOfferingInput, UpdateOfferingInput } from "../validators/courseOffering.schema";
import type { ListOfferingsOptions } from "../services/courseOffering.service";
import * as validators from "../validators/courseOffering.schema";

const router = Router();

router.get("/", requireAuth, validateQuery(validators.listOfferingsQuerySchema), async (req, res, next) => {
  try {
    const query = getQuery<ListOfferingsQuery>(req);
    const includeInactive = req.user!.role === "ENCARGADO" && query.includeInactive === "true";
    const opts: ListOfferingsOptions = {
      semesterId: query.semesterId,
      subjectId: query.subjectId,
      includeInactive,
      page: query.page,
      pageSize: query.pageSize,
    };
    const result = await offeringService.listOfferings(opts);
    paginated(res, result.items, result.meta);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", requireAuth, validateParams(validators.idParamsSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const offering = await offeringService.getOffering(id);
    ok(res, { offering }, 200);
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAuth, requireRole("ENCARGADO"), validateBody(validators.createOfferingSchema), async (req, res, next) => {
  try {
    const body = getBody<CreateOfferingInput>(req);
    const offering = await offeringService.createOffering(body);
    ok(res, { offering }, 201);
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", requireAuth, requireRole("ENCARGADO"), validateParams(validators.idParamsSchema), validateBody(validators.updateOfferingSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    const body = getBody<UpdateOfferingInput>(req);
    const offering = await offeringService.updateOffering(id, body);
    ok(res, { offering }, 200);
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, requireRole("ENCARGADO"), validateParams(validators.idParamsSchema), async (req, res, next) => {
  try {
    const { id } = getParams(req);
    await offeringService.deleteOffering(id);
    noContent(res);
  } catch (e) {
    next(e);
  }
});

function getBody<T>(req: import("express").Request): T {
  return req.validated?.body as T;
}

export default router;