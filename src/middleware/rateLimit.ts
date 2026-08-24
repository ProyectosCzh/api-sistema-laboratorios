import { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { ApiErrors } from "../utils/errors";

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_LOGIN_MAX = 20;
const DEFAULT_GLOBAL_MAX = 300;

function jsonHandler(_req: Request, res: Response) {
  const apiErr = ApiErrors.rateLimited();
  res.status(apiErr.status).json({ error: { code: apiErr.code, message: apiErr.message } });
}

export function createLoginLimiter(options?: { windowMs?: number; max?: number }) {
  return rateLimit({
    windowMs: options?.windowMs ?? DEFAULT_WINDOW_MS,
    limit: options?.max ?? DEFAULT_LOGIN_MAX,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: jsonHandler,
  });
}

export function createGlobalLimiter() {
  return rateLimit({
    windowMs: DEFAULT_WINDOW_MS,
    limit: DEFAULT_GLOBAL_MAX,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: req => req.path === "/health" || req.path === "/openapi.json",
    handler: jsonHandler,
  });
}
