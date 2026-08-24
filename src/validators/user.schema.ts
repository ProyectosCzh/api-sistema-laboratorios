import { z } from "zod";
import { paginationSchema, searchQuerySchema, userRoleSchema } from "./shared.schema";

export { idParamsSchema } from "./shared.schema";

export const listUsersQuerySchema = paginationSchema.merge(searchQuerySchema);

export const createUserSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.email().max(254).transform(e => e.toLowerCase()),
  password: z.string().min(8).max(100),
  role: userRoleSchema,
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  email: z.email().max(254).transform(e => e.toLowerCase()).optional(),
  password: z.string().min(8).max(100).optional(),
  role: userRoleSchema.optional(),
  active: z.boolean().optional(),
}).refine(obj => Object.keys(obj).length > 0, { message: "Al menos un campo requerido" });

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
