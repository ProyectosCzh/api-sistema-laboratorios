import { z } from "zod";
import { paginationSchema, searchQuerySchema, includeInactiveQuerySchema } from "./shared.schema";

export { idParamsSchema } from "./shared.schema";

export const listSubjectsQuerySchema = paginationSchema.merge(searchQuerySchema).merge(includeInactiveQuerySchema);

export const createSubjectSchema = z.object({
  code: z.string().min(2).max(20).transform(s => s.trim().toUpperCase()),
  name: z.string().min(2).max(120).trim(),
});

export const updateSubjectSchema = z.object({
  code: z.string().min(2).max(20).transform(s => s.trim().toUpperCase()).optional(),
  name: z.string().min(2).max(120).trim().optional(),
  active: z.boolean().optional(),
}).refine(obj => Object.keys(obj).length > 0, { message: "Al menos un campo requerido" });

export type ListSubjectsQuery = z.infer<typeof listSubjectsQuerySchema>;
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
