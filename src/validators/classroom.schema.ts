import { z } from "zod";
import {
  classroomStatusSchema,
  classroomTypeSchema,
  includeInactiveQuerySchema,
  paginationSchema,
  searchQuerySchema,
} from "./shared.schema";

export { idParamsSchema } from "./shared.schema";

export const listClassroomsQuerySchema = paginationSchema
  .extend({ status: classroomStatusSchema.optional() })
  .merge(searchQuerySchema)
  .merge(includeInactiveQuerySchema);

export const createClassroomSchema = z.object({
  code: z.string().min(2).max(20).transform(s => s.trim().toUpperCase()),
  name: z.string().min(2).max(100).trim(),
  type: classroomTypeSchema,
  capacity: z.coerce.number().int().min(1).max(500).optional(),
  location: z.string().max(200).trim().nullish(),
});

export const updateClassroomSchema = z.object({
  code: z.string().min(2).max(20).transform(s => s.trim().toUpperCase()).optional(),
  name: z.string().min(2).max(100).trim().optional(),
  type: classroomTypeSchema.optional(),
  status: classroomStatusSchema.optional(),
  capacity: z.coerce.number().int().min(1).max(500).optional(),
  location: z.string().max(200).trim().nullish().optional(),
}).refine(obj => Object.keys(obj).length > 0, { message: "Al menos un campo requerido" });

export type ListClassroomsQuery = z.infer<typeof listClassroomsQuerySchema>;
export type CreateClassroomInput = z.infer<typeof createClassroomSchema>;
export type UpdateClassroomInput = z.infer<typeof updateClassroomSchema>;

export const stateQuerySchema = z.object({
  date: z.coerce.date().optional(),
  timeSlotId: z.string().min(1).optional(),
});
