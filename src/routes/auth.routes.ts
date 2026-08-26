import { Router } from "express";
import type { Request } from "express";
import { requireAuth } from "../middleware/auth";
import { createLoginLimiter } from "../middleware/rateLimit";
import { validateBody, validateParams, getBody, getParams } from "../middleware/validate";
import { ok, noContent } from "../utils/responses";
import { ApiErrors } from "../utils/errors";
import * as authService from "../services/auth.service";
import { idParamsSchema } from "../validators/shared.schema";
import type { LoginInput, UpdateProfileInput, ChangePasswordInput } from "../validators/auth.schema";
import * as validators from "../validators/auth.schema";

const router = Router();

function bearerFrom(req: Request): string | undefined {
  const auth = req.headers.authorization;
  return auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
}

router.post("/login", createLoginLimiter(), validateBody(validators.loginSchema), async (req, res, next) => {
  try {
    const { email, password } = getBody<LoginInput>(req);
    const result = await authService.login(email, password, {
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });
    ok(res, result, 200);
  } catch (e) {
    next(e);
  }
});

/**
 * Rotación de refresh token. Acepta {token} en el body o la cookie lm_refresh
 * que setea el BFF Astro. Rate-limit estricto: solo dispositivos legítimos
 * deberían refrescar una vez cada ACCESS_TOKEN_TTL.
 */
router.post("/refresh", createLoginLimiter({ windowMs: 15 * 60 * 1000, max: 30 }), async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as { token?: unknown };
    const token =
      (typeof body.token === "string" && body.token.length > 0 ? body.token : undefined) ??
      req.cookies?.lm_refresh;
    if (!token) {
      next(ApiErrors.tokenInvalid());
      return;
    }
    const result = await authService.refresh(token);
    ok(res, result, 200);
  } catch (e) {
    next(e);
  }
});

/** Logout tolerante: revoca la sesión del access token si es válido y responde siempre 204. */
router.post("/logout", async (req, res, next) => {
  try {
    const token = bearerFrom(req) ?? req.cookies?.lm_access;
    await authService.logoutWithAccessToken(token);
    noContent(res);
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
    const user = await authService.changePassword(req.user!.id, data, req.user!.sid);
    ok(res, { user }, 200);
  } catch (e) {
    next(e);
  }
});

router.get("/sessions", requireAuth, async (req, res, next) => {
  try {
    const sessions = await authService.listSessions(req.user!.id, req.user!.sid);
    ok(res, { sessions }, 200);
  } catch (e) {
    next(e);
  }
});

router.delete(
  "/sessions/:id",
  requireAuth,
  validateParams(idParamsSchema),
  async (req, res, next) => {
    try {
      const { id } = getParams<{ id: string }>(req);
      await authService.revokeSession(req.user!.id, id);
      noContent(res);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
