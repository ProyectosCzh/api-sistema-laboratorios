import { z } from "zod";

export const idParamsSchema = z.object({ id: z.string().min(1) });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
});

export const includeInactiveQuerySchema = z.object({
  includeInactive: z.enum(["true", "false"]).optional(),
});

export const userRoleSchema = z.enum(["ENCARGADO", "AYUDANTE"]);
export const classroomTypeSchema = z.enum(["LAB_COMPUTACION", "LAB_GENERAL", "AULA"]);
export const classroomStatusSchema = z.enum(["ACTIVA", "INACTIVA", "EN_MANTENIMIENTO", "FUERA_SERVICIO"]);
export const offeringTypeSchema = z.enum(["CLASE", "EXTRACURRICULAR", "ACTIVIDAD"]);
export const maintenanceStatusSchema = z.enum(["REPORTADO", "EN_PROGRESO", "COMPLETADO"]);

export const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Debe tener formato HH:mm (24h)");
