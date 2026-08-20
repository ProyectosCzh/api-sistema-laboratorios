import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { ApiError, ApiErrors } from "../utils/errors";

function toBody(err: ApiError) {
  return { error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } };
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
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
      const target = err.meta?.target;
      if (Array.isArray(target)) {
        const field = target.join(",");
        if (field.includes("email")) return res.status(409).json(toBody(ApiErrors.emailInUse()));
        if (field.includes("code")) return res.status(409).json(toBody(ApiErrors.classroomCodeInUse()));
        if (field.includes("classroomId") && field.includes("semesterId") && field.includes("dayOfWeek") && field.includes("timeSlotId")) {
          return res.status(409).json(toBody(ApiErrors.reservationConflict()));
        }
      }
      return res.status(409).json(toBody(ApiErrors.conflict()));
    }
    if (err.code === "P2025") {
      return res.status(404).json(toBody(ApiErrors.notFound()));
    }
    if (err.code === "P2003") {
      return res.status(409).json(toBody(ApiErrors.conflict()));
    }
  }

  console.error("Unhandled error:", err);
  return res.status(500).json(toBody(ApiErrors.internal()));
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json(toBody(ApiErrors.notFound("Ruta no encontrada")));
}