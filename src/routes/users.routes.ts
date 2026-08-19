import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { requireAuth, requireRole } from "../middleware/auth";
import * as userService from "../services/user.service";

const router = Router();

router.get("/", requireAuth, requireRole("ENCARGADO"), async (_req, res, next) => {
  try {
    const users = await userService.listUsers();
    res.status(200).json({ users });
  } catch (e) {
    next(e);
  }
});

const createUserSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.email().max(254).transform(e => e.toLowerCase()),
  password: z.string().min(8).max(100),
  role: z.enum(["ENCARGADO", "AYUDANTE"]),
});

router.post("/", requireAuth, requireRole("ENCARGADO"), validate(createUserSchema), async (req, res, next) => {
  try {
    const user = await userService.createUser(req.body);
    res.status(201).json({ user });
  } catch (e) {
    next(e);
  }
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  email: z.email().max(254).transform(e => e.toLowerCase()).optional(),
  password: z.string().min(8).max(100).optional(),
  role: z.enum(["ENCARGADO", "AYUDANTE"]).optional(),
  active: z.boolean().optional(),
}).refine(obj => Object.keys(obj).length > 0, { message: "Al menos un campo requerido" });

router.patch("/:id", requireAuth, requireRole("ENCARGADO"), validate(updateUserSchema), validate(z.object({ id: z.string().min(1) }), "params"), async (req, res, next) => {
  try {
    const user = await userService.updateUser(req.params.id as string, req.body);
    res.status(200).json({ user });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, requireRole("ENCARGADO"), validate(z.object({ id: z.string().min(1) }), "params"), async (req, res, next) => {
  try {
    await userService.deleteUser(req.params.id as string, req.user!.id);
    res.status(200).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;