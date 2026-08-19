import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { ApiErrors } from "../utils/errors";
import type { UserRole } from "../types";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) throw ApiErrors.tokenInvalid();

    const token = auth.slice(7);
    let payload: { sub: string };
    try {
      payload = jwt.verify(token, env.jwtSecret) as { sub: string };
    } catch (e) {
      if (e instanceof jwt.TokenExpiredError) throw ApiErrors.tokenExpired();
      throw ApiErrors.tokenInvalid();
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active) throw ApiErrors.tokenInvalid();

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      active: user.active,
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