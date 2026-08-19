import type { User } from "../types";

export function toPublicUser(u: { id: string; name: string; email: string; role: "ENCARGADO" | "AYUDANTE"; active: boolean; createdAt: Date; updatedAt: Date; passwordHash: string }): User {
  const { passwordHash, ...rest } = u;
  return {
    ...rest,
    createdAt: rest.createdAt.toISOString(),
    updatedAt: rest.updatedAt.toISOString(),
  };
}