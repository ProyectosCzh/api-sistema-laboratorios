import { z } from "zod";

export { idParamsSchema } from "./shared.schema";

export const listSchedulesQuerySchema = z.object({
  classroomId: z.string().min(1),
  semesterId: z.string().min(1),
});

export const createScheduleSchema = z.object({
  classroomId: z.string().min(1),
  semesterId: z.string().min(1),
  courseOfferingId: z.string().min(1),
  dayOfWeek: z.coerce.number().int().min(1).max(6),
  timeSlotId: z.string().min(1),
  note: z.string().max(500).trim().nullish(),
});

export const updateScheduleSchema = z.object({
  classroomId: z.string().min(1).optional(),
  semesterId: z.string().min(1).optional(),
  courseOfferingId: z.string().min(1).optional(),
  dayOfWeek: z.coerce.number().int().min(1).max(6).optional(),
  timeSlotId: z.string().min(1).optional(),
  note: z.string().max(500).trim().nullish().optional(),
}).refine(obj => Object.keys(obj).length > 0, { message: "Al menos un campo requerido" });

export type ListSchedulesQuery = z.infer<typeof listSchedulesQuerySchema>;
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
