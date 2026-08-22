import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { requireAuth, requireRole } from "../middleware/auth";
import * as offeringService from "../services/courseOffering.service";

const router = Router();

const listOfferingsSchema = z.object({
  semesterId: z.string().min(1),
  subjectId: z.string().min(1).optional(),
  includeInactive: z.enum(["true", "false"]).optional(),
});

router.get("/", requireAuth, validate(listOfferingsSchema, "query"), async (req, res, next) => {
  try {
    const includeInactive = req.user!.role === "ENCARGADO" && req.query.includeInactive === "true";
    const offerings = await offeringService.listOfferings({
      semesterId: req.query.semesterId as string,
      subjectId: req.query.subjectId as string | undefined,
      includeInactive,
    });
    res.status(200).json({ offerings });
  } catch (e) {
    next(e);
  }
});

router.get("/:id", requireAuth, validate(z.object({ id: z.string().min(1) }), "params"), async (req, res, next) => {
  try {
    const offering = await offeringService.getOffering(req.params.id as string);
    res.status(200).json({ offering });
  } catch (e) {
    next(e);
  }
});

const createOfferingSchema = z.object({
  semesterId: z.string().min(1),
  subjectId: z.string().min(1),
  teacherId: z.string().min(1).nullish(),
  section: z.string().min(1).max(20).transform(s => s.trim()),
  type: z.enum(["CLASE", "EXTRACURRICULAR", "ACTIVIDAD"]).optional(),
  note: z.string().max(500).trim().nullish(),
});

router.post("/", requireAuth, requireRole("ENCARGADO"), validate(createOfferingSchema), async (req, res, next) => {
  try {
    const offering = await offeringService.createOffering(req.body);
    res.status(201).json({ offering });
  } catch (e) {
    next(e);
  }
});

const updateOfferingSchema = z.object({
  teacherId: z.string().min(1).nullish().optional(),
  section: z.string().min(1).max(20).transform(s => s.trim()).optional(),
  type: z.enum(["CLASE", "EXTRACURRICULAR", "ACTIVIDAD"]).optional(),
  active: z.boolean().optional(),
  note: z.string().max(500).trim().nullish().optional(),
}).refine(obj => Object.keys(obj).length > 0, { message: "Al menos un campo requerido" });

router.patch("/:id", requireAuth, requireRole("ENCARGADO"), validate(updateOfferingSchema), validate(z.object({ id: z.string().min(1) }), "params"), async (req, res, next) => {
  try {
    const offering = await offeringService.updateOffering(req.params.id as string, req.body);
    res.status(200).json({ offering });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, requireRole("ENCARGADO"), validate(z.object({ id: z.string().min(1) }), "params"), async (req, res, next) => {
  try {
    await offeringService.deleteOffering(req.params.id as string);
    res.status(200).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
