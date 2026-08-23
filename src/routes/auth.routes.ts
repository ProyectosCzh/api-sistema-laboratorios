import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { createLoginLimiter } from "../middleware/rateLimit";
import { validateBody } from "../middleware/validate";
import { ok } from "../utils/responses";
import * as authService from "../services/auth.service";
import type { LoginInput, UpdateProfileInput, ChangePasswordInput } from "../validators/auth.schema";
import * as validators from "../validators/auth.schema";

const router = Router();

router.post("/login", createLoginLimiter(), validateBody(validators.loginSchema), async (req, res, next) => {
  try {
    const { email, password } = getBody<LoginInput>(req);
    const result = await authService.login(email, password);
    ok(res, result, 200);
  } catch (e) {
    next(e);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await authService.me(req.user!.id);
    ok(res, { user }, 200);
  } catch (e) {
    next(e);
  }
});

router.patch("/me", requireAuth, validateBody(validators.updateProfileSchema), async (req, res, next) => {
  try {
    const data = getBody<UpdateProfileInput>(req);
    const user = await authService.updateProfile(req.user!.id, data);
    ok(res, { user }, 200);
  } catch (e) {
    next(e);
  }
});

router.patch("/me/password", requireAuth, validateBody(validators.changePasswordSchema), async (req, res, next) => {
  try {
    const data = getBody<ChangePasswordInput>(req);
    const user = await authService.changePassword(req.user!.id, data);
    ok(res, { user }, 200);
  } catch (e) {
    next(e);
  }
});

function getBody<T>(req: import("express").Request): T {
  return req.validated?.body as T;
}

export default router;