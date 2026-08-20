import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { ApiErrors } from "../utils/errors";
import { toPublicUser } from "../utils/serializers";
import type { User } from "../types";

export async function listUsers(): Promise<User[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });
  return users.map(toPublicUser);
}

export async function createUser(data: { name: string; email: string; password: string; role: "ENCARGADO" | "AYUDANTE" }): Promise<User> {
  const passwordHash = await bcrypt.hash(data.password, 12);
  const { password, ...rest } = data;
  const user = await prisma.user.create({
    data: { ...rest, email: rest.email.toLowerCase(), passwordHash },
  });
  return toPublicUser(user);
}

export async function updateUser(id: string, data: { name?: string; email?: string; password?: string; role?: "ENCARGADO" | "AYUDANTE"; active?: boolean }): Promise<User> {
  const updateData: typeof data & { passwordHash?: string } = { ...data };
  if (data.password) {
    updateData.passwordHash = await bcrypt.hash(data.password, 12);
    delete updateData.password;
  }
  if (data.email) {
    updateData.email = data.email.toLowerCase();
  }
  const user = await prisma.user.update({ where: { id }, data: updateData });
  return toPublicUser(user);
}

export async function deleteUser(id: string, currentUserId: string): Promise<void> {
  if (id === currentUserId) throw ApiErrors.cannotDeleteSelf();

  const [schedulesCount, annotationsCount, maintenanceCount] = await Promise.all([
    prisma.schedule.count({ where: { assignedById: id } }),
    prisma.annotation.count({ where: { userId: id } }),
    prisma.maintenanceLog.count({ where: { createdById: id } }),
  ]);

  if (schedulesCount > 0 || annotationsCount > 0 || maintenanceCount > 0) {
    throw ApiErrors.userHasDependencies();
  }

  await prisma.user.delete({ where: { id } });
}