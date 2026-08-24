import { z } from "zod";
import { dayOfWeekSchema } from "./shared.schema";

export { idParamsSchema } from "./shared.schema";

export const listSchedulesQuerySchema = z.object({
  classroomId: z.string().min(1),
  semesterId: z.string().min(1),
});

export const createScheduleSchema = z.object({
  classroomId: z.string().min(1),
  semesterId: z.string().min(1),
  subjectId: z.string().min(1),
  teacherId: z.string().min(1).nullish(),
  dayOfWeek: dayOfWeekSchema,
  timeSlotId: z.string().min(1),
  note: z.string().max(500).trim().nullish(),
});

export const updateScheduleSchema = z.object({
  classroomId: z.string().min(1).optional(),
  semesterId: z.string().min(1).optional(),
  subjectId: z.string().min(1).optional(),
  teacherId: z.string().min(1).nullish().optional(),
  dayOfWeek: dayOfWeekSchema.optional(),
  timeSlotId: z.string().min(1).optional(),
  note: z.string().max(500).trim().nullish().optional(),
}).refine(obj => Object.keys(obj).length > 0, { message: "Al menos un campo requerido" });

export type ListSchedulesQuery = z.infer<typeof listSchedulesQuerySchema>;
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
