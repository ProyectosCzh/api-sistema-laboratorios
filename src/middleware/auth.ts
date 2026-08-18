import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { ApiErrors } from "../utils/errors";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "ENCARGADO" | "AYUDANTE";
  active: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) throw ApiErrors.tokenInvalid();

    const token = auth.slice(7);
    let payload: { sub: string; role: string };
    try {
      payload = jwt.verify(token, env.jwtSecret) as { sub: string; role: string };
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
      role: user.role as "ENCARGADO" | "AYUDANTE",
      active: user.active,
    };
    next();
  } catch (e) {
    next(e);
  }
}

export function requireRole(...roles: Array<"ENCARGADO" | "AYUDANTE">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiErrors.tokenInvalid());
    if (!roles.includes(req.user.role)) return next(ApiErrors.forbidden());
    next();
  };
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return next();

  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string; role: string };
    prisma.user.findUnique({ where: { id: payload.sub } }).then(user => {
      if (user && user.active) {
        req.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as "ENCARGADO" | "AYUDANTE",
          active: user.active,
        };
      }
      next();
    });
  } catch {
    next();
  }
}