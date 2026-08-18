import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { requireAuth, requireRole } from "../middleware/auth";
import * as semesterService from "../services/semester.service";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const semesters = await semesterService.listSemesters();
    res.status(200).json({ semesters });
  } catch (e) {
    next(e);
  }
});

const createSemesterSchema = z.object({
  name: z.string().min(2).max(20).trim(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).superRefine((data, ctx) => {
  if (data.endDate <= data.startDate) {
    ctx.addIssue({ code: "custom", message: "endDate debe ser posterior a startDate", path: ["endDate"] });
  }
});

router.post("/", requireAuth, requireRole("ENCARGADO"), validate(createSemesterSchema), async (req, res, next) => {
  try {
    const semester = await semesterService.createSemester({ ...req.body, startDate: new Date(req.body.startDate), endDate: new Date(req.body.endDate) });
    res.status(201).json({ semester });
  } catch (e) {
    next(e);
  }
});

const updateSemesterSchema = z.object({
  name: z.string().min(2).max(20).trim().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).superRefine((data, ctx) => {
  if (data.startDate && data.endDate && data.endDate <= data.startDate) {
    ctx.addIssue({ code: "custom", message: "endDate debe ser posterior a startDate", path: ["endDate"] });
  }
});

router.patch("/:id", requireAuth, requireRole("ENCARGADO"), validate(updateSemesterSchema), async (req, res, next) => {
  try {
    const semester = await semesterService.updateSemester(req.params.id as string, req.body);
    res.status(200).json({ semester });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/activate", requireAuth, requireRole("ENCARGADO"), validate(z.object({ id: z.string().min(1) }), "params"), async (req, res, next) => {
  try {
    const semester = await semesterService.activateSemester(req.params.id as string);
    res.status(200).json({ semester });
  } catch (e) {
    next(e);
  }
});

export default router;