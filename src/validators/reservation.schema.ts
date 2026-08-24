import { z } from "zod";
import { dayOfWeekSchema, reservationStatusSchema, reservationTypeSchema } from "./shared.schema";

export { idParamsSchema } from "./shared.schema";

export const listReservationsQuerySchema = z.object({
  status: reservationStatusSchema.optional(),
  classroomId: z.string().min(1).optional(),
  semesterId: z.string().min(1).optional(),
  type: reservationTypeSchema.optional(),
}).merge(z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}));

const conditionalFieldsRefine = (
  data: { type: "RECURRENTE" | "PUNTUAL"; dayOfWeek?: number; date?: Date },
  ctx: z.RefinementCtx
) => {
  if (data.type === "RECURRENTE") {
    if (data.dayOfWeek === undefined) {
      ctx.addIssue({ code: "custom", path: ["dayOfWeek"], message: "dayOfWeek es obligatorio para reservas recurrentes" });
    }
    if (data.date !== undefined) {
      ctx.addIssue({ code: "custom", path: ["date"], message: "date no aplica a reservas recurrentes" });
    }
  } else {
    if (data.date === undefined) {
      ctx.addIssue({ code: "custom", path: ["date"], message: "date es obligatorio para reservas puntuales" });
    }
    if (data.dayOfWeek !== undefined) {
      ctx.addIssue({ code: "custom", path: ["dayOfWeek"], message: "dayOfWeek se deriva automáticamente de la fecha" });
    }
  }
};

export const createReservationSchema = z.object({
  classroomId: z.string().min(1),
  semesterId: z.string().min(1),
  type: reservationTypeSchema,
  dayOfWeek: dayOfWeekSchema.optional(),
  date: z.coerce.date().optional(),
  timeSlotId: z.string().min(1),
  note: z.string().max(500).trim().nullish(),
}).superRefine(conditionalFieldsRefine);

/// El tipo de reserva es inmutable: cambiar entre recurrente y puntual
/// requiere cancelar y crear una nueva reserva.
export const updateReservationSchema = z.object({
  classroomId: z.string().min(1).optional(),
  timeSlotId: z.string().min(1).optional(),
  dayOfWeek: dayOfWeekSchema.optional(),
  date: z.coerce.date().optional(),
  note: z.string().max(500).trim().nullish().optional(),
}).refine(obj => Object.keys(obj).length > 0, { message: "Al menos un campo requerido" });

export const updateReservationStatusSchema = z.object({
  status: z.enum(["CONFIRMADA", "CANCELADA"]),
});

export type ListReservationsQuery = z.infer<typeof listReservationsQuerySchema>;
export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;
export type UpdateReservationStatusInput = z.infer<typeof updateReservationStatusSchema>;
