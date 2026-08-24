import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { cache } from "../cache";
import { CACHE_KEYS, CACHE_POLICIES } from "../cache/policies";
import { ApiErrors } from "../utils/errors";
import { buildMeta, buildPagination, PaginatedResult } from "../utils/pagination";
import { toPublicUser } from "../utils/serializers";
import { revokeAllSessionsForUser } from "./auth.service";
import type { User } from "../types";
import type { ListUsersQuery } from "../validators/user.schema";

export async function listUsers(query: ListUsersQuery): Promise<PaginatedResult<User>> {
  const { page, pageSize, q } = query;
  const { skip, take } = buildPagination(page, pageSize);

  const where: Prisma.UserWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.user.count({ where }),
  ]);

  return { items: users.map(toPublicUser), meta: buildMeta(total, page, pageSize) };
}

/**
 * Lectura de usuario por id vía cache (user:{id}, 60s). Devuelve null si no
 * existe (cache negativo) para no golpear la BD en cada request de auth.
 * Toda escritura de usuario DEBE invalidar la clave.
 */
export async function findUserCached(id: string): Promise<User | null> {
  return cache.getOrSet(
    CACHE_KEYS.user(id),
    async () => {
      const user = await prisma.user.findUnique({ where: { id } });
      return user ? toPublicUser(user) : null;
    },
    CACHE_POLICIES.userById
  );
}

export async function getUser(id: string): Promise<User> {
  const user = await findUserCached(id);
  if (!user) throw ApiErrors.notFound("Usuario no encontrado");
  return user;
}

export async function createUser(data: { name: string; email: string; password: string; role: "ENCARGADO" | "AYUDANTE" }): Promise<User> {
  const passwordHash = await bcrypt.hash(data.password, 12);
  const { password, ...rest } = data;
  const user = await prisma.user.create({
    data: { ...rest, email: rest.email.toLowerCase(), passwordHash },
  });
  return toPublicUser(user);
}

/**
 * Actualiza un usuario. Si cambia role/active revoca todas sus sesiones
 * (excepto la del propio actor si se indica) y SIEMPRE invalida `user:{id}`.
 */
export async function updateUser(
  id: string,
  data: { name?: string; email?: string; password?: string; role?: "ENCARGADO" | "AYUDANTE"; active?: boolean },
  opts?: { keepSessionId?: string }
): Promise<User> {
  const updateData: typeof data & { passwordHash?: string } = { ...data };
  if (data.password) {
    updateData.passwordHash = await bcrypt.hash(data.password, 12);
    delete updateData.password;
  }
  if (data.email) {
    updateData.email = data.email.toLowerCase();
  }
  const user = await prisma.user.update({ where: { id }, data: updateData });
  cache.del(CACHE_KEYS.user(id));
  if (data.role !== undefined || data.active !== undefined) {
    await revokeAllSessionsForUser(id, opts?.keepSessionId);
  }
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
  cache.del(CACHE_KEYS.user(id));
}
