import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { ApiErrors } from "../utils/errors";
import { toPublicUser } from "../utils/serializers";
import type { User } from "../types";

const DUMMY_HASH = "$2b$12$4Ho6xOIYPP6uKVrpf5dUQePwuNVVOzpON0JE4hxfALq0aZwoqsQeu";

export async function login(email: string, password: string): Promise<{ token: string; user: User }> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw ApiErrors.invalidCredentials();

  if (!user.active) throw ApiErrors.userInactive();

  const token = jwt.sign({ sub: user.id }, env.jwtSecret, { expiresIn: "12h" });
  return { token, user: toPublicUser(user) };
}

export async function me(userId: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiErrors.tokenInvalid();
  return toPublicUser(user);
}