import { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { ApiErrors } from "../utils/errors";

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX = 20;

export function createLoginLimiter(options?: { windowMs?: number; max?: number }) {
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const limit = options?.max ?? (process.env.NODE_ENV === "test" ? 10_000 : DEFAULT_MAX);

  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      const apiErr = ApiErrors.rateLimited();
      res.status(apiErr.status).json({ error: { code: apiErr.code, message: apiErr.message } });
    },
  });
}