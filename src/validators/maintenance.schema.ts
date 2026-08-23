import { z } from "zod";
import { maintenanceStatusSchema, paginationSchema } from "./shared.schema";

export { idParamsSchema } from "./shared.schema";

export const listMaintenanceQuerySchema = z.object({
  classroomId: z.string().min(1).optional(),
  status: maintenanceStatusSchema.optional(),
}).merge(paginationSchema);

export const createMaintenanceSchema = z.object({
  classroomId: z.string().min(1),
  date: z.coerce.date(),
  reason: z.string().min(3).max(500).trim(),
});

export const updateMaintenanceSchema = z.object({
  status: maintenanceStatusSchema,
});

export type ListMaintenanceQuery = z.infer<typeof listMaintenanceQuerySchema>;
export type CreateMaintenanceInput = z.infer<typeof createMaintenanceSchema>;
export type UpdateMaintenanceInput = z.infer<typeof updateMaintenanceSchema>;
