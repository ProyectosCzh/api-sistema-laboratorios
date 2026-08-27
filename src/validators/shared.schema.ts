import { z } from "zod";

export const idParamsSchema = z.object({
  id: z.string().min(1).regex(/^c[a-z0-9]{24,}$/, "ID inválido"),
});

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
export const maintenanceStatusSchema = z.enum(["REPORTADO", "EN_PROGRESO", "COMPLETADO"]);
export const reservationTypeSchema = z.enum(["RECURRENTE", "PUNTUAL"]);
export const reservationStatusSchema = z.enum(["PENDIENTE", "CONFIRMADA", "CANCELADA"]);

/// 1 = Lunes ... 6 = Sábado (semana hábil del documento base)
export const dayOfWeekSchema = z.coerce.number().int().min(1).max(6);

export const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Debe tener formato HH:mm (24h)");

export const gridQuerySchema = z.object({
  semesterId: z.string().min(1),
  classroomId: z.string().min(1).optional(),
  includePuntual: z.enum(["true", "false"]).optional(),
});
