import { z } from "zod";
import { paginationSchema, searchQuerySchema, includeInactiveQuerySchema } from "./shared.schema";

export { idParamsSchema } from "./shared.schema";

export const listTeachersQuerySchema = paginationSchema.merge(searchQuerySchema).merge(includeInactiveQuerySchema);

export const createTeacherSchema = z.object({
  code: z.string().min(2).max(30).transform(s => s.trim().toUpperCase()),
  name: z.string().min(2).max(120).trim(),
  email: z.email().nullish(),
});

export const updateTeacherSchema = z.object({
  name: z.string().min(2).max(120).trim().optional(),
  email: z.email().nullish().optional(),
  active: z.boolean().optional(),
}).refine(obj => Object.keys(obj).length > 0, { message: "Al menos un campo requerido" });

export type ListTeachersQuery = z.infer<typeof listTeachersQuerySchema>;
export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;
