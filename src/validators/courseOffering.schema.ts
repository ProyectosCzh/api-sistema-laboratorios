import { z } from "zod";
import { offeringTypeSchema, paginationSchema, includeInactiveQuerySchema } from "./shared.schema";

export { idParamsSchema } from "./shared.schema";

export const listOfferingsQuerySchema = z.object({
  semesterId: z.string().min(1),
  subjectId: z.string().min(1).optional(),
}).merge(paginationSchema).merge(includeInactiveQuerySchema);

export const createOfferingSchema = z.object({
  semesterId: z.string().min(1),
  subjectId: z.string().min(1),
  teacherId: z.string().min(1).nullish(),
  section: z.string().min(1).max(20).transform(s => s.trim()),
  type: offeringTypeSchema.optional(),
  note: z.string().max(500).trim().nullish(),
});

export const updateOfferingSchema = z.object({
  teacherId: z.string().min(1).nullish().optional(),
  section: z.string().min(1).max(20).transform(s => s.trim()).optional(),
  type: offeringTypeSchema.optional(),
  active: z.boolean().optional(),
  note: z.string().max(500).trim().nullish().optional(),
}).refine(obj => Object.keys(obj).length > 0, { message: "Al menos un campo requerido" });

export type ListOfferingsQuery = z.infer<typeof listOfferingsQuerySchema>;
export type CreateOfferingInput = z.infer<typeof createOfferingSchema>;
export type UpdateOfferingInput = z.infer<typeof updateOfferingSchema>;
