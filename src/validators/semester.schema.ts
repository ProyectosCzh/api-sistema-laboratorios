import { z } from "zod";
import { paginationSchema } from "./shared.schema";

export { idParamsSchema } from "./shared.schema";

export const listSemestersQuerySchema = paginationSchema;

const dateRangeRefine = (data: { startDate?: Date; endDate?: Date }, ctx: z.RefinementCtx) => {
  if (data.startDate && data.endDate && data.endDate <= data.startDate) {
    ctx.addIssue({ code: "custom", message: "endDate debe ser posterior a startDate", path: ["endDate"] });
  }
};

export const createSemesterSchema = z.object({
  name: z.string().min(2).max(20).trim(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).superRefine(dateRangeRefine);

export const updateSemesterSchema = z.object({
  name: z.string().min(2).max(20).trim().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).superRefine(dateRangeRefine);

export type ListSemestersQuery = z.infer<typeof listSemestersQuerySchema>;
export type CreateSemesterInput = z.infer<typeof createSemesterSchema>;
export type UpdateSemesterInput = z.infer<typeof updateSemesterSchema>;
