import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { ApiError, ApiErrors } from "../utils/errors";

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    const details = err.issues.map(i => ({
      field: i.path.join("."),
      message: i.message,
    }));
    const apiErr = ApiErrors.validation(details);
    return res.status(apiErr.status).json({ error: { code: apiErr.code, message: apiErr.message, details: apiErr.details } });
  }

  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = err.meta?.target;
      if (Array.isArray(target)) {
        const field = target.join(",");
        if (field.includes("email")) return res.status(409).json({ error: { code: "EMAIL_IN_USE", message: "Ese email ya está registrado" } });
        if (field.includes("code")) return res.status(409).json({ error: { code: "CLASSROOM_CODE_IN_USE", message: "Ya existe un aula con ese código" } });
        if (field.includes("classroomId") && field.includes("semesterId") && field.includes("dayOfWeek") && field.includes("timeSlotId")) {
          return res.status(409).json({ error: { code: "RESERVATION_CONFLICT", message: "Ese turno ya está ocupado en esta aula" } });
        }
      }
      return res.status(409).json({ error: { code: "RESERVATION_CONFLICT", message: "Conflicto de reserva" } });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "El recurso no existe" } });
    }
    if (err.code === "P2003") {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Referencia inexistente" } });
    }
  }

  console.error("Unhandled error:", err);
  const apiErr = ApiErrors.internal();
  return res.status(apiErr.status).json({ error: { code: apiErr.code, message: apiErr.message } });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Ruta no encontrada" } });
}