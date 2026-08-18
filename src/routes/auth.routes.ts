import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import * as authService from "../services/auth.service";
import { ApiErrors } from "../utils/errors";

const router = Router();

const loginSchema = z.object({
  email: z.email().max(254).transform(e => e.toLowerCase()),
  password: z.string().min(1).max(100),
});

router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.status(200).json(result);
  } catch (e) {
    next(e);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await authService.me(req.user!.id);
    res.status(200).json({ user });
  } catch (e) {
    next(e);
  }
});

export default router;