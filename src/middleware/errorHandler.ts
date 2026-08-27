import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { ApiError, ApiErrors } from "../utils/errors";
import { uniqueViolationColumns } from "../utils/dbErrors";

function toBody(err: ApiError) {
  return { error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } };
}

function mapUniqueTarget(target: string[]): ApiError | null {
  const has = (col: string) => target.includes(col);
  if (has("email")) return ApiErrors.emailInUse();
  if (has("code") && !has("classroomId")) return ApiErrors.classroomCodeInUse();
  if (has("order")) return ApiErrors.timeSlotOrderInUse();
  const isRecurring = has("classroomId") && has("semesterId") && has("timeSlotId") && has("dayOfWeek") && !has("date");
  const isPunctual = has("classroomId") && has("semesterId") && has("timeSlotId") && has("date") && !has("dayOfWeek");
  if (isRecurring || isPunctual) return ApiErrors.reservationConflict();
  if (has("classroomId") && has("semesterId") && has("dayOfWeek") && has("timeSlotId") && !has("date")) {
    return ApiErrors.conflict();
  }
  return null;
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const details = err.issues.map(i => ({
      field: i.path.join("."),
      message: i.message,
    }));
    return res.status(400).json(toBody(ApiErrors.validation(details)));
  }

  if (err instanceof ApiError) {
    return res.status(err.status).json(toBody(err));
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = uniqueViolationColumns(err);
      if (target) {
        const mapped = mapUniqueTarget(target);
        if (mapped) return res.status(mapped.status).json(toBody(mapped));
      }
      return res.status(409).json(toBody(ApiErrors.conflict()));
    }
    if (err.code === "P2025") {
      return res.status(404).json(toBody(ApiErrors.notFound()));
    }
    if (err.code === "P2003") {
      return res.status(400).json(toBody(ApiErrors.conflict()));
    }
  }

  console.error(`[ERROR] ${req.method} ${req.originalUrl}`, err);
  return res.status(500).json(toBody(ApiErrors.internal()));
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json(toBody(ApiErrors.notFound("Ruta no encontrada")));
}
