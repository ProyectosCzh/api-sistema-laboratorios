import { z } from "zod";

export const loginSchema = z.object({
  email: z.email().max(254).transform(e => e.toLowerCase()),
  password: z.string().min(1).max(100),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  email: z.email().max(254).transform(e => e.toLowerCase()).optional(),
}).refine(obj => Object.keys(obj).length > 0, { message: "Al menos un campo requerido" });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(100),
  newPassword: z.string().min(8).max(100),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
