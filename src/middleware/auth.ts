import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { ApiErrors } from "../utils/errors";
import { findUserCached } from "../services/user.service";
import { isSessionActive } from "../services/auth.service";
import type { UserRole } from "../types";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  /** Id de sesión (solo tokens nuevos; undefined en tokens legacy de 12h). */
  sid?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface AccessClaims {
  sub: string;
  sid?: string;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) throw ApiErrors.tokenInvalid();

    const token = auth.slice(7);
    let payload: AccessClaims;
    try {
      payload = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] }) as AccessClaims;
    } catch (e) {
      if (e instanceof jwt.TokenExpiredError) throw ApiErrors.tokenExpired();
      throw ApiErrors.tokenInvalid();
    }

    // Tokens con sid (sesiones por dispositivo): la sesión debe estar viva.
    // Los legacy sin sid conviven hasta expirar naturalmente.
    if (payload.sid && !(await isSessionActive(payload.sid))) throw ApiErrors.tokenInvalid();

    const cached = await findUserCached(payload.sub);
    if (!cached || !cached.active) throw ApiErrors.tokenInvalid();

    req.user = {
      id: cached.id,
      name: cached.name,
      email: cached.email,
      role: cached.role,
      active: cached.active,
      ...(payload.sid ? { sid: payload.sid } : {}),
    };
    next();
  } catch (e) {
    next(e);
  }
}

export function requireRole(...roles: Array<UserRole>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiErrors.tokenInvalid());
    if (!roles.includes(req.user.role)) return next(ApiErrors.forbidden());
    next();
  };
}
