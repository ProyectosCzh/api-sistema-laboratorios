import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { ApiErrors } from "../utils/errors";
import type { User } from "../types";

export async function login(email: string, password: string): Promise<{ token: string; user: User }> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw ApiErrors.invalidCredentials();

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw ApiErrors.invalidCredentials();

  if (!user.active) throw ApiErrors.userInactive();

  const token = jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: "12h" });
  return { token, user: toPublicUser(user) };
}

export async function me(userId: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiErrors.tokenInvalid();
  return toPublicUser(user);
}

function toPublicUser(u: { id: string; name: string; email: string; passwordHash: string; role: "ENCARGADO" | "AYUDANTE"; active: boolean; createdAt: Date; updatedAt: Date }): User {
  const { passwordHash, ...rest } = u;
  return {
    ...rest,
    createdAt: rest.createdAt.toISOString(),
    updatedAt: rest.updatedAt.toISOString(),
  };
}