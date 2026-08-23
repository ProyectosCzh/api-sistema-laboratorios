import { z } from "zod";
import { timeStringSchema } from "./shared.schema";

export { idParamsSchema } from "./shared.schema";

const baseTimeSlotSchema = z.object({
  label: z.string().min(1).max(60).trim(),
  startTime: timeStringSchema,
  endTime: timeStringSchema,
  order: z.coerce.number().int().min(1).max(100),
}).refine(data => data.endTime > data.startTime, {
  message: "endTime debe ser posterior a startTime",
  path: ["endTime"],
});

export const createTimeSlotSchema = baseTimeSlotSchema;

export const updateTimeSlotSchema = z.object({
  label: z.string().min(1).max(60).trim().optional(),
  startTime: timeStringSchema.optional(),
  endTime: timeStringSchema.optional(),
  order: z.coerce.number().int().min(1).max(100).optional(),
}).refine(
  data => Object.keys(data).length > 0 && !(data.startTime && data.endTime && data.endTime <= data.startTime),
  { message: "Al menos un campo requerido y endTime debe ser posterior a startTime" }
);

export type CreateTimeSlotInput = z.infer<typeof createTimeSlotSchema>;
export type UpdateTimeSlotInput = z.infer<typeof updateTimeSlotSchema>;
