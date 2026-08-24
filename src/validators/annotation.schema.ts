import { z } from "zod";
import { paginationSchema } from "./shared.schema";

export { idParamsSchema } from "./shared.schema";

export const listAnnotationsQuerySchema = z.object({
  classroomId: z.string().min(1),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).merge(paginationSchema);

export const createAnnotationSchema = z.object({
  classroomId: z.string().min(1),
  content: z.string().min(1).max(1000).trim(),
});

export const updateAnnotationSchema = z.object({
  content: z.string().min(1).max(1000).trim(),
});

export type ListAnnotationsQuery = z.infer<typeof listAnnotationsQuerySchema>;
export type CreateAnnotationInput = z.infer<typeof createAnnotationSchema>;
export type UpdateAnnotationInput = z.infer<typeof updateAnnotationSchema>;
